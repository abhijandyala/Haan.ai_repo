#!/bin/bash

# Tauri Desktop App - Quick Setup Script
# This script helps you install Rust and set up the Tauri desktop app

set -e

echo "🔥 haan.ai Tauri Desktop App - Setup"
echo "======================================"
echo ""

# Check if Rust is installed
if ! command -v rustc &> /dev/null; then
    echo "📦 Rust is not installed."
    echo ""
    read -p "Do you want to install Rust now? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Installing Rust..."
        curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y

        # Source cargo env
        source $HOME/.cargo/env

        echo "✅ Rust installed successfully!"
        rustc --version
        cargo --version
    else
        echo "❌ Rust is required to build Tauri apps."
        echo "Install manually: curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
        exit 1
    fi
else
    echo "✅ Rust is already installed:"
    rustc --version
    cargo --version
fi

echo ""
echo "📦 Checking Node.js..."

if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed."
    echo "Please install Node.js from: https://nodejs.org/"
    exit 1
else
    echo "✅ Node.js is installed:"
    node --version
    npm --version
fi

echo ""
echo "📦 Installing dependencies..."
npm install

echo ""
echo "🏗️  Building parent project..."
cd ..
npm run build

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Start development mode:"
echo "     cd dashboard && npm run tauri:dev"
echo ""
echo "  2. Build production app:"
echo "     cd dashboard && npm run tauri:build"
echo ""
echo "  3. See TAURI_SETUP.md for more details"
echo ""
