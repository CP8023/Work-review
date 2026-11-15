/* 零依赖本地静态服务器。
   运行：node server.js  然后访问 http://localhost:5173
   说明：Service Worker 需要 localhost 或 https 才能注册。 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const ROOT = __dirname;
const BASE_PORT = Number(process.env.PORT) || 5173;
const HOST = process.env.HOST || '0.0.0.0';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.md': 'text/markdown; charset=utf-8',
  '.woff2': 'font/woff2'
};

function send(res, status, body, headers) {
  res.writeHead(status, Object.assign({
    'Cache-Control': 'no-cache',
    'X-Content-Type-Options': 'nosniff'
  }, headers || {}));
  res.end(body);
}

function createServer() {
  return http.createServer((req, res) => {
    let pathname = '/';
    try {
      pathname = decodeURIComponent((req.url || '/').split('?')[0]);
    } catch (err) {
      send(res, 400, 'Bad Request');
      return;
    }

    if (pathname === '/') pathname = '/index.html';
    const filePath = path.join(ROOT, path.normalize(pathname));
    if (!filePath.startsWith(ROOT)) {
      send(res, 403, 'Forbidden');
      return;
    }

    fs.stat(filePath, (err, stat) => {
      if (err || !stat.isFile()) {
        send(res, 404, 'Not Found');
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      const type = TYPES[ext] || 'application/octet-stream';
      fs.readFile(filePath, (readErr, data) => {
        if (readErr) {
          send(res, 500, 'Internal Server Error');
          return;
        }
        send(res, 200, data, {
          'Content-Type': type,
          'Cache-Control': ext === '.html' || ext === '.js' || ext === '.css' ? 'no-cache' : 'public, max-age=3600'
        });
      });
    });
  });
}

function openBrowser(url) {
  const platform = process.platform;
  if (platform === 'win32') exec('start "" "' + url + '"');
  else if (platform === 'darwin') exec('open "' + url + '"');
  else exec('xdg-open "' + url + '"');
}

function listen(server, port, attempts) {
  server.once('error', (err) => {
    if (err.code === 'EADDRINUSE' && attempts > 0) {
      listen(server, port + 1, attempts - 1);
      return;
    }
    console.error('启动失败：' + err.message);
  });
  server.listen(port, HOST, () => {
    const url = 'http://localhost:' + port + '/';
    console.log('');
    console.log('  工作复盘已启动：' + url);
    console.log('  按 Ctrl + C 停止。数据保存在浏览器本地。');
    console.log('');
    if (process.env.NO_OPEN !== '1') openBrowser(url);
  });
}

listen(createServer(), BASE_PORT, 10);
