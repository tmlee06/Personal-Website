#!/usr/bin/env node
// Batch-generates natural-sounding narration audio for every published log,
// in every language the site actually offers a translated reading of (see
// NARRATION_LANGS below), using Microsoft Edge's online neural voices via
// the `msedge-tts` package — the same free voice engine behind Edge's
// built-in "Read Aloud" feature — for the audio itself, and (for non-
// English narration) DeepL for translation when DEEPL_API_KEY is set,
// since it reads noticeably more natural than Google's translator and its
// free tier (500K chars/month) comfortably covers a full run in one sitting
// — falling back to Google's free/unofficial translate endpoint (via
// `@vitalets/google-translate-api`) and then MyMemory's free API if DeepL
// isn't configured or its monthly quota runs out. Both fallbacks are
// unofficial/anonymous services with real limits — found out the hard way
// that a full run can burn through Google's undocumented rate limit and
// MyMemory's small daily quota in a single sitting. Still genuinely $0
// either way; DeepL's free tier just needs a one-time account + API key
// instead of being fully keyless like the fallbacks. (If any of these ever
// stop working, only this one script needs to change, since the reader in
// script.js just plays whatever .mp3 files end up in audio-manifest.json
// regardless of how they were made.)
//
// Safe to re-run any time: each (log, language) pair's narration is keyed
// by a sha256 of the log's raw *English* markdown file (translation is
// deterministic from that source, so one hash covers every language), so
// an unedited log is never re-synthesized/re-translated, and only logs
// that actually changed since the last run get regenerated. See
// initReaderTTS/resolvePrerenderedAudio in script.js for how the reader
// picks this up — it plays the pre-rendered file for whichever language
// the page is currently showing, and simply hides the read-aloud controls
// otherwise (new log, edited but not yet regenerated, or a language this
// script doesn't narrate).
//
// One-time setup:
//   npm install
//
// Usage:
//   node scripts/build-tts-audio.js                    # generate/update audio
//   node scripts/build-tts-audio.js --only-lang en      # restrict to one
//                                                        # narration language
//                                                        # (e.g. when every
//                                                        # translation source
//                                                        # is tapped out but
//                                                        # Edge TTS is fine)
//   node scripts/build-tts-audio.js --dry-run  # print what *would* be
//                                               # generated and the total
//                                               # character count, without
//                                               # contacting either service
//
// English voice defaults to en-US-AndrewNeural. Microsoft ships several
// names in two tiers — a classic neural voice and a newer "Multilingual"
// version with identical personality tags (e.g. AndrewNeural and
// AndrewMultilingualNeural are both "Warm, Confident, Authentic, Honest").
// The Multilingual tier sounds marginally more natural but turned out to be
// unreliable on this free/unofficial endpoint — proven directly: the exact
// same request chunks sent back-to-back both timed out on
// AndrewMultilingualNeural and both succeeded instantly on a classic voice,
// at the same moment, ruling out general outage/throttling/pacing as the
// cause. The classic tier is the one worth defaulting to as a result, for
// every language here, not just English. Override per language with
// EDGE_TTS_VOICE / EDGE_TTS_VOICE_JA / EDGE_TTS_VOICE_ZH_TW. List every
// available voice with: node -e "const {MsEdgeTTS}=require('msedge-tts'); new MsEdgeTTS().getVoices().then(v=>console.log(v.map(x=>x.ShortName).join('\n')))"

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');
const { spawn } = require('child_process');
const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');
const { translate } = require('@vitalets/google-translate-api');

const ROOT = path.resolve(__dirname, '..');
const INDEX_PATH = path.join(ROOT, 'logs-index.json');
const MANIFEST_PATH = path.join(ROOT, 'audio-manifest.json');

