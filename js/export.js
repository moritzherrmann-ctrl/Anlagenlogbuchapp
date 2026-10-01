/* Export der anstehenden Termine eines Bereichs: Excel (CSV) und Kalender (iCalendar/.ics) */
'use strict';

const DueExport = (() => {
  /** Alle Termine mit Datum: bei Kälte Dichtheitskontrollen und Wartungen, sonst Wartungen. */
  function items(areaKey) {
    const out = [];
    for (const s of Store.get().systems) {
      if (Areas.of(s) !== areaKey) continue;
      const entries = Store.entriesOf(s.id);
      const due = [FGas.nextMaintenance(s, entries), Areas.isKaelte(s) ? FGas.nextDue(s, entries) : null];
      for (const d of due) {
        if (!d || !d.date) continue;
        const c = Store.customer(s.customerId) || {};
        const l = Store.location(s.locationId) || {};
        out.push({
          s, d, c, l,
          art: d.kind === 'wartung' ? 'Wartung' : d.reason,
          adresse: customerAddress(l) || customerAddress(c),
          ansprechpartner: l.ansprechpartner || c.ansprechpartner || '',
          telefon: l.telefon || c.telefon || '',
        });
      }
    }
    return out.sort((a, b) => a.d.date.localeCompare(b.d.date));
  }

  const statusText = (d) => (d.date < todayISO() ? 'überfällig' : 'fällig');

  const fileBase = (areaKey) => `Termine_${Areas.get(areaKey).short.replace(/ä/g, 'ae').replace(/[^A-Za-z0-9]+/g, '_')}_${todayISO()}`;

  // ---------- CSV (Excel: Semikolon, UTF-8 mit BOM) ----------
  function cell(v) {
    let t = String(v ?? '');
    if (/^[=+\-@\t\r]/.test(t)) t = "'" + t; // keine Formeln in Excel ausführen lassen
    return /[;"\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  }

  function csv(areaKey) {
    const rows = [['Fällig am', 'Art', 'Status', 'Anlagen-Nr.', 'Bezeichnung', 'Anlagentyp', 'Kunde', 'Kunden-Nr.', 'Standort', 'Anschrift', 'Ansprechpartner', 'Telefon']];
    for (const x of items(areaKey)) {
      rows.push([fmtDate(x.d.date), x.art, statusText(x.d), x.s.anlagenNr, x.s.bezeichnung, x.s.typ, x.c.name, x.c.kundennr,
        x.l.name, x.adresse, x.ansprechpartner, x.telefon]);
    }
    const text = '\uFEFF' + rows.map((r) => r.map(cell).join(';')).join('\r\n') + '\r\n';
    return { blob: new Blob([text], { type: 'text/csv;charset=utf-8' }), name: fileBase(areaKey) + '.csv' };
  }

  // ---------- iCalendar ----------
  const icsText = (t) => String(t ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
  const compact = (iso) => iso.replace(/-/g, '');
  const nextDay = (iso) => {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
  };

  /** Zeilen nach RFC 5545 auf 75 Byte falten (Folgezeilen beginnen mit Leerzeichen). */
  function fold(line) {
    const enc = new TextEncoder();
    const parts = [];
    let cur = '';
    for (const ch of line) {
      if (enc.encode(cur + ch).length > (parts.length ? 74 : 75)) {
        parts.push(cur);
        cur = '';
      }
      cur += ch;
    }
    parts.push(cur);
    return parts.join('\r\n ');
  }

  function ics(areaKey) {
    const area = Areas.get(areaKey);
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Anlagenbuch//Termine//DE', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
      `X-WR-CALNAME:${icsText('Anlagenbuch ' + area.short)}`];
    for (const x of items(areaKey)) {
      const title = [x.s.anlagenNr, x.s.bezeichnung].filter(Boolean).join(' – ');
      const desc = [
        `${x.art} ${statusText(x.d)} am ${fmtDate(x.d.date)}`,
        `Anlage: ${title}${x.s.typ ? ' (' + x.s.typ + ')' : ''}`,
        `Kunde: ${[x.c.name, x.c.kundennr ? 'Kd.-Nr. ' + x.c.kundennr : ''].filter(Boolean).join(', ')}`,
        x.l.name ? `Standort: ${x.l.name}` : '',
        x.ansprechpartner ? `Ansprechpartner: ${x.ansprechpartner}` : '',
        x.telefon ? `Telefon: ${x.telefon}` : '',
      ].filter(Boolean).join('\n');
      lines.push(
        'BEGIN:VEVENT',
        `UID:${x.s.id}-${x.d.kind || 'dichtheit'}@anlagenbuch`,
        `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${compact(x.d.date)}`,
        `DTEND;VALUE=DATE:${compact(nextDay(x.d.date))}`,
        `SUMMARY:${icsText(`${x.art}: ${title} – ${x.c.name || ''}`)}`,
        x.adresse ? `LOCATION:${icsText(x.adresse)}` : '',
        `DESCRIPTION:${icsText(desc)}`,
        'TRANSP:TRANSPARENT',
        'BEGIN:VALARM', 'ACTION:DISPLAY', 'TRIGGER:-P7D', `DESCRIPTION:${icsText(x.art + ' in einer Woche fällig')}`, 'END:VALARM',
        'END:VEVENT',
      );
    }
    lines.push('END:VCALENDAR');
    const text = lines.filter(Boolean).map(fold).join('\r\n') + '\r\n';
    return { blob: new Blob([text], { type: 'text/calendar;charset=utf-8' }), name: fileBase(areaKey) + '.ics' };
  }

  return { items, csv, ics };
})();
