/* Oberfläche: Bereich → Kunden → Standorte → Anlagen → Einträge mit digitaler Unterschrift */
'use strict';

const main = document.getElementById('main');

// ---------- Hilfsfunktionen ----------
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const today = () => new Date().toISOString().slice(0, 10);
const go = (hash) => { location.hash = hash; };

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { t.hidden = true; }, 2600);
}

function field(name, label, value, opts = {}) {
  const { type = 'text', full = false, required = false, hint = '', attrs = '', list = '' } = opts;
  const req = required ? ' required' : '';
  const cls = full ? 'field full' : 'field';
  let input;
  if (type === 'textarea') {
    input = `<textarea name="${name}"${req} ${attrs}>${esc(value)}</textarea>`;
  } else if (type === 'select') {
    input = `<select name="${name}"${req} ${attrs}>${opts.options.map((o) => {
      const [v, l] = Array.isArray(o) ? o : [o, o];
      return `<option value="${esc(v)}"${String(value ?? '') === String(v) ? ' selected' : ''}>${esc(l)}</option>`;
    }).join('')}</select>`;
  } else {
    input = `<input name="${name}" type="${type}" value="${esc(value)}"${req} ${list ? `list="${list}"` : ''} ${attrs}>`;
  }
  return `<label class="${cls}"><span>${esc(label)}${required ? ' *' : ''}</span>${input}${hint ? `<span class="hint">${hint}</span>` : ''}</label>`;
}

function formData(form) {
  const o = {};
  for (const el of form.elements) {
    if (!el.name) continue;
    if (el.type === 'checkbox') o[el.name] = el.checked;
    else if (el.type === 'radio') { if (el.checked) o[el.name] = el.value; }
    else o[el.name] = el.value.trim();
  }
  return o;
}

function setActiveNav(key) {
  document.querySelectorAll('.topnav a').forEach((a) => a.classList.toggle('active', a.dataset.nav === key));
}

function render(html, nav = 'kunden', showArea = true) {
  main.innerHTML = html;
  setActiveNav(nav);
  const area = Areas.get(Areas.current);
  document.getElementById('brandText').textContent = showArea ? `${area.icon} ${area.short}` : 'Anlagenbuch';
  document.querySelector('.brand').setAttribute('href', showArea ? '#/b/' + area.key : '#/');
  window.scrollTo(0, 0);
}

const areaHome = () => '#/b/' + Areas.current;

function notFound() {
  render(`<div class="empty">Nicht gefunden. <a href="#/">Zur Startseite</a></div>`, 'kunden', false);
}

function systemTitle(s) {
  return [s.anlagenNr, s.bezeichnung].filter(Boolean).join(' – ') || 'Anlage ohne Bezeichnung';
}

function locationTitle(l) {
  return (l && (l.name || customerAddress(l))) || 'Standort ohne Namen';
}

/** Brotkrumen: Kunden › Kunde › Standort › Anlage (je nach Tiefe). */
function crumbs({ c, l, s } = {}) {
  const area = Areas.get(Areas.current);
  const parts = ['<a href="#/">Start</a>', `<a href="#/b/${area.key}">${esc(area.short)}</a>`];
  if (c) parts.push(`<a href="#/kunde/${c.id}">${esc(c.name)}</a>`);
  if (l) parts.push(`<a href="#/standort/${l.id}">${esc(locationTitle(l))}</a>`);
  if (s) parts.push(`<a href="#/anlage/${s.id}">${esc(systemTitle(s))}</a>`);
  return `<div class="crumbs">${parts.join(' › ')}</div>`;
}

const dueLabel = (d) => (d.kind === 'wartung' ? 'Wartung' : d.reason);

/** Badge mit dem frühesten anstehenden Termin einer Anlage. */
function dueBadge(sys) {
  const [first] = FGas.dueItems(sys, Store.entriesOf(sys.id));
  if (!first) return '<span class="badge">keine Termine</span>';
  const st = FGas.dueStatus(first);
  return `<span class="badge ${st.cls}">${esc(dueLabel(first))}: ${esc(st.text)}</span>`;
}

/** Frühester Termin über mehrere Anlagen (für Kunden- und Standortlisten). */
function worstBadge(systems) {
  const items = systems.flatMap((s) => FGas.dueItems(s, Store.entriesOf(s.id)).filter((d) => d.date));
  if (!items.length) return '';
  items.sort((a, b) => a.date.localeCompare(b.date));
  const st = FGas.dueStatus(items[0]);
  return `<span class="badge ${st.cls}">${esc(st.text)}</span>`;
}

// ---------- Start: Bereichsauswahl ----------
function viewAreas() {
  const st = Store.get();
  render(`
    <h1>Bereich wählen</h1>
    <p class="muted">Kunden und Standorte sind in allen Bereichen gleich – die Anlagen gehören jeweils zu einem Bereich.</p>
    <div class="area-grid">${Areas.keys.map((k) => {
      const a = Areas.get(k);
      const systems = st.systems.filter((s) => Areas.of(s) === k);
      const overdue = systems.flatMap((s) => FGas.dueItems(s, Store.entriesOf(s.id))).filter((d) => d.date && d.date < today()).length;
      return `<a class="area-tile area-${k}" href="#/b/${k}">
        <span class="area-icon">${a.icon}</span>
        <span class="area-title">${esc(a.label)}</span>
        <span class="area-desc">${esc(a.desc)}</span>
        <span class="entry-meta"><span class="badge">${systems.length} ${systems.length === 1 ? 'Anlage' : 'Anlagen'}</span>
          ${overdue ? `<span class="badge danger">${overdue} überfällig</span>` : ''}</span>
      </a>`;
    }).join('')}</div>
    <p class="muted small" style="margin-top:16px">${st.customers.length} Kunden · ${st.locations.length} Standorte</p>
  `, 'kunden', false);
}

// ---------- Bereichs-Startseite: nächste Termine + Kunden ----------
const HOME_LIMIT = 10;

