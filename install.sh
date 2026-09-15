#!/bin/bash
# ────────────────────────────────────────────────────────
# Pomus - Install Script (user-local, no sudo required)
# Installs launcher, .desktop entry, and icons into
# ~/.local/{bin,share/applications,share/icons/hicolor}
# ────────────────────────────────────────────────────────
set -euo pipefail

APP_NAME="pomus"
PROJECT_DIR="$(cd "$(dirname "$(readlink -f "$0")")" && pwd)"

BIN_DIR="${HOME}/.local/bin"
APPS_DIR="${HOME}/.local/share/applications"
ICON_SVG_DIR="${HOME}/.local/share/icons/hicolor/scalable/apps"
ICON_PNG_DIR="${HOME}/.local/share/icons/hicolor/512x512/apps"

echo "╔══════════════════════════════════════════════╗"
echo "║   🍅 Pomus - Instalação Local para Linux    ║"
echo "╚══════════════════════════════════════════════╝"
echo ""
echo "Diretório do projeto: ${PROJECT_DIR}"
echo ""

# ── 1. Executável (symlink para o launcher) ──
mkdir -p "${BIN_DIR}"
ln -sf "${PROJECT_DIR}/pomus" "${BIN_DIR}/${APP_NAME}"
echo "✔ Executável instalado: ${BIN_DIR}/${APP_NAME}"

# ── 2. Desktop Entry ──
mkdir -p "${APPS_DIR}"
# Gera o .desktop com o Exec apontando para o caminho real
sed "s|Exec=pomus %U|Exec=${BIN_DIR}/${APP_NAME} %U|" \
    "${PROJECT_DIR}/pomus.desktop" > "${APPS_DIR}/${APP_NAME}.desktop"
chmod 644 "${APPS_DIR}/${APP_NAME}.desktop"
echo "✔ Desktop entry instalado: ${APPS_DIR}/${APP_NAME}.desktop"

# ── 3. Ícone SVG (scalable) ──
if [ -f "${PROJECT_DIR}/assets/icon.svg" ]; then
    mkdir -p "${ICON_SVG_DIR}"
    cp -f "${PROJECT_DIR}/assets/icon.svg" "${ICON_SVG_DIR}/${APP_NAME}.svg"
    echo "✔ Ícone SVG instalado: ${ICON_SVG_DIR}/${APP_NAME}.svg"
fi

# ── 4. Ícone PNG (512x512) ──
if [ -f "${PROJECT_DIR}/assets/icon.png" ]; then
    mkdir -p "${ICON_PNG_DIR}"
    cp -f "${PROJECT_DIR}/assets/icon.png" "${ICON_PNG_DIR}/${APP_NAME}.png"
    echo "✔ Ícone PNG instalado: ${ICON_PNG_DIR}/${APP_NAME}.png"
fi

# ── 4.1 Ícones em Pixmaps (fallback direto para docks KDE/GNOME) ──
PIXMAPS_DIR="${HOME}/.local/share/pixmaps"
mkdir -p "${PIXMAPS_DIR}"
if [ -f "${PROJECT_DIR}/assets/icon.png" ]; then
    cp -f "${PROJECT_DIR}/assets/icon.png" "${PIXMAPS_DIR}/${APP_NAME}.png"
fi
if [ -f "${PROJECT_DIR}/assets/icon.svg" ]; then
    cp -f "${PROJECT_DIR}/assets/icon.svg" "${PIXMAPS_DIR}/${APP_NAME}.svg"
fi
echo "✔ Ícones instalados em pixmaps: ${PIXMAPS_DIR}/"

# ── 5. Atualizar caches do desktop ──
if command -v update-desktop-database &>/dev/null; then
    update-desktop-database "${APPS_DIR}" 2>/dev/null || true
fi
if command -v gtk-update-icon-cache &>/dev/null; then
    gtk-update-icon-cache -f -t "${HOME}/.local/share/icons/hicolor" 2>/dev/null || true
fi

echo ""
echo "═══════════════════════════════════════════════"
echo "  ✅ Instalação concluída com sucesso!"
echo ""
echo "  Você já pode:"
echo "    • Abrir pelo menu de aplicativos (KDE/GNOME)"
echo "    • Executar no terminal: pomus"
echo "    • Desinstalar com: ./uninstall.sh"
echo "═══════════════════════════════════════════════"
