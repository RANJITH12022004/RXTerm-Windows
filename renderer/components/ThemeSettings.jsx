import { useMemo } from 'react';
import { useTerminalStore } from '../store/terminalStore.js';

const BUILTIN = [
  { id: 'hacker', label: 'Hacker' },
  { id: 'matrix', label: 'Matrix' },
  { id: 'ember', label: 'Ember' },
  { id: 'arctic', label: 'Arctic' },
  { id: 'violet', label: 'Violet' },
  { id: 'custom', label: 'Custom' },
];

export default function ThemeSettings() {
  const open = useTerminalStore((s) => s.settingsOpen);
  const setOpen = useTerminalStore((s) => s.setSettingsOpen);
  const themeId = useTerminalStore((s) => s.themeId);
  const setThemeId = useTerminalStore((s) => s.setThemeId);
  const customTheme = useTerminalStore((s) => s.customTheme);
  const setCustomTheme = useTerminalStore((s) => s.setCustomTheme);

  const customFields = useMemo(
    () => [
      ['bgDeep', 'Background'],
      ['bgPanel', 'Panel'],
      ['text', 'Text'],
      ['accent', 'Accent'],
      ['cyan', 'Cyan'],
      ['border', 'Border'],
    ],
    [],
  );

  if (!open) return null;

  return (
    <div className="settings-overlay" onMouseDown={() => setOpen(false)}>
      <div className="settings-panel" onMouseDown={(e) => e.stopPropagation()}>
        <div className="view-header">
          <div>
            <div className="view-eyebrow">Display</div>
            <h2 className="view-title">Theme switcher</h2>
          </div>
          <button className="toolbar-pill" onClick={() => setOpen(false)}>
            Close
          </button>
        </div>
        <div className="theme-grid">
          {BUILTIN.map((item) => (
            <button
              key={item.id}
              className={`toolbar-pill ${themeId === item.id ? 'active' : ''}`}
              onClick={() => setThemeId(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        {themeId === 'custom' ? (
          <div className="theme-custom-grid">
            {customFields.map(([key, label]) => (
              <label key={key} className="theme-color-row">
                <span>{label}</span>
                <input
                  type="color"
                  value={customTheme[key]}
                  onChange={(e) => setCustomTheme({ [key]: e.target.value })}
                />
              </label>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
