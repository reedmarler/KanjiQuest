@echo off
setlocal
cd /d "%~dp0"

REM Builds the app's voice audio start to finish: starts the TTS service,
REM renders the vocabulary and a batch of hero sentences, and banks the
REM result into public\audio. Close this window at any point to stop.

echo ============================================
echo   Kanji Quest - build the voice library
echo ============================================
echo.

if "%TTS_API_KEY%"=="" (
  set /p TTS_API_KEY="ElevenLabs API key (starts sk_): "
)
if "%TTS_DEFAULT_VOICE%"=="" (
  set /p TTS_DEFAULT_VOICE="Voice ID from the ElevenLabs dashboard: "
)

set TTS_PROVIDER=elevenlabs
REM Half the credits of multilingual_v2, and fine for short lines.
if "%TTS_MODEL_ID%"=="" set TTS_MODEL_ID=eleven_flash_v2_5
REM Safety net: the service refuses to spend past this in a month.
if "%TTS_MONTHLY_CHARACTER_BUDGET%"=="" set TTS_MONTHLY_CHARACTER_BUDGET=30000
REM Lets the last step read finished clips back out of the service.
if "%TTS_ADMIN_TOKEN%"=="" set TTS_ADMIN_TOKEN=local-build-token
set TTS_CACHE_ONLY=false
REM The build asks for thousands of clips in a row from one machine, and every
REM one is a cache miss. The service's public default is 20 requests a minute,
REM which would 429 nearly all of them — and the render scripts count a 429 as
REM a failed clip rather than retrying it. Safe to lift here: the service is
REM bound to 127.0.0.1 for the length of the build.
if "%TTS_RATE_LIMIT_REQUESTS%"=="" set TTS_RATE_LIMIT_REQUESTS=100000
REM Render under the chosen voice's own cache key. Left empty, every clip is
REM keyed as "" instead, so a later build in a second voice replays this
REM voice's cached audio — and the manifest records the voice it was built in.
set TTS_VOICE_ID=%TTS_DEFAULT_VOICE%

echo.
echo Setting up the TTS service...
cd backend\tts_service
if not exist .venv (
  python -m venv .venv
  call .venv\Scripts\activate.bat
  REM No torch: the local engine is only imported if you ask for it.
  pip install -r requirements-hosted.txt
) else (
  call .venv\Scripts\activate.bat
)

echo Starting the service in a second window...
start "Kanji Quest TTS" cmd /c ".venv\Scripts\activate.bat && uvicorn app:app --host 127.0.0.1 --port 8001"
cd ..\..

echo Waiting for it to come up...
set READY=
for /l %%i in (1,1,30) do (
  if not defined READY (
    curl -s -o nul http://127.0.0.1:8001/health && set READY=1
    if not defined READY timeout /t 2 /nobreak >nul
  )
)
if not defined READY (
  echo.
  echo The service did not start. Check the "Kanji Quest TTS" window for the error.
  pause
  exit /b 1
)

echo.
call npm run build:voice

echo.
echo Close the "Kanji Quest TTS" window when you are done.
pause
