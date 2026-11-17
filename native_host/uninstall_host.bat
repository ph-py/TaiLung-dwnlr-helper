@echo off
title TaiLung Downloader - Desinstalador Native Host (Windows)
echo Desregistrando o Native Host do Firefox...
REG DELETE "HKCU\Software\Mozilla\NativeMessagingHosts\tailung_helper" /f >nul 2>&1
echo [OK] Native Host desregistrado do Registro do Windows com sucesso.
pause
