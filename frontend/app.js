/**
 * Prompt Tutor — Linear-style Frontend
 * All 4 pages, loading/skeleton state, mobile bottom tab bar sync
 * Dark mode, diff view, search, example dropdown, score improvement chart
 */

class App {
    constructor() {
        this.API = location.hostname === 'localhost' ? 'http://localhost:3000/api' : '/api';
        this.analysis = null;
        this.originalPrompt = '';
        this.variant = 'default';
        this.filter = 'all';
        this.searchQuery = '';
        this.sortMode = 'newest';
        this.history = [];
        this.showDiff = false;
        this.cachedKeyStatus = null;
        this.loadingPhrases = [
            'Analyzing structure...',
            'Checking clarity and constraints...',
            'Generating improved versions...'
        ];
        this.loadingTick = null;
        this.charts = { line: null, bar: null, radar: null };
        this.particle = {
            canvas: null,
            ctx: null,
            particles: [],
            dpr: Math.min(window.devicePixelRatio || 1, 2),
            rafId: null,
            width: 0,
            height: 0,
            palette: null,
            reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        };
        this.cache();
        this.bind();
        // Spotlight effect (Optimized with rAF)
        let ticking = false;
        window.addEventListener('mousemove', e => {
            if (!ticking) {
                window.requestAnimationFrame(() => {
                    document.body.style.setProperty('--mouse-x', `${e.clientX}px`);
                    document.body.style.setProperty('--mouse-y', `${e.clientY}px`);
                    ticking = false;
                });
                ticking = true;
            }
        });
    }

    cache() {
        this.$ = {
            sidebar: document.getElementById('sidebar'),
            sbLinks: document.querySelectorAll('.sb-link[data-view]'),
            btmTabs: document.querySelectorAll('.btm-tab[data-view]'),
            views: document.querySelectorAll('.view'),
            badge: document.getElementById('libBadge'),
            input: document.getElementById('promptInput'),
            clearBtn: document.getElementById('clearBtn'),
            analyzeBtn: document.getElementById('analyzeBtn'),
            analyzeTxt: document.getElementById('analyzeTxt'),
            spinner: document.getElementById('spinner'),
            errBar: document.getElementById('errBar'),
            errMsg: document.getElementById('errMsg'),
            errX: document.getElementById('errX'),
            tonePill: document.getElementById('tonePill'),
            wc: document.getElementById('wc'),
            cc: document.getElementById('cc'),
            tc: document.getElementById('tc'),
            // Results
            emptyState: document.getElementById('emptyState'),
            loadingState: document.getElementById('loadingState'),
            resultsContent: document.getElementById('resultsContent'),
            ringProgress: document.getElementById('ringProgress'),
            scoreVal: document.getElementById('scoreVal'),
            scoreLabel: document.getElementById('scoreLabel'),
            scoreTone: document.getElementById('scoreTone'),
            scoreEls: document.getElementById('scoreEls'),
            strengthsList: document.getElementById('strengthsList'),
            missingList: document.getElementById('missingList'),
            tipsList: document.getElementById('tipsList'),
            impText: document.getElementById('impText'),
            diffView: document.getElementById('diffView'),
            diffToggle: document.getElementById('diffToggle'),
            useBtn: document.getElementById('useBtn'),
            copyBtn: document.getElementById('copyBtn'),
            copyTxt: document.getElementById('copyTxt'),
            varTabs: document.querySelectorAll('.var-tab'),
            // Example dropdown
            exampleTrigger: document.getElementById('exampleTrigger'),
            exampleMenu: document.getElementById('exampleMenu'),
            quickChips: document.querySelectorAll('.qb-chip'),
            loadingText: document.querySelector('.loading-text'),
            // Library
            libGrid: document.getElementById('libGrid'),
            libEmpty: document.getElementById('libEmpty'),
            libSearch: document.getElementById('libSearch'),
            libSort: document.getElementById('libSort'),
            exportBtn: document.getElementById('exportBtn'),
            importBtn: document.getElementById('importBtn'),
            importInput: document.getElementById('importInput'),
            clearAllBtn: document.getElementById('clearAllBtn'),
            filters: document.querySelectorAll('.filt'),
            // Stats
            sTot: document.getElementById('sTot'),
            sAvg: document.getElementById('sAvg'),
            sBest: document.getElementById('sBest'),
            sWeek: document.getElementById('sWeek'),
            barChart: document.getElementById('barChart'),
            lineChartWrap: document.getElementById('lineChartWrap'),
            lineChart: document.getElementById('lineChart'),
            trendLabel: document.getElementById('trendLabel'),
            radarChart: document.getElementById('radarChart'),
            // Modal
            modal: document.getElementById('modal'),
            modalOverlay: document.getElementById('modalOverlay'),
            modalX: document.getElementById('modalX'),
            saveKeyBtn: document.getElementById('saveKeyBtn'),
            apiKeyInput: document.getElementById('apiKeyInput'),
            modalStatus: document.getElementById('modalStatus'),
            apiDot: document.getElementById('apiDot'),
            keyToggle: document.getElementById('keyToggle'),
            // Theme
            themeToggle: document.getElementById('themeToggle'),
            themeIcon: document.getElementById('themeIcon'),
            themeLabel: document.getElementById('themeLabel'),
            particleCanvas: document.getElementById('particleCanvas'),
            // Toast
            toastStack: document.getElementById('toastStack'),
            // Tour
            tourFab: document.getElementById('tourFab'),
            tourWrap: document.getElementById('tourWrap'),
            tourOverlay: document.getElementById('tourOverlay'),
            tourClose: document.getElementById('tourClose'),
            tourTitle: document.getElementById('tourTitle'),
            tourDesc: document.getElementById('tourDesc'),
            tourStep: document.getElementById('tourStep'),
            tourPrev: document.getElementById('tourPrev'),
            tourNext: document.getElementById('tourNext'),
            tourSkip: document.getElementById('tourSkip'),
            tourDots: document.getElementById('tourDots'),
        };
        this.pills = {};
        document.querySelectorAll('.el-pill').forEach(p => { this.pills[p.dataset.el] = p; });
    }

