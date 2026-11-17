/**
 * TaiLung Downloader - Popup Script
 */

document.addEventListener('DOMContentLoaded', async () => {
  const ffmpegBadge = document.getElementById('ffmpeg-badge');
  const videoTitle = document.getElementById('video-title');
  const btnDownload = document.getElementById('btn-download');
  const progressWrap = document.getElementById('progress-wrap');
  const progressBar = document.getElementById('progress-bar');
  const btnCancel = document.getElementById('btn-cancel');
  const statusDesc = document.getElementById('status-desc');
  const manualUrlInput = document.getElementById('manual-url');
  const btnManual = document.getElementById('btn-manual');

  let activeVideo = null;
  let ffmpegOk = false;

  // 1. Renderiza o estado de download
  function renderState(s) {
    if (!s) return;

    if (s.status === 'STARTING') {
      progressWrap.style.display = 'block';
      progressBar.style.width = '10%';
      btnDownload.disabled = true;
      btnDownload.innerText = 'Iniciando download...';
      btnCancel.style.display = 'block';
      statusDesc.innerText = s.message;
    } else if (s.status === 'PROGRESS') {
      progressWrap.style.display = 'block';
      progressBar.style.width = `${s.percent}%`;
      btnDownload.disabled = true;
      btnDownload.innerText = `Baixando ${s.track}: ${s.percent}%`;
      btnCancel.style.display = 'block';
      statusDesc.innerText = s.message;
    } else if (s.status === 'INFO') {
      statusDesc.innerText = s.message;
    } else if (s.status === 'SUCCESS') {
      progressWrap.style.display = 'block';
      progressBar.style.width = '100%';
      btnDownload.disabled = false;
      btnDownload.className = 'btn-main ready';
      btnDownload.innerText = '✔ Concluído! Baixar Novamente';
      btnCancel.style.display = 'none';
      statusDesc.innerText = s.message || 'Salvo em ~/Downloads/TaiLung';
    } else if (s.status === 'CANCELLED') {
      progressWrap.style.display = 'none';
      progressBar.style.width = '0%';
      btnDownload.disabled = false;
      btnDownload.className = 'btn-main ready';
      btnDownload.innerText = '⬇ Baixar (1080p HD)';
      btnCancel.style.display = 'none';
      statusDesc.innerText = s.message || 'Download cancelado.';
    } else if (s.status === 'ERROR') {
      btnDownload.disabled = false;
      btnDownload.className = 'btn-main';
      btnDownload.innerText = 'Tentar Novamente';
      btnCancel.style.display = 'none';
      statusDesc.innerText = s.message;
    }
  }

  // 2. Escuta mudanças de estado do background
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'DOWNLOAD_STATE_CHANGED') {
      renderState(msg.state);
    }
  });

  // 3. Obtém o estado atual já existente
  chrome.runtime.sendMessage({ action: 'GET_STATE' }, (s) => {
    if (s && s.status !== 'IDLE') {
      renderState(s);
    }
  });

  // 4. Checa status do FFmpeg nativo
  chrome.runtime.sendMessage({ action: 'CHECK_FFMPEG' }, (resp) => {
    if (resp && resp.installed) {
      ffmpegOk = true;
      ffmpegBadge.className = 'badge-ffmpeg badge-ok';
      ffmpegBadge.innerText = 'FFmpeg: OK';
    } else {
      ffmpegOk = false;
      ffmpegBadge.className = 'badge-ffmpeg badge-err';
      ffmpegBadge.innerText = 'FFmpeg: Ausente';
      statusDesc.innerText = 'Instale o FFmpeg (sudo apt install ffmpeg) para habilitar o download.';
    }
    atualizarBotao();
  });

  // 5. Consulta vídeo na aba ativa
  try {
    const tabs = await new Promise(resolve => chrome.tabs.query({ active: true, currentWindow: true }, resolve));
    if (tabs && tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, { action: 'GET_PAGE_INFO' }, (info) => {
        if (chrome.runtime.lastError || !info || !info.embedUrl) {
          videoTitle.innerText = 'Nenhum player detectado';
          statusDesc.innerText = 'Abra um vídeo compatível ou use o campo manual abaixo.';
        } else {
          activeVideo = info;
          videoTitle.innerText = info.title || 'Vídeo Detectado';
          atualizarBotao();
        }
      });
    }
  } catch (err) {
    videoTitle.innerText = 'Aba indisponível';
  }

  function atualizarBotao() {
    if (ffmpegOk && activeVideo && activeVideo.embedUrl) {
      btnDownload.disabled = false;
      btnDownload.className = 'btn-main ready';
      btnDownload.innerText = '⬇ Baixar (1080p HD)';
      statusDesc.innerText = 'Clique para iniciar o download do vídeo detectado.';

      btnDownload.onclick = () => {
        btnDownload.disabled = true;
        btnDownload.innerText = '⏳ Solicitando...';
        chrome.runtime.sendMessage({
          action: 'START_DOWNLOAD',
          embedUrl: activeVideo.embedUrl,
          title: activeVideo.title
        });
      };
    }
  }

  // 6. Botão de Cancelar
  btnCancel.onclick = () => {
    chrome.runtime.sendMessage({ action: 'CANCEL_DOWNLOAD' });
  };

  // 7. Download Manual por URL / ID
  btnManual.onclick = () => {
    const url = manualUrlInput.value.trim();
    if (!url) {
      alert('Por favor, cole a URL do embed ou o UUID do vídeo.');
      return;
    }
    if (!ffmpegOk) {
      alert('FFmpeg não encontrado no sistema.');
      return;
    }

    btnDownload.disabled = true;
    btnDownload.innerText = '⏳ Solicitando...';
    chrome.runtime.sendMessage({
      action: 'START_DOWNLOAD',
      url: url,
      title: activeVideo ? activeVideo.title : 'TaiLung_Manual'
    });
  };
});