function viewHome(q) {
  const st = Store.get();
  const area = Areas.get(Areas.current);
  const inArea = (s) => Areas.of(s) === area.key;
  const term = (q.get('q') || '').toLowerCase();
  const showAll = q.get('alle') || '';
  const customers = [...st.customers]
    .filter((c) => !term || [c.name, c.ansprechpartner, c.ort, c.strasse, c.kundennr,
      ...Store.locationsOf(c.id).map((l) => [l.name, l.ort, l.strasse].join(' '))].join(' ').toLowerCase().includes(term))
    .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'de'));

  const dueRow = ({ s, d }) => {
    const c = Store.customer(s.customerId);
    const l = Store.location(s.locationId);
    const stt = FGas.dueStatus(d);
    const day = d.date ? d.date.slice(8, 10) + '.' + d.date.slice(5, 7) + '.' : '–';
    return `<li><a class="list-item" href="#/anlage/${s.id}">
      <div class="date-chip ${stt.cls}"><strong>${day}</strong><span>${d.date ? d.date.slice(0, 4) : 'offen'}</span></div>
      <div class="grow"><div class="title">${esc(dueLabel(d))} · ${esc(systemTitle(s))}</div>
      <div class="sub">${esc([c && c.name, l && locationTitle(l)].filter(Boolean).join(' · '))}</div>
      <div class="entry-meta"><span class="badge ${stt.cls}">${esc(stt.text)}</span></div></div>
      <span class="chev">›</span></a></li>`;
  };

  /** Terminliste (Dichtheitskontrollen bzw. Wartungen) mit „Alle anzeigen“ und Anlagen ohne Termin. */
  const dueSection = ({ key, title, calc, emptyText, openText }) => {
    const due = st.systems.filter(inArea).map((s) => ({ s, d: calc(s, Store.entriesOf(s.id)) })).filter((x) => x.d);
    const dated = due.filter((x) => x.d.date).sort((a, b) => a.d.date.localeCompare(b.d.date));
    const open = due.filter((x) => !x.d.date);
    const all = showAll === key;
    const shown = all ? dated : dated.slice(0, HOME_LIMIT);
    const overdue = dated.filter((x) => x.d.date < today()).length;
    const toggle = new URLSearchParams(term ? { q: q.get('q') } : {});
    if (!all) toggle.set('alle', key);
    return `
      <div class="head-row" style="margin-top:8px"><h1>${title}</h1></div>
      ${overdue ? `<div class="notice danger"><strong>${overdue} ${overdue === 1 ? 'Termin ist' : 'Termine sind'} überfällig.</strong></div>` : ''}
      ${dated.length ? `<ul class="list">${shown.map(dueRow).join('')}</ul>
        ${dated.length > HOME_LIMIT ? `<div class="actions" style="margin-top:0">
          <a class="btn small" href="${areaHome()}?${toggle}">${all ? 'Weniger anzeigen' : `Alle ${dated.length} Termine anzeigen`}</a></div>` : ''}`
      : `<div class="empty">${emptyText}</div>`}
      ${open.length ? `<details class="card" style="margin-top:12px"><summary><strong>${open.length} Anlage(n) ohne Termin</strong>
        <span class="muted small"> – ${openText}</span></summary>
        <ul class="list" style="margin-top:10px">${open.map(dueRow).join('')}</ul></details>` : ''}
      <div style="height:16px"></div>`;
  };

  render(`
    <div class="area-head"><span>${area.icon}</span> ${esc(area.label)} <a class="small" href="#/">Bereich wechseln</a></div>
    ${area.key === 'kaelte' ? dueSection({
      key: 'dk',
      title: 'Nächste Dichtheitskontrollen',
      calc: FGas.nextDue,
      emptyText: 'Keine anstehenden Dichtheitskontrollen. Termine entstehen automatisch für prüfpflichtige Anlagen (ab 5 t CO2-Äquivalent) aus dem Prüfintervall und den Einträgen.',
      openText: 'noch keine Dichtheitskontrolle und kein Errichtungsdatum erfasst',
    }) : ''}
    ${dueSection({
      key: 'wa',
      title: 'Nächste Wartungen',
      calc: FGas.nextMaintenance,
      emptyText: 'Keine anstehenden Wartungen. Termine entstehen aus dem Wartungsintervall der Anlagen und den eingetragenen Wartungen.',
      openText: 'noch keine Wartung und kein Inbetriebnahme-Datum erfasst',
    })}

    <div class="head-row" style="margin-top:24px">
      <h1>Kunden</h1>
      <a class="btn primary" href="#/kunde/neu">+ Kunde anlegen</a>
    </div>
    <input class="search" type="search" id="search" placeholder="Kunden oder Standorte suchen …" value="${esc(q.get('q') || '')}">
    ${customers.length ? `<ul class="list">${customers.map((c) => {
      const nl = Store.locationsOf(c.id).length;
      const ns = Store.systemsOf(c.id).filter(inArea).length;
      return `<li><a class="list-item" href="#/kunde/${c.id}">
        <div class="grow"><div class="title">${esc(c.name)}</div>
        <div class="sub">${esc(customerAddress(c))}</div>
        <div class="entry-meta"><span class="badge">${nl} ${nl === 1 ? 'Standort' : 'Standorte'}</span>
          <span class="badge">${ns} ${ns === 1 ? 'Anlage' : 'Anlagen'}</span></div></div>
        <span class="chev">›</span></a></li>`;
    }).join('')}</ul>`
    : `<div class="empty">${term ? 'Keine Treffer.' : 'Noch keine Kunden angelegt.<br><br><a class="btn primary" href="#/kunde/neu">+ Ersten Kunden anlegen</a>'}</div>`}
  `);
  const s = document.getElementById('search');
  s.addEventListener('input', () => {
    const qs = new URLSearchParams({ q: s.value });
    if (showAll) qs.set('alle', showAll);
    history.replaceState(null, '', areaHome() + '?' + qs);
    const pos = s.selectionStart;
    viewHome(qs);
    const n = document.getElementById('search');
    n.focus();
    n.setSelectionRange(pos, pos);
  });
}

