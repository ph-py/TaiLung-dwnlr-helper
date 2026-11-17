#!/bin/bash
set -e

TARGET_DIR="$HOME/.mozilla/native-messaging-hosts"
TARGET_FILE="$TARGET_DIR/tailung_helper.json"

if [ -f "$TARGET_FILE" ]; then
    rm -f "$TARGET_FILE"
    echo "[OK] Manifesto removido de $TARGET_FILE"
else
    echo "[!] Manifesto não encontrado em $TARGET_FILE"
fi

echo "Desinstalação do Native Host concluída."
