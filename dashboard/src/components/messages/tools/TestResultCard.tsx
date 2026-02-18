import { motion } from 'framer-motion';
import { CheckCircle, XCircle, AlertCircle, FlaskConical } from 'lucide-react';

interface TestResultCardProps {
  output: string;
  isError?: boolean;
}

function parseTestResults(output: string) {
  const passed = output.match(/(\d+)\s*(?:passed|pass)/i);
  const failed = output.match(/(\d+)\s*(?:failed|fail)/i);
  const skipped = output.match(/(\d+)\s*(?:skipped|skip)/i);
  const errors = output.match(/(\d+)\s*(?:errors?)/i);
  const coverage = output.match(/(\d+(?:\.\d+)?)\s*%/);
  return {
    passed: passed ? parseInt(passed[1]) : 0,
    failed: failed ? parseInt(failed[1]) : 0,
    skipped: skipped ? parseInt(skipped[1]) : 0,
    errors: errors ? parseInt(errors[1]) : 0,
    coverage: coverage ? parseFloat(coverage[1]) : undefined,
  };
}

export default function TestResultCard({ output, isError }: TestResultCardProps) {
  const results = parseTestResults(output);
  const total = results.passed + results.failed + results.errors;
  const allPassed = results.failed === 0 && results.errors === 0 && results.passed > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        borderRadius: 'var(--radius-md)',
        border: `1px solid ${allPassed ? 'var(--success)' : isError ? 'var(--error)' : 'var(--border)'}`,
        overflow: 'hidden',
        marginTop: 'var(--space-2)',
        backgroundColor: 'var(--surface-2)',
      }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-2)',
        padding: '8px 12px',
      }}>
        <FlaskConical size={13} style={{ color: allPassed ? 'var(--success)' : 'var(--error)', flexShrink: 0 }} />
        <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>
          Test Results
        </span>
      </div>
      <div style={{
        display: 'flex',
        gap: 'var(--space-3)',
        padding: '4px 12px 10px',
        flexWrap: 'wrap',
      }}>
        {results.passed > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <CheckCircle size={12} style={{ color: 'var(--success)' }} />
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--success)', fontWeight: 600 }}>
              {results.passed} passed
            </span>
          </div>
        )}
        {results.failed > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <XCircle size={12} style={{ color: 'var(--error)' }} />
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--error)', fontWeight: 600 }}>
              {results.failed} failed
            </span>
          </div>
        )}
        {results.errors > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <AlertCircle size={12} style={{ color: 'var(--warning)' }} />
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--warning)', fontWeight: 600 }}>
              {results.errors} errors
            </span>
          </div>
        )}
        {results.skipped > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>
              {results.skipped} skipped
            </span>
          </div>
        )}
        {results.coverage !== undefined && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
            <div style={{ width: 60, height: 4, backgroundColor: 'var(--surface-3)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{
                width: `${results.coverage}%`,
                height: '100%',
                backgroundColor: results.coverage > 80 ? 'var(--success)' : results.coverage > 50 ? 'var(--warning)' : 'var(--error)',
                borderRadius: 2,
              }} />
            </div>
            <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
              {results.coverage}%
            </span>
          </div>
        )}
      </div>
      {total === 0 && (
        <pre style={{
          margin: '0 12px 10px',
          padding: 8,
          backgroundColor: 'var(--bg)',
          borderRadius: 'var(--radius-sm)',
          fontSize: 11,
          fontFamily: 'var(--font-mono)',
          color: 'var(--text-secondary)',
          maxHeight: 200,
          overflow: 'auto',
          whiteSpace: 'pre-wrap',
        }}>
          {output}
        </pre>
      )}
    </motion.div>
  );
}