// ---------- Kunde anlegen / bearbeiten ----------
function viewCustomerForm(id) {
  const c = id ? Store.customer(id) : {};
  if (id && !c) return notFound();
  render(`
    ${crumbs({ c: id ? c : null })}
    <h1>${id ? 'Kunde bearbeiten' : 'Neuer Kunde'}</h1>
    <form id="f" class="card">
      <div class="grid">
        ${field('name', 'Name / Firma (Betreiber)', c.name, { required: true, full: true })}
        ${field('ansprechpartner', 'Ansprechpartner', c.ansprechpartner)}
        ${field('kundennr', 'Kunden-Nr.', c.kundennr)}
        ${field('strasse', 'Straße, Hausnr.', c.strasse, { full: true })}
        ${field('plz', 'PLZ', c.plz, { attrs: 'inputmode="numeric"' })}
        ${field('ort', 'Ort', c.ort)}
        ${field('telefon', 'Telefon', c.telefon, { type: 'tel' })}
        ${field('email', 'E-Mail', c.email, { type: 'email' })}
        ${field('notizen', 'Notizen', c.notizen, { type: 'textarea', full: true })}
        ${id ? '' : '<label class="check full"><input type="checkbox" id="firstLoc" checked> Kundenanschrift gleich als ersten Standort anlegen</label>'}
      </div>
      <div class="actions">
        ${id ? '<button type="button" class="btn danger" id="del">Kunde löschen</button>' : ''}
        <span class="spacer"></span>
        <a class="btn ghost" href="${id ? '#/kunde/' + id : areaHome()}">Abbrechen</a>
        <button class="btn primary" type="submit">Speichern</button>
      </div>
    </form>
  `);
  document.getElementById('f').addEventListener('submit', async (e) => {
    e.preventDefault();
    const d = formData(e.target);
    const saved = await Store.upsert('customers', { ...d, id: id || undefined });
    const firstLoc = document.getElementById('firstLoc');
    if (firstLoc && firstLoc.checked) {
      await Store.upsert('locations', {
        customerId: saved.id, name: 'Hauptstandort', strasse: d.strasse, plz: d.plz, ort: d.ort,
        ansprechpartner: d.ansprechpartner, telefon: d.telefon,
      });
    }
    toast('Kunde gespeichert');
    go('#/kunde/' + saved.id);
  });
  const del = document.getElementById('del');
  if (del) del.addEventListener('click', async () => {
    const nl = Store.locationsOf(id).length;
    const n = Store.systemsOf(id).length;
    if (!confirm(`Kunde „${c.name}“ wirklich löschen?${nl || n ? `\nAuch ${nl} Standort(e) und ${n} Anlage(n) inkl. aller Einträge werden gelöscht!` : ''}`)) return;
    await Store.removeCustomer(id);
    toast('Kunde gelöscht');
    go(areaHome());
  });
}

// ---------- Kundendetail mit Standorten ----------
function viewCustomer(id) {
  const c = Store.customer(id);
  if (!c) return notFound();
  const locations = Store.locationsOf(id);
  render(`
    ${crumbs()}
    <div class="head-row">
      <h1>${esc(c.name)}</h1>
      <a class="btn" href="#/kunde/${id}/bearbeiten">Bearbeiten</a>
    </div>
    <div class="card">
      <dl class="kv">
        ${c.ansprechpartner ? `<dt>Ansprechpartner</dt><dd>${esc(c.ansprechpartner)}</dd>` : ''}
        ${c.kundennr ? `<dt>Kunden-Nr.</dt><dd>${esc(c.kundennr)}</dd>` : ''}
        <dt>Anschrift</dt><dd>${esc(customerAddress(c)) || '–'}</dd>
        ${c.telefon ? `<dt>Telefon</dt><dd><a href="tel:${esc(c.telefon)}">${esc(c.telefon)}</a></dd>` : ''}
        ${c.email ? `<dt>E-Mail</dt><dd><a href="mailto:${esc(c.email)}">${esc(c.email)}</a></dd>` : ''}
        ${c.notizen ? `<dt>Notizen</dt><dd>${esc(c.notizen)}</dd>` : ''}
      </dl>
    </div>
    <div class="head-row">
      <h2 style="margin:8px 0 0;flex:1">Standorte</h2>
      <a class="btn primary" href="#/standort/neu?kunde=${id}">+ Standort anlegen</a>
    </div>
    ${locations.length ? `<ul class="list">${locations.map((l) => {
      const systems = Store.systemsAt(l.id).filter((s) => Areas.of(s) === Areas.current);
      return `<li><a class="list-item" href="#/standort/${l.id}">
        <div class="grow"><div class="title">${esc(locationTitle(l))}</div>
        <div class="sub">${esc(l.name ? customerAddress(l) : '')}</div>
        <div class="entry-meta"><span class="badge">${systems.length} ${systems.length === 1 ? 'Anlage' : 'Anlagen'}</span>${worstBadge(systems)}</div></div>
        <span class="chev">›</span></a></li>`;
    }).join('')}</ul>`
    : `<div class="empty">Für diesen Kunden ist noch kein Standort angelegt.<br>Lege zuerst einen Standort an – dort kannst du dann die Anlagen anlegen.</div>`}
  `);
}

// ---------- Standort anlegen / bearbeiten ----------
function viewLocationForm(id, q) {
  const l = id ? Store.location(id) : null;
  if (id && !l) return notFound();
  const c = Store.customer(l ? l.customerId : q.get('kunde'));
  if (!c) return notFound();
  const hasLocations = Store.locationsOf(c.id).length > 0;
  const v = l || (hasLocations ? {} : { name: 'Hauptstandort', strasse: c.strasse, plz: c.plz, ort: c.ort });
  render(`
    ${crumbs({ c, l })}
    <h1>${l ? 'Standort bearbeiten' : 'Neuer Standort'}</h1>
    <form id="f" class="card">
      <div class="grid">
        ${field('name', 'Bezeichnung', v.name, { required: true, full: true, hint: 'z. B. „Filiale Innenstadt“, „Lager Nord“, „Hauptsitz“' })}
        ${field('strasse', 'Straße, Hausnr.', v.strasse, { full: true })}
        ${field('plz', 'PLZ', v.plz, { attrs: 'inputmode="numeric"' })}
        ${field('ort', 'Ort', v.ort)}
        ${field('ansprechpartner', 'Ansprechpartner vor Ort', v.ansprechpartner)}
        ${field('telefon', 'Telefon vor Ort', v.telefon, { type: 'tel' })}
        ${field('notizen', 'Notizen (Zugang, Schlüssel, …)', v.notizen, { type: 'textarea', full: true })}
      </div>
      <div class="actions">
        ${l ? '<button type="button" class="btn danger" id="del">Standort löschen</button>' : `<button type="button" class="btn ghost" id="copyAddr">Kundenanschrift übernehmen</button>`}
        <span class="spacer"></span>
        <a class="btn ghost" href="${l ? '#/standort/' + l.id : '#/kunde/' + c.id}">Abbrechen</a>
        <button class="btn primary" type="submit">Speichern</button>
      </div>
    </form>
  `);
  const f = document.getElementById('f');
  const copy = document.getElementById('copyAddr');
  if (copy) copy.addEventListener('click', () => {
    f.strasse.value = c.strasse || '';
    f.plz.value = c.plz || '';
    f.ort.value = c.ort || '';
  });
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const saved = await Store.upsert('locations', { ...formData(f), id: id || undefined, customerId: c.id });
    toast('Standort gespeichert');
    go('#/standort/' + saved.id);
  });
  const del = document.getElementById('del');
  if (del) del.addEventListener('click', async () => {
    const n = Store.systemsAt(id).length;
    if (!confirm(`Standort „${locationTitle(l)}“ wirklich löschen?${n ? `\nAuch ${n} Anlage(n) inkl. aller Einträge werden gelöscht!` : ''}`)) return;
    await Store.removeLocation(id);
    toast('Standort gelöscht');
    go('#/kunde/' + c.id);
  });
}

