# Anlagenbuch Kälte/Klima

Web-App (PWA) zum Führen von Anlagenbüchern / Logbüchern für Klima- und Kälteanlagen
nach Art. 7 der F-Gase-Verordnung (EU) 2024/573 – für **Moritz Herrmann Heizung und Klima**.

## Funktionen

- **Startseite: nächste Dichtheitskontrollen** – alle anstehenden Dichtheitskontrollen und
  Nachkontrollen der prüfpflichtigen Anlagen, nach Datum sortiert, überfällige rot markiert
- **Startseite: nächste Wartungen** – nach Wartungsintervall der Anlagen, nach Datum sortiert
- **Kunden** (Betreiber) anlegen, bearbeiten, suchen
- **Automatische Anlagen-Nr.**: Kunden-Nr. + laufende Nummer (z. B. `10023-0001`, `10023-0002`, …);
  Nummern gelöschter Anlagen werden nicht erneut vergeben
- **Standorte** je Kunde (z. B. Filialen, Lager) mit eigener Anschrift und Ansprechpartner
- **Anlagen** je Standort anlegen – alle Stammdaten der Vorlage:
  Betreiber, Standort (+ Aufstellort), Anlagen-Nr./Bezeichnung, Anlagentyp, Kältemittel, GWP-Wert,
  Füllmenge, CO2-Äquivalent (automatisch), Prüfintervall (automatisch berechnet, überschreibbar),
  Leckage-Erkennungssystem ja/nein, errichtet am/durch (Fachbetrieb, Zertifikat-Nr.)
- **Einträge / Prüfungen** je Anlage: Datum, Tätigkeit, Menge zugefügt/entnommen,
  Herkunft (neu/recycelt/aufgearbeitet), Ergebnis Dichtheitskontrolle, Leckage-Ursache & Reparatur,
  Nachkontrolle am, Fachbetrieb/Techniker + Zertifikat-Nr., Bemerkung
- **Digitale Unterschrift** von Techniker und (optional) Betreiber per Finger/Stift/Maus.
  Unterschriebene Einträge sind gesperrt.
- **PDF-Ausgabe** je Anlage im Layout der Vorlage (Blatt 1 Stammdaten + Pflichten,
  ab Blatt 2 chronologische Einträge mit Unterschriften)
- **Fälligkeiten**: nächste Wartung (einstellbares Wartungsintervall je Anlage, Standard 12 Monate)
  sowie nächste Dichtheitskontrolle bzw. Nachkontrolle nach Leckage
- **Offline-fähig** und auf dem Handy/Tablet als App installierbar („Zum Home-Bildschirm“)
- **Datensicherung** als JSON-Datei exportieren/importieren (auch zum Übertragen auf ein anderes Gerät)

## Nutzung

Die App besteht nur aus statischen Dateien – kein Server, keine Datenbank nötig.

- **Lokal testen:** im Projektordner `python3 -m http.server 8000` und `http://localhost:8000` öffnen.
- **Online stellen:** Ordner auf einen beliebigen Webspace hochladen oder GitHub Pages
  aktivieren (Settings → Pages → Branch wählen). Für Installation als App und Offline-Betrieb ist HTTPS nötig.

## Wichtig: Datenspeicherung

Alle Daten liegen **nur auf dem jeweiligen Gerät** im Browser (IndexedDB).
Bitte regelmäßig unter *Einstellungen → Sicherung exportieren* eine Sicherung erstellen –
die Aufzeichnungen müssen mindestens 5 Jahre aufbewahrt werden.

## Hinweise

- GWP-Werte der Kältemittel-Auswahl nach VO (EU) 2024/573 (Gemische berechnet); der Wert
  ist in jeder Anlage editierbar und sollte mit dem Typenschild/Datenblatt abgeglichen werden.
- Prüfintervalle: ab 5 t CO2e alle 12 Monate, ab 50 t alle 6, ab 500 t alle 3 Monate;
  mit Leckage-Erkennungssystem verdoppelt; hermetisch geschlossene Einrichtungen unter 10 t CO2e ausgenommen.
- Verwendete Bibliotheken: [jsPDF](https://github.com/parallax/jsPDF) und
  [jsPDF-AutoTable](https://github.com/simonbengtsson/jsPDF-AutoTable) (MIT, im Ordner `vendor/`).
