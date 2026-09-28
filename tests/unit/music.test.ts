import { describe, it, expect } from 'vitest';
import { SONG } from '../../src/audio/music';
import { migrate, emptyState } from '../../src/persistence/schema';

describe('background music', () => {
  it('song is well-formed: 16 bars of 8 steps, a chord per bar, notes in a gentle range', () => {
    expect(SONG.MELODY).toHaveLength(16);
    expect(SONG.CHORDS).toHaveLength(16);
    for (const bar of SONG.MELODY) {
      expect(bar).toHaveLength(8);
      for (const n of bar) if (n !== null) expect(n >= 67 && n <= 88).toBe(true);
    }
  });
  it('music is on by default and an off choice survives a save/load', () => {
    expect(emptyState().music).toBe(true);
    expect(migrate({ schemaVersion: 1, profiles: [], activeProfileId: null }).music).toBe(true);
    expect(migrate({ ...emptyState(), music: false }).music).toBe(false);
  });
});
