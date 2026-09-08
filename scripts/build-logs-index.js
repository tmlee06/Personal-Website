#!/usr/bin/env node
// Fills in logs-index.json's `logs` arrays from disk — run automatically
// by .github/workflows/update-logs-index.yml on every push that touches
// logs/**, and safe to run by hand any time.
//
// This does NOT rebuild the file from scratch. The section/folder
// structure — titles, flags, nesting, pinned/draft flags on existing
// entries — is hand-curated and is left exactly as written. All this
// script does is: for any folder node that declares a "dir", look for
// .md files in that directory that aren't referenced *anywhere* in the
// index yet, and append an entry for them, built from the file's own
// frontmatter — never guessed.
//
// A file only gets picked up once it has a frontmatter `title:` — that's
// the "this one's ready" signal. No frontmatter (or no title) means the
// script leaves it alone, so a draft-in-progress log never gets
// published into the site nav by accident.
//
// Existing entries are never edited, reordered, or removed — new ones
// are appended to the end of their node's `logs` array (in date order
// among themselves), which is also chronological order for how these
// arrays are normally written (Week 1, Week 2, ... newest last).

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const INDEX_PATH = path.join(ROOT, 'logs-index.json');

function parseFrontmatter(text) {
    const m = text.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
    if (!m) return {};
    const meta = {};
    m[1].split('\n').forEach((line) => {
        const i = line.indexOf(':');
        if (i === -1) return;
        const key = line.slice(0, i).trim();
        let value = line.slice(i + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        meta[key] = value;
    });
    return meta;
}

// Every path already referenced anywhere in the tree, so a file that's
// already listed under one node (even a hand-placed grouping that isn't
// its own dir's node — e.g. a city folder whose one log actually lives
// in its parent country's directory) never gets added a second time.
function collectExistingPaths(nodes, set) {
    (nodes || []).forEach((node) => {
        (node.logs || []).forEach((log) => {
            if (log && log.path) set.add(path.normalize(log.path));
        });
        collectExistingPaths(node.folders, set);
    });
}

function buildNewEntries(dirRel, existingPaths) {
    const dirAbs = path.join(ROOT, dirRel);
    if (!fs.existsSync(dirAbs)) return [];
    const entries = fs.readdirSync(dirAbs, { withFileTypes: true })
        .filter((d) => d.isFile() && d.name.toLowerCase().endsWith('.md'))
        .map((d) => {
            const relPath = path.join(dirRel, d.name).split(path.sep).join('/');
            if (existingPaths.has(path.normalize(relPath))) return null;
            const text = fs.readFileSync(path.join(dirAbs, d.name), 'utf8');
            const meta = parseFrontmatter(text);
            if (!meta.title) return null; // no frontmatter yet = not opted in
            const entry = { filename: meta.title, path: relPath };
            if (meta.date) entry.date = meta.date;
            if (meta.pinned === 'true') entry.pinned = true;
            if (meta.draft === 'true') entry.draft = true;
            return entry;
        })
        .filter(Boolean);
    entries.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    return entries;
}

function processNode(node, existingPaths) {
    if (node.dir) {
        const newEntries = buildNewEntries(node.dir, existingPaths);
        if (newEntries.length) {
            node.logs = [...(node.logs || []), ...newEntries];
            newEntries.forEach((e) => existingPaths.add(path.normalize(e.path)));
        }
    }
    (node.folders || []).forEach((child) => processNode(child, existingPaths));
}

function main() {
    const data = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
    const existingPaths = new Set();
    collectExistingPaths(data, existingPaths);
    data.forEach((node) => processNode(node, existingPaths));
    fs.writeFileSync(INDEX_PATH, JSON.stringify(data, null, 2) + '\n');
}

main();
