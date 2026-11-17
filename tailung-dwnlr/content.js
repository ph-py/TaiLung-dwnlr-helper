/**
 * TaiLung Downloader - Content Script
 * Detecta players de vídeo em qualquer página ou se a própria página for o player.
 */

let videoInfo = null;

function extrairTituloDaPagina() {
  // 1. Tenta título em cabeçalhos h1/h2
  const h1 = document.querySelector('h1, h2');
  if (h1 && h1.innerText.trim() && h1.innerText.trim().length < 80) {
    return h1.innerText.trim();
  }

  // 2. Tenta itens de menu de aula ou elementos ativos
  const activeItem = document.querySelector('[class*="active"] [class*="title"], [class*="selected"], [aria-current="true"]');
  if (activeItem && activeItem.innerText.trim()) {
    return activeItem.innerText.trim().split('\n')[0];
  }

  // 3. Fallback para document.title
  return document.title.replace(/[\/*?:"<>|]/g, '').trim() || 'TaiLung';
}

function buscarPandaNaPagina() {
  // Caso 1: A própria página atual é a página do player embutido
  const host = window.location.hostname;
  if (host.includes('pandavideo.com.br') || host.includes('tv.pandavideo')) {
    const matchUuid = window.location.href.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
    if (matchUuid) {
      return {
        title: extrairTituloDaPagina(),
        embedUrl: window.location.href
      };
    }
  }

  // Caso 2: Iframes convencionais
  const iframes = document.querySelectorAll('iframe');
  for (const iframe of iframes) {
    const src = iframe.src || iframe.getAttribute('data-src') || iframe.getAttribute('data-player-url') || '';
    if (src.includes('pandavideo.com.br') || src.includes('tv.pandavideo')) {
      return {
        title: extrairTituloDaPagina(),
        embedUrl: src
      };
    }
  }

  // Caso 3: Tags customizadas (<panda-player> ou [data-panda])
  const customPanda = document.querySelector('panda-player, [data-panda-player], [data-panda-video]');
  if (customPanda) {
    const videoId = customPanda.getAttribute('video-id') || customPanda.getAttribute('data-panda-video') || '';
    if (videoId) {
      return {
        title: extrairTituloDaPagina(),
        embedUrl: `https://player-vz-e707b79b-db8.tv.pandavideo.com.br/embed/?v=${videoId}`
      };
    }
  }

  return null;
}

function detectarVideo() {
  const detectado = buscarPandaNaPagina();
  if (detectado && (!videoInfo || videoInfo.embedUrl !== detectado.embedUrl)) {
    videoInfo = detectado;
    atualizarWidgetFlutuante();
  }
}

// Criação do Widget Flutuante
function atualizarWidgetFlutuante() {
  if (!videoInfo || !videoInfo.embedUrl) return;

  let widget = document.getElementById('tailung-floating-widget');
  if (!widget) {
    widget = document.createElement('div');
    widget.id = 'tailung-floating-widget';
    widget.innerHTML = `
      <div id="pv-header">
        <span id="pv-title"><img id="pv-title-icon" alt="" width="18" height="18" style="vertical-align: middle; border-radius: 3px;"> TaiLung (1080p)</span>
        <button id="pv-close" title="Minimizar">✕</button>
      </div>
      <div id="pv-body">
        <div id="pv-video-title">Localizando vídeo...</div>
        <button id="pv-action-btn" disabled>Checando FFmpeg...</button>
        <button id="pv-cancel-btn" style="display:none;">⏹ Cancelar Download</button>
        <div id="pv-progress-container" style="display:none;">
          <div id="pv-progress-bar"></div>
        </div>
        <div id="pv-status-text">Pronto</div>
      </div>
    `;
    const iconImg = widget.querySelector('#pv-title-icon');
    if (iconImg) {
      iconImg.src = chrome.runtime.getURL('tai_lung-48.png');
    }
    document.body.appendChild(widget);

    document.getElementById('pv-close').onclick = () => {
      widget.classList.toggle('minimized');
    };

    // Consulta status do FFmpeg
    chrome.runtime.sendMessage({ action: 'CHECK_FFMPEG' }, (res) => {
      const btn = document.getElementById('pv-action-btn');
      const statusText = document.getElementById('pv-status-text');
      if (res && res.installed) {
        btn.disabled = false;
        btn.innerText = '⬇ Baixar (1080p HD)';
        btn.className = 'ready';
        btn.onclick = () => {
          btn.disabled = true;
          btn.innerText = '⏳ Conectando...';
          const pContainer = document.getElementById('pv-progress-container');
          const pBar = document.getElementById('pv-progress-bar');
          if (pContainer) pContainer.style.display = 'block';
          if (pBar) pBar.style.width = '5%';
          if (statusText) statusText.innerText = 'Enviando comando para o FFmpeg...';

          chrome.runtime.sendMessage({
            action: 'START_DOWNLOAD',
            embedUrl: videoInfo.embedUrl,
            title: videoInfo.title
          });
        };
      } else {
        btn.disabled = true;
        btn.innerText = 'FFmpeg não encontrado';
        btn.className = 'error';
        if (statusText) statusText.innerText = 'FFmpeg não detectado. Execute o instalador do host (install_host) e verifique o FFmpeg no PATH.';
      }
    });

    document.getElementById('pv-cancel-btn').onclick = () => {
      chrome.runtime.sendMessage({ action: 'CANCEL_DOWNLOAD' });
    };
  }

  const titleEl = document.getElementById('pv-video-title');
  if (titleEl) {
    titleEl.innerText = videoInfo.title || 'Vídeo Detectado';
    titleEl.title = videoInfo.title || '';
  }
}

// Responde a consultas do Popup
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'GET_PAGE_INFO') {
    detectarVideo();
    sendResponse(videoInfo);
    return false;
  }

  // Atualiza a barra de progresso no Widget Flutuante
  if (msg.action === 'DOWNLOAD_STATE_CHANGED') {
    const s = msg.state;
    const btn = document.getElementById('pv-action-btn');
    const cancelBtn = document.getElementById('pv-cancel-btn');
    const pContainer = document.getElementById('pv-progress-container');
    const pBar = document.getElementById('pv-progress-bar');
    const sText = document.getElementById('pv-status-text');

    if (!btn || !pBar || !sText) return;

    if (s.status === 'STARTING') {
      btn.disabled = true;
      btn.innerText = 'Iniciando...';
      if (cancelBtn) cancelBtn.style.display = 'block';
      pContainer.style.display = 'block';
      pBar.style.width = '10%';
      sText.innerText = s.message;
    } else if (s.status === 'PROGRESS') {
      btn.disabled = true;
      btn.innerText = `Baixando ${s.track}: ${s.percent}%`;
      if (cancelBtn) cancelBtn.style.display = 'block';
      pContainer.style.display = 'block';
      pBar.style.width = `${s.percent}%`;
      sText.innerText = s.message;
    } else if (s.status === 'INFO') {
      sText.innerText = s.message;
    } else if (s.status === 'SUCCESS') {
      pBar.style.width = '100%';
      btn.disabled = false;
      btn.innerText = '✔ Concluído com Sucesso!';
      btn.className = 'ready';
      if (cancelBtn) cancelBtn.style.display = 'none';
      sText.innerText = 'Salvo em ~/Downloads/TaiLung';
    } else if (s.status === 'CANCELLED') {
      pContainer.style.display = 'none';
      pBar.style.width = '0%';
      btn.disabled = false;
      btn.innerText = '⬇ Baixar (1080p HD)';
      btn.className = 'ready';
      if (cancelBtn) cancelBtn.style.display = 'none';
      sText.innerText = s.message || 'Download cancelado.';
    } else if (s.status === 'ERROR') {
      btn.disabled = false;
      btn.innerText = 'Tentar Novamente';
      btn.className = 'error';
      if (cancelBtn) cancelBtn.style.display = 'none';
      sText.innerText = s.message;
    }
  }
});

// Detecção contínua e observador de mutações no DOM
detectarVideo();
setInterval(detectarVideo, 2500);

const observer = new MutationObserver(() => {
  detectarVideo();
});
observer.observe(document.body || document.documentElement, {
  childList: true,
  subtree: true
});

