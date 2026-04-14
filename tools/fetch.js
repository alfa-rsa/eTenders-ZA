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

function defaultDateRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return {
    dateFrom: from.toISOString().slice(0, 10),
    dateTo: to.toISOString().slice(0, 10),
  };
}

function matchesKeyword(release, keyword) {
  const text = [
    release.tender?.title ?? '',
    release.tender?.description ?? '',
  ].join(' ').toLowerCase();
  return text.includes(keyword.toLowerCase());
}

function matchesProvince(release, province) {
  return release.tender?.province?.toLowerCase() === province.toLowerCase();
}

function applyFilters(releases, params) {
  let result = releases;
  if (params.province) {
    result = result.filter(r => matchesProvince(r, params.province));
  }
  if (params.keyword) {
    result = result.filter(r => matchesKeyword(r, params.keyword));
  }
  return result;
}

export async function fetch_releases(params = {}) {
  const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE;
  const maxPages = params.maxPages ?? DEFAULT_MAX_PAGES;
  const startPage = params.pageNumber ?? 1;
  const { dateFrom, dateTo } = {
    ...defaultDateRange(),
    ...(params.dateFrom ? { dateFrom: params.dateFrom } : {}),
    ...(params.dateTo ? { dateTo: params.dateTo } : {}),
  };

  const releases = [];
  for (let page = startPage; page < startPage + maxPages; page++) {
    const url = new URL('/api/OCDSReleases', BASE_URL);
    url.searchParams.set('PageNumber', String(page));
    url.searchParams.set('PageSize', String(pageSize));
    url.searchParams.set('dateFrom', dateFrom);
    url.searchParams.set('dateTo', dateTo);

    const res = await fetchWithRetry(url.toString());
    const text = await res.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      throw new Error(`API returned non-JSON response: ${text.slice(0, 200)}`);
    }
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
  return applyFilters(releases, { province: params.province, keyword: params.keyword });
}

export async function fetch_release_by_ocid(params = {}) {
  if (!params.ocid) throw new Error('Missing required param: ocid');
  const url = `${BASE_URL}/api/OCDSReleases/release/${encodeURIComponent(params.ocid)}`;
  const res = await fetchWithRetry(url);
  return res.json();
}
