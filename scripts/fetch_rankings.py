"""
FANZA ランキング 自動取得スクリプト
=====================================

【APIモード (推奨)】
  API_ID と AFFILIATE_ID が両方設定されている場合、DMM Web API を使用します。
  女優名・メーカー・ジャンル・レビュー評価などの詳細情報が取得できます。
  登録: https://affiliate.dmm.com/
  API登録: アフィリエイト管理画面の「WEBサービス利用登録」から取得

【スクレイピングモード (フォールバック)】
  API未設定の場合、Playwright でFANZAランキングページをスクレイピングします。

使い方:
  python fetch_rankings.py

必要パッケージ:
  pip install playwright requests
  python -m playwright install chromium
"""

import json
import os
import time
import logging
from datetime import datetime, timezone, timedelta

try:
    import requests as _requests
    HAS_REQUESTS = True
except ImportError:
    HAS_REQUESTS = False

from playwright.sync_api import sync_playwright

# ===== 設定 =============================================

# 1) FANZAアフィリエイトID
#    https://affiliate.dmm.com/ に登録後、管理画面で確認
#    例: "yoursite-990"
AFFILIATE_ID = "__AFFILIATE_ID__"

# 2) DMM Web API ID
#    アフィリエイト管理画面の「WEBサービス利用登録」から取得
#    例: "XXXXXXXXXXXXXXXXXX"
API_ID = "__API_ID__"

# 取得件数 (APIモード: 最大100, スクレイピングモード: 最大30)
HITS = 30

# ファイルパス
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")

# ログ設定
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(os.path.join(BASE_DIR, "fetch.log"), encoding="utf-8"),
    ]
)
logger = logging.getLogger(__name__)

JST = timezone(timedelta(hours=9))

DMM_API_URL = "https://api.dmm.com/affiliate/v3/ItemList"

# ========================================================


def _is_api_configured() -> bool:
    """APIモードが使用可能か判定"""
    return (
        API_ID != "__API_ID__"
        and AFFILIATE_ID != "__AFFILIATE_ID__"
        and HAS_REQUESTS
    )


# ===== DMM API モード =====================================

def fetch_via_api(sort: str, hits: int, period_label: str) -> list[dict]:
    """
    DMM Web APIを使ってビデオランキングを取得。
    sort: 'rank' (売れ筋) | 'review' (評価順) | 'date' (新着)
    """
    params = {
        "api_id":       API_ID,
        "affiliate_id": AFFILIATE_ID,
        "site":         "FANZA",
        "service":      "digital",
        "floor":        "videoa",
        "hits":         min(hits, 100),
        "sort":         sort,
        "output":       "json",
    }
    logger.info(f"  DMM API取得中 (sort={sort}, hits={hits})")
    resp = _requests.get(DMM_API_URL, params=params, timeout=20)
    resp.raise_for_status()
    data = resp.json()

    result     = data.get("result", {})
    items_data = result.get("items", {}).get("item", [])
    logger.info(f"  API取得件数: {len(items_data)}")

    items = []
    for i, item in enumerate(items_data):
        info      = item.get("iteminfo", {})
        actress   = [a["name"] for a in info.get("actress", [])]
        maker_lst = info.get("maker", [])
        maker     = maker_lst[0]["name"] if maker_lst else ""
        genres    = [g["name"] for g in info.get("genre", [])[:6]]
        review    = item.get("review", {})
        prices    = item.get("prices", {})
        price_str = prices.get("price", "")

        items.append({
            "rank":         i + 1,
            "content_id":   item.get("content_id", ""),
            "title":        item.get("title", ""),
            "url":          item.get("affiliateURL") or item.get("URL", ""),
            "image":        item.get("imageURL", {}).get("large", ""),
            "image_small":  item.get("imageURL", {}).get("small", ""),
            "price":        price_str,
            "review_avg":   float(review.get("average") or 0),
            "review_count": int(review.get("count") or 0),
            "maker":        maker,
            "actress":      actress,
            "date":         item.get("date", ""),
            "genres":       genres,
        })

    return items


# ===== Playwright スクレイピングモード ====================

RANKING_TERMS = {
    "daily":   "daily",
    "monthly": "monthly",
    "alltime": "monthly",   # FANZAに全期間ランキングなし → 月間で代替
}

BASE_RANKING_URL = "https://video.dmm.co.jp/av/ranking/?term={term}"


