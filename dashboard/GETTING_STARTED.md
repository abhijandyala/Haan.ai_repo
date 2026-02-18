# Getting Started with haan.ai Desktop App

This guide will help you set up and run the native desktop application.

## 🚀 Quick Start (5 minutes)

### Step 1: Install Rust

Open your terminal and run:

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

Follow the prompts (just press Enter to accept defaults).

**After installation, restart your terminal** or run:
```bash
source $HOME/.cargo/env
```

Verify it worked:
```bash
rustc --version
# Should show: rustc 1.xx.x
```

### Step 2: Run the Setup Script

```bash
cd /Users/suhaan/Documents/Coding/Haan.ai/dashboard
./install-tauri.sh
```

This will:
- ✅ Check Rust installation
- ✅ Install Node dependencies
- ✅ Build the parent project
- ✅ Set everything up

### Step 3: Launch the App

```bash
npm run tauri:dev
```

This will:
1. Start the React dashboard (Vite dev server)
2. Start the haan.ai API server on port 3333
3. Open the native desktop window

**First launch takes 2-5 minutes** (compiling Rust code). Subsequent launches are much faster.

## 🎯 What You'll See

When you run `npm run tauri:dev`, you should see:

```
    Info Starting dev server...
    Info Compiling app...
    Info Building application...
    Info Running beforeDevCommand `npm run dev`

VITE v6.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose

    Info Watching for changes...
```

Then a native window will open showing the haan.ai dashboard.

## 🔧 Common Issues

### "rustc: command not found"

You need to install Rust first (see Step 1 above).

### "EADDRINUSE: address already in use :::3333"

Port 3333 is already in use. Kill the process:

```bash
lsof -ti:3333 | xargs kill -9
```

### Compilation takes forever

First compile can take 2-5 minutes. This is normal for Rust. Subsequent builds are faster.

### Window opens but shows error

Make sure the parent project is built:

```bash
cd /Users/suhaan/Documents/Coding/Haan.ai
npm run build
```

### API not responding

Check if the API server started in the terminal output. You should see something like:
```
Starting API server from: /path/to/bin/haan.js
```

## 📦 Building for Distribution

Once everything works in dev mode, create a production build:

```bash
npm run tauri:build
```

**Build time:** 5-10 minutes (first time)

**Output:**
- macOS App: `src-tauri/target/release/bundle/macos/haan-ai.app`
- macOS DMG: `src-tauri/target/release/bundle/dmg/haan-ai_1.0.0_*.dmg`

You can then:
1. Move the `.app` to `/Applications`
2. Distribute the `.dmg` to other users

## 🎨 How It Works

```
┌─────────────────────────────────────┐
│   Native Desktop Window (Tauri)     │
│  ┌───────────────────────────────┐  │
│  │   React Dashboard UI          │  │
│  │   (Vite + React)              │  │
│  └───────────────────────────────┘  │
│              ▲                       │
│              │ WebSocket             │
│              │                       │
│  ┌───────────▼───────────────────┐  │
│  │   Node.js API Server          │  │
│  │   (port 3333)                 │  │
│  │   - REST API                  │  │
│  │   - WebSocket                 │  │
│  │   - Pipeline execution        │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

### Startup Sequence:

1. **Tauri launches** (Rust binary)
2. **API server starts** automatically (`node bin/haan.js --server`)
3. **React dashboard loads** in the native window
4. **WebSocket connects** to localhost:3333
5. **You're ready to use the app!**

### Shutdown:

1. Close the window
2. API server automatically stops
3. Clean exit

## 📚 Next Steps

- See [README.md](./README.md) for full documentation
- See [TAURI_SETUP.md](./TAURI_SETUP.md) for detailed Tauri info
- Check the [parent project README](../README.md) for API details

## 🧪 Testing the App

Once the app is running, try:

1. **Check Health**: The dashboard should show "Healthy" status
2. **View Tools**: You should see all available tools listed
3. **Create Task**: Try creating a simple task to test the pipeline
4. **Watch Real-time**: Observe WebSocket updates in the console

## 💡 Development Tips

### Hot Reload

- **React changes**: Automatically reload (instant)
- **Rust changes**: Require restart (`Ctrl+C` then `npm run tauri:dev`)

### Debugging

Add console logs in the React code:
```typescript
console.log('Debug:', data);
```

View them in:
- **macOS**: Safari > Develop > haan-ai > Console
- **Or**: Right-click in app > Inspect Element (if devtools enabled)

### Performance

Development mode is slower. Production builds are much faster:
```bash
npm run tauri:build
./src-tauri/target/release/bundle/macos/haan-ai.app/Contents/MacOS/haan-ai
```

## 🔥 Ready to Go!

```bash
# Just run this:
cd /Users/suhaan/Documents/Coding/Haan.ai/dashboard
npm run tauri:dev
```

**First time:** 5-7 minutes total (Rust compile)
**After that:** ~30 seconds to launch

Enjoy your native haan.ai desktop app!
