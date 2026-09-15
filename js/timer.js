/**
 * TIMER ENGINE
 * Drift-proof countdown timer with cycle management, Web Notifications, and mode switching.
 */

const TimerMode = {
  POMODORO: 'pomodoro',
  SHORT_BREAK: 'shortBreak',
  LONG_BREAK: 'longBreak'
};

class PomodoroTimer {
  constructor(options = {}) {
    this.settings = options.settings || Storage.getSettings();
    this.mode = TimerMode.POMODORO;
    this.isRunning = false;
    this.cycleCount = 0; // 0 to settings.cyclesToLongBreak

    this.timeLeft = this.settings.workTime * 60;
    this.totalDuration = this.settings.workTime * 60;

    this.timerId = null;
    this.targetEndTime = null;

    // Callbacks
    this.onTick = options.onTick || (() => {});
    this.onStateChange = options.onStateChange || (() => {});
    this.onComplete = options.onComplete || (() => {});

    // Request notification permission if available
    this._initNotifications();
  }

  _initNotifications() {
    if ('Notification' in window && Notification.permission === 'default') {
      // Defer prompt until user interaction if needed
    }
  }

  requestNotificationPermission() {
    if ('Notification' in window && Notification.permission !== 'granted') {
      Notification.requestPermission();
    }
  }

  _sendNotification(title, body) {
    // Layer 1: Native Linux notification bridge via Python backend (libnotify/notify-send)
    if (window.location.protocol.startsWith('http')) {
      fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, body })
      }).catch(() => {});
    }

    // Layer 2: Web Notification API fallback (browser-only mode)
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body: body,
          icon: 'assets/icon.png'
        });
      } catch (e) {
        // Ignore notification errors
      }
    }
  }


  getDurationForMode(mode) {
    switch (mode) {
      case TimerMode.SHORT_BREAK:
        return this.settings.shortBreakTime * 60;
      case TimerMode.LONG_BREAK:
        return this.settings.longBreakTime * 60;
      case TimerMode.POMODORO:
      default:
        return this.settings.workTime * 60;
    }
  }

  setMode(mode, autoStart = false) {
    this.pause();
    this.mode = mode;
    this.totalDuration = this.getDurationForMode(mode);
    this.timeLeft = this.totalDuration;

    this.onStateChange(this.mode, this.isRunning, this.cycleCount);
    this._dispatchTick();

    if (autoStart) {
      this.start();
    }
  }

  start() {
    if (this.isRunning) return;

    this.isRunning = true;
    this.targetEndTime = performance.now() + this.timeLeft * 1000;

    this.timerId = setInterval(() => {
      this._step();
    }, 250); // Poll at 250ms for precise timing without drift

    this.onStateChange(this.mode, this.isRunning, this.cycleCount);
  }

  pause() {
    if (!this.isRunning) return;

    this.isRunning = false;
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }

    this.onStateChange(this.mode, this.isRunning, this.cycleCount);
  }

  toggle() {
    if (this.isRunning) {
      this.pause();
    } else {
      this.start();
    }
  }

  reset() {
    this.pause();
    this.timeLeft = this.totalDuration;
    this._dispatchTick();
    this.onStateChange(this.mode, this.isRunning, this.cycleCount);
  }

  skip() {
    this.pause();
    this._handleSessionFinish(false); // don't log if explicitly skipped early
  }

  _step() {
    const now = performance.now();
    const remainingMs = Math.max(0, this.targetEndTime - now);
    const remainingSec = Math.ceil(remainingMs / 1000);

    if (remainingSec !== this.timeLeft) {
      this.timeLeft = remainingSec;
      this._dispatchTick();

      if (this.settings.tickSound && this.timeLeft > 0) {
        AudioPlayer.playTick();
      }
    }

    if (remainingMs <= 0) {
      this.pause();
      this._handleSessionFinish(true);
    }
  }

  _dispatchTick() {
    const progress = (this.totalDuration - this.timeLeft) / this.totalDuration;
    this.onTick(this.timeLeft, this.totalDuration, Math.min(1, Math.max(0, progress)));
  }

  _handleSessionFinish(completedNaturally) {
    const finishedMode = this.mode;

    // Play alert sound
    AudioPlayer.playAlert(this.settings.alarmSound, this.settings.soundVolume);

    if (completedNaturally) {
      if (finishedMode === TimerMode.POMODORO) {
        this.cycleCount++;
        this._sendNotification('Pomodoro Completed!', 'Great work! Time to take a mindful break.');
      } else {
        this._sendNotification('Break Over!', 'Time to get back into focus!');
      }

      this.onComplete(finishedMode);
    }

    // Determine next mode
    let nextMode = TimerMode.POMODORO;
    let autoStart = false;

    if (finishedMode === TimerMode.POMODORO) {
      if (this.cycleCount >= this.settings.cyclesToLongBreak) {
        nextMode = TimerMode.LONG_BREAK;
        this.cycleCount = 0; // reset cycle
      } else {
        nextMode = TimerMode.SHORT_BREAK;
      }
      autoStart = this.settings.autoStartBreaks;
    } else {
      nextMode = TimerMode.POMODORO;
      autoStart = this.settings.autoStartPomodoros;
    }

    this.setMode(nextMode, autoStart);
  }

  updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    // If currently stopped, refresh total duration
    if (!this.isRunning) {
      this.totalDuration = this.getDurationForMode(this.mode);
      this.timeLeft = this.totalDuration;
      this._dispatchTick();
    }
  }
}
