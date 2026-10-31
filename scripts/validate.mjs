import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { validateRecords } from '../src/lib.mjs';

export async function loadRecords(path = new URL('../data/records.json', import.meta.url)) {
  const records = JSON.parse(await readFile(path, 'utf8'));
  const errors = validateRecords(records);
  if (errors.length) throw new Error(`主数据校验失败：\n${errors.join('\n')}`);
  return records;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const records = await loadRecords();
    console.log(`校验通过：${records.length} 条${records.some(record => record.demo) ? '虚构示例' : '正式'}记录。`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
