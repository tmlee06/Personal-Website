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


// --- LOG LOADING & DATA PROCESSING ---

async function loadWeeklyLogs() {
    const logsContainer = document.getElementById('logs-list');
    const bioContainer = document.getElementById('bio-logs-list');

    try {
        const response = await fetch('logs-index.json');
        const sections = await response.json();

        // LIFO Sort
        sections.reverse();
        sections.forEach(s => s.logs && s.logs.reverse());

        if (logsContainer) renderLogs(logsContainer, sections);
        if (bioContainer) renderBioLogs(bioContainer, sections);

        // DIRECT LINK LOGIC: If URL has a hash (from bio click), open it immediately
        const currentHash = window.location.hash;
        if (currentHash.startsWith('#log-')) {
            const filePath = currentHash.replace('#log-', '');
            // Find the log object in our data
            const allLogs = sections.flatMap(s => s.logs);
            const targetLog = allLogs.find(l => l.path === filePath);
            if (targetLog) openFullscreenLog(targetLog);
        }
    } catch (e) { console.error(e); }
}

// --- MAIN LOGS PAGE RENDERER ---

function renderLogs(container, sections) {
    container.innerHTML = ''; 

    sections.forEach((section) => {
        const seasonFolder = document.createElement('details');
        seasonFolder.className = 'season-folder';

        const seasonSummary = document.createElement('summary');
        seasonSummary.className = 'season-header';
        seasonSummary.innerHTML = `
            <div class="folder-title">
                <i class="fas fa-folder"></i>
                <span>${section.title}</span>
            </div>
            <span class="custom-arrow"><i class="fas fa-chevron-right"></i></span>
        `;

        // Exclusive Logic: Close other folders when one opens
        seasonSummary.addEventListener('click', () => {
            if (!seasonFolder.hasAttribute('open')) {
                document.querySelectorAll('.season-folder').forEach(other => {
                    if (other !== seasonFolder) other.removeAttribute('open');
                });
            }
        });

        const logsList = document.createElement('div');
        logsList.className = 'logs-preview-list';

        // LIFO order for the logs
        section.logs.forEach((log) => {
            const logRow = document.createElement('div');
            logRow.className = 'log-file-row';
            logRow.innerHTML = `
                <span class="file-name">${log.filename}</span>
                <span class="file-date">${log.date || ''}</span>
            `;
            logRow.onclick = () => openFullscreenLog(log);
            logsList.appendChild(logRow);
        });

        seasonFolder.appendChild(seasonSummary);
        seasonFolder.appendChild(logsList);
        container.appendChild(seasonFolder);
    });
}

// --- BIO SECTION RENDERER (Simplified to prevent crashing) ---

/**
 * Renders the Bio section with the clean, minimalist grid
 */
function renderBioLogs(container, sections) {
    let allLogs = [];
    
    // Process sections to flatten the log list
    sections.forEach(section => {
        section.logs.forEach(log => {
            allLogs.push({ 
                ...log, 
                seasonTitle: section.title || "Recent" // Fallback if title is missing
            });
        });
    });

    // Sort by date (LIFO)
    allLogs.sort((a, b) => new Date(b.date) - new Date(a.date));

    container.innerHTML = '';
    
    // Render top 4
    allLogs.slice(0, 4).forEach(log => {
        const card = document.createElement('div');
        card.className = 'bio-log-card'; 
        
        // Ensure strings are valid to avoid "undefined"
        const displaySeason = (log.seasonTitle).toUpperCase();
        const displayDate = log.date ? `• ${log.date}` : "";

        card.innerHTML = `
            <span class="meta">${displaySeason} ${displayDate}</span>
            <h3>${log.filename || "Untitled Log"}</h3>
        `;
        
        // Open the log directly on click
        card.onclick = () => openFullscreenLog(log);
        container.appendChild(card);
    });
}

/**
 * Opens log in a persistent view with a pinned back button
 */
async function openFullscreenLog(log) {
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

        // Close logic
        document.getElementById('close-viewer').onclick = () => {
            reader.remove();
            document.body.style.overflow = '';
        };

        // Optional Scroll to top
        document.getElementById('scroll-top-btn').onclick = () => {
            reader.scrollTo({ top: 0, behavior: 'smooth' });
        };
        
    } catch (err) { console.error("Error opening log:", err); }
}

document.addEventListener('DOMContentLoaded', loadWeeklyLogs);

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
    if (typedName && typedGreeting) {
        setTimeout(() => {
            startSynchronizedTyping(
                typedName,
                ['tlee', 'トリー', '智坦'],
                typedGreeting,
                ['Hi!', 'こんにちは!', '你好!'],
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
    loadWeeklyLogs(false);
    loadWeeklyLogs(true);

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

        const updateSidebarForColor = (color) => {
            const sidebar = document.querySelector('.sidebar');
            if (sidebar) {
                if (color === '#f7fbff' || color === '#000' || color === '#000000') {
                    sidebar.style.color = '#282828';
                    sidebar.style.borderRight = '1px solid rgba(255, 255, 255, 0.08)';
                } else if (color === '#ede3d8' || color === '#16ca82') {
                    // Light backgrounds - use dark text
                    sidebar.style.color = '#282828';
                    sidebar.style.borderRight = '1px solid rgba(0, 0, 0, 0.08)';
                } else {
                    sidebar.style.color = '#282828';
                    sidebar.style.borderRight = '1px solid rgba(0, 0, 0, 0.06)';
                }
            }
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
      const iconClass = typeof getIconClassForRepo === 'function' ? getIconClassForRepo(repo) : 'fas fa-code';
      icon.innerHTML = `<i class="${iconClass}"></i>`;

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


// Console welcome message
console.log(`
🚀 Welcome to Tristan Lee's Portfolio!
   
   Built with vanilla HTML, CSS, and JavaScript
   
   https://www.linkedin.com/in/tlee06/
`);