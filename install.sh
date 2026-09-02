#!/usr/bin/env bash
set -e

# EnQuota Universal Linux & macOS Installer
REPO="Najihh/EnQuota"
BIN_NAME="enquota"

echo "=== Installing EnQuota ==="

OS="$(uname -s)"
ARCH="$(uname -m)"

case "$OS" in
  Linux)
    case "$ARCH" in
      x86_64|amd64) TARGET="enquota-linux-amd64" ;;
      aarch64|arm64) TARGET="enquota-linux-arm64" ;;
      *) echo "Unsupported Linux architecture: $ARCH"; exit 1 ;;
    esac
    ;;
  Darwin)
    case "$ARCH" in
      arm64) TARGET="enquota-darwin-arm64" ;;
      x86_64) TARGET="enquota-darwin-amd64" ;;
      *) echo "Unsupported macOS architecture: $ARCH"; exit 1 ;;
    esac
    ;;
  *)
    echo "Unsupported OS: $OS. Please use PowerShell on Windows or install manually via npm."
    exit 1
    ;;
esac

DOWNLOAD_URL="https://github.com/${REPO}/releases/latest/download/${TARGET}"

# Determine install directory
if [ -w "/usr/local/bin" ]; then
  INSTALL_DIR="/usr/local/bin"
elif [ -d "$HOME/.local/bin" ]; then
  INSTALL_DIR="$HOME/.local/bin"
else
  INSTALL_DIR="/usr/local/bin"
fi

echo "Downloading ${TARGET} from ${DOWNLOAD_URL}..."
TMP_FILE="$(mktemp)"

if command -v curl >/dev/null 2>&1; then
  curl -fsSL -L "$DOWNLOAD_URL" -o "$TMP_FILE"
elif command -v wget >/dev/null 2>&1; then
  wget -qO "$TMP_FILE" "$DOWNLOAD_URL"
else
  echo "Error: curl or wget is required to download EnQuota."
  exit 1
fi

chmod +x "$TMP_FILE"

if [ -w "$INSTALL_DIR" ]; then
  mv "$TMP_FILE" "${INSTALL_DIR}/${BIN_NAME}"
else
  echo "Installing to ${INSTALL_DIR} requires sudo privileges:"
  sudo mv "$TMP_FILE" "${INSTALL_DIR}/${BIN_NAME}"
fi

echo ""
echo "=== EnQuota installed successfully to ${INSTALL_DIR}/${BIN_NAME} ==="
echo "Run 'enquota --help' or 'enquota detect 0896xxxxxxx' to get started."
