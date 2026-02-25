/**
 * FANZA ランキング サイト - フロントエンド
 * ランキングデータを読み込み、カードを動的に生成します
 */

// ===== 設定 =====
const CONFIG = {
  affiliateId: '__AFFILIATE_ID__',   // ← Fanzaアフィリエイトに登録後に設定
  tabTypes: ['daily', 'monthly', 'alltime'],
  tabLabels: { daily: '日間', monthly: '月間', alltime: '全期間' },
  rankPerPage: 30,
  dataPath: './data/',
  fanzaBaseUrl: 'https://www.dmm.co.jp/digital/videoa/-/detail/=/cid=',
};

// ===== State =====
let currentTab = 'daily';
let rankingsData = { daily: null, monthly: null, alltime: null };
let lastUpdated = {};

// ===== DOM Ready =====
document.addEventListener('DOMContentLoaded', () => {
  initAgeGate();
  initTabs();
  loadRanking(currentTab);
  updateTimestampDisplay();
});

// ===== 年齢確認 =====
function initAgeGate() {
  const gate = document.getElementById('ageGate');
  const confirmed = sessionStorage.getItem('ageConfirmed');

  if (confirmed === 'yes') {
    gate.classList.add('hidden');
    return;
  }

  document.getElementById('btnConfirm').addEventListener('click', () => {
    sessionStorage.setItem('ageConfirmed', 'yes');
    gate.style.opacity = '0';
    gate.style.transition = 'opacity 0.4s ease';
    setTimeout(() => gate.classList.add('hidden'), 400);
  });

  document.getElementById('btnDeny').addEventListener('click', () => {
    // 18歳未満は退出
    window.location.href = 'https://www.google.com';
  });
}

// ===== タブ切り替え =====
function initTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      if (tab === currentTab) return;
      currentTab = tab;

      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      loadRanking(tab);
    });
  });
}

