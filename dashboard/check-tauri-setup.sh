#!/bin/bash

# Tauri Setup Verification Script
# Checks if all prerequisites are met

echo "🔍 haan.ai Tauri Setup Checker"
echo "================================"
echo ""

ERRORS=0
WARNINGS=0

# Check Node.js
echo -n "📦 Checking Node.js... "
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo "✅ $NODE_VERSION"
else
    echo "❌ NOT FOUND"
    echo "   Install from: https://nodejs.org/"
    ERRORS=$((ERRORS + 1))
fi

# Check npm
echo -n "📦 Checking npm... "
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    echo "✅ v$NPM_VERSION"
else
    echo "❌ NOT FOUND"
    ERRORS=$((ERRORS + 1))
fi

# Check Rust
echo -n "🦀 Checking Rust... "
if command -v rustc &> /dev/null; then
    RUST_VERSION=$(rustc --version | cut -d' ' -f2)
    echo "✅ v$RUST_VERSION"
else
    echo "❌ NOT FOUND"
    echo "   Run: curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
    ERRORS=$((ERRORS + 1))
fi

# Check Cargo
echo -n "📦 Checking Cargo... "
if command -v cargo &> /dev/null; then
    CARGO_VERSION=$(cargo --version | cut -d' ' -f2)
    echo "✅ v$CARGO_VERSION"
else
    echo "❌ NOT FOUND"
    ERRORS=$((ERRORS + 1))
fi

echo ""
echo "📁 Checking Files..."

# Check package.json
echo -n "   package.json... "
if [ -f "package.json" ]; then
    echo "✅"
else
    echo "❌ NOT FOUND"
    ERRORS=$((ERRORS + 1))
fi

# Check src-tauri directory
echo -n "   src-tauri/... "
if [ -d "src-tauri" ]; then
    echo "✅"
else
    echo "❌ NOT FOUND"
    ERRORS=$((ERRORS + 1))
fi

# Check tauri.conf.json
echo -n "   src-tauri/tauri.conf.json... "
if [ -f "src-tauri/tauri.conf.json" ]; then
    echo "✅"
else
    echo "❌ NOT FOUND"
    ERRORS=$((ERRORS + 1))
fi

# Check lib.rs
echo -n "   src-tauri/src/lib.rs... "
if [ -f "src-tauri/src/lib.rs" ]; then
    # Check if it has API server code
    if grep -q "start_api_server" "src-tauri/src/lib.rs"; then
        echo "✅ (with API server)"
    else
        echo "⚠️  (missing API server code)"
        WARNINGS=$((WARNINGS + 1))
    fi
else
    echo "❌ NOT FOUND"
    ERRORS=$((ERRORS + 1))
fi

# Check Cargo.toml
echo -n "   src-tauri/Cargo.toml... "
if [ -f "src-tauri/Cargo.toml" ]; then
    echo "✅"
else
    echo "❌ NOT FOUND"
    ERRORS=$((ERRORS + 1))
fi

# Check icons
echo -n "   src-tauri/icons/... "
if [ -d "src-tauri/icons" ] && [ -f "src-tauri/icons/icon.icns" ]; then
    ICON_COUNT=$(ls src-tauri/icons/*.png 2>/dev/null | wc -l)
    echo "✅ ($ICON_COUNT icons)"
else
    echo "❌ NOT FOUND"
    ERRORS=$((ERRORS + 1))
fi

# Check node_modules
echo -n "   node_modules/... "
if [ -d "node_modules" ]; then
    if [ -d "node_modules/@tauri-apps/cli" ]; then
        echo "✅ (Tauri installed)"
    else
        echo "⚠️  (run npm install)"
        WARNINGS=$((WARNINGS + 1))
    fi
else
    echo "⚠️  (run npm install)"
    WARNINGS=$((WARNINGS + 1))
fi

echo ""
echo "🔧 Checking Parent Project..."

# Check parent bin/haan.js
echo -n "   ../bin/haan.js... "
if [ -f "../bin/haan.js" ]; then
    echo "✅"
else
    echo "❌ NOT FOUND"
    echo "   Run: cd .. && npm run build"
    ERRORS=$((ERRORS + 1))
fi

# Check parent dist
echo -n "   ../dist/index.js... "
if [ -f "../dist/index.js" ]; then
    echo "✅"
else
    echo "⚠️  NOT FOUND"
    echo "   Run: cd .. && npm run build"
    WARNINGS=$((WARNINGS + 1))
fi

echo ""
echo "================================"

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo "✅ All checks passed!"
    echo ""
    echo "🚀 You're ready to run:"
    echo "   npm run tauri:dev"
    echo ""
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo "⚠️  $WARNINGS warning(s) found"
    echo ""
    echo "You can still run the app, but you may need to:"
    echo "   npm install              # Install dependencies"
    echo "   cd .. && npm run build   # Build parent project"
    echo ""
    exit 0
else
    echo "❌ $ERRORS error(s) found"
    if [ $WARNINGS -gt 0 ]; then
        echo "⚠️  $WARNINGS warning(s) found"
    fi
    echo ""
    echo "Please fix the errors above before running the app."
    echo ""
    echo "Quick fixes:"
    if ! command -v rustc &> /dev/null; then
        echo "  1. Install Rust: ./install-tauri.sh"
    fi
    if [ ! -d "node_modules" ]; then
        echo "  2. Install deps: npm install"
    fi
    if [ ! -f "../dist/index.js" ]; then
        echo "  3. Build parent: cd .. && npm run build"
    fi
    echo ""
    exit 1
fi
