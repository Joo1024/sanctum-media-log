import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, readdir, rm } from 'node:fs/promises';
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
    assert.deepEqual((await readdir(output)).sort(), ['.nojekyll', 'app.mjs', 'data', 'favicon.svg', 'index.html', 'lib.mjs', 'styles.css', 'vendor']);
    assert.ok((await readFile(join(output, 'vendor/tabulator/tabulator.min.js'), 'utf8')).length > 10000);
    assert.match(await readFile(join(output, 'vendor/tabulator/LICENSE'), 'utf8'), /MIT/);
    assert.match(await readFile(join(output, 'index.html'), 'utf8'), /\.\/app\.mjs/);
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
