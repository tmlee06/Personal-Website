// Simple reliable typing loop
function delay(ms) { return new Promise(res => setTimeout(res, ms)); }

async function startTypingLoop(element, items, { typeDelay = 70, eraseDelay = 45, holdDelay = 900 } = {}) {
    if (!element || !items || items.length === 0) return;
    let i = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
        try {
            const text = String(items[i] || '');
        element.setAttribute('aria-label', text);
            // type (1..length)
        for (let c = 1; c <= text.length; c++) {
            element.textContent = text.slice(0, c);
            await delay(typeDelay);
        }
        await delay(holdDelay);
            // erase (length..0)
        for (let c = text.length; c >= 0; c--) {
                element.textContent = text.slice(0, c);
            await delay(eraseDelay);
        }
        i = (i + 1) % items.length;
        } catch (err) {
            // If something goes wrong (element removed from DOM, etc.), stop the loop silently
            // but don't crash the rest of the script.
            console.error('Typing loop error:', err);
            break;
        }
    }
}

// Synchronized typing loop for two elements that cycle together
async function startSynchronizedTyping(element1, items1, element2, items2, { typeDelay = 70, eraseDelay = 45, holdDelay = 900 } = {}) {
    if (!element1 || !element2 || !items1 || !items2 || items1.length === 0 || items2.length === 0) return;
    if (items1.length !== items2.length) {
        console.warn('Synchronized typing: arrays must have the same length');
        return;
    }
    let i = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
        try {
            const text1 = String(items1[i] || '');
            const text2 = String(items2[i] || '');
            
            element1.setAttribute('aria-label', text1);
            element2.setAttribute('aria-label', text2);
            
            // Calculate max length to type both together
            const maxLength = Math.max(text1.length, text2.length);
            
            // Type both simultaneously
            for (let c = 1; c <= maxLength; c++) {
                if (c <= text1.length) {
                    element1.textContent = text1.slice(0, c);
                }
                if (c <= text2.length) {
                    element2.textContent = text2.slice(0, c);
                }
                await delay(typeDelay);
            }
            
            await delay(holdDelay);
            
            // Erase both simultaneously
            for (let c = maxLength; c >= 0; c--) {
                if (c <= text1.length) {
                    element1.textContent = text1.slice(0, c);
                }
                if (c <= text2.length) {
                    element2.textContent = text2.slice(0, c);
                }
                await delay(eraseDelay);
            }
            
            i = (i + 1) % items1.length;
        } catch (err) {
            console.error('Synchronized typing loop error:', err);
            break;
        }
    }
}

// Three-way synchronized typing for three elements that should change together
async function startThreeSynchronizedTyping(element1, items1, element2, items2, element3, items3, { typeDelay = 70, eraseDelay = 45, holdDelay = 900 } = {}) {
    if (!element1 || !element2 || !element3 || !items1 || !items2 || !items3) return;
    let i = 0;
    const len1 = items1.length || 1;
    const len2 = items2.length || 1;
    const len3 = items3.length || 1;
    const total = Math.max(len1, len2, len3);
    // eslint-disable-next-line no-constant-condition
    while (true) {
        try {
            const text1 = String(items1[i % len1] || '');
            const text2 = String(items2[i % len2] || '');
            const text3 = String(items3[i % len3] || '');

            element1.setAttribute('aria-label', text1);
            element2.setAttribute('aria-label', text2);
            element3.setAttribute('aria-label', text3);

            // Prefer smooth fade-in/out for all three elements to avoid per-character jitter.
            // Ensure CSS transitions exist (these will be set in styles.css as well).
            try {
                if (element1.style.transition === '') element1.style.transition = 'opacity 140ms ease';
                if (element2.style.transition === '') element2.style.transition = 'opacity 140ms ease';
                if (element3.style.transition === '') element3.style.transition = 'opacity 140ms ease';
            } catch (e) {
                // ignore if style access fails
            }

            // Fade out all three quickly, swap text, then fade in together
            element1.style.opacity = '0';
            element2.style.opacity = '0';
            element3.style.opacity = '0';
            await delay(100);

            element1.textContent = text1;
            element2.textContent = text2;
            element3.textContent = text3;

            element1.style.opacity = '1';
            element2.style.opacity = '1';
            element3.style.opacity = '1';

            await delay(holdDelay);

            // Fade out before next cycle and clear text
            element1.style.opacity = '0';
            element2.style.opacity = '0';
            element3.style.opacity = '0';
            await delay(100);
            element1.textContent = '';
            element2.textContent = '';
            element3.textContent = '';

            i = (i + 1) % total;
        } catch (err) {
            console.error('Three-way typing loop error:', err);
            break;
        }
    }
}

// Smooth scroll for navigation links (only for hash links, not external URLs)
document.querySelectorAll('a[href^="#"]:not([href^="http"])').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        // Don't prevent default if it's a log deep link or project wrapper
        if (this.getAttribute('href').startsWith('#log-') || this.classList.contains('current-project-card-link')) {
            return; 
        }
        e.preventDefault();
        const href = this.getAttribute('href');
        const target = document.querySelector(href);
        if (target) {
            // For project cards, scroll to center them
            if (target.classList.contains('current-project-card')) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center',
                    inline: 'nearest'
                });
            } else {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start',
                    inline: 'nearest'
                });
            }
        }
    });
});

// Update active nav link on scroll
function updateActiveLink() {
    const sections = document.querySelectorAll('.content-section');
    const navLinks = document.querySelectorAll('.sidebar-nav .nav-link');
    const scrollPos = window.scrollY + 200;

    sections.forEach(section => {
        const id = section.getAttribute('id');
        const offsetTop = section.offsetTop;
        const offsetHeight = section.offsetHeight;

        if (scrollPos >= offsetTop && scrollPos < offsetTop + offsetHeight) {
            navLinks.forEach(link => {
                link.classList.remove('active');
                const href = link.getAttribute('href');
                if (href === `#${id}`) {
                    link.classList.add('active');
                }
            });
        }
    });
}

window.addEventListener('scroll', updateActiveLink);
updateActiveLink();

