@echo off
title Build EXE - Lavoro e Concorsi
cd /d "%~dp0"

echo.
echo  ============================================
echo   BUILD EXE - Lavoro e Concorsi
echo   Copyright 2026 Maurizio Tavilla
echo  ============================================
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo  ERRORE: Node.js non installato.
  echo  Scarica da: https://nodejs.org/
  pause
  exit /b 1
)

echo  [1/4] Icona applicazione...
cd /d "%~dp0\.."
if exist "assets\icon.png" (
  cd scripts
  if not exist "node_modules" call npm install
  call node generate-icons.js
  cd /d "%~dp0"
)

echo  [2/4] Installazione dipendenze...
call npm install
if errorlevel 1 goto errore

echo.
echo  [3/4] Copia file applicazione...
call node copy-app.js
if errorlevel 1 goto errore

echo.
echo  [4/4] Creazione file .exe (puo richiedere alcuni minuti)...
set CSC_IDENTITY_AUTO_DISCOVERY=false
call npm run build:exe
if errorlevel 1 goto errore

if not exist "..\dist" mkdir "..\dist"
if exist "dist\LavoroConcorsi-1.0.0-Portable.exe" (
  copy /Y "dist\LavoroConcorsi-1.0.0-Portable.exe" "..\dist\LavoroConcorsi.exe" >nul
)

echo.
echo  ============================================
echo   COMPLETATO!
echo   File creato in: desktop\dist\
echo   Nome: LavoroConcorsi-1.0.0-Portable.exe
echo   Copia anche in: dist\LavoroConcorsi.exe
echo  ============================================
echo.
pause
exit /b 0

:errore
echo.
echo  Build fallita. Controlla i messaggi sopra.
pause
exit /b 1
