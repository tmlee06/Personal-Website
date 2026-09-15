#!/usr/bin/env node
// Batch-generates natural-sounding narration audio for every published log,
// using Microsoft Edge's online neural voices via the `msedge-tts` package —
// the same free voice engine behind Edge's built-in "Read Aloud" feature.
// No API key, no cloud account, no billing anywhere; genuinely $0. (It's an
// unofficial client for an internal Microsoft endpoint, not a published
// public API — if it ever stops working, only this one script needs to
// change, since the reader in script.js just plays whatever .mp3 files
// end up in audio-manifest.json regardless of how they were made.)
//
// Safe to re-run any time: each log's narration is keyed by a sha256 of its
// raw markdown file, so an unedited log is never re-synthesized, and only
// logs that actually changed since the last run get regenerated. See
// initReaderTTS/resolvePrerenderedAudio in script.js for how the reader
// picks this up — it plays the pre-rendered file whenever the hash still
// matches what's on the page, and falls back to the live browser voice
// otherwise (new log, or edited but not yet regenerated).
//
// One-time setup:
//   npm install
//
// Usage:
//   node scripts/build-tts-audio.js            # generate/update audio
//   node scripts/build-tts-audio.js --dry-run  # print what *would* be
//                                               # generated and the total
//                                               # character count, without
//                                               # contacting Edge's service
//
// Voice defaults to en-US-AndrewNeural. Microsoft ships several names in
// two tiers — a classic neural voice and a newer "Multilingual" version
// with identical personality tags (e.g. AndrewNeural and
// AndrewMultilingualNeural are both "Warm, Confident, Authentic, Honest").
// The Multilingual tier sounds marginally more natural but turned out to be
// unreliable on this free/unofficial endpoint — proven directly: the exact
// same request chunks sent back-to-back both timed out on
// AndrewMultilingualNeural and both succeeded instantly on a classic voice,
// at the same moment, ruling out general outage/throttling/pacing as the
// cause. The classic tier is the one worth defaulting to as a result.
// Override with the EDGE_TTS_VOICE env var. List every available voice
// with: node -e "const {MsEdgeTTS}=require('msedge-tts'); new MsEdgeTTS().getVoices().then(v=>console.log(v.map(x=>x.ShortName).join('\n')))"

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');

const ROOT = path.resolve(__dirname, '..');
const INDEX_PATH = path.join(ROOT, 'logs-index.json');
const MANIFEST_PATH = path.join(ROOT, 'audio-manifest.json');

const DRY_RUN = process.argv.includes('--dry-run');
// Internal flag, not a public option (not in the usage comment above) — the
// top-level run spawns one of these per file rather than calling
// synthesizeAndWriteFile in-process for all of them. See the big comment on
// runOneFileInSubprocess below for why.
const workerFlagIndex = process.argv.indexOf('--worker');
const WORKER_REL_PATH = workerFlagIndex !== -1 ? process.argv[workerFlagIndex + 1] : null;
// Was 1500 — cut hard after a session of heavy testing left the endpoint
// visibly degraded: side-by-side tests kept showing small requests (a few
// hundred bytes) succeeding reliably while ~1400+ byte requests failed, at
// the exact same moment, on the exact same voice. That's not the original
// "~750-1800 clean, climbs past that" baseline (see the old comment this
// replaced) — today's threshold is much lower, almost certainly from this
// session's own cumulative request volume against a free, undocumented-
// limit endpoint. Small chunks land in the zone that kept working through
// every test today, at the cost of more (slower) requests per file.
const MAX_CHUNK_BYTES = 400;
const REQUEST_TIMEOUT_MS = 15000;
const MAX_ATTEMPTS = 5;
const VOICE_NAME = process.env.EDGE_TTS_VOICE || 'en-US-AndrewNeural';

// Adaptive pacing between requests, instead of one fixed delay guessed up
// front (which is either needlessly slow on a healthy connection or still
// gets throttled on a bad one). A full-batch run once got hammered hard by
// Edge's endpoint — every multi-chunk file failed outright while single-
// request files kept succeeding — which points at rate-limiting triggered
// by request *frequency*, something only visible from inside the run
// itself. So the delay self-tunes off real results as it goes: any failure
// (including a single retry inside synthesizeChunk, not just a whole
// chunk giving up) jumps it toward MAX_PACING_MS right away, and a streak
// of clean requests eases it back down toward MIN_PACING_MS. No batching/
// cooldown babysitting from outside the script needed. Floor raised from
// 600ms alongside the chunk-size cut above, for the same reason: stay
// gentler than today's proven-safe rate, not just react after the fact.
const MIN_PACING_MS = 900;
const MAX_PACING_MS = 20000;
const INITIAL_PACING_MS = 2000;
const PACING_BACKOFF_MULTIPLIER = 2.2; // failure: back off hard and fast
const PACING_RECOVERY_MULTIPLIER = 0.85; // success: ease off gradually
let pacingMs = INITIAL_PACING_MS;