// ---------- Standortdetail mit Anlagen ----------
function viewLocation(id) {
  const l = Store.location(id);
  if (!l) return notFound();
  const c = Store.customer(l.customerId);
  const area = Areas.get(Areas.current);
  const all = Store.systemsAt(id);
  const systems = all.filter((s) => Areas.of(s) === area.key).sort((a, b) => systemTitle(a).localeCompare(systemTitle(b), 'de'));
  const others = Areas.keys.filter((k) => k !== area.key).map((k) => [k, all.filter((s) => Areas.of(s) === k).length]).filter(([, n]) => n);
  const sub = (s) => (Areas.isKaelte(s)
    ? [s.typ, s.kaeltemittel, s.fuellmenge ? fmtNum(s.fuellmenge, 3) + ' kg' : '', s.aufstellort]
    : [s.typ, s.hersteller, s.modell, s.aufstellort]).filter(Boolean).join(' · ');
  render(`
    ${crumbs({ c })}
    <div class="head-row">
      <h1>${esc(locationTitle(l))}</h1>
      <a class="btn" href="#/standort/${id}/bearbeiten">Bearbeiten</a>
    </div>
    <div class="card">
      <dl class="kv">
        <dt>Kunde</dt><dd>${esc(c.name)}</dd>
        <dt>Anschrift</dt><dd>${esc(customerAddress(l)) || '–'}</dd>
        ${l.ansprechpartner ? `<dt>Ansprechpartner</dt><dd>${esc(l.ansprechpartner)}</dd>` : ''}
        ${l.telefon ? `<dt>Telefon</dt><dd><a href="tel:${esc(l.telefon)}">${esc(l.telefon)}</a></dd>` : ''}
        ${l.notizen ? `<dt>Notizen</dt><dd>${esc(l.notizen)}</dd>` : ''}
      </dl>
    </div>
    <div class="head-row">
      <h2 style="margin:8px 0 0;flex:1">${area.icon} ${esc(area.label)}</h2>
      <a class="btn primary" href="#/anlage/neu?standort=${id}&bereich=${area.key}">+ Anlage anlegen</a>
    </div>
    ${systems.length ? `<ul class="list">${systems.map((s) => `
      <li><a class="list-item" href="#/anlage/${s.id}">
        <div class="grow"><div class="title">${esc(systemTitle(s))}</div>
        <div class="sub">${esc(sub(s))}</div>
        <div class="entry-meta">${dueBadge(s)}</div></div>
        <span class="chev">›</span></a></li>`).join('')}</ul>`
    : `<div class="empty">An diesem Standort ist noch keine Anlage im Bereich ${esc(area.short)} angelegt.</div>`}
    ${others.length ? `<p class="small muted" style="margin-top:12px">Weitere Anlagen an diesem Standort: ${others.map(([k, n]) =>
      `<a href="#/standort/${id}?bereich=${k}">${Areas.get(k).icon} ${n} × ${esc(Areas.get(k).short)}</a>`).join(' · ')}</p>` : ''}
  `);
}