// Bump on any change to how a log's markdown becomes spoken text
// (markdownToPlainText, splitIntoChunks) so every cached entry
// invalidates cleanly instead of drifting out of sync with what the
// current logic would actually produce for an unedited file. v2: images'
// alt text is now read aloud as a caption instead of being discarded.
//
// !! MUST be mirrored in script.js's NARRATION_LOGIC_VERSION_SALT !!
// Bumping only here once made every log's read-aloud button vanish
// site-wide (not just the ones this was meant to invalidate) — the
// browser was still hashing without the salt, so nothing could ever
// match again until both sides agreed. Change both, in the same commit.
const NARRATION_LOGIC_VERSION = '2';

const DRY_RUN = process.argv.includes('--dry-run');
// Internal flags, not public options (not in the usage comment above) — the
// top-level run spawns one of these per (file, language) rather than doing
// the work in-process for all of them. See the big comment on
// runOneFileInSubprocess below for why.
function argAfter(flag) {
    const i = process.argv.indexOf(flag);
    return i !== -1 ? process.argv[i + 1] : null;
}
const WORKER_REL_PATH = argAfter('--worker');
const WORKER_LANG = argAfter('--lang');
// Restricts a top-level (non-worker) run to one narration language — e.g.
// generating just 'en' when every translation source (DeepL/Google/
// MyMemory) happens to be tapped out at once but Edge TTS itself is fine,
// rather than every queued task failing at the translation step.
const ONLY_LANG = argAfter('--only-lang');

