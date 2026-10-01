/* Fotos zu Einträgen: aufnehmen/auswählen, verkleinern, anzeigen (Vorschau + Großansicht) */
'use strict';

const Photos = (() => {
  const MAX_SIDE = 1600; // längste Seite in Pixel
  const QUALITY = 0.72; // JPEG-Qualität → ca. 150–300 KB je Foto
  const MAX_PER_ENTRY = 12;
  const VALID = /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/;
  const cache = new Map();

  /** Bilddatei laden, auf MAX_SIDE verkleinern und als JPEG zurückgeben. */
  async function resize(file) {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = () => reject(new Error(`„${file.name}“ ist kein lesbares Bild.`));
        i.src = url;
      });
      const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.max(1, Math.round(img.naturalWidth * scale));
      const h = Math.max(1, Math.round(img.naturalHeight * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      return { data: canvas.toDataURL('image/jpeg', QUALITY), w, h };
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function add(file) {
    const { data, w, h } = await resize(file);
    const id = Store.uid();
    await Store.putPhoto(id, data);
    cache.set(id, data);
    return { id, w, h, at: new Date().toISOString() };
  }

  /** Foto holen: Zwischenspeicher → Gerät → Server (wird dann auf dem Gerät abgelegt). */
  async function get(id) {
    if (cache.has(id)) return cache.get(id);
    let data = await Store.getPhoto(id);
    if (!data && Sync.loggedIn) {
      try {
        data = await Sync.fetchPhoto(id);
        if (VALID.test(data || '')) await Store.putPhoto(id, data, { remote: true });
      } catch { data = null; }
    }
    if (!VALID.test(data || '')) return null;
    cache.set(id, data);
    return data;
  }

  /** Alle Fotos der Einträge laden (für das PDF). */
  async function load(entries) {
    const map = new Map();
    for (const f of entries.flatMap((e) => e.fotos || [])) {
      const data = await get(f.id);
      if (data) map.set(f.id, data);
    }
    return map;
  }

  const thumb = (f, removable) => `
    <div class="photo" data-photo="${esc(f.id)}">
      <button type="button" class="photo-open" aria-label="Foto vergrößern"><img alt="Foto" loading="lazy"></button>
      ${removable ? '<button type="button" class="photo-del" aria-label="Foto entfernen">✕</button>' : ''}
    </div>`;

  /** Bilder in die Vorschau-Kacheln laden und Klick → Großansicht. */
  function fill(root) {
    root.querySelectorAll('.photo[data-photo]').forEach(async (el) => {
      const img = el.querySelector('img');
      if (img.src) return;
      const data = await get(el.dataset.photo);
      if (data) img.src = data;
      else el.classList.add('missing');
    });
  }

  // ---------- Formular: Fotos hinzufügen/entfernen ----------
  function editorHtml() {
    return `
      <fieldset class="card">
        <legend>Fotos</legend>
        <div class="photo-grid" id="photoGrid"></div>
        <div class="actions" style="margin-top:8px">
          <label class="btn">📷 Foto aufnehmen / hinzufügen<input type="file" id="photoInput" accept="image/*" multiple hidden></label>
          <span class="muted small" id="photoInfo"></span>
        </div>
      </fieldset>`;
  }

  /** Bindet den Foto-Bereich im Formular; liefert die aktuelle Liste über .list. */
  function bindEditor(initial) {
    const state = { list: [...(initial || [])], busy: 0 };
    const grid = document.getElementById('photoGrid');
    const info = document.getElementById('photoInfo');
    const draw = () => {
      grid.innerHTML = state.list.map((f) => thumb(f, true)).join('') || '<p class="muted small" style="margin:0">Noch keine Fotos (z. B. Typenschild, Schaden, Messprotokoll).</p>';
      info.textContent = state.busy ? 'Foto wird verarbeitet …' : `${state.list.length} / ${MAX_PER_ENTRY}`;
      fill(grid);
    };
    grid.addEventListener('click', (e) => {
      const el = e.target.closest('.photo');
      if (!el) return;
      if (e.target.closest('.photo-del')) {
        if (!confirm('Foto entfernen?')) return;
        state.list = state.list.filter((f) => f.id !== el.dataset.photo);
        draw();
      } else if (e.target.closest('.photo-open')) {
        open(el.dataset.photo);
      }
    });
    document.getElementById('photoInput').addEventListener('change', async (e) => {
      const files = [...e.target.files];
      e.target.value = '';
      for (const file of files) {
        if (state.list.length >= MAX_PER_ENTRY) { alert(`Höchstens ${MAX_PER_ENTRY} Fotos je Eintrag.`); break; }
        state.busy++;
        draw();
        try { state.list.push(await add(file)); } catch (err) { alert('Foto konnte nicht übernommen werden: ' + err.message); }
        state.busy--;
        draw();
      }
    });
    draw();
    return state;
  }

  // ---------- Ansicht ----------
  function galleryHtml(list) {
    if (!list || !list.length) return '';
    return `<div class="card"><h3>Fotos (${list.length})</h3><div class="photo-grid" id="photoGallery">${list.map((f) => thumb(f, false)).join('')}</div></div>`;
  }

  function bindGallery() {
    const g = document.getElementById('photoGallery');
    if (!g) return;
    fill(g);
    g.addEventListener('click', (e) => {
      const el = e.target.closest('.photo');
      if (el) open(el.dataset.photo);
    });
  }

  // ---------- Großansicht ----------
  let box = null;
  async function open(id) {
    if (!box) {
      box = document.createElement('div');
      box.className = 'lightbox';
      box.innerHTML = '<img alt="Foto"><button type="button" class="btn" aria-label="Schließen">✕ Schließen</button>';
      box.addEventListener('click', () => { box.hidden = true; });
      document.body.appendChild(box);
    }
    const data = await get(id);
    if (!data) { alert('Foto ist auf diesem Gerät nicht verfügbar.'); return; }
    box.querySelector('img').src = data;
    box.hidden = false;
  }

  return { load, get, editorHtml, bindEditor, galleryHtml, bindGallery, MAX_PER_ENTRY };
})();
