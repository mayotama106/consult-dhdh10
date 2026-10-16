/*
 * デザインパターン（テーマ）
 *
 * すべての図・スライドはここで定義した色と形のルールで描かれる。
 * 図のレンダラーは色を直接持たず、下のトークンだけを参照するので、
 * テーマを1件追加すれば全ての図（今後増える図も含む）に適用される。
 *
 * colors
 *   bg        背景            surface  箱の地（アウトライン時など）
 *   ink       本文の文字      sub      補足の文字・矢印
 *   line      罫線            faint    淡い面（軸ラベルの地など）
 *   primary   主色（中心要素・表の見出しなど）
 *   strong    強調文字（主色を文字に使うときの色）
 *   accents   要素ごとの色（6色）。図の i 番目の要素は accents[i]
 *   highlight ポジショニングマップの自社など、1点だけ目立たせる色
 *   good / bad / warn   ○ × △ の記号の色
 * style
 *   radius       角丸の半径（0 で角ばった箱）
 *   header       箱の見出しの描き方  'filled' 塗り帯 / 'outline' 線囲み / 'bar' 上辺の太線
 *   headerAlign  見出しの揃え 'center' | 'left'
 *   bodyTint     塗り帯のときの本文の地の淡さ（0〜1、1 に近いほど背景色に近い）
 *   bullet       箇条書きの記号 'dot' | 'square' | 'dash'
 *   slideHeader  スライドのタイトル部分 'rule' 下線 / 'band' 塗り帯 / 'plain' なし
 *   pptFont      PowerPoint に書き出すときのフォント名
 */
window.THEMES = [
  {
    id: 'standard',
    name: 'スタンダード',
    note: '紺を基調にした定番の配色',
    colors: {
      bg: '#FFFFFF', surface: '#FFFFFF', ink: '#1B2433', sub: '#56657A', line: '#C8D1DD', faint: '#F2F5F9',
      primary: '#1E3A5F', strong: '#1E3A5F',
      accents: ['#1F5FA8', '#23857B', '#B9651E', '#A8455A', '#5E52A0', '#4F6B88'],
      highlight: '#B9651E', good: '#23857B', bad: '#A8455A', warn: '#B9651E',
    },
    style: { radius: 6, header: 'filled', headerAlign: 'center', bodyTint: 0.92, bullet: 'dot', slideHeader: 'rule', pptFont: 'BIZ UDPGothic' },
  },
  {
    id: 'mono',
    name: 'モノトーン',
    note: '白黒に赤を1色だけ。印刷しても崩れない',
    colors: {
      bg: '#FFFFFF', surface: '#FFFFFF', ink: '#141414', sub: '#5A5A5A', line: '#BDBDBD', faint: '#F1F1F1',
      primary: '#1A1A1A', strong: '#1A1A1A',
      accents: ['#262626', '#4A4A4A', '#6B6B6B', '#8A8A8A', '#383838', '#5C5C5C'],
      highlight: '#C8102E', good: '#1A1A1A', bad: '#C8102E', warn: '#6B6B6B',
    },
    style: { radius: 0, header: 'bar', headerAlign: 'left', bodyTint: 0.94, bullet: 'square', slideHeader: 'rule', pptFont: 'BIZ UDPGothic' },
  },
  {
    id: 'outline',
    name: 'アウトライン',
    note: '線で囲むだけの軽い見た目。文字の多い図に',
    colors: {
      bg: '#FFFFFF', surface: '#FFFFFF', ink: '#1F2A37', sub: '#5B6878', line: '#CBD3DC', faint: '#F4F7F9',
      primary: '#0F4C5C', strong: '#0F4C5C',
      accents: ['#0F766E', '#2563EB', '#C2410C', '#BE185D', '#7C3AED', '#475569'],
      highlight: '#C2410C', good: '#0F766E', bad: '#BE185D', warn: '#C2410C',
    },
    style: { radius: 4, header: 'outline', headerAlign: 'left', bodyTint: 0.95, bullet: 'dash', slideHeader: 'plain', pptFont: 'BIZ UDPGothic' },
  },
  {
    id: 'vivid',
    name: 'ビビッド',
    note: '明るい色と丸い角。社内向けやワークショップに',
    colors: {
      bg: '#FFFFFF', surface: '#FFFFFF', ink: '#22223B', sub: '#5C5C77', line: '#D9D9E6', faint: '#F4F4FA',
      primary: '#3D2C8D', strong: '#3D2C8D',
      accents: ['#2F6FDB', '#0E9A82', '#D9701C', '#E04F5F', '#8B46D6', '#1C8FC4'],
      highlight: '#E04F5F', good: '#0E9A82', bad: '#E04F5F', warn: '#D9701C',
    },
    style: { radius: 14, header: 'filled', headerAlign: 'center', bodyTint: 0.9, bullet: 'dot', slideHeader: 'band', pptFont: 'BIZ UDPGothic' },
  },
  {
    id: 'dark',
    name: 'ダーク',
    note: '暗い背景。登壇や投影に',
    colors: {
      bg: '#0F1A2B', surface: '#14223A', ink: '#E8EEF6', sub: '#A5B3C6', line: '#33445F', faint: '#18263C',
      primary: '#2C5C9A', strong: '#9CC3F5',
      accents: ['#3D7DD8', '#22A08E', '#D9822B', '#D0607A', '#8A7BD8', '#6F8AA8'],
      highlight: '#F2A65A', good: '#3CC2AC', bad: '#F07D95', warn: '#F2A65A',
    },
    style: { radius: 6, header: 'filled', headerAlign: 'center', bodyTint: 0.8, bullet: 'dot', slideHeader: 'plain', pptFont: 'BIZ UDPGothic' },
  },
];
