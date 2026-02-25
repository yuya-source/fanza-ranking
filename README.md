# FANZAランキング サイト

Fanzaの人気作品を日間・月間・全期間でランキング表示するアフィリエイトサイトです。

## ファイル構成

```
fanza-ranking/
├── index.html              # メインサイト
├── css/style.css           # スタイルシート
├── js/app.js               # フロントエンドJS
├── data/
│   ├── daily.json          # 日間ランキングデータ
│   ├── monthly.json        # 月間ランキングデータ
│   └── alltime.json        # 全期間ランキングデータ
└── scripts/
    ├── fetch_rankings.py   # データ取得スクリプト
    ├── requirements.txt    # Python依存パッケージ
    ├── run_fetch.bat       # 起動バッチ
    └── setup_scheduler.bat # タスクスケジューラ登録
```

## セットアップ手順

### 1. Fanzaアフィリエイト登録（必須）

1. https://affiliate.dmm.com/ にアクセス
2. アカウントを登録
3. **API ID** と **アフィリエイトID** を取得

### 2. APIキーを設定

`scripts/fetch_rankings.py` の先頭部分を編集:

```python
AFFILIATE_ID = "yoursite-990"      # 取得したアフィリエイトID
API_ID       = "abc1234567890"     # 取得したAPI ID
USE_API      = True
```

`index.html` 内の `__AFFILIATE_ID__` を実際のIDに置換:

```bash
# 一括置換 (VSCodeなどで検索&置換)
__AFFILIATE_ID__ → あなたのアフィリエイトID
```

### 3. Python環境セットアップ

```bash
pip install -r scripts/requirements.txt
```

### 4. 初回データ取得

```bash
cd scripts
python fetch_rankings.py
```

`data/` フォルダに `daily.json`, `monthly.json`, `alltime.json` が生成されます。

### 5. 毎朝8時の自動更新設定

**setup_scheduler.bat を管理者権限で実行**:

```
右クリック → 管理者として実行
```

これでWindowsタスクスケジューラに毎日8:00(JST)実行のタスクが登録されます。

### 6. サイト公開

- **静的ホスティング**: GitHub Pages, Netlify, Vercel, さくらレンタルサーバーなど
- ファイルをサーバーにアップロード
- fetch_rankings.py はサーバー側のcronまたはローカルPCから実行

## 広告収益設定

### Fanzaアフィリエイト（メイン収益）
- 商品リンクからの購入で3〜10%の報酬
- `index.html` の `__AFFILIATE_ID__` を設定するだけで有効

### 成人向け広告ネットワーク
Google AdSense は成人コンテンツ不可のため、以下を推奨:

| 広告ネットワーク | 特徴 | 登録URL |
|---|---|---|
| **ExoClick** | 最大手の成人向け広告ネットワーク | exoclick.com |
| **TrafficJunky** | xHamsterなど大手と提携 | trafficjunky.com |
| **JuicyAds** | 中小サイトにも対応 | juicyads.com |

各サービスに登録後、広告タグを `index.html` の `ad-slot` クラスの要素内に挿入してください。

## 注意事項

- **年齢確認**: サイトには18歳確認ゲートを実装済みです
- **法令遵守**: 日本の法律に従い、18歳未満のコンテンツは一切含みません
- **アフィリエイト表記**: フッターに「アフィリエイトリンクを使用している」旨を明記済みです
- **API利用規約**: Fanzaアフィリエイト利用規約を必ず確認してください
- **スクレイピング**: API未設定時はスクレイピングになりますが、Fanzaの利用規約に抵触する場合があります。APIの使用を強く推奨します。

## カスタマイズ

### デザイン変更
`css/style.css` の `:root` セクションでカラーパレットを変更できます:

```css
:root {
  --gold: #C9A96E;   /* ゴールドアクセント */
  --rose: #C4706A;   /* ローズアクセント */
  /* ... */
}
```

### カテゴリ追加
`fetch_rankings.py` の `floor` パラメータを変更することで別カテゴリも取得可能:
- `videoa` ... 一般ビデオ
- `anime`  ... アニメ
- その他はFanza API仕様書を参照
