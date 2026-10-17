const test = require('node:test');
const assert = require('node:assert/strict');
const { load, global } = require('./helpers');

load('storage.js', 'timer.js');
const PomodoroTimer = global('PomodoroTimer');
const TimerMode = global('TimerMode');
const DEFAULT_SETTINGS = global('DEFAULT_SETTINGS');

function createTimer(overrides = {}) {
  const events = [];
  const alerts = [];
  globalThis.AudioPlayer = { playAlert: (...args) => alerts.push(args), playTick() {} };
  const timer = new PomodoroTimer({
    settings: { ...DEFAULT_SETTINGS, ...overrides },
    onStateChange: (mode, isRunning) => events.push({ type: 'state', mode, isRunning }),
    onComplete: (mode) => events.push({ type: 'complete', mode })
  });
  return { timer, events, alerts };
}

test.beforeEach((t) => {
  t.mock.timers.enable({ apis: ['setInterval', 'Date'], now: Date.UTC(2026, 0, 1, 9) });
});

test('natural completion is not reported as a pause (no double-counted focus time)', (t) => {
  const { timer, events, alerts } = createTimer({ workTime: 1 });
  timer.start();
  events.length = 0;

  t.mock.timers.tick(61 * 1000);

  const completeAt = events.findIndex(e => e.type === 'complete');
  assert.notEqual(completeAt, -1, 'onComplete must fire');
  const pausedPomodoroBeforeComplete = events
    .slice(0, completeAt)
    .some(e => e.type === 'state' && e.mode === TimerMode.POMODORO && !e.isRunning);
  assert.equal(pausedPomodoroBeforeComplete, false);
  assert.equal(alerts.length, 1, 'alarm plays once');
  assert.equal(timer.mode, TimerMode.SHORT_BREAK);
  assert.equal(timer.cycleCount, 1);
});

test('skipping a session does not play the alarm', () => {
  const { timer, alerts } = createTimer();
  timer.start();
  timer.skip();
  assert.equal(alerts.length, 0);
  assert.equal(timer.mode, TimerMode.SHORT_BREAK);
  assert.equal(timer.cycleCount, 0, 'a skipped pomodoro does not count as a cycle');
});

test('remaining time follows the wall clock, so it stays correct after the machine sleeps', (t) => {
  const { timer } = createTimer({ workTime: 25 });
  timer.start();

  // Suspend: the wall clock jumps 10 minutes while no timer callbacks run
  t.mock.timers.setTime(Date.now() + 10 * 60 * 1000);
  t.mock.timers.tick(250);

  assert.equal(timer.timeLeft, 15 * 60);
});

test('the cycle before the long break switches to a long break', (t) => {
  const { timer } = createTimer({ workTime: 1, cyclesToLongBreak: 2, shortBreakTime: 1 });
  timer.start();
  t.mock.timers.tick(61 * 1000);
  timer.setMode(TimerMode.POMODORO);
  timer.start();
  t.mock.timers.tick(61 * 1000);
  assert.equal(timer.mode, TimerMode.LONG_BREAK);
  assert.equal(timer.cycleCount, 0);
});
