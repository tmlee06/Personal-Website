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
        // Don't prevent default if it's a link that wraps a project card going to external site
        if (this.classList.contains('current-project-card-link')) {
            return; // Let the link work normally
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
 * Loads and processes all logs from logs-index.json.
 * It is now resilient to both the old (flat array of file names) and the new (nested) structure.
 *
 * @returns {Promise<Array<{sectionTitle: string, logs: Array<Object>}>>} Array of section objects.
 */
async function loadLogsData() {
    try {
        const indexRes = await fetch('logs-index.json', { cache: 'no-store' });
        if (!indexRes.ok) {
            console.error('Failed to load logs-index.json');
            return null;
        }
        
        const indexData = await indexRes.json();

        let sectionsData = [];
        
        // CHECK 1: If it's the OLD, FLAT array structure (e.g., ["file1.md", "file2.md"])
        if (Array.isArray(indexData) && typeof indexData[0] === 'string') {
            // Convert flat array into the expected nested structure for processing
            const flatLogs = indexData.map(filename => ({
                filename: filename.replace('.md', ''),
                path: filename // Assumes all logs are in the root directory for now
            }));
            sectionsData = [{ title: 'All Logs', logs: flatLogs }];

        // CHECK 2: If it's the NEW, NESTED array structure
        } else if (Array.isArray(indexData) && typeof indexData[0] === 'object' && indexData[0].logs) {
            sectionsData = indexData;
        } else {
            console.error('logs-index.json format not recognized.');
            return null;
        }
        
        if (sectionsData.length === 0) {
            return [];
        }
        
        // The rest of the logic remains the same: process the now-standardized sectionsData
        const processedSections = await Promise.all(sectionsData.map(async (section) => {
            if (!Array.isArray(section.logs)) return { sectionTitle: section.title, logs: [] };

            const logPromises = section.logs.map(async (logEntry) => {
                const path = logEntry.path; 
                
                try {
                    const res = await fetch(path, { cache: 'no-store' });
                    // CRITICAL: Robust error handling - skip if file is missing (404)
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

            // Sort logs within the section
            logs.sort((a, b) => {
                if (a.week && b.week) return a.week - b.week;
                if (a.date && b.date) return new Date(a.date) - new Date(b.date);
                return 0;
            });
            
            return { sectionTitle: section.title, logs: logs };
        }));

        // Filter out sections with no logs
        return processedSections.filter(section => section.logs.length > 0);

    } catch (err) {
        console.error('Error loading logs data:', err);
        return null;
    }
}
// Prevent double-init (your file was calling loadWeeklyLogs multiple times)
let __weeklyLogsLoaded = false;

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

    // If embed lib already exists, just process
    if (window.instgrm && window.instgrm.Embeds) {
        run();
        return;
    }

    // Load embed.js once, then process
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
    if (__weeklyLogsLoaded) return;
    __weeklyLogsLoaded = true;

    const logsContainer = document.getElementById('logs-list');
    const bioContainer = document.getElementById('bio-logs-list');

    try {
        const response = await fetch('logs-index.json');
        const sections = await response.json();

        // Standard logs page render
        if (logsContainer) {
            renderLogs(logsContainer, sections);
        }

        // Bio/Home screen render
        if (bioContainer) {
            renderBioLogs(bioContainer, sections);
        }

       const currentHash = window.location.hash || '';

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

if (currentHash.startsWith("#log-")) {
    const filePath = currentHash.replace("#log-", "");

    const allLogs = [];

    const flatten = (items) => {
        items.forEach((item) => {
            if (item.logs) allLogs.push(...item.logs);
            if (item.folders) flatten(item.folders);
        });
    };

    flatten(sections);

    const wantedPath = normalizeLogPath(filePath);

    const targetLog = allLogs.find((log) => {
        return normalizeLogPath(log.path) === wantedPath;
    });

    if (targetLog) {
        setTimeout(() => openFullscreenLog(targetLog, false, false), 100);
    } else {
        console.warn("Could not find log for hash:", wantedPath);
        console.warn("Available logs:", allLogs.map((log) => log.path));
    }
}

// --- MAIN LOGS PAGE RENDERER ---

function renderLogs(container, items) {
    container.innerHTML = '';

    function createFolderElement(item, level = 0) {
        const details = document.createElement('details');
        details.className = level === 0 ? 'season-folder' : 'season-folder sub-folder';
        if (level > 0) details.style.marginLeft = '20px';

        const summary = document.createElement('summary');
        summary.className = 'season-header';
        summary.innerHTML = `
            <div class="folder-title">
                <i class="fas ${item.folders ? 'fa-folder-tree' : 'fa-folder'}"></i>
                <span>${item.title}</span>
            </div>
            <span class="custom-arrow"><i class="fas fa-chevron-right"></i></span>
        `;
        details.appendChild(summary);

        const contentWrapper = document.createElement('div');
        contentWrapper.className = 'folder-content';

        if (item.folders) {
            item.folders.forEach(sub => contentWrapper.appendChild(createFolderElement(sub, level + 1)));
        } else if (item.logs) {
            const list = document.createElement('div');
            list.className = 'logs-preview-list';
            item.logs.forEach(log => {
                const row = document.createElement('div');
                row.className = 'log-file-row';
                row.innerHTML = `<span class="file-name">${log.filename}</span><span class="file-date">${log.date || ''}</span>`;
                row.onclick = (e) => { e.stopPropagation(); openFullscreenLog(log, true, false); };
                list.appendChild(row);
            });
            contentWrapper.appendChild(list);
        }
        details.appendChild(contentWrapper);
        return details;
    }
    items.forEach(item => container.appendChild(createFolderElement(item)));
}

// --- BIO SECTION RENDERER (Simplified to prevent crashing) ---

/**
 * Renders the Bio section with the clean, minimalist grid
 */
function renderBioLogs(container, sections) {
    let allLogs = [];

    const findLogs = (items, parentTitle = "") => {
        items.forEach(item => {
            // Combines titles: "Junior Year 1" + "Winter 2026"
            const currentTitle = parentTitle 
                ? `${parentTitle} - ${item.title}` 
                : item.title;

            if (item.logs) {
                item.logs.forEach(l => {
                    allLogs.push({
                        ...l,
                        // This is the clean "Junior Year 1 - Winter 2026" string
                        displayCategory: currentTitle 
                    });
                });
            }
            
            if (item.folders) {
                findLogs(item.folders, currentTitle);
            }
        });
    };

    findLogs(sections);

    // Sort by date (LIFO)
    allLogs.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    container.innerHTML = '';
    
    allLogs.slice(0, 4).forEach(log => {
        const card = document.createElement('div');
        card.className = 'bio-log-card'; 
        
        // Removed the ${log.date} from the template literal for a cleaner look
        card.innerHTML = `
            <span class="meta">${log.displayCategory.toUpperCase()}</span>
            <h3>${log.filename}</h3>
        `;
        
        card.onclick = () => openFullscreenLog(log, true, false);
        container.appendChild(card);
    });
}

function hydrateEmbeds(rootEl) {
  processInstagramEmbeds(rootEl);
}

/**
 * Opens log in a persistent view with a pinned back button
 */
async function openFullscreenLog(log, updateHash = true, scrollOnClose = false) {
    if (!log || !log.path) return;

    if (updateHash) {
        window.location.hash = `log-${log.path}`;
    }

    // If a reader is already open, replace it
    const existingReader = document.querySelector('.fullscreen-reader');
    if (existingReader) {
        existingReader.remove();
        document.body.style.overflow = '';
    }

    const reader = document.createElement('div');
    reader.className = 'fullscreen-reader';

    try {
        const res = await fetch(log.path);
        const text = await res.text();
        const content = typeof marked !== 'undefined' ? marked.parse(text) : text;

        reader.innerHTML = `
            <div class="pinned-nav">
                <button class="back-link" id="close-viewer">
                    <i class="fas fa-arrow-left"></i> BACK TO LOGS
                </button>
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

        // Initialize embeds (Instagram, etc.)
        hydrateEmbeds(reader);

        // Scroll to top within the reader
        const scrollTopBtn = reader.querySelector('#scroll-top-btn');
        if (scrollTopBtn) {
            scrollTopBtn.onclick = () => reader.scrollTo({ top: 0, behavior: 'smooth' });
        }

        // Close button
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

                // Only scroll to logs if you asked for it
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
   // Set initial background to a light color (like your default #f7fbff) in case JS fails
document.documentElement.style.setProperty('--page-bg', '#f7fbff');
    
    // Hamburger menu toggle (mobile)
    const hamburgerMenu = document.getElementById('hamburger-menu');
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    
    if (hamburgerMenu && sidebar) {
        const toggleMenu = () => {
            const isActive = sidebar.classList.contains('active');
            sidebar.classList.toggle('active');
            hamburgerMenu.classList.toggle('active');
            if (sidebarOverlay) {
                sidebarOverlay.classList.toggle('active');
            }
            // Prevent body scroll when menu is open
            document.body.style.overflow = isActive ? '' : 'hidden';
        };
        
        hamburgerMenu.addEventListener('click', toggleMenu);
        
        // Close menu when clicking overlay
        if (sidebarOverlay) {
            sidebarOverlay.addEventListener('click', toggleMenu);
        }
        
        // Close menu when clicking a nav link (mobile only)
        const navLinks = sidebar.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                if (window.innerWidth <= 900) {
                    toggleMenu();
                }
            });
        });
        
        // Close menu on ESC key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && sidebar.classList.contains('active')) {
                toggleMenu();
            }
        });
        
        // Close menu when window is resized to desktop size
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                if (window.innerWidth > 900 && sidebar.classList.contains('active')) {
                    sidebar.classList.remove('active');
                    hamburgerMenu.classList.remove('active');
                    if (sidebarOverlay) {
                        sidebarOverlay.classList.remove('active');
                    }
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
            // Start a three-way synchronized typing loop for name, greeting, and flags
            startThreeSynchronizedTyping(
                typedName,
                ['tlee', 'トリー', '智坦'],
                typedGreeting,
                ['Hi!', 'こんにちは!', '你好!'],
                typedFlags,
                ['🇺🇸 | 🇨🇦', '🇯🇵', '🇭🇰 | 🇨🇳'],
                {
                    typeDelay: 150,
                    eraseDelay: 100,
                    holdDelay: 2000,
                }
            );
        }, 50);
    }

    // Timestamp
    const timestamp = document.getElementById('timestamp');
    if (timestamp) {
        const updateTime = () => {
            const now = new Date();
            const options = { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
            timestamp.textContent = now.toLocaleString('en-US', options).replace(/,/g, '');
        };
        updateTime();
        setInterval(updateTime, 60000); // Update every minute
    }

     // Load logs
    loadWeeklyLogs();

    // Load GitHub projects
    loadGitHubProjects('tmlee06');

    // Profile picture modal (only on click, no auto-popup)
    const profileImage = document.getElementById('profile-image');
    const profileModal = document.getElementById('profile-modal');
    const modalClose = document.querySelector('.profile-modal-close');
    
    if (profileImage && profileModal) {
        // Click on profile image to show modal
        profileImage.addEventListener('click', () => {
            profileModal.classList.add('show');
        });

        // Close modal when clicking X or outside
        if (modalClose) {
            modalClose.addEventListener('click', () => {
                profileModal.classList.remove('show');
            });
        }

        profileModal.addEventListener('click', (e) => {
            if (e.target === profileModal) {
                profileModal.classList.remove('show');
            }
        });

        // Close modal on ESC key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && profileModal.classList.contains('show')) {
                profileModal.classList.remove('show');
            }
        });
    }

    // Background color switching observer for seamless transitions between panels
    (function registerBackgroundObserver() {
        const sections = document.querySelectorAll('.content-section[data-bg]');
        if (!sections.length) return;

        let lastBg = null;
        let rafPending = false;

        // create a full-screen overlay for crossfading
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

        const updateSidebarForColor = () => {
            // Sidebar color is governed entirely by CSS (.sidebar / body.theme-light .sidebar)
            // so the page background crossfade never has to fight the theme toggle.
        };

        const crossfadeTo = (color) => {
            if (color === lastBg) return;
            
            // Update lastBg immediately to prevent duplicate calls
            lastBg = color;
            
            // Also update sidebar text/border for readability first
            updateSidebarForColor(color);
            
            // Set the background color directly on body/html for immediate update
            // This prevents the "shake" by ensuring the color is applied instantly
            document.documentElement.style.setProperty('--page-bg', color || 'transparent');
            
            // Then use overlay for smooth crossfade effect
            overlay.style.willChange = 'opacity, background-color';
            overlay.style.backgroundColor = color || 'transparent';
            overlay.style.opacity = '0';
            
            // Force layout to ensure transition triggers
            // eslint-disable-next-line no-unused-expressions
            overlay.offsetWidth;
            
            // Start the fade-in
            overlay.style.opacity = '1';
            
            // fade out after the CSS duration
            const computed = getComputedStyle(document.documentElement).getPropertyValue('--bg-fade-duration') || '1200ms';
            let durationMs = 1200;
            try {
                const val = computed.trim();
                if (val.endsWith('ms')) durationMs = parseFloat(val);
                else if (val.endsWith('s')) durationMs = parseFloat(val) * 1000;
                else durationMs = parseFloat(val);
            } catch (e) {
                durationMs = 1200;
            }
            
            setTimeout(() => { 
                overlay.style.opacity = '0';
                // Remove will-change after animation to free up resources
                setTimeout(() => {
                    overlay.style.willChange = 'auto';
                }, durationMs + 100);
            }, Math.max(1, Math.round(durationMs)));
        };

        const setBg = (color, foreground) => {
            if (rafPending && color === lastBg) return;
            if (color === lastBg) return;
            
            // Update foreground class immediately to prevent flicker
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
        
        // Fallback: determine the most-visible section by checking viewport center
        function updateVisibleBg() {
            const viewportHeight = window.innerHeight;
            const viewportCenter = window.scrollY + (viewportHeight / 2);
            let chosen = null;
            let bestScore = 0;
            
            sections.forEach(s => {
                const rect = s.getBoundingClientRect();
                const sectionTop = rect.top + window.scrollY;
                const sectionBottom = sectionTop + rect.height;
                const sectionCenter = sectionTop + (rect.height / 2);
                
                // Calculate how close the section center is to viewport center
                const distanceFromCenter = Math.abs(sectionCenter - viewportCenter);
                // Also consider how much of the section is visible
                const visibleHeight = Math.max(0, Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0));
                const visibilityRatio = visibleHeight / Math.max(rect.height, viewportHeight);
                
                // Score based on proximity to center and visibility
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
                    // Use setBg to ensure proper crossfade and sidebar update
                    setBg(bg, foreground);
                }
            }
        }

        // Create intersection observer as primary method
        let observerTimeout;
        const bgObserver = new IntersectionObserver((entries) => {
            // Find the section with the highest intersection ratio
            let bestEntry = null;
            let bestRatio = 0;
            
            entries.forEach(entry => {
                if (entry.isIntersecting && entry.intersectionRatio > bestRatio) {
                    bestRatio = entry.intersectionRatio;
                    bestEntry = entry;
                }
            });
            
            // Debounce observer updates to prevent jitter
            clearTimeout(observerTimeout);
            observerTimeout = setTimeout(() => {
                // Use the best visible section if it's at least 20% visible
                if (bestEntry && bestRatio >= 0.2) {
                    const bg = bestEntry.target.getAttribute('data-bg');
                    const foreground = bestEntry.target.getAttribute('data-foreground');
                    if (bg && bg !== lastBg) {
                        setBg(bg, foreground);
                    }
                } else {
                    // Fallback to viewport center method if observer doesn't detect well
                    updateVisibleBg();
                }
            }, 50);
        }, {
            threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
            rootMargin: '0px'
        });

        // Observe all sections
        sections.forEach(section => bgObserver.observe(section));
        
        // Also call updateVisibleBg on scroll and resize as fallback
        let scrollTimeout;
        let rafId = null;
        
        const handleScroll = () => {
            // Cancel any pending RAF
            if (rafId) {
                cancelAnimationFrame(rafId);
            }
            
            // Use RAF for immediate updates during scroll
            rafId = window.requestAnimationFrame(() => {
                updateVisibleBg();
                rafId = null;
            });
            
            // Also set a debounced update for when scrolling stops
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
                if (rafId) {
                    cancelAnimationFrame(rafId);
                    rafId = null;
                }
                updateVisibleBg();
            }, 100);
        };
        
        window.addEventListener('scroll', handleScroll, { passive: true });
        
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                updateVisibleBg();
            }, 200);
        }, { passive: true });
        
        // Initial call
        updateVisibleBg();

    })();
});
// For now. no custom logos. always fall back to icons
function getProjectLogo(repo) {
  // When you have real logo files later, uncomment and edit this map.
  /*
  const name = (repo.name || '').toLowerCase();
  const map = {
    'blackjack': 'img/projects/blackjack.svg',
    'personal-website': 'img/projects/personal-website.svg'
    // add more mappings here
  };
  return map[name] || null;
  */
  return null;
}

// Fallback icons by language or name
function getIconClassForRepo(repo) {
  const lang = repo.language || '';
  const name = (repo.name || '').toLowerCase();

  switch (lang) {
    case 'JavaScript':
      return 'fab fa-js-square';
    case 'TypeScript':
      return 'fab fa-js';
    case 'Python':
      return 'fab fa-python';
    case 'Jupyter Notebook':
      // "Notebook" style icon for Jupyter projects
      return 'fas fa-book-open';
    case 'HTML':
      return 'fab fa-html5';
    case 'CSS':
      return 'fab fa-css3-alt';
    case 'C++':
      return 'fas fa-code-branch';
    case 'C':
      return 'fas fa-microchip';
    case 'Java':
      return 'fab fa-java';
    default:
      break;
  }

  if (name.includes('blackjack')) {
    return 'fas fa-dice';
  }

  return 'fas fa-code';
}

async function loadGitHubProjects(username) {
  const grid = document.getElementById('projects-grid');
  if (!grid) return;

  try {
    const res = await fetch(`https://api.github.com/users/${encodeURIComponent(username)}/repos?per_page=100&sort=updated`);
    if (!res.ok) throw new Error('Failed to fetch');
    const repos = await res.json();

    const filtered = (Array.isArray(repos) ? repos : [])
      .filter(r => !r.fork)
      .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
      .slice(0, 9);

    const frag = document.createDocumentFragment();

    filtered.forEach(repo => {
      // Create the card as an anchor (The whole box is now clickable)
      const card = document.createElement('a');
      card.href = repo.html_url;
      card.target = '_blank';
      card.rel = 'noopener noreferrer';
      card.className = 'work-card project-card';

      // Create Icon Container
        const icon = document.createElement('div');
        icon.className = 'work-icon';

        if (repo.language === 'Jupyter Notebook') {
        // Using a Simple Icons CDN link for the official Jupyter Logo
        icon.innerHTML = `<img src="https://cdn.simpleicons.org/jupyter/F37626" style="width:20px; height:20px; display:block;" alt="Jupyter">`;
        } else {
            const iconClass = typeof getIconClassForRepo === 'function' ? getIconClassForRepo(repo) : 'fas fa-code';
            icon.innerHTML = `<i class="${iconClass}"></i>`;
        }

      // Create Info Container
      const info = document.createElement('div');
      info.className = 'work-info';

      // Title (Using div here because the parent 'card' is already an <a>)
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
  } catch (e) {
    console.error("GitHub Load Error:", e);
    grid.innerHTML = '<p style="opacity:0.5; font-size:0.8rem; text-align:center; grid-column: 1/-1;">Unable to load projects.</p>';
  }
}

window.addEventListener('hashchange', () => {
    const reader = document.querySelector('.fullscreen-reader');
    // If user hits 'Back' and hash is gone, close the reader
    if (!window.location.hash.includes('log-') && reader) {
        reader.remove();
        document.body.style.overflow = '';
    }
});

// Console welcome message
console.log(`
🚀 Welcome to Tristan Lee's Portfolio!
   
   Built with vanilla HTML, CSS, and JavaScript
   
   https://www.linkedin.com/in/tlee06/
`);
// ==========================================================================
// Theme Toggle (Dark / Light)
// ==========================================================================
(function initThemeToggle() {
    const STORAGE_KEY = 'tlee-theme';
    const toggleBtn = document.getElementById('theme-toggle');
    const sections = document.querySelectorAll('.content-section[data-bg]');

    // Cache the original dark values on each section so we can swap back and forth
    sections.forEach(section => {
        if (!section.dataset.bgDark) {
            section.dataset.bgDark = section.getAttribute('data-bg');
            section.dataset.foregroundDark = section.getAttribute('data-foreground') || 'light';
        }
    });

    function applyTheme(theme) {
        const isLight = theme === 'light';
        document.body.classList.toggle('theme-light', isLight);

        // Swap each section's data-bg / data-foreground to the right palette
        sections.forEach(section => {
            const bg = isLight ? section.dataset.bgLight : section.dataset.bgDark;
            const fg = isLight ? section.dataset.foregroundLight : section.dataset.foregroundDark;
            if (bg) section.setAttribute('data-bg', bg);
            if (fg) section.setAttribute('data-foreground', fg);
        });

        // Force the currently-visible section to re-apply its (now-swapped) color immediately
        const overlay = document.getElementById('bg-overlay');
        let current = null;
        let bestRatio = 0;
        const viewportHeight = window.innerHeight;
        sections.forEach(section => {
            const rect = section.getBoundingClientRect();
            const visible = Math.max(0, Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0));
            const ratio = visible / Math.max(rect.height, 1);
            if (ratio > bestRatio) {
                bestRatio = ratio;
                current = section;
            }
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

        try {
            localStorage.setItem(STORAGE_KEY, theme);
        } catch (e) {
            // localStorage unavailable, ignore
        }
    }



    window.tleeApplyTheme = applyTheme;
    window.tleeGetTheme = () => document.body.classList.contains('theme-light') ? 'light' : 'dark';

    // Determine initial theme: stored preference, else default to dark
    let initialTheme = 'dark';
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored === 'light' || stored === 'dark') initialTheme = stored;
    } catch (e) {
        // ignore
    }

    applyTheme(initialTheme);

    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            const next = document.body.classList.contains('theme-light') ? 'dark' : 'light';
            applyTheme(next);
        });
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
        const url =
            `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${encodeURIComponent(LASTFM_USERNAME)}&api_key=${encodeURIComponent(LASTFM_API_KEY)}&format=json&limit=1`;

        const response = await fetch(url);
        const data = await response.json();

        console.log("Last.fm response:", data);

        if (data.error) {
            box.innerHTML = `
                <div class="now-playing-status">
                    Last.fm error: ${escapeHTML(data.message)}
                </div>
            `;
            return;
        }

        const track = data.recenttracks?.track?.[0];

        if (!track) {
            box.innerHTML = `
                <div class="now-playing-status">
                    No recent music found
                </div>
            `;
            return;
        }

        const isNowPlaying = track["@attr"]?.nowplaying === "true";
        const song = track.name || "Unknown Song";
        const artist = track.artist?.["#text"] || "Unknown Artist";
        const trackUrl = track.url || "#";

        const images = track.image || [];
        const albumArt =
            [...images].reverse().find((img) => img["#text"])?.["#text"] || "";

        const statusText = isNowPlaying ? "Currently listening" : "Last listened";

        box.innerHTML = `
            <a href="${escapeHTML(trackUrl)}" target="_blank" rel="noopener noreferrer">
                <div class="now-playing-status">${statusText}</div>
                <div class="now-playing-inner">
                    ${
                        albumArt
                            ? `<img class="now-playing-art" src="${escapeHTML(albumArt)}" alt="${escapeHTML(song)} album art">`
                            : `<div class="now-playing-art"></div>`
                    }
                    <div class="now-playing-text">
                        <div class="now-playing-title">${escapeHTML(song)}</div>
                        <div class="now-playing-artist">${escapeHTML(artist)}</div>
                    </div>
                </div>
            </a>
        `;
    } catch (error) {
        console.error("Failed to load Last.fm music:", error);

        box.innerHTML = `
            <div class="now-playing-status">
                Could not connect to Last.fm
            </div>
        `;
    }
}

document.addEventListener("DOMContentLoaded", () => {
    loadNowPlaying();
    setInterval(loadNowPlaying, 30000);
});