// Parse YAML frontmatter from markdown file
function parseFrontmatter(markdownText) {
    const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
    const match = markdownText.match(frontmatterRegex);
    
    if (!match) {
        return { metadata: {}, content: markdownText };
    }
    
    const [, frontmatter, content] = match;
    const metadata = {};
    
    // Simple YAML parser for key: value pairs
    frontmatter.split('\n').forEach(line => {
        const colonIndex = line.indexOf(':');
        if (colonIndex === -1) return;
        
        const key = line.substring(0, colonIndex).trim();
        let value = line.substring(colonIndex + 1).trim();
        
        // Handle array values like tags: [tag1, tag2]
        if (value.startsWith('[') && value.endsWith(']')) {
            value = value.slice(1, -1).split(',').map(v => v.trim().replace(/^["']|["']$/g, ''));
        }
        // Remove quotes if present
        else if ((value.startsWith('"') && value.endsWith('"')) || 
                 (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        
        metadata[key] = value;
    });
    
    return { metadata, content: content.trim() };
}

/**
 * Normalizes relative resource paths to handle subdirectory differences 
 * between local deployment and GitHub Pages configurations.
 */
function getNormalizedFetchUrl(relativePath) {
    const cleanPath = relativePath.startsWith('/') ? relativePath.slice(1) : relativePath;
    
    // If you are using a custom domain or standard github.io, point directly to your repo files
    if (window.location.hostname.includes('tlee06.me') || window.location.hostname.includes('github.io')) {
        // Force the absolute structure so pages don't look relative to a deep-linked folder path
        return window.location.origin + '/' + cleanPath;
    }
    return `/${cleanPath}`;
}
/**
 * Loads and processes all logs from logs-index.json.
 */
async function loadLogsData() {
    try {
        const indexUrl = getNormalizedFetchUrl('logs-index.json');
        const indexRes = await fetch(indexUrl, { cache: 'no-store' });
        if (!indexRes.ok) {
            console.error('Failed to load logs-index.json');
            return null;
        }
        
        const indexData = await indexRes.json();
        let sectionsData = [];
        
        if (Array.isArray(indexData) && typeof indexData[0] === 'string') {
            const flatLogs = indexData.map(filename => ({
                filename: filename.replace('.md', ''),
                path: filename 
            }));
            sectionsData = [{ title: 'All Logs', logs: flatLogs }];
        } else if (Array.isArray(indexData) && typeof indexData[0] === 'object' && indexData[0].logs) {
            sectionsData = indexData;
        } else {
            console.error('logs-index.json format not recognized.');
            return null;
        }
        
        if (sectionsData.length === 0) return [];
        
        const processedSections = await Promise.all(sectionsData.map(async (section) => {
            if (!Array.isArray(section.logs)) return { sectionTitle: section.title, logs: [] };

            const logPromises = section.logs.map(async (logEntry) => {
                const path = logEntry.path; 
                try {
                    const logUrl = getNormalizedFetchUrl(path);
                    const res = await fetch(logUrl, { cache: 'no-store' });
                    if (!res.ok) {
                       console.error(`Log file not found or failed to load: ${path}`, res.status);
                       return null; 
                    }
                    const markdown = await res.text();
                    const { metadata, content } = parseFrontmatter(markdown);
                    
                    return {
                        sectionTitle: section.title, 
                        title: metadata.title || logEntry.filename, 
                        date: metadata.date || '',
                        week: metadata.week || null,
                        content: content,
                        tags: Array.isArray(metadata.tags) ? metadata.tags : (metadata.tags ? [metadata.tags] : []),
                        url: metadata.url || null
                    };
                } catch (err) {
                    console.error(`Failed to load log from path ${path}:`, err);
                    return null;
                }
            });
            
            const logs = (await Promise.all(logPromises)).filter(log => log !== null);

            logs.sort((a, b) => {
                if (a.week && b.week) return a.week - b.week;
                if (a.date && b.date) return new Date(a.date) - new Date(b.date);
                return 0;
            });
            
            return { sectionTitle: section.title, logs: logs };
        }));

        return processedSections.filter(section => section.logs.length > 0);
    } catch (err) {
        console.error('Error loading logs data:', err);
        return null;
    }
}

let __weeklyLogsLoaded = false;

// Flat, in-visual-order list of every navigable log across all folders/sections.
// Rebuilt whenever logs-index.json loads; powers the reader's Next button.
let logNavList = [];

function normalizeLogPath(path) {
    try {
        return decodeURIComponent(String(path || ""))
            .replace(/^#log-/, "")
            .replace(/^\/+/, "")
            .replace(/\\/g, "/")
            .normalize("NFC");
    } catch (error) {
        return String(path || "")
            .replace(/^#log-/, "")
            .replace(/^\/+/, "")
            .replace(/\\/g, "/");
    }
}

// Flattens the folder tree into the same order renderLogs draws it in:
// a folder's own "pinned" logs first, then its subfolders, then its
// remaining logs. Skips placeholder log entries that have no path/filename
// yet, and entries flagged "draft" (written but not ready to publish —
// e.g. an empty stub file).
function flattenLogsInOrder(items) {
    const result = [];
    (items || []).forEach((item) => {
        const logs = Array.isArray(item.logs) ? item.logs : [];
        const isVisible = (log) => log && log.path && log.filename && !log.draft;
        logs.filter((log) => isVisible(log) && log.pinned).forEach((log) => result.push(log));
        if (item.folders) result.push(...flattenLogsInOrder(item.folders));
        logs.filter((log) => isVisible(log) && !log.pinned).forEach((log) => result.push(log));
    });
    return result;
}

// Instagram embeds injected via innerHTML need this to actually render
function processInstagramEmbeds(rootEl) {
    if (!rootEl) return;

    const hasInsta = rootEl.querySelector('.instagram-media');
    if (!hasInsta) return;

    const run = () => {
        if (window.instgrm && window.instgrm.Embeds && typeof window.instgrm.Embeds.process === 'function') {
            window.instgrm.Embeds.process();
        }
    };

    if (window.instgrm && window.instgrm.Embeds) {
        run();
        return;
    }

    if (!document.querySelector('script[data-instgrm-embed]')) {
        const s = document.createElement('script');
        s.async = true;
        s.src = 'https://www.instagram.com/embed.js';
        s.setAttribute('data-instgrm-embed', '1');
        s.onload = run;
        document.body.appendChild(s);
    } else {
        setTimeout(run, 300);
    }
}

// --- LOG LOADING & DATA PROCESSING ---

async function loadWeeklyLogs() {
    // --- START SPA REDIRECT INTERCEPTOR ---
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const redirectedPath = urlParams.get('p');
        if (redirectedPath) {
            // Clean up the redirected path (e.g., remove trailing slashes)
            let cleanPath = redirectedPath.replace(/\/$/, "");
            
            // If the path doesn't already start with 'log-', prepend it to match your router
            if (!cleanPath.startsWith('log-')) {
                // If they typed just 'logs', transform it to your route structure or ignore
                if (cleanPath === 'logs') {
                    cleanPath = ''; // Or keep it to navigate to a logs landing section
                } else {
                    cleanPath = 'log-' + cleanPath;
                }
            }
            
            // Rewrite the URL cleanly without reloading the page, setting the correct hash
            const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname + (cleanPath ? '#' + cleanPath : '');
            window.history.replaceState(null, '', newUrl);
        }
    } catch (e) {
        console.error("SPA routing parameter parsing failed:", e);
    }
    // --- END SPA REDIRECT INTERCEPTOR ---

    if (__weeklyLogsLoaded) return;
    __weeklyLogsLoaded = true;

    const logsContainer = document.getElementById('logs-list');
    const bioContainer = document.getElementById('bio-logs-list');

    try {
        const indexUrl = getNormalizedFetchUrl('logs-index.json');
        const response = await fetch(indexUrl, { cache: 'no-store' });
        const sections = await response.json();

        logNavList = flattenLogsInOrder(sections);

        if (logsContainer) renderLogs(logsContainer, sections);
        if (bioContainer) renderBioLogs(bioContainer, sections);

        // Process Deep Links and URL Hashes
        const checkHashRoute = () => {
            const currentHash = window.location.hash || '';
            if (currentHash.startsWith("#log-")) {
                const filePath = currentHash.replace("#log-", "");
                const wantedPath = normalizeLogPath(filePath);
                const targetLog = logNavList.find((log) => normalizeLogPath(log.path) === wantedPath);

                if (targetLog) {
                    setTimeout(() => {
                        openFullscreenLog(targetLog, false, false);
                    }, 150);
                }
            }
        };

        // Listen for direct actions or backward browser steps
        checkHashRoute();
        window.addEventListener('hashchange', checkHashRoute);

    } catch (error) {
        console.error("Failed to load logs:", error);
    }
}

// --- MAIN LOGS PAGE RENDERER: category rail + card grid + inline drawer ---

// Per-category presentation. Colors are fixed jewel-tone gradients (kept
// constant across light/dark — verified >=7:1 white-text contrast on every
// gradient's lightest stop) so they read the same regardless of site theme.
const CATEGORY_META = {
    'UCSD': { slug: 'ucsd', a: '#0E1D3D', b: '#16294F', icon: 'fa-regular fa-umbrella-beach',
        desc: 'My time at UC San Diego — coursework, labs, and the occasional 2am debugging spiral.' },
    '京都大学': { slug: 'kyoto', a: '#231A3A', b: '#2E2350', icon: 'fa-torii-gate',
        desc: 'A study-abroad log series from Kyoto University, spring through summer 2026.' },
    'Travel': { slug: 'travel', a: '#5A2A0F', b: '#7C3D14', icon: 'fa-compass',
        desc: 'Everywhere I’ve pointed a camera, city by city.' },
    'Reads': { slug: 'reads', a: '#4A3216', b: '#5E4220', icon: 'fa-book-open',
        desc: 'What I’m reading this year.' },
    'Reflections': { slug: 'reflections', a: '#341F3B', b: '#432A4F', icon: 'fa-moon',
        desc: 'Longer, slower check-ins on how I am actually feeling.' },
    'Thoughts & Papers': { slug: 'thoughts', a: '#202226', b: '#2E3138', icon: 'fa-regular fa-pen-to-square',
        desc: 'Essays written for class, or just for myself, worth keeping.' }
};
// Rotating fallback so a future top-level category in logs-index.json
// still renders something reasonable instead of breaking.
const FALLBACK_GRADIENTS = [['#1F2937', '#2E3B4E'], ['#2B2636', '#3A3348'], ['#1B3A3A', '#215050']];
let __fallbackMetaIndex = 0;

// Note: only used for categories NOT in CATEGORY_META above — slugifyTitle
// strips non-ASCII (CJK included), so known titles carry an explicit,
// hardcoded `slug` instead of relying on this for anything user-facing.
function slugifyTitle(title) {
    return String(title || '')
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[^\w\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-') || 'section';
}

function getCategoryMeta(title) {
    const known = CATEGORY_META[title];
    if (known) return known;
    const g = FALLBACK_GRADIENTS[__fallbackMetaIndex % FALLBACK_GRADIENTS.length];
    __fallbackMetaIndex++;
    return { slug: slugifyTitle(title), a: g[0], b: g[1], icon: 'fa-folder-tree', desc: 'A collection of logs.' };
}

// Ordered children of a folder/category node: any "pinned" logs first,
// then subfolders, then its remaining logs — matches flattenLogsInOrder()
// so counts and browse order agree.
function getChildren(node) {
    const children = [];
    const logs = Array.isArray(node.logs) ? node.logs : [];
    const isVisible = (l) => l && l.path && l.filename && !l.draft;
    logs.filter((l) => isVisible(l) && l.pinned).forEach((l) => children.push({ type: 'log', title: l.filename, log: l }));
    (node.folders || []).forEach((f) => children.push({ type: 'folder', title: f.title, node: f }));
    logs.filter((l) => isVisible(l) && !l.pinned).forEach((l) => children.push({ type: 'log', title: l.filename, log: l }));
    return children;
}

function renderLogs(container, items) {
    container.innerHTML = '';

    const grid = document.createElement('div');
    grid.className = 'log-grid';
    grid.setAttribute('aria-label', 'Log categories');

    const drawerSlot = document.createElement('div');
    drawerSlot.className = 'drawer-slot';

    const bySlug = {};
    const state = { slug: null, item: null, stack: [], lastTrigger: null };

    function setExpanded(slug, val) {
        container.querySelectorAll(`[data-slug="${slug}"]`).forEach((el) => el.setAttribute('aria-expanded', String(val)));
    }

    function openCategory(item, meta, trigger) {
        if (state.slug && state.slug !== meta.slug) setExpanded(state.slug, false);
        state.slug = meta.slug;
        state.item = item;
        state.stack = [];
        state.lastTrigger = trigger || null;
        setExpanded(meta.slug, true);
        renderDrawer({});
        history.pushState({}, '', '#logs-' + meta.slug);
    }

    function openCategoryBySlug(slug, opts) {
        const entry = bySlug[slug];
        if (!entry) return;
        if (state.slug && state.slug !== slug) setExpanded(state.slug, false);
        state.slug = slug;
        state.item = entry.item;
        state.stack = [];
        state.lastTrigger = container.querySelector(`.log-tile[data-slug="${slug}"]`);
        setExpanded(slug, true);
        renderDrawer({ pulse: !!(opts && opts.pulse), skipFocus: true });
        if (opts && opts.scroll) {
            const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            const drawerEl = drawerSlot.querySelector('.log-drawer');
            if (drawerEl) drawerEl.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
        }
    }

    function closeDrawer(updateUrl) {
        if (!state.slug) return;
        setExpanded(state.slug, false);
        const trigger = state.lastTrigger;
        state.slug = null; state.item = null; state.stack = [];
        drawerSlot.innerHTML = '';
        if (updateUrl !== false) history.pushState({}, '', window.location.pathname + window.location.search);
        if (trigger) trigger.focus();
    }

    function renderDrawer(opts) {
        const crumbs = [{ label: state.item.title, depth: -1 }];
        let node = { folders: state.item.folders, logs: state.item.logs };
        state.stack.forEach((idx, i) => {
            const kids = getChildren(node);
            node = kids[idx].node;
            crumbs.push({ label: kids[idx].title, depth: i });
        });
        const children = getChildren(node);

        drawerSlot.innerHTML = `
            <section class="log-drawer${opts && opts.pulse ? ' pulse' : ''}" id="logs-drawer" role="region" aria-label="${escapeHtml(state.item.title)} logs" tabindex="-1">
                <div class="drawer-head">
                    <div>
                        <p class="drawer-eyebrow">Category</p>
                        <h2>${escapeHtml(state.item.title)}</h2>
                    </div>
                    <button type="button" class="drawer-close" aria-label="Close, back to all categories"><i class="fas fa-xmark"></i></button>
                </div>
                <ol class="breadcrumb">
                    ${crumbs.map((c, i) => {
                        const isLast = i === crumbs.length - 1;
                        return `<li${isLast ? ' class="current"' : ''}>${isLast ? `<span>${escapeHtml(c.label)}</span>` : `<button type="button" data-depth="${c.depth}">${escapeHtml(c.label)}</button>`}</li>`;
                    }).join('')}
                </ol>
                <ul class="entry-list">
                    ${children.length ? children.map((c, i) => {
                        if (c.type === 'folder') {
                            const empty = flattenLogsInOrder([c.node]).length === 0;
                            return `<li><button type="button" class="entry-row is-folder" data-action="folder" data-index="${i}"${empty ? ' disabled' : ''}>
                                <span class="entry-icon"><i class="fas fa-folder"></i></span>
                                <span class="entry-main"><span class="entry-title">${escapeHtml(c.title)}</span></span>
                                <span class="entry-cue">${empty ? 'No entries yet' : 'Open folder <i class="fas fa-arrow-right"></i>'}</span>
                            </button></li>`;
                        }
                        return `<li><button type="button" class="entry-row" data-action="log" data-index="${i}">
                            <span class="entry-icon"><i class="fas fa-file-lines"></i></span>
                            <span class="entry-main"><span class="entry-title">${escapeHtml(c.title)}</span>${c.log.date ? `<div class="entry-date">${escapeHtml(c.log.date)}</div>` : ''}</span>
                            <span class="entry-cue">Read <i class="fas fa-arrow-right"></i></span>
                        </button></li>`;
                    }).join('') : '<li class="entry-empty">No entries yet — check back soon.</li>'}
                </ul>
            </section>
        `;

        const drawerEl = drawerSlot.querySelector('.log-drawer');
        drawerEl.querySelector('.drawer-close').onclick = () => closeDrawer();
        drawerEl.querySelector('.breadcrumb').addEventListener('click', (ev) => {
            const btn = ev.target.closest('button[data-depth]');
            if (!btn) return;
            state.stack = state.stack.slice(0, parseInt(btn.dataset.depth, 10) + 1);
            renderDrawer({});
        });
        drawerEl.querySelectorAll('.entry-row[data-action="folder"]:not([disabled])').forEach((btn) => {
            btn.onclick = () => { state.stack.push(parseInt(btn.dataset.index, 10)); renderDrawer({}); };
        });
        drawerEl.querySelectorAll('.entry-row[data-action="log"]').forEach((btn) => {
            btn.onclick = () => {
                const c = children[parseInt(btn.dataset.index, 10)];
                openFullscreenLog(c.log, true, true);
            };
        });

        if (!(opts && opts.skipFocus)) drawerEl.focus();
    }

    function handleCategoryRoute() {
        const hash = (window.location.hash || '').replace('#', '');
        if (hash.indexOf('logs-') === 0) {
            const slug = hash.slice(5);
            if (bySlug[slug]) { openCategoryBySlug(slug, { pulse: true, scroll: true }); return; }
        }
        if (hash.indexOf('log-') === 0) return; // an individual-log deep link — leave drawer state alone
        if (state.slug) closeDrawer(false);
    }

    items.forEach((item) => {
        const meta = getCategoryMeta(item.title);
        const count = flattenLogsInOrder([item]).length;
        bySlug[meta.slug] = { item, meta };

        const tile = document.createElement('button');
        tile.type = 'button';
        tile.className = 'log-tile';
        tile.style.setProperty('--a', meta.a);
        tile.style.setProperty('--b', meta.b);
        tile.dataset.slug = meta.slug;
        tile.setAttribute('aria-expanded', 'false');
        tile.setAttribute('aria-controls', 'logs-drawer');
        tile.innerHTML = `
            <div class="tile-top">
                <span class="tile-icon"><i class="fas ${meta.icon}"></i></span>
                <span class="tile-count">${count} ${count === 1 ? 'log' : 'logs'}</span>
            </div>
            <h3 class="tile-title">${escapeHtml(item.title)}</h3>
            <p class="tile-desc">${escapeHtml(meta.desc)}</p>
            <span class="tile-cta">Explore <i class="fas fa-arrow-right"></i></span>
        `;
        tile.addEventListener('click', () => openCategory(item, meta, tile));
        grid.appendChild(tile);
    });

    container.appendChild(grid);
    container.appendChild(drawerSlot);

    window.addEventListener('hashchange', handleCategoryRoute);
    handleCategoryRoute();
}

// --- BIO SECTION RENDERER ---

function renderBioLogs(container, sections) {
    let allLogs = [];

    const findLogs = (items, parentTitle = "") => {
        items.forEach(item => {
            const currentTitle = parentTitle ? `${parentTitle} - ${item.title}` : item.title;
            if (item.logs) {
                item.logs.forEach(l => {
                    if (l && l.path && l.filename && !l.draft) allLogs.push({ ...l, displayCategory: currentTitle });
                });
            }
            if (item.folders) findLogs(item.folders, currentTitle);
        });
    };

    findLogs(sections);
    allLogs.sort((a, b) => new Date(b.date) - new Date(a.date));
    container.innerHTML = '';
    
    allLogs.slice(0, 2).forEach(log => {
        const card = document.createElement('div');
        card.className = 'bio-log-card'; 
        card.innerHTML = `
            <span class="meta">${log.displayCategory.toUpperCase()}</span>
            <h3>${log.filename}</h3>
        `;
        card.onclick = () => openFullscreenLog(log, true, false);
        container.appendChild(card);
    });
}

// Wraps raw <iframe> embeds (YouTube, Vimeo, etc.) pasted into log markdown
// in a responsive 16:9 container so they scale to the reader width instead
// of rendering at a fixed pixel size (which looked broken/cramped on iPad).
function processVideoEmbeds(rootEl) {
    if (!rootEl) return;

    const iframes = rootEl.querySelectorAll('iframe');
    iframes.forEach(iframe => {
        // Skip if already wrapped (e.g. re-hydration)
        if (iframe.parentElement && iframe.parentElement.classList.contains('video-embed-wrap')) return;

        // Only touch video-style embeds, leave other iframes alone
        const src = iframe.getAttribute('src') || '';
        const isVideo = /youtube\.com|youtu\.be|vimeo\.com|player\.twitch\.tv/i.test(src);
        if (!isVideo) return;

        const wrap = document.createElement('div');
        wrap.className = 'video-embed-wrap';

        iframe.removeAttribute('width');
        iframe.removeAttribute('height');
        iframe.style.width = '100%';
        iframe.style.height = '100%';
        iframe.style.border = '0';

        iframe.parentNode.insertBefore(wrap, iframe);
        wrap.appendChild(iframe);
    });
}

// --- POP-IN (page load + scroll) ---
// One system for the whole site: every tracked element starts hidden,
// then springs in via IntersectionObserver — elements already on screen
// at load animate right away (giving that refresh "cascade" feel),
// elements further down animate the moment they scroll into view.
// Watches the dynamic grids (GitHub projects, weekly logs) too, since
// those cards get added after an async fetch resolves.
function initPopInAnimation() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (typeof IntersectionObserver === 'undefined') return;

    const selector = [
        // Sidebar
        '.sidebar-name', '.sidebar-nav .nav-link', '.project-link', '.social-link', '.theme-toggle-wrap',
        // Hero / profile
        '.profile-image-wrapper', '.profile-name', '.profile-title', '.resume-buttons',
        '.map-caption', '.location-map', '.now-playing-card', '.spotify-card',
        '.home-video-card', '.letterboxd-card', '.verse-container',
        '.manifesto-quote',
        '.left-content-column', '.bio-text',
        // Section headers used throughout (TEAM PROJECTS, LOGS, etc.)
        '.section-title-small', '.experience-section-header',
        // Cards
        '.work-card', '.current-project-card', '.log-card', '.bio-log-card', '.experience-item', '.cert-card', '.highlights-card',
        // Contact + footer
        '.social-icon-link', '.resume-download-button', '.resume-download-link',
        '.contact-content h2', '.contact-content p', 'footer p',
        // Logs page folder browser
        '.season-folder'
    ].join(', ');
    const seen = new WeakSet();

    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry, i) => {
            if (entry.isIntersecting) {
                const el = entry.target;
                // Stagger within whatever batch just intersected: a big
                // cascade on initial load (many elements at once), near-
                // instant for the 1-2 elements that cross in during a
                // normal scroll.
                el.style.setProperty('--pop-delay', `${Math.min(i * 40, 480)}ms`);
                el.classList.add('pop-in-visible');
                observer.unobserve(el);
            }
        });
    }, { threshold: 0.1, rootMargin: '0px 0px -30px 0px' });

    function markAndObserve(el) {
        if (seen.has(el)) return;
        seen.add(el);
        el.classList.add('pop-in');
        observer.observe(el);
    }

    document.querySelectorAll(selector).forEach(markAndObserve);

    const grids = document.querySelectorAll('#projects-grid, #logs-list, .current-projects-grid');
    grids.forEach(grid => {
        const mo = new MutationObserver(() => {
            grid.querySelectorAll(selector).forEach(markAndObserve);
        });
        mo.observe(grid, { childList: true });
    });
}

// --- HORIZONTAL SCROLL STRIPS (certifications, highlights) ---
// Lets a normal vertical mouse wheel scroll these strips sideways instead
// of doing nothing (trackpads/touch already scroll them natively via
// horizontal swipe; scroll-snap in the CSS handles settling on a card).
function initHorizontalScroll(selector) {
    document.querySelectorAll(selector).forEach((strip) => {
        strip.addEventListener('wheel', (e) => {
            if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return; // already horizontal, let it be
            e.preventDefault();
            strip.scrollLeft += e.deltaY;
        }, { passive: false });
    });
}

// --- CURATED TRANSLATIONS (About + Message sections) ---
// Google's live translator is fine for gist, but it mangles slang, jokes,
// and wordplay — so the two sections carrying the most personal voice get
// real hand-drafted Japanese and Traditional Chinese instead. Anything
// without a curated entry (every other section/log) still falls through
// to Google's widget normally. These are solid first-draft translations,
// not native-speaker-polished — worth having a fluent reader (hi, aunt
// and grandma) correct anything that reads off.
const CURATED_TRANSLATIONS = {
    'message-lead': {
        ja: '生きるに値する人生が困難と向き合うことの上に築かれるのなら、誰もがもう少しうまく苦しめるように、私たちはどんな技術を作れるだろうか。',
        'zh-TW': '如果值得過的人生，是建立在面對逆境之上，那我們該如何開發科技，幫助每個人更好地承受這份掙扎？'
    },
    'message-close': {
        ja: '満ち足りた、濃密な人生を貪欲に求めている。辛い日々も含めて、全部。でも、その重荷を一人で背負う人がいてはいけない。',
        'zh-TW': '我渴望活得豐盛、熾烈，連艱難的日子也不例外。但沒有人應該獨自扛起這份重擔。'
    },
    'about-p1': {
        ja: '現在19歳。17歳のとき、6時間目まで授業を受けて、「良い」大学に入るためだけにGPA4.0にこだわり続けるより、もっと大事な生き方があるはずだと思った。だから、人生を早めにスタートさせようと決めて、高校を中退した（正確には、高卒認定を取って卒業扱いにした、というやつ）。でも、その解放感は長くは続かなかった。結局、1年半後にはUCサンディエゴに入学することになった😂。UCSDでの最初の1年（学年としては3年生）は、想像以上に自分の鼻をへし折られる経験だった。大変だったけど、それでも生きて、学んで、道中を楽しむ方法をちゃんと見つけられたと思う。',
        'zh-TW': '我今年19歲。17歲那年，我覺得人生應該不只是坐在教室上六節課、拼命維持4.0的GPA，只為了擠進一所「好」大學。於是我決定提早開始過自己想要的生活，從高中輟學（嚴格來說，是用同等學力考試「跳」出來的）。不過那種解放感沒有維持太久——一年半後，我還是進了加州大學聖地牙哥分校（UCSD）😂。在UCSD的第一年（學制上算大三），讓我謙卑的程度遠超我的想像。過程很不容易，但我還是找到了活著、學習、並且享受這趟旅程的方法。'
    },
    // John 16:33 — a faithful rendering, not a specific published edition's
    // exact wording. If you use a particular Bible translation, swap this
    // for its exact text; the Chinese line below is the (public-domain)
    // Union Version, quoted as-is.
    'about-verse': {
        ja: '<h3 style="font-size: 0.9rem; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 0.5rem; opacity: 0.7;">ヨハネによる福音書 16章33節</h3><h1 style="font-size: 1.8rem; margin: 0; line-height: 1.2;">「あなたがたは世にあって苦難がある。</h1><h2 style="font-size: 1.5rem; margin: 0.5rem 0; font-weight: 300;">しかし、勇気を出しなさい。</h2><h3 style="font-size: 1.2rem; margin: 0; font-style: italic;">わたしはすでに世に勝っている。」</h3>',
        'zh-TW': '<h3 style="font-size: 0.9rem; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 0.5rem; opacity: 0.7;">約翰福音 16:33</h3><h1 style="font-size: 1.8rem; margin: 0; line-height: 1.2;">「在世上，你們有苦難；</h1><h2 style="font-size: 1.5rem; margin: 0.5rem 0; font-weight: 300;">但你們可以放心，</h2><h3 style="font-size: 1.2rem; margin: 0; font-style: italic;">我已經勝了世界。」</h3>'
    },
    'about-p2': {
        ja: '「勉強」をしていないときの生活は、3つの「G」——God（信仰）、Golf（ゴルフ）、Gym（筋トレ）、日曜日なら信仰・家族・フットボールで回っている。新しいことを理解するのにものすごく情熱を燃やす一方で、テクノロジーから離れて息抜きするのも大好きだ。映画を観たり、本を読んだり、ジグソーパズルを解いたり、あるいはスポーツの試合展開やオッズを追いかけたりする。でも一番の情熱は、なんといってもアイスホッケー。もう15年もプレーしているから、草試合で「もう衰えた」フォワードが必要になったらいつでも声をかけてほしい。ただし、事前にエリートプロスペクツ（有名なホッケー選手データベース）で僕のプロフィールを調べないでほしい。スポーツ以外にも、旅すること、新しい文化を学ぶこと、冒険することが大好きだ。若いうちにいろんな国を巡れているのは本当に幸運だと思うし、これからも続けていきたい。僕自身や考えていることについては、こちらの<a href="#logs" style="color: #ffffff; text-decoration: underline; display: inline; text-underline-offset: 3px;">ログ</a>でもっと読める。',
        'zh-TW': '當我沒在「讀書」的時候，生活主要圍繞著三個「G」——God（信仰）、Golf（高爾夫）、Gym（健身房），星期天則是信仰、家庭、美式足球。我對認識新事物有極大的熱情，但同時也很享受遠離科技、放鬆一下，像是看電影、看書、拼拼圖，或是研究一下球賽走勢、預測和盤口。不過我最深的熱情，還是冰球。我已經打了15年，如果哪天你需要一個「已經過氣」的前鋒來湊人數打野球，儘管找我，只是拜託不要事先去查我在Elite Prospects（知名冰球球探資料庫）上的檔案。除了運動和其他興趣，我也很愛旅行、認識不同文化、探索世界。能在這麼年輕的時候就有機會走訪這麼多國家，我覺得非常幸運，也希望能繼續下去。想更了解我和我的想法，歡迎到這裡看看我的<a href="#logs" style="color: #ffffff; text-decoration: underline; display: inline; text-underline-offset: 3px;">網誌</a>。'
    },
    'about-p3': {
        ja: '僕の学業、キャリア、そして人生の歩みは、かなり型破りで、なかなかの冒険だった。仕事の話をしたい、専門的な話で盛り上がりたい、旅の話を交換したい、レブロン・レイモン・ジェームズについて論争したい、あるいはただ挨拶したいだけでも、気軽に<a href="#contact" style="color: #ffffff; text-decoration: underline; display: inline; text-underline-offset: 3px;">連絡</a>してほしい。',
        'zh-TW': '我的求學、職涯與人生歷程都相當不按牌理出牌，稱得上是一場精彩的冒險。如果你想聊聊工作機會、交流專業話題、分享旅行故事、辯論一下「LeBron Raymone James」到底多厲害，或只是想打聲招呼，都歡迎<a href="#contact" style="color: #ffffff; text-decoration: underline; display: inline; text-underline-offset: 3px;">聯絡</a>我。'
    }
};

// Only these two languages have curated text above; anything else the
// visitor picks (via the dropdown, not just the quick buttons) still runs
// through Google's live translator like the rest of the site.
const CURATED_LANGS = ['ja', 'zh-TW'];

function getGoogTransLang() {
    const match = document.cookie.match(/googtrans=\/en\/([a-zA-Z-]+)/);
    return match ? match[1] : null;
}

// Was originally only ever called once, right after page load, when
// initQuickTranslate() still always reloaded the page on every switch.
// Now that the quick-translate buttons can also drive the widget directly
// with no reload (see initQuickTranslate), this can run again mid-session
// with a *different* language than last time — so it also needs to revert
// what it changed, not just apply.
function applyCuratedTranslations() {
    const lang = getGoogTransLang();
    const isCurated = lang && CURATED_LANGS.indexOf(lang) !== -1;

    let curatedCount = 0;
    document.querySelectorAll('[data-i18n]').forEach((el) => {
        // Stash the original English markup the first time this element is
        // touched at all, so a later revert (switch to English, or to a
        // language with no curated text) has something to restore.
        if (el.dataset.i18nOriginal === undefined) {
            el.dataset.i18nOriginal = el.innerHTML;
        }

        const entry = CURATED_TRANSLATIONS[el.dataset.i18n];
        if (isCurated && entry && entry[lang]) {
            el.innerHTML = entry[lang];
            el.setAttribute('translate', 'no');
            curatedCount++;
        } else if (el.innerHTML !== el.dataset.i18nOriginal) {
            el.innerHTML = el.dataset.i18nOriginal;
            el.removeAttribute('translate');
        }
    });

    showTranslationNotice(lang, curatedCount > 0);
}

// A small, dismissible, in-language heads-up. Wording differs depending on
// whether this page actually has curated sections (index.html's About/
// Message) or is machine-translated throughout (logs.html, etc.) — the
// notice shouldn't claim credit for a section that isn't on this page.
// Re-callable mid-session (see applyCuratedTranslations above): leaves an
// already-shown notice for the *same* language alone (so dismissing it
// still sticks if nothing actually changed), swaps it if the language
// changed, and removes it entirely on revert to English/non-curated.
function showTranslationNotice(lang, hasCurated) {
    const copy = hasCurated
        ? {
            ja: 'このサイトの大部分は自動翻訳です。ジョークがうまく伝わらないところがあっても大目に見てください 😅　「A MESSAGE」と「ABOUT」のセクションは僕が自分で訳しました。',
            'zh-TW': '這個網站大部分內容是機器翻譯，如果有些玩笑翻得怪怪的，請多包涵 😅　「A MESSAGE」和「ABOUT」這兩個部分是我自己翻譯的。'
        }
        : {
            ja: 'このページは自動翻訳です。ジョークやスラングがうまく伝わらないところがあっても大目に見てください 😅',
            'zh-TW': '這個頁面是機器翻譯，如果有些玩笑或用語翻得怪怪的，請多包涵 😅'
        };
    const dismissLabel = { ja: '閉じる', 'zh-TW': '關閉' };

    const existing = document.querySelector('.translate-notice');

    if (!lang || !copy[lang]) {
        if (existing) existing.remove();
        return;
    }

    if (existing) {
        if (existing.dataset.lang === lang) return; // already showing for this language — let a dismissal stick
        existing.remove();
    }

    const main = document.querySelector('.main-content') || document.querySelector('.page-layout');
    if (!main) return;

    const notice = document.createElement('div');
    notice.className = 'translate-notice';
    notice.dataset.lang = lang;
    notice.innerHTML = `<p>${copy[lang]}</p><button type="button" class="translate-notice-close" aria-label="${dismissLabel[lang]}">&times;</button>`;
    main.insertBefore(notice, main.firstChild);
    notice.querySelector('.translate-notice-close').addEventListener('click', () => notice.remove());
}

applyCuratedTranslations();

// --- ONE-CLICK TRANSLATE BUTTONS ---
// Two ways to drive Google's translate widget, tried in order:
//
// 1. Reach into the widget's own <select class="goog-te-combo"> and fire
//    it directly — this is what the (hidden) dropdown does when a person
//    picks a language themselves, so it's driving the actual live widget
//    rather than a side-channel it merely reads on some future load.
//    Works instantly, no page reload, and sidesteps cookie domain/timing
//    semantics entirely (browsers don't have to agree on cookie-jar
//    ordering if there's no cookie in the loop for this click).
// 2. If that element hasn't mounted yet — translate.google.com's
//    element.js loads async and a fast click can beat it — fall back to
//    the documented googtrans cookie + reload, which is slower but keeps
//    working regardless of load timing.
//
// The cookie is still written on every click either way, so a reload (or
// opening the log reader, a separate page load) picks up the same choice.
//
// Takes an optional root so it can be re-run against markup injected after
// the initial page load (e.g. the log reader's own set of pills) without
// double-binding the buttons that were already wired up — each button is
// flagged once it has a listener.
function initQuickTranslate(root) {
    const buttons = (root || document).querySelectorAll('.translate-quick-btn:not([data-translate-bound])');
    if (!buttons.length) return;

    // Writes exactly one googtrans cookie, host-only (no Domain attribute).
    // This used to also write a second `domain=.<host>` copy of the same
    // cookie "for safety" — but that leaves two live cookies with the same
    // name and different Domain scopes, and RFC 6265 doesn't define which
    // one document.cookie (or the widget's own read of it) sees first.
    // Chromium and WebKit aren't guaranteed to agree, which is exactly the
    // kind of thing that could work on desktop and silently pick the wrong
    // (stale/empty) value on iOS Safari. One cookie removes the ambiguity
    // outright, and a host-only cookie is all this single-domain site needs.
    function setGoogTransCookie(lang) {
        const expired = 'googtrans=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;';
        document.cookie = expired;
        if (lang !== 'en') {
            document.cookie = 'googtrans=/en/' + lang + ';path=/;';
        }
    }

    // Returns true if it managed to trigger the widget directly (no
    // reload needed), false if the widget isn't mounted yet.
    function applyViaWidget(lang) {
        const combo = document.querySelector('select.goog-te-combo');
        if (!combo) return false;
        combo.value = lang === 'en' ? '' : lang; // '' is the combo's own "show original" option
        combo.dispatchEvent(new Event('change'));
        return true;
    }

    buttons.forEach((btn) => {
        btn.dataset.translateBound = 'true';
        btn.addEventListener('click', () => {
            const lang = btn.dataset.lang;
            setGoogTransCookie(lang);
            if (applyViaWidget(lang)) {
                // No reload happened, so nothing re-runs the curated
                // ja/zh-TW overrides or the notice banner on its own —
                // they only ever ran once at page load. Re-run them now.
                applyCuratedTranslations();
            } else {
                window.location.reload();
            }
        });
    });
}

function hydrateEmbeds(rootEl) {
  processInstagramEmbeds(rootEl);
  processVideoEmbeds(rootEl);
  initReaderReveal(rootEl);
}

// --- LOG CONTENT SCROLL REVEAL ---
// Fades/slides in each block of a log's rendered markdown (paragraphs,
// headings, images, video embeds, lists, quotes) as you scroll through it.
// Runs fresh every time a log is opened since the content is swapped in.
// Uses the same .pop-in/.pop-in-visible system as the rest of the site.
function initReaderReveal(rootEl) {
    if (!rootEl) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (typeof IntersectionObserver === 'undefined') return;

    const body = rootEl.querySelector ? rootEl.querySelector('.reader-body') : null;
    if (!body) return;

    const blocks = body.querySelectorAll(
        'p, h1, h2, h3, h4, blockquote, ul, ol, .video-embed-wrap, img, hr, table'
    );
    if (!blocks.length) return;

    const observer = new IntersectionObserver((entries) => {
        const visible = entries.filter(e => e.isIntersecting);
        visible.forEach((entry, i) => {
            entry.target.style.setProperty('--pop-delay', `${Math.min(i * 45, 300)}ms`);
            entry.target.classList.add('pop-in-visible');
            observer.unobserve(entry.target);
        });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

    blocks.forEach(el => {
        el.classList.add('pop-in');
        observer.observe(el);
    });
}

// --- LOCATION MAP (Leaflet, CartoDB Dark Matter tiles) ---
function initLocationMap() {
    const mapEl = document.getElementById('location-map');
    if (!mapEl || typeof L === 'undefined') return;
    if (mapEl.dataset.initialized === 'true') return;

    const COORDS = [32.8788, -117.2366]; 

    const map = L.map(mapEl, {
        center: COORDS,
        zoom: 10,
        scrollWheelZoom: false,
        zoomControl: true
    });


    L.tileLayer('https://tiles.stadiamaps.com/tiles/stamen_toner_lite/{z}/{x}/{y}{r}.png?api_key=b6cf1e2f-a73e-4025-a83b-a6877c578e82', {
        maxZoom: 20,
        attribution: '&copy; <a href="https://stadiamaps.com/" target="_blank">Stadia Maps</a> &copy; <a href="https://stamen.com/" target="_blank">Stamen Design</a> &copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>'
    }).addTo(map);

    L.circleMarker(COORDS, {
        radius: 7,
        weight: 2,
        color: '#ffffff',
        fillColor: '#EE964B',
        fillOpacity: 1
    }).addTo(map);

    mapEl.dataset.initialized = 'true';

    // Leaflet measures its container once at init. If anything above it
    // (fonts loading late, the async Google Translate widget, a flex
    // reflow) shifts the layout afterward, the map is left thinking it's
    // still the old size — tiles only render for that stale area and the
    // rest looks cut off/grey. invalidateSize() re-measures and redraws.
    setTimeout(() => map.invalidateSize(), 150);
    window.addEventListener('resize', () => map.invalidateSize());
}

/**
 * Opens log in a persistent fullscreen view.
 */
async function openFullscreenLog(log, updateHash = true, scrollOnClose = false) {
    if (!log || !log.path) return;

    if (updateHash) {
        window.location.hash = `log-${log.path}`;
    }

    const existingReader = document.querySelector('.fullscreen-reader');
    if (existingReader) {
        existingReader.remove();
        document.body.style.overflow = '';
    }

    const reader = document.createElement('div');
    reader.className = 'fullscreen-reader';

    try {
        const logUrl = getNormalizedFetchUrl(log.path);
        const res = await fetch(logUrl);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        
        const text = await res.text();
        const content = typeof marked !== 'undefined' ? marked.parse(text) : text;

        // Figure out what comes before/after this log (in folder-browse order)
        // so we can offer Previous/Next buttons. No wraparound: the first/
        // last log in the list simply doesn't get one.
        const currentIndex = logNavList.findIndex(
            (l) => normalizeLogPath(l.path) === normalizeLogPath(log.path)
        );
        const prevLog = currentIndex > 0 ? logNavList[currentIndex - 1] : null;
        const nextLog = (currentIndex !== -1 && currentIndex < logNavList.length - 1)
            ? logNavList[currentIndex + 1]
            : null;

        reader.innerHTML = `
            <!-- Single fixed toolbar, two flex rows in normal flow — not two
                 independently-fixed boxes racing for the same top-right
                 corner, which is what let Back/Previous/Next collide with
                 the translate pills/theme toggle on narrow phones. Row 1:
                 Back left, translate+theme right. Row 2 (only when a prev
                 or next log exists): Previous/Next. -->
            <div class="reader-toolbar">
                <div class="reader-toolbar-row reader-toolbar-top">
                    <button class="back-link" id="close-viewer">
                        <i class="fas fa-arrow-left"></i> BACK TO MAIN
                    </button>

                    <div class="reader-top-controls">
                        <!-- Same one-click pills as the sidebar/home translate control
                             (see initQuickTranslate in script.js) — kept up here, out
                             of the article flow, so it doesn't interrupt the log
                             content below. -->
                        <div class="translate-wrap translate-wrap--reader">
                            <div class="translate-quick">
                                <button type="button" class="translate-quick-btn" data-lang="ja">日本語</button>
                                <button type="button" class="translate-quick-btn" data-lang="zh-TW">中文</button>
                                <button type="button" class="translate-quick-btn" data-lang="en">EN</button>
                            </div>
                        </div>

                        <button id="reader-theme-toggle" class="theme-toggle reader-theme-toggle" type="button" aria-label="Switch theme" title="Switch theme">
                            <svg class="theme-icon theme-icon-sun" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <circle cx="12" cy="12" r="4"/>
                                <line x1="12" y1="1" x2="12" y2="3"/>
                                <line x1="12" y1="21" x2="12" y2="23"/>
                                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                                <line x1="1" y1="12" x2="3" y2="12"/>
                                <line x1="21" y1="12" x2="23" y2="12"/>
                                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                            </svg>
                            <svg class="theme-icon theme-icon-moon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                            </svg>
                        </button>
                    </div>
                </div>

                ${(prevLog || nextLog) ? `
                <div class="reader-toolbar-row reader-toolbar-nav">
                    ${prevLog ? `
                    <button class="back-link prev-link" id="prev-log-btn">
                        <i class="fas fa-chevron-left"></i> PREVIOUS
                    </button>` : '<span></span>'}
                    ${nextLog ? `
                    <button class="back-link next-link" id="next-log-btn">
                        NEXT <i class="fas fa-chevron-right"></i>
                    </button>` : ''}
                </div>` : ''}
            </div>

            <div class="reader-content">
                <header class="reader-header">
                    <span class="reader-meta">${log.date || ''}</span>
                    <h1>${log.filename}</h1>
                </header>
                <div class="reader-body">${content}</div>
                <button class="scroll-top" id="scroll-top-btn">TOP</button>
            </div>
        `;

        document.body.appendChild(reader);
        document.body.style.overflow = 'hidden';

        hydrateEmbeds(reader);
        initQuickTranslate(reader);

        const scrollTopBtn = reader.querySelector('#scroll-top-btn');
        if (scrollTopBtn) {
            scrollTopBtn.onclick = () => reader.scrollTo({ top: 0, behavior: 'smooth' });
        }

        const prevBtn = reader.querySelector('#prev-log-btn');
        if (prevBtn && prevLog) {
            prevBtn.onclick = () => openFullscreenLog(prevLog, true, scrollOnClose);
        }

        const nextBtn = reader.querySelector('#next-log-btn');
        if (nextBtn && nextLog) {
            nextBtn.onclick = () => openFullscreenLog(nextLog, true, scrollOnClose);
        }

        const closeBtn = reader.querySelector('#close-viewer');
        if (closeBtn) {
            closeBtn.onclick = () => {
                const logsList = document.getElementById('logs-list');
                const isBackgroundEmpty = !logsList || logsList.children.length === 0;

                if (isBackgroundEmpty) {
                    window.location.href = 'logs.html';
                    return;
                }

                reader.remove();
                document.body.style.overflow = '';
                history.pushState("", document.title, window.location.pathname + window.location.search);

                if (scrollOnClose) {
                    const logsSection = document.getElementById('logs');
                    if (logsSection) logsSection.scrollIntoView({ behavior: 'smooth' });
                }
            };
        }

        const readerThemeToggle = reader.querySelector('#reader-theme-toggle');
        if (readerThemeToggle) {
            const syncReaderToggleLabel = () => {
                const isLight = document.body.classList.contains('theme-light');
                readerThemeToggle.setAttribute('aria-label', isLight ? 'Switch to dark mode' : 'Switch to light mode');
                readerThemeToggle.setAttribute('title', isLight ? 'Switch to dark mode' : 'Switch to light mode');
            };

            syncReaderToggleLabel();
            readerThemeToggle.addEventListener('click', () => {
                const next = document.body.classList.contains('theme-light') ? 'dark' : 'light';
                if (typeof window.tleeApplyTheme === 'function') {
                    window.tleeApplyTheme(next);
                    syncReaderToggleLabel();
                }
            });
        }

    } catch (err) {
        console.error("Error opening log:", err);
    }
}

function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, m => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    })[m]);
}

