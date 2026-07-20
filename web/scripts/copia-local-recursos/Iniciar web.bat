@echo off
setlocal
cd /d "%~dp0"

rem Localizar Python; si no esta instalado, instalarlo con winget.
set "PY="
where py >nul 2>nul && set "PY=py"
if not defined PY where python >nul 2>nul && set "PY=python"

if not defined PY (
    echo Python no esta instalado. Instalando con winget...
    winget install --id Python.Python.3.12 -e --silent --accept-package-agreements --accept-source-agreements
    where py >nul 2>nul && set "PY=py"
    if not defined PY (
        for /d %%d in ("%LocalAppData%\Programs\Python\Python*") do set "PY=%%d\python.exe"
    )
)

if not defined PY (
    echo No se pudo instalar Python automaticamente.
    echo Instalalo desde https://www.python.org y vuelve a ejecutar este archivo.
    pause
    exit /b 1
)

start "" http://localhost:8724
%PY% servidor.py