function onRequestSuccess() {
    pacingMs = Math.max(MIN_PACING_MS, Math.round(pacingMs * PACING_RECOVERY_MULTIPLIER));
}

function onRequestFailure() {
    pacingMs = Math.min(MAX_PACING_MS, Math.round(pacingMs * PACING_BACKOFF_MULTIPLIER));
}

// Every log path referenced anywhere in logs-index.json — the same tree
// build-logs-index.js walks — regardless of which folder node it's nested
// under. This (not frontmatter) is this repo's actual "is it published"
// signal, since most logs carry no frontmatter at all.
function collectPublishedPaths(nodes, set) {
    (nodes || []).forEach((node) => {
        (node.logs || []).forEach((log) => {
            if (log && log.path) set.add(log.path);
        });
        collectPublishedPaths(node.folders, set);
    });
}

function findPublishedLogFiles() {
    const index = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
    const paths = new Set();
    collectPublishedPaths(index, paths);
    return Array.from(paths)
        .map((relPath) => path.join(ROOT, relPath))
        .filter((abs) => fs.existsSync(abs));
}

// Frontmatter, if present at all, isn't prose — strip it so it doesn't get
// read aloud.
function stripFrontmatter(text) {
    const m = text.match(/^---\s*\n[\s\S]*?\n---\s*\n?([\s\S]*)$/);
    return m ? m[1] : text;
}

