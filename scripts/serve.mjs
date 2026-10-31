import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { extname, resolve, sep } from 'node:path';
import { loadRecords } from './validate.mjs';

const preview = process.argv.includes('--preview');
const portArg = process.argv.indexOf('--port');
const port = portArg >= 0 ? Number(process.argv[portArg + 1]) : 4321;
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('端口必须是 1–65535 的整数。');
const root = resolve(fileURLToPath(new URL(preview ? '../dist/' : '../src/', import.meta.url)));
const dataPath = new URL('../data/records.json', import.meta.url);
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml' };
const server = createServer(async (request, response) => {
  if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405); response.end(); return; }
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    let body;
    if (!preview && pathname === '/data/records.json') {
      await loadRecords(dataPath);
      body = await readFile(dataPath);
    } else {
      const path = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
      if (!path.startsWith(root + sep)) { response.writeHead(403); response.end(); return; }
      body = await readFile(path);
    }
    response.writeHead(200, { 'Content-Type': mime[extname(pathname)] || (pathname === '/' ? mime['.html'] : 'application/octet-stream'), 'Cache-Control': 'no-store' });
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch (error) {
    response.writeHead(['ENOENT', 'EISDIR'].includes(error.code) ? 404 : 500, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end(error.code === 'ENOENT' ? '页面不存在' : '读取失败，请在终端检查数据校验结果。');
    if (!['ENOENT', 'EISDIR'].includes(error.code)) console.error(error.message);
  }
});
server.on('error', error => { console.error(`启动失败：${error.message}`); process.exitCode = 1; });
server.listen(port, '127.0.0.1', () => console.log(`${preview ? '构建预览' : '开发预览'}：http://127.0.0.1:${port}\n${preview ? '预览 dist/ 构建产物。' : '修改数据或源码后刷新浏览器即可。'}`));
