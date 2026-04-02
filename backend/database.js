/* ========================================
   Database Layer — JSON File Based
   (Robust for all environments)
   ======================================== */

const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'prompts.json');
const SETTINGS_PATH = path.join(__dirname, 'settings.json');
const CHATS_PATH = path.join(__dirname, 'chats.json');

// Initialize empty files if they don't exist
if (!fs.existsSync(DB_PATH)) fs.writeFileSync(DB_PATH, JSON.stringify([]));
if (!fs.existsSync(SETTINGS_PATH)) fs.writeFileSync(SETTINGS_PATH, JSON.stringify({}));
if (!fs.existsSync(CHATS_PATH)) fs.writeFileSync(CHATS_PATH, JSON.stringify([]));

function readJSON(filePath) {
    try {
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        return [];
    }
}

function writeJSON(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function initDatabase() {
    console.log('✅ JSON Database initialized');
}

function detectPromptElements(text) {
    const t = String(text || '');
    return {
        role: /act as|you are a?|persona|pretend|role|as a|expert|assistant|developer|scientist|writer|teacher|coach/i.test(t),
        format: /\b(json|markdown|table|csv|format|output|structure|code block|email|report|essay|html|xml|numbered list|bullet(?: points?)?|step-by-step)\b|(?:return|respond|output)\s+(?:in|as)\s+(?:a|an)?\s*(?:json|table|list|markdown|csv)/i.test(t),
        constraints: /\b(limit|max|must|exactly|no more|at least|words|under|avoid|don't|do not|never|only|restrict|constraint|edge case(?:s)?|handle edge|including edge)\b/i.test(t),
        examples: /example|sample|for instance|input:|output:|e\.g\.|demonstrate|like this|such as/i.test(t),
        context: /context|background|situation|scenario|given that|assuming|based on|the goal|objective|purpose|audience|for (?:a|an) [\w\s-]+ (?:student|beginner)|target audience/i.test(t)
    };
}

// ===== Prompt Operations =====

function saveAnalysis(promptText, analysis) {
    const prompts = readJSON(DB_PATH);

    // Normalize improved: support both object {default,developer,beginner} and legacy string
    let impDefault = '', impDev = '', impBeg = '';
    if (typeof analysis.improved === 'object' && analysis.improved !== null) {
        impDefault = analysis.improved.default || '';
        impDev = analysis.improved.developer || '';
        impBeg = analysis.improved.beginner || '';
    } else {
        impDefault = analysis.improved || analysis.improved_prompt || '';
        impDev = analysis.improvedDeveloper || impDefault;
        impBeg = analysis.improvedBeginner || impDefault;
    }

    // Normalize tips: support both proTips (new) and tips (old)
    const tips = analysis.proTips || analysis.tips || [];

    const inferredElements = analysis.elements && Object.values(analysis.elements).some(Boolean)
        ? analysis.elements
        : detectPromptElements(promptText);

    const newEntry = {
        id: Date.now(),
        prompt_text: promptText,
        score: analysis.score,
        category: analysis.category || analysis.label || analysis.verdict || '',
        scoreLabel: analysis.scoreLabel || analysis.label || '',
        tone: analysis.tone || '',
        elements: inferredElements,
        strengths: analysis.strengths || [],
        missing: analysis.missing || analysis.weaknesses || [],
        tips: tips,
        improved: impDefault,
        improvedDeveloper: impDev,
        improvedBeginner: impBeg,
        created_at: new Date().toISOString()
    };
    
    prompts.unshift(newEntry);
    writeJSON(DB_PATH, prompts);
    return newEntry.id;
}

function getHistory(limit = 50) {
    return readJSON(DB_PATH).slice(0, limit);
}

function getHistoryById(id) {
    const prompts = readJSON(DB_PATH);
    return prompts.find(p => p.id === id) || null;
}

function deleteHistoryItem(id) {
    let prompts = readJSON(DB_PATH);
    prompts = prompts.filter(p => p.id !== id);
    writeJSON(DB_PATH, prompts);
}

function clearHistory() {
    writeJSON(DB_PATH, []);
}

function importHistory(entries, mode = 'merge') {
    const incoming = Array.isArray(entries) ? entries : [];
    if (!incoming.length) return 0;

    const existing = mode === 'replace' ? [] : readJSON(DB_PATH);
    const seen = new Set(existing.map(p => `${p.prompt_text}::${p.created_at}`));
    let imported = 0;

    incoming.forEach((raw) => {
        if (!raw || typeof raw !== 'object') return;
        const promptText = String(raw.prompt_text || '').trim();
        if (!promptText) return;

        const createdAt = raw.created_at || new Date().toISOString();
        const key = `${promptText}::${createdAt}`;
        if (seen.has(key)) return;

        const cleanScore = parseFloat(String(raw.score).split('/')[0]);
        const score = Number.isFinite(cleanScore) ? Math.max(0, Math.min(10, cleanScore)) : 0;

        const normalizedElements = raw.elements && Object.values(raw.elements).some(Boolean)
            ? raw.elements
            : detectPromptElements(promptText);

        existing.push({
            id: Number(raw.id) || Date.now() + imported,
            prompt_text: promptText,
            score,
            category: raw.category || raw.label || raw.verdict || '',
            scoreLabel: raw.scoreLabel || raw.label || '',
            tone: raw.tone || '',
            elements: normalizedElements,
            strengths: Array.isArray(raw.strengths) ? raw.strengths : [],
            missing: Array.isArray(raw.missing) ? raw.missing : (Array.isArray(raw.weaknesses) ? raw.weaknesses : []),
            tips: Array.isArray(raw.tips) ? raw.tips : (Array.isArray(raw.proTips) ? raw.proTips : []),
            improved: raw.improved || raw.improved_prompt || '',
            improvedDeveloper: raw.improvedDeveloper || raw.improved || raw.improved_prompt || '',
            improvedBeginner: raw.improvedBeginner || raw.improved || raw.improved_prompt || '',
            isSaved: !!raw.isSaved,
            created_at: createdAt
        });

        seen.add(key);
        imported += 1;
    });

    existing.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    writeJSON(DB_PATH, existing);
    return imported;
}

function getStats() {
    const prompts = readJSON(DB_PATH);
    if (prompts.length === 0) return { totalAnalyzed: 0, averageScore: 0, bestScore: 0, trend: 'neutral', scoreHistory: [] };

    // Clean scores from legacy string formats and ensure numeric parsing is safe
    const parsedPrompts = prompts.map(p => ({
        ...p,
        cleanScore: parseFloat(String(p.score).split('/')[0]) || 0,
        cleanDate: p.created_at || new Date().toISOString()
    }));

    const scores = parsedPrompts.map(p => p.cleanScore);
    const total = parsedPrompts.length;
    const avgScore = scores.reduce((a, b) => a + b, 0) / total;
    const bestScore = Math.max(...scores);
    
    // Recent trend
    const recent = parsedPrompts.slice(0, 5).map(p => p.cleanScore);
    const older = parsedPrompts.slice(5, 10).map(p => p.cleanScore);
    
    let trend = 'neutral';
    if (recent.length > 0 && older.length > 0) {
        const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
        const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
        if (recentAvg > olderAvg + 0.5) trend = 'improving';
        else if (recentAvg < olderAvg - 0.5) trend = 'declining';
    }

    // Score history for line chart (chronological, up to last 20)
    const scoreHistory = parsedPrompts.slice(0, 20).reverse().map(p => ({
        score: p.cleanScore,
        date: p.cleanDate,
        label: p.category || p.label || p.verdict || ''
    }));

    // Element Usage for Radar Chart
    const elementUsage = { role: 0, format: 0, constraints: 0, examples: 0, context: 0 };
    parsedPrompts.forEach(p => {
        const el = p.elements && Object.values(p.elements).some(Boolean)
            ? p.elements
            : detectPromptElements(p.prompt_text);
        if (el.role) elementUsage.role++;
        if (el.format) elementUsage.format++;
        if (el.constraints) elementUsage.constraints++;
        if (el.examples) elementUsage.examples++;
        if (el.context) elementUsage.context++;
    });

    return {
        totalAnalyzed: total,
        averageScore: Math.round(avgScore * 10) / 10,
        bestScore: bestScore,
        trend,
        scoreHistory,
        elementUsage
    };
}

function getRecentContext(limit = 5) {
    const prompts = readJSON(DB_PATH).slice(0, limit);
    return prompts.map(p => ({
        prompt: p.prompt_text.substring(0, 100),
        score: p.score,
        verdict: p.verdict,
        weaknesses: p.weaknesses
    }));
}

// ===== Settings =====

function getSetting(key) {
    const settings = readJSON(SETTINGS_PATH);
    return settings[key] || null;
}

function setSetting(key, value) {
    const settings = readJSON(SETTINGS_PATH);
    settings[key] = value;
    writeJSON(SETTINGS_PATH, settings);
}

function findAnalysisByPrompt(promptText) {
    const prompts = readJSON(DB_PATH);
    return prompts.find(p => p.prompt_text === promptText) || null;
}

function toggleSave(id) {
    const prompts = readJSON(DB_PATH);
    const item = prompts.find(p => p.id === id);
    if (item) {
        item.isSaved = !item.isSaved;
        writeJSON(DB_PATH, prompts);
        return item.isSaved;
    }
    return null;
}

// ===== Chat History =====
function getChatHistory() {
    return readJSON(CHATS_PATH);
}

function addChatMessage(role, content) {
    const chats = readJSON(CHATS_PATH);
    chats.push({ role, content, ts: Date.now() });
    writeJSON(CHATS_PATH, chats);
}

function clearChatHistory() {
    writeJSON(CHATS_PATH, []);
}

module.exports = {
    initDatabase,
    saveAnalysis,
    findAnalysisByPrompt,
    getHistory,
    getHistoryById,
    deleteHistoryItem,
    clearHistory,
    getStats,
    getRecentContext,
    getSetting,
    setSetting,
    toggleSave,
    importHistory,
    getChatHistory,
    addChatMessage,
    clearChatHistory
};
