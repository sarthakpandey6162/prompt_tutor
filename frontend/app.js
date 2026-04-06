/**
 * Prompt Tutor — Linear-style Frontend
 * All 4 pages, loading/skeleton state
 * Diff view, search, example dropdown, score improvement chart
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
        this.analysisMode = 'balanced';
        this.tokenBudget = { limit: 6000, used: 0, remaining: 6000, resetsInMs: 0 };
        this.usagePoll = null;
        this.lastEstimate = 0;
        this.lastAnalyzeAt = 0;
        this.history = [];
        this.showDiff = false;
        this.cachedKeyStatus = null;
        this.sessionApiKey = '';
        this.backendHasDefaultKey = false;
        this.loadingPhrases = [
            'Analyzing structure...',
            'Checking clarity and constraints...',
            'Generating improved versions...'
        ];
        this.loadingTick = null;
        this.charts = { line: null, bar: null, radar: null };
        this.lessons = this.getLessons();
        this.challenges = this.getChallenges();
        this.lessonState = this.loadProgressState('pt_lessons_completed');
        this.challengeState = this.loadProgressState('pt_challenges_completed');
        this.activeLessonId = null;
        this.activeChallengeId = null;
        this.libraryModalData = null;
        this.cache();
        this.bind();
    }

    cache() {
        this.$ = {
            sidebar: document.getElementById('sidebar'),
            sbLinks: document.querySelectorAll('.sb-link[data-view]'),
            views: document.querySelectorAll('.view'),
            badge: document.getElementById('libBadge'),
            input: document.getElementById('promptInput'),
            clearBtn: document.getElementById('clearBtn'),
            analyzeBtn: document.getElementById('analyzeBtn'),
            analyzeTxt: document.getElementById('analyzeTxt'),
            spinner: document.getElementById('spinner'),
            budgetPill: document.getElementById('budgetPill'),
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
            testWeakBtn: document.getElementById('testWeakBtn'),
            testStrongBtn: document.getElementById('testStrongBtn'),
            testRandomBtn: document.getElementById('testRandomBtn'),
            testHealthBtn: document.getElementById('testHealthBtn'),
            apiHealthBadge: document.getElementById('apiHealthBadge'),
            loadingText: document.querySelector('.loading-text'),
            // Library
            libGrid: document.getElementById('libGrid'),
            libEmpty: document.getElementById('libEmpty'),
            libSearch: document.getElementById('libSearch'),
            libSortShell: document.getElementById('libSortShell'),
            libSortTrigger: document.getElementById('libSortTrigger'),
            libSortMenu: document.getElementById('libSortMenu'),
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
            elementRadar: document.getElementById('elementRadar'),
            trendLabel: document.getElementById('trendLabel'),
            distPills: document.querySelectorAll('.dist-pill[data-band]'),
            // Modal
            modal: document.getElementById('modal'),
            modalOverlay: document.getElementById('modalOverlay'),
            modalX: document.getElementById('modalX'),
            saveKeyBtn: document.getElementById('saveKeyBtn'),
            apiKeyInput: document.getElementById('apiKeyInput'),
            modalStatus: document.getElementById('modalStatus'),

            apiDot: document.getElementById('apiDot'),
            keyToggle: document.getElementById('keyToggle'),
            libraryModal: document.getElementById('libraryModal'),
            libraryModalOverlay: document.getElementById('libraryModalOverlay'),
            libraryModalX: document.getElementById('libraryModalX'),
            libraryModalScore: document.getElementById('libraryModalScore'),
            libraryModalStrengths: document.getElementById('libraryModalStrengths'),
            libraryModalWeaknesses: document.getElementById('libraryModalWeaknesses'),
            libraryModalImproved: document.getElementById('libraryModalImproved'),
            libraryUseBtn: document.getElementById('libraryUseBtn'),
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
            // Lessons
            lessonList: document.getElementById('lessonList'),
            lessonDetail: document.getElementById('lessonDetail'),
            lessonBack: document.getElementById('lessonBack'),
            lessonTitle: document.getElementById('lessonTitle'),
            lessonDesc: document.getElementById('lessonDesc'),
            lessonContent: document.getElementById('lessonContent'),
            lessonCompleteBtn: document.getElementById('lessonCompleteBtn'),
            lessonProgress: document.getElementById('lessonProgress'),
            // Challenges
            challengeList: document.getElementById('challengeList'),
            challengeDetail: document.getElementById('challengeDetail'),
            challengeBack: document.getElementById('challengeBack'),
            challengeTitle: document.getElementById('challengeTitle'),
            challengeDesc: document.getElementById('challengeDesc'),
            challengeInput: document.getElementById('challengeInput'),
            challengeSubmit: document.getElementById('challengeSubmit'),
            challengeResult: document.getElementById('challengeResult'),
            challengeFeedback: document.getElementById('challengeFeedback'),
            challengeProgress: document.getElementById('challengeProgress'),
            // Chat
            chatList: document.getElementById('chatList'),
            chatScroll: document.getElementById('chatScroll'),
            chatInput: document.getElementById('chatInput'),
            chatSendBtn: document.getElementById('chatSendBtn'),
            chatClearBtn: document.getElementById('chatClearBtn'),
            chatModelSelect: document.getElementById('chatModelSelect')
        };
        this.pills = {};
        document.querySelectorAll('.el-pill').forEach(p => { this.pills[p.dataset.el] = p; });
    }

    bind() {
        // Desktop nav
        this.$.sbLinks.forEach(n => n.addEventListener('click', () => this.go(n.dataset.view)));
        // Settings nav
        document.getElementById('settingsNav')?.addEventListener('click', () => this.openModal());
        // Input
        this.$.input.addEventListener('input', () => { this.detect(); this.counts(); this.updateAnalyzeButtonState(); this.saveDraft(); });
        this.$.input.addEventListener('keydown', e => {
            if (e.key === 'Enter' && !e.shiftKey && !this.$.analyzeBtn.disabled) {
                e.preventDefault();
                this.analyze();
            }
        });
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
                this.updateAnalyzeButtonState();
                this.$.input.focus();
                this.saveDraft();
                this.$.exampleMenu.classList.remove('open');
            });
        });
        this.$.quickChips.forEach(chip => {
            chip.addEventListener('click', () => this.insertTemplate(chip.dataset.insert || ''));
        });
        this.$.testWeakBtn?.addEventListener('click', () => this.loadTestPrompt('weak'));
        this.$.testStrongBtn?.addEventListener('click', () => this.loadTestPrompt('strong'));
        this.$.testRandomBtn?.addEventListener('click', () => this.loadRandomTestPrompt());
        this.$.testHealthBtn?.addEventListener('click', () => this.runApiHealthCheck());
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
        const libSearchWrap = this.$.libSearch?.closest('.lib-search-wrap');
        const syncLibSearchTypingState = () => {
            if (!libSearchWrap || !this.$.libSearch) return;
            const isTyping = document.activeElement === this.$.libSearch && this.$.libSearch.value.trim().length > 0;
            libSearchWrap.classList.toggle('is-typing', isTyping);
        };

        this.$.libSearch.addEventListener('input', () => {
            this.searchQuery = this.$.libSearch.value.trim().toLowerCase();
            this.renderLib();
            syncLibSearchTypingState();
        });
        this.$.libSearch.addEventListener('focus', () => syncLibSearchTypingState());
        this.$.libSearch.addEventListener('blur', () => libSearchWrap?.classList.remove('is-typing'));
        this.$.libSortTrigger?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleLibSortMenu();
        });
        this.$.libSortMenu?.addEventListener('click', (e) => {
            const btn = e.target.closest('.lib-sort-option');
            if (!btn) return;
            this.setLibSortMode(btn.dataset.value, btn.textContent.trim());
        });
        document.addEventListener('click', () => this.closeLibSortMenu());
        this.$.exportBtn?.addEventListener('click', () => this.exportHistory());
        this.$.importBtn?.addEventListener('click', () => this.$.importInput?.click());
        this.$.importInput?.addEventListener('change', (e) => this.importHistoryFile(e));
        // Modal
        this.$.modalOverlay.addEventListener('click', () => this.closeModal());
        this.$.modalX.addEventListener('click', () => this.closeModal());
        this.$.saveKeyBtn.addEventListener('click', () => this.saveKey());

        this.$.libraryModalOverlay?.addEventListener('click', () => this.closeLibraryModal());
        this.$.libraryModalX?.addEventListener('click', () => this.closeLibraryModal());
        this.$.libraryUseBtn?.addEventListener('click', () => this.useLibraryInEditor());
        // Eye toggle
        this.$.keyToggle.addEventListener('click', () => {
            const inp = this.$.apiKeyInput;
            inp.type = inp.type === 'password' ? 'text' : 'password';
        });

        // Tour
        this.$.tourFab?.addEventListener('click', () => this.openTour(true));
        this.$.tourOverlay?.addEventListener('click', () => this.closeTour());
        this.$.tourClose?.addEventListener('click', () => this.closeTour());
        this.$.tourSkip?.addEventListener('click', () => this.closeTour(true));
        this.$.tourPrev?.addEventListener('click', () => this.nextTour(-1));
        this.$.tourNext?.addEventListener('click', () => this.nextTour(1));

        // Lessons
        this.$.lessonBack?.addEventListener('click', () => this.showLessonsList());
        this.$.lessonCompleteBtn?.addEventListener('click', () => this.markLessonComplete());

        // Challenges
        this.$.challengeBack?.addEventListener('click', () => this.showChallengesList());
        this.$.challengeSubmit?.addEventListener('click', () => this.submitChallenge());

        // PromptCraft
        const pcIdea = document.getElementById('pcIdea');
        const pcBtn = document.getElementById('pcGenerateBtn');
        pcIdea?.addEventListener('input', () => {
            if (pcBtn) pcBtn.disabled = !pcIdea.value.trim();
        });
        pcBtn?.addEventListener('click', () => this.craftPrompt());
        document.getElementById('pcCopyBtn')?.addEventListener('click', () => this.copyPromptCraft());
        document.getElementById('pcUseBtn')?.addEventListener('click', () => this.usePromptCraftInEditor());

        // Chat
        this.$.chatSendBtn?.addEventListener('click', () => this.sendChatMessage());
        this.$.chatInput?.addEventListener('keydown', e => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendChatMessage();
            }
        });
        this.$.chatClearBtn?.addEventListener('click', () => this.clearChat());
    }

    async init() {
        document.documentElement.setAttribute('data-theme', 'light');

        this.checkKey();
        this.syncLibSortUI();
        this.loadBadge();
        this.loadDraft();
        await this.refreshUsageBudget();
        this.usagePoll = setInterval(() => this.refreshUsageBudget(), 10_000);
        this.buildCheatSheet();
        this.renderLessonsList();
        this.renderChallengesList();
        this.openTour(false);
    }

    /* ===== PromptCraft ===== */
    async craftPrompt() {
        const idea = document.getElementById('pcIdea')?.value?.trim();
        if (!idea) return;
        if (!this.ensureSessionApiKey()) return;

        const tone = document.getElementById('pcTone')?.value || '';
        const audience = document.getElementById('pcAudience')?.value || '';
        const format = document.getElementById('pcFormat')?.value || '';
        const btn = document.getElementById('pcGenerateBtn');
        const btnTxt = document.getElementById('pcGenerateTxt');
        const spinner = document.getElementById('pcSpinner');

        // Loading state
        if (btn) btn.disabled = true;
        if (btnTxt) btnTxt.textContent = 'Crafting...';
        if (spinner) spinner.style.display = 'inline-block';



        try {
            const resp = await fetch('/api/craft-prompt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ idea, tone, audience, format, apiKey: this.sessionApiKey })
            });

            const data = await resp.json();

            if (!resp.ok) {
                this.toast(data.error || 'Failed to craft prompt', 'error');
                return;
            }

            // Show result
            this._lastCraftedPrompt = data.prompt;
            document.getElementById('pcEmpty').style.display = 'none';
            const resultEl = document.getElementById('pcResult');
            resultEl.style.display = 'flex';

            document.getElementById('pcResultTitle').textContent = data.title || 'Crafted Prompt';
            document.getElementById('pcPromptText').textContent = data.prompt;

            // Render tips
            const tipsEl = document.getElementById('pcTips');
            tipsEl.innerHTML = '';
            if (data.tips && data.tips.length) {
                data.tips.forEach(tip => {
                    const div = document.createElement('div');
                    div.className = 'pc-tip';
                    div.textContent = tip;
                    tipsEl.appendChild(div);
                });
            }

            if (data.budget) this.refreshUsageBudget();

        } catch (err) {
            this.toast('Network error. Please check your connection.', 'error');
        } finally {
            if (btn) btn.disabled = !idea;
            if (btnTxt) btnTxt.textContent = 'Generate Prompt';
            if (spinner) spinner.style.display = 'none';
        }
    }

    copyPromptCraft() {
        const text = this._lastCraftedPrompt;
        if (!text) return;
        navigator.clipboard.writeText(text).then(() => {
            const el = document.getElementById('pcCopyTxt');
            if (el) { el.textContent = 'Copied!'; setTimeout(() => el.textContent = 'Copy', 1500); }
        });
    }

    usePromptCraftInEditor() {
        const text = this._lastCraftedPrompt;
        if (!text) return;
        // Navigate to Craft view and populate editor
        this.go('craft');
        const editor = this.$.promptInput;
        if (editor) {
            editor.innerText = text;
            editor.dispatchEvent(new Event('input', { bubbles: true }));
        }
        this.toast('Prompt loaded into editor!', 'success');
    }

    getLessons() {
        return [
            {
                id: 'l1',
                icon: '📘',
                title: 'Prompt Basics',
                summary: 'Understand what makes a good prompt and why it matters',
                content: '<p>Strong prompts are specific, structured, and contextual. Think of prompts as brief specs, not casual requests.</p><h4>Core structure to follow</h4><ul><li><strong>Role:</strong> "Act as a hiring manager"</li><li><strong>Format:</strong> "Return as a table with columns: skill, gap, recommendation"</li><li><strong>Constraints:</strong> "Under 150 words"</li><li><strong>Examples:</strong> "Input: X -> Output: Y"</li><li><strong>Context:</strong> "Audience is beginners"</li></ul><h4>Mini example</h4><p><strong>Weak:</strong> "Help me with my resume"</p><p><strong>Strong:</strong> "Act as a senior recruiter. Review this resume for a frontend role. Return 5 bullet points with one specific fix each. Keep under 130 words."</p>'
            },
            {
                id: 'l2',
                icon: '🧠',
                title: 'Role Assignment',
                summary: 'Learn how assigning roles to AI dramatically improves output quality',
                content: '<p>Role assignment sets the model perspective and raises answer quality instantly.</p><p><strong>Without role:</strong> "Write feedback for this resume."</p><p><strong>With role:</strong> "Act as a senior recruiter. Give concise resume feedback using hiring criteria, impact, and clarity."</p><h4>Why it works</h4><ul><li>Creates a clear decision lens</li><li>Improves consistency across responses</li><li>Reduces generic fluff</li></ul><p>Use role + domain + audience for best results.</p>'
            },
            {
                id: 'l3',
                icon: '🧪',
                title: 'Few-Shot Prompting',
                summary: 'Provide examples to guide AI output format and style',
                content: '<p>Few-shot prompting means: show examples first, then ask for new output.</p><h4>Pattern</h4><p>Input A -> Output A<br>Input B -> Output B<br>Input C -> ?</p><h4>Practical example</h4><p><strong>Example:</strong> Input: "Refund request" -> Output: "Empathetic 3-line response"</p><p>Then your new case gets more consistent style, length, and tone.</p><ul><li>Great for email writing</li><li>Great for JSON response templates</li><li>Great for support/chat tone consistency</li></ul>'
            },
            {
                id: 'l4',
                icon: '🪜',
                title: 'Chain of Thought',
                summary: 'Guide AI to think step-by-step for complex tasks',
                content: '<p>For difficult reasoning tasks, use scaffolding language to reduce mistakes.</p><h4>Useful phrases</h4><ul><li>"Think step by step"</li><li>"Explain assumptions first"</li><li>"List 2 alternatives, then choose best"</li><li>"Then provide final answer"</li></ul><p>This improves logic transparency and catches edge cases before final output.</p><h4>Tip</h4><p>For production prompts, ask for a short reasoning summary, then final answer in a strict format.</p>'
            },
            {
                id: 'l5',
                icon: '📏',
                title: 'Constraints & Format',
                summary: 'Control AI output length, format and style',
                content: '<p>Constraints and format convert "nice output" into "usable output".</p><h4>High-value constraints</h4><ul><li>"Max 120 words"</li><li>"Exactly 5 bullets"</li><li>"No jargon"</li><li>"Include one concrete example"</li></ul><h4>Format controls</h4><ul><li>"Return JSON with keys: summary, risks, next_steps"</li><li>"Use markdown table with columns: issue, impact, fix"</li><li>"Use plain English for a 10-year-old"</li></ul><p>Constraints make responses predictable and easy to integrate into workflows.</p>'
            }
        ];
    }

    getChallenges() {
        return [
            { id: 'c1', title: 'Email Composer', summary: 'Write a prompt that gets AI to write a professional email declining a meeting. Must score 7+ to pass.', pass: 7 },
            { id: 'c2', title: 'Code Debugger', summary: 'Write a prompt asking AI to find and fix a bug in a specific code snippet. Must score 7+ to pass.', pass: 7 },
            { id: 'c3', title: 'Data Analyst', summary: 'Write a prompt to analyze sales data and provide actionable insights. Must score 7+ to pass.', pass: 7 },
            { id: 'c4', title: 'Teach Me', summary: 'Write a prompt explaining a complex topic to a 10-year-old. Must score 7+ to pass.', pass: 7 },
            { id: 'c5', title: 'Creative Writer', summary: 'Write a prompt to generate a short story with specific requirements. Must score 7+ to pass.', pass: 7 }
        ];
    }

    loadProgressState(key) {
        try {
            const raw = localStorage.getItem(key);
            const parsed = raw ? JSON.parse(raw) : {};
            return parsed && typeof parsed === 'object' ? parsed : {};
        } catch {
            return {};
        }
    }

    saveProgressState(key, state) {
        localStorage.setItem(key, JSON.stringify(state || {}));
    }

    /* ===== Navigation ===== */
    go(view) {
        let actualView = view === 'saved' ? 'library' : view;
        
        // Sync sidebar
        this.$.sbLinks.forEach(n => n.classList.toggle('active', n.dataset.view === view));
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
        if (actualView === 'lessons') this.renderLessonsList();
        if (actualView === 'challenges') this.renderChallengesList();
        if (actualView === 'chat') this.loadChat();
        if (actualView === 'cheatsheet') this.buildCheatSheet();
    }

    /* ===== API Key ===== */
    openModal() { this.$.modal.classList.add('open'); }
    closeModal() { this.$.modal.classList.remove('open'); }

    async checkKey() {
        const badge = this.$.apiDot;
        const setBadge = (configured) => {
            if (!badge) return;
            badge.textContent = configured ? 'Ready ✓' : 'Not set ✗';
            badge.classList.toggle('on', configured);
            badge.style.width = 'auto';
            badge.style.height = '22px';
            badge.style.padding = '0 8px';
            badge.style.borderRadius = '999px';
            badge.style.display = 'inline-flex';
            badge.style.alignItems = 'center';
            badge.style.justifyContent = 'center';
            badge.style.fontSize = '11px';
            badge.style.fontWeight = '700';
            badge.style.color = '#fff';
            badge.style.lineHeight = '1';
        };

        try {
            const r = await fetch(`${this.API}/settings/apikey/status`);
            const d = await r.json();
            this.backendHasDefaultKey = !!(d.configured || d.hasKey);
        } catch (_) {
            this.backendHasDefaultKey = false;
        }

        const configured = !!this.sessionApiKey || this.backendHasDefaultKey;
        this.cachedKeyStatus = configured;
        setBadge(configured);
        if (!configured) setTimeout(() => this.openModal(), 300);
    }

    async saveKey() {
        const k = this.$.apiKeyInput.value.trim();
        if (!k) return;
        if (k.length < 20) {
            this.$.modalStatus.textContent = 'Invalid key format';
            this.$.modalStatus.style.color = 'var(--red)';
            return;
        }
        this.$.saveKeyBtn.textContent = 'Applying...';
        try {
            this.sessionApiKey = k;
            this.$.apiKeyInput.value = '';
            this.$.modalStatus.textContent = 'Key set for this session only';
            this.$.modalStatus.style.color = 'var(--ok)';
            this.checkKey();
            this.toast('Session key applied', 'ok');
            setTimeout(() => this.closeModal(), 400);
        } catch (e) {
            this.$.modalStatus.textContent = 'Error saving key';
            this.$.modalStatus.style.color = 'var(--red)';
        } finally { this.$.saveKeyBtn.textContent = 'Apply Session Key'; }
    }

    ensureSessionApiKey() {
        if (this.sessionApiKey || this.backendHasDefaultKey) return true;
        this.showErr('Enter your Groq API key to continue. It is not saved and is required each login.');
        this.openModal();
        return false;
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
        this.lastEstimate = this.estimateTokensForPrompt(t, this.analysisMode);
        this.updateBudgetUI();
    }

    estimateTokensForPrompt(text, mode = 'balanced') {
        const maxOut = mode === 'quick' ? 280 : mode === 'deep' ? 760 : 520;
        const input = Math.ceil((String(text || '').length + 900) / 4);
        return input + maxOut;
    }

    updateAnalyzeButtonState() {
        const hasPrompt = !!this.$.input.value.trim();
        const enoughBudget = (this.tokenBudget?.remaining ?? 0) >= this.lastEstimate;
        this.$.analyzeBtn.disabled = !hasPrompt || !enoughBudget;
    }

    updateBudgetUI() {
        if (!this.$.budgetPill) return;
        const remaining = Math.max(0, Number(this.tokenBudget?.remaining || 0));
        const limit = Math.max(1, Number(this.tokenBudget?.limit || 6000));
        this.$.budgetPill.textContent = `Budget ${remaining}/${limit} · est ${this.lastEstimate}`;
        this.$.budgetPill.classList.toggle('low', remaining < this.lastEstimate);
    }

    async refreshUsageBudget() {
        try {
            const r = await this.apiFetch(['/usage']);
            if (!r.ok) return;
            const d = await r.json();
            if (d && typeof d.remaining === 'number') {
                this.tokenBudget = d;
                this.updateBudgetUI();
                this.updateAnalyzeButtonState();
            }
        } catch (_) {}
    }

    /* ===== Analyze ===== */
    async analyze() {
        const prompt = this.$.input.value.trim();
        if (!prompt) return;
        if (!this.ensureSessionApiKey()) return;
        if (prompt.length > 8000) {
            this.showErr('Prompt is too long. Please keep it under 8000 characters.');
            return;
        }
        const now = Date.now();
        if (now - this.lastAnalyzeAt < 1800) {
            this.showErr('Please wait a second before running another analysis.');
            return;
        }



        const estimate = this.estimateTokensForPrompt(prompt, this.analysisMode);
        if ((this.tokenBudget?.remaining ?? 0) < estimate) {
            this.showErr('Budget too low right now. Please wait about 1 minute and try again.');
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
        this.lastAnalyzeAt = now;

        try {
            const r = await fetch(`${this.API}/analyze`, {
                method: 'POST',
                headers: {'Content-Type':'application/json'},
                body: JSON.stringify({ prompt, apiKey: this.sessionApiKey })
            });
            const d = await r.json();
            if (!r.ok) throw new Error(d.error || 'Analysis failed.');
            if (d.budget) {
                this.tokenBudget = d.budget;
                this.updateBudgetUI();
            }
            this.analysis = this.normalizeAnalysis(d.analysis || d, prompt);
            this.variant = 'default';
            this.showDiff = false;
            this.$.diffToggle.classList.remove('active');
            this.render(this.analysis);
            this.loadBadge();
            this.toast(d.cached ? 'Loaded cached analysis' : 'Analysis complete', 'ok');
        } catch (e) { this.showErr(e.message); this.$.loadingState.style.display = 'none'; this.$.emptyState.style.display = 'flex'; }
        finally {
            this.setLoading(false);
            this.updateAnalyzeButtonState();
            this.refreshUsageBudget();
        }
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

        const normalizedScore = parseFloat(String(a.score ?? 0).split('/')[0]) || 0;

        return {
            score: Math.max(0, Math.min(10, normalizedScore)),
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

        if (this._scoreAnimRaf) cancelAnimationFrame(this._scoreAnimRaf);
        const finalScore = Number(s) || 0;
        const animDuration = 800;
        const animStart = performance.now();
        this.$.scoreVal.innerHTML = `0<span>/10</span>`;
        const animateScore = (now) => {
            const progress = Math.min((now - animStart) / animDuration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            const current = Math.round(finalScore * eased * 10) / 10;
            this.$.scoreVal.innerHTML = `${current}<span>/10</span>`;
            if (progress < 1) {
                this._scoreAnimRaf = requestAnimationFrame(animateScore);
                return;
            }
            this._scoreAnimRaf = null;
            this.$.scoreVal.innerHTML = `${finalScore}<span>/10</span>`;
        };
        this._scoreAnimRaf = requestAnimationFrame(animateScore);

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
        this.updateAnalyzeButtonState();
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
        this.$.resultsContent.style.display = 'none';
        this.$.loadingState.style.display = 'none';
        this.$.emptyState.style.display = 'flex';
        this.$.errBar.style.display = 'none';
        this.analysis = null;
        this.originalPrompt = '';
        this.showDiff = false;
        this.$.diffToggle.classList.remove('active');
        this.detect(); this.counts();
        this.updateAnalyzeButtonState();
        this.$.input.focus();
        this.saveDraft();
    }

    /* ===== Library ===== */
    async loadBadge() {
        try {
            const r = await fetch(`${this.API}/history`);
            const d = await r.json();
            const viewData = Array.isArray(d) && d.length ? d : this.getShowcaseHistory();
            this.$.badge.textContent = viewData.length;
            this.$.badge.style.display = viewData.length > 0 ? 'inline-block' : 'none';
        } catch (e) {}
    }

    async loadLib() {
        try {
            const r = await fetch(`${this.API}/history`);
            const apiHistory = await r.json();
            this.history = Array.isArray(apiHistory) && apiHistory.length ? apiHistory : this.getShowcaseHistory();
            this.renderLib();
        } catch (e) { this.$.libGrid.innerHTML = ''; this.$.libEmpty.style.display = 'flex'; }
    }

    renderLib() {
        let items = [...this.history];

        // Filter by score / saved
        if (this.filter === 'saved') items = items.filter(i => i.saved === true || i.isSaved === true);
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

        this.syncLibSortUI();

        this.$.clearAllBtn.style.display = this.history.length > 0 ? 'inline-flex' : 'none';

        if (!items.length) { this.$.libGrid.innerHTML = ''; this.$.libEmpty.style.display = 'flex'; return; }
        this.$.libEmpty.style.display = 'none';
        this.$.libGrid.innerHTML = items.map(i => {
            const cleanScore = parseFloat(String(i.score).split('/')[0]) || 0;
            const gradClass = cleanScore >= 7 ? 'sb-high' : cleanScore >= 4 ? 'sb-mid' : 'sb-low';
            const catBadge = i.tone || i.category || 'Neutral';
            const d = new Date(i.created_at);
            const ds = !isNaN(d) ? d.toLocaleDateString(undefined,{month:'short',day:'numeric'}) : '';
            const isSaved = i.saved === true || i.isSaved === true;
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
            const normalized = this.normalizeAnalysis(d, d.prompt_text || '');
            this.libraryModalData = {
                prompt_text: d.prompt_text || '',
                score: normalized.score || 0,
                category: normalized.category || '',
                strengths: normalized.strengths || [],
                weaknesses: normalized.missing || [],
                tips: normalized.tips || [],
                improved: normalized.improved || ''
            };
            this.$.libraryModalScore.textContent = `${this.libraryModalData.score}/10`;
            const catEl = document.getElementById('libraryModalCategory');
            if (catEl) catEl.textContent = this.libraryModalData.category || '—';
            this.$.libraryModalStrengths.innerHTML = this.libraryModalData.strengths.length
                ? this.libraryModalData.strengths.map((x) => `<li>${this.esc(x)}</li>`).join('')
                : '<li>—</li>';
            this.$.libraryModalWeaknesses.innerHTML = this.libraryModalData.weaknesses.length
                ? this.libraryModalData.weaknesses.map((x) => `<li>${this.esc(x)}</li>`).join('')
                : '<li>—</li>';
            const tipsEl = document.getElementById('libraryModalTips');
            if (tipsEl) {
                tipsEl.innerHTML = this.libraryModalData.tips.length
                    ? this.libraryModalData.tips.map((t) => `<li><b>${this.esc(t.title)}</b>${t.description ? ' — ' + this.esc(t.description) : ''}</li>`).join('')
                    : '<li>—</li>';
            }
            this.$.libraryModalImproved.textContent = this.libraryModalData.improved || '—';
            this.$.libraryModal.classList.add('open');
        } catch (e) {}
    }

    closeLibraryModal() {
        this.$.libraryModal?.classList.remove('open');
    }

    useLibraryInEditor() {
        if (!this.libraryModalData) return;
        this.go('craft');
        this.$.input.value = this.libraryModalData.improved || this.libraryModalData.prompt_text || '';
        this.detect();
        this.counts();
        this.updateAnalyzeButtonState();
        this.$.input.focus();
        this.saveDraft();
        this.closeLibraryModal();
        this.toast('Loaded into editor', 'ok');
    }

    async delItem(id) {
        await fetch(`${this.API}/history/${id}`, {method:'DELETE'});
        this.loadLib(); this.loadBadge();
        this.toast('Deleted');
    }

    async toggleSave(id) {
        try {
            let r = await fetch(`${this.API}/history/${id}/save`, { method: 'POST' });
            if (r.status === 404) {
                r = await fetch(`${this.API}/history/${id}/save`, { method: 'PATCH' });
            }
            if (r.ok) {
                const res = await r.json();
                // Update local model
                const item = this.history.find(i => i.id === id);
                if (item) {
                    const nextSaved = typeof res.saved === 'boolean' ? res.saved : !!res.isSaved;
                    item.saved = nextSaved;
                    item.isSaved = nextSaved;
                }
                // Re-render
                this.renderLib();
                const nowSaved = typeof res.saved === 'boolean' ? res.saved : !!res.isSaved;
                this.toast(nowSaved ? 'Prompt Saved' : 'Prompt Removed', 'ok');
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

    toggleLibSortMenu() {
        if (!this.$.libSortShell || !this.$.libSortTrigger) return;
        const isOpen = this.$.libSortShell.classList.toggle('open');
        this.$.libSortTrigger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    }

    closeLibSortMenu() {
        if (!this.$.libSortShell || !this.$.libSortTrigger) return;
        this.$.libSortShell.classList.remove('open');
        this.$.libSortTrigger.setAttribute('aria-expanded', 'false');
    }

    setLibSortMode(value, label) {
        if (!value) return;
        this.sortMode = value;
        if (this.$.libSortTrigger && label) this.$.libSortTrigger.textContent = label;
        this.closeLibSortMenu();
        this.renderLib();
    }

    syncLibSortUI() {
        if (!this.$.libSortTrigger || !this.$.libSortMenu) return;
        const options = Array.from(this.$.libSortMenu.querySelectorAll('.lib-sort-option'));
        const active = options.find((o) => o.dataset.value === this.sortMode) || options[0];
        options.forEach((o) => o.classList.toggle('active', o === active));
        if (active) this.$.libSortTrigger.textContent = active.textContent.trim();
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
            const histRaw = await hr.json();
            const hist = Array.isArray(histRaw) && histRaw.length ? histRaw : this.getShowcaseHistory();

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
            this.updateTrendExplanation(stats.trend, stats.last5Average, stats.averageScore, stats.weakestElement);

            this.renderElementRadar(stats.elementUsage || { role: 0, format: 0, constraints: 0, examples: 0, context: 0 }, stats.totalAnalyzed || hist.length || 0);
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
        const parsedDates = scoreHistory.map(d => new Date(d.date));
        const validDates = parsedDates.filter(d => !isNaN(d));
        const sameDay = validDates.length > 0 && validDates.every(d => {
            const f = validDates[0];
            return d.getFullYear() === f.getFullYear() && d.getMonth() === f.getMonth() && d.getDate() === f.getDate();
        });
        const labels = parsedDates.map(dt => {
            if (isNaN(dt)) return '';
            if (sameDay) {
                return dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
            }
            return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        });
        const data = scoreHistory.map(d => Number(d.score) || 0);
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const accent = this.css('--accent');

        const grad = ctx.createLinearGradient(0, 0, 0, 260);
        grad.addColorStop(0, isDark ? 'rgba(34, 211, 238, 0.34)' : 'rgba(14, 165, 164, 0.28)');
        grad.addColorStop(1, isDark ? 'rgba(34, 211, 238, 0.03)' : 'rgba(14, 165, 164, 0.02)');

        const lineGrad = ctx.createLinearGradient(0, 0, ctx.canvas.width || 600, 0);
        lineGrad.addColorStop(0, isDark ? '#22d3ee' : '#0ea5a4');
        lineGrad.addColorStop(1, isDark ? '#34d399' : '#0f766e');

        this.charts.line = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: 'Score',
                    data,
                    borderColor: lineGrad,
                    backgroundColor: grad,
                    fill: true,
                    tension: 0.42,
                    cubicInterpolationMode: 'monotone',
                    borderWidth: 3,
                    pointRadius: 3,
                    pointHoverRadius: 6,
                    pointHoverBorderWidth: 3,
                    pointBackgroundColor: this.css('--card-solid'),
                    pointBorderColor: accent,
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
                        ticks: { color: this.css('--tx3'), stepSize: 2, padding: 8 },
                        grid: { color: this.css('--border-lt'), drawBorder: false, borderDash: [5, 5] }
                    },
                    x: {
                        ticks: { color: this.css('--tx3'), maxRotation: 0, autoSkip: true, maxTicksLimit: 8 },
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
                        cornerRadius: 10,
                        padding: 10,
                        displayColors: false,
                        callbacks: {
                            label: (ctx2) => `Score: ${ctx2.parsed.y}/10`
                        }
                    }
                }
            }
        });
    }

    renderElementRadar(usage, total) {
        if (!window.Chart || !this.$.elementRadar) return;
        this.destroyChart('radar');

        const safeTotal = Number(total) > 0 ? Number(total) : 1;
        const keys = ['role', 'format', 'constraints', 'examples', 'context'];
        const labels = ['Role', 'Format', 'Constraints', 'Examples', 'Context'];
        const values = keys.map((key) => {
            const count = Number(usage[key] || 0);
            return Math.max(0, Math.min(100, Math.round((count / safeTotal) * 100)));
        });

        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const ctx = this.$.elementRadar.getContext('2d');

        this.charts.radar = new Chart(ctx, {
            type: 'radar',
            data: {
                labels,
                datasets: [{
                    label: 'Element Coverage',
                    data: values,
                    borderColor: isDark ? '#22d3ee' : '#0ea5a4',
                    backgroundColor: isDark ? 'rgba(34, 211, 238, 0.20)' : 'rgba(14, 165, 164, 0.18)',
                    pointBackgroundColor: isDark ? '#5eead4' : '#0f766e',
                    pointBorderColor: this.css('--card-solid'),
                    pointHoverBackgroundColor: this.css('--card-solid'),
                    pointHoverBorderColor: isDark ? '#22d3ee' : '#0ea5a4',
                    pointRadius: 3,
                    pointHoverRadius: 5,
                    borderWidth: 2.5,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: 800, easing: 'easeOutQuart' },
                scales: {
                    r: {
                        min: 0,
                        max: 100,
                        ticks: {
                            stepSize: 20,
                            display: false,
                            backdropColor: 'transparent'
                        },
                        angleLines: { color: this.css('--border-lt') },
                        grid: { color: this.css('--border-lt'), circular: false },
                        pointLabels: {
                            color: this.css('--tx2'),
                            font: { size: 12, weight: '600' }
                        }
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
                        cornerRadius: 10,
                        padding: 10,
                        callbacks: {
                            label: (ctx2) => `${ctx2.label}: ${ctx2.raw}%`
                        }
                    }
                }
            }
        });

        const weakest = Object.entries(usage).sort((a, b) => a[1] - b[1])[0]?.[0] || 'examples';
        const weakestLabel = weakest.charAt(0).toUpperCase() + weakest.slice(1);

        let ctaEl = document.getElementById('radarCta');
        if (!ctaEl) {
            ctaEl = document.createElement('div');
            ctaEl.id = 'radarCta';
            ctaEl.style.textAlign = 'center';
            ctaEl.style.marginTop = '12px';
            this.$.elementRadar.parentNode.appendChild(ctaEl);
        }
        ctaEl.innerHTML = `
            <p style="font-size:13px; color:#6b7280; margin:8px 0 4px;">Your weakest element is <b>${weakestLabel}</b></p>
            <button onclick="app.practiceElement('${weakest}')" style="font-size:12px; padding:5px 12px; border:1px solid #d1d5db; border-radius:6px; cursor:pointer; background:#f9fafb; color:#374151; font-weight:600;">
                Practice ${weakestLabel} →
            </button>
        `;
    }

    renderDistributionChart({ weak, mid, high, total }) {
        if (!window.Chart || !this.$.barChart) return;
        this.destroyChart('bar');
        const ctx = this.$.barChart.getContext('2d');
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

        const pct = (v) => total > 0 ? Math.round((v / total) * 100) : 0;
        const values = [weak, mid, high];
        const maxVal = Math.max(...values, 1);

        const gWeak = ctx.createLinearGradient(0, 0, 0, 260);
        gWeak.addColorStop(0, isDark ? '#fb7185' : '#ef4444');
        gWeak.addColorStop(1, isDark ? '#f43f5e' : '#dc2626');

        const gMid = ctx.createLinearGradient(0, 0, 0, 260);
        gMid.addColorStop(0, isDark ? '#fbbf24' : '#f59e0b');
        gMid.addColorStop(1, isDark ? '#f59e0b' : '#d97706');

        const gHigh = ctx.createLinearGradient(0, 0, 0, 260);
        gHigh.addColorStop(0, isDark ? '#34d399' : '#10b981');
        gHigh.addColorStop(1, isDark ? '#10b981' : '#059669');

        const distributionFx = {
            id: 'distributionFx',
            afterDatasetsDraw: (chart) => {
                const { ctx: c } = chart;
                const meta = chart.getDatasetMeta(0);
                if (!meta || !meta.data?.length) return;
                c.save();
                c.font = '600 11px Manrope, sans-serif';
                c.textAlign = 'center';
                c.textBaseline = 'bottom';

                const drawBadge = (x, y, text, color) => {
                    const padX = 8;
                    const h = 20;
                    const w = c.measureText(text).width + padX * 2;
                    const r = 8;
                    const bx = x - w / 2;
                    const by = y - h;

                    c.save();
                    c.beginPath();
                    c.moveTo(bx + r, by);
                    c.lineTo(bx + w - r, by);
                    c.quadraticCurveTo(bx + w, by, bx + w, by + r);
                    c.lineTo(bx + w, by + h - r);
                    c.quadraticCurveTo(bx + w, by + h, bx + w - r, by + h);
                    c.lineTo(bx + r, by + h);
                    c.quadraticCurveTo(bx, by + h, bx, by + h - r);
                    c.lineTo(bx, by + r);
                    c.quadraticCurveTo(bx, by, bx + r, by);
                    c.closePath();
                    c.fillStyle = isDark ? 'rgba(8, 23, 32, 0.88)' : 'rgba(255, 255, 255, 0.9)';
                    c.fill();
                    c.strokeStyle = color;
                    c.lineWidth = 1;
                    c.stroke();
                    c.restore();

                    c.fillStyle = this.css('--tx2');
                    c.fillText(text, x, by + h - 6);
                };

                meta.data.forEach((bar, idx) => {
                    const value = values[idx] || 0;
                    const x = bar.x;
                    const y = bar.y;
                    const glow = idx === 2 ? '#34d399' : idx === 1 ? '#fbbf24' : '#fb7185';

                    if (value === maxVal && value > 0) {
                        c.save();
                        c.globalAlpha = isDark ? 0.34 : 0.2;
                        c.fillStyle = glow;
                        c.beginPath();
                        c.ellipse(x, y - 10, 24, 10, 0, 0, Math.PI * 2);
                        c.fill();
                        c.restore();
                    }

                    drawBadge(x, y - 8, `${value} (${pct(value)}%)`, glow);
                });
                c.restore();
            },
            beforeDatasetDraw: (chart, args) => {
                if (args.index !== 0) return;
                const bars = chart.getDatasetMeta(0)?.data || [];
                const c = chart.ctx;
                c.save();
                bars.forEach((bar, idx) => {
                    const color = idx === 2 ? '#34d399' : idx === 1 ? '#fbbf24' : '#fb7185';
                    c.shadowBlur = 18;
                    c.shadowColor = isDark ? color : 'rgba(0,0,0,0)';
                });
                c.restore();
            },
            afterEvent: (chart, args) => {
                const ev = args?.event;
                const active = chart.tooltip?.getActiveElements?.() || [];
                const map = ['weak', 'mid', 'high'];
                const activeBand = active.length ? map[active[0]?.index] : null;
                this.$.distPills?.forEach((pill) => {
                    pill.classList.toggle('active', !!activeBand && pill.dataset.band === activeBand);
                });

                if (ev?.type === 'mouseout' || ev?.type === 'touchend' || ev?.type === 'touchcancel') {
                    this.$.distPills?.forEach((pill) => pill.classList.remove('active'));
                }
            }
        };

        this.charts.bar = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Weak', 'Needs Work', 'High'],
                datasets: [{
                    data: values,
                    backgroundColor: [gWeak, gMid, gHigh],
                    hoverBackgroundColor: [isDark ? '#fb7185' : '#f87171', isDark ? '#fbbf24' : '#f59e0b', isDark ? '#34d399' : '#10b981'],
                    borderColor: [isDark ? '#fb7185' : '#ef4444', isDark ? '#fbbf24' : '#f59e0b', isDark ? '#34d399' : '#10b981'],
                    borderWidth: 1,
                    borderRadius: 14,
                    borderSkipped: false,
                    barThickness: 44,
                    maxBarThickness: 52
                }]
            },
            plugins: [distributionFx],
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: 880, easing: 'easeOutQuart' },
                datasets: {
                    bar: {
                        barPercentage: 0.62,
                        categoryPercentage: 0.58
                    }
                },
                animations: {
                    y: {
                        duration: 900,
                        easing: 'easeOutQuart',
                        delay: (ctx2) => (ctx2.type === 'data' ? ctx2.dataIndex * 160 : 0)
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        suggestedMax: Math.max(3, maxVal + 2),
                        ticks: { color: this.css('--tx3'), precision: 0, padding: 8 },
                        grid: { color: this.css('--border-lt'), drawBorder: false, borderDash: [4, 4] }
                    },
                    x: {
                        ticks: { color: this.css('--tx2'), font: { weight: '700' } },
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
                        cornerRadius: 12,
                        padding: 12,
                        displayColors: false,
                        callbacks: {
                            title: (items) => items?.[0]?.label || 'Distribution',
                            label: (ctx2) => `${ctx2.raw} prompts (${pct(ctx2.raw)}%)`
                        }
                    }
                }
            }
        });
    }

    practiceElement(element) {
        let template = '';
        if (element === 'role') template = 'Explain the water cycle to a 5-year-old. Format as a bulleted list. Keep it under 50 words. E.g. "Input: water cycle -> Output: rain falls."';
        else if (element === 'format') template = 'Act as a science teacher. Explain the water cycle to a 5-year-old. Keep it under 50 words. E.g. "Input: water cycle -> Output: rain falls."';
        else if (element === 'constraints') template = 'Act as a science teacher. Explain the water cycle to a 5-year-old. Format as a bulleted list. E.g. "Input: water cycle -> Output: rain falls."';
        else if (element === 'examples') template = 'Act as a science teacher. Explain the water cycle to a 5-year-old. Format as a bulleted list. Keep it under 50 words.';
        else template = 'Act as a science teacher. Explain the water cycle. Format as a bulleted list. Keep it under 50 words. E.g. "Input: water cycle -> Output: rain falls."';
        
        this.go('craft');
        this.$.input.value = template;
        this.detect();
        this.counts();
        this.updateAnalyzeButtonState();
        this.$.input.focus();
        this.toast(`Practicing: Add a missing ${element}!`, 'ok');
    }

    destroyChart(name) {
        const chart = this.charts[name];
        if (chart) {
            chart.destroy();
            this.charts[name] = null;
        }
    }

    updateTrendExplanation(trend, last5Average, averageScore, weakestElement) {
        const el = document.getElementById('trendExplanation');
        if (!el) return;
        const l5 = last5Average || 0;
        const avg = averageScore || 0;
        const weak = weakestElement || 'examples';
        el.innerHTML = `Your last 5 prompts averaged ${l5}/10 vs your overall ${avg}/10. Most missed element: <b>${weak}</b>`;
        if (trend === 'declining') el.style.color = 'var(--red)';
        else if (trend === 'improving') el.style.color = 'var(--green)';
        else el.style.color = 'var(--tx3)';
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
        const list = document.getElementById('csList');
        if (!list) return;

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

    renderLessonsList() {
        if (!this.$.lessonList) return;
        this.showLessonsList();
        this.$.lessonList.innerHTML = this.lessons.map((l, idx) => {
            const done = !!this.lessonState[l.id];
            return `<button class="lesson-card ${done ? 'done' : ''}" data-id="${l.id}">
                <span class="lesson-icon">${l.icon}</span>
                <span class="lesson-meta"><strong>${this.esc(l.title)}</strong><span>${this.esc(l.summary)}</span></span>
                <span class="lesson-tail">${done ? '✓' : '>'}</span>
            </button>`;
        }).join('');
        this.$.lessonList.querySelectorAll('.lesson-card').forEach(btn => {
            btn.addEventListener('click', () => this.openLesson(btn.dataset.id));
        });
        if (this.$.lessonProgress) {
            const doneCount = Object.values(this.lessonState).filter(Boolean).length;
            this.$.lessonProgress.textContent = `${doneCount}/${this.lessons.length} completed`;
        }

        const allDone = this.lessons.every(l => !!this.lessonState[l.id]);
        if (allDone) {
            let banner = document.getElementById('lessonsBanner');
            if (!banner) {
                banner = document.createElement('div');
                banner.id = 'lessonsBanner';
                this.$.lessonList.parentNode.insertBefore(banner, this.$.lessonList);
            }
            banner.innerHTML = `
                <div style="background:#d1fae5; border:1px solid #6ee7b7; border-radius:8px; padding:12px 16px; margin-bottom:16px; display:flex; align-items:center; justify-content:space-between;">
                    <span style="color:#065f46; font-weight:500;">🎉 All lessons complete! Ready for the real test?</span>
                    <button onclick="app.go('challenges')" style="background:#059669; color:white; border:none; padding:6px 14px; border-radius:6px; cursor:pointer; font-weight:600;">Try Challenges →</button>
                </div>
            `;
            localStorage.setItem('pt_lessonsCompleted', 'true');
        } else {
            const banner = document.getElementById('lessonsBanner');
            if (banner) banner.remove();
        }
    }

    showLessonsList() {
        if (this.$.lessonList) this.$.lessonList.style.display = 'grid';
        if (this.$.lessonDetail) this.$.lessonDetail.style.display = 'none';
    }

    openLesson(id) {
        const lesson = this.lessons.find(l => l.id === id);
        if (!lesson || !this.$.lessonDetail) return;
        this.activeLessonId = lesson.id;
        this.$.lessonTitle.textContent = lesson.title;
        this.$.lessonDesc.textContent = lesson.summary;
        this.$.lessonContent.innerHTML = lesson.content;
        this.$.lessonList.style.display = 'none';
        this.$.lessonDetail.style.display = 'block';
        const done = !!this.lessonState[lesson.id];
        this.$.lessonCompleteBtn.textContent = done ? 'Completed ✓' : 'Mark Complete ✓';
        this.$.lessonCompleteBtn.disabled = done;
    }

    markLessonComplete() {
        if (!this.activeLessonId) return;
        this.lessonState[this.activeLessonId] = true;
        this.saveProgressState('pt_lessons_completed', this.lessonState);
        this.renderLessonsList();
        this.openLesson(this.activeLessonId);
        this.toast('Lesson marked complete', 'ok');
    }

    renderChallengesList(showList = true) {
        if (!this.$.challengeList) return;
        if (showList) this.showChallengesList();
        
        const CHALLENGE_HINTS = {
            'c1': "Specify tone (formal/apologetic), include a role like 'Act as a professional assistant', and state the exact reason for declining.",
            'c2': "Mention the programming language, describe the bug symptom clearly, and ask for both the fix AND an explanation of why it was wrong.",
            'c3': "Specify data type, desired output format (table/chart/bullets), and what decision or action the analysis should support.",
            'c4': "Set the audience age/level explicitly, request an analogy to explain, and limit the explanation to one concept at a time.",
            'c5': "Define genre, exact word count, tone/mood, and at least one specific plot constraint or character requirement."
        };

        this.$.challengeList.innerHTML = this.challenges.map((c, idx) => {
            const done = !!this.challengeState[c.id];
            const hintHtml = !done ? `
                <div style="margin-top: 6px; padding: 0 12px;">
                    <button class="hint-toggle" data-challenge="${c.id}" onclick="event.stopPropagation(); this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'none' ? 'block' : 'none';" style="background:none; border:none; color:var(--accent); font-size:12px; cursor:pointer; padding:4px 0;">Show Hint ▼</button>
                    <div class="hint-text" style="display:none; font-size:12px; color:var(--tx2); padding:8px 12px; background:var(--card-solid); border:1px solid var(--border); border-radius:6px; margin-top:4px;">${this.esc(CHALLENGE_HINTS[c.id])}</div>
                </div>
            ` : '';

            return `<div style="display:flex; flex-direction:column; gap:4px;">
                <button class="challenge-card ${done ? 'done' : ''}" data-id="${c.id}">
                    <span class="challenge-badge">#${idx + 1}</span>
                    <span class="lesson-meta"><strong>${this.esc(c.title)}</strong><span>${this.esc(c.summary)}</span></span>
                    <span class="lesson-tail">${done ? '✓' : '>'}</span>
                </button>${hintHtml}
            </div>`;
        }).join('');
        this.$.challengeList.querySelectorAll('.challenge-card').forEach(btn => {
            btn.addEventListener('click', () => this.openChallenge(btn.dataset.id));
        });
        if (this.$.challengeProgress) {
            const doneCount = Object.values(this.challengeState).filter(Boolean).length;
            this.$.challengeProgress.textContent = `${doneCount}/${this.challenges.length} completed`;
        }
    }

    showChallengesList() {
        if (this.$.challengeList) this.$.challengeList.style.display = 'grid';
        if (this.$.challengeDetail) this.$.challengeDetail.style.display = 'none';
    }

    openChallenge(id) {
        const challenge = this.challenges.find(c => c.id === id);
        if (!challenge || !this.$.challengeDetail) return;
        this.activeChallengeId = challenge.id;
        this.$.challengeTitle.textContent = challenge.title;
        this.$.challengeDesc.textContent = challenge.summary;
        this.$.challengeInput.value = localStorage.getItem(`pt_challenge_draft_${challenge.id}`) || '';
        this.$.challengeResult.textContent = '';
        this.$.challengeResult.className = 'challenge-result';
        this.$.challengeResult.style.display = 'none';
        this.$.challengeFeedback.innerHTML = '';
        this.$.challengeList.style.display = 'none';
        this.$.challengeDetail.style.display = 'block';
    }

    async submitChallenge() {
        const id = this.activeChallengeId;
        const challenge = this.challenges.find(c => c.id === id);
        if (!challenge) return;
        const prompt = this.$.challengeInput.value.trim();
        if (!prompt) {
            this.$.challengeResult.className = 'challenge-result fail';
            this.$.challengeResult.textContent = 'Please enter your prompt first.';
            this.$.challengeResult.style.display = 'block';
            return;
        }
        localStorage.setItem(`pt_challenge_draft_${id}`, prompt);

        this.$.challengeSubmit.disabled = true;
        this.$.challengeSubmit.textContent = 'Analyzing...';
        this.$.challengeResult.className = 'challenge-result';
        this.$.challengeResult.textContent = 'Analyzing your challenge prompt...';
        this.$.challengeResult.style.display = 'block';
        this.$.challengeFeedback.innerHTML = '';
        try {
            const r = await fetch(`${this.API}/analyze`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt, mode: 'quick' })
            });
            const d = await r.json();
            if (!r.ok) throw new Error(d.error || 'Challenge failed');

            const analysis = this.normalizeAnalysis(d.analysis || d, prompt);
            const score = parseFloat(String(analysis.score).split('/')[0]) || 0;
            const passed = score >= challenge.pass;
            const position = this.getScorePosition(score);

            if (passed) {
                this.challengeState[id] = true;
                this.saveProgressState('pt_challenges_completed', this.challengeState);
                this.$.challengeResult.className = 'challenge-result pass';
                this.$.challengeResult.textContent = `Challenge Passed! ✓ Your score: ${score}/10. Position: ${position}.`;
                this.$.challengeFeedback.innerHTML = '';
            } else {
                this.$.challengeResult.className = 'challenge-result fail';
                this.$.challengeResult.textContent = `Score was ${score}/10. Need ${challenge.pass}+ to pass. Position: ${position}. Try again!`;
                const feedback = [...(analysis.missing || []), ...(analysis.tips || []).map(t => t.title)].slice(0, 5);
                this.$.challengeFeedback.innerHTML = feedback.map(f => `<li>${this.esc(typeof f === 'string' ? f : '')}</li>`).join('');
            }
            this.$.challengeResult.style.display = 'block';
            this.renderChallengesList(false);
        } catch (err) {
            this.$.challengeResult.className = 'challenge-result fail';
            this.$.challengeResult.textContent = err.message || 'Challenge submission failed.';
            this.$.challengeResult.style.display = 'block';
        } finally {
            this.$.challengeSubmit.disabled = false;
            this.$.challengeSubmit.textContent = 'Submit Challenge';
        }
    }

    getScorePosition(score) {
        if (score >= 9) return 'Expert Prompt Engineer';
        if (score >= 7) return 'Advanced Prompt Engineer';
        if (score >= 5) return 'Intermediate Prompt Engineer';
        return 'Beginner Prompt Engineer';
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
        this.updateAnalyzeButtonState();
        this.saveDraft();
    }

    loadTestPrompt(type) {
        const weak = 'Explain AI';
        const strong = 'Act as a senior prompt engineer. Improve this request for a class project. Context: beginner students, topic is renewable energy. Constraints: under 120 words, simple English, bullet points only. Output format: 1) final prompt 2) why it is better.';
        this.$.input.value = type === 'strong' ? strong : weak;
        this.detect();
        this.counts();
        this.updateAnalyzeButtonState();
        this.saveDraft();
        this.$.input.focus();
        this.toast(type === 'strong' ? 'Loaded strong test prompt' : 'Loaded weak test prompt', 'ok');
    }

    loadRandomTestPrompt() {
        const roles = ['teacher', 'product manager', 'data analyst', 'career coach', 'startup mentor'];
        const goals = ['summarize a topic', 'create an email', 'build a study plan', 'analyze feedback', 'generate interview questions'];
        const formats = ['bullet points', 'markdown table', 'JSON', 'numbered list'];
        const constraints = ['under 120 words', 'exactly 5 points', 'simple language', 'include one example'];
        const contexts = ['for beginners', 'for class presentation', 'for quick revision', 'for non-technical audience'];

        const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
        const prompt = `Act as a ${pick(roles)}. Goal: ${pick(goals)}. Output format: ${pick(formats)}. Constraints: ${pick(constraints)}. Context: ${pick(contexts)}.`;

        this.$.input.value = prompt;
        this.detect();
        this.counts();
        this.updateAnalyzeButtonState();
        this.saveDraft();
        this.$.input.focus();
        this.toast('Loaded random test prompt', 'ok');
    }

    async runApiHealthCheck() {
        if (!this.$.apiHealthBadge) return;
        this.$.apiHealthBadge.textContent = 'API: Checking...';
        this.$.apiHealthBadge.classList.remove('ok', 'err');
        const started = performance.now();

        try {
            const resp = await fetch(`${this.API}/health`);
            const elapsed = Math.round(performance.now() - started);
            if (!resp.ok) throw new Error('Health endpoint failed');
            const data = await resp.json().catch(() => ({}));
            if (!data.ok) throw new Error('API not ready');
            this.$.apiHealthBadge.textContent = `API: OK (${elapsed}ms)`;
            this.$.apiHealthBadge.classList.add('ok');
            this.toast('API is healthy', 'ok');
        } catch (_) {
            this.$.apiHealthBadge.textContent = 'API: Unavailable';
            this.$.apiHealthBadge.classList.add('err');
            this.toast('API health check failed', 'err');
        }
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

    toast(msg, type='ok') {
        const t = document.createElement('div');
        t.className = `toast ${type}`;
        t.textContent = msg;
        this.$.toastStack.appendChild(t);
        setTimeout(() => t.remove(), 3000);
    }

    /* ===== Chat View ===== */
    async loadChat() {
        if(!this.$.chatList) return;
        try {
            const r = await fetch(`${this.API}/chat`);
            const d = await r.json();
            if (Array.isArray(d)) {
                this.$.chatList.innerHTML = '';
                if(d.length === 0) {
                    this.$.chatList.innerHTML = `<div class="chat-msg msg-ai"><div class="msg-avatar">🤖</div><div class="msg-content">Hey! I am your prompt buddy. Ask me anything about writing better prompts, and I will help improve structure, clarity, and output quality.</div></div>`;
                } else {
                    d.forEach(msg => this.appendChatBubble(msg.role, msg.content));
                    this.scrollChat();
                }
            }
        } catch(e) {}
    }

    async clearChat() {
        try {
            await fetch(`${this.API}/chat`, { method: 'DELETE' });
            this.loadChat();
        } catch(e){}
    }

    appendChatBubble(role, content) {
        const div = document.createElement('div');
        div.className = `chat-msg ${role === 'user' ? 'msg-user' : 'msg-ai'}`;
        div.innerHTML = `<div class="msg-avatar">${role === 'user' ? 'U' : '🤖'}</div><div class="msg-content">${this.esc(content)}</div>`;
        this.$.chatList.appendChild(div);
        this.scrollChat();
        return div;
    }

    scrollChat() {
        if(this.$.chatScroll) {
            this.$.chatScroll.scrollTop = this.$.chatScroll.scrollHeight;
        }
    }

    getChatSystemPrompt() {
        return {
            role: 'system',
            content: 'You are Prompt Tutor Buddy: helpful, friendly, and classmate-like. Keep answers clear and practical for prompt writing. Focus only on prompt engineering help: improving prompts, finding missing elements (role, format, constraints, examples, context), and giving short actionable feedback.'
        };
    }

    async sendChatMessage() {
        const text = this.$.chatInput?.value.trim();
        if(!text) return;
        if (!this.ensureSessionApiKey()) return;

        this.$.chatInput.value = '';
        this.$.chatSendBtn.disabled = true;

        this.appendChatBubble('user', text);

        // Append AI thinking bubble with typing indicator
        const aiBubble = document.createElement('div');
        aiBubble.className = 'chat-msg msg-ai';
        aiBubble.innerHTML = `<div class="msg-avatar">🤖</div><div class="msg-content"><span class="typing-indicator"></span></div>`;
        this.$.chatList.appendChild(aiBubble);
        this.scrollChat();

        const contentDiv = aiBubble.querySelector('.msg-content');

        const msgs = [];
        Array.from(this.$.chatList.querySelectorAll('.chat-msg')).forEach(bubble => {
            const isUser = bubble.classList.contains('msg-user');
            const contentNode = bubble.querySelector('.msg-content');
            if (!contentNode || contentNode.querySelector('.typing-indicator')) return;
            const txt = (contentNode.textContent || '').trim();
            if(txt) msgs.push({ role: isUser ? 'user' : 'assistant', content: txt });
        });

        if (!msgs.length || msgs[msgs.length - 1].role !== 'user') {
            msgs.push({ role: 'user', content: text });
        }

        const payloadMessages = [this.getChatSystemPrompt(), ...msgs];

        try {
            const resp = await fetch(`${this.API}/chat/stream`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: payloadMessages, apiKey: this.sessionApiKey })
            });

            if (!resp.ok) {
                const err = await resp.json().catch(()=>({}));
                throw new Error(err.error || 'Chat error');
            }

            contentDiv.innerHTML = '<span class="typing-indicator"></span>';
            let streamText = '';
            
            const reader = resp.body.getReader();
            const decoder = new TextDecoder();
            
            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                
                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');
                
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const jsonStr = line.substring(6).trim();
                        if (jsonStr === '[DONE]') continue;
                        try {
                            const data = JSON.parse(jsonStr);
                            if (data.error) throw new Error(data.error);
                            if (data.content) {
                                streamText += data.content;
                                contentDiv.textContent = streamText;
                                const indicator = document.createElement('span');
                                indicator.className = 'typing-indicator';
                                contentDiv.appendChild(indicator);
                                this.scrollChat();
                            }
                        } catch(e) {}
                    }
                }
            }
            
            // Finalize
            contentDiv.textContent = streamText;

        } catch (e) {
            contentDiv.textContent = `Error: ${e.message}`;
            contentDiv.style.color = 'var(--red)';
        } finally {
            this.$.chatSendBtn.disabled = false;
        }
    }



    saveDraft() { localStorage.setItem('pt_draft', this.$.input.value); }
    loadDraft() {
        const d = localStorage.getItem('pt_draft');
        if (d) { this.$.input.value = d; this.detect(); this.counts(); this.updateAnalyzeButtonState(); }
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
