@echo off
setlocal

cd /d "%~dp0"

echo Starting Kanji Quest...
echo.
echo When Vite says "Local: http://127.0.0.1:5173/", open that address in your browser.
echo To stop the server later, come back to this window and press Ctrl+C.
echo.

npm.cmd run dev -- --host 127.0.0.1

echo.
echo Server stopped.
pause
