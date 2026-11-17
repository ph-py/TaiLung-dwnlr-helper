#!/usr/bin/env python3
"""
TaiLung Native Host
Comunica com a extensão Firefox tailung-dwnlr via Native Messaging (stdin/stdout).
Suporta fMP4 (Byte-Range) e MPEG-TS (.ts), com multiplexação via FFmpeg nativo (Linux e Windows).
"""

import json
import logging
import os
import random
import re
import shutil
import string
import struct
import subprocess
import sys
import tempfile
import threading
import urllib.parse
import urllib.request
from pathlib import Path

# Configuração de modo binário no Windows para stdin/stdout
if sys.platform == "win32":
    try:
        import msvcrt
        msvcrt.setmode(sys.stdin.fileno(), os.O_BINARY)
        msvcrt.setmode(sys.stdout.fileno(), os.O_BINARY)
    except Exception:
        pass

# Configuração de Logs (compatível com Linux /tmp e Windows %TEMP%)
LOG_FILE = Path(tempfile.gettempdir()) / "tailung_host.log"
logging.basicConfig(
    filename=str(LOG_FILE),
    level=logging.DEBUG,
    format="%(asctime)s [%(levelname)s] %(message)s"
)
logging.info("=== TaiLung Native Host Iniciado ===")

# =====================================================================
# PROTOCOLO NATIVE MESSAGING
# =====================================================================
def ler_mensagem():
    raw_length = sys.stdin.buffer.read(4)
    if not raw_length or len(raw_length) < 4:
        return None
    length = struct.unpack('@I', raw_length)[0]
    data = sys.stdin.buffer.read(length).decode('utf-8')
    return json.loads(data)


def enviar_mensagem(msg_dict):
    data = json.dumps(msg_dict).encode('utf-8')
    sys.stdout.buffer.write(struct.pack('@I', len(data)))
    sys.stdout.buffer.write(data)
    sys.stdout.buffer.flush()


# =====================================================================
# REQUISIÇÕES HTTP E HLS
# =====================================================================
def requisicao_http(url: str, headers_base: dict, headers_extra: dict = None) -> bytes:
    req_headers = headers_base.copy()
    if headers_extra:
        req_headers.update(headers_extra)
    req = urllib.request.Request(url, headers=req_headers)
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read()


def resolver_url(base_url: str, relative_url: str) -> str:
    return urllib.parse.urljoin(base_url, relative_url)


def parsear_master_playlist(conteudo_m3u8: str, base_url: str):
    """
    Extrai resoluções e faixas de áudio da Master Playlist HLS.
    """
    audio_tracks = {}
    video_streams = []

    linhas = [l.strip() for l in conteudo_m3u8.splitlines() if l.strip()]
    for i, linha in enumerate(linhas):
        if linha.startswith("#EXT-X-MEDIA:TYPE=AUDIO"):
            gid_m = re.search(r'GROUP-ID="([^"]+)"', linha)
            uri_m = re.search(r'URI="([^"]+)"', linha)
            if gid_m and uri_m:
                audio_tracks[gid_m.group(1)] = resolver_url(base_url, uri_m.group(1))

        if linha.startswith("#EXT-X-STREAM-INF") and i + 1 < len(linhas):
            bw_m = re.search(r'BANDWIDTH=(\d+)', linha)
            res_m = re.search(r'RESOLUTION=(\d+)x(\d+)', linha)
            aud_m = re.search(r'AUDIO="([^"]+)"', linha)
            url_stream = resolver_url(base_url, linhas[i + 1])

            bw = int(bw_m.group(1)) if bw_m else 0
            w = int(res_m.group(1)) if res_m else 0
            h = int(res_m.group(2)) if res_m else 0
            aud_group = aud_m.group(1) if aud_m else None

            video_streams.append({
                "width": w,
                "height": h,
                "bandwidth": bw,
                "audio_group": aud_group,
                "url": url_stream,
                "tag": f"{h}p" if h > 0 else "HD"
            })

    if not video_streams:
        # Se não houver tags de stream, a própria playlist pode ser de mídia direta
        return base_url, None, "1080p"

    # Ordena da maior resolução para a menor
    video_streams.sort(key=lambda s: (s["height"], s["bandwidth"]), reverse=True)
    melhor_video = video_streams[0]

    audio_url = audio_tracks.get(melhor_video["audio_group"])
    if not audio_url and audio_tracks:
        audio_url = list(audio_tracks.values())[-1]

    return melhor_video["url"], audio_url, melhor_video["tag"]


