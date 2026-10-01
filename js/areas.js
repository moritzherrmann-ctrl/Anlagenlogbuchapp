/* Bereiche: Kälteanlagen (F-Gase), Heizungsanlagen (fossil), Trinkwasseranlagen.
   Kunden und Standorte sind gemeinsam, Anlagen gehören genau einem Bereich an. */
'use strict';

const Areas = (() => {
  const LS_KEY = 'anlagenbuch.bereich';

  // ---------- Heizung (klassische fossile Anlagen) ----------
  const HEIZUNG_TYPEN = [
    'Gas-Brennwertkessel', 'Gas-Brennwerttherme', 'Gas-Kombitherme', 'Gas-Niedertemperaturkessel',
    'Gas-Heizkessel atmosphärisch', 'Gas-Umlaufwasserheizer', 'Öl-Brennwertkessel', 'Öl-Niedertemperaturkessel',
    'Flüssiggas-Brennwertkessel', 'Gas-Warmwasserbereiter',
    'Luft/Wasser-Wärmepumpe', 'Sole/Wasser-Wärmepumpe', 'Wasser/Wasser-Wärmepumpe', 'Hybrid-Wärmepumpe',
  ];
  const isWP = (d) => /wärmepumpe/i.test(d.typ || '');
  const isOel = (d) => !isWP(d) && (/öl/i.test(d.brennstoff || '') || /öl/i.test(d.typ || ''));
  const fossil = (d) => !isWP(d);

  const heizung = {
    key: 'heizung',
    suffix: 'HZ',
    label: 'Heizungsanlagen',
    short: 'Heizung',
    icon: '🔥',
    desc: 'Gas-, Öl- und Flüssiggas-Feuerstätten, Wärmepumpen',
    pdfTitle: 'Anlagenbuch / Wartungsnachweis Heizungsanlage',
    pdfSubtitle: 'Nachweis über Wartung, Inspektion und Instandsetzung der Heizungsanlage.',
    notes: [
      ['Wartung:', 'Feuerstätten sind nach Herstellerangaben regelmäßig, in der Regel jährlich, durch einen Fachbetrieb zu warten (DVGW-TRGI / TRF bzw. DIN 4755 / DIN EN 15378).'],
      ['Messungen:', 'Emissionsmessungen nach 1. BImSchV erfolgen durch den bevollmächtigten Bezirksschornsteinfeger; die hier dokumentierten Werte dienen der Einstellung und Kontrolle.'],
      ['Aufbewahrung:', 'Wartungsnachweise zusammen mit den Anlagenunterlagen aufbewahren und bei Bedarf dem Schornsteinfeger vorlegen.'],
    ],
    typen: HEIZUNG_TYPEN,
    defaultInterval: 12,
    maintActs: ['Wartung', 'Inbetriebnahme'],
    taetigkeiten: ['Wartung', 'Inspektion', 'Reparatur', 'Störungsbeseitigung', 'Abgasmessung', 'Inbetriebnahme', 'Außerbetriebnahme'],
    systemSections: [
      {
        legend: 'Wärmeerzeuger',
        fields: [
          { name: 'typ', label: 'Anlagentyp', list: HEIZUNG_TYPEN, required: true },
          { name: 'brennstoff', label: 'Brennstoff', type: 'select', options: ['', 'Erdgas E', 'Erdgas LL', 'Flüssiggas (Propan)', 'Heizöl EL', 'Heizöl EL schwefelarm', 'Sonstiges'], when: fossil },

          { name: 'hersteller', label: 'Hersteller', when: fossil },
          { name: 'modell', label: 'Modell / Typ', when: fossil },
          { name: 'seriennr', label: 'Serien-Nr.', when: fossil },
          { name: 'baujahr', label: 'Baujahr', attrs: 'inputmode="numeric"' },
          { name: 'leistung', label: 'Nennwärmeleistung', unit: 'kW', num: true, when: fossil },
          { name: 'brenner', label: 'Brenner (Hersteller / Typ)', when: isOel, hint: 'bei Gebläsebrennern' },
          { name: 'oeltank', label: 'Öltank (Art / Volumen)', when: isOel },
        ],
      },
      {
        legend: 'Außengeräte / Kaskade',
        when: isWP,
        fields: [
          {
            name: 'aussengeraete', label: 'Außengeräte', type: 'units', unitLabel: 'Außengerät', full: true, min: 1,
            hint: 'Bei einer Kaskade jedes Außengerät einzeln erfassen. Jedes Außengerät hat einen eigenen Kältekreis, der als Kälteanlage geführt wird (Kältemittel, Dichtheitskontrollen nach F-Gase-Verordnung).',
            subfields: [
              { name: 'hersteller', label: 'Hersteller' },
              { name: 'modell', label: 'Modell / Typ' },
              { name: 'seriennr', label: 'Serien-Nr.' },
              { name: 'leistung', label: 'Heizleistung', unit: 'kW', num: true },
              { name: 'kaelteAnlage', label: 'Kältekreis (Kälteanlage)', type: 'systemLink' },
            ],
          },
        ],
      },
      {
        legend: 'Inneneinheiten',
        when: isWP,
        fields: [
          {
            name: 'innengeraete', label: 'Inneneinheiten', type: 'units', unitLabel: 'Inneneinheit', full: true, min: 0,
            hint: 'Jede Inneneinheit einem oder mehreren Außengeräten zuordnen (z. B. ein Kaskadenregler für alle Außengeräte).',
            subfields: [
              { name: 'art', label: 'Art', type: 'select', options: ['', 'Hydraulikmodul / Hydraulikstation', 'Inneneinheit mit integriertem Speicher', 'Split-Inneneinheit', 'Wärmepumpen-Regler / Kaskadenregler', 'Sonstiges'] },
              { name: 'hersteller', label: 'Hersteller' },
              { name: 'modell', label: 'Modell / Typ' },
              { name: 'seriennr', label: 'Serien-Nr.' },
              { name: 'aussen', label: 'Zugeordnet zu', type: 'unitRefs', ref: 'aussengeraete', refLabel: 'Außengerät' },
            ],
          },
        ],
      },
      {
        legend: 'Pufferspeicher',
        when: isWP,
        fields: [
          { name: 'pufferArt', label: 'Art', type: 'select', options: ['', 'kein Pufferspeicher', 'Trennpuffer', 'Reihenpuffer (Rücklauf)', 'Reihenpuffer (Vorlauf)', 'Kombispeicher (Heizung + Warmwasser)', 'Hygienespeicher'] },
          { name: 'pufferInhalt', label: 'Inhalt', unit: 'l', num: true },
          { name: 'pufferHersteller', label: 'Hersteller Pufferspeicher' },
          { name: 'pufferModell', label: 'Modell Pufferspeicher' },
          { name: 'pufferSeriennr', label: 'Serien-Nr. Pufferspeicher' },
        ],
      },
      {
        legend: 'Abgas & Hydraulik',
        fields: [
          { name: 'betriebsart', label: 'Betriebsart', type: 'select', options: ['', 'raumluftabhängig', 'raumluftunabhängig'], when: fossil },
          { name: 'abgasanlage', label: 'Abgasanlage', list: ['Schornstein', 'Luft-Abgas-System (LAS)', 'Abgasleitung im Schacht', 'Abgasleitung an der Fassade', 'Sonstige'], when: fossil },
          { name: 'aufstellung', label: 'Aufstellung', type: 'select', options: ['', 'Außenaufstellung', 'Innenaufstellung', 'Split (Innen- und Außeneinheit)'], when: isWP },
          { name: 'zusatzheizung', label: 'Zusatzheizung / Heizstab', unit: 'kW', num: true, when: isWP },
          { name: 'warmwasser', label: 'Warmwasserbereitung', type: 'select', options: ['', 'keine', 'Speicher', 'Durchlauf (Kombigerät)', 'Schichtspeicher', 'Frischwasserstation'] },
          { name: 'speicherInhalt', label: 'Speicherinhalt', unit: 'l', num: true },
          { name: 'mag', label: 'Ausdehnungsgefäß', unit: 'l', num: true },
        ],
      },
    ],
    entrySections: [
      {
        legend: 'Messwerte',
        fields: [
          { name: 'abgastemp', label: 'Abgastemperatur', unit: '°C', num: true, when: fossil },
          { name: 'lufttemp', label: 'Verbrennungslufttemperatur', unit: '°C', num: true, when: fossil },
          { name: 'o2', label: 'O2', unit: '%', num: true, when: fossil },
          { name: 'co2', label: 'CO2', unit: '%', num: true, when: fossil },
          { name: 'co', label: 'CO (unverdünnt)', unit: 'ppm', num: true, when: fossil },
          { name: 'abgasverlust', label: 'Abgasverlust qA', unit: '%', num: true, when: fossil },
          { name: 'zug', label: 'Förderdruck / Zug', unit: 'hPa', num: true, when: fossil },
          { name: 'russzahl', label: 'Rußzahl', num: true, when: isOel },
          { name: 'oelderivate', label: 'Ölderivate', type: 'select', options: ['', 'nein', 'ja'], when: isOel },
          { name: 'gasFliessdruck', label: 'Gas-Anschlussfließdruck', unit: 'mbar', num: true, when: (s) => fossil(s) && !isOel(s) },
          { name: 'aussentemp', label: 'Außentemperatur', unit: '°C', num: true, when: isWP },
          { name: 'vorlauf', label: 'Vorlauftemperatur', unit: '°C', num: true, when: isWP },
          { name: 'ruecklauf', label: 'Rücklauftemperatur', unit: '°C', num: true, when: isWP },
          { name: 'anlagendruck', label: 'Anlagendruck', unit: 'bar', num: true },
          { name: 'magVordruck', label: 'MAG-Vordruck', unit: 'bar', num: true },
        ],
      },
    ],
    arbeiten: [
      { t: 'Brenner gereinigt und geprüft', when: fossil }, { t: 'Brennraum / Wärmetauscher gereinigt', when: fossil },
      { t: 'Zünd- und Überwachungselektrode geprüft / eingestellt', when: fossil },
      { t: 'Gasarmatur und Gasleitung auf Dichtheit geprüft', when: (d) => fossil(d) && !isOel(d) },
      { t: 'Ölfilter gewechselt', when: isOel }, { t: 'Öldüse gewechselt', when: isOel },
      { t: 'Kondensatablauf / Siphon gereinigt', when: fossil }, { t: 'Neutralisation geprüft', when: fossil },
      { t: 'Abgasweg auf Dichtheit geprüft', when: fossil },
      { t: 'Verdampfer / Lamellen gereinigt', when: isWP }, { t: 'Ventilator geprüft', when: isWP },
      { t: 'Tauwasserablauf gereinigt / Ablaufheizung geprüft', when: isWP }, { t: 'Elektrische Anschlüsse geprüft', when: isWP },
      { t: 'Heizstab / Zusatzheizung geprüft', when: isWP }, { t: 'Schmutzfänger / Filter im Heizkreis gereinigt', when: isWP },
      'Sicherheitsventil geprüft', 'Ausdehnungsgefäß geprüft', 'Anlagendruck / Heizungswasser geprüft', 'Regelung / Heizkurve geprüft',
      'Umwälzpumpe geprüft', 'Sicherheitseinrichtungen geprüft',
    ],
  };

  // ---------- Trinkwasser ----------
  // Richtwerte für Wartungsintervalle (Monate) in Anlehnung an DIN EN 806-5 – bitte je Anlage prüfen.
  const TW_TYPEN = {
    'Trinkwassererwärmer / Warmwasserspeicher': 12,
    'Hauswasserstation': 6,
    'Filter (rückspülbar)': 6,
    'Filter (Wechselfilter / Kartusche)': 6,
    'Systemtrenner BA': 6,
    'Systemtrenner CA': 12,
    'Rohrtrenner': 12,
    'Druckminderer': 12,
    'Sicherheitsventil / Sicherheitsgruppe': 6,
    'Enthärtungsanlage': 6,
    'Dosieranlage': 6,
    'Thermostatischer Mischer / Armatur': 12,
    'Rückflussverhinderer': 12,
    'Zirkulationspumpe': 12,
    'Wasserzähler': 0,
    'Sonstige Komponente': 12,
  };
  const t = (d) => d.typ || '';
  const isSpeicher = (d) => /speicher|erwärmer/i.test(t(d));
  const isArmatur = (d) => /filter|systemtrenner|rohrtrenner|druckminderer|rückfluss|hauswasser|sicherheits|mischer|zähler/i.test(t(d));
  const isEnth = (d) => /enthärtung|dosier/i.test(t(d));
  const hasDruck = (d) => /druckminderer|hauswasser|filter|systemtrenner/i.test(t(d));

  const trinkwasser = {
    key: 'trinkwasser',
    suffix: 'TW',
    label: 'Trinkwasseranlagen',
    short: 'Trinkwasser',
    icon: '💧',
    desc: 'Speicher, Armaturen, Filter, Systemtrenner …',
    pdfTitle: 'Anlagenbuch / Wartungsnachweis Trinkwasserinstallation',
    pdfSubtitle: 'Nachweis über Inspektion und Wartung von Apparaten der Trinkwasserinstallation (DIN EN 806-5).',
    notes: [
      ['Betreiberpflicht:', 'Trinkwasserinstallationen sind nach den allgemein anerkannten Regeln der Technik zu betreiben und instand zu halten (TrinkwV, DIN EN 806-5, DIN 1988).'],
      ['Intervalle:', 'Inspektion und Wartung von Filtern, Sicherungsarmaturen, Druckminderern und Trinkwassererwärmern nach DIN EN 806-5 bzw. Herstellerangaben.'],
      ['Temperaturen:', 'Bei Großanlagen am Austritt des Trinkwassererwärmers mind. 60 °C, Zirkulationsrücklauf mind. 55 °C (DVGW W 551).'],
    ],
    typen: Object.keys(TW_TYPEN),
    typeIntervals: TW_TYPEN,
    defaultInterval: 12,
    maintActs: ['Inspektion', 'Wartung', 'Rückspülung', 'Filterwechsel', 'Funktionsprüfung', 'Austausch', 'Einbau / Inbetriebnahme'],
    taetigkeiten: ['Inspektion', 'Wartung', 'Rückspülung', 'Filterwechsel', 'Funktionsprüfung', 'Reparatur', 'Austausch', 'Einbau / Inbetriebnahme', 'Probenahme'],
    systemSections: [
      {
        legend: 'Komponente',
        fields: [
          { name: 'typ', label: 'Art der Komponente', type: 'select', options: ['', ...Object.keys(TW_TYPEN)], required: true },
          { name: 'hersteller', label: 'Hersteller' },
          { name: 'modell', label: 'Modell / Typ' },
          { name: 'seriennr', label: 'Serien-Nr.' },
          { name: 'nennweite', label: 'Nennweite', hint: 'z. B. DN 25 / 1"', when: isArmatur },
          { name: 'inhalt', label: 'Inhalt', unit: 'l', num: true, when: isSpeicher },
          { name: 'beheizung', label: 'Beheizung', type: 'select', options: ['', 'Heizung (indirekt)', 'Solar', 'Wärmepumpe', 'Elektro', 'Gas direkt', 'Fernwärme'], when: isSpeicher },
          { name: 'anode', label: 'Korrosionsschutz', type: 'select', options: ['', 'Magnesiumanode', 'Fremdstromanode', 'Edelstahl (keine Anode)'], when: isSpeicher },
          { name: 'sollDruck', label: 'Eingestellter Hinterdruck', unit: 'bar', num: true, when: hasDruck },
          { name: 'regeneriermittel', label: 'Regeneriermittel / Wirkstoff', when: isEnth },
        ],
      },
    ],
    entrySections: [
      {
        legend: 'Messwerte',
        fields: [
          { name: 'vordruck', label: 'Vordruck / Eingangsdruck', unit: 'bar', num: true, when: (s) => hasDruck(s) || isArmatur(s) },
          { name: 'hinterdruck', label: 'Hinterdruck / Ausgangsdruck', unit: 'bar', num: true, when: hasDruck },
          // nicht mehr erfasst – nur noch Anzeige bereits gespeicherter Werte
          { name: 'differenzdruck', label: 'Differenzdruck Systemtrenner', unit: 'bar', num: true, legacy: true, when: (s) => /systemtrenner/i.test(t(s)) },
          { name: 'wwTemp', label: 'Warmwassertemperatur (Austritt)', unit: '°C', num: true, when: isSpeicher },
          { name: 'zirkTemp', label: 'Zirkulationsrücklauf', unit: '°C', num: true, when: (s) => isSpeicher(s) || /zirkulation/i.test(t(s)) },
          { name: 'anodeZustand', label: 'Zustand Schutzanode', type: 'select', options: ['', 'in Ordnung', 'verbraucht – getauscht', 'verbraucht – Tausch empfohlen'], when: isSpeicher },
          { name: 'haerteRoh', label: 'Härte Rohwasser', unit: '°dH', num: true, when: isEnth },
          { name: 'haerteWeich', label: 'Härte Weichwasser / Verschnitt', unit: '°dH', num: true, when: isEnth },
        ],
      },
    ],
    arbeiten: [
      'Sichtprüfung / Dichtheit', 'Funktionsprüfung', 'Filter rückgespült', 'Filtereinsatz gewechselt', 'Siebe / Dichtungen gereinigt bzw. getauscht',
      'Druckminderer geprüft / eingestellt', 'Sicherheitsventil angelüftet', 'Kartuscheneinsatz getauscht', 'Rückflussverhinderer geprüft',
      'Speicher gereinigt / entkalkt', 'Schutzanode geprüft', 'Thermische Desinfektion durchgeführt', 'Regeneriersalz / Wirkstoff nachgefüllt',
    ],
  };

  const kaelte = {
    key: 'kaelte',
    suffix: 'K',
    label: 'Kälteanlagen',
    short: 'Kälte',
    icon: '❄️',
    desc: 'Klima- und Kälteanlagen nach F-Gase-Verordnung',
    // Wartung / Instandhaltung: Messwerte und Checkliste (Formular in app.js)
    workActs: ['Wartung/Instandhaltung', 'Installation', 'Reparatur'],
    entrySections: [
      {
        legend: 'Messwerte',
        fields: [
          { name: 'aussentemp', label: 'Außentemperatur', unit: '°C', num: true },
          { name: 'hochdruck', label: 'Hochdruck', unit: 'bar', num: true },
          { name: 'niederdruck', label: 'Niederdruck', unit: 'bar', num: true },
          { name: 'verfluessigung', label: 'Verflüssigungstemperatur', unit: '°C', num: true },
          { name: 'verdampfung', label: 'Verdampfungstemperatur', unit: '°C', num: true },
          { name: 'ueberhitzung', label: 'Überhitzung', unit: 'K', num: true },
          { name: 'unterkuehlung', label: 'Unterkühlung', unit: 'K', num: true },
          { name: 'luftEin', label: 'Lufteintritt Innengerät', unit: '°C', num: true },
          { name: 'luftAus', label: 'Luftaustritt Innengerät', unit: '°C', num: true },
          { name: 'stromaufnahme', label: 'Stromaufnahme Verdichter', unit: 'A', num: true },
        ],
      },
    ],
    arbeiten: [
      'Sichtprüfung Anlage auf Beschädigung, Ölspuren und Korrosion',
      'Kältemittelleitungen, Verbindungen und Isolierung geprüft',
      'Luftfilter Innengerät gereinigt / gewechselt',
      'Verdampfer / Wärmetauscher Innengerät gereinigt',
      'Verflüssiger / Lamellen Außengerät gereinigt',
      'Kondensatwanne gereinigt und desinfiziert',
      'Kondensatablauf / Kondensatpumpe geprüft',
      'Ventilatoren und Lager geprüft',
      'Verdichter geprüft (Geräusch, Vibration, Stromaufnahme)',
      'Betriebsdrücke und Temperaturen gemessen',
      'Sicherheits- und Druckschalter geprüft',
      'Elektrische Anschlüsse und Klemmen geprüft / nachgezogen',
      'Regelung / Fernbedienung / Sensoren geprüft',
      'Befestigung und Schwingungsdämpfer geprüft',
      { t: 'Leckage-Erkennungssystem geprüft', when: (s) => s.leckageSystem === 'ja' },
      { t: 'Abtauung / Abtauheizung geprüft', when: (s) => /kühl|tiefkühl|wärmepumpe/i.test(s.typ || '') },
      { t: 'Türdichtungen und Türheizung geprüft', when: (s) => /kühlzelle|kühlraum|kühlmöbel/i.test(s.typ || '') },
      'Probelauf / Funktionsprüfung durchgeführt',
    ],
  };

  const all = { kaelte, heizung, trinkwasser };
  const keys = Object.keys(all);

  const get = (key) => all[key] || kaelte;
  const of = (sys) => (sys && all[sys.bereich] ? sys.bereich : 'kaelte');
  const isKaelte = (sys) => of(sys) === 'kaelte';

  let current = 'kaelte';
  try { if (all[localStorage.getItem(LS_KEY)]) current = localStorage.getItem(LS_KEY); } catch { /* ohne Speicher */ }

  function setCurrent(key) {
    if (!all[key]) return;
    current = key;
    try { localStorage.setItem(LS_KEY, key); } catch { /* ohne Speicher */ }
  }

  /** Alle Felder (Anlage oder Eintrag) eines Bereichs, gefiltert nach Sichtbarkeit für die Anlage. */
  const visible = (fields, data) => fields.filter((f) => !f.when || f.when(data || {}));

  /** Arbeiten-Checkliste passend zur Anlage (Einträge können eine Bedingung „when“ haben). */
  const arbeitenFor = (area, sys) => (area.arbeiten || [])
    .filter((a) => typeof a === 'string' || !a.when || a.when(sys || {}))
    .map((a) => (typeof a === 'string' ? a : a.t));

  const linkLabel = (id) => {
    const x = Store.system(id);
    return x ? [x.anlagenNr, x.bezeichnung].filter(Boolean).join(' – ') : '';
  };

  /** Zuordnung zu Geräten einer anderen Liste als Text, z. B. „Außengerät 1, 2“. */
  function refText(sf, ids, sys) {
    const ref = (sys && sys[sf.ref]) || [];
    const nums = (ids || []).map((id) => ref.findIndex((u) => u.id === id) + 1).filter((n) => n > 0).sort((a, b) => a - b);
    if (!nums.length) return '';
    return nums.length === ref.length && ref.length > 1 ? `alle ${sf.refLabel}e` : `${sf.refLabel} ${nums.join(', ')}`;
  }

  /** Teile einer Geräte-Zeile (ohne Kältekreis-Verknüpfung). */
  const unitParts = (f, u, sys) => f.subfields.filter((sf) => sf.type !== 'systemLink').map((sf) => {
    if (sf.type === 'unitRefs') { const t = refText(sf, u[sf.name], sys); return t ? `für ${t}` : ''; }
    return display(sf, u[sf.name]);
  }).filter(Boolean);

  /** Eine Zeile je Gerät (Kaskade) für Anzeige/PDF. */
  function unitLines(f, units, sys) {
    const lines = (units || []).map((u, i) => {
      const link = linkLabel(u.kaelteAnlage);
      return `${f.unitLabel} ${i + 1}: ${unitParts(f, u, sys).join(', ') || '–'}${link ? ` · Kältekreis ${link}` : ''}`;
    });
    const total = (units || []).reduce((a, u) => a + (FGas.num(u.leistung) || 0), 0);
    if (f.name === 'aussengeraete' && (units || []).length > 1 && total) lines.push(`Kaskade gesamt: ${fmtNum(total, 1)} kW`);
    return lines;
  }

  /** Abschnitte mit Bedingung und ihre sichtbaren Felder. */
  const visibleSections = (sections, data) => sections
    .filter((sec) => !sec.when || sec.when(data || {}))
    .map((sec) => ({ ...sec, fields: visible(sec.fields, data) }))
    .filter((sec) => sec.fields.length);

  /** Wert mit Einheit für Anzeige/PDF. */
  function display(f, v, sys) {
    if (f.type === 'units') return unitLines(f, v, sys).join('\n');
    if (v === undefined || v === null || v === '' || v === false) return '';
    if (f.type === 'systemLink') return linkLabel(v);
    const val = f.num ? fmtNum(v, 3) : String(v);
    return f.unit ? `${val} ${f.unit}` : val;
  }

  /** Wärmepumpen (mit Außengerät-Nr.), deren Kältekreis die angegebene Kälteanlage ist. */
  function heatPumpsOf(kaelteId) {
    const out = [];
    for (const x of Store.get().systems) {
      if (of(x) !== 'heizung') continue;
      (x.aussengeraete || []).forEach((u, i) => { if (u.kaelteAnlage === kaelteId) out.push({ wp: x, nr: i + 1, count: x.aussengeraete.length }); });
    }
    return out;
  }

  return {
    all, keys, get, of, isKaelte, isWP, get current() { return current; }, setCurrent, visible, visibleSections, display, unitParts, arbeitenFor, heatPumpsOf,
  };
})();
