# Haan.ai Roadmap

## Current MVP Status (v1.0)

### What's Built

**Core Architecture**
- Multi-agent pipeline engine: PLANNING → BUILDING → TESTING → DEBUGGING → REVIEWING
- Automatic retry loop on test failure (debug → build → test, max 3 retries)
- Review-driven improvement cycles (build → test → review, max 2 passes)
- Human-aided mode with approval gates at every stage
- Auto mode for fully autonomous execution
- Git stash/restore during retry loops for state safety

**5 Specialized Agents**
- **Planner** — Analyzes requirements, produces step-by-step implementation plans with risk assessment
- **Builder** — Implements code using file-write/edit tools, validates non-empty output
- **Tester** — Generates tests, discovers test frameworks, runs and parses results
- **Debugger** — Root cause analysis on test failures, applies fixes
- **Feature Engineer** — Reviews code quality, security, performance; scores 1-10

**3 LLM Providers**
- **OpenAI** — Chat Completions + Responses API (for Codex models)
- **Anthropic** — Extended thinking support for Claude Opus/Sonnet
- **Google** — Gemini with thought signature handling for multi-turn tool calls

**22 Tools**
- File operations (7): read, write, edit, delete, search, glob, list
- Shell execution (1): with safety blocklist, timeout, output truncation
- Git operations (6): status, diff, commit, branch, push, log
- Web operations (2): search (DuckDuckGo), fetch/parse
- Code analysis (2): static analysis, symbol finder
- Test operations (3): discover, run, parse
- Memory operations (3): save, load, search

**20 CLI Commands**
- Pipeline: plan, build, test, debug, review (run individual stages)
- Management: config, mode, model, status, cost, memory, todo, logs
- Utilities: init, undo, doctor, compact, clear, help
- Easter egg: pong

**Terminal UI (Ink/React)**
- Real-time streaming text with character animation
- Agent panel showing current agent, iteration, tool execution
- Pipeline progress tracker with per-stage duration and tokens
- Status bar with mode, stage, token count, cost
- Structured output rendering for agent JSON summaries
- Diff viewer, file tree, code blocks
- Confirmation dialogs for human-aided mode

**Infrastructure**
- Event bus for pipeline↔UI↔cost tracking coordination
- Cost tracker with per-model pricing tables and 1.5x markup
- JSONL session logging with error filtering
- Long-term memory with persistent storage and search
- Working memory (ephemeral per-task state)
- Context window management with auto-compression at 110K tokens
- Read-only loop detection (nudges agents after 8 read-only iterations)
- Per-tool 60s timeout, per-stage 5min timeout

**Default Model Assignments**
| Role | Model | Provider |
|------|-------|----------|
| Planner | gemini-3-pro-preview | Google |
| Builder | gpt-5.2-codex | OpenAI |
| Tester | gpt-5.2-codex | OpenAI |
| Debugger | gpt-5.1-codex-max | OpenAI |
| Feature Engineer | gpt-5.1-codex-max | OpenAI |

---

## Phase 1: Core Stability & Reliability

**Goal:** Make the pipeline reliably complete end-to-end for real-world tasks.

### Agent Improvements
- [ ] Smarter context management — dynamically size context per agent role instead of fixed truncation
- [ ] Agent self-reflection — agents evaluate their own output quality before returning
- [ ] Better structured output parsing — handle partial/malformed JSON gracefully
- [ ] Tool call batching — group related file reads into single operations
- [ ] Progressive task decomposition — break large tasks into subtasks automatically

### Pipeline Hardening
- [ ] Parallel stage execution where independent (e.g., lint + test simultaneously)
- [ ] Stage dependency graph instead of linear sequence
- [ ] Checkpoint/resume — save pipeline state to disk, resume after crash
- [ ] Incremental builds — skip unchanged stages on re-run
- [ ] Better error classification — distinguish transient vs. permanent failures
- [ ] Configurable stage ordering — user-defined pipeline sequences

### Provider Reliability
- [ ] Automatic failover between providers (e.g., OpenAI down → fall back to Anthropic)
- [ ] Rate limit handling with queuing
- [ ] Request deduplication for identical prompts
- [ ] Provider health monitoring and circuit breaker pattern
- [ ] Streaming recovery — resume from last chunk on connection drop

