/* Datenhaltung (IndexedDB, Fallback localStorage) und Fachlogik F-Gase */
'use strict';

const Store = (() => {
  const DB_NAME = 'anlagenbuch';
  const OBJ = 'kv';
  const KEY = 'state';
  const LS_KEY = 'anlagenbuch.state';

  const DEFAULT_SETTINGS = {
    firma: 'Moritz Herrmann Heizung und Klima',
    strasse: 'Elisabethgarten 6C',
    plzOrt: '31135 Hildesheim',
    telefon: '+49 176 45344653',
    email: 'Info@herrmann-heizung-klima.com',
    zertifikatNr: 'HI911018171-1',
    techniker: 'Moritz Herrmann',
    technikerZertNr: '',
  };

  let db = null;
  let state = emptyState();

  function emptyState() {
    return { version: 2, settings: { ...DEFAULT_SETTINGS }, customers: [], locations: [], systems: [], entries: [] };
  }

  function openDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(OBJ);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  function idb(mode, fn) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(OBJ, mode);
      const req = fn(tx.objectStore(OBJ));
      tx.oncomplete = () => resolve(req && req.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  function normalize(s) {
    const base = emptyState();
    if (!s || typeof s !== 'object') return base;
    return migrate({
      version: 2,
      settings: { ...base.settings, ...(s.settings || {}) },
      customers: Array.isArray(s.customers) ? s.customers : [],
      locations: Array.isArray(s.locations) ? s.locations : [],
      systems: Array.isArray(s.systems) ? s.systems : [],
      entries: Array.isArray(s.entries) ? s.entries : [],
    });
  }

  /** Version 1 kannte keine Standorte: je Kunde und Standort-Text einen Standort anlegen. */
  function migrate(s) {
    const now = new Date().toISOString();
    for (const sys of s.systems) FGas.fixGwp(sys);
    for (const sys of s.systems) {
      if (sys.locationId && s.locations.some((l) => l.id === sys.locationId)) continue;
      const cust = s.customers.find((c) => c.id === sys.customerId) || {};
      const custAddr = customerAddress(cust);
      const text = (sys.standort || '').trim();
      const sameAsCustomer = !text || text === custAddr;
      let loc = s.locations.find((l) => l.customerId === sys.customerId && l.migratedFrom === (sameAsCustomer ? '' : text));
      if (!loc) {
        loc = sameAsCustomer
          ? { name: 'Hauptstandort', strasse: cust.strasse || '', plz: cust.plz || '', ort: cust.ort || '' }
          : { name: text, strasse: '', plz: '', ort: '' };
        Object.assign(loc, { id: uid(), customerId: sys.customerId, migratedFrom: sameAsCustomer ? '' : text, createdAt: now, updatedAt: now });
        s.locations.push(loc);
      }
      sys.locationId = loc.id;
      delete sys.standort;
    }
    return s;
  }

  async function load() {
    try {
      db = await openDb();
      state = normalize(await idb('readonly', (os) => os.get(KEY)));
    } catch (e) {
      console.warn('IndexedDB nicht verfügbar, nutze localStorage', e);
      db = null;
      try { state = normalize(JSON.parse(localStorage.getItem(LS_KEY))); } catch { state = emptyState(); }
    }
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    return state;
  }

  async function save() {
    if (db) {
      await idb('readwrite', (os) => os.put(state, KEY));
    } else {
      localStorage.setItem(LS_KEY, JSON.stringify(state));
    }
  }

  function uid() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2);
  }

  const get = () => state;
  const replace = (s) => { state = normalize(s); return save(); };

  // --- Kunden ---
  const customer = (id) => state.customers.find((c) => c.id === id);
  const systemsOf = (customerId) => state.systems.filter((s) => s.customerId === customerId);
  const location = (id) => state.locations.find((l) => l.id === id);
  const locationsOf = (customerId) => state.locations
    .filter((l) => l.customerId === customerId)
    .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'de'));
  const systemsAt = (locationId) => state.systems.filter((s) => s.locationId === locationId);
  const system = (id) => state.systems.find((s) => s.id === id);
  const entry = (id) => state.entries.find((e) => e.id === id);
  const entriesOf = (systemId) => state.entries
    .filter((e) => e.systemId === systemId)
    .sort((a, b) => (a.datum || '').localeCompare(b.datum || '') || (a.createdAt || '').localeCompare(b.createdAt || ''));

  // --- Anlagen-Nummern: <Kundennummer>-0001, -0002, … ---
  function numberSuffix(nr, prefix) {
    const m = String(nr || '').match(/^(.*)-(\d+)$/);
    return m && m[1] === prefix ? Number(m[2]) : 0;
  }

  /** Nächste freie Anlagen-Nr. des Kunden ('' wenn keine Kundennummer hinterlegt). */
  function nextSystemNumber(customerId) {
    const c = customer(customerId);
    const prefix = c && (c.kundennr || '').trim();
    if (!prefix) return '';
    const used = systemsOf(customerId).map((x) => numberSuffix(x.anlagenNr, prefix));
    const counter = c.anlagenZaehlerPrefix === prefix ? Number(c.anlagenZaehler) || 0 : 0;
    const next = Math.max(counter, ...used) + 1;
    return `${prefix}-${String(next).padStart(4, '0')}`;
  }

  /** Zähler merken, damit Nummern gelöschter Anlagen nicht erneut vergeben werden. */
  function noteSystemNumber(customerId, nr) {
    const c = customer(customerId);
    const prefix = c && (c.kundennr || '').trim();
    const n = prefix ? numberSuffix(nr, prefix) : 0;
    if (!n) return;
    const counter = c.anlagenZaehlerPrefix === prefix ? Number(c.anlagenZaehler) || 0 : 0;
    if (n > counter) Object.assign(c, { anlagenZaehler: n, anlagenZaehlerPrefix: prefix });
  }

  function upsert(list, obj) {
    const now = new Date().toISOString();
    obj.updatedAt = now;
    if (!obj.id) {
      obj.id = uid();
      obj.createdAt = now;
      state[list].push(obj);
    } else {
      const i = state[list].findIndex((x) => x.id === obj.id);
      if (i < 0) state[list].push(obj); else state[list][i] = { ...state[list][i], ...obj };
    }
    return save().then(() => state[list].find((x) => x.id === obj.id));
  }

  function removeCustomer(id) {
    const sysIds = new Set(systemsOf(id).map((s) => s.id));
    state.entries = state.entries.filter((e) => !sysIds.has(e.systemId));
    state.systems = state.systems.filter((s) => s.customerId !== id);
    state.locations = state.locations.filter((l) => l.customerId !== id);
    state.customers = state.customers.filter((c) => c.id !== id);
    return save();
  }
  function removeLocation(id) {
    const sysIds = new Set(systemsAt(id).map((s) => s.id));
    state.entries = state.entries.filter((e) => !sysIds.has(e.systemId));
    state.systems = state.systems.filter((s) => s.locationId !== id);
    state.locations = state.locations.filter((l) => l.id !== id);
    return save();
  }
  function removeSystem(id) {
    state.entries = state.entries.filter((e) => e.systemId !== id);
    state.systems = state.systems.filter((s) => s.id !== id);
    return save();
  }
  function removeEntry(id) {
    state.entries = state.entries.filter((e) => e.id !== id);
    return save();
  }

  return {
    load, save, get, replace, uid, customer, location, locationsOf, system, entry, systemsOf, systemsAt, entriesOf,
    upsert, nextSystemNumber, noteSystemNumber, removeCustomer, removeLocation, removeSystem, removeEntry, DEFAULT_SETTINGS,
  };
})();

