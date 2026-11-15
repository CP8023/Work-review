@echo off
chcp 65001 >nul
cd /d "%~dp0"

where node >nul 2>nul
if %errorlevel%==0 (
  node server.js
  goto :end
)

where python >nul 2>nul
if %errorlevel%==0 (
  echo 未检测到 Node.js，改用 Python 启动本地服务...
  start "" "http://localhost:5173/"
  python -m http.server 5173
  goto :end
)

echo 未检测到 Node.js 或 Python。
echo 请安装 Node.js（https://nodejs.org）后重试，
echo 或者直接在浏览器中打开 index.html（此方式无法安装为应用）。
pause

:end
