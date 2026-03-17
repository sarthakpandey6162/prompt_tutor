/* ========================================
   AI Prompt Tutor — App Logic
   ======================================== */

// --- DOM Elements ---
// Navigation
const navItems = document.querySelectorAll('.nav-item');
const views = document.querySelectorAll('.view');
const navHistoryBtn = document.getElementById('navHistoryBtn');
const historyBadge = document.getElementById('historyBadge');

// Workspace
const promptInput = document.getElementById('promptInput');
const charCount = document.getElementById('charCount');
const clearBtn = document.getElementById('clearBtn');
const analyzeBtn = document.getElementById('analyzeBtn');
const analyzeBtnText = document.getElementById('analyzeBtnText');

// Prompt Builder
const roleSelect = document.getElementById('roleSelect');
const toneSelect = document.getElementById('toneSelect');
const formatSelect = document.getElementById('formatSelect');

// Results
const resultsEmpty = document.getElementById('resultsEmpty');
const resultsSection = document.getElementById('resultsSection');
const scoreRingFill = document.getElementById('scoreRingFill');
const scoreNumber = document.getElementById('scoreNumber');
const scoreVerdict = document.getElementById('scoreVerdict');
const scoreDesc = document.getElementById('scoreDesc');
const strengthsList = document.getElementById('strengthsList');
const weaknessesList = document.getElementById('weaknessesList');
const improvedPrompt = document.getElementById('improvedPrompt');
const tipsList = document.getElementById('tipsList');
const copyBtn = document.getElementById('copyBtn');
const copyBtnText = document.getElementById('copyBtnText');

// History & Stats
const historyList = document.getElementById('historyList');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');
const statTotal = document.getElementById('statTotal');
const statAvg = document.getElementById('statAvg');

// Modals
const apiModal = document.getElementById('apiModal');
const apiKeyToggle = document.getElementById('apiKeyToggle');
const closeApiModal = document.getElementById('closeApiModal');
const saveApiKeyBtn = document.getElementById('saveApiKeyBtn');
const apiKeyInput = document.getElementById('apiKeyInput');
const apiKeyStatus = document.getElementById('apiKeyStatus');
const apiStatusDot = document.getElementById('apiStatusDot');

// Error Toast
const errorSection = document.getElementById('errorSection');
const errorTitle = document.getElementById('errorTitle');
const errorMessage = document.getElementById('errorMessage');

// --- State ---
const API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:3000/api' : '/api';
let builtContext = { role: '', tone: '', format: '' };

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    checkApiKeyStatus();
    loadStats();
    initTemplates();
    
    // Auto-focus input on load
    setTimeout(() => {
        if(document.getElementById('view-workspace').classList.contains('active')) {
            promptInput.focus();
        }
    }, 500);
});

// --- Prompt Template Logic ---
function initTemplates() {
    document.querySelectorAll('.template-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const promptText = chip.getAttribute('data-prompt');
            if (promptText) {
                promptInput.value = promptText;
                updateCharCount();
                promptInput.focus();
            }
        });
    });
}

// --- Navigation Logic ---
navItems.forEach(item => {
    item.addEventListener('click', () => {
        const targetView = item.getAttribute('data-view');
        
        // Update active nav
        navItems.forEach(n => n.classList.remove('active'));
        item.classList.add('active');
        
        // Update view
        views.forEach(v => {
            v.classList.remove('active');
            if (v.id === `view-${targetView}`) {
                v.classList.add('active');
            }
        });

        // Specific view logic
        if (targetView === 'history') {
            loadHistory();
        }
    });
});

// --- API Key Modal Logic ---
apiKeyToggle.addEventListener('click', () => {
    apiModal.classList.add('open');
});
closeApiModal.addEventListener('click', () => {
    apiModal.classList.remove('open');
});
apiModal.querySelector('.modal-backdrop').addEventListener('click', () => {
    apiModal.classList.remove('open');
});

async function checkApiKeyStatus() {
    try {
        const res = await fetch(`${API_BASE}/settings/apikey/status`);
        const data = await res.json();
        if (data.configured) {
            apiStatusDot.classList.add('connected');
        } else {
            apiStatusDot.classList.remove('connected');
            // If completely unconfigured, suggest opening modal
            setTimeout(() => { apiModal.classList.add('open'); }, 1000);
        }
    } catch (error) {
        console.error('Failed to check API key status:', error);
    }
}

saveApiKeyBtn.addEventListener('click', async () => {
    const key = apiKeyInput.value.trim();
    if (!key) return;

    saveApiKeyBtn.classList.add('loading');
    apiKeyStatus.textContent = '';
    apiKeyStatus.className = 'status-msg';

    try {
        const res = await fetch(`${API_BASE}/settings/apikey`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ apiKey: key })
        });
        
        if (res.ok) {
            apiKeyStatus.textContent = 'API Key saved securely to server.';
            apiKeyStatus.classList.add('success');
            apiKeyInput.value = '';
            checkApiKeyStatus();
            setTimeout(() => {
                apiModal.classList.remove('open');
                apiKeyStatus.textContent = '';
            }, 1500);
        } else {
            throw new Error('Failed to save key');
        }
    } catch (e) {
        apiKeyStatus.textContent = 'Failed to save API Key.';
        apiKeyStatus.classList.add('error');
    } finally {
        saveApiKeyBtn.classList.remove('loading');
    }
});