window.addEventListener('load', () => {
    document.documentElement.style.setProperty('--page-bg', '#f7fbff');
    
    const hamburgerMenu = document.getElementById('hamburger-menu');
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    
    if (hamburgerMenu && sidebar) {
        const toggleMenu = () => {
            const isActive = sidebar.classList.contains('active');
            sidebar.classList.toggle('active');
            hamburgerMenu.classList.toggle('active');
            if (sidebarOverlay) sidebarOverlay.classList.toggle('active');
            document.body.style.overflow = isActive ? '' : 'hidden';
        };
        
        hamburgerMenu.addEventListener('click', toggleMenu);
        if (sidebarOverlay) sidebarOverlay.addEventListener('click', toggleMenu);
        
        const navLinks = sidebar.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                if (window.innerWidth <= 900) toggleMenu();
            });
        });
        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && sidebar.classList.contains('active')) toggleMenu();
        });
        
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                if (window.innerWidth > 900 && sidebar.classList.contains('active')) {
                    sidebar.classList.remove('active');
                    hamburgerMenu.classList.remove('active');
                    if (sidebarOverlay) sidebarOverlay.classList.remove('active');
                    document.body.style.overflow = '';
                }
            }, 100);
        });
    }
    
    const typedName = document.querySelector('.typed-name');
    const typedGreeting = document.querySelector('.greeting');
    const typedFlags = document.querySelector('.typed-flags');
    if (typedName && typedGreeting && typedFlags) {
        setTimeout(() => {
            startThreeSynchronizedTyping(
                typedName,
                ['tlee', 'ティー・リー', '明宇'],
                typedGreeting,
                ['Hi!', 'こんにちは!', '你好!'],
                typedFlags,
                ['🇺🇸 | 🇨🇦', '🇯🇵', '🇭🇰 | 🇨🇳'],
                { typeDelay: 150, eraseDelay: 100, holdDelay: 2000 }
            );
        }, 50);
    }

    const timestamp = document.getElementById('timestamp');
    if (timestamp) {
        const updateTime = () => {
            const now = new Date();
            const options = { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
            timestamp.textContent = now.toLocaleString('en-US', options).replace(/,/g, '');
        };
        updateTime();
        setInterval(updateTime, 60000);
    }

    loadWeeklyLogs();
    loadGitHubProjects('tmlee06');
    initLocationMap();
    initPopInAnimation();
    initHorizontalScroll('.cert-grid, .highlights-strip');
    initQuickTranslate();

    const profileImage = document.getElementById('profile-image');
    const profileModal = document.getElementById('profile-modal');
    const modalClose = document.querySelector('.profile-modal-close');
    
    if (profileImage && profileModal) {
        profileImage.addEventListener('click', () => profileModal.classList.add('show'));
        if (modalClose) {
            modalClose.addEventListener('click', () => profileModal.classList.remove('show'));
        }
        profileModal.addEventListener('click', (e) => {
            if (e.target === profileModal) profileModal.classList.remove('show');
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && profileModal.classList.contains('show')) {
                profileModal.classList.remove('show');
            }
        });
    }

    // Background color crossfade loop
    (function registerBackgroundObserver() {
        const sections = document.querySelectorAll('.content-section[data-bg]');
        if (!sections.length) return;

        let lastBg = null;
        let rafPending = false;

        function ensureOverlay() {
            let overlay = document.getElementById('bg-overlay');
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.id = 'bg-overlay';
                document.body.insertBefore(overlay, document.body.firstChild);
            }
            return overlay;
        }

        const overlay = ensureOverlay();
        const updateSidebarForColor = () => {};

        const crossfadeTo = (color) => {
            if (color === lastBg) return;
            lastBg = color;
            updateSidebarForColor(color);
            
            document.documentElement.style.setProperty('--page-bg', color || 'transparent');
            overlay.style.willChange = 'opacity, background-color';
            overlay.style.backgroundColor = color || 'transparent';
            overlay.style.opacity = '0';
            
            // eslint-disable-next-line no-unused-expressions
            overlay.offsetWidth;
            overlay.style.opacity = '1';
            
            const computed = getComputedStyle(document.documentElement).getPropertyValue('--bg-fade-duration') || '1200ms';
            let durationMs = 1200;
            try {
                const val = computed.trim();
                if (val.endsWith('ms')) durationMs = parseFloat(val);
                else if (val.endsWith('s')) durationMs = parseFloat(val) * 1000;
            } catch (e) {
                durationMs = 1200;
            }
            
            setTimeout(() => { 
                overlay.style.opacity = '0';
                setTimeout(() => { overlay.style.willChange = 'auto'; }, durationMs + 100);
            }, Math.max(1, Math.round(durationMs)));
        };

        const setBg = (color, foreground) => {
            if (rafPending && color === lastBg) return;
            if (color === lastBg) return;
            
            if (foreground) {
                document.body.classList.toggle('light-foreground', foreground === 'light');
                document.body.classList.toggle('dark-foreground', foreground === 'dark');
            }
            
            rafPending = true;
            window.requestAnimationFrame(() => {
                crossfadeTo(color);
                rafPending = false;
            });
        };
        
        function updateVisibleBg() {
            const viewportHeight = window.innerHeight;
            const viewportCenter = window.scrollY + (viewportHeight / 2);
            let chosen = null;
            let bestScore = 0;
            
            sections.forEach(s => {
                const rect = s.getBoundingClientRect();
                const sectionTop = rect.top + window.scrollY;
                const sectionCenter = sectionTop + (rect.height / 2);
                const distanceFromCenter = Math.abs(sectionCenter - viewportCenter);
                const visibleHeight = Math.max(0, Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0));
                const visibilityRatio = visibleHeight / Math.max(rect.height, viewportHeight);
                const score = visibilityRatio * (1 / (1 + distanceFromCenter / viewportHeight));
                
                if (score > bestScore) {
                    bestScore = score;
                    chosen = s;
                }
            });

            if (chosen) {
                const bg = chosen.dataset.bg || null;
                const foreground = chosen.dataset.foreground || null;
                const current = getComputedStyle(document.documentElement).getPropertyValue('--page-bg').trim();
                if (bg && current !== bg.trim() && bg !== lastBg) {
                    setBg(bg, foreground);
                }
            }
        }

        let observerTimeout;
        const bgObserver = new IntersectionObserver((entries) => {
            let bestEntry = null;
            let bestRatio = 0;
            
            entries.forEach(entry => {
                if (entry.isIntersecting && entry.intersectionRatio > bestRatio) {
                    bestRatio = entry.intersectionRatio;
                    bestEntry = entry;
                }
            });
            
            clearTimeout(observerTimeout);
            observerTimeout = setTimeout(() => {
                if (bestEntry && bestRatio >= 0.2) {
                    const bg = bestEntry.target.getAttribute('data-bg');
                    const foreground = bestEntry.target.getAttribute('data-foreground');
                    if (bg && bg !== lastBg) setBg(bg, foreground);
                } else {
                    updateVisibleBg();
                }
            }, 50);
        }, {
            threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
            rootMargin: '0px'
        });

        sections.forEach(section => bgObserver.observe(section));
        
        let scrollTimeout;
        let rafId = null;
        const handleScroll = () => {
            if (rafId) cancelAnimationFrame(rafId);
            rafId = window.requestAnimationFrame(() => {
                updateVisibleBg();
                rafId = null;
            });
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
                if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
                updateVisibleBg();
            }, 100);
        };
        
        window.addEventListener('scroll', handleScroll, { passive: true });
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => { updateVisibleBg(); }, 200);
        }, { passive: true });
        
        updateVisibleBg();
    })();
});

