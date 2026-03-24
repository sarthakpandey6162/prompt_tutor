const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// In-memory storage (Vercel serverless = ephemeral filesystem)
let promptHistory = [];
let settings = {};

// --- API Key Management ---
app.post('/api/set-api-key', (req, res) => {
    const { apiKey } = req.body;
    if (!apiKey) return res.status(400).json({ error: 'API key is required' });
    settings.groq_api_key = apiKey;
    res.json({ message: 'API key saved successfully' });
});

app.get('/api/check-api-key', (req, res) => {
    // Check environment variable first, then in-memory
    const hasKey = !!(process.env.GROQ_API_KEY || settings.groq_api_key);
    res.json({ hasKey });
});

// Settings compatibility aliases
app.post('/api/settings/apikey', (req, res) => {
    const { apiKey } = req.body;
    if (!apiKey) return res.status(400).json({ error: 'API key is required' });
    settings.groq_api_key = apiKey;
    res.json({ message: 'Saved' });
});

app.get('/api/settings/apikey/status', (req, res) => {
    const configured = !!(process.env.GROQ_API_KEY || settings.groq_api_key);
    res.json({ configured });
});

// --- Prompt Analysis ---
app.post('/api/analyze', async (req, res) => {
    try {
        const { prompt } = req.body;
        if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

        const apiKey = process.env.GROQ_API_KEY || settings.groq_api_key;
        if (!apiKey) return res.status(400).json({ error: 'API key not configured' });

        const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

        const systemPrompt = `You are an expert AI prompt engineer. Analyze the given prompt and provide feedback in the following JSON format ONLY. Do not include markdown formatting or backticks around the JSON. Your evaluation must be strict.
{
    "score": <overall score 1-10>,
    "verdict": "<short verdict like 'Excellent Prompt' or 'Needs Context'>",
    "description": "<1-2 sentence high-level analysis>",
    "evaluation": {
        "context": { "score": <number 1-10>, "note": "<strict 1 sentence note if they provided enough background context>" },
        "role": { "score": <number 1-10>, "note": "<strict 1 sentence note if they defined a specific persona>" },
        "format": { "score": <number 1-10>, "note": "<strict 1 sentence note if they specified exact output structure (JSON, table, etc.)>" },
        "examples": { "score": <number 1-10>, "note": "<strict 1 sentence note if they provided few-shot examples>" },
        "constraints": { "score": <number 1-10>, "note": "<strict 1 sentence note if they set boundaries like word count or tone>" }
    },
    "strengths": ["<strength 1>", "<strength 2>"],
    "weaknesses": ["<missing element 1>", "<missing element 2>"],
    "improved_prompt": "<your improved, professional version of the user's prompt>"
}`;

        const response = await fetch(GROQ_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'llama-3.1-8b-instant',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: `Analyze this prompt strictly:\n\n"${prompt}"` }
                ],
                temperature: 0.4,
                max_tokens: 4000
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error?.message || `API error: ${response.status}`);
        }

        const data = await response.json();
        const content = data.choices[0]?.message?.content;

        if (!content) throw new Error('Empty response from AI');

        // Parse JSON safely
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('Incomplete analysis received from LLM.');

        const analysis = JSON.parse(jsonMatch[0]);

        // Calculate score from evaluation integers if not provided explicitly by LLM
        let totalSubScore = 0;
        let critCount = 5;
        if(analysis.evaluation) {
            totalSubScore += analysis.evaluation.context?.score || 0;
            totalSubScore += analysis.evaluation.role?.score || 0;
            totalSubScore += analysis.evaluation.format?.score || 0;
            totalSubScore += analysis.evaluation.examples?.score || 0;
            totalSubScore += analysis.evaluation.constraints?.score || 0;
        }
        
        let calculatedAverage = Math.round(totalSubScore / critCount);

        // Auto-correct score if it deviates highly from the sub-scores
        if (Math.abs(analysis.score - calculatedAverage) > 2) {
            analysis.score = calculatedAverage;
        }

        // --- SECOND CALL: Execute original prompt ---
        const executionResponse = await fetch(GROQ_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'llama-3.1-8b-instant',
                messages: [
                    { role: 'user', content: prompt }
                ],
                temperature: 0.7,
                max_tokens: 2000
            })
        });

        let promptResult = "No result generated.";
        if (executionResponse.ok) {
            const executionData = await executionResponse.json();
            promptResult = executionData.choices[0]?.message?.content || "Empty response from AI.";
        }

        // Store in memory
        const entry = {
            id: Date.now().toString(),
            prompt_text: prompt.substring(0, 500),
            score: analysis.score || 0,
            verdict: analysis.verdict || 'Analyzed',
            analysis,
            promptResult,
            created_at: new Date().toISOString()
        };
        
        promptHistory.unshift(entry);
        if (promptHistory.length > 50) promptHistory = promptHistory.slice(0, 50);

        res.json({ analysis, promptResult });
    } catch (error) {
        console.error('Analysis error:', error);
        res.status(500).json({ error: error.message });
    }
});

// --- History ---
app.get('/api/history', (req, res) => {
    res.json(promptHistory);
});

app.get('/api/history/:id', (req, res) => {
    const item = promptHistory.find(p => p.id === req.params.id);
    if(item) {
        res.json(item);
    } else {
        res.status(404).json({ error: 'Not found' });
    }
});

app.delete('/api/history/:id', (req, res) => {
    promptHistory = promptHistory.filter(p => p.id !== req.params.id);
    res.json({ message: 'Deleted' });
});

app.delete('/api/history', (req, res) => {
    promptHistory = [];
    res.json({ message: 'History cleared' });
});

// --- Stats ---
app.get('/api/stats', (req, res) => {
    const totalAnalyzed = promptHistory.length;
    const averageScore = totalAnalyzed > 0
        ? promptHistory.reduce((sum, p) => sum + (p.score || 0), 0) / totalAnalyzed
        : 0;
    res.json({ totalAnalyzed, averageScore });
});

// Export for Vercel
module.exports = app;

// Local testing fallback
if (require.main === module) {
    app.listen(3000, () => {
        console.log('API Server running on http://localhost:3000');
    });
}
