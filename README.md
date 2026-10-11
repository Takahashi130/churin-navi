# ちかくの駐輪場（自分用 PWA）

アプリを開くと現在地を取得し、半径500m以内で自転車を一時利用できる駐輪場を地図に表示します。

## 起動

```bash
npm install
cp .env.example .env.local   # キーを入れる（下記）。空のままだとデモモード
npm run dev                  # http://localhost:3000
npm test                     # ロジックの単体テスト
```

- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` が空のときは、**デモモード**になります。画面上部に赤い帯が出て、架空のサンプル施設だけを表示します。実際の検索は行いません。
- `?demo=1` を付けると、キーがあってもデモモードで開きます。

## データの取り方と「自転車・一時利用」の判定

| 層 | ピン | 出典 | 意味 |
|---|---|---|---|
| 確認済み | 緑 ✓ | `src/data/verified.json` | 自転車で使えて、一時利用（時間利用）もできることを、自治体や運営会社の資料、または現地で確認したもの |
| 自転車用 | 青 P | OpenStreetMap `amenity=bicycle_parking` | 自転車駐車場として登録されている施設。一時利用できるかは確認していない |
| 未確認候補 | 灰 ? | Google Places Text Search（「駐輪場」「自転車駐車場」） | 自転車で使えるか、一時利用できるかが、どちらも不明なもの。初期状態では表示しない |

- Google Places には自転車駐車場専用の type がありません（2026-10 時点の Table A / B を確認済み）。そのため Google の結果は、名前に「駐輪場」が入っていても「確認済み」にはしません。
- OSM の `access=private / no / permit / residents / discouraged` は除外します。`customers` は「店舗利用者向け」と注記して表示します。
- `verified.json` に `temporaryUse: false`（定期専用）や `bicycle: false` と書いた施設は、検索結果から外れます。
- Google の地点が OSM や確認済みの施設から25m以内にあれば、同じ施設として Google の写真と Google マップへのリンクだけを付け足します。ただし同一施設とは限らないことを画面に表示します。
- 料金は確認済みデータにあるときだけ「最初の2時間無料、その後4時間ごとに110円」の形で表示します。OSM に「有料／無料」の登録があれば「OSM登録情報・未確認」と添えて表示し、何もなければ「料金未確認」と表示します。

### 確認済みデータの追加

`src/data/verified.json` にエントリを追加します。紐づけには OSM の ID（地図ピンの詳細にある OSM リンクの `way/…` や `node/…`）か、Google の place_id を使います。place_id は規約上、無期限に保存してよいことになっています。

```json
{
  "id": "任意のID",
  "name": "施設名",
  "location": { "lat": 35.0, "lng": 139.0 },
  "osmId": "way/123",
  "bicycle": true,
  "temporaryUse": true,
  "pricing": { "freeMinutes": 120, "unitMinutes": 240, "unitYen": 110, "maxYen": 300, "note": "補足" },
  "payment": ["現金", "ICカード"],
  "source": { "url": "出典URL", "checkedAt": "2026-10-11", "note": "確認方法" }
}
```

## Google API の設定

1. Google Cloud でプロジェクトを作り、請求先アカウントを設定します。
2. 次の2つの API を有効にします。
   - **Maps JavaScript API**（地図の表示）
   - **Places API (New)**（候補の検索と写真）
3. API キーを2本作ります。
   - ブラウザ用 → `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
     - アプリケーションの制限：HTTP リファラ（`http://localhost:3000/*` と、公開先のドメイン `https://xxxx.vercel.app/*`）
     - API の制限：Maps JavaScript API のみ
   - サーバー用 → `GOOGLE_PLACES_API_KEY`
     - API の制限：Places API (New) のみ
     - ブラウザには一切出しません
4. 任意で、Map ID を作って `NEXT_PUBLIC_GOOGLE_MAP_ID` に入れます。未設定のときは `DEMO_MAP_ID` を使います。
5. 想定外の課金を防ぐため、各 API の「割り当て」で1日の上限を設定し、予算アラートも設定しておきます。

### 料金の目安（2026-10 時点の公式価格表）

