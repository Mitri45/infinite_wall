import type { ThemePack } from '../shared/contracts';

export type SelectionMode = 'infinite' | 'curated' | 'custom';

interface ScenePickerProps {
  readonly theme: ThemePack;
  readonly mode: SelectionMode;
  readonly selectedSceneId: string;
  readonly customPrompt: string;
  readonly onModeChange: (mode: SelectionMode) => void;
  readonly onSceneChange: (sceneId: string) => void;
  readonly onCustomPromptChange: (value: string) => void;
}

const MODES: ReadonlyArray<{ id: SelectionMode; label: string }> = [
  { id: 'infinite', label: 'Infinite' },
  { id: 'curated', label: 'Curated' },
  { id: 'custom', label: 'Custom' },
];

export function ScenePicker({
  theme,
  mode,
  selectedSceneId,
  customPrompt,
  onModeChange,
  onSceneChange,
  onCustomPromptChange,
}: ScenePickerProps) {
  return (
    <div className="scene-picker">
      <div className="mode-tabs" role="tablist" aria-label="Scene mode">
        {MODES.map((option) => (
          <button
            key={option.id}
            id={`mode-${option.id}`}
            type="button"
            role="tab"
            aria-selected={mode === option.id}
            aria-controls={`mode-panel-${option.id}`}
            tabIndex={mode === option.id ? 0 : -1}
            onClick={() => onModeChange(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>

      {mode === 'infinite' && (
        <div
          className="mode-panel infinite-panel"
          id="mode-panel-infinite"
          role="tabpanel"
          aria-labelledby="mode-infinite"
        >
          <span className="infinite-glyph" aria-hidden="true">∞</span>
          <div>
            <strong>A scene you have not seen before</strong>
            <p>
              Codex will compose a fresh {theme.name.toLocaleLowerCase()} concept
              and steer away from your 20 most recent wallpapers.
            </p>
          </div>
        </div>
      )}

      {mode === 'curated' && (
        <div
          className="mode-panel scene-list"
          id="mode-panel-curated"
          role="tabpanel"
          aria-labelledby="mode-curated"
        >
          {theme.sceneSeeds.map((scene, index) => (
            <button
              key={scene.id}
              className="scene-option"
              type="button"
              aria-pressed={selectedSceneId === scene.id}
              onClick={() => onSceneChange(scene.id)}
            >
              <span className="scene-number">{index + 1}</span>
              <span>
                <strong>{scene.title}</strong>
                <small>{scene.summary}</small>
              </span>
              <span className="scene-check" aria-hidden="true">✓</span>
            </button>
          ))}
        </div>
      )}

      {mode === 'custom' && (
        <div
          className="mode-panel custom-panel"
          id="mode-panel-custom"
          role="tabpanel"
          aria-labelledby="mode-custom"
        >
          <label htmlFor="custom-prompt">What do you want to see?</label>
          <textarea
            id="custom-prompt"
            rows={5}
            maxLength={1_000}
            value={customPrompt}
            placeholder="A quiet observatory above a sea of clouds at blue hour…"
            onChange={(event) => onCustomPromptChange(event.target.value)}
          />
          <span>{customPrompt.length} / 1,000</span>
        </div>
      )}
    </div>
  );
}
