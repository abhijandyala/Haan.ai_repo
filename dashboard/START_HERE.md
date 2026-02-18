# 🔥 haan.ai Desktop App - START HERE

## ⚡ Quick Launch (Copy & Paste)

```bash
# 1. Install Rust (one-time, 5 min)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env

# 2. Run setup (one-time, 2 min)
cd /Users/suhaan/Documents/Coding/Haan.ai/dashboard
./install-tauri.sh

# 3. Launch the app (30 sec)
npm run tauri:dev
```

That's it! The native desktop app will open.

---

## 📖 Documentation

- **[GETTING_STARTED.md](./GETTING_STARTED.md)** - Detailed getting started guide
- **[TAURI_SETUP.md](./TAURI_SETUP.md)** - Complete Tauri documentation
- **[README.md](./README.md)** - Dashboard overview
- **[TAURI_INSTALLATION_COMPLETE.md](./TAURI_INSTALLATION_COMPLETE.md)** - What was installed

## 🔍 Verify Setup

Run this anytime to check if everything is ready:

```bash
./check-tauri-setup.sh
```

## 🚀 Commands

### Development
```bash
npm run tauri:dev        # Launch desktop app (dev mode)
npm run dev              # Web only (no desktop)
```

### Production
```bash
npm run tauri:build      # Build .app/.dmg for distribution
npm run build            # Web build only
```

### Utilities
```bash
./check-tauri-setup.sh   # Verify everything is installed
./install-tauri.sh       # Run setup/installation
```

## 🎯 What You Get

- ✅ Native macOS/Windows/Linux app
- ✅ Auto-starts API server (port 3333)
- ✅ WebSocket real-time updates
- ✅ 1400x900 window (resizable, min 1000x600)
- ✅ Production-ready builds (.dmg installer)
- ✅ Clean shutdown (kills API server)

## ⚙️ How It Works

1. Launch app → Tauri starts (Rust)
2. API server auto-starts → `node bin/haan.js --server`
3. Dashboard loads → React UI in native window
4. WebSocket connects → Real-time pipeline updates
5. Close window → API server stops automatically

## 🧪 First Run

When you run `npm run tauri:dev` for the first time:

1. **Compiling Rust** (2-5 minutes first time only)
2. **Starting Vite** (React dev server)
3. **Launching API** (Node.js server on port 3333)
4. **Opening Window** (Native desktop app)

Subsequent runs: ~30 seconds

## 📦 Distribution

After `npm run tauri:build`:

- **macOS App**: `src-tauri/target/release/bundle/macos/haan-ai.app`
- **macOS DMG**: `src-tauri/target/release/bundle/dmg/haan-ai_1.0.0_*.dmg`

Move the `.app` to `/Applications` or share the `.dmg` with users.

## 🆘 Troubleshooting

### Rust not installed
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env
```

### Port 3333 in use
```bash
lsof -ti:3333 | xargs kill -9
```

### Clean rebuild
```bash
cd src-tauri && cargo clean && cd ..
npm run tauri:build
```

### API won't start
```bash
cd /Users/suhaan/Documents/Coding/Haan.ai
npm run build
```

## 🎓 Learn More

- Tauri: https://v2.tauri.app
- React: https://react.dev
- Vite: https://vitejs.dev

---

**Ready?** Run this:

```bash
./check-tauri-setup.sh && npm run tauri:dev
```
