import { useMemo, useState } from 'react';

import type { ThemeId } from '../shared/contracts';
import { APP_NAME } from '../shared/app-info';
import { getThemePack, THEME_PACKS } from '../shared/themes';
import { ScenePicker, type SelectionMode } from './ScenePicker';
import { ThemeCard } from './ThemeCard';

export function App() {
  const platform = window.infiniteWall?.platform ?? 'preview';
  const [selectedThemeId, setSelectedThemeId] = useState<ThemeId>('minimal');
  const [mode, setMode] = useState<SelectionMode>('infinite');
  const [selectedSceneId, setSelectedSceneId] = useState(
    getThemePack('minimal').sceneSeeds[0].id,
  );
  const [customPrompt, setCustomPrompt] = useState('');
  const [preparedLabel, setPreparedLabel] = useState<string | null>(null);
  const selectedTheme = getThemePack(selectedThemeId);

  const selectionLabel = useMemo(() => {
    if (mode === 'infinite') {
      return `Infinite · ${selectedTheme.name}`;
    }

    if (mode === 'custom') {
      return `Custom · ${selectedTheme.name}`;
    }

    const scene = selectedTheme.sceneSeeds.find(
      (candidate) => candidate.id === selectedSceneId,
    );
    return `${scene?.title ?? 'Curated scene'} · ${selectedTheme.name}`;
  }, [mode, selectedSceneId, selectedTheme]);

  const handleThemeChange = (themeId: ThemeId) => {
    const theme = getThemePack(themeId);
    setSelectedThemeId(themeId);
    setSelectedSceneId(theme.sceneSeeds[0].id);
    setPreparedLabel(null);
  };

  const canPrepare = mode !== 'custom' || customPrompt.trim().length >= 3;

  return (
    <div className="app-shell" data-theme={selectedTheme.id}>
      <header className="topbar">
        <a className="brand" href="#theme-library" aria-label={`${APP_NAME} home`}>
          <span className="brand-mark" aria-hidden="true">∞</span>
          <span>{APP_NAME}</span>
        </a>
        <div className="topbar-meta">
          <span className="local-badge">
            <span className="local-dot" aria-hidden="true" />
            Local by design
          </span>
          <span className="platform-label">{platform}</span>
        </div>
      </header>

      <main className="workspace">
        <section className="library" id="theme-library" aria-labelledby="library-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Choose a visual world</p>
              <h1 id="library-title">Where should we go?</h1>
            </div>
            <p className="section-intro">
              Pick a direction. Infinite Wall changes the scene each time while
              holding onto the mood and composition you chose.
            </p>
          </div>

          <div className="theme-grid" aria-label="Wallpaper theme packs">
            {THEME_PACKS.map((theme, index) => (
              <ThemeCard
                key={theme.id}
                theme={theme}
                index={index + 1}
                selected={theme.id === selectedThemeId}
                onSelect={handleThemeChange}
              />
            ))}
          </div>
        </section>

        <aside className="direction-panel" aria-labelledby="direction-title">
          <div className="direction-art" data-theme={selectedTheme.id} aria-hidden="true">
            <span className="art-orbit art-orbit-one" />
            <span className="art-orbit art-orbit-two" />
            <span className="art-core" />
            <span className="art-grain" />
          </div>

          <div className="direction-copy">
            <p className="collection-label">{selectedTheme.collection}</p>
            <div className="direction-title-row">
              <h2 id="direction-title">{selectedTheme.name}</h2>
              <div className="palette" aria-label={`${selectedTheme.name} palette`}>
                {selectedTheme.palette.map((color, index) => (
                  <span key={color} className={`swatch swatch-${index + 1}`} />
                ))}
              </div>
            </div>
            <p className="theme-description">{selectedTheme.description}</p>
            <div className="mood-list" aria-label="Theme mood">
              {selectedTheme.mood.map((mood) => (
                <span key={mood}>{mood}</span>
              ))}
            </div>
          </div>

          <ScenePicker
            theme={selectedTheme}
            mode={mode}
            selectedSceneId={selectedSceneId}
            customPrompt={customPrompt}
            onModeChange={(nextMode) => {
              setMode(nextMode);
              setPreparedLabel(null);
            }}
            onSceneChange={(sceneId) => {
              setSelectedSceneId(sceneId);
              setPreparedLabel(null);
            }}
            onCustomPromptChange={(value) => {
              setCustomPrompt(value);
              setPreparedLabel(null);
            }}
          />

          <div className="panel-action">
            <button
              className="primary-action"
              type="button"
              disabled={!canPrepare}
              onClick={() => setPreparedLabel(selectionLabel)}
            >
              Use this direction
              <span aria-hidden="true">→</span>
            </button>
            <p className="action-note">Generation wiring comes next. No credits are used here.</p>
          </div>

          <p className="selection-status" aria-live="polite">
            {preparedLabel ? `Direction ready: ${preparedLabel}` : ''}
          </p>
        </aside>
      </main>
    </div>
  );
}
