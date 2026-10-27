/** Formats an epoch-millisecond timestamp for display, in the learner's locale. */
export function formatAttemptDate(epochMs: number): string {
  return new Date(epochMs).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}
