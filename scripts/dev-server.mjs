import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const root = process.env.STATIC_ROOT ? path.resolve(projectRoot, process.env.STATIC_ROOT) : projectRoot;
const port = Number(process.env.PORT || process.argv[2] || 8888);

async function loadDotEnv() {
  const file = path.join(projectRoot, '.env');
  if (!existsSync(file)) return;
  const raw = await readFile(file, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const eq = trimmed.indexOf('=');
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '');
    if (key && process.env[key] == null) process.env[key] = value;
  }
}

const mime = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.gif', 'image/gif'],
  ['.svg', 'image/svg+xml; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.mp3', 'audio/mpeg'],
  ['.wav', 'audio/wav'],
]);

function sendJson(res, data, status = 200) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(data));
}

function isInside(base, target) {
  const relative = path.relative(base, target);
  return relative && !relative.startsWith('..') && !path.isAbsolute(relative);
}

await loadDotEnv();

createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || `localhost:${port}`}`);

    if (url.pathname === '/api/auth-config') {
      const supabaseUrl = String(process.env.SUPABASE_URL || '').replace(/\/+$/, '');
      const anonKey = String(process.env.SUPABASE_ANON_KEY || '');
      return sendJson(res, {
        enabled: !!(supabaseUrl && anonKey),
        url: supabaseUrl,
        anonKey,
      });
    }

    if (url.pathname === '/api/client-events') {
      return sendJson(res, { ok: true, accepted: true, local: true }, 202);
    }

    if (url.pathname === '/api/run-session') {
      if (req.method !== 'POST') return sendJson(res, { error: 'Method not allowed' }, 405);
      const now = Date.now();
      return sendJson(res, {
        ok: true,
        token: 'local-development-session',
        issued_at: now,
        expires_at: now + 60 * 60 * 1000,
        local: true,
      });
    }

    if (url.pathname === '/api/leaderboard') {
      if (req.method !== 'GET') return sendJson(res, { error: 'Local dev server is read-only for leaderboard.' }, 501);
      const version = JSON.parse(await readFile(path.join(root, 'version.json'), 'utf8')).version;
      return sendJson(res, { rows: [], required_build: version, auth_enabled: !!process.env.SUPABASE_URL, postgres_enabled: false, storage: 'local-read-only' });
    }

    if (url.pathname === '/api/player-progress') {
      return sendJson(res, { error: 'Local dev server does not sync player progress. Use Netlify for full online sync.' }, 501);
    }

    if (url.pathname === '/api/mailbox') {
      if (req.method !== 'GET') return sendJson(res, { error: 'Local mailbox admin writes require Netlify.' }, 501);
      return sendJson(res, { ok: true, messages: [], storage: 'local-fallback', local_fallback: true });
    }

    const decoded = decodeURIComponent(url.pathname);
    const requestPath = decoded === '/' ? '/index.html' : decoded;
    const filePath = path.normalize(path.join(root, requestPath));
    if (filePath !== path.join(root, 'index.html') && !isInside(root, filePath)) {
      return sendJson(res, { error: 'Not found' }, 404);
    }

    const body = await readFile(filePath);
    res.writeHead(200, {
      'Content-Type': mime.get(path.extname(filePath).toLowerCase()) || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(body);
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end((err && err.message) || 'Server error');
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`Shadow Covenant dev server: http://127.0.0.1:${port}/`);
  console.log(`Auth config: http://127.0.0.1:${port}/api/auth-config`);
});
