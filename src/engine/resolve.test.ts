import { describe, expect, it } from 'vitest';
import { dbToLinearGain, resolveSoundSet } from './resolve';
import type { Location, Manifest, SoundSet } from './schema';

describe('event resolver', () => {
  const dummySoundSet: SoundSet = {
    id: 'test-set',
    label: 'Test Sound Set',
    events: [
      {
        kind: 'transient',
        component: 'S1',
        sample: 's1-apex',
        at: { anchor: 'S1' },
        gain: 1.0,
        playbackRate: 1.0,
        filter: { highpassHz: 80, lowpassHz: 1200 },
      },
      {
        kind: 'transient',
        component: 'S2',
        sample: 's2-base',
        at: { anchor: 'S2' },
        gain: 0.9,
        playbackRate: 1.0,
      },
    ],
  };

  it('converts decibels to linear gain multiplier', () => {
    expect(dbToLinearGain(0)).toBe(1);
    expect(dbToLinearGain(6)).toBeCloseTo(1.995, 2);
    expect(dbToLinearGain(-6)).toBeCloseTo(0.501, 2);
  });

  it('resolves sound set with identity multipliers when no location or manifest is given', () => {
    const resolved = resolveSoundSet(dummySoundSet);
    expect(resolved.length).toBe(2);

    const ev0 = resolved[0];
    expect(ev0?.component).toBe('S1');
    expect(ev0?.sampleId).toBe('s1-apex');
    expect(ev0?.gain).toBe(1.0);
    expect(ev0?.kind).toBe('transient');
    if (ev0?.kind === 'transient') {
      expect(ev0.playbackRate).toBe(1.0);
    }

    const ev1 = resolved[1];
    expect(ev1?.component).toBe('S2');
    expect(ev1?.sampleId).toBe('s2-base');
    expect(ev1?.gain).toBe(0.9);
  });

  it('applies sample trimDb from manifest', () => {
    const manifest: Manifest = {
      samples: [
        { id: 's1-apex', url: '/sounds/s1-apex.wav', kind: 'transient', trimDb: 6 },
        { id: 's2-base', url: '/sounds/s2-base.wav', kind: 'transient', trimDb: 0 },
      ],
    };

    const resolved = resolveSoundSet(dummySoundSet, undefined, manifest);
    // S1 gain: 1.0 * 10^(6/20) ~ 2.0
    expect(resolved[0]?.gain).toBeCloseTo(2.0, 1);
  });

  it('applies location gain multiplier and component override', () => {
    const pulmonicLocation: Location = {
      id: 'pulmonic',
      label: 'Pulmonic',
      landmark: '2nd ICS LSB',
      gain: 1.2,
      components: {
        S2: { gain: 1.5, playbackRate: 1.1 },
      },
      samples: {
        S2: 's2-pulmonic-custom',
      },
    };

    const resolved = resolveSoundSet(dummySoundSet, pulmonicLocation);
    // S2 gain: 0.9 * 1.2 (loc) * 1.5 (comp) = 1.62
    const ev1 = resolved[1];
    expect(ev1?.gain).toBeCloseTo(1.62, 2);
    expect(ev1?.kind).toBe('transient');
    if (ev1?.kind === 'transient') {
      expect(ev1.playbackRate).toBeCloseTo(1.1, 2);
    }
    // Sample overridden
    expect(ev1?.sampleId).toBe('s2-pulmonic-custom');
  });
});
