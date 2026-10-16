/*
 * 図の形（レイアウト）
 *
 * Diagram.layout(名前, (c, d, fw) => { ... }) で登録する。
 *   c  … 描画の道具。c.W / c.H が描画領域の大きさ（幅は常に960、高さは用途で変わる）。
 *        色は c.K（テーマの色）、c.accent(i)（i番目の要素の色）、c.tint / c.on で作る。
 *        図形は c.rect / c.circle / c.poly / c.line / c.arrow、文字は c.label / c.list / c.card。
 *   d  … 図のデータ（frameworks.js の data。利用者の編集内容が入る）
 *   fw … フレームワークの定義（colors や orientation などのオプション）
 *
 * 色の直書きや座標の決め打ちをせず、テーマの色と c.W / c.H から位置を計算すると、
 * どのデザインパターンでも、スライドに載せたときも崩れない。
 */
(function () {
  'use strict';
  const L = window.Diagram.layout;

  // 2×2 マトリクス（SWOT、PEST、アンゾフ、PPM など）
  L('matrix', (c, d) => {
    const { W, H, K } = c;
    const ax = d.axes;
    const left = ax ? 104 : 20, top = ax ? 54 : 20, gap = 10;
    const cw = (W - left - 20 - gap) / 2, ch = (H - top - 20 - gap) / 2;
    if (ax) {
      // 軸名があれば「軸名：目盛り」として見出しに含める
      const name = (n, t) => (n && t ? n + '：' + t : t || '');
      const xt = ax.xTicks || [], yt = ax.yTicks || [];
      for (let i = 0; i < 2; i++) {
        const x = left + i * (cw + gap);
        c.rect(x, 10, cw, top - 18, { fill: K.faint });
        c.label(name(ax.x, xt[i]), x + 6, 10, cw - 12, top - 18, { size: 15, fill: K.strong });
        const y = top + i * (ch + gap);
        c.rect(10, y, left - 18, ch, { fill: K.faint });
        c.label(name(ax.y, yt[i]), 16, y + 6, left - 30, ch - 12, { size: 15, fill: K.strong });
      }
    }
    (d.sections || []).slice(0, 4).forEach((sec, i) => {
      c.card(left + (i % 2) * (cw + gap), top + Math.floor(i / 2) * (ch + gap), cw, ch, sec, c.accent(i));
    });
  });

  // 3つの円（3C）
  L('venn3', (c, d) => {
    const { W, H, K } = c;
    const r = Math.min(122, (H - 40) / 3.2);
    const cx = 250, cy = H / 2 + 0.186 * r;
    const centers = [[cx, cy - 0.743 * r], [cx - 0.64 * r, cy + 0.371 * r], [cx + 0.64 * r, cy + 0.371 * r]];
    const tpos = [[cx, centers[0][1] - 0.49 * r], [cx - 0.92 * r, centers[1][1] + 0.36 * r], [cx + 0.92 * r, centers[2][1] + 0.36 * r]];
    const secs = (d.sections || []).slice(0, 3);
    secs.forEach((sec, i) => c.circle(centers[i][0], centers[i][1], r, { fill: c.accent(i), opacity: 0.14, stroke: c.accent(i), sw: 2 }));
    secs.forEach((sec, i) => c.label(sec.title, tpos[i][0] - 70, tpos[i][1] - 28, 140, 56, { size: 17, fill: c.accent(i) }));
    if (d.center) {
      const kr = r * 0.28;
      c.circle(cx, cy, kr, { fill: K.primary });
      c.label(d.center, cx - kr * 0.82, cy - kr * 0.7, kr * 1.64, kr * 1.4, { size: 15, fill: c.on(K.primary), min: 8 });
    }
    const x = 486, cw = W - x - 20, gap = 12, ch = (H - 40 - gap * 2) / 3;
    secs.forEach((sec, i) => {
      const col = c.accent(i), y = 20 + i * (ch + gap);
      c.rect(x, y, cw, ch, { fill: c.tint(col, 0.92) });
      c.rect(x, y, 128, ch, { fill: col });
      c.rect(x + 120, y, 8, ch, { fill: col, rx: 0 });
      c.label(sec.title, x + 8, y + 8, 112, ch - 16, { fill: c.on(col), size: 16 });
      c.list(sec.items, x + 144, y + 12, cw - 158, ch - 24, { size: 14, bulletColor: col });
    });
  });

  // 5フォース（中央＋上下左右）
  L('forces', (c, d) => {
    const { W, H, K } = c;
    // 縦は「上 150・間 22・中央 168・間 22・下 150」の比率で配分する
    const u = (H - 28) / 512;
    const cx = W / 2, vw = 380;
    const box = [
      [cx - 140, 14 + 172 * u, 280, 168 * u],   // 中央: 業界内の競争
      [cx - vw / 2, 14, vw, 150 * u],           // 上: 新規参入
      [W - 274, H / 2 - 108 * u, 254, 216 * u], // 右: 買い手
      [cx - vw / 2, 14 + 362 * u, vw, 150 * u], // 下: 代替品
      [20, H / 2 - 108 * u, 254, 216 * u],      // 左: 売り手
    ];
    const ctr = box[0];
    c.arrow(cx, box[1][1] + box[1][3] + 2, cx, ctr[1] - 2);
    c.arrow(cx, box[3][1] - 2, cx, ctr[1] + ctr[3] + 2);
    c.arrow(box[4][0] + box[4][2] + 2, H / 2, ctr[0] - 2, H / 2);
    c.arrow(box[2][0] - 2, H / 2, ctr[0] + ctr[2] + 2, H / 2);
    (d.sections || []).slice(0, 5).forEach((sec, i) => {
      const [x, y, w, h] = box[i];
      c.card(x, y, w, h, sec, i === 0 ? K.primary : c.accent(i - 1), { size: 14, titleSize: 16, headH: Math.min(38, 26 + 12 * u), min: 8 });
    });
  });

  // マッキンゼーの7S（中央＋周囲6つ）
  L('sevenS', (c, d) => {
    const { W, H, K } = c;
    const r = Math.min(80, H * 0.148), rc = r * 1.15;
    const cx = W / 2, cy = H / 2, rx = 300, ry = H / 2 - r - 4;
    const pts = [[cx, cy]];
    for (let i = 0; i < 6; i++) {
      const a = (-90 + i * 60) * Math.PI / 180;
      pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
    }
    for (let i = 0; i < 7; i++) for (let j = i + 1; j < 7; j++) c.line(pts[i][0], pts[i][1], pts[j][0], pts[j][1], { stroke: K.line, sw: 1.2 });
    const hard = c.accent(0), soft = c.accent(1);
    (d.sections || []).slice(0, 7).forEach((sec, i) => {
      const [x, y] = pts[i];
      const rr = i === 0 ? rc : r;
      // 1〜3: ハードS、4〜6: ソフトS
      const col = i === 0 ? K.primary : i <= 3 ? hard : soft;
      const fill = i === 0 ? col : c.tint(col, 0.9);
      c.circle(x, y, rr, { fill, stroke: col, sw: 2 });
      const fg = i === 0 ? c.on(col) : col;
      c.label(sec.title, x - rr * 0.78, y - rr * 0.66, rr * 1.56, rr * 0.42, { size: 14, fill: fg, min: 9 });
      c.list(sec.items, x - rr * 0.66, y - rr * 0.2, rr * 1.32, rr * 0.86, {
        size: 13, min: 7.5, fill: i === 0 ? c.on(col) : K.ink, bullet: false, anchor: 'middle', gap: 0.2, lh: 1.3,
      });
    });
    [['ハードS', hard], ['ソフトS', soft]].forEach(([t, col], i) => {
      c.circle(26, 26 + i * 22, 6, { fill: c.tint(col, 0.9), stroke: col, sw: 2 });
      c.text(38, 31 + i * 22, t, { size: 13, weight: 700, fill: col });
    });
  });

  // 横並びの列（4P、4C など）
  L('columns', (c, d) => {
    const { W, H } = c;
    const secs = d.sections || [];
    const n = secs.length || 1, gap = 12;
    const w = (W - 40 - gap * (n - 1)) / n;
    secs.forEach((sec, i) => c.card(20 + i * (w + gap), 20, w, H - 40, sec, c.accent(i), { headH: 48, titleSize: 18, size: 16 }));
  });

  // シェブロンのプロセス（STP、空・雨・傘 など）
  L('flow', (c, d) => {
    const { W, H } = c;
    const secs = d.sections || [];
    const n = secs.length || 1, gap = 6, hh = Math.min(62, H * 0.115);
    const w = (W - 40 - gap * (n - 1)) / n;
    secs.forEach((sec, i) => {
      const x = 20 + i * (w + gap), col = c.accent(i);
      c.chevron(x, 20, w, hh, i === 0, col);
      c.label(sec.title, x + 10, 22, w - 34, hh - 4, { fill: c.on(col), size: 17 });
      c.rect(x, 20 + hh + 12, w - 18, H - 52 - hh, { fill: c.tint(col, 0.92) });
      c.list(sec.items, x + 14, 20 + hh + 26, w - 46, H - 80 - hh, { size: 15, bulletColor: col });
    });
  });

  // As-Is / To-Be（現状 → 施策 → あるべき姿）
  L('gap', (c, d) => {
    const { W, H } = c;
    const [asis, act, tobe] = d.sections || [];
    const bw = 300;
    if (asis) c.card(20, 20, bw, H - 40, asis, c.accent(5));
    if (tobe) c.card(W - 20 - bw, 20, bw, H - 40, tobe, c.accent(0));
    if (!act) return;
    const x0 = 20 + bw + 16, x1 = W - 20 - bw - 14;
    const y0 = H * 0.2, y1 = H * 0.8, mid = H / 2, head = 56, flare = H * 0.074;
    const col = c.accent(2);
    c.poly([[x0, y0], [x1 - head, y0], [x1 - head, y0 - flare], [x1, mid], [x1 - head, y1 + flare], [x1 - head, y1], [x0, y1]], { fill: c.tint(col, 0.85) });
    c.label(act.title, x0 + 12, y0 + 10, x1 - head - x0 - 18, 36, { fill: col, size: 18 });
    c.list(act.items, x0 + 16, y0 + 56, x1 - head - x0 - 20, y1 - y0 - 70, { size: 14, bulletColor: col });
  });

  // バリューチェーン（支援活動＋主活動＋マージン）
  L('chain', (c, d) => {
    const { W, H, K } = c;
    const x0 = 20, x1 = W - 20, tipX = x1 - 78, ySplit = H * 0.496;
    c.poly([[tipX, 20], [x1, H / 2], [tipX, H - 20]], { fill: K.primary });
    const chars = [...String(d.margin || 'マージン')];
    const fs = Math.min(18, (H * 0.4) / chars.length);
    chars.forEach((ch, i) => {
      c.text(tipX + 26, H / 2 - (chars.length * fs * 1.15) / 2 + fs * (i + 0.9) * 1.15, ch, { size: fs, weight: 700, fill: c.on(K.primary), anchor: 'middle' });
    });
    const sup = d.support || [];
    const sc = c.accent(5);
    const rg = 6, rh = (ySplit - 20 - rg * (sup.length - 1)) / Math.max(1, sup.length);
    sup.forEach((sec, i) => {
      const y = 20 + i * (rh + rg);
      c.rect(x0, y, tipX - x0 - 8, rh, { fill: c.tint(sc, 0.9) });
      c.rect(x0, y, 178, rh, { fill: sc });
      c.label(sec.title, x0 + 8, y + 2, 162, rh - 4, { fill: c.on(sc), size: 14, min: 9 });
      c.list([c.clean(sec.items).join(' ／ ')], x0 + 192, y + 6, tipX - x0 - 220, rh - 12, { size: 13, bullet: false, valign: 'middle', min: 8 });
    });
    const pri = d.sections || [];
    const pg = 8, pw = (tipX - x0 - 8 - pg * (pri.length - 1)) / Math.max(1, pri.length);
    pri.forEach((sec, i) => {
      c.card(x0 + i * (pw + pg), ySplit + 10, pw, H - 30 - ySplit, sec, c.accent(0), { size: 13, titleSize: 14, headH: 42, min: 8 });
    });
  });

  // ツリー（ロジックツリー: 横、ピラミッドストラクチャー: 縦）
  L('tree', (c, d, fw) => {
    const { W, K } = c;
    let H = c.H;
    const tree = c.parseTree(d.tree);
    const vertical = fw && fw.orientation === 'vertical';
    const leaves = [];
    let depthMax = 0;
    (function walk(n, dep) {
      n.depth = dep;
      depthMax = Math.max(depthMax, dep);
      if (!n.children.length) leaves.push(n);
      n.children.forEach((ch) => walk(ch, dep + 1));
    })(tree, 0);
    const D = depthMax + 1, NL = Math.max(1, leaves.length);
    const nodeColor = (dep) => (dep === 0 ? K.primary : c.accent(0));
    const drawNode = (n, x, y, w, h) => {
      const col = nodeColor(n.depth);
      if (n.depth === 0) c.rect(x, y, w, h, { fill: col });
      else if (n.depth === 1) c.rect(x, y, w, h, { fill: c.tint(col, 0.88), stroke: col, sw: 1.5 });
      else c.rect(x, y, w, h, { fill: K.surface, stroke: K.line, sw: 1.5 });
      c.label(n.label, x + 8, y + 3, w - 16, h - 6, {
        fill: n.depth === 0 ? c.on(col) : n.depth === 1 ? K.strong : K.ink,
        size: n.depth === 0 ? 17 : 14, weight: n.depth <= 1 ? 700 : 400, min: 8, lh: 1.25,
      });
    };
    const elbow = { stroke: K.sub, sw: 1.5 };

    if (!vertical) {
      // 葉が多いときは図を縦に伸ばす
      H = Math.max(H, NL * 46 + 40);
      c.setHeight(H);
      const gx = 40, cw = (W - 40 - gx * (D - 1)) / D;
      const sp = (H - 40) / NL;
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
          c.line(x + cw, n.cy, xm, n.cy, elbow);
          c.line(xm, n.children[0].cy, xm, n.children[n.children.length - 1].cy, elbow);
          n.children.forEach((ch) => c.line(xm, ch.cy, x + cw + gx, ch.cy, elbow));
          n.children.forEach(draw);
        }
        drawNode(n, x, n.cy - bh / 2, cw, bh);
      })(tree);
      return;
    }

    const gy = 34, rh = (H - 40 - gy * (D - 1)) / D;
    const bh = Math.min(rh, 110);
    const oy = (H - 40 - (bh * D + gy * (D - 1))) / 2;
    const sp = (W - 40) / NL, bw = sp - 10;
    leaves.forEach((n, i) => { n.cx = 20 + sp * (i + 0.5); });
    (function pos(n) {
      if (n.children.length) {
        n.children.forEach(pos);
        n.cx = (n.children[0].cx + n.children[n.children.length - 1].cx) / 2;
      }
    })(tree);
    (function draw(n) {
      const y = 20 + oy + n.depth * (bh + gy);
      const kids = n.children;
      const w = kids.length ? Math.min(Math.max(bw, kids[kids.length - 1].cx - kids[0].cx + bw), W - 40) : bw;
      if (kids.length) {
        const ym = y + bh + gy / 2;
        c.line(n.cx, y + bh, n.cx, ym, elbow);
        c.line(kids[0].cx, ym, kids[kids.length - 1].cx, ym, elbow);
        kids.forEach((ch) => c.line(ch.cx, ym, ch.cx, y + bh + gy, elbow));
        kids.forEach(draw);
      }
      drawNode(n, n.cx - w / 2, y, w, bh);
    })(tree);
  });

  // ファネル / ピラミッド（AIDMA、戦略ピラミッド）
  L('stack', (c, d, fw) => {
    const { H, K } = c;
    const pyramid = fw && fw.shape === 'pyramid';
    const secs = d.sections || [];
    const n = Math.max(1, secs.length), gap = 6;
    const top = 20, bottom = H - 20, cx = 230, maxW = 420;
    const lh = (bottom - top - gap * (n - 1)) / n;
    const widthAt = (y) => {
      const t = (y - top) / (bottom - top);
      return pyramid ? 96 + (maxW - 96) * t : maxW - (maxW - 130) * t;
    };
    // 主色から1色目の要素色へ、段ごとに淡くしていく
    const ramp = (i) => (i === 0 ? K.primary : c.tint(c.accent(0), Math.min(0.7, (i - 1) * 0.16)));
    secs.forEach((sec, i) => {
      const y0 = top + i * (lh + gap), y1 = y0 + lh;
      const w0 = widthAt(y0), w1 = widthAt(y1);
      const col = ramp(i);
      c.poly([[cx - w0 / 2, y0], [cx + w0 / 2, y0], [cx + w1 / 2, y1], [cx - w1 / 2, y1]], { fill: col });
      const tw = Math.min(w0, w1) * 0.86;
      c.label(sec.title, cx - tw / 2, y0, tw, lh, { fill: c.on(col), size: 17, min: 9 });
      const edge = cx + Math.max(w0, w1) / 2;
      c.line(edge + 8, (y0 + y1) / 2, 470, (y0 + y1) / 2, { stroke: K.line, sw: 1.2, dash: '3 4' });
      c.rect(478, y0, c.W - 498, lh, { fill: K.faint });
      c.list(sec.items, 494, y0 + 8, c.W - 530, lh - 16, { size: 14, bulletColor: col === K.primary ? K.strong : c.accent(0), valign: 'middle' });
    });
  });

  // サイクル（PDCA など）
  L('cycle', (c, d) => {
    const { W, H, K } = c;
    const secs = d.sections || [];
    const n = Math.max(2, secs.length);
    const cx = W / 2, cy = H / 2;
    const bw = n <= 4 ? 236 : 196, bh = Math.min(n <= 4 ? 132 : 118, H * 0.245);
    const rx = n <= 4 ? 330 : 340, ry = H / 2 - bh / 2 - 14;
    const angs = secs.map((_, i) => (-90 + (360 / n) * i) * Math.PI / 180);
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
      const pts = [];
      for (let t = s0; t <= e0; t += step * 4) pts.push(ep(t));
      pts.push(ep(e0));
      c.polyline(pts, { stroke: K.sub, sw: 2.5 });
      const p1 = pts[pts.length - 1], p0 = pts[pts.length - 2];
      c.arrowHead(p1[0], p1[1], Math.atan2(p1[1] - p0[1], p1[0] - p0[0]), K.sub, 13);
    });
    if (d.center) {
      const r = Math.min(72, H * 0.13);
      c.circle(cx, cy, r, { fill: K.faint, stroke: K.line });
      c.label(d.center, cx - r * 0.8, cy - r * 0.56, r * 1.6, r * 1.12, { size: 16, fill: K.strong, min: 9 });
    }
    secs.forEach((sec, i) => {
      const [x, y, w, h] = boxes[i];
      c.card(x, y, w, h, sec, c.accent(i), { headH: 36, size: 13, titleSize: 16, min: 8 });
    });
  });

  // ポジショニングマップ（2軸の散布図）
  L('scatter', (c, d) => {
    const { W, H, K } = c;
    const ax = d.axes || {};
    const X0 = 130, X1 = W - 130, Y0 = 52, Y1 = H - 52;
    const mx = (X0 + X1) / 2, my = (Y0 + Y1) / 2;
    for (let i = 1; i < 10; i++) {
      if (i === 5) continue;
      const x = X0 + (X1 - X0) * i / 10, y = Y0 + (Y1 - Y0) * i / 10;
      c.line(x, Y0, x, Y1, { stroke: K.faint, sw: 1 });
      c.line(X0, y, X1, y, { stroke: K.faint, sw: 1 });
    }
    c.arrow(X0 - 4, my, X1 + 8, my, { both: true, sw: 2 });
    c.arrow(mx, Y1 + 4, mx, Y0 - 8, { both: true, sw: 2 });
    const xt = ax.xTicks || [], yt = ax.yTicks || [];
    c.label(xt[0] || '', 14, my - 30, X0 - 30, 60, { size: 15, fill: K.strong });
    c.label(xt[1] || '', X1 + 18, my - 30, W - X1 - 30, 60, { size: 15, fill: K.strong });
    c.label(yt[0] || '', mx - 200, 6, 400, Y0 - 22, { size: 15, fill: K.strong });
    c.label(yt[1] || '', mx - 200, Y1 + 16, 400, H - Y1 - 20, { size: 15, fill: K.strong });
    const px = (v) => mx + (Math.max(-5, Math.min(5, v)) / 5) * (X1 - X0) / 2;
    const py = (v) => my - (Math.max(-5, Math.min(5, v)) / 5) * (Y1 - Y0) / 2;
    (d.points || []).filter((p) => p && p.label).forEach((p) => {
      // 名前の先頭が * か「自社」を含むものを強調
      const self = /^\*/.test(p.label) || /自社/.test(p.label);
      const name = p.label.replace(/^\*/, '');
      const x = px(+p.x || 0), y = py(+p.y || 0);
      const r = p.size ? 10 + Math.max(0, Math.min(5, +p.size)) * 5 : (self ? 16 : 12);
      const col = self ? K.highlight : c.accent(0);
      c.circle(x, y, r, { fill: col, opacity: self ? 0.9 : 0.22, stroke: col, sw: 2 });
      const tw = c.measure(name, 14, 700) + 12;
      c.rect(x - tw / 2, y + r + 4, tw, 22, { fill: K.bg, rx: 4, stroke: self ? col : null });
      c.text(x, y + r + 20, name, { size: 14, weight: 700, fill: self ? col : K.ink, anchor: 'middle' });
    });
  });

  // 表（VRIO など）。○ × △ はテーマの good / bad / warn 色の記号になる
  L('table', (c, d, fw) => {
    const { W, H, K } = c;
    const tb = d.table || { columns: [], rows: [] };
    const cols = tb.columns.length || 1;
    const weights = (fw && fw.colWeights) || tb.columns.map((_, i) => (i === 0 ? 2.4 : 1));
    const sum = weights.slice(0, cols).reduce((a, b) => a + b, 0);
    const tw = W - 40, hh = 56;
    const rows = tb.rows.length || 1;
    const rh = Math.min(110, (H - 40 - hh - 4) / rows);
    const mark = (v) => {
      const t = String(v).trim();
      if (/^[○◯〇]$/.test(t)) return K.good;
      if (/^[×✕x]$/.test(t)) return K.bad;
      if (/^△$/.test(t)) return K.warn;
      return null;
    };
    let acc = 20;
    const xs = weights.slice(0, cols).map((w) => { const v = acc; acc += tw * w / sum; return v; });
    xs.push(20 + tw);
    c.rect(20, 20, tw, hh, { fill: K.primary });
    tb.columns.forEach((col, i) => c.label(col, xs[i] + 6, 22, xs[i + 1] - xs[i] - 12, hh - 4, { fill: c.on(K.primary), size: 15, min: 9 }));
    tb.rows.forEach((row, r) => {
      const y = 20 + hh + 4 + r * rh;
      c.rect(20, y, tw, rh - 4, { fill: r % 2 ? K.bg : K.faint, rx: Math.min(4, c.style.radius) });
      for (let i = 0; i < cols; i++) {
        const v = row[i] == null ? '' : String(row[i]);
        const mc = mark(v);
        const cw = xs[i + 1] - xs[i];
        if (mc) {
          c.label(v.trim(), xs[i], y, cw, rh - 4, { size: 24, fill: mc });
        } else {
          const last = i === cols - 1 && cols > 2;
          c.label(v, xs[i] + 10, y + 4, cw - 20, rh - 12, {
            size: 16, weight: i === 0 || last ? 700 : 400, fill: last ? K.strong : K.ink,
            anchor: i === 0 ? 'start' : 'middle', min: 8, lh: 1.35,
          });
        }
      }
    });
    for (let i = 1; i < cols; i++) c.line(xs[i], 20 + hh + 8, xs[i], 20 + hh + rows * rh - 4, { stroke: K.line, sw: 1 });
  });

  // 見出し付き 2×2（クロスSWOT）
  L('grid', (c, d) => {
    const { W, H, K } = c;
    const hw = 230, hh = Math.min(150, H * 0.278), gap = 8;
    const cw = (W - 40 - hw - gap * 2) / 2, ch = (H - 40 - hh - gap * 2) / 2;
    c.rect(20, 20, hw, hh, { fill: K.faint });
    c.label(d.center || '', 30, 30, hw - 20, hh - 20, { size: 18, fill: K.strong });
    const ccol = [c.accent(1), c.accent(3)], rcol = [c.accent(0), c.accent(2)];
    const small = { headH: 34, size: 12.5, titleSize: 15, min: 8 };
    (d.colHeaders || []).slice(0, 2).forEach((sec, i) => c.card(20 + hw + gap + i * (cw + gap), 20, cw, hh, sec, ccol[i], small));
    (d.rowHeaders || []).slice(0, 2).forEach((sec, i) => c.card(20, 20 + hh + gap + i * (ch + gap), hw, ch, sec, rcol[i], small));
    (d.cells || []).slice(0, 4).forEach((sec, k) => {
      const x = 20 + hw + gap + (k % 2) * (cw + gap), y = 20 + hh + gap + Math.floor(k / 2) * (ch + gap);
      c.rect(x, y, cw, ch, { fill: K.surface, stroke: K.line, sw: 1.5 });
      c.label(sec.title, x + 14, y + 8, cw - 28, 30, { size: 16, fill: K.strong, anchor: 'start' });
      c.list(sec.items, x + 14, y + 44, cw - 28, ch - 54, { size: 14, bulletColor: K.strong });
    });
  });

  // ビジネスモデルキャンバス（9マス）
  L('bmc', (c, d) => {
    const { W, H, K } = c;
    const g = 6, x0 = 20, y0 = 20, tw = W - 40, th = (H - 40) * 0.7;
    const cw = (tw - g * 4) / 5, half = (th - g) / 2;
    const X = (i) => x0 + i * (cw + g);
    const bh = H - 40 - th - g;
    const cells = [
      [X(0), y0, cw, th], [X(1), y0, cw, half], [X(1), y0 + half + g, cw, half], [X(2), y0, cw, th],
      [X(3), y0, cw, half], [X(3), y0 + half + g, cw, half], [X(4), y0, cw, th],
      [x0, y0 + th + g, (tw - g) / 2, bh], [x0 + (tw + g) / 2, y0 + th + g, (tw - g) / 2, bh],
    ];
    const hl = c.accent(0);
    (d.sections || []).slice(0, 9).forEach((sec, i) => {
      const [x, y, w, h] = cells[i];
      const vp = i === 3; // 価値提案を強調
      c.rect(x, y, w, h, { fill: vp ? c.tint(hl, 0.88) : K.surface, stroke: vp ? hl : K.line, sw: 1.5 });
      c.label(sec.title, x + 10, y + 6, w - 20, 26, { size: 13, fill: vp ? hl : K.strong, anchor: 'start', min: 9 });
      c.list(sec.items, x + 10, y + 36, w - 20, h - 44, { size: 12.5, min: 8, bulletColor: vp ? hl : K.sub, gap: 0.35 });
    });
  });

  // カスタマージャーニーマップ（ステージ×行）
  L('journey', (c, d) => {
    const { W, H, K } = c;
    const tb = d.table || { columns: [], rows: [] };
    const stages = tb.columns.slice(1);
    const n = Math.max(1, stages.length);
    const lw = 128, hh = Math.min(54, H * 0.1), g = 6;
    const cw = (W - 40 - lw - g) / n;
    stages.forEach((st, i) => {
      const x = 20 + lw + g + i * cw;
      const col = i % 2 ? c.accent(0) : K.primary;
      c.chevron(x + (i === 0 ? 0 : 4), 20, cw - 4, hh, i === 0, col);
      c.label(st, x + 10, 22, cw - 32, hh - 4, { fill: c.on(col), size: 15, min: 9 });
    });
    const rows = tb.rows.length || 1;
    const rh = (H - 40 - hh - g - g * (rows - 1)) / rows;
    tb.rows.forEach((row, r) => {
      const y = 20 + hh + g + r * (rh + g);
      c.rect(20, y, lw, rh, { fill: c.tint(c.accent(0), 0.86) });
      c.label(row[0] || '', 26, y + 4, lw - 12, rh - 8, { fill: K.strong, size: 15, min: 9 });
      c.rect(20 + lw + g, y, W - 40 - lw - g, rh, { fill: r % 2 ? K.bg : K.faint, stroke: K.line, sw: 1 });
      for (let i = 0; i < n; i++) {
        const x = 20 + lw + g + i * cw;
        if (i > 0) c.line(x, y + 8, x, y + rh - 8, { stroke: K.line, sw: 1, dash: '3 3' });
        c.list(String(row[i + 1] || '').split(/\s*[／/]\s*/), x + 10, y + 8, cw - 20, rh - 16, { size: 13, min: 8, bulletColor: c.accent(0), gap: 0.3 });
      }
    });
  });
})();
