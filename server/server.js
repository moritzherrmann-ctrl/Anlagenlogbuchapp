#!/usr/bin/env node
/*
 * Anlagenbuch-Server: liefert die App aus, verwaltet Benutzer und speichert alle Daten zentral.
 * Keine externen Abhängigkeiten – nur Node.js (ab Version 18).
 *
 * Umgebungsvariablen:
 *   PORT             Port (Standard 8080)
 *   DATA_DIR         Datenverzeichnis (Standard ./data neben dieser Datei)
 *   ALLOWED_ORIGINS  Kommagetrennte Liste erlaubter fremder Origins (CORS), z. B. https://….github.io
 *   ADMIN_USER / ADMIN_PASSWORD / ADMIN_NAME   Legt beim ersten Start einen Administrator an (optional)
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.PORT) || 8080;
const APP_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, 'data'));
const DB_FILE = path.join(DATA_DIR, 'db.json');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const PHOTO_DIR = path.join(DATA_DIR, 'photos');
const MAX_PHOTO = 8 * 1024 * 1024;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
const COLLECTIONS = ['customers', 'locations', 'systems', 'entries', 'settings'];
const SESSION_DAYS = 90;
const VALID_ID = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,79}$/;
const MAX_BODY = 25 * 1024 * 1024;
// Nur diese Dateien/Ordner der App werden ausgeliefert
const PUBLIC = ['index.html', 'styles.css', 'manifest.webmanifest', 'sw.js', 'js/', 'vendor/', 'icons/'];

// ---------- Datenbank (JSON-Datei, atomar geschrieben, tägliche Sicherung) ----------
let db = { seq: 0, users: [], sessions: {}, records: {} };

function loadDb() {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  fs.mkdirSync(PHOTO_DIR, { recursive: true });
  if (fs.existsSync(DB_FILE)) db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  for (const c of COLLECTIONS) db.records[c] = db.records[c] || {};
  db.users = db.users || [];
  db.sessions = db.sessions || {};
  db.seq = db.seq || 0;
}

let saveTimer = null;
function saveDb() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(writeDb, 150);
}
function writeDb() {
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db));
  fs.renameSync(tmp, DB_FILE);
  backupDaily();
}
function backupDaily() {
  const day = new Date().toISOString().slice(0, 10);
  const file = path.join(BACKUP_DIR, `db-${day}.json`);
  if (fs.existsSync(file)) return;
  fs.copyFileSync(DB_FILE, file);
  const old = fs.readdirSync(BACKUP_DIR).filter((f) => /^db-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort().slice(0, -60);
  for (const f of old) fs.unlinkSync(path.join(BACKUP_DIR, f)); // 60 Tagessicherungen behalten
}

// ---------- Benutzer & Anmeldung ----------
function hashPassword(pw, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(String(pw), salt, 64).toString('hex');
  return `${salt}:${hash}`;
}
function checkPassword(pw, stored) {
  const [salt, hash] = String(stored || '').split(':');
  if (!salt || !hash) return false;
  const test = crypto.scryptSync(String(pw), salt, 64);
  return crypto.timingSafeEqual(test, Buffer.from(hash, 'hex'));
}
const publicUser = (u) => ({ id: u.id, username: u.username, name: u.name, role: u.role, zertNr: u.zertNr || '', active: u.active !== false });
const normUser = (s) => String(s || '').trim().toLowerCase();

function createUser({ username, password, name, role = 'techniker', zertNr = '' }) {
  username = normUser(username);
  if (!/^[a-z0-9._-]{2,40}$/.test(username)) throw httpError(400, 'Benutzername: 2–40 Zeichen (a–z, 0–9, . _ -).');
  if (db.users.some((u) => u.username === username)) throw httpError(409, 'Benutzername ist bereits vergeben.');
  if (String(password || '').length < 8) throw httpError(400, 'Passwort muss mindestens 8 Zeichen haben.');
  const user = {
    id: crypto.randomUUID(), username, name: String(name || username).trim(), role: role === 'admin' ? 'admin' : 'techniker',
    zertNr: String(zertNr || '').trim(), active: true, password: hashPassword(password), createdAt: new Date().toISOString(),
  };
  db.users.push(user);
  saveDb();
  return user;
}

const tokenHash = (token) => crypto.createHash('sha256').update(token).digest('hex');
const bearer = (req) => (String(req.headers.authorization || '').match(/^Bearer ([a-f0-9]{64})$/) || [])[1];

function newSession(user) {
  const token = crypto.randomBytes(32).toString('hex');
  db.sessions[tokenHash(token)] = { userId: user.id, created: Date.now() };
  // abgelaufene Sitzungen aufräumen
  const limit = Date.now() - SESSION_DAYS * 864e5;
  for (const [t, s] of Object.entries(db.sessions)) if (s.created < limit) delete db.sessions[t];
  saveDb();
  return token;
}

/** Alle Sitzungen eines Benutzers beenden (außer optional der aktuellen). */
function dropSessions(userId, keepToken) {
  const keep = keepToken ? tokenHash(keepToken) : null;
  for (const [h, s] of Object.entries(db.sessions)) if (s.userId === userId && h !== keep) delete db.sessions[h];
}