function getProjectLogo(repo) { return null; }

function getIconClassForRepo(repo) {
  const lang = repo.language || '';
  const name = (repo.name || '').toLowerCase();

  switch (lang) {
    case 'JavaScript': return 'fab fa-js-square';
    case 'TypeScript': return 'fab fa-js';
    case 'Python': return 'fab fa-python';
    case 'Jupyter Notebook': return 'fas fa-book-open';
    case 'HTML': return 'fab fa-html5';
    case 'CSS': return 'fab fa-css3-alt';
    case 'C++': return 'fas fa-code-branch';
    case 'C': return 'fas fa-microchip';
    case 'Java': return 'fab fa-java';
    default: break;
  }
  if (name.includes('blackjack')) return 'fas fa-dice';
  return 'fas fa-code';
}

// GitHub's unauthenticated REST API caps at 60 requests/hour per IP,
// shared across everything that visitor's network does against
// api.github.com — easy to exhaust on a shared/corporate connection or
// just from repeat page loads. A rate-limited or offline fetch used to
// leave the whole Personal Projects section showing only an error
// message. Cache the last successful response so a failed fetch can
// still render something instead of an empty-looking section.
const GITHUB_REPOS_CACHE_KEY = 'tlee-github-repos-cache';
const GITHUB_REPOS_CACHE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function readCachedRepos() {
    try {
        const raw = localStorage.getItem(GITHUB_REPOS_CACHE_KEY);
        if (!raw) return null;
        const { savedAt, repos } = JSON.parse(raw);
        if (!Array.isArray(repos) || Date.now() - savedAt > GITHUB_REPOS_CACHE_MAX_AGE_MS) return null;
        return repos;
    } catch (e) { return null; }
}