// --- Prompt Builder Logic ---
function updateInputFromBuilder() {
    // We append the context to the manual input
    const role = roleSelect.value;
    const tone = toneSelect.value;
    const format = formatSelect.value;
    
    // Instead of forcing it into the textarea, we treat builder separate visually
    // but we need to ensure the user knows it's active. 
    // Actually, letting them write in text area and prepending context in API is cleaner,
    // but user wants to "build" a prompt. Let's prepend it into the textarea if empty,
    // or just let the API handle the combo. 
    // For maximum UX: let's inject it directly into textarea when changed.
}

[roleSelect, toneSelect, formatSelect].forEach(select => {
    select.addEventListener('change', () => {
        let lines = [];
        if(roleSelect.value) lines.push(roleSelect.value);
        if(toneSelect.value) lines.push(toneSelect.value);
        if(formatSelect.value) lines.push(formatSelect.value);
        
        const manualText = promptInput.value.replace(/Act as [^\n]+\n|Keep the tone [^\n]+\n|Format the output [^\n]+\n/g, '').trim();
        
        promptInput.value = lines.length ? lines.join('\n') + '\n\n' + manualText : manualText;
        updateCharCount();
    });
});

// --- Workspace Logic ---
promptInput.addEventListener('input', updateCharCount);

function updateCharCount() {
    const text = promptInput.value.trim();
    const chars = text.length;
    const words = text ? text.split(/\s+/).length : 0;
    charCount.textContent = `${chars} chars · ${words} words`;
    analyzeBtn.disabled = chars === 0;
}

clearBtn.addEventListener('click', () => {
    promptInput.value = '';
    roleSelect.value = '';
    toneSelect.value = '';
    formatSelect.value = '';
    updateCharCount();
    promptInput.focus();
    resultsSection.style.display = 'none';
    resultsEmpty.style.display = 'flex';
});