| 操作 | SKU | 月の無料枠 | 超過分 |
|---|---|---|---|
| 地図の読み込み | Dynamic Maps | 10,000 | 公式価格表を参照 |
| 1回の検索 | Text Search **Pro**：500mは2リクエスト、1kmは最大4、2kmは最大6 | 5,000 | $32 / 1,000 |
| 写真（詳細を開くと1枚目を自動表示、2枚目以降は「他の写真を見る」を押した時だけ） | Place Details Photos | 1,000 | $7 / 1,000 |

- 取得するフィールドは Pro SKU に収まるもの（id, displayName, location, shortFormattedAddress, types, primaryType, googleMapsUri, photos）だけに絞っています。
- 営業時間・電話番号・支払方法は Enterprise 以上の SKU になるため、取得していません。
- 地図を動かしても自動では再検索しません。検索するのは、起動時と、「再検索」「範囲変更」「この地点の周辺を探す」を押した時だけです。
- 個人で1日10回ほど使う程度なら、無料枠に収まる見込みです。

### 規約上の扱い

- Places の結果は Google マップ上に表示しています。Google のロゴは地図上に出ているので、別途の帰属表示は不要です。
- 写真には投稿者名を表示しています。
- 写真名や検索結果は保存しません。サーバーにもブラウザにもキャッシュしません。保存しているのは自分で確認した place_id と OSM の ID だけです。
- OSM のデータには「© OpenStreetMap contributors（ODbL）」と表示しています。
- 現在地は検索リクエストに使うだけで、保存していません。

## スマホで使う

位置情報と PWA のどちらも **HTTPS が必須**です（localhost は例外）。そのため、同じ Wi‑Fi から `http://192.168.x.x:3000` で開いても現在地は取れません。

おすすめは Vercel への公開です。

1. このフォルダを GitHub の非公開リポジトリに push します。
2. Vercel で Import し、Environment Variables に `.env.local` と同じ3つの値を設定して Deploy します。
3. 発行された `https://….vercel.app` を、ブラウザ用キーの HTTP リファラ制限に追加します。
4. スマホでその URL を開き、位置情報の利用を許可します。
5. ホーム画面に追加します。
   - iPhone：Safari の共有ボタン →「ホーム画面に追加」
   - Android：Chrome のメニュー →「ホーム画面に追加」（「インストール」と表示される場合もあります）

URL を知っている人なら誰でも開けるので、自分用に絞りたい場合は Vercel の Deployment Protection（パスワード保護など）を検討してください。

## 既知の限界

- **網羅的ではありません。** OSM や Google に登録されていない駐輪場は出てきません。自治体の小さな路上駐輪場も漏れることがあります。
- 確認済みデータは今のところ「新宿駅東口自転車駐輪場①②」の2件だけです（新宿区の PDF と照合。現地では未確認）。新宿駅周辺の他の施設は、区の PDF の表の文字順が崩れていて料金と施設の対応を確定できなかったため、まだ登録していません。
- OSM には名称のない小さな駐輪スペースが多く、マンションや店舗の駐輪スペースが「一般利用可」の登録なしで含まれることがあります。
- 公開 Overpass サーバーは混雑すると数秒〜十数秒止まることがあります。3つのサーバーに順に問い合わせますが、すべて失敗すると OSM の結果が出ません（画面に注記が出ます）。

## 現地確認の登録と要望の送信

- 詳細画面の「現地で確認した結果を登録する」から登録すると、`src/data/verified.json` に GitHub API で直接コミットします。main への push で Vercel が再デプロイするので、1分ほどで全端末に反映されます。
  - 「一時利用できた」→ 確認済み（緑）になります。
  - 「定期・月極専用」「自転車不可」→ 以後その施設は表示されません。
  - Google だけで見つかった施設は、place_id だけを保存します。座標は保存しません（Places の規約で無期限保存できるのは place_id だけのため）。
- 画面下の「開発への要望を送る」から送ると、GitHub の Issue（ラベル「要望」）になります。
- どちらも合言葉（`APP_PASSCODE`）が必要です。一度通ると、その端末のブラウザに保存されます。
- Vercel に次の2つを Secret として設定してください。
  - `GITHUB_TOKEN`：fine-grained token。対象リポジトリは churin-navi のみ、権限は Contents と Issues の Read and write。
  - `APP_PASSCODE`：自分で決めた合言葉。