// Markdown -> plain narration text. Doesn't need to be a full parser (that's
// marked's job for on-page rendering) — just needs to strip syntax well
// enough to read naturally aloud. Order matters: code/images go first so
// nothing downstream mangles their contents.
function markdownToPlainText(md) {
    let text = md;
    text = text.replace(/```[\s\S]*?```/g, ' ');           // fenced code blocks
    text = text.replace(/`([^`]+)`/g, '$1');                // inline code
    text = text.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ');      // images
    text = text.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');    // links -> link text
    text = text.replace(/<[^>]+>/g, ' ');                   // raw HTML/embeds
    text = text.replace(/^\s*#{1,6}\s*/gm, '');             // heading markers
    text = text.replace(/^\s*>\s?/gm, '');                  // blockquote markers
    text = text.replace(/^\s*([-*+]|\d+\.)\s+/gm, '');      // list markers
    text = text.replace(/^\s*-{3,}\s*$/gm, ' ');            // hr
    text = text.replace(/\|/g, ' ');                        // table pipes
    text = text.replace(/(\*\*|__)(.*?)\1/g, '$2');         // bold
    text = text.replace(/(\*|_)(.*?)\1/g, '$2');            // italic
    text = text.replace(/[ \t]+/g, ' ');
    text = text.replace(/\n{3,}/g, '\n\n');
    return text.trim();
}

// Splits on paragraph boundaries first (natural pause points), only falling
// back to sentence-splitting for the rare paragraph that alone exceeds the
// per-request byte cap.
// Greedily packs `pieces` (rejoined with `sep`) into chunks no larger than
// maxBytes. A piece that's *itself* still too big gets handed to `finer`
// (a function breaking that one piece down at a smaller granularity) rather
// than ever being emitted oversized — layered below into paragraphs ->
// sentences -> lines -> words. That last fallback matters more than it
// looks: a checklist-style log (bullet items, no terminal punctuation on
// most lines) used to sail straight through the old paragraph/sentence-only
// version as one multi-KB "sentence" with nowhere to break, silently
// blowing past maxBytes and reliably timing out against Edge's endpoint —
// found by comparing what this function produced against what actually got
// sent over the wire, not by guessing.
function splitIntoChunks(text, maxBytes) {
    const byteLen = (s) => Buffer.byteLength(s, 'utf8');

    function pack(pieces, sep, finer) {
        const chunks = [];
        let current = '';
        function pushCurrent() { if (current) chunks.push(current.trim()); current = ''; }
        for (const piece of pieces) {
            const candidate = current ? current + sep + piece : piece;
            if (byteLen(candidate) <= maxBytes) { current = candidate; continue; }
            pushCurrent();
            if (byteLen(piece) <= maxBytes) { current = piece; continue; }
            // Still too big on its own — break it down further, or (only at
            // the word level, with nothing finer left) emit it as-is.
            chunks.push(...(finer ? finer(piece) : [piece]));
        }
        pushCurrent();
        return chunks;
    }

    const byWords = (piece) => pack(piece.split(/\s+/).filter(Boolean), ' ', null);
    const byLines = (piece) => pack(piece.split('\n').map((l) => l.trim()).filter(Boolean), '\n', byWords);
    const bySentences = (piece) => pack(piece.split(/(?<=[.!?])\s+/), ' ', byLines);
    const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
    return pack(paragraphs, '\n\n', bySentences);
}

// One fresh connection per chunk — simplest way to stay reliable against
// the underlying websocket dropping on a long-running client.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// msedge-tts builds its request by dropping the input straight into an XML
// (SSML) template with zero escaping — confirmed directly: a chunk with a
// bare "&" in it (e.g. "Mom & Dad") reliably breaks the connection with
// "closed before turn.end" every single time, while the exact same text
// minus the "&" goes through fine. That, not flakiness or throttling, is
// why the same handful of logs (the ones with an "&", or a stray "<"/">")
// failed 100% of the time on every previous run no matter how much retry/
// backoff/socket-cleanup was thrown at it — escaping is the actual fix.
function escapeSsmlText(text) {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// This is also an unofficial client for an internal Microsoft endpoint with
// no documented rate limit or SLA, so on top of the escaping fix above,
// close() unconditionally on every exit path (success, error, or timeout)
// — msedge-tts doesn't release its websocket on its own once a stream
// ends, and leaving dozens of those open across one long batch run is its
// own way to eventually start failing requests.
function synthesizeChunkOnce(text) {
    return new Promise((resolve, reject) => {
        const tts = new MsEdgeTTS();
        let settled = false;
        const done = (fn, arg) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            try { tts.close(); } catch (e) { /* already closed/errored — fine */ }
            fn(arg);
        };
        const timer = setTimeout(() => {
            done(reject, new Error(`Timed out after ${REQUEST_TIMEOUT_MS}ms waiting for Edge TTS`));
        }, REQUEST_TIMEOUT_MS);

        (async () => {
            await tts.setMetadata(VOICE_NAME, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
            const { audioStream } = tts.toStream(escapeSsmlText(text));
            const chunks = [];
            audioStream.on('data', (d) => chunks.push(d));
            audioStream.on('end', () => done(resolve, Buffer.concat(chunks)));
            audioStream.on('error', (err) => done(reject, err));
        })().catch((err) => done(reject, err));
    });
}

// A short percentage of individual requests failing/timing out is just how
// this particular free, unofficial endpoint behaves (confirmed by testing
// it directly, not assumed) — retrying clears it almost every time without
// needing a person to babysit a 49-file run. The backoff between retries is
// the same self-tuning pacingMs everything else uses (see onRequestFailure
// above), not a separate fixed formula, so a chunk that's struggling backs
// off exactly as hard as the rest of the run just did.
async function synthesizeChunk(text, attempt = 1) {
    try {
        const buf = await synthesizeChunkOnce(text);
        onRequestSuccess();
        return buf;
    } catch (err) {
        onRequestFailure();
        if (attempt >= MAX_ATTEMPTS) throw err;
        await sleep(pacingMs);
        return synthesizeChunk(text, attempt + 1);
    }
}

// The manifest-reading half of task discovery, extracted so both the
// top-level scan (many files) and a single --worker invocation (one
// specific relPath, handed down by the parent) can share it.
function buildTask(relPath, manifest) {
    const abs = path.join(ROOT, relPath);
    const raw = fs.readFileSync(abs, 'utf8');
    const body = stripFrontmatter(raw);

    const hash = crypto.createHash('sha256').update(raw).digest('hex').slice(0, 16);
    const outRel = 'audio/' + relPath.replace(/^logs\//, '').replace(/\.md$/i, '.mp3');
    const outAbs = path.join(ROOT, outRel);
    const existing = manifest[relPath];

    if (existing && existing.hash === hash && fs.existsSync(outAbs)) {
        return null; // unchanged since the last run
    }
    const plain = markdownToPlainText(body);
    if (!plain) return null;
    return { relPath, outRel, outAbs, hash, plain };
}

function findTasks() {
    const manifest = fs.existsSync(MANIFEST_PATH) ? JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8')) : {};
    const files = findPublishedLogFiles();
    const tasks = [];
    for (const abs of files) {
        const relPath = path.relative(ROOT, abs).split(path.sep).join('/'); // e.g. logs/Travel/.../chongqing2.md
        const task = buildTask(relPath, manifest);
        if (task) tasks.push(task);
    }
    return tasks;
}

// Synthesizes one file's audio and writes both the .mp3 and its
// audio-manifest.json entry. Re-reads the manifest from disk right before
// writing (rather than trusting a copy handed in) so this is safe to call
// from a short-lived --worker subprocess that has no memory of what any
// sibling process just wrote.
async function synthesizeAndWriteFile(f) {
    const chunks = splitIntoChunks(f.plain, MAX_CHUNK_BYTES);
    const buffers = [];
    for (const chunk of chunks) {
        buffers.push(await synthesizeChunk(chunk));
        await sleep(pacingMs); // self-tuning — see onRequestSuccess/onRequestFailure above
    }
    fs.mkdirSync(path.dirname(f.outAbs), { recursive: true });
    fs.writeFileSync(f.outAbs, Buffer.concat(buffers));

    const manifest = fs.existsSync(MANIFEST_PATH) ? JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8')) : {};
    manifest[f.relPath] = { hash: f.hash, file: f.outRel, voice: VOICE_NAME };
    fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n');
}

// --worker entry point: does exactly one file, then exits. Never throws out
// to a caller — the parent only ever sees this through the child's exit
// code, so every path here ends in process.exit().
async function runAsWorker(relPath) {
    const manifest = fs.existsSync(MANIFEST_PATH) ? JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8')) : {};
    const task = buildTask(relPath, manifest);
    if (!task) { process.exit(0); return; } // already up to date — nothing to do, not a failure
    try {
        await synthesizeAndWriteFile(task);
        console.log(`  -> ${task.outRel}`);
        process.exit(0);
    } catch (err) {
        console.error(`  FAILED: ${relPath} — ${err.message || err}`);
        process.exit(1);
    }
}

// Runs one file's synthesis in a brand-new child `node` process rather than
// in-process alongside every other file. This is the fix for a failure mode
// discovered the hard way: a single long-lived process working through
// dozens of files in a row would eventually get every request timing out —
// even maxed-out adaptive backoff (see pacingMs above) didn't recover it —
// while a fresh, short-lived process hitting the exact same endpoint with
// the exact same voice succeeded immediately, every time, no matter how
// many prior processes had just failed. That points at some kind of
// per-process connection/session state degrading with sustained use (this
// is an unofficial client for an undocumented endpoint, so there's no
// spec to check against) rather than real request-rate throttling — so the
// fix is to never let one process make "sustained use" of the endpoint in
// the first place. Costs a bit of Node startup overhead per file; worth it
// against actually losing whole runs.
function runOneFileInSubprocess(relPath) {
    return new Promise((resolve) => {
        const child = spawn(process.execPath, [__filename, '--worker', relPath], {
            stdio: 'inherit',
            env: process.env,
        });
        child.on('exit', (code) => resolve(code === 0));
        child.on('error', () => resolve(false));
    });
}

async function main() {
    if (WORKER_REL_PATH) {
        await runAsWorker(WORKER_REL_PATH);
        return;
    }

    const toGenerate = findTasks();

    if (!toGenerate.length) {
        console.log('Nothing to generate — every published log already has up-to-date narration.');
        return;
    }

    const totalChars = toGenerate.reduce((sum, f) => sum + f.plain.length, 0);
    console.log(`${toGenerate.length} log(s) need narration, ~${totalChars.toLocaleString()} characters total. Voice: ${VOICE_NAME}`);
    toGenerate.forEach((f) => console.log(`  ${DRY_RUN ? 'would generate' : 'queued'}: ${f.relPath} (${f.plain.length.toLocaleString()} chars)`));

    if (DRY_RUN) {
        console.log('\nDry run — nothing was sent to Edge, no requests made.');
        return;
    }

    const failed = [];

    for (const f of toGenerate) {
        console.log(`Generating ${f.relPath}...`);
        // One stubborn log (even after retries, in its own fresh process)
        // shouldn't sink the rest — note it and keep going. Since it's not
        // written to the manifest, the next run retries just this one.
        const ok = await runOneFileInSubprocess(f.relPath);
        if (!ok) failed.push(f.relPath);
    }

    if (failed.length) {
        console.log(`\nDone, with ${failed.length} failure(s) — re-run the script to retry just these:`);
        failed.forEach((p) => console.log(`  ${p}`));
    } else {
        console.log('\nDone.');
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
