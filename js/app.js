/**
 * APP CONTROLLER - POMUS
 * Coordinates Timer, Tasks, Themes, Audio, Fullscreen, and Dialog Modals.
 * Features drag-and-drop task reordering, active task highlighting,
 * soft tactile button sounds, and multi-theme customization from Inspirations.
 */

document.addEventListener('DOMContentLoaded', () => {
  try {
  // Global DOM Elements
  const body = document.body;
  const btnStats = document.getElementById('btnStats');
  const btnSettings = document.getElementById('btnSettings');
  const btnSoundToggle = document.getElementById('btnSoundToggle');
  const iconSoundOn = document.getElementById('iconSoundOn');
  const iconSoundOff = document.getElementById('iconSoundOff');
  const btnFullscreen = document.getElementById('btnFullscreen');
  const iconFullscreenEnter = document.getElementById('iconFullscreenEnter');
  const iconFullscreenExit = document.getElementById('iconFullscreenExit');
  const btnThemeToggle = document.getElementById('btnThemeToggle');
  const quickThemeMenu = document.getElementById('quickThemeMenu');
  const quickThemeGrid = document.getElementById('quickThemeGrid');
  const quickBackgroundGroup = document.getElementById('quickBackgroundGroup');

  // Timer Elements
  const tabPomodoro = document.getElementById('tabPomodoro');
  const tabShortBreak = document.getElementById('tabShortBreak');
  const tabLongBreak = document.getElementById('tabLongBreak');
  const timerRingProgress = document.getElementById('timerRingProgress');
  const timerDigits = document.getElementById('timerDigits');
  let timerRoller = (typeof DigitRoller === 'function' && timerDigits)
    ? new DigitRoller(timerDigits, {
        enabled: true,
        duration: 350
      })
    : null;
  window.timerRoller = timerRoller;
  const timerModeBadge = document.getElementById('timerModeBadge');
  const cycleText = document.getElementById('cycleText');
  const btnTimerMain = document.getElementById('btnTimerMain');
  const btnTimerMainText = document.getElementById('btnTimerMainText');
  const iconTimerPlay = document.getElementById('iconTimerPlay');
  const iconTimerPause = document.getElementById('iconTimerPause');
  const btnTimerReset = document.getElementById('btnTimerReset');
  const btnTimerSkip = document.getElementById('btnTimerSkip');

  // Tasks Section Elements
  const btnTasksMenu = document.getElementById('btnTasksMenu');
  const tasksDropdownMenu = document.getElementById('tasksDropdownMenu');
  const btnClearCompletedTasks = document.getElementById('btnClearCompletedTasks');
  const btnClearAllTasks = document.getElementById('btnClearAllTasks');
  const tasksList = document.getElementById('tasksList');
  const btnOpenAddTask = document.getElementById('btnOpenAddTask');
  const taskForm = document.getElementById('taskForm');
  const taskTitleInput = document.getElementById('taskTitleInput');
  const taskEstCyclesInput = document.getElementById('taskEstCyclesInput');
  const btnEstPlus = document.getElementById('btnEstPlus');
  const btnEstMinus = document.getElementById('btnEstMinus');
  const btnCancelAddTask = document.getElementById('btnCancelAddTask');

  // Summary Footer Elements
  const summaryActPomos = document.getElementById('summaryActPomos');
  const summaryEstPomos = document.getElementById('summaryEstPomos');
  const summaryFinishClock = document.getElementById('summaryFinishClock');
  const summaryFinishHours = document.getElementById('summaryFinishHours');

  // Modals & Settings Elements
  const settingsDialog = document.getElementById('settingsDialog');
  const statsDialog = document.getElementById('statsDialog');
  const btnCloseSettings = document.getElementById('btnCloseSettings');
  const btnCloseStats = document.getElementById('btnCloseStats');
  const btnSaveSettings = document.getElementById('btnSaveSettings');
  const btnCancelSettings = document.getElementById('btnCancelSettings');
  const settingsThemeGrid = document.getElementById('settingsThemeGrid');
  const settingsBackgroundGroup = document.getElementById('settingsBackgroundGroup');

  const inputWorkTime = document.getElementById('inputWorkTime');
  const inputShortBreak = document.getElementById('inputShortBreak');
  const inputLongBreak = document.getElementById('inputLongBreak');
  const inputCyclesToLong = document.getElementById('inputCyclesToLong');
  const toggleAutoBreaks = document.getElementById('toggleAutoBreaks');
  const toggleAutoPomos = document.getElementById('toggleAutoPomos');
  const toggleIndividualTimers = document.getElementById('toggleIndividualTimers');
  const inputSoundVolume = document.getElementById('inputSoundVolume');
  const volumePercentDisplay = document.getElementById('volumePercentDisplay');
  const selectAlarmSound = document.getElementById('selectAlarmSound');
  const btnPreviewSound = document.getElementById('btnPreviewSound');
  const toggleTickSound = document.getElementById('toggleTickSound');
  const toggleRollingAnimation = document.getElementById('toggleRollingAnimation');

  const customColorSettings = document.getElementById('customColorSettings');
  const colorPomoInput = document.getElementById('colorPomoInput');
  const colorShortInput = document.getElementById('colorShortInput');
  const colorLongInput = document.getElementById('colorLongInput');

  const btnExportData = document.getElementById('btnExportData');
  const inputImportFile = document.getElementById('inputImportFile');

  // Stats Controls
  const periodButtons = document.querySelectorAll('.period-btn');
  const btnClearHistory = document.getElementById('btnClearHistory');

  // App State - Synchronous initial load for instant rendering
  let settings = Storage.getSettings();
  let tasks = Storage.getTasks();
  let activeTaskId = Storage.getActiveTaskId();
  let soundMuted = (settings.soundVolume !== undefined) ? (settings.soundVolume <= 0) : false;
  let timer = null;
  let draggedTaskId = null;
  let editingTaskId = null;

  // Helpers for Individual Task Timers
  function saveCurrentTimerToActiveTask(forcePause = false) {
    if (!settings.individualTimers || !activeTaskId) return;
    const currentTask = tasks.find(t => t.id === activeTaskId);
    if (!currentTask) return;

    if (forcePause && timer && timer.isRunning) {
      timer.pause();
    }

    if (!timer) return;

    currentTask.timerState = {
      mode: timer.mode,
      timeLeft: timer.timeLeft,
      totalDuration: timer.totalDuration,
      cycleCount: timer.cycleCount,
      isRunning: false,
      savedAt: Date.now()
    };

    Storage.saveTasks(tasks);
  }

  function switchActiveTask(newTaskId) {
    if (!newTaskId || newTaskId === activeTaskId) return;

    if (settings.individualTimers) {
      // 1. Pause and save timer state of previous task
      if (activeTaskId) {
        saveCurrentTimerToActiveTask(true);
      }

      // 2. Set new active task
      activeTaskId = newTaskId;
      Storage.setActiveTaskId(activeTaskId);

      // 3. Restore or initialize timer for new task
      const targetTask = tasks.find(t => t.id === newTaskId);
      if (targetTask) {
        if (targetTask.timerState) {
          timer.restoreState(targetTask.timerState);
        } else {
          timer.pause();
          timer.cycleCount = 0;
          timer.setMode(TimerMode.POMODORO, false);
          targetTask.timerState = timer.getState();
          Storage.saveTasks(tasks);
        }
        updateCycleDisplay(timer.cycleCount, true);
      }
    } else {
      activeTaskId = newTaskId;
      Storage.setActiveTaskId(activeTaskId);
    }

    renderTasks();
    updateTaskEstimate();
  }

  function syncVolumeUI(vol) {
    const safeVol = (vol !== undefined && vol !== null) ? Number(vol) : 0.8;
    const pct = Math.round(Math.min(1, Math.max(0, safeVol)) * 100);
    if (inputSoundVolume) inputSoundVolume.value = pct;
    if (volumePercentDisplay) volumePercentDisplay.textContent = `${pct}%`;
  }

  // Synchronize audio mute state & header icon on start
  AudioPlayer.setMuted(soundMuted);
  syncVolumeUI(settings.soundVolume !== undefined ? settings.soundVolume : 0.8);
  if (soundMuted) {
    iconSoundOn.style.display = 'none';
    iconSoundOff.style.display = 'block';
  } else {
    iconSoundOn.style.display = 'block';
    iconSoundOff.style.display = 'none';
  }

  // Apply Initial Theme
  applyTheme();

  // Persist timer state to disk on window unload or hidden visibility
  window.persistAll = function() {
    if (timer) {
      if (settings.individualTimers && activeTaskId) {
        saveCurrentTimerToActiveTask(false);
      }
      Storage.saveTimerState(timer.getState(), true);
    }
    Storage.syncWithDisk(true);
  };

  window.addEventListener('beforeunload', () => window.persistAll());
  window.addEventListener('pagehide', () => window.persistAll());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') window.persistAll();
  });

  // Hydrate data from disk on startup
  Storage.loadFromDisk().then(hydrated => {
    if (hydrated) {
      settings = Storage.getSettings();
      tasks = Storage.getTasks();
      activeTaskId = Storage.getActiveTaskId();
      soundMuted = (settings.soundVolume !== undefined) ? (settings.soundVolume <= 0) : false;
      AudioPlayer.setMuted(soundMuted);
      syncVolumeUI(settings.soundVolume !== undefined ? settings.soundVolume : 0.8);
      iconSoundOn.style.display = soundMuted ? 'none' : 'block';
      iconSoundOff.style.display = soundMuted ? 'block' : 'none';
      applyTheme();
      renderTasks();
      if (timerRoller) timerRoller.setEnabled(settings.rollingAnimation !== false);
      if (timer && !timer.isRunning) {
        if (settings.individualTimers && activeTaskId) {
          const activeTask = tasks.find(t => t.id === activeTaskId);
          if (activeTask && activeTask.timerState) {
            timer.restoreState(activeTask.timerState);
          } else {
            const diskTimerState = Storage.getTimerState();
            if (diskTimerState && diskTimerState.timeLeft > 0) {
              timer.restoreState(diskTimerState);
            } else {
              timer.updateSettings(settings, true);
            }
          }
        } else {
          const diskTimerState = Storage.getTimerState();
          if (diskTimerState && diskTimerState.timeLeft > 0) {
            timer.restoreState(diskTimerState);
          } else {
            timer.updateSettings(settings, true);
          }
        }
        updateCycleDisplay(timer.cycleCount);
      }
        updateTaskEstimate();
    }
  });

  // SVG Progress Ring circumference (radius = 135)
  const RING_RADIUS = 135;
  const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
  timerRingProgress.style.strokeDasharray = `${RING_CIRCUMFERENCE}`;
  timerRingProgress.style.strokeDashoffset = '0';

  // Helper for sound effects on button click (ONLY used for Start/Pause button)
  function playClick() {
    AudioPlayer.playButtonClick();
  }

  // TIMER INITIALIZATION & ROLLING DIGITS
  let lastTimeLeft = null;
  const focusTracker = new FocusTracker();

  /**
   * "On pause or completion" tracking: credits focused seconds to the active task and
   * the session log. `endOfPomodoro` flushes the sub-minute remainder so a pomodoro
   * that was paused and resumed still logs its full length, exactly once.
   */
  function creditFocusTime(elapsedSec, endOfPomodoro = false) {
    const activeTask = tasks.find(t => t.id === activeTaskId);
    const minutes = focusTracker.takeMinutes(elapsedSec, endOfPomodoro);
    if (minutes >= 1) {
      Storage.logCompletedSession(minutes, activeTask ? activeTask.title : 'General Focus');
    }
    if (activeTask && elapsedSec > 0) {
      activeTask.focusedSeconds = (activeTask.focusedSeconds || 0) + elapsedSec;
      activeTask.focusedMinutes = Math.round(activeTask.focusedSeconds / 60);
    }
  }

  const srAnnouncer = document.getElementById('srAnnouncer');
  function announce(message) {
    if (!srAnnouncer) return;
    // Clearing first makes repeated identical messages be read again
    srAnnouncer.textContent = '';
    requestAnimationFrame(() => { srAnnouncer.textContent = message; });
  }

  function formatClock(seconds) {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const sec = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  }

  let lastAnnouncedState = null;

  function refreshCalendar() {
    if (window.Calendar && typeof Calendar.render === 'function') {
      Calendar.render();
    }
  }

  if (timerRoller) {
    timerRoller.setEnabled(settings.rollingAnimation !== false);
  }

  timer = new PomodoroTimer({
    settings: settings,
    onTick: (timeLeft, totalDuration, progress, isInstant = false) => {
      const mins = Math.floor(timeLeft / 60).toString().padStart(2, '0');
      const secs = (timeLeft % 60).toString().padStart(2, '0');
      const formatted = `${mins}:${secs}`;

      if (timerRoller) {
        if (isInstant) {
          timerRoller.setValue(formatted, null, true);
        } else {
          const isFirst = (lastTimeLeft === null);
          const dir = (isFirst || timeLeft < lastTimeLeft) ? 'down' : 'up';
          timerRoller.setValue(formatted, dir, isFirst);
        }
      } else {
        timerDigits.textContent = formatted;
      }
      lastTimeLeft = timeLeft;

      const offset = RING_CIRCUMFERENCE * (1 - progress);
      if (isInstant) {
        timerRingProgress.style.transition = 'none';
        timerRingProgress.style.strokeDashoffset = offset;
        void timerRingProgress.offsetWidth;
        timerRingProgress.style.transition = '';
      } else {
        timerRingProgress.style.strokeDashoffset = offset;
      }

      const modeLabel = timer.mode === TimerMode.POMODORO ? 'Focus' : 'Break';
      document.title = `(${formatted}) ${modeLabel} | Popomus`;
    },
    onStateChange: (mode, isRunning, cycleCount) => {
      body.setAttribute('data-mode', mode);
      Themes.syncMetaThemeColor();

      [tabPomodoro, tabShortBreak, tabLongBreak].forEach(t => t.classList.remove('active'));
      if (mode === TimerMode.POMODORO) tabPomodoro.classList.add('active');
      else if (mode === TimerMode.SHORT_BREAK) tabShortBreak.classList.add('active');
      else if (mode === TimerMode.LONG_BREAK) tabLongBreak.classList.add('active');

      const modeNames = {
        [TimerMode.POMODORO]: 'Pomodoro',
        [TimerMode.SHORT_BREAK]: 'Short Break',
        [TimerMode.LONG_BREAK]: 'Long Break'
      };
      timerModeBadge.textContent = modeNames[mode] || 'Popomus';

      const modeName = modeNames[mode] || 'Timer';
      if (lastAnnouncedState) {
        if (lastAnnouncedState.mode !== mode) {
          announce(`${modeName}, ${formatClock(timer.timeLeft)}${isRunning ? ', running' : ''}`);
        } else if (lastAnnouncedState.isRunning !== isRunning) {
          announce(isRunning ? `${modeName} started` : `${modeName} paused at ${formatClock(timer.timeLeft)}`);
        }
      }
      lastAnnouncedState = { mode, isRunning };

      if (isRunning) {
        btnTimerMain.classList.add('running');
        btnTimerMainText.textContent = 'PAUSE';
        if (iconTimerPlay) iconTimerPlay.style.display = 'none';
        if (iconTimerPause) iconTimerPause.style.display = 'block';
        body.classList.add('timer-running');
        if (mode === TimerMode.POMODORO) {
          focusTracker.start(timer.timeLeft);
        }
      } else {
        btnTimerMain.classList.remove('running');
        btnTimerMainText.textContent = 'START';
        if (iconTimerPlay) iconTimerPlay.style.display = 'block';
        if (iconTimerPause) iconTimerPause.style.display = 'none';
        body.classList.remove('timer-running');

        // A pause (also reset, skip or switching modes mid-run) ends the current focus run
        if (mode === TimerMode.POMODORO && focusTracker.isTracking) {
          const elapsedSec = focusTracker.stop(timer.timeLeft);
          if (elapsedSec > 0 && settings.taskTimeTrackingMode === 'on_pause_or_complete') {
            creditFocusTime(elapsedSec);
            Storage.saveTasks(tasks);
            renderTasks();
            refreshCalendar();
          }
        }

        if (settings.individualTimers && activeTaskId) {
          saveCurrentTimerToActiveTask(false);
          renderTasks();
        }
      }

      updateCycleDisplay(cycleCount);
    },
    onComplete: (finishedMode) => {
      if (finishedMode === TimerMode.POMODORO) {
        const activeTask = tasks.find(t => t.id === activeTaskId);
        const finalRunSec = focusTracker.stop(0);

        if (settings.taskTimeTrackingMode === 'on_pause_or_complete') {
          // Earlier runs of this pomodoro were credited on each pause; add only the last one
          creditFocusTime(finalRunSec, true);
        } else {
          Storage.logCompletedSession(settings.workTime, activeTask ? activeTask.title : 'General Focus');
        }

        if (activeTask) {
          activeTask.actCycles = (activeTask.actCycles || 0) + 1;
          delete activeTask.manuallyUnchecked;

          // Auto-mark completed when target cycles reached
          if (activeTask.actCycles >= (activeTask.estCycles || 1)) {
            activeTask.completed = true;
            activeTask.completedAt = activeTask.completedAt || Date.now();
            activeTask.completedDate = Storage._formatLocalDate(new Date(activeTask.completedAt));
            Storage.recordCompletedTask(activeTask);
            refreshCalendar();
          }
          if (settings.individualTimers && activeTask.timerState) {
            activeTask.timerState.cycleCount = timer.cycleCount;
          }
          Storage.saveTasks(tasks);
          renderTasks();
        }

        if (statsDialog.open) {
          StatsChart.renderChart();
          refreshCalendar();
        }
      }
    }
  });

  window.timer = timer;

  function updateCycleDisplay(cycleCount, isInstant = false) {
    const current = ((cycleCount || 0) % settings.cyclesToLongBreak) + 1;
    const newText = `#${current}`;
    if (cycleText) {
      if (cycleText.textContent !== newText) {
        cycleText.textContent = newText;
        if (!isInstant && settings.rollingAnimation !== false) {
          cycleText.classList.remove('cycle-roll');
          void cycleText.offsetWidth; // trigger reflow
          cycleText.classList.add('cycle-roll');
        } else {
          cycleText.classList.remove('cycle-roll');
        }
      }
    }
  }

  // Initial trigger to paint timer
  let initialRestored = false;
  if (settings.individualTimers && activeTaskId) {
    const activeTask = tasks.find(t => t.id === activeTaskId);
    if (activeTask && activeTask.timerState) {
      initialRestored = timer.restoreState(activeTask.timerState);
    }
  }
  if (!initialRestored) {
    const initialTimerState = Storage.getTimerState();
    if (initialTimerState && timer.restoreState(initialTimerState)) {
      // Restored from disk or localStorage
    } else {
      timer.reset();
    }
  }
  updateCycleDisplay(timer.cycleCount);

  // TIMER CONTROLS & SOUNDS
  // Start/Pause is the ONLY button with tactile sound feedback per user request
  btnTimerMain.addEventListener('click', () => {
    playClick();
    timer.requestNotificationPermission();
    timer.toggle();
  });

  btnTimerReset.addEventListener('click', () => {
    timer.reset();
    if (settings.individualTimers) {
      saveCurrentTimerToActiveTask(false);
      renderTasks();
    }
  });

  btnTimerSkip.addEventListener('click', () => {
    timer.skip();
    if (settings.individualTimers) {
      saveCurrentTimerToActiveTask(false);
      renderTasks();
    }
  });

  tabPomodoro.addEventListener('click', () => {
    timer.setMode(TimerMode.POMODORO);
    if (settings.individualTimers) {
      saveCurrentTimerToActiveTask(false);
      renderTasks();
    }
  });
  tabShortBreak.addEventListener('click', () => {
    timer.setMode(TimerMode.SHORT_BREAK);
    if (settings.individualTimers) {
      saveCurrentTimerToActiveTask(false);
      renderTasks();
    }
  });
  tabLongBreak.addEventListener('click', () => {
    timer.setMode(TimerMode.LONG_BREAK);
    if (settings.individualTimers) {
      saveCurrentTimerToActiveTask(false);
      renderTasks();
    }
  });

  // Sound toggle button in header
  let lastAudibleVolume = settings.soundVolume > 0 ? settings.soundVolume : 0.8;
  btnSoundToggle.addEventListener('click', () => {
    soundMuted = !soundMuted;
    if (soundMuted) {
      if (settings.soundVolume > 0) lastAudibleVolume = settings.soundVolume;
      settings.soundVolume = 0;
      iconSoundOn.style.display = 'none';
      iconSoundOff.style.display = 'block';
    } else {
      settings.soundVolume = lastAudibleVolume;
      iconSoundOn.style.display = 'block';
      iconSoundOff.style.display = 'none';
    }
    syncVolumeUI(settings.soundVolume);
    AudioPlayer.setMuted(soundMuted);
    Storage.saveSettings(settings);
    if (timer) {
      timer.settings.soundVolume = settings.soundVolume;
    }
  });

  // Volume slider in settings modal
  if (inputSoundVolume) {
    inputSoundVolume.addEventListener('input', () => {
      const pct = parseInt(inputSoundVolume.value, 10);
      const vol = pct / 100;
      if (volumePercentDisplay) volumePercentDisplay.textContent = `${pct}%`;
      settings.soundVolume = vol;
      soundMuted = (vol <= 0);
      AudioPlayer.setMuted(soundMuted);
      if (soundMuted) {
        iconSoundOn.style.display = 'none';
        iconSoundOff.style.display = 'block';
      } else {
        iconSoundOn.style.display = 'block';
        iconSoundOff.style.display = 'none';
      }
      Storage.saveSettings(settings);
      if (timer) {
        timer.settings.soundVolume = settings.soundVolume;
      }
    });
  }

  // FULLSCREEN HANDLER
  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }

  btnFullscreen.addEventListener('click', toggleFullscreen);

  document.addEventListener('fullscreenchange', () => {
    const isFull = !!document.fullscreenElement;
    body.classList.toggle('is-fullscreen', isFull);
    iconFullscreenEnter.style.display = isFull ? 'none' : 'block';
    iconFullscreenExit.style.display = isFull ? 'block' : 'none';
  });

  // THEMES & COLOR SWITCHING (see js/themes.js)

  /**
   * Paints the UI with the theme described by `source` (defaults to saved settings).
   * Passing a draft object previews a theme without persisting it.
   */
  function applyTheme(source = settings) {
    const key = Themes.apply(source.theme, source, source.themeBackground);
    if (source === settings) {
      settings.theme = key;
      settings.themeBackground = Themes.resolveBackground(settings.themeBackground);
    }
    const currentMode = (timer && timer.mode) ? timer.mode : 'pomodoro';
    body.setAttribute('data-mode', currentMode);
    Themes.syncMetaThemeColor();
    renderQuickThemeMenu();
  }

  function themeOptionsHtml(activeKey, source, itemClass, role) {
    const entries = Object.entries(THEME_PRESETS).map(([key, preset]) => ({ key, name: preset.name, colors: preset }));
    entries.push({ key: 'custom', name: 'Custom', colors: Themes.colorsFor('custom', source) });
    return entries.map(({ key, name, colors }) => {
      const active = key === activeKey;
      return `
        <button type="button" class="${itemClass} ${active ? 'active' : ''}" data-theme="${key}" role="${role}" aria-checked="${active}">
          <span class="theme-swatch ${key === 'custom' ? 'is-custom' : ''}" aria-hidden="true">${Themes.swatchHtml(colors)}</span>
          <span class="theme-option-name">${escapeHtml(name)}</span>
          <svg class="theme-option-check" viewBox="0 0 24 24" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg>
        </button>
      `;
    }).join('');
  }

  function backgroundOptionsHtml(activeBg) {
    return Object.entries(Themes.backgrounds).map(([key, bg]) => `
      <button type="button" class="segmented-btn ${key === activeBg ? 'active' : ''}" data-background="${key}" role="radio" aria-checked="${key === activeBg}">${bg.name}</button>
    `).join('');
  }

  function renderQuickThemeMenu() {
    if (!quickThemeGrid) return;
    quickThemeGrid.innerHTML = themeOptionsHtml(Themes.resolveKey(settings.theme), settings, 'theme-palette-btn', 'menuitemradio');
    quickBackgroundGroup.innerHTML = backgroundOptionsHtml(Themes.resolveBackground(settings.themeBackground));
  }

  function positionQuickThemeMenu() {
    const rect = btnThemeToggle.getBoundingClientRect();
    const menuWidth = quickThemeMenu.offsetWidth || 280;
    const left = Math.min(Math.max(8, rect.right - menuWidth), window.innerWidth - menuWidth - 8);
    quickThemeMenu.style.top = `${rect.bottom + 8}px`;
    quickThemeMenu.style.left = `${left}px`;
  }

  function setQuickThemeMenuOpen(open) {
    quickThemeMenu.hidden = !open;
    btnThemeToggle.setAttribute('aria-expanded', String(open));
    if (open) positionQuickThemeMenu();
  }

  btnThemeToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    setQuickThemeMenuOpen(quickThemeMenu.hidden);
  });

  quickThemeMenu.addEventListener('click', (e) => {
    e.stopPropagation();
    const themeBtn = e.target.closest('[data-theme]');
    const bgBtn = e.target.closest('[data-background]');
    if (themeBtn) {
      settings.theme = themeBtn.dataset.theme;
    } else if (bgBtn) {
      settings.themeBackground = bgBtn.dataset.background;
    } else if (e.target.closest('#btnQuickThemeMore')) {
      setQuickThemeMenuOpen(false);
      openSettingsDialog();
      document.getElementById('settingsAppearance')?.scrollIntoView({ block: 'start' });
      return;
    } else {
      return;
    }
    applyTheme();
    Storage.saveSettings(settings);
  });

  window.addEventListener('resize', () => {
    if (!quickThemeMenu.hidden) positionQuickThemeMenu();
  });

  document.addEventListener('click', (e) => {
    if (!quickThemeMenu.hidden && !quickThemeMenu.contains(e.target) && !btnThemeToggle.contains(e.target)) {
      setQuickThemeMenuOpen(false);
    }
    if (!tasksDropdownMenu.contains(e.target) && !btnTasksMenu.contains(e.target)) {
      tasksDropdownMenu.style.display = 'none';
    }
  });

  // TASKS MANAGEMENT: Drag & Drop + Active Task Highlight + Expandable Edit Drawer
  function renderTasks() {
    tasksList.innerHTML = '';

    if (tasks.length === 0) {
      tasksList.innerHTML = `
        <div class="empty-tasks-state">
          No tasks yet. Click "Add Task" to plan your focus.
        </div>
      `;
        updateTaskEstimate();
      return;
    }

    let tasksAutoCompleted = false;
    tasks.forEach(task => {
      const act = task.actCycles || 0;
      const est = Math.max(1, task.estCycles || 1);
      // Auto-mark completed when target cycles reached
      if (act >= est && !task.completed && !task.manuallyUnchecked) {
        task.completed = true;
        task.completedAt = task.completedAt || Date.now();
        task.completedDate = Storage._formatLocalDate(new Date(task.completedAt));
        Storage.recordCompletedTask(task);
        tasksAutoCompleted = true;
      }
      const isSelected = task.id === activeTaskId;
      const isCompleted = !!task.completed;
      const isEditing = task.id === editingTaskId;

      let timerChipHtml = '';
      if (settings.individualTimers) {
        let taskTimeLeft;
        let taskMode = TimerMode.POMODORO;
        if (task.timerState && typeof task.timerState.timeLeft === 'number') {
          taskTimeLeft = task.timerState.timeLeft;
          taskMode = task.timerState.mode || TimerMode.POMODORO;
        } else {
          taskTimeLeft = (settings.workTime || 25) * 60;
          taskMode = TimerMode.POMODORO;
        }
        const chipMins = Math.floor(taskTimeLeft / 60).toString().padStart(2, '0');
        const chipSecs = (taskTimeLeft % 60).toString().padStart(2, '0');
        const chipFormatted = `${chipMins}:${chipSecs}`;
        const isBreak = (taskMode !== TimerMode.POMODORO);
        const titleMode = isBreak ? (taskMode === TimerMode.LONG_BREAK ? 'Long Break' : 'Short Break') : 'Pomodoro';

        timerChipHtml = `
          <span id="taskTimerChip_${task.id}" class="task-timer-chip ${isBreak ? 'is-break' : ''}" data-action="select" title="${titleMode}: ${chipFormatted}">
            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"></circle><polyline points="12 7 12 12 15 14"></polyline></svg>
            <span class="task-timer-chip-text">${chipFormatted}</span>
          </span>
        `;
      }

      let timeSpentHtml = '';
      const totalSecs = task.focusedSeconds || ((task.focusedMinutes || 0) * 60);
      if (totalSecs > 0) {
        const m = Math.round(totalSecs / 60);
        const h = Math.floor(m / 60);
        const remM = m % 60;
        const timeFormatted = h > 0 ? (remM > 0 ? `${h}h ${remM}m` : `${h}h`) : `${m}m`;
        timeSpentHtml = `<span class="task-focused-time-chip" title="Accumulated focus time on this task">${timeFormatted}</span>`;
      }

      const taskEl = document.createElement('div');
      taskEl.className = `task-item ${isSelected ? 'active-focus' : ''} ${isCompleted ? 'completed' : ''} ${isEditing ? 'is-editing' : ''}`;
      taskEl.dataset.id = task.id;
      taskEl.setAttribute('draggable', 'true');
      taskEl.setAttribute('role', 'listitem');
      taskEl.tabIndex = 0;
      taskEl.setAttribute('aria-current', isSelected ? 'true' : 'false');
      taskEl.setAttribute('aria-label', `${task.title}, ${act} of ${est} pomodoros${isCompleted ? ', completed' : ''}${isSelected ? ', active' : ''}`);

      taskEl.innerHTML = `
        <div class="task-item-left">
          <div class="task-drag-handle" aria-hidden="true">
            <svg viewBox="0 0 24 24"><circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/></svg>
          </div>
          <button class="task-check-circle" data-action="toggle" aria-label="${isCompleted ? 'Mark as incomplete' : 'Mark as completed'}">
            <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
          </button>
          <span class="task-title-text" data-action="select">${escapeHtml(task.title)}</span>
          ${isSelected ? '<span class="task-active-badge-pill">ACTIVE</span>' : ''}
        </div>

        <div class="task-item-right">
          ${timeSpentHtml}
          ${timerChipHtml}
          <span class="task-pomos-counter" data-action="select">${act} / ${est}</span>
          <button class="task-card-menu-btn ${isEditing ? 'active' : ''}" data-action="menu" aria-label="${isEditing ? 'Close options' : 'Task options'}">
            <svg viewBox="0 0 24 24"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
          </button>
        </div>
      `;

      // Drag & Drop event listeners
      taskEl.addEventListener('dragstart', (e) => {
        draggedTaskId = task.id;
        e.dataTransfer.setData('text/plain', task.id);
        e.dataTransfer.effectAllowed = 'move';
        taskEl.classList.add('is-dragging');
      });

      taskEl.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const rect = taskEl.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        const isBelow = e.clientY > midY;
        taskEl.classList.toggle('drag-over-above', !isBelow);
        taskEl.classList.toggle('drag-over-below', isBelow);
      });

      taskEl.addEventListener('dragleave', () => {
        taskEl.classList.remove('drag-over-above', 'drag-over-below');
      });

      taskEl.addEventListener('drop', (e) => {
        e.preventDefault();
        taskEl.classList.remove('drag-over-above', 'drag-over-below');
        const fromId = e.dataTransfer.getData('text/plain') || draggedTaskId;
        const toId = task.id;

        if (fromId && toId && fromId !== toId) {
          const fromIndex = tasks.findIndex(t => t.id === fromId);
          const toIndex = tasks.findIndex(t => t.id === toId);

          if (fromIndex !== -1 && toIndex !== -1) {
            const rect = taskEl.getBoundingClientRect();
            const isBelow = e.clientY > (rect.top + rect.height / 2);
            const [movedItem] = tasks.splice(fromIndex, 1);
            const targetIndex = tasks.findIndex(t => t.id === toId);
            const insertIndex = isBelow ? targetIndex + 1 : targetIndex;
            tasks.splice(insertIndex, 0, movedItem);

            Storage.saveTasks(tasks);
            updateTaskEstimate();
            renderTasks();
          }
        }
      });

      taskEl.addEventListener('dragend', () => {
        taskEl.classList.remove('is-dragging');
        document.querySelectorAll('.task-item').forEach(el => {
          el.classList.remove('drag-over-above', 'drag-over-below', 'is-dragging');
        });
        draggedTaskId = null;
      });

      tasksList.appendChild(taskEl);

      // Expandable inline edit drawer directly beneath this task
      if (isEditing) {
        const drawerEl = document.createElement('div');
        drawerEl.className = 'task-edit-drawer';
        drawerEl.dataset.id = task.id;
        drawerEl.innerHTML = `
          <div class="task-edit-drawer-inner">
            <div class="task-edit-field-group">
              <label class="task-edit-field-label">Task Title</label>
              <input type="text" class="task-edit-title-input" value="${escapeHtml(task.title)}" data-edit-title autocomplete="off">
            </div>
            <div class="task-edit-cycles-grid">
              <div class="task-edit-cycle-col">
                <span class="task-edit-field-label">Completed Pomos</span>
                <div class="est-stepper-wrap">
                  <input type="number" class="est-number-input" min="0" max="99" value="${act}" data-edit-act>
                  <button type="button" class="est-stepper-btn" data-edit-action="act-plus" aria-label="Increase completed">+</button>
                  <button type="button" class="est-stepper-btn" data-edit-action="act-minus" aria-label="Decrease completed">-</button>
                </div>
              </div>
              <div class="task-edit-cycle-col">
                <span class="task-edit-field-label">Est Pomodoros</span>
                <div class="est-stepper-wrap">
                  <input type="number" class="est-number-input" min="1" max="99" value="${est}" data-edit-est>
                  <button type="button" class="est-stepper-btn" data-edit-action="est-plus" aria-label="Increase estimated">+</button>
                  <button type="button" class="est-stepper-btn" data-edit-action="est-minus" aria-label="Decrease estimated">-</button>
                </div>
              </div>
            </div>
            <div class="task-edit-actions">
              <button type="button" class="btn-edit-danger" data-edit-action="delete" aria-label="Delete task">
                <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                <span>Delete</span>
              </button>
              <div class="task-edit-btn-group">
                <button type="button" class="btn-edit-cancel" data-edit-action="cancel">Cancel</button>
                <button type="button" class="btn-edit-save" data-edit-action="save">Save</button>
              </div>
            </div>
          </div>
        `;
        tasksList.appendChild(drawerEl);

        setTimeout(() => {
          const input = drawerEl.querySelector('[data-edit-title]');
          if (input) {
            input.focus();
            input.select();
          }
        }, 15);
      }
    });

    if (tasksAutoCompleted) {
      Storage.saveTasks(tasks);
      if (window.Calendar && typeof Calendar.render === 'function') {
        Calendar.render();
      }
    }

    updateTaskEstimate();
  }

  /**
   * Recalculates finish time estimation dynamically whenever tasks change
   * or when time configurations (workTime) are altered.
   */
  function updateTaskEstimate(overrideWorkTime = null) {
    let actSum = 0;
    let estSum = 0;
    let remainingCycles = 0;

    tasks.forEach(t => {
      actSum += (t.actCycles || 0);
      estSum += (t.estCycles || 1);
      if (!t.completed) {
        remainingCycles += Math.max(0, (t.estCycles || 1) - (t.actCycles || 0));
      }
    });

    summaryActPomos.textContent = actSum;
    summaryEstPomos.textContent = estSum;

    const workMins = (overrideWorkTime !== null && overrideWorkTime > 0)
      ? overrideWorkTime
      : (settings.workTime || 25);
    const totalMinutes = remainingCycles * workMins;
    const hoursDecimal = (totalMinutes / 60).toFixed(1);

    summaryFinishHours.textContent = `(${hoursDecimal}h)`;

    if (remainingCycles === 0) {
      summaryFinishClock.textContent = '--:--';
      summaryFinishHours.textContent = '(0.0h)';
      return;
    }

    const now = new Date();
    const finishDate = new Date(now.getTime() + totalMinutes * 60000);
    const finishHours = finishDate.getHours().toString().padStart(2, '0');
    const finishMinutes = finishDate.getMinutes().toString().padStart(2, '0');
    summaryFinishClock.textContent = `${finishHours}:${finishMinutes}`;
  }

  // Add Task Toggle (Open / Cancel)
  btnOpenAddTask.addEventListener('click', () => {
    btnOpenAddTask.style.display = 'none';
    taskForm.style.display = 'block';
    taskTitleInput.value = '';
    taskEstCyclesInput.value = '1';
    taskTitleInput.focus();
  });

  btnCancelAddTask.addEventListener('click', () => {
    taskForm.style.display = 'none';
    btnOpenAddTask.style.display = 'flex';
  });

  btnEstPlus.addEventListener('click', () => {
    const v = parseInt(taskEstCyclesInput.value, 10) || 1;
    taskEstCyclesInput.value = v + 1;
  });

  btnEstMinus.addEventListener('click', () => {
    const v = parseInt(taskEstCyclesInput.value, 10) || 1;
    taskEstCyclesInput.value = Math.max(1, v - 1);
  });

  // Submit new task
  taskForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = taskTitleInput.value.trim();
    const est = parseInt(taskEstCyclesInput.value, 10) || 1;

    if (!title) return;

    const newTask = {
      id: 'task_' + Date.now(),
      title: title,
      estCycles: Math.max(1, est),
      actCycles: 0,
      completed: false,
      createdAt: Date.now()
    };

    if (settings.individualTimers) {
      newTask.timerState = {
        mode: TimerMode.POMODORO,
        timeLeft: (settings.workTime || 25) * 60,
        totalDuration: (settings.workTime || 25) * 60,
        cycleCount: 0,
        isRunning: false,
        savedAt: Date.now()
      };
    }

    tasks.push(newTask);

    if (!activeTaskId) {
      activeTaskId = newTask.id;
      Storage.setActiveTaskId(activeTaskId);
      if (settings.individualTimers && newTask.timerState) {
        timer.restoreState(newTask.timerState);
      }
    }

    Storage.saveTasks(tasks);
    renderTasks();

    taskForm.style.display = 'none';
    btnOpenAddTask.style.display = 'flex';
  });

  // Tasks Header Dropdown
  btnTasksMenu.addEventListener('click', (e) => {
    e.stopPropagation();
    const isVisible = tasksDropdownMenu.style.display === 'block';
    tasksDropdownMenu.style.display = isVisible ? 'none' : 'block';
  });

  btnClearCompletedTasks.addEventListener('click', () => {
    // Preserve completed tasks in all-time history before clearing active list
    tasks.forEach(t => {
      if (t.completed) {
        t.completedAt = t.completedAt || Date.now();
        t.completedDate = t.completedDate || Storage._formatLocalDate(new Date(t.completedAt));
        Storage.recordCompletedTask(t);
      }
    });
    const activeWasDeleted = tasks.some(t => t.id === activeTaskId && t.completed);
    tasks = tasks.filter(t => !t.completed);
    if (activeWasDeleted || !tasks.some(t => t.id === activeTaskId)) {
      activeTaskId = tasks.length > 0 ? tasks[0].id : null;
      Storage.setActiveTaskId(activeTaskId);
      if (settings.individualTimers) {
        if (activeTaskId) {
          const nextTask = tasks.find(t => t.id === activeTaskId);
          if (nextTask && nextTask.timerState) {
            timer.restoreState(nextTask.timerState);
          } else {
            timer.pause();
            timer.setMode(TimerMode.POMODORO, false);
          }
        } else {
          timer.pause();
          timer.setMode(TimerMode.POMODORO, false);
        }
      }
    }
    Storage.saveTasks(tasks);
    updateTaskEstimate();
    renderTasks();
    tasksDropdownMenu.style.display = 'none';
  });

  btnClearAllTasks.addEventListener('click', async () => {
    tasksDropdownMenu.style.display = 'none';
    const confirmed = await Confirm.ask({
      title: 'Delete all tasks?',
      message: 'Every task in your list will be removed. Completed tasks stay in the calendar history.',
      confirmText: 'Delete All',
      danger: true
    });
    if (confirmed) {
      tasks = [];
      activeTaskId = null;
      editingTaskId = null;
      Storage.setActiveTaskId(null);
      if (settings.individualTimers) {
        timer.pause();
        timer.setMode(TimerMode.POMODORO, false);
      }
      Storage.saveTasks(tasks);
      updateTaskEstimate();
      renderTasks();
    }
    tasksDropdownMenu.style.display = 'none';
  });

  // Task item and drawer click delegations
  tasksList.addEventListener('click', (e) => {
    // 1. Handle clicks inside an inline edit drawer
    const drawer = e.target.closest('.task-edit-drawer');
    if (drawer) {
      e.stopPropagation();
      const taskId = drawer.dataset.id;
      const task = tasks.find(t => t.id === taskId);
      if (!task) return;

      const actionBtn = e.target.closest('[data-edit-action]');
      if (!actionBtn) return;
      const editAction = actionBtn.dataset.editAction;

      const titleInput = drawer.querySelector('[data-edit-title]');
      const actInput = drawer.querySelector('[data-edit-act]');
      const estInput = drawer.querySelector('[data-edit-est]');

      if (editAction === 'act-plus') {
        const cur = parseInt(actInput.value, 10) || 0;
        actInput.value = cur + 1;
      } else if (editAction === 'act-minus') {
        const cur = parseInt(actInput.value, 10) || 0;
        actInput.value = Math.max(0, cur - 1);
      } else if (editAction === 'est-plus' || editAction === 'plus') {
        const cur = parseInt(estInput.value, 10) || 1;
        estInput.value = cur + 1;
      } else if (editAction === 'est-minus' || editAction === 'minus') {
        const cur = parseInt(estInput.value, 10) || 1;
        estInput.value = Math.max(1, cur - 1);
      } else if (editAction === 'cancel') {
        editingTaskId = null;
        renderTasks();
      } else if (editAction === 'delete') {
        const wasActive = (activeTaskId === taskId);
        tasks = tasks.filter(t => t.id !== taskId);
        if (wasActive) {
          activeTaskId = tasks.length > 0 ? tasks[0].id : null;
          Storage.setActiveTaskId(activeTaskId);
          if (settings.individualTimers) {
            if (activeTaskId) {
              const nextTask = tasks.find(t => t.id === activeTaskId);
              if (nextTask && nextTask.timerState) {
                timer.restoreState(nextTask.timerState);
              } else {
                timer.pause();
                timer.setMode(TimerMode.POMODORO, false);
              }
            } else {
              timer.pause();
              timer.setMode(TimerMode.POMODORO, false);
            }
          }
        }
        editingTaskId = null;
        Storage.saveTasks(tasks);
        updateTaskEstimate();
        renderTasks();
      } else if (editAction === 'save') {
        const trimmed = titleInput ? titleInput.value.trim() : '';
        const parsedAct = actInput ? parseInt(actInput.value, 10) : 0;
        const parsedEst = estInput ? parseInt(estInput.value, 10) : 1;
        if (trimmed) {
          task.title = trimmed;
        }
        task.actCycles = Math.max(0, isNaN(parsedAct) ? 0 : parsedAct);
        task.estCycles = Math.max(1, isNaN(parsedEst) ? 1 : parsedEst);
        if (task.actCycles >= task.estCycles && !task.completed) {
          task.completed = true;
          task.completedAt = task.completedAt || Date.now();
          task.completedDate = Storage._formatLocalDate(new Date(task.completedAt));
          Storage.recordCompletedTask(task);
          if (window.Calendar && typeof Calendar.render === 'function') {
            Calendar.render();
          }
        }
        editingTaskId = null;
        Storage.saveTasks(tasks);
            updateTaskEstimate();
        renderTasks();
      }
      return;
    }

    // 2. Handle clicks on task card itself
    const taskItem = e.target.closest('.task-item');
    if (!taskItem) return;
    const taskId = taskItem.dataset.id;
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const actionBtn = e.target.closest('[data-action]');
    const action = actionBtn ? actionBtn.dataset.action : 'select';

    if (action === 'toggle') {
      e.stopPropagation();
      task.completed = !task.completed;
      task.manuallyUnchecked = !task.completed;
      if (task.completed) {
        task.completedAt = Date.now();
        task.completedDate = Storage._formatLocalDate(new Date(task.completedAt));
        Storage.recordCompletedTask(task);
      } else {
        Storage.removeCompletedTaskFromHistory(task.id);
      }
      Storage.saveTasks(tasks);
      updateTaskEstimate();
      renderTasks();
      if (window.Calendar && typeof Calendar.render === 'function') {
        Calendar.render();
      }
    } else if (action === 'menu') {
      e.stopPropagation();
      editingTaskId = (editingTaskId === taskId) ? null : taskId;
      renderTasks();
    } else {
      // Default: select task
      switchActiveTask(taskId);
    }
  });

  // Handle keyboard submission (Enter / Escape) inside inline edit drawer
  function moveTask(taskId, delta) {
    const from = tasks.findIndex(t => t.id === taskId);
    const to = from + delta;
    if (from === -1 || to < 0 || to >= tasks.length) return;
    const [moved] = tasks.splice(from, 1);
    tasks.splice(to, 0, moved);
    Storage.saveTasks(tasks);
    renderTasks();
    tasksList.querySelector(`.task-item[data-id="${CSS.escape(taskId)}"]`)?.focus();
    announce(`${moved.title} moved to position ${to + 1} of ${tasks.length}`);
  }

  tasksList.addEventListener('keydown', (e) => {
    // Keyboard support on the task card itself (not its inner buttons)
    if (e.target.classList.contains('task-item')) {
      const taskId = e.target.dataset.id;
      if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault();
        moveTask(taskId, e.key === 'ArrowUp' ? -1 : 1);
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        switchActiveTask(taskId);
        tasksList.querySelector(`.task-item[data-id="${CSS.escape(taskId)}"]`)?.focus();
      } else if (!e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault();
        const items = [...tasksList.querySelectorAll('.task-item')];
        const idx = items.indexOf(e.target);
        items[idx + (e.key === 'ArrowUp' ? -1 : 1)]?.focus();
      }
      return;
    }
    if (e.target.matches('[data-edit-title]')) {
      if (e.key === 'Enter') {
        e.preventDefault();
        const drawer = e.target.closest('.task-edit-drawer');
        const saveBtn = drawer?.querySelector('[data-edit-action="save"]');
        if (saveBtn) saveBtn.click();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        editingTaskId = null;
        renderTasks();
      }
    }
  });

  // MODALS & DIALOG MANAGEMENT

  // Appearance draft: edited live in the settings dialog, persisted only on Save
  let themeDraft = null;
  let settingsSaved = false;

  function previewThemeDraft() {
    applyTheme({ ...settings, ...themeDraft });
    renderSettingsAppearance();
  }

  function renderSettingsAppearance() {
    const draftSource = { ...settings, ...themeDraft };
    settingsThemeGrid.innerHTML = themeOptionsHtml(themeDraft.theme, draftSource, 'theme-card-option', 'radio');
    settingsBackgroundGroup.innerHTML = backgroundOptionsHtml(themeDraft.themeBackground);
    customColorSettings.hidden = themeDraft.theme !== 'custom';
    [
      [colorPomoInput, themeDraft.customColorPomo],
      [colorShortInput, themeDraft.customColorShort],
      [colorLongInput, themeDraft.customColorLong]
    ].forEach(([input, value]) => {
      if (input.value !== value) input.value = value;
      const hexLabel = document.querySelector(`[data-hex-for="${input.id}"]`);
      if (hexLabel) hexLabel.textContent = value.toUpperCase();
    });
  }

  settingsThemeGrid.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-theme]');
    if (!btn) return;
    const chosen = btn.dataset.theme;
    // First switch to Custom starts from the theme the user was on instead of arbitrary defaults
    if (chosen === 'custom' && themeDraft.theme !== 'custom' && !settings.customColorsEdited) {
      const base = Themes.colorsFor(themeDraft.theme, settings);
      themeDraft.customColorPomo = base.pomo;
      themeDraft.customColorShort = base.short;
      themeDraft.customColorLong = base.long;
    }
    themeDraft.theme = chosen;
    previewThemeDraft();
  });

  settingsBackgroundGroup.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-background]');
    if (!btn) return;
    themeDraft.themeBackground = btn.dataset.background;
    previewThemeDraft();
  });

  [
    [colorPomoInput, 'customColorPomo'],
    [colorShortInput, 'customColorShort'],
    [colorLongInput, 'customColorLong']
  ].forEach(([input, key]) => {
    input.addEventListener('input', () => {
      themeDraft[key] = input.value;
      themeDraft.customColorsEdited = true;
      previewThemeDraft();
    });
  });

  btnSettings.addEventListener('click', () => openSettingsDialog());

  function openSettingsDialog() {
    inputWorkTime.value = settings.workTime;
    inputShortBreak.value = settings.shortBreakTime;
    inputLongBreak.value = settings.longBreakTime;
    inputCyclesToLong.value = settings.cyclesToLongBreak;
    toggleAutoBreaks.checked = settings.autoStartBreaks;
    toggleAutoPomos.checked = settings.autoStartPomodoros;
    if (toggleIndividualTimers) {
      toggleIndividualTimers.checked = !!settings.individualTimers;
    }
    const selectTaskTimeTracking = document.getElementById('selectTaskTimeTracking');
    if (selectTaskTimeTracking) {
      selectTaskTimeTracking.value = settings.taskTimeTrackingMode || 'on_complete';
    }
    selectAlarmSound.value = settings.alarmSound;
    CustomSelect.refreshAll();
    toggleTickSound.checked = !!settings.tickSound;
    if (toggleRollingAnimation) toggleRollingAnimation.checked = (settings.rollingAnimation !== false);
    syncVolumeUI(settings.soundVolume !== undefined ? settings.soundVolume : 0.8);

    const customColors = Themes.colorsFor('custom', settings);
    themeDraft = {
      theme: Themes.resolveKey(settings.theme),
      themeBackground: Themes.resolveBackground(settings.themeBackground),
      customColorPomo: customColors.pomo,
      customColorShort: customColors.short,
      customColorLong: customColors.long,
      customColorsEdited: !!settings.customColorsEdited
    };
    renderSettingsAppearance();

    settingsSaved = false;
    if (!settingsDialog.open) settingsDialog.showModal();
  }

  // Closing without saving (X, Cancel, Esc or backdrop) discards the appearance preview
  settingsDialog.addEventListener('close', () => {
    if (!settingsSaved) {
      applyTheme();
      updateTaskEstimate();
    }
  });

  // Dynamic estimate update when timer duration setting is edited
  inputWorkTime.addEventListener('input', () => {
    const v = parseInt(inputWorkTime.value, 10);
    if (v && v > 0) {
      updateTaskEstimate(v);
    }
  });

  // Sound Preview Button (safely passes isPreview = true using current volume slider)
  btnPreviewSound.addEventListener('click', () => {
    const selectedSound = selectAlarmSound.value;
    const currentVol = inputSoundVolume ? (parseInt(inputSoundVolume.value, 10) / 100) : (settings.soundVolume ?? 0.8);
    AudioPlayer.playAlert(selectedSound, currentVol > 0 ? currentVol : 0.8, true);
  });

  btnSaveSettings.addEventListener('click', () => {
    const workVal = Math.max(1, parseInt(inputWorkTime.value, 10) || 25);
    const shortVal = Math.max(1, parseInt(inputShortBreak.value, 10) || 5);
    const longVal = Math.max(1, parseInt(inputLongBreak.value, 10) || 15);
    const cyclesVal = Math.max(1, parseInt(inputCyclesToLong.value, 10) || 4);

    const volPct = inputSoundVolume ? parseInt(inputSoundVolume.value, 10) : 80;
    const volVal = Math.min(1, Math.max(0, volPct / 100));
    const individualVal = toggleIndividualTimers ? toggleIndividualTimers.checked : false;
    const individualChanged = (settings.individualTimers !== individualVal);
    const selectTaskTimeTracking = document.getElementById('selectTaskTimeTracking');
    const taskTrackingModeVal = selectTaskTimeTracking ? selectTaskTimeTracking.value : (settings.taskTimeTrackingMode || 'on_complete');

    settings = {
      ...settings,
      workTime: workVal,
      shortBreakTime: shortVal,
      longBreakTime: longVal,
      cyclesToLongBreak: cyclesVal,
      autoStartBreaks: toggleAutoBreaks.checked,
      autoStartPomodoros: toggleAutoPomos.checked,
      individualTimers: individualVal,
      taskTimeTrackingMode: taskTrackingModeVal,
      soundVolume: volVal,
      alarmSound: selectAlarmSound.value,
      tickSound: toggleTickSound.checked,
      rollingAnimation: toggleRollingAnimation ? toggleRollingAnimation.checked : true,
      ...themeDraft
    };

    if (individualChanged && individualVal) {
      if (activeTaskId) {
        saveCurrentTimerToActiveTask(false);
      }
      tasks.forEach(t => {
        if (!t.timerState) {
          t.timerState = {
            mode: TimerMode.POMODORO,
            timeLeft: workVal * 60,
            totalDuration: workVal * 60,
            cycleCount: 0,
            isRunning: false,
            savedAt: Date.now()
          };
        }
      });
      Storage.saveTasks(tasks);
    }

    if (settings.individualTimers) {
      tasks.forEach(t => {
        if (t.timerState) {
          const modeDur = t.timerState.mode === TimerMode.SHORT_BREAK
            ? shortVal * 60
            : (t.timerState.mode === TimerMode.LONG_BREAK ? longVal * 60 : workVal * 60);
          if (t.timerState.timeLeft === t.timerState.totalDuration || t.timerState.timeLeft > modeDur) {
            t.timerState.timeLeft = modeDur;
          }
          t.timerState.totalDuration = modeDur;
        }
      });
      Storage.saveTasks(tasks);
    }

    if (timerRoller) {
      timerRoller.setEnabled(settings.rollingAnimation !== false);
    }

    soundMuted = (volVal <= 0);
    AudioPlayer.setMuted(soundMuted);
    if (soundMuted) {
      iconSoundOn.style.display = 'none';
      iconSoundOff.style.display = 'block';
    } else {
      iconSoundOn.style.display = 'block';
      iconSoundOff.style.display = 'none';
    }

    Storage.saveSettings(settings);
    timer.updateSettings(settings);
    applyTheme();

    updateCycleDisplay(timer.cycleCount);
    updateTaskEstimate();
    renderTasks();
    settingsSaved = true;
    settingsDialog.close();
  });

  btnCloseSettings.addEventListener('click', () => settingsDialog.close());
  btnCancelSettings.addEventListener('click', () => settingsDialog.close());

  // Stats Modal
  btnStats.addEventListener('click', () => {
    statsDialog.showModal();
    if (typeof switchStatsModalTab === 'function') {
      switchStatsModalTab('stats');
    } else {
      StatsChart.renderChart(7);
    }
  });

  btnCloseStats.addEventListener('click', () => {
    if (window.StatsChart && typeof StatsChart.hidePopout === 'function') {
      StatsChart.hidePopout();
    }
    statsDialog.close();
  });

  statsDialog.addEventListener('close', () => {
    if (window.StatsChart && typeof StatsChart.hidePopout === 'function') {
      StatsChart.hidePopout();
    }
  });

  periodButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      periodButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const days = parseInt(btn.dataset.days, 10) || 7;
      StatsChart.renderChart(days);
    });
  });

  btnClearHistory.addEventListener('click', async () => {
    const confirmed = await Confirm.ask({
      title: 'Clear focus history?',
      message: 'All logged focus sessions and chart data will be permanently deleted. Your tasks and settings are kept. This cannot be undone.',
      confirmText: 'Clear History',
      danger: true
    });
    if (!confirmed) return;
    Storage.clearHistory();
    const activePeriod = document.querySelector('.period-btn.active');
    StatsChart.renderChart(activePeriod ? (parseInt(activePeriod.dataset.days, 10) || 7) : 7);
  });

  // Export / Import Backup
  btnExportData.addEventListener('click', () => {
    const jsonStr = Storage.exportData();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pomus_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  inputImportFile.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === 'string') {
        const success = Storage.importData(content);
        if (success) {
          settings = Storage.getSettings();
          tasks = Storage.getTasks();
          activeTaskId = Storage.getActiveTaskId();
          soundMuted = settings.soundVolume <= 0;
          AudioPlayer.setMuted(soundMuted);
          iconSoundOn.style.display = soundMuted ? 'none' : 'block';
          iconSoundOff.style.display = soundMuted ? 'block' : 'none';
          applyTheme();
          renderTasks();
          if (settings.individualTimers && activeTaskId) {
            const actTask = tasks.find(t => t.id === activeTaskId);
            if (actTask && actTask.timerState) {
              timer.restoreState(actTask.timerState);
            } else {
              timer.updateSettings(settings);
            }
          } else {
            timer.updateSettings(settings);
          }
          settingsSaved = true;
          settingsDialog.close();
          Toast.show('Data imported successfully');
        } else {
          Toast.show('Import failed: this file is not a valid Popomus backup', { type: 'error', duration: 4000 });
        }
      }
    };
    reader.readAsText(file);
    // Allow importing the same file again later
    inputImportFile.value = '';
  });

  // Dialog backdrop light dismiss
  [settingsDialog, statsDialog].forEach(dialog => {
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close();
    });
  });

  // KEYBOARD SHORTCUTS (Active in background without visual hints)
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !quickThemeMenu.hidden) {
      setQuickThemeMenuOpen(false);
      btnThemeToggle.focus();
      return;
    }
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
      return;
    }
    // Shortcuts must not leak into open dialogs (e.g. Space toggling the timer behind Settings)
    if (settingsDialog.open || statsDialog.open) {
      return;
    }

    if (e.code === 'Space') {
      // Space keeps its native meaning on focused buttons, options and task cards
      if (document.activeElement && document.activeElement !== document.body &&
          document.activeElement.matches('button, a, [tabindex], [role="option"], label')) {
        return;
      }
      e.preventDefault();
      timer.toggle();
    } else if (e.altKey && e.code === 'KeyR') {
      e.preventDefault();
      timer.reset();
    } else if (e.altKey && e.code === 'KeyS') {
      e.preventDefault();
      timer.skip();
    } else if (e.code === 'F11') {
      e.preventDefault();
      toggleFullscreen();
    }
  });

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // Tasks have a single source of truth: Storage. When another module (e.g. the calendar's
  // "Reopen") saves a different task list or picks a task, adopt it instead of overwriting it later.
  window.addEventListener('pomus:tasks-changed', (e) => {
    if (e.detail && e.detail.tasks === tasks) return;
    tasks = Storage.getTasks();
    if (editingTaskId && !tasks.some(t => t.id === editingTaskId)) editingTaskId = null;
    renderTasks();
  });

  window.addEventListener('pomus:active-task-changed', (e) => {
    const id = e.detail && e.detail.id;
    if (id && id !== activeTaskId && tasks.some(t => t.id === id)) {
      switchActiveTask(id);
    }
  });

  // Initial render
  renderTasks();
  setInterval(updateTaskEstimate, 30000);

  // Stats modal tab switcher (Statistics & Charts vs Task Calendar)
  const modalTabStats = document.getElementById('modalTabStats');
  const modalTabCalendar = document.getElementById('modalTabCalendar');
  const statsPanelActivity = document.getElementById('statsPanelActivity');
  const statsPanelCalendar = document.getElementById('statsPanelCalendar');

  function switchStatsModalTab(tabName) {
    if (tabName === 'calendar') {
      if (modalTabStats) {
        modalTabStats.classList.remove('active');
        modalTabStats.setAttribute('aria-selected', 'false');
      }
      if (modalTabCalendar) {
        modalTabCalendar.classList.add('active');
        modalTabCalendar.setAttribute('aria-selected', 'true');
      }
      if (statsPanelActivity) statsPanelActivity.style.display = 'none';
      if (statsPanelCalendar) statsPanelCalendar.style.display = 'flex';
      if (window.Calendar && typeof Calendar.render === 'function') {
        Calendar.render();
      }
    } else {
      if (modalTabCalendar) {
        modalTabCalendar.classList.remove('active');
        modalTabCalendar.setAttribute('aria-selected', 'false');
      }
      if (modalTabStats) {
        modalTabStats.classList.add('active');
        modalTabStats.setAttribute('aria-selected', 'true');
      }
      if (statsPanelCalendar) statsPanelCalendar.style.display = 'none';
      if (statsPanelActivity) statsPanelActivity.style.display = 'flex';
      const activePeriodBtn = document.querySelector('.period-btn.active');
      const days = activePeriodBtn ? (parseInt(activePeriodBtn.dataset.days, 10) || 7) : 7;
      if (window.StatsChart && typeof StatsChart.renderChart === 'function') {
        StatsChart.renderChart(days);
      }
    }
  }
  window.switchStatsModalTab = switchStatsModalTab;
  window.renderTasks = renderTasks;

  if (modalTabStats) {
    modalTabStats.addEventListener('click', () => switchStatsModalTab('stats'));
  }
  if (modalTabCalendar) {
    modalTabCalendar.addEventListener('click', () => switchStatsModalTab('calendar'));
  }

  // Initialize Calendar Module
  if (window.Calendar && typeof Calendar.init === 'function') {
    Calendar.init();
  }

  // Audio unlock gesture
  function unlockAudio() {
    AudioPlayer._initContext();
    document.removeEventListener('click', unlockAudio);
    document.removeEventListener('keydown', unlockAudio);
  }
  document.addEventListener('click', unlockAudio);
  document.addEventListener('keydown', unlockAudio);
  } catch (err) {
    console.error('CRITICAL DOMContentLoaded ERROR:', err);
  }
});
