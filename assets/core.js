/*
 * 描画の土台（Diagram コア）
 *
 * 図は「シーン」（四角・文字・線などの図形の並び）として組み立てる。
 * シーンは出力先に依存しないので、同じ図から
 *   - SVG（画面表示・PNG・SVG 保存）     … toSVG()
 *   - PowerPoint の編集できる図形         … assets/pptx.js の toPptx()
 * の両方を作れる。色や形はすべてテーマ（assets/themes.js）から取る。
 *
 * 新しい図の形（レイアウト）は Diagram.layout(名前, 関数) で登録する（assets/layouts.js）。
 * 関数は描画用の道具一式 c と、図のデータ d、フレームワーク定義 fw を受け取る。
 */
(function () {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  const FONT = "'BIZ UDPGothic','Hiragino Sans','Hiragino Kaku Gothic ProN','Yu Gothic','Meiryo',sans-serif";
  const BASE_W = 960;
  const BASE_H = 540;

  const layouts = {};
  let T;   // 描画中のテーマ
  let K;   // 描画中のテーマの色

  // ---------- テーマと色 ----------

  function themeById(id) {
    const list = window.THEMES || [];
    return list.find((t) => t.id === id) || list[0];
  }

  function rgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [n >> 16, (n >> 8) & 255, n & 255];
  }
  function toHex(r, g, b) {
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
  }
  function mix(a, b, t) {
    const A = rgb(a), B = rgb(b);
    return toHex(...A.map((v, i) => Math.round(v + (B[i] - v) * t)));
  }
  function lum(c) {
    const [r, g, b] = rgb(c).map((v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  // 色を背景色に寄せて淡くする（ダークテーマでは暗く沈む）
  function tint(c, amt) { return mix(c, K.bg, amt); }
  // 塗りの上に載せる文字色（明るい塗りには濃い文字、濃い塗りには白）
  function on(fill) { return lum(fill) < 0.3 ? '#FFFFFF' : '#14202F'; }

  function accent(i, fw) {
    const idx = fw && fw.colors ? fw.colors[i % fw.colors.length] : i;
    if (idx === 'primary' || idx === 'navy') return K.primary;
    return K.accents[idx % K.accents.length];
  }

  // ---------- 文字の計測と折り返し ----------

  let ctx2d;
  function measure(text, size, weight) {
    if (!ctx2d) ctx2d = document.createElement('canvas').getContext('2d');
    ctx2d.font = `${weight || 400} ${size}px ${FONT}`;
    return ctx2d.measureText(text).width;
  }

  // 行頭に来てはいけない文字（簡易禁則）
  const NO_START = '、。，．,.）)」』】〕！？!?・ーァィゥェォッャュョ々';

  function wrap(text, maxW, size, weight) {
    const out = [];
    String(text == null ? '' : text).split('\n').forEach((para) => {
      let line = '';
      for (const ch of para) {
        const test = line + ch;
        if (line && measure(test, size, weight) > maxW) {
          if (NO_START.includes(ch)) { line = test; continue; }
          // 英数字の途中では改行しない（単語・数値ごと次の行へ送る）
          if (/[A-Za-z0-9%.,]/.test(ch)) {
            const m = line.match(/[A-Za-z0-9%.,\-]+$/);
            if (m && m.index > 0) {
              out.push(line.slice(0, m.index).replace(/ $/, ''));
              line = m[0] + ch;
              continue;
            }
          }
          out.push(line);
          line = ch === ' ' ? '' : ch;
        } else {
          line = test;
        }
      }
      out.push(line);
    });
    return out;
  }

  function clean(items) {
    return (items || []).map((s) => String(s)).filter((s) => s.trim() !== '');
  }

  // ---------- シーン（出力先に依存しない図形の並び） ----------

  function Scene(w, h) {
    this.w = w;
    this.h = h;
    this.bg = K.bg;
    this.font = T.style.pptFont;
    this.items = [];
  }
  Scene.prototype.add = function (o) { this.items.push(o); return o; };

  function rect(s, x, y, w, h, o) {
    o = o || {};
    return s.add({ t: 'rect', x, y, w: Math.max(0, w), h: Math.max(0, h), rx: o.rx == null ? T.style.radius : o.rx, fill: o.fill || null, stroke: o.stroke || null, sw: o.sw || 1, dash: o.dash || null });
  }
  function circle(s, cx, cy, r, o) {
    o = o || {};
    return s.add({ t: 'ellipse', cx, cy, rx: r, ry: r, fill: o.fill || null, opacity: o.opacity == null ? 1 : o.opacity, stroke: o.stroke || null, sw: o.sw || 1 });
  }
  function poly(s, pts, o) {
    o = o || {};
    return s.add({ t: 'poly', pts, closed: true, fill: o.fill || null, stroke: o.stroke || null, sw: o.sw || 1 });
  }
  function polyline(s, pts, o) {
    o = o || {};
    return s.add({ t: 'poly', pts, closed: false, fill: null, stroke: o.stroke || K.sub, sw: o.sw || 1.5 });
  }
  function line(s, x1, y1, x2, y2, o) {
    o = o || {};
    return s.add({ t: 'line', x1, y1, x2, y2, stroke: o.stroke || K.line, sw: o.sw || 1.5, dash: o.dash || null });
  }
  function arrow(s, x1, y1, x2, y2, o) {
    o = o || {};
    return s.add({ t: 'arrow', x1, y1, x2, y2, stroke: o.stroke || K.sub, sw: o.sw || 2.5, head: o.head || 11, both: !!o.both });
  }
  function arrowHead(s, x, y, angle, color, size) {
    size = size || 10;
    const a1 = angle + Math.PI * 0.82, a2 = angle - Math.PI * 0.82;
    poly(s, [[x, y], [x + Math.cos(a1) * size, y + Math.sin(a1) * size], [x + Math.cos(a2) * size, y + Math.sin(a2) * size]], { fill: color });
  }
  // 扇形（ハーベイボール・円グラフ用）。frac は 0〜1、12時の位置から時計回り
  function pie(s, cx, cy, r, frac, o) {
    o = o || {};
    frac = Math.max(0, Math.min(1, frac));
    if (frac <= 0) return;
    if (frac >= 1) return circle(s, cx, cy, r, { fill: o.fill });
    const pts = [[cx, cy]];
    const n = Math.max(2, Math.ceil(frac * 48));
    for (let i = 0; i <= n; i++) {
      const a = -Math.PI / 2 + (Math.PI * 2 * frac * i) / n;
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    return poly(s, pts, { fill: o.fill });
  }

  function text(s, x, y, str, o) {
    o = o || {};
    return s.add({ t: 'text', x, y, str: String(str), size: o.size || 14, weight: o.weight || 400, fill: o.fill || K.ink, anchor: o.anchor || 'start' });
  }

  /*
   * 箇条書き/テキストを枠 (x, y, w, h) に収まるよう自動縮小して配置する。
   * o.anchor: 'start' | 'middle'  o.valign: 'top' | 'middle'  o.bullet: false で記号なし
   */
  function layoutList(items, w, h, o) {
    const max = o.size || 15, min = o.min || 9, weight = o.weight || 400;
    const lh = o.lh || 1.4, gap = o.gap == null ? 0.45 : o.gap;
    const bullet = o.bullet !== false;
    let L;
    for (let s = max; s >= min; s -= 0.5) {
      const ind = bullet ? s * 0.95 : 0;
      const blocks = items.map((t) => wrap(t, Math.max(10, w - ind), s, weight));
      const n = blocks.reduce((a, b) => a + b.length, 0);
      const height = n * s * lh + Math.max(0, blocks.length - 1) * s * gap;
      L = { s, ind, blocks, height, lh, gap, weight, bullet };
      if (height <= h) break;
    }
    return L;
  }

  function joinLines(lines) {
    return lines.reduce((a, b) => (a && /[A-Za-z0-9]$/.test(a) && /^[A-Za-z0-9]/.test(b) ? a + ' ' + b : a + b), '');
  }

  function list(s, items, x, y, w, h, o) {
    o = o || {};
    items = clean(items);
    if (!items.length || w <= 0 || h <= 0) return 0;
    const L = layoutList(items, w, h, o);
    const size = L.s;
    const anchor = o.anchor || 'start';
    let cy = y;
    if (o.valign === 'middle' && L.height < h) cy = y + (h - L.height) / 2;
    const maxY = y + h + 0.5;
    const lines = [], paras = [];
    let done = false;
    for (let bi = 0; bi < L.blocks.length && !done; bi++) {
      const block = L.blocks[bi];
      const used = [];
      for (let li = 0; li < block.length; li++) {
        let str = block[li];
        const lastFit = cy + size * L.lh * 2 > maxY;
        const more = li < block.length - 1 || bi < L.blocks.length - 1;
        if (lastFit && more) {
          // 入りきらない場合は省略記号で切る
          str = str.replace(/.{0,1}$/, '') + '…';
          done = true;
        }
        const base = cy + size * (L.lh - 1) / 2 + size * 0.88;
        lines.push({ str, x: anchor === 'middle' ? x + w / 2 : x + L.ind, base, bullet: li === 0 && L.bullet });
        used.push(str);
        cy += size * L.lh;
        if (done) break;
      }
      paras.push(joinLines(used));
      cy += size * L.gap;
    }
    s.add({
      t: 'tb', x, y, w, h, size, weight: L.weight, fill: o.fill || K.ink,
      align: anchor === 'middle' ? 'center' : 'left', valign: o.valign === 'middle' ? 'middle' : 'top',
      lh: L.lh, gap: L.gap, ind: L.ind, bullet: L.bullet ? T.style.bullet : null, bulletColor: o.bulletColor || K.sub,
      lines, paras,
    });
    return L.height;
  }

  function label(s, str, x, y, w, h, o) {
    o = Object.assign({ anchor: 'middle', valign: 'middle', bullet: false, weight: 700, size: 17, min: 10, gap: 0, lh: 1.25 }, o || {});
    return list(s, [str], x, y, w, h, o);
  }

  // 見出し + 箇条書きの基本の箱。見出しの描き方はテーマの style.header で変わる
  function card(s, x, y, w, h, sec, color, o) {
    o = o || {};
    const st = T.style;
    const hh = o.headH || 40, ts = o.titleSize || 17;
    const align = st.headerAlign === 'left' ? 'start' : 'middle';
    if (st.header === 'outline') {
      rect(s, x, y, w, h, { fill: K.surface, stroke: color, sw: 1.5 });
      label(s, sec.title, x + 12, y + 2, w - 24, hh - 4, { fill: color, size: ts, anchor: align });
      line(s, x + 12, y + hh, x + w - 12, y + hh, { stroke: color, sw: 1.2 });
    } else if (st.header === 'bar') {
      rect(s, x, y, w, h, { fill: K.faint });
      rect(s, x, y, w, 5, { fill: color, rx: 0 });
      label(s, sec.title, x + 12, y + 6, w - 24, hh - 6, { fill: K.ink, size: ts, anchor: align });
      line(s, x + 12, y + hh + 2, x + w - 12, y + hh + 2, { stroke: K.line, sw: 1 });
    } else {
      rect(s, x, y, w, h, { fill: tint(color, st.bodyTint) });
      rect(s, x, y, w, hh, { fill: color });
      const sq = Math.min(st.radius + 2, hh / 2);
      if (st.radius) rect(s, x, y + hh - sq, w, sq, { fill: color, rx: 0 });
      label(s, sec.title, x + 10, y + 2, w - 20, hh - 4, { fill: on(color), size: ts, anchor: align });
    }
    // 箱が低いときは上下の余白も詰めて、文字を小さくしすぎない
    const pad = Math.max(6, Math.min(12, (h - hh) * 0.1));
    list(s, sec.items, x + 14, y + hh + pad, w - 28, h - hh - pad * 1.8, { size: o.size || 15, bulletColor: color, min: o.min });
  }

  function chevron(s, x, y, w, h, first, color) {
    const t = Math.min(18, h * 0.35);
    const pts = first
      ? [[x, y], [x + w - t, y], [x + w, y + h / 2], [x + w - t, y + h], [x, y + h]]
      : [[x - t, y], [x + w - t, y], [x + w, y + h / 2], [x + w - t, y + h], [x - t, y + h], [x, y + h / 2]];
    poly(s, pts, { fill: color });
  }

  // ツリー用：インデント付きテキストを木構造にする
  function parseTree(src) {
    const top = { label: '', children: [] };
    const stack = [{ node: top, indent: -1 }];
    String(src || '').split('\n').forEach((raw) => {
      if (!raw.trim()) return;
      const t = raw.replace(/\t/g, '  ').replace(/　/g, '  ');
      const m = t.match(/^(\s*)(?:[-・*]\s*)?(.*)$/);
      const indent = m[1].length;
      const node = { label: m[2].trim(), children: [] };
      while (stack[stack.length - 1].indent >= indent) stack.pop();
      stack[stack.length - 1].node.children.push(node);
      stack.push({ node, indent });
    });
    return top.children.length === 1 ? top.children[0] : { label: '（テーマ）', children: top.children };
  }

  // レイアウト関数に渡す道具一式
  function tools(s, fw) {
    const b = (fn) => (...a) => fn(s, ...a);
    return {
      W: s.w, H: s.h, K, style: T.style, theme: T,
      accent: (i) => accent(i, fw), tint, mix, on, measure, wrap, clean, parseTree,
      rect: b(rect), circle: b(circle), poly: b(poly), polyline: b(polyline), line: b(line),
      arrow: b(arrow), arrowHead: b(arrowHead), pie: b(pie), text: b(text), list: b(list), label: b(label),
      card: b(card), chevron: b(chevron),
      // 図の高さを内容に合わせて伸ばすとき（ツリーなど）
      setHeight: (h) => { s.h = h; },
    };
  }

  // ---------- 公開 API ----------

  function useTheme(id) {
    T = themeById(id);
    K = T.colors;
    return T;
  }

  // 図だけのシーンを作る
  function render(fw, data, opts) {
    opts = opts || {};
    useTheme(opts.theme);
    const fn = layouts[fw.layout];
    if (!fn) throw new Error('未対応のレイアウト: ' + fw.layout);
    const s = new Scene(opts.width || BASE_W, opts.height || BASE_H);
    fn(tools(s, fw), data, fw);
    return s;
  }

  // スライド（タイトル・キーメッセージ・図・注記）のシーンを作る
  function slide(fw, data, meta, opts) {
    opts = opts || {};
    useTheme(opts.theme);
    meta = meta || {};
    const s = new Scene(BASE_W, BASE_H);
    const st = T.style, M = 36;
    const title = (meta.title || '').trim() || fw.name;
    const msg = (meta.message || '').trim();
    const note = (meta.note || '').trim();
    let top;
    if (st.slideHeader === 'band') {
      rect(s, 0, 0, BASE_W, 74, { fill: K.primary, rx: 0 });
      label(s, title, M, 12, BASE_W - M * 2, 50, { anchor: 'start', size: 26, min: 14, fill: on(K.primary) });
      top = 74;
      if (msg) { label(s, msg, M, top + 12, BASE_W - M * 2, 44, { anchor: 'start', size: 17, min: 11, fill: K.strong }); top += 66; } else top += 18;
    } else {
      label(s, title, M, 18, BASE_W - M * 2, 46, { anchor: 'start', size: 26, min: 14, fill: K.ink });
      top = 64;
      if (msg) { label(s, msg, M, top, BASE_W - M * 2, 44, { anchor: 'start', size: 17, min: 11, fill: K.strong }); top += 46; }
      if (st.slideHeader === 'rule') { line(s, M, top + 6, BASE_W - M, top + 6, { stroke: K.primary, sw: 2 }); top += 20; } else top += 12;
    }
    const foot = note ? 34 : 18;
    const areaW = BASE_W - M * 2, areaH = BASE_H - top - foot;
    const d = render(fw, data, { theme: T.id, width: BASE_W, height: Math.round(BASE_W * areaH / areaW) });
    useTheme(T.id);
    const k = Math.min(areaW / d.w, areaH / d.h);
    s.add({ t: 'group', x: M + (areaW - d.w * k) / 2, y: top, scale: k, scene: d });
    if (note) label(s, note, M, BASE_H - 30, BASE_W - M * 2, 22, { anchor: 'start', size: 11, min: 8, weight: 400, fill: K.sub });
    return s;
  }

  // ---------- SVG 出力 ----------

  function E(tag, attrs, parent) {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  const r1 = (v) => Math.round(v * 10) / 10;
  const ptsStr = (pts) => pts.map((p) => r1(p[0]) + ',' + r1(p[1])).join(' ');

  function headPts(x, y, ang, size) {
    const a1 = ang + Math.PI * 0.82, a2 = ang - Math.PI * 0.82;
    return [[x, y], [x + Math.cos(a1) * size, y + Math.sin(a1) * size], [x + Math.cos(a2) * size, y + Math.sin(a2) * size]];
  }

  function svgItems(p, items) {
    items.forEach((it) => {
      switch (it.t) {
        case 'rect':
          E('rect', { x: r1(it.x), y: r1(it.y), width: r1(it.w), height: r1(it.h), rx: it.rx, fill: it.fill || 'none', stroke: it.stroke || 'none', 'stroke-width': it.sw, 'stroke-dasharray': it.dash }, p);
          break;
        case 'ellipse':
          E('ellipse', { cx: r1(it.cx), cy: r1(it.cy), rx: r1(it.rx), ry: r1(it.ry), fill: it.fill || 'none', 'fill-opacity': it.opacity < 1 ? it.opacity : null, stroke: it.stroke || 'none', 'stroke-width': it.sw }, p);
          break;
        case 'poly':
          E(it.closed ? 'polygon' : 'polyline', { points: ptsStr(it.pts), fill: it.fill || 'none', stroke: it.stroke || 'none', 'stroke-width': it.sw, 'stroke-linejoin': 'round' }, p);
          break;
        case 'line':
          E('line', { x1: r1(it.x1), y1: r1(it.y1), x2: r1(it.x2), y2: r1(it.y2), stroke: it.stroke, 'stroke-width': it.sw, 'stroke-dasharray': it.dash, 'stroke-linecap': 'round' }, p);
          break;
        case 'arrow': {
          const ang = Math.atan2(it.y2 - it.y1, it.x2 - it.x1);
          const cut = it.head * 0.7;
          const sx = it.both ? it.x1 + Math.cos(ang) * cut : it.x1, sy = it.both ? it.y1 + Math.sin(ang) * cut : it.y1;
          E('line', { x1: r1(sx), y1: r1(sy), x2: r1(it.x2 - Math.cos(ang) * cut), y2: r1(it.y2 - Math.sin(ang) * cut), stroke: it.stroke, 'stroke-width': it.sw }, p);
          E('polygon', { points: ptsStr(headPts(it.x2, it.y2, ang, it.head)), fill: it.stroke }, p);
          if (it.both) E('polygon', { points: ptsStr(headPts(it.x1, it.y1, ang + Math.PI, it.head)), fill: it.stroke }, p);
          break;
        }
        case 'text': {
          const n = E('text', { x: r1(it.x), y: r1(it.y), 'font-size': it.size, 'font-weight': it.weight, fill: it.fill, 'text-anchor': it.anchor }, p);
          n.textContent = it.str;
          break;
        }
        case 'tb':
          it.lines.forEach((ln) => {
            const sz = it.size;
            if (ln.bullet) {
              const bx = it.x + sz * 0.32, by = ln.base - sz * 0.34;
              if (it.bullet === 'square') E('rect', { x: r1(bx - sz * 0.13), y: r1(by - sz * 0.13), width: r1(sz * 0.26), height: r1(sz * 0.26), fill: it.bulletColor }, p);
              else if (it.bullet === 'dash') E('rect', { x: r1(bx - sz * 0.22), y: r1(by - sz * 0.05), width: r1(sz * 0.44), height: r1(sz * 0.1), fill: it.bulletColor }, p);
              else E('circle', { cx: r1(bx), cy: r1(by), r: r1(sz * 0.16), fill: it.bulletColor }, p);
            }
            const n = E('text', { x: r1(ln.x), y: r1(ln.base), 'font-size': sz, 'font-weight': it.weight, fill: it.fill, 'text-anchor': it.align === 'center' ? 'middle' : 'start' }, p);
            n.textContent = ln.str;
          });
          break;
        case 'group': {
          const g = E('g', { transform: `translate(${r1(it.x)} ${r1(it.y)}) scale(${Math.round(it.scale * 10000) / 10000})` }, p);
          svgItems(g, it.scene.items);
          break;
        }
      }
    });
  }

  function toSVG(scene) {
    const svg = E('svg', { xmlns: NS, viewBox: `0 0 ${scene.w} ${scene.h}`, width: scene.w, height: scene.h, 'font-family': FONT });
    E('rect', { x: 0, y: 0, width: scene.w, height: scene.h, fill: scene.bg }, svg);
    svgItems(svg, scene.items);
    return svg;
  }

  window.Diagram = {
    BASE_W, BASE_H, FONT,
    layout(name, fn) { layouts[name] = fn; },
    hasLayout(name) { return !!layouts[name]; },
    render, slide, toSVG, themeById, measure,
  };
})();
