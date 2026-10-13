/**
 * STORAGE MODULE - POMUS
 * Handles localStorage persistence, color themes, disk synchronization,
 * and JSON data export/import.
 */

const STORAGE_KEYS = {
  SETTINGS: 'pomus_settings',
  TASKS: 'pomus_tasks',
  SESSIONS: 'pomus_sessions',
  ACTIVE_TASK: 'pomus_active_task',
  TIMER_STATE: 'pomus_timer_state',
  COMPLETED_HISTORY: 'pomus_completed_history'
};

// Legacy keys migration helper
const LEGACY_KEYS = {
  SETTINGS: 'pomodoro_settings',
  TASKS: 'pomodoro_tasks',
  SESSIONS: 'pomodoro_sessions',
  ACTIVE_TASK: 'pomodoro_active_task',
  COMPLETED_HISTORY: 'pomodoro_completed_history'
};

const DEFAULT_SETTINGS = {
  workTime: 25,          // minutes
  shortBreakTime: 5,     // minutes
  longBreakTime: 15,     // minutes
  cyclesToLongBreak: 4,  // count
  autoStartBreaks: false,
  autoStartPomodoros: false,
  individualTimers: false,
  taskTimeTrackingMode: 'on_complete', // 'on_complete' (default) | 'on_pause_or_complete'
  alarmSound: 'bell',    // bell, zen, beep, marimba
  soundVolume: 0.8,
  tickSound: false,
  rollingAnimation: true, // Number Rolling Animation
  theme: 'sunset',       // sunset, earth, dusk, night, gunmetal, custom
  customColorPomo: '#da4d4f',
  customColorShort: '#ea845e',
  customColorLong: '#f39336'
};

const THEME_PRESETS = {
  sunset: {
    name: 'Sunset Glow',
    pomo: '#da4d4f',
    short: '#ea845e',
    long: '#f39336'
  },
  earth: {
    name: 'Warm Earth',
    pomo: '#ea845e',
    short: '#f39336',
    long: '#eab66a'
  },
  dusk: {
    name: 'Dusk Horizons',
    pomo: '#dd7057',
    short: '#f4a971',
    long: '#213241'
  },
  night: {
    name: 'Deep Night',
    pomo: '#3d2228',
    short: '#dd7057',
    long: '#213241'
  },
  gunmetal: {
    name: 'Midnight Slate',
    pomo: '#213241',
    short: '#272233',
    long: '#3d2228'
  },
  // Backward-compatible aliases
  classic: {
    name: 'Sunset Glow',
    pomo: '#da4d4f',
    short: '#ea845e',
    long: '#f39336'
  },
  palette: {
    name: 'Sunset Glow',
    pomo: '#da4d4f',
    short: '#ea845e',
    long: '#f39336'
  },
  mint: {
    name: 'Warm Earth',
    pomo: '#ea845e',
    short: '#f39336',
    long: '#eab66a'
  },
  ocean: {
    name: 'Dusk Horizons',
    pomo: '#dd7057',
    short: '#f4a971',
    long: '#213241'
  },
  lavender: {
    name: 'Deep Night',
    pomo: '#3d2228',
    short: '#dd7057',
    long: '#213241'
  },
  dark: {
    name: 'Midnight Slate',
    pomo: '#213241',
    short: '#272233',
    long: '#3d2228'
  }
};

