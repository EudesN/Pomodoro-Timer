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

  // Timer Elements
  const tabPomodoro = document.getElementById('tabPomodoro');
  const tabShortBreak = document.getElementById('tabShortBreak');
  const tabLongBreak = document.getElementById('tabLongBreak');
  const timerRingProgress = document.getElementById('timerRingProgress');
  const timerDigits = document.getElementById('timerDigits');
  const timerModeBadge = document.getElementById('timerModeBadge');
  const cycleText = document.getElementById('cycleText');
  const btnTimerMain = document.getElementById('btnTimerMain');
  const btnTimerMainText = document.getElementById('btnTimerMainText');
  const iconTimerPlay = document.getElementById('iconTimerPlay');
  const iconTimerPause = document.getElementById('iconTimerPause');
  const btnTimerReset = document.getElementById('btnTimerReset');
  const btnTimerSkip = document.getElementById('btnTimerSkip');

  // Active Task Banner
  const activeTaskBanner = document.getElementById('activeTaskBanner');
  const activeTaskTitle = document.getElementById('activeTaskTitle');
  const activeTaskCycles = document.getElementById('activeTaskCycles');

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

  const inputWorkTime = document.getElementById('inputWorkTime');
  const inputShortBreak = document.getElementById('inputShortBreak');
  const inputLongBreak = document.getElementById('inputLongBreak');
  const inputCyclesToLong = document.getElementById('inputCyclesToLong');
  const toggleAutoBreaks = document.getElementById('toggleAutoBreaks');
  const toggleAutoPomos = document.getElementById('toggleAutoPomos');
  const inputSoundVolume = document.getElementById('inputSoundVolume');
  const volumePercentDisplay = document.getElementById('volumePercentDisplay');
  const selectAlarmSound = document.getElementById('selectAlarmSound');
  const btnPreviewSound = document.getElementById('btnPreviewSound');
  const toggleTickSound = document.getElementById('toggleTickSound');

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
  applyTheme(settings.theme || 'sunset');

  // Listeners de ciclo de vida para garantir gravação imediata em disco ao fechar janela
  window.addEventListener('beforeunload', () => Storage.syncWithDisk(true));
  window.addEventListener('pagehide', () => Storage.syncWithDisk(true));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') Storage.syncWithDisk(true);
  });

  // Hidratação garantida a partir do disco na inicialização
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
      applyTheme(settings.theme || 'sunset');
      renderTasks();
      if (timer) timer.updateSettings(settings);
      updateActiveTaskBanner();
      updateTaskEstimate();
    } else {
      // Primeira execução de todas: se disco e localStorage estiverem vazios, cria tarefa exemplo
      if (tasks.length === 0 && !localStorage.getItem('pomus_tasks')) {
        const initialTasks = [
          { id: 'task_ia', title: 'IA', actCycles: 7, estCycles: 10, completed: false, createdAt: Date.now() }
        ];
        tasks = initialTasks;
        activeTaskId = 'task_ia';
        Storage.saveTasks(tasks);
        Storage.setActiveTaskId(activeTaskId);
        renderTasks();
      }
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

  // --------------------------------------------------------------------------
  // TIMER INITIALIZATION
  // --------------------------------------------------------------------------
  timer = new PomodoroTimer({
    settings: settings,
    onTick: (timeLeft, totalDuration, progress) => {
      const mins = Math.floor(timeLeft / 60).toString().padStart(2, '0');
      const secs = (timeLeft % 60).toString().padStart(2, '0');
      const formatted = `${mins}:${secs}`;
      timerDigits.textContent = formatted;

      const offset = RING_CIRCUMFERENCE * (1 - progress);
      timerRingProgress.style.strokeDashoffset = offset;

      const modeLabel = timer.mode === TimerMode.POMODORO ? 'Focus' : 'Break';
      document.title = `(${formatted}) ${modeLabel} | Popomus`;
    },
    onStateChange: (mode, isRunning, cycleCount) => {
      body.setAttribute('data-mode', mode);

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

      if (isRunning) {
        btnTimerMain.classList.add('running');
        btnTimerMainText.textContent = 'PAUSE';
        if (iconTimerPlay) iconTimerPlay.style.display = 'none';
        if (iconTimerPause) iconTimerPause.style.display = 'block';
        body.classList.add('timer-running');
      } else {
        btnTimerMain.classList.remove('running');
        btnTimerMainText.textContent = 'START';
        if (iconTimerPlay) iconTimerPlay.style.display = 'block';
        if (iconTimerPause) iconTimerPause.style.display = 'none';
        body.classList.remove('timer-running');
      }

      updateCycleDisplay(cycleCount);
    },
    onComplete: (finishedMode) => {
      if (finishedMode === TimerMode.POMODORO) {
        // Confetti celebration removed per user request

        const activeTask = tasks.find(t => t.id === activeTaskId);
        const taskTitle = activeTask ? activeTask.title : 'General Focus';
        Storage.logCompletedSession(settings.workTime, taskTitle);

        if (activeTask) {
          activeTask.actCycles = (activeTask.actCycles || 0) + 1;
          Storage.saveTasks(tasks);
          renderTasks();
          updateActiveTaskBanner();
        }

        if (statsDialog.open) {
          StatsChart.renderChart();
        }
      }
    }
  });

  function updateCycleDisplay(cycleCount) {
    const current = (cycleCount % settings.cyclesToLongBreak) + 1;
    if (cycleText) {
      cycleText.textContent = `#${current}`;
    }
  }

  // Initial trigger to paint timer
  timer.reset();

  // --------------------------------------------------------------------------
  // TIMER CONTROLS & SOUNDS
  // --------------------------------------------------------------------------
  // Start/Pause is the ONLY button with tactile sound feedback per user request
  btnTimerMain.addEventListener('click', () => {
    playClick();
    timer.requestNotificationPermission();
    timer.toggle();
  });

  btnTimerReset.addEventListener('click', () => {
    timer.reset();
  });

  btnTimerSkip.addEventListener('click', () => {
    timer.skip();
  });

  tabPomodoro.addEventListener('click', () => {
    timer.setMode(TimerMode.POMODORO);
  });
  tabShortBreak.addEventListener('click', () => {
    timer.setMode(TimerMode.SHORT_BREAK);
  });
  tabLongBreak.addEventListener('click', () => {
    timer.setMode(TimerMode.LONG_BREAK);
  });

  // Sound toggle button in header
  btnSoundToggle.addEventListener('click', () => {
    soundMuted = !soundMuted;
    if (soundMuted) {
      settings.soundVolume = 0;
      iconSoundOn.style.display = 'none';
      iconSoundOff.style.display = 'block';
    } else {
      settings.soundVolume = 0.8;
      iconSoundOn.style.display = 'block';
      iconSoundOff.style.display = 'none';
    }
    syncVolumeUI(settings.soundVolume);
    AudioPlayer.setMuted(soundMuted);
    Storage.saveSettings(settings);
    timer.updateSettings(settings);
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
      if (timer) timer.updateSettings(settings);
    });
  }

  // --------------------------------------------------------------------------
  // FULLSCREEN HANDLER
  // --------------------------------------------------------------------------
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

  // --------------------------------------------------------------------------
  // THEMES & COLOR SWITCHING (Inspirations Palettes)
  // --------------------------------------------------------------------------
  function applyTheme(themeKey, customColors = null) {
    settings.theme = themeKey;
    const root = document.documentElement;

    if (themeKey === 'custom') {
      const p = customColors?.pomo || settings.customColorPomo || '#da4d4f';
      const s = customColors?.short || settings.customColorShort || '#ea845e';
      const l = customColors?.long || settings.customColorLong || '#f39336';
      root.style.setProperty('--theme-pomo-primary', p);
      root.style.setProperty('--theme-short-primary', s);
      root.style.setProperty('--theme-long-primary', l);
    } else {
      const preset = THEME_PRESETS[themeKey] || THEME_PRESETS.sunset;
      root.style.setProperty('--theme-pomo-primary', preset.pomo);
      root.style.setProperty('--theme-short-primary', preset.short);
      root.style.setProperty('--theme-long-primary', preset.long);
    }

    // Refresh active mode color
    const currentMode = (timer && timer.mode) ? timer.mode : 'pomodoro';
    body.setAttribute('data-mode', currentMode);
  }

  // Quick theme toggle popover
  btnThemeToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    const isVisible = quickThemeMenu.style.display === 'block';
    quickThemeMenu.style.display = isVisible ? 'none' : 'block';
  });

  quickThemeMenu.addEventListener('click', (e) => {
    const btn = e.target.closest('.theme-palette-btn');
    if (!btn) return;
    const chosen = btn.dataset.theme;
    applyTheme(chosen);
    Storage.saveSettings(settings);
    quickThemeMenu.style.display = 'none';
  });

  document.addEventListener('click', (e) => {
    if (!quickThemeMenu.contains(e.target) && e.target !== btnThemeToggle) {
      quickThemeMenu.style.display = 'none';
    }
    if (!tasksDropdownMenu.contains(e.target) && e.target !== btnTasksMenu) {
      tasksDropdownMenu.style.display = 'none';
    }
  });

  // --------------------------------------------------------------------------
  // TASKS MANAGEMENT: Drag & Drop + Active Task Highlight + Expandable Edit Drawer
  // --------------------------------------------------------------------------
  let draggedTaskId = null;
  let editingTaskId = null;

  function renderTasks() {
    tasksList.innerHTML = '';

    if (tasks.length === 0) {
      tasksList.innerHTML = `
        <div class="empty-tasks-state">
          No tasks yet. Click "Add Task" to plan your focus.
        </div>
      `;
      updateActiveTaskBanner();
      updateTaskEstimate();
      return;
    }

    tasks.forEach(task => {
      const isSelected = task.id === activeTaskId;
      const isCompleted = !!task.completed;
      const isEditing = task.id === editingTaskId;
      const act = task.actCycles || 0;
      const est = Math.max(1, task.estCycles || 1);

      const taskEl = document.createElement('div');
      taskEl.className = `task-item ${isSelected ? 'active-focus' : ''} ${isCompleted ? 'completed' : ''} ${isEditing ? 'is-editing' : ''}`;
      taskEl.dataset.id = task.id;
      taskEl.setAttribute('draggable', 'true');

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

    updateActiveTaskBanner();
    updateTaskEstimate();
  }

  function updateActiveTaskBanner() {
    const activeTask = tasks.find(t => t.id === activeTaskId);
    if (activeTask) {
      activeTaskBanner.style.display = 'flex';
      activeTaskTitle.textContent = activeTask.title;
      activeTaskCycles.textContent = `${activeTask.actCycles || 0}/${activeTask.estCycles || 1} pomos`;
    } else {
      activeTaskBanner.style.display = 'none';
    }
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

    tasks.push(newTask);

    if (!activeTaskId) {
      activeTaskId = newTask.id;
      Storage.setActiveTaskId(activeTaskId);
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
    tasks = tasks.filter(t => !t.completed);
    if (!tasks.some(t => t.id === activeTaskId)) {
      activeTaskId = tasks.length > 0 ? tasks[0].id : null;
      Storage.setActiveTaskId(activeTaskId);
    }
    Storage.saveTasks(tasks);
    updateTaskEstimate();
    renderTasks();
    tasksDropdownMenu.style.display = 'none';
  });

  btnClearAllTasks.addEventListener('click', () => {
    if (confirm('Are you sure you want to delete all tasks?')) {
      tasks = [];
      activeTaskId = null;
      editingTaskId = null;
      Storage.setActiveTaskId(null);
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
        tasks = tasks.filter(t => t.id !== taskId);
        if (activeTaskId === taskId) {
          activeTaskId = tasks.length > 0 ? tasks[0].id : null;
          Storage.setActiveTaskId(activeTaskId);
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
        editingTaskId = null;
        Storage.saveTasks(tasks);
        updateActiveTaskBanner();
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
      Storage.saveTasks(tasks);
      updateTaskEstimate();
      renderTasks();
    } else if (action === 'menu') {
      e.stopPropagation();
      editingTaskId = (editingTaskId === taskId) ? null : taskId;
      renderTasks();
    } else {
      // Default: select task
      activeTaskId = taskId;
      Storage.setActiveTaskId(activeTaskId);
      renderTasks();
    }
  });

  // Handle keyboard submission (Enter / Escape) inside inline edit drawer
  tasksList.addEventListener('keydown', (e) => {
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

  // --------------------------------------------------------------------------
  // MODALS & DIALOG MANAGEMENT
  // --------------------------------------------------------------------------
  btnSettings.addEventListener('click', () => {
    inputWorkTime.value = settings.workTime;
    inputShortBreak.value = settings.shortBreakTime;
    inputLongBreak.value = settings.longBreakTime;
    inputCyclesToLong.value = settings.cyclesToLongBreak;
    toggleAutoBreaks.checked = settings.autoStartBreaks;
    toggleAutoPomos.checked = settings.autoStartPomodoros;
    selectAlarmSound.value = settings.alarmSound;
    toggleTickSound.checked = !!settings.tickSound;
    syncVolumeUI(settings.soundVolume !== undefined ? settings.soundVolume : 0.8);

    // Theme radios
    const currentTheme = settings.theme || 'sunset';
    const radios = document.querySelectorAll('input[name="settingsTheme"]');
    radios.forEach(r => {
      r.checked = (r.value === currentTheme);
    });

    customColorSettings.style.display = currentTheme === 'custom' ? 'flex' : 'none';
    colorPomoInput.value = settings.customColorPomo || '#da4d4f';
    colorShortInput.value = settings.customColorShort || '#ea845e';
    colorLongInput.value = settings.customColorLong || '#f39336';

    settingsDialog.showModal();
  });

  // Dynamic estimate update when timer duration setting is edited
  inputWorkTime.addEventListener('input', () => {
    const v = parseInt(inputWorkTime.value, 10);
    if (v && v > 0) {
      updateTaskEstimate(v);
    }
  });

  // Settings theme radio change
  document.querySelectorAll('input[name="settingsTheme"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      const val = e.target.value;
      customColorSettings.style.display = val === 'custom' ? 'flex' : 'none';
    });
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

    const checkedTheme = document.querySelector('input[name="settingsTheme"]:checked')?.value || 'sunset';
    const volPct = inputSoundVolume ? parseInt(inputSoundVolume.value, 10) : 80;
    const volVal = Math.min(1, Math.max(0, volPct / 100));

    settings = {
      ...settings,
      workTime: workVal,
      shortBreakTime: shortVal,
      longBreakTime: longVal,
      cyclesToLongBreak: cyclesVal,
      autoStartBreaks: toggleAutoBreaks.checked,
      autoStartPomodoros: toggleAutoPomos.checked,
      soundVolume: volVal,
      alarmSound: selectAlarmSound.value,
      tickSound: toggleTickSound.checked,
      theme: checkedTheme,
      customColorPomo: colorPomoInput.value,
      customColorShort: colorShortInput.value,
      customColorLong: colorLongInput.value
    };

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
    applyTheme(checkedTheme, {
      pomo: colorPomoInput.value,
      short: colorShortInput.value,
      long: colorLongInput.value
    });

    updateCycleDisplay(timer.cycleCount);
    updateTaskEstimate();
    settingsDialog.close();
  });

  btnCloseSettings.addEventListener('click', () => {
    updateTaskEstimate();
    settingsDialog.close();
  });

  // Stats Modal
  btnStats.addEventListener('click', () => {
    statsDialog.showModal();
    StatsChart.renderChart(7);
  });

  btnCloseStats.addEventListener('click', () => {
    statsDialog.close();
  });

  periodButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      periodButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const days = parseInt(btn.dataset.days, 10) || 7;
      StatsChart.renderChart(days);
    });
  });

  btnClearHistory.addEventListener('click', () => {
    if (confirm('Are you sure you want to clear your focus history? This cannot be undone.')) {
      Storage.clearHistory();
      StatsChart.renderChart(7);
    }
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
          alert('Data imported successfully!');
          settings = Storage.getSettings();
          tasks = Storage.getTasks();
          activeTaskId = Storage.getActiveTaskId();
          soundMuted = settings.soundVolume <= 0;
          AudioPlayer.setMuted(soundMuted);
          iconSoundOn.style.display = soundMuted ? 'none' : 'block';
          iconSoundOff.style.display = soundMuted ? 'block' : 'none';
          applyTheme(settings.theme || 'sunset');
          renderTasks();
          timer.updateSettings(settings);
          settingsDialog.close();
        } else {
          alert('Import error: Invalid file format.');
        }
      }
    };
    reader.readAsText(file);
  });

  // Dialog backdrop light dismiss
  [settingsDialog, statsDialog].forEach(dialog => {
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close();
    });
  });

  // --------------------------------------------------------------------------
  // KEYBOARD SHORTCUTS (Active in background without visual hints)
  // --------------------------------------------------------------------------
  window.addEventListener('keydown', (e) => {
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
      return;
    }

    if (e.code === 'Space') {
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

  // --------------------------------------------------------------------------
  // CANVAS CONFETTI
  // --------------------------------------------------------------------------
  function launchConfetti() {
    const canvas = document.getElementById('confettiCanvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ['#ffffff', '#faecc9', '#f39336', '#da4d4f', '#dd7057', '#f4a971'];
    const particles = [];
    const count = 120;

    for (let i = 0; i < count; i++) {
      particles.push({
        x: canvas.width / 2,
        y: canvas.height / 2,
        vx: (Math.random() - 0.5) * 16,
        vy: (Math.random() - 0.8) * 16,
        size: Math.random() * 8 + 5,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 10,
        alpha: 1,
        decay: Math.random() * 0.015 + 0.01
      });
    }

    let animId;
    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let aliveCount = 0;

      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.35;
        p.vx *= 0.98;
        p.rotation += p.rotationSpeed;
        p.alpha -= p.decay;

        if (p.alpha > 0) {
          aliveCount++;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate((p.rotation * Math.PI) / 180);
          ctx.globalAlpha = Math.max(0, p.alpha);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
          ctx.restore();
        }
      });

      if (aliveCount > 0) {
        animId = requestAnimationFrame(animate);
      } else {
        cancelAnimationFrame(animId);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }

    animate();
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // Initial render
  renderTasks();
  setInterval(updateTaskEstimate, 30000);

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
