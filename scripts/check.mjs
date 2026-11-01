import { readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
export async function checkSyntax(directory) {
  const root = directory instanceof URL ? fileURLToPath(directory) : directory;
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || ['node_modules', 'dist', 'test-results', 'playwright-report'].includes(entry.name)) continue;
    const path = join(root, entry.name);
    if (entry.isDirectory()) await checkSyntax(path);
    else if (/\.(?:mjs|js)$/.test(entry.name)) {
      try { await run(process.execPath, ['--check', path]); }
      catch (error) { throw new Error(`JavaScript 语法检查失败：${path}\n${error.stderr}`, { cause: error }); }
    }
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { await checkSyntax(new URL('../', import.meta.url)); console.log('JavaScript 语法检查通过。'); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
