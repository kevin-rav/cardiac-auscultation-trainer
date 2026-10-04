import { describe, expect, it } from 'vitest';
import {
  type Beat,
  type BeatGenerator,
  createBlockedBeatGenerator,
  createIrregularBeatGenerator,
  createRampBeatGenerator,
  createRegularBeatGenerator,
} from './beats';

function nextBeat(gen: BeatGenerator): Beat {
  const result = gen.next();
  if (!result.value) {
    throw new Error('Expected next beat to be defined');
  }
  return result.value;
}

describe('rhythm beat generators', () => {
  it('generates regular sinus beats with sample-accurate intervals', () => {
    // 60 BPM -> 1000 ms RR interval
    const generator = createRegularBeatGenerator(60, 0);

    const b0 = nextBeat(generator);
    expect(b0.start).toBe(0);
    expect(b0.rr).toBe(1000);
    expect(b0.bpm).toBe(60);
    expect(b0.conducted).toBe(true);
    expect(b0.atrialKick).toBe(true);

    const b1 = nextBeat(generator);
    expect(b1.start).toBe(1.0);
    expect(b1.rr).toBe(1000);

    const b2 = nextBeat(generator);
    expect(b2.start).toBe(2.0);
  });

  it('generates irregular AFib beats with requested variability and no atrial kick', () => {
    const generator = createIrregularBeatGenerator(100, 0.25, false, 0, 12345);

    const beats: Beat[] = [];
    for (let i = 0; i < 50; i++) {
      beats.push(nextBeat(generator));
    }

    expect(beats.length).toBe(50);
    // AFib has atrialKick: false
    expect(beats.every((b) => !b.atrialKick)).toBe(true);

    // Variation exists
    const rrIntervals = beats.map((b) => b.rr);
    const minRr = Math.min(...rrIntervals);
    const maxRr = Math.max(...rrIntervals);
    expect(maxRr).toBeGreaterThan(minRr);
  });

  it('generates blocked rhythm with periodic unconducted beats', () => {
    // 2:1 block: conductEvery = 2
    const generator = createBlockedBeatGenerator(60, 2, 0);

    const b0 = nextBeat(generator);
    expect(b0.conducted).toBe(true);

    const b1 = nextBeat(generator);
    expect(b1.conducted).toBe(false); // 2nd beat is blocked

    const b2 = nextBeat(generator);
    expect(b2.conducted).toBe(true);

    const b3 = nextBeat(generator);
    expect(b3.conducted).toBe(false); // 4th beat is blocked
  });

  it('generates ramp rhythm smoothly shifting BPM over time', () => {
    // 60 BPM to 120 BPM over 10 seconds
    const generator = createRampBeatGenerator(60, 120, 10, 0);

    const first = nextBeat(generator);
    expect(first.bpm).toBe(60);

    // Pull beats until 10 seconds have elapsed
    let current = first;
    while (current.start < 10) {
      current = nextBeat(generator);
    }

    expect(current.bpm).toBeCloseTo(120, -1);
  });
});
