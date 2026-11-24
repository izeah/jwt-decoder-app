let countdownInterval;
let globalCache = [];
let currentSearchTerm = '';

function formatTime(timestamp) {
  if (!timestamp) return 'N/A';
  const date = new Date(timestamp * 1000);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getCountdownText(exp) {
  if (!exp) return { text: "No Expiration", expired: false, noExp: true };

  const now = Math.floor(Date.now() / 1000);
  const diff = exp - now;

  if (diff <= 0) return { text: "EXPIRED", expired: true };

  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  const mins = Math.floor((diff % 3600) / 60);
  const secs = diff % 60;

  let text = "Expires in ";
  if (days > 0) text += `${days}d `;
  if (hours > 0) text += `${hours}h `;
  if (mins > 0 || hours > 0) text += `${mins}m `;
  text += `${secs}s`;

  return { text, expired: false };
}

function updateCountdowns() {
  const els = document.querySelectorAll('[data-exp]');
  els.forEach(el => {
    const expAttr = el.getAttribute('data-exp');
    if (!expAttr || expAttr === 'undefined') return;

    const exp = parseInt(expAttr, 10);
    const result = getCountdownText(exp);
    el.textContent = result.text;
    if (result.expired) {
      el.classList.add('expired');
    } else {
      el.classList.remove('expired');
    }
  });
}

function renderJwts(cache) {
  const list = document.getElementById('jwt-list');

  // Filter
  const filtered = cache.filter(item => {
    if (!currentSearchTerm) return true;
    const term = currentSearchTerm.toLowerCase();
    return item.domain.toLowerCase().includes(term) || JSON.stringify(item.fullPayload).toLowerCase().includes(term);
  });

  if (!filtered || filtered.length === 0) {
    list.innerHTML = currentSearchTerm
      ? `<div class="empty-state">No matching JWTs found for "${currentSearchTerm}"</div>`
      : `<div class="empty-state">No JWTs captured yet.<br><small>Browse sites normally. Tokens sent in headers will appear here.</small></div>`;
    return;
  }

  list.innerHTML = '';

  for (let i = 0; i < filtered.length; i++) {
    const item = filtered[i];
    const card = document.createElement('div');
    card.className = 'jwt-card';

    const { text: countdownText, expired, noExp } = getCountdownText(item.exp);
    let countdownClass = 'countdown';
    if (expired) countdownClass += ' expired';
    if (noExp) countdownClass += ' no-exp';

    card.innerHTML = `
      <div class="domain-row">
        <span class="domain">${item.domain}</span>
        <div class="token-container">
          <span class="short-token">${item.shortToken}</span>
          <button class="btn-copy" data-token="${item.token}">Copy</button>
        </div>
      </div>
      <div class="info-row">
        <span>Issued: ${formatTime(item.iat)}</span>
        <span class="${countdownClass}" data-exp="${item.exp}">${countdownText}</span>
      </div>
      <button class="btn-view" data-index="${i}">View Payload</button>
      <pre class="payload" id="payload-${i}">${JSON.stringify(item.fullPayload, null, 2)}</pre>
    `;

    list.appendChild(card);
  }

  // Handle Copy buttons
  document.querySelectorAll('.btn-copy').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const token = e.target.getAttribute('data-token');
      try {
        await navigator.clipboard.writeText(token);
        const originalText = e.target.textContent;
        e.target.textContent = 'Copied!';
        e.target.style.color = '#34d399';
        e.target.style.borderColor = 'rgba(52, 211, 153, 0.3)';
        setTimeout(() => {
          e.target.textContent = originalText;
          e.target.style.color = '';
          e.target.style.borderColor = '';
        }, 1500);
      } catch (err) {
        console.error('Failed to copy: ', err);
      }
    });
  });

  // Handle View Payload buttons
  document.querySelectorAll('.btn-view').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = e.target.getAttribute('data-index');
      const payloadEl = document.getElementById(`payload-${idx}`);
      if (payloadEl.style.display === 'block') {
        payloadEl.style.display = 'none';
        e.target.textContent = 'View Payload';
      } else {
        payloadEl.style.display = 'block';
        e.target.textContent = 'Hide Payload';
      }
    });
  });
}

async function loadData() {
  const result = await chrome.storage.local.get(['jwt_cache']);
  globalCache = result.jwt_cache || [];
  renderJwts(globalCache);
}

document.getElementById('clear-btn').addEventListener('click', async () => {
  await chrome.storage.local.remove('jwt_cache');
  loadData();
});

// Search
document.getElementById('search-input').addEventListener('input', (e) => {
  currentSearchTerm = e.target.value;
  renderJwts(globalCache);
});

// Init
loadData();
countdownInterval = setInterval(updateCountdowns, 1000);
chrome.storage.onChanged.addListener((changes) => {
  if (changes.jwt_cache) {
    loadData();
  }
});