// --- Analysis Logic ---
analyzeBtn.addEventListener('click', async () => {
    const text = promptInput.value.trim();
    if (!text) return;

    analyzeBtn.classList.add('loading');
    analyzeBtn.disabled = true;
    errorSection.style.display = 'none';
    
    // Hide empty state, show results container (it will populate)
    resultsEmpty.style.display = 'none';

    try {
        const res = await fetch(`${API_BASE}/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: text })
        });
        
        const data = await res.json();
        
        if (!res.ok) {
            throw new Error(data.error || 'Failed to analyze prompt');
        }

        renderAnalysis(data.analysis);
        resultsSection.style.display = 'flex';
        
        // Scroll to results seamlessly on mobile
        if(window.innerWidth <= 1024) {
            resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }

        loadStats();
        updateHistoryBadge();

    } catch (e) {
        errorTitle.textContent = e.message.includes('429') || e.message.includes('API key not valid') ? 'API Error' : 'Analysis Failed';
        errorMessage.textContent = e.message;
        errorSection.style.display = 'flex';
        resultsEmpty.style.display = 'flex';
        resultsSection.style.display = 'none';
    } finally {
        analyzeBtn.classList.remove('loading');
        analyzeBtn.disabled = false;
    }
});

function renderAnalysis(data) {
    if (!data) return;

    const score = data.score || 0;
    const verdict = data.verdict || 'Analyzed';
    const description = data.description || 'No description provided.';
    const strengths = data.strengths || [];
    const weaknesses = data.weaknesses || [];
    const improved_prompt = data.improved_prompt || 'No improved prompt generated.';
    const tips = data.tips || [];

    // Reset ring animation
    scoreRingFill.style.transition = 'none';
    scoreRingFill.style.strokeDashoffset = '377';
    
    // Trigger reflow
    void scoreRingFill.offsetWidth;
    
    // Animate to new score
    const offset = 377 - (377 * (score / 10));
    scoreRingFill.style.transition = 'stroke-dashoffset 1.5s cubic-bezier(0.34, 1.56, 0.64, 1)';
    scoreRingFill.style.strokeDashoffset = offset;

    // Number animation
    animateValue(scoreNumber, parseInt(scoreNumber.innerText) || 0, score, 1000);

    scoreVerdict.textContent = verdict;
    scoreDesc.textContent = description;

    // Strengths
    strengthsList.innerHTML = strengths.length 
        ? strengths.map(s => `<li>${s}</li>`).join('')
        : '<li>No major strengths identified.</li>';

    // Weaknesses
    weaknessesList.innerHTML = weaknesses.length 
        ? weaknesses.map(w => `<li>${w}</li>`).join('')
        : '<li>No major weaknesses identified!</li>';

    // Improved Prompt
    improvedPrompt.textContent = improved_prompt;

    // Tips
    tipsList.innerHTML = tips.length
        ? tips.map(t => typeof t === 'string' ? `<div class="tip-card"><p>${t}</p></div>` : `<div class="tip-card"><strong>${t.title || 'Pro Tip'}</strong><p>${t.description || t}</p></div>`).join('')
        : '<p>You are a prompt master.</p>';
}

function animateValue(obj, start, end, duration) {
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        obj.innerHTML = Math.floor(progress * (end - start) + start);
        if (progress < 1) window.requestAnimationFrame(step);
    };
    window.requestAnimationFrame(step);
}

// Copy Button
window.copyImprovedPrompt = function() {
    navigator.clipboard.writeText(improvedPrompt.textContent).then(() => {
        copyBtnText.textContent = 'Copied!';
        copyBtn.classList.add('btn-primary');
        copyBtn.classList.remove('btn-outline');
        setTimeout(() => {
            copyBtnText.textContent = 'Copy';
            copyBtn.classList.remove('btn-primary');
            copyBtn.classList.add('btn-outline');
        }, 2000);
    });
};

// Use Optimized Prompt button
window.useOptimizedPrompt = function() {
    const optimized = improvedPrompt.textContent;
    if (optimized) {
        promptInput.value = optimized;
        updateCharCount();
        // Scroll left panel into view on mobile
        if(window.innerWidth <= 1024) {
            document.querySelector('.editor-col').scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        promptInput.focus();
    }
};

// --- Stats Logic ---
async function loadStats() {
    try {
        const res = await fetch(`${API_BASE}/stats`);
        if(res.ok) {
            const stats = await res.json();
            statTotal.textContent = stats.totalAnalyzed;
            statAvg.textContent = stats.averageScore.toFixed(1);
            
            // Initial history badge update
            if(historyBadge.textContent === '0') {
               updateHistoryBadge();
            }
        }
    } catch (e) {
        console.error('Failed to load stats', e);
    }
}

// --- History Logic ---
async function updateHistoryBadge() {
    try {
        const res = await fetch(`${API_BASE}/history`);
        if(res.ok) {
            const items = await res.json();
            if(items.length > 0) {
                historyBadge.textContent = items.length;
                historyBadge.style.display = 'inline-block';
            } else {
                historyBadge.style.display = 'none';
            }
        }
    } catch(e) {}
}

async function loadHistory() {
    try {
        const res = await fetch(`${API_BASE}/history`);
        const items = await res.json();
        
        if (items.length === 0) {
            historyList.innerHTML = '<div class="empty-state">No history yet. Start analyzing prompts!</div>';
            return;
        }

        historyList.innerHTML = items.map(item => {
            let scoreClass = 'low';
            if (item.score >= 5) scoreClass = 'mid';
            if (item.score >= 7) scoreClass = 'good';
            if (item.score >= 9) scoreClass = 'great';

            const date = new Date(item.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit' });

            return `
                <div class="glass-panel history-item fade-up" onclick="viewHistoryItem(${item.id})">
                    <div class="hist-head">
                        <div class="hist-score ${scoreClass}">${item.score}</div>
                        <button class="hist-del" onclick="event.stopPropagation(); deleteHistoryItem(${item.id})" title="Delete">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        </button>
                    </div>
                    <div class="hist-text">${item.prompt_text}</div>
                    <div class="hist-date">${date}</div>
                </div>
            `;
        }).join('');
    } catch (error) {
        historyList.innerHTML = '<div class="empty-state" style="color:var(--danger)">Failed to load history.</div>';
    }
}

window.viewHistoryItem = async function(id) {
    try {
        const res = await fetch(`${API_BASE}/history/${id}`);
        if(res.ok) {
            const data = await res.json();
            // Switch back to workspace view
            document.querySelector('[data-view="workspace"]').click();
            
            // Populate
            promptInput.value = data.prompt_text;
            updateCharCount();
            renderAnalysis(data);
            resultsEmpty.style.display = 'none';
            resultsSection.style.display = 'flex';
        }
    } catch(e) {
        console.error(e);
    }
}

window.deleteHistoryItem = async function(id) {
    try {
        await fetch(`${API_BASE}/history/${id}`, { method: 'DELETE' });
        loadHistory();
        loadStats();
        updateHistoryBadge();
    } catch (e) {
        console.error(e);
    }
}

clearHistoryBtn.addEventListener('click', async () => {
    if(confirm('Are you sure you want to clear all history?')) {
        try {
            await fetch(`${API_BASE}/history`, { method: 'DELETE' });
            loadHistory();
            loadStats();
            updateHistoryBadge();
        } catch(e) {
            console.error(e);
        }
    }
});