function authUser(req) {
  const token = bearer(req);
  const s = token && db.sessions[tokenHash(token)];
  if (!s || s.created < Date.now() - SESSION_DAYS * 864e5) return null;
  const u = db.users.find((x) => x.id === s.userId);
  return u && u.active !== false ? u : null;
}

// Schutz gegen Passwort-Raten: max. 10 Fehlversuche je Adresse und Benutzer in 15 Minuten
const failed = new Map();
function tooManyFailures(key) {
  const f = failed.get(key);
  return f && f.count >= 10 && Date.now() - f.first < 15 * 60e3;
}
function noteFailure(key) {
  const now = Date.now();
  for (const [k, f] of failed) if (now - f.first > 15 * 60e3) failed.delete(k); // abgelaufene Einträge aufräumen
  const f = failed.get(key);
  if (!f) failed.set(key, { count: 1, first: now });
  else f.count++;
}

// ---------- HTTP-Hilfen ----------
function httpError(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) { reject(httpError(413, 'Anfrage zu groß.')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { reject(httpError(400, 'Ungültiges JSON.')); }
    });
    req.on('error', reject);
  });
}

function cors(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  }
}

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

// ---------- API ----------
async function api(req, res, url) {
  const route = `${req.method} ${url.pathname.replace(/\/+$/, '')}`;
  const ip = req.socket.remoteAddress;

  if (route === 'GET /api/health') return send(res, 200, { app: 'anlagenbuch', version: 1, needsSetup: db.users.length === 0 });

  if (route === 'POST /api/setup') {
    if (db.users.length) throw httpError(403, 'Es ist bereits ein Administrator angelegt.');
    const body = await readJson(req);
    const user = createUser({ ...body, role: 'admin' });
    return send(res, 200, { token: newSession(user), user: publicUser(user) });
  }

  if (route === 'POST /api/login') {
    const { username, password } = await readJson(req);
    // Je Adresse UND Benutzername zählen: hinter einem Reverse-Proxy (Caddy) haben alle Anfragen dieselbe IP,
    // sonst würden 10 Fehlversuche eines Einzelnen alle Benutzer aussperren.
    const failKey = `${ip}|${normUser(username)}`;
    if (tooManyFailures(failKey)) throw httpError(429, 'Zu viele Fehlversuche. Bitte in 15 Minuten erneut versuchen.');
    const user = db.users.find((u) => u.username === normUser(username));
    if (!user || user.active === false || !checkPassword(password, user.password)) {
      noteFailure(failKey);
      throw httpError(401, 'Benutzername oder Passwort falsch.');
    }
    failed.delete(failKey);
    return send(res, 200, { token: newSession(user), user: publicUser(user) });
  }

  const me = authUser(req);
  if (!me) throw httpError(401, 'Bitte anmelden.');

  if (route === 'GET /api/me') return send(res, 200, { user: publicUser(me) });

  if (route === 'POST /api/logout') {
    delete db.sessions[tokenHash(bearer(req))];
    saveDb();
    return send(res, 200, { ok: true });
  }

  if (route === 'POST /api/password') {
    const { oldPassword, newPassword } = await readJson(req);
    if (!checkPassword(oldPassword, me.password)) throw httpError(400, 'Bisheriges Passwort ist falsch.');
    if (String(newPassword || '').length < 8) throw httpError(400, 'Neues Passwort muss mindestens 8 Zeichen haben.');
    me.password = hashPassword(newPassword);
    dropSessions(me.id, bearer(req)); // andere Geräte müssen sich neu anmelden
    saveDb();
    return send(res, 200, { ok: true });
  }

  // --- Synchronisation ---
  if (route === 'GET /api/sync') {
    const since = Number(url.searchParams.get('since')) || 0;
    const changes = [];
    for (const coll of COLLECTIONS) {
      for (const rec of Object.values(db.records[coll])) if (rec._rev > since) changes.push({ coll, rec });
    }
    changes.sort((a, b) => a.rec._rev - b.rec._rev);
    return send(res, 200, { seq: db.seq, changes });
  }

  if (route === 'POST /api/sync') {
    const { changes } = await readJson(req);
    if (!Array.isArray(changes)) throw httpError(400, 'changes fehlt.');
    let accepted = 0;
    for (const ch of changes) {
      const { coll, rec } = ch && typeof ch === 'object' ? ch : {};
      if (!COLLECTIONS.includes(coll) || !rec || typeof rec !== 'object' || !VALID_ID.test(rec.id)) continue;
      const cur = Object.hasOwn(db.records[coll], rec.id) ? db.records[coll][rec.id] : null;
      // Neuere Änderung gewinnt (Zeitstempel des Geräts)
      if (cur && String(cur.updatedAt || '') > String(rec.updatedAt || '')) continue;
      db.records[coll][rec.id] = { ...rec, _rev: ++db.seq, _by: me.name };
      accepted++;
    }
    if (accepted) saveDb();
    return send(res, 200, { accepted, seq: db.seq });
  }

  // --- Fotos: je Foto eine JPEG-Datei, unveränderlich ---
  if (url.pathname.startsWith('/api/photos/')) {
    let id = '';
    try { id = decodeURIComponent(url.pathname.slice('/api/photos/'.length)); } catch { /* unten abgelehnt */ }
    if (!VALID_ID.test(id)) throw httpError(400, 'Ungültige Foto-ID.');
    const file = path.join(PHOTO_DIR, id + '.jpg');
    if (req.method === 'GET') {
      if (!fs.existsSync(file)) throw httpError(404, 'Foto nicht gefunden.');
      return send(res, 200, { data: 'data:image/jpeg;base64,' + fs.readFileSync(file).toString('base64') });
    }
    if (req.method === 'PUT') {
      const { data } = await readJson(req);
      const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(String(data || ''));
      const buf = m ? Buffer.from(m[1], 'base64') : null;
      if (!buf || buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) throw httpError(400, 'Kein gültiges JPEG-Foto.');
      if (buf.length > MAX_PHOTO) throw httpError(413, 'Foto zu groß.');
      if (!fs.existsSync(file)) {
        fs.writeFileSync(file + '.tmp', buf);
        fs.renameSync(file + '.tmp', file);
      }
      return send(res, 200, { ok: true });
    }
  }

  // --- Benutzerverwaltung (nur Administratoren) ---
  if (url.pathname.startsWith('/api/users')) {
    if (me.role !== 'admin') throw httpError(403, 'Nur für Administratoren.');
    const id = url.pathname.split('/')[3];
    if (req.method === 'GET' && !id) return send(res, 200, { users: db.users.map(publicUser) });
    if (req.method === 'POST' && !id) return send(res, 200, { user: publicUser(createUser(await readJson(req))) });
    const user = db.users.find((u) => u.id === id);
    if (!user) throw httpError(404, 'Benutzer nicht gefunden.');
    if (req.method === 'PUT') {
      const body = await readJson(req);
      const activeAdmins = db.users.filter((u) => u.role === 'admin' && u.active !== false);
      const isActiveAdmin = user.role === 'admin' && user.active !== false;
      const losesAdmin = isActiveAdmin && (body.role === 'techniker' || body.active === false);
      if (losesAdmin && activeAdmins.length <= 1) throw httpError(400, 'Es muss mindestens ein aktiver Administrator bleiben.');
      if (body.name !== undefined) user.name = String(body.name).trim() || user.username;
      if (body.zertNr !== undefined) user.zertNr = String(body.zertNr).trim();
      if (body.role !== undefined) user.role = body.role === 'admin' ? 'admin' : 'techniker';
      if (body.active !== undefined) user.active = !!body.active;
      if (body.password) {
        if (String(body.password).length < 8) throw httpError(400, 'Passwort muss mindestens 8 Zeichen haben.');
        user.password = hashPassword(body.password);
      }
      if (user.active === false || body.password) dropSessions(user.id, bearer(req));
      saveDb();
      return send(res, 200, { user: publicUser(user) });
    }
  }

  throw httpError(404, 'Unbekannte Anfrage.');
}

