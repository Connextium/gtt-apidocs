const fs = require('fs');
const path = require('path');

module.exports = async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  // Parse body
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (e) {
      body = {};
    }
  }

  const query = body?.query;
  if (!query) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Query is required' }));
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: 'AI API Key is not configured. Please set GEMINI_API_KEY in your environment.'
    }));
    return;
  }

  try {
    // 1. Read the OpenAPI schema for context
    const specPath = path.join(process.cwd(), 'openapi/business-client.json');
    let specSummary = '';
    if (fs.existsSync(specPath)) {
      const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
      specSummary = Object.entries(spec.paths || {})
        .map(([apiPath, methods]) => {
          return Object.entries(methods).map(([method, op]) => 
            `- ${method.toUpperCase()} ${apiPath}: ${op.summary || op.description || ''}`
          ).join('\n');
        }).join('\n');
    }

    const systemPrompt = `You are the technical AI assistant for the Global Trade Treasury (GTT) Business Client API.
API Base URL: https://gtt-api.connextium.xyz

Available Endpoints:
${specSummary}

Instructions:
1. Explain the relevant endpoint and workflow clearly and concisely.
2. Provide the exact HTTP method, path, and request header requirements (e.g. Bearer token / API key).
3. Include an executable cURL or JSON request payload example.`;

    // 2. Call AI Provider (Gemini or OpenAI)
    let answer = '';

    if (process.env.GEMINI_API_KEY) {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [{ text: `${systemPrompt}\n\nUser Question: ${query}` }]
              }
            ]
          })
        }
      );

      const data = await response.json();
      if (data.error) {
        throw new Error(data.error.message || 'Gemini API error');
      }
      answer = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No answer generated.';
    } else if (process.env.OPENAI_API_KEY) {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: query }
          ]
        })
      });

      const data = await response.json();
      if (data.error) {
        throw new Error(data.error.message || 'OpenAI API error');
      }
      answer = data.choices?.[0]?.message?.content || 'No answer generated.';
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ answer }));
  } catch (error) {
    console.error('AI Search Error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: error.message || 'Failed to process AI query' }));
  }
};
