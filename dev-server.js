/* =========================================================================
   Minimal local dev server — mimics just enough of Vercel's runtime
   (static file serving + /api/*.js as request handlers) so you can run
   `npm run dev` and click through the whole app before deploying anything.
   Not used in production — Vercel serves api/*.js and static files itself.
   ========================================================================= */
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

// Convenience defaults so `npm run dev` works with zero setup.
// Deploying to Vercel MUST set real values for these — see README.md.
if (!process.env.TOKEN_A) process.env.TOKEN_A = 'dev-token-a';
if (!process.env.TOKEN_B) process.env.TOKEN_B = 'dev-token-b';

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };

async function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => (data += chunk));
    req.on('end', () => {
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

function makeRes(res) {
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (obj) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(obj)); };
  return res;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === '/api/state' || url.pathname === '/api/action') {
    try {
      req.body = req.method === 'POST' ? await readBody(req) : {};
    } catch (e) {
      res.statusCode = 400; res.end('Invalid JSON body'); return;
    }
    const mod = url.pathname === '/api/state' ? await import('./api/state.js') : await import('./api/action.js');
    await mod.default(req, makeRes(res));
    return;
  }

  let filePath = path.join(__dirname, url.pathname === '/' ? 'index.html' : url.pathname);
  fs.readFile(filePath, (err, content) => {
    if (err) { res.statusCode = 404; res.end('Not found'); return; }
    const ext = path.extname(filePath);
    res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
    res.end(content);
  });
});

server.listen(PORT, () => {
  console.log(`Together (local dev) running at http://localhost:${PORT}`);
  console.log(`Ezgi link:  http://localhost:${PORT}/?u=${process.env.TOKEN_A}`);
  console.log(`Aslı link:  http://localhost:${PORT}/?u=${process.env.TOKEN_B}`);
});
