# GTT OpenAPI Specification & AI Digestion Architecture

This document details how the **Global Trade Treasury (GTT) Business Client API** OpenAPI specification is fetched, normalized, cached, and digested by the **Ask GTT AI** assistant.

---

## 1. OpenAPI Spec Lifecycle & Normalization

### Upstream Source
- **Live Endpoint**: `https://gtt-api.connextium.xyz/openapi/business-client.json`
- **Cached Local Path**: `openapi/business-client.json`

### Fetch & Normalization (`scripts/fetch-spec.js`)
When running `npm run fetch-spec` or during the automated daily CI/CD workflow:
1. **HTTP Fetch**: Downloads the JSON schema from `SPEC_URL` (configurable via `process.env.OPENAPI_SPEC_URL`).
2. **Schema Validation**: Validates the presence of `openapi: 3.1.0` or `swagger` fields.
3. **Server URL Normalization**: Automatically extracts the API host origin (e.g. `https://gtt-api.connextium.xyz`) from the spec URL and sets it as the primary `servers` entry, preserving local development hosts as fallback options:
   ```json
   "servers": [
     {
       "url": "https://gtt-api.connextium.xyz",
       "description": "Production API Server"
     },
     {
       "url": "http://localhost:4000",
       "description": "Local development server"
     }
   ]
   ```
4. **Formatting**: Pretty-prints and saves to `openapi/business-client.json`.

---

## 2. How Ask GTT AI Digests the API Specification

The **Ask GTT AI** assistant runs as a serverless function in `api/ask-ai.js` (on Vercel or locally via `scripts/dev-server.js`). It digests the OpenAPI contract dynamically per query without needing an external vector database.

### Digestion Pipeline Diagram

```
┌─────────────────────────────────┐
│ openapi/business-client.json    │  (Cached OpenAPI 3.1.0 specification)
└────────────────┬────────────────┘
                 │
                 ▼  1. Read on-demand per request
┌─────────────────────────────────┐
│ Schema Parser (api/ask-ai.js)   │  Extracts HTTP Verbs, Paths, Summaries & Descriptions
└────────────────┬────────────────┘
                 │
                 ▼  2. Synthesizes Compact Endpoint Index
┌──────────────────────────────────────────────────────────────┐
│ Contextual System Prompt:                                    │
│ - Base URL: https://gtt-api.connextium.xyz                   │
│ - Available Endpoints (19 Operations):                       │
│   - POST /business/auth/login: Business client login...      │
│   - POST /business/me/funding-instructions: Create payin...  │
│   - POST /business/api-keys/{id}/rotate: Rotate API key...   │
│ - Developer Question: "How do I create a USDC payin?"        │
└────────────────┬─────────────────────────────────────────────┘
                 │
                 ▼  3. Direct LLM Inference with Fallback
┌─────────────────────────────────┐
│ Google Gemini / OpenAI API      │  Returns accurate, grounded instructions with cURL
└─────────────────────────────────┘
```

---

## 3. Implementation Details in `api/ask-ai.js`

### A. Dynamic Schema Parsing & Summarization
```javascript
// 1. Read the OpenAPI schema from local disk
const specPath = path.join(process.cwd(), 'openapi/business-client.json');
let specSummary = '';

if (fs.existsSync(specPath)) {
  const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
  // Build a lightweight summary of paths and operations to fit in prompt
  specSummary = Object.entries(spec.paths || {})
    .map(([apiPath, methods]) => {
      return Object.entries(methods).map(([method, op]) => 
        `- ${method.toUpperCase()} ${apiPath}: ${op.summary || op.description || ''}`
      ).join('\n');
    }).join('\n');
}
```

### B. Prompt Construction
```javascript
const systemPrompt = `You are the technical AI assistant for the Global Trade Treasury (GTT) Business Client API.
API Base URL: https://gtt-api.connextium.xyz

Available Endpoints:
${specSummary}

Instructions:
1. Explain the relevant endpoint and workflow clearly and concisely.
2. Provide the exact HTTP method, path, and request header requirements (e.g. Bearer token / API key).
3. Include an executable cURL or JSON request payload example.`;
```

### C. Multi-Model Fallback Strategy
To guarantee 100% uptime and avoid model deprecation or versioning errors:
1. Supports `GEMINI_API_KEY` (Google Gemini) and `OPENAI_API_KEY` (OpenAI GPT-4o-mini).
2. For Gemini, it attempts user-specified models (`GEMINI_MODEL`) and automatically falls back to active stable models (`gemini-1.5-flash`, `gemini-2.0-flash`, `gemini-2.5-flash`):
   ```javascript
   const preferredModel = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
   const modelsToTry = [preferredModel, 'gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-2.5-flash'];
   ```

---

## 4. Why This In-Memory Digestion Architecture is Optimal

1. **Zero Vector Database Overhead**: 
   Because the OpenAPI spec is under 100KB, the entire catalog fits directly within modern LLM context windows (1M+ tokens in Gemini, 128k in GPT-4o).
2. **Instant Synchronization**: 
   When a new endpoint is added to the backend API and synced via `npm run fetch-spec`, the AI assistant immediately recognizes it with zero embedding or indexing re-runs.
3. **No Hallucinations on Endpoint Paths**: 
   By grounding the LLM with the exact HTTP methods and paths from `openapi/business-client.json`, responses consistently reference verified routes.

---

## 5. Frontend Split-View Architecture

The user interface uses a **parallel side-by-side flex layout** (`.app-body-wrapper`):
- **Left Pane (`.viewports-wrapper`)**: Dual documentation engine with instant switching between **Modern (Scalar)** and **Classic (Redoc)**.
- **Right Pane (`.ai-side-panel`)**: Interactive AI chat assistant (`440px` wide) that expands without overlaying or dimming the documentation.
- **Header Synchronization**: Light/Dark theme toggle applies simultaneously across the top header, Redoc/Scalar documentation, and the Ask GTT AI panel.

---

## 6. Commands & Verification

| Task | Command |
| :--- | :--- |
| **Sync Latest Spec from Upstream** | `npm run fetch-spec` |
| **Build Standalone Static Bundle** | `npm run build` |
| **Run Local Server with AI API Support** | `npm run dev` |
| **Preview Built Static HTML** | `npm run preview` |
