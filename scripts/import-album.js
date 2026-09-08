#!/usr/bin/env node
// Pulls every photo out of a public Google Photos shared album link and
// appends them to a log .md file as empty, ordered image blocks —
// ![]() with a timestamp comment above each — so writing a log becomes
// "fill in the blanks" instead of "hunt down a link, then write".
//
// Usage:
//   node scripts/import-album.js <album-url> <target.md> [options]
//
// Options:
//   --after HH:MM     only photos at/after this local time-of-day
//   --before HH:MM     only photos strictly before this local time-of-day
//   --date YYYY-MM-DD  only photos taken on this local date
//   --long-edge N      target size for the longer image dimension (default 1600)
//   --marker STRING    placeholder line to insert at (default "<!-- photos -->")
//   --dry-run          print what would be written instead of writing the file
//
// Insert mid-file instead of appending at the end: put a line containing
// just the marker (default <!-- photos -->) wherever you want the photos
// to land *before* running this. If the target file contains that marker,
// it's replaced with the image blocks; if not (or the file doesn't exist
// yet), the blocks are appended to the end as before. An HTML comment is
// used rather than a blank/whitespace-only line because editors routinely
// auto-strip trailing whitespace on save, which would delete a blank
// marker line before the script ever saw it.
//
// How it works: a photos.app.goo.gl link is an app-deep-link interstitial
// that normally needs JS to resolve, but requesting it with a plain
// (non-browser) User-Agent makes Google skip that and 302-redirect
// straight to the real photos.google.com/share/... page, server-rendered
// with every photo's direct CDN URL + exact capture timestamp embedded
// in an AF_initDataCallback(...) data blob. No login, no API key, no
// browser automation.

const fs = require('fs');
const { execFileSync } = require('child_process');

function parseArgs(argv) {
    const args = { _: [] };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a.startsWith('--')) {
            const key = a.slice(2);
            const next = argv[i + 1];
            if (next !== undefined && !next.startsWith('--')) {
                args[key] = next;
                i++;
            } else {
                args[key] = true;
            }
        } else {
            args._.push(a);
        }
    }
    return args;
}

function timeToMinutes(hhmm) {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + (m || 0);
}

// Find the AF_initDataCallback(...) blob whose data array actually looks
// like the photo list, rather than assuming a fixed index — Google has
// shuffled which callback slot this lands in before.
function extractPhotoItems(html) {
    const callbackRe = /AF_initDataCallback\((\{[\s\S]*?\})\);/g;
    let match;
    while ((match = callbackRe.exec(html)) !== null) {
        const blob = match[1];
        const dataMatch = blob.match(/data:(\[[\s\S]*\]), sideChannel:/);
        if (!dataMatch) continue;
        let arr;
        try {
            arr = JSON.parse(dataMatch[1]);
        } catch {
            continue;
        }
        const candidate = Array.isArray(arr) ? arr[1] : null;
        if (
            Array.isArray(candidate) &&
            candidate.length &&
            Array.isArray(candidate[0]) &&
            Array.isArray(candidate[0][1]) &&
            typeof candidate[0][1][0] === 'string' &&
            candidate[0][1][0].startsWith('https://lh3.googleusercontent.com/')
        ) {
            return candidate;
        }
    }
    throw new Error(
        "Couldn't find the photo data blob in this page — Google may have changed the album page format."
    );
}

// Shells out to curl rather than using fetch() — Node's own fetch (undici)
// has been unreliable over IPv6 in some sandboxes for this exact host,
// while plain curl connects fine, so curl is the dependency that actually
// works everywhere this is likely to run (every Mac has it).
function fetchAlbumHtml(url) {
    return execFileSync('curl', ['-sL', '-A', 'curl/8.0', url], {
        maxBuffer: 20 * 1024 * 1024,
    }).toString('utf8');
}

function scaledDims(width, height, longEdge) {
    const scale = longEdge / Math.max(width, height);
    // Never upscale past the original.
    const s = Math.min(scale, 1);
    return [Math.round(width * s), Math.round(height * s)];
}

function main() {
    const args = parseArgs(process.argv.slice(2));
    const [albumUrl, targetFile] = args._;
    if (!albumUrl || !targetFile) {
        console.error('Usage: node scripts/import-album.js <album-url> <target.md> [--after HH:MM] [--before HH:MM] [--date YYYY-MM-DD] [--long-edge N] [--marker STRING] [--dry-run]');
        process.exit(1);
    }
    const longEdge = args['long-edge'] ? Number(args['long-edge']) : 1600;
    const afterMin = args.after ? timeToMinutes(args.after) : null;
    const beforeMin = args.before ? timeToMinutes(args.before) : null;
    const onlyDate = args.date || null;
    const marker = typeof args.marker === 'string' ? args.marker : '<!-- photos -->';

    Promise.resolve()
        .then(() => fetchAlbumHtml(albumUrl))
        .then((html) => {
            const items = extractPhotoItems(html);

            const photos = items.map((it) => {
                const [baseUrl, width, height] = it[1];
                const tsMs = it[2];
                const utcOffsetMs = typeof it[4] === 'number' ? it[4] : 0;
                const localMs = tsMs + utcOffsetMs;
                const local = new Date(localMs);
                return {
                    baseUrl,
                    width,
                    height,
                    tsMs,
                    localDate: local.toISOString().slice(0, 10),
                    localHour: local.getUTCHours(),
                    localMinute: local.getUTCMinutes(),
                    localLabel: local.toISOString().slice(11, 16),
                };
            });

            photos.sort((a, b) => a.tsMs - b.tsMs);

            const filtered = photos.filter((p) => {
                if (onlyDate && p.localDate !== onlyDate) return false;
                const mins = p.localHour * 60 + p.localMinute;
                if (afterMin !== null && mins < afterMin) return false;
                if (beforeMin !== null && mins >= beforeMin) return false;
                return true;
            });

            if (!filtered.length) {
                console.error('No photos matched those filters — nothing to write.');
                process.exit(1);
            }

            const blocks = filtered.map((p) => {
                const [w, h] = scaledDims(p.width, p.height, longEdge);
                const hour12 = ((p.localHour + 11) % 12) + 1;
                const ampm = p.localHour < 12 ? 'AM' : 'PM';
                const timeLabel = `${hour12}:${String(p.localMinute).padStart(2, '0')} ${ampm}`;
                const url = `${p.baseUrl}=w${w}-h${h}-s-no-gm?authuser=0`;
                return `<!-- ${timeLabel} -->\n![](${url})`;
            });

            console.log(`Matched ${filtered.length} of ${photos.length} photos in the album.`);

            const existing = fs.existsSync(targetFile) ? fs.readFileSync(targetFile, 'utf8') : '';
            const hasMarker = existing.includes(marker);
            const inserted = blocks.join('\n\n');

            if (args['dry-run']) {
                console.log(hasMarker ? `Would insert at marker "${marker}":` : 'Would append to end of file:');
                console.log('\n' + inserted + '\n');
                return;
            }

            if (hasMarker) {
                fs.writeFileSync(targetFile, existing.replace(marker, inserted));
                console.log(`Inserted ${filtered.length} image blocks at the "${marker}" marker in ${targetFile}`);
            } else {
                fs.appendFileSync(targetFile, '\n\n' + inserted + '\n');
                console.log(`No "${marker}" marker found — appended ${filtered.length} image blocks to the end of ${targetFile}`);
            }
        })
        .catch((err) => {
            console.error(err.message);
            process.exit(1);
        });
}

main();
