#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# haan.ai — Cross-Platform Installer
# Usage: curl -fsSL https://haan.ai/install.sh | bash
# ═══════════════════════════════════════════════════════════════

set -euo pipefail

# ── Colors ──
CYAN='\033[0;36m'
PURPLE='\033[0;35m'
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
DIM='\033[0;90m'
BOLD='\033[1m'
RESET='\033[0m'

# ── Banner ──
echo ""
echo -e "${CYAN}  _                          ${PURPLE}       _ ${RESET}"
echo -e "${CYAN} | |__   __ _  __ _ _ __    ${PURPLE}  __ _(_)${RESET}"
echo -e "${CYAN} | '_ \ / _\` |/ _\` | '_ \  ${PURPLE} / _\` | |${RESET}"
echo -e "${CYAN} | | | | (_| | (_| | | | |${PURPLE} | (_| | |${RESET}"
echo -e "${CYAN} |_| |_|\__,_|\__,_|_| |_|${PURPLE}  \__,_|_|${RESET}"
echo ""
echo -e "${DIM}  Autonomous Coding Agent — Installer${RESET}"
echo ""

# ── Detect OS ──
detect_os() {
  local os=""
  local arch=""

  case "$(uname -s)" in
    Linux*)   os="linux" ;;
    Darwin*)  os="macos" ;;
    CYGWIN*|MINGW*|MSYS*) os="windows" ;;
    *)        os="unknown" ;;
  esac

  case "$(uname -m)" in
    x86_64|amd64)  arch="x64" ;;
    arm64|aarch64) arch="arm64" ;;
    *)             arch="x64" ;;
  esac

  echo "${os}:${arch}"
}

OS_ARCH=$(detect_os)
OS="${OS_ARCH%%:*}"
ARCH="${OS_ARCH##*:}"

echo -e "  ${DIM}Platform:${RESET} ${BOLD}${OS}${RESET} (${ARCH})"

if [ "$OS" = "unknown" ]; then
  echo -e "  ${RED}✗ Unsupported operating system.${RESET}"
  echo -e "  ${DIM}haan.ai supports macOS, Linux, and Windows (WSL).${RESET}"
  exit 1
fi

# ── Check Node.js ──
echo -e "  ${DIM}Checking Node.js...${RESET}"

check_node() {
  if ! command -v node &>/dev/null; then
    return 1
  fi

  local version
  version=$(node -v 2>/dev/null | sed 's/v//')
  local major
  major=$(echo "$version" | cut -d. -f1)

  if [ "$major" -lt 20 ]; then
    echo -e "  ${YELLOW}⚠ Node.js ${version} found, but v20+ is required.${RESET}"
    return 1
  fi

  echo -e "  ${GREEN}✓${RESET} Node.js v${version}"
  return 0
}

install_node_guidance() {
  echo ""
  echo -e "  ${BOLD}Node.js 20+ is required.${RESET} Install it using one of:"
  echo ""
  case "$OS" in
    macos)
      echo -e "  ${CYAN}brew install node${RESET}"
      echo -e "  ${DIM}or${RESET}"
      echo -e "  ${CYAN}curl -fsSL https://fnm.vercel.app/install | bash && fnm install 22${RESET}"
      ;;
    linux)
      echo -e "  ${CYAN}curl -fsSL https://fnm.vercel.app/install | bash && fnm install 22${RESET}"
      echo -e "  ${DIM}or${RESET}"
      echo -e "  ${CYAN}curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt-get install -y nodejs${RESET}"
      ;;
    windows)
      echo -e "  ${CYAN}winget install OpenJS.NodeJS.LTS${RESET}"
      echo -e "  ${DIM}or download from:${RESET} https://nodejs.org/"
      ;;
  esac
  echo ""
  echo -e "  ${DIM}After installing Node.js, re-run this script.${RESET}"
  exit 1
}

if ! check_node; then
  install_node_guidance
