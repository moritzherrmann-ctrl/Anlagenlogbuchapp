/* PDF-Ausgabe im Layout der Vorlage „Anlagenbuch / Logbuch für Kälteanlagen“ */
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

  function build(sysId) {
    const { jsPDF } = window.jspdf;
    const st = Store.get();
    const settings = st.settings;
    const sys = Store.system(sysId);
    const cust = Store.customer(sys.customerId);
    const loc = Store.location(sys.locationId);
    const standort = locationText(loc, sys);
    const entries = Store.entriesOf(sysId);
    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    doc.setProperties({ title: `Anlagenbuch ${systemLabel(sys)}`, author: settings.firma, creator: 'Anlagenbuch-App' });

    // ---------- Blatt 1: Stammdaten + Pflichten ----------
    const pw = doc.internal.pageSize.getWidth();
    let y = 24;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(17);
    doc.text('Anlagenbuch / Logbuch für Kälteanlagen', M, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...GREY);
    doc.text('Aufzeichnungen gemäß Art. 7 der F-Gase-Verordnung (EU) 2024/573 – je Anlage ein Anlagenbuch führen.', M, y);
    doc.setTextColor(0);
    y += 10;
    y = sectionTitle(doc, 1, 'Anlagen-Stammdaten', y);

    const t = FGas.co2e(sys);
    const interval = FGas.interval(sys);
    const due = FGas.nextDue(sys, entries);
    const betreiber = [cust && cust.name, cust && cust.ansprechpartner ? 'z. Hd. ' + cust.ansprechpartner : '', customerAddress(cust)]
      .filter(Boolean).join(', ');
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
        [label('Anlagentyp (z. B. Kaltwassersatz, VRF, Kühlzelle)'), wide(sys.typ)],
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
    richParagraph(doc, 'Nach einer reparierten Leckage:', 'Nachkontrolle innerhalb eines Monats durch zertifiziertes Personal.', M, y, tw, lh);

    // ---------- Blatt 2 ff.: Einträge (Querformat) ----------
    doc.addPage('a4', 'landscape');
    const lw = doc.internal.pageSize.getWidth();
    y = 22;
    y = sectionTitle(doc, 3, 'Einträge (chronologisch)', y);
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

    const origAddPage = doc.addPage;
    doc.addPage = function () { return origAddPage.call(this, 'a4', 'landscape'); };
    doc.autoTable({
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
        if (d.section !== 'body' || d.column.index !== 8) return;
        const sigs = sigRows[d.row.index] || [];
        const slotH = (d.cell.height - 1) / Math.max(1, sigs.length);
        sigs.forEach((s, i) => {
          const maxW = d.cell.width - 3;
          const maxH = slotH - 4.5;
          const ratio = Math.min(maxW / s.w, maxH / s.h);
          const w = s.w * ratio;
          const h = s.h * ratio;
          const top = d.cell.y + 0.8 + i * slotH;
          try { doc.addImage(s.img, 'PNG', d.cell.x + 1.5, top, w, h); } catch (err) { console.warn(err); }
          doc.setFontSize(5.2);
          doc.setTextColor(...GREY);
          const role = s.role === 'kunde' ? 'Betr.' : 'Techn.';
          let caption = `${role} ${s.name || ''}, ${fmtDate(s.at)}`;
          while (doc.getTextWidth(caption) > maxW && caption.length > 10) caption = caption.slice(0, -2);
          doc.text(caption, d.cell.x + 1.5, top + slotH - 1.2);
          doc.setTextColor(0);
        });
      },
    });
    doc.addPage = origAddPage;

    let fy = doc.lastAutoTable.finalY + 5;
    const lh2 = doc.internal.pageSize.getHeight();
    if (fy > lh2 - 26) {
      doc.addPage('a4', 'landscape');
      fy = 22;
    }
    doc.setFontSize(7.5);
    doc.setTextColor(...GREY);
    doc.text('* Tätigkeit: Installation · Wartung/Instandhaltung · Reparatur · Dichtheitskontrolle · Rückgewinnung · Stilllegung.', M, fy, { maxWidth: lw - 2 * M });
    doc.setTextColor(0);

    // Kopf/Fuß auf allen Seiten
    const total = doc.internal.getNumberOfPages();
    for (let p = 1; p <= total; p++) {
      doc.setPage(p);
      header(doc, settings);
      footer(doc, settings, p, total);
    }
    return doc;
  }

  function filename(sysId) {
    const sys = Store.system(sysId);
    const cust = Store.customer(sys.customerId);
    const uml = { ä: 'ae', ö: 'oe', ü: 'ue', Ä: 'Ae', Ö: 'Oe', Ü: 'Ue', ß: 'ss' };
    const safe = (s) => (s || '')
      .replace(/[äöüÄÖÜß]/g, (c) => uml[c])
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Za-z0-9\-_]+/g, '_').replace(/^_+|_+$/g, '');
    const today = new Date().toISOString().slice(0, 10);
    return `Anlagenbuch_${[safe(cust && cust.name), safe(sys.anlagenNr || sys.bezeichnung)].filter(Boolean).join('_')}_${today}.pdf`;
  }

  function download(sysId) {
    const blob = build(sysId).output('blob');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename(sysId);
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  }

  return { build, filename, download };
})();