function writeCachedRepos(repos) {
    try {
        localStorage.setItem(GITHUB_REPOS_CACHE_KEY, JSON.stringify({ savedAt: Date.now(), repos }));
    } catch (e) { /* storage full/unavailable — cache is a nice-to-have, not required */ }
}

function renderGitHubProjects(repos, grid, homeGrid) {
    const sorted = (Array.isArray(repos) ? repos : [])
      .filter(r => !r.fork)
      .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));

    const filtered = sorted.slice(0, 9);

    if (homeGrid) {
      homeGrid.innerHTML = '';
      sorted.slice(0, 2).forEach(repo => {
        const card = document.createElement('a');
        card.href = repo.html_url;
        card.target = '_blank';
        card.rel = 'noopener noreferrer';
        card.className = 'bio-log-card';
        card.style.display = 'block';
        card.style.textDecoration = 'none';
        card.innerHTML = `
            <span class="meta">${(repo.language || 'REPO').toUpperCase()}</span>
            <h3>${repo.name}</h3>
        `;
        homeGrid.appendChild(card);
      });
    }

    if (!grid) return;

    const frag = document.createDocumentFragment();

    filtered.forEach(repo => {
      const card = document.createElement('a');
      card.href = repo.html_url;
      card.target = '_blank';
      card.rel = 'noopener noreferrer';
      card.className = 'work-card project-card';

      const icon = document.createElement('div');
      icon.className = 'work-icon';

      if (repo.language === 'Jupyter Notebook') {
          icon.innerHTML = `<img src="https://cdn.simpleicons.org/jupyter/F37626" style="width:20px; height:20px; display:block;" alt="Jupyter">`;
      } else {
          const iconClass = typeof getIconClassForRepo === 'function' ? getIconClassForRepo(repo) : 'fas fa-code';
          icon.innerHTML = `<i class="${iconClass}"></i>`;
      }

      const info = document.createElement('div');
      info.className = 'work-info';

      const title = document.createElement('div');
      title.className = 'work-title';
      title.textContent = repo.name;

      const desc = document.createElement('div');
      desc.className = 'project-desc';
      desc.textContent = repo.description || '';

      info.appendChild(title);
      if (desc.textContent) info.appendChild(desc);

      card.appendChild(icon);
      card.appendChild(info);
      frag.appendChild(card);
    });

    grid.innerHTML = '';
    grid.appendChild(frag);
}

