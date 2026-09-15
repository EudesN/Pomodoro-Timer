#!/bin/bash
# ────────────────────────────────────────────────────────
# Pomus - Uninstall Script
# Removes launcher, .desktop entry, and icons from
# ~/.local/{bin,share/applications,share/icons/hicolor}
# ────────────────────────────────────────────────────────
set -euo pipefail

APP_NAME="pomus"

BIN_DIR="${HOME}/.local/bin"
APPS_DIR="${HOME}/.local/share/applications"
ICON_SVG_DIR="${HOME}/.local/share/icons/hicolor/scalable/apps"
ICON_PNG_DIR="${HOME}/.local/share/icons/hicolor/512x512/apps"

echo "╔══════════════════════════════════════════════╗"
echo "║   🍅 Pomus - Desinstalação Local            ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

remove_file() {
    if [ -f "$1" ] || [ -L "$1" ]; then
        rm -f "$1"
        echo "✔ Removido: $1"
    else
        echo "  (não encontrado: $1)"
    fi
}

remove_file "${BIN_DIR}/${APP_NAME}"
remove_file "${APPS_DIR}/${APP_NAME}.desktop"
remove_file "${ICON_SVG_DIR}/${APP_NAME}.svg"
remove_file "${ICON_PNG_DIR}/${APP_NAME}.png"
remove_file "${HOME}/.local/share/pixmaps/${APP_NAME}.png"
remove_file "${HOME}/.local/share/pixmaps/${APP_NAME}.svg"

# Atualizar caches do desktop
if command -v update-desktop-database &>/dev/null; then
    update-desktop-database "${APPS_DIR}" 2>/dev/null || true
fi
if command -v gtk-update-icon-cache &>/dev/null; then
    gtk-update-icon-cache -f -t "${HOME}/.local/share/icons/hicolor" 2>/dev/null || true
fi

echo ""
echo "═══════════════════════════════════════════════"
echo "  ✅ Desinstalação concluída."
echo "  Os dados do aplicativo (pomus_data.json) não"
echo "  foram removidos. Exclua manualmente se desejar."
echo "═══════════════════════════════════════════════"
