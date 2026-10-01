/* Anlagen und Einträge für Heizung und Trinkwasser – Formulare und Ansichten aus der Bereichs-Definition (areas.js) */
'use strict';

const Generic = (() => {
  const INTERVALS = [['3', 'alle 3 Monate'], ['6', 'alle 6 Monate'], ['12', 'alle 12 Monate'], ['24', 'alle 24 Monate'], ['36', 'alle 36 Monate'], ['0', 'keine regelmäßige Wartung']];
  const ERGEBNIS = ['', 'in Ordnung', 'Mängel festgestellt', 'Mängel behoben', 'außer Betrieb genommen'];

  /** Formularfeld aus einer Feld-Definition. */
  function specField(f, v) {
    const label = f.unit ? `${f.label} (${f.unit})` : f.label;
    const opts = { required: f.required, hint: f.hint || '', attrs: [f.num ? 'inputmode="decimal"' : '', f.attrs || ''].join(' '), full: f.full };
    let html;
    if (f.type === 'select') html = field(f.name, label, v, { ...opts, type: 'select', options: f.options.map((o) => [o, o || '–']) });
    else if (f.list) html = field(f.name, label, v, { ...opts, list: 'list-' + f.name });
    else html = field(f.name, label, v, { ...opts, type: f.type || 'text' });
    const list = f.list ? `<datalist id="list-${f.name}">${f.list.map((o) => `<option value="${esc(o)}">`).join('')}</datalist>` : '';
    return `<div class="spec" data-name="${f.name}"${f.full ? ' style="grid-column:1/-1"' : ''}>${html}${list}</div>`;
  }

  /** Felder mit Bedingung (when) passend zu den aktuellen Daten ein-/ausblenden. */
  function applyVisibility(form, sections, data) {
    for (const f of sections.flatMap((s) => s.fields)) {
      if (!f.when) continue;
      const el = form.querySelector(`.spec[data-name="${f.name}"]`);
      if (el) el.hidden = !f.when(data);
    }
  }

  const kv = (label, value) => (value ? `<dt>${esc(label)}</dt><dd>${esc(value)}</dd>` : '');

  // ---------- Anlage anlegen / bearbeiten ----------
  function systemForm(id, q, areaKey) {
    const settings = Store.get().settings;
    const s = id ? Store.system(id) : null;
    if (id && !s) return notFound();
    const area = Areas.get(s ? Areas.of(s) : areaKey);
    const l = Store.location(s ? s.locationId : q.get('standort'));
    if (!l) return notFound();
    const c = Store.customer(l.customerId);
    const autoNr = Store.nextSystemNumber(c.id, area.key);
    const locOptions = Store.locationsOf(c.id).map((x) => [x.id, locationTitle(x) + (x.name && customerAddress(x) ? ' – ' + customerAddress(x) : '')]);
    const v = s || {
      locationId: l.id,
      wartungsintervall: String(area.defaultInterval),
      errichtetDurch: `${settings.firma}, ${settings.strasse}, ${settings.plzOrt}`,
    };
    render(`
      ${crumbs({ c, l, s })}
      <h1>${s ? 'Anlage bearbeiten' : 'Neue Anlage'} <span class="badge">${area.icon} ${esc(area.short)}</span></h1>
      <form id="f">
        <fieldset class="card">
          <legend>Anlage</legend>
          <div class="grid">
            ${field('anlagenNr', 'Anlagen-Nr.', v.anlagenNr || autoNr, {
              hint: autoNr
                ? (v.anlagenNr ? '' : `automatisch vergeben (Kundennummer + laufende Nummer + ${area.suffix})`)
                : `Für automatische Nummern beim Kunden eine <a href="#/kunde/${c.id}/bearbeiten">Kunden-Nr.</a> eintragen.`,
            })}
            ${field('bezeichnung', 'Bezeichnung', v.bezeichnung, { required: true, hint: area.key === 'heizung' ? 'z. B. „Gaskessel Keller“' : 'z. B. „Hauswasserstation HWR“' })}
            ${field('locationId', 'Standort', v.locationId || l.id, { type: 'select', options: locOptions, required: true })}
            ${field('aufstellort', area.key === 'heizung' ? 'Aufstellraum (optional)' : 'Einbauort (optional)', v.aufstellort, { hint: 'z. B. „Heizraum UG“' })}
          </div>
        </fieldset>
        ${area.systemSections.map((sec) => `
          <fieldset class="card">
            <legend>${esc(sec.legend)}</legend>
            <div class="grid">${sec.fields.map((f) => specField(f, v[f.name])).join('')}</div>
          </fieldset>`).join('')}
        <fieldset class="card">
          <legend>Wartung &amp; Inbetriebnahme</legend>
          <div class="grid">
            ${field('wartungsintervall', 'Wartungsintervall', v.wartungsintervall === undefined ? String(area.defaultInterval) : v.wartungsintervall, {
              type: 'select', options: INTERVALS,
              hint: area.typeIntervals ? 'wird bei Auswahl der Komponente mit einem Richtwert (DIN EN 806-5) vorbelegt' : 'Nächste Wartung = letzte Wartung (bzw. Inbetriebnahme) + Intervall',
            })}
            ${field('errichtetAm', area.key === 'heizung' ? 'Inbetriebnahme' : 'Einbau / Inbetriebnahme', v.errichtetAm, { type: 'date' })}
            ${field('errichtetDurch', 'Errichtet durch (Fachbetrieb)', v.errichtetDurch, { type: 'textarea', full: true })}
          </div>
        </fieldset>
        <div class="actions">
          ${s ? '<button type="button" class="btn danger" id="del">Anlage löschen</button>' : ''}
          <span class="spacer"></span>
          <a class="btn ghost" href="${s ? '#/anlage/' + s.id : '#/standort/' + l.id}">Abbrechen</a>
          <button class="btn primary" type="submit">Speichern</button>
        </div>
      </form>
    `);
    const f = document.getElementById('f');
    let intervalTouched = !!s;
    f.wartungsintervall.addEventListener('change', () => { intervalTouched = true; });
    const update = () => applyVisibility(f, area.systemSections, formData(f));
    f.addEventListener('input', update);
    f.addEventListener('change', (e) => {
      if (e.target.name === 'typ' && area.typeIntervals && !intervalTouched) {
        const m = area.typeIntervals[e.target.value];
        if (m !== undefined) f.wartungsintervall.value = String(m);
      }
      update();
    });
    update();
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const d = formData(f);
      Store.noteSystemNumber(c.id, d.anlagenNr, area.key);
      const saved = await Store.upsert('systems', { ...d, id: id || undefined, customerId: c.id, bereich: area.key });
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

  // ---------- Anlagendetail ----------
  function systemView(id) {
    const s = Store.system(id);
    const area = Areas.get(Areas.of(s));
    const c = Store.customer(s.customerId);
    const l = Store.location(s.locationId);
    const entries = Store.entriesOf(id);
    const maint = FGas.nextMaintenance(s, entries);
    const maintSt = FGas.dueStatus(maint);
    const m = FGas.maintInterval(s);
    render(`
      ${crumbs({ c, l })}
      <div class="head-row">
        <h1>${esc(systemTitle(s))}</h1>
        <a class="btn" href="#/anlage/${id}/bearbeiten">Bearbeiten</a>
      </div>
      ${maint && (maintSt.cls === 'danger' || maintSt.cls === 'warn') ? `<div class="notice ${maintSt.cls}"><strong>Wartung:</strong> ${esc(maintSt.text)}</div>` : ''}
      <div class="card">
        <dl class="kv">
          <dt>Bereich</dt><dd>${area.icon} ${esc(area.label)}</dd>
          <dt>Betreiber</dt><dd>${esc(c.name)}${customerAddress(c) ? ', ' + esc(customerAddress(c)) : ''}</dd>
          <dt>Standort</dt><dd>${esc(locationText(l, s)) || '–'}</dd>
          ${area.systemSections.flatMap((sec) => Areas.visible(sec.fields, s)).map((f) => kv(f.label, Areas.display(f, s[f.name]))).join('')}
          <dt>Wartungsintervall</dt><dd>${m ? `alle ${m} Monate` : 'keine regelmäßige Wartung'}</dd>
          <dt>Nächste Wartung</dt><dd><span class="badge ${maint ? maintSt.cls : ''}">${esc(maint ? maintSt.text : '–')}</span></dd>
          ${kv('Inbetriebnahme', [fmtDate(s.errichtetAm), s.errichtetDurch].filter(Boolean).join(' · '))}
        </dl>
        <div class="actions">
          <button class="btn" id="pdf">${FileOut.isNative() ? 'PDF speichern / teilen' : 'PDF herunterladen'}</button>
          ${FileOut.canShareFiles() && !FileOut.isNative() ? '<button class="btn" id="share">PDF teilen</button>' : ''}
        </div>
      </div>
      <div class="head-row">
        <h2 style="margin:8px 0 0;flex:1">Einträge / Wartungen</h2>
        <a class="btn primary" href="#/eintrag/neu?anlage=${id}">+ Neuer Eintrag</a>
      </div>
      ${entries.length ? `<ul class="list">${[...entries].reverse().map((e) => `
        <li><a class="list-item" href="#/eintrag/${e.id}">
          <div class="grow">
            <div class="title">${fmtDate(e.datum)} · ${esc(e.taetigkeit)}</div>
            <div class="sub">${esc([e.ergebnis, (e.arbeiten || []).length ? `${e.arbeiten.length} Arbeiten` : '', e.techniker].filter(Boolean).join(' · '))}</div>
            <div class="entry-meta">${e.sigTechniker ? '<span class="badge ok">✓ unterschrieben</span>' : '<span class="badge warn">nicht unterschrieben</span>'}
              ${/Mängel festgestellt/.test(e.ergebnis || '') ? '<span class="badge danger">Mängel</span>' : ''}
              ${(e.fotos || []).length ? `<span class="badge">📷 ${e.fotos.length}</span>` : ''}</div>
          </div><span class="chev">›</span></a></li>`).join('')}</ul>`
      : '<div class="empty">Noch keine Einträge. Lege die erste Wartung/Inspektion an.</div>'}
    `);
    bindPdfButtons(id, s);
  }

  // ---------- Eintrag anlegen / bearbeiten ----------
  function entryForm(id, q) {
    const settings = Store.get().settings;
    const e = id ? Store.entry(id) : null;
    if (id && !e) return notFound();
    if (e && (e.sigTechniker || e.sigKunde)) return go('#/eintrag/' + id);
    const s = Store.system(e ? e.systemId : q.get('anlage'));
    if (!s) return notFound();
    const area = Areas.get(Areas.of(s));
    const c = Store.customer(s.customerId);
    const v = e || {
      datum: today(),
      taetigkeit: area.taetigkeiten[0],
      fachbetrieb: settings.firma,
      techniker: Sync.user ? Sync.user.name : settings.techniker,
      arbeiten: [],
    };
    const done = new Set(v.arbeiten || []);
    const sections = area.entrySections.map((sec) => ({ ...sec, fields: Areas.visible(sec.fields, s) })).filter((sec) => sec.fields.length);
    render(`
      ${crumbs({ c, l: Store.location(s.locationId), s })}
      <h1>${e ? 'Eintrag bearbeiten' : 'Neuer Eintrag'}</h1>
      <form id="f">
        <fieldset class="card">
          <legend>Tätigkeit</legend>
          <div class="grid">
            ${field('datum', 'Datum', v.datum, { type: 'date', required: true })}
            ${field('taetigkeit', 'Tätigkeit', v.taetigkeit, { type: 'select', options: area.taetigkeiten, required: true })}
          </div>
        </fieldset>
        ${sections.map((sec) => `
          <fieldset class="card">
            <legend>${esc(sec.legend)}</legend>
            <div class="grid">${sec.fields.map((f) => specField(f, v[f.name])).join('')}</div>
          </fieldset>`).join('')}
        <fieldset class="card">
          <legend>Durchgeführte Arbeiten</legend>
          <div class="checks">${area.arbeiten.map((a) => `
            <label class="check"><input type="checkbox" data-arbeit value="${esc(a)}"${done.has(a) ? ' checked' : ''}> ${esc(a)}</label>`).join('')}
          </div>
          <div class="grid" style="margin-top:8px">
            ${field('weitereArbeiten', 'Weitere Arbeiten (je Zeile eine)', (v.arbeiten || []).filter((a) => !area.arbeiten.includes(a)).join('\n'), { type: 'textarea', full: true })}
            ${field('ersatzteile', 'Ersatzteile / Material', v.ersatzteile, { type: 'textarea', full: true })}
          </div>
        </fieldset>
        <fieldset class="card">
          <legend>Ergebnis</legend>
          <div class="grid">
            ${field('ergebnis', 'Ergebnis', v.ergebnis, { type: 'select', options: ERGEBNIS.map((o) => [o, o || '–']) })}
            ${field('maengel', 'Mängel / Empfehlungen', v.maengel, { type: 'textarea', full: true })}
          </div>
        </fieldset>
        ${Photos.editorHtml()}
        <fieldset class="card">
          <legend>Ausführung</legend>
          <div class="grid">
            ${field('fachbetrieb', 'Fachbetrieb', v.fachbetrieb, { full: true })}
            ${field('techniker', 'Techniker', v.techniker, { required: true })}
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
    const photos = Photos.bindEditor(v.fotos);
    f.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      if (photos.busy) { alert('Bitte warten, bis alle Fotos verarbeitet sind.'); return; }
      const d = formData(f);
      d.fotos = photos.list;
      const extra = (d.weitereArbeiten || '').split('\n').map((x) => x.trim()).filter(Boolean);
      delete d.weitereArbeiten;
      d.arbeiten = [...[...f.querySelectorAll('[data-arbeit]:checked')].map((x) => x.value), ...extra];
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

  /** Zeilen der Eintrags-Ansicht. */
  function entryRows(e, s) {
    const area = Areas.get(Areas.of(s));
    const mess = area.entrySections.flatMap((sec) => Areas.visible(sec.fields, s)).map((f) => kv(f.label, Areas.display(f, e[f.name]))).join('');
    const arbeiten = (e.arbeiten || []).length ? `<dt>Durchgeführte Arbeiten</dt><dd><ul class="plain">${e.arbeiten.map((a) => `<li>✓ ${esc(a)}</li>`).join('')}</ul></dd>` : '';
    return [
      kv('Datum', fmtDate(e.datum)),
      kv('Tätigkeit', e.taetigkeit),
      mess,
      arbeiten,
      kv('Ersatzteile / Material', e.ersatzteile),
      kv('Ergebnis', e.ergebnis),
      kv('Mängel / Empfehlungen', e.maengel),
      kv('Fachbetrieb', e.fachbetrieb),
      kv('Techniker', e.techniker),
      kv('Bemerkung', e.bemerkung),
    ].join('');
  }

  return { systemForm, systemView, entryForm, entryRows };
})();
