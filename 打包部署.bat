@echo off
setlocal
set OUT=dist

if exist "%OUT%" rmdir /s /q "%OUT%"
mkdir "%OUT%"

copy /y index.html "%OUT%\" >nul
copy /y manifest.webmanifest "%OUT%\" >nul
copy /y sw.js "%OUT%\" >nul
copy /y .nojekyll "%OUT%\" >nul
xcopy /s /e /i /y css "%OUT%\css" >nul
xcopy /s /e /i /y js "%OUT%\js" >nul
xcopy /s /e /i /y icons "%OUT%\icons" >nul

if exist deploy.zip del /q deploy.zip
powershell -NoProfile -ExecutionPolicy Bypass -File "tools\make_zip.ps1"

echo.
echo [OK] Build finished: folder dist\ and file deploy.zip
echo Upload the CONTENTS of dist\ (or unzip deploy.zip) to your HTTPS host,
echo then open the URL on your phone and choose "Add to Home screen".
echo Step-by-step guide: the mobile guide markdown file in this folder.
echo.
if /i not "%SKIP_PAUSE%"=="1" pause
