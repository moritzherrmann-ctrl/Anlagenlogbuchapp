# Anlagenbuch-Server (eigener Server)

Der Server liefert die App aus, verwaltet die **Benutzer** und speichert alle Daten **zentral**.
Die App arbeitet weiterhin offline und gleicht Änderungen automatisch ab, sobald eine Verbindung besteht.

## Starten mit Docker (empfohlen)

Voraussetzung: Docker mit „docker compose“ (z. B. auf einem Linux-Server, VPS oder NAS wie Synology/QNAP).

```bash
git clone https://github.com/moritzherrmann-ctrl/Anlagenlogbuchapp.git
cd Anlagenlogbuchapp
docker compose up -d --build
```

Die App ist dann unter `http://<server>:8080` erreichbar. Beim ersten Aufruf legst du den
**ersten Administrator** an. Danach unter *Einstellungen → Benutzer verwalten* weitere Benutzer.

### HTTPS mit eigener Domain

Für den Zugriff aus dem Internet (und damit die App auf dem Handy installierbar ist) wird HTTPS benötigt.
1. DNS-Eintrag der Domain (z. B. `anlagenbuch.meine-firma.de`) auf die IP des Servers zeigen lassen,
   Ports 80 und 443 freigeben.
2. Starten mit:
   ```bash
   DOMAIN=anlagenbuch.meine-firma.de docker compose --profile https up -d --build
   ```
   Caddy besorgt das Zertifikat (Let's Encrypt) automatisch.

Alternativ kann ein vorhandener Reverse-Proxy (nginx, Synology-Reverse-Proxy …) auf Port 8080 weiterleiten.

## Ohne Docker

Node.js ab Version 18 installieren, dann:

```bash
node server/server.js
```

Einstellungen über Umgebungsvariablen:

| Variable | Bedeutung | Standard |
|---|---|---|
| `PORT` | Port | `8080` |
| `DATA_DIR` | Datenverzeichnis | `server/data` |
| `ALLOWED_ORIGINS` | Fremde Adressen, die zugreifen dürfen (kommagetrennt), z. B. `https://localhost` für die Android-App | – |
| `ADMIN_USER`, `ADMIN_PASSWORD`, `ADMIN_NAME` | Legt beim ersten Start einen Administrator an | – |

## Daten & Sicherung

- Alle Daten liegen in `db.json` im Datenverzeichnis (bei Docker im Volume `anlagenbuch-daten`).
- Der Server legt täglich eine Sicherung unter `backups/` an und behält die letzten 60 Tage.
- Zusätzlich empfiehlt sich eine Sicherung des Datenverzeichnisses auf ein anderes Medium.
- Docker-Volume sichern: `docker run --rm -v anlagenbuchapp_anlagenbuch-daten:/data -v "$PWD":/b alpine tar czf /b/anlagenbuch-sicherung.tgz -C /data .`

## Benutzer & Rechte

- **Administrator**: alles, zusätzlich Benutzer anlegen, sperren, Passwörter zurücksetzen.
- **Techniker**: Kunden, Standorte, Anlagen und Einträge bearbeiten, unterschreiben, PDFs erstellen.
- Der Name des angemeldeten Benutzers wird bei neuen Einträgen als Techniker vorbelegt,
  die Personal-Zertifikat-Nr. ebenfalls.
- Gesperrte Benutzer werden sofort abgemeldet. Nach 10 falschen Passwörtern wird die Anmeldung
  von dieser Adresse für 15 Minuten gesperrt.

## Android-App / GitHub-Pages-Version verbinden

In der App unter *Einstellungen → Server-Adresse* die HTTPS-Adresse des Servers eintragen.
Die Adresse muss in `ALLOWED_ORIGINS` erlaubt sein (in `docker-compose.yml` bereits für die
Android-App und GitHub Pages eingetragen).
