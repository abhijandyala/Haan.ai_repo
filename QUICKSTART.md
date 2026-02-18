# 🔥 haan.ai — Quick Start Guide

## Three Ways to Use Haan.ai

### 1️⃣ Terminal CLI (Default)
**Best for:** Command-line users, CI/CD, automation

```bash
# Interactive mode
haan

# Direct task execution
haan "Build a REST API with user authentication"

# Auto mode (no confirmations)
haan -y "Refactor the database layer"

# Specify project directory
haan --dir /path/to/project
```

---

### 2️⃣ Web Dashboard (NEW! ✨)
**Best for:** Visual pipeline tracking, real-time updates, split-panel UI

```bash
# Start server + open browser
haan --dashboard

# Or manually:
haan --server --port 3333
# Then open http://localhost:3333 in your browser
```

**Features:**
- 🎨 **Void Flame** color scheme (deep blacks + amber/orange fire)
- 📊 Split-panel layout (like OpenAI Codex)
- ⚡ Real-time WebSocket updates
- 🔍 Code diffs, file trees, streaming messages
- 📈 Live cost tracking and agent activity
- 🎯 Stage timeline with progress indicators

---

### 3️⃣ Native Desktop App (Tauri)
**Best for:** Standalone app experience, macOS/Windows/Linux

```bash
cd dashboard

# First time setup (requires Rust):
./install-tauri.sh

# Launch desktop app:
npm run tauri:dev

# Build production app:
npm run tauri:build
```

See [`dashboard/START_HERE.md`](dashboard/START_HERE.md) for full Tauri docs.

---

## 🌐 Web Dashboard Details

### Color Scheme: "Void Flame"
A unique identity distinct from Codex (black/white), Claude (grey/orange), and Cursor (dark/blue).

- **Background:** `#07080C` (void black)
- **Accents:** `#F59E0B` (amber fire), `#FBBF24` (amber glow)
- **Text:** `#E8E9ED` (near-white) on deep void surfaces
- **Agent colors:** Purple (planner), Emerald (builder), Blue (tester), Red (debugger), Amber (reviewer)

### Architecture
- **Frontend:** React 18 + Vite 6 + Zustand (state management)
- **Backend:** Node.js HTTP server + WebSocket bridge
- **Real-time:** EventBus → WebSocket → Browser (27 event types)
- **Components:** 24 React components (layout, pipeline, messages, code, agents)
- **Build size:** 167 KB gzipped

### How It Works
1. `haan --dashboard` starts API server on port 3333
2. Browser opens to `http://localhost:3333`
3. Dashboard connects via WebSocket to `/ws`
4. All pipeline events stream in real-time
5. Submit tasks via the input bar at the bottom
6. Watch stages progress on the left, messages/code on the right

---

## 🚀 Installation

### Install haan.ai globally:
```bash
npm install -g haan-ai
```

### Or via curl (from website):
```bash
curl -fsSL https://haan.ai/install.sh | bash
```

### Build from source:
```bash
git clone https://github.com/your-org/haan.ai.git
cd haan.ai
npm install
npm run build
npm link

# Build dashboard too:
cd dashboard
npm install
npm run build
```

---

## 🧪 Verify Installation

### Check CLI:
```bash
haan --help
```

### Check Web Dashboard:
```bash
haan --dashboard
# Browser should open automatically
```

### Check API Server:
```bash
haan --server --port 3333
curl http://localhost:3333/api/health
# Should return: {"status":"ok","uptime":...}
```

### Check Desktop App (if Tauri installed):
```bash
cd dashboard
./check-tauri-setup.sh
npm run tauri:dev
```

---

## 📊 Full Build Stats

- **CLI:** 326 KB (bundled)
- **Dashboard:** 167 KB (gzipped)
- **Tests:** 63/63 passing ✅
- **TypeScript:** 0 errors ✅
- **Tools:** 25 registered
- **Agents:** 5 specialized (planner, builder, tester, debugger, reviewer)
- **Plugins:** Support for custom plugins + MCP servers
- **Events:** 27 typed events on the event bus

---

## 🔑 API Keys

Set via environment variables or `~/.haan/.env`:

```bash
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GOOGLE_API_KEY=AI...
```

---

## 🎯 Next Steps

1. **Try the CLI:**
   ```bash
   haan "Analyze this codebase and suggest improvements"
   ```

2. **Launch the Web Dashboard:**
   ```bash
   haan --dashboard
   ```

3. **Explore the marketing website:**
   Open `website/index.html` in a browser to see the updated landing page with:
   - Void Flame color scheme
   - curl install command
   - Plugin system, MCP integration, multi-agent features
   - Web dashboard showcase

4. **Build the desktop app (optional):**
   ```bash
   cd dashboard
   ./install-tauri.sh
   npm run tauri:dev
   ```

---

## 📚 Documentation

- **Main README:** [`README.md`](README.md)
- **Dashboard README:** [`dashboard/README.md`](dashboard/README.md)
- **Tauri Setup:** [`dashboard/START_HERE.md`](dashboard/START_HERE.md)
- **Getting Started:** [`dashboard/GETTING_STARTED.md`](dashboard/GETTING_STARTED.md)
- **Website:** [`website/index.html`](website/index.html)

---

## 🆘 Troubleshooting

### "command not found: haan"
```bash
npm link
```

### "Dashboard not built"
```bash
cd dashboard
npm install
npm run build
```

### Port 3333 in use
```bash
lsof -ti:3333 | xargs kill -9
haan --dashboard
```

### TypeScript errors
```bash
npx tsc --noEmit
npm run build
```

---

**Ready to build?** 🚀

```bash
haan --dashboard
```
