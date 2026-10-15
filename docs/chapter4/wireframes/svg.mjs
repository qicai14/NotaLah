// Turns a laid-out wireframe DOM into a flat, editable vector SVG (runs inside the page via page.evaluate).
// Boxes become <rect>/<path>, strokes come from borders, outlines and box-shadows, text nodes become one
// <text> per rendered line, inline icons are copied as vector groups, and .xb / [data-x] boxes get a cross.
// Colours are reduced to grey so the output stays greyscale whatever the CSS says. ::before/::after boxes are
// first turned into real spans, and scaled subtrees (transform: scale) keep their scaled type and strokes.
export function domToSvg() {
  const PSEUDO = ['position', 'left', 'top', 'width', 'height', 'margin-left', 'margin-top', 'background-color', 'border-radius', 'box-shadow', 'display'];
  const made = [];
  for (const el of document.body.querySelectorAll('*')) {
    if (el instanceof SVGElement) continue;
    for (const p of ['::before', '::after']) {
      const ps = getComputedStyle(el, p);
      if (!ps.content || ps.content === 'none' || ps.content === 'normal') continue;
      made.push([el, p, PSEUDO.map((k) => `${k}:${ps.getPropertyValue(k)}`).join(';')]);
    }
  }
  if (made.length) {
    const st = document.createElement('style');
    st.textContent = '.np-b::before,.np-a::after{content:none!important}';
    document.head.append(st);
    for (const [el, p, css] of made) {
      const sp = document.createElement('span'); sp.style.cssText = `padding:0;margin:0;border:0;${css}`;
      if (p === '::before') { el.prepend(sp); el.classList.add('np-b'); } else { el.append(sp); el.classList.add('np-a'); }
    }
  }
  const root = document.querySelector('body > *');
  const R0 = root.getBoundingClientRect();
  const W = Math.round(R0.width), H = Math.round(R0.height);
  const out = [], defs = [];
  let clipN = 0, grpN = 0;
  const GROUPS = ['nav', 'top', 'card', 'rail', 'dlg', 'pop', 'sheet', 'tbar', 'side', 'ebar', 'erail', 'epan', 'ws', 'ebot', 'scrim', 'board', 'tile', 'banner'];
  const n = (v) => Math.round(v * 100) / 100;
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const col = (c) => {
    const m = c && c.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const [r, g, b, a = 1] = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
    if (a === 0) return null;
    const l = Math.round(0.299 * r + 0.587 * g + 0.114 * b).toString(16).padStart(2, '0');
    return { hex: `#${l}${l}${l}`, a };
  };
  const paint = (attr, c, o) => `${attr}="${c.hex}"${c.a * o < 1 ? ` ${attr}-opacity="${n(c.a * o)}"` : ''}`;
  const radii = (cs, w, h, sc = 1) => ['borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomRightRadius', 'borderBottomLeftRadius'].map((k) => {
    const v = cs[k].split(' ')[0];
    const px = v.endsWith('%') ? (parseFloat(v) / 100) * Math.min(w, h) : (parseFloat(v) || 0) * sc;
    return Math.min(px, w / 2, h / 2);
  });
  const shape = (x, y, w, h, r) => {
    if (w <= 0 || h <= 0) return null;
    r = r.map((v) => Math.max(0, Math.min(v, w / 2, h / 2)));
    if (r.every((v) => v === r[0])) return { tag: 'rect', a: `x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}"${r[0] ? ` rx="${n(r[0])}"` : ''}` };
    const [a, b, c, d] = r;
    return { tag: 'path', a: `d="M${n(x + a)} ${n(y)}H${n(x + w - b)}${b ? `A${n(b)} ${n(b)} 0 0 1 ${n(x + w)} ${n(y + b)}` : ''}V${n(y + h - c)}${c ? `A${n(c)} ${n(c)} 0 0 1 ${n(x + w - c)} ${n(y + h)}` : ''}H${n(x + d)}${d ? `A${n(d)} ${n(d)} 0 0 1 ${n(x)} ${n(y + h - d)}` : ''}V${n(y + a)}${a ? `A${n(a)} ${n(a)} 0 0 1 ${n(x + a)} ${n(y)}` : ''}Z"` };
  };
  const emit = (s, extra) => { if (s) out.push(`<${s.tag} ${s.a} ${extra}/>`); };
  const stroke = (x, y, w, h, r, c, sw, o, dash = '') => emit(shape(x, y, w, h, r), `fill="none" ${paint('stroke', c, o)} stroke-width="${n(sw)}"${dash}`);

  function box(el, r, cs, o, sc) {
    const x = r.left - R0.left, y = r.top - R0.top, w = r.width, h = r.height;
    if (w < 0.5 || h < 0.5) return;
    const rad = radii(cs, w, h, sc);
    const bg = col(cs.backgroundColor);
    // outer shadows first (they sit under the box)
    const shadows = cs.boxShadow === 'none' ? [] : cs.boxShadow.split(/,(?![^(]*\))/).map((s) => {
      const c = col(s); const [sx = 0, sy = 0, blur = 0, spread = 0] = (s.replace(/rgba?\([^)]*\)/, '').match(/-?[\d.]+px/g) || []).map((v) => parseFloat(v) * sc);
      return { c, sx, sy, blur, spread, inset: /inset/.test(s) };
    }).filter((s) => s.c);
    let elevated = false;
    for (const s of shadows.filter((s) => !s.inset)) {
      if (s.blur > 0) { if (!elevated) { elevated = true; stroke(x - 0.5, y - 0.5, w + 1, h + 1, rad.map((v) => v + 0.5), { hex: '#bdbdbd', a: 1 }, 1, o); } }
      else if (s.spread > 0) stroke(x - s.spread / 2, y - s.spread / 2, w + s.spread, h + s.spread, rad.map((v) => v + s.spread / 2), s.c, s.spread, o);
    }
    if (bg) emit(shape(x, y, w, h, rad), paint('fill', bg, o));
    if (el.hasAttribute('data-x') || el.classList.contains('xb')) {
      const c = { hex: '#a8a8a8', a: 1 };
      out.push(`<path d="M${n(x)} ${n(y)}L${n(x + w)} ${n(y + h)}M${n(x + w)} ${n(y)}L${n(x)} ${n(y + h)}" fill="none" ${paint('stroke', c, o)} stroke-width="1"/>`);
    }
    if (el.classList.contains('xc')) { // crossed circle (avatars, icon placeholders): the cross stays inside the circle
      const c = { hex: '#a8a8a8', a: 1 }, cx = x + w / 2, cy = y + h / 2, d = (Math.min(w, h) / 2) * 0.7071;
      out.push(`<path d="M${n(cx - d)} ${n(cy - d)}L${n(cx + d)} ${n(cy + d)}M${n(cx + d)} ${n(cy - d)}L${n(cx - d)} ${n(cy + d)}" fill="none" ${paint('stroke', c, o)} stroke-width="1"/>`);
    }
    for (const s of shadows.filter((s) => s.inset && s.blur === 0)) {
      if (s.spread > 0 && !s.sx && !s.sy) stroke(x + s.spread / 2, y + s.spread / 2, w - s.spread, h - s.spread, rad.map((v) => Math.max(0, v - s.spread / 2)), s.c, s.spread, o);
      else if (s.sy) emit(shape(x, s.sy > 0 ? y : y + h + s.sy, w, Math.abs(s.sy), [0, 0, 0, 0]), paint('fill', s.c, o));
      else if (s.sx) emit(shape(s.sx > 0 ? x : x + w + s.sx, y, Math.abs(s.sx), h, [0, 0, 0, 0]), paint('fill', s.c, o));
    }
    const bw = ['Top', 'Right', 'Bottom', 'Left'].map((k) => (cs[`border${k}Style`] === 'none' ? 0 : (parseFloat(cs[`border${k}Width`]) || 0) * sc));
    const bc = ['Top', 'Right', 'Bottom', 'Left'].map((k) => col(cs[`border${k}Color`]));
    if (bw.every((v) => v === bw[0]) && bw[0] > 0 && bc[0]) {
      const dash = cs.borderTopStyle === 'dashed' ? ` stroke-dasharray="${bw[0] * 3} ${bw[0] * 2}"` : '';
      stroke(x + bw[0] / 2, y + bw[0] / 2, w - bw[0], h - bw[0], rad.map((v) => Math.max(0, v - bw[0] / 2)), bc[0], bw[0], o, dash);
    } else {
      const [t, rr, b, l] = bw;
      if (t && bc[0]) emit(shape(x, y, w, t, [0, 0, 0, 0]), paint('fill', bc[0], o));
      if (rr && bc[1]) emit(shape(x + w - rr, y, rr, h, [0, 0, 0, 0]), paint('fill', bc[1], o));
      if (b && bc[2]) emit(shape(x, y + h - b, w, b, [0, 0, 0, 0]), paint('fill', bc[2], o));
      if (l && bc[3]) emit(shape(x, y, l, h, [0, 0, 0, 0]), paint('fill', bc[3], o));
    }
    if (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) {
      const ow = parseFloat(cs.outlineWidth) * sc, off = (parseFloat(cs.outlineOffset) || 0) * sc, d = off + ow / 2;
      const c = col(cs.outlineColor); if (c) stroke(x - d, y - d, w + 2 * d, h + 2 * d, rad.map((v) => v + d), c, ow, o);
    }
  }

  function icon(svg, r, cs, o) {
    const vb = svg.viewBox && svg.viewBox.baseVal;
    if (!vb || !vb.width || r.width < 1) return;
    const c = col(cs.color) || { hex: '#1f1f1f', a: 1 };
    const s = r.width / vb.width;
    const kids = [...svg.children].map((k) => {
      const t = k.cloneNode(true);
      const filled = t.classList.contains('f');
      t.removeAttribute('class');
      if (filled) { t.setAttribute('fill', c.hex); t.setAttribute('stroke', 'none'); }
      return t.outerHTML.replace(/ xmlns="[^"]*"/g, '');
    }).join('');
    out.push(`<g transform="translate(${n(r.left - R0.left)} ${n(r.top - R0.top)}) scale(${n(s)})" fill="none" stroke="${c.hex}" stroke-width="${cs.strokeWidth ? parseFloat(cs.strokeWidth) : 1.75}" stroke-linecap="round" stroke-linejoin="round"${c.a * o < 1 ? ` opacity="${n(c.a * o)}"` : ''}>${kids}</g>`);
  }

  function text(node, cs, o, sc) {
    const s = node.textContent;
    if (!s.trim()) return;
    const c = col(cs.color); if (!c) return;
    const range = document.createRange();
    const lines = [];
    for (const m of s.matchAll(/\S+/g)) {
      range.setStart(node, m.index); range.setEnd(node, m.index + m[0].length);
      const rs = range.getClientRects(); if (!rs.length) continue;
      const rc = rs[0];
      let line = lines.find((l) => Math.abs(l.top - rc.top) < 2);
      if (!line) { line = { top: rc.top, h: rc.height, x: rc.left, words: [] }; lines.push(line); }
      line.x = Math.min(line.x, rc.left); line.words.push(m[0]);
    }
    const fs = parseFloat(cs.fontSize) * sc;
    const ls = cs.letterSpacing === 'normal' ? '' : ` letter-spacing="${n(parseFloat(cs.letterSpacing) * sc)}"`;
    const fw = cs.fontWeight !== '400' ? ` font-weight="${cs.fontWeight}"` : '';
    const fi = cs.fontStyle === 'italic' ? ' font-style="italic"' : '';
    const ff = /mono|consolas/i.test(cs.fontFamily) ? ' font-family="Consolas, monospace"' : /georgia|serif/i.test(cs.fontFamily) && !/sans/i.test(cs.fontFamily) ? ' font-family="Georgia, serif"' : '';
    for (const l of lines) {
      const base = l.top - R0.top + (l.h - fs * 1.33) / 2 + fs * 1.08;
      out.push(`<text x="${n(l.x - R0.left)}" y="${n(base)}" font-size="${n(fs)}"${fw}${fi}${ff}${ls} ${paint('fill', c, o)}>${esc(l.words.join(' '))}</text>`);
    }
  }

  function walk(el, op, psc) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return;
    const o = op * parseFloat(cs.opacity);
    const tm = cs.transform && cs.transform.match(/matrix\(([^)]+)\)/);
    const sc = tm ? psc * Math.hypot(...tm[1].split(',').slice(0, 2).map(Number)) : psc;
    if (o <= 0.01) return;
    const r = el.getBoundingClientRect();
    if (el.tagName.toLowerCase() === 'svg') { icon(el, r, cs, o); return; }
    if (el.tagName === 'STYLE') return;
    const g = GROUPS.find((k) => el.classList.contains(k));
    if (g) out.push(`<g id="${g}-${++grpN}">`);
    box(el, r, cs, o, sc);
    const clip = cs.overflow !== 'visible' && (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1);
    if (clip) {
      const id = `clip${++clipN}`;
      const s = shape(r.left - R0.left, r.top - R0.top, r.width, r.height, radii(cs, r.width, r.height, sc));
      defs.push(`<clipPath id="${id}"><${s.tag} ${s.a}/></clipPath>`);
      out.push(`<g clip-path="url(#${id})">`);
    }
    const kids = [...el.childNodes].map((k, i) => {
      let z = 0;
      if (k.nodeType === 1) { const kc = getComputedStyle(k); if (kc.position !== 'static' && kc.zIndex !== 'auto') z = parseInt(kc.zIndex, 10); }
      return { k, z, i };
    }).sort((a, b) => a.z - b.z || a.i - b.i);
    for (const { k } of kids) {
      if (k.nodeType === 3) text(k, cs, o, sc);
      else if (k.nodeType === 1) walk(k, o, sc);
    }
    if (clip) out.push('</g>');
    if (g) out.push('</g>');
  }

  walk(root, 1, 1);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Segoe UI, Arial, sans-serif">\n<defs>${defs.join('')}</defs>\n<rect width="${W}" height="${H}" fill="#ffffff"/>\n${out.join('\n')}\n</svg>\n`;
}

