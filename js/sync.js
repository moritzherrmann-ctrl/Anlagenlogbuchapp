/* Anmeldung und Abgleich mit dem eigenen Anlagenbuch-Server (optional).
   Ohne Server arbeitet die App wie bisher nur lokal auf dem Gerät. */
'use strict';

const Sync = (() => {
  const LS_URL = 'anlagenbuch.server';
  const LS_TOKEN = 'anlagenbuch.token';
  const LS_USER = 'anlagenbuch.user';
  const INTERVAL = 30e3;

  let base = null; // Server-Adresse (mit abschließendem /) oder null = nur lokal
  let token = null;
  let user = null;
  let needsSetup = false;
  let status = 'aus'; // aus | ok | läuft | offline | fehler
  let lastError = '';
  let lastSync = null;
  let running = null;
  let again = false;
  let timer = null;
  const statusListeners = [];
  const dataListeners = [];

  const ls = {
    get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { if (v === null || v === undefined) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* ignorieren */ } },
  };

  const normalizeUrl = (u) => {
    u = String(u || '').trim();
    if (!u) return '';
    if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
    return u.endsWith('/') ? u : u + '/';
  };

  function setStatus(s, err = '') {
    status = s;
    lastError = err;
    statusListeners.forEach((fn) => fn());
  }

  async function request(path, { method = 'GET', body } = {}) {
    const res = await fetch(base + path, {
      method,
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    });
    let data = {};
    try { data = await res.json(); } catch { /* leer */ }
    if (!res.ok) {
      const e = new Error(data.error || `Serverfehler (${res.status})`);
      e.status = res.status;
      if (res.status === 401 && token) { setSession(null, null); }
      throw e;
    }
    return data;
  }

  async function probe(url) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(url + 'api/health', { cache: 'no-store', signal: ctrl.signal }).finally(() => clearTimeout(t));
    const data = await res.json();
    if (data.app !== 'anlagenbuch') throw new Error('Kein Anlagenbuch-Server');
    return data;
  }

  /** Beim Start: Server suchen (eingestellte Adresse oder gleicher Server wie die App). */
  async function init() {
    token = ls.get(LS_TOKEN);
    try { user = JSON.parse(ls.get(LS_USER) || 'null'); } catch { user = null; }
    const configured = ls.get(LS_URL);
    const candidates = configured ? [configured] : (location.protocol.startsWith('http') ? [new URL('./', location.href).href] : []);
    for (const url of candidates) {
      try {
        const h = await probe(url);
        base = url;
        needsSetup = !!h.needsSetup;
        break;
      } catch {
        if (configured) { base = configured; setStatus('offline', 'Server nicht erreichbar'); }
      }
    }
    if (!base) return;
    if (token) {
      request('api/me').then((d) => { user = d.user; ls.set(LS_USER, JSON.stringify(user)); statusListeners.forEach((fn) => fn()); }).catch(() => {});
      start();
    }
  }

  function setSession(t, u) {
    token = t;
    user = u;
    ls.set(LS_TOKEN, t);
    ls.set(LS_USER, u ? JSON.stringify(u) : null);
    if (!t) { stop(); setStatus('aus'); }
    statusListeners.forEach((fn) => fn());
  }

  function hasLocalData() {
    const st = Store.get();
    return st.customers.length + st.systems.length + st.entries.length > 0;
  }

  /** Nach der ersten Anmeldung auf diesem Gerät: lokale Daten hochladen oder verwerfen. */
  async function firstConnect(chooseUpload) {
    if (Store.get().syncSeq) return;
    const remote = await request('api/sync?since=0');
    if (hasLocalData()) {
      const upload = remote.changes.length === 0 || await chooseUpload(remote.changes.length);
      if (upload) Store.markAllDirty();
      else await Store.resetForServer();
    }
  }

  async function login(username, password, chooseUpload) {
    const d = await request('api/login', { method: 'POST', body: { username, password } });
    setSession(d.token, d.user);
    await firstConnect(chooseUpload);
    start();
    return d.user;
  }

  async function setup(data, chooseUpload) {
    const d = await request('api/setup', { method: 'POST', body: data });
    needsSetup = false;
    setSession(d.token, d.user);
    await firstConnect(chooseUpload);
    start();
    return d.user;
  }

  async function logout() {
    try { await request('api/logout', { method: 'POST' }); } catch { /* egal */ }
    setSession(null, null);
  }

  /** Server-Adresse setzen (leer = automatisch / nur lokal). */
  async function setServer(url) {
    url = normalizeUrl(url);
    if (url) await probe(url);
    ls.set(LS_URL, url || null);
    if (url !== base) {
      setSession(null, null);
      Store.get().syncSeq = 0;
      await Store.save({ silent: true });
    }
    base = null;
    needsSetup = false;
    await init();
  }

  // ---------- Abgleich ----------
  async function run() {
    if (!base || !token) return;
    if (running) { again = true; return running; }
    running = (async () => {
      setStatus('läuft');
      try {
        do {
          again = false;
          const sent = Store.pendingChanges();
          for (let i = 0; i < sent.length; i += 200) {
            const chunk = sent.slice(i, i + 200);
            await request('api/sync', { method: 'POST', body: { changes: chunk.map(({ coll, rec }) => ({ coll, rec })) } });
            await Store.clearPending(chunk);
          }
          const d = await request('api/sync?since=' + (Store.get().syncSeq || 0));
          const changed = await Store.applyRemote(d.changes, d.seq);
          if (changed) dataListeners.forEach((fn) => fn());
        } while (again);
        lastSync = new Date();
        setStatus('ok');
      } catch (e) {
        if (e.status === 401) setStatus('aus', 'Abgemeldet');
        else setStatus(navigator.onLine === false || e instanceof TypeError ? 'offline' : 'fehler', e.message);
      } finally {
        running = null;
      }
    })();
    return running;
  }

  let debounce = null;
  function schedule() {
    if (!base || !token) return;
    clearTimeout(debounce);
    debounce = setTimeout(run, 800);
  }

  function start() {
    stop();
    run();
    timer = setInterval(run, INTERVAL);
  }

  function stop() {
    clearInterval(timer);
    timer = null;
  }

  Store.onChange(schedule);
  window.addEventListener('online', () => run());
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') run(); });

  // ---------- Benutzerverwaltung ----------
  const users = {
    list: () => request('api/users').then((d) => d.users),
    create: (u) => request('api/users', { method: 'POST', body: u }).then((d) => d.user),
    update: (id, u) => request('api/users/' + id, { method: 'PUT', body: u }).then((d) => d.user),
  };
  const changePassword = (oldPassword, newPassword) => request('api/password', { method: 'POST', body: { oldPassword, newPassword } });

  return {
    init, login, setup, logout, setServer, run, users, changePassword,
    onStatus: (fn) => statusListeners.push(fn),
    onData: (fn) => dataListeners.push(fn),
    get enabled() { return !!base; },
    get loggedIn() { return !!(base && token); },
    get needsSetup() { return needsSetup; },
    get user() { return user; },
    get isAdmin() { return !!(user && user.role === 'admin'); },
    get server() { return base; },
    get configuredServer() { return ls.get(LS_URL) || ''; },
    get status() { return status; },
    get lastError() { return lastError; },
    get lastSync() { return lastSync; },
    get pendingCount() { return Object.keys(Store.get().pending || {}).length; },
  };
})();