async function loadGitHubProjects(username) {
  const grid = document.getElementById('projects-grid');
  const homeGrid = document.getElementById('bio-projects-list');
  if (!grid && !homeGrid) return;

  try {
    const res = await fetch(`https://api.github.com/users/${encodeURIComponent(username)}/repos?per_page=100&sort=updated`);
    if (!res.ok) throw new Error('Failed to fetch');
    const repos = await res.json();
    if (!Array.isArray(repos)) throw new Error('Unexpected response shape');

    writeCachedRepos(repos);
    renderGitHubProjects(repos, grid, homeGrid);
  } catch (e) {
    console.error("GitHub Load Error:", e);
    const cached = readCachedRepos();
    if (cached) {
        renderGitHubProjects(cached, grid, homeGrid);
    } else if (grid) {
        grid.innerHTML = '<p style="opacity:0.5; font-size:0.8rem; text-align:center; grid-column: 1/-1;">Unable to load projects.</p>';
    }
  }
}

window.addEventListener('hashchange', () => {
    const reader = document.querySelector('.fullscreen-reader');
    if (!window.location.hash.includes('log-') && reader) {
        reader.remove();
        document.body.style.overflow = '';
    }
});

console.log(`\n🚀 Welcome to Tristan Lee's Portfolio!\n   Built with vanilla HTML, CSS, and JavaScript\n   https://www.linkedin.com/in/tlee06/\n`);

