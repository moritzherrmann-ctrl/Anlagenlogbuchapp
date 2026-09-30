// Kopiert die Web-App (statische Dateien) nach www/ – Grundlage für die Android-App.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const out = path.join(root, 'www');
const items = ['index.html', 'styles.css', 'manifest.webmanifest', 'js', 'vendor', 'icons'];

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out);
for (const item of items) fs.cpSync(path.join(root, item), path.join(out, item), { recursive: true });
console.log('www/ erstellt:', items.join(', '));
