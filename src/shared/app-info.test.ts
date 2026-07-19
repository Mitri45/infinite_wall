import { describe, expect, it } from 'vitest';

import { APP_ID, APP_NAME } from './app-info';

describe('application metadata', () => {
  it('uses stable public identifiers', () => {
    expect(APP_NAME).toBe('Infinite Wall');
    expect(APP_ID).toBe('com.mitri45.infinite-wall');
  });
});
