@echo off
setlocal enabledelayedexpansion
title TaiLung Downloader - Instalador Native Host (Windows)

echo ==============================================
echo Instalacao do TaiLung Native Host (Windows)
echo ==============================================
echo.

:: 1. Verifica Python
where python >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERRO] Python nao foi encontrado no PATH!
    echo Por favor, instale o Python em https://www.python.org/
    echo e certifique-se de marcar a opcao "Add python.exe to PATH".
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('python --version 2^>^&1') do set "PY_VER=%%i"
echo [*] Python encontrado: %PY_VER%

:: 2. Verifica FFmpeg
where ffmpeg >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [AVISO] FFmpeg nao foi encontrado no PATH!
    echo Para que a uniao de audio e video funcione sem erros:
    echo 1. Baixe o FFmpeg em https://www.ffmpeg.org/ ou instale via winget:
    echo       winget install Gyan.FFmpeg
    echo 2. Garanta que o binario 'ffmpeg.exe' esteja adicionado ao PATH do sistema.
    echo.
) else (
    echo [*] FFmpeg encontrado no PATH.
)

:: 3. Gera o arquivo de manifesto com o caminho absoluto (com barras escapadas)
set "HOST_DIR=%~dp0"
set "HOST_DIR=%HOST_DIR:~0,-1%"
set "BAT_PATH=%HOST_DIR%\tailung_host.bat"
set "JSON_PATH=%HOST_DIR%\tailung_helper.json"

:: Gera o JSON usando Python inline para garantir barras e escape compativeis
python -c "import json, sys; p = r'%BAT_PATH%'; data = {'name': 'tailung_helper', 'description': 'TaiLung Downloader Host', 'path': p, 'type': 'stdio', 'allowed_extensions': ['tailung-dwnlr@local']}; open(r'%JSON_PATH%', 'w', encoding='utf-8').write(json.dumps(data, indent=2))"

if not exist "%JSON_PATH%" (
    echo [ERRO] Falha ao criar o arquivo %JSON_PATH%
    pause
    exit /b 1
)

:: 4. Registra no Registro do Windows (HKCU para o usuario atual do Firefox)
REG ADD "HKCU\Software\Mozilla\NativeMessagingHosts\tailung_helper" /ve /t REG_SZ /d "%JSON_PATH%" /f >nul
if %ERRORLEVEL% EQU 0 (
    echo.
    echo [OK] Manifesto registrado no Firefox com sucesso!
    echo [OK] Registro: HKCU\Software\Mozilla\NativeMessagingHosts\tailung_helper
    echo [OK] Caminho do Host: %BAT_PATH%
    echo.
    echo ==============================================
    echo Instalacao concluida com sucesso!
    echo Agora a extensao TaiLung Downloader ja pode se comunicar com o FFmpeg.
    echo ==============================================
) else (
    echo.
    echo [ERRO] Falha ao adicionar chave no Registro do Windows.
)

echo.
pause
