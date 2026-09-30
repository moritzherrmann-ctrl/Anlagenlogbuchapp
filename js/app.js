/* Oberfläche: Kunden → Anlagen → Einträge (Prüfungen) mit digitaler Unterschrift */
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

function render(html, nav = 'kunden') {
  main.innerHTML = html;
  setActiveNav(nav);
  window.scrollTo(0, 0);
}

function notFound() {
  render(`<div class="empty">Nicht gefunden. <a href="#/">Zur Kundenliste</a></div>`);
}

function systemTitle(s) {
  return [s.anlagenNr, s.bezeichnung].filter(Boolean).join(' – ') || 'Anlage ohne Bezeichnung';
}

function dueBadge(sys) {
  const st = FGas.dueStatus(FGas.nextDue(sys, Store.entriesOf(sys.id)));
  return `<span class="badge ${st.cls}">${esc(st.text)}</span>`;
}

// ---------- Kundenliste (Start) ----------
function viewCustomers(q) {
  const st = Store.get();
  const term = (q.get('q') || '').toLowerCase();
  const customers = [...st.customers]
    .filter((c) => !term || [c.name, c.ansprechpartner, c.ort, c.strasse, c.kundennr].join(' ').toLowerCase().includes(term))
    .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'de'));

  // Fällige Prüfungen
  const dueList = st.systems.map((s) => ({ s, due: FGas.nextDue(s, Store.entriesOf(s.id)) }))
    .filter(({ due }) => due && (!due.date || due.date <= FGas.addMonths(today(), 1)))
    .sort((a, b) => (a.due.date || '').localeCompare(b.due.date || ''));

  render(`
    <div class="head-row">
      <h1>Kunden</h1>
      <a class="btn primary" href="#/kunde/neu">+ Kunde anlegen</a>
    </div>
    ${dueList.length ? `
      <div class="card">
        <h3>Anstehende / überfällige Prüfungen</h3>
        <ul class="list">${dueList.map(({ s }) => {
          const c = Store.customer(s.customerId);
          return `<li><a class="list-item" href="#/anlage/${s.id}">
            <div class="grow"><div class="title">${esc(systemTitle(s))}</div><div class="sub">${esc(c ? c.name : '')}</div></div>
            ${dueBadge(s)}</a></li>`;
        }).join('')}</ul>
      </div>` : ''}
    <input class="search" type="search" id="search" placeholder="Kunden suchen …" value="${esc(q.get('q') || '')}">
    ${customers.length ? `<ul class="list">${customers.map((c) => {
      const n = Store.systemsOf(c.id).length;
      return `<li><a class="list-item" href="#/kunde/${c.id}">
        <div class="grow"><div class="title">${esc(c.name)}</div>
        <div class="sub">${esc(customerAddress(c))}</div></div>
        <span class="badge">${n} ${n === 1 ? 'Anlage' : 'Anlagen'}</span><span class="chev">›</span></a></li>`;
    }).join('')}</ul>`
    : `<div class="empty">${term ? 'Keine Treffer.' : 'Noch keine Kunden angelegt.<br><br><a class="btn primary" href="#/kunde/neu">+ Ersten Kunden anlegen</a>'}</div>`}
  `);
  const s = document.getElementById('search');
  s.addEventListener('input', () => {
    history.replaceState(null, '', '#/?q=' + encodeURIComponent(s.value));
    const pos = s.selectionStart;
    viewCustomers(new URLSearchParams('q=' + encodeURIComponent(s.value)));
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
    <div class="crumbs"><a href="#/">Kunden</a>${id ? ` › <a href="#/kunde/${c.id}">${esc(c.name)}</a>` : ''}</div>
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
      </div>
      <div class="actions">
        ${id ? '<button type="button" class="btn danger" id="del">Kunde löschen</button>' : ''}
        <span class="spacer"></span>
        <a class="btn ghost" href="${id ? '#/kunde/' + id : '#/'}">Abbrechen</a>
        <button class="btn primary" type="submit">Speichern</button>
      </div>
    </form>
  `);
  document.getElementById('f').addEventListener('submit', async (e) => {
    e.preventDefault();
    const saved = await Store.upsert('customers', { ...formData(e.target), id: id || undefined });
    toast('Kunde gespeichert');
    go(id ? '#/kunde/' + id : '#/kunde/' + saved.id);
  });
  const del = document.getElementById('del');
  if (del) del.addEventListener('click', async () => {
    const n = Store.systemsOf(id).length;
    if (!confirm(`Kunde „${c.name}“ wirklich löschen?${n ? `\nAuch ${n} Anlage(n) inkl. aller Einträge werden gelöscht!` : ''}`)) return;
    await Store.removeCustomer(id);
    toast('Kunde gelöscht');
    go('#/');
  });
}

// ---------- Kundendetail mit Anlagen ----------
function viewCustomer(id) {
  const c = Store.customer(id);
  if (!c) return notFound();
  const systems = Store.systemsOf(id).sort((a, b) => systemTitle(a).localeCompare(systemTitle(b), 'de'));
  render(`
    <div class="crumbs"><a href="#/">Kunden</a></div>
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
      <h2 style="margin:8px 0 0;flex:1">Anlagen</h2>
      <a class="btn primary" href="#/anlage/neu?kunde=${id}">+ Anlage anlegen</a>
    </div>
    ${systems.length ? `<ul class="list">${systems.map((s) => `
      <li><a class="list-item" href="#/anlage/${s.id}">
        <div class="grow"><div class="title">${esc(systemTitle(s))}</div>
        <div class="sub">${esc([s.typ, s.kaeltemittel, s.fuellmenge ? fmtNum(s.fuellmenge, 3) + ' kg' : '', s.standort].filter(Boolean).join(' · '))}</div></div>
        ${dueBadge(s)}<span class="chev">›</span></a></li>`).join('')}</ul>`
    : `<div class="empty">Für diesen Kunden ist noch keine Anlage angelegt.</div>`}
  `);
}

// ---------- Anlage anlegen / bearbeiten ----------
function viewSystemForm(id, q) {
  const settings = Store.get().settings;
  const s = id ? Store.system(id) : null;
  if (id && !s) return notFound();
  const customerId = s ? s.customerId : q.get('kunde');
  const c = Store.customer(customerId);
  if (!c) return notFound();
  const v = s || {
    standort: customerAddress(c),
    kaeltemittel: '',
    leckageSystem: 'nein',
    pruefintervall: 'auto',
    errichtetDurch: `${settings.firma}, ${settings.strasse}, ${settings.plzOrt} · Zertifikat-Nr. ${settings.zertifikatNr}`,
  };
  render(`
    <div class="crumbs"><a href="#/">Kunden</a> › <a href="#/kunde/${c.id}">${esc(c.name)}</a>${s ? ` › <a href="#/anlage/${s.id}">${esc(systemTitle(s))}</a>` : ''}</div>
    <h1>${s ? 'Anlage bearbeiten' : 'Neue Anlage'}</h1>
    <form id="f">
      <fieldset class="card">
        <legend>Anlage</legend>
        <div class="grid">
          ${field('anlagenNr', 'Anlagen-Nr.', v.anlagenNr)}
          ${field('bezeichnung', 'Bezeichnung', v.bezeichnung, { required: true, hint: 'z. B. „Klima Büro EG“' })}
          ${field('standort', 'Anlagen-Standort', v.standort, { full: true })}
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
        <legend>Errichtung</legend>
        <div class="grid">
          ${field('errichtetAm', 'Errichtet am', v.errichtetAm, { type: 'date' })}
          ${field('errichtetDurch', 'Errichtet durch (Fachbetrieb, Zertifikat-Nr.)', v.errichtetDurch, { type: 'textarea', full: true })}
        </div>
      </fieldset>
      <div class="actions">
        ${s ? '<button type="button" class="btn danger" id="del">Anlage löschen</button>' : ''}
        <span class="spacer"></span>
        <a class="btn ghost" href="${s ? '#/anlage/' + s.id : '#/kunde/' + c.id}">Abbrechen</a>
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
    go('#/kunde/' + c.id);
  });
}

