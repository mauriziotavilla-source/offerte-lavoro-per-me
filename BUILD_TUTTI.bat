@echo off
title Build EXE e APK - Lavoro e Concorsi
cd /d "%~dp0"

echo Scegli cosa compilare:
echo   1 = Solo EXE (Windows)
echo   2 = Solo APK (Android)
echo   3 = Entrambi
echo.
set /p SCELTA="Inserisci 1, 2 o 3: "

if "%SCELTA%"=="1" goto exe
if "%SCELTA%"=="2" goto apk
if "%SCELTA%"=="3" goto entrambi
echo Scelta non valida.
pause
exit /b 1

:exe
call desktop\BUILD_EXE.bat
exit /b %errorlevel%

:apk
call mobile\BUILD_APK.bat
exit /b %errorlevel%

:entrambi
call desktop\BUILD_EXE.bat
call mobile\BUILD_APK.bat
exit /b 0
