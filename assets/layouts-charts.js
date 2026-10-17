/*
 * 定量チャートとガントチャートのレイアウト
 *
 * コンサルの定量チャートの作法に沿って描く。
 *   - 目盛り線や縦軸は省き、値はグラフに直接書く（Less is More）
 *   - 伝えたい1点だけを色で強調し、他は灰色に落とす
 *   - 凡例より、線や棒の横に直接ラベルを置く
 */
(function () {
  'use strict';
  const L = window.Diagram.layout;

  // ---------- 共通ヘルパー ----------

  function num(v) {
    const n = parseFloat(String(v == null ? '' : v).replace(/[,，\s]/g, '').replace(/^＋/, '+').replace(/^[−－]/, '-'));
    return isFinite(n) ? n : null;
  }
  function fmt(v, sign) {
    const r = Math.round(v * 10) / 10;
    const s = Math.abs(r).toLocaleString('ja-JP', { maximumFractionDigits: 1 });
    if (r < 0) return '−' + s;
    return (sign && r > 0 ? '+' : '') + s;
  }
  // 強調しない要素の色（文字色と背景色の中間の灰色）
  const muted = (c) => c.mix(c.K.sub, c.K.bg, 0.55);

  function unitLabel(c, d, x, y) {
    if (d.unit) c.text(x, y, `（単位：${d.unit}）`, { size: 12, fill: c.K.sub });
  }

  // 表データ（1列目が系列名、残りが値）を読む
  function readSeries(d) {
    const tb = d.table || { columns: [], rows: [] };
    const cats = tb.columns.slice(1);
    const series = tb.rows.filter((r) => r && r[0] != null && r.length > 1)
      .map((r) => ({ name: String(r[0]), values: cats.map((_, i) => num(r[i + 1])) }));
    return { cats, series };
  }

  // ---------- ウォーターフォール ----------
  // steps: 1行に「項目名, 値」。1行目は起点の合計。値が「=」または空欄の行はそこまでの合計。
  L('waterfall', (c, d) => {
    const { W, H, K } = c;
    const steps = String(d.steps || '').split('\n').map((ln) => ln.trim()).filter(Boolean).map((ln, i) => {
      const m = ln.split(/\s*[,，\t]\s*/);
      const raw = (m[1] || '').trim();
      const total = i === 0 || raw === '' || raw === '=' || raw === '＝';
      return { label: m[0], value: num(raw), total };
    });
    if (!steps.length) return;
    let cum = 0;
    const bars = steps.map((st, i) => {
      if (i === 0) { cum = st.value || 0; return { ...st, from: 0, to: cum, kind: 'total' }; }
      if (st.total) return { ...st, from: 0, to: cum, kind: 'total', value: cum };
      const from = cum;
      cum += st.value || 0;
      return { ...st, from, to: cum, kind: (st.value || 0) >= 0 ? 'up' : 'down' };
    });
    const lo = Math.min(0, ...bars.map((b) => Math.min(b.from, b.to)));
    const hi = Math.max(0, ...bars.map((b) => Math.max(b.from, b.to)));
    const X0 = 30, X1 = W - 30, Y0 = 52, Y1 = H - 64;
    const span = (hi - lo) || 1;
    const y = (v) => Y1 - ((v - lo) / span) * (Y1 - Y0);
    const slot = (X1 - X0) / bars.length, bw = Math.min(slot * 0.62, 110);
    unitLabel(c, d, 20, 24);
    c.line(X0, y(0), X1, y(0), { stroke: K.sub, sw: 1.5 });
    // 増加の色が主色と同じテーマ（モノトーンなど）では、合計と区別できるよう灰色にする
    const upCol = K.good.toUpperCase() === K.primary.toUpperCase() ? c.mix(K.primary, K.bg, 0.5) : K.good;
    const colorOf = (b) => (b.kind === 'total' ? K.primary : b.kind === 'up' ? upCol : K.bad);
    bars.forEach((b, i) => {
      const cx = X0 + slot * (i + 0.5);
      const top = y(Math.max(b.from, b.to)), bot = y(Math.min(b.from, b.to));
      const col = colorOf(b);
      c.rect(cx - bw / 2, top, bw, Math.max(1.5, bot - top), { fill: col, rx: Math.min(2, c.style.radius) });
      // 次の棒へのつなぎ線
      if (i < bars.length - 1) {
        const nx = X0 + slot * (i + 1.5);
        c.line(cx + bw / 2, y(b.to), nx - bw / 2, y(b.to), { stroke: K.sub, sw: 1, dash: '3 3' });
      }
      const val = b.kind === 'total' ? fmt(b.to) : fmt(b.value, true);
      const ly = b.kind === 'down' ? bot + 18 : top - 8;
      c.text(cx, ly, val, { size: 15, weight: 700, fill: b.kind === 'total' ? K.strong : col, anchor: 'middle' });
      c.label(b.label, cx - slot / 2 + 4, Y1 + 10, slot - 8, H - Y1 - 16, { size: 13, weight: b.kind === 'total' ? 700 : 400, fill: K.ink, valign: 'top', min: 9 });
    });
  });

  // ---------- マリメッコ（市場規模×シェア） ----------
  // table: 列 = [区分の見出し, 規模, 社名1, 社名2, …]、行 = [区分, 規模, シェア1, シェア2, …]
  L('marimekko', (c, d) => {
    const { W, H, K } = c;
    const tb = d.table || { columns: [], rows: [] };
    const players = tb.columns.slice(2);
    const segs = tb.rows.filter((r) => r && r.length > 2).map((r) => {
      const vals = players.map((_, j) => Math.max(0, num(r[j + 2]) || 0));
      const sum = vals.reduce((a, b) => a + b, 0) || 1;
      return { label: String(r[0]), size: Math.max(0, num(r[1]) || 0), shares: vals.map((v) => v / sum) };
    });
    if (!segs.length) return;
    const legendW = 170;
    const X0 = 56, X1 = W - legendW - 20, Y0 = 40, Y1 = H - 70, gap = 3;
    const total = segs.reduce((a, s) => a + s.size, 0) || 1;
    const usable = X1 - X0 - gap * (segs.length - 1);
    unitLabel(c, d, 20, 24);
    // 縦軸の目盛り（0〜100%）
    [0, 50, 100].forEach((p) => c.text(X0 - 8, Y1 - (Y1 - Y0) * p / 100 + 4, p + '%', { size: 11, fill: K.sub, anchor: 'end' }));
    const hl = String(d.highlight || '').trim();
    const colorOf = (j) => (hl ? (players[j] === hl ? K.highlight : c.tint(c.accent(j), 0.35 + 0.12 * (j % 3))) : c.accent(j));
    let x = X0;
    segs.forEach((sg) => {
      const w = usable * sg.size / total;
      let yb = Y1;
      sg.shares.forEach((sh, j) => {
        const h = (Y1 - Y0) * sh;
        if (h <= 0) return;
        const col = colorOf(j);
        c.rect(x, yb - h, w, h, { fill: col, stroke: c.K.bg, sw: 1.5, rx: 0 });
        if (h >= 18 && w >= 38) c.label(Math.round(sh * 100) + '%', x + 2, yb - h, w - 4, h, { size: 13, fill: c.on(col), min: 9 });
        yb -= h;
      });
      c.label(sg.label, x, Y1 + 6, w, 34, { size: 13, fill: K.ink, valign: 'top', min: 8 });
      c.label(fmt(sg.size) + (d.unit || ''), x, Y1 + 40, w, 20, { size: 12, weight: 400, fill: K.sub, valign: 'top', min: 8 });
      x += w + gap;
    });
    // 凡例（積み上げ順に合わせ、上から下へ）
    const lx = W - legendW, n = players.length;
    players.slice().reverse().forEach((p, k) => {
      const j = n - 1 - k;
      const ly = Y0 + k * 28;
      c.rect(lx, ly, 16, 16, { fill: colorOf(j), rx: Math.min(3, c.style.radius) });
      c.label(p, lx + 24, ly - 4, legendW - 30, 24, { size: 14, weight: p === hl ? 700 : 400, fill: p === hl ? K.highlight : K.ink, anchor: 'start', min: 9 });
    });
  });

  // ---------- 棒・横棒・折れ線グラフ ----------
  // table: 列 = ['', 項目1, 項目2, …]、行 = [系列名, 値1, 値2, …]
  // fw.chart: 'bar' | 'hbar' | 'line'。d.highlight に項目名（線なら系列名）を入れると、そこだけ色が付く
  L('chart', (c, d, fw) => {
    const { W, H, K } = c;
    const type = (fw && fw.chart) || 'bar';
    const { cats, series } = readSeries(d);
    if (!cats.length || !series.length) return;
    const hl = String(d.highlight || '').trim();
    const all = series.flatMap((s) => s.values).filter((v) => v != null);
    const hi = Math.max(0, ...all), lo = Math.min(0, ...all);
    const span = (hi - lo) || 1;
    unitLabel(c, d, 20, 24);
    const multi = series.length > 1;
    const sColor = (i) => c.accent(i);

    // 複数系列のときの凡例（上部に横並び）
    if (multi && type !== 'line') {
      let lx = W - 20;
      series.slice().reverse().forEach((s, k) => {
        const i = series.length - 1 - k;
        const tw = c.measure(s.name, 13, 400);
        lx -= tw;
        c.text(lx, 24, s.name, { size: 13, fill: K.ink });
        lx -= 20;
        c.rect(lx, 13, 14, 14, { fill: sColor(i), rx: Math.min(3, c.style.radius) });
        lx -= 18;
      });
    }

    if (type === 'hbar') {
      const LW = 200, X0 = 20 + LW, X1 = W - 80, Y0 = 44, Y1 = H - 20;
      const slot = (Y1 - Y0) / cats.length;
      const bh = Math.min(slot * 0.62 / series.length, 40);
      const x = (v) => X0 + ((v - lo) / span) * (X1 - X0);
      c.line(x(0), Y0, x(0), Y1, { stroke: K.sub, sw: 1.5 });
      cats.forEach((cat, ci) => {
        const cy = Y0 + slot * (ci + 0.5);
        const isHl = !multi && hl && cat === hl;
        c.label(cat, 20, cy - slot / 2, LW - 14, slot, { size: 15, weight: isHl ? 700 : 400, fill: isHl ? K.highlight : K.ink, anchor: 'start', min: 9 });
        series.forEach((s, si) => {
          const v = s.values[ci];
          if (v == null) return;
          const by = cy - (bh * series.length) / 2 + si * bh;
          const col = multi ? sColor(si) : hl ? (isHl ? K.highlight : muted(c)) : c.accent(0);
          const x0 = Math.min(x(0), x(v)), w = Math.abs(x(v) - x(0));
          c.rect(x0, by + 2, Math.max(1.5, w), bh - 4, { fill: col, rx: Math.min(2, c.style.radius) });
          c.text(x(v) + (v >= 0 ? 8 : -8), by + bh / 2 + 5, fmt(v), { size: 14, weight: 700, fill: multi || !hl || isHl ? col : K.sub, anchor: v >= 0 ? 'start' : 'end' });
        });
      });
      return;
    }

    const X0 = 30, X1 = type === 'line' ? W - 140 : W - 30, Y0 = 56, Y1 = H - 52;
    const y = (v) => Y1 - ((v - lo) / span) * (Y1 - Y0);
    const slot = (X1 - X0) / cats.length;
    c.line(X0, y(0), type === 'line' ? X1 + 20 : X1, y(0), { stroke: K.sub, sw: 1.5 });
    cats.forEach((cat, ci) => {
      const isHl = !multi && hl && cat === hl;
      c.label(cat, X0 + slot * ci + 2, Y1 + 8, slot - 4, H - Y1 - 12, { size: 14, weight: isHl ? 700 : 400, fill: isHl ? K.highlight : K.ink, valign: 'top', min: 9 });
    });

    if (type === 'line') {
      const px = (ci) => X0 + slot * (ci + 0.5);
      series.forEach((s, si) => {
        const isHl = hl ? s.name === hl : true;
        const col = hl ? (isHl ? K.highlight : muted(c)) : sColor(si);
        const pts = s.values.map((v, ci) => (v == null ? null : [px(ci), y(v)])).filter(Boolean);
        if (pts.length > 1) c.polyline(pts, { stroke: col, sw: isHl ? 3 : 2 });
        pts.forEach((p) => c.circle(p[0], p[1], isHl ? 4.5 : 3.5, { fill: col }));
        // 単一系列は全点に値、複数系列は終点に値と系列名
        if (!multi) {
          s.values.forEach((v, ci) => { if (v != null) c.text(px(ci), y(v) - 12, fmt(v), { size: 14, weight: 700, fill: col, anchor: 'middle' }); });
        }
        const last = pts[pts.length - 1];
        if (last) {
          const lv = s.values.filter((v) => v != null).pop();
          c.text(last[0] + 12, last[1] + 5, `${s.name}${multi ? ' ' + fmt(lv) : ''}`, { size: 14, weight: 700, fill: col });
        }
      });
      return;
    }

    // 縦棒
    const bw = Math.min(slot * 0.66 / series.length, 90);
    cats.forEach((cat, ci) => {
      const isHl = !multi && hl && cat === hl;
      series.forEach((s, si) => {
        const v = s.values[ci];
        if (v == null) return;
        const bx = X0 + slot * (ci + 0.5) - (bw * series.length) / 2 + si * bw;
        const col = multi ? sColor(si) : hl ? (isHl ? K.highlight : muted(c)) : c.accent(0);
        const top = Math.min(y(v), y(0)), h = Math.abs(y(v) - y(0));
        c.rect(bx + 2, top, bw - 4, Math.max(1.5, h), { fill: col, rx: Math.min(2, c.style.radius) });
        c.text(bx + bw / 2, v >= 0 ? top - 8 : top + h + 18, fmt(v), { size: series.length > 2 ? 12 : 15, weight: 700, fill: multi || !hl || isHl ? col : K.sub, anchor: 'middle' });
      });
    });
  });

  // ---------- ガントチャート ----------
  // periods: 期間の見出し。plan: 1行に「タスク名, 開始, 終了」。
  //   「# 見出し」でフェーズ、「◆ 名前, 位置」でマイルストーン。開始・終了・位置は期間の番号（1〜）か見出しの文字。
  L('gantt', (c, d) => {
    const { W, H, K } = c;
    const periods = (d.periods || []).filter(Boolean);
    const P = Math.max(1, periods.length);
    const pos = (v) => {
      const t = String(v == null ? '' : v).trim();
      const i = periods.indexOf(t);
      if (i >= 0) return i + 1;
      const n = num(t);
      return n == null ? null : Math.max(1, Math.min(P, n));
    };
    const rows = [];
    let gi = -1;
    String(d.plan || '').split('\n').map((l) => l.trim()).filter(Boolean).forEach((ln) => {
      if (/^[#＃]/.test(ln)) { gi += 1; rows.push({ kind: 'group', label: ln.replace(/^[#＃]\s*/, ''), g: gi }); return; }
      const ms = /^[◆♦*＊]/.test(ln);
      const parts = ln.replace(/^[◆♦*＊]\s*/, '').split(/\s*[,，\t]\s*/);
      if (ms) rows.push({ kind: 'ms', label: parts[0], at: pos(parts[1]), g: Math.max(0, gi) });
      else rows.push({ kind: 'task', label: parts[0], s: pos(parts[1]), e: pos(parts[2] || parts[1]), g: Math.max(0, gi) });
    });
    const LW = 250, X0 = 20 + LW, X1 = W - 20, Y0 = 20, hh = 36;
    const rh = Math.min(38, (H - 20 - Y0 - hh) / Math.max(1, rows.length));
    const pw = (X1 - X0) / P;
    // 期間の見出しと縦の区切り
    c.rect(X0, Y0, X1 - X0, hh, { fill: K.primary, rx: Math.min(4, c.style.radius) });
    periods.forEach((p, i) => {
      c.label(p, X0 + i * pw + 2, Y0, pw - 4, hh, { size: 14, fill: c.on(K.primary), min: 8 });
    });
    const gridTop = Y0 + hh, gridBot = gridTop + rows.length * rh;
    for (let i = 0; i <= P; i++) c.line(X0 + i * pw, gridTop, X0 + i * pw, gridBot, { stroke: K.line, sw: 1 });
    rows.forEach((r, k) => {
      const y = gridTop + k * rh;
      const col = c.accent(r.g);
      if (r.kind === 'group') {
        c.rect(20, y + 2, X1 - 20, rh - 4, { fill: c.tint(col, 0.88), rx: Math.min(4, c.style.radius) });
        c.label(r.label, 30, y + 2, LW - 20, rh - 4, { size: 15, fill: col, anchor: 'start', min: 9 });
        return;
      }
      c.line(20, y + rh, X1, y + rh, { stroke: K.faint, sw: 1 });
      if (r.kind === 'task') {
        c.label(r.label, 40, y, LW - 30, rh, { size: 14, weight: 400, fill: K.ink, anchor: 'start', min: 8 });
        if (r.s != null && r.e != null) {
          const s = Math.min(r.s, r.e), e = Math.max(r.s, r.e);
          const bx = X0 + (s - 1) * pw + 4, bw = (e - s + 1) * pw - 8;
          c.rect(bx, y + rh * 0.24, bw, rh * 0.52, { fill: col, rx: Math.min(rh * 0.26, c.style.radius) });
        }
      } else {
        c.label(r.label, 40, y, LW - 30, rh, { size: 14, fill: K.highlight, anchor: 'start', min: 8 });
        if (r.at != null) {
          const mx = X0 + (r.at - 0.5) * pw, my = y + rh / 2, m = Math.min(10, rh * 0.3);
          c.poly([[mx, my - m], [mx + m, my], [mx, my + m], [mx - m, my]], { fill: K.highlight });
        }
      }
    });
  });
})();
