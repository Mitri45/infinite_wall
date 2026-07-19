import type { DisplayDimensions } from '../shared/contracts';

interface ElectronDisplayMetrics {
  readonly size: {
    readonly width: number;
    readonly height: number;
  };
  readonly scaleFactor: number;
}

export function physicalDisplayDimensions(
  display: ElectronDisplayMetrics,
): DisplayDimensions {
  const scaleFactor =
    Number.isFinite(display.scaleFactor) && display.scaleFactor > 0
      ? display.scaleFactor
      : 1;
  return {
    width: Math.round(display.size.width * scaleFactor),
    height: Math.round(display.size.height * scaleFactor),
  };
}
