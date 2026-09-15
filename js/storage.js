/**
 * STORAGE MODULE - POMUS
 * Handles localStorage persistence, color themes, disk synchronization,
 * and JSON data export/import.
 */

const STORAGE_KEYS = {
  SETTINGS: 'pomus_settings',
  TASKS: 'pomus_tasks',
  SESSIONS: 'pomus_sessions',
  ACTIVE_TASK: 'pomus_active_task'
};

// Legacy keys migration helper
const LEGACY_KEYS = {
  SETTINGS: 'pomodoro_settings',
  TASKS: 'pomodoro_tasks',
  SESSIONS: 'pomodoro_sessions',
  ACTIVE_TASK: 'pomodoro_active_task'
};

const DEFAULT_SETTINGS = {
  workTime: 25,          // minutes
  shortBreakTime: 5,     // minutes
  longBreakTime: 15,     // minutes
  cyclesToLongBreak: 4,  // count
  autoStartBreaks: false,
  autoStartPomodoros: false,
  alarmSound: 'bell',    // bell, zen, beep, marimba
  soundVolume: 0.8,
  tickSound: false,
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

  // --- Settings ---
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

  // --- Tasks ---
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

  // --- Focus Sessions Log ---
  getSessions() {
    this._migrate();
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SESSIONS);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Error loading sessions:', e);
      return [];
    }
  },

  saveSessions(sessions) {
    try {
      localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));
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

  getMetricsSummary(daysCount = 7) {
    const dailyData = this.getDailyFocusData(daysCount);
    const sessions = this.getSessions();

    const totalMinutes = dailyData.reduce((acc, curr) => acc + curr.minutes, 0);
    const totalHours = Number((totalMinutes / 60).toFixed(1));
    const totalSessions = dailyData.reduce((acc, curr) => acc + curr.sessionsCount, 0);
    const dailyAverageHours = Number((totalHours / daysCount).toFixed(1));

    let streak = 0;
    const allSessions = [...sessions];
    const uniqueDaysWithFocus = new Set(allSessions.filter(s => s.durationMinutes > 0).map(s => {
      return s.date || (s.timestamp ? this._formatLocalDate(new Date(s.timestamp)) : '');
    }));

    const checkDate = new Date();
    const todayStr = this._formatLocalDate(checkDate);
    
    if (!uniqueDaysWithFocus.has(todayStr)) {
      checkDate.setDate(checkDate.getDate() - 1);
    }

    while (true) {
      const dStr = checkDate.toISOString().split('T')[0];
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
    localStorage.removeItem(STORAGE_KEYS.SESSIONS);
    this.syncWithDisk();
  },

  // --- Disk Synchronization (Bridge with python app.py) ---
  syncDebounceTimer: null,
  syncWithDisk(immediate = false) {
    if (!window.location.protocol.startsWith('http')) return;

    const doSync = () => {
      clearTimeout(this.syncDebounceTimer);
      const payload = {
        settings: this.getSettings(),
        tasks: this.getTasks(),
        sessions: this.getSessions(),
        activeTaskId: this.getActiveTaskId(),
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
          return updated;
        }
      }
    } catch (e) {
      console.warn('[Storage] Não foi possível carregar dados do disco:', e);
    }
    return false;
  },

  // --- Export & Import ---
  exportData() {
    const payload = {
      app: 'Popomus',
      version: '2.0',
      exportedAt: new Date().toISOString(),
      settings: this.getSettings(),
      tasks: this.getTasks(),
      sessions: this.getSessions(),
      activeTaskId: this.getActiveTaskId()
    };
    return JSON.stringify(payload, null, 2);
  },

  importData(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      if (data && typeof data === 'object') {
        if (data.settings) localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(data.settings));
        if (Array.isArray(data.tasks)) localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(data.tasks));
        if (Array.isArray(data.sessions)) localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(data.sessions));
        if (data.activeTaskId) localStorage.setItem(STORAGE_KEYS.ACTIVE_TASK, data.activeTaskId);
        this.syncWithDisk();
        return true;
      }
    } catch (e) {
      console.error('Import error:', e);
    }
    return false;
  }
};
