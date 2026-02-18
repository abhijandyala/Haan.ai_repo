# Tauri Desktop App Setup

This directory contains the Tauri-based native desktop application for haan.ai.

## Prerequisites

### 1. Install Rust

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

After installation, restart your terminal or run:
```bash
source $HOME/.cargo/env
```

Verify installation:
```bash
rustc --version
cargo --version
```

### 2. Install System Dependencies (macOS)

```bash
# Install Xcode Command Line Tools (if not already installed)
xcode-select --install
```

For other platforms, see: https://v2.tauri.app/start/prerequisites/

## Development

### Start Development Mode

This will start both the Vite dev server and the Tauri app:

```bash
cd /Users/suhaan/Documents/Coding/Haan.ai/dashboard
npm run tauri:dev
```

The app will:
1. Start the React dashboard on port 5173
2. Start the haan.ai API server on port 3333
3. Open the native desktop window

### Hot Reload

- Frontend changes (React) will hot-reload automatically
- Backend changes (Rust) require restarting the app

## Building

### Build Production App

```bash
cd /Users/suhaan/Documents/Coding/Haan.ai/dashboard
npm run tauri:build
```

This creates:
- **macOS**: `src-tauri/target/release/bundle/macos/haan-ai.app`
- **macOS DMG**: `src-tauri/target/release/bundle/dmg/haan-ai_1.0.0_*.dmg`

### Distribution

The `.app` can be moved to `/Applications` or distributed.
The `.dmg` is ready for distribution to users.

## Architecture

### How It Works

1. **Tauri App Launches**: The Rust backend starts
2. **API Server Starts**: The app automatically starts the Node.js API server (`node bin/haan.js --server --port 3333`)
3. **Dashboard Loads**: The React frontend connects to the API server
4. **WebSocket Connection**: Real-time communication via WebSocket
5. **Window Closes**: API server is automatically killed

### File Structure

```
dashboard/
├── src/                    # React frontend source
├── dist/                   # Built React app
├── src-tauri/
│   ├── src/
│   │   ├── main.rs        # Entry point
│   │   └── lib.rs         # Main logic (API server startup)
│   ├── icons/             # App icons
│   ├── Cargo.toml         # Rust dependencies
│   └── tauri.conf.json    # Tauri configuration
└── package.json           # Node dependencies & scripts
```

## Configuration

### Window Settings

Edit `src-tauri/tauri.conf.json`:

```json
{
  "app": {
    "windows": [
      {
        "title": "haan.ai Dashboard",
        "width": 1400,
        "height": 900,
        "minWidth": 1000,
        "minHeight": 600,
        "resizable": true,
        "fullscreen": false
      }
    ]
  }
}
```

### API Server Port

Default port is 3333. To change it, edit `src-tauri/src/lib.rs`:

```rust
Command::new("node")
    .arg(server_path)
    .arg("--server")
    .arg("--port")
    .arg("3333")  // Change this
    .spawn()
```

## Troubleshooting

### Rust Not Found

Install Rust: `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`

### API Server Won't Start

1. Ensure Node.js is installed: `node --version`
2. Ensure the main project is built: `cd .. && npm run build`
3. Check that `bin/haan.js` exists in the parent directory

### Build Fails

1. Clean the build: `cd src-tauri && cargo clean`
2. Update Rust: `rustup update`
3. Rebuild: `npm run tauri:build`

### Port Already in Use

Kill any process using port 3333:
```bash
lsof -ti:3333 | xargs kill -9
```

## Scripts Reference

- `npm run dev` - Start Vite dev server only
- `npm run build` - Build React app only
- `npm run tauri` - Run Tauri CLI commands
- `npm run tauri:dev` - Start Tauri in development mode
- `npm run tauri:build` - Build production desktop app

## Next Steps

1. Install Rust (see Prerequisites above)
2. Run `npm run tauri:dev` to start development
3. Build with `npm run tauri:build` when ready to distribute

## Resources

- Tauri Docs: https://v2.tauri.app
- Tauri API: https://v2.tauri.app/reference/javascript/api/
- Rust Book: https://doc.rust-lang.org/book/
