import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { APP_NAME, CODEX_SETUP_URL } from '../shared/app-info';
import type {
  CodexDiagnostics,
  AppSettings,
  AppSettingsPatch,
  GenerationProgress,
  GenerationRequest,
  PublicAppError,
  ScheduleStatus,
  ThemeId,
  WallpaperLibraryItem,
  WallpaperRecord,
} from '../shared/contracts';
import { getThemePack, THEME_PACKS } from '../shared/themes';
import { CodexStatus } from './CodexStatus';
import { ScenePicker, type SelectionMode } from './ScenePicker';
import { SettingsSelect, type SettingsSelectOption } from './SettingsSelect';
import { ThemeArtwork } from './ThemeArtwork';
import { ThemeCard } from './ThemeCard';

const INITIAL_PROGRESS: GenerationProgress = {
  phase: 'preparing',
  message: 'Preparing generation…',
  percent: 2,
};
const GENERATION_STAGES = ['Prepare', 'Create', 'Check', 'Save'] as const;
const DEFAULT_SETTINGS: AppSettings = {
  quality: 'standard', scheduleHours: null, schedulePaused: false,
  launchAtLogin: false, libraryLimit: 100, applyToAllDisplays: true,
};
const DEFAULT_SCHEDULE_STATUS: ScheduleStatus = {
  state: 'manual',
  intervalHours: null,
  nextRunAt: null,
};
const QUALITY_OPTIONS: readonly SettingsSelectOption[] = [
  {
    value: 'standard',
    label: 'Standard',
    description: 'Balanced detail and generation time',
  },
  {
    value: 'high',
    label: 'High',
    description: 'More detail, with a longer wait',
  },
];
const SCHEDULE_OPTIONS: readonly SettingsSelectOption[] = [
  { value: '', label: 'Manual only', description: 'Generate only when you ask' },
  { value: '1', label: 'Every hour', description: 'A new wallpaper every 60 minutes' },
  { value: '3', label: 'Every 3 hours', description: 'Four changes during a 12-hour day' },
  { value: '6', label: 'Every 6 hours', description: 'Four changes each day' },
  { value: '12', label: 'Every 12 hours', description: 'Two changes each day' },
  { value: '24', label: 'Every 24 hours', description: 'One change each day' },
];

const formatInterval = (hours: number): string =>
  hours === 1 ? '1-hour' : `${hours}-hour`;

const formatTimeRemaining = (nextRunAt: string, now: number): string => {
  const remainingMinutes = Math.max(
    0,
    Math.ceil((new Date(nextRunAt).getTime() - now) / 60_000),
  );
  if (remainingMinutes < 60) {
    return remainingMinutes <= 1 ? 'less than a minute' : `${remainingMinutes} min`;
  }
  const hours = Math.floor(remainingMinutes / 60);
  const minutes = remainingMinutes % 60;
  return minutes ? `${hours} hr ${minutes} min` : `${hours} hr`;
};

const formatLocalTime = (nextRunAt: string): string =>
  new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(nextRunAt));

const generationStageIndex = (phase: GenerationProgress['phase']): number => {
  if (phase === 'preparing') return 0;
  if (phase === 'starting' || phase === 'generating') return 1;
  if (phase === 'validating') return 2;
  return 3;
};