// Every language narration gets generated for. 'en' just reads the log's
// own text; anything else first machine-translates that same plain text
// (see translateLong) before handing it to Edge TTS in a voice for that
// language. 'ja' and 'zh-TW' match CURATED_LANGS / the quick-translate
// pills in script.js. 'yue' (Cantonese) is the exception — no mainstream
// translator (DeepL, Google, MyMemory) offers a distinct written-Cantonese
// target, so it reuses zh-TW's Traditional Chinese translation and just
// reads it with a Cantonese voice instead of Mandarin, which is standard
// practice for Cantonese TTS. It's also not confirmed reachable via the
// site's actual Google Translate widget (its language-popup wouldn't
// enumerate under automation to check) — narrationLangKey in script.js
// maps for it defensively in case a visitor ever reaches it, but treat it
// as "narration exists, live discoverability unconfirmed."
const NARRATION_LANGS = [
    { key: 'en', translateTo: null, voice: process.env.EDGE_TTS_VOICE || 'en-US-AndrewNeural' },
    { key: 'ja', translateTo: 'ja', voice: process.env.EDGE_TTS_VOICE_JA || 'ja-JP-KeitaNeural' },
    { key: 'zh-TW', translateTo: 'zh-TW', voice: process.env.EDGE_TTS_VOICE_ZH_TW || 'zh-TW-YunJheNeural' },
    { key: 'yue', translateTo: 'zh-TW', voice: process.env.EDGE_TTS_VOICE_YUE || 'zh-HK-WanLungNeural' },
];

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
//
// Images keep their alt text (when they have any) rather than vanishing
// entirely — most of this site's photos carry a real caption there (e.g.
// "*The Cyberpunk City*"), and those often carry as much of the story as
// the surrounding prose. A trailing period gives the narrator a clean
// pause before/after it instead of running it into whatever text is
// adjacent; a captionless image (`![]()`, the common case) still
// contributes nothing, same as before. Emphasis markers inside the
// caption (the asterisks above) get stripped later in this same pass,
// same as anywhere else in the prose.
function markdownToPlainText(md) {
    let text = md;
    text = text.replace(/```[\s\S]*?```/g, ' ');           // fenced code blocks
    text = text.replace(/`([^`]+)`/g, '$1');                // inline code
    text = text.replace(/!\[([^\]]*)\]\([^)]*\)/g, (m, alt) => (alt.trim() ? ` ${alt.trim()}. ` : ' ')); // images -> spoken caption
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

// Splits `text` into pieces no larger than maxBytes, preferring natural
// pause points (paragraphs, then sentences, then lines, then words) and
// only falling through to raw character-count slicing when nothing coarser
// finds anywhere to break. That last fallback matters more than it looks:
// a checklist-style log (bullet items, no terminal punctuation) used to
// sail straight through an earlier paragraph/sentence-only version as one
// multi-KB "sentence" with nowhere to break, silently blowing past
// maxBytes and reliably timing out against Edge's endpoint — found by
// comparing what this function produced against what actually got sent
// over the wire, not by guessing. Translated CJK text has the same
// problem from a different angle (no spaces between "words", full-width
// 。！？ instead of ASCII .!?), which is why the hard character-slice
// fallback exists at all: it's the one level that can't fail to shrink a
// piece, regardless of script or formatting.
function splitIntoChunks(text, maxBytes) {
    const byteLen = (s) => Buffer.byteLength(s, 'utf8');

    function hardSlice(piece) {
        const out = [];
        let i = 0;
        while (i < piece.length) {
            let size = maxBytes; // characters, shrunk below until the UTF-8 byte length fits
            let slice = piece.slice(i, i + size);
            while (byteLen(slice) > maxBytes && size > 1) {
                size--;
                slice = piece.slice(i, i + size);
            }
            out.push(slice);
            i += slice.length || 1;
        }
        return out;
    }

    function pack(pieces, sep, finer) {
        const chunks = [];
        let current = '';
        function pushCurrent() { if (current) chunks.push(current.trim()); current = ''; }
        for (const piece of pieces) {
            const candidate = current ? current + sep + piece : piece;
            if (byteLen(candidate) <= maxBytes) { current = candidate; continue; }
            pushCurrent();
            if (byteLen(piece) <= maxBytes) { current = piece; continue; }
            // Still too big on its own — break it down further (or, with
            // nothing finer defined, hard-slice it; every path bottoms out
            // there eventually, so maxBytes is never actually exceeded).
            chunks.push(...(finer ? finer(piece) : hardSlice(piece)));
        }
        pushCurrent();
        return chunks.filter(Boolean);
    }

    const byWords = (piece) => pack(piece.split(/\s+/).filter(Boolean), ' ', null);
    const byLines = (piece) => pack(piece.split('\n').map((l) => l.trim()).filter(Boolean), '\n', byWords);
    // Both ASCII (.!?) and full-width CJK (。！？) sentence terminators.
    const bySentences = (piece) => pack(piece.split(/(?<=[.!?。！？])\s*/), ' ', byLines);
    const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
    return pack(paragraphs, '\n\n', bySentences);
}

// One fresh connection per chunk — simplest way to stay reliable against
// the underlying websocket dropping on a long-running client.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --- Translation (DeepL) ---
// The primary translation source when configured — reads noticeably more
// natural than Google's translator (this is the engine a lot of human
// translators use as a starting point), and its free tier's 500K chars/
// month comfortably covers a full run of this site in one sitting, unlike
// the fallbacks below which both proved to have real limits under
// sustained batch use. Needs a free account + API key from
// https://www.deepl.com/pro-api — set DEEPL_API_KEY to enable; the script
// runs fine without it, just falls through to Google/MyMemory instead.
// Free-tier keys are suffixed ":fx", which is also how DeepL's own official
// clients decide which host to hit — api-free vs api (using the Pro host
// with a free-tier key, or vice versa, fails outright).
const DEEPL_API_KEY = process.env.DEEPL_API_KEY || null;
const DEEPL_HOST = DEEPL_API_KEY && DEEPL_API_KEY.endsWith(':fx') ? 'api-free.deepl.com' : 'api.deepl.com';
// Our internal language keys ('ja', 'zh-TW', matching Google/MyMemory's
// codes) -> DeepL's own target-language codes. ZH-HANT specifically, not
// bare ZH (which defaults to Simplified) — confirmed via DeepL's docs.
const DEEPL_LANG_CODE = { ja: 'JA', 'zh-TW': 'ZH-HANT' };
const DEEPL_MAX_ATTEMPTS = 3;

function deepLRequestOnce(text, to) {
    const targetLang = DEEPL_LANG_CODE[to];
    if (!targetLang) return Promise.reject(new Error(`DeepL: no target-language mapping for "${to}"`));
    const body = JSON.stringify({ text: [text], target_lang: targetLang, source_lang: 'EN' });
    return new Promise((resolve, reject) => {
        const req = https.request({
            hostname: DEEPL_HOST,
            path: '/v2/translate',
            method: 'POST',
            headers: {
                'Authorization': `DeepL-Auth-Key ${DEEPL_API_KEY}`,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body),
            },
            timeout: REQUEST_TIMEOUT_MS,
        }, (res) => {
            let data = '';
            res.on('data', (d) => { data += d; });
            res.on('end', () => {
                if (res.statusCode !== 200) {
                    const err = new Error(`DeepL HTTP ${res.statusCode}: ${data.slice(0, 300)}`);
                    err.statusCode = res.statusCode;
                    reject(err);
                    return;
                }
                try {
                    resolve(JSON.parse(data).translations[0].text);
                } catch (err) { reject(err); }
            });
        });
        req.on('timeout', () => req.destroy(new Error('DeepL request timed out')));
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

// Once the monthly quota's exhausted (DeepL returns 456), every further
// request in this run will fail the exact same way — this flag (per
// process, so per --worker file, since each is a fresh subprocess) stops
// paying for a doomed DeepL round-trip on every remaining chunk of the
// current file once that's confirmed, going straight to the fallback
// chain instead.
let deepLQuotaExceeded = false;
async function translateViaDeepL(text, to, attempt = 1) {
    try {
        return await deepLRequestOnce(text, to);
    } catch (err) {
        if (err.statusCode === 456) deepLQuotaExceeded = true;
        const retryable = err.statusCode === 429 || (err.statusCode >= 500 && err.statusCode < 600);
        if (!retryable || attempt >= DEEPL_MAX_ATTEMPTS) throw err;
        await sleep(1000 * attempt);
        return translateViaDeepL(text, to, attempt + 1);
    }
}

// --- Translation (Google's free/unofficial endpoint) ---
// Same "public web endpoint, no API key" philosophy as Edge TTS below,
// just for text instead of audio. Noticeably more reliable in testing than
// Edge's endpoint has been — occasional single-request 500s (~1 in 5 back
// to back), nowhere near the meltdown Edge TTS had under sustained use —
// so a small retry is enough; no need for the adaptive-pacing machinery
// built for that.
const TRANSLATE_MAX_ATTEMPTS = 4;
async function translateText(text, to, attempt = 1) {
    try {
        const res = await translate(text, { to });
        return res.text;
    } catch (err) {
        // A real 429 ("Too Many Requests", with err.status === 429 — this
        // endpoint says so explicitly, confirmed directly, unlike Edge
        // TTS's silent timeouts) needs real time to clear, not a quick
        // retry loop that just adds more load to the same block. Fail
        // fast instead (one immediate re-check in case it was a one-off)
        // and let this (file, language) pair land in the "re-run later"
        // list like any other failure — the exact same resumable design
        // Edge TTS synthesis already relies on, rather than hammering a
        // confirmed rate limit from inside one run.
        const isRateLimited = err && err.status === 429;
        const maxAttempts = isRateLimited ? 2 : TRANSLATE_MAX_ATTEMPTS;
        if (attempt >= maxAttempts) throw err;
        await sleep(isRateLimited ? 5000 : 1000 * attempt);
        return translateText(text, to, attempt + 1);
    }
}

// --- Translation fallback (MyMemory) ---
// A completely different free/keyless translation service — different
// provider, different IP-quota bucket, so a Google-side block (like the
// 429 that motivated adding this) doesn't necessarily block this too.
// Confirmed directly: 500 chars is the actual hard per-request cap (a 501+
// char request comes back HTTP 403 "QUERY LENGTH LIMIT EXCEEDED"), well
// under Google's effectively-whole-essay-in-one-request headroom, and its
// free daily quota is much smaller — this is a fallback to keep a run
// making *some* progress while Google's blocked, not a full replacement.
const MYMEMORY_MAX_CHUNK_BYTES = 480; // margin under the confirmed 500-char cap
function myMemoryRequestOnce(text, to) {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|${to}`;
    return new Promise((resolve, reject) => {
        const req = https.get(url, { timeout: REQUEST_TIMEOUT_MS }, (res) => {
            let data = '';
            res.on('data', (d) => { data += d; });
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json.responseStatus !== 200) {
                        reject(new Error(`MyMemory: ${json.responseDetails || json.responseStatus}`));
                        return;
                    }
                    resolve(json.responseData.translatedText);
                } catch (err) { reject(err); }
            });
        });
        req.on('timeout', () => req.destroy(new Error('MyMemory request timed out')));
        req.on('error', reject);
    });
}
async function translateViaMyMemory(text, to) {
    // Re-chunks at MyMemory's own (much smaller) size regardless of how
    // big the piece handed in was — this can be called with a whole
    // Google-sized (~4000 byte) piece that just failed over.
    const pieces = splitIntoChunks(text, MYMEMORY_MAX_CHUNK_BYTES);
    const translated = [];
    for (const piece of pieces) {
        translated.push(await myMemoryRequestOnce(piece, to));
        await sleep(400);
    }
    return translated.join(' ');
}

