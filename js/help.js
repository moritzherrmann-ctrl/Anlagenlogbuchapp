/* Hilfe: „?“ oben rechts erklärt, was man auf der aktuellen Seite machen kann. */
'use strict';

const Help = (() => {
  const T = {
    login: ['Anmelden', [
      'Mit Benutzername und Passwort anmelden, die der Administrator vergeben hat.',
      'Nach der Anmeldung werden die Daten mit dem Server abgeglichen und stehen allen Kollegen zur Verfügung.',
      'Ohne Netz kann weitergearbeitet werden – Änderungen werden später automatisch hochgeladen.',
    ]],
    start: ['Bereiche', [
      'Hier wählst du den Bereich: ❄️ Kälte, 🔥 Heizung oder 🚰 Trinkwasser.',
      'Kunden und Standorte sind in allen Bereichen dieselben – eine Anlage gehört immer genau zu einem Bereich.',
      'Über „Bereiche“ oben kommst du jederzeit hierher zurück.',
    ]],
    home: ['Übersicht des Bereichs', [
      'Oben siehst du die nächsten fälligen Termine (Dichtheitskontrollen bzw. Wartungen) – Rot = überfällig, Gelb = bald fällig.',
      'Mit „Excel (CSV)“ oder „Kalender (.ics)“ kannst du die Fälligkeiten exportieren, z. B. in Outlook oder Excel.',
      'Darunter die Kundenliste: Suchen über das Suchfeld, neuen Kunden mit „+ Kunde anlegen“ erfassen.',
      'Ablauf: Kunde → Standort → Anlage → Einträge (Prüfungen, Wartungen) → unterschreiben → PDF.',
    ]],
    kundeForm: ['Kunde anlegen / bearbeiten', [
      'Name und Adresse des Kunden eintragen.',
      'Die Kunden-Nr. ist wichtig: Aus ihr werden die Anlagen-Nummern automatisch gebildet (z. B. 10023-0001K, -0001HZ, -0001TW).',
      'Ansprechpartner, Telefon und E-Mail sind optional und erscheinen im PDF.',
    ]],
    kunde: ['Kunde', [
      'Hier siehst du die Standorte des Kunden mit ihren Anlagen.',
      'Mit „+ Standort anlegen“ legst du einen weiteren Standort an (z. B. Filiale, Lager, Wohnhaus).',
      'Sammel-PDF: alle Anlagenbücher des Kunden (im aktuellen Bereich) in einer Datei – mit Deckblatt.',
      '„Bearbeiten“ ändert die Kundendaten, dort kann der Kunde auch gelöscht werden.',
    ]],
    standortForm: ['Standort anlegen / bearbeiten', [
      'Name und Adresse des Standorts eintragen, an dem die Anlagen stehen.',
      'Ist die Adresse leer, wird im PDF die Kundenadresse verwendet.',
    ]],
    standort: ['Standort', [
      'Alle Anlagen dieses Standorts im aktuellen Bereich.',
      'Mit „+ Anlage anlegen“ eine Anlage erfassen – die Anlagen-Nr. wird automatisch vergeben.',
      'Sammel-PDF: alle Anlagenbücher dieses Standorts in einer Datei.',
    ]],
    anlageFormKaelte: ['Kälteanlage anlegen / bearbeiten', [
      'Anlagen-Nr. wird automatisch vergeben (Kunden-Nr. + laufende Nummer + K) und kann überschrieben werden.',
      'Kältemittel auswählen – der GWP-Wert wird automatisch eingetragen, CO₂-Äquivalent und Prüfintervall werden berechnet.',
      'Leckage-Erkennungssystem und „hermetisch geschlossen“ beeinflussen das Prüfintervall nach F-Gase-Verordnung.',
      'Prüfintervall „automatisch“ lassen, außer es gibt einen Grund für ein kürzeres Intervall.',
    ]],
    anlageForm: ['Anlage anlegen / bearbeiten', [
      'Anlagen-Nr. wird automatisch vergeben und kann überschrieben werden.',
      'Je nach Anlagentyp erscheinen passende Felder (z. B. Brenner bei Öl, Außengeräte bei Wärmepumpe).',
      'Wärmepumpe: Bei einer Kaskade mit „+ weiteres Außengerät“ mehrere Außengeräte erfassen; jedes kann mit seinem Kältekreis (Kälteanlage) verbunden werden.',
      'Inneneinheiten: beliebig viele anlegen und per Häkchen einem oder mehreren Außengeräten zuordnen. Dazu Pufferspeicher erfassen.',
      'Das Wartungsintervall bestimmt, wann die nächste Wartung fällig wird.',
    ]],
    anlageKaelte: ['Kälteanlage', [
      'Oben die Stammdaten, das CO₂-Äquivalent und die nächste fällige Dichtheitskontrolle.',
      'Kältemittel-Bilanz: zugefügte und entnommene Mengen aus allen Einträgen (Installation zählt nicht mit).',
      '„+ Neuer Eintrag“ für Dichtheitskontrolle, Reparatur usw. – „+ Wartung“ öffnet direkt einen Wartungseintrag mit Checkliste.',
      '„PDF“ erzeugt das Anlagenbuch nach F-Gase-Verordnung mit allen Einträgen, Unterschriften und Fotos.',
      'Gehört die Anlage zu einer Wärmepumpe, ist sie oben verlinkt.',
    ]],
    anlage: ['Anlage', [
      'Oben die Stammdaten der Anlage und die nächste fällige Wartung.',
      'Wärmepumpe: Bei jedem Außengerät siehst du den verbundenen Kältekreis oder kannst ihn mit „Kälteanlage anlegen und verbinden“ direkt anlegen.',
      '„+ Neuer Eintrag“ für Wartung, Inspektion, Reparatur usw.',
      '„PDF“ erzeugt das Anlagenbuch mit allen Einträgen, Unterschriften und Fotos.',
    ]],
    eintragFormKaelte: ['Eintrag Kälteanlage', [
      'Tätigkeit wählen. Bei Dichtheitskontrolle muss das Ergebnis (dicht / Leckage) angegeben werden – sonst zählt sie nicht für die nächste Fälligkeit.',
      'Kältemittel zugefügt? Dann auch die Herkunft angeben (neu / recycelt / aufgearbeitet).',
      'Bei Leckage oder Reparatur erscheint das Feld für Ursache, Reparatur und Nachkontrolle.',
      'Bei Wartung/Instandhaltung, Installation und Reparatur: Messwerte, Checkliste der Arbeiten, Ersatzteile und Mängel.',
      'Fotos (z. B. Typenschild, Schaden) aufnehmen oder hinzufügen.',
      'Nach dem Speichern geht es weiter zur Unterschrift.',
    ]],
    eintragForm: ['Eintrag anlegen / bearbeiten', [
      'Tätigkeit und Datum wählen, Messwerte eintragen.',
      'Durchgeführte Arbeiten abhaken – weitere Arbeiten und Ersatzteile als Freitext.',
      'Ergebnis und Mängel / Empfehlungen festhalten, Fotos hinzufügen.',
      'Nach dem Speichern geht es weiter zur Unterschrift.',
    ]],
    eintrag: ['Eintrag', [
      'Alle Angaben des Eintrags auf einen Blick.',
      'Unten unterschreiben Techniker und Kunde direkt auf dem Bildschirm (Finger oder Stift).',
      'Nach der ersten Unterschrift ist der Eintrag gesperrt. Zum Ändern „Unterschriften zurücksetzen“.',
      'Die Unterschriften erscheinen im PDF des Anlagenbuchs.',
    ]],
    einstellungen: ['Einstellungen', [
      'Firmendaten, Zertifikat-Nr. und Techniker – erscheinen in neuen Einträgen und im PDF.',
      'Server: Adresse des eigenen Servers eintragen, um Daten zentral zu speichern und mit Kollegen zu teilen.',
      'Datensicherung: „Sicherung exportieren“ speichert alle Daten als Datei, „Sicherung importieren“ liest sie wieder ein. Ohne Server regelmäßig sichern!',
    ]],
    benutzer: ['Benutzer', [
      'Nur für Administratoren: mit „+ Benutzer anlegen“ neue Kollegen anlegen und bestehende bearbeiten.',
      'Rolle „Techniker“ darf Kunden, Anlagen und Einträge bearbeiten, „Administrator“ zusätzlich Benutzer verwalten.',
      'Name und Zertifikat-Nr. des Benutzers werden automatisch in neue Einträge übernommen.',
    ]],
  };

  /** Hilfethema zur aktuellen Seite. */
  function topic() {
    const [path, qs] = (location.hash.slice(1) || '/').split('?');
    const q = new URLSearchParams(qs || '');
    const p = path.split('/').filter(Boolean);
    if (typeof Sync !== 'undefined' && Sync.enabled && !Sync.loggedIn && p[0] !== 'einstellungen') return 'login';
    if (!p.length) return 'start';
    if (p[0] === 'b') return 'home';
    if (p[0] === 'einstellungen' || p[0] === 'benutzer') return p[0];
    const form = p[1] === 'neu' || p[2] === 'bearbeiten';
    if (p[0] === 'kunde') return form ? 'kundeForm' : 'kunde';
    if (p[0] === 'standort') return form ? 'standortForm' : 'standort';
    if (p[0] === 'anlage') {
      const s = Store.system(p[1]);
      const kaelte = s ? Areas.isKaelte(s) : (q.get('bereich') || Areas.current) === 'kaelte';
      return (form ? 'anlageForm' : 'anlage') + (kaelte ? 'Kaelte' : '');
    }
    if (p[0] === 'eintrag') {
      const e = Store.entry(p[1]);
      const s = Store.system(e ? e.systemId : q.get('anlage'));
      if (!form) return 'eintrag';
      return s && Areas.isKaelte(s) ? 'eintragFormKaelte' : 'eintragForm';
    }
    return 'start';
  }

  const modal = () => document.getElementById('helpModal');

  function show() {
    const [title, items] = T[topic()] || T.start;
    document.getElementById('helpTitle').textContent = '❓ ' + title;
    document.getElementById('helpBody').innerHTML = `<ul>${items.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`;
    modal().hidden = false;
    document.getElementById('helpClose').focus();
  }

  const hide = () => { modal().hidden = true; };

  function init() {
    document.getElementById('helpBtn').addEventListener('click', show);
    document.getElementById('helpClose').addEventListener('click', hide);
    modal().addEventListener('click', (e) => { if (e.target === modal()) hide(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal().hidden) hide(); });
    window.addEventListener('hashchange', hide);
  }

  return { init, show, hide, topic };
})();
