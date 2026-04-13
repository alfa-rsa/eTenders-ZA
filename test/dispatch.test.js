import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

function run(args) {
  try {
    const stdout = execFileSync(
      process.execPath,
      [join(projectRoot, 'etenders.js'), ...args],
      { encoding: 'utf8' }
    );
    return { stdout, code: 0 };
  } catch (err) {
    return { stdout: err.stdout ?? '', code: err.status ?? 1 };
  }
}

describe('CLI dispatch', () => {
  it('returns error JSON for unknown tool', () => {
    const { stdout, code } = run(['not_a_tool', '{}']);
    const res = JSON.parse(stdout);
    assert.equal(res.ok, false);
    assert.ok(res.error.includes('Unknown tool'));
    assert.equal(code, 1);
  });

  it('returns error JSON for invalid JSON params', () => {
    const { stdout, code } = run(['fetch_releases', 'not-json']);
    const res = JSON.parse(stdout);
    assert.equal(res.ok, false);
    assert.ok(res.error.includes('Invalid JSON'));
    assert.equal(code, 1);
  });

  it('returns error JSON when no tool name given', () => {
    const { stdout, code } = run([]);
    const res = JSON.parse(stdout);
    assert.equal(res.ok, false);
    assert.equal(code, 1);
  });
});
