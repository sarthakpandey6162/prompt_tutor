/**
 * Prompt Tutor — Frontend Application Logic
 * Refactored for modularity, clean architecture, and modern UX.
 */

class App {
    constructor() {
        this.API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:3000/api' : '/api';
        
        // DOM Elements
        this.elements = {
            // Navigation
            navItems: document.querySelectorAll('.nav-item[data-view]'),
            views: document.querySelectorAll('.view'),
            navHistoryBtn: document.getElementById('navHistoryBtn'),
            historyBadge: document.getElementById('historyBadge'),
            
            // Workspace Header/Auth
            apiKeyToggle: document.getElementById('apiKeyToggle'),
            apiStatusDot: document.getElementById('apiStatusDot'),
            
            // Input Area
            promptInput: document.getElementById('promptInput'),
            charCount: document.getElementById('charCount'),
            clearBtn: document.getElementById('clearBtn'),
            analyzeBtn: document.getElementById('analyzeBtn'),
            btnLoader: document.getElementById('btnLoader'),
            submitIcon: document.querySelector('.submit-icon'),
            
            // Modal & Banner
            apiModal: document.getElementById('apiModal'),
            closeApiModal: document.getElementById('closeApiModal'),
            saveApiKeyBtn: document.getElementById('saveApiKeyBtn'),
            apiKeyInput: document.getElementById('apiKeyInput'),
            apiKeyStatus: document.getElementById('apiKeyStatus'),
            errorBanner: document.getElementById('errorBanner'),
            errorMessage: document.getElementById('errorMessage'),
            
            // Results & Welcome
            welcomeState: document.getElementById('welcomeState'),
            resultsSection: document.getElementById('resultsSection'),
            userPromptText: document.getElementById('userPromptText'),
            scoreVerdict: document.getElementById('scoreVerdict'),
            scoreBadge: document.getElementById('scoreBadge'),
            scoreDesc: document.getElementById('scoreDesc'),
            criteriaGrid: document.getElementById('criteriaGrid'),
            strengthsList: document.getElementById('strengthsList'),
            weaknessesList: document.getElementById('weaknessesList'),
            improvedPrompt: document.getElementById('improvedPrompt'),
            copyBtn: document.getElementById('copyBtn'),
            copyBtnText: document.getElementById('copyBtnText'),
            workspaceScroll: document.getElementById('workspaceScroll'),
            
            // History View
            historyList: document.getElementById('historyList'),
            clearHistoryBtn: document.getElementById('clearHistoryBtn'),
            filterButtons: document.querySelectorAll('.filter-btn'),
            rewriteButtons: document.querySelectorAll('.rewrite-btn'),
        };

        this.currentMode = 'general';
        this.currentFilter = 'all';
        this.allHistoryItems = []; // Cache for filtering

        this.init();
    }

    init() {
        this.bindEvents();
        this.checkApiKeyStatus();
        this.setupTemplates();
        this.loadHistoryBadge();
        
        // Expose global functions for inline handlers
        window.useOptimizedPrompt = () => this.useOptimizedPrompt();
        window.copyImprovedPrompt = () => this.copyImprovedPrompt();
        window.deleteHistoryItem = (id) => this.deleteHistoryItem(id);
        window.viewHistoryItem = (id) => this.viewHistoryItem(id);
    }

