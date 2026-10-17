/**
 * FOCUS TRACKER - POPOMUS
 * Turns timer start/stop/complete events into credited focus time, so every second
 * of a pomodoro is counted exactly once no matter how often it is paused.
 *
 * Session logs are stored in whole minutes; the sub-minute remainder of each pause is
 * carried over and flushed when the pomodoro ends, so splitting a session into pieces
 * neither loses nor invents minutes.
 */

class FocusTracker {
  constructor() {
    this.runStartLeft = null; // timeLeft (s) when the current focus run started
    this.carrySec = 0;        // focused seconds not yet logged as a whole minute
  }

  get isTracking() {
    return this.runStartLeft !== null;
  }

  /** Call when a focus (pomodoro) run starts or resumes. */
  start(timeLeft) {
    this.runStartLeft = timeLeft;
  }

  /**
   * Ends the current run and returns the seconds focused since `start()`.
   * Returns 0 when no run was being tracked.
   */
  stop(timeLeft) {
    if (this.runStartLeft === null) return 0;
    const elapsed = Math.max(0, this.runStartLeft - Math.max(0, timeLeft));
    this.runStartLeft = null;
    return elapsed;
  }

  /**
   * Converts focused seconds into whole minutes for the session log.
   * With `flush` the leftover is rounded and cleared (end of a pomodoro);
   * otherwise it is carried into the next call.
   */
  takeMinutes(seconds, flush = false) {
    const total = this.carrySec + Math.max(0, seconds);
    const minutes = flush ? Math.round(total / 60) : Math.floor(total / 60);
    this.carrySec = flush ? 0 : total - minutes * 60;
    return minutes;
  }

  reset() {
    this.runStartLeft = null;
    this.carrySec = 0;
  }
}

if (typeof window !== 'undefined') {
  window.FocusTracker = FocusTracker;
}