### Testing & Validation
- [ ] Integration test suite for the pipeline itself
- [ ] Agent output validation schemas per stage
- [ ] Regression test library — known-good task/output pairs
- [ ] Benchmark suite — track agent performance across versions

---

## Phase 2: Intelligence & Capabilities

**Goal:** Make agents significantly smarter and more capable.

### Advanced Planning
- [ ] Multi-file dependency analysis — understand import graphs before planning
- [ ] Architecture-aware planning — detect patterns (MVC, microservices, etc.) and plan accordingly
- [ ] Risk scoring — flag high-risk changes (database migrations, auth changes, public API changes)
- [ ] Effort estimation — predict token cost and time before execution
- [ ] Plan versioning — compare multiple plan alternatives

### Enhanced Building
- [ ] Incremental code generation — generate file-by-file with validation between each
- [ ] Type-aware editing — use TypeScript/language server for type-safe modifications
- [ ] Template library — reusable code patterns for common tasks (REST API, auth, CRUD, etc.)
- [ ] Multi-language support — detect and adapt to project language (Python, Rust, Go, Java, etc.)
- [ ] Framework detection — auto-detect Next.js, Express, Django, Rails, etc. and use framework-specific patterns

### Smarter Testing
- [ ] Coverage-aware test generation — target uncovered code paths
- [ ] Property-based testing — generate edge cases automatically
- [ ] Visual regression testing — screenshot comparison for UI changes
- [ ] Performance testing — benchmark before/after for performance-sensitive changes
- [ ] Test prioritization — run most likely-to-fail tests first

### Deep Debugging
- [ ] Stack trace analysis — parse and navigate error traces automatically
- [ ] Binary search bisection — git bisect integration for regression hunting
- [ ] Memory/performance profiling — detect leaks and bottlenecks
- [ ] Log correlation — match runtime logs to code paths
- [ ] Dependency conflict resolution — detect and fix version mismatches

### Code Review Upgrades
- [ ] Security scanning — OWASP top 10, dependency vulnerabilities, secrets detection
- [ ] Performance profiling — identify O(n^2) patterns, unnecessary re-renders, N+1 queries
- [ ] Style consistency — enforce project conventions beyond linting
- [ ] Documentation quality — check for outdated/missing docs
- [ ] Accessibility auditing — WCAG compliance for UI changes

### Memory & Learning
- [ ] Project knowledge base — auto-index codebase structure, conventions, patterns
- [ ] Cross-session learning — remember what worked/failed for similar tasks
- [ ] Team conventions — learn from git history and PR patterns
- [ ] Decision logging — record why certain approaches were chosen
- [ ] Semantic code search — embedding-based code retrieval

---

## Phase 3: Ecosystem & Integrations

**Goal:** Connect Haan.ai to the broader development ecosystem.

### MCP (Model Context Protocol) Integration
- [ ] MCP server mode — expose Haan.ai as an MCP server for other tools
- [ ] MCP client — consume external MCP servers for additional capabilities
- [ ] GitHub MCP — PR creation, issue management, code review directly through MCP
- [ ] Linear/Jira MCP — task tracking integration
- [ ] Slack/Discord MCP — notify team on pipeline completion
- [ ] Database MCP — query and modify databases safely
- [ ] Docker MCP — container management and deployment
- [ ] AWS/GCP/Azure MCP — cloud resource provisioning
- [ ] Figma MCP — design-to-code pipeline integration
- [ ] Sentry/Datadog MCP — error monitoring and alerting

### Plugin System
- [ ] Plugin manifest format (plugin.json) for third-party extensions
- [ ] Custom tool plugins — add domain-specific tools (e.g., Kubernetes, Terraform)
- [ ] Custom agent plugins — specialized agents for specific frameworks/languages
- [ ] Custom stage plugins — add pipeline stages (e.g., DEPLOYING, DOCUMENTING, LINTING)
- [ ] Plugin marketplace / registry
- [ ] Plugin versioning and dependency management
- [ ] Sandboxed plugin execution for security

