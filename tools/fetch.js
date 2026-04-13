// tools/fetch.js
import { BASE_URL, DEFAULT_PAGE_SIZE, DEFAULT_MAX_PAGES, REQUEST_TIMEOUT_MS } from '../config.js';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithRetry(url, attempt = 0) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let res;
  try {
    res = await fetch(url, { signal: controller.signal });
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') throw new Error('Request timed out');
    throw new Error(`Network error: ${err.message}`);
  }
  clearTimeout(timer);
  if (res.status === 429 && attempt < 3) {
    await sleep(1000 * Math.pow(2, attempt));
    return fetchWithRetry(url, attempt + 1);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res;
}

export async function fetch_releases(params = {}) {
  const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE;
  const maxPages = params.maxPages ?? DEFAULT_MAX_PAGES;
  const startPage = params.pageNumber ?? 1;

  const releases = [];
  for (let page = startPage; page < startPage + maxPages; page++) {
    const url = new URL('/api/OCDSReleases', BASE_URL);
    url.searchParams.set('PageNumber', String(page));
    url.searchParams.set('PageSize', String(pageSize));
    if (params.dateFrom) url.searchParams.set('dateFrom', params.dateFrom);
    if (params.dateTo) url.searchParams.set('dateTo', params.dateTo);

    const res = await fetchWithRetry(url.toString());
    const body = await res.json();
    let items;
    if (Array.isArray(body)) {
      items = body;
    } else if (Array.isArray(body?.releases)) {
      items = body.releases;
    } else if (Array.isArray(body?.data)) {
      items = body.data;
    } else {
      throw new Error(`Unexpected API response shape: ${JSON.stringify(body).slice(0, 200)}`);
    }
    releases.push(...items);
    if (items.length < pageSize) break;
  }
  return releases;
}

export async function fetch_release_by_ocid(params = {}) {
  if (!params.ocid) throw new Error('Missing required param: ocid');
  const url = `${BASE_URL}/api/OCDSReleases/release/${encodeURIComponent(params.ocid)}`;
  const res = await fetchWithRetry(url);
  return res.json();
}
