#!/usr/bin/env bash
set -euo pipefail

APP_ID="it.evvsk.FunkinLauncher"
BUILD_DIR="build-dir"
REPO_DIR="repo"
OUT_FILE="${APP_ID}.flatpak"

log() {
    echo -e "\033[1;32m[INFO]\033[0m $*"
}

error() {
    echo -e "\033[1;31m[ERROR]\033[0m $*" >&2
    exit 1
}

cleanup() {
    log "Cleaning up build artifacts..."
    rm -rf "$BUILD_DIR" "$REPO_DIR" "$OUT_FILE"
}
trap cleanup EXIT

require() {
    command -v "$1" >/dev/null 2>&1 || error "Missing dependency: $1"
}

log "Checking dependencies..."
require flatpak
require flatpak-builder
require npx

log "Ensuring Tauri build prerequisites..."
touch src-tauri/d.dll

log "Building Tauri (deb bundle)..."
npx tauri build --bundles deb

log "Adding Flathub remote (if needed)..."
flatpak --user remote-add --if-not-exists flathub \
    https://flathub.org/repo/flathub.flatpakrepo

log "Installing runtime (GNOME 48)..."
flatpak --user install -y flathub \
    org.gnome.Platform//48 \
    org.gnome.Sdk//48

log "Cleaning previous build state..."
rm -rf "$BUILD_DIR" "$REPO_DIR" "$OUT_FILE"

log "Building Flatpak..."
flatpak-builder \
    --force-clean \
    --user \
    --install-deps-from=flathub \
    --repo="$REPO_DIR" \
    "$BUILD_DIR" \
    flatpak.json

log "Creating Flatpak bundle..."
flatpak build-bundle \
    "$REPO_DIR" \
    "$OUT_FILE" \
    "$APP_ID"

log "Build complete: $OUT_FILE"
log "To install locally:"
log "  flatpak install --user $OUT_FILE"
log "To run:"
log "  flatpak run $APP_ID"