const Storage = {
  // Migrate from old keys if existing
  _migrate() {
    try {
      Object.keys(STORAGE_KEYS).forEach(k => {
        const newKey = STORAGE_KEYS[k];
        const oldKey = LEGACY_KEYS[k];
        if (!localStorage.getItem(newKey) && localStorage.getItem(oldKey)) {
          localStorage.setItem(newKey, localStorage.getItem(oldKey));
        }
      });
    } catch (e) {}
  },

  // Settings
  getSettings() {
    this._migrate();
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      return data ? { ...DEFAULT_SETTINGS, ...JSON.parse(data) } : { ...DEFAULT_SETTINGS };
    } catch (e) {
      console.error('Error loading settings:', e);
      return { ...DEFAULT_SETTINGS };
    }
  },

  saveSettings(settings) {
    try {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
      this.syncWithDisk(true);
    } catch (e) {
      console.error('Error saving settings:', e);
    }
  },

  // Tasks
  getTasks() {
    this._migrate();
    try {
      const data = localStorage.getItem(STORAGE_KEYS.TASKS);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Error loading tasks:', e);
    }
    return [];
  },

  saveTasks(tasks) {
    try {
      localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
      this.syncWithDisk(true);
    } catch (e) {
      console.error('Error saving tasks:', e);
    }
  },

  getActiveTaskId() {
    this._migrate();
    return localStorage.getItem(STORAGE_KEYS.ACTIVE_TASK) || null;
  },

  setActiveTaskId(id) {
    if (id) {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_TASK, id);
    } else {
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_TASK);
    }
    this.syncWithDisk(true);
  },

  // Completed Tasks History (All Time Persistence)
  getCompletedTasksHistory() {
    this._migrate();
    try {
      const data = localStorage.getItem(STORAGE_KEYS.COMPLETED_HISTORY);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Error loading completed tasks history:', e);
    }
    return [];
  },

  saveCompletedTasksHistory(historyList) {
    try {
      localStorage.setItem(STORAGE_KEYS.COMPLETED_HISTORY, JSON.stringify(historyList));
      this.syncWithDisk(true);
    } catch (e) {
      console.error('Error saving completed tasks history:', e);
    }
  },

  recordCompletedTask(task) {
    if (!task || !task.id) return null;
    const history = this.getCompletedTasksHistory();
    const now = Date.now();
    const completedAt = task.completedAt || now;
    const d = new Date(completedAt);
    const dateStr = task.completedDate || this._formatLocalDate(d);
    const timeFormatted = task.completedTimeFormatted || d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const settings = this.getSettings();
    const act = typeof task.actCycles === 'number' ? task.actCycles : (task.estCycles || 1);
    const est = Math.max(1, task.estCycles || 1);
    const totalMinutes = act * (settings.workTime || 25);

    const record = {
      id: task.id,
      title: (task.title || 'Untitled Task').trim(),
      actCycles: act,
      estCycles: est,
      completed: true,
      completedAt: completedAt,
      completedDate: dateStr,
      completedTimeFormatted: timeFormatted,
      createdAt: task.createdAt || completedAt,
      totalMinutes: totalMinutes
    };

    const existingIndex = history.findIndex(h => h.id === task.id);
    if (existingIndex !== -1) {
      history[existingIndex] = { ...history[existingIndex], ...record };
    } else {
      history.unshift(record);
    }

    this.saveCompletedTasksHistory(history);
    return record;
  },

  removeCompletedTaskFromHistory(taskId) {
    let history = this.getCompletedTasksHistory();
    history = history.filter(h => h.id !== taskId);
    this.saveCompletedTasksHistory(history);
  },

  getAllCompletedTasks() {
    const history = this.getCompletedTasksHistory();
    const activeTasks = this.getTasks();
    const sessions = this.getSessions();
    const settings = this.getSettings();
    const map = new Map();

    // 1. Aggregate recorded database sessions across all time
    sessions.forEach(s => {
      const title = (s.taskTitle && s.taskTitle.trim()) ? s.taskTitle.trim() : 'General Focus';
      const date = s.date || (s.timestamp ? this._formatLocalDate(new Date(s.timestamp)) : '');
      if (!date) return;
      const key = `${date}___${title}`;
      if (!map.has(key)) {
        map.set(key, {
          id: 'sess_task_' + date + '_' + title.replace(/\s+/g, '_'),
          title: title,
          completedDate: date,
          totalMinutes: 0,
          actCycles: 0,
          estCycles: 1,
          completed: true,
          completedAt: s.timestamp || Date.now(),
          sessionTimes: [],
          fromDatabase: true
        });
      }
      const item = map.get(key);
      item.totalMinutes += (s.durationMinutes || 0);
      item.actCycles += 1;
      if (s.timeFormatted && !item.sessionTimes.includes(s.timeFormatted)) {
        item.sessionTimes.push(s.timeFormatted);
      }
      if (s.timestamp && s.timestamp > item.completedAt) {
        item.completedAt = s.timestamp;
      }
    });

    // 2. Merge with completed tasks history (completedHistory)
    history.forEach(item => {
      const date = item.completedDate || this._formatLocalDate(new Date(item.completedAt || Date.now()));
      const title = (item.title || 'Untitled Task').trim();
      const key = `${date}___${title}`;
      if (map.has(key)) {
        const existing = map.get(key);
        existing.id = item.id;
        existing.estCycles = Math.max(existing.estCycles || 1, item.estCycles || 1);
        existing.actCycles = Math.max(existing.actCycles || 0, item.actCycles || 0);
        existing.totalMinutes = Math.max(existing.totalMinutes || 0, item.totalMinutes || 0);
        if (item.completedAt && item.completedAt > existing.completedAt) {
          existing.completedAt = item.completedAt;
        }
      } else {
        map.set(key, {
          ...item,
          completedDate: date,
          completed: true
        });
      }
    });

    // 3. Merge with active tasks marked as completed
    activeTasks.filter(t => t.completed).forEach(t => {
      const completedAt = t.completedAt || t.createdAt || Date.now();
      const d = new Date(completedAt);
      const date = this._formatLocalDate(d);
      const title = (t.title || 'Untitled Task').trim();
      const key = `${date}___${title}`;
      const act = typeof t.actCycles === 'number' ? t.actCycles : (t.estCycles || 1);
      const est = Math.max(1, t.estCycles || 1);
      const timeMins = (t.focusedMinutes && t.focusedMinutes > 0) ? t.focusedMinutes : (act * (settings.workTime || 25));

      if (map.has(key)) {
        const existing = map.get(key);
        existing.id = t.id;
        existing.actCycles = Math.max(existing.actCycles || 0, act);
        existing.estCycles = Math.max(existing.estCycles || 1, est);
        existing.totalMinutes = Math.max(existing.totalMinutes || 0, timeMins);
      } else {
        map.set(key, {
          id: t.id,
          title: title,
          actCycles: act,
          estCycles: est,
          completed: true,
          completedAt: completedAt,
          completedDate: date,
          createdAt: t.createdAt || completedAt,
          totalMinutes: timeMins
        });
      }
    });

    // 4. Format friendly duration and sort descending by completion date
    const list = Array.from(map.values()).map(item => {
      const totalMins = Math.max(1, Math.round(item.totalMinutes || (item.actCycles * 25)));
      const h = Math.floor(totalMins / 60);
      const m = totalMins % 60;
      const formattedTime = h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${totalMins}m`;
      const d = new Date(item.completedAt || Date.now());
      return {
        ...item,
        totalMinutes: totalMins,
        durationFormatted: formattedTime,
        completedTimeFormatted: item.completedTimeFormatted || d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
    });

    return list.sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));
  },

  // Timer State Persistence
  getTimerState() {
    this._migrate();
    try {
      const data = localStorage.getItem(STORAGE_KEYS.TIMER_STATE);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      console.error('Error loading timer state:', e);
      return null;
    }
  },

  saveTimerState(state, syncDisk = false) {
    if (!state) return;
    try {
      localStorage.setItem(STORAGE_KEYS.TIMER_STATE, JSON.stringify(state));
      if (syncDisk) {
        this.syncWithDisk(true);
      }
    } catch (e) {
      console.error('Error saving timer state:', e);
    }
  },

  clearTimerState() {
    try {
      localStorage.removeItem(STORAGE_KEYS.TIMER_STATE);
    } catch (e) {}
  },

  // Focus Sessions Log (with in-memory cache to prevent redundant JSON.parse)
  _sessionsCache: null,

  getSessions() {
    if (this._sessionsCache !== null) {
      return this._sessionsCache;
    }
    this._migrate();
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SESSIONS);
      this._sessionsCache = data ? JSON.parse(data) : [];
      return this._sessionsCache;
    } catch (e) {
      console.error('Error loading sessions:', e);
      return [];
    }
  },

  saveSessions(sessions) {
    this._sessionsCache = Array.isArray(sessions) ? sessions : [];
    try {
      localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(this._sessionsCache));
      this.syncWithDisk(true);
    } catch (e) {
      console.error('Error saving sessions:', e);
    }
  },

  _formatLocalDate(d = new Date()) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  /**
   * Log a newly completed pomodoro focus session
   */
  logCompletedSession(durationMinutes, taskTitle = 'Foco Geral') {
    const sessions = this.getSessions();
    const now = new Date();
    const dateStr = this._formatLocalDate(now);
    
    const newSession = {
      id: 'sess_' + Date.now(),
      date: dateStr,
      timestamp: now.getTime(),
      timeFormatted: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      durationMinutes: durationMinutes,
      durationHours: Number((durationMinutes / 60).toFixed(2)),
      taskTitle: taskTitle || 'Foco Geral',
      mode: 'pomodoro'
    };

    sessions.unshift(newSession);
    this.saveSessions(sessions);
    return newSession;
  },

  getDailyFocusData(daysCount = 7) {
    const sessions = this.getSessions();
    const dailyMap = new Map();

    const now = new Date();
    const result = [];

    for (let i = daysCount - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      const dateKey = this._formatLocalDate(d);
      
      const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
      const monthName = d.toLocaleDateString('en-US', { month: 'short' });
      const dayNum = d.getDate();
      const label = `${dayName}, ${monthName} ${dayNum}`;

      dailyMap.set(dateKey, {
        date: dateKey,
        label: label,
        minutes: 0,
        hours: 0,
        sessionsCount: 0,
        tasks: {}
      });
    }

    sessions.forEach(sess => {
      let matchedKey = null;
      if (dailyMap.has(sess.date)) {
        matchedKey = sess.date;
      } else if (sess.timestamp) {
        const localKey = this._formatLocalDate(new Date(sess.timestamp));
        if (dailyMap.has(localKey)) {
          matchedKey = localKey;
        }
      }

      if (matchedKey) {
        const item = dailyMap.get(matchedKey);
        const duration = sess.durationMinutes || 0;
        item.minutes += duration;
        item.sessionsCount += 1;

        const taskTitle = (sess.taskTitle && sess.taskTitle.trim()) ? sess.taskTitle.trim() : 'Foco Geral';
        if (!item.tasks[taskTitle]) {
          item.tasks[taskTitle] = {
            minutes: 0,
            hours: 0,
            sessionsCount: 0
          };
        }
        item.tasks[taskTitle].minutes += duration;
        item.tasks[taskTitle].sessionsCount += 1;
      }
    });

    for (const item of dailyMap.values()) {
      item.hours = Number((item.minutes / 60).toFixed(2));
      for (const tTitle in item.tasks) {
        item.tasks[tTitle].hours = Number((item.tasks[tTitle].minutes / 60).toFixed(2));
      }
      result.push(item);
    }

    return result;
  },

  getMetricsSummary(daysCount = 7, providedDailyData = null) {
    const dailyData = providedDailyData || this.getDailyFocusData(daysCount);
    const sessions = this.getSessions();

    const totalMinutes = dailyData.reduce((acc, curr) => acc + curr.minutes, 0);
    const totalHours = Number((totalMinutes / 60).toFixed(1));
    const totalSessions = dailyData.reduce((acc, curr) => acc + curr.sessionsCount, 0);
    const dailyAverageHours = Number((totalHours / daysCount).toFixed(1));

    let streak = 0;
    const allSessions = sessions;
    const uniqueDaysWithFocus = new Set(allSessions.filter(s => s.durationMinutes > 0).map(s => {
      return s.date || (s.timestamp ? this._formatLocalDate(new Date(s.timestamp)) : '');
    }));

    const checkDate = new Date();
    const todayStr = this._formatLocalDate(checkDate);
    
    if (!uniqueDaysWithFocus.has(todayStr)) {
      checkDate.setDate(checkDate.getDate() - 1);
    }

    while (true) {
      const dStr = this._formatLocalDate(checkDate);
      if (uniqueDaysWithFocus.has(dStr)) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }

    return {
      totalHours,
      dailyAverageHours,
      totalSessions,
      streak
    };
  },

  seedDemoData() {
    const demoSessions = [];
    const sampleTasks = [
      'Refactor Core Architecture',
      'Data Structures & Algorithms',
      'Automated Testing Suite',
      'Technical Documentation Review',
      'Code Review & Pair Programming',
      'Frontend Performance Optimization'
    ];

    const today = new Date();

    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];

      const count = Math.floor(Math.random() * 5) + 2; 
      for (let s = 0; s < count; s++) {
        const hour = 9 + s * 2;
        const taskTitle = sampleTasks[Math.floor(Math.random() * sampleTasks.length)];
        demoSessions.push({
          id: 'demo_' + dateStr + '_' + s,
          date: dateStr,
          timestamp: new Date(d.getFullYear(), d.getMonth(), d.getDate(), hour, 30).getTime(),
          timeFormatted: `${hour.toString().padStart(2, '0')}:30`,
          durationMinutes: 25,
          durationHours: 0.42,
          taskTitle: taskTitle,
          mode: 'pomodoro'
        });
      }
    }

    this.saveSessions(demoSessions);
    return demoSessions;
  },

  clearHistory() {
    this._sessionsCache = [];
    localStorage.removeItem(STORAGE_KEYS.SESSIONS);
    this.syncWithDisk();
  },

  // Disk Synchronization (Bridge with python app.py)
  syncDebounceTimer: null,
  syncWithDisk(immediate = false) {
    if (!window.location.protocol.startsWith('http')) return;

    const doSync = () => {
      clearTimeout(this.syncDebounceTimer);
      const currentTimerState = (typeof window !== 'undefined' && window.timer && typeof window.timer.getState === 'function')
        ? window.timer.getState()
        : this.getTimerState();

      const payload = {
        settings: this.getSettings(),
        tasks: this.getTasks(),
        sessions: this.getSessions(),
        activeTaskId: this.getActiveTaskId(),
        timerState: currentTimerState,
        completedHistory: this.getAllCompletedTasks(),
        updatedAt: new Date().toISOString()
      };

      const body = JSON.stringify(payload);
      if (navigator.sendBeacon) {
        try {
          const blob = new Blob([body], { type: 'application/json' });
          if (navigator.sendBeacon('/api/sync', blob)) return;
        } catch (e) {}
      }

      fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body,
        keepalive: true
      }).catch(() => {});
    };

    if (immediate) {
      clearTimeout(this.syncDebounceTimer);
      doSync();
    } else {
      clearTimeout(this.syncDebounceTimer);
      this.syncDebounceTimer = setTimeout(doSync, 200);
    }
  },

  async loadFromDisk() {
    if (!window.location.protocol.startsWith('http')) return false;
    try {
      const res = await fetch('/api/sync');
      if (res.ok) {
        const data = await res.json();
        if (data && typeof data === 'object' && (data.tasks || data.settings || data.sessions)) {
          let updated = false;
          if (data.settings && typeof data.settings === 'object') {
            localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(data.settings));
            updated = true;
          }
          if (Array.isArray(data.tasks)) {
            localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(data.tasks));
            updated = true;
          }
          if (Array.isArray(data.sessions)) {
            localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(data.sessions));
            this._sessionsCache = data.sessions;
            updated = true;
          }
          if (data.activeTaskId !== undefined) {
            if (data.activeTaskId) {
              localStorage.setItem(STORAGE_KEYS.ACTIVE_TASK, data.activeTaskId);
            } else {
              localStorage.removeItem(STORAGE_KEYS.ACTIVE_TASK);
            }
            updated = true;
          }
          if (data.timerState && typeof data.timerState === 'object') {
            localStorage.setItem(STORAGE_KEYS.TIMER_STATE, JSON.stringify(data.timerState));
            updated = true;
          }
          if (Array.isArray(data.completedHistory)) {
            localStorage.setItem(STORAGE_KEYS.COMPLETED_HISTORY, JSON.stringify(data.completedHistory));
            updated = true;
          } else if (Array.isArray(data.completedTasks)) {
            localStorage.setItem(STORAGE_KEYS.COMPLETED_HISTORY, JSON.stringify(data.completedTasks));
            updated = true;
          }
          return updated;
        }
      }
    } catch (e) {
      console.warn('[Storage] Não foi possível carregar dados do disco:', e);
    }
    return false;
  },

  // Export & Import
  exportData() {
    const payload = {
      app: 'Popomus',
      version: '2.0',
      exportedAt: new Date().toISOString(),
      settings: this.getSettings(),
      tasks: this.getTasks(),
      sessions: this.getSessions(),
      activeTaskId: this.getActiveTaskId(),
      timerState: this.getTimerState(),
      completedHistory: this.getAllCompletedTasks()
    };
    return JSON.stringify(payload, null, 2);
  },

  importData(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      if (data && typeof data === 'object') {
        if (data.settings) localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(data.settings));
        if (Array.isArray(data.tasks)) localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(data.tasks));
        if (Array.isArray(data.sessions)) {
          localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(data.sessions));
          this._sessionsCache = data.sessions;
        }
        if (data.activeTaskId) localStorage.setItem(STORAGE_KEYS.ACTIVE_TASK, data.activeTaskId);
        if (data.timerState) localStorage.setItem(STORAGE_KEYS.TIMER_STATE, JSON.stringify(data.timerState));
        if (Array.isArray(data.completedHistory)) {
          localStorage.setItem(STORAGE_KEYS.COMPLETED_HISTORY, JSON.stringify(data.completedHistory));
        } else if (Array.isArray(data.completedTasks)) {
          localStorage.setItem(STORAGE_KEYS.COMPLETED_HISTORY, JSON.stringify(data.completedTasks));
        }
        this.syncWithDisk();
        return true;
      }
    } catch (e) {
      console.error('Import error:', e);
    }
    return false;
  }
};

if (typeof window !== 'undefined') {
  window.Storage = Storage;
}