def _make_browser_context(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context(
        user_agent=(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/122.0.0.0 Safari/537.36"
        ),
        locale="ja-JP",
        viewport={"width": 1280, "height": 900},
    )
    context.add_cookies([
        {"name": "age_check_done",       "value": "1", "domain": ".dmm.co.jp", "path": "/"},
        {"name": "age_check_done_fanza", "value": "1", "domain": ".dmm.co.jp", "path": "/"},
        {"name": "ckcy",                 "value": "1", "domain": ".dmm.co.jp", "path": "/"},
    ])
    return browser, context


def _extract_items_js() -> str:
    return """(maxItems) => {
        const results = [];
        const seen = new Set();
        const allLinks = document.querySelectorAll('a[href]');
        for (const a of allLinks) {
            const href = a.href;
            const ordMatch = href.match(/i3_ord=(\\d+)/);
            const idMatch  = href.match(/[?&]id=([^&]+)/);
            if (!ordMatch || !idMatch) continue;
            const rank      = parseInt(ordMatch[1]);
            const contentId = idMatch[1];
            if (seen.has(contentId)) continue;
            seen.add(contentId);
            let title = '';
            let el = a;
            for (let i = 0; i < 5 && !title; i++) {
                if (el.parentElement) el = el.parentElement;
                for (const t of el.querySelectorAll('p, span, h2, h3, div[class*="title"]')) {
                    const txt = t.textContent.trim();
                    if (txt.length > 5 && txt.length < 200) { title = txt; break; }
                }
            }
            let imgSrc = '';
            let el2 = a;
            for (let i = 0; i < 5; i++) {
                if (el2.parentElement) el2 = el2.parentElement;
                const img = el2.querySelector('img');
                if (img) { imgSrc = img.src || img.dataset.src || ''; break; }
            }
            const imgLarge = imgSrc
                .replace(/(\\/[a-z0-9]+)ps\\.jpg/i, '$1pl.jpg')
                .replace(/\\?w=\\d+&h=\\d+&t=\\w+/, '');
            let price = '';
            let el3 = a;
            for (let i = 0; i < 5; i++) {
                if (el3.parentElement) el3 = el3.parentElement;
                for (const pe of el3.querySelectorAll('[class*="price"], [class*="Price"]')) {
                    const txt = pe.textContent.trim();
                    if (txt.includes('円') || /\\d+/.test(txt)) { price = txt.substring(0, 30); break; }
                }
                if (price) break;
            }
            results.push({ rank, contentId, title, href, imgSrc: imgLarge, imgSmall: imgSrc, price });
        }
        return results.sort((a, b) => a.rank - b.rank).slice(0, maxItems);
    }"""


def fetch_via_scraping(term: str, hits: int = HITS) -> list[dict]:
    url = BASE_RANKING_URL.format(term=term)
    logger.info(f"  スクレイピング: {url}")

    with sync_playwright() as pw:
        browser, context = _make_browser_context(pw)
        page = context.new_page()
        try:
            page.goto(url, wait_until="load", timeout=25000)
            page.wait_for_timeout(2000)
            page.evaluate("window.scrollTo(0, document.body.scrollHeight / 2)")
            page.wait_for_timeout(1000)
            raw_items = page.evaluate(_extract_items_js(), hits)
        except Exception as e:
            logger.error(f"  ページ取得エラー: {e}")
            raw_items = []
        finally:
            browser.close()

    logger.info(f"  スクレイピング取得件数: {len(raw_items)}")

    items = []
    for item in raw_items:
        url_item = item.get("href", "")
        if AFFILIATE_ID != "__AFFILIATE_ID__" and url_item:
            sep = "&" if "?" in url_item else "?"
            url_item = f"{url_item}{sep}affiliate_id={AFFILIATE_ID}"

        items.append({
            "rank":         item.get("rank", 0),
            "content_id":   item.get("contentId", ""),
            "title":        item.get("title", ""),
            "url":          url_item,
            "image":        item.get("imgSrc", ""),
            "image_small":  item.get("imgSmall", ""),
            "price":        item.get("price", ""),
            "review_avg":   0,
            "review_count": 0,
            "maker":        "",
            "actress":      [],
            "date":         "",
            "genres":       [],
        })

    return items


# ===== 保存 ===============================================

def save_ranking(items: list[dict], filename: str, period_label: str = "") -> None:
    os.makedirs(DATA_DIR, exist_ok=True)
    filepath = os.path.join(DATA_DIR, filename)
    payload = {
        "updated_at":   datetime.now(JST).isoformat(),
        "period_label": period_label,
        "total":        len(items),
        "items":        items,
    }
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    logger.info(f"  保存完了: {filepath} ({len(items)} 件)")


# ===== メイン =============================================

def main():
    logger.info("=" * 50)
    logger.info(f"ランキング取得開始: {datetime.now(JST).strftime('%Y-%m-%d %H:%M JST')}")

    api_mode = _is_api_configured()

    if api_mode:
        logger.info("モード: DMM Web API")
        logger.info("=" * 50)
        # APIモード: 売れ筋/評価順/新着 の3パターンで取得
        tasks = [
            # (filename,       period_label,      api_sort,  hits)
            ("daily.json",   "日間 (売れ筋)",    "rank",    20),
            ("monthly.json", "月間 (売れ筋)",    "rank",    30),
            ("alltime.json", "高評価 TOP30",      "review",  30),
        ]
        for filename, label, sort, hits in tasks:
            logger.info(f"--- {label} ---")
            try:
                items = fetch_via_api(sort=sort, hits=hits, period_label=label)
                save_ranking(items, filename, label)
            except Exception as e:
                logger.error(f"  APIエラー ({label}): {e}")
            time.sleep(1)

    else:
        logger.info("モード: Playwright スクレイピング (API未設定)")
        logger.info("  API設定方法: scripts/fetch_rankings.py の API_ID と AFFILIATE_ID を設定")
        logger.info("=" * 50)
        tasks = [
            # (term,      filename,       period_label, hits)
            ("daily",   "daily.json",   "日間",       20),
            ("monthly", "monthly.json", "月間",       30),
            ("monthly", "alltime.json", "全期間",     30),
        ]
        for term, filename, label, hits in tasks:
            logger.info(f"--- {label}ランキング ---")
            items = fetch_via_scraping(term, hits)
            save_ranking(items, filename, label)
            time.sleep(2)

    logger.info("=" * 50)
    logger.info("完了!")


if __name__ == "__main__":
    main()