// ===== ランキング読み込み =====
async function loadRanking(type) {
  const container = document.getElementById('rankingContainer');
  container.innerHTML = `
    <div class="loading-state">
      <div class="spinner"></div>
      <p>ランキングを読み込み中...</p>
    </div>
  `;

  // キャッシュ確認
  if (rankingsData[type]) {
    renderRanking(rankingsData[type]);
    return;
  }

  try {
    const response = await fetch(`${CONFIG.dataPath}${type}.json?t=${Date.now()}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    rankingsData[type] = data;
    lastUpdated[type] = data.updated_at;

    renderRanking(data);
    updateTimestampDisplay(data.updated_at);
  } catch (err) {
    console.error('ランキング読み込みエラー:', err);
    container.innerHTML = `
      <div class="error-state">
        <div style="font-size:2rem;margin-bottom:12px;">⚠️</div>
        <p>データの読み込みに失敗しました。<br>
        スクリプトを実行してデータを生成してください。</p>
        <p style="font-size:0.8rem;margin-top:12px;color:#9B948F;">
          scripts/fetch_rankings.py を実行してください
        </p>
      </div>
    `;
  }
}

// ===== ランキング描画 =====
function renderRanking(data) {
  const items = (data.items || []).slice(0, CONFIG.rankPerPage);
  if (!items.length) {
    document.getElementById('rankingContainer').innerHTML = `
      <div class="error-state"><p>データがありません</p></div>
    `;
    return;
  }

  const top3 = items.slice(0, 3);
  const rest = items.slice(3);

  const top3Html = renderTop3(top3);
  const listHtml = renderList(rest, 4);

  document.getElementById('rankingContainer').innerHTML = `
    <div class="top3-grid">${top3Html}</div>
    <div id="midAd" class="mid-ad">
      <div class="ad-slot">
        <!-- 広告スロット: ExoClick / TrafficJunky / Fanzaアフィリエイトバナー -->
        広告スペース (728×250) — ExoClick / TrafficJunky / Fanza アフィリエイトバナーを挿入
      </div>
    </div>
    <div class="ranking-list">${listHtml}</div>
  `;
}

// ===== TOP3カード =====
function renderTop3(items) {
  const rankClass = ['rank-1', 'rank-2', 'rank-3'];
  const crownEmoji = ['👑', '🥈', '🥉'];

  // 表示順: 2位 → 1位 → 3位 (podium style, or just 1,2,3)
  const order = [0, 1, 2]; // シンプルに1,2,3順

  return order.map(i => {
    const item = items[i];
    if (!item) return '';
    const cls = rankClass[i];
    const crown = crownEmoji[i];
    const actressText = formatActress(item.actress);
    const priceText = formatPrice(item.price);
    const ratingText = formatRating(item.review_avg, item.review_count);

    return `
      <article class="top3-card ${cls}">
        <div class="rank-crown">${crown}</div>
        <div class="top3-img-wrap">
          <img src="${escHtml(item.image)}"
               alt="${escHtml(item.title)}"
               onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 300 400%22><rect fill=%22%23f0ebe5%22 width=%22300%22 height=%22400%22/><text x=%22150%22 y=%22200%22 text-anchor=%22middle%22 fill=%22%23ccc%22 font-size=%2240%22>🎬</text></svg>'">
        </div>
        <div class="top3-info">
          <p class="top3-actress">${escHtml(actressText)}</p>
          <h3 class="top3-title">${escHtml(item.title)}</h3>
          <div class="top3-meta">
            <span class="top3-price">${priceText}</span>
            <span class="star-rating">${ratingText}</span>
          </div>
        </div>
        <a href="${escHtml(item.url)}" target="_blank" rel="noopener sponsored" class="top3-link">
          Fanzaで詳細を見る →
        </a>
      </article>
    `;
  }).join('');
}

// ===== 4位以降リスト =====
function renderList(items, startRank) {
  return items.map((item, i) => {
    const rank = startRank + i;
    const actressText = formatActress(item.actress);
    const priceText = formatPrice(item.price);
    const badgeClass = rank <= 10 ? 'rank-num-badge top10' : 'rank-num-badge';

    return `
      <article class="rank-card">
        <div class="rank-img-wrap">
          <span class="${badgeClass}">${rank}</span>
          <img src="${escHtml(item.image)}"
               alt="${escHtml(item.title)}"
               loading="lazy"
               onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 300 400%22><rect fill=%22%23f0ebe5%22 width=%22300%22 height=%22400%22/><text x=%22150%22 y=%22200%22 text-anchor=%22middle%22 fill=%22%23ccc%22 font-size=%2240%22>🎬</text></svg>'">
        </div>
        <div class="rank-info">
          <p class="rank-actress">${escHtml(actressText)}</p>
          <h3 class="rank-title">${escHtml(item.title)}</h3>
          <p class="rank-price">${priceText}</p>
        </div>
        <a href="${escHtml(item.url)}" target="_blank" rel="noopener sponsored" class="rank-link">
          Fanzaで詳細を見る
        </a>
      </article>
    `;
  }).join('');
}

// ===== ヘルパー =====
function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatActress(actress) {
  if (!actress || !actress.length) return '出演者情報なし';
  const names = Array.isArray(actress) ? actress : [actress];
  return names.slice(0, 3).join(' / ');
}

function formatPrice(price) {
  if (!price) return '価格未定';
  const num = parseInt(String(price).replace(/[^0-9]/g, ''));
  if (isNaN(num) || num === 0) return price;
  return `¥${num.toLocaleString()}`;
}

function formatRating(avg, count) {
  if (!avg) return '';
  const stars = Math.round(Number(avg));
  const starStr = '★'.repeat(Math.min(stars, 5)) + '☆'.repeat(Math.max(0, 5 - stars));
  const countStr = count ? ` (${Number(count).toLocaleString()}件)` : '';
  return `${starStr}${countStr}`;
}

function updateTimestampDisplay(isoStr) {
  const el = document.getElementById('updateTime');
  if (!el) return;

  if (!isoStr) {
    el.textContent = '—';
    return;
  }

  try {
    const d = new Date(isoStr);
    const formatter = new Intl.DateTimeFormat('ja-JP', {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
      timeZone: 'Asia/Tokyo'
    });
    el.textContent = formatter.format(d) + ' 更新';
  } catch (e) {
    el.textContent = isoStr;
  }
}
