
<p align="center">
  <img src="https://github.com/evvsksh/FunkinLauncher/releases/download/assets/background.png" width="900"/>
</p>

<h1 align="center">Funkin' Launcher</h1>

<p align="center">
  <img src="https://img.shields.io/github/repo-size/evvsksh/FunkinLauncher" />
  <img src="https://img.shields.io/github/stars/evvsksh/FunkinLauncher?style=badge" />
  <img src="https://img.shields.io/github/license/evvsksh/FunkinLauncher" />
  <img src="https://img.shields.io/badge/status-WIP-yellow" />
  <img src="https://img.shields.io/github/actions/workflow/status/evvsksh/FunkinLauncher/build.yml?branch=main" />
</p>

<p align="center">
  <b>Funkin' Launcher</b> is a modern mod manager for <a href="https://github.com/FunkinCrew/funkin"><i>Friday Night Funkin’</i></a> that lets you browse, download, and install multiple mods seamlessly — powered by the GameBanana API.
</p>

<div align="center">
  <h2>Building from Source</h2>

  <p><strong>Windows</strong> — open PowerShell and run:</p>
</div>

```powershell
git clone https://github.com/evvsksh/FunkinLauncher.git
cd FunkinLauncher

npm ci --no-audit --no-fund
npx tauri build --bundles msi
````

<div align="center">
  <p><strong>Linux</strong> (example for Ubuntu 22.04):</p>
</div>

```bash
sudo apt-get update -qq
sudo apt-get install -y --no-install-recommends flatpak flatpak-builder jq pkg-config build-essential binutils elfutils \
git libssl-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev libwebkit2gtk-4.1-dev libjavascriptcoregtk-4.1-dev

git clone https://github.com/evvsksh/FunkinLauncher.git
cd FunkinLauncher

npm ci --no-audit --no-fund

# Add Flathub
flatpak --user remote-add --if-not-exists flathub \
    https://flathub.org/repo/flathub.flatpakrepo

# Get Tauri version
VERSION=$(jq -r '.version' src-tauri/tauri.conf.json)

# Build
flatpak-builder --user \
    --force-clean \
    --install-deps-from=flathub \
    --repo=repo \
    build-dir \
    flatpak/it.evvsk.FunkinLauncher.json

# Package
flatpak build-bundle repo \
    "Funkin.Launcher_${VERSION}.flatpak" \
    it.evvsk.FunkinLauncher
```
<div align="center">
  <h2>Contributors</h2>
  <img src="https://contrib.rocks/image?repo=evvsksh/FunkinLauncher"/> 
</div>
