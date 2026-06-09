@echo off
title Build APK - Lavoro e Concorsi
cd /d "%~dp0"

echo.
echo  ============================================
echo   BUILD APK - Lavoro e Concorsi
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

where java >nul 2>&1
if errorlevel 1 (
  echo  ERRORE: Java JDK non trovato.
  echo  Installa JDK 17+ e Android Studio:
  echo  https://developer.android.com/studio
  pause
  exit /b 1
)

if not exist "android" (
  echo  [0/5] Prima configurazione Android...
  call npm install
  if errorlevel 1 goto errore
  call node copy-www.js
  call npx cap add android
  if errorlevel 1 goto errore
)

echo  [1/5] Icona applicazione (se disponibile)...
if exist "..\scripts\generate-icons.js" (
  cd /d "%~dp0\.."
  cd scripts
  if not exist "node_modules" call npm install
  call node generate-icons.js
  cd /d "%~dp0"
) else (
  echo  (generate-icons.js non presente: uso le icone gia incluse)
)

echo  [2/5] Installazione dipendenze...
call npm install
if errorlevel 1 goto errore

echo.
echo  [3/5] Copia file web...
call node copy-www.js
if errorlevel 1 goto errore

echo.
echo  [4/5] Configurazione Android SDK...
call node scripts\setup-sdk.js
if errorlevel 1 goto errore

echo.
echo  Sincronizzazione progetto Android...
call npx cap sync android
if errorlevel 1 goto errore

echo.
echo  [5/5] Compilazione APK (5-15 minuti la prima volta)...
cd android
set "JAVA_HOME="
if exist "C:\Program Files\Android\Android Studio\jbr" set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
if exist "%ProgramFiles(x86)%\Android\Android Studio\jbr" set "JAVA_HOME=%ProgramFiles(x86)%\Android\Android Studio\jbr"
if exist "%LOCALAPPDATA%\Programs\Android Studio\jbr" set "JAVA_HOME=%LOCALAPPDATA%\Programs\Android Studio\jbr"
set "APK_SRC=app\build\outputs\apk\debug\app-debug.apk"
set "APK_DEST=dist\LavoroConcorsi-1.0.0.apk"
if exist "key.properties" (
  echo  Firma release trovata: genero APK release firmato...
  set "APK_SRC=app\build\outputs\apk\release\app-release.apk"
  call gradlew.bat assembleRelease
) else (
  echo  Firma release non trovata: genero APK debug...
  call gradlew.bat assembleDebug
)
if errorlevel 1 (
  cd ..
  goto errore
)
cd ..

if not exist dist mkdir dist
copy /Y "%APK_SRC%" "%APK_DEST%" >nul

echo.
echo  ============================================
echo   COMPLETATO!
echo   APK creato in:
echo   mobile\%APK_DEST%
echo.
echo   Copia il file sul telefono e installalo.
echo   (Abilita "Origini sconosciute" se richiesto)
echo  ============================================
echo.
pause
exit /b 0

:errore
echo.
echo  Build fallita.
echo  - SDK: apri Android Studio ^> SDK Manager ^> installa "Android SDK Platform 34"
echo  - Se manca local.properties: esegui "node scripts\setup-sdk.js"
echo  - Oppure: npm run open:android e compila da Android Studio
pause
exit /b 1