// Lo-fi pass (runs in the page before domToSvg). Navigation icons stay; every other icon is dropped when its
// element already has a text label, becomes a short text label inside an icon-only button, and otherwise
// becomes a crossed circle placeholder. Status-bar glyphs are removed.
export function lofiIcons() {
  const KEEP = new Set(['home', 'users', 'compass', 'search', 'plus', 'msg', 'bell', 'bookmark', 'user', 'more', 'heart', 'heartF',
    'comment', 'share', 'star', 'starF', 'left', 'right', 'up', 'down', 'back', 'x', 'menu', 'sidebar', 'inbox', 'send', 'check',
    'flag', 'shield', 'book', 'play', 'pause', 'square', 'circle', 'tri', 'line', 'arrowR', 'minus']);
  const DROP = new Set(['wifi', 'battery']);
  const LABEL = { pencil: 'Edit', trash: 'Delete', copy: 'Copy', lock: 'Lock', info: 'Info', userPlus: 'Add', clip: 'Attach', smile: 'Emoji',
    at: '@', undo: 'Undo', redo: 'Redo', gridI: 'Grid', resize: 'Fit', sliders: 'Settings', filter: 'Filter', layers: 'Position',
    drop: 'Opacity', crop: 'Crop', flip: 'Flip', rotate: 'Rotate', link: 'Link', eye: 'Show', logout: 'Leave', alignL: 'Align',
    list: 'List', spacing: 'Spacing', bold: 'B', italic: 'I', under: 'U', strike: 'S', present: 'Preview', upload: 'Upload',
    image: 'Image', type: 'Text', code: 'Code', table: 'Table', cal: 'Date', notes: 'Notes', music: 'Music', vol: 'Volume',
    warn: '!', sparkle: 'Effects', border: 'Border', fill: 'Fill', friends: 'Friends', globe: 'Public', layout: 'Layout' };
  const LABELLED = '.ib,.tb2,.tab,.sarr,.end,.addp';
  for (const s of [...document.querySelectorAll('svg.i')]) {
    const name = s.dataset.n, p = s.parentElement;
    if (DROP.has(name)) { s.remove(); continue; }
    if (p.closest('.ni,.tbi,.er')) continue; // navigation: icon plus label is the pattern
    if (p.textContent.trim()) { if (!/^(down|up)$/.test(name)) s.remove(); continue; } // dropdown chevrons stay
    if (KEEP.has(name)) continue;
    const size = parseFloat(s.getAttribute('width')) || 20;
    const sp = document.createElement('span');
    if (p.matches(LABELLED) && LABEL[name]) {
      sp.className = 'ilab'; sp.textContent = LABEL[name];
      if (p.matches('.ib')) { p.style.width = 'auto'; p.style.padding = '0 12px'; p.style.borderRadius = '999px'; }
    } else {
      sp.className = 'iph xc'; sp.style.width = sp.style.height = `${Math.round(size * 0.85)}px`;
    }
    s.replaceWith(sp);
  }
}