    bind() {
        // Desktop nav
        this.$.sbLinks.forEach(n => n.addEventListener('click', () => this.go(n.dataset.view)));
        // Mobile bottom tabs
        this.$.btmTabs.forEach(t => t.addEventListener('click', () => this.go(t.dataset.view)));
        // Settings nav
        document.getElementById('settingsNav')?.addEventListener('click', () => this.openModal());
        document.getElementById('btmSettings')?.addEventListener('click', () => this.openModal());
        // Input
        this.$.input.addEventListener('input', () => { this.detect(); this.counts(); this.$.analyzeBtn.disabled = !this.$.input.value.trim(); this.saveDraft(); });
        this.$.input.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !this.$.analyzeBtn.disabled) { e.preventDefault(); this.analyze(); } });
        document.addEventListener('keydown', (e) => {
            if (e.key === '/' && document.activeElement !== this.$.input && !this.$.modal.classList.contains('open') && !this.$.tourWrap.classList.contains('open')) {
                e.preventDefault();
                this.$.input.focus();
            }
        });
        // Example dropdown
        this.$.exampleTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            this.$.exampleMenu.classList.toggle('open');
        });
        document.addEventListener('click', () => this.$.exampleMenu.classList.remove('open'));
        document.querySelectorAll('.example-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                this.$.input.value = item.dataset.tpl;
                this.detect(); this.counts();
                this.$.analyzeBtn.disabled = false;
                this.$.input.focus();
                this.saveDraft();
                this.$.exampleMenu.classList.remove('open');
            });
        });
        this.$.quickChips.forEach(chip => {
            chip.addEventListener('click', () => this.insertTemplate(chip.dataset.insert || ''));
        });
        // Actions
        this.$.clearBtn.addEventListener('click', () => this.clear());
        this.$.analyzeBtn.addEventListener('click', () => this.analyze());
        this.$.errX.addEventListener('click', () => this.$.errBar.style.display = 'none');
        this.$.useBtn.addEventListener('click', () => this.useImproved());
        this.$.copyBtn.addEventListener('click', () => this.copyImproved());
        // Diff toggle
        this.$.diffToggle.addEventListener('click', () => this.toggleDiff());
        // Variant tabs
        this.$.varTabs.forEach(t => t.addEventListener('click', () => { this.$.varTabs.forEach(x => x.classList.remove('active')); t.classList.add('active'); this.variant = t.dataset.var; this.showVariant(); }));
        // Library
        this.$.clearAllBtn.addEventListener('click', () => this.clearAll());
        this.$.filters.forEach(f => f.addEventListener('click', () => { this.$.filters.forEach(x => x.classList.remove('active')); f.classList.add('active'); this.filter = f.dataset.f; this.renderLib(); }));
        this.$.libSearch.addEventListener('input', () => { this.searchQuery = this.$.libSearch.value.trim().toLowerCase(); this.renderLib(); });
        this.$.libSort?.addEventListener('change', () => { this.sortMode = this.$.libSort.value; this.renderLib(); });
        this.$.exportBtn?.addEventListener('click', () => this.exportHistory());
        this.$.importBtn?.addEventListener('click', () => this.$.importInput?.click());
        this.$.importInput?.addEventListener('change', (e) => this.importHistoryFile(e));
        // Modal
        this.$.modalOverlay.addEventListener('click', () => this.closeModal());
        this.$.modalX.addEventListener('click', () => this.closeModal());
        this.$.saveKeyBtn.addEventListener('click', () => this.saveKey());
        // Eye toggle
        this.$.keyToggle.addEventListener('click', () => {
            const inp = this.$.apiKeyInput;
            inp.type = inp.type === 'password' ? 'text' : 'password';
        });
        // Theme toggle
        this.$.themeToggle.addEventListener('click', () => this.toggleTheme());

        // Tour
        this.$.tourFab?.addEventListener('click', () => this.openTour(true));
        this.$.tourOverlay?.addEventListener('click', () => this.closeTour());
        this.$.tourClose?.addEventListener('click', () => this.closeTour());
        this.$.tourSkip?.addEventListener('click', () => this.closeTour(true));
        this.$.tourPrev?.addEventListener('click', () => this.nextTour(-1));
        this.$.tourNext?.addEventListener('click', () => this.nextTour(1));
    }

    async init() {
        this.loadTheme();
        this.initParticles();
        this.checkKey();
        this.loadBadge();
        this.loadDraft();
        this.buildCheatSheet();
        this.openTour(false);
    }

    /* ===== Dark Mode ===== */
    loadTheme() {
        const saved = localStorage.getItem('pt_theme') || 'light';
        document.documentElement.setAttribute('data-theme', saved);
        this.updateThemeUI(saved);
    }

    toggleTheme() {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('pt_theme', next);
        this.updateThemeUI(next);
        this.updateParticlePalette();
        if (document.getElementById('view-stats')?.classList.contains('active')) {
            this.loadStats();
        }
    }

    initParticles() {
        const canvas = this.$.particleCanvas;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        this.particle.canvas = canvas;
        this.particle.ctx = ctx;

        const media = window.matchMedia('(prefers-reduced-motion: reduce)');
        const onMotionChange = (e) => {
            this.particle.reducedMotion = e.matches;
            this.rebuildParticles();
        };
        if (typeof media.addEventListener === 'function') {
            media.addEventListener('change', onMotionChange);
        } else if (typeof media.addListener === 'function') {
            media.addListener(onMotionChange);
        }

        window.addEventListener('resize', () => this.rebuildParticles(), { passive: true });
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                if (this.particle.rafId) cancelAnimationFrame(this.particle.rafId);
                this.particle.rafId = null;
            } else if (!this.particle.rafId) {
                this.animateParticles();
            }
        });

        this.rebuildParticles();
    }

    updateParticlePalette() {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        this.particle.palette = isDark
            ? ['129, 140, 248', '45, 212, 191', '244, 114, 182']
            : ['79, 70, 229', '16, 185, 129', '99, 102, 241'];
    }

    rebuildParticles() {
        if (!this.particle.canvas || !this.particle.ctx) return;

        const { canvas, ctx } = this.particle;
        this.particle.dpr = Math.min(window.devicePixelRatio || 1, 2);
        this.particle.width = window.innerWidth;
        this.particle.height = window.innerHeight;

        canvas.width = Math.floor(this.particle.width * this.particle.dpr);
        canvas.height = Math.floor(this.particle.height * this.particle.dpr);
        canvas.style.width = `${this.particle.width}px`;
        canvas.style.height = `${this.particle.height}px`;
        ctx.setTransform(this.particle.dpr, 0, 0, this.particle.dpr, 0, 0);

        this.updateParticlePalette();
        const area = this.particle.width * this.particle.height;
        const targetCount = this.particle.reducedMotion
            ? Math.max(16, Math.round(area / 100000))
            : Math.max(28, Math.round(area / 52000));

        this.particle.particles = Array.from({ length: targetCount }, () => {
            const speedScale = this.particle.reducedMotion ? 0.06 : 0.22;
            return {
                x: Math.random() * this.particle.width,
                y: Math.random() * this.particle.height,
                r: Math.random() * 2.2 + 0.8,
                vx: (Math.random() - 0.5) * speedScale,
                vy: (Math.random() - 0.5) * speedScale,
                alpha: Math.random() * 0.35 + 0.15,
                c: this.particle.palette[Math.floor(Math.random() * this.particle.palette.length)]
            };
        });

        if (this.particle.rafId) cancelAnimationFrame(this.particle.rafId);
        this.particle.rafId = null;
        this.animateParticles();
    }

    animateParticles() {
        if (!this.particle.ctx || !this.particle.canvas || document.hidden) return;

        const { ctx, width, height, particles } = this.particle;
        ctx.clearRect(0, 0, width, height);

        for (const p of particles) {
            p.x += p.vx;
            p.y += p.vy;

            if (p.x < -20) p.x = width + 20;
            if (p.x > width + 20) p.x = -20;
            if (p.y < -20) p.y = height + 20;
            if (p.y > height + 20) p.y = -20;

            ctx.beginPath();
            ctx.fillStyle = `rgba(${p.c}, ${p.alpha})`;
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fill();
        }

        const maxDist = 120;
        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const a = particles[i];
                const b = particles[j];
                const dx = a.x - b.x;
                const dy = a.y - b.y;
                const dist = Math.hypot(dx, dy);
                if (dist < maxDist) {
                    const op = (1 - dist / maxDist) * 0.18;
                    ctx.strokeStyle = `rgba(148, 163, 184, ${op})`;
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(a.x, a.y);
                    ctx.lineTo(b.x, b.y);
                    ctx.stroke();
                }
            }
        }

        if (!this.particle.reducedMotion) {
            this.particle.rafId = requestAnimationFrame(() => this.animateParticles());
        }
    }

    updateThemeUI(theme) {
        if (theme === 'dark') {
            this.$.themeIcon.innerHTML = '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>';
            this.$.themeLabel.textContent = 'Light Mode';
        } else {
            this.$.themeIcon.innerHTML = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';
            this.$.themeLabel.textContent = 'Dark Mode';
        }
    }

    /* ===== Navigation ===== */
    go(view) {
        let actualView = view === 'saved' ? 'library' : view;
        
        // Sync sidebar
        this.$.sbLinks.forEach(n => n.classList.toggle('active', n.dataset.view === view));
        // Sync bottom tabs
        this.$.btmTabs.forEach(t => t.classList.toggle('active', t.dataset.view === view));
        // Show view
        this.$.views.forEach(v => { v.classList.toggle('active', v.id === `view-${actualView}`); });
        
        if (actualView === 'library') {
            const fGrp = document.getElementById('libFilters');
            if(fGrp) {
                fGrp.style.display = view === 'saved' ? 'none' : 'flex';
                this.filter = view === 'saved' ? 'saved' : 'all';
                fGrp.querySelectorAll('.filt').forEach(f => f.classList.toggle('active', f.dataset.f === this.filter));
            }
            this.loadLib();
        }
        if (actualView === 'stats') this.loadStats();
    }

    /* ===== API Key ===== */
    openModal() { this.$.modal.classList.add('open'); }
    closeModal() { this.$.modal.classList.remove('open'); }

    async checkKey() {
        try {
            const r = await this.apiFetch(['/settings/apikey/status', '/check-api-key']);
            const d = await r.json();
            const configured = !!(d.configured || d.hasKey);
            this.cachedKeyStatus = configured;
            this.$.apiDot.classList.toggle('on', configured);
            if (!configured) setTimeout(() => this.openModal(), 1000);
        } catch (e) {}
    }

    async saveKey() {
        const k = this.$.apiKeyInput.value.trim();
        if (!k) return;
        this.$.saveKeyBtn.textContent = 'Saving…';
        try {
            const r = await this.apiFetch(['/settings/apikey', '/set-api-key'], {
                method: 'POST',
                headers: {'Content-Type':'application/json'},
                body: JSON.stringify({apiKey:k})
            });
            if (r.ok) {
                this.$.apiKeyInput.value = '';
                this.checkKey();
                this.toast('API key saved', 'ok');
                setTimeout(() => this.closeModal(), 600);
            } else throw new Error();
        } catch (e) {
            this.$.modalStatus.textContent = 'Error saving key';
            this.$.modalStatus.style.color = 'var(--red)';
        } finally { this.$.saveKeyBtn.textContent = 'Save Configuration'; }
    }

    /* ===== Live Detection ===== */
    detect() {
        const t = this.$.input.value;
        const elements = this.detectElementsFromText(t);
        Object.entries(elements).forEach(([k, on]) => {
            const p = this.pills[k];
            if (on) { p.classList.remove('missing'); p.classList.add('detected'); }
            else { p.classList.remove('detected'); p.classList.add('missing'); }
        });
        let tone = 'Neutral';
        if (/please|kindly|would you|appreciate|thank you/i.test(t)) tone = 'Formal';
        else if (/must|exactly|strict|constraint|no more than|required/i.test(t)) tone = 'Directive';
        else if (/algorithm|function|api|database|deploy|syntax|variable|code/i.test(t)) tone = 'Technical';
        else if (/imagine|creative|unique|innovative|story|narrative/i.test(t)) tone = 'Creative';
        else if (/hey|hi |yo |bro|cool|awesome|lol/i.test(t)) tone = 'Casual';
        else if (/analyze|compare|evaluate|assess|research|study/i.test(t)) tone = 'Analytical';
        this.$.tonePill.textContent = tone;
    }

    counts() {
        const t = this.$.input.value;
        this.$.wc.textContent = t.trim() ? t.trim().split(/\s+/).length : 0;
        this.$.cc.textContent = t.length;
        this.$.tc.textContent = Math.ceil(t.length / 4);
    }

    /* ===== Analyze ===== */
    async analyze() {
        const prompt = this.$.input.value.trim();
        if (!prompt) return;
        if (prompt.length > 8000) {
            this.showErr('Prompt is too long. Please keep it under 8000 characters.');
            return;
        }
        this.originalPrompt = prompt;
        this.setLoading(true);
        // Clear previous state explicitly
        this.$.impText.textContent = '';
        this.analysis = null;
        // Show loading state in results
        this.$.emptyState.style.display = 'none';
        this.$.resultsContent.style.display = 'none';
        this.$.loadingState.style.display = 'flex';

        try {
            const r = await fetch(`${this.API}/analyze`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({prompt}) });
            const d = await r.json();
            if (!r.ok) throw new Error(d.error || 'Analysis failed.');
            this.analysis = this.normalizeAnalysis(d.analysis || d, prompt);
            this.variant = 'default';
            this.showDiff = false;
            this.$.diffToggle.classList.remove('active');
            this.render(this.analysis);
            this.loadBadge();
            this.toast('Analysis complete', 'ok');
        } catch (e) { this.showErr(e.message); this.$.loadingState.style.display = 'none'; this.$.emptyState.style.display = 'flex'; }
        finally { this.setLoading(false); }
    }

    /* Normalize analysis to handle both old and new schema */
    normalizeAnalysis(a, promptText = '') {
        // Handle improved as object or string
        let improved = '', improvedDev = '', improvedBeg = '';
        if (typeof a.improved === 'object' && a.improved !== null) {
            improved = a.improved.default || '';
            improvedDev = a.improved.developer || '';
            improvedBeg = a.improved.beginner || '';
        } else {
            improved = a.improved || a.improved_prompt || '';
            improvedDev = a.improvedDeveloper || improved;
            improvedBeg = a.improvedBeginner || improved;
        }

        // Handle tips/proTips
        const tips = (a.proTips || a.tips || []).map(tip => {
            if (typeof tip === 'string') return { title: tip, description: '' };
            return {
                title: tip.title || '',
                description: tip.description || tip.body || ''
            };
        });

        const fallbackElements = this.detectElementsFromText(promptText || this.$.input.value || '');
        const normalizedElements = a.elements && Object.values(a.elements).some(Boolean)
            ? a.elements
            : fallbackElements;

        return {
            score: a.score || 0,
            category: a.category || a.label || a.verdict || '',
            scoreLabel: a.scoreLabel || a.label || '',
            tone: a.tone || '—',
            elements: normalizedElements,
            strengths: a.strengths || [],
            missing: a.missing || a.weaknesses || [],
            tips,
            improved,
            improvedDeveloper: improvedDev,
            improvedBeginner: improvedBeg,
        };
    }

    render(a) {
        this.$.loadingState.style.display = 'none';
        this.$.emptyState.style.display = 'none';
        this.$.errBar.style.display = 'none';
        this.$.resultsContent.style.display = 'flex';

        const s = a.score || 0;
        const circ = 238.76; // 2*π*38
        // Reset ring first for smooth animation
        this.$.ringProgress.style.transition = 'none';
        this.$.ringProgress.style.strokeDashoffset = circ;
        // Force reflow to ensure the reset takes effect
        this.$.ringProgress.getBoundingClientRect();
        // Animate to target
        this.$.ringProgress.style.transition = 'stroke-dashoffset 0.8s ease-out, stroke 0.3s ease';
        this.$.ringProgress.style.strokeDashoffset = circ - (s / 10) * circ;
        this.$.ringProgress.style.stroke = s >= 7 ? 'url(#grad-high)' : s >= 4 ? 'url(#grad-mid)' : 'url(#grad-low)';
        this.$.scoreVal.innerHTML = `${s}<span>/10</span>`;
        this.$.scoreLabel.textContent = a.category || a.scoreLabel || this.sLabel(s);
        this.$.scoreLabel.style.color = this.sColor(s);
        this.$.scoreTone.textContent = a.tone || '—';

        // Element pills
        this.$.scoreEls.innerHTML = '';
        const els = a.elements || {};
        ['role','format','constraints','examples','context'].forEach(k => {
            const on = els[k];
            const pill = document.createElement('span');
            pill.className = `se-pill ${on ? 'on' : 'off'}`;
            pill.innerHTML = `<span class="se-dot"></span>${k.charAt(0).toUpperCase() + k.slice(1)}`;
            this.$.scoreEls.appendChild(pill);
        });

        this.$.strengthsList.innerHTML = (a.strengths||[]).map(s => `<li>${this.esc(s)}</li>`).join('') || '<li>—</li>';
        this.$.missingList.innerHTML = (a.missing||[]).map(s => `<li>${this.esc(s)}</li>`).join('') || '<li>—</li>';

        // Tips accordion
        this.$.tipsList.innerHTML = '';
        (a.tips||[]).forEach(tip => {
            const item = document.createElement('div');
            item.className = 'tip-item';
            item.innerHTML = `
                <button class="tip-head">
                    <span>${this.esc(tip.title)}</span>
                    <svg class="tip-chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
                </button>
                <div class="tip-body"><div class="tip-content">${this.esc(tip.description)}</div></div>`;
            item.querySelector('.tip-head').addEventListener('click', () => item.classList.toggle('open'));
            this.$.tipsList.appendChild(item);
        });

        this.$.varTabs.forEach(t => t.classList.remove('active'));
        this.$.varTabs[0].classList.add('active');
        this.variant = 'default';
        this.showVariant();

        document.getElementById('resultsCol')?.scrollTo({top:0, behavior:'smooth'});
    }

    showVariant() {
        if (!this.analysis) return;
        const a = this.analysis;
        let t = '';
        if (this.variant === 'developer') t = a.improvedDeveloper || a.improved || '';
        else if (this.variant === 'beginner') t = a.improvedBeginner || a.improved || '';
        else t = a.improved || '';
        this.$.impText.textContent = t;

        // Update diff if active
        if (this.showDiff) {
            this.renderDiff();
        }
    }

    /* ===== Diff View ===== */
    toggleDiff() {
        this.showDiff = !this.showDiff;
        this.$.diffToggle.classList.toggle('active', this.showDiff);
        if (this.showDiff) {
            this.$.impText.style.display = 'none';
            this.$.diffView.style.display = 'block';
            this.$.diffView.style.opacity = '0';
            requestAnimationFrame(() => { this.$.diffView.style.opacity = '1'; });
            this.renderDiff();
        } else {
            this.$.impText.style.display = 'block';
            this.$.impText.style.opacity = '0';
            requestAnimationFrame(() => { this.$.impText.style.opacity = '1'; });
            this.$.diffView.style.display = 'none';
        }
    }

    renderDiff() {
        const original = this.originalPrompt || '';
        const improved = this.$.impText.textContent || '';
        const diff = this.computeWordDiff(original, improved);
        this.$.diffView.innerHTML = diff;
    }

    computeWordDiff(oldText, newText) {
        const oldWords = oldText.split(/(\s+)/);
        const newWords = newText.split(/(\s+)/);

        // Simple LCS-based diff
        const m = oldWords.length, n = newWords.length;
        const dp = Array.from({length: m + 1}, () => Array(n + 1).fill(0));

        for (let i = 1; i <= m; i++) {
            for (let j = 1; j <= n; j++) {
                if (oldWords[i-1] === newWords[j-1]) dp[i][j] = dp[i-1][j-1] + 1;
                else dp[i][j] = Math.max(dp[i-1][j], dp[i][j-1]);
            }
        }

        // Backtrack
        const result = [];
        let i = m, j = n;
        while (i > 0 || j > 0) {
            if (i > 0 && j > 0 && oldWords[i-1] === newWords[j-1]) {
                result.unshift({ type: 'same', text: oldWords[i-1] });
                i--; j--;
            } else if (j > 0 && (i === 0 || dp[i][j-1] >= dp[i-1][j])) {
                result.unshift({ type: 'add', text: newWords[j-1] });
                j--;
            } else {
                result.unshift({ type: 'del', text: oldWords[i-1] });
                i--;
            }
        }

        return result.map(r => {
            if (r.type === 'add') return `<span class="diff-add">${this.esc(r.text)}</span>`;
            if (r.type === 'del') return `<span class="diff-del">${this.esc(r.text)}</span>`;
            return this.esc(r.text);
        }).join('');
    }

    /* ===== Actions ===== */
    useImproved() {
        const t = this.$.impText.textContent;
        if (!t) return;
        this.$.input.value = t;
        this.detect(); this.counts();
        this.$.analyzeBtn.disabled = false;
        this.$.input.focus();
        this.saveDraft();
        this.toast('Loaded into editor', 'ok');
    }

    copyImproved() {
        const t = this.$.impText.textContent;
        if (!t) return;
        const finalize = () => {
            this.$.copyTxt.textContent = 'Copied!';
            this.toast('Copied to clipboard', 'ok');
            setTimeout(() => this.$.copyTxt.textContent = 'Copy', 2000);
        };
        if (navigator.clipboard?.writeText) {
            navigator.clipboard.writeText(t).then(finalize).catch(() => this.fallbackCopy(t, finalize));
            return;
        }
        this.fallbackCopy(t, finalize);
    }

    clear() {
        this.$.input.value = '';
        this.$.analyzeBtn.disabled = true;
        this.$.resultsContent.style.display = 'none';
        this.$.loadingState.style.display = 'none';
        this.$.emptyState.style.display = 'flex';
        this.$.errBar.style.display = 'none';
        this.analysis = null;
        this.originalPrompt = '';
        this.showDiff = false;
        this.$.diffToggle.classList.remove('active');
        this.detect(); this.counts();
        this.$.input.focus();
        this.saveDraft();
    }

    /* ===== Library ===== */
    async loadBadge() {
        try {
            const r = await fetch(`${this.API}/history`);
            const d = await r.json();
            this.$.badge.textContent = d.length;
            this.$.badge.style.display = d.length > 0 ? 'inline-block' : 'none';
        } catch (e) {}
    }

    async loadLib() {
        try {
            const r = await fetch(`${this.API}/history`);
            this.history = await r.json();
            this.renderLib();
        } catch (e) { this.$.libGrid.innerHTML = ''; this.$.libEmpty.style.display = 'flex'; }
    }

    renderLib() {
        let items = [...this.history];

        // Filter by score / saved
        if (this.filter === 'saved') items = items.filter(i => i.isSaved);
        else if (this.filter === 'high') items = items.filter(i => i.score >= 7);
        else if (this.filter === 'mid') items = items.filter(i => i.score >= 4 && i.score < 7);
        else if (this.filter === 'low') items = items.filter(i => i.score < 4);

        // Filter by search
        if (this.searchQuery) {
            items = items.filter(i => i.prompt_text.toLowerCase().includes(this.searchQuery));
        }

        // Sort
        if (this.sortMode === 'oldest') items.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        else if (this.sortMode === 'score_high') items.sort((a, b) => (parseFloat(String(b.score).split('/')[0]) || 0) - (parseFloat(String(a.score).split('/')[0]) || 0));
        else if (this.sortMode === 'score_low') items.sort((a, b) => (parseFloat(String(a.score).split('/')[0]) || 0) - (parseFloat(String(b.score).split('/')[0]) || 0));
        else items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        this.$.clearAllBtn.style.display = this.history.length > 0 ? 'inline-flex' : 'none';

        if (!items.length) { this.$.libGrid.innerHTML = ''; this.$.libEmpty.style.display = 'flex'; return; }
        this.$.libEmpty.style.display = 'none';
        this.$.libGrid.innerHTML = items.map(i => {
            const cleanScore = parseFloat(String(i.score).split('/')[0]) || 0;
            const gradClass = cleanScore >= 7 ? 'sb-high' : cleanScore >= 4 ? 'sb-mid' : 'sb-low';
            const catBadge = i.tone || i.category || 'Neutral';
            const d = new Date(i.created_at);
            const ds = !isNaN(d) ? d.toLocaleDateString(undefined,{month:'short',day:'numeric'}) : '';
            const isSaved = i.isSaved;
            const saveIcon = isSaved ? 
                '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>' :
                '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>';

            return `<div class="lib-card ${isSaved ? 'is-saved' : ''}" onclick="app.viewItem(${i.id})">
                <div class="lc-top">
                    <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-start">
                        <span class="lc-score ${gradClass}">${cleanScore}/10</span>
                        <span class="lc-cat-badge">${this.esc(catBadge)}</span>
                    </div>
                    <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
                        <span class="lc-date">${ds}</span>
                        <button class="lc-save ${isSaved ? 'active' : ''}" onclick="event.stopPropagation();app.toggleSave(${i.id})" title="${isSaved ? 'Unsave' : 'Save'} Prompt">
                            ${saveIcon}
                        </button>
                    </div>
                </div>
                <div class="lc-text">${this.esc(i.prompt_text)}</div>
                <div class="lc-foot">
                    <span class="lc-label">${this.esc(i.category||i.label||i.verdict||this.sLabel(cleanScore))}</span>
                    <button class="lc-del" onclick="event.stopPropagation();app.delItem(${i.id})" aria-label="Delete">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>
                </div>
            </div>`;
        }).join('');
    }

    async viewItem(id) {
        try {
            const r = await fetch(`${this.API}/history/${id}`);
            if (!r.ok) return;
            const d = await r.json();
            this.go('craft');
            this.$.input.value = d.prompt_text;
            this.originalPrompt = d.prompt_text;
            this.$.analyzeBtn.disabled = false;
            this.detect(); this.counts();
            this.analysis = this.normalizeAnalysis(d, d.prompt_text || '');
            this.showDiff = false;
            this.$.diffToggle.classList.remove('active');
            this.render(this.analysis);
        } catch (e) {}
    }

    async delItem(id) {
        await fetch(`${this.API}/history/${id}`, {method:'DELETE'});
        this.loadLib(); this.loadBadge();
        this.toast('Deleted');
    }

    async toggleSave(id) {
        try {
            const r = await this.apiFetch([`/history/${id}/save`], { method: 'PATCH' });
            if (r.ok) {
                const res = await r.json();
                // Update local model
                const item = this.history.find(i => i.id === id);
                if (item) item.isSaved = res.isSaved;
                // Re-render
                this.renderLib();
                this.toast(res.isSaved ? 'Prompt Saved' : 'Prompt Removed', 'ok');
            }
        } catch (e) {
            this.toast('Failed to save', 'err');
        }
    }

    async clearAll() {
        if (!confirm('Clear all history?')) return;
        await fetch(`${this.API}/history`, {method:'DELETE'});
        this.loadLib(); this.loadBadge();
        this.toast('History cleared');
    }

    exportHistory() {
        if (!this.history.length) {
            this.toast('No history to export');
            return;
        }
        const payload = {
            exportedAt: new Date().toISOString(),
            count: this.history.length,
            prompts: this.history
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `prompt-tutor-history-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        this.toast('History exported', 'ok');
    }

    async importHistoryFile(e) {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const text = await file.text();
            const parsed = JSON.parse(text);
            const prompts = Array.isArray(parsed) ? parsed : parsed.prompts;

            if (!Array.isArray(prompts) || prompts.length === 0) {
                throw new Error('Invalid file. Expected a JSON array or { prompts: [] }.');
            }

            const r = await this.apiFetch(['/history/import'], {
                method: 'POST',
                headers: {'Content-Type':'application/json'},
                body: JSON.stringify({ prompts, mode: 'merge' })
            });
            const d = await r.json();
            if (!r.ok) throw new Error(d.error || 'Import failed');

            this.toast(`Imported ${d.imported || 0} prompts`, 'ok');
            this.$.importInput.value = '';
            await this.loadLib();
            await this.loadBadge();
            if (document.getElementById('view-stats')?.classList.contains('active')) {
                await this.loadStats();
            }
        } catch (err) {
            this.toast(err.message || 'Import failed', 'err');
            this.$.importInput.value = '';
        }
    }

    /* ===== Stats ===== */
    async loadStats() {
        try {
            const [sr, hr] = await Promise.all([fetch(`${this.API}/stats`), fetch(`${this.API}/history`)]);
            const stats = await sr.json();
            const hist = await hr.json();

            this.$.sTot.textContent = stats.totalAnalyzed || 0;
            this.$.sAvg.textContent = stats.averageScore || 0;
            this.$.sBest.textContent = stats.bestScore || 0;

            const now = new Date();
            const weekAgo = new Date(now.getTime() - 7*24*60*60*1000);
            this.$.sWeek.textContent = hist.filter(h => new Date(h.created_at) >= weekAgo).length;

            const total = hist.length || 1;
            const weak = hist.filter(h => { const sc = parseFloat(String(h.score).split('/')[0]) || 0; return sc < 4; }).length;
            const mid = hist.filter(h => { const sc = parseFloat(String(h.score).split('/')[0]) || 0; return sc >= 4 && sc < 7; }).length;
            const high = hist.filter(h => { const sc = parseFloat(String(h.score).split('/')[0]) || 0; return sc >= 7; }).length;
            this.renderDistributionChart({ weak, mid, high, total });

            // === Score Improvement Line Chart ===
            this.renderLineChart(stats.scoreHistory || []);

            // === Trend label ===
            const tl = this.$.trendLabel;
            if (tl) {
                if (stats.trend === 'improving') { tl.textContent = '↑ Improving'; tl.className = 'chart-sub up'; }
                else if (stats.trend === 'declining') { tl.textContent = '↓ Declining'; tl.className = 'chart-sub down'; }
                else { tl.textContent = '→ Stable'; tl.className = 'chart-sub flat'; }
            }

            // === Element Usage Radar Chart ===
            if (stats.elementUsage) {
                this.renderRadarChart(stats.elementUsage);
            } else {
                this.destroyChart('radar');
            }
        } catch (e) {}
    }

    renderLineChart(scoreHistory) {
        if (!window.Chart || !this.$.lineChart) return;
        if (!scoreHistory || scoreHistory.length < 2) {
            this.destroyChart('line');
            return;
        }
        this.destroyChart('line');
        const ctx = this.$.lineChart.getContext('2d');
        const labels = scoreHistory.map(d => {
            const dt = new Date(d.date);
            return !isNaN(dt) ? dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';
        });
        const data = scoreHistory.map(d => Number(d.score) || 0);

        const grad = ctx.createLinearGradient(0, 0, 0, 260);
        grad.addColorStop(0, 'rgba(129, 140, 248, 0.38)');
        grad.addColorStop(1, 'rgba(129, 140, 248, 0.02)');

        this.charts.line = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: 'Score',
                    data,
                    borderColor: this.css('--accent'),
                    backgroundColor: grad,
                    fill: true,
                    tension: 0.38,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    pointBackgroundColor: this.css('--card-solid'),
                    pointBorderColor: this.css('--accent'),
                    pointBorderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: 700, easing: 'easeOutQuart' },
                scales: {
                    y: {
                        min: 0,
                        max: 10,
                        ticks: { color: this.css('--tx3'), stepSize: 2 },
                        grid: { color: this.css('--border-lt') }
                    },
                    x: {
                        ticks: { color: this.css('--tx3') },
                        grid: { display: false }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: this.css('--card-solid'),
                        titleColor: this.css('--tx'),
                        bodyColor: this.css('--tx2'),
                        borderColor: this.css('--border'),
                        borderWidth: 1,
                        displayColors: false,
                        callbacks: {
                            label: (ctx2) => `Score: ${ctx2.parsed.y}/10`
                        }
                    }
                }
            }
        });
    }

    renderRadarChart(usage) {
        if (!window.Chart || !this.$.radarChart) return;
        this.destroyChart('radar');
        const ctx = this.$.radarChart.getContext('2d');
        const labels = ['Role', 'Format', 'Constraints', 'Examples', 'Context'];
        const values = [usage.role || 0, usage.format || 0, usage.constraints || 0, usage.examples || 0, usage.context || 0];

        this.charts.radar = new Chart(ctx, {
            type: 'radar',
            data: {
                labels,
                datasets: [{
                    data: values,
                    borderColor: this.css('--accent'),
                    backgroundColor: 'rgba(129, 140, 248, 0.28)',
                    pointBackgroundColor: this.css('--accent'),
                    pointBorderColor: this.css('--card-solid'),
                    pointBorderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: 700, easing: 'easeOutQuart' },
                plugins: { legend: { display: false } },
                scales: {
                    r: {
                        beginAtZero: true,
                        angleLines: { color: this.css('--border-lt') },
                        grid: { color: this.css('--border-lt') },
                        pointLabels: { color: this.css('--tx2'), font: { size: 11, weight: '600' } },
                        ticks: { display: false }
                    }
                }
            }
        });
    }

    renderDistributionChart({ weak, mid, high, total }) {
        if (!window.Chart || !this.$.barChart) return;
        this.destroyChart('bar');
        const ctx = this.$.barChart.getContext('2d');

        const pct = (v) => total > 0 ? Math.round((v / total) * 100) : 0;
        const values = [weak, mid, high];

        this.charts.bar = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Weak', 'Needs Work', 'High'],
                datasets: [{
                    data: values,
                    backgroundColor: ['#ef4444', '#f59e0b', '#059669'],
                    borderRadius: 10,
                    borderSkipped: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: 700, easing: 'easeOutQuart' },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { color: this.css('--tx3'), precision: 0 },
                        grid: { color: this.css('--border-lt') }
                    },
                    x: {
                        ticks: { color: this.css('--tx2') },
                        grid: { display: false }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: this.css('--card-solid'),
                        titleColor: this.css('--tx'),
                        bodyColor: this.css('--tx2'),
                        borderColor: this.css('--border'),
                        borderWidth: 1,
                        callbacks: {
                            label: (ctx2) => `${ctx2.raw} prompts (${pct(ctx2.raw)}%)`
                        }
                    }
                }
            }
        });
    }

    destroyChart(name) {
        const chart = this.charts[name];
        if (chart) {
            chart.destroy();
            this.charts[name] = null;
        }
    }

    css(name) {
        return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#999';
    }

    detectElementsFromText(text) {
        const t = String(text || '');
        return {
            role: /act as|you are a?|persona|pretend|role|as a|expert|assistant|developer|scientist|writer|teacher|coach/i.test(t),
            format: /\b(json|markdown|table|csv|format|output|structure|code block|email|report|essay|html|xml|numbered list|bullet(?: points?)?|step-by-step)\b|(?:return|respond|output)\s+(?:in|as)\s+(?:a|an)?\s*(?:json|table|list|markdown|csv)/i.test(t),
            constraints: /\b(limit|max|must|exactly|no more|at least|words|under|avoid|don't|do not|never|only|restrict|constraint|edge case(?:s)?|handle edge|including edge)\b/i.test(t),
            examples: /example|sample|for instance|input:|output:|e\.g\.|demonstrate|like this|such as/i.test(t),
            context: /context|background|situation|scenario|given that|assuming|based on|the goal|objective|purpose|audience|for (?:a|an) [\w\s-]+ (?:student|beginner)|target audience/i.test(t)
        };
    }

    /* ===== Cheat Sheet ===== */
    buildCheatSheet() {
        const secs = [
            {
                icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
                title: 'The 5 Core Elements',
                body: `<h4>1. Role</h4><p>Tell the AI who it should be. <code>Act as a senior Python developer</code></p>
                <h4>2. Format</h4><p>Specify output structure. <code>Return as a numbered list</code></p>
                <h4>3. Constraints</h4><p>Set boundaries. <code>Keep it under 200 words</code></p>
                <h4>4. Examples</h4><p>Show what you expect. <code>Input: X → Output: Y</code></p>
                <h4>5. Context</h4><p>Provide background. <code>The audience is high school students</code></p>`
            },
            {
                icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>',
                title: 'Tone Guide',
                body: `<ul>
                    <li><strong>Formal</strong> — Business emails, reports, professional docs</li>
                    <li><strong>Casual</strong> — Friendly conversation, social media</li>
                    <li><strong>Technical</strong> — Code, architecture docs, API specs</li>
                    <li><strong>Creative</strong> — Stories, brainstorming, marketing</li>
                    <li><strong>Analytical</strong> — Data analysis, research, comparisons</li>
                    <li><strong>Directive</strong> — Step-by-step, strict requirements</li>
                </ul>`
            },
            {
                icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
                title: 'Common Mistakes to Avoid',
                body: `<ul>
                    <li>❌ Being too vague — <code>Write something about AI</code></li>
                    <li>❌ No output format — the AI guesses what you want</li>
                    <li>❌ Missing constraints — responses can be too long/short</li>
                    <li>❌ No role — generic responses instead of expert ones</li>
                    <li>❌ Multiple unrelated questions in one prompt</li>
                    <li>❌ Not specifying the audience or context</li>
                </ul>`
            },
            {
                icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
                title: 'Power Phrases',
                body: `<p>Click to copy:</p>
                    <button class="cs-chip" data-copy="Act as a [role] with expertise in [domain]">Act as a [role] with expertise in [domain]</button>
                    <button class="cs-chip" data-copy="Respond in [format] with no more than [N] words">Respond in [format] with no more than [N] words</button>
                    <button class="cs-chip" data-copy="Provide [N] examples, each with [structure]">Provide [N] examples, each with [structure]</button>
                    <button class="cs-chip" data-copy="Think step by step before answering">Think step by step before answering</button>
                    <button class="cs-chip" data-copy="The audience is [audience] who need [goal]">The audience is [audience] who need [goal]</button>
                    <button class="cs-chip" data-copy="Avoid [thing]. Focus only on [thing]">Avoid [thing]. Focus only on [thing]</button>
                    <button class="cs-chip" data-copy="Before answering, identify any assumptions">Before answering, identify any assumptions</button>`
            },
            {
                icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
                title: 'Quick Score Guide',
                body: `<ul>
                    <li><strong style="color:var(--red)">1-3 — Needs Major Work:</strong> Vague, no structure</li>
                    <li><strong style="color:var(--amber)">4-6 — Good Foundation:</strong> Some structure, missing key elements</li>
                    <li><strong style="color:var(--green)">7-8 — Strong Prompt:</strong> Well-structured with role + context</li>
                    <li><strong style="color:var(--green-dk)">9-10 — Professional-Grade:</strong> Perfect prompt engineering</li>
                </ul>`
            },
        ];

        const list = document.getElementById('csList');
        list.innerHTML = secs.map(s => `
            <div class="cs-item">
                <button class="cs-head">
                    ${s.icon}
                    <span>${s.title}</span>
                    <svg class="cs-chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
                </button>
                <div class="cs-body"><div class="cs-content">${s.body}</div></div>
            </div>
        `).join('');

        list.querySelectorAll('.cs-head').forEach(h => h.addEventListener('click', () => h.parentElement.classList.toggle('open')));

        // Power phrase chip copy with tooltip
        list.querySelectorAll('.cs-chip').forEach(chip => {
            chip.addEventListener('click', e => {
                e.stopPropagation();
                const text = chip.dataset.copy;
                navigator.clipboard.writeText(text).then(() => {
                    // Show tooltip
                    const tip = document.createElement('span');
                    tip.className = 'chip-tip';
                    tip.textContent = 'Copied!';
                    chip.appendChild(tip);
                    setTimeout(() => tip.remove(), 1500);
                    this.toast('Copied!', 'ok');
                });
            });
        });
    }

    /* ===== Helpers ===== */
    setLoading(on) {
        this.$.analyzeBtn.disabled = on;
        this.$.input.disabled = on;
        this.$.analyzeTxt.style.display = on ? 'none' : 'inline';
        this.$.spinner.style.display = on ? 'inline-block' : 'none';
        if (on) this.$.errBar.style.display = 'none';

        if (on && this.$.loadingText) {
            let idx = 0;
            this.$.loadingText.textContent = this.loadingPhrases[idx];
            this.loadingTick = setInterval(() => {
                idx = (idx + 1) % this.loadingPhrases.length;
                this.$.loadingText.textContent = this.loadingPhrases[idx];
            }, 1100);
        } else if (!on && this.loadingTick) {
            clearInterval(this.loadingTick);
            this.loadingTick = null;
            if (this.$.loadingText) this.$.loadingText.textContent = 'Analyzing your prompt...';
        }
    }

    insertTemplate(text) {
        if (!text) return;
        const el = this.$.input;
        const start = el.selectionStart ?? el.value.length;
        const end = el.selectionEnd ?? el.value.length;
        const before = el.value.slice(0, start);
        const after = el.value.slice(end);
        const prefix = before && !before.endsWith(' ') ? ' ' : '';
        const nextValue = `${before}${prefix}${text}${after}`;
        el.value = nextValue;
        const cursor = (before + prefix + text).length;
        el.setSelectionRange(cursor, cursor);
        el.focus();
        this.detect();
        this.counts();
        this.$.analyzeBtn.disabled = !el.value.trim();
        this.saveDraft();
    }

    showErr(msg) {
        this.$.errMsg.textContent = msg;
        this.$.errBar.style.display = 'flex';
        this.toast(msg, 'err');
    }

    sColor(s) {
        if (s >= 9) return '#065f46';
        if (s >= 7) return '#059669';
        if (s >= 4) return '#d97706';
        return '#dc2626';
    }

    sLabel(s) {
        if (s >= 9) return 'Professional-Grade';
        if (s >= 7) return 'Strong Prompt';
        if (s >= 4) return 'Good Foundation';
        return 'Needs Major Work';
    }

    esc(s) { return s ? s.replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]||c)) : ''; }

    toast(msg, type = '') {
        const el = document.createElement('div');
        el.className = `toast ${type}`;
        el.textContent = msg;
        this.$.toastStack.appendChild(el);
        setTimeout(() => el.remove(), 3200);
    }

    saveDraft() { localStorage.setItem('pt_draft', this.$.input.value); }
    loadDraft() {
        const d = localStorage.getItem('pt_draft');
        if (d) { this.$.input.value = d; this.$.analyzeBtn.disabled = !d.trim(); this.detect(); this.counts(); }
    }

    fallbackCopy(text, onDone) {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try {
            document.execCommand('copy');
            onDone();
        } catch {
            this.toast('Copy failed', 'err');
        } finally {
            ta.remove();
        }
    }

    async apiFetch(paths, options = {}) {
        const list = Array.isArray(paths) ? paths : [paths];
        let lastError = null;
        for (const p of list) {
            try {
                const r = await fetch(`${this.API}${p}`, options);
                if (r.ok || r.status !== 404) return r;
                lastError = new Error(`Endpoint not found: ${p}`);
            } catch (err) {
                lastError = err;
            }
        }
        throw lastError || new Error('Request failed');
    }

    openTour(force) {
        const seen = localStorage.getItem('pt_tour_seen') === '1';
        if (seen && !force) return;

        this.tourSteps = [
            {
                title: 'Start in Craft',
                desc: 'Write your prompt, then use Ctrl/Cmd + Enter to analyze quickly.',
                view: 'craft'
            },
            {
                title: 'Use Smart Rewrites',
                desc: 'Switch between Default, Developer, and Beginner variants, then inject back into editor with Use in Editor.',
                view: 'craft'
            },
            {
                title: 'Manage Your Library',
                desc: 'Search, filter, sort, save favorites, and now import/export JSON backups.',
                view: 'library'
            },
            {
                title: 'Track Improvement',
                desc: 'Watch your score trend, distribution, and prompt element usage in Stats.',
                view: 'stats'
            }
        ];
        this.tourIndex = 0;
        this.renderTour();
        this.$.tourWrap.classList.add('open');
        this.$.tourWrap.setAttribute('aria-hidden', 'false');
    }

    nextTour(dir) {
        if (!this.tourSteps?.length) return;
        const next = this.tourIndex + dir;

        if (next >= this.tourSteps.length) {
            this.closeTour(true);
            return;
        }
        this.tourIndex = Math.max(0, next);
        this.renderTour();
    }

    renderTour() {
        const step = this.tourSteps[this.tourIndex];
        if (!step) return;

        this.$.tourTitle.textContent = step.title;
        this.$.tourDesc.textContent = step.desc;
        this.$.tourStep.textContent = `Step ${this.tourIndex + 1}/${this.tourSteps.length}`;
        this.$.tourPrev.disabled = this.tourIndex === 0;
        this.$.tourNext.textContent = this.tourIndex === this.tourSteps.length - 1 ? 'Finish' : 'Next';
        this.$.tourDots.innerHTML = this.tourSteps.map((_, i) => `<span class="tour-dot ${i === this.tourIndex ? 'active' : ''}"></span>`).join('');
        this.go(step.view);
    }

    closeTour(markSeen = false) {
        this.$.tourWrap.classList.remove('open');
        this.$.tourWrap.setAttribute('aria-hidden', 'true');
        if (markSeen) localStorage.setItem('pt_tour_seen', '1');
    }
}

document.addEventListener('DOMContentLoaded', () => { window.app = new App(); window.app.init(); });
