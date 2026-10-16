# フレームワーク図鑑

コンサルの資料づくりで頻出するフレームワーク図（3C、SWOT、5フォース、PPM など）を一覧で探し、
項目を書き換えるだけで 16:9 の図を作れる Web サイトです。

## できること

- **一覧で探す**：25種類のフレームワークをカテゴリ別（環境分析／戦略立案／マーケティング／組織・ビジョン／問題解決・実行）に表示。名前や用途（例：「競合」「優先順位」）で検索できます。
- **項目を入れて図を作る**：各図の右側の編集欄に見出しと箇条書きを入れると、図がその場で描き直されます。文字量に応じてフォントサイズが自動で調整されます。
- **スライドに貼る**：「PNGをコピー」でそのまま PowerPoint／Googleスライドに貼り付け。PNG（1920×1080）と SVG の保存にも対応。
- **解説つき**：使いどころ・作成のコツ・出典を図ごとに掲載。

入力内容はブラウザ（localStorage）にだけ保存され、外部には送信されません。

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

## ファイル構成

```
index.html            画面の骨組み
assets/frameworks.js  フレームワークのカタログ（名前・解説・サンプルデータ）
assets/render.js      データから SVG の図を描く描画エンジン（レイアウトごとのレンダラー）
assets/app.js         一覧・詳細・編集フォーム・書き出しの制御
assets/style.css      サイトのスタイル
```

## フレームワークを追加するには

`assets/frameworks.js` の `FRAMEWORKS` に1件追加します。既存のレイアウトで描ける図なら、データを書くだけで一覧・編集・書き出しまで動きます。

```js
{
  id: 'my-matrix',              // URL の #my-matrix になる
  name: '〇〇マトリクス',
  en: 'English Name',
  cat: 'strategy',              // CATEGORIES の id
  summary: '一覧に出る一文の説明',
  origin: '出典・由来',
  when: ['使いどころ'],
  tips: ['作成のコツ'],
  layout: 'matrix',             // 描画方法（下表）
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

## 今後のアイデア

- PowerPoint（.pptx）への書き出し（図形のまま編集できる形）
- 文章やメモを貼ると、AI が各項目に振り分けて図を下書きする機能
- 入力内容を URL で共有、JSON での保存・読み込み
- 配色テーマ（自社のスライドテンプレートの色に合わせる）
