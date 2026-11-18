import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import {
  ParseBdrisRequestBody,
  parseBdrisDocumentsWithGemini,
} from './lib/parseBdrisGemini.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';
const SYNC_STORE_PATH = path.resolve(__dirname, '.bdris-sync-store.json');

interface SyncItem {
  id: string;
  pushedAt: string;
  bdrisTrackingId?: string;
  status?: string;
  data: Record<string, unknown>;
  documents?: Record<string, unknown> | null;
}

interface SyncChannel {
  active: SyncItem | null;
  queue: SyncItem[];
  updatedAt: string;
}

const syncChannels = new Map<string, SyncChannel>();

function loadSyncStore() {
  try {
    if (fs.existsSync(SYNC_STORE_PATH)) {
      const raw = fs.readFileSync(SYNC_STORE_PATH, 'utf-8');
      const parsed = JSON.parse(raw) as Record<string, SyncChannel>;
      Object.entries(parsed).forEach(([k, v]) => {
        syncChannels.set(k, v);
      });
    }
  } catch (err) {
    console.warn('Could not load sync store cache:', err);
  }
}

function persistSyncStore() {
  try {
    const obj: Record<string, SyncChannel> = {};
    syncChannels.forEach((v, k) => {
      obj[k] = v;
    });
    fs.writeFileSync(SYNC_STORE_PATH, JSON.stringify(obj, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Could not persist sync store cache:', err);
  }
}

loadSyncStore();

function isValidSyncKey(key: string): boolean {
  return /^[a-zA-Z0-9_-]{12,64}$/.test(key);
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '12mb' }));

  // Allow CORS (with credentials) for Chrome Extension fetching from /api/sync/*
  app.use('/api/sync', (req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Vary', 'Origin');
    } else {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    return next();
  });

  app.post('/api/sync/push', (req, res) => {
    const { syncKey, application } = req.body as {
      syncKey?: string;
      application?: SyncItem;
    };

    if (!syncKey || !isValidSyncKey(syncKey)) {
      return res.status(400).json({ error: 'Invalid syncKey' });
    }
    if (!application || !application.data) {
      return res.status(400).json({ error: 'Missing application payload' });
    }

    const now = new Date().toISOString();
    const item: SyncItem = {
      id: application.id || `app_${Date.now()}`,
      pushedAt: now,
      bdrisTrackingId: application.bdrisTrackingId || '',
      status: application.status || 'pushed',
      data: application.data,
      documents: application.documents ?? null,
    };

    const existing = syncChannels.get(syncKey);
    const prevQueue = existing?.queue ?? [];
    const nextQueue = [item, ...prevQueue.filter((q) => q.id !== item.id)].slice(0, 15);

    syncChannels.set(syncKey, {
      active: item,
      queue: nextQueue,
      updatedAt: now,
    });
    persistSyncStore();

    return res.json({
      ok: true,
      updatedAt: now,
      queueSize: nextQueue.length,
    });
  });

  app.get('/api/sync/:syncKey', (req, res) => {
    const { syncKey } = req.params;
    if (!syncKey || !isValidSyncKey(syncKey)) {
      return res.status(400).json({ error: 'Invalid syncKey' });
    }
    const channel = syncChannels.get(syncKey) ?? {
      active: null,
      queue: [],
      updatedAt: null,
    };
    return res.json(channel);
  });

  app.delete('/api/sync/:syncKey', (req, res) => {
    const { syncKey } = req.params;
    if (!syncKey || !isValidSyncKey(syncKey)) {
      return res.status(400).json({ error: 'Invalid syncKey' });
    }
    syncChannels.delete(syncKey);
    persistSyncStore();
    return res.json({ ok: true });
  });

  app.post('/api/parse-bdris', async (req, res) => {
    const result = await parseBdrisDocumentsWithGemini(
      req.body as ParseBdrisRequestBody,
      process.env.GEMINI_API_KEY
    );
    if (result.error || !result.data) {
      return res.status(result.status).json({ error: result.error || 'তথ্য বিশ্লেষণে সমস্যা হয়েছে।' });
    }
    return res.json({ data: result.data });
  });

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`BDRIS SmartForm server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