def parsear_media_playlist(conteudo_m3u8: str, base_url: str):
    """
    Identifica se a playlist usa fMP4 Byte-Range ou segmentos MPEG-TS tradicionais.
    Retorna: (modo, init_url, init_range, segmentos)
    modo: 'BYTERANGE' ou 'SEGMENTS'
    """
    linhas = [l.strip() for l in conteudo_m3u8.splitlines() if l.strip()]

    # 1. Verifica se possui #EXT-X-BYTERANGE (fMP4)
    tem_byterange = any(l.startswith("#EXT-X-BYTERANGE") for l in linhas)

    if tem_byterange:
        init_url = None
        init_range = None
        segmentos = []

        map_match = re.search(r'#EXT-X-MAP:URI="([^"]+)",BYTERANGE="(\d+)@(\d+)"', conteudo_m3u8)
        if map_match:
            init_url = resolver_url(base_url, map_match.group(1))
            length = int(map_match.group(2))
            offset = int(map_match.group(3))
            init_range = (offset, offset + length - 1)

        offset_atual = 0
        arquivo_midia_url = None

        for i, linha in enumerate(linhas):
            if linha.startswith("#EXT-X-BYTERANGE:"):
                partes = linha.split(":")[1].split("@")
                length = int(partes[0])
                start = int(partes[1]) if len(partes) > 1 else offset_atual
                end = start + length - 1
                offset_atual = end + 1

                url_chunk = resolver_url(base_url, linhas[i + 1].strip())
                arquivo_midia_url = url_chunk
                segmentos.append((start, end, url_chunk))

        return "BYTERANGE", init_url or arquivo_midia_url, init_range, segmentos

    # 2. Modo tradicional MPEG-TS (.ts segments)
    segmentos = []
    for i, linha in enumerate(linhas):
        if linha.startswith("#EXTINF") and i + 1 < len(linhas):
            chunk_url = resolver_url(base_url, linhas[i + 1].strip())
            segmentos.append(chunk_url)

    return "SEGMENTS", None, None, segmentos


# Controle de execução e cancelamento
cancel_event = threading.Event()
current_ffmpeg_proc = None

def baixar_trilha(nome_trilha: str, playlist_url: str, caminho_saida: Path, headers_base: dict) -> bool:
    """
    Baixa uma trilha (vídeo ou áudio) suportando tanto Byte-Range quanto segmentos .ts.
    """
    conteudo = requisicao_http(playlist_url, headers_base).decode("utf-8")
    modo, init_url, init_range, segmentos = parsear_media_playlist(conteudo, playlist_url)
    total_segmentos = len(segmentos)

    logging.info(f"Baixando trilha {nome_trilha} - Modo: {modo} - Total segmentos: {total_segmentos}")

    with open(caminho_saida, "wb") as f_out:
        if modo == "BYTERANGE":
            if init_range:
                headers = {"Range": f"bytes={init_range[0]}-{init_range[1]}"}
                init_bytes = requisicao_http(init_url, headers_base, headers)
                f_out.write(init_bytes)

            for idx, (start, end, seg_url) in enumerate(segmentos, 1):
                if cancel_event.is_set():
                    logging.info(f"Cancelado pelo usuário durante trilha {nome_trilha}.")
                    return False

                headers = {"Range": f"bytes={start}-{end}"}
                chunk = requisicao_http(seg_url, headers_base, headers)
                f_out.write(chunk)

                if idx % 15 == 0 or idx == total_segmentos:
                    pct = int((idx / total_segmentos) * 100)
                    enviar_mensagem({
                        "status": "PROGRESS",
                        "track": nome_trilha,
                        "current": idx,
                        "total": total_segmentos,
                        "percent": pct
                    })
        else:
            # Modo SEGMENTS (.ts files)
            for idx, seg_url in enumerate(segmentos, 1):
                if cancel_event.is_set():
                    logging.info(f"Cancelado pelo usuário durante trilha {nome_trilha}.")
                    return False

                chunk = requisicao_http(seg_url, headers_base)
                f_out.write(chunk)

                if idx % 10 == 0 or idx == total_segmentos:
                    pct = int((idx / total_segmentos) * 100)
                    enviar_mensagem({
                        "status": "PROGRESS",
                        "track": nome_trilha,
                        "current": idx,
                        "total": total_segmentos,
                        "percent": pct
                    })

    return True


