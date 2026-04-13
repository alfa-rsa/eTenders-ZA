// etenders.js
import { fetch_releases, fetch_release_by_ocid } from './tools/fetch.js';
import { aggregate_suppliers, aggregate_buyers, filter_by_status, sum_values } from './tools/aggregate.js';
import { export_csv, export_json } from './tools/export.js';

const TOOLS = {
  fetch_releases,
  fetch_release_by_ocid,
  aggregate_suppliers,
  aggregate_buyers,
  filter_by_status,
  sum_values,
  export_csv,
  export_json,
};

async function main() {
  const [,, toolName, paramsJson] = process.argv;

  function fail(message) {
    process.stderr.write(message + '\n');
    process.stdout.write(JSON.stringify({ ok: false, error: message }) + '\n');
    process.exit(1);
  }

  if (!toolName) return fail('Usage: node etenders.js <toolName> [jsonParams]');

  const tool = TOOLS[toolName];
  if (!tool) return fail(`Unknown tool: ${toolName}`);

  let params = {};
  if (paramsJson) {
    try {
      params = JSON.parse(paramsJson);
    } catch {
      return fail('Invalid JSON params');
    }
  }

  try {
    const data = await tool(params);
    process.stdout.write(JSON.stringify({ ok: true, data }) + '\n');
    process.exit(0);
  } catch (err) {
    process.stderr.write((err.stack ?? err.message) + '\n');
    process.stdout.write(JSON.stringify({ ok: false, error: err.message }) + '\n');
    process.exit(1);
  }
}

main();
