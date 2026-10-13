export type LatLng = { lat: number; lng: number };

/**
 * 自転車の一時利用について、どこまで確認できているか。
 * - verified : 自転車OK かつ 一時利用OK を、確認済みデータ（src/data/verified.json）で確認
 * - bicycle  : 自転車用の駐輪場であることは OSM で登録されているが、一時利用かは未確認
 * - candidate: Google の「駐輪場」検索に出ただけ。自転車対応・一時利用とも未確認
 */
export type Tier = "verified" | "bicycle" | "candidate";

export type Source = "verified" | "osm" | "google";

/** 構造化された料金。わかる部分だけ埋める。 */
export type Pricing = {
  /** 最初の無料時間（分）。0 なら無料時間なし */
  freeMinutes?: number;
  /** 課金単位（分） */
  unitMinutes?: number;
  /** 課金単位あたりの料金（円） */
  unitYen?: number;
  /** 1日（または1回）の上限（円） */
  maxYen?: number;
  /** 構造化できない補足 */
  note?: string;
};

export type Photo = {
  /** Places API の photo resource name（キャッシュ禁止。検索結果からその場で使うだけ） */
  name: string;
  authors: { displayName: string; uri?: string }[];
};

export type Facility = {
  /** "verified:xxx" | "osm:node/123" | "google:ChIJ..." */
  id: string;
  name: string;
  location: LatLng;
  tier: Tier;
  sources: Source[];
  /** 現在地（検索中心）からの直線距離 m */
  distanceM: number;
  /** 検索中心から見た方角（度、北=0） */
  bearingDeg: number;
  /** 料金: 構造化（確認済みデータ） */
  pricing?: Pricing;
  /** 料金: 出典の生テキスト（OSM の charge 等）。確認済みではない */
  feeText?: string;
  /** OSM の fee タグ由来: true=有料, false=無料と登録 */
  osmFee?: boolean;
  payment?: string[];
  capacity?: number;
  openingHours?: string;
  operator?: string;
  /** 二輪車（バイク）共用の可能性 */
  motorcycleShared?: boolean;
  /** 利用制限の注記（店舗利用者のみ等） */
  accessNote?: string;
  address?: string;
  googlePlaceId?: string;
  googleMapsUri?: string;
  /** Google上の名称（OSM等と統合した場合） */
  googleName?: string;
  /** 名前は OSM に無く、近くの Google 掲載地点の名前を仮に使っている */
  nameFromGoogle?: boolean;
  /** 名前が無いので近くの目印・駅から付けた仮の名前（「◯◯付近の駐輪スペース」など） */
  provisionalName?: boolean;
  photos?: Photo[];
  /** 確認済みデータの出典 */
  verifiedSource?: { url?: string; checkedAt?: string; note?: string };
  osmUrl?: string;
  /** 運営会社等のページ（満空情報があることも） */
  website?: string;
};

export type SourceStatus = {
  ok: boolean;
  /** 未設定・失敗理由 */
  message?: string;
  count: number;
};

export type SearchResponse = {
  center: LatLng;
  radiusM: number;
  facilities: Facility[];
  status: {
    google: SourceStatus;
    osm: SourceStatus;
    verified: SourceStatus;
  };
  /** 網羅性に関する注意 */
  notices: string[];
  demo: boolean;
};

/** 名前のない駐輪場に仮の名前を付けるための目印 */
export type Landmark = { name: string; location: LatLng };
