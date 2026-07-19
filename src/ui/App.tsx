import { useCallback, useEffect, useMemo, useState } from 'react';

import { APP_NAME, CODEX_SETUP_URL } from '../shared/app-info';
import type {
  CodexDiagnostics,
  GenerationProgress,
  GenerationRequest,
  PublicAppError,
  ThemeId,
  WallpaperLibraryItem,
  WallpaperRecord,
} from '../shared/contracts';
import { getThemePack, THEME_PACKS } from '../shared/themes';
import { CodexStatus } from './CodexStatus';
import { ScenePicker, type SelectionMode } from './ScenePicker';
import { ThemeCard } from './ThemeCard';

const INITIAL_PROGRESS: GenerationProgress = {
  phase: 'preparing',
  message: 'Preparing generation…',
  percent: 2,
};

type ActivePreview = WallpaperLibraryItem & {
  readonly source: 'generated' | 'library';
};

export function App() {
  const platform = (window.infiniteWall?.platform as string | undefined) ?? 'preview';
  const [codexDiagnostics, setCodexDiagnostics] =
    useState<CodexDiagnostics | null>(null);
  const [checkingCodex, setCheckingCodex] = useState(
    Boolean(window.infiniteWall?.checkCodex),
  );
  const [selectedThemeId, setSelectedThemeId] = useState<ThemeId>('minimal');
  const [mode, setMode] = useState<SelectionMode>('infinite');
  const [selectedSceneId, setSelectedSceneId] = useState(
    getThemePack('minimal').sceneSeeds[0].id,
  );
  const [customPrompt, setCustomPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [progress, setProgress] = useState<GenerationProgress>(INITIAL_PROGRESS);
  const [preview, setPreview] = useState<ActivePreview | null>(null);
  const [wallpapers, setWallpapers] = useState<WallpaperLibraryItem[]>([]);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [activeWallpaperId, setActiveWallpaperId] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState<PublicAppError | null>(
    null,
  );
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

  const checkCodex = useCallback(async () => {
    if (!window.infiniteWall?.checkCodex) {
      setCheckingCodex(false);
      return;
    }
    setCheckingCodex(true);
    try {
      setCodexDiagnostics(await window.infiniteWall.checkCodex());
    } catch {
      setCodexDiagnostics({
        installed: false,
        authenticated: false,
        version: null,
        authMethod: null,
        issue: 'check-failed',
        message: 'Infinite Wall could not verify Codex on this computer.',
      });
    } finally {
      setCheckingCodex(false);
    }
  }, []);

  useEffect(() => {
    void checkCodex();
  }, [checkCodex]);

  useEffect(() => {
    if (!window.infiniteWall?.onGenerationProgress) {
      return undefined;
    }
    return window.infiniteWall.onGenerationProgress(setProgress);
  }, []);

  const refreshLibrary = useCallback(async () => {
    if (!window.infiniteWall?.listWallpapers) {
      return;
    }
    try {
      const result = await window.infiniteWall.listWallpapers();
      if (result.ok) {
        setWallpapers(result.value);
        setLibraryError(null);
      } else {
        setLibraryError(result.error.message);
      }
    } catch {
      setLibraryError('The local wallpaper library could not be loaded.');
    }
  }, []);

  useEffect(() => {
    void refreshLibrary();
  }, [refreshLibrary]);

  const buildRequest = useCallback(
    async (): Promise<GenerationRequest> => {
      const display = await window.infiniteWall.getPrimaryDisplay();
      const base = {
        themeId: selectedThemeId,
        display,
        quality: 'standard' as const,
        recentConcepts: [],
      };
      if (mode === 'curated') {
        return { ...base, mode, sceneId: selectedSceneId };
      }
      if (mode === 'custom') {
        return { ...base, mode, customPrompt };
      }
      return { ...base, mode };
    },
    [customPrompt, mode, selectedSceneId, selectedThemeId],
  );

  const handleGenerate = useCallback(async () => {
    if (!window.infiniteWall?.generateWallpaper) {
      return;
    }
    if (!codexDiagnostics?.authenticated) {
      setGenerationError({
        code: 'not-authenticated',
        message: 'Finish Codex setup before generating a wallpaper.',
        retryable: false,
      });
      return;
    }

    setGenerating(true);
    setCancelling(false);
    setPreview(null);
    setGenerationError(null);
    setProgress(INITIAL_PROGRESS);
    try {
      const result = await window.infiniteWall.generateWallpaper(
        await buildRequest(),
      );
      if (result.ok) {
        setPreview({ ...result.value, source: 'generated' });
        await refreshLibrary();
      } else {
        setGenerationError(result.error);
      }
    } catch {
      setGenerationError({
        code: 'process-failed',
        message: 'Infinite Wall lost contact with the local generation process.',
        retryable: true,
      });
    } finally {
      setGenerating(false);
      setCancelling(false);
    }
  }, [buildRequest, codexDiagnostics?.authenticated, refreshLibrary]);

  const replaceRecord = useCallback((record: WallpaperRecord) => {
    setWallpapers((items) =>
      items.map((item) => ({
        ...item,
        record:
          item.record.id === record.id
            ? record
            : record.applied
              ? { ...item.record, applied: false }
              : item.record,
      })),
    );
    setPreview((item) => {
      if (!item) {
        return item;
      }
      if (item.record.id === record.id) {
        return { ...item, record };
      }
      return record.applied
        ? { ...item, record: { ...item.record, applied: false } }
        : item;
    });
  }, []);

  const handleApply = useCallback(
    async (recordId: string) => {
      if (!window.infiniteWall?.applyWallpaper) {
        return;
      }
      setActiveWallpaperId(recordId);
      setLibraryError(null);
      try {
        const result = await window.infiniteWall.applyWallpaper(recordId);
        if (result.ok) {
          replaceRecord(result.value);
        } else {
          setLibraryError(result.error.message);
        }
      } catch {
        setLibraryError('The wallpaper could not be applied.');
      } finally {
        setActiveWallpaperId(null);
      }
    },
    [replaceRecord],
  );

  const handleFavorite = useCallback(
    async (record: WallpaperRecord) => {
      setActiveWallpaperId(record.id);
      setLibraryError(null);
      try {
        const result = await window.infiniteWall.setWallpaperFavorite(
          record.id,
          !record.favorite,
        );
        if (result.ok) {
          replaceRecord(result.value);
        } else {
          setLibraryError(result.error.message);
        }
      } catch {
        setLibraryError('The wallpaper could not be updated.');
      } finally {
        setActiveWallpaperId(null);
      }
    },
    [replaceRecord],
  );

  const handleDelete = useCallback(async (recordId: string) => {
    setActiveWallpaperId(recordId);
    setLibraryError(null);
    try {
      const result = await window.infiniteWall.deleteWallpaper(recordId);
      if (result.ok && result.value) {
        setWallpapers((items) =>
          items.filter((item) => item.record.id !== recordId),
        );
        setPreview((item) => (item?.record.id === recordId ? null : item));
      } else if (!result.ok) {
        setLibraryError(result.error.message);
      }
    } catch {
      setLibraryError('The wallpaper could not be removed.');
    } finally {
      setActiveWallpaperId(null);
    }
  }, []);

  const handleCancel = async () => {
    setCancelling(true);
    const cancelled = await window.infiniteWall.cancelGeneration().catch(() => false);
    if (!cancelled) {
      setCancelling(false);
    }
  };

  const handleThemeChange = (themeId: ThemeId) => {
    if (generating) {
      return;
    }
    const theme = getThemePack(themeId);
    setSelectedThemeId(themeId);
    setSelectedSceneId(theme.sceneSeeds[0].id);
    setPreview(null);
    setGenerationError(null);
  };

  const canGenerate =
    (mode !== 'custom' || customPrompt.trim().length >= 3) &&
    codexDiagnostics?.authenticated === true &&
    platform !== 'preview';

  return (
    <div className="app-shell" data-theme={selectedTheme.id}>
      <header className="topbar">
        <a className="brand" href="#theme-library" aria-label={`${APP_NAME} home`}>
          <span className="brand-mark" aria-hidden="true">∞</span>
          <span>{APP_NAME}</span>
        </a>
        <div className="topbar-meta">
          <CodexStatus
            diagnostics={codexDiagnostics}
            checking={checkingCodex}
            preview={platform === 'preview'}
            onRetry={() => void checkCodex()}
          />
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

          {codexDiagnostics?.issue && (
            <section className="codex-onboarding" aria-labelledby="codex-setup-title">
              <div className="codex-onboarding-mark" aria-hidden="true">›_</div>
              <div>
                <p className="eyebrow">One local prerequisite</p>
                <h2 id="codex-setup-title">
                  {codexDiagnostics.issue === 'not-installed'
                    ? 'Install Codex to start generating'
                    : codexDiagnostics.issue === 'not-authenticated'
                      ? 'Sign in to Codex'
                      : codexDiagnostics.issue === 'unsupported-version'
                        ? 'Upgrade Codex to continue'
                      : 'Check the Codex installation'}
                </h2>
                <p>{codexDiagnostics.message}</p>
              </div>
              <div className="codex-onboarding-actions">
                {(codexDiagnostics.issue === 'not-installed' ||
                  codexDiagnostics.issue === 'unsupported-version') && (
                  <a href={CODEX_SETUP_URL} target="_blank" rel="noreferrer">
                    Open setup guide
                  </a>
                )}
                {codexDiagnostics.issue === 'not-authenticated' && (
                  <code>codex login</code>
                )}
                <button type="button" onClick={() => void checkCodex()}>
                  Check again
                </button>
              </div>
            </section>
          )}

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
          {preview ? (
            <div className="wallpaper-preview-frame">
              <img
                className="wallpaper-preview-image"
                src={preview.previewUrl}
                alt={`${preview.record.title} wallpaper preview`}
              />
              <span className="preview-saved-badge">Saved locally</span>
            </div>
          ) : (
            <div className="direction-art" data-theme={selectedTheme.id} aria-hidden="true">
              <span className="art-orbit art-orbit-one" />
              <span className="art-orbit art-orbit-two" />
              <span className="art-core" />
              <span className="art-grain" />
            </div>
          )}

          <div className="direction-copy">
            <p className="collection-label">
              {preview
                ? preview.source === 'generated'
                  ? 'New wallpaper'
                  : 'Library wallpaper'
                : selectedTheme.collection}
            </p>
            <div className="direction-title-row">
              <h2 id="direction-title">
                {preview ? preview.record.title : selectedTheme.name}
              </h2>
              {!preview && (
                <div className="palette" aria-label={`${selectedTheme.name} palette`}>
                  {selectedTheme.palette.map((color, index) => (
                    <span key={color} className={`swatch swatch-${index + 1}`} />
                  ))}
                </div>
              )}
            </div>
            <p className="theme-description">
              {preview ? preview.record.sceneSummary : selectedTheme.description}
            </p>
            {preview ? (
              <p className="preview-metadata">
                {preview.record.width} × {preview.record.height} ·{' '}
                {getThemePack(preview.record.themeId).name}
              </p>
            ) : (
              <div className="mood-list" aria-label="Theme mood">
                {selectedTheme.mood.map((mood) => (
                  <span key={mood}>{mood}</span>
                ))}
              </div>
            )}
          </div>

          {preview ? (
            <div className="preview-actions">
              <button
                className="primary-action"
                type="button"
                disabled={preview.record.applied || activeWallpaperId === preview.record.id}
                onClick={() => void handleApply(preview.record.id)}
              >
                {preview.record.applied
                  ? 'Applied to desktop'
                  : activeWallpaperId === preview.record.id
                    ? 'Applying…'
                    : 'Apply wallpaper'}
                <span aria-hidden="true">→</span>
              </button>
              <button
                className="secondary-action danger-action"
                type="button"
                disabled={preview.record.applied || activeWallpaperId === preview.record.id}
                onClick={() => void handleDelete(preview.record.id)}
              >
                Reject and remove
              </button>
              <button className="text-action" type="button" onClick={() => setPreview(null)}>
                Back to directions
              </button>
              {libraryError && <p className="library-error" role="alert">{libraryError}</p>}
              <p className="action-note">Stored only in your private local library until you remove it.</p>
            </div>
          ) : generating ? (
            <section className="generation-progress" aria-labelledby="generation-progress-title">
              <div className="progress-heading">
                <span className="generation-spinner" aria-hidden="true" />
                <div>
                  <p className="eyebrow">{selectionLabel}</p>
                  <h3 id="generation-progress-title">Creating your wallpaper</h3>
                </div>
                <span className="progress-percent">{progress.percent}%</span>
              </div>
              <progress
                className="progress-track"
                max={100}
                value={progress.percent}
                aria-label="Wallpaper generation progress"
              />
              <p className="progress-message" aria-live="polite">{progress.message}</p>
              {progress.phase !== 'importing' && progress.phase !== 'complete' ? (
                <button
                  className="cancel-action"
                  type="button"
                  disabled={cancelling}
                  onClick={() => void handleCancel()}
                >
                  {cancelling ? 'Cancelling…' : 'Cancel generation'}
                </button>
              ) : (
                <p className="persistence-note">Finishing the private library save…</p>
              )}
            </section>
          ) : (
            <>
              <ScenePicker
                theme={selectedTheme}
                mode={mode}
                selectedSceneId={selectedSceneId}
                customPrompt={customPrompt}
                onModeChange={(nextMode) => {
                  setMode(nextMode);
                  setGenerationError(null);
                }}
                onSceneChange={(sceneId) => {
                  setSelectedSceneId(sceneId);
                  setGenerationError(null);
                }}
                onCustomPromptChange={(value) => {
                  setCustomPrompt(value);
                  setGenerationError(null);
                }}
              />

              {generationError && (
                <div className="generation-error" role="alert">
                  <span aria-hidden="true">!</span>
                  <p>{generationError.message}</p>
                </div>
              )}

              <div className="panel-action">
                <button
                  className="primary-action"
                  type="button"
                  disabled={!canGenerate}
                  onClick={() => void handleGenerate()}
                >
                  Generate wallpaper
                  <span aria-hidden="true">→</span>
                </button>
                <p className="action-note">
                  Uses your signed-in Codex session. No API key is stored by Infinite Wall.
                </p>
              </div>
            </>
          )}
        </aside>

        <section className="wallpaper-history" aria-labelledby="history-title">
          <div className="history-heading">
            <div>
              <p className="eyebrow">Private on this computer</p>
              <h2 id="history-title">Local wallpaper library</h2>
            </div>
            <p>{wallpapers.length} {wallpapers.length === 1 ? 'wallpaper' : 'wallpapers'}</p>
          </div>

          {libraryError && !preview && (
            <p className="library-error" role="alert">{libraryError}</p>
          )}

          {wallpapers.length === 0 ? (
            <div className="history-empty">
              <p>Your generated wallpapers will appear here.</p>
              <span>Images and prompts stay in the app’s local library.</span>
            </div>
          ) : (
            <div className="history-grid">
              {wallpapers.map((item) => {
                const busy = activeWallpaperId === item.record.id;
                return (
                  <article className="history-card" key={item.record.id}>
                    <button
                      className="history-preview"
                      type="button"
                      onClick={() => setPreview({ ...item, source: 'library' })}
                      aria-label={`Preview ${item.record.title}`}
                    >
                      <img src={item.previewUrl} alt="" />
                      {item.record.applied && <span>Current wallpaper</span>}
                    </button>
                    <div className="history-card-copy">
                      <div>
                        <h3>{item.record.title}</h3>
                        <p>{item.record.width} × {item.record.height} · {getThemePack(item.record.themeId).name}</p>
                      </div>
                      <button
                        className="favorite-action"
                        type="button"
                        disabled={busy}
                        aria-label={`${item.record.favorite ? 'Remove' : 'Add'} ${item.record.title} ${item.record.favorite ? 'from' : 'to'} favorites`}
                        aria-pressed={item.record.favorite}
                        onClick={() => void handleFavorite(item.record)}
                      >
                        {item.record.favorite ? '★' : '☆'}
                      </button>
                    </div>
                    <div className="history-actions">
                      <button
                        type="button"
                        disabled={busy || item.record.applied}
                        onClick={() => void handleApply(item.record.id)}
                      >
                        {item.record.applied ? 'Applied' : busy ? 'Working…' : 'Apply'}
                      </button>
                      <button
                        type="button"
                        disabled={busy || item.record.applied}
                        onClick={() => void handleDelete(item.record.id)}
                        aria-label={`Remove ${item.record.title}`}
                      >
                        Remove
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