// ---------- Anlage anlegen / bearbeiten ----------
function viewSystemForm(id, q) {
  const settings = Store.get().settings;
  const s = id ? Store.system(id) : null;
  if (id && !s) return notFound();
  const areaKey = s ? Areas.of(s) : (q.get('bereich') || Areas.current);
  if (areaKey !== 'kaelte') return Generic.systemForm(id, q, areaKey);
  const l = Store.location(s ? s.locationId : q.get('standort'));
  if (!l) return notFound();
  const c = Store.customer(l.customerId);
  if (!c) return notFound();
  const autoNr = Store.nextSystemNumber(c.id);
  const locOptions = Store.locationsOf(c.id).map((x) => [x.id, locationTitle(x) + (x.name && customerAddress(x) ? ' – ' + customerAddress(x) : '')]);
  const v = s || {
    locationId: l.id,
    kaeltemittel: '',
    wartungsintervall: '12',
    leckageSystem: 'nein',
    pruefintervall: 'auto',
    errichtetDurch: `${settings.firma}, ${settings.strasse}, ${settings.plzOrt} · Zertifikat-Nr. ${settings.zertifikatNr}`,
  };
  render(`
    ${crumbs({ c, l, s })}
    <h1>${s ? 'Anlage bearbeiten' : 'Neue Anlage'}</h1>
    <form id="f">
      <fieldset class="card">
        <legend>Anlage</legend>
        <div class="grid">
          ${field('anlagenNr', 'Anlagen-Nr.', v.anlagenNr || autoNr, {
            hint: autoNr
              ? (v.anlagenNr ? '' : 'automatisch vergeben (Kundennummer + laufende Nummer)')
              : `Für automatische Nummern beim Kunden eine <a href="#/kunde/${c.id}/bearbeiten">Kunden-Nr.</a> eintragen.`,
          })}
          ${field('bezeichnung', 'Bezeichnung', v.bezeichnung, { required: true, hint: 'z. B. „Klima Büro EG“' })}
          ${field('locationId', 'Standort', v.locationId || l.id, { type: 'select', options: locOptions, required: true })}
          ${field('aufstellort', 'Aufstellort (optional)', v.aufstellort, { hint: 'z. B. „Dach“, „Serverraum 2. OG“' })}
          ${field('typ', 'Anlagentyp', v.typ, { list: 'typen', hint: 'z. B. Split, Multisplit, VRF, Kaltwassersatz, Kühlzelle' })}
          ${field('hersteller', 'Hersteller', v.hersteller)}
          ${field('modell', 'Modell / Typ', v.modell)}
          ${field('seriennr', 'Serien-Nr.', v.seriennr)}
        </div>
      </fieldset>
      <fieldset class="card">
        <legend>Kältemittel &amp; Prüfpflicht</legend>
        <div class="grid">
          ${field('kaeltemittel', 'Kältemittel', v.kaeltemittel, { list: 'kaeltemittel', required: true })}
          ${field('gwp', 'GWP-Wert', v.gwp, { attrs: 'inputmode="decimal"', hint: 'wird bei bekanntem Kältemittel automatisch gesetzt' })}
          ${field('fuellmenge', 'Füllmenge (kg)', v.fuellmenge, { attrs: 'inputmode="decimal"', required: true })}
          <label class="field"><span>CO2-Äquivalent (t) = kg × GWP ÷ 1.000</span><input id="co2" readonly></label>
          <div class="field"><span>Leckage-Erkennungssystem vorhanden?</span>
            <div class="radio-row">
              <label><input type="radio" name="leckageSystem" value="ja"${v.leckageSystem === 'ja' ? ' checked' : ''}> ja</label>
              <label><input type="radio" name="leckageSystem" value="nein"${v.leckageSystem !== 'ja' ? ' checked' : ''}> nein</label>
            </div>
          </div>
          <label class="check"><input type="checkbox" name="hermetisch"${v.hermetisch ? ' checked' : ''}> hermetisch geschlossene Einrichtung (gekennzeichnet)</label>
          ${field('pruefintervall', 'Prüfintervall Dichtheitskontrolle', v.pruefintervall || 'auto', {
            type: 'select',
            options: [['auto', 'automatisch berechnen'], ['3', 'alle 3 Monate'], ['6', 'alle 6 Monate'], ['12', 'alle 12 Monate'], ['24', 'alle 24 Monate'], ['0', 'keine Pflicht']],
          })}
          <label class="field"><span>Ergebnis</span><input id="intervalOut" readonly></label>
        </div>
      </fieldset>
      <fieldset class="card">
        <legend>Wartung</legend>
        <div class="grid">
          ${field('wartungsintervall', 'Wartungsintervall', v.wartungsintervall === undefined ? '12' : v.wartungsintervall, {
            type: 'select',
            options: [['3', 'alle 3 Monate'], ['6', 'alle 6 Monate'], ['12', 'alle 12 Monate'], ['24', 'alle 24 Monate'], ['0', 'keine regelmäßige Wartung']],
            hint: 'Nächste Wartung = letzte Wartung (bzw. Errichtung) + Intervall. Erscheint auf der Startseite.',
          })}
        </div>
      </fieldset>
      <fieldset class="card">
        <legend>Errichtung</legend>
        <div class="grid">
          ${field('errichtetAm', 'Errichtet am', v.errichtetAm, { type: 'date' })}
          ${field('errichtetDurch', 'Errichtet durch (Fachbetrieb, Zertifikat-Nr.)', v.errichtetDurch, { type: 'textarea', full: true })}
        </div>
      </fieldset>
      <div class="actions">
        ${s ? '<button type="button" class="btn danger" id="del">Anlage löschen</button>' : ''}
        <span class="spacer"></span>
        <a class="btn ghost" href="${s ? '#/anlage/' + s.id : '#/standort/' + l.id}">Abbrechen</a>
        <button class="btn primary" type="submit">Speichern</button>
      </div>
      <datalist id="kaeltemittel">${Object.keys(FGas.REFRIGERANTS).map((k) => `<option value="${esc(k)}">`).join('')}</datalist>
      <datalist id="typen">${['Split-Klimagerät', 'Multisplit', 'VRF/VRV-System', 'Kaltwassersatz', 'Wärmepumpe', 'Kühlzelle', 'Tiefkühlzelle', 'Kühlmöbel', 'Rückkühler'].map((k) => `<option value="${k}">`).join('')}</datalist>
    </form>
  `);
  const f = document.getElementById('f');
  const update = () => {
    const d = formData(f);
    const t = FGas.co2e(d);
    document.getElementById('co2').value = isFinite(t) ? fmtNum(t, 2) + ' t CO2e' : '';
    const m = FGas.interval(d);
    const auto = FGas.autoInterval(d);
    document.getElementById('intervalOut').value = FGas.intervalLabel(m) + (d.pruefintervall !== 'auto' && m !== auto ? ` (berechnet: ${FGas.intervalLabel(auto)})` : '');
  };
  f.kaeltemittel.addEventListener('input', () => {
    const gwp = FGas.REFRIGERANTS[f.kaeltemittel.value];
    if (gwp !== undefined) f.gwp.value = String(gwp).replace('.', ',');
    update();
  });
  f.addEventListener('input', update);
  update();
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const d = formData(f);
    Store.noteSystemNumber(c.id, d.anlagenNr);
    const saved = await Store.upsert('systems', { ...d, id: id || undefined, customerId: c.id });
    toast('Anlage gespeichert');
    go('#/anlage/' + saved.id);
  });
  const del = document.getElementById('del');
  if (del) del.addEventListener('click', async () => {
    const n = Store.entriesOf(id).length;
    if (!confirm(`Anlage „${systemTitle(s)}“ wirklich löschen?${n ? `\nAuch ${n} Eintrag/Einträge werden gelöscht!` : ''}`)) return;
    await Store.removeSystem(id);
    toast('Anlage gelöscht');
    go('#/standort/' + l.id);
  });
}

