# TaiLung Downloader Helper

<p align="center">
  <img src="tailung-dwnlr/tai_lung-128.png" alt="TaiLung Downloader" width="128" height="128" />
</p>

<p align="center">
  <b>English</b> | <a href="README.pt-br.md">Português</a>
</p>

Mozilla Firefox extension for **Linux** integrated with **native FFmpeg** for downloading high-quality (1080p Full HD) streams from **Panda Video**.

Works independently on any web page or directly from the player URL.

---

## 💻 System Support & Requirements

* **Operating System:** Linux (Debian, Ubuntu, Linux Mint);
* **Supported Browser:** Mozilla Firefox;
* **Requirements:**
  1. **Python 3** (default on Linux);
  2. **FFmpeg** (to multiplex audio and video tracks in lossless high definition).

### How to install requirements via terminal (Ubuntu / Debian / Mint):
```bash
sudo apt update
sudo apt install -y python3 ffmpeg git
```

---

## 📁 Project Structure

```text
TaiLung-dwnlr-helper/
├── native_host/                    # Linux native messaging host with FFmpeg
│   ├── tailung_host.py             # Download engine (supports fMP4 and .ts)
│   ├── tailung_helper.json         # Firefox native messaging host manifest
│   └── install_host.sh             # Automatic installer with path detection
│
├── tailung-dwnlr/                   # Firefox WebExtension
│   ├── manifest.json               # Configuration and permissions (ID: tailung-dwnlr@local)
│   ├── background.js               # Native messaging and token manager
│   ├── content.js                  # Universal detection (iframes, direct pages, SPA)
│   ├── content.css                 # Modern floating widget styles
│   ├── popup.html                  # Browser action popup with manual input
│   ├── popup.js                    # UI logic and real-time progress bar
│   ├── tai_lung-48.png
│   └── tai_lung-128.png
│
├── README.md                       # Main documentation (English)
├── README.pt-br.md                 # Documentation in Portuguese
└── LICENSE                         # MIT License
```

---

## 🚀 Installation

### Method 1: Installing via Signed `.xpi` (Recommended - Permanent)

This is the recommended method for regular use. The extension remains permanently installed across Firefox restarts without requiring Developer Mode or `about:debugging`.

1. **Install Prerequisites (Linux):**
   ```bash
   sudo apt update && sudo apt install -y python3 ffmpeg git
   ```

2. **Register the Native Host (Linux):**
   Clone the repository and run the automated installer:
   ```bash
   git clone https://github.com/ph-py/TaiLung-dwnlr-helper.git
   cd TaiLung-dwnlr-helper
   bash native_host/install_host.sh
   ```

3. **Install the Firefox Extension (.xpi):**
   * Go to the [Releases](https://github.com/ph-py/TaiLung-dwnlr-helper/releases) page.
   * Download the latest **`.xpi`** file (e.g., `tailung_downloader-0.1.1.xpi`).
   * Drag and drop the `.xpi` file into any Firefox window (or open it with Firefox) and click **"Add"**.

Done! The **TaiLung Downloader** extension is permanently installed and ready to use.

---

### Method 2: Installing from Source / Development (via `about:debugging`)

Use this method if you want to inspect, modify, or develop features for the extension:

1. **Clone and Setup the Native Host:**
   ```bash
   git clone https://github.com/ph-py/TaiLung-dwnlr-helper.git
   cd TaiLung-dwnlr-helper
   bash native_host/install_host.sh
   ```

2. **Load Temporary Add-on in Firefox:**
   * Open Mozilla Firefox and navigate to:
     ```text
     about:debugging#/runtime/this-firefox
     ```
   * Click **"Load Temporary Add-on..."** (*Carregar extensão temporária...*).
   * Browse to the project folder and select:
     ```text
     tailung-dwnlr/manifest.json
     ```

*(Note: Extensions loaded via `about:debugging` are temporary and unloaded when Firefox closes).*

---

## 🎯 How to Use

### Option 1: Automatic Detection via In-Page Floating Widget
1. When browsing any web page containing a compatible video (embedded, in an iframe, or direct player URL), a floating card will appear in the **bottom-right corner** of the screen with the TaiLung icon (`TaiLung (1080p)`).
2. The system automatically extracts the original title and verifies that FFmpeg is operational.
3. Click **`⬇ Baixar (1080p HD)`**.
4. Real-time download progress will be shown in the progress bar.

---

### Option 2: Via Toolbar Popup Menu
1. Click the extension icon in the top-right toolbar of Firefox (tip: right-click and select **"Pin to Toolbar"**).
2. The popup displays:
   * FFmpeg status (`FFmpeg: OK`);
   * Name of the video detected in the active tab;
   * Main action button **`⬇ Baixar (1080p HD)`**.

---

### Option 3: Download by Pasting URL Manually (For any link or UUID)
If the page has custom overlays or the iframe is hidden:
1. Open the extension popup menu;
2. In the **"Ou Cole o Link / UUID do Vídeo"** section, paste the player URL or video UUID (e.g., `https://player-vz-xxxxxx.tv.pandavideo.com.br/embed/?v=dc308456-1453-4a25-bf26-8b57434aa230`);
3. Click **`⬇ Baixar por URL Manual`**;
4. The extension fetches the official manifest, video metadata, and initiates the 1080p download.

---

## ⏹ Canceling Downloads
* During any download, a red **`⏹ Cancelar Download`** button remains available.
* Clicking it immediately stops CDN downloads, terminates the FFmpeg process, and cleans up temporary files.

---

## 💾 Where are Videos Saved?
All completed videos in full resolution (1080p) are organized and saved to:
```text
~/Downloads/TaiLung/{Video_Title}_1080p.mp4
```

---

## 🛡️ Format Compatibility
This extension implements an intelligent download engine supporting CDN formats:
1. **Modern fMP4 (Byte-Range):** Fragmented streams downloaded via HTTP Range (`video.m4s` and `audio.m4s`);
2. **Traditional MPEG-TS:** Sequential classic `.ts` segments.
In both formats, native FFmpeg performs lossless remuxing into a clean MP4 container without video re-encoding (maximum speed).

---

## 📄 License

This project is licensed under the [MIT](LICENSE) License - see the [LICENSE](LICENSE) file for details.

