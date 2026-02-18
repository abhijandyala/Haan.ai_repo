import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Eye, EyeOff, Save } from 'lucide-react';
import { useStore } from '../../store';

interface SettingsState {
  anthropic_api_key: string;
  openai_api_key: string;
  google_api_key: string;
  default_provider: string;
  default_model: string;
  max_retries: number;
  budget_per_task: number;
}

export default function SettingsPanel() {
  const settingsOpen = useStore((s) => s.settingsOpen);
  const toggleSettings = useStore((s) => s.toggleSettings);
  const [activeTab, setActiveTab] = useState<'keys' | 'models' | 'prefs'>('keys');
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [settings, setSettings] = useState<SettingsState>({
    anthropic_api_key: '',
    openai_api_key: '',
    google_api_key: '',
    default_provider: 'anthropic',
    default_model: 'claude-sonnet-4-20250514',
    max_retries: 3,
    budget_per_task: 0,
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (settingsOpen) {
      fetch('/api/settings').then(r => r.json()).then(data => {
        if (data) setSettings(prev => ({ ...prev, ...data }));
      }).catch(() => {});
    }
  }, [settingsOpen]);

  const handleSave = async () => {
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch { /* ignore */ }
  };

  const tabs = [
    { id: 'keys' as const, label: 'API Keys' },
    { id: 'models' as const, label: 'Models' },
    { id: 'prefs' as const, label: 'Preferences' },
  ];

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 10px',
    backgroundColor: 'var(--surface-3)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-primary)',
    fontSize: 'var(--font-size-sm)',
    fontFamily: 'var(--font-mono)',
    outline: 'none',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 'var(--font-size-xs)',
    color: 'var(--text-secondary)',
    fontWeight: 500,
    marginBottom: 4,
    display: 'block',
  };

  return (
    <AnimatePresence>
      {settingsOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={toggleSettings}
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0,0,0,0.5)',
              zIndex: 99,
            }}
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            style={{
              position: 'fixed',
              top: 0,
              right: 0,
              bottom: 0,
              width: 400,
              backgroundColor: 'var(--surface)',
              borderLeft: '1px solid var(--border)',
              zIndex: 100,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 20px',
              borderBottom: '1px solid var(--border)',
            }}>
              <span style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--text-primary)' }}>Settings</span>
              <button onClick={toggleSettings} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                <X size={18} />
              </button>
            </div>

            {/* Tabs */}
            <div style={{
              display: 'flex',
              borderBottom: '1px solid var(--border)',
              padding: '0 20px',
            }}>
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    padding: '10px 16px',
                    fontSize: 'var(--font-size-sm)',
                    fontWeight: 500,
                    color: activeTab === tab.id ? 'var(--accent)' : 'var(--text-tertiary)',
                    background: 'none',
                    border: 'none',
                    borderBottomWidth: 2,
                    borderBottomStyle: 'solid',
                    borderBottomColor: activeTab === tab.id ? 'var(--accent)' : 'transparent',
                    cursor: 'pointer',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Content */}
            <div style={{ flex: 1, padding: '20px', overflow: 'auto' }}>
              {activeTab === 'keys' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {[
                    { key: 'anthropic_api_key', label: 'Anthropic API Key', placeholder: 'sk-ant-...' },
                    { key: 'openai_api_key', label: 'OpenAI API Key', placeholder: 'sk-...' },
                    { key: 'google_api_key', label: 'Google API Key', placeholder: 'AI...' },
                  ].map(({ key, label, placeholder }) => (
                    <div key={key}>
                      <label style={labelStyle}>{label}</label>
                      <div style={{ position: 'relative' }}>
                        <input
                          type={showKeys[key] ? 'text' : 'password'}
                          value={settings[key as keyof SettingsState] as string}
                          onChange={(e) => setSettings(prev => ({ ...prev, [key]: e.target.value }))}
                          placeholder={placeholder}
                          style={inputStyle}
                        />
                        <button
                          onClick={() => setShowKeys(prev => ({ ...prev, [key]: !prev[key] }))}
                          style={{
                            position: 'absolute',
                            right: 8,
                            top: '50%',
                            transform: 'translateY(-50%)',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'var(--text-muted)',
                          }}
                        >
                          {showKeys[key] ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'models' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <label style={labelStyle}>Default Provider</label>
                    <select
                      value={settings.default_provider}
                      onChange={(e) => setSettings(prev => ({ ...prev, default_provider: e.target.value }))}
                      style={{ ...inputStyle, fontFamily: 'var(--font-sans)' }}
                    >
                      <option value="anthropic">Anthropic</option>
                      <option value="openai">OpenAI</option>
                      <option value="google">Google</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Default Model</label>
                    <input
                      type="text"
                      value={settings.default_model}
                      onChange={(e) => setSettings(prev => ({ ...prev, default_model: e.target.value }))}
                      style={inputStyle}
                    />
                  </div>
                </div>
              )}

              {activeTab === 'prefs' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <label style={labelStyle}>Max Retries</label>
                    <input
                      type="number"
                      min={0}
                      max={10}
                      value={settings.max_retries}
                      onChange={(e) => setSettings(prev => ({ ...prev, max_retries: parseInt(e.target.value) || 3 }))}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Budget per Task (USD, 0 = unlimited)</label>
                    <input
                      type="number"
                      min={0}
                      step={0.5}
                      value={settings.budget_per_task}
                      onChange={(e) => setSettings(prev => ({ ...prev, budget_per_task: parseFloat(e.target.value) || 0 }))}
                      style={inputStyle}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Footer with save */}
            <div style={{
              padding: '12px 20px',
              borderTop: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'flex-end',
            }}>
              <button
                onClick={handleSave}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  background: saved ? 'var(--success)' : 'var(--gradient-fire)',
                  color: '#000',
                  fontWeight: 600,
                  fontSize: 'var(--font-size-sm)',
                  cursor: 'pointer',
                }}
              >
                <Save size={14} />
                {saved ? 'Saved!' : 'Save'}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
