/*
 * 図の描画エンジン
 * 各フレームワークの「データ」から 16:9 の SVG を生成する。
 * レイアウトごとにレンダラーを持ち、文字量に応じてフォントサイズを自動調整する。
 */
(function () {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  const W = 960;
  const H = 540;
  const FONT = "'BIZ UDPGothic','Hiragino Sans','Hiragino Kaku Gothic ProN','Yu Gothic','Meiryo',sans-serif";

  // 図の配色（スライドに貼る前提なので常にライト配色）
  const C = {
    ink: '#1B2433',
    sub: '#56657A',
    line: '#C8D1DD',
    faint: '#F2F5F9',
    white: '#FFFFFF',
    navy: '#1E3A5F',
    pal: ['#1F5FA8', '#23857B', '#B9651E', '#A8455A', '#5E52A0', '#4F6B88'],
  };

  // ---------- 基本ヘルパー ----------

  function tint(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    const m = (c) => Math.round(c + (255 - c) * amt);
    return '#' + ((1 << 24) + (m(r) << 16) + (m(g) << 8) + m(b)).toString(16).slice(1);
  }

  function col(i, fw) {
    const idx = fw && fw.colors ? fw.colors[i % fw.colors.length] : i;
    return idx === 'navy' ? C.navy : C.pal[idx % C.pal.length];
  }

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

  function E(tag, attrs, parent) {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }

  function text(parent, x, y, str, o) {
    o = o || {};
    const n = E('text', {
      x: r1(x), y: r1(y),
      'font-size': o.size || 14,
      'font-weight': o.weight || 400,
      fill: o.fill || C.ink,
      'text-anchor': o.anchor || 'start',
    }, parent);
    n.textContent = str;
    return n;
  }

  function rect(parent, x, y, w, h, o) {
    o = o || {};
    return E('rect', {
      x: r1(x), y: r1(y), width: r1(Math.max(0, w)), height: r1(Math.max(0, h)),
      rx: o.rx == null ? 6 : o.rx,
      fill: o.fill || 'none',
      stroke: o.stroke || 'none',
      'stroke-width': o.sw || 1,
      'stroke-dasharray': o.dash || null,
    }, parent);
  }

  function poly(parent, pts, o) {
    o = o || {};
    return E('polygon', {
      points: pts.map((p) => r1(p[0]) + ',' + r1(p[1])).join(' '),
      fill: o.fill || 'none',
      stroke: o.stroke || 'none',
      'stroke-width': o.sw || 1,
      'stroke-linejoin': 'round',
    }, parent);
  }

  function line(parent, x1, y1, x2, y2, o) {
    o = o || {};
    return E('line', {
      x1: r1(x1), y1: r1(y1), x2: r1(x2), y2: r1(y2),
      stroke: o.stroke || C.line, 'stroke-width': o.sw || 1.5,
      'stroke-dasharray': o.dash || null, 'stroke-linecap': 'round',
    }, parent);
  }

  function arrowHead(parent, x, y, angle, color, size) {
    size = size || 10;
    const a1 = angle + Math.PI * 0.82, a2 = angle - Math.PI * 0.82;
    poly(parent, [
      [x, y],
      [x + Math.cos(a1) * size, y + Math.sin(a1) * size],
      [x + Math.cos(a2) * size, y + Math.sin(a2) * size],
    ], { fill: color });
  }

  function arrow(parent, x1, y1, x2, y2, o) {
    o = o || {};
    const color = o.stroke || C.sub;
    const ang = Math.atan2(y2 - y1, x2 - x1);
    const hs = o.head || 11;
    line(parent, x1, y1, x2 - Math.cos(ang) * hs * 0.7, y2 - Math.sin(ang) * hs * 0.7, { stroke: color, sw: o.sw || 2.5, dash: o.dash });
    arrowHead(parent, x2, y2, ang, color, hs);
    if (o.both) {
      arrowHead(parent, x1, y1, ang + Math.PI, color, hs);
    }
  }

  function r1(v) { return Math.round(v * 10) / 10; }

  function clean(items) {
    return (items || []).map((s) => String(s)).filter((s) => s.trim() !== '');
  }

  /*
   * 箇条書き/テキストを枠 (x, y, w, h) に収まるよう自動縮小して描画する。
   * o.anchor: 'start' | 'middle'  o.valign: 'top' | 'middle'
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

  function list(parent, items, x, y, w, h, o) {
    o = o || {};
    items = clean(items);
    if (!items.length || w <= 0 || h <= 0) return 0;
    const L = layoutList(items, w, h, o);
    const s = L.s;
    const anchor = o.anchor || 'start';
    let cy = y;
    if (o.valign === 'middle' && L.height < h) cy = y + (h - L.height) / 2;
    const maxY = y + h + 0.5;
    let done = false;
    for (let bi = 0; bi < L.blocks.length && !done; bi++) {
      const block = L.blocks[bi];
      for (let li = 0; li < block.length; li++) {
        let str = block[li];
        const isLastFit = cy + s * L.lh * 2 > maxY;
        const more = li < block.length - 1 || bi < L.blocks.length - 1;
        if (isLastFit && more) {
          // 入りきらない場合は省略記号で切る
          str = str.replace(/.{0,1}$/, '') + '…';
          done = true;
        }
        const base = cy + s * (L.lh - 1) / 2 + s * 0.88;
        if (li === 0 && L.bullet) {
          E('circle', { cx: r1(x + s * 0.32), cy: r1(base - s * 0.34), r: r1(s * 0.16), fill: o.bulletColor || C.sub }, parent);
        }
        const tx = anchor === 'middle' ? x + w / 2 : x + L.ind;
        text(parent, tx, base, str, { size: s, weight: L.weight, fill: o.fill || C.ink, anchor });
        cy += s * L.lh;
        if (done) break;
      }
      cy += s * L.gap;
    }
    return L.height;
  }

  function label(parent, str, x, y, w, h, o) {
    o = Object.assign({ anchor: 'middle', valign: 'middle', bullet: false, weight: 700, size: 17, min: 10, gap: 0, lh: 1.25 }, o || {});
    return list(parent, [str], x, y, w, h, o);
  }

  // 見出し帯 + 箇条書きの基本カード
  function card(parent, x, y, w, h, sec, color, o) {
    o = o || {};
    const hh = o.headH || 40;
    rect(parent, x, y, w, h, { fill: o.bodyFill || tint(color, 0.92), rx: 6 });
    rect(parent, x, y, w, hh, { fill: color, rx: 6 });
    rect(parent, x, y + hh - 8, w, 8, { fill: color, rx: 0 });
    label(parent, sec.title, x + 8, y + 2, w - 16, hh - 4, { fill: C.white, size: o.titleSize || 17 });
    list(parent, sec.items, x + 14, y + hh + 12, w - 28, h - hh - 22, { size: o.size || 15, bulletColor: color, min: o.min });
  }

  function chevron(parent, x, y, w, h, first, color) {
    const t = Math.min(18, h * 0.35);
    const pts = first
      ? [[x, y], [x + w - t, y], [x + w, y + h / 2], [x + w - t, y + h], [x, y + h]]
      : [[x - t, y], [x + w - t, y], [x + w, y + h / 2], [x + w - t, y + h], [x - t, y + h], [x, y + h / 2]];
    poly(parent, pts, { fill: color });
  }

  function root(h) {
    h = h || H;
    const s = E('svg', { xmlns: NS, viewBox: `0 0 ${W} ${h}`, width: W, height: h, 'font-family': FONT });
    rect(s, 0, 0, W, h, { fill: C.white, rx: 0 });
    return s;
  }

  // ---------- レンダラー ----------

  const R = {};

  // 2×2 マトリクス（SWOT、PEST、アンゾフ、PPM など）
  R.matrix = function (d, fw) {
    const s = root();
    const ax = d.axes;
    const hasAx = !!ax;
    const left = hasAx ? 104 : 20, top = hasAx ? 54 : 20, gap = 10;
    const gw = W - left - 20, gh = H - top - 20;
    const cw = (gw - gap) / 2, ch = (gh - gap) / 2;
    const pos = [[0, 0], [1, 0], [0, 1], [1, 1]];
    if (hasAx) {
      // 軸名があれば「軸名：目盛り」として見出しに含める
      const name = (n, t) => (n && t ? n + '：' + t : t || '');
      const xt = ax.xTicks || [], yt = ax.yTicks || [];
      for (let i = 0; i < 2; i++) {
        const cx = left + i * (cw + gap);
        rect(s, cx, 10, cw, top - 18, { fill: C.faint, rx: 6 });
        label(s, name(ax.x, xt[i]), cx + 6, 10, cw - 12, top - 18, { size: 15, fill: C.navy });
        const cy = top + i * (ch + gap);
        rect(s, 10, cy, left - 18, ch, { fill: C.faint, rx: 6 });
        label(s, name(ax.y, yt[i]), 16, cy + 6, left - 30, ch - 12, { size: 15, fill: C.navy });
      }
    }
    d.sections.slice(0, 4).forEach((sec, i) => {
      const [cx, cy] = pos[i];
      card(s, left + cx * (cw + gap), top + cy * (ch + gap), cw, ch, sec, col(i, fw));
    });
    return s;
  };

  // 3つの円（3C）
  R.venn3 = function (d, fw) {
    const s = root();
    const r = 122;
    const centers = [[250, 200], [172, 336], [328, 336]];
    const textPos = [[250, 140], [138, 380], [362, 380]];
    d.sections.slice(0, 3).forEach((sec, i) => {
      const c = col(i, fw);
      E('circle', { cx: centers[i][0], cy: centers[i][1], r, fill: c, 'fill-opacity': 0.14, stroke: c, 'stroke-width': 2 }, s);
    });
    d.sections.slice(0, 3).forEach((sec, i) => {
      label(s, sec.title, textPos[i][0] - 70, textPos[i][1] - 28, 140, 56, { size: 17, fill: col(i, fw) });
    });
    if (d.center) {
      E('circle', { cx: 250, cy: 290, r: 34, fill: C.navy }, s);
      label(s, d.center, 222, 266, 56, 48, { size: 15, fill: C.white, min: 8 });
    }
    const x = 486, cw = 454, gap = 12, ch = (H - 40 - gap * 2) / 3;
    d.sections.slice(0, 3).forEach((sec, i) => {
      const c = col(i, fw), y = 20 + i * (ch + gap);
      rect(s, x, y, cw, ch, { fill: tint(c, 0.92) });
      rect(s, x, y, 128, ch, { fill: c });
      rect(s, x + 120, y, 8, ch, { fill: c, rx: 0 });
      label(s, sec.title, x + 8, y + 8, 112, ch - 16, { fill: C.white, size: 16 });
      list(s, sec.items, x + 144, y + 12, cw - 158, ch - 24, { size: 14, bulletColor: c });
    });
    return s;
  };

  // 5フォース
  R.forces = function (d, fw) {
    const s = root();
    const box = [
      [345, 192, 270, 156], // 中央: 業界内の競争
      [330, 14, 300, 146],  // 上: 新規参入
      [686, 162, 254, 216], // 右: 買い手
      [330, 380, 300, 146], // 下: 代替品
      [20, 162, 254, 216],  // 左: 売り手
    ];
    const sec = d.sections;
    // 矢印（外側 → 中央）
    const a = C.sub;
    arrow(s, 480, 162, 480, 190, { stroke: a });
    arrow(s, 480, 378, 480, 350, { stroke: a });
    arrow(s, 276, 270, 343, 270, { stroke: a });
    arrow(s, 684, 270, 617, 270, { stroke: a });
    sec.slice(0, 5).forEach((sc, i) => {
      const [x, y, w, h] = box[i];
      card(s, x, y, w, h, sc, i === 0 ? C.navy : col(i - 1, fw), { size: 14, titleSize: 16, headH: 38 });
    });
    return s;
  };

  // マッキンゼーの7S
  R.sevenS = function (d) {
    const s = root();
    const cx = 480, cy = 270, rx = 300, ry = 186, r = 80, rc = 92;
    const pts = [[cx, cy]];
    for (let i = 0; i < 6; i++) {
      const a = (-90 + i * 60) * Math.PI / 180;
      pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
    }
    for (let i = 0; i < 7; i++) for (let j = i + 1; j < 7; j++) {
      line(s, pts[i][0], pts[i][1], pts[j][0], pts[j][1], { stroke: C.line, sw: 1.2 });
    }
    d.sections.slice(0, 7).forEach((sec, i) => {
      const [x, y] = pts[i];
      const rr = i === 0 ? rc : r;
      // 1〜3: ハードS、4〜6: ソフトS
      const c = i === 0 ? C.navy : i <= 3 ? C.pal[0] : C.pal[1];
      E('circle', { cx: x, cy: y, r: rr, fill: i === 0 ? c : tint(c, 0.9), stroke: c, 'stroke-width': 2 }, s);
      const fg = i === 0 ? C.white : c;
      label(s, sec.title, x - rr * 0.78, y - rr * 0.66, rr * 1.56, 34, { size: 14, fill: fg, min: 9 });
      list(s, sec.items, x - rr * 0.66, y - rr * 0.66 + 36, rr * 1.32, rr * 0.92, {
        size: 13, min: 7.5, fill: i === 0 ? C.white : C.ink, bullet: false, anchor: 'middle', gap: 0.2, lh: 1.3,
      });
    });
    [['ハードS', C.pal[0]], ['ソフトS', C.pal[1]]].forEach(([t, c], i) => {
      E('circle', { cx: 26, cy: 26 + i * 22, r: 6, fill: tint(c, 0.9), stroke: c, 'stroke-width': 2 }, s);
      text(s, 38, 31 + i * 22, t, { size: 13, weight: 700, fill: c });
    });
    return s;
  };

  // 横並びの列（4P、4C など）
  R.columns = function (d, fw) {
    const s = root();
    const n = d.sections.length || 1, gap = 12;
    const w = (W - 40 - gap * (n - 1)) / n;
    d.sections.forEach((sec, i) => {
      card(s, 20 + i * (w + gap), 20, w, H - 40, sec, col(i, fw), { headH: 48, titleSize: 18, size: 16 });
    });
    return s;
  };

  // シェブロンのプロセス（STP、空・雨・傘 など）
  R.flow = function (d, fw) {
    const s = root();
    const n = d.sections.length || 1, gap = 6, hh = 62;
    const w = (W - 40 - gap * (n - 1)) / n;
    d.sections.forEach((sec, i) => {
      const x = 20 + i * (w + gap), c = col(i, fw);
      chevron(s, x, 20, w, hh, i === 0, c);
      label(s, sec.title, x + 10, 22, w - 34, hh - 4, { fill: C.white, size: 17 });
      rect(s, x, 20 + hh + 12, w - 18, H - 52 - hh, { fill: tint(c, 0.92) });
      list(s, sec.items, x + 14, 20 + hh + 26, w - 46, H - 80 - hh, { size: 15, bulletColor: c });
    });
    return s;
  };

  // As-Is / To-Be
  R.gap = function (d) {
    const s = root();
    const [asis, act, tobe] = d.sections;
    card(s, 20, 20, 300, H - 40, asis, C.pal[5]);
    card(s, 640, 20, 300, H - 40, tobe, C.pal[0]);
    const y0 = 110, y1 = H - 110, mid = H / 2;
    poly(s, [[336, y0], [570, y0], [570, y0 - 40], [626, mid], [570, y1 + 40], [570, y1], [336, y1]], { fill: tint(C.pal[2], 0.85) });
    label(s, act.title, 348, y0 + 10, 216, 36, { fill: C.pal[2], size: 18 });
    list(s, act.items, 352, y0 + 56, 214, y1 - y0 - 70, { size: 14, bulletColor: C.pal[2] });
    return s;
  };

  // バリューチェーン
  R.chain = function (d) {
    const s = root();
    const x0 = 20, tipX = 862, x1 = 940, ySplit = 268;
    poly(s, [[tipX, 20], [x1, H / 2], [tipX, H - 20]], { fill: C.navy });
    const m = String(d.margin || 'マージン');
    const chars = [...m];
    const fs = Math.min(18, 200 / chars.length);
    chars.forEach((ch, i) => {
      text(s, 888, H / 2 - (chars.length * fs * 1.15) / 2 + fs * (i + 0.9) * 1.15, ch, { size: fs, weight: 700, fill: C.white, anchor: 'middle' });
    });
    const sup = d.support || [];
    const rg = 6, rh = (ySplit - 20 - rg * (sup.length - 1)) / Math.max(1, sup.length);
    sup.forEach((sec, i) => {
      const y = 20 + i * (rh + rg);
      rect(s, x0, y, tipX - x0 - 8, rh, { fill: tint(C.pal[5], 0.9) });
      rect(s, x0, y, 178, rh, { fill: C.pal[5] });
      label(s, sec.title, x0 + 8, y + 2, 162, rh - 4, { fill: C.white, size: 14, min: 9 });
      list(s, [clean(sec.items).join(' ／ ')], x0 + 192, y + 6, tipX - x0 - 220, rh - 12, { size: 13, bullet: false, valign: 'middle', min: 8 });
    });
    const pri = d.sections || [];
    const pg = 8, pw = (tipX - x0 - 8 - pg * (pri.length - 1)) / Math.max(1, pri.length);
    pri.forEach((sec, i) => {
      const x = x0 + i * (pw + pg);
      card(s, x, ySplit + 10, pw, H - 30 - ySplit, sec, C.pal[0], { size: 13, titleSize: 14, headH: 42, min: 8 });
    });
    return s;
  };

  // ツリー（ロジックツリー: 横、ピラミッドストラクチャー: 縦）
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

  R.tree = function (d, fw) {
    const tree = parseTree(d.tree);
    const vertical = fw && fw.orientation === 'vertical';
    const leaves = [];
    let depthMax = 0;
    (function walk(n, dep) {
      n.depth = dep;
      depthMax = Math.max(depthMax, dep);
      if (!n.children.length) leaves.push(n);
      n.children.forEach((c) => walk(c, dep + 1));
    })(tree, 0);
    const D = depthMax + 1, L = Math.max(1, leaves.length);

    const depthColor = (dep) => dep === 0 ? C.navy : dep === 1 ? C.pal[0] : C.pal[5];
    const drawNode = (s, n, x, y, w, h) => {
      const c = depthColor(n.depth);
      if (n.depth === 0) rect(s, x, y, w, h, { fill: c });
      else if (n.depth === 1) rect(s, x, y, w, h, { fill: tint(c, 0.88), stroke: c, sw: 1.5 });
      else rect(s, x, y, w, h, { fill: C.white, stroke: C.line, sw: 1.5 });
      label(s, n.label, x + 8, y + 3, w - 16, h - 6, {
        fill: n.depth === 0 ? C.white : n.depth === 1 ? C.navy : C.ink,
        size: n.depth === 0 ? 17 : 14, weight: n.depth <= 1 ? 700 : 400, min: 8, lh: 1.25,
      });
    };

    if (!vertical) {
      const unit = 46;
      const h = Math.max(H, L * unit + 40);
      const s = root(h);
      const gx = 40, cw = (W - 40 - gx * (D - 1)) / D;
      const sp = (h - 40) / L;
      const bh = Math.min(sp - 8, 64);
      leaves.forEach((n, i) => { n.cy = 20 + sp * (i + 0.5); });
      (function pos(n) {
        if (n.children.length) {
          n.children.forEach(pos);
          n.cy = (n.children[0].cy + n.children[n.children.length - 1].cy) / 2;
        }
      })(tree);
      (function draw(n) {
        const x = 20 + n.depth * (cw + gx);
        if (n.children.length) {
          const xm = x + cw + gx / 2;
          line(s, x + cw, n.cy, xm, n.cy, { stroke: C.sub, sw: 1.5 });
          line(s, xm, n.children[0].cy, xm, n.children[n.children.length - 1].cy, { stroke: C.sub, sw: 1.5 });
          n.children.forEach((c) => line(s, xm, c.cy, x + cw + gx, c.cy, { stroke: C.sub, sw: 1.5 }));
          n.children.forEach(draw);
        }
        drawNode(s, n, x, n.cy - bh / 2, cw, bh);
      })(tree);
      return s;
    }

    const s = root();
    const gy = 34, rh = (H - 40 - gy * (D - 1)) / D;
    const bh = Math.min(rh, 110);
    const oy = (H - 40 - (bh * D + gy * (D - 1))) / 2;
    const sp = (W - 40) / L;
    const bw = sp - 10;
    leaves.forEach((n, i) => { n.cx = 20 + sp * (i + 0.5); });
    (function pos(n) {
      if (n.children.length) {
        n.children.forEach(pos);
        n.cx = (n.children[0].cx + n.children[n.children.length - 1].cx) / 2;
      }
    })(tree);
    (function draw(n) {
      const y = 20 + oy + n.depth * (bh + gy);
      const w = n.children.length ? Math.min(Math.max(bw, (n.children[n.children.length - 1].cx - n.children[0].cx) + bw), W - 40) : bw;
      if (n.children.length) {
        const ym = y + bh + gy / 2;
        line(s, n.cx, y + bh, n.cx, ym, { stroke: C.sub, sw: 1.5 });
        line(s, n.children[0].cx, ym, n.children[n.children.length - 1].cx, ym, { stroke: C.sub, sw: 1.5 });
        n.children.forEach((c) => line(s, c.cx, ym, c.cx, y + bh + gy, { stroke: C.sub, sw: 1.5 }));
        n.children.forEach(draw);
      }
      drawNode(s, n, n.cx - w / 2, y, w, bh);
    })(tree);
    return s;
  };

  // ファネル / ピラミッド（AIDMA、戦略ピラミッド）
  R.stack = function (d, fw) {
    const s = root();
    const pyramid = fw && fw.shape === 'pyramid';
    const n = Math.max(1, d.sections.length), gap = 6;
    const top = 20, bottom = H - 20, cx = 230, maxW = 420;
    const lh = (bottom - top - gap * (n - 1)) / n;
    const widthAt = (y) => {
      const t = (y - top) / (bottom - top);
      return pyramid ? 96 + (maxW - 96) * t : maxW - (maxW - 130) * t;
    };
    d.sections.forEach((sec, i) => {
      const y0 = top + i * (lh + gap), y1 = y0 + lh;
      const w0 = widthAt(y0), w1 = widthAt(y1);
      const c = [C.navy, C.pal[0], '#3B7BC4', '#5C93D1', '#7FAAD9', '#9FC0E3'][Math.min(i, 5)];
      poly(s, [[cx - w0 / 2, y0], [cx + w0 / 2, y0], [cx + w1 / 2, y1], [cx - w1 / 2, y1]], { fill: c });
      const tw = Math.min(w0, w1) * 0.86;
      const ty = y0;
      const fg = i >= 3 ? C.navy : C.white;
      label(s, sec.title, cx - tw / 2, ty, tw, y1 - ty, { fill: fg, size: 17, min: 9 });
      const edge = cx + Math.max(w0, w1) / 2;
      line(s, edge + 8, (y0 + y1) / 2, 470, (y0 + y1) / 2, { stroke: C.line, sw: 1.2, dash: '3 4' });
      rect(s, 478, y0, 462, lh, { fill: C.faint, rx: 6 });
      list(s, sec.items, 494, y0 + 8, 432, lh - 16, { size: 14, bulletColor: c, valign: 'middle' });
    });
    return s;
  };

  // サイクル（PDCA など）
  R.cycle = function (d, fw) {
    const s = root();
    const n = Math.max(2, d.sections.length);
    const cx = 480, cy = 270;
    const bw = n <= 4 ? 236 : 196, bh = n <= 4 ? 132 : 118;
    const rx = n <= 4 ? 330 : 340, ry = n <= 4 ? 178 : 190;
    const angs = d.sections.map((_, i) => (-90 + (360 / n) * i) * Math.PI / 180);
    const boxes = angs.map((a) => {
      const x = cx + Math.cos(a) * rx, y = cy + Math.sin(a) * ry;
      return [Math.min(Math.max(x - bw / 2, 14), W - 14 - bw), Math.min(Math.max(y - bh / 2, 14), H - 14 - bh), bw, bh];
    });
    const inside = (p, b) => p[0] > b[0] - 10 && p[0] < b[0] + b[2] + 10 && p[1] > b[1] - 10 && p[1] < b[1] + b[3] + 10;
    const ep = (a) => [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry];
    angs.forEach((a, i) => {
      const j = (i + 1) % n;
      let b = angs[j];
      if (b <= a) b += Math.PI * 2;
      const step = (b - a) / 120;
      let s0 = a, e0 = b;
      while (s0 < b && inside(ep(s0), boxes[i])) s0 += step;
      while (e0 > s0 && inside(ep(e0), boxes[j])) e0 -= step;
      if (e0 - s0 < step * 4) return;
      const ptsArr = [];
      for (let t = s0; t <= e0; t += step) ptsArr.push(ep(t));
      E('polyline', { points: ptsArr.map((p) => r1(p[0]) + ',' + r1(p[1])).join(' '), fill: 'none', stroke: C.sub, 'stroke-width': 2.5 }, s);
      const p1 = ptsArr[ptsArr.length - 1], p0 = ptsArr[ptsArr.length - 3] || ptsArr[0];
      arrowHead(s, p1[0], p1[1], Math.atan2(p1[1] - p0[1], p1[0] - p0[0]), C.sub, 13);
    });
    if (d.center) {
      E('circle', { cx, cy, r: 72, fill: C.faint, stroke: C.line }, s);
      label(s, d.center, cx - 58, cy - 40, 116, 80, { size: 16, fill: C.navy });
    }
    d.sections.forEach((sec, i) => {
      const [x, y, w, h] = boxes[i];
      card(s, x, y, w, h, sec, col(i, fw), { headH: 36, size: 13, titleSize: 16, min: 8 });
    });
    return s;
  };

  // ポジショニングマップ
  R.scatter = function (d) {
    const s = root();
    const ax = d.axes || {};
    const X0 = 130, X1 = 830, Y0 = 52, Y1 = 488;
    const mx = (X0 + X1) / 2, my = (Y0 + Y1) / 2;
    for (let i = 1; i < 10; i++) {
      if (i === 5) continue;
      const x = X0 + (X1 - X0) * i / 10, y = Y0 + (Y1 - Y0) * i / 10;
      line(s, x, Y0, x, Y1, { stroke: C.faint, sw: 1 });
      line(s, X0, y, X1, y, { stroke: C.faint, sw: 1 });
    }
    arrow(s, X0 - 4, my, X1 + 8, my, { stroke: C.sub, both: true, sw: 2 });
    arrow(s, mx, Y1 + 4, mx, Y0 - 8, { stroke: C.sub, both: true, sw: 2 });
    const xt = ax.xTicks || [], yt = ax.yTicks || [];
    label(s, xt[0] || '', 14, my - 30, X0 - 30, 60, { size: 15, fill: C.navy, anchor: 'middle' });
    label(s, xt[1] || '', X1 + 18, my - 30, W - X1 - 30, 60, { size: 15, fill: C.navy });
    label(s, yt[0] || '', mx - 200, 6, 400, Y0 - 22, { size: 15, fill: C.navy });
    label(s, yt[1] || '', mx - 200, Y1 + 16, 400, H - Y1 - 20, { size: 15, fill: C.navy });
    const pts = (d.points || []).filter((p) => p && p.label);
    const px = (v) => mx + (Math.max(-5, Math.min(5, v)) / 5) * (X1 - X0) / 2;
    const py = (v) => my - (Math.max(-5, Math.min(5, v)) / 5) * (Y1 - Y0) / 2;
    pts.forEach((p) => {
      const self = /^\*/.test(p.label) || /自社/.test(p.label);
      const name = p.label.replace(/^\*/, '');
      const x = px(+p.x || 0), y = py(+p.y || 0);
      const r = p.size ? 10 + Math.max(0, Math.min(5, +p.size)) * 5 : (self ? 16 : 12);
      const c = self ? C.pal[2] : C.pal[0];
      E('circle', { cx: r1(x), cy: r1(y), r, fill: c, 'fill-opacity': self ? 0.9 : 0.22, stroke: c, 'stroke-width': 2 }, s);
      const tw = measure(name, 14, 700) + 12;
      rect(s, x - tw / 2, y + r + 4, tw, 22, { fill: C.white, rx: 4, stroke: self ? c : 'none' });
      text(s, x, y + r + 20, name, { size: 14, weight: 700, fill: self ? c : C.ink, anchor: 'middle' });
    });
    return s;
  };

  // 表（VRIO など）
  function markColor(v) {
    const t = String(v).trim();
    if (/^[○◯〇]$/.test(t)) return C.pal[1];
    if (/^[×✕x]$/.test(t)) return C.pal[3];
    if (/^[△]$/.test(t)) return C.pal[2];
    return null;
  }

  R.table = function (d, fw) {
    const s = root();
    const tb = d.table || { columns: [], rows: [] };
    const cols = tb.columns.length || 1;
    const weights = (fw && fw.colWeights) || tb.columns.map((_, i) => (i === 0 ? 2.4 : 1));
    const sum = weights.slice(0, cols).reduce((a, b) => a + b, 0);
    const tw = W - 40, hh = 56;
    const rows = tb.rows.length || 1;
    const rh = Math.min(110, (H - 40 - hh - 4) / rows);
    let x = 20;
    const xs = weights.slice(0, cols).map((w) => { const v = x; x += tw * w / sum; return v; });
    xs.push(20 + tw);
    rect(s, 20, 20, tw, hh, { fill: C.navy });
    tb.columns.forEach((c, i) => {
      label(s, c, xs[i] + 6, 22, xs[i + 1] - xs[i] - 12, hh - 4, { fill: C.white, size: 15, min: 9 });
    });
    tb.rows.forEach((row, r) => {
      const y = 20 + hh + 4 + r * rh;
      rect(s, 20, y, tw, rh - 4, { fill: r % 2 ? C.white : C.faint, rx: 4 });
      for (let i = 0; i < cols; i++) {
        const v = row[i] == null ? '' : String(row[i]);
        const mc = markColor(v);
        const cw = xs[i + 1] - xs[i];
        if (mc) {
          label(s, v.trim(), xs[i], y, cw, rh - 4, { size: 24, fill: mc });
        } else {
          const last = i === cols - 1 && cols > 2;
          label(s, v, xs[i] + 10, y + 4, cw - 20, rh - 12, {
            size: 16, weight: i === 0 || last ? 700 : 400, fill: last ? C.navy : C.ink,
            anchor: i === 0 ? 'start' : 'middle', min: 8, lh: 1.35,
          });
        }
      }
    });
    for (let i = 1; i < cols; i++) line(s, xs[i], 20 + hh + 8, xs[i], 20 + hh + rows * rh - 4, { stroke: C.line, sw: 1 });
    return s;
  };

  // クロスSWOT
  R.grid = function (d) {
    const s = root();
    const hw = 230, hh = 150, gap = 8;
    const cw = (W - 40 - hw - gap * 2) / 2, ch = (H - 40 - hh - gap * 2) / 2;
    rect(s, 20, 20, hw, hh, { fill: C.faint });
    label(s, d.center || '', 30, 30, hw - 20, hh - 20, { size: 18, fill: C.navy });
    const ccol = [C.pal[1], C.pal[3]], rcol = [C.pal[0], C.pal[2]];
    (d.colHeaders || []).slice(0, 2).forEach((sec, i) => {
      card(s, 20 + hw + gap + i * (cw + gap), 20, cw, hh, sec, ccol[i], { headH: 34, size: 12.5, titleSize: 15, min: 8 });
    });
    (d.rowHeaders || []).slice(0, 2).forEach((sec, i) => {
      card(s, 20, 20 + hh + gap + i * (ch + gap), hw, ch, sec, rcol[i], { headH: 34, size: 12.5, titleSize: 15, min: 8 });
    });
    (d.cells || []).slice(0, 4).forEach((sec, k) => {
      const r = Math.floor(k / 2), c = k % 2;
      const x = 20 + hw + gap + c * (cw + gap), y = 20 + hh + gap + r * (ch + gap);
      rect(s, x, y, cw, ch, { fill: C.white, stroke: C.line, sw: 1.5 });
      label(s, sec.title, x + 14, y + 8, cw - 28, 30, { size: 16, fill: C.navy, anchor: 'start' });
      list(s, sec.items, x + 14, y + 44, cw - 28, ch - 54, { size: 14, bulletColor: C.navy });
    });
    return s;
  };

  // ビジネスモデルキャンバス
  R.bmc = function (d) {
    const s = root();
    const g = 6, x0 = 20, y0 = 20, tw = W - 40, th = 370;
    const cw = (tw - g * 4) / 5;
    const half = (th - g) / 2;
    const X = (i) => x0 + i * (cw + g);
    const cells = [
      [X(0), y0, cw, th],         // KP
      [X(1), y0, cw, half],       // KA
      [X(1), y0 + half + g, cw, half], // KR
      [X(2), y0, cw, th],         // VP
      [X(3), y0, cw, half],       // CR
      [X(3), y0 + half + g, cw, half], // CH
      [X(4), y0, cw, th],         // CS
      [x0, y0 + th + g, (tw - g) / 2, H - 40 - th - g], // Cost
      [x0 + (tw + g) / 2, y0 + th + g, (tw - g) / 2, H - 40 - th - g], // Revenue
    ];
    d.sections.slice(0, 9).forEach((sec, i) => {
      const [x, y, w, h] = cells[i];
      const hl = i === 3;
      rect(s, x, y, w, h, { fill: hl ? tint(C.pal[0], 0.88) : C.white, stroke: hl ? C.pal[0] : C.line, sw: 1.5 });
      label(s, sec.title, x + 10, y + 6, w - 20, 26, { size: 13, fill: hl ? C.pal[0] : C.navy, anchor: 'start', min: 9 });
      list(s, sec.items, x + 10, y + 36, w - 20, h - 44, { size: 12.5, min: 8, bulletColor: hl ? C.pal[0] : C.sub, gap: 0.35 });
    });
    return s;
  };

  // カスタマージャーニーマップ
  R.journey = function (d) {
    const s = root();
    const tb = d.table || { columns: [], rows: [] };
    const stages = tb.columns.slice(1);
    const n = Math.max(1, stages.length);
    const lw = 128, hh = 54, g = 6;
    const cw = (W - 40 - lw - g) / n;
    stages.forEach((st, i) => {
      const x = 20 + lw + g + i * cw;
      chevron(s, x + (i === 0 ? 0 : 4), 20, cw - 4, hh, i === 0, i % 2 ? C.pal[0] : C.navy);
      label(s, st, x + 10, 22, cw - 32, hh - 4, { fill: C.white, size: 15, min: 9 });
    });
    const rows = tb.rows.length || 1;
    const rh = (H - 40 - hh - g - g * (rows - 1)) / rows;
    tb.rows.forEach((row, r) => {
      const y = 20 + hh + g + r * (rh + g);
      rect(s, 20, y, lw, rh, { fill: tint(C.pal[0], 0.86) });
      label(s, row[0] || '', 26, y + 4, lw - 12, rh - 8, { fill: C.navy, size: 15, min: 9 });
      rect(s, 20 + lw + g, y, W - 40 - lw - g, rh, { fill: r % 2 ? C.white : C.faint, stroke: C.line, sw: 1 });
      for (let i = 0; i < n; i++) {
        const x = 20 + lw + g + i * cw;
        if (i > 0) line(s, x, y + 8, x, y + rh - 8, { stroke: C.line, sw: 1, dash: '3 3' });
        const v = row[i + 1] || '';
        list(s, String(v).split(/\s*[／/]\s*/), x + 10, y + 8, cw - 20, rh - 16, { size: 13, min: 8, bulletColor: C.pal[0], gap: 0.3 });
      }
    });
    return s;
  };

  function render(fw, data) {
    const fn = R[fw.layout];
    if (!fn) throw new Error('未対応のレイアウト: ' + fw.layout);
    return fn(data, fw);
  }

  window.Diagram = { render, W, H, FONT, parseTree };
})();
