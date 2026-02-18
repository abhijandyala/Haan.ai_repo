import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ListTodo, CheckSquare, Square, ChevronDown, ChevronRight, FileCode, Layers, Target, Lightbulb } from 'lucide-react';

interface PlanDisplayProps {
  content: string;
}

interface PlanSection {
  title: string;
  type: 'checklist' | 'numbered' | 'files' | 'text';
  items: PlanItem[];
}

interface PlanItem {
  text: string;
  checked: boolean;
  indent: number;
  isFile?: boolean;
}

function parsePlan(content: string): { title: string; sections: PlanSection[] } | null {
  const lines = content.split('\n');
  const sections: PlanSection[] = [];
  let mainTitle = '';
  let currentSection: PlanSection | null = null;

  for (const line of lines) {
    // Main title (# or ##)
    const h1Match = line.match(/^#{1,2}\s+(.+)/);
    if (h1Match && !mainTitle) {
      mainTitle = h1Match[1];
      continue;
    }

    // Section header (### or ##)
    const h2Match = line.match(/^#{2,3}\s+(.+)/);
    if (h2Match) {
      if (currentSection && currentSection.items.length > 0) {
        sections.push(currentSection);
      }
      const sectionTitle = h2Match[1];
      const isFileSection = /files?|changes?|create|modify/i.test(sectionTitle);
      currentSection = {
        title: sectionTitle,
        type: isFileSection ? 'files' : 'text',
        items: [],
      };
      continue;
    }

    // Checkbox items
    const checkboxMatch = line.match(/^(\s*)[-*]\s+\[([ xX])\]\s+(.*)/);
    if (checkboxMatch) {
      if (!currentSection) {
        currentSection = { title: 'Tasks', type: 'checklist', items: [] };
      }
      currentSection.type = 'checklist';
      currentSection.items.push({
        text: checkboxMatch[3],
        checked: checkboxMatch[2] !== ' ',
        indent: Math.floor(checkboxMatch[1].length / 2),
      });
      continue;
    }

    // Numbered items
    const numberedMatch = line.match(/^(\s*)(\d+)\.\s+(.*)/);
    if (numberedMatch) {
      if (!currentSection) {
        currentSection = { title: 'Steps', type: 'numbered', items: [] };
      }
      if (currentSection.type === 'text') currentSection.type = 'numbered';
      currentSection.items.push({
        text: numberedMatch[3],
        checked: false,
        indent: Math.floor(numberedMatch[1].length / 2),
      });
      continue;
    }

    // Bullet items
    const bulletMatch = line.match(/^(\s*)[-*]\s+(.*)/);
    if (bulletMatch && bulletMatch[2].trim()) {
      if (!currentSection) {
        currentSection = { title: 'Details', type: 'text', items: [] };
      }
      const text = bulletMatch[2];
      const isFile = /\.[a-z]{1,4}$/i.test(text.split(' ')[0]) || text.includes('/');
      currentSection.items.push({
        text,
        checked: false,
        indent: Math.floor(bulletMatch[1].length / 2),
        isFile,
      });
      continue;
    }

    // File-like lines (paths)
    if (currentSection?.type === 'files') {
      const fileLine = line.trim();
      if (fileLine && /[./]/.test(fileLine) && !fileLine.startsWith('#')) {
        currentSection.items.push({
          text: fileLine,
          checked: false,
          indent: 0,
          isFile: true,
        });
      }
    }
  }

  if (currentSection && currentSection.items.length > 0) {
    sections.push(currentSection);
  }

  // Also check for a flat plan (no sections, just items)
  if (sections.length === 0) {
    const flatItems: PlanItem[] = [];
    for (const line of lines) {
      const cb = line.match(/^(\s*)[-*]\s+\[([ xX])\]\s+(.*)/);
      if (cb) {
        flatItems.push({ text: cb[3], checked: cb[2] !== ' ', indent: Math.floor(cb[1].length / 2) });
        continue;
      }
      const num = line.match(/^(\s*)(\d+)\.\s+(.*)/);
      if (num) {
        flatItems.push({ text: num[3], checked: false, indent: Math.floor(num[1].length / 2) });
      }
    }
    if (flatItems.length >= 2) {
      sections.push({ title: 'Plan', type: flatItems.some(i => i.checked !== undefined) ? 'checklist' : 'numbered', items: flatItems });
    }
  }

  if (sections.length === 0) return null;
  return { title: mainTitle || 'Implementation Plan', sections };
}

const SECTION_ICONS: Record<string, typeof ListTodo> = {
  checklist: ListTodo,
  numbered: Target,
  files: FileCode,
  text: Lightbulb,
};

function SectionCard({ section, index }: { section: PlanSection; index: number }) {
  const [expanded, setExpanded] = useState(index === 0);
  const completed = section.items.filter(i => i.checked).length;
  const total = section.items.length;
  const Icon = SECTION_ICONS[section.type] || Layers;

  return (
    <div style={{
      borderRadius: 'var(--radius-md)',
      border: '1px solid var(--border)',
      overflow: 'hidden',
      backgroundColor: 'var(--surface)',
    }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 14px',
          backgroundColor: 'var(--surface-2)',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <Icon size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />
        <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>
          {section.title}
        </span>
        {section.type === 'checklist' && (
          <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            {completed}/{total}
          </span>
        )}
        {section.type !== 'checklist' && (
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
            {total} items
          </span>
        )}
        {expanded ? <ChevronDown size={12} style={{ color: 'var(--text-muted)' }} /> : <ChevronRight size={12} style={{ color: 'var(--text-muted)' }} />}
      </button>

      {section.type === 'checklist' && (
        <div style={{ height: 2, backgroundColor: 'var(--surface-3)' }}>
          <div style={{
            width: total > 0 ? `${(completed / total) * 100}%` : '0%',
            height: '100%',
            backgroundColor: completed === total && total > 0 ? 'var(--success)' : 'var(--accent)',
            transition: 'width 0.3s ease',
          }} />
        </div>
      )}

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ padding: '8px 14px' }}>
              {section.items.map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 8,
                    padding: '5px 0',
                    paddingLeft: item.indent * 16,
                  }}
                >
                  {section.type === 'checklist' ? (
                    item.checked
                      ? <CheckSquare size={14} style={{ color: 'var(--success)', flexShrink: 0, marginTop: 2 }} />
                      : <Square size={14} style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: 2 }} />
                  ) : section.type === 'numbered' ? (
                    <span style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: 'var(--accent)',
                      minWidth: 18,
                      height: 18,
                      borderRadius: '50%',
                      backgroundColor: 'rgba(var(--accent-rgb),0.12)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      marginTop: 2,
                    }}>
                      {i + 1}
                    </span>
                  ) : item.isFile ? (
                    <FileCode size={13} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 2 }} />
                  ) : (
                    <div style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: 'var(--text-muted)', flexShrink: 0, marginTop: 7 }} />
                  )}
                  <span style={{
                    fontSize: 'var(--font-size-sm)',
                    color: item.checked ? 'var(--text-tertiary)' : 'var(--text-primary)',
                    textDecoration: item.checked ? 'line-through' : 'none',
                    lineHeight: 1.5,
                    fontFamily: item.isFile ? 'var(--font-mono)' : 'inherit',
                  }}>
                    {/* Bold text before colon */}
                    {item.text.includes(':') && !item.isFile ? (
                      <>
                        <strong style={{ color: item.checked ? 'var(--text-tertiary)' : 'var(--text-primary)' }}>
                          {item.text.split(':')[0]}:
                        </strong>
                        {item.text.split(':').slice(1).join(':')}
                      </>
                    ) : item.text}
                  </span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function PlanDisplay({ content }: PlanDisplayProps) {
  const plan = parsePlan(content);
  if (!plan) return null;

  const totalItems = plan.sections.reduce((sum, s) => sum + s.items.length, 0);
  const totalChecked = plan.sections.reduce((sum, s) => sum + s.items.filter(i => i.checked).length, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border)',
        overflow: 'hidden',
        marginTop: 'var(--space-3)',
        marginBottom: 'var(--space-2)',
        backgroundColor: 'var(--surface-2)',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-2)',
        padding: '14px 16px',
        borderBottom: '1px solid var(--border)',
        background: 'linear-gradient(135deg, rgba(var(--accent-rgb),0.06) 0%, transparent 60%)',
      }}>
        <div style={{
          width: 28,
          height: 28,
          borderRadius: 'var(--radius-sm)',
          background: 'var(--gradient-fire)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Layers size={14} color="#000" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 'var(--font-size-md)', fontWeight: 700, color: 'var(--text-primary)' }}>
            {plan.title}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>
            {plan.sections.length} {plan.sections.length === 1 ? 'section' : 'sections'} &middot; {totalItems} items
            {totalChecked > 0 && ` \u00b7 ${totalChecked} done`}
          </div>
        </div>
      </div>

      {/* Sections */}
      <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {plan.sections.map((section, i) => (
          <SectionCard key={i} section={section} index={i} />
        ))}
      </div>
    </motion.div>
  );
}