// ---------- Anlagendetail mit Einträgen ----------
function viewSystem(id) {
  const s = Store.system(id);
  if (!s) return notFound();
  if (!Areas.isKaelte(s)) return Generic.systemView(id);
  const c = Store.customer(s.customerId);
  const l = Store.location(s.locationId);
  const entries = Store.entriesOf(id);
  const t = FGas.co2e(s);
  const due = FGas.nextDue(s, entries);
  const dueSt = FGas.dueStatus(due);
  const maint = FGas.nextMaintenance(s, entries);
  const maintSt = FGas.dueStatus(maint);
  const alerts = [[due, dueSt], [maint, maintSt]].filter(([d, st]) => d && (st.cls === 'danger' || st.cls === 'warn'));
  const sumAdd = entries.reduce((a, e) => a + (FGas.num(e.mengeZugefuegt) || 0), 0);
  const sumRem = entries.reduce((a, e) => a + (FGas.num(e.mengeEntnommen) || 0), 0);
  render(`
    ${crumbs({ c, l })}
    <div class="head-row">
      <h1>${esc(systemTitle(s))}</h1>
      <a class="btn" href="#/anlage/${id}/bearbeiten">Bearbeiten</a>
    </div>
    ${alerts.map(([d, st]) => `<div class="notice ${st.cls}"><strong>${esc(d.reason)}:</strong> ${esc(st.text)}</div>`).join('')}
    <div class="card">
      <dl class="kv">
        <dt>Betreiber</dt><dd>${esc(c.name)}${customerAddress(c) ? ', ' + esc(customerAddress(c)) : ''}</dd>
        <dt>Standort</dt><dd>${esc(locationText(l, s)) || '–'}</dd>
        <dt>Anlagentyp</dt><dd>${esc(s.typ) || '–'}</dd>
        ${s.hersteller || s.modell || s.seriennr ? `<dt>Hersteller / Modell / S/N</dt><dd>${esc([s.hersteller, s.modell, s.seriennr].filter(Boolean).join(' / '))}</dd>` : ''}
        <dt>Kältemittel</dt><dd>${esc(s.kaeltemittel) || '–'} (GWP ${fmtNum(s.gwp, 3) || '–'})</dd>
        <dt>Füllmenge</dt><dd>${fmtNum(s.fuellmenge, 3) || '–'} kg</dd>
        <dt>CO2-Äquivalent</dt><dd>${isFinite(t) ? fmtNum(t, 2) + ' t' : '–'}</dd>
        <dt>Leckage-Erkennung</dt><dd>${s.leckageSystem === 'ja' ? 'ja' : 'nein'}${s.hermetisch ? ' · hermetisch geschlossen' : ''}</dd>
        <dt>Prüfintervall</dt><dd>${FGas.intervalLabel(FGas.interval(s))}</dd>
        <dt>Nächste Dichtheitskontrolle</dt><dd><span class="badge ${dueSt.cls}">${esc(dueSt.text)}</span></dd>
        <dt>Wartungsintervall</dt><dd>${FGas.maintInterval(s) ? 'alle ' + FGas.maintInterval(s) + ' Monate' : 'keine regelmäßige Wartung'}</dd>
        <dt>Nächste Wartung</dt><dd><span class="badge ${maint ? maintSt.cls : ''}">${esc(maint ? maintSt.text : '–')}</span></dd>
        <dt>Errichtet</dt><dd>${esc([fmtDate(s.errichtetAm), s.errichtetDurch].filter(Boolean).join(' · ')) || '–'}</dd>
        ${entries.length ? `<dt>Summe zugefügt / entnommen</dt><dd>${fmtNum(sumAdd, 3)} kg / ${fmtNum(sumRem, 3)} kg</dd>` : ''}
      </dl>
      <div class="actions">
        <button class="btn" id="pdf">${FileOut.isNative() ? 'PDF speichern / teilen' : 'PDF herunterladen'}</button>
        ${FileOut.canShareFiles() && !FileOut.isNative() ? '<button class="btn" id="share">PDF teilen</button>' : ''}
      </div>
    </div>
    <div class="head-row">
      <h2 style="margin:8px 0 0;flex:1">Einträge / Prüfungen</h2>
      <a class="btn primary" href="#/eintrag/neu?anlage=${id}">+ Neuer Eintrag</a>
    </div>
    ${entries.length ? `<ul class="list">${[...entries].reverse().map((e) => `
      <li><a class="list-item" href="#/eintrag/${e.id}">
        <div class="grow">
          <div class="title">${fmtDate(e.datum)} · ${esc(e.taetigkeit)}</div>
          <div class="sub">${esc([
            e.ergebnis ? 'Ergebnis: ' + e.ergebnis : '',
            FGas.num(e.mengeZugefuegt) ? '+' + fmtNum(e.mengeZugefuegt, 3) + ' kg' : '',
            FGas.num(e.mengeEntnommen) ? '−' + fmtNum(e.mengeEntnommen, 3) + ' kg' : '',
            e.techniker,
          ].filter(Boolean).join(' · '))}</div>
          <div class="entry-meta">${e.sigTechniker ? '<span class="badge ok">✓ unterschrieben</span>' : '<span class="badge warn">nicht unterschrieben</span>'}
            ${e.ergebnis === 'Leckage' ? '<span class="badge danger">Leckage</span>' : ''}</div>
        </div><span class="chev">›</span></a></li>`).join('')}</ul>`
    : `<div class="empty">Noch keine Einträge. Lege die erste Prüfung/Tätigkeit an.</div>`}
  `);
  bindPdfButtons(id, s);
}

function bindPdfButtons(id, s) {
  document.getElementById('pdf').addEventListener('click', async () => {
    try {
      await PdfExport.download(id);
    } catch (err) {
      console.error(err);
      if (err.name !== 'AbortError' && !/cancel/i.test(err.message)) alert('PDF konnte nicht erstellt werden: ' + err.message);
    }
  });
  const share = document.getElementById('share');
  if (share) share.addEventListener('click', async () => {
    try {
      await FileOut.share(PdfExport.build(id).output('blob'), PdfExport.filename(id), 'Anlagenbuch ' + systemTitle(s));
    } catch (err) {
      if (err.name !== 'AbortError') alert('Teilen fehlgeschlagen: ' + err.message);
    }
  });
}

// ---------- Eintrag anlegen / bearbeiten ----------
function viewEntryForm(id, q) {
  const settings = Store.get().settings;
  const e = id ? Store.entry(id) : null;
  if (id && !e) return notFound();
  if (e && (e.sigTechniker || e.sigKunde)) return go('#/eintrag/' + id);
  const s = Store.system(e ? e.systemId : q.get('anlage'));
  if (!s) return notFound();
  if (!Areas.isKaelte(s)) return Generic.entryForm(id, q);
  const c = Store.customer(s.customerId);
  const v = e || {
    datum: today(),
    taetigkeit: 'Dichtheitskontrolle',
    fachbetrieb: `${settings.firma} (Zert.-Nr. ${settings.zertifikatNr})`,
    techniker: settings.techniker,
    technikerZertNr: settings.technikerZertNr,
    herkunft: '',
    ergebnis: '',
  };
  render(`
    ${crumbs({ c, l: Store.location(s.locationId), s })}
    <h1>${e ? 'Eintrag bearbeiten' : 'Neuer Eintrag'}</h1>
    <form id="f">
      <fieldset class="card">
        <legend>Tätigkeit</legend>
        <div class="grid">
          ${field('datum', 'Datum', v.datum, { type: 'date', required: true })}
          ${field('taetigkeit', 'Tätigkeit', v.taetigkeit, { type: 'select', options: FGas.TAETIGKEITEN, required: true })}
          ${field('ergebnis', 'Ergebnis Dichtheitskontrolle', v.ergebnis, { type: 'select', options: [['', '– keine Kontrolle –'], ...FGas.ERGEBNIS] })}
        </div>
      </fieldset>
      <fieldset class="card">
        <legend>Kältemittel</legend>
        <div class="grid">
          ${field('mengeZugefuegt', 'Menge zugefügt (kg)', v.mengeZugefuegt, { attrs: 'inputmode="decimal"' })}
          ${field('mengeEntnommen', 'Menge entnommen (kg)', v.mengeEntnommen, { attrs: 'inputmode="decimal"' })}
          ${field('herkunft', 'Herkunft (bei Zufügen)', v.herkunft, { type: 'select', options: [['', '–'], ...FGas.HERKUNFT] })}
        </div>
      </fieldset>
      <fieldset class="card" id="leakBox">
        <legend>Leckage</legend>
        <div class="grid">
          ${field('leckageUrsache', 'Ursache & Reparatur', v.leckageUrsache, { type: 'textarea', full: true })}
          ${field('nachkontrolleAm', 'Nachkontrolle am', v.nachkontrolleAm, { type: 'date', hint: 'Pflicht innerhalb eines Monats nach Reparatur' })}
        </div>
      </fieldset>
      <fieldset class="card">
        <legend>Ausführung</legend>
        <div class="grid">
          ${field('fachbetrieb', 'Fachbetrieb (+ Zertifikat-Nr.)', v.fachbetrieb, { full: true })}
          ${field('techniker', 'Techniker', v.techniker, { required: true })}
          ${field('technikerZertNr', 'Personal-Zertifikat-Nr.', v.technikerZertNr)}
          ${field('bemerkung', 'Bemerkung', v.bemerkung, { type: 'textarea', full: true })}
        </div>
      </fieldset>
      <div class="actions">
        ${e ? '<button type="button" class="btn danger" id="del">Eintrag löschen</button>' : ''}
        <span class="spacer"></span>
        <a class="btn ghost" href="${e ? '#/eintrag/' + e.id : '#/anlage/' + s.id}">Abbrechen</a>
        <button class="btn primary" type="submit">Speichern &amp; weiter zur Unterschrift</button>
      </div>
    </form>
  `);
  const f = document.getElementById('f');
  const toggleLeak = () => {
    const show = f.ergebnis.value === 'Leckage' || f.taetigkeit.value === 'Reparatur' || f.leckageUrsache.value;
    document.getElementById('leakBox').hidden = !show;
  };
  f.addEventListener('change', toggleLeak);
  toggleLeak();
  f.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const d = formData(f);
    if (FGas.num(d.mengeZugefuegt) > 0 && !d.herkunft) {
      alert('Bitte die Herkunft des zugefügten Kältemittels angeben (neu / recycelt / aufgearbeitet).');
      f.herkunft.focus();
      return;
    }
    const saved = await Store.upsert('entries', { ...d, id: id || undefined, systemId: s.id });
    toast('Eintrag gespeichert');
    go('#/eintrag/' + saved.id);
  });
  const del = document.getElementById('del');
  if (del) del.addEventListener('click', async () => {
    if (!confirm('Eintrag wirklich löschen?')) return;
    await Store.removeEntry(id);
    toast('Eintrag gelöscht');
    go('#/anlage/' + s.id);
  });
}

