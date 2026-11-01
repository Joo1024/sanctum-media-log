import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, readdir, cp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from '../scripts/build.mjs';
import { loadRecords } from '../scripts/validate.mjs';

test('构建空数组可用，输出只包含网站源码和主数据，不复制私有备份', async () => {
  const temporary = await mkdtemp(join(tmpdir(), 'media-log-test-'));
  try {
    const source = join(temporary, 'records.json');
    const output = join(temporary, 'output');
    await writeFile(source, '[]');
    assert.equal(await build({ output, recordsPath: source }), 0);
    assert.deepEqual(JSON.parse(await readFile(join(output, 'data/records.json'), 'utf8')), []);
    const sourceFiles = await readdir(new URL('../src/', import.meta.url), { recursive: true });
    for (const file of sourceFiles) assert.ok((await readdir(output, { recursive: true })).includes(file), file);
    assert.ok((await readdir(output)).includes('.nojekyll'));
    for (const privateName of ['imports', 'backups', 'private', '.git']) assert.ok(!(await readdir(output)).includes(privateName));
    assert.match(await readFile(join(output, 'vendor/tabulator/LICENSE'), 'utf8'), /MIT/);
    const page = await readFile(join(output, 'index.html'), 'utf8');
    assert.match(page, /\.\/app\.mjs/);
    assert.match(page, /<title>sanctum-media-log<\/title>/);
    assert.match(page, /<h1>sanctum-media-log<\/h1>/);
    await writeFile(join(output, 'sentinel'), '保留上一次构建');
    await writeFile(source, '[{}]');
    await assert.rejects(build({ output, recordsPath: source }), /主数据校验失败/);
    assert.equal(await readFile(join(output, 'sentinel'), 'utf8'), '保留上一次构建');
  } finally { await rm(temporary, { recursive: true, force: true }); }
});

test('主数据可读取；存在示例时必须全部明确标记', async () => {
  const records = await loadRecords();
  // 正式数据接入后仍可使用本测试；不锁定条数、标题或示例模式。
  assert.ok(Array.isArray(records));
  if (records.some(record => record.demo)) assert.ok(records.every(record => record.demo === true));
});

test('前端语法错误会阻止构建，并保留上一次输出；新增源码无需同步测试文件清单', async () => {
  const temporary = await mkdtemp(join(tmpdir(), 'media-log-syntax-'));
  try {
    const source = join(temporary, 'src');
    const output = join(temporary, 'output');
    await cp(new URL('../src/', import.meta.url), source, { recursive: true });
    await writeFile(join(source, 'extra.mjs'), 'export const extra = true;');
    await build({ source, output });
    assert.equal(await readFile(join(output, 'extra.mjs'), 'utf8'), 'export const extra = true;');
    await writeFile(join(source, 'app.mjs'), 'const = ;');
    await assert.rejects(build({ source, output }), /JavaScript 语法检查失败/);
    assert.match(await readFile(join(output, 'app.mjs'), 'utf8'), /Tabulator/);
  } finally { await rm(temporary, { recursive: true, force: true }); }
});
