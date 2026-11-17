#!/bin/bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
HOST_PY="$DIR/tailung_host.py"
TARGET_DIR="$HOME/.mozilla/native-messaging-hosts"
TARGET_FILE="$TARGET_DIR/tailung_helper.json"

echo "=============================================="
echo "Instalação do TaiLung Native Host (Linux)"
echo "=============================================="

# 1. Verifica dependências
echo -n "[*] Verificando Python 3... "
if command -v python3 >/dev/null 2>&1; then
    echo "OK ($(python3 --version))"
else
    echo "ERRO: Python 3 não encontrado!"
    echo "Execute: sudo apt update && sudo apt install -y python3"
    exit 1
fi

echo -n "[*] Verificando FFmpeg... "
if command -v ffmpeg >/dev/null 2>&1; then
    echo "OK ($(ffmpeg -version | head -n 1))"
else
    echo "AVISO: FFmpeg não está instalado!"
    echo "Para multiplexação sem perdas, instale com:"
    echo "    sudo apt update && sudo apt install -y ffmpeg"
fi

# 2. Garante permissão de execução
chmod +x "$HOST_PY"

# 3. Registra o manifesto com o caminho absoluto dinâmico no Firefox do usuário local
mkdir -p "$TARGET_DIR"

cat <<EOF > "$TARGET_FILE"
{
  "name": "tailung_helper",
  "description": "TaiLung Downloader Host",
  "path": "$HOST_PY",
  "type": "stdio",
  "allowed_extensions": [
    "tailung-dwnlr@local"
  ]
}
EOF

chmod 644 "$TARGET_FILE"

echo "[✓] Manifesto instalado com sucesso em:"
echo "    $TARGET_FILE"
echo "=============================================="
echo "Instalação concluída com sucesso!"
echo "Agora você já pode carregar a extensão no Firefox via about:debugging."
