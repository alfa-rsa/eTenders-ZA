import { stringify } from 'csv-stringify/sync';
import { writeFileSync, readFileSync } from 'node:fs';

export async function export_csv(params = {}) {
  if (!params.filename) throw new Error('Missing required param: filename');
  if (params.data == null && !params.inputFile) {
    throw new Error('One of "data" or "inputFile" is required');
  }
  const data = params.data ?? JSON.parse(readFileSync(params.inputFile, 'utf8'));
  const csv = stringify(data, { header: true });
  writeFileSync(params.filename, csv, 'utf8');
  return { filename: params.filename, rows: Array.isArray(data) ? data.length : 1 };
}

export async function export_json(params = {}) {
  if (!params.filename) throw new Error('Missing required param: filename');
  if (params.data == null && !params.inputFile) {
    throw new Error('One of "data" or "inputFile" is required');
  }
  const data = params.data ?? JSON.parse(readFileSync(params.inputFile, 'utf8'));
  writeFileSync(params.filename, JSON.stringify(data, null, 2), 'utf8');
  return { filename: params.filename, rows: Array.isArray(data) ? data.length : 1 };
}