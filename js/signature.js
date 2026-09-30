/* Unterschriftenfeld (Finger, Stift, Maus) */
'use strict';

class SignaturePad {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.strokes = [];
    this.current = null;

    canvas.addEventListener('pointerdown', (e) => this.down(e));
    canvas.addEventListener('pointermove', (e) => this.move(e));
    canvas.addEventListener('pointerup', (e) => this.up(e));
    canvas.addEventListener('pointercancel', (e) => this.up(e));
    canvas.addEventListener('pointerleave', (e) => this.up(e));
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    if (!r.width) return;
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.round(r.width * dpr);
    this.canvas.height = Math.round(r.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.w = r.width;
    this.h = r.height;
    this.redraw();
  }

  point(e) {
    const r = this.canvas.getBoundingClientRect();
    // normiert auf 0..1, damit Größenänderungen die Unterschrift nicht verzerren
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  }

  down(e) {
    e.preventDefault();
    this.canvas.setPointerCapture(e.pointerId);
    this.current = [this.point(e)];
    this.strokes.push(this.current);
    this.redraw();
  }

  move(e) {
    if (!this.current) return;
    e.preventDefault();
    const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (const ev of events) this.current.push(this.point(ev));
    this.redraw();
  }

  up() {
    this.current = null;
  }

  clear() {
    this.strokes = [];
    this.redraw();
  }

  isEmpty() {
    return !this.strokes.some((s) => s.length > 1);
  }

  static drawStrokes(ctx, strokes, map, lineWidth) {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0d1b2a';
    ctx.fillStyle = '#0d1b2a';
    ctx.lineWidth = lineWidth;
    for (const s of strokes) {
      const pts = s.map(map);
      if (pts.length === 1) {
        ctx.beginPath();
        ctx.arc(pts[0].x, pts[0].y, lineWidth / 2, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length - 1; i++) {
        const mx = (pts[i].x + pts[i + 1].x) / 2;
        const my = (pts[i].y + pts[i + 1].y) / 2;
        ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
      }
      const l = pts[pts.length - 1];
      ctx.lineTo(l.x, l.y);
      ctx.stroke();
    }
  }

  redraw() {
    const { ctx, w, h } = this;
    if (!w) return;
    ctx.clearRect(0, 0, w, h);
    SignaturePad.drawStrokes(ctx, this.strokes, (p) => ({ x: p.x * w, y: p.y * h }), 2.5);
  }

  /** Zugeschnittenes PNG mit weißem Hintergrund, max. 600×200 px. */
  export() {
    if (this.isEmpty()) return null;
    const pts = this.strokes.flat().map((p) => ({ x: p.x * this.w, y: p.y * this.h }));
    const minX = Math.min(...pts.map((p) => p.x));
    const maxX = Math.max(...pts.map((p) => p.x));
    const minY = Math.min(...pts.map((p) => p.y));
    const maxY = Math.max(...pts.map((p) => p.y));
    const pad = 8;
    const bw = maxX - minX + pad * 2;
    const bh = maxY - minY + pad * 2;
    const scale = Math.min(600 / bw, 200 / bh, 2);
    const out = document.createElement('canvas');
    out.width = Math.max(1, Math.round(bw * scale));
    out.height = Math.max(1, Math.round(bh * scale));
    const c = out.getContext('2d');
    c.fillStyle = '#fff';
    c.fillRect(0, 0, out.width, out.height);
    SignaturePad.drawStrokes(
      c,
      this.strokes,
      (p) => ({ x: (p.x * this.w - minX + pad) * scale, y: (p.y * this.h - minY + pad) * scale }),
      2.5 * scale,
    );
    return { img: out.toDataURL('image/png'), w: out.width, h: out.height };
  }
}