// --- INTELLIGENT THEME ENGINE ---
// Auto mode (active whenever no explicit choice is saved) goes dark if
// EITHER it's nighttime at the visitor's approximate location OR their OS
// is set to prefers-color-scheme: dark. System preference is the safety-net
// baseline; real sunrise/sunset is what actually drives the decision, so a
// default-light OS still dims the site once the sun goes down.

// Rough {lat, lon} per IANA time zone — just enough to get day-length in
// the right ballpark. Falls back to the zone's UTC-offset meridian at a
// mid-populated latitude for anything not listed.
const TIMEZONE_COORDS = {
    'America/Los_Angeles': [34.05, -118.24], 'America/Denver': [39.74, -104.99],
    'America/Chicago': [41.88, -87.63], 'America/New_York': [40.71, -74.01],
    'America/Anchorage': [61.22, -149.90], 'Pacific/Honolulu': [21.31, -157.86],
    'America/Toronto': [43.65, -79.38], 'America/Vancouver': [49.28, -123.12],
    'America/Mexico_City': [19.43, -99.13], 'America/Sao_Paulo': [-23.55, -46.63],
    'America/Bogota': [4.71, -74.07], 'America/Argentina/Buenos_Aires': [-34.60, -58.38],
    'Europe/London': [51.51, -0.13], 'Europe/Dublin': [53.35, -6.26],
    'Europe/Paris': [48.85, 2.35], 'Europe/Berlin': [52.52, 13.40],
    'Europe/Madrid': [40.42, -3.70], 'Europe/Rome': [41.90, 12.50],
    'Europe/Amsterdam': [52.37, 4.90], 'Europe/Moscow': [55.76, 37.62],
    'Europe/Istanbul': [41.01, 28.98], 'Europe/Athens': [37.98, 23.73],
    'Africa/Cairo': [30.04, 31.24], 'Africa/Lagos': [6.52, 3.38],
    'Africa/Johannesburg': [-26.20, 28.05], 'Africa/Nairobi': [-1.29, 36.82],
    'Asia/Dubai': [25.20, 55.27], 'Asia/Karachi': [24.86, 67.01],
    'Asia/Kolkata': [28.61, 77.21], 'Asia/Dhaka': [23.81, 90.41],
    'Asia/Bangkok': [13.76, 100.50], 'Asia/Jakarta': [-6.21, 106.85],
    'Asia/Singapore': [1.35, 103.82], 'Asia/Hong_Kong': [22.32, 114.17],
    'Asia/Shanghai': [31.23, 121.47], 'Asia/Taipei': [25.03, 121.57],
    'Asia/Tokyo': [35.68, 139.65], 'Asia/Seoul': [37.57, 126.98],
    'Australia/Perth': [-31.95, 115.86], 'Australia/Sydney': [-33.87, 151.21],
    'Australia/Melbourne': [-37.81, 144.96], 'Pacific/Auckland': [-36.85, 174.76]
};

function getApproxCoords() {
    try {
        const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (zone && TIMEZONE_COORDS[zone]) return TIMEZONE_COORDS[zone];
    } catch (e) {}
    // No exact zone match — approximate longitude from the UTC offset itself
    // (each hour of offset ≈ 15° of longitude) and assume a mid latitude.
    const offsetHours = -(new Date().getTimezoneOffset() / 60);
    return [35, offsetHours * 15];
}

// Simplified sunrise-equation approximation (skips the ~15min equation-of-
// time correction and atmospheric refraction — plenty precise for "is it
// dark out yet"). Returns local sunrise/sunset as decimal hours, or null at
// latitudes currently in polar day/night.
function computeSunHours(lat, lon, date) {
    const rad = Math.PI / 180;
    const dayOfYear = Math.floor((date - new Date(date.getFullYear(), 0, 0)) / 86400000);
    const declination = -23.44 * Math.cos(rad * (360 / 365) * (dayOfYear + 10));
    const cosH = -Math.tan(lat * rad) * Math.tan(declination * rad);
    if (cosH <= -1 || cosH >= 1) return null; // polar day (-1) or polar night (+1)
    const hourAngle = (Math.acos(cosH) * (180 / Math.PI)) / 15; // hours either side of solar noon
    const solarNoonUtc = 12 - lon / 15;
    const localOffset = -date.getTimezoneOffset() / 60;
    const norm = (h) => ((h % 24) + 24) % 24;
    return {
        sunrise: norm(solarNoonUtc - hourAngle + localOffset),
        sunset: norm(solarNoonUtc + hourAngle + localOffset)
    };
}

