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
    // Use a fetch mock that returns 3 releases from Dept Health and 1 from SAPS
    const multiReleases = [
      { ocid: '001', buyer: { name: 'Dept Health' }, tender: { status: 'active', value: { amount: 1000, currency: 'ZAR' } }, awards: [] },
      { ocid: '002', buyer: { name: 'Dept Health' }, tender: { status: 'active', value: { amount: 2000, currency: 'ZAR' } }, awards: [] },
      { ocid: '003', buyer: { name: 'Dept Health' }, tender: { status: 'active', value: { amount: 3000, currency: 'ZAR' } }, awards: [] },
      { ocid: '004', buyer: { name: 'SAPS' }, tender: { status: 'active', value: { amount: 5000, currency: 'ZAR' } }, awards: [] },
    ];
    globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => multiReleases });
    const result = await aggregate_buyers({ pageSize: 10, maxPages: 1 });
    assert.equal(result[0].name, 'Dept Health');
    assert.equal(result[0].tenderCount, 3);
    assert.equal(result[1].name, 'SAPS');
    assert.equal(result[1].tenderCount, 1);
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

describe('edge cases', () => {
  it('aggregate_suppliers handles releases with no awards', async () => {
    globalThis.fetch = async () => ({
      ok: true, status: 200,
      json: async () => [{ ocid: 'x', buyer: { name: 'Dept A' }, tender: { status: 'active' }, awards: [] }],
    });
    const result = await aggregate_suppliers({ pageSize: 10, maxPages: 1 });
    assert.deepEqual(result, []);
  });

  it('aggregate_buyers handles releases with no buyer field', async () => {
    globalThis.fetch = async () => ({
      ok: true, status: 200,
      json: async () => [{ ocid: 'x', tender: { status: 'active' }, awards: [] }],
    });
    const result = await aggregate_buyers({ pageSize: 10, maxPages: 1 });
    assert.deepEqual(result, []);
  });

  it('aggregate_suppliers handles missing award value gracefully', async () => {
    globalThis.fetch = async () => ({
      ok: true, status: 200,
      json: async () => [{
        ocid: 'x',
        buyer: { name: 'Dept A' },
        tender: { status: 'active' },
        awards: [{ suppliers: [{ name: 'No Value Co' }] }], // no value field
      }],
    });
    const result = await aggregate_suppliers({ pageSize: 10, maxPages: 1 });
    assert.equal(result[0].name, 'No Value Co');
    assert.equal(result[0].totalValue, 0);
  });

  it('aggregate_suppliers falls back to "Unknown" for supplier with no name or id', async () => {
    globalThis.fetch = async () => ({
      ok: true, status: 200,
      json: async () => [{
        ocid: 'x', buyer: { name: 'Dept A' }, tender: { status: 'active' },
        awards: [{ value: { amount: 100, currency: 'ZAR' }, suppliers: [{}] }],
      }],
    });
    const result = await aggregate_suppliers({ pageSize: 10, maxPages: 1 });
    assert.equal(result[0].name, 'Unknown');
  });

  it('filter_by_status returns empty array when nothing matches', async () => {
    globalThis.fetch = async () => ({
      ok: true, status: 200,
      json: async () => [{ ocid: 'x', tender: { status: 'complete' }, awards: [] }],
    });
    const result = await filter_by_status({ status: 'active', pageSize: 10, maxPages: 1 });
    assert.deepEqual(result, []);
  });

  it('sum_values returns zero total for releases with no matching field items', async () => {
    globalThis.fetch = async () => ({
      ok: true, status: 200,
      json: async () => [{ ocid: 'x', tender: { status: 'active' }, awards: [], contracts: [] }],
    });
    const result = await sum_values({ field: 'awards', pageSize: 10, maxPages: 1 });
    assert.equal(result.total, 0);
    assert.equal(result.count, 0);
  });

  it('aggregate_suppliers respects default topN of 10', async () => {
    // Create 15 unique suppliers
    const manySuppliers = Array.from({ length: 15 }, (_, i) => ({
      ocid: `ocds-${i}`,
      buyer: { name: 'Dept' },
      tender: { status: 'active' },
      awards: [{ value: { amount: (15 - i) * 1000, currency: 'ZAR' }, suppliers: [{ name: `Supplier ${i}` }] }],
      contracts: [],
    }));
    globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => manySuppliers });
    const result = await aggregate_suppliers({ pageSize: 20, maxPages: 1 }); // no topN param
    assert.equal(result.length, 10);
  });
});