const FGas = (() => {
  // GWP-Werte laut Tabelle „Fluorierte Treibhausgase: GWP-Werte und Beispiele für CO2-Äquivalente“
  // (Bundesfachschule Kälte-Klima-Technik, 2015 – Basis IPCC AR4 / VO (EU) 517/2014).
  // Werte sind in der Anlage editierbar.
  const REFRIGERANTS = {
    'R-23': 14800,
    'R-32': 675,
    'R-41': 92,
    'R-125': 3500,
    'R-134': 1100,
    'R-134a': 1430,
    'R-143': 353,
    'R-143a': 4470,
    'R-152': 53,
    'R-152a': 124,
    'R-161': 12,
    'R-227ea': 3220,
    'R-236cb': 1340,
    'R-236ea': 1370,
    'R-236fa': 9810,
    'R-245ca': 693,
    'R-245fa': 1030,
    'R-365mfc': 794,
    'R-14': 7390,
    'R-116': 12200,
    'R-218': 8830,
    'R-C318': 10300,
    'R-404A': 3922,
    'R-407A': 2107,
    'R-407B': 2804,
    'R-407C': 1774,
    'R-407D': 1627,
    'R-407E': 1552,
    'R-407F': 1825,
    'R-410A': 2088,
    'R-413A': 2053,
    'R-417A': 2346,
    'R-422A': 3143,
    'R-422D': 2729,
    'R-427A': 2138,
    'R-437A': 1805,
    'R-438A': 2265,
    'R-448A': 1387,
    'R-449A': 1397,
    'R-507': 3990,
    'R-508A': 13214,
    'R-508B': 13396,
    // Ergänzungen (nicht in der Tabelle), GWP auf gleicher Basis (AR4) bzw. aus den Gemisch-Anteilen berechnet
    'R-450A': 605,
    'R-452A': 2140,
    'R-452B': 698,
    'R-454A': 239,
    'R-454B': 466,
    'R-454C': 148,
    'R-455A': 148,
    'R-513A': 631,
    'R-1234yf': 4,
    'R-1234ze(E)': 7,
    'R-290 (Propan)': 3,
    'R-600a (Isobutan)': 3,
    'R-1270 (Propen)': 2,
    'R-744 (CO2)': 1,
    'R-717 (Ammoniak)': 0,
  };

  // Werte der früheren App-Version – gespeicherte Anlagen mit diesen Werten werden automatisch korrigiert.
  const OLD_GWP = {
    'R-32': 771, 'R-134a': 1530, 'R-404A': 4728, 'R-407A': 2262, 'R-407C': 1908, 'R-407F': 1965,
    'R-410A': 2256, 'R-417A': 2508, 'R-422D': 2917, 'R-448A': 1494, 'R-449A': 1504, 'R-507A': 4775,
    'R-450A': 643, 'R-452A': 2292, 'R-452B': 779, 'R-454A': 270, 'R-454B': 531, 'R-454C': 166, 'R-455A': 166,
    'R-513A': 673, 'R-1234yf': 0.5, 'R-1234ze(E)': 1.4, 'R-290 (Propan)': 0.02, 'R-600a (Isobutan)': 0.006,
  };
  const RENAMED = { 'R-507A': 'R-507' };

  /** Alten App-Standardwert durch Tabellenwert ersetzen (manuell geänderte Werte bleiben). */
  function fixGwp(sys) {
    const old = OLD_GWP[sys.kaeltemittel];
    if (old === undefined || num(sys.gwp) !== old) return false;
    const name = RENAMED[sys.kaeltemittel] || sys.kaeltemittel;
    sys.kaeltemittel = name;
    sys.gwp = String(REFRIGERANTS[name]);
    return true;
  }

  const TAETIGKEITEN = ['Installation', 'Wartung/Instandhaltung', 'Reparatur', 'Dichtheitskontrolle', 'Rückgewinnung', 'Stilllegung'];
  const HERKUNFT = ['neu', 'recycelt', 'aufgearbeitet'];
  const ERGEBNIS = ['dicht', 'Leckage'];

  const num = (v) => {
    if (v === null || v === undefined || v === '') return NaN;
    return Number(String(v).replace(',', '.'));
  };

  function co2e(sys) {
    const kg = num(sys.fuellmenge);
    const gwp = num(sys.gwp);
    if (!isFinite(kg) || !isFinite(gwp)) return NaN;
    return (kg * gwp) / 1000;
  }

  /** Prüfintervall in Monaten (0 = keine Pflicht), gemäß Art. 5 VO (EU) 2024/573 bzw. Vorlage. */
  function autoInterval(sys) {
    const t = co2e(sys);
    if (!isFinite(t) || t < 5) return 0;
    if (sys.hermetisch && t < 10) return 0;
    let m = t >= 500 ? 3 : t >= 50 ? 6 : 12;
    if (sys.leckageSystem === 'ja') m *= 2;
    return m;
  }

  function interval(sys) {
    if (sys.pruefintervall && sys.pruefintervall !== 'auto') return Number(sys.pruefintervall);
    return autoInterval(sys);
  }

  function intervalLabel(m) {
    return m > 0 ? `alle ${m} Monate` : 'keine Pflicht';
  }

  function addMonths(iso, m) {
    const [y, mo, d] = iso.split('-').map(Number);
    const target = new Date(Date.UTC(y, mo - 1 + m, 1));
    const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
    target.setUTCDate(Math.min(d, last));
    return target.toISOString().slice(0, 10);
  }

  /** Nächste fällige Dichtheitskontrolle bzw. Nachkontrolle. */
  function nextDue(sys, entries) {
    if (!Areas.isKaelte(sys)) return null; // Dichtheitskontrollen nur bei Kälteanlagen
    const m = interval(sys);
    const checks = entries.filter((e) => e.datum && (e.ergebnis === 'dicht' || e.ergebnis === 'Leckage'));
    const last = checks[checks.length - 1];
    if (last && last.ergebnis === 'Leckage') {
      const ref = last.nachkontrolleAm && last.nachkontrolleAm >= last.datum ? null : addMonths(last.datum, 1);
      if (ref) return { date: ref, reason: 'Nachkontrolle nach Leckage' };
    }
    if (!m) return null;
    const base = last ? (last.nachkontrolleAm && last.nachkontrolleAm > last.datum ? last.nachkontrolleAm : last.datum) : sys.errichtetAm;
    if (!base) return { date: null, reason: 'Dichtheitskontrolle (noch keine erfasst)' };
    return { date: addMonths(base, m), reason: 'Dichtheitskontrolle' };
  }

  /** Wartungsintervall in Monaten (Standard 12, 0 = keine regelmäßige Wartung). */
  function maintInterval(sys) {
    if (sys.wartungsintervall === undefined || sys.wartungsintervall === '') return 12;
    return Number(sys.wartungsintervall) || 0;
  }

  /** Nächste fällige Wartung (letzte Wartung/Instandhaltung bzw. Errichtung + Intervall). */
  function nextMaintenance(sys, entries) {
    const m = maintInterval(sys);
    if (!m) return null;
    const area = Areas.get(Areas.of(sys));
    const acts = area.maintActs || ['Wartung/Instandhaltung', 'Installation'];
    const done = entries.filter((e) => e.datum && acts.includes(e.taetigkeit));
    const last = done[done.length - 1];
    const base = last ? last.datum : sys.errichtetAm;
    if (!base) return { date: null, reason: 'Wartung', kind: 'wartung' };
    return { date: addMonths(base, m), reason: 'Wartung', kind: 'wartung' };
  }

  /** Alle anstehenden Termine einer Anlage (Wartung + Dichtheitskontrolle), früheste zuerst. */
  function dueItems(sys, entries) {
    const leak = nextDue(sys, entries);
    const items = [nextMaintenance(sys, entries), leak && { ...leak, kind: 'dichtheit' }].filter(Boolean);
    return items.sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'));
  }

  function dueStatus(due) {
    if (!due) return { cls: '', text: 'keine Prüfpflicht' };
    if (!due.date) return { cls: 'warn', text: 'Prüfung offen' };
    const today = new Date().toISOString().slice(0, 10);
    if (due.date < today) return { cls: 'danger', text: 'überfällig seit ' + fmtDate(due.date) };
    if (due.date <= addMonths(today, 1)) return { cls: 'warn', text: 'fällig ' + fmtDate(due.date) };
    return { cls: 'ok', text: 'fällig ' + fmtDate(due.date) };
  }

  return {
    REFRIGERANTS, TAETIGKEITEN, HERKUNFT, ERGEBNIS, num, co2e, autoInterval, interval, intervalLabel, addMonths,
    nextDue, maintInterval, nextMaintenance, dueItems, dueStatus, fixGwp,
  };
})();

function fmtDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}.${m}.${y}`;
}

function fmtDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function fmtNum(v, digits = 2) {
  const n = FGas.num(v);
  if (!isFinite(n)) return '';
  return n.toLocaleString('de-DE', { maximumFractionDigits: digits });
}

function customerAddress(c) {
  if (!c) return '';
  return [c.strasse, [c.plz, c.ort].filter(Boolean).join(' ')].filter(Boolean).join(', ');
}

/** Standort als Text: Name, Anschrift (+ Aufstellort der Anlage). */
function locationText(loc, sys) {
  if (!loc) return sys && sys.aufstellort ? sys.aufstellort : '';
  const addr = customerAddress(loc);
  const name = loc.name && loc.name !== addr ? loc.name : '';
  return [name, addr, sys && sys.aufstellort ? 'Aufstellort: ' + sys.aufstellort : ''].filter(Boolean).join(', ');
}
