import type { Beat } from './beats';
import { calculateLandmarks, resolvePositionMs } from './cycle';
import { generateMurmurCurve } from './envelope';
import type { ResolvedEvent } from './resolve';
import type { CycleParams, Filter } from './schema';

export interface ScheduledEvent {
  readonly id: string;
  readonly component: string;
  readonly sampleId: string;
  /** Absolute audio-clock time in seconds. */
  readonly time: number;
  readonly gain: number;
  readonly playbackRate: number;
  readonly filter?: Filter | undefined;
  /** Present for sustained samples (murmurs). Looped audio buffer shaped by this gain curve. */
  readonly envelope?:
    | {
        readonly durationMs: number;
        readonly curve: Float32Array;
      }
    | undefined;
}

/**
 * Schedules cardiac cycle events across a specified time window [fromSec, toSec).
 * Gated by beat conduction and atrial contraction state.
 */
export function scheduleEvents(
  beats: readonly Beat[],
  resolvedEvents: readonly ResolvedEvent[],
  fromSec: number,
  toSec: number,
  cycleParams?: CycleParams['systole'],
): readonly ScheduledEvent[] {
  const scheduled: ScheduledEvent[] = [];

  for (const beat of beats) {
    // Non-conducted beat produces a silent gap (no ventricular sounds)
    if (!beat.conducted) {
      continue;
    }

    const landmarks = calculateLandmarks(beat.rr, beat.bpm, cycleParams);

    for (let i = 0; i < resolvedEvents.length; i++) {
      const event = resolvedEvents[i];
      if (!event) {
        continue;
      }

      // Absence of atrial kick (e.g. AFib) suppresses S4 gallop
      if (!beat.atrialKick && event.component === 'S4') {
        continue;
      }

      if (event.kind === 'transient') {
        const offsetMs = resolvePositionMs(event.at, landmarks);
        const eventTimeSec = beat.start + offsetMs / 1000;

        if (eventTimeSec >= fromSec && eventTimeSec < toSec) {
          scheduled.push({
            id: `beat-${beat.index.toString()}-ev-${i.toString()}-${event.component}`,
            component: event.component,
            sampleId: event.sampleId,
            time: eventTimeSec,
            gain: event.gain,
            playbackRate: event.playbackRate,
            ...(event.filter ? { filter: event.filter } : {}),
          });
        }
      } else {
        const startOffsetMs = resolvePositionMs(event.from, landmarks);
        const endOffsetMs = resolvePositionMs(event.to, landmarks);
        const durationMs = Math.max(10, endOffsetMs - startOffsetMs);
        const eventTimeSec = beat.start + startOffsetMs / 1000;

        if (eventTimeSec >= fromSec && eventTimeSec < toSec) {
          const curve = generateMurmurCurve(event.shape, durationMs, event.edgeMs);

          scheduled.push({
            id: `beat-${beat.index.toString()}-ev-${i.toString()}-${event.component}`,
            component: event.component,
            sampleId: event.sampleId,
            time: eventTimeSec,
            gain: event.gain,
            playbackRate: 1.0,
            ...(event.filter ? { filter: event.filter } : {}),
            envelope: {
              durationMs,
              curve,
            },
          });
        }
      }
    }
  }

  // Sort events chronologically by scheduled audio timeline timestamp
  scheduled.sort((a, b) => a.time - b.time);
  return scheduled;
}
