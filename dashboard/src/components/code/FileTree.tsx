import { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronRight, ChevronDown, FileCode, Folder, FolderOpen } from 'lucide-react';

interface FileTreeProps {
  files: string[];
  onFileClick?: (file: string) => void;
}

interface TreeNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: TreeNode[];
}

function buildTree(filePaths: string[]): TreeNode[] {
  const root: TreeNode[] = [];

  filePaths.forEach((path) => {
    const parts = path.split('/');
    let currentLevel = root;

    parts.forEach((part, index) => {
      const isLast = index === parts.length - 1;
      const fullPath = parts.slice(0, index + 1).join('/');
      let existing = currentLevel.find((n) => n.name === part);

      if (!existing) {
        existing = {
          name: part,
          path: fullPath,
          isDirectory: !isLast,
          children: isLast ? undefined : [],
        };
        currentLevel.push(existing);
      }

      if (!isLast && existing.children) {
        currentLevel = existing.children;
      }
    });
  });

  return root;
}

export default function FileTree({ files, onFileClick }: FileTreeProps) {
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    // Auto-expand first level
    const initial = new Set<string>();
    files.forEach((f) => {
      const first = f.split('/')[0];
      if (first) initial.add(first);
    });
    return initial;
  });

  const toggleExpanded = (path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const renderNode = (node: TreeNode, depth: number = 0) => {
    const isExpanded = expanded.has(node.path);
    const hasChildren = node.children && node.children.length > 0;

    return (
      <div key={node.path}>
        <motion.div
          whileHover={{ backgroundColor: 'var(--surface-hover)' }}
          onClick={() => {
            if (node.isDirectory) toggleExpanded(node.path);
            else onFileClick?.(node.path);
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-1)',
            padding: '3px var(--space-2)',
            paddingLeft: depth * 16 + 8,
            cursor: 'pointer',
            fontSize: 'var(--font-size-sm)',
            color: 'var(--text-secondary)',
            transition: 'background-color 0.1s',
            borderRadius: 'var(--radius-xs)',
            margin: '0 var(--space-1)',
          }}
        >
          {node.isDirectory ? (
            <>
              {isExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
              {isExpanded ? (
                <FolderOpen size={13} style={{ color: 'var(--accent-dim)' }} />
              ) : (
                <Folder size={13} style={{ color: 'var(--text-tertiary)' }} />
              )}
            </>
          ) : (
            <>
              <span style={{ width: 11 }} />
              <FileCode size={13} style={{ color: 'var(--text-tertiary)' }} />
            </>
          )}
          <span style={{
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--font-size-xs)',
          }}>
            {node.name}
          </span>
        </motion.div>

        {node.isDirectory && isExpanded && hasChildren && (
          <div>
            {node.children!.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const tree = buildTree(files);

  return (
    <div style={{ padding: 'var(--space-2) 0' }}>
      {tree.map((node) => renderNode(node))}
    </div>
  );
}
