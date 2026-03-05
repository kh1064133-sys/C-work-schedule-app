@echo off
chcp 65001 >nul
title 일정매출관리 서버
cd /d "%~dp0"
echo.
echo  ╔══════════════════════════════════╗
echo  ║   일정매출관리 앱 시작 중...     ║
echo  ╚══════════════════════════════════╝
echo.
timeout /t 2 /nobreak >nul
start "" http://localhost:3000
npm run dev
