#!/usr/bin/env node

/**
 * Lightweight local development and preview server (Zero-dependency)
 * Usage:
 *   node scripts/dev-server.js         -> Serves live workspace root
 *   node scripts/dev-server.js --dist  -> Previews static build in dist/
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const isDist = process.argv.includes('--dist');
const PORT = parseInt(process.env.PORT, 10) || 3000;
const ROOT_DIR = isDist 
  ? path.resolve(__dirname, '../dist')
  : path.resolve(__dirname, '..');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// Load .env.local or .env for local serverless function simulation
function loadEnv() {
  const envFiles = ['.env.local', '.env'];
  for (const file of envFiles) {
    const envPath = path.resolve(__dirname, '..', file);
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      content.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
          const idx = trimmed.indexOf('=');
          const key = trimmed.slice(0, idx).trim();
          const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      });
    }
  }
}
loadEnv();

const server = http.createServer((req, res) => {
  // Normalize request path
  let reqPath = req.url.split('?')[0];

  // Route /api/ask-ai locally
  if (reqPath === '/api/ask-ai') {
    let bodyData = '';
    req.on('data', chunk => { bodyData += chunk; });
    req.on('end', () => {
      try {
        req.body = bodyData ? JSON.parse(bodyData) : {};
      } catch (e) {
        req.body = {};
      }
      try {
        const handler = require('../api/ask-ai');
        handler(req, res);
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  if (reqPath === '/' || reqPath === '') {
    reqPath = '/index.html';
  }

  const filePath = path.join(ROOT_DIR, reqPath);

  // Security check: prevent directory traversal
  if (!filePath.startsWith(ROOT_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end(`404 Not Found: ${reqPath}`);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache'
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

server.listen(PORT, () => {
  const mode = isDist ? 'Static Preview (dist/)' : 'Live Development';
  console.log(`\n\x1b[32m🚀 GTT API Docs Server Running!\x1b[0m`);
  console.log(`  - Mode:    \x1b[1m${mode}\x1b[0m`);
  console.log(`  - Local:   \x1b[36mhttp://localhost:${PORT}\x1b[0m`);
  console.log(`  - Root:    \x1b[34m${ROOT_DIR}\x1b[0m`);
  console.log(`\nPress Ctrl+C to stop.\n`);
});
