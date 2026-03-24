/**
 * Prompt Tutor — Frontend Application
 * Premium redesign with live detection, improve-for tabs, toast system
 */

class App {
    constructor() {
        this.API = window.location.hostname === 'localhost' ? 'http://localhost:3000/api' : '/api';

        // Cache DOM
        this.el = {
            navItems: document.querySelectorAll('.nav-item[data-view]'),
            views: document.querySelectorAll('.view'),
            historyBadge: document.getElementById('historyBadge'),

            promptInput: document.getElementById('promptInput'),
            inputContainer: document.getElementById('inputContainer'),
            clearBtn: document.getElementById('clearBtn'),
            analyzeBtn: document.getElementById('analyzeBtn'),
            submitText: document.getElementById('submitText'),
            btnLoader: document.getElementById('btnLoader'),
            errorBanner: document.getElementById('errorBanner'),
            errorMessage: document.getElementById('errorMessage'),
            errorClose: document.getElementById('errorClose'),

            // Live detection
            badges: {
                role: document.getElementById('badge-role'),
                format: document.getElementById('badge-format'),
                constraints: document.getElementById('badge-constraints'),
                examples: document.getElementById('badge-examples'),
                context: document.getElementById('badge-context'),
            },
            toneBadge: document.getElementById('toneBadge'),
            statWords: document.getElementById('statWords'),
            statChars: document.getElementById('statChars'),
            statTokens: document.getElementById('statTokens'),

            // API modal
            apiKeyToggle: document.getElementById('apiKeyToggle'),
            apiModal: document.getElementById('apiModal'),
            closeApiModal: document.getElementById('closeApiModal'),
            apiModalBackdrop: document.getElementById('apiModalBackdrop'),
            saveApiKeyBtn: document.getElementById('saveApiKeyBtn'),
            apiKeyInput: document.getElementById('apiKeyInput'),
            apiKeyStatus: document.getElementById('apiKeyStatus'),
            apiStatusDot: document.getElementById('apiStatusDot'),

            // Results
            welcomeState: document.getElementById('welcomeState'),
            resultsSection: document.getElementById('resultsSection'),
            scoreLabel: document.getElementById('scoreLabel'),
            scoreTone: document.getElementById('scoreTone'),
            scoreBadge: document.getElementById('scoreBadge'),
            scoreRingFill: document.getElementById('scoreRingFill'),
            scoreElements: document.getElementById('scoreElements'),
            strengthsList: document.getElementById('strengthsList'),
            missingList: document.getElementById('missingList'),
            tipsList: document.getElementById('tipsList'),
            improvedPrompt: document.getElementById('improvedPrompt'),
            useImprovedBtn: document.getElementById('useImprovedBtn'),
            copyImprovedBtn: document.getElementById('copyImprovedBtn'),
            copyBtnText: document.getElementById('copyBtnText'),
            improveTabs: document.querySelectorAll('.improve-tab'),

            // History
            historyList: document.getElementById('historyList'),
            historyEmpty: document.getElementById('historyEmpty'),
            clearHistoryBtn: document.getElementById('clearHistoryBtn'),
            filterButtons: document.querySelectorAll('.filter-btn'),

            // Toast
            toastContainer: document.getElementById('toastContainer'),
        };

        this.currentAnalysis = null;
        this.currentVariant = 'default';
        this.currentFilter = 'all';
        this.allHistory = [];

        this.init();
    }

    init() {
        this.bindEvents();
        this.checkApiKey();
        this.loadHistoryBadge();
        this.loadDraft();
        this.setupMobile();
    }

