/**
 * Prompt Tutor — Full Frontend Application
 * 4 pages: Craft, Library, Stats, Cheat Sheet
 */

class App {
    constructor() {
        this.API = location.hostname === 'localhost' ? 'http://localhost:3000/api' : '/api';
        this.analysis = null;
        this.variant = 'default';
        this.filter = 'all';
        this.history = [];
        this.cache();
        this.bind();
        this.init();
    }

    cache() {
        this.$ = {
            sidebar: document.getElementById('sidebar'),
            navs: document.querySelectorAll('.sb-item[data-view]'),
            views: document.querySelectorAll('.view'),
            badge: document.getElementById('historyBadge'),
            input: document.getElementById('promptInput'),
            clearBtn: document.getElementById('clearBtn'),
            analyzeBtn: document.getElementById('analyzeBtn'),
            analyzeTxt: document.getElementById('analyzeTxt'),
            analyzeSpinner: document.getElementById('analyzeSpinner'),
            errBar: document.getElementById('errBar'),
            errMsg: document.getElementById('errMsg'),
            errClose: document.getElementById('errClose'),
            tonePill: document.getElementById('tonePill'),
            wc: document.getElementById('wc'),
            cc: document.getElementById('cc'),
            tc: document.getElementById('tc'),
            // Results
            emptyState: document.getElementById('emptyState'),
            resultsWrap: document.getElementById('resultsWrap'),
            ringFill: document.getElementById('ringFill'),
            scoreNum: document.getElementById('scoreNum'),
            scoreLabel: document.getElementById('scoreLabel'),
            scoreTone: document.getElementById('scoreTone'),
            scoreEls: document.getElementById('scoreEls'),
            strengthsList: document.getElementById('strengthsList'),
            missingList: document.getElementById('missingList'),
            tipsList: document.getElementById('tipsList'),
            improvedText: document.getElementById('improvedText'),
            useBtn: document.getElementById('useBtn'),
            copyBtn: document.getElementById('copyBtn'),
            copyTxt: document.getElementById('copyTxt'),
            varTabs: document.querySelectorAll('.var-tab'),
            // Library
            libGrid: document.getElementById('libGrid'),
            libEmpty: document.getElementById('libEmpty'),
            clearAllBtn: document.getElementById('clearAllBtn'),
            filters: document.querySelectorAll('.filt'),
            // Stats
            sTot: document.getElementById('sTot'),
            sAvg: document.getElementById('sAvg'),
            sBest: document.getElementById('sBest'),
            sWeek: document.getElementById('sWeek'),
            barChart: document.getElementById('barChart'),
            dotTimeline: document.getElementById('dotTimeline'),
            // Modal
            settingsBtn: document.getElementById('settingsBtn'),
            settingsModal: document.getElementById('settingsModal'),
            modalBg: document.getElementById('modalBg'),
            modalX: document.getElementById('modalX'),
            saveKeyBtn: document.getElementById('saveKeyBtn'),
            apiKeyInput: document.getElementById('apiKeyInput'),
            modalMsg: document.getElementById('modalMsg'),
            apiDot: document.getElementById('apiDot'),
            // Toast
            toastBox: document.getElementById('toastBox'),
        };
        // Element pill references
        this.pills = {};
        document.querySelectorAll('.el-pill').forEach(p => { this.pills[p.dataset.el] = p; });
    }