function isDaytimeNow() {
    const [lat, lon] = getApproxCoords();
    const now = new Date();
    const sun = computeSunHours(lat, lon, now);
    const hour = now.getHours() + now.getMinutes() / 60;
    if (!sun) return hour >= 6 && hour < 19; // polar edge case — clock fallback
    return sun.sunrise < sun.sunset
        ? (hour >= sun.sunrise && hour < sun.sunset)
        : !(hour >= sun.sunset && hour < sun.sunrise); // day span crosses midnight
}

function resolveAutoTheme() {
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    return (prefersDark || !isDaytimeNow()) ? 'dark' : 'light';
}

(function initThemeToggle() {
    const STORAGE_KEY = 'tlee-theme';
    const toggleBtn = document.getElementById('theme-toggle');
    const sections = document.querySelectorAll('.content-section[data-bg]');

    sections.forEach(section => {
        if (!section.dataset.bgDark) {
            section.dataset.bgDark = section.getAttribute('data-bg');
            section.dataset.foregroundDark = section.getAttribute('data-foreground') || 'light';
        }
    });

    function hasManualOverride() {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            return stored === 'light' || stored === 'dark';
        } catch (e) { return false; }
    }

    function applyTheme(theme, opts) {
        const persist = !!(opts && opts.persist);
        const isLight = theme === 'light';
        document.body.classList.toggle('theme-light', isLight);

        sections.forEach(section => {
            const bg = isLight ? section.dataset.bgLight : section.dataset.bgDark;
            const fg = isLight ? section.dataset.foregroundLight : section.dataset.foregroundDark;
            if (bg) section.setAttribute('data-bg', bg);
            if (fg) section.setAttribute('data-foreground', fg);
        });

        const overlay = document.getElementById('bg-overlay');
        let current = null;
        let bestRatio = 0;
        const viewportHeight = window.innerHeight;
        sections.forEach(section => {
            const rect = section.getBoundingClientRect();
            const visible = Math.max(0, Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0));
            const ratio = visible / Math.max(rect.height, 1);
            if (ratio > bestRatio) { bestRatio = ratio; current = section; }
        });
        if (current) {
            const bg = current.getAttribute('data-bg');
            const fg = current.getAttribute('data-foreground');
            document.documentElement.style.setProperty('--page-bg', bg);
            if (overlay) overlay.style.backgroundColor = bg;
            document.body.classList.toggle('light-foreground', fg === 'light');
            document.body.classList.toggle('dark-foreground', fg === 'dark');
        }

        if (toggleBtn) {
            toggleBtn.setAttribute('aria-label', isLight ? 'Switch to dark mode' : 'Switch to light mode');
            toggleBtn.setAttribute('title', isLight ? 'Switch to dark mode' : 'Switch to light mode');
        }

        const readerToggleBtn = document.getElementById('reader-theme-toggle');
        if (readerToggleBtn) {
            readerToggleBtn.setAttribute('aria-label', isLight ? 'Switch to dark mode' : 'Switch to light mode');
            readerToggleBtn.setAttribute('title', isLight ? 'Switch to dark mode' : 'Switch to light mode');
        }

        if (persist) {
            try { localStorage.setItem(STORAGE_KEY, theme); } catch (e) {}
        }
    }

    window.tleeApplyTheme = (theme) => applyTheme(theme, { persist: true });
    window.tleeGetTheme = () => document.body.classList.contains('theme-light') ? 'light' : 'dark';

    let initialTheme;
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        initialTheme = (stored === 'light' || stored === 'dark') ? stored : resolveAutoTheme();
    } catch (e) {
        initialTheme = resolveAutoTheme();
    }
    applyTheme(initialTheme, { persist: false });

    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            const next = document.body.classList.contains('theme-light') ? 'dark' : 'light';
            applyTheme(next, { persist: true });
        });
    }

    // Auto mode stays "live" — re-checked on a timer, whenever the tab
    // regains focus, and whenever the OS theme changes — but only while no
    // explicit choice has been saved. The moment someone clicks the toggle,
    // none of this adjusts anything for them again.
    function recheckAutoTheme() {
        if (hasManualOverride()) return;
        const next = resolveAutoTheme();
        if (next !== window.tleeGetTheme()) applyTheme(next, { persist: false });
    }

    setInterval(recheckAutoTheme, 15 * 60 * 1000); // catches a sunrise/sunset crossing mid-session
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') recheckAutoTheme();
    });
    if (window.matchMedia) {
        const mql = window.matchMedia('(prefers-color-scheme: dark)');
        const onChange = () => recheckAutoTheme();
        if (mql.addEventListener) mql.addEventListener('change', onChange);
        else if (mql.addListener) mql.addListener(onChange); // older Safari
    }
})();

document.getElementById("year").textContent = new Date().getFullYear();

const LASTFM_USERNAME = 'tmlee06';
const LASTFM_API_KEY = '05c804c9671368e90457e72507fc92ff';

function escapeHTML(value) {
    return String(value || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

async function loadNowPlaying() {
    const box = document.getElementById("now-playing");
    if (!box) return;

    try {
        const url = `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${encodeURIComponent(LASTFM_USERNAME)}&api_key=${encodeURIComponent(LASTFM_API_KEY)}&format=json&limit=1`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.error) {
            box.innerHTML = `<div class="now-playing-status">Last.fm error: ${escapeHTML(data.message)}</div>`;
            return;
        }

        const track = data.recenttracks?.track?.[0];
        if (!track) {
            box.innerHTML = `<div class="now-playing-status">No recent music found</div>`;
            return;
        }

        const isNowPlaying = track["@attr"]?.nowplaying === "true";
        const song = track.name || "Unknown Song";
        const artist = track.artist?.["#text"] || "Unknown Artist";
        const album = track.album?.["#text"] || ""; // Extracted Album Name
        const trackUrl = track.url || "#";
        const images = track.image || [];
        const albumArt = [...images].reverse().find((img) => img["#text"])?.["#text"] || "";
        const statusText = isNowPlaying ? "Currently listening" : "Last listened";

        box.innerHTML = `
            <a href="${escapeHTML(trackUrl)}" target="_blank" rel="noopener noreferrer" style="text-decoration: none; display: flex; flex-direction: column; height: 100%;">
                <div class="now-playing-status" style="font-size: 0.75rem; color: #aaa; padding: 0.75rem 0.75rem 0 0.75rem; margin-bottom: 0.75rem; font-weight: 500; letter-spacing: 0.02em;">${statusText}</div>
                ${albumArt ? `<img class="now-playing-art" src="${escapeHTML(albumArt)}" alt="${escapeHTML(song)}" style="width: 100% !important; aspect-ratio: 1 / 1 !important; border-radius: 0 !important; object-fit: cover !important; display: block !important; flex-shrink: 0 !important; box-shadow: none !important;">` : `<div class="now-playing-art" style="width: 100%; aspect-ratio: 1 / 1; background: rgba(255,255,255,0.1); flex-shrink: 0;"></div>`}
                <div class="now-playing-text" style="text-align: left; overflow: hidden; padding: 0.65rem 0.75rem 0.75rem 0.75rem;">
                    <div class="now-playing-title" style="font-weight: 700; color: #fff; font-size: 0.95rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 0.15rem;">${escapeHTML(song)}</div>
                    ${album ? `<div class="now-playing-album" style="color: #b3b3b3; font-size: 0.85rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 0.15rem;">${escapeHTML(album)}</div>` : ''}
                    <div class="now-playing-artist" style="color: #888; font-size: 0.85rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHTML(artist)}</div>
                </div>
            </a>
        `;
    } catch (error) {
        console.error("Failed to load Last.fm music:", error);
        box.innerHTML = `<div class="now-playing-status">Could not connect to Last.fm</div>`;
    }
}

document.addEventListener("DOMContentLoaded", () => {
    loadNowPlaying();
    setInterval(loadNowPlaying, 30000);
});

async function fetchLatestLetterboxd() {
    const rssUrl = `https://letterboxd.com/tlee06/rss/`;
    const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`;

    try {
        const response = await fetch(apiUrl);
        const data = await response.json();

        if (data.status === 'ok' && data.items.length > 0) {
            const latestItem = data.items[0]; 
            document.getElementById('letterboxd-link').href = latestItem.link;

            // Clean up the title string (Extracting pure title vs stars)
            let fullTitle = latestItem.title || "";
            let cleanTitle = fullTitle;
            let ratingText = "";

            // If the RSS title contains trailing star indicators, separate them cleanly
            if (fullTitle.includes(" - ")) {
                const parts = fullTitle.split(" - ");
                const possibleStars = parts[parts.length - 1];
                if (/(★|½)+/.test(possibleStars)) {
                    ratingText = possibleStars;
                    parts.pop(); // Remove stars string from title array
                    cleanTitle = parts.join(" - ");
                }
            }

            // Set clean DOM text outputs
            document.getElementById('film-title').innerText = cleanTitle;
            document.getElementById('film-rating').innerText = ratingText;

            // Process image markup without layout distortion
            if (latestItem.description) {
                const parser = new DOMParser();
                const doc = parser.parseFromString(latestItem.description, 'text/html');
                const imgTag = doc.querySelector('img');
                
                if (imgTag && imgTag.src) {
                    const posterImg = document.getElementById('film-poster');
                    const posterWrapper = document.getElementById('film-poster-wrapper');
                    
                    posterImg.src = imgTag.src;
                    posterWrapper.style.display = 'block';
                }
            }
        } else {
            document.getElementById('film-title').innerText = 'No films logged';
        }
    } catch (error) {
        console.error('Error parsing Letterboxd RSS feed:', error);
        document.getElementById('film-title').innerText = 'Offline';
    }
}

// Global initialization
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fetchLatestLetterboxd);
} else {
    fetchLatestLetterboxd();
}
// Trigger the X/Twitter widget refresh
if (window.twttr) {
    window.twttr.widgets.load();
}