    bindEvents() {
        // Nav
        this.el.navItems.forEach(n => n.addEventListener('click', () => this.switchView(n)));

        // Input
        this.el.promptInput.addEventListener('input', () => {
            this.updateLiveDetection();
            this.updateStats();
            this.el.analyzeBtn.disabled = !this.el.promptInput.value.trim();
            this.saveDraft();
        });

        this.el.promptInput.addEventListener('keydown', e => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                if (!this.el.analyzeBtn.disabled) this.analyze();
            }
        });

        // Actions
        this.el.clearBtn.addEventListener('click', () => this.clearWorkspace());
        this.el.analyzeBtn.addEventListener('click', () => this.analyze());
        this.el.errorClose.addEventListener('click', () => this.el.errorBanner.style.display = 'none');
        this.el.useImprovedBtn.addEventListener('click', () => this.useImproved());
        this.el.copyImprovedBtn.addEventListener('click', () => this.copyImproved());

        // Templates
        document.querySelectorAll('.template-card').forEach(c => {
            c.addEventListener('click', () => {
                this.el.promptInput.value = c.dataset.prompt;
                this.updateLiveDetection();
                this.updateStats();
                this.el.analyzeBtn.disabled = false;
                this.el.promptInput.focus();
                this.saveDraft();
            });
        });

        // Improve-for tabs
        this.el.improveTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                this.el.improveTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.currentVariant = tab.dataset.variant;
                this.showVariant();
            });
        });

        // Modal
        this.el.apiKeyToggle.addEventListener('click', () => this.toggleModal(true));
        this.el.closeApiModal.addEventListener('click', () => this.toggleModal(false));
        this.el.apiModalBackdrop.addEventListener('click', () => this.toggleModal(false));
        this.el.saveApiKeyBtn.addEventListener('click', () => this.saveApiKey());

        // History
        this.el.clearHistoryBtn.addEventListener('click', () => this.clearHistory());
        this.el.filterButtons.forEach(b => b.addEventListener('click', () => this.setFilter(b)));
    }

    setupMobile() {
        const toggle = document.getElementById('menuToggleBtn');
        const sidebar = document.getElementById('sidebar');
        const close = document.getElementById('closeSidebarBtn');
        if (toggle) toggle.addEventListener('click', () => sidebar.classList.add('open'));
        if (close) close.addEventListener('click', () => sidebar.classList.remove('open'));
    }

    /* ===== Navigation ===== */
    switchView(nav) {
        const target = nav.dataset.view;
        this.el.navItems.forEach(n => n.classList.remove('active'));
        nav.classList.add('active');
        this.el.views.forEach(v => {
            v.classList.remove('active');
            if (v.id === `view-${target}`) v.classList.add('active');
        });
        if (target === 'history') this.loadHistory();
        // Close mobile sidebar
        document.getElementById('sidebar').classList.remove('open');
    }

    /* ===== API Key ===== */
    toggleModal(show) {
        this.el.apiModal.classList.toggle('open', show);
    }

    async checkApiKey() {
        try {
            const r = await fetch(`${this.API}/settings/apikey/status`);
            const d = await r.json();
            this.el.apiStatusDot.classList.toggle('connected', d.configured);
            if (!d.configured) setTimeout(() => this.toggleModal(true), 1200);
        } catch (e) { console.error(e); }
    }

    async saveApiKey() {
        const key = this.el.apiKeyInput.value.trim();
        if (!key) return;
        this.el.saveApiKeyBtn.textContent = 'Saving...';
        try {
            const r = await fetch(`${this.API}/settings/apikey`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ apiKey: key })
            });
            if (r.ok) {
                this.el.apiKeyStatus.textContent = '✓ Key saved securely.';
                this.el.apiKeyStatus.style.color = 'var(--success)';
                this.el.apiKeyInput.value = '';
                this.checkApiKey();
                this.toast('API key saved', 'success');
                setTimeout(() => { this.toggleModal(false); this.el.apiKeyStatus.textContent = ''; }, 1000);
            } else throw new Error('Failed');
        } catch (e) {
            this.el.apiKeyStatus.textContent = e.message;
            this.el.apiKeyStatus.style.color = 'var(--danger)';
        } finally {
            this.el.saveApiKeyBtn.textContent = 'Save Configuration';
        }
    }

    /* ===== Live Detection ===== */
    updateLiveDetection() {
        const t = this.el.promptInput.value.toLowerCase();

        const checks = {
            role: /act as|you are a|persona|pretend|role|as a|expert|assistant|developer|scientist|writer|teacher|coach/i,
            format: /json|markdown|table|csv|format|output|structure|bullet|list|code block|email|report|essay|html|xml/i,
            constraints: /limit|max|must|exactly|no more|at least|words|under|avoid|don't|do not|never|only|restrict|constraint/i,
            examples: /example|sample|for instance|input:|output:|e\.g\.|demonstrate|like this|such as/i,
            context: /context|background|situation|scenario|given that|assuming|based on|the goal|objective|purpose|audience/i,
        };

        Object.entries(checks).forEach(([key, regex]) => {
            const badge = this.el.badges[key];
            if (regex.test(t)) {
                if (!badge.classList.contains('detected')) {
                    badge.classList.remove('missing');
                    badge.classList.add('detected');
                }
            } else {
                badge.classList.remove('detected');
                badge.classList.add('missing');
            }
        });

        // Tone
        let tone = 'Neutral';
        if (/please|kindly|would you|appreciate|thank you/i.test(t)) tone = 'Formal';
        else if (/must|exactly|strict|constraint|no more than|required/i.test(t)) tone = 'Directive';
        else if (/algorithm|function|api|database|deploy|syntax|variable/i.test(t)) tone = 'Technical';
        else if (/imagine|creative|unique|innovative|story|narrative/i.test(t)) tone = 'Creative';
        else if (/hey|hi|yo|bro|cool|awesome|lol/i.test(t)) tone = 'Casual';
        else if (/analyze|compare|evaluate|assess|research|study/i.test(t)) tone = 'Analytical';
        this.el.toneBadge.textContent = tone;
    }

    updateStats() {
        const t = this.el.promptInput.value;
        const words = t.trim() ? t.trim().split(/\s+/).length : 0;
        const chars = t.length;
        const tokens = Math.ceil(chars / 4);
        this.el.statWords.textContent = words;
        this.el.statChars.textContent = chars;
        this.el.statTokens.textContent = tokens;
    }

    /* ===== Analyze ===== */
    async analyze() {
        const prompt = this.el.promptInput.value.trim();
        if (!prompt) return;
        this.setLoading(true);

        try {
            const r = await fetch(`${this.API}/analyze`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt })
            });
            const d = await r.json();
            if (!r.ok) throw new Error(d.error || 'Analysis failed.');

            this.currentAnalysis = d.analysis;
            this.currentVariant = 'default';
            this.renderResults(d.analysis);
            this.loadHistoryBadge();
            this.toast('Analysis complete');
        } catch (e) {
            this.showError(e.message);
        } finally {
            this.setLoading(false);
        }
    }

    renderResults(a) {
        this.el.welcomeState.style.display = 'none';
        this.el.errorBanner.style.display = 'none';
        this.el.resultsSection.style.display = 'flex';

        // Score
        const score = a.score || 0;
        this.el.scoreLabel.textContent = a.label || a.verdict || 'Analyzed';
        this.el.scoreTone.textContent = a.tone || '—';
        this.el.scoreBadge.innerHTML = `${score}<span class="score-max">/10</span>`;

        // Ring
        const circ = 263.89; // 2 * π * 42
        const offset = circ - (score / 10) * circ;
        this.el.scoreRingFill.style.strokeDashoffset = offset;
        this.el.scoreRingFill.style.stroke = this.scoreColor(score);

        // Element pills
        this.el.scoreElements.innerHTML = '';
        const elements = a.elements || {};
        ['role', 'format', 'constraints', 'examples', 'context'].forEach(key => {
            const present = elements[key];
            const pill = document.createElement('span');
            pill.className = `score-el-pill ${present ? 'present' : 'absent'}`;
            const icon = present
                ? '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#059669;margin-right:2px"></span>'
                : '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;border:1.5px solid #9ca3af;margin-right:2px"></span>';
            pill.innerHTML = `${icon} ${key.charAt(0).toUpperCase() + key.slice(1)}`;
            this.el.scoreElements.appendChild(pill);
        });

        // Strengths
        this.el.strengthsList.innerHTML = (a.strengths || []).map(s => `<li>${this.esc(s)}</li>`).join('') || '<li>None noted.</li>';

        // Missing
        this.el.missingList.innerHTML = (a.missing || a.weaknesses || []).map(s => `<li>${this.esc(s)}</li>`).join('') || '<li>Looks solid!</li>';

        // Tips
        this.el.tipsList.innerHTML = '';
        (a.tips || []).forEach(tip => {
            const div = document.createElement('div');
            div.className = 'tip-card';
            if (typeof tip === 'string') {
                div.innerHTML = `<div class="tip-desc">${this.esc(tip)}</div>`;
            } else {
                div.innerHTML = `
                    <div class="tip-title">${this.esc(tip.title || '')}</div>
                    <div class="tip-desc">${this.esc(tip.description || '')}</div>
                `;
            }
            this.el.tipsList.appendChild(div);
        });

        // Improved prompt — reset tabs
        this.el.improveTabs.forEach(t => t.classList.remove('active'));
        this.el.improveTabs[0].classList.add('active');
        this.currentVariant = 'default';
        this.showVariant();

        // Scroll to top
        setTimeout(() => {
            document.getElementById('analysisPane')?.scrollTo({ top: 0, behavior: 'smooth' });
        }, 100);
    }

    showVariant() {
        if (!this.currentAnalysis) return;
        const a = this.currentAnalysis;
        let text = '';
        if (this.currentVariant === 'developer') text = a.improvedDeveloper || a.improved_prompt || a.improved || '';
        else if (this.currentVariant === 'beginner') text = a.improvedBeginner || a.improved_prompt || a.improved || '';
        else text = a.improved || a.improved_prompt || '';
        this.el.improvedPrompt.textContent = text;
    }

    /* ===== Actions ===== */
    useImproved() {
        const text = this.el.improvedPrompt.textContent;
        if (text) {
            this.el.promptInput.value = text;
            this.updateLiveDetection();
            this.updateStats();
            this.el.analyzeBtn.disabled = false;
            this.el.promptInput.focus();
            this.saveDraft();
            this.toast('Prompt loaded into editor', 'success');
        }
    }

    copyImproved() {
        const text = this.el.improvedPrompt.textContent;
        if (text) {
            navigator.clipboard.writeText(text).then(() => {
                this.el.copyBtnText.textContent = 'Copied!';
                this.toast('Copied to clipboard', 'success');
                setTimeout(() => { this.el.copyBtnText.textContent = 'Copy'; }, 2000);
            });
        }
    }

    clearWorkspace() {
        this.el.promptInput.value = '';
        this.el.analyzeBtn.disabled = true;
        this.el.resultsSection.style.display = 'none';
        this.el.welcomeState.style.display = 'flex';
        this.el.errorBanner.style.display = 'none';
        this.currentAnalysis = null;
        this.updateLiveDetection();
        this.updateStats();
        this.el.promptInput.focus();
        this.saveDraft();
    }

    /* ===== UI Helpers ===== */
    setLoading(on) {
        this.el.analyzeBtn.disabled = on;
        this.el.promptInput.disabled = on;
        this.el.submitText.style.display = on ? 'none' : 'inline';
        this.el.btnLoader.style.display = on ? 'inline-block' : 'none';
        if (on) this.el.errorBanner.style.display = 'none';
    }

    showError(msg) {
        this.el.errorMessage.textContent = msg;
        this.el.errorBanner.style.display = 'flex';
        this.toast(msg, 'error');
    }

    scoreColor(s) {
        if (s >= 7) return '#059669';
        if (s >= 4) return '#d97706';
        return '#dc2626';
    }

    esc(s) {
        if (!s) return '';
        return s.replace(/[&<>'"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[c] || c));
    }

    /* ===== Toast ===== */
    toast(msg, type = '') {
        const el = document.createElement('div');
        el.className = `toast ${type ? `toast-${type}` : ''}`;
        el.textContent = msg;
        this.el.toastContainer.appendChild(el);
        setTimeout(() => el.remove(), 3200);
    }

    /* ===== History ===== */
    async loadHistoryBadge() {
        try {
            const r = await fetch(`${this.API}/history`);
            const d = await r.json();
            this.el.historyBadge.textContent = d.length;
            this.el.historyBadge.style.display = d.length > 0 ? 'inline-block' : 'none';
        } catch (e) {}
    }

    async loadHistory() {
        try {
            const r = await fetch(`${this.API}/history`);
            this.allHistory = await r.json();
            this.renderHistory();
        } catch (e) {
            this.el.historyList.innerHTML = '';
            this.el.historyEmpty.style.display = 'flex';
        }
    }

    setFilter(btn) {
        this.el.filterButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentFilter = btn.dataset.filter;
        this.renderHistory();
    }

    renderHistory() {
        let items = [...this.allHistory];
        if (this.currentFilter === 'high') items = items.filter(i => i.score >= 7);
        else if (this.currentFilter === 'mid') items = items.filter(i => i.score >= 4 && i.score < 7);
        else if (this.currentFilter === 'low') items = items.filter(i => i.score < 4);

        if (items.length === 0) {
            this.el.historyList.innerHTML = '';
            this.el.historyEmpty.style.display = 'flex';
            return;
        }

        this.el.historyEmpty.style.display = 'none';
        this.el.historyList.innerHTML = '';

        items.forEach(item => {
            const date = new Date(item.created_at);
            const dateStr = !isNaN(date) ? date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';
            const bg = this.scoreColor(item.score);

            const div = document.createElement('div');
            div.className = 'history-card';
            div.onclick = () => this.viewHistoryItem(item.id);
            div.innerHTML = `
                <div class="hist-card-head">
                    <span class="hist-score" style="background:${bg}">${item.score}/10</span>
                    <span class="hist-date">${dateStr}</span>
                </div>
                <div class="hist-text">${this.esc(item.prompt_text)}</div>
                <div class="hist-footer">
                    <span class="hist-label">${this.esc(item.label || item.verdict || '')}</span>
                    <button class="delete-btn" onclick="event.stopPropagation(); window.app.deleteHistoryItem(${item.id})" aria-label="Delete">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>
                </div>
            `;
            this.el.historyList.appendChild(div);
        });
    }

    async deleteHistoryItem(id) {
        await fetch(`${this.API}/history/${id}`, { method: 'DELETE' });
        this.loadHistory();
        this.loadHistoryBadge();
        this.toast('Prompt deleted');
    }

    async clearHistory() {
        if (!confirm('Clear all history?')) return;
        await fetch(`${this.API}/history`, { method: 'DELETE' });
        this.loadHistory();
        this.loadHistoryBadge();
        this.toast('History cleared');
    }

    async viewHistoryItem(id) {
        try {
            const r = await fetch(`${this.API}/history/${id}`);
            if (!r.ok) return;
            const data = await r.json();
            document.querySelector('.nav-item[data-view="workspace"]').click();
            this.el.promptInput.value = data.prompt_text;
            this.el.analyzeBtn.disabled = false;
            this.updateLiveDetection();
            this.updateStats();

            // Reconstruct analysis object
            const analysis = {
                score: data.score,
                label: data.label || data.verdict,
                tone: data.tone || '—',
                elements: data.elements || {},
                strengths: data.strengths || [],
                missing: data.missing || data.weaknesses || [],
                tips: data.tips || [],
                improved: data.improved || data.improved_prompt || '',
                improvedDeveloper: data.improvedDeveloper || '',
                improvedBeginner: data.improvedBeginner || '',
            };
            this.currentAnalysis = analysis;
            this.renderResults(analysis);
        } catch (e) {}
    }

    /* ===== Draft ===== */
    saveDraft() { localStorage.setItem('prompt_draft', this.el.promptInput.value); }
    loadDraft() {
        const d = localStorage.getItem('prompt_draft');
        if (d) {
            this.el.promptInput.value = d;
            this.el.analyzeBtn.disabled = !d.trim();
            this.updateLiveDetection();
            this.updateStats();
        }
    }
}

document.addEventListener('DOMContentLoaded', () => { window.app = new App(); });
