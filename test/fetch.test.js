import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { fetch_releases, fetch_release_by_ocid } from '../tools/fetch.js';

const mockReleases = [
  { ocid: 'ocds-9t57fa-001', buyer: { name: 'Dept A' }, tender: { status: 'active', value: { amount: 1000, currency: 'ZAR' } }, awards: [] },
  { ocid: 'ocds-9t57fa-002', buyer: { name: 'Dept B' }, tender: { status: 'complete', value: { amount: 2000, currency: 'ZAR' } }, awards: [] },
];

let originalFetch;

before(() => {
  originalFetch = globalThis.fetch;
});

after(() => {
  globalThis.fetch = originalFetch;
});

describe('fetch_releases', () => {
  it('returns releases from first page', async () => {
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => mockReleases,
    });

    const result = await fetch_releases({ pageSize: 2, maxPages: 1 });
    assert.equal(result.length, 2);
    assert.equal(result[0].ocid, 'ocds-9t57fa-001');
  });

  it('stops paginating when page returns fewer items than pageSize', async () => {
    let callCount = 0;
    globalThis.fetch = async () => {
      callCount++;
      // First page returns 2 items against pageSize 10 — stops immediately, no second call
      return {
        ok: true,
        status: 200,
        json: async () => mockReleases,
      };
    };

    await fetch_releases({ pageSize: 10, maxPages: 5 });
    assert.equal(callCount, 1);
  });

  it('stops paginating on partial page without extra request', async () => {
    let callCount = 0;
    globalThis.fetch = async () => {
      callCount++;
      return {
        ok: true,
        status: 200,
        json: async () => mockReleases.slice(0, 1), // 1 item < pageSize of 10
      };
    };

    const result = await fetch_releases({ pageSize: 10, maxPages: 5 });
    assert.equal(callCount, 1);
    assert.equal(result.length, 1);
  });

  it('throws on HTTP error', async () => {
    globalThis.fetch = async () => ({ ok: false, status: 500 });
    await assert.rejects(() => fetch_releases(), /HTTP 500/);
  });
});

describe('fetch_release_by_ocid', () => {
  it('fetches a single release by ocid', async () => {
    globalThis.fetch = async (url) => {
      assert.ok(url.includes('ocds-9t57fa-001'));
      return { ok: true, status: 200, json: async () => mockReleases[0] };
    };

    const result = await fetch_release_by_ocid({ ocid: 'ocds-9t57fa-001' });
    assert.equal(result.ocid, 'ocds-9t57fa-001');
  });

  it('throws when ocid is missing', async () => {
    await assert.rejects(() => fetch_release_by_ocid({}), /Missing required param: ocid/);
  });

  it('throws on 404', async () => {
    globalThis.fetch = async () => ({ ok: false, status: 404 });
    await assert.rejects(() => fetch_release_by_ocid({ ocid: 'bad' }), /HTTP 404/);
  });
});
