@echo off
setlocal

cd /d "%~dp0"
set "DEPLOY_SCRIPT=%~dp0..\automation\deploy_web_code_and_r2.ps1"

if not exist "%DEPLOY_SCRIPT%" (
  echo ERROR: No existe el script de deploy:
  echo   %DEPLOY_SCRIPT%
  goto end
)

echo ===============================================
echo   BMR - Deploy diario web + datos (Cloudflare)
echo ===============================================
echo.
echo 1^) DryRun (no cambia nada)
echo 2^) Deploy completo (GitHub codigo + R2 JSON)
echo 3^) Solo codigo web a GitHub
echo 4^) Solo JSON a Cloudflare R2
echo.
set /p opt=Elige opcion [1-4]: 

if "%opt%"=="1" goto dryrun
if "%opt%"=="2" goto full
if "%opt%"=="3" goto code
if "%opt%"=="4" goto r2

echo Opcion no valida.
goto end

:dryrun
powershell -ExecutionPolicy Bypass -File "%DEPLOY_SCRIPT%" -DryRun
goto end

:full
powershell -ExecutionPolicy Bypass -File "%DEPLOY_SCRIPT%"
goto end

:code
powershell -ExecutionPolicy Bypass -File "%DEPLOY_SCRIPT%" -SkipR2
goto end

:r2
powershell -ExecutionPolicy Bypass -File "%DEPLOY_SCRIPT%" -SkipPushCode
goto end

:end
echo.
echo Proceso finalizado. Pulsa una tecla para cerrar...
pause >nul
endlocal