fi

# ── Check npm ──
if ! command -v npm &>/dev/null; then
  echo -e "  ${RED}✗ npm not found.${RESET} It should come with Node.js."
  echo -e "  ${DIM}Try reinstalling Node.js.${RESET}"
  exit 1
fi
echo -e "  ${GREEN}✓${RESET} npm $(npm -v)"

# ── Install haan-ai ──
echo ""
echo -e "  ${BOLD}Installing haan-ai...${RESET}"
echo ""

if npm install -g haan-ai 2>&1; then
  echo ""
  echo -e "  ${GREEN}✓${RESET} haan-ai installed successfully"
else
  echo ""
  echo -e "  ${YELLOW}⚠ Global install failed. Trying with sudo...${RESET}"
  if [ "$OS" != "windows" ]; then
    sudo npm install -g haan-ai 2>&1
    echo ""
    echo -e "  ${GREEN}✓${RESET} haan-ai installed successfully"
  else
    echo -e "  ${RED}✗ Installation failed.${RESET}"
    echo -e "  ${DIM}Try running this terminal as Administrator.${RESET}"
    exit 1
  fi
fi

# ── Setup config directory ──
HAAN_DIR="${HOME}/.haan"
ENV_FILE="${HAAN_DIR}/.env"

if [ ! -d "$HAAN_DIR" ]; then
  mkdir -p "$HAAN_DIR"
  echo -e "  ${GREEN}✓${RESET} Created ${DIM}~/.haan/${RESET}"
fi

if [ ! -f "$ENV_FILE" ]; then
  cat > "$ENV_FILE" << 'ENVEOF'
# haan.ai — API Keys
# Fill in at least one provider's key to get started.
#
# Get keys from:
#   Anthropic: https://console.anthropic.com/
#   OpenAI:    https://platform.openai.com/api-keys
#   Google AI: https://aistudio.google.com/apikey

ANTHROPIC_API_KEY=
OPENAI_API_KEY=
GOOGLE_API_KEY=
ENVEOF
  echo -e "  ${GREEN}✓${RESET} Created ${DIM}~/.haan/.env${RESET} (add your API keys here)"
fi

# ── Verify installation ──
echo ""
if command -v haan &>/dev/null; then
  INSTALLED_VERSION=$(haan --version 2>/dev/null || echo "1.0.0")
  echo -e "  ┌─────────────────────────────────────────────┐"
  echo -e "  │                                             │"
  echo -e "  │   ${GREEN}${BOLD}haan.ai installed successfully!${RESET}           │"
  echo -e "  │   ${DIM}Version: ${INSTALLED_VERSION}${RESET}                          │"
  echo -e "  │                                             │"
  echo -e "  │   ${BOLD}Next steps:${RESET}                               │"
  echo -e "  │                                             │"
  echo -e "  │   ${CYAN}1.${RESET} Add your API keys:                    │"
  echo -e "  │      ${DIM}nano ~/.haan/.env${RESET}                      │"
  echo -e "  │                                             │"
  echo -e "  │   ${CYAN}2.${RESET} Start coding:                         │"
  echo -e "  │      ${GREEN}haan${RESET} ${DIM}\"Build a REST API\"${RESET}              │"
  echo -e "  │                                             │"
  echo -e "  │   ${CYAN}3.${RESET} Or go full auto:                      │"
  echo -e "  │      ${GREEN}haan --mode auto${RESET}                      │"
  echo -e "  │                                             │"
  echo -e "  └─────────────────────────────────────────────┘"
else
  echo -e "  ${YELLOW}⚠ haan command not found in PATH.${RESET}"
  echo -e "  ${DIM}You may need to restart your terminal or add npm's global bin to PATH.${RESET}"
  echo -e "  ${DIM}Try: ${RESET}export PATH=\"\$(npm config get prefix)/bin:\$PATH\""
fi
echo ""
