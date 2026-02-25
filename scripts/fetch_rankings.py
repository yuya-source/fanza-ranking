"""
FANZA ランキング 自動取得スクリプト
=====================================
Playwright を使ってブラウザレンダリングし、
日間・月間・全期間のランキング上位30件を取得し、
../data/ ディレクトリに JSON として保存します。

使い方:
  python fetch_rankings.py

必要パッケージ:
  pip install playwright
  python -m playwright install chromium

定期実行:
  Windowsタスクスケジューラで毎朝8時に実行 (setup_scheduler.bat 参照)
"""

import json
import os
import re
import time
import logging
from datetime import datetime, timezone, timedelta
from playwright.sync_api import sync_playwright

# ===== 設定 =============================================
# Fanza アフィリエイトプログラム登録後に設定してください
# 登録: https://affiliate.dmm.com/
AFFILIATE_ID = "__AFFILIATE_ID__"   # 例: "yoursite-990"

# 取得件数 (最大30)
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
# ========================================================

# ランキング種別 → URL の term パラメータ
RANKING_TERMS = {
    "daily":   "daily",    # 日間
    "monthly": "monthly",  # 月間
    "alltime": "monthly",  # 全期間 (FANZAに全期間ランキングなし → 月間で代替)
}

BASE_RANKING_URL = "https://video.dmm.co.jp/av/ranking/?term={term}"


def _make_browser_context(playwright):
    """年齢確認Cookie付きのブラウザコンテキストを作成"""
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
    """ランキングアイテムを抽出する JavaScript (page.evaluate で使用)"""
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

            // タイトル: 近くの p/span/h 要素から取得
            let title = '';
            let el = a;
            for (let i = 0; i < 5 && !title; i++) {
                if (el.parentElement) el = el.parentElement;
                for (const t of el.querySelectorAll('p, span, h2, h3, div[class*=\"title\"]')) {
                    const txt = t.textContent.trim();
                    if (txt.length > 5 && txt.length < 200) {
                        title = txt;
                        break;
                    }
                }
            }

            // 画像 URL
            let imgSrc = '';
            let el2 = a;
            for (let i = 0; i < 5; i++) {
                if (el2.parentElement) el2 = el2.parentElement;
                const img = el2.querySelector('img');
                if (img) { imgSrc = img.src || img.dataset.src || ''; break; }
            }
            // 小さいサムネイルを大きい画像URLに変換 (ps → pl)
            const imgLarge = imgSrc
                .replace(/(\\/[a-z0-9]+)ps\\.jpg/i, '$1pl.jpg')
                .replace(/\\?w=\\d+&h=\\d+&t=\\w+/, '');

            // 価格
            let price = '';
            let el3 = a;
            for (let i = 0; i < 5; i++) {
                if (el3.parentElement) el3 = el3.parentElement;
                for (const pe of el3.querySelectorAll('[class*=\"price\"], [class*=\"Price\"]')) {
                    const txt = pe.textContent.trim();
                    if (txt.includes('円') || /\\d+/.test(txt)) {
                        price = txt.substring(0, 30);
                        break;
                    }
                }
                if (price) break;
            }

            results.push({ rank, contentId, title, href, imgSrc: imgLarge, imgSmall: imgSrc, price });
        }

        return results
            .sort((a, b) => a.rank - b.rank)
            .slice(0, maxItems);
    }"""


def fetch_ranking(term: str, period_label: str, hits: int = HITS) -> list[dict]:
    """
    Playwright を使って FANZA ランキングを取得

    term: daily / monthly / alltime 等
    """
    url = BASE_RANKING_URL.format(term=term)
    logger.info(f"  取得中: {url}")

    with sync_playwright() as pw:
        browser, context = _make_browser_context(pw)
        page = context.new_page()
        try:
            page.goto(url, wait_until="load", timeout=25000)
            page.wait_for_timeout(2000)  # JS レンダリング待ち

            # スクロールして遅延ロード画像も取得
            page.evaluate("window.scrollTo(0, document.body.scrollHeight / 2)")
            page.wait_for_timeout(1000)

            raw_items = page.evaluate(_extract_items_js(), hits)
        except Exception as e:
            logger.error(f"  ページ取得エラー: {e}")
            raw_items = []
        finally:
            browser.close()

    logger.info(f"  取得件数: {len(raw_items)}")

    items = []
    for item in raw_items:
        content_id = item.get("contentId", "")
        url_item   = item.get("href", "")

        # アフィリエイトID付与 (設定済みの場合)
        if AFFILIATE_ID != "__AFFILIATE_ID__" and url_item:
            sep = "&" if "?" in url_item else "?"
            url_item = f"{url_item}{sep}affiliate_id={AFFILIATE_ID}"

        items.append({
            "rank":         item.get("rank", 0),
            "content_id":   content_id,
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
        })

    return items


def save_ranking(items: list[dict], filename: str, period_label: str = "") -> None:
    """ランキングデータをJSON保存"""
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


def main():
    logger.info("=" * 50)
    logger.info(f"ランキング取得開始: {datetime.now(JST).strftime('%Y-%m-%d %H:%M JST')}")
    logger.info("=" * 50)

    tasks = [
        ("daily",   "daily.json",   "日間"),
        ("monthly", "monthly.json", "月間"),
        ("monthly", "alltime.json", "全期間"),  # 全期間は月間で代替
    ]

    for term, filename, label in tasks:
        logger.info(f"--- {label}ランキング ---")
        items = fetch_ranking(term, label, HITS)
        save_ranking(items, filename, label)
        time.sleep(2)  # サーバー負荷軽減

    logger.info("=" * 50)
    logger.info("完了!")
    logger.info("=" * 50)


if __name__ == "__main__":
    main()
