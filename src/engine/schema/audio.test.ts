import { describe, expect, it } from 'vitest';
import {
  FilterSchema,
  PositionSchema,
  SoundEventSchema,
  SoundSetSchema,
  TransientSchema,
  MurmurSchema,
} from './audio';

describe('Audio Schemas', () => {
  describe('PositionSchema', () => {
    it('accepts valid anchor with ms', () => {
      const parsed = PositionSchema.safeParse({ anchor: 'S2', ms: 120 });
      expect(parsed.success).toBe(true);
    });

    it('accepts valid anchor with fraction', () => {
      const parsed = PositionSchema.safeParse({ anchor: 'S1', fraction: 0.5 });
      expect(parsed.success).toBe(true);
    });

    it('rejects both ms and fraction', () => {
      const parsed = PositionSchema.safeParse({
        anchor: 'S1',
        ms: 100,
        fraction: 0.5,
      });
      expect(parsed.success).toBe(false);
    });

    it('rejects fraction on nextS1', () => {
      const parsed = PositionSchema.safeParse({
        anchor: 'nextS1',
        fraction: 0.2,
      });
      expect(parsed.success).toBe(false);
    });
  });

  describe('FilterSchema', () => {
    it('accepts valid cutoff frequencies', () => {
      const parsed = FilterSchema.safeParse({
        highpassHz: 150,
        lowpassHz: 2000,
      });
      expect(parsed.success).toBe(true);
    });

    it('rejects highpass frequency out of range', () => {
      const parsed = FilterSchema.safeParse({
        highpassHz: 10,
      });
      expect(parsed.success).toBe(false);
    });

    it('rejects lowpass frequency out of range', () => {
      const parsed = FilterSchema.safeParse({
        lowpassHz: 25000,
      });
      expect(parsed.success).toBe(false);
    });
  });

  describe('SoundEventSchema', () => {
    it('validates a transient event with default gain and playbackRate', () => {
      const input = {
        kind: 'transient',
        component: 'S1',
        sample: 's1-apex',
        at: { anchor: 'S1' },
      };
      const parsed = TransientSchema.safeParse(input);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.gain).toBe(1);
        expect(parsed.data.playbackRate).toBe(1);
      }
    });

    it('validates a murmur event', () => {
      const input = {
        kind: 'murmur',
        component: 'systolicMurmur',
        sample: 'murmur-noise',
        from: { anchor: 'S1', fraction: 0.2 },
        to: { anchor: 'S2' },
        shape: 'crescendo',
        gain: 1.2,
        filter: { highpassHz: 100, lowpassHz: 3000 },
      };
      const parsed = MurmurSchema.safeParse(input);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.edgeMs).toBe(15);
      }
    });

    it('validates via discriminated union', () => {
      const parsedTransient = SoundEventSchema.safeParse({
        kind: 'transient',
        component: 'click',
        sample: 'click-1',
        at: { anchor: 'S1', fraction: 0.4 },
      });
      expect(parsedTransient.success).toBe(true);

      const parsedMurmur = SoundEventSchema.safeParse({
        kind: 'murmur',
        component: 'diastolicMurmur',
        sample: 'murmur-noise',
        from: { anchor: 'S2' },
        to: { anchor: 'nextS1' },
        shape: 'decrescendo',
      });
      expect(parsedMurmur.success).toBe(true);
    });
  });

  describe('SoundSetSchema', () => {
    it('validates complete sound set definition', () => {
      const soundSet = {
        id: 'normal-s1-s2',
        label: 'Normal S1-S2 Heart Sound',
        description: 'Standard physiological heart sounds',
        events: [
          {
            kind: 'transient',
            component: 'S1',
            sample: 's1-apex',
            at: { anchor: 'S1' },
            gain: 1,
            playbackRate: 1,
          },
          {
            kind: 'transient',
            component: 'S2',
            sample: 's2-base',
            at: { anchor: 'S2' },
            gain: 1,
            playbackRate: 1,
          },
        ],
      };

      const parsed = SoundSetSchema.safeParse(soundSet);
      expect(parsed.success).toBe(true);
    });

    it('rejects empty events array', () => {
      const parsed = SoundSetSchema.safeParse({
        id: 'empty',
        label: 'Empty Sound Set',
        events: [],
      });
      expect(parsed.success).toBe(false);
    });
  });
});
