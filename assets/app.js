/*
 * 画面の制御：一覧（ギャラリー）と詳細（編集・書き出し）
 * URL のハッシュ（#swot など）で画面を切り替える。
 */
(function () {
  'use strict';

  const FWS = window.FRAMEWORKS;
  const CATS = window.CATEGORIES;
  const THEMES = window.THEMES;
  const D = window.Diagram;
  const catName = (id) => (CATS.find((c) => c.id === id) || {}).name || '';
  const $ = (id) => document.getElementById(id);
  const STORE = 'fw-zukan:';
  const PNG_SCALE = 2;
  const SAMPLE_NOTE = '※ サンプルは架空の事例です';

  // 要素数を増減できるレイアウト [最小, 最大]
  const VARIABLE = { columns: [2, 6], flow: [2, 5], stack: [2, 6], cycle: [3, 6] };

  const SECTION_LABELS = {
    sections: '要素',
    support: '支援活動',
    colHeaders: '列見出し（外部環境）',
    rowHeaders: '行見出し（内部環境）',
    cells: '掛け合わせた戦略',
  };

  const clone = (o) => JSON.parse(JSON.stringify(o));

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(STORE + key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch (e) { return fallback; }
  }
  function write(key, value) {
    try { localStorage.setItem(STORE + key, JSON.stringify(value)); } catch (e) { /* 保存できない環境では何もしない */ }
  }
  function remove(key) {
    try { localStorage.removeItem(STORE + key); } catch (e) { /* noop */ }
  }

  const state = {
    cat: 'all',
    q: '',
    theme: read('theme', THEMES[0].id),
    view: read('view', 'slide'), // 'slide' | 'figure'
  };
  if (!THEMES.some((t) => t.id === state.theme)) state.theme = THEMES[0].id;

  // ---------- トースト ----------
  let toastTimer;
  function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 3200);
  }

  // ---------- デザインパターンの選択（全画面共通） ----------
  function buildThemePickers() {
    document.querySelectorAll('[data-theme-picker]').forEach((box) => {
      box.innerHTML = '';
      THEMES.forEach((t) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'theme-opt';
        b.setAttribute('aria-pressed', String(t.id === state.theme));
        b.title = t.note;
        const sw = document.createElement('span');
        sw.className = 'theme-sw';
        sw.style.background = t.colors.bg;
        sw.style.borderColor = t.colors.line;
        sw.style.borderRadius = Math.min(t.style.radius, 6) + 'px';
        [t.colors.primary].concat(t.colors.accents.slice(0, 3)).forEach((c) => {
          const i = document.createElement('i');
          i.style.background = c;
          sw.appendChild(i);
        });
        b.appendChild(sw);
        const name = document.createElement('span');
        name.textContent = t.name;
        b.appendChild(name);
        b.addEventListener('click', () => setTheme(t.id));
        box.appendChild(b);
      });
    });
  }

  function setTheme(id) {
    if (id === state.theme) return;
    state.theme = id;
    write('theme', id);
    for (const k in thumbs) delete thumbs[k];
    buildThemePickers();
    if (cur) renderStage(); else buildGallery();
    toast(`デザインを「${D.themeById(id).name}」にしました。すべての図に反映されます。`);
  }

  // ---------- 一覧 ----------
  const thumbs = {};

  function buildChips() {
    const chips = $('chips');
    chips.innerHTML = '';
    const all = [{ id: 'all', name: 'すべて', n: FWS.length }].concat(
      CATS.map((c) => ({ id: c.id, name: c.name, n: FWS.filter((f) => f.cat === c.id).length }))
    );
    all.forEach((c) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', String(state.cat === c.id));
      b.innerHTML = `${c.name}<span>${c.n}</span>`;
      b.addEventListener('click', () => { state.cat = c.id; buildChips(); buildGallery(); });
      chips.appendChild(b);
    });
  }

  function matches(f) {
    if (state.cat !== 'all' && f.cat !== state.cat) return false;
    const q = state.q.trim().toLowerCase();
    if (!q) return true;
    const hay = [f.name, f.en, f.summary, catName(f.cat)].concat(f.when, f.tips).join(' ').toLowerCase();
    return q.split(/\s+/).every((w) => hay.includes(w));
  }

  function thumb(f) {
    if (!thumbs[f.id]) thumbs[f.id] = D.toSVG(D.render(f, f.data, { theme: state.theme }));
    return thumbs[f.id].cloneNode(true);
  }

  function buildGallery() {
    const g = $('gallery');
    g.innerHTML = '';
    let count = 0;
    CATS.forEach((c) => {
      const items = FWS.filter((f) => f.cat === c.id && matches(f));
      if (!items.length) return;
      count += items.length;
      const sec = document.createElement('section');
      sec.className = 'group';
      sec.innerHTML = `<h2 class="group-title">${c.name}<span>${items.length}</span></h2>`;
      const grid = document.createElement('div');
      grid.className = 'grid';
      items.forEach((f) => {
        const a = document.createElement('a');
        a.className = 'fw-card';
        a.href = '#' + f.id;
        const th = document.createElement('div');
        th.className = 'thumb';
        th.appendChild(thumb(f));
        a.appendChild(th);
        const meta = document.createElement('div');
        meta.className = 'meta';
        meta.innerHTML = `
          <h3>${f.name}${read('data:' + f.id, null) ? '<span class="edited">編集あり</span>' : ''}</h3>
          <p class="en">${f.en}</p>
          <p class="sum">${f.summary}</p>`;
        a.appendChild(meta);
        grid.appendChild(a);
      });
      sec.appendChild(grid);
      g.appendChild(sec);
    });
    $('empty').hidden = count > 0;
  }

  // ---------- 詳細 ----------
  let cur = null; // { fw, data }
  let renderTimer;

  function defaults(fw) {
    const d = clone(fw.data);
    d.slide = { title: fw.name, message: fw.message || '', note: SAMPLE_NOTE };
    return d;
  }

  function showDetail(fw) {
    const saved = read('data:' + fw.id, null);
    const data = saved || defaults(fw);
    if (!data.slide) data.slide = defaults(fw).slide;
    cur = { fw, data };
    $('gallery-view').hidden = true;
    $('detail-view').hidden = false;
    $('d-cat').textContent = catName(fw.cat);
    $('d-name').textContent = fw.name;
    $('d-en').textContent = fw.en;
    $('d-summary').textContent = fw.summary;
    $('d-origin').textContent = fw.origin;
    fillList($('d-when'), fw.when);
    fillList($('d-tips'), fw.tips);
    document.title = fw.name + '｜フレームワーク図鑑';
    syncViewTabs();
    buildEditor();
    renderStage();
    window.scrollTo(0, 0);
  }

  function fillList(ul, arr) {
    ul.innerHTML = '';
    arr.forEach((t) => { const li = document.createElement('li'); li.textContent = t; ul.appendChild(li); });
  }

  function currentScene() {
    const opts = { theme: state.theme };
    return state.view === 'slide'
      ? D.slide(cur.fw, cur.data, cur.data.slide, opts)
      : D.render(cur.fw, cur.data, opts);
  }

  function renderStage() {
    const stage = $('stage');
    stage.innerHTML = '';
    const svg = D.toSVG(currentScene());
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', cur.fw.name + (state.view === 'slide' ? 'のスライド' : 'の図'));
    stage.appendChild(svg);
    const vb = svg.viewBox.baseVal;
    $('ratio').textContent = `${vb.height === D.BASE_H ? '16:9' : '縦長'}・PNG ${vb.width * PNG_SCALE}×${vb.height * PNG_SCALE}px`;
  }

  function changed() {
    write('data:' + cur.fw.id, cur.data);
    clearTimeout(renderTimer);
    renderTimer = setTimeout(renderStage, 80);
  }

  function syncViewTabs() {
    document.querySelectorAll('[data-view]').forEach((b) => {
      b.setAttribute('aria-selected', String(b.dataset.view === state.view));
    });
    const sf = $('slide-fields');
    if (sf) sf.hidden = state.view !== 'slide';
  }

  // ---------- エディタ ----------
  function el(tag, cls, html) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }

  function field(labelText, id, control) {
    const w = el('div', 'field');
    const l = el('label');
    l.htmlFor = id;
    l.textContent = labelText;
    control.id = id;
    w.appendChild(l);
    w.appendChild(control);
    return w;
  }

  function input(value, onInput) {
    const i = document.createElement('input');
    i.type = 'text';
    i.value = value == null ? '' : value;
    i.addEventListener('input', () => { onInput(i.value); changed(); });
    return i;
  }

  function textarea(value, rows, onInput) {
    const t = document.createElement('textarea');
    t.rows = rows;
    t.value = value;
    t.addEventListener('input', () => { onInput(t.value); changed(); });
    return t;
  }

  const splitLines = (v) => v.split('\n').map((s) => s.trim()).filter(Boolean);
  const splitCells = (v) => v.split(/\s*[,，\t]\s*/).map((s) => s.trim());

  function group(title, hint) {
    const g = el('fieldset', 'ed-group');
    g.appendChild(el('legend', null, title));
    if (hint) g.appendChild(el('p', 'hint', hint));
    return g;
  }

  function buildEditor() {
    const form = $('ed-form');
    form.innerHTML = '';
    const { fw, data } = cur;

    // スライドの文言
    const sl = data.slide;
    const sg = group('スライドの文言', 'タイトルの下に入るキーメッセージは、そのスライドで一番言いたいことを1文で。');
    sg.id = 'slide-fields';
    sg.appendChild(field('タイトル', 'sl-title', input(sl.title, (v) => { sl.title = v; })));
    sg.appendChild(field('キーメッセージ', 'sl-msg', textarea(sl.message, 2, (v) => { sl.message = v; })));
    sg.appendChild(field('出典・注記（左下）', 'sl-note', input(sl.note, (v) => { sl.note = v; })));
    sg.hidden = state.view !== 'slide';
    form.appendChild(sg);

    if (data.axes) {
      const scatter = fw.layout === 'scatter';
      const g = group('軸ラベル');
      const ax = data.axes;
      ax.xTicks = ax.xTicks || ['', ''];
      ax.yTicks = ax.yTicks || ['', ''];
      const row = el('div', 'two');
      if (!scatter) {
        row.appendChild(field('列の軸名', 'ax-x', input(ax.x, (v) => { ax.x = v; })));
        row.appendChild(field('行の軸名', 'ax-y', input(ax.y, (v) => { ax.y = v; })));
      }
      row.appendChild(field(scatter ? '横軸・左端' : '左の列', 'ax-x0', input(ax.xTicks[0], (v) => { ax.xTicks[0] = v; })));
      row.appendChild(field(scatter ? '横軸・右端' : '右の列', 'ax-x1', input(ax.xTicks[1], (v) => { ax.xTicks[1] = v; })));
      row.appendChild(field(scatter ? '縦軸・上端' : '上の行', 'ax-y0', input(ax.yTicks[0], (v) => { ax.yTicks[0] = v; })));
      row.appendChild(field(scatter ? '縦軸・下端' : '下の行', 'ax-y1', input(ax.yTicks[1], (v) => { ax.yTicks[1] = v; })));
      g.appendChild(row);
      form.appendChild(g);
    }

    if ('center' in data) {
      const g = group('中央のラベル');
      g.appendChild(field('ラベル', 'center', input(data.center, (v) => { data.center = v; })));
      form.appendChild(g);
    }
    if ('margin' in data) {
      const g = group('右端の表記');
      g.appendChild(field('ラベル', 'margin', input(data.margin, (v) => { data.margin = v; })));
      form.appendChild(g);
    }

    if ('points' in data) {
      const g = group('プロットする企業・商品', '1行に「名前, 横の値, 縦の値」。値は -5〜5。名前の先頭に * を付けると強調表示になります。4つ目の値（1〜5）で円の大きさも変えられます。');
      const v = data.points.map((p) => [p.label, p.x, p.y].concat(p.size ? [p.size] : []).join(', ')).join('\n');
      g.appendChild(field('データ', 'points', textarea(v, 8, (val) => {
        data.points = splitLines(val).map((ln) => {
          const [label, x, y, size] = splitCells(ln);
          return { label, x: parseFloat(x) || 0, y: parseFloat(y) || 0, size: size ? parseFloat(size) : undefined };
        });
      })));
      form.appendChild(g);
    }

    if ('tree' in data) {
      const g = group('ツリーの内容', fw.editorHint);
      const t = textarea(data.tree, 14, (v) => { data.tree = v; });
      t.classList.add('mono');
      t.addEventListener('keydown', (e) => {
        if (e.key !== 'Tab') return;
        e.preventDefault();
        t.setRangeText('  ', t.selectionStart, t.selectionEnd, 'end');
        t.dispatchEvent(new Event('input'));
      });
      g.appendChild(field('項目（インデントで階層）', 'tree', t));
      form.appendChild(g);
    }

    if ('table' in data) {
      const tb = data.table;
      const journey = fw.layout === 'journey';
      const g = group(journey ? 'ステージと行' : '表の内容',
        journey
          ? '1行目はステージ名をカンマ区切りで。下の欄は1行に「行名, ステージ1, ステージ2, …」。セル内を「／」で区切ると箇条書きになります。'
          : '列見出しはカンマ区切り。下の欄は1行に1行分をカンマ区切りで。○・×・△は色付きの記号になります。');
      const cols = journey ? tb.columns.slice(1) : tb.columns;
      g.appendChild(field(journey ? 'ステージ' : '列見出し', 'tb-cols', input(cols.join(', '), (v) => {
        const c = splitCells(v);
        tb.columns = journey ? [''].concat(c) : c;
      })));
      g.appendChild(field('行', 'tb-rows', textarea(tb.rows.map((r) => r.join(', ')).join('\n'), 8, (v) => {
        tb.rows = splitLines(v).map(splitCells);
      })));
      form.appendChild(g);
    }

    ['colHeaders', 'rowHeaders', 'cells', 'support', 'sections'].forEach((key) => {
      if (!Array.isArray(data[key])) return;
      const label = key === 'sections' && fw.layout === 'chain' ? '主活動' : SECTION_LABELS[key];
      form.appendChild(sectionGroup(key, label));
    });
  }

  function sectionGroup(key, label) {
    const { fw, data } = cur;
    const arr = data[key];
    const range = key === 'sections' ? VARIABLE[fw.layout] : null;
    const g = group(label, '見出しと、1行に1項目ずつ箇条書きを入力します。');
    arr.forEach((sec, i) => {
      const box = el('div', 'sec');
      const head = el('div', 'sec-head');
      head.appendChild(el('span', 'sec-no', String(i + 1)));
      const ti = input(sec.title, (v) => { sec.title = v; });
      ti.id = `${key}-${i}-title`;
      ti.setAttribute('aria-label', `${label} ${i + 1} の見出し`);
      head.appendChild(ti);
      if (range && arr.length > range[0]) {
        const rm = el('button', 'icon-btn', '×');
        rm.type = 'button';
        rm.title = 'この要素を削除';
        rm.setAttribute('aria-label', `${label} ${i + 1} を削除`);
        rm.addEventListener('click', () => { arr.splice(i, 1); changed(); buildEditor(); });
        head.appendChild(rm);
      }
      box.appendChild(head);
      const ta = textarea((sec.items || []).join('\n'), Math.max(2, Math.min(6, (sec.items || []).length + 1)), (v) => {
        sec.items = v.split('\n').filter((s) => s.trim() !== '');
      });
      ta.id = `${key}-${i}-items`;
      ta.setAttribute('aria-label', `${label} ${i + 1} の項目`);
      ta.placeholder = '1行に1項目';
      box.appendChild(ta);
      g.appendChild(box);
    });
    if (range && arr.length < range[1]) {
      const add = el('button', 'btn small add', '＋ 要素を追加');
      add.type = 'button';
      add.addEventListener('click', () => {
        arr.push({ title: '新しい要素', items: ['項目'] });
        changed();
        buildEditor();
      });
      g.appendChild(add);
    }
    return g;
  }

  // ---------- 書き出し ----------
  function currentSvg() { return $('stage').querySelector('svg'); }
  function fileBase() { return cur.fw.name + (state.view === 'slide' ? '_スライド' : ''); }

  function pngBlob(svg) {
    return new Promise((resolve, reject) => {
      const vb = svg.viewBox.baseVal;
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = vb.width * PNG_SCALE;
        c.height = vb.height * PNG_SCALE;
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        c.toBlob((b) => (b ? resolve(b) : reject(new Error('PNGを作成できませんでした'))), 'image/png');
      };
      img.onerror = () => reject(new Error('画像の読み込みに失敗しました'));
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(svg));
    });
  }

  function download(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function bindToolbar() {
    document.querySelectorAll('[data-view]').forEach((b) => {
      b.addEventListener('click', () => {
        state.view = b.dataset.view;
        write('view', state.view);
        syncViewTabs();
        renderStage();
      });
    });

    const pptBtn = $('btn-pptx');
    pptBtn.addEventListener('click', () => {
      if (!D.toPptx) return;
      pptBtn.disabled = true;
      const label = pptBtn.textContent;
      pptBtn.textContent = '書き出し中…';
      D.toPptx([currentScene()], fileBase(), { title: cur.data.slide.title || cur.fw.name }).then(
        () => toast('PowerPointファイルを保存しました。図形のまま編集できます。'),
        (e) => toast(e.message || 'PowerPointに書き出せませんでした。')
      ).finally(() => { pptBtn.disabled = false; pptBtn.textContent = label; });
    });

    $('btn-copy').addEventListener('click', () => {
      const svg = currentSvg();
      if (!svg) return;
      try {
        const item = new ClipboardItem({ 'image/png': pngBlob(svg) });
        navigator.clipboard.write([item]).then(
          () => toast('PNG画像をコピーしました。スライドに貼り付けできます。'),
          () => toast('この環境ではコピーできませんでした。「PNG保存」をお使いください。')
        );
      } catch (e) {
        toast('この環境ではコピーできませんでした。「PNG保存」をお使いください。');
      }
    });
    $('btn-png').addEventListener('click', () => {
      const svg = currentSvg();
      if (!svg) return;
      pngBlob(svg).then((b) => { download(b, fileBase() + '.png'); toast('PNGを保存しました。'); }, (e) => toast(e.message));
    });
    $('btn-svg').addEventListener('click', () => {
      const svg = currentSvg();
      if (!svg) return;
      const text = '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(svg);
      download(new Blob([text], { type: 'image/svg+xml' }), fileBase() + '.svg');
      toast('SVGを保存しました。');
    });

    // confirm() が使えない環境もあるため、2回押しで確定する
    let armed = false, armTimer;
    const reset = $('btn-reset');
    function disarm() {
      armed = false;
      clearTimeout(armTimer);
      reset.textContent = 'サンプルに戻す';
      reset.classList.remove('warn');
    }
    reset.addEventListener('click', () => {
      if (!armed) {
        armed = true;
        reset.textContent = 'もう一度押すと戻します';
        reset.classList.add('warn');
        armTimer = setTimeout(disarm, 3000);
        return;
      }
      disarm();
      remove('data:' + cur.fw.id);
      cur.data = defaults(cur.fw);
      buildEditor();
      renderStage();
      toast('サンプルの内容に戻しました。');
    });
  }

  // ---------- ルーティング ----------
  function route() {
    const id = decodeURIComponent(location.hash.replace(/^#/, ''));
    const fw = FWS.find((f) => f.id === id);
    if (fw) {
      showDetail(fw);
    } else {
      cur = null;
      $('detail-view').hidden = true;
      $('gallery-view').hidden = false;
      document.title = 'フレームワーク図鑑';
      buildGallery();
    }
  }

  // 旧バージョンの保存データ（キー名が違う）を引き継ぐ
  function migrate() {
    FWS.forEach((f) => {
      const old = read(f.id, null);
      if (old && !read('data:' + f.id, null)) { write('data:' + f.id, old); remove(f.id); }
    });
  }

  function init() {
    migrate();
    $('head-count').textContent = `${FWS.length}種類のフレームワーク`;
    $('q').addEventListener('input', (e) => { state.q = e.target.value; buildGallery(); });
    buildChips();
    buildThemePickers();
    bindToolbar();
    window.addEventListener('hashchange', route);
    route();
    // Webフォントの読み込み後に文字幅を測り直して描き直す
    if (document.fonts && document.fonts.load) {
      Promise.all([
        document.fonts.load('400 16px "BIZ UDPGothic"'),
        document.fonts.load('700 16px "BIZ UDPGothic"'),
      ]).then(() => {
        for (const k in thumbs) delete thumbs[k];
        if (cur) renderStage(); else buildGallery();
      }, () => {});
    }
  }

  init();
})();
