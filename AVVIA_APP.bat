@echo off
chcp 65001 >nul
title Lavoro e Concorsi per Me
cd /d "%~dp0"
echo.
echo   Avvio dell'app "Lavoro ^& Concorsi per Me"...
echo   (si aprira' il browser; lascia aperta questa finestra)
echo.
python scripts\avvia_server.py
if errorlevel 1 (
  echo.
  echo   Python non trovato. Installa Python da https://www.python.org/downloads/
  echo   e ricordati di spuntare "Add Python to PATH".
  echo.
  pause
)
