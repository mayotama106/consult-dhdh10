# フレームワーク図鑑

コンサルの資料づくりで頻出するフレームワーク図（3C、SWOT、5フォース、PPM など）を一覧で探し、
項目を書き換えるだけで 16:9 の図を作れる Web サイトです。

## できること

- **一覧で探す**：25種類のフレームワークをカテゴリ別（環境分析／戦略立案／マーケティング／組織・ビジョン／問題解決・実行）に表示。名前や用途（例：「競合」「優先順位」）で検索できます。
- **項目を入れて図を作る**：各図の右側の編集欄に見出しと箇条書きを入れると、図がその場で描き直されます。文字量に応じてフォントサイズが自動で調整されます。
- **スライドにする**：「スライド」表示では、タイトル・キーメッセージ・出典／注記の入った 16:9 のスライドになります。「図のみ」に切り替えると図だけを出せます。
- **PowerPoint に書き出す**：「PowerPointで保存」で .pptx を保存。画像ではなく図形・テキストボックスとして出力されるので、PowerPoint 上で文字や色をそのまま直せます。
- **デザインパターンを選ぶ**：スタンダード／モノトーン／アウトライン／ビビッド／ダークの5種類。選んだデザインはすべての図・スライドに共通で反映されます。
- **画像でも使う**：「PNGをコピー」でそのまま貼り付け。PNG（1920×1080）と SVG の保存にも対応。
- **解説つき**：使いどころ・作成のコツ・出典を図ごとに掲載。

入力内容とデザインの選択はブラウザ（localStorage）にだけ保存され、外部には送信されません。

## 使い方

ビルド不要の静的サイトです。

- ローカル：`index.html` をブラウザで開くだけで動きます。
- 公開：GitHub の Settings → Pages で `main` ブランチの `/ (root)` を指定すると GitHub Pages で公開できます。

## 収録フレームワーク

| カテゴリ | フレームワーク |
| --- | --- |
| 環境分析 | 3C分析、SWOT分析、PEST分析、5フォース分析、バリューチェーン、VRIO分析 |
| 戦略立案 | クロスSWOT、アンゾフの成長マトリクス、PPM、STP分析、ポジショニングマップ、ビジネスモデルキャンバス |
| マーケティング | 4P分析、4C分析、AIDMA、カスタマージャーニーマップ |
| 組織・ビジョン | 7Sフレームワーク、戦略ピラミッド |
| 問題解決・実行 | ロジックツリー、ピラミッドストラクチャー、空・雨・傘、As-Is / To-Be、緊急度×重要度マトリクス、ペイオフマトリクス、PDCAサイクル |

## しくみ

図は「データ → シーン → 出力」の3段で作られます。

```
frameworks.js（図の中身）
        │
        ▼
layouts.js（形）＋ themes.js（デザイン）
        │  core.js が図形の並び＝「シーン」を組み立てる
        ▼
  ┌─────────────┬──────────────────┐
  toSVG()       toPptx()
  画面・PNG・SVG   PowerPoint（編集できる図形）
```

- レイアウトは色を直接持たず、テーマの色（`c.K` / `c.accent(i)`）だけで描きます。
- レイアウトは出力先を知らず、四角・文字・線などの「シーン」だけを作ります。

このため、**図を1つ追加すれば、5種類すべてのデザイン・スライド表示・PowerPoint／PNG／SVG 出力に自動で対応**し、**デザインを1つ追加すれば、既存・今後のすべての図に適用**されます。

## ファイル構成

```
index.html              画面の骨組み
assets/frameworks.js    フレームワークのカタログ（名前・解説・サンプルデータ・キーメッセージ）
assets/themes.js        デザインパターン（色・角丸・見出しの描き方・箇条書き記号など）
assets/core.js          描画の土台（シーン、文字の自動縮小、テーマ適用、スライド組版、SVG 出力）
assets/layouts.js       図の形（レイアウト）。Diagram.layout() で登録
assets/pptx.js          シーン → PowerPoint 図形への変換
assets/app.js           一覧・詳細・編集フォーム・書き出しの制御
assets/style.css        サイトのスタイル
assets/vendor/          PowerPoint 出力ライブラリ（PptxGenJS 3.12.0, MIT）。書き出し時だけ読み込む
```

## フレームワーク（図）を追加するには

### 既存の形で描ける場合

`assets/frameworks.js` の `FRAMEWORKS` に1件追加するだけです。一覧・編集・スライド・全デザイン・各種書き出しまで動きます。