### Git & CI/CD Integration
- [ ] PR workflow — auto-create branches, commits, and PRs with descriptions
- [ ] CI integration — trigger and monitor GitHub Actions / GitLab CI pipelines
- [ ] Pre-commit hooks — run Haan.ai review before commit
- [ ] Merge conflict resolution — auto-resolve or suggest resolutions
- [ ] Release automation — changelog generation, version bumping, tagging
- [ ] Monorepo support — scope changes to specific packages

### IDE Integration
- [ ] VS Code extension — run Haan.ai from within the editor
- [ ] JetBrains plugin — IntelliJ/WebStorm integration
- [ ] Neovim plugin — terminal-native integration
- [ ] LSP integration — provide Haan.ai suggestions through Language Server Protocol
- [ ] Inline annotations — show agent reasoning inline with code

### API & Headless Mode
- [ ] REST API server mode — run Haan.ai as a service
- [ ] WebSocket API — real-time streaming for web clients
- [ ] SDK (TypeScript/Python) — programmatic access to pipeline
- [ ] Webhook support — trigger pipelines from external events
- [ ] Batch mode — process multiple tasks from a queue

---

## Phase 4: Enterprise & Scale

**Goal:** Make Haan.ai production-ready for teams and organizations.

### Team Features
- [ ] Multi-user support — shared pipelines with role-based access
- [ ] Shared memory — team-wide knowledge base and conventions
- [ ] Code ownership — respect CODEOWNERS for review routing
- [ ] Audit logging — track all agent actions for compliance
- [ ] Approval workflows — multi-reviewer gates for critical changes

### Security & Compliance
- [ ] SOC 2 compliance — audit trails, access controls, encryption
- [ ] Secret detection — prevent accidental credential commits
- [ ] Sandboxed execution — run shell commands in containers
- [ ] Network isolation — control agent internet access
- [ ] Data residency — keep code and context in specific regions
- [ ] Custom model endpoints — support private/self-hosted LLMs (Ollama, vLLM, etc.)

### Performance & Scale
- [ ] Distributed pipeline execution — run stages across multiple machines
- [ ] Caching layer — cache LLM responses for identical prompts
- [ ] Streaming optimization — reduce time-to-first-token
- [ ] Token budget management — hard limits per task/day/team
- [ ] Concurrent pipelines — run multiple tasks in parallel
- [ ] Large repo support — handle 100K+ file monorepos efficiently

### Observability & Analytics
- [ ] Dashboard — web UI for pipeline monitoring and analytics
- [ ] Cost analytics — per-project, per-team, per-model breakdowns with trends
- [ ] Success rate tracking — measure pipeline completion rates over time
- [ ] Agent performance metrics — which agents succeed/fail most, token efficiency
- [ ] Custom alerts — notify on budget thresholds, failure spikes, etc.

### Deployment & Distribution
- [ ] npm global install (`npm i -g haan-ai`)
- [ ] Homebrew formula (`brew install haan`)
- [ ] Docker image for CI/CD environments
- [ ] GitHub Action (`uses: haan-ai/action@v1`)
- [ ] Auto-update mechanism
- [ ] Offline mode — work without internet using local models

---

## Phase 5: Advanced AI Capabilities

**Goal:** Push the boundaries of autonomous software engineering.

### Multi-Agent Collaboration
- [ ] Agent-to-agent communication — agents share findings in real-time
- [ ] Specialist spawning — dynamically create sub-agents for specific subtasks
- [ ] Consensus mechanisms — multiple agents vote on best approach
- [ ] Agent delegation — planner assigns subtasks to multiple builders in parallel
- [ ] Cross-project agents — work across multiple repos simultaneously

### Autonomous Project Management
- [ ] Requirement decomposition — break user stories into technical tasks
- [ ] Sprint planning — estimate and prioritize a backlog of tasks
- [ ] Dependency management — update packages, resolve conflicts, run migrations
- [ ] Technical debt tracking — identify and prioritize refactoring opportunities
- [ ] Architecture evolution — suggest and implement architectural improvements

### Self-Improvement
- [ ] Pipeline optimization — learn optimal stage ordering for project types
- [ ] Prompt optimization — A/B test and evolve system prompts
- [ ] Tool creation — agents create new tools when existing ones are insufficient
- [ ] Error pattern learning — build a database of common errors and fixes
- [ ] Performance tuning — optimize token usage based on historical data

