import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { aggregate_suppliers, aggregate_buyers, filter_by_status, sum_values } from '../tools/aggregate.js';

const mockReleases = [
  {
    ocid: 'ocds-9t57fa-001',
    buyer: { name: 'Dept Health', id: 'dh' },
    tender: { status: 'active', value: { amount: 5000000, currency: 'ZAR' } },
    awards: [
      { value: { amount: 4000000, currency: 'ZAR' }, suppliers: [{ name: 'Acme Ltd', id: 's1' }] },
    ],
    contracts: [{ value: { amount: 4000000, currency: 'ZAR' } }],
  },
  {
    ocid: 'ocds-9t57fa-002',
    buyer: { name: 'SAPS', id: 'saps' },
    tender: { status: 'complete', value: { amount: 12000000, currency: 'ZAR' } },
    awards: [
      { value: { amount: 11000000, currency: 'ZAR' }, suppliers: [{ name: 'Acme Ltd', id: 's1' }] },
      { value: { amount: 500000, currency: 'ZAR' }, suppliers: [{ name: 'Beta Co', id: 's2' }] },
    ],
    contracts: [{ value: { amount: 11000000, currency: 'ZAR' } }],
  },
];

let originalFetch;
before(() => { originalFetch = globalThis.fetch; });
after(() => { globalThis.fetch = originalFetch; });

function mockFetch() {
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => mockReleases,
  });
}

describe('aggregate_suppliers', () => {
  it('tallies award count and total value per supplier', async () => {
    mockFetch();
    const result = await aggregate_suppliers({ pageSize: 10, maxPages: 1 });
    const acme = result.find(s => s.name === 'Acme Ltd');
    assert.equal(acme.awardCount, 2);
    assert.equal(acme.totalValue, 15000000);
  });

  it('sorts by totalValue descending', async () => {
    mockFetch();
    const result = await aggregate_suppliers({ pageSize: 10, maxPages: 1 });
    assert.equal(result[0].name, 'Acme Ltd');
    assert.equal(result[1].name, 'Beta Co');
  });

  it('respects topN param', async () => {
    mockFetch();
    const result = await aggregate_suppliers({ topN: 1, pageSize: 10, maxPages: 1 });
    assert.equal(result.length, 1);
  });
});

describe('aggregate_buyers', () => {
  it('tallies tender count per buyer', async () => {
    mockFetch();
    const result = await aggregate_buyers({ pageSize: 10, maxPages: 1 });
    const health = result.find(b => b.name === 'Dept Health');
    assert.equal(health.tenderCount, 1);
    assert.equal(health.totalValue, 5000000);
  });

  it('sorts by tenderCount descending', async () => {
    mockFetch();
    const result = await aggregate_buyers({ pageSize: 10, maxPages: 1 });
    assert.ok(result.length >= 1);
  });
});

describe('filter_by_status', () => {
  it('returns only releases with matching tender status', async () => {
    mockFetch();
    const result = await filter_by_status({ status: 'active', pageSize: 10, maxPages: 1 });
    assert.equal(result.length, 1);
    assert.equal(result[0].ocid, 'ocds-9t57fa-001');
  });

  it('throws when status is missing', async () => {
    await assert.rejects(() => filter_by_status({}), /Missing required param: status/);
  });
});

describe('sum_values', () => {
  it('sums award values', async () => {
    mockFetch();
    const result = await sum_values({ field: 'awards', pageSize: 10, maxPages: 1 });
    assert.equal(result.total, 15500000);
    assert.equal(result.count, 3);
  });

  it('sums contract values', async () => {
    mockFetch();
    const result = await sum_values({ field: 'contracts', pageSize: 10, maxPages: 1 });
    assert.equal(result.total, 15000000);
  });

  it('throws when field is missing', async () => {
    await assert.rejects(() => sum_values({}), /Missing required param: field/);
  });

  it('throws when field is invalid', async () => {
    await assert.rejects(() => sum_values({ field: 'foo' }), /must be "awards" or "contracts"/);
  });
});
