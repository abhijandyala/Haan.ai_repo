# haan.ai Dashboard

Web and native desktop dashboard for the haan.ai autonomous coding agent.

## Quick Start

### Web Dashboard (Development)

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

Visit http://localhost:5173

The dashboard will proxy API requests to http://localhost:3333, so make sure to start the API server:

```bash
# In parent directory
cd ..
npm run build
node bin/haan.js --server --port 3333
```

### Native Desktop App

The dashboard can also run as a native macOS/Windows/Linux application using Tauri.

#### Prerequisites

1. **Install Rust** (required for Tauri):
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   ```

2. **Restart your terminal** or run:
   ```bash
   source $HOME/.cargo/env
   ```

#### Quick Setup

Run the install script:
```bash
./install-tauri.sh
```

Or manually:
```bash
# Install dependencies
npm install

# Build parent project
cd .. && npm run build && cd dashboard
```

#### Run Desktop App

```bash
# Development mode (hot reload)
npm run tauri:dev

# Build production app
npm run tauri:build
```

**Production builds are located at:**
- macOS: `src-tauri/target/release/bundle/macos/haan-ai.app`
- macOS DMG: `src-tauri/target/release/bundle/dmg/haan-ai_1.0.0_*.dmg`

See [TAURI_SETUP.md](./TAURI_SETUP.md) for detailed Tauri documentation.

## Features

- **Real-time Pipeline Monitoring**: Watch your AI agent work in real-time
- **Tool Execution Tracking**: See which tools are being used and when
- **Task Management**: Monitor task progress and status
- **WebSocket Live Updates**: Get instant updates as the pipeline executes
- **Native Desktop Performance**: Run as a native app with system integration

## Architecture

```
dashboard/
├── src/                    # React source code
│   ├── App.tsx            # Main application component
│   ├── components/        # React components
│   ├── lib/              # API client & utilities
│   └── stores/           # Zustand state management
├── src-tauri/            # Tauri native app
│   ├── src/              # Rust backend
│   ├── icons/            # App icons
│   └── tauri.conf.json   # Tauri config
├── dist/                 # Production build output
└── package.json
```

## Development

### Web Only

```bash
npm run dev       # Start Vite dev server
npm run build     # Build for production
npm run preview   # Preview production build
```

### Desktop App

```bash
npm run tauri:dev      # Start Tauri in development mode
npm run tauri:build    # Build production desktop app
npm run tauri          # Run Tauri CLI commands
```

## API Integration

The dashboard connects to the haan.ai API server on port 3333.

### API Endpoints

- `GET /api/health` - Health check
- `GET /api/status` - System status
- `GET /api/tools` - Available tools
- `POST /api/pipeline` - Start pipeline
- `GET /api/pipeline/:id` - Pipeline status
- `WS /ws` - WebSocket for real-time updates

### Environment Variables

The dashboard uses relative URLs for API calls, so it works in both:
- **Development**: Vite proxy forwards `/api` to `http://localhost:3333`
- **Production**: Same-origin requests (both served from port 3333)
- **Tauri**: The desktop app starts the API server automatically

## Building for Production

### Web Build

```bash
npm run build
```

Output: `dist/` directory

Serve with:
```bash
# From parent directory
node bin/haan.js --dashboard --port 3333
```

### Desktop Build

```bash
npm run tauri:build
```

Output:
- macOS `.app`: `src-tauri/target/release/bundle/macos/`
- macOS `.dmg`: `src-tauri/target/release/bundle/dmg/`
- Windows `.msi`: `src-tauri/target/release/bundle/msi/`
- Linux `.deb/.appimage`: `src-tauri/target/release/bundle/`

## Tech Stack

- **Frontend**: React 18 + TypeScript
- **Build Tool**: Vite 6
- **State Management**: Zustand
- **Syntax Highlighting**: Prism React Renderer
- **Desktop**: Tauri 2.10
- **Backend**: Rust (for Tauri)

## Contributing

1. Make changes to React components in `src/`
2. Test with `npm run dev`
3. For Tauri changes, edit `src-tauri/src/lib.rs`
4. Build with `npm run build` or `npm run tauri:build`

## Troubleshooting

### Port 3333 in use

```bash
lsof -ti:3333 | xargs kill -9
```

### Vite dev server issues

```bash
rm -rf node_modules dist
npm install
npm run dev
```

### Tauri build fails

```bash
cd src-tauri
cargo clean
cd ..
npm run tauri:build
```

### API not connecting

1. Ensure API server is running: `node bin/haan.js --server`
2. Check port 3333 is accessible
3. Check browser console for errors

## License

MIT

## Resources

- [Tauri Documentation](https://v2.tauri.app)
- [Vite Documentation](https://vitejs.dev)
- [React Documentation](https://react.dev)
