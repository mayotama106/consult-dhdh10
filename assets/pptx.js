/*
 * PowerPoint 出力
 *
 * core.js のシーン（図形の並び）を、PowerPoint の「編集できる図形・テキストボックス」に変換する。
 * レイアウトはシーンだけを作るので、新しい図を追加してもこのファイルの変更は不要。
 *
 * 単位: シーンの 960 = スライド幅 13.333 インチ。つまり 1単位 = 1/72 インチ = 1pt。
 */
(function () {
  'use strict';

  // ライブラリは同梱版を優先し、無ければ CDN から読む（社内ネットワークや file:// でも動くように）
  const LIB_URLS = ['assets/vendor/pptxgen.bundle.js', 'https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js'];
  const SLIDE_W = 13.333, SLIDE_H = 7.5;

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = () => { s.remove(); reject(new Error('load failed: ' + src)); };
      document.head.appendChild(s);
    });
  }

  let loading;
  function loadLib() {
    if (window.PptxGenJS) return Promise.resolve();
    if (!loading) {
      loading = LIB_URLS.reduce((p, url) => p.catch(() => loadScript(url)), Promise.reject())
        .then(() => { if (!window.PptxGenJS) throw new Error('missing'); })
        .catch(() => {
          loading = null;
          throw new Error('PowerPoint書き出し用のライブラリを読み込めませんでした。ネットワーク接続を確認してください。');
        });
    }
    return loading;
  }

  const hex = (c) => String(c || '#000000').replace('#', '').toUpperCase();
  const DASH = (d) => (d ? 'dash' : undefined);

  function drawItems(pres, slide, items, tf, font) {
    const X = (x) => tf.ox + x * tf.k;
    const Y = (y) => tf.oy + y * tf.k;
    const D = (v) => v * tf.k;        // 長さ（インチ）
    const PT = (v) => v * tf.k * 72;  // 太さ・文字サイズ（pt）
    const lineOpt = (it) => (it.stroke ? { color: hex(it.stroke), width: PT(it.sw), dashType: DASH(it.dash) } : { type: 'none' });

    items.forEach((it) => {
      switch (it.t) {
        case 'rect': {
          if (it.w <= 0 || it.h <= 0) break;
          const rounded = it.rx > 0;
          slide.addShape(rounded ? pres.ShapeType.roundRect : pres.ShapeType.rect, {
            x: X(it.x), y: Y(it.y), w: D(it.w), h: D(it.h),
            fill: it.fill ? { color: hex(it.fill) } : undefined,
            line: lineOpt(it),
            rectRadius: rounded ? D(Math.min(it.rx, it.w / 2, it.h / 2)) : undefined,
          });
          break;
        }
        case 'ellipse':
          slide.addShape(pres.ShapeType.ellipse, {
            x: X(it.cx - it.rx), y: Y(it.cy - it.ry), w: D(it.rx * 2), h: D(it.ry * 2),
            fill: it.fill ? { color: hex(it.fill), transparency: Math.round((1 - it.opacity) * 100) } : undefined,
            line: lineOpt(it),
          });
          break;
        case 'poly': {
          const xs = it.pts.map((p) => p[0]), ys = it.pts.map((p) => p[1]);
          const minX = Math.min(...xs), minY = Math.min(...ys);
          const w = Math.max(...xs) - minX, h = Math.max(...ys) - minY;
          const points = it.pts.map((p) => ({ x: D(p[0] - minX), y: D(p[1] - minY) }));
          if (it.closed) points.push({ close: true });
          slide.addShape(pres.ShapeType.custGeom, {
            x: X(minX), y: Y(minY), w: Math.max(D(w), 0.001), h: Math.max(D(h), 0.001), points,
            fill: it.fill ? { color: hex(it.fill) } : undefined,
            line: lineOpt(it),
          });
          break;
        }
        case 'line':
        case 'arrow': {
          const dx = it.x2 - it.x1, dy = it.y2 - it.y1;
          const ln = lineOpt(it);
          if (it.t === 'arrow') {
            ln.endArrowType = 'triangle';
            if (it.both) ln.beginArrowType = 'triangle';
          }
          slide.addShape(pres.ShapeType.line, {
            x: X(Math.min(it.x1, it.x2)), y: Y(Math.min(it.y1, it.y2)), w: D(Math.abs(dx)), h: D(Math.abs(dy)),
            flipH: dx < 0, flipV: dy < 0, line: ln,
          });
          break;
        }
        case 'text': {
          const w = window.Diagram.measure(it.str, it.size, it.weight) + it.size;
          const x = it.anchor === 'middle' ? it.x - w / 2 : it.anchor === 'end' ? it.x - w : it.x;
          slide.addText(it.str, {
            x: X(x), y: Y(it.y - it.size * 1.05), w: D(w), h: D(it.size * 1.4),
            fontFace: font, fontSize: PT(it.size), bold: it.weight >= 700, color: hex(it.fill),
            align: it.anchor === 'middle' ? 'center' : it.anchor === 'end' ? 'right' : 'left', valign: 'middle',
            margin: 0, wrap: false,
          });
          break;
        }
        case 'tb': {
          if (!it.paras.length) break;
          const size = PT(it.size);
          const runs = it.paras.map((p, i) => ({
            text: p,
            options: {
              bullet: it.bullet ? { characterCode: it.bullet === 'square' ? '25AA' : it.bullet === 'dash' ? '2013' : '2022', indent: PT(it.ind) } : false,
              breakLine: i < it.paras.length - 1,
            },
          }));
          // PowerPoint 側の文字幅の差で折り返しが増えないよう、幅に少し余裕を持たせる
          const slack = it.align === 'center' ? it.size * 0.6 : it.size * 0.5;
          slide.addText(runs, {
            x: X(it.align === 'center' ? it.x - slack / 2 : it.x), y: Y(it.y), w: D(it.w + slack), h: D(it.h),
            fontFace: font, fontSize: size, bold: it.weight >= 700, color: hex(it.fill),
            align: it.align, valign: it.valign, margin: 0, wrap: true,
            lineSpacing: PT(it.size * it.lh), paraSpaceAfter: it.gap ? PT(it.size * it.gap) : 0,
          });
          break;
        }
        case 'group':
          drawItems(pres, slide, it.scene.items, { ox: X(it.x), oy: Y(it.y), k: tf.k * it.scale }, font);
          break;
      }
    });
  }

  // scenes: シーンの配列（1枚 = 1スライド）
  async function toPptx(scenes, fileName, meta) {
    await loadLib();
    const pres = new window.PptxGenJS();
    pres.layout = 'LAYOUT_WIDE';
    pres.title = (meta && meta.title) || fileName;
    scenes.forEach((scene) => {
      const slide = pres.addSlide();
      slide.background = { color: hex(scene.bg) };
      // 図だけを出すときなど、縦長のシーンはスライドに収まるよう縮小して中央に置く
      const k = Math.min(SLIDE_W / scene.w, SLIDE_H / scene.h);
      const tf = { ox: (SLIDE_W - scene.w * k) / 2, oy: (SLIDE_H - scene.h * k) / 2, k };
      drawItems(pres, slide, scene.items, tf, scene.font || 'BIZ UDPGothic');
    });
    await pres.writeFile({ fileName: fileName.endsWith('.pptx') ? fileName : fileName + '.pptx' });
  }

  window.Diagram.toPptx = toPptx;
})();
