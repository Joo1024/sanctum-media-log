import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve, sep } from 'node:path';
import { loadRecords } from './validate.mjs';

export async function build({ output = new URL('../dist/', import.meta.url), recordsPath } = {}) {
  // 校验成功后才替换生成目录；只复制网站源码和主数据，不扫描或打包备份。
  const records = await loadRecords(recordsPath);
  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });
  await cp(new URL('../src/', import.meta.url), output, { recursive: true });
  const root = output instanceof URL ? output : pathToFileURL(resolve(output) + sep);
  await mkdir(new URL('data/', root), { recursive: true });
  await writeFile(new URL('data/records.json', root), `${JSON.stringify(records, null, 2)}\n`);
  await writeFile(new URL('.nojekyll', root), '');
  return records.length;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(`构建完成：${await build()} 条记录 → dist/`); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
