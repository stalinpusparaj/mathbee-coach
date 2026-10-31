import { describe, it, expect } from 'vitest';
import { COMBO_BARS, COMBO_PAD_FROM, SONG, WORLD_MUSIC, melodyRange, music } from '../../src/audio/music';
import { FRIEND_ORDER } from '../../src/learning/fun';
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

describe('world music', () => {
  it('every world has its own key and tempo from the plan', () => {
    expect(Object.keys(WORLD_MUSIC).sort()).toEqual([...FRIEND_ORDER].sort());
    expect(Object.fromEntries(Object.entries(WORLD_MUSIC).map(([w, m]) => [w, `${m.key}/${m.bpm}`]))).toEqual({
      meadow: 'C/96', river: 'D/92', orchard: 'F/100', ice: 'A/88', trail: 'G/104', town: 'Bb/96', garden: 'C/100',
    });
  });

  it('keeps every variation (combo lift included) in a gentle range', () => {
    for (const w of [null, ...FRIEND_ORDER]) {
      const [lo, hi] = melodyRange(w);
      expect(lo).toBeGreaterThanOrEqual(60);
      expect(hi).toBeLessThanOrEqual(90);
    }
  });

  it('setWorld changes the key and tempo; null goes back to the written tune', () => {
    music.setWorld('ice');
    expect(music.debugState()).toMatchObject({ world: 'ice', shift: WORLD_MUSIC.ice.shift, bpm: 88 });
    music.setWorld(null);
    expect(music.debugState()).toMatchObject({ world: null, shift: 0, bpm: 100 });
  });

  it('a combo lift lasts a fixed number of bars, with the pad stem from 5 in a row', () => {
    music.combo(3);
    expect(music.debugState()).toMatchObject({ comboBarsLeft: COMBO_BARS, comboPad: false });
    music.combo(COMBO_PAD_FROM);
    expect(music.debugState()).toMatchObject({ comboBarsLeft: COMBO_BARS, comboPad: true });
  });

  it('rest fades out and ends any combo lift; waking up clears it', () => {
    music.combo(8);
    music.rest(true);
    expect(music.debugState()).toMatchObject({ resting: true, comboBarsLeft: 0 });
    music.rest(false);
    expect(music.debugState().resting).toBe(false);
  });
});
