import { describe, expect, it } from 'vitest';

import { physicalDisplayDimensions } from './display-dimensions';

describe('physicalDisplayDimensions', () => {
  it('converts Electron DIP measurements to physical pixels', () => {
    expect(
      physicalDisplayDimensions({
        size: { width: 1920, height: 1080 },
        scaleFactor: 2,
      }),
    ).toEqual({ width: 3840, height: 2160 });
  });
});