// ---------- Anlagendetail mit Einträgen ----------
function viewSystem(id) {
  const s = Store.system(id);
  if (!s) return notFound();
  const c = Store.customer(s.customerId);
  const entries = Store.entriesOf(id);
  const t = FGas.co2e(s);
  const due = FGas.nextDue(s, entries);
  const dueSt = FGas.dueStatus(due);
  const sumAdd = entries.reduce((a, e) => a + (FGas.num(e.mengeZugefuegt) || 0), 0);
  const sumRem = entries.reduce((a, e) => a + (FGas.num(e.mengeEntnommen) || 0), 0);
  render(`
    <div class="crumbs"><a href="#/">Kunden</a> › <a href="#/kunde/${c.id}">${esc(c.name)}</a></div>
    <div class="head-row">
      <h1>${esc(systemTitle(s))}</h1>
      <a class="btn" href="#/anlage/${id}/bearbeiten">Bearbeiten</a>
    </div>
    ${dueSt.cls === 'danger' || dueSt.cls === 'warn' ? `<div class="notice ${dueSt.cls}"><strong>${esc(due.reason)}:</strong> ${esc(dueSt.text)}</div>` : ''}
    <div class="card">
      <dl class="kv">
        <dt>Betreiber</dt><dd>${esc(c.name)}${customerAddress(c) ? ', ' + esc(customerAddress(c)) : ''}</dd>
        <dt>Standort</dt><dd>${esc(s.standort) || '–'}</dd>
        <dt>Anlagentyp</dt><dd>${esc(s.typ) || '–'}</dd>
        ${s.hersteller || s.modell || s.seriennr ? `<dt>Hersteller / Modell / S/N</dt><dd>${esc([s.hersteller, s.modell, s.seriennr].filter(Boolean).join(' / '))}</dd>` : ''}
        <dt>Kältemittel</dt><dd>${esc(s.kaeltemittel) || '–'} (GWP ${fmtNum(s.gwp, 3) || '–'})</dd>
        <dt>Füllmenge</dt><dd>${fmtNum(s.fuellmenge, 3) || '–'} kg</dd>
        <dt>CO2-Äquivalent</dt><dd>${isFinite(t) ? fmtNum(t, 2) + ' t' : '–'}</dd>
        <dt>Leckage-Erkennung</dt><dd>${s.leckageSystem === 'ja' ? 'ja' : 'nein'}${s.hermetisch ? ' · hermetisch geschlossen' : ''}</dd>
        <dt>Prüfintervall</dt><dd>${FGas.intervalLabel(FGas.interval(s))}</dd>
        <dt>Nächste Kontrolle</dt><dd><span class="badge ${dueSt.cls}">${esc(dueSt.text)}</span></dd>
        <dt>Errichtet</dt><dd>${esc([fmtDate(s.errichtetAm), s.errichtetDurch].filter(Boolean).join(' · ')) || '–'}</dd>
        ${entries.length ? `<dt>Summe zugefügt / entnommen</dt><dd>${fmtNum(sumAdd, 3)} kg / ${fmtNum(sumRem, 3)} kg</dd>` : ''}
      </dl>
      <div class="actions">
        <button class="btn" id="pdf">PDF herunterladen</button>
        ${navigator.canShare ? '<button class="btn" id="share">PDF teilen</button>' : ''}
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
  document.getElementById('pdf').addEventListener('click', () => {
    try {
      PdfExport.download(id);
    } catch (err) {
      console.error(err);
      alert('PDF konnte nicht erstellt werden: ' + err.message);
    }
  });
  const share = document.getElementById('share');
  if (share) share.addEventListener('click', async () => {
    try {
      const blob = PdfExport.build(id).output('blob');
      const file = new File([blob], PdfExport.filename(id), { type: 'application/pdf' });
      if (!navigator.canShare({ files: [file] })) { alert('Teilen von Dateien wird auf diesem Gerät nicht unterstützt.'); return; }
      await navigator.share({ files: [file], title: 'Anlagenbuch ' + systemTitle(s) });
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
    <div class="crumbs"><a href="#/">Kunden</a> › <a href="#/kunde/${c.id}">${esc(c.name)}</a> › <a href="#/anlage/${s.id}">${esc(systemTitle(s))}</a></div>
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
    <div class="crumbs"><a href="#/">Kunden</a> › <a href="#/kunde/${c.id}">${esc(c.name)}</a> › <a href="#/anlage/${s.id}">${esc(systemTitle(s))}</a></div>
    <div class="head-row">
      <h1>${fmtDate(e.datum)} · ${esc(e.taetigkeit)}</h1>
      ${locked ? '' : `<a class="btn" href="#/eintrag/${id}/bearbeiten">Bearbeiten</a>`}
    </div>
    ${locked ? '<div class="notice">Dieser Eintrag ist unterschrieben und damit gesperrt. Zum Ändern müssen die Unterschriften zurückgesetzt werden.</div>' : ''}
    <div class="card">
      <dl class="kv">
        ${row('Datum', fmtDate(e.datum))}
        ${row('Tätigkeit', e.taetigkeit)}
        ${row('Menge zugefügt', fmtNum(e.mengeZugefuegt, 3) && fmtNum(e.mengeZugefuegt, 3) + ' kg')}
        ${row('Menge entnommen', fmtNum(e.mengeEntnommen, 3) && fmtNum(e.mengeEntnommen, 3) + ' kg')}
        ${row('Herkunft', e.herkunft)}
        ${row('Ergebnis Dichtheitskontrolle', e.ergebnis)}
        ${row('Leckage: Ursache & Reparatur', e.leckageUrsache)}
        ${row('Nachkontrolle am', fmtDate(e.nachkontrolleAm))}
        ${row('Fachbetrieb', e.fachbetrieb)}
        ${row('Techniker', [e.techniker, e.technikerZertNr ? 'Zert.-Nr. ' + e.technikerZertNr : ''].filter(Boolean).join(', '))}
        ${row('Bemerkung', e.bemerkung)}
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
      : 'Der Techniker bestätigt die Richtigkeit der Angaben (Art. 7 VO (EU) 2024/573).';
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
      <p class="small">${st.customers.length} Kunden · ${st.systems.length} Anlagen · ${st.entries.length} Einträge</p>
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
  document.getElementById('exp').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(Store.get(), null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `Anlagenbuch_Sicherung_${today()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
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

  if (p.length === 0) return viewCustomers(q);
  if (p[0] === 'einstellungen') return viewSettings();
  if (p[0] === 'kunde') {
    if (p[1] === 'neu') return viewCustomerForm(null);
    if (p[2] === 'bearbeiten') return viewCustomerForm(p[1]);
    return viewCustomer(p[1]);
  }
  if (p[0] === 'anlage') {
    if (p[1] === 'neu') return viewSystemForm(null, q);
    if (p[2] === 'bearbeiten') return viewSystemForm(p[1], q);
    return viewSystem(p[1]);
  }
  if (p[0] === 'eintrag') {
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
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
