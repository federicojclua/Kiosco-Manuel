@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul
echo ==============================================
echo   KIOSCO MANUEL - Generador de APK
echo ==============================================
echo.

cd /d C:\Users\Federico\Downloads\kiosco-manuel-react-app

echo [1/4] Compilando la web con Vite...
call npm run build
if errorlevel 1 (
  echo.
  echo ERROR: fallo "npm run build".
  pause
  exit /b 1
)

echo.
echo [2/4] Sincronizando web con Android (Capacitor)...
call npx cap sync android
if errorlevel 1 (
  echo.
  echo ERROR: fallo "npx cap sync android".
  pause
  exit /b 1
)

set "JAVA_HOME=C:\Users\Federico\AppData\Local\Jdk\jdk-21.0.12.1+1"
set "ANDROID_HOME=C:\Users\Federico\AppData\Local\Android\Sdk"

echo.
echo [3/4] Generando APK con Gradle...
cd /d C:\Users\Federico\Downloads\kiosco-manuel-react-app\android
call gradlew.bat assembleDebug --no-daemon
if errorlevel 1 (
  echo.
  echo ERROR: fallo la compilacion del APK.
  pause
  exit /b 1
)

echo.
echo [4/4] Copiando el APK a Descargas...
for /f "delims=" %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd_HHmm"') do set "stamp=%%i"
copy /y "C:\Users\Federico\Downloads\kiosco-manuel-react-app\android\app\build\outputs\apk\debug\app-debug.apk" "C:\Users\Federico\Downloads\Kiosco-Manuel-%stamp%.apk" >nul

echo.
echo ==============================================
echo   LISTO! APK generado en Descargas:
echo   Kiosco-Manuel-%stamp%.apk
echo.
echo   Mandaselo a Manuel por WhatsApp y que lo
echo   reinstale (desinstalar la version vieja primero).
echo ==============================================
echo.
pause
