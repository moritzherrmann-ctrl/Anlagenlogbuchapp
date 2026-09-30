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
  ];
  const isOel = (d) => /öl/i.test(d.brennstoff || '') || /öl/i.test(d.typ || '');

  const heizung = {
    key: 'heizung',
    label: 'Heizungsanlagen',
    short: 'Heizung',
    icon: '🔥',
    desc: 'Gas-, Öl- und Flüssiggas-Feuerstätten',
    pdfTitle: 'Anlagenbuch / Wartungsnachweis Heizungsanlage',
    pdfSubtitle: 'Nachweis über Wartung, Inspektion und Instandsetzung der Feuerungsanlage.',
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
          { name: 'brennstoff', label: 'Brennstoff', type: 'select', options: ['', 'Erdgas E', 'Erdgas LL', 'Flüssiggas (Propan)', 'Heizöl EL', 'Heizöl EL schwefelarm', 'Sonstiges'] },
          { name: 'hersteller', label: 'Hersteller' },
          { name: 'modell', label: 'Modell / Typ' },
          { name: 'seriennr', label: 'Serien-Nr.' },
          { name: 'baujahr', label: 'Baujahr', attrs: 'inputmode="numeric"' },
          { name: 'leistung', label: 'Nennwärmeleistung', unit: 'kW', num: true },
          { name: 'brenner', label: 'Brenner (Hersteller / Typ)', when: isOel, hint: 'bei Gebläsebrennern' },
          { name: 'oeltank', label: 'Öltank (Art / Volumen)', when: isOel },
        ],
      },
      {
        legend: 'Abgas & Hydraulik',
        fields: [
          { name: 'betriebsart', label: 'Betriebsart', type: 'select', options: ['', 'raumluftabhängig', 'raumluftunabhängig'] },
          { name: 'abgasanlage', label: 'Abgasanlage', list: ['Schornstein', 'Luft-Abgas-System (LAS)', 'Abgasleitung im Schacht', 'Abgasleitung an der Fassade', 'Sonstige'] },
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
          { name: 'abgastemp', label: 'Abgastemperatur', unit: '°C', num: true },
          { name: 'lufttemp', label: 'Verbrennungslufttemperatur', unit: '°C', num: true },
          { name: 'o2', label: 'O2', unit: '%', num: true },
          { name: 'co2', label: 'CO2', unit: '%', num: true },
          { name: 'co', label: 'CO (unverdünnt)', unit: 'ppm', num: true },
          { name: 'abgasverlust', label: 'Abgasverlust qA', unit: '%', num: true },
          { name: 'zug', label: 'Förderdruck / Zug', unit: 'hPa', num: true },
          { name: 'russzahl', label: 'Rußzahl', num: true, when: isOel },
          { name: 'oelderivate', label: 'Ölderivate', type: 'select', options: ['', 'nein', 'ja'], when: isOel },
          { name: 'gasFliessdruck', label: 'Gas-Anschlussfließdruck', unit: 'mbar', num: true, when: (s) => !isOel(s) },
          { name: 'anlagendruck', label: 'Anlagendruck', unit: 'bar', num: true },
          { name: 'magVordruck', label: 'MAG-Vordruck', unit: 'bar', num: true },
        ],
      },
    ],
    arbeiten: [
      'Brenner gereinigt und geprüft', 'Brennraum / Wärmetauscher gereinigt', 'Zünd- und Überwachungselektrode geprüft / eingestellt',
      'Gasarmatur und Gasleitung auf Dichtheit geprüft', 'Ölfilter gewechselt', 'Öldüse gewechselt', 'Kondensatablauf / Siphon gereinigt',
      'Neutralisation geprüft', 'Abgasweg auf Dichtheit geprüft', 'Sicherheitsventil geprüft', 'Ausdehnungsgefäß geprüft',
      'Anlagendruck / Heizungswasser geprüft', 'Regelung / Heizkurve geprüft', 'Umwälzpumpe geprüft', 'Sicherheitseinrichtungen geprüft',
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
          { name: 'differenzdruck', label: 'Differenzdruck Systemtrenner', unit: 'bar', num: true, when: (s) => /systemtrenner/i.test(t(s)) },
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
      'Druckminderer geprüft / eingestellt', 'Sicherheitsventil angelüftet', 'Systemtrenner geprüft (Differenzdruck)', 'Rückflussverhinderer geprüft',
      'Speicher gereinigt / entkalkt', 'Schutzanode geprüft', 'Thermische Desinfektion durchgeführt', 'Regeneriersalz / Wirkstoff nachgefüllt',
    ],
  };

  const kaelte = {
    key: 'kaelte',
    label: 'Kälteanlagen',
    short: 'Kälte',
    icon: '❄️',
    desc: 'Klima- und Kälteanlagen nach F-Gase-Verordnung',
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

  /** Wert mit Einheit für Anzeige/PDF. */
  function display(f, v) {
    if (v === undefined || v === null || v === '' || v === false) return '';
    const val = f.num ? fmtNum(v, 3) : String(v);
    return f.unit ? `${val} ${f.unit}` : val;
  }

  return { all, keys, get, of, isKaelte, get current() { return current; }, setCurrent, visible, display };
})();
