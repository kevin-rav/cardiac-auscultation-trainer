import { describe, expect, it } from 'vitest';
import { calculateLandmarks, calculateSystoleMs, resolvePositionMs } from './cycle';

describe('cycle engine timing', () => {
  describe('calculateSystoleMs', () => {
    it('computes Weissler electromechanical systole accurately across heart rates', () => {
      // 546 - 2.1 * 60 = 420 ms
      expect(calculateSystoleMs(60)).toBe(420);
      // 546 - 2.1 * 72 = 394.8 -> 395 ms
      expect(calculateSystoleMs(72)).toBe(395);
      // 546 - 2.1 * 100 = 336 ms
      expect(calculateSystoleMs(100)).toBe(336);
      // 546 - 2.1 * 150 = 231 ms
      expect(calculateSystoleMs(150)).toBe(231);
    });

    it('clamps systole at physiological minimum and maximum bounds', () => {
      // Very low heart rates clamp to maxMs (450 ms)
      expect(calculateSystoleMs(30)).toBe(450);
      expect(calculateSystoleMs(40)).toBe(450);

      // Very high heart rates clamp to minMs (200 ms)
      expect(calculateSystoleMs(180)).toBe(200);
      expect(calculateSystoleMs(220)).toBe(200);
    });

    it('respects custom cycle params', () => {
      const customParams = {
        interceptMs: 500,
        slopePerBpm: 2.0,
        minMs: 150,
        maxMs: 400,
      };
      // 500 - 2.0 * 60 = 380 ms
      expect(calculateSystoleMs(60, customParams)).toBe(380);
    });
  });

  describe('calculateLandmarks', () => {
    it('produces correct S1, S2, nextS1, systole and diastole intervals at 60 BPM', () => {
      const rrMs = 1000;
      const bpm = 60;
      const landmarks = calculateLandmarks(rrMs, bpm);

      expect(landmarks.S1).toBe(0);
      expect(landmarks.S2).toBe(420);
      expect(landmarks.nextS1).toBe(1000);
      expect(landmarks.systoleMs).toBe(420);
      expect(landmarks.diastoleMs).toBe(580);
      expect(landmarks.rrMs).toBe(1000);
    });

    it('shortens diastole dramatically at high heart rates (summation gallop range)', () => {
      // At 150 BPM: RR = 400 ms, systole = 231 ms, diastole = 169 ms
      const landmarks = calculateLandmarks(400, 150);
      expect(landmarks.systoleMs).toBe(231);
      expect(landmarks.diastoleMs).toBe(169);
    });
  });

  describe('resolvePositionMs', () => {
    const landmarks = calculateLandmarks(1000, 60); // S1 = 0, S2 = 420, nextS1 = 1000, systole = 420, diastole = 580

    it('resolves exact landmark positions without offset', () => {
      expect(resolvePositionMs({ anchor: 'S1' }, landmarks)).toBe(0);
      expect(resolvePositionMs({ anchor: 'S2' }, landmarks)).toBe(420);
      expect(resolvePositionMs({ anchor: 'nextS1' }, landmarks)).toBe(1000);
    });

    it('resolves millisecond offsets on S2 (S3 early diastole)', () => {
      // S3 at S2 + 140ms = 420 + 140 = 560ms
      expect(resolvePositionMs({ anchor: 'S2', ms: 140 }, landmarks)).toBe(560);
    });

    it('resolves negative millisecond offsets on nextS1 (S4 presystolic)', () => {
      // S4 at nextS1 - 90ms = 1000 - 90 = 910ms
      expect(resolvePositionMs({ anchor: 'nextS1', ms: -90 }, landmarks)).toBe(910);
    });

    it('resolves fraction offsets on S1 across systole (click & murmur)', () => {
      // Mid-systolic click at 50% of systole: 0 + 0.5 * 420 = 210ms
      expect(resolvePositionMs({ anchor: 'S1', fraction: 0.5 }, landmarks)).toBe(210);
      // Late systolic murmur start at 55% of systole: 0 + 0.55 * 420 = 231ms
      expect(resolvePositionMs({ anchor: 'S1', fraction: 0.55 }, landmarks)).toBe(231);
    });

    it('resolves fraction offsets on S2 across diastole', () => {
      // 10% into diastole: S2 + 0.1 * 580 = 420 + 58 = 478ms
      expect(resolvePositionMs({ anchor: 'S2', fraction: 0.1 }, landmarks)).toBe(478);
    });
  });
});
