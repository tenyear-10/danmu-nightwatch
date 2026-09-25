import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, extname, resolve, sep } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../dist');
const port = Number(process.env.PORT || 4173);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url || '/', 'http://127.0.0.1');
    const pathname = decodeURIComponent(url.pathname);
    const target = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (target !== root && !target.startsWith(root + sep)) { response.writeHead(403); response.end('Forbidden'); return; }
    const data = await readFile(target);
    response.writeHead(200, { 'Content-Type': types[extname(target)] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
    response.end(data);
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('未找到文件。首次使用请先构建 dist 目录。');
  }
});
server.on('error', error => { console.error(error.code === 'EADDRINUSE' ? `端口 ${port} 已被占用，请打开已有预览，或设置 PORT 使用其他端口。` : error.message); process.exitCode = 1; });
server.listen(port, '127.0.0.1', () => console.log(`\n弹幕守夜城已启动：http://127.0.0.1:${port}/\n在浏览器打开此地址。保持本窗口运行，按 Ctrl+C 停止。\n`));