// ---------- Statische Dateien (die App selbst) ----------
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8',
};

function serveStatic(req, res, url) {
  let decoded;
  try { decoded = decodeURIComponent(url.pathname); } catch { throw httpError(400, 'Ungültige Adresse.'); }
  const file = path.resolve(APP_DIR, decoded.replace(/^\/+/, '') || 'index.html');
  // Prüfung auf dem normalisierten Pfad, damit z. B. /js%2f..%2fserver%2fdata%2fdb.json nicht durchrutscht
  const rel = path.relative(APP_DIR, file).split(path.sep).join('/');
  const allowed = file.startsWith(APP_DIR + path.sep) && PUBLIC.some((p) => (p.endsWith('/') ? rel.startsWith(p) : rel === p));
  if (!allowed || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Nicht gefunden');
  }
  res.writeHead(200, {
    'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
    'Cache-Control': rel === 'sw.js' || rel === 'index.html' ? 'no-cache' : 'public, max-age=300',
  });
  fs.createReadStream(file).pipe(res);
}

// ---------- Start ----------
loadDb();
if (!db.users.length && process.env.ADMIN_USER && process.env.ADMIN_PASSWORD) {
  createUser({ username: process.env.ADMIN_USER, password: process.env.ADMIN_PASSWORD, name: process.env.ADMIN_NAME, role: 'admin' });
  console.log(`Administrator „${process.env.ADMIN_USER}“ angelegt.`);
}

const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; "
    + "img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'");
  cors(req, res);
  const url = new URL(req.url, 'http://localhost');
  try {
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    if (req.method !== 'GET' && req.method !== 'HEAD') throw httpError(405, 'Methode nicht erlaubt.');
    return serveStatic(req, res, url);
  } catch (e) {
    if (!e.status) console.error(e);
    if (!res.headersSent) send(res, e.status || 500, { error: e.status ? e.message : 'Interner Serverfehler.' });
  }
});

server.listen(PORT, () => console.log(`Anlagenbuch-Server läuft auf Port ${PORT} – Daten in ${DATA_DIR}`));

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    clearTimeout(saveTimer);
    writeDb();
    process.exit(0);
  });
}
