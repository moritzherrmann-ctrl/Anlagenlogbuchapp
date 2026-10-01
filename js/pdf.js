/* PDF-Ausgabe im Layout der Vorlage „Anlagenbuch / Logbuch für Kälteanlagen“ – auch für Heizung und Trinkwasser */
'use strict';

const PdfExport = (() => {
  const GREY = [95, 107, 126];
  const LINE = [170, 178, 190];
  const LABEL_BG = [238, 242, 247];
  const M = 15; // Rand in mm

  function header(doc, settings) {
    const w = doc.internal.pageSize.getWidth();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...GREY);
    doc.text(`${(settings.firma || '').toUpperCase()} · ANLAGENBUCH`, w - M, 10, { align: 'right' });
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.3);
    doc.line(M, 12, w - M, 12);
    doc.setTextColor(0);
  }

  function footer(doc, settings, page, total) {
    const w = doc.internal.pageSize.getWidth();
    const h = doc.internal.pageSize.getHeight();
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.3);
    doc.line(M, h - 18, w - M, h - 18);
    doc.setFontSize(7.5);
    doc.setTextColor(...GREY);
    doc.setFont('helvetica', 'bold');
    doc.text(settings.firma || '', M, h - 14);
    doc.setFont('helvetica', 'normal');
    doc.text([settings.strasse, settings.plzOrt].filter(Boolean).join(' · '), M, h - 10.5);
    doc.text([settings.telefon, settings.email].filter(Boolean).join(' · '), M, h - 7);
    doc.text(`Blatt ${page} von ${total}`, w - M, h - 10.5, { align: 'right' });
    doc.setTextColor(0);
  }

  function sectionTitle(doc, no, title, y) {
    doc.setFillColor(11, 92, 171);
    doc.circle(M + 2.6, y - 1.3, 2.6, 'F');
    doc.setTextColor(255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text(String(no), M + 2.6, y - 0.2, { align: 'center' });
    doc.setTextColor(0);
    doc.setFontSize(12);
    doc.text(title, M + 8, y);
    return y + 5;
  }

  /** Absatz mit fettem Einleitungswort, mit Zeilenumbruch. */
  function richParagraph(doc, lead, text, x, y, maxW, lh) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    const leadW = doc.getTextWidth(lead + ' ');
    doc.text(lead, x, y);
    doc.setFont('helvetica', 'normal');
    const words = text.split(/\s+/);
    let line = '';
    let lineX = x + leadW;
    let avail = maxW - leadW;
    for (const word of words) {
      const test = line ? line + ' ' + word : word;
      if (doc.getTextWidth(test) > avail && line) {
        doc.text(line, lineX, y);
        y += lh;
        line = word;
        lineX = x;
        avail = maxW;
      } else {
        line = test;
      }
    }
    if (line) doc.text(line, lineX, y);
    return y + lh;
  }

  function checkbox(doc, x, y, checked) {
    doc.setDrawColor(60);
    doc.setLineWidth(0.3);
    doc.rect(x, y - 2.8, 3.2, 3.2);
    if (checked) {
      doc.setLineWidth(0.5);
      doc.line(x + 0.6, y - 1.2, x + 1.4, y - 0.1);
      doc.line(x + 1.4, y - 0.1, x + 2.8, y - 2.3);
    }
  }

  function systemLabel(sys) {
    return [sys.anlagenNr, sys.bezeichnung].filter(Boolean).join(' – ');
  }

  /** Unterschriften (Techniker/Betreiber) in eine Tabellenzelle zeichnen. */
  function drawSignatures(doc, d, sigs = []) {
    const slotH = (d.cell.height - 1) / Math.max(1, sigs.length);
    sigs.forEach((s, i) => {
      const maxW = d.cell.width - 3;
      const maxH = slotH - 4.5;
      const ratio = Math.min(maxW / s.w, maxH / s.h);
      const top = d.cell.y + 0.8 + i * slotH;
      try { doc.addImage(s.img, 'PNG', d.cell.x + 1.5, top, s.w * ratio, s.h * ratio); } catch (err) { console.warn(err); }
      doc.setFontSize(5.2);
      doc.setTextColor(...GREY);
      const role = s.role === 'kunde' ? 'Betr.' : 'Techn.';
      let caption = `${role} ${s.name || ''}, ${fmtDate(s.at)}`;
      while (doc.getTextWidth(caption) > maxW && caption.length > 10) caption = caption.slice(0, -2);
      doc.text(caption, d.cell.x + 1.5, top + slotH - 1.2);
      doc.setTextColor(0);
    });
  }

  /** Kopf/Fuß auf allen Seiten. */
  function finish(doc, settings) {
    const total = doc.internal.getNumberOfPages();
    for (let p = 1; p <= total; p++) {
      doc.setPage(p);
      header(doc, settings);
      footer(doc, settings, p, total);
    }
    return doc;
  }

  /** Tabelle, die bei Seitenumbruch im Querformat weiterläuft. */
  function landscapeTable(doc, opts) {
    const origAddPage = doc.addPage;
    doc.addPage = function () { return origAddPage.call(this, 'a4', 'landscape'); };
    try { doc.autoTable(opts); } finally { doc.addPage = origAddPage; }
  }

  function footnote(doc, text) {
    let fy = doc.lastAutoTable.finalY + 5;
    if (fy > doc.internal.pageSize.getHeight() - 26) {
      doc.addPage('a4', 'landscape');
      fy = 22;
    }
    doc.setFontSize(7.5);
    doc.setTextColor(...GREY);
    doc.text(text, M, fy, { maxWidth: doc.internal.pageSize.getWidth() - 2 * M });
    doc.setTextColor(0);
  }

  function betreiberText(cust) {
    return [cust && cust.name, cust && cust.ansprechpartner ? 'z. Hd. ' + cust.ansprechpartner : '', customerAddress(cust)]
      .filter(Boolean).join(', ');
  }

  // ---------- Firmenlogo ----------
  const LOGO_W = 42; // Breite in mm (oben rechts auf der ersten Seite eines Berichts)
  let logo = null; // { data, ratio } oder null

  async function loadLogo() {
    if (logo) return logo;
    try {
      const res = await fetch('icons/logo.jpg');
      if (!res.ok) throw new Error(res.status);
      const blob = await res.blob();
      const data = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = () => reject(r.error);
        r.readAsDataURL(blob);
      });
      const img = await new Promise((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = reject;
        i.src = data;
      });
      logo = { data, ratio: img.naturalHeight / img.naturalWidth };
    } catch (err) {
      console.warn('Logo nicht verfügbar', err);
      logo = null;
    }
    return logo;
  }

  /** Titel + Untertitel links, Logo rechts; liefert die y-Position für den ersten Abschnitt. */
  function titleBlock(doc, title, subtitle) {
    const pw = doc.internal.pageSize.getWidth();
    let textW = pw - 2 * M;
    let logoBottom = 0;
    if (logo) {
      const h = LOGO_W * logo.ratio;
      doc.addImage(logo.data, 'JPEG', pw - M - LOGO_W, 15, LOGO_W, h, 'firmenlogo', 'FAST');
      textW -= LOGO_W + 6;
      logoBottom = 15 + h;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    const tLines = doc.splitTextToSize(title, textW);
    doc.text(tLines, M, 24);
    let y = 24 + (tLines.length - 1) * 6.5 + 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...GREY);
    const sLines = doc.splitTextToSize(subtitle, textW);
    doc.text(sLines, M, y);
    doc.setTextColor(0);
    y += (sLines.length - 1) * 4;
    return Math.max(y, logoBottom) + 9;
  }

  /** Neues PDF beginnen oder – im Sammel-PDF – eine neue Hochformat-Seite anhängen. */
  function startDoc(doc, title) {
    if (doc) {
      doc.addPage('a4', 'portrait');
      return doc;
    }
    const { jsPDF } = window.jspdf;
    doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    doc.setProperties({ title, author: Store.get().settings.firma, creator: 'Anlagenbuch-App' });
    return doc;
  }

  /** Fotos der Einträge auf eigenen Seiten (2 × 3 je Seite) mit Datum und Tätigkeit. */
  function photoPages(doc, no, sys, entries, photos) {
    const items = entries.flatMap((e) => (e.fotos || []).map((f, i, all) => ({ e, f, i, n: all.length }))).filter((x) => photos.has(x.f.id));
    if (!items.length) return;
    const pw = 210;
    const colW = (pw - 2 * M - 6) / 2;
    const boxH = 68;
    const rowH = boxH + 12;
    let y = 0;
    let col = 0;
    const newPage = () => {
      doc.addPage('a4', 'portrait');
      y = sectionTitle(doc, no, `Fotos – ${systemLabel(sys)}`, 22) + 2;
      col = 0;
    };
    newPage();
    for (const { e, f, i, n } of items) {
      if (col === 2) { col = 0; y += rowH; }
      if (y + rowH > 297 - 22) newPage();
      const x = M + col * (colW + 6);
      const ratio = Math.min(colW / (f.w || 4), boxH / (f.h || 3));
      const w = (f.w || 4) * ratio;
      const h = (f.h || 3) * ratio;
      try { doc.addImage(photos.get(f.id), 'JPEG', x + (colW - w) / 2, y + (boxH - h) / 2, w, h, f.id, 'FAST'); } catch (err) { console.warn(err); }
      doc.setDrawColor(...LINE);
      doc.rect(x, y, colW, boxH);
      doc.setFontSize(8);
      doc.setTextColor(...GREY);
      doc.text(`${fmtDate(e.datum)} · ${e.taetigkeit || ''} – Foto ${i + 1}/${n}`, x, y + boxH + 4.5, { maxWidth: colW });
      doc.setTextColor(0);
      col++;
    }
  }

  /** Anlagenbuch für Heizungs- und Trinkwasseranlagen (Felder aus der Bereichs-Definition). */
  function drawGeneric(sys, target, photos) {
    const area = Areas.get(Areas.of(sys));
    const cust = Store.customer(sys.customerId);
    const standort = locationText(Store.location(sys.locationId), sys);
    const entries = Store.entriesOf(sys.id);
    const doc = startDoc(target, `Anlagenbuch ${systemLabel(sys)}`);
    const pw = doc.internal.pageSize.getWidth();

    let y = sectionTitle(doc, 1, 'Anlagen-Stammdaten', titleBlock(doc, area.pdfTitle, area.pdfSubtitle));

    const label = (t) => ({ content: t, styles: { fillColor: LABEL_BG, fontStyle: 'bold', textColor: [60, 70, 85] } });
    const maint = FGas.nextMaintenance(sys, entries);
    const m = FGas.maintInterval(sys);
    const rows = [
      [label('Betreiber (Name, Anschrift)'), betreiberText(cust)],
      [label('Anlagen-Standort'), standort],
      [label('Anlagen-Nr. / Bezeichnung'), systemLabel(sys)],
      ...Areas.visibleSections(area.systemSections, sys).flatMap((sec) => sec.fields.map((f) => [label(f.label), Areas.display(f, sys[f.name], sys)])),
      [label('Inbetriebnahme / errichtet durch'), [sys.errichtetAm ? fmtDate(sys.errichtetAm) : '', sys.errichtetDurch].filter(Boolean).join(' · ')],
      [label('Wartungsintervall'), m ? `alle ${m} Monate` : 'keine regelmäßige Wartung'],
      [label('Nächste Wartung fällig'), maint ? (maint.date ? fmtDate(maint.date) : 'offen') : '–'],
    ];
    doc.autoTable({
      startY: y,
      margin: { left: M, right: M, bottom: 24 },
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: 9, cellPadding: 2, lineColor: LINE, lineWidth: 0.25, textColor: [20, 20, 20], valign: 'middle', minCellHeight: 8 },
      columnStyles: { 0: { cellWidth: 62 } },
      body: rows,
    });

    y = doc.lastAutoTable.finalY + 12;
    if (y > doc.internal.pageSize.getHeight() - 60) { doc.addPage('a4', 'portrait'); y = 24; }
    y = sectionTitle(doc, 2, 'Hinweise', y) + 1;
    for (const [lead, text] of area.notes) y = richParagraph(doc, lead, text, M, y, pw - 2 * M, 4.3) + 1.5;

    // Einträge im Querformat
    doc.addPage('a4', 'landscape');
    y = sectionTitle(doc, 3, 'Einträge (chronologisch)', 22);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Anlage:', M, y + 2);
    doc.setFont('helvetica', 'normal');
    doc.text([systemLabel(sys), standort, cust && cust.name].filter(Boolean).join(' · '), M + 14, y + 2, { maxWidth: 250 });
    y += 6;

    const measureFields = area.entrySections.flatMap((sec) => Areas.visible(sec.fields, sys));
    const sigRows = [];
    const body = entries.map((e) => {
      const sigs = [e.sigTechniker, e.sigKunde].filter(Boolean);
      sigRows.push(sigs);
      const mess = measureFields.map((f) => (Areas.display(f, e[f.name]) ? `${f.label}: ${Areas.display(f, e[f.name])}` : '')).filter(Boolean).join('\n');
      const arbeiten = [...(e.arbeiten || []).map((a) => '• ' + a), e.ersatzteile ? 'Ersatzteile: ' + e.ersatzteile : ''].filter(Boolean).join('\n');
      return [
        fmtDate(e.datum),
        e.taetigkeit || '',
        mess,
        arbeiten,
        [e.ergebnis, e.maengel].filter(Boolean).join('\n'),
        [e.fachbetrieb, e.techniker].filter(Boolean).join('\n'),
        { content: '', styles: { minCellHeight: sigs.length > 1 ? 26 : 15 } },
        e.bemerkung || '',
      ];
    });
    const blank = Math.max(3, 8 - body.length);
    for (let i = 0; i < blank; i++) {
      sigRows.push([]);
      body.push(['', '', '', '', '', '', { content: '', styles: { minCellHeight: 11 } }, '']);
    }
    landscapeTable(doc, {
      startY: y,
      margin: { left: M, right: M, top: 18, bottom: 24 },
      theme: 'grid',
      rowPageBreak: 'avoid',
      head: [['Datum', 'Tätigkeit *', 'Messwerte', 'Durchgeführte Arbeiten', 'Ergebnis / Mängel', 'Fachbetrieb / Techniker', 'Unterschrift', 'Bemerkung']],
      body,
      styles: { font: 'helvetica', fontSize: 7.8, cellPadding: 1.6, lineColor: LINE, lineWidth: 0.25, textColor: [20, 20, 20], valign: 'top', overflow: 'linebreak' },
      headStyles: { fillColor: LABEL_BG, textColor: [40, 50, 65], fontStyle: 'bold', fontSize: 7.5, valign: 'middle' },
      columnStyles: {
        0: { cellWidth: 19 }, 1: { cellWidth: 26 }, 2: { cellWidth: 46 }, 3: { cellWidth: 52 },
        4: { cellWidth: 34 }, 5: { cellWidth: 28 }, 6: { cellWidth: 38 }, 7: { cellWidth: 24 },
      },
      didDrawCell: (d) => {
        if (d.section === 'body' && d.column.index === 6) drawSignatures(doc, d, sigRows[d.row.index]);
      },
    });
    footnote(doc, '* Tätigkeit: ' + area.taetigkeiten.join(' · ') + '.');
    photoPages(doc, 4, sys, entries, photos);
    return doc;
  }

  /** Anlagenbuch Kälte im Layout der Vorlage. */
  function drawKaelte(sys, target, photos) {
    const cust = Store.customer(sys.customerId);
    const loc = Store.location(sys.locationId);
    const standort = locationText(loc, sys);
    const entries = Store.entriesOf(sys.id);
    const doc = startDoc(target, `Anlagenbuch ${systemLabel(sys)}`);

    // ---------- Blatt 1: Stammdaten + Pflichten ----------
    const pw = doc.internal.pageSize.getWidth();
    let y = titleBlock(doc, 'Anlagenbuch / Logbuch für Kälteanlagen',
      'Aufzeichnungen gemäß Art. 7 der F-Gase-Verordnung (EU) 2024/573 – je Anlage ein Anlagenbuch führen.');
    y = sectionTitle(doc, 1, 'Anlagen-Stammdaten', y);

    const t = FGas.co2e(sys);
    const interval = FGas.interval(sys);
    const due = FGas.nextDue(sys, entries);
    const betreiber = betreiberText(cust);
    const errichtet = [sys.errichtetAm ? fmtDate(sys.errichtetAm) : '', sys.errichtetDurch].filter(Boolean).join(' · ');
    const geraet = [sys.hersteller, sys.modell, sys.seriennr ? 'S/N ' + sys.seriennr : ''].filter(Boolean).join(' / ');
    const label = (s) => ({ content: s, styles: { fillColor: LABEL_BG, fontStyle: 'bold', textColor: [60, 70, 85] } });
    const wide = (s) => ({ content: s || '', colSpan: 3 });
    const leakRowIndex = 7;

    doc.autoTable({
      startY: y,
      margin: { left: M, right: M },
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: 9, cellPadding: 2.2, lineColor: LINE, lineWidth: 0.25, textColor: [20, 20, 20], valign: 'middle', minCellHeight: 9 },
      columnStyles: { 0: { cellWidth: 50 }, 1: { cellWidth: 38 }, 2: { cellWidth: 54 }, 3: { cellWidth: 38 } },
      body: [
        [label('Betreiber (Name, Anschrift)'), wide(betreiber)],
        [label('Anlagen-Standort'), wide(standort)],
        [label('Anlagen-Nr. / Bezeichnung'), wide(systemLabel(sys))],
        [label('Anlagentyp (z. B. Kaltwassersatz, VRF, Kühlzelle)'), wide([sys.typ, ...Areas.heatPumpsOf(sys.id)
          .map((h) => `Kältekreis der Wärmepumpe ${systemLabel(h.wp)}${h.count > 1 ? ` (Außengerät ${h.nr})` : ''}`)].filter(Boolean).join(' · '))],
        [label('Hersteller / Modell / Serien-Nr.'), wide(geraet)],
        [label('Kältemittel (z. B. R-410A)'), sys.kaeltemittel || '', label('GWP-Wert'), fmtNum(sys.gwp, 3)],
        [label('Füllmenge (kg)'), fmtNum(sys.fuellmenge, 3), label('CO2-Äquivalent (t) = kg × GWP ÷ 1.000'), isFinite(t) ? fmtNum(t, 2) + ' t' : ''],
        [label('Prüfintervall Dichtheitskontrolle'), FGas.intervalLabel(interval), label('Leckage-Erkennungssystem vorhanden?'), ''],
        [label('Errichtet am / durch (Fachbetrieb, Zertifikat-Nr.)'), wide(errichtet)],
        [label('Nächste Dichtheitskontrolle fällig'), wide(due ? (due.date ? fmtDate(due.date) + ' – ' + due.reason : due.reason) : 'keine Prüfpflicht')],
      ],
      didDrawCell: (d) => {
        if (d.section === 'body' && d.row.index === leakRowIndex && d.column.index === 3) {
          const cy = d.cell.y + d.cell.height / 2 + 1.2;
          const cx = d.cell.x + 3;
          doc.setFontSize(9);
          checkbox(doc, cx, cy, sys.leckageSystem === 'ja');
          doc.text('ja', cx + 4.5, cy);
          checkbox(doc, cx + 14, cy, sys.leckageSystem !== 'ja');
          doc.text('nein', cx + 18.5, cy);
        }
      },
    });

    y = doc.lastAutoTable.finalY + 12;
    y = sectionTitle(doc, 2, 'Pflichten auf einen Blick', y);
    y += 1;
    const tw = pw - 2 * M;
    const lh = 4.3;
    y = richParagraph(doc, 'Aufzeichnungspflicht:', 'Für Anlagen mit Dichtheitskontrollpflicht sind Menge und Typ des Kältemittels, zugefügte und rückgewonnene Mengen (inkl. Herkunft: neu, recycelt oder aufgearbeitet), Ergebnisse der Dichtheitskontrollen, Leckage-Ursachen und die Identität des ausführenden zertifizierten Unternehmens/Personals zu dokumentieren.', M, y, tw, lh) + 1.5;
    y = richParagraph(doc, 'Prüfintervalle nach CO2-Äquivalent:', 'ab 5 t CO2e alle 12 Monate, ab 50 t alle 6 Monate, ab 500 t alle 3 Monate. Mit fest installiertem Leckage-Erkennungssystem verdoppeln sich die Intervalle (24/12/6 Monate).', M, y, tw, lh) + 1.5;
    y = richParagraph(doc, 'Aufbewahrung:', 'mindestens 5 Jahre – durch Betreiber UND ausführenden Fachbetrieb. Auf Verlangen der Behörde vorzulegen.', M, y, tw, lh) + 1.5;
    y = richParagraph(doc, 'Nach einer reparierten Leckage:', 'Nachkontrolle innerhalb eines Monats durch zertifiziertes Personal.', M, y, tw, lh);

    // ---------- Kältemittel-Bilanz je Jahr ----------
    const bal = FGas.balance(sys, entries);
    y += 8;
    if (y > doc.internal.pageSize.getHeight() - 60) { doc.addPage('a4', 'portrait'); y = 24; }
    y = sectionTitle(doc, 3, 'Kältemittel-Bilanz', y);
    if (bal.rows.length) {
      const kg = (v) => (v ? fmtNum(v, 3) : '–');
      const row = (r) => [r.year, kg(r.zugefuegt), kg(r.neu), kg(r.recycelt), kg(r.aufgearbeitet), kg(r.entnommen),
        r.rate === null || r.rate === undefined ? '–' : fmtNum(r.rate, 1) + ' %'];
      doc.autoTable({
        startY: y,
        margin: { left: M, right: M, bottom: 24 },
        theme: 'grid',
        head: [['Jahr', 'zugefügt (kg)', 'davon neu', 'recycelt', 'aufgearbeitet', 'entnommen (kg)', 'Nachfüllrate *']],
        body: [...bal.rows.map(row), ...(bal.rows.length > 1 ? [row(bal.total).map((c) => ({ content: c, styles: { fontStyle: 'bold' } }))] : [])],
        styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 1.6, lineColor: LINE, lineWidth: 0.25, textColor: [20, 20, 20], halign: 'right' },
        headStyles: { fillColor: LABEL_BG, textColor: [40, 50, 65], fontStyle: 'bold', halign: 'right' },
        columnStyles: { 0: { halign: 'left' } },
      });
      doc.setFontSize(7.5);
      doc.setTextColor(...GREY);
      doc.text('* zugefügte Menge im Jahr bezogen auf die Füllmenge der Anlage (Hinweis auf Leckageverluste). Erstbefüllung bei Installation nicht enthalten.', M, doc.lastAutoTable.finalY + 4);
      doc.setTextColor(0);
    } else {
      doc.setFontSize(9);
      doc.setTextColor(...GREY);
      doc.text('Noch keine Kältemittel-Mengen erfasst.', M, y + 2);
      doc.setTextColor(0);
    }

    // ---------- Blatt 2 ff.: Einträge (Querformat) ----------
    doc.addPage('a4', 'landscape');
    y = 22;
    y = sectionTitle(doc, 4, 'Einträge (chronologisch)', y);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Anlage:', M, y + 2);
    doc.setFont('helvetica', 'normal');
    doc.text([systemLabel(sys), standort, cust && cust.name].filter(Boolean).join(' · '), M + 14, y + 2);
    y += 6;

    const sigRows = [];
    const body = entries.map((e) => {
      const leak = [e.leckageUrsache, e.nachkontrolleAm ? 'Nachkontrolle am ' + fmtDate(e.nachkontrolleAm) : ''].filter(Boolean).join('\n');
      const tech = [e.fachbetrieb, [e.techniker, e.technikerZertNr ? 'Zert.-Nr. ' + e.technikerZertNr : ''].filter(Boolean).join(', ')].filter(Boolean).join('\n');
      const sigs = [e.sigTechniker, e.sigKunde].filter(Boolean);
      sigRows.push(sigs);
      return [
        fmtDate(e.datum),
        (e.taetigkeit || '').replace('/', '/\n'),
        fmtNum(e.mengeZugefuegt, 3),
        fmtNum(e.mengeEntnommen, 3),
        e.herkunft || '',
        e.ergebnis || '',
        leak,
        tech,
        { content: '', styles: { minCellHeight: sigs.length > 1 ? 26 : 15 } },
        e.bemerkung || '',
      ];
    });
    // Leerzeilen zum handschriftlichen Nachtragen
    const blank = Math.max(3, 8 - body.length);
    for (let i = 0; i < blank; i++) {
      sigRows.push([]);
      body.push(['', '', '', '', '', '', '', '', { content: '', styles: { minCellHeight: 11 } }, '']);
    }

    landscapeTable(doc, {
      startY: y,
      margin: { left: M, right: M, top: 18, bottom: 24 },
      theme: 'grid',
      rowPageBreak: 'avoid',
      head: [[
        'Datum', 'Tätigkeit *', 'Menge\nzugefügt\n(kg)', 'Menge\nentnommen\n(kg)', 'Herkunft:\nneu / recycelt /\naufgearbeitet',
        'Ergebnis\nDichtheits-\nkontrolle\n(dicht / Leckage)', 'Leckage: Ursache & Reparatur, Nachkontrolle am',
        'Fachbetrieb / Techniker + Zertifikat-Nr.', 'Unterschrift', 'Bemerkung',
      ]],
      body,
      styles: { font: 'helvetica', fontSize: 8, cellPadding: 1.6, lineColor: LINE, lineWidth: 0.25, textColor: [20, 20, 20], valign: 'top', overflow: 'linebreak' },
      headStyles: { fillColor: LABEL_BG, textColor: [40, 50, 65], fontStyle: 'bold', fontSize: 7.5, valign: 'middle' },
      columnStyles: {
        0: { cellWidth: 19 }, 1: { cellWidth: 27 }, 2: { cellWidth: 17, halign: 'right' }, 3: { cellWidth: 19, halign: 'right' },
        4: { cellWidth: 23 }, 5: { cellWidth: 22 }, 6: { cellWidth: 38 }, 7: { cellWidth: 38 }, 8: { cellWidth: 38 }, 9: { cellWidth: 26 },
      },
      didDrawCell: (d) => {
        if (d.section === 'body' && d.column.index === 8) drawSignatures(doc, d, sigRows[d.row.index]);
      },
    });

    footnote(doc, '* Tätigkeit: Installation · Wartung/Instandhaltung · Reparatur · Dichtheitskontrolle · Rückgewinnung · Stilllegung.');

    // Wartungsprotokolle: Messwerte, Checkliste, Ersatzteile, Mängel
    const area = Areas.get('kaelte');
    const measureFields = area.entrySections.flatMap((sec) => Areas.visible(sec.fields, sys));
    const work = entries.filter((e) => (e.arbeiten || []).length || e.ersatzteile || e.maengel || measureFields.some((f) => e[f.name]));
    let photoNo = 5;
    if (work.length) {
      doc.addPage('a4', 'landscape');
      y = sectionTitle(doc, 5, 'Wartung / Instandhaltung – Protokolle', 22);
      photoNo = 6;
      landscapeTable(doc, {
        startY: y,
        margin: { left: M, right: M, top: 18, bottom: 24 },
        theme: 'grid',
        rowPageBreak: 'avoid',
        head: [['Datum', 'Tätigkeit', 'Messwerte', 'Durchgeführte Arbeiten', 'Ersatzteile / Material', 'Mängel / Empfehlungen', 'Techniker']],
        body: work.map((e) => [
          fmtDate(e.datum),
          (e.taetigkeit || '').replace('/', '/\n'),
          measureFields.map((f) => (Areas.display(f, e[f.name]) ? `${f.label}: ${Areas.display(f, e[f.name])}` : '')).filter(Boolean).join('\n'),
          (e.arbeiten || []).map((a) => '• ' + a).join('\n'),
          e.ersatzteile || '',
          e.maengel || '',
          e.techniker || '',
        ]),
        styles: { font: 'helvetica', fontSize: 7.8, cellPadding: 1.6, lineColor: LINE, lineWidth: 0.25, textColor: [20, 20, 20], valign: 'top', overflow: 'linebreak' },
        headStyles: { fillColor: LABEL_BG, textColor: [40, 50, 65], fontStyle: 'bold', fontSize: 7.5, valign: 'middle' },
        columnStyles: {
          0: { cellWidth: 19 }, 1: { cellWidth: 26 }, 2: { cellWidth: 52 }, 3: { cellWidth: 70 },
          4: { cellWidth: 36 }, 5: { cellWidth: 40 }, 6: { cellWidth: 24 },
        },
      });
    }
    photoPages(doc, photoNo, sys, entries, photos);
    return doc;
  }

  const drawSystem = (sys, doc, photos) => (Areas.isKaelte(sys) ? drawKaelte : drawGeneric)(sys, doc, photos);

  /** Anlagenbuch einer Anlage (inkl. Fotos). */
  async function build(sysId) {
    await loadLogo();
    const sys = Store.system(sysId);
    const photos = await Photos.load(Store.entriesOf(sysId));
    return finish(drawSystem(sys, null, photos), Store.get().settings);
  }

  /** Anlagen eines Kunden (optional nur ein Bereich), sortiert nach Bereich und Nummer. */
  function customerSystems(customerId, areaKey, locationId) {
    return Store.systemsOf(customerId)
      .filter((s) => (!areaKey || Areas.of(s) === areaKey) && (!locationId || s.locationId === locationId))
      .sort((a, b) => Areas.keys.indexOf(Areas.of(a)) - Areas.keys.indexOf(Areas.of(b)) || systemLabel(a).localeCompare(systemLabel(b), 'de'));
  }

  /** Sammel-PDF: Übersicht + Anlagenbuch jeder Anlage des Kunden (optional nur ein Standort). */
  async function buildCustomer(customerId, areaKey, locationId) {
    const cust = Store.customer(customerId);
    const loc = locationId ? Store.location(locationId) : null;
    const systems = customerSystems(customerId, areaKey, locationId);
    const photos = await Photos.load(systems.flatMap((s) => Store.entriesOf(s.id)));
    await loadLogo();
    const doc = startDoc(null, `Anlagenübersicht ${cust.name}`);
    let top = titleBlock(doc, 'Anlagenübersicht',
      `${areaKey ? Areas.get(areaKey).label : 'Alle Bereiche'} · Stand ${fmtDate(todayISO())} · ${systems.length} ${systems.length === 1 ? 'Anlage' : 'Anlagen'}`) - 3;
    doc.setFontSize(10);
    const labelled = (label, text) => {
      doc.setFont('helvetica', 'bold');
      doc.text(label, M, top);
      const lw = doc.getTextWidth(label + ' ') + 1; // Breite in fetter Schrift messen
      doc.setFont('helvetica', 'normal');
      doc.text(text, M + lw, top, { maxWidth: 180 - lw });
      top += 6;
    };
    labelled('Betreiber:', betreiberText(cust));
    if (loc) labelled('Standort:', locationText(loc));
    const dueText = (d) => (d ? (d.date ? fmtDate(d.date) : 'offen') : '–');
    doc.autoTable({
      startY: top + 2,
      margin: { left: M, right: M, bottom: 24 },
      theme: 'grid',
      head: [['Anlagen-Nr.', 'Bezeichnung', 'Bereich', 'Standort', 'Nächste Wartung', 'Nächste Dichtheitskontr.']],
      body: systems.map((s) => {
        const entries = Store.entriesOf(s.id);
        return [s.anlagenNr || '', s.bezeichnung || '', Areas.get(Areas.of(s)).short, locationText(Store.location(s.locationId), s),
          dueText(FGas.nextMaintenance(s, entries)), Areas.isKaelte(s) ? dueText(FGas.nextDue(s, entries)) : '–'];
      }),
      styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 1.8, lineColor: LINE, lineWidth: 0.25, textColor: [20, 20, 20], valign: 'top' },
      headStyles: { fillColor: LABEL_BG, textColor: [40, 50, 65], fontStyle: 'bold' },
      columnStyles: { 0: { cellWidth: 26 }, 2: { cellWidth: 20 }, 4: { cellWidth: 22 }, 5: { cellWidth: 26 } },
    });
    for (const s of systems) drawSystem(s, doc, photos);
    return finish(doc, Store.get().settings);
  }

  const uml = { ä: 'ae', ö: 'oe', ü: 'ue', Ä: 'Ae', Ö: 'Oe', Ü: 'Ue', ß: 'ss' };
  const safe = (s) => (s || '')
    .replace(/[äöüÄÖÜß]/g, (c) => uml[c])
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9\-_]+/g, '_').replace(/^_+|_+$/g, '');

  function filename(sysId) {
    const sys = Store.system(sysId);
    const cust = Store.customer(sys.customerId);
    return `Anlagenbuch_${[safe(cust && cust.name), safe(sys.anlagenNr || sys.bezeichnung)].filter(Boolean).join('_')}_${todayISO()}.pdf`;
  }

  const customerFilename = (customerId, areaKey, locationId) => {
    const loc = locationId ? Store.location(locationId) : null;
    return `Anlagenuebersicht_${[safe(Store.customer(customerId).name), loc ? safe(loc.name) : '', areaKey ? safe(Areas.get(areaKey).short) : 'alle']
      .filter(Boolean).join('_')}_${todayISO()}.pdf`;
  };

  async function download(sysId) {
    return FileOut.save((await build(sysId)).output('blob'), filename(sysId), 'Anlagenbuch');
  }

  async function downloadCustomer(customerId, areaKey, locationId) {
    return FileOut.save((await buildCustomer(customerId, areaKey, locationId)).output('blob'), customerFilename(customerId, areaKey, locationId), 'Anlagenübersicht');
  }

  return { build, buildCustomer, customerSystems, filename, download, downloadCustomer };
})();
