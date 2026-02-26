/**
 * FANZA ランキング サイト - フロントエンド
 * 検索・お気に入り・ソート機能付き
 */

// ===== 設定 =====
const CONFIG = {
  affiliateId: '__AFFILIATE_ID__',
  tabTypes:    ['daily', 'monthly', 'alltime', 'favorites'],
  tabLabels:   { daily: '日間', monthly: '月間', alltime: '全期間', favorites: 'お気に入り' },
  rankPerPage: 30,
  dataPath:    './data/',
};

// ===== State =====
let currentTab    = 'daily';
let rankingsData  = { daily: null, monthly: null, alltime: null };
let lastUpdated   = {};
let searchQuery   = '';
let sortOrder     = 'rank';
let favorites     = new Set();

// ===== プレースホルダー画像 =====
const PLACEHOLDER_IMG = 'data:image/svg+xml,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 400">' +
  '<rect fill="#f0ebe5" width="300" height="400"/>' +
  '<text x="150" y="200" text-anchor="middle" fill="#ccc" font-size="40">🎬</text></svg>'
);

// ===== DOM Ready =====
document.addEventListener('DOMContentLoaded', () => {
  loadFavorites();
  initAgeGate();
  initTabs();
  initSearch();
  initSort();
  updateFavCount();
  loadRanking(currentTab);
  updateTimestampDisplay();
});

// ===== お気に入り =====
function loadFavorites() {
  try {
    const saved = localStorage.getItem('fanza_favorites');
    if (saved) favorites = new Set(JSON.parse(saved));
  } catch (e) {}
}

function saveFavorites() {
  try {
    localStorage.setItem('fanza_favorites', JSON.stringify([...favorites]));
  } catch (e) {}
}

function toggleFavorite(contentId, e) {
  if (e) e.stopPropagation();
  if (favorites.has(contentId)) {
    favorites.delete(contentId);
  } else {
    favorites.add(contentId);
    showToast('お気に入りに追加しました ♥');
  }
  saveFavorites();
  document.querySelectorAll(`[data-fav-id="${CSS.escape(contentId)}"]`).forEach(btn => {
    btn.classList.toggle('active', favorites.has(contentId));
    btn.setAttribute('aria-pressed', String(favorites.has(contentId)));
  });
  updateFavCount();
  if (currentTab === 'favorites') renderFavorites();
}

function updateFavCount() {
  const badge = document.getElementById('favCount');
  if (!badge) return;
  badge.textContent = favorites.size;
  badge.style.display = favorites.size > 0 ? 'inline-flex' : 'none';
}

// ===== 検索 =====
function initSearch() {
  const input    = document.getElementById('searchInput');
  const clearBtn = document.getElementById('searchClear');
  if (!input) return;

  input.addEventListener('input', () => {
    searchQuery = input.value.trim().toLowerCase();
    if (clearBtn) clearBtn.style.display = searchQuery ? 'flex' : 'none';
    rerender();
  });

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      input.value = '';
      searchQuery = '';
      clearBtn.style.display = 'none';
      rerender();
      input.focus();
    });
  }
}

// ===== ソート =====
function initSort() {
  const sel = document.getElementById('sortSelect');
  if (!sel) return;
  sel.addEventListener('change', () => {
    sortOrder = sel.value;
    rerender();
  });
}

function rerender() {
  if (currentTab === 'favorites') {
    renderFavorites();
  } else if (rankingsData[currentTab]) {
    renderRanking(rankingsData[currentTab]);
  }
}

function applyFiltersAndSort(items) {
  let result = [...items];

  // 検索フィルター
  if (searchQuery) {
    result = result.filter(item => {
      const title   = (item.title  || '').toLowerCase();
      const actress = (Array.isArray(item.actress) ? item.actress.join(' ') : '').toLowerCase();
      const maker   = (item.maker  || '').toLowerCase();
      return title.includes(searchQuery) || actress.includes(searchQuery) || maker.includes(searchQuery);
    });
  }

  // ソート
  if (sortOrder === 'review') {
    result.sort((a, b) => (Number(b.review_avg) || 0) - (Number(a.review_avg) || 0));
  } else if (sortOrder === 'price_asc') {
    result.sort((a, b) => parsePriceNum(a.price) - parsePriceNum(b.price));
  } else if (sortOrder === 'price_desc') {
    result.sort((a, b) => parsePriceNum(b.price) - parsePriceNum(a.price));
  }
  // 'rank': 元の順序を維持

  return result;
}

function parsePriceNum(price) {
  if (!price) return 99999;
  const n = parseInt(String(price).replace(/[^0-9]/g, ''));
  return isNaN(n) ? 99999 : n;
}

