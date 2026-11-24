function base64UrlDecode(str) {
  try {
    let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}

const MAX_TOKENS = 20;

async function saveJwt(domain, tokenString) {
  const parts = tokenString.split('.');
  if (parts.length !== 3) return;

  const payload = base64UrlDecode(parts[1]);
  if (!payload) return; // Cannot decode payload properly

  const result = await chrome.storage.local.get(['jwt_cache']);
  let cache = result.jwt_cache || [];

  const existingIndex = cache.findIndex(item => item.token === tokenString);
  if (existingIndex !== -1) {
    return; // Already cached
  }

  const shortToken = tokenString.substring(0, 15) + '...';

  cache.unshift({
    domain,
    token: tokenString,
    shortToken,
    fullPayload: payload,
    iat: payload.iat,
    exp: payload.exp,
    capturedAt: Date.now()
  });

  if (cache.length > MAX_TOKENS) {
    cache = cache.slice(0, MAX_TOKENS);
  }

  await chrome.storage.local.set({ jwt_cache: cache });
}

chrome.webRequest.onBeforeSendHeaders.addListener(
  (details) => {
    const url = new URL(details.url);
    const domain = url.hostname;

    for (let header of details.requestHeaders) {
      if (header.name.toLowerCase() === 'authorization' && header.value.toLowerCase().startsWith('bearer ey')) {
        const tokenString = header.value.substring(7);
        saveJwt(domain, tokenString).catch(console.error);
      }
    }
    return { requestHeaders: details.requestHeaders };
  },
  { urls: ['<all_urls>'] },
  ['requestHeaders', 'extraHeaders']
);
