// ═══════════════════════════════════════════════
// haan.ai — Website Interactions
// ═══════════════════════════════════════════════

// ── Nav scroll effect ──
const nav = document.querySelector('.nav');
window.addEventListener('scroll', () => {
  nav.classList.toggle('scrolled', window.scrollY > 40);
});

// ── Copy install command ──
function copyInstall(el) {
  const cmd = 'curl -fsSL https://haan.ai/install.sh | bash';
  navigator.clipboard.writeText(cmd).then(() => {
    const icon = el.querySelector('.copy-icon');
    if (icon) {
      icon.textContent = 'Copied!';
      icon.classList.add('copied');
      setTimeout(() => {
        icon.textContent = '📋';
        icon.classList.remove('copied');
      }, 2000);
    }
  });
}

// ── Copy npm install command ──
function copyNpm(el) {
  const cmd = 'npm install -g haan-ai';
  navigator.clipboard.writeText(cmd).then(() => {
    const icon = el.querySelector('.copy-icon');
    if (icon) {
      icon.textContent = 'Copied!';
      icon.classList.add('copied');
      setTimeout(() => {
        icon.textContent = '📋';
        icon.classList.remove('copied');
      }, 2000);
    }
  });
}

// ── Terminal animation ──
const terminalLines = [
  { type: 'input', text: 'haan "Add OAuth login with Google and GitHub"' },
  { type: 'blank' },
  { type: 'agent', agent: 'planner', text: '🧠 PLANNER  Analyzing codebase structure...' },
  { type: 'detail', text: '   Found 24 files, 3 auth-related modules' },
  { type: 'detail', text: '   Planning: 4 steps, estimated 12 tool calls' },
  { type: 'detail', text: '   DAG: 2 parallel branches detected' },
  { type: 'agent', agent: 'planner', text: '   ✓ Plan complete — 4 steps, 2 parallel stages' },
  { type: 'blank' },
  { type: 'agent', agent: 'builder', text: '🔨 BUILDER  Implementing OAuth providers...' },
  { type: 'detail', text: '   ⚡ Spawning 2 parallel builder agents' },
  { type: 'detail', text: '   Creating src/auth/google-provider.ts' },
  { type: 'detail', text: '   Creating src/auth/github-provider.ts' },
  { type: 'detail', text: '   Editing src/routes/auth.ts — adding endpoints' },
  { type: 'detail', text: '   Loading plugin: @haan/auth-helpers' },
  { type: 'agent', agent: 'builder', text: '   ✓ Built — 3 files created, 2 modified' },
  { type: 'blank' },
  { type: 'agent', agent: 'tester', text: '🧪 TESTER   Running test suite...' },
  { type: 'detail', text: '   Generated 8 test cases for OAuth flows' },
  { type: 'agent', agent: 'tester', text: '   ✓ All 8 tests passing' },
  { type: 'blank' },
  { type: 'agent', agent: 'reviewer', text: '⭐ REVIEWER  Code quality check...' },
  { type: 'agent', agent: 'reviewer', text: '   ✓ No issues found — production ready' },
  { type: 'blank' },
  { type: 'success', text: '✅ Complete — OAuth login shipped in 34s' },
  { type: 'info', text: '   Tokens: 42.3K  Cost: $0.38  Files: 5' },
];

function buildTerminalHTML(line) {
  switch (line.type) {
    case 'input':
      return `<span class="prompt-char">❯ </span><span class="cmd-text">${line.text}</span>`;
    case 'blank':
      return '&nbsp;';
    case 'agent':
      return `<span class="agent-${line.agent}">${line.text}</span>`;
    case 'detail':
      return `<span class="muted">${line.text}</span>`;
    case 'success':
      return `<span class="success">${line.text}</span>`;
    case 'info':
      return `<span class="info">${line.text}</span>`;
    default:
      return line.text;
  }
}

function animateTerminal() {
  const body = document.getElementById('terminal-body');
  if (!body) return;
  body.innerHTML = '';
  let i = 0;

  function addLine() {
    if (i >= terminalLines.length) {
      // Restart after pause
      setTimeout(() => animateTerminal(), 4000);
      return;
    }

    const div = document.createElement('div');
    div.className = 'terminal-line';
    div.innerHTML = buildTerminalHTML(terminalLines[i]);
    div.style.animationDelay = '0s';
    body.appendChild(div);
    body.scrollTop = body.scrollHeight;
    i++;

    const delay = terminalLines[i - 1].type === 'blank' ? 200 :
                  terminalLines[i - 1].type === 'input' ? 600 :
                  terminalLines[i - 1].type === 'success' ? 500 : 120;
    setTimeout(addLine, delay);
  }

  addLine();
}

// ── Intersection Observer for fade-in ──
const observerOptions = { threshold: 0.1, rootMargin: '0px 0px -50px 0px' };
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    }
  });
}, observerOptions);

document.addEventListener('DOMContentLoaded', () => {
  // Start terminal animation
  animateTerminal();

  // Observe animate-on-scroll elements
  document.querySelectorAll('.animate-in').forEach(el => observer.observe(el));
});

// ── Smooth scroll for nav links ──
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});