// ===== 年齢確認 =====
function initAgeGate() {
  const gate = document.getElementById('ageGate');
  if (sessionStorage.getItem('ageConfirmed') === 'yes') {
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

      document.querySelectorAll('.tab-btn').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');

      if (tab === 'favorites') {
        renderFavorites();
        updateTimestampDisplay(null);
      } else {
        loadRanking(tab);
      }
    });
  });
}

// タブ切り替えリンク用ヘルパー (フッターから呼び出し)
function switchTab(tab) {
  const btn = document.querySelector(`[data-tab="${tab}"]`);
  if (btn) btn.click();
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

  if (rankingsData[type]) {
    renderRanking(rankingsData[type]);
    return;
  }

  try {
    const response = await fetch(`${CONFIG.dataPath}${type}.json?t=${Date.now()}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    rankingsData[type] = data;
    lastUpdated[type]  = data.updated_at;

    renderRanking(data);
    updateTimestampDisplay(data.updated_at);
  } catch (err) {
    console.error('ランキング読み込みエラー:', err);
    container.innerHTML = `
      <div class="error-state">
        <div style="font-size:2rem;margin-bottom:12px;">⚠️</div>
        <p>データの読み込みに失敗しました。<br>
           scripts/fetch_rankings.py を実行してください。</p>
      </div>
    `;
  }
}

// ===== ランキング描画 =====
function renderRanking(data) {
  const allItems = (data.items || []).slice(0, CONFIG.rankPerPage);
  const items    = applyFiltersAndSort(allItems);
  renderItems(items, allItems.length, false);
  updateTimestampDisplay(lastUpdated[currentTab]);
}

function renderFavorites() {
  // 全タブのデータからお気に入り作品を集める
  const allItems = [];
  const seen     = new Set();
  for (const type of ['daily', 'monthly', 'alltime']) {
    if (!rankingsData[type]) continue;
    for (const item of (rankingsData[type].items || [])) {
      if (favorites.has(item.content_id) && !seen.has(item.content_id)) {
        allItems.push(item);
        seen.add(item.content_id);
      }
    }
  }

  if (allItems.length === 0) {
    document.getElementById('rankingContainer').innerHTML = `
      <div class="empty-fav">
        <div class="empty-fav-icon">♡</div>
        <p>お気に入りはまだありません</p>
        <p class="empty-fav-sub">作品カードの ♥ ボタンで追加できます</p>
      </div>
    `;
    return;
  }

  const items = applyFiltersAndSort(allItems);
  renderItems(items, allItems.length, true);
}

function renderItems(items, totalCount, isFavorites) {
  const container = document.getElementById('rankingContainer');
  const filtered  = items.length !== totalCount;

  const countHtml = `
    <div class="result-count">
      ${filtered
        ? `<span>${totalCount}件中 <strong>${items.length}件</strong>を表示</span>`
        : `<span>全 <strong>${items.length}件</strong></span>`}
    </div>`;

  if (!items.length) {
    container.innerHTML = countHtml + `
      <div class="no-results">
        <div style="font-size:2rem;margin-bottom:12px;">🔍</div>
        <p>「${escHtml(searchQuery)}」に一致する作品が見つかりませんでした</p>
      </div>
    `;
    return;
  }

  // ソート変更時 or お気に入りタブはフラットリスト
  if (isFavorites || sortOrder !== 'rank') {
    container.innerHTML = countHtml + `
      <div class="ranking-list ranking-list--flat">
        ${items.map((item, i) => renderCard(item, i + 1)).join('')}
      </div>
    `;
  } else {
    const top3 = items.slice(0, 3);
    const rest  = items.slice(3);
    container.innerHTML = countHtml + `
      <div class="top3-grid">${renderTop3(top3)}</div>
      <div class="mid-ad">
        <div class="ad-slot">広告スペース (728×250) — アフィリエイトバナーを挿入</div>
      </div>
      <div class="ranking-list">
        ${rest.map((item, i) => renderCard(item, i + 4)).join('')}
      </div>
    `;
  }
}

// ===== TOP3カード =====
function renderTop3(items) {
  const rankClass  = ['rank-1', 'rank-2', 'rank-3'];
  const crownEmoji = ['👑', '🥈', '🥉'];

  return [0, 1, 2].map(i => {
    const item = items[i];
    if (!item) return '';
    const isFav = favorites.has(item.content_id);
    return `
      <article class="top3-card ${rankClass[i]}">
        <button class="fav-btn${isFav ? ' active' : ''}"
                data-fav-id="${escAttr(item.content_id)}"
                onclick="toggleFavorite('${escAttr(item.content_id)}', event)"
                aria-label="お気に入り" aria-pressed="${isFav}">♥</button>
        <div class="rank-crown">${crownEmoji[i]}</div>
        <div class="top3-img-wrap">
          <img src="${escAttr(item.image)}" alt="${escAttr(item.title)}"
               onerror="this.src='${PLACEHOLDER_IMG}'">
        </div>
        <div class="top3-info">
          ${item.actress && item.actress.length
            ? `<p class="top3-actress">${escHtml(formatActress(item.actress))}</p>`
            : ''}
          <h3 class="top3-title">${escHtml(item.title)}</h3>
          ${item.maker ? `<p class="card-maker">${escHtml(item.maker)}</p>` : ''}
          ${renderGenreTags(item.genres)}
          <div class="top3-meta">
            <span class="top3-price">${formatPrice(item.price)}</span>
            <span class="star-rating">${formatRating(item.review_avg, item.review_count)}</span>
          </div>
        </div>
        <a href="${escAttr(item.url)}" target="_blank" rel="noopener sponsored" class="top3-link">
          動画を見る →
        </a>
      </article>
    `;
  }).join('');
}

// ===== ランキングカード (4位以降 / ソート済み一覧) =====
function renderCard(item, rank) {
  const badgeClass = rank <= 10 ? 'rank-num-badge top10' : 'rank-num-badge';
  const isFav      = favorites.has(item.content_id);
  return `
    <article class="rank-card">
      <div class="rank-img-wrap">
        <span class="${badgeClass}">${rank}</span>
        <button class="fav-btn${isFav ? ' active' : ''}"
                data-fav-id="${escAttr(item.content_id)}"
                onclick="toggleFavorite('${escAttr(item.content_id)}', event)"
                aria-label="お気に入り" aria-pressed="${isFav}">♥</button>
        <img src="${escAttr(item.image)}" alt="${escAttr(item.title)}"
             loading="lazy"
             onerror="this.src='${PLACEHOLDER_IMG}'">
      </div>
      <div class="rank-info">
        ${item.actress && item.actress.length
          ? `<p class="rank-actress">${escHtml(formatActress(item.actress))}</p>`
          : ''}
        <h3 class="rank-title">${escHtml(item.title)}</h3>
        ${item.maker ? `<p class="card-maker">${escHtml(item.maker)}</p>` : ''}
        ${renderGenreTags(item.genres)}
        <div class="rank-bottom">
          <p class="rank-price">${formatPrice(item.price)}</p>
          ${item.review_avg ? `<span class="rank-review">${formatRating(item.review_avg, item.review_count)}</span>` : ''}
        </div>
      </div>
      <a href="${escAttr(item.url)}" target="_blank" rel="noopener sponsored" class="rank-link">
        動画を見る
      </a>
    </article>
  `;
}

function renderGenreTags(genres) {
  if (!genres || !genres.length) return '';
  return `<div class="genre-tags">${
    genres.slice(0, 3).map(g => `<span class="genre-tag">${escHtml(g)}</span>`).join('')
  }</div>`;
}

// ===== ヘルパー =====
function escHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escAttr(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatActress(actress) {
  if (!actress || !actress.length) return '';
  const names = Array.isArray(actress) ? actress : [actress];
  return names.slice(0, 3).join(' / ');
}

function formatPrice(price) {
  if (!price) return '価格未定';
  const num = parseInt(String(price).replace(/[^0-9]/g, ''));
  if (isNaN(num) || num === 0) return String(price);
  return `¥${num.toLocaleString()}`;
}

function formatRating(avg, count) {
  if (!avg || Number(avg) === 0) return '';
  const score = Math.round(Number(avg) * 10) / 10;
  const full  = Math.floor(score);
  const half  = score - full >= 0.5;
  const empty = 5 - full - (half ? 1 : 0);
  const stars = '★'.repeat(Math.max(0, full))
              + (half ? '½' : '')
              + '☆'.repeat(Math.max(0, empty));
  const countStr = count ? ` (${Number(count).toLocaleString()})` : '';
  return `${stars}${countStr}`;
}

function updateTimestampDisplay(isoStr) {
  const el = document.getElementById('updateTime');
  if (!el) return;
  if (!isoStr) { el.textContent = '—'; return; }
  try {
    const formatter = new Intl.DateTimeFormat('ja-JP', {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
      timeZone: 'Asia/Tokyo',
    });
    el.textContent = formatter.format(new Date(isoStr)) + ' 更新';
  } catch (e) {
    el.textContent = isoStr;
  }
}

// ===== トースト通知 =====
let toastTimer;
function showToast(msg) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2500);
}