const formatElapsedTime = (elapsedSeconds: number): string => {
  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
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
  const [generationStartedAt, setGenerationStartedAt] = useState<number | null>(null);
  const [generationClock, setGenerationClock] = useState(Date.now());
  const [preview, setPreview] = useState<ActivePreview | null>(null);
  const [wallpapers, setWallpapers] = useState<WallpaperLibraryItem[]>([]);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [activeWallpaperId, setActiveWallpaperId] = useState<string | null>(null);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [scheduleStatus, setScheduleStatus] = useState<ScheduleStatus>(
    DEFAULT_SCHEDULE_STATUS,
  );
  const [scheduleClock, setScheduleClock] = useState(Date.now());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [scheduleRunning, setScheduleRunning] = useState(false);
  const [scheduleMessage, setScheduleMessage] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState<PublicAppError | null>(
    null,
  );
  const generationActiveRef = useRef(false);
  const diagnosticsCheckRef = useRef<Promise<CodexDiagnostics | null> | null>(null);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const settingsDrawerRef = useRef<HTMLElement>(null);
  const selectedTheme = getThemePack(selectedThemeId);

  const closeSettings = useCallback(() => {
    setSettingsOpen(false);
    window.setTimeout(() => settingsButtonRef.current?.focus(), 0);
  }, []);

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

  const checkCodex = useCallback((): Promise<CodexDiagnostics | null> => {
    if (!window.infiniteWall?.checkCodex) {
      setCheckingCodex(false);
      return Promise.resolve(null);
    }
    if (diagnosticsCheckRef.current) return diagnosticsCheckRef.current;
    setCheckingCodex(true);
    const check = window.infiniteWall.checkCodex()
      .catch((): CodexDiagnostics => ({
          installed: false,
          authenticated: false,
          version: null,
          authMethod: null,
          issue: 'check-failed',
          message: 'Infinite Wall could not verify Codex on this computer.',
        }))
      .then((diagnostics) => {
        setCodexDiagnostics(diagnostics);
        return diagnostics;
      })
      .finally(() => {
        diagnosticsCheckRef.current = null;
        setCheckingCodex(false);
      });
    diagnosticsCheckRef.current = check;
    return check;
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

  useEffect(() => {
    if (!generating) return undefined;
    const clock = window.setInterval(() => setGenerationClock(Date.now()), 1_000);
    return () => window.clearInterval(clock);
  }, [generating]);

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

  useEffect(() => {
    if (!window.infiniteWall?.onLibraryChanged) return undefined;
    return window.infiniteWall.onLibraryChanged(() => {
      void refreshLibrary();
    });
  }, [refreshLibrary]);

  useEffect(() => {
    if (!window.infiniteWall?.getSettings) return;
    void window.infiniteWall.getSettings().then((result) => {
      if (result.ok) setSettings(result.value);
      else setSettingsError(result.error.message);
    }).catch(() => setSettingsError('Settings could not be loaded.'));
  }, []);

  useEffect(() => {
    if (!window.infiniteWall?.onSettingsChanged) return undefined;
    return window.infiniteWall.onSettingsChanged((nextSettings) => {
      setSettings(nextSettings);
      setSettingsError(null);
    });
  }, []);

  useEffect(() => {
    if (!window.infiniteWall?.getScheduleStatus) return;
    void window.infiniteWall.getScheduleStatus().then((result) => {
      if (result.ok) {
        setScheduleStatus(result.value);
        setScheduleClock(Date.now());
      } else {
        setSettingsError(result.error.message);
      }
    }).catch(() => setSettingsError('Schedule status could not be loaded.'));
  }, []);

  useEffect(() => {
    if (!window.infiniteWall?.onScheduleStatusChanged) return undefined;
    return window.infiniteWall.onScheduleStatusChanged((status) => {
      setScheduleStatus(status);
      setScheduleClock(Date.now());
    });
  }, []);

  useEffect(() => {
    if (scheduleStatus.state !== 'active') return undefined;
    const clock = window.setInterval(() => setScheduleClock(Date.now()), 30_000);
    return () => window.clearInterval(clock);
  }, [scheduleStatus.state]);

  useEffect(() => {
    if (!settingsOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    const manageDialogKeyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeSettings();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = settingsDrawerRef.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled), select:not(:disabled)',
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', manageDialogKeyboard);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', manageDialogKeyboard);
    };
  }, [closeSettings, settingsOpen]);

  const buildRequest = useCallback(
    async (themeOverride?: ThemeId): Promise<GenerationRequest> => {
      const display = await window.infiniteWall.getPrimaryDisplay();
      const base = {
        themeId: themeOverride ?? selectedThemeId,
        display,
        quality: settings.quality,
        recentConcepts: [],
      };
      if (themeOverride) return { ...base, mode: 'infinite' };
      if (mode === 'curated') {
        return { ...base, mode, sceneId: selectedSceneId };
      }
      if (mode === 'custom') {
        return { ...base, mode, customPrompt };
      }
      return { ...base, mode };
    },
    [customPrompt, mode, selectedSceneId, selectedThemeId, settings.quality],
  );

  const handleGenerate = useCallback(async (themeOverride?: ThemeId) => {
    if (!window.infiniteWall?.generateWallpaper || generationActiveRef.current) {
      return;
    }
    generationActiveRef.current = true;
    try {
      const diagnostics = codexDiagnostics ?? await checkCodex();
      if (!diagnostics?.authenticated) {
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
      const startedAt = Date.now();
      setGenerationStartedAt(startedAt);
      setGenerationClock(startedAt);
      const result = await window.infiniteWall.generateWallpaper(
        await buildRequest(themeOverride),
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
      generationActiveRef.current = false;
      setGenerating(false);
      setCancelling(false);
    }
  }, [buildRequest, checkCodex, codexDiagnostics, refreshLibrary]);

  const activeGenerationStage = generationStageIndex(progress.phase);
  const generationElapsedSeconds = generationStartedAt === null
    ? 0
    : Math.max(0, Math.floor((generationClock - generationStartedAt) / 1_000));
  const generationExpectation = generationElapsedSeconds < 120
    ? 'Most wallpapers take about 1–2 minutes.'
    : 'Complex scenes can take longer. Codex is still working.';

  useEffect(() => {
    if (!window.infiniteWall?.onAppCommand) return undefined;
    return window.infiniteWall.onAppCommand((command) => {
      void handleGenerate(command.type === 'surprise' ? command.themeId : undefined);
    });
  }, [handleGenerate]);

  useEffect(() => {
    window.infiniteWall?.signalRendererReady?.();
  }, []);

  const updateSettings = useCallback(async (
    patch: AppSettingsPatch,
    confirmation?: string,
  ) => {
    setSettingsError(null);
    setScheduleMessage(null);
    try {
      const result = await window.infiniteWall.updateSettings(patch);
      if (result.ok) {
        setSettings(result.value);
        if (confirmation) setScheduleMessage(confirmation);
      } else {
        setSettingsError(result.error.message);
      }
    } catch {
      setSettingsError('Settings could not be saved.');
    }
  }, []);

  const runScheduleNow = useCallback(async () => {
    if (!window.infiniteWall?.runScheduleNow || generationActiveRef.current) return;
    generationActiveRef.current = true;
    setScheduleRunning(true);
    setScheduleMessage(null);
    setSettingsError(null);
    try {
      const result = await window.infiniteWall.runScheduleNow();
      if (result.ok) {
        setScheduleMessage('New wallpaper generated and applied.');
        await refreshLibrary();
      } else {
        setSettingsError(result.error.message);
      }
    } catch {
      setSettingsError('The scheduled wallpaper could not be generated.');
    } finally {
      generationActiveRef.current = false;
      setScheduleRunning(false);
    }
  }, [refreshLibrary]);

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

  const generationBlockedReason = (() => {
    if (platform === 'preview') {
      return 'Wallpaper generation is unavailable in the interface preview.';
    }
    if (checkingCodex || codexDiagnostics === null) {
      return 'Checking your local Codex setup before generation can begin.';
    }
    if (!codexDiagnostics.authenticated) {
      return codexDiagnostics.message;
    }
    if (scheduleRunning) {
      return 'A scheduled wallpaper is already being generated.';
    }
    if (mode === 'custom' && customPrompt.trim().length < 3) {
      return 'Enter at least 3 characters for your custom direction.';
    }
    return null;
  })();
  const canGenerate = generationBlockedReason === null;
  const schedulePresentation = useMemo(() => {
    if (scheduleRunning || scheduleStatus.state === 'running') {
      return {
        state: 'running',
        label: 'Change in progress',
        detail: 'Generating and applying a new wallpaper now.',
      } as const;
    }
    if (scheduleStatus.state === 'manual') {
      return {
        state: 'manual',
        label: 'Manual mode',
        detail: 'Nothing runs automatically. Generate whenever you want.',
      } as const;
    }
    if (scheduleStatus.state === 'paused') {
      return {
        state: 'paused',
        label: 'Automatic changes paused',
        detail: `Resume to start a new ${formatInterval(scheduleStatus.intervalHours)} countdown.`,
      } as const;
    }
    return {
      state: 'active',
      label: 'Automatic changes active',
      detail: `Next wallpaper in ${formatTimeRemaining(scheduleStatus.nextRunAt, scheduleClock)} · ${formatLocalTime(scheduleStatus.nextRunAt)}`,
    } as const;
  }, [scheduleClock, scheduleRunning, scheduleStatus]);

  return (
    <div className="app-shell" data-theme={selectedTheme.id}>
      <header className="topbar">
        <a className="brand" href="#theme-library" aria-label={`${APP_NAME} home`}>
          <span className="brand-mark" aria-hidden="true">∞</span>
          <span>{APP_NAME}</span>
        </a>
        <div className="topbar-meta">
          <button
            className="settings-button"
            ref={settingsButtonRef}
            type="button"
            aria-expanded={settingsOpen}
            aria-controls="settings-drawer"
            onClick={() => setSettingsOpen(true)}
          >
            <svg aria-hidden="true" viewBox="0 0 16 16">
              <path d="M3 4h10M5.5 8h7.5M3 12h10M5.5 2.5v3M10.5 6.5v3M6.5 10.5v3" />
            </svg>
            <span>Settings</span>
          </button>
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
              <ThemeArtwork
                themeId={selectedTheme.id}
                className="direction-artwork"
                eager
              />
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
                <div className="generation-study" aria-hidden="true">
                  <span className="generation-shape generation-shape-one" />
                  <span className="generation-shape generation-shape-two" />
                  <span className="generation-shape generation-shape-three" />
                </div>
                <div>
                  <p className="eyebrow">{selectionLabel}</p>
                  <h3 id="generation-progress-title">Creating your wallpaper</h3>
                  <p className="generation-expectation">{generationExpectation}</p>
                </div>
              </div>
              <ol className="generation-stages" aria-label="Generation stages">
                {GENERATION_STAGES.map((stage, index) => (
                  <li
                    key={stage}
                    className={index < activeGenerationStage
                      ? 'is-complete'
                      : index === activeGenerationStage
                        ? 'is-active'
                        : undefined}
                    aria-current={index === activeGenerationStage ? 'step' : undefined}
                  >
                    <span className="generation-stage-mark" aria-hidden="true" />
                    <span>{stage}</span>
                  </li>
                ))}
              </ol>
              <div className="generation-status">
                <div className="generation-status-meta">
                  <span>Stage {activeGenerationStage + 1} of {GENERATION_STAGES.length}</span>
                  <span>Elapsed {formatElapsedTime(generationElapsedSeconds)}</span>
                </div>
                <p className="progress-message" aria-live="polite" aria-atomic="true">
                  {progress.message}
                </p>
              </div>
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
                {generationBlockedReason && (
                  <div className="generation-blocked" role="status">
                    <span className="generation-blocked-mark" aria-hidden="true">!</span>
                    <p id="generation-blocked-reason">
                      <strong>Generation unavailable</strong>
                      <span>{generationBlockedReason}</span>
                    </p>
                  </div>
                )}
                <button
                  className="primary-action"
                  type="button"
                  disabled={!canGenerate}
                  aria-describedby={generationBlockedReason
                    ? 'generation-blocked-reason'
                    : 'generation-privacy-note'}
                  onClick={() => void handleGenerate()}
                >
                  Generate wallpaper
                  <span aria-hidden="true">→</span>
                </button>
                <p className="action-note" id="generation-privacy-note">
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

      {settingsOpen && (
        <div className="settings-layer">
          <button
            className="settings-backdrop"
            type="button"
            aria-label="Dismiss settings"
            onClick={closeSettings}
          />
          <aside
            className="settings-drawer"
            ref={settingsDrawerRef}
            id="settings-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-title"
          >
            <div className="settings-drawer-heading">
              <div>
                <p className="eyebrow">Automation</p>
                <h2 id="settings-title">Settings</h2>
                <p>Stored privately on this computer.</p>
              </div>
              <button
                className="settings-close"
                type="button"
                aria-label="Close settings"
                autoFocus
                onClick={closeSettings}
              >
                ×
              </button>
            </div>

            <div className="settings-grid">
              <SettingsSelect
                label="Generation quality"
                value={settings.quality}
                options={QUALITY_OPTIONS}
                onChange={(value) => void updateSettings(
                  { quality: value as AppSettings['quality'] },
                  `Generation quality set to ${value === 'high' ? 'High' : 'Standard'}.`,
                )}
              />
              <SettingsSelect
                label="Wallpaper schedule"
                value={settings.scheduleHours?.toString() ?? ''}
                options={SCHEDULE_OPTIONS}
                onChange={(value) => {
                  const scheduleHours = value
                    ? Number(value) as NonNullable<AppSettings['scheduleHours']>
                    : null;
                  void updateSettings(
                    { scheduleHours, schedulePaused: false },
                    scheduleHours
                      ? `${formatInterval(scheduleHours)} schedule started.`
                      : 'Automatic wallpaper changes turned off.',
                  );
                }}
              />
              <label className="toggle-setting">
                <input
                  type="checkbox"
                  checked={settings.launchAtLogin}
                  onChange={(event) => void updateSettings(
                    { launchAtLogin: event.target.checked },
                    `Launch at login ${event.target.checked ? 'enabled' : 'disabled'}.`,
                  )}
                />
                <span aria-hidden="true" className="toggle-control" />
                <span>Launch Infinite Wall at login</span>
              </label>
            </div>

            <section
              className={`schedule-status-card is-${schedulePresentation.state}`}
              aria-label="Wallpaper schedule status"
            >
              <span className="schedule-status-dot" aria-hidden="true" />
              <div>
                <strong>{schedulePresentation.label}</strong>
                <p>{schedulePresentation.detail}</p>
              </div>
            </section>

            <div className="schedule-actions">
              <button
                className="secondary-action"
                type="button"
                disabled={!settings.scheduleHours || scheduleRunning}
                onClick={() => void updateSettings(
                  { schedulePaused: !settings.schedulePaused },
                  settings.schedulePaused
                    ? `Schedule resumed with a new ${formatInterval(settings.scheduleHours ?? 1)} countdown.`
                    : 'Automatic wallpaper changes paused.',
                )}
              >
                {settings.schedulePaused
                  ? 'Resume automatic changes'
                  : 'Pause automatic changes'}
              </button>
              <button
                className="primary-action"
                type="button"
                disabled={scheduleRunning || generating}
                onClick={() => void runScheduleNow()}
              >
                {scheduleRunning ? 'Generating and applying…' : 'Generate & apply now'}
                <span aria-hidden="true">→</span>
              </button>
            </div>

            {settingsError && <p className="library-error" role="alert">{settingsError}</p>}
            {scheduleMessage && <p className="settings-success" role="status">{scheduleMessage}</p>}
            <p className="settings-note">
              Generate &amp; apply now chooses a random direction immediately. It
              does not move your next automatic change or create a retry loop.
            </p>
          </aside>
        </div>
      )}
    </div>
  );
}
