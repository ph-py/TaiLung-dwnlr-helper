/**
 * TaiLung Downloader - Background Script
 * Conecta exclusivamente ao host 'tailung_helper' via Native Messaging.
 */

const NATIVE_HOST_NAME = "tailung_helper";

let nativePort = null;
let downloadState = {
  status: "IDLE", // IDLE, STARTING, PROGRESS, INFO, SUCCESS, ERROR, CANCELLED
  track: "",
  percent: 0,
  current: 0,
  total: 0,
  message: "",
  title: ""
};

function gerarToken64() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < 64; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

function broadcastState() {
  console.log("[TaiLung BG] Broadcast de estado:", downloadState);

  // 1. Notifica o Popup
  try {
    chrome.runtime.sendMessage({
      action: "DOWNLOAD_STATE_CHANGED",
      state: downloadState
    }, () => {
      const _ = chrome.runtime.lastError;
    });
  } catch (e) { }

  // 2. Notifica todas as abas (Content Scripts)
  try {
    chrome.tabs.query({}, (tabs) => {
      if (!tabs) return;
      for (const tab of tabs) {
        if (tab && tab.id) {
          try {
            chrome.tabs.sendMessage(tab.id, {
              action: "DOWNLOAD_STATE_CHANGED",
              state: downloadState
            }, () => {
              const _ = chrome.runtime.lastError;
            });
          } catch (e) { }
        }
      }
    });
  } catch (e) { }
}

function conectarHostNativo() {
  if (nativePort) return nativePort;

  try {
    console.log("[TaiLung BG] Conectando ao host nativo:", NATIVE_HOST_NAME);
    nativePort = chrome.runtime.connectNative(NATIVE_HOST_NAME);

    nativePort.onMessage.addListener((msg) => {
      console.log("[TaiLung BG] Mensagem recebida do host:", msg);
      if (msg.status === "PROGRESS") {
        downloadState.status = "PROGRESS";
        downloadState.track = msg.track || "";
        downloadState.percent = msg.percent || 0;
        downloadState.current = msg.current || 0;
        downloadState.total = msg.total || 0;
        downloadState.message = `Baixando ${msg.track}: ${msg.percent}% (${msg.current}/${msg.total})`;
      } else if (msg.status === "INFO") {
        downloadState.status = "INFO";
        downloadState.message = msg.message;
      } else if (msg.status === "SUCCESS") {
        downloadState.status = "SUCCESS";
        downloadState.percent = 100;
        downloadState.message = msg.message || "Download concluído com sucesso!";
      } else if (msg.status === "CANCELLED") {
        downloadState.status = "CANCELLED";
        downloadState.percent = 0;
        downloadState.message = msg.message || "Download cancelado.";
      } else if (msg.status === "ERROR") {
        downloadState.status = "ERROR";
        downloadState.message = msg.message || "Erro no processo de download.";
      }

      broadcastState();
    });

    nativePort.onDisconnect.addListener(() => {
      const err = chrome.runtime.lastError ? chrome.runtime.lastError.message : "Desconectado";
      console.error("[TaiLung BG] Host desconectado:", err);
      if (downloadState.status === "PROGRESS" || downloadState.status === "STARTING") {
        downloadState.status = "ERROR";
        downloadState.message = `Host nativo desconectado: ${err}`;
        broadcastState();
      }
      nativePort = null;
    });

    return nativePort;
  } catch (e) {
    console.error("[TaiLung BG] Erro ao conectar ao host:", e);
    nativePort = null;
    return null;
  }
}

async function obterTituloOficialPanda(pullzone, videoId) {
  try {
    const res = await fetch(`https://config.tv.pandavideo.com.br/${pullzone}/${videoId}.json`, { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      if (data && data.title && data.title.trim()) {
        return data.title.trim();
      }
    }
  } catch (e) {
    // Falha silenciosa
  }
  return null;
}

async function iniciarDownload(urlOuEmbed, tituloInformado) {
  console.log("[TaiLung BG] iniciarDownload:", urlOuEmbed, tituloInformado);
  const port = conectarHostNativo();
  if (!port) {
    downloadState = {
      status: "ERROR",
      message: "Não foi possível conectar ao host nativo (tailung_helper). Execute install_host.sh."
    };
    broadcastState();
    return;
  }

  if (!urlOuEmbed) {
    downloadState = {
      status: "ERROR",
      message: "Nenhuma URL fornecida."
    };
    broadcastState();
    return;
  }

  try {
    // 1. Extração do Video ID
    let videoId = null;
    let pullzone = "vz-e707b79b-db8";

    try {
      const parsedUrl = new URL(urlOuEmbed);
      videoId = parsedUrl.searchParams.get("v");
      const pzMatch = parsedUrl.hostname.match(/(vz-[a-z0-9\-]+)/);
      if (pzMatch) pullzone = pzMatch[1];
    } catch (_) {
      // Não é URL completa válida, pode ser um trecho
    }

    if (!videoId) {
      const matchUuid = urlOuEmbed.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
      if (matchUuid) videoId = matchUuid[1];
    }

    if (!videoId) {
      downloadState = {
        status: "ERROR",
        message: "Não foi possível identificar o UUID do vídeo: " + urlOuEmbed
      };
      broadcastState();
      return;
    }

    // 2. Resolução do Título
    let tituloFinal = tituloInformado || "TaiLung";
    const tituloRemoto = await obterTituloOficialPanda(pullzone, videoId);
    if (tituloRemoto) {
      tituloFinal = tituloRemoto;
    }

    tituloFinal = tituloFinal.replace(/[\/*?:"<>|]/g, "").trim() || "TaiLung";

    // 3. Montagem da Master Playlist HLS com Token
    const token = gerarToken64();
    const masterPlaylistUrl = `https://b-${pullzone}.tv.pandavideo.com.br/${videoId}/playlist.m3u8?token=${token}`;

    downloadState = {
      status: "STARTING",
      track: "",
      percent: 0,
      current: 0,
      total: 0,
      title: tituloFinal,
      message: "Iniciando download em 1080p HD..."
    };
    broadcastState();

    port.postMessage({
      action: "START_DOWNLOAD",
      playlistUrl: masterPlaylistUrl,
      pullzone: pullzone,
      title: tituloFinal
    });

  } catch (err) {
    console.error("[TaiLung BG] Erro geral em iniciarDownload:", err);
    downloadState = {
      status: "ERROR",
      message: `Erro ao iniciar: ${err.message}`
    };
    broadcastState();
  }
}

// Ouvinte de mensagens da extensão
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "CHECK_FFMPEG") {
    chrome.runtime.sendNativeMessage(NATIVE_HOST_NAME, { action: "CHECK_FFMPEG" }, (response) => {
      if (chrome.runtime.lastError) {
        sendResponse({ installed: false, error: chrome.runtime.lastError.message });
      } else {
        sendResponse(response);
      }
    });
    return true;
  }

  if (msg.action === "START_DOWNLOAD") {
    iniciarDownload(msg.embedUrl || msg.url, msg.title);
    sendResponse({ status: "STARTED" });
    return true;
  }

  if (msg.action === "CANCEL_DOWNLOAD") {
    const port = conectarHostNativo();
    if (port) {
      port.postMessage({ action: "CANCEL_DOWNLOAD" });
    }
    downloadState.status = "CANCELLED";
    downloadState.message = "Cancelamento solicitado.";
    broadcastState();
    sendResponse({ status: "CANCELLING" });
    return true;
  }

  if (msg.action === "GET_STATE") {
    sendResponse(downloadState);
    return false;
  }
});

