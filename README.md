# Anlagenbuch Kälte/Klima

Web-App (PWA) zum Führen von Anlagenbüchern / Logbüchern für Klima- und Kälteanlagen
nach Art. 7 der F-Gase-Verordnung (EU) 2024/573 – für **Moritz Herrmann Heizung und Klima**.

## Bereiche

Beim Öffnen wählt man den Bereich – Kunden und Standorte sind in allen Bereichen dieselben:

- **❄️ Kälteanlagen** – Anlagenbuch nach F-Gase-Verordnung (siehe unten)
- **🔥 Heizungsanlagen** – klassische fossile Feuerstätten (Gas, Öl, Flüssiggas): Kessel-/Brennerdaten,
  Abgas-Messwerte (Abgastemperatur, O2, CO2, CO, qA, Zug, Rußzahl …), Checkliste der Wartungsarbeiten
- **💧 Trinkwasseranlagen** – Speicher, Hauswasserstationen, Filter, Systemtrenner, Druckminderer,
  Sicherheitsventile, Enthärtung, Armaturen …; Wartungsintervall-Richtwerte je Komponente
  (in Anlehnung an DIN EN 806-5), passende Messwerte (Drücke, Temperaturen, Härte)

Jeder Bereich hat seine eigene Startseite mit den nächsten fälligen Terminen, eigene Protokolle
mit Unterschrift und eine eigene PDF-Ausgabe.

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

- GWP-Werte der Kältemittel-Auswahl laut Tabelle der Bundesfachschule Kälte-Klima-Technik
  (Basis IPCC AR4 / VO (EU) 517/2014); der Wert ist in jeder Anlage editierbar.
- Prüfintervalle: ab 5 t CO2e alle 12 Monate, ab 50 t alle 6, ab 500 t alle 3 Monate;
  mit Leckage-Erkennungssystem verdoppelt; hermetisch geschlossene Einrichtungen unter 10 t CO2e ausgenommen.
- Verwendete Bibliotheken: [jsPDF](https://github.com/parallax/jsPDF) und
  [jsPDF-AutoTable](https://github.com/simonbengtsson/jsPDF-AutoTable) (MIT, im Ordner `vendor/`).

## Android-App (APK)

Die Web-App wird mit [Capacitor](https://capacitorjs.com) in eine Android-App verpackt.
Gebaut wird per GitHub Actions (`.github/workflows/android.yml`). **Der automatische Bau ist
vorerst abgeschaltet** – nur manuell über *Actions → Android-APK → Run workflow*.

- **Download der aktuellen Version:**
  https://github.com/moritzherrmann-ctrl/Anlagenlogbuchapp/releases/latest/download/Anlagenbuch.apk
- **Signierung:** Repository-Secrets `ANDROID_KEYSTORE_BASE64` und `ANDROID_KEYSTORE_PASSWORD`
  (Alias `anlagenbuch`). Ohne Secrets wird nur eine Test-APK als Workflow-Artefakt gebaut.
  Den Signierschlüssel sicher aufbewahren – ohne ihn sind keine Updates mehr möglich.
- In der App öffnen „PDF speichern / teilen“ und „Sicherung exportieren“ das Android-Teilen-Menü.
- Die App-Daten liegen getrennt von der Browser-Version. Umzug über
  *Einstellungen → Sicherung exportieren/importieren*.

Lokal bauen (Android Studio / Android SDK nötig): `npm ci && npm run android:add`,
dann `android/` in Android Studio öffnen.
