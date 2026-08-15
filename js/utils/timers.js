/* ==========================================================================
   Timer Formatting & Period Helper Utilities
   ========================================================================== */

/**
 * Formats a raw number of seconds into tabular-monospace MM:SS string
 * @param {number} totalSeconds - Cumulative elapsed seconds
 * @returns {string} Formatted time string (e.g. 05:22 or 47:09)
 */
export function formatTime(totalSeconds) {
  if (isNaN(totalSeconds) || totalSeconds < 0) return '00:00';
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  
  const minStr = mins < 10 ? '0' + mins : mins;
  const secStr = secs < 10 ? '0' + secs : secs;
  
  return `${minStr}:${secStr}`;
}

/**
 * Maps period integer indices to game labels
 * @param {number} period - Game period (1 or 2)
 * @returns {string} Game label
 */
export function formatPeriod(period) {
  if (period === 1) return '1st Half';
  if (period === 2) return '2nd Half';
  return `Half ${period}`;
}