    bindEvents() {
        // Navigation
        this.elements.navItems.forEach(item => {
            item.addEventListener('click', () => this.switchView(item));
        });

        // Input Handle
        this.elements.promptInput.addEventListener('input', () => this.handleInput());
        this.elements.promptInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (!this.elements.analyzeBtn.disabled) this.analyzePrompt();
            }
        });

        this.elements.clearBtn.addEventListener('click', () => this.clearWorkspace());
        this.elements.analyzeBtn.addEventListener('click', () => this.analyzePrompt());

        // API Modal
        this.elements.apiKeyToggle.addEventListener('click', () => this.toggleModal(true));
        this.elements.closeApiModal.addEventListener('click', () => this.toggleModal(false));
        document.getElementById('apiModalBackdrop').addEventListener('click', () => this.toggleModal(false));
        this.elements.saveApiKeyBtn.addEventListener('click', () => this.saveApiKey());
        
        // History Filters
        this.elements.filterButtons.forEach(btn => {
            btn.addEventListener('click', () => this.handleFilter(btn));
        });

        // Rewrite Modes
        this.elements.rewriteButtons.forEach(btn => {
            btn.addEventListener('click', () => this.handleRewrite(btn));
        });

        this.elements.clearHistoryBtn.addEventListener('click', () => this.clearHistory());
    }

    /* --- Navigation --- */
    switchView(navEl) {
        const target = navEl.getAttribute('data-view');
        
        this.elements.navItems.forEach(n => n.classList.remove('active'));
        navEl.classList.add('active');
        
        this.elements.views.forEach(v => {
            v.classList.remove('active');
            if (v.id === `view-${target}`) v.classList.add('active');
        });

        if (target === 'history') this.loadHistory();
    }

    /* --- API Key Management --- */
    toggleModal(show) {
        if (show) this.elements.apiModal.classList.add('open');
        else this.elements.apiModal.classList.remove('open');
    }

    async checkApiKeyStatus() {
        try {
            const res = await fetch(`${this.API_BASE}/settings/apikey/status`);
            const data = await res.json();
            if (data.configured) {
                this.elements.apiStatusDot.classList.add('connected');
            } else {
                this.elements.apiStatusDot.classList.remove('connected');
                // Auto show after 1s if unconfigured
                setTimeout(() => this.toggleModal(true), 1000);
            }
        } catch (e) {
            console.error('Failed to check API status:', e);
        }
    }

    async saveApiKey() {
        const key = this.elements.apiKeyInput.value.trim();
        if (!key) return;

        this.elements.saveApiKeyBtn.textContent = 'Saving...';
        
        try {
            const res = await fetch(`${this.API_BASE}/settings/apikey`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ apiKey: key })
            });

            if (res.ok) {
                this.elements.apiKeyStatus.textContent = 'Key securely saved to server.';
                this.elements.apiKeyStatus.style.color = 'var(--success)';
                this.elements.apiKeyInput.value = '';
                this.checkApiKeyStatus();
                setTimeout(() => {
                    this.toggleModal(false);
                    this.elements.apiKeyStatus.textContent = '';
                }, 1000);
            } else {
                throw new Error('Failed to save API key');
            }
        } catch (e) {
            this.elements.apiKeyStatus.textContent = e.message;
            this.elements.apiKeyStatus.style.color = 'var(--danger)';
        } finally {
            this.elements.saveApiKeyBtn.textContent = 'Save Configuration';
        }
    }

    /* --- Workspace Actions --- */
    setupTemplates() {
        document.querySelectorAll('.template-card').forEach(card => {
            card.addEventListener('click', () => {
                const prompt = card.getAttribute('data-prompt');
                if (prompt) {
                    this.elements.promptInput.value = prompt;
                    this.handleInput();
                    this.elements.promptInput.focus();
                }
            });
        });
    }

    handleInput() {
        // Auto-resize textarea
        const el = this.elements.promptInput;
        el.style.height = 'auto';
        el.style.height = (el.scrollHeight < 200 ? el.scrollHeight : 200) + 'px';

        const text = el.value.trim();
        this.elements.charCount.textContent = `${text.length} chars`;
        this.elements.analyzeBtn.disabled = text.length === 0;

        // --- Real-Time Coaching Logic ---
        this.evaluateLiveCoaching(text.toLowerCase());
    }

    evaluateLiveCoaching(text) {
        // Quick regex checks for specific criteria patterns
        
        // Role: "act as", "you are a", "persona:"
        const hasRole = /act as|you are a|persona:|pretend to be|role as a/i.test(text);
        this.toggleCoachChip('coach-role', hasRole);

        // Format: "json", "markdown", "table", "format:", "output as"
        const hasFormat = /json|markdown|table|csv|format:|output as|structure:|bullet points/i.test(text);
        this.toggleCoachChip('coach-format', hasFormat);

        // Constraints: "under", "max", "words", "limit", "must be", "exactly"
        const hasConstraints = /under \d+|max \d+|limit|must be|exactly \d+|no more than|at least \d+/i.test(text);
        this.toggleCoachChip('coach-constraints', hasConstraints);

        // Examples: "example:", "for instance", "input: ... output:"
        const hasExamples = /example:|for instance|e\.g\.|input:.+output:/i.test(text);
        this.toggleCoachChip('coach-examples', hasExamples);
    }

    toggleCoachChip(id, isDetected) {
        const chip = document.getElementById(id);
        if (!chip) return;

        if (isDetected) {
            chip.classList.remove('missing');
            chip.classList.add('detected');
        } else {
            chip.classList.remove('detected');
            chip.classList.add('missing');
        }
    }

    clearWorkspace() {
        this.elements.promptInput.value = '';
        this.handleInput();
        this.elements.promptInput.focus();
        
        this.elements.resultsSection.style.display = 'none';
        this.elements.welcomeState.style.display = 'block';
        this.elements.errorBanner.style.display = 'none';
    }

    async analyzePrompt(customMode = null) {
        const prompt = this.elements.promptInput.value.trim();
        if (!prompt) return;

        const mode = customMode || this.currentMode;
        this.setLoadingState(true);

        try {
            const res = await fetch(`${this.API_BASE}/analyze`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt, mode })
            });

            const data = await res.json();
            
            if (!res.ok) {
                throw new Error(data.error || 'Analysis failed. Make sure your API key is correct and valid.');
            }

            this.renderAnalysis(prompt, data.analysis);
            this.loadHistoryBadge();

        } catch (e) {
            this.showError(e.message);
        } finally {
            this.setLoadingState(false);
        }
    }

    setLoadingState(isLoading) {
        this.elements.analyzeBtn.disabled = isLoading;
        this.elements.promptInput.disabled = isLoading;
        if (isLoading) {
            this.elements.submitIcon.style.display = 'none';
            this.elements.btnLoader.style.display = 'block';
            this.elements.errorBanner.style.display = 'none';
        } else {
            this.elements.submitIcon.style.display = 'block';
            this.elements.btnLoader.style.display = 'none';
        }
    }

    showError(msg) {
        this.elements.errorMessage.textContent = msg;
        this.elements.errorBanner.style.display = 'flex';
        this.elements.welcomeState.style.display = 'none';
        this.elements.resultsSection.style.display = 'none';
    }

    renderAnalysis(userPrompt, data) {
        if (!data) return;

        this.elements.welcomeState.style.display = 'none';
        this.elements.errorBanner.style.display = 'none';
        this.elements.resultsSection.style.display = 'flex';

        // Render Score Header
        const score = data.score || 0;
        this.elements.scoreVerdict.textContent = data.verdict || 'Evaluation Complete';
        this.elements.scoreDesc.textContent = data.description || '';
        
        // Massive Score UI Update
        this.elements.scoreBadge.innerHTML = `${score}<span class="score-massive-max">/10</span>`;
        
        let ringBg = 'var(--danger)';
        if (score >= 5) ringBg = 'var(--warning)';
        if (score >= 7) ringBg = 'var(--success)';
        if (score >= 9) ringBg = '#000';
        document.querySelector('.score-massive-ring').style.background = ringBg;

        // Render Quality Breakdown (Progress Bars)
        if (data.evaluation) {
            this.elements.criteriaGrid.innerHTML = '';
            
            const criteriaMaps = [
                { key: 'context', name: 'Context' },
                { key: 'role', name: 'Role Assignment' },
                { key: 'format', name: 'Output Format' },
                { key: 'examples', name: 'Few-Shot Examples' },
                { key: 'constraints', name: 'Constraints Set' }
            ];

            criteriaMaps.forEach(c => {
                const evalData = data.evaluation[c.key];
                if (!evalData) return;

                const subScore = evalData.score || 0;
                const note = evalData.note || 'No notes provided.';
                const barWidth = `${subScore * 10}%`;
                
                let barColor = 'var(--danger)';
                if (subScore >= 5) barColor = 'var(--warning)';
                if (subScore >= 7) barColor = 'var(--success)';
                if (subScore >= 9) barColor = '#000';

                const div = document.createElement('div');
                div.className = 'crit-row';
                div.innerHTML = `
                    <div class="crit-info">
                        <span>${c.name}</span>
                        <span class="crit-info-score">${subScore}/10</span>
                    </div>
                    <div class="crit-bar-bg">
                        <div class="crit-bar-fill" style="width: ${barWidth}; background: ${barColor}"></div>
                    </div>
                    <div class="crit-note">${this.escapeHTML(note)}</div>
                `;
                this.elements.criteriaGrid.appendChild(div);
            });
        }

        // Lists
        const sf = x => `<li>${this.escapeHTML(x)}</li>`;
        this.elements.strengthsList.innerHTML = data.strengths?.length > 0 ? data.strengths.map(sf).join('') : '<li>None notable.</li>';
        this.elements.weaknessesList.innerHTML = data.weaknesses?.length > 0 ? data.weaknesses.map(sf).join('') : '<li>Looks completely solid!</li>';

        // Optimized Prompt
        this.elements.improvedPrompt.textContent = data.improved_prompt || 'No improved prompt generated.';

        // Scroll down
        setTimeout(() => {
            const rightPane = document.getElementById('analysisPane');
            if(rightPane) rightPane.scrollTo({ top: rightPane.scrollHeight, behavior: 'smooth' });
        }, 100);
    }

    handleRewrite(btn) {
        const mode = btn.getAttribute('data-mode');
        this.elements.rewriteButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentMode = mode;
        this.analyzePrompt(mode);
    }

    handleFilter(btn) {
        const filter = btn.getAttribute('data-filter');
        this.elements.filterButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentFilter = filter;
        this.renderFilteredHistory();
    }

    useOptimizedPrompt() {
        const text = this.elements.improvedPrompt.textContent;
        if (text) {
            this.elements.promptInput.value = text;
            this.handleInput();
            this.elements.promptInput.focus();
        }
    }

    copyImprovedPrompt() {
        const text = this.elements.improvedPrompt.textContent;
        navigator.clipboard.writeText(text).then(() => {
            this.elements.copyBtnText.textContent = 'Copied!';
            setTimeout(() => {
                this.elements.copyBtnText.textContent = 'Copy';
            }, 2000);
        });
    }

    escapeHTML(str) {
        return str.replace(/[&<>'"]/g, tag => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
        }[tag] || tag));
    }

    /* --- History Management --- */
    async loadHistoryBadge() {
        try {
            const res = await fetch(`${this.API_BASE}/history`);
            const data = await res.json();
            if (data.length > 0) {
                this.elements.historyBadge.textContent = data.length;
                this.elements.historyBadge.style.display = 'inline-block';
            } else {
                this.elements.historyBadge.style.display = 'none';
            }
        } catch (e) {}
    }

    async loadHistory() {
        this.elements.historyList.innerHTML = '<div class="panel-empty-state">Loading history...</div>';
        
        try {
            const res = await fetch(`${this.API_BASE}/history`);
            this.allHistoryItems = await res.json();
            this.renderFilteredHistory();
        } catch (e) {
            this.elements.historyList.innerHTML = '<div class="panel-empty-state" style="color:var(--danger)">Failed to load history.</div>';
        }
    }

    renderFilteredHistory() {
        let items = [...this.allHistoryItems];

        if (this.currentFilter === 'high') {
            items = items.filter(i => i.score >= 8);
        } else if (this.currentFilter === 'needs-improvement') {
            items = items.filter(i => i.score < 6);
        }

        if (items.length === 0) {
            this.elements.historyList.innerHTML = `<div class="panel-empty-state">No ${this.currentFilter === 'all' ? '' : this.currentFilter.replace('-', ' ')} prompts found.</div>`;
            return;
        }

        this.elements.historyList.innerHTML = '';
        
        items.forEach(item => {
                const dateRaw = new Date(item.created_at);
                const date = !isNaN(dateRaw) ? dateRaw.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';
                
                let scoreBg = 'var(--danger)';
                if (item.score >= 5) scoreBg = 'var(--warning)';
                if (item.score >= 7) scoreBg = 'var(--success)';
                if (item.score >= 9) scoreBg = '#000';

                const div = document.createElement('div');
                div.className = 'history-card';
                div.onclick = () => this.viewHistoryItem(item.id);
                
                div.innerHTML = `
                    <div class="hist-card-head">
                        <div class="hist-card-score" style="background:${scoreBg}">${item.score}/10</div>
                        <div class="hist-card-date">${date}</div>
                    </div>
                    <div class="hist-card-text">${this.escapeHTML(item.prompt_text)}</div>
                    <div class="hist-card-verdict">
                        <span>${this.escapeHTML(item.verdict || 'Analyzed')}</span>
                        <button class="delete-btn" onclick="event.stopPropagation(); deleteHistoryItem('${item.id}')" aria-label="Delete History Item">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        </button>
                    </div>
                `;
                this.elements.historyList.appendChild(div);
            });
    }

    async deleteHistoryItem(id) {
        try {
            await fetch(`${this.API_BASE}/history/${id}`, { method: 'DELETE' });
            this.loadHistory();
            this.loadHistoryBadge();
        } catch(e) {}
    }

    async clearHistory() {
        if(confirm('Are you sure you want to clear your entire history?')) {
            try {
                await fetch(`${this.API_BASE}/history`, { method: 'DELETE' });
                this.loadHistory();
                this.loadHistoryBadge();
            } catch(e) {}
        }
    }

    async viewHistoryItem(id) {
        try {
            const res = await fetch(`${this.API_BASE}/history/${id}`);
            if(res.ok) {
                const data = await res.json();
                
                // Switch back to Workspace view
                document.querySelector('.nav-item[data-view="workspace"]').click();
                
                // Populate data
                this.renderAnalysis(data.prompt_text, data.analysis);
            }
        } catch(e) {}
    }
}

// Initialize Application once DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.appInstance = new App();
});
