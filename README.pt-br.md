# TaiLung Downloader

<p align="center">
  <img src="tailung-dwnlr/tai_lung-128.png" alt="TaiLung Downloader" width="128" height="128" />
</p>

<p align="center">
  <a href="README.md">English</a> | <b>Português</b>
</p>

Extensão para Mozilla Firefox no **Linux** integrada ao **FFmpeg nativo** para download de transmissões em qualidade (1080p Full HD) do **Panda Video**.

Funciona de forma independente em qualquer site da web ou diretamente no link do player.

---

## 💻 Suporte e Requisitos de Sistema

* **Sistema Operacional:** Linux (Debian, Ubuntu, Linux Mint);
* **Navegador Suportado:** Mozilla Firefox;
* **Requisitos:**
  1. **Python 3** (padrão no Linux);
  2. **FFmpeg** (para multiplexar trilhas de áudio e vídeo em alta definição sem perdas).

### Como instalar os requisitos no terminal (Ubuntu / Debian / Mint):
```bash
sudo apt update
sudo apt install -y python3 ffmpeg
```

---

## 📁 Estrutura do Projeto

```text
TaiLung-dwnlr-helper/
├── native_host/                    # Comunicação nativa Linux com o FFmpeg
│   ├── tailung_host.py             # Script de download (suporta fMP4 e .ts)
│   ├── tailung_helper.json         # Manifesto do host nativo para o Firefox
│   └── install_host.sh             # Instalador automático com detecção de caminho
│
├── tailung-dwnlr/                   # Extensão WebExtension para o Firefox
│   ├── manifest.json               # Configurações e permissões (ID: tailung-dwnlr@local)
│   ├── background.js               # Gerenciador de Native Messaging e tokens
│   ├── content.js                  # Detecção universal (iframes, páginas diretas e SPA)
│   ├── content.css                 # Estilo moderno do widget flutuante
│   ├── popup.html                  # Painel de controle no menu do navegador com entrada manual
│   ├── popup.js                    # Lógica de controle e barra de progresso em tempo real
│   ├── tai_lung-48.png
│   └── tai_lung-128.png
│
├── README.md                       # Documentação principal (Inglês)
├── README.pt-br.md                 # Guia completo de instalação e uso (Português)
└── LICENSE                         # Licença MIT
```

---

## 🚀 Instalação Passo a Passo

### Passo 1: Registrar o Host Nativo no Firefox (Linux)
Abra o seu terminal na pasta raiz do projeto e execute o instalador:

```bash
bash native_host/install_host.sh
```

---

### Passo 2: Carregar a Extensão no Firefox
1. Abra o Mozilla Firefox e acesse na barra de endereços:
   ```text
   about:debugging#/runtime/this-firefox
   ```
2. Clique no botão **"Carregar extensão temporária..."** (*Load Temporary Add-on...*);
3. Navegue até o diretório do projeto e selecione o arquivo:
   ```text
   tailung-dwnlr/manifest.json
   ```

Pronto! A extensão **TaiLung Downloader** já estará ativa e pronta para uso.

---

## 🎯 Como Usar

### Opção 1: Detecção Automática via Widget Flutuante na Página
1. Ao abrir qualquer página na web que contenha um vídeo compatível (seja via iframe, embutido ou link direto do player), um card flutuante surgirá no **canto inferior direito** da tela com o ícone do TaiLung (`TaiLung (1080p)`).
2. O sistema extrai o título original e verifica se o FFmpeg está operacional.
3. Clique em **`⬇ Baixar (1080p HD)`**.
4. O progresso será exibido em tempo real na barra.

---

### Opção 2: Pelo Menu Popup na Barra de Ferramentas
1. Clique no ícone da extensão no topo direito do Firefox (dica: clique com o botão direito e selecione **"Fixar na barra de ferramentas"**).
2. O popup mostrará:
   * Status do FFmpeg (`FFmpeg: OK`);
   * Nome do vídeo identificado na aba ativa;
   * Botão principal **`⬇ Baixar (1080p HD)`**.

---

### Opção 3: Baixar Colando o Link Manualmente (Para qualquer link ou UUID)
Se a página possuir proteções ou o iframe estiver oculto:
1. Abra o menu popup da extensão;
2. Na seção **"Ou Cole o Link / UUID do Vídeo"**, cole a URL do player ou apenas o UUID do vídeo (ex: `https://player-vz-xxxxxx.tv.pandavideo.com.br/embed/?v=dc308456-1453-4a25-bf26-8b57434aa230`);
3. Clique em **`⬇ Baixar por URL Manual`**.
4. A extensão buscará o manifesto oficial, os metadados do vídeo e iniciará o download em 1080p.

---

## ⏹ Cancelamento de Download
* Durante qualquer download, um botão vermelho **`⏹ Cancelar Download`** fica disponível.
* Ao clicar nele, o download na CDN é interrompido, o processo do FFmpeg é finalizado e os arquivos temporários são deletados imediatamente.

---

## 💾 Onde os Vídeos são Salvos?
Todos os arquivos finalizados em resolução máxima (1080p) são salvos organizados na pasta:
```text
~/Downloads/TaiLung/{Nome_do_Video}_1080p.mp4
```

---

## 🛡️ Compatibilidade de Formatos
Esta extensão implementa um motor inteligente que reconhece e baixa os formatos existentes na CDN:
1. **fMP4 Moderno (Byte-Range):** Fragmentos temporais baixados via HTTP Range (`video.m4s` e `audio.m4s`);
2. **MPEG-TS Tradicional:** Segmentos clássicos `.ts` sequenciais.
Em ambos os formatos, o FFmpeg nativo realiza a multiplexação limpa em container MP4 sem recodificação de vídeo (velocidade máxima).

---

## 📄 Licença

Este projeto está sob a licença [MIT](LICENSE) - veja o arquivo [LICENSE](LICENSE) para mais detalhes.
