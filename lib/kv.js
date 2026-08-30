/* =========================================================================
   Thin persistence + auth layer for the API routes.
   - getState()/saveState() talk to Upstash Redis in production (via the
     Vercel "Upstash for Redis" marketplace integration — env vars
     KV_REST_API_URL / KV_REST_API_TOKEN are injected automatically once
     you add it in the Vercel dashboard).
   - If those env vars are NOT set (e.g. running `npm run dev` locally
     before you've connected a database), this falls back to a JSON file
     on disk (.local-state.json) so you can develop and click through the
     app without any cloud setup. Vercel deployments should always have
     the real env vars, so this fallback never runs in production.
   - resolveRole() is the ENTIRE "auth" system for now: two long random
     tokens (env vars TOKEN_A / TOKEN_B) map to role 'A' / 'B'. It is
     intentionally isolated in one function so swapping in real auth later
     only means rewriting this one function — nothing else in api/ or
     lib/domain.js needs to change.
   ========================================================================= */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { blankState } from './domain.js';

const STATE_KEY = 'together:state';
const HAS_REDIS = !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCAL_FILE = path.join(__dirname, '..', '.local-state.json');

let redis = null;
async function getRedis() {
  if (!redis) {
    const { Redis } = await import('@upstash/redis');
    redis = Redis.fromEnv();
  }
  return redis;
}

function readLocalFile() {
  try { return JSON.parse(fs.readFileSync(LOCAL_FILE, 'utf8')); } catch (e) { return null; }
}
function writeLocalFile(state) {
  fs.writeFileSync(LOCAL_FILE, JSON.stringify(state, null, 2));
}

export async function getState() {
  if (HAS_REDIS) {
    const kv = await getRedis();
    const existing = await kv.get(STATE_KEY);
    if (existing) return existing;
    const fresh = blankState();
    await kv.set(STATE_KEY, fresh);
    return fresh;
  }
  const existing = readLocalFile();
  if (existing) return existing;
  const fresh = blankState();
  writeLocalFile(fresh);
  return fresh;
}

export async function saveState(state) {
  if (HAS_REDIS) {
    await (await getRedis()).set(STATE_KEY, state);
  } else {
    writeLocalFile(state);
  }
}

/** Reads `Authorization: Bearer <token>` and maps it to 'A' | 'B' | null. */
export function resolveRole(req) {
  const header = req.headers['authorization'] || req.headers['Authorization'];
  if (!header || !header.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length).trim();
  if (!token) return null;
  if (process.env.TOKEN_A && token === process.env.TOKEN_A) return 'A';
  if (process.env.TOKEN_B && token === process.env.TOKEN_B) return 'B';
  return null;
}