```js
{
  id: 'my-matrix',              // URL の #my-matrix になる
  name: '〇〇マトリクス',
  en: 'English Name',
  cat: 'strategy',              // CATEGORIES の id
  summary: '一覧に出る一文の説明',
  message: 'スライドのキーメッセージ（サンプル）',
  origin: '出典・由来',
  when: ['使いどころ'],
  tips: ['作成のコツ'],
  layout: 'matrix',             // 描画方法（下表）
  colors: [0, 2, 1, 3],         // 任意。要素ごとの色＝テーマの accents の番号（'primary' で主色）
  data: { sections: [{ title: '見出し', items: ['箇条書き'] }, /* … */] },
}
```

| layout | 形 | 主なデータ |
| --- | --- | --- |
| `matrix` | 2×2 マトリクス（軸ラベル任意） | `sections`×4、`axes` |
| `venn3` | 3つの円＋説明 | `sections`×3、`center` |
| `forces` | 中央＋上下左右 | `sections`×5 |
| `sevenS` | 中央＋6つの円 | `sections`×7 |
| `columns` | 横並びの列 | `sections`（2〜6） |
| `flow` | シェブロンのプロセス | `sections`（2〜5） |
| `gap` | 現状 → 施策 → あるべき姿 | `sections`×3 |
| `chain` | バリューチェーン | `support`、`sections`、`margin` |
| `tree` | ツリー（`orientation: 'vertical'` で縦） | `tree`（インデント付きテキスト） |
| `stack` | ファネル（`shape: 'pyramid'` でピラミッド） | `sections`（2〜6） |
| `cycle` | サイクル | `sections`（3〜6）、`center` |
| `scatter` | ポジショニングマップ | `points`、`axes` |
| `table` | 表（○×△は色付き記号） | `table` |
| `grid` | 見出し付き 2×2（クロスSWOT） | `colHeaders`、`rowHeaders`、`cells` |
| `bmc` | ビジネスモデルキャンバス | `sections`×9 |
| `journey` | カスタマージャーニー | `table` |

編集フォームはデータのキー（`sections` / `axes` / `center` / `tree` / `points` / `table` など）から自動で作られます。

### 新しい形が必要な場合

`assets/layouts.js` に `Diagram.layout('名前', (c, d, fw) => { ... })` を追加します。

```js
Diagram.layout('timeline', (c, d) => {
  const { W, H, K } = c;                       // 描画領域とテーマの色
  const n = d.sections.length, w = (W - 40) / n;
  c.line(20, H / 2, W - 20, H / 2, { stroke: K.line, sw: 2 });
  d.sections.forEach((sec, i) => {
    c.card(20 + i * w, 40, w - 12, H - 80, sec, c.accent(i));  // 見出し＋箇条書きの箱
  });
});
```

守るのは2点だけです。

1. **色はテーマから取る**（`c.K.ink` / `c.K.primary` / `c.accent(i)` / `c.tint()` / `c.on()`）。`#1F5FA8` のような直書きをしない。
2. **位置は `c.W` / `c.H` から計算する**。スライドに載せると高さが変わるため（幅は常に 960）。

使える道具：`c.rect` `c.circle` `c.poly` `c.polyline` `c.line` `c.arrow` `c.arrowHead` `c.text` `c.label`（枠に収まる見出し）`c.list`（枠に収まる箇条書き）`c.card`（テーマに沿った見出し付きの箱）`c.chevron`。

## デザインパターンを追加するには

`assets/themes.js` の `THEMES` に1件追加します。各項目の意味はファイル先頭のコメントにあります。

```js
{
  id: 'forest',
  name: 'フォレスト',
  note: '緑を基調にした落ち着いた配色',
  colors: {
    bg: '#FFFFFF', surface: '#FFFFFF', ink: '#1E2A22', sub: '#5B6B60', line: '#CBD5CE', faint: '#F2F6F3',
    primary: '#1F4D3A', strong: '#1F4D3A',
    accents: ['#2E7D5B', '#3B6EA5', '#B7791F', '#A94442', '#6B5BA8', '#5F7A6B'],
    highlight: '#B7791F', good: '#2E7D5B', bad: '#A94442', warn: '#B7791F',
  },
  style: { radius: 4, header: 'filled', headerAlign: 'center', bodyTint: 0.92, bullet: 'dot', slideHeader: 'rule', pptFont: 'BIZ UDPGothic' },
},
```

自社のスライドテンプレートの色を `primary` と `accents` に入れれば、全ての図を自社カラーで出せます。

## 今後のアイデア

- 複数の図をまとめて1つの PowerPoint（デッキ）として書き出す
- 文章やメモを貼ると、AI が各項目に振り分けて図を下書きする機能
- 入力内容を URL で共有、JSON での保存・読み込み
- デザインパターンを画面上で作って保存する機能
