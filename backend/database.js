/* ========================================
   Database Layer — JSON File Based
   (Robust for all environments)
   ======================================== */

const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'prompts.json');
const SETTINGS_PATH = path.join(__dirname, 'settings.json');

// Initialize empty files if they don't exist
if (!fs.existsSync(DB_PATH)) fs.writeFileSync(DB_PATH, JSON.stringify([]));
if (!fs.existsSync(SETTINGS_PATH)) fs.writeFileSync(SETTINGS_PATH, JSON.stringify({}));

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

    const newEntry = {
        id: Date.now(),
        prompt_text: promptText,
        score: analysis.score,
        category: analysis.category || analysis.label || analysis.verdict || '',
        scoreLabel: analysis.scoreLabel || analysis.label || '',
        tone: analysis.tone || '',
        elements: analysis.elements || {},
        strengths: analysis.strengths || [],
        missing: analysis.missing || analysis.weaknesses || [],
        tips: tips,
        improved: impDefault,
        improvedDeveloper: impDev,
        improvedBeginner: impBeg,
        // Legacy compat
        label: analysis.category || analysis.label || analysis.verdict || '',
        verdict: analysis.category || analysis.label || analysis.verdict || '',
        weaknesses: analysis.missing || analysis.weaknesses || [],
        improved_prompt: impDefault,
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

function getStats() {
    const prompts = readJSON(DB_PATH);
    if (prompts.length === 0) return { totalAnalyzed: 0, averageScore: 0, bestScore: 0, trend: 'neutral', scoreHistory: [] };

    // Clean scores from legacy formats like "8/18" and ensure stringified numbers are floats
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

    return {
        totalAnalyzed: total,
        averageScore: Math.round(avgScore * 10) / 10,
        bestScore: bestScore,
        trend,
        scoreHistory
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
    setSetting
};