def executar_download_completo(master_playlist_url: str, pullzone: str, titulo: str):
    global current_ffmpeg_proc
    logging.info(f"executar_download_completo iniciado para '{titulo}' | Master: {master_playlist_url}")

    caminho_ffmpeg = shutil.which("ffmpeg")
    if not caminho_ffmpeg:
        logging.error("FFmpeg não encontrado no PATH.")
        enviar_mensagem({"status": "ERROR", "message": "FFmpeg não encontrado. Certifique-se de que o FFmpeg está instalado e no PATH do sistema."})
        return

    # Pasta padrão de saída: ~/Downloads/TaiLung
    try:
        pasta_saida = Path.home() / "Downloads" / "TaiLung"
        pasta_saida.mkdir(parents=True, exist_ok=True)
    except Exception as e:
        pasta_saida = Path.home() / "Downloads"
        pasta_saida.mkdir(parents=True, exist_ok=True)

    nome_sanitizado = re.sub(r'[\/*?:"<>|]', "", titulo).strip().replace(" ", "_")
    if not nome_sanitizado:
        nome_sanitizado = "TaiLung"

    headers_req = {
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:134.0) Gecko/20100101 Firefox/134.0",
        "Referer": f"https://player-{pullzone}.tv.pandavideo.com.br/",
        "Origin": f"https://player-{pullzone}.tv.pandavideo.com.br",
    }

    arquivo_video_tmp = pasta_saida / f"temp_{nome_sanitizado}_video.dat"
    arquivo_audio_tmp = pasta_saida / f"temp_{nome_sanitizado}_audio.dat"
    arquivo_final_mp4 = pasta_saida / f"{nome_sanitizado}_1080p.mp4"

    def limpar_temporarios():
        if arquivo_video_tmp.exists():
            try: arquivo_video_tmp.unlink()
            except Exception: pass
        if arquivo_audio_tmp.exists():
            try: arquivo_audio_tmp.unlink()
            except Exception: pass

    try:
        if cancel_event.is_set():
            limpar_temporarios()
            enviar_mensagem({"status": "CANCELLED", "message": "Download cancelado."})
            return

        enviar_mensagem({"status": "INFO", "message": "Obtendo resoluções disponíveis..."})
        master_content = requisicao_http(master_playlist_url, headers_req).decode("utf-8")
        video_url, audio_url, tag_res = parsear_master_playlist(master_content, master_playlist_url)

        arquivo_final_mp4 = pasta_saida / f"{nome_sanitizado}_{tag_res}.mp4"
        logging.info(f"Stream selecionado: {tag_res} - Vídeo: {video_url} | Áudio: {audio_url}")

        if cancel_event.is_set():
            limpar_temporarios()
            enviar_mensagem({"status": "CANCELLED", "message": "Download cancelado."})
            return

        enviar_mensagem({"status": "INFO", "message": f"Baixando trilha de vídeo em {tag_res}..."})
        if not baixar_trilha("VIDEO", video_url, arquivo_video_tmp, headers_req):
            limpar_temporarios()
            enviar_mensagem({"status": "CANCELLED", "message": "Download cancelado."})
            return

        if audio_url:
            enviar_mensagem({"status": "INFO", "message": "Baixando trilha de áudio..."})
            if not baixar_trilha("AUDIO", audio_url, arquivo_audio_tmp, headers_req):
                limpar_temporarios()
                enviar_mensagem({"status": "CANCELLED", "message": "Download cancelado."})
                return

        if cancel_event.is_set():
            limpar_temporarios()
            enviar_mensagem({"status": "CANCELLED", "message": "Download cancelado."})
            return

        # Multiplexação com FFmpeg
        enviar_mensagem({"status": "INFO", "message": "Processando e montando arquivo MP4 final..."})

        if audio_url and arquivo_audio_tmp.exists():
            cmd = [
                caminho_ffmpeg, "-y",
                "-i", str(arquivo_video_tmp),
                "-i", str(arquivo_audio_tmp),
                "-c", "copy",
                "-movflags", "+faststart",
                str(arquivo_final_mp4)
            ]
        else:
            # Caso a trilha de vídeo já contenha áudio multiplexado (.ts único)
            cmd = [
                caminho_ffmpeg, "-y",
                "-i", str(arquivo_video_tmp),
                "-c", "copy",
                "-movflags", "+faststart",
                str(arquivo_final_mp4)
            ]

        logging.info(f"Executando FFmpeg: {' '.join(cmd)}")
        extra_popen_args = {}
        if sys.platform == "win32":
            extra_popen_args["creationflags"] = subprocess.CREATE_NO_WINDOW

        current_ffmpeg_proc = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            **extra_popen_args
        )
        stdout, stderr = current_ffmpeg_proc.communicate()

        if current_ffmpeg_proc.returncode != 0:
            err_msg = stderr.decode('utf-8', errors='ignore')
            logging.error(f"Erro no FFmpeg: {err_msg}")
            limpar_temporarios()
            enviar_mensagem({"status": "ERROR", "message": f"Erro ao montar MP4 com FFmpeg: {err_msg[:100]}"})
            return

        limpar_temporarios()
        logging.info(f"Sucesso! Arquivo final salvo em: {arquivo_final_mp4}")
        enviar_mensagem({
            "status": "SUCCESS",
            "message": f"Concluído com sucesso! Salvo em ~/Downloads/TaiLung/{arquivo_final_mp4.name}",
            "file": str(arquivo_final_mp4)
        })

    except Exception as e:
        limpar_temporarios()
        logging.exception(f"Exceção durante download: {e}")
        enviar_mensagem({"status": "ERROR", "message": f"Falha no download: {str(e)}"})


