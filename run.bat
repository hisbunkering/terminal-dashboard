@echo off
chcp 65001 >nul
cd /d "%~dp0"
title 광양터미널 운영 대시보드

where node >nul 2>nul
if errorlevel 1 (
  echo [오류] Node.js가 설치되어 있지 않습니다. https://nodejs.org 에서 설치 후 다시 실행하세요.
  pause
  exit /b 1
)

if not exist node_modules (
  echo [1/2] 패키지를 설치합니다. 처음 한 번만 걸립니다...
  call npm install
  if errorlevel 1 (
    echo [오류] 패키지 설치에 실패했습니다.
    pause
    exit /b 1
  )
)

echo [2/2] 대시보드를 시작합니다. 브라우저가 자동으로 열립니다. (종료: Ctrl+C)
call npm run dev
pause
