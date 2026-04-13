// tools/aggregate.js
import { fetch_releases } from './fetch.js';

export async function aggregate_suppliers(params = {}) {
  const releases = await fetch_releases(params);
  const topN = params.topN ?? 10;
  const map = new Map();

  for (const release of releases) {
    for (const award of release.awards ?? []) {
      for (const supplier of award.suppliers ?? []) {
        const name = supplier.name ?? supplier.id ?? 'Unknown';
        const prev = map.get(name) ?? { name, awardCount: 0, totalValue: 0, currency: 'ZAR' };
        map.set(name, {
          name,
          awardCount: prev.awardCount + 1,
          totalValue: prev.totalValue + (award.value?.amount ?? 0),
          currency: award.value?.currency ?? prev.currency,
        });
      }
    }
  }

  return [...map.values()]
    .sort((a, b) => b.totalValue - a.totalValue)
    .slice(0, topN);
}

export async function aggregate_buyers(params = {}) {
  const releases = await fetch_releases(params);
  const topN = params.topN ?? 10;
  const map = new Map();

  for (const release of releases) {
    if (!release.buyer) continue;
    const name = release.buyer.name ?? release.buyer.id ?? 'Unknown';
    const prev = map.get(name) ?? { name, tenderCount: 0, totalValue: 0, currency: 'ZAR' };
    map.set(name, {
      name,
      tenderCount: prev.tenderCount + 1,
      totalValue: prev.totalValue + (release.tender?.value?.amount ?? 0),
      currency: release.tender?.value?.currency ?? prev.currency,
    });
  }

  return [...map.values()]
    .sort((a, b) => b.tenderCount - a.tenderCount)
    .slice(0, topN);
}

export async function filter_by_status(params = {}) {
  if (!params.status) throw new Error('Missing required param: status');
  const releases = await fetch_releases(params);
  return releases.filter(r => r.tender?.status === params.status);
}

export async function sum_values(params = {}) {
  if (!params.field) throw new Error('Missing required param: field');
  if (params.field !== 'awards' && params.field !== 'contracts') {
    throw new Error('param "field" must be "awards" or "contracts"');
  }
  const releases = await fetch_releases(params);
  let total = 0;
  let currency = 'ZAR';
  let count = 0;

  for (const release of releases) {
    for (const item of release[params.field] ?? []) {
      total += item.value?.amount ?? 0;
      currency = item.value?.currency ?? currency;
      count++;
    }
  }

  return { total, currency, count };
}