// ---------- Eintrag ansehen & unterschreiben ----------
function sigBox(e, role) {
  const key = role === 'kunde' ? 'sigKunde' : 'sigTechniker';
  const sig = e[key];
  const title = role === 'kunde' ? 'Unterschrift Betreiber / Kunde' : 'Unterschrift Techniker';
  return `<div class="sig-box">
    <h3>${title}${role === 'kunde' ? ' <span class="muted small">(optional)</span>' : ''}</h3>
    ${sig ? `<img src="${sig.img}" alt="${title}">
      <div class="small" style="margin-top:6px">${esc(sig.name)} · ${esc(fmtDateTime(sig.at))}</div>`
    : `<div class="none">noch nicht unterschrieben</div>
      <div class="actions" style="margin-top:10px"><button class="btn primary" data-sign="${role}">Jetzt unterschreiben</button></div>`}
  </div>`;
}

function viewEntry(id) {
  const e = Store.entry(id);
  if (!e) return notFound();
  const s = Store.system(e.systemId);
  const c = Store.customer(s.customerId);
  const locked = !!(e.sigTechniker || e.sigKunde);
  const row = (k, val) => (val ? `<dt>${k}</dt><dd>${esc(val)}</dd>` : '');
  render(`
    ${crumbs({ c, l: Store.location(s.locationId), s })}
    <div class="head-row">
      <h1>${fmtDate(e.datum)} · ${esc(e.taetigkeit)}</h1>
      ${locked ? '' : `<a class="btn" href="#/eintrag/${id}/bearbeiten">Bearbeiten</a>`}
    </div>
    ${locked ? '<div class="notice">Dieser Eintrag ist unterschrieben und damit gesperrt. Zum Ändern müssen die Unterschriften zurückgesetzt werden.</div>' : ''}
    <div class="card">
      <dl class="kv">
        ${Areas.isKaelte(s) ? `${row('Datum', fmtDate(e.datum))}
        ${row('Tätigkeit', e.taetigkeit)}
        ${row('Menge zugefügt', fmtNum(e.mengeZugefuegt, 3) && fmtNum(e.mengeZugefuegt, 3) + ' kg')}
        ${row('Menge entnommen', fmtNum(e.mengeEntnommen, 3) && fmtNum(e.mengeEntnommen, 3) + ' kg')}
        ${row('Herkunft', e.herkunft)}
        ${row('Ergebnis Dichtheitskontrolle', e.ergebnis)}
        ${row('Leckage: Ursache & Reparatur', e.leckageUrsache)}
        ${row('Nachkontrolle am', fmtDate(e.nachkontrolleAm))}
        ${row('Fachbetrieb', e.fachbetrieb)}
        ${row('Techniker', [e.techniker, e.technikerZertNr ? 'Zert.-Nr. ' + e.technikerZertNr : ''].filter(Boolean).join(', '))}
        ${row('Bemerkung', e.bemerkung)}` : Generic.entryRows(e, s)}
      </dl>
    </div>
    <h2>Unterschriften</h2>
    <div class="sig-grid">${sigBox(e, 'techniker')}${sigBox(e, 'kunde')}</div>
    <div class="actions">
      ${locked ? '<button class="btn danger" id="unsign">Unterschriften zurücksetzen</button>' : ''}
      <span class="spacer"></span>
      <a class="btn primary" href="#/anlage/${s.id}">Fertig – zur Anlage</a>
    </div>
  `);
  main.querySelectorAll('[data-sign]').forEach((b) => b.addEventListener('click', () => {
    const role = b.dataset.sign;
    const settings = Store.get().settings;
    const name = role === 'kunde' ? (c.ansprechpartner || c.name) : (e.techniker || settings.techniker);
    const hint = role === 'kunde'
      ? 'Der Betreiber bestätigt die Durchführung der oben dokumentierten Arbeiten.'
      : `Der Techniker bestätigt die Richtigkeit der Angaben${Areas.isKaelte(s) ? ' (Art. 7 VO (EU) 2024/573)' : ''}.`;
    Signature.open({ title: role === 'kunde' ? 'Unterschrift Betreiber / Kunde' : 'Unterschrift Techniker', hint, name }, async (sig) => {
      const key = role === 'kunde' ? 'sigKunde' : 'sigTechniker';
      await Store.upsert('entries', { id, [key]: { ...sig, role, at: new Date().toISOString() } });
      toast('Unterschrift gespeichert');
      viewEntry(id);
    });
  }));
  const unsign = document.getElementById('unsign');
  if (unsign) unsign.addEventListener('click', async () => {
    if (!confirm('Alle Unterschriften dieses Eintrags entfernen? Der Eintrag kann danach wieder bearbeitet werden und muss neu unterschrieben werden.')) return;
    const cur = Store.entry(id);
    delete cur.sigTechniker;
    delete cur.sigKunde;
    await Store.save();
    toast('Unterschriften entfernt');
    viewEntry(id);
  });
}