### Advanced Code Understanding
- [ ] Full AST parsing — understand code structure beyond text matching
- [ ] Control flow analysis — trace execution paths
- [ ] Data flow analysis — track variable mutations and dependencies
- [ ] Cross-file refactoring — rename symbols, extract functions, move modules safely
- [ ] Dead code detection — identify and remove unused code

### Research & Experimental
- [ ] Formal verification — prove correctness of critical code paths
- [ ] Fuzzing integration — auto-generate fuzz tests
- [ ] Symbolic execution — explore all code paths systematically
- [ ] Natural language specifications — generate code from formal specs
- [ ] Code synthesis — generate entire modules from type signatures

---

## Feature Inventory

### Current (v1.0)
| Category | Feature | Status |
|----------|---------|--------|
| Pipeline | 5-stage sequential pipeline | Done |
| Pipeline | Test failure retry loop (3 retries) | Done |
| Pipeline | Review-driven improvement passes (2 cycles) | Done |
| Pipeline | Human-aided approval gates | Done |
| Pipeline | Auto mode (fully autonomous) | Done |
| Pipeline | Stage timeout protection (5 min) | Done |
| Agents | Planner with risk analysis | Done |
| Agents | Builder with file validation | Done |
| Agents | Tester with framework auto-detection | Done |
| Agents | Debugger with root cause analysis | Done |
| Agents | Feature Engineer with scoring | Done |
| Agents | Context compression at 110K tokens | Done |
| Agents | Read-only loop detection | Done |
| Agents | Streaming with parallel tool execution | Done |
| Tools | File CRUD (7 tools) | Done |
| Tools | Shell execution with safety | Done |
| Tools | Git operations (6 tools) | Done |
| Tools | Web search + fetch | Done |
| Tools | Code analysis + symbol finder | Done |
| Tools | Test discover/run/parse | Done |
| Tools | Memory save/load/search | Done |
| Providers | OpenAI (Chat + Responses API) | Done |
| Providers | Anthropic (extended thinking) | Done |
| Providers | Google (thought signatures) | Done |
| UI | Real-time streaming display | Done |
| UI | Pipeline progress tracker | Done |
| UI | Agent panel with tool tracking | Done |
| UI | Structured output rendering | Done |
| UI | Diff viewer, file tree, code blocks | Done |
| Config | Per-role model assignment | Done |
| Config | Multi-provider API keys | Done |
| Config | Pipeline tuning (retries, timeout, etc.) | Done |
| Memory | Long-term persistent storage | Done |
| Memory | Working memory (per-task) | Done |
| Infra | Cost tracking with pricing tables | Done |
| Infra | JSONL session logging | Done |
| Infra | Event bus architecture | Done |
| CLI | 20 commands | Done |
| CLI | Inline task execution | Done |
| CLI | Doctor/diagnostics | Done |

### Planned (v1.1+)
| Category | Feature | Phase |
|----------|---------|-------|
| Pipeline | Parallel stage execution | 1 |
| Pipeline | Checkpoint/resume | 1 |
| Pipeline | Provider failover | 1 |
| Agents | Self-reflection | 2 |
| Agents | Multi-language support | 2 |
| Agents | Framework detection | 2 |
| Testing | Coverage-aware generation | 2 |
| Security | OWASP scanning | 2 |
| Memory | Cross-session learning | 2 |
| MCP | Server mode | 3 |
| MCP | GitHub/Linear/Slack | 3 |
| Plugins | Custom tools/agents/stages | 3 |
| IDE | VS Code extension | 3 |
| API | REST/WebSocket server mode | 3 |
| Teams | Multi-user support | 4 |
| Security | Sandboxed execution | 4 |
| Scale | Distributed pipelines | 4 |
| Analytics | Web dashboard | 4 |
| Deploy | npm/Homebrew/Docker/GitHub Action | 4 |
| AI | Multi-agent collaboration | 5 |
| AI | Autonomous project management | 5 |
| AI | Self-improvement | 5 |
| AI | AST-based code understanding | 5 |