    bind() {
        // Nav
        this.$.navs.forEach(n => n.addEventListener('click', () => this.go(n)));
        // Mobile
        document.getElementById('mobMenu')?.addEventListener('click', () => this.$.sidebar.classList.add('open'));
        document.getElementById('sbClose')?.addEventListener('click', () => this.$.sidebar.classList.remove('open'));
        // Input
        this.$.input.addEventListener('input', () => { this.detect(); this.counts(); this.$.analyzeBtn.disabled = !this.$.input.value.trim(); this.saveDraft(); });
        this.$.input.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !this.$.analyzeBtn.disabled) { e.preventDefault(); this.analyze(); }});
        // Templates
        document.querySelectorAll('.tpl').forEach(t => t.addEventListener('click', () => { this.$.input.value = t.dataset.tpl; this.detect(); this.counts(); this.$.analyzeBtn.disabled = false; this.$.input.focus(); this.saveDraft(); }));
        // Actions
        this.$.clearBtn.addEventListener('click', () => this.clear());
        this.$.analyzeBtn.addEventListener('click', () => this.analyze());
        this.$.errClose.addEventListener('click', () => this.$.errBar.style.display = 'none');
        this.$.useBtn.addEventListener('click', () => this.useImproved());
        this.$.copyBtn.addEventListener('click', () => this.copyImproved());
        // Variant tabs
        this.$.varTabs.forEach(t => t.addEventListener('click', () => { this.$.varTabs.forEach(x => x.classList.remove('active')); t.classList.add('active'); this.variant = t.dataset.var; this.showVariant(); }));
        // Library
        this.$.clearAllBtn.addEventListener('click', () => this.clearAll());
        this.$.filters.forEach(f => f.addEventListener('click', () => { this.$.filters.forEach(x => x.classList.remove('active')); f.classList.add('active'); this.filter = f.dataset.f; this.renderLib(); }));
        // Modal
        this.$.settingsBtn.addEventListener('click', () => this.modal(true));
        this.$.modalX.addEventListener('click', () => this.modal(false));
        this.$.modalBg.addEventListener('click', () => this.modal(false));
        this.$.saveKeyBtn.addEventListener('click', () => this.saveKey());
    }

    async init() {
        this.checkKey();
        this.loadBadge();
        this.loadDraft();
        this.buildCheatSheet();
    }

    /* ===== Navigation ===== */
    go(nav) {
        const v = nav.dataset.view;
        this.$.navs.forEach(n => n.classList.remove('active'));
        nav.classList.add('active');
        this.$.views.forEach(el => { el.classList.toggle('active', el.id === `view-${v}`); });
        if (v === 'library') this.loadLib();
        if (v === 'stats') this.loadStats();
        this.$.sidebar.classList.remove('open');
    }

    /* ===== API Key ===== */
    modal(on) { this.$.settingsModal.classList.toggle('open', on); }

    async checkKey() {
        try {
            const r = await fetch(`${this.API}/settings/apikey/status`);
            const d = await r.json();
            this.$.apiDot.classList.toggle('on', d.configured);
            if (!d.configured) setTimeout(() => this.modal(true), 1000);
        } catch (e) {}
    }

    async saveKey() {
        const k = this.$.apiKeyInput.value.trim();
        if (!k) return;
        this.$.saveKeyBtn.textContent = 'Saving...';
        try {
            const r = await fetch(`${this.API}/settings/apikey`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({apiKey:k}) });
            if (r.ok) {
                this.$.apiKeyInput.value = '';
                this.checkKey();
                this.toast('API key saved', 'ok');
                setTimeout(() => this.modal(false), 600);
            } else throw new Error('Failed');
        } catch (e) {
            this.$.modalMsg.textContent = 'Error saving key';
            this.$.modalMsg.style.color = 'var(--red)';
        } finally { this.$.saveKeyBtn.textContent = 'Save Configuration'; }
    }

    /* ===== Live Detection ===== */
    detect() {
        const t = this.$.input.value;
        const checks = {
            role: /act as|you are a?|persona|pretend|role|as a|expert|assistant|developer|scientist|writer|teacher|coach/i,
            format: /json|markdown|table|csv|format|output|structure|bullet|list|code block|email|report|essay|html|xml/i,
            constraints: /limit|max|must|exactly|no more|at least|words|under|avoid|don't|do not|never|only|restrict|constraint/i,
            examples: /example|sample|for instance|input:|output:|e\.g\.|demonstrate|like this|such as/i,
            context: /context|background|situation|scenario|given that|assuming|based on|the goal|objective|purpose|audience/i,
        };
        Object.entries(checks).forEach(([k, rx]) => {
            const p = this.pills[k];
            if (rx.test(t)) { p.classList.remove('missing'); p.classList.add('detected'); }
            else { p.classList.remove('detected'); p.classList.add('missing'); }
        });
        // Tone
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
        this.loading(true);
        try {
            const r = await fetch(`${this.API}/analyze`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({prompt}) });
            const d = await r.json();
            if (!r.ok) throw new Error(d.error || 'Analysis failed.');
            this.analysis = d.analysis;
            this.variant = 'default';
            this.render(d.analysis);
            this.loadBadge();
            this.toast('Analysis complete', 'ok');
        } catch (e) { this.showErr(e.message); }
        finally { this.loading(false); }
    }

    render(a) {
        this.$.emptyState.style.display = 'none';
        this.$.errBar.style.display = 'none';
        this.$.resultsWrap.style.display = 'flex';

        const s = a.score || 0;

        // Score ring
        const circ = 301.59; // 2πr = 2*π*48
        this.$.ringFill.style.strokeDashoffset = circ - (s / 10) * circ;
        this.$.ringFill.style.stroke = this.sColor(s);
        this.$.scoreNum.innerHTML = `${s}<span>/10</span>`;

        // Label
        this.$.scoreLabel.textContent = a.label || a.verdict || this.sLabel(s);
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

        // Strengths & Missing
        this.$.strengthsList.innerHTML = (a.strengths||[]).map(s => `<li>${this.esc(s)}</li>`).join('') || '<li>—</li>';
        this.$.missingList.innerHTML = (a.missing||a.weaknesses||[]).map(s => `<li>${this.esc(s)}</li>`).join('') || '<li>—</li>';

        // Tips accordion
        this.$.tipsList.innerHTML = '';
        (a.tips||[]).forEach(tip => {
            const item = document.createElement('div');
            item.className = 'tip-item';
            const title = typeof tip === 'string' ? tip : (tip.title || '');
            const body = typeof tip === 'string' ? '' : (tip.body || tip.description || '');
            item.innerHTML = `
                <button class="tip-head">
                    <span>${this.esc(title)}</span>
                    <svg class="tip-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
                </button>
                <div class="tip-body">${this.esc(body)}</div>
            `;
            item.querySelector('.tip-head').addEventListener('click', () => item.classList.toggle('open'));
            this.$.tipsList.appendChild(item);
        });

        // Improved tabs reset
        this.$.varTabs.forEach(t => t.classList.remove('active'));
        this.$.varTabs[0].classList.add('active');
        this.variant = 'default';
        this.showVariant();

        // Scroll to top
        document.getElementById('resultsPane')?.scrollTo({top:0, behavior:'smooth'});
    }

    showVariant() {
        if (!this.analysis) return;
        const a = this.analysis;
        let t = '';
        if (this.variant === 'developer') t = a.improvedDeveloper || a.improved || a.improved_prompt || '';
        else if (this.variant === 'beginner') t = a.improvedBeginner || a.improved || a.improved_prompt || '';
        else t = a.improved || a.improved_prompt || '';
        this.$.improvedText.textContent = t;
    }

    /* ===== Actions ===== */
    useImproved() {
        const t = this.$.improvedText.textContent;
        if (!t) return;
        this.$.input.value = t;
        this.detect(); this.counts();
        this.$.analyzeBtn.disabled = false;
        this.$.input.focus();
        this.saveDraft();
        this.toast('Loaded into editor', 'ok');
    }

    copyImproved() {
        const t = this.$.improvedText.textContent;
        if (!t) return;
        navigator.clipboard.writeText(t).then(() => {
            this.$.copyTxt.textContent = 'Copied!';
            this.toast('Copied to clipboard', 'ok');
            setTimeout(() => this.$.copyTxt.textContent = 'Copy', 2000);
        });
    }

    clear() {
        this.$.input.value = '';
        this.$.analyzeBtn.disabled = true;
        this.$.resultsWrap.style.display = 'none';
        this.$.emptyState.style.display = 'flex';
        this.$.errBar.style.display = 'none';
        this.analysis = null;
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
        if (this.filter === 'high') items = items.filter(i => i.score >= 7);
        else if (this.filter === 'mid') items = items.filter(i => i.score >= 4 && i.score < 7);
        else if (this.filter === 'low') items = items.filter(i => i.score < 4);

        if (!items.length) { this.$.libGrid.innerHTML = ''; this.$.libEmpty.style.display = 'flex'; return; }
        this.$.libEmpty.style.display = 'none';
        this.$.libGrid.innerHTML = items.map(i => {
            const d = new Date(i.created_at);
            const ds = !isNaN(d) ? d.toLocaleDateString(undefined,{month:'short',day:'numeric'}) : '';
            return `<div class="lib-card" onclick="app.viewItem(${i.id})">
                <div class="lc-top">
                    <span class="lc-score" style="background:${this.sColor(i.score)}">${i.score}/10</span>
                    <span class="lc-date">${ds}</span>
                </div>
                <div class="lc-text">${this.esc(i.prompt_text)}</div>
                <div class="lc-foot">
                    <span class="lc-label">${this.esc(i.label||i.verdict||this.sLabel(i.score))}</span>
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
            document.querySelector('.sb-item[data-view="craft"]').click();
            this.$.input.value = d.prompt_text;
            this.$.analyzeBtn.disabled = false;
            this.detect(); this.counts();
            this.analysis = {
                score: d.score,
                label: d.label || d.verdict,
                tone: d.tone || '—',
                elements: d.elements || {},
                strengths: d.strengths || [],
                missing: d.missing || d.weaknesses || [],
                tips: d.tips || [],
                improved: d.improved || d.improved_prompt || '',
                improvedDeveloper: d.improvedDeveloper || '',
                improvedBeginner: d.improvedBeginner || '',
            };
            this.render(this.analysis);
        } catch (e) {}
    }

    async delItem(id) {
        await fetch(`${this.API}/history/${id}`, {method:'DELETE'});
        this.loadLib(); this.loadBadge();
        this.toast('Deleted');
    }

    async clearAll() {
        if (!confirm('Clear all history?')) return;
        await fetch(`${this.API}/history`, {method:'DELETE'});
        this.loadLib(); this.loadBadge();
        this.toast('History cleared');
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

            // This week count
            const now = new Date();
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            const thisWeek = hist.filter(h => new Date(h.created_at) >= weekAgo).length;
            this.$.sWeek.textContent = thisWeek;

            // Bar chart
            const total = hist.length || 1;
            const weak = hist.filter(h => h.score < 4).length;
            const mid = hist.filter(h => h.score >= 4 && h.score < 7).length;
            const high = hist.filter(h => h.score >= 7).length;

            this.$.barChart.innerHTML = [
                {label:'Weak (1-3)', count: weak, color: 'var(--red)', pct: Math.round(weak/total*100)},
                {label:'Needs Work (4-6)', count: mid, color: 'var(--amber)', pct: Math.round(mid/total*100)},
                {label:'High Quality (7-10)', count: high, color: 'var(--green)', pct: Math.round(high/total*100)},
            ].map(b => `
                <div class="bar-row">
                    <span class="bar-label">${b.label}</span>
                    <div class="bar-track"><div class="bar-fill" style="width:${b.pct}%;background:${b.color}"></div></div>
                    <span class="bar-val">${b.count} (${b.pct}%)</span>
                </div>
            `).join('');

            // Dot timeline (last 5)
            const last5 = hist.slice(0, 5).reverse();
            if (last5.length) {
                this.$.dotTimeline.innerHTML = last5.map(h => {
                    const c = this.sColor(h.score);
                    const d = new Date(h.created_at);
                    const ds = !isNaN(d) ? d.toLocaleDateString(undefined,{month:'short',day:'numeric'}) : '';
                    return `<div class="dt-item">
                        <div class="dt-dot" style="border-color:${c};background:${c}"></div>
                        <span class="dt-score">${h.score}/10</span>
                        <span class="dt-date">${ds}</span>
                    </div>`;
                }).join('');
            } else {
                this.$.dotTimeline.innerHTML = '<span style="color:var(--tx3);font-size:0.85rem">No data yet</span>';
            }
        } catch (e) {}
    }

    /* ===== Cheat Sheet ===== */
    buildCheatSheet() {
        const sections = [
            {
                icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
                title: 'The 5 Core Elements',
                body: `<h4>1. Role</h4><p>Tell the AI who it should be. Example: <code>Act as a senior Python developer</code></p>
                <h4>2. Format</h4><p>Specify desired output structure. Example: <code>Return as a numbered list</code></p>
                <h4>3. Constraints</h4><p>Set boundaries and limits. Example: <code>Keep it under 200 words</code></p>
                <h4>4. Examples</h4><p>Show what you expect. Example: <code>For instance: Input: X → Output: Y</code></p>
                <h4>5. Context</h4><p>Provide background info. Example: <code>The audience is high school students</code></p>`
            },
            {
                icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>',
                title: 'Tone Guide',
                body: `<ul>
                    <li><strong>Formal</strong> — Business emails, reports, professional docs</li>
                    <li><strong>Casual</strong> — Friendly conversation, social media posts</li>
                    <li><strong>Technical</strong> — Code reviews, architecture docs, API specs</li>
                    <li><strong>Creative</strong> — Stories, brainstorming, marketing copy</li>
                    <li><strong>Analytical</strong> — Data analysis, research summaries, comparisons</li>
                    <li><strong>Directive</strong> — Step-by-step instructions, strict requirements</li>
                </ul>`
            },
            {
                icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
                title: 'Common Mistakes to Avoid',
                body: `<ul>
                    <li>❌ Being too vague — <code>Write something about AI</code></li>
                    <li>❌ No output format — the AI guesses what you want</li>
                    <li>❌ Missing constraints — responses can be too long or too short</li>
                    <li>❌ No role assignment — generic responses instead of expert ones</li>
                    <li>❌ Asking multiple unrelated questions in one prompt</li>
                    <li>❌ Not specifying the audience or context</li>
                </ul>`
            },
            {
                icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
                title: 'Power Phrases',
                body: `<p>Click to copy any phrase:</p>
                    <button class="cs-copy-btn" onclick="app.copySnippet(this)">Act as a [role] with expertise in [domain]</button>
                    <button class="cs-copy-btn" onclick="app.copySnippet(this)">Respond in [format] with no more than [N] words</button>
                    <button class="cs-copy-btn" onclick="app.copySnippet(this)">Provide [N] examples, each with [structure]</button>
                    <button class="cs-copy-btn" onclick="app.copySnippet(this)">Think step by step before answering</button>
                    <button class="cs-copy-btn" onclick="app.copySnippet(this)">The audience is [audience] who need [goal]</button>
                    <button class="cs-copy-btn" onclick="app.copySnippet(this)">Avoid [thing]. Focus only on [thing]</button>
                    <button class="cs-copy-btn" onclick="app.copySnippet(this)">Before answering, identify any assumptions</button>`
            },
            {
                icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
                title: 'Quick Score Guide',
                body: `<ul>
                    <li><strong style="color:var(--red)">1-3 — Needs Major Work:</strong> Vague, no structure, missing most elements</li>
                    <li><strong style="color:var(--amber)">4-6 — Good Foundation:</strong> Has some structure, missing key elements</li>
                    <li><strong style="color:var(--green)">7-8 — Strong Prompt:</strong> Well-structured with role, context, format</li>
                    <li><strong style="color:var(--green-dk)">9-10 — Professional-Grade:</strong> Perfect prompt engineering</li>
                </ul>`
            },
        ];

        const list = document.getElementById('csList');
        list.innerHTML = sections.map(s => `
            <div class="cs-item">
                <button class="cs-head">
                    ${s.icon}
                    <span>${s.title}</span>
                    <svg class="cs-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
                </button>
                <div class="cs-body"><div class="cs-content">${s.body}</div></div>
            </div>
        `).join('');

        list.querySelectorAll('.cs-head').forEach(h => h.addEventListener('click', () => h.parentElement.classList.toggle('open')));
    }

    copySnippet(btn) {
        navigator.clipboard.writeText(btn.textContent).then(() => {
            this.toast('Copied!', 'ok');
        });
    }

    /* ===== Helpers ===== */
    loading(on) {
        this.$.analyzeBtn.disabled = on;
        this.$.input.disabled = on;
        this.$.analyzeTxt.style.display = on ? 'none' : 'inline';
        this.$.analyzeSpinner.style.display = on ? 'inline-block' : 'none';
        if (on) this.$.errBar.style.display = 'none';
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
        this.$.toastBox.appendChild(el);
        setTimeout(() => el.remove(), 3200);
    }

    saveDraft() { localStorage.setItem('pt_draft', this.$.input.value); }
    loadDraft() {
        const d = localStorage.getItem('pt_draft');
        if (d) { this.$.input.value = d; this.$.analyzeBtn.disabled = !d.trim(); this.detect(); this.counts(); }
    }
}

document.addEventListener('DOMContentLoaded', () => { window.app = new App(); });
