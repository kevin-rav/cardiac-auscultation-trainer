import { describe, expect, it } from 'vitest';
import type { Beat } from './beats';
import { resolveSoundSet } from './resolve';
import type { SoundSet } from './schema';
import { scheduleEvents } from './scheduler';

describe('lookahead scheduler', () => {
  const normalSoundSet: SoundSet = {
    id: 'normal',
    label: 'Normal',
    events: [
      {
        kind: 'transient',
        component: 'S1',
        sample: 's1-apex',
        at: { anchor: 'S1' },
        gain: 1.0,
        playbackRate: 1.0,
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

  const gallopSoundSet: SoundSet = {
    id: 's4-gallop',
    label: 'S4 Gallop',
    events: [
      {
        kind: 'transient',
        component: 'S4',
        sample: 's4',
        at: { anchor: 'nextS1', ms: -90 },
        gain: 1.0,
        playbackRate: 1.0,
      },
      {
        kind: 'transient',
        component: 'S1',
        sample: 's1-apex',
        at: { anchor: 'S1' },
        gain: 1.0,
        playbackRate: 1.0,
      },
    ],
  };

  it('schedules S1 and S2 at physiological intervals within a time window', () => {
    // Single beat starting at 0.0s, RR = 1000ms (60 BPM, systole = 420ms)
    const beats: Beat[] = [
      {
        index: 0,
        start: 0,
        rr: 1000,
        bpm: 60,
        conducted: true,
        atrialKick: true,
      },
    ];

    const resolved = resolveSoundSet(normalSoundSet);
    const events = scheduleEvents(beats, resolved, 0, 1.0);

    expect(events.length).toBe(2);
    // S1 at 0.0s
    expect(events[0]?.component).toBe('S1');
    expect(events[0]?.time).toBe(0);

    // S2 at 0.42s (420ms after S1)
    expect(events[1]?.component).toBe('S2');
    expect(events[1]?.time).toBeCloseTo(0.42, 3);
  });

  it('omits ventricular sounds during unconducted beats', () => {
    const beats: Beat[] = [
      {
        index: 0,
        start: 0,
        rr: 1000,
        bpm: 60,
        conducted: false, // Blocked beat
        atrialKick: true,
      },
    ];

    const resolved = resolveSoundSet(normalSoundSet);
    const events = scheduleEvents(beats, resolved, 0, 1.0);

    expect(events.length).toBe(0);
  });

  it('suppresses S4 gallop when atrial kick is absent (e.g. Atrial Fibrillation)', () => {
    const beatWithoutKick: Beat = {
      index: 0,
      start: 0,
      rr: 1000,
      bpm: 60,
      conducted: true,
      atrialKick: false, // No atrial contraction
    };

    const resolved = resolveSoundSet(gallopSoundSet);
    const events = scheduleEvents([beatWithoutKick], resolved, 0, 1.0);

    // S4 is suppressed, only S1 is scheduled
    expect(events.length).toBe(1);
    expect(events[0]?.component).toBe('S1');
  });

  it('only schedules events falling strictly within [fromSec, toSec)', () => {
    const beats: Beat[] = [
      {
        index: 0,
        start: 0,
        rr: 1000,
        bpm: 60,
        conducted: true,
        atrialKick: true,
      },
    ];

    const resolved = resolveSoundSet(normalSoundSet);
    // Window from 0.1s to 0.5s catches S2 (0.42s) but misses S1 (0.0s)
    const events = scheduleEvents(beats, resolved, 0.1, 0.5);

    expect(events.length).toBe(1);
    expect(events[0]?.component).toBe('S2');
  });
});
