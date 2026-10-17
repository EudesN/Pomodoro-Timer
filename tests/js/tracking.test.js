const test = require('node:test');
const assert = require('node:assert/strict');
const { load, global } = require('./helpers');

load('tracking.js');
const FocusTracker = global('FocusTracker');

test('stop() returns the seconds focused since start()', () => {
  const tracker = new FocusTracker();
  tracker.start(1500);
  assert.equal(tracker.isTracking, true);
  assert.equal(tracker.stop(1200), 300);
  assert.equal(tracker.isTracking, false);
});

test('stop() without a running focus run credits nothing', () => {
  const tracker = new FocusTracker();
  assert.equal(tracker.stop(100), 0);
  tracker.start(1500);
  tracker.stop(1400);
  assert.equal(tracker.stop(1000), 0, 'a second stop must not count the same run again');
});

test('a pomodoro paused into pieces logs its full length exactly once', () => {
  const tracker = new FocusTracker();
  const workSec = 25 * 60;
  let logged = 0;

  // Focus 12m30s, pause, then resume until the pomodoro completes
  tracker.start(workSec);
  logged += tracker.takeMinutes(tracker.stop(workSec - 750));
  tracker.start(workSec - 750);
  logged += tracker.takeMinutes(tracker.stop(0), true);

  assert.equal(logged, 25);
  assert.equal(tracker.carrySec, 0);
});

test('sub-minute pauses are carried over instead of being dropped', () => {
  const tracker = new FocusTracker();
  assert.equal(tracker.takeMinutes(40), 0);
  assert.equal(tracker.takeMinutes(40), 1);
  assert.equal(tracker.carrySec, 20);
});
