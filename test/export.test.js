import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { export_csv, export_json } from '../tools/export.js';

const tmpCsv = join(tmpdir(), 'etenders_test.csv');
const tmpJson = join(tmpdir(), 'etenders_test.json');
const tmpInput = join(tmpdir(), 'etenders_input.json');

after(() => {
  [tmpCsv, tmpJson, tmpInput].forEach(f => { if (existsSync(f)) unlinkSync(f); });
});

const sampleData = [
  { name: 'Acme Ltd', awardCount: 2, totalValue: 5000 },
  { name: 'Beta Co', awardCount: 1, totalValue: 2000 },
];

describe('export_csv', () => {
  it('writes a valid CSV file from inline data', async () => {
    const result = await export_csv({ filename: tmpCsv, data: sampleData });
    assert.equal(result.filename, tmpCsv);
    assert.equal(result.rows, 2);
    const content = readFileSync(tmpCsv, 'utf8');
    assert.ok(content.includes('name,awardCount,totalValue'));
    assert.ok(content.includes('Acme Ltd'));
  });

  it('writes a valid CSV file from inputFile', async () => {
    writeFileSync(tmpInput, JSON.stringify(sampleData));
    const result = await export_csv({ filename: tmpCsv, inputFile: tmpInput });
    assert.equal(result.rows, 2);
  });

  it('throws when filename is missing', async () => {
    await assert.rejects(() => export_csv({ data: sampleData }), /Missing required param: filename/);
  });

  it('throws when neither data nor inputFile is provided', async () => {
    await assert.rejects(() => export_csv({ filename: tmpCsv }), /data.*inputFile/);
  });
});

describe('export_json', () => {
  it('writes a valid JSON file from inline data', async () => {
    const result = await export_json({ filename: tmpJson, data: sampleData });
    assert.equal(result.rows, 2);
    const parsed = JSON.parse(readFileSync(tmpJson, 'utf8'));
    assert.equal(parsed[0].name, 'Acme Ltd');
  });

  it('throws when filename is missing', async () => {
    await assert.rejects(() => export_json({ data: sampleData }), /Missing required param: filename/);
  });

  it('throws when neither data nor inputFile is provided', async () => {
    await assert.rejects(() => export_json({ filename: tmpJson }), /data.*inputFile/);
  });

  it('writes a valid JSON file from inputFile', async () => {
    writeFileSync(tmpInput, JSON.stringify(sampleData));
    const result = await export_json({ filename: tmpJson, inputFile: tmpInput });
    assert.equal(result.rows, 2);
  });
});