// ---------- Unterschriften-Dialog ----------
const Signature = (() => {
  const modal = document.getElementById('sigModal');
  const pad = new SignaturePad(document.getElementById('sigCanvas'));
  const nameInput = document.getElementById('sigName');
  let callback = null;

  function close() {
    modal.hidden = true;
    callback = null;
    document.body.style.overflow = '';
  }

  document.getElementById('sigClear').addEventListener('click', () => pad.clear());
  document.getElementById('sigCancel').addEventListener('click', close);
  document.getElementById('sigOk').addEventListener('click', () => {
    if (pad.isEmpty()) { alert('Bitte im Feld unterschreiben.'); return; }
    if (!nameInput.value.trim()) { alert('Bitte den Namen des Unterzeichners eintragen.'); nameInput.focus(); return; }
    const out = pad.export();
    const cb = callback;
    close();
    cb({ ...out, name: nameInput.value.trim() });
  });

  function open({ title, hint, name }, cb) {
    callback = cb;
    document.getElementById('sigTitle').textContent = title;
    document.getElementById('sigHint').textContent = hint;
    nameInput.value = name || '';
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    pad.clear();
    requestAnimationFrame(() => pad.resize());
  }

  return { open };
})();

// ---------- Einstellungen & Datensicherung ----------
function viewSettings() {
  const st = Store.get();
  const s = st.settings;
  render(`
    <h1>Einstellungen</h1>
    <form id="f" class="card">
      <h3>Fachbetrieb (erscheint im PDF)</h3>
      <div class="grid">
        ${field('firma', 'Firmenname', s.firma, { full: true, required: true })}
        ${field('strasse', 'Straße', s.strasse)}
        ${field('plzOrt', 'PLZ Ort', s.plzOrt)}
        ${field('telefon', 'Telefon', s.telefon, { type: 'tel' })}
        ${field('email', 'E-Mail', s.email, { type: 'email' })}
        ${field('zertifikatNr', 'Betriebs-Zertifikat-Nr.', s.zertifikatNr)}
      </div>
      <h3 style="margin-top:16px">Vorgaben für neue Einträge</h3>
      <div class="grid">
        ${field('techniker', 'Techniker (Standard)', s.techniker)}
        ${field('technikerZertNr', 'Personal-Zertifikat-Nr. (Standard)', s.technikerZertNr)}
      </div>
      <div class="actions"><span class="spacer"></span><button class="btn primary" type="submit">Speichern</button></div>
    </form>
    <div class="card">
      <h3>Datensicherung</h3>
      <p class="muted small">Alle Daten werden nur auf diesem Gerät im Browser gespeichert. Erstelle regelmäßig eine Sicherung
        (Aufbewahrungspflicht mindestens 5 Jahre!) und bewahre sie z. B. in der Cloud oder auf dem PC auf.
        Mit der Sicherungsdatei kannst du die Daten auch auf ein anderes Gerät übertragen.</p>
      <p class="small">${st.customers.length} Kunden · ${st.locations.length} Standorte · ${st.systems.length} Anlagen · ${st.entries.length} Einträge</p>
      <div class="actions">
        <button class="btn" id="exp">Sicherung exportieren (.json)</button>
        <label class="btn">Sicherung importieren<input type="file" id="imp" accept="application/json,.json" hidden></label>
      </div>
    </div>
  `, 'einstellungen');
  document.getElementById('f').addEventListener('submit', async (e) => {
    e.preventDefault();
    Object.assign(Store.get().settings, formData(e.target));
    await Store.save();
    toast('Einstellungen gespeichert');
  });
  document.getElementById('exp').addEventListener('click', async () => {
    const blob = new Blob([JSON.stringify(Store.get(), null, 1)], { type: 'application/json' });
    try {
      await FileOut.save(blob, `Anlagenbuch_Sicherung_${today()}.json`, 'Anlagenbuch-Sicherung');
    } catch (err) {
      if (!/cancel/i.test(err.message)) alert('Sicherung fehlgeschlagen: ' + err.message);
    }
  });
  document.getElementById('imp').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!data || !Array.isArray(data.customers) || !Array.isArray(data.systems) || !Array.isArray(data.entries)) throw new Error('Keine gültige Sicherungsdatei.');
      if (!confirm(`Sicherung mit ${data.customers.length} Kunden, ${data.systems.length} Anlagen und ${data.entries.length} Einträgen laden?\nDie aktuellen Daten auf diesem Gerät werden dabei ERSETZT.`)) return;
      await Store.replace(data);
      toast('Sicherung importiert');
      viewSettings();
    } catch (err) {
      alert('Import fehlgeschlagen: ' + err.message);
    } finally {
      e.target.value = '';
    }
  });
}

// ---------- Router ----------
function router() {
  const hash = location.hash.slice(1) || '/';
  const [path, qs] = hash.split('?');
  const q = new URLSearchParams(qs || '');
  const p = path.split('/').filter(Boolean);
  if (Signature && !document.getElementById('sigModal').hidden) document.getElementById('sigCancel').click();
  if (q.get('bereich')) Areas.setCurrent(q.get('bereich'));

  if (p.length === 0) return viewAreas();
  if (p[0] === 'b') {
    Areas.setCurrent(p[1]);
    return viewHome(q);
  }
  if (p[0] === 'einstellungen') return viewSettings();
  if (p[0] === 'kunde') {
    if (p[1] === 'neu') return viewCustomerForm(null);
    if (p[2] === 'bearbeiten') return viewCustomerForm(p[1]);
    return viewCustomer(p[1]);
  }
  if (p[0] === 'standort') {
    if (p[1] === 'neu') return viewLocationForm(null, q);
    if (p[2] === 'bearbeiten') return viewLocationForm(p[1], q);
    return viewLocation(p[1]);
  }
  const sysArea = (sysId) => { const x = Store.system(sysId); if (x) Areas.setCurrent(Areas.of(x)); };
  if (p[0] === 'anlage') {
    if (p[1] !== 'neu') sysArea(p[1]);
    if (p[1] === 'neu') return viewSystemForm(null, q);
    if (p[2] === 'bearbeiten') return viewSystemForm(p[1], q);
    return viewSystem(p[1]);
  }
  if (p[0] === 'eintrag') {
    const en = Store.entry(p[1]);
    sysArea(en ? en.systemId : q.get('anlage'));
    if (p[1] === 'neu') return viewEntryForm(null, q);
    if (p[2] === 'bearbeiten') return viewEntryForm(p[1], q);
    return viewEntry(p[1]);
  }
  return notFound();
}

(async function init() {
  await Store.load();
  window.addEventListener('hashchange', router);
  router();
  if ('serviceWorker' in navigator && location.protocol !== 'file:' && !FileOut.isNative()) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