// DeepL first when configured and not already known to be out of quota for
// this run (better quality, bigger quota); Google next; MyMemory last. Each
// step only runs once the one before it has genuinely given up on this
// piece, rather than always paying for three services' worth of requests
// on the happy path.
async function translatePiece(text, to) {
    if (DEEPL_API_KEY && !deepLQuotaExceeded) {
        try {
            return await translateViaDeepL(text, to);
        } catch (deepLErr) { /* fall through to Google/MyMemory below */ }
    }
    try {
        return await translateText(text, to);
    } catch (googleErr) {
        try {
            return await translateViaMyMemory(text, to);
        } catch (fallbackErr) {
            throw googleErr; // Google's error is usually the more informative one
        }
    }
}

// Chunks translation input at a much bigger boundary than TTS uses (whole
// essays translated clean as one request in testing, up to ~14.5K chars —
// this is just headroom for anything longer, or for a chunk-level retry
// not having to redo an entire log's translation) and joins the results
// back into one block of target-language text ready for splitIntoChunks
// to hand to Edge TTS.
const TRANSLATE_CHUNK_BYTES = 4000;
// Keyed by (content hash, target language) — not by narration key — so
// 'zh-TW' and 'yue' share one cache entry: both translate English into
// the same Traditional Chinese text, just read by different voices
// (Mandarin vs. Cantonese pronunciation of the same written text, the
// standard approach since no mainstream translator offers a distinct
// Cantonese written target). Learned the hard way that skipping this
// meant literally paying to translate the same text twice — real
// quota burned on a free tier that isn't unlimited, found only after
// DeepL's monthly 1M-character allowance came back fully spent mid-run.
// Also means a retried synthesis (translation succeeded, TTS failed)
// never re-pays for translation on its next attempt either.
const TRANSLATION_CACHE_DIR = path.join(ROOT, '.tts-translation-cache');
function translationCachePath(hash, to) {
    return path.join(TRANSLATION_CACHE_DIR, `${hash}-${to}.txt`);
}
async function translateLong(hash, text, to) {
    const cachePath = translationCachePath(hash, to);
    if (fs.existsSync(cachePath)) return fs.readFileSync(cachePath, 'utf8');

    const pieces = splitIntoChunks(text, TRANSLATE_CHUNK_BYTES);
    const translated = [];
    for (const piece of pieces) {
        translated.push(await translatePiece(piece, to));
        await sleep(500);
    }
    const result = translated.join('\n\n');
    fs.mkdirSync(TRANSLATION_CACHE_DIR, { recursive: true });
    fs.writeFileSync(cachePath, result);
    return result;
}

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
function synthesizeChunkOnce(text, voice) {
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
            await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
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
async function synthesizeChunk(text, voice, attempt = 1) {
    try {
        const buf = await synthesizeChunkOnce(text, voice);
        onRequestSuccess();
        return buf;
    } catch (err) {
        onRequestFailure();
        if (attempt >= MAX_ATTEMPTS) throw err;
        await sleep(pacingMs);
        return synthesizeChunk(text, voice, attempt + 1);
    }
}

// Manifest entries used to be flat ({hash,file,voice} directly under the
// log's path) before per-language narration existed. Wrap any old-shaped
// entry as its 'en' variant in place so existing English audio isn't
// silently orphaned/re-synthesized the first time this runs post-upgrade.
function migrateManifest(manifest) {
    for (const relPath of Object.keys(manifest)) {
        const entry = manifest[relPath];
        if (entry && typeof entry.hash === 'string' && typeof entry.file === 'string') {
            manifest[relPath] = { en: entry };
        }
    }
    return manifest;
}

function readManifest() {
    if (!fs.existsSync(MANIFEST_PATH)) return {};
    return migrateManifest(JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8')));
}

// The manifest-reading half of task discovery, extracted so both the
// top-level scan (many files x languages) and a single --worker invocation
// (one specific relPath+lang, handed down by the parent) can share it.
function buildTask(relPath, manifest, langConf) {
    const abs = path.join(ROOT, relPath);
    const raw = fs.readFileSync(abs, 'utf8');
    const body = stripFrontmatter(raw);

    // Folding NARRATION_LOGIC_VERSION into the hash (not just the raw file
    // content) means a change to how markdown becomes spoken text — like
    // captions starting to get read — invalidates every cached entry
    // exactly once, cleanly, rather than silently leaving old audio
    // mismatched with what markdownToPlainText would now produce for the
    // same unedited file. Bump it whenever that logic changes again.
    const hash = crypto.createHash('sha256').update(raw + '\n' + NARRATION_LOGIC_VERSION).digest('hex').slice(0, 16);
    const baseOutRel = 'audio/' + relPath.replace(/^logs\//, '').replace(/\.md$/i, '');
    // English keeps its original bare filename (audio/x.mp3) — this repo
    // already has 51 of those committed, and there's no reason to rename/
    // orphan them just because other languages now exist alongside.
    const outRel = langConf.key === 'en' ? `${baseOutRel}.mp3` : `${baseOutRel}.${langConf.key}.mp3`;
    const outAbs = path.join(ROOT, outRel);
    const existing = manifest[relPath] && manifest[relPath][langConf.key];

    if (existing && existing.hash === hash && fs.existsSync(outAbs)) {
        return null; // unchanged since the last run
    }
    const plain = markdownToPlainText(body);
    if (!plain) return null;
    return { relPath, lang: langConf.key, langConf, outRel, outAbs, hash, plain };
}

function findTasks() {
    const manifest = readManifest();
    const files = findPublishedLogFiles();
    const tasks = [];
    for (const abs of files) {
        const relPath = path.relative(ROOT, abs).split(path.sep).join('/'); // e.g. logs/Travel/.../chongqing2.md
        for (const langConf of NARRATION_LANGS) {
            const task = buildTask(relPath, manifest, langConf);
            if (task) tasks.push(task);
        }
    }
    return tasks;
}

// Synthesizes one (file, language) pair's audio and writes both the .mp3
// and its audio-manifest.json entry. Re-reads the manifest from disk right
// before writing (rather than trusting a copy handed in) so this is safe
// to call from a short-lived --worker subprocess that has no memory of
// what any sibling process just wrote.
async function synthesizeAndWriteFile(f) {
    const textToSpeak = f.langConf.translateTo ? await translateLong(f.hash, f.plain, f.langConf.translateTo) : f.plain;

    const chunks = splitIntoChunks(textToSpeak, MAX_CHUNK_BYTES);
    const buffers = [];
    for (const chunk of chunks) {
        buffers.push(await synthesizeChunk(chunk, f.langConf.voice));
        await sleep(pacingMs); // self-tuning — see onRequestSuccess/onRequestFailure above
    }
    fs.mkdirSync(path.dirname(f.outAbs), { recursive: true });
    fs.writeFileSync(f.outAbs, Buffer.concat(buffers));

    const manifest = readManifest();
    manifest[f.relPath] = manifest[f.relPath] || {};
    manifest[f.relPath][f.lang] = { hash: f.hash, file: f.outRel, voice: f.langConf.voice };
    fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n');
}

// --worker entry point: does exactly one (file, language) pair, then exits.
// Never throws out to a caller — the parent only ever sees this through
// the child's exit code, so every path here ends in process.exit().
async function runAsWorker(relPath, langKey) {
    const langConf = NARRATION_LANGS.find((l) => l.key === langKey);
    if (!langConf) {
        console.error(`  FAILED: ${relPath} — unknown --lang "${langKey}"`);
        process.exit(1);
        return;
    }
    const manifest = readManifest();
    const task = buildTask(relPath, manifest, langConf);
    if (!task) { process.exit(0); return; } // already up to date — nothing to do, not a failure
    try {
        await synthesizeAndWriteFile(task);
        console.log(`  -> ${task.outRel}`);
        process.exit(0);
    } catch (err) {
        console.error(`  FAILED: ${relPath} [${langKey}] — ${err.message || err}`);
        process.exit(1);
    }
}

// Runs one (file, language) pair's synthesis in a brand-new child `node`
// process rather than in-process alongside every other one. This is the
// fix for a failure mode discovered the hard way: a single long-lived
// process working through dozens of files in a row would eventually get
// every request timing out — even maxed-out adaptive backoff (see
// pacingMs above) didn't recover it — while a fresh, short-lived process
// hitting the exact same endpoint with the exact same voice succeeded
// immediately, every time, no matter how many prior processes had just
// failed. That points at some kind of per-process connection/session
// state degrading with sustained use (this is an unofficial client for an
// undocumented endpoint, so there's no spec to check against) rather than
// real request-rate throttling — so the fix is to never let one process
// make "sustained use" of the endpoint in the first place. Costs a bit of
// Node startup overhead per task; worth it against actually losing whole
// runs.
function runOneFileInSubprocess(relPath, langKey) {
    return new Promise((resolve) => {
        const child = spawn(process.execPath, [__filename, '--worker', relPath, '--lang', langKey], {
            stdio: 'inherit',
            env: process.env,
        });
        child.on('exit', (code) => resolve(code === 0));
        child.on('error', () => resolve(false));
    });
}

async function main() {
    if (WORKER_REL_PATH) {
        await runAsWorker(WORKER_REL_PATH, WORKER_LANG);
        return;
    }

    let toGenerate = findTasks();
    if (ONLY_LANG) toGenerate = toGenerate.filter((f) => f.lang === ONLY_LANG);

    if (!toGenerate.length) {
        console.log('Nothing to generate — every published log already has up-to-date narration in every language.');
        return;
    }

    const totalChars = toGenerate.reduce((sum, f) => sum + f.plain.length, 0);
    console.log(`${toGenerate.length} (log, language) pair(s) need narration, ~${totalChars.toLocaleString()} source characters total.`);
    toGenerate.forEach((f) => console.log(`  ${DRY_RUN ? 'would generate' : 'queued'}: ${f.relPath} [${f.lang}] (${f.plain.length.toLocaleString()} chars)`));

    if (DRY_RUN) {
        console.log('\nDry run — nothing was sent to Edge or Google, no requests made.');
        return;
    }

    const failed = [];

    for (const f of toGenerate) {
        console.log(`Generating ${f.relPath} [${f.lang}]...`);
        // One stubborn (file, language) pair (even after retries, in its
        // own fresh process) shouldn't sink the rest — note it and keep
        // going. Since it's not written to the manifest, the next run
        // retries just this one.
        const ok = await runOneFileInSubprocess(f.relPath, f.lang);
        if (!ok) failed.push(`${f.relPath} [${f.lang}]`);
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