def main():
    global current_ffmpeg_proc
    logging.info("Aguardando comandos da extensão...")

    while True:
        try:
            msg = ler_mensagem()
            if msg is None:
                logging.info("Canal stdin fechado. Encerrando host.")
                break

            action = msg.get("action")
            logging.info(f"Comando recebido: {action}")

            if action == "CHECK_FFMPEG":
                ffmpeg_path = shutil.which("ffmpeg")
                enviar_mensagem({
                    "installed": bool(ffmpeg_path),
                    "path": ffmpeg_path or ""
                })

            elif action == "CANCEL_DOWNLOAD":
                logging.info("Cancelamento solicitado pela extensão.")
                cancel_event.set()
                if current_ffmpeg_proc and current_ffmpeg_proc.poll() is None:
                    try:
                        current_ffmpeg_proc.kill()
                    except Exception:
                        pass
                enviar_mensagem({"status": "CANCELLED", "message": "Download cancelado."})

            elif action == "START_DOWNLOAD":
                cancel_event.clear()
                playlist_url = msg.get("playlistUrl")
                pullzone = msg.get("pullzone", "vz-e707b79b-db8")
                titulo = msg.get("title", "TaiLung")

                t = threading.Thread(
                    target=executar_download_completo,
                    args=(playlist_url, pullzone, titulo),
                    daemon=True
                )
                t.start()

        except Exception as e:
            logging.exception(f"Erro no loop principal: {e}")
            break


if __name__ == "__main__":
    main()

