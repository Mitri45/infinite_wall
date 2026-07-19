import type { ThemeId, ThemePack } from '../shared/contracts';

interface ThemeCardProps {
  readonly theme: ThemePack;
  readonly index: number;
  readonly selected: boolean;
  readonly onSelect: (themeId: ThemeId) => void;
}

export function ThemeCard({ theme, index, selected, onSelect }: ThemeCardProps) {
  return (
    <button
      className="theme-card"
      data-theme={theme.id}
      type="button"
      aria-label={`${theme.name} — ${theme.collection}`}
      aria-pressed={selected}
      onClick={() => onSelect(theme.id)}
    >
      <span className="theme-card-art" aria-hidden="true">
        <span className="card-shape card-shape-one" />
        <span className="card-shape card-shape-two" />
        <span className="card-shape card-shape-three" />
      </span>
      <span className="theme-card-copy">
        <span className="theme-index">{String(index).padStart(2, '0')}</span>
        <span>
          <strong>{theme.name}</strong>
          <small>{theme.collection}</small>
        </span>
        <span className="card-arrow" aria-hidden="true">↗</span>
      </span>
    </button>
  );
}
