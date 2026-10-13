/**
 * CALENDAR MODULE - POPOMUS
 * Manages the Calendar tab view displaying all completed tasks of all time.
 * Supports interactive monthly grid, date selection, all-time list, search,
 * sorting, task reopening, and real-time synchronization with timer.
 */

const Calendar = {
  // Calendar State
  state: {
    currentYear: new Date().getFullYear(),
    currentMonth: new Date().getMonth(), // 0 - 11
    selectedDateStr: null, // 'YYYY-MM-DD'
    activeSubTab: 'month', // 'month' | 'all'
    searchQuery: '',
    sortBy: 'recent' // 'recent' | 'oldest' | 'pomos' | 'alpha'
  },

  // DOM Elements cache
  elements: {},

  init() {
    // Default selected date to today
    const now = new Date();
    this.state.currentYear = now.getFullYear();
    this.state.currentMonth = now.getMonth();
    this.state.selectedDateStr = Storage._formatLocalDate(now);

    this._cacheElements();
    this._bindEvents();
    this.render();
  },

  _cacheElements() {
    this.elements = {
      // Views and Navigation
      container: document.getElementById('statsPanelCalendar') || document.getElementById('calendarViewContainer'),
      navBadge: document.getElementById('statsModalCalBadge') || document.getElementById('calendarNavBadge'),
      activeTimerPill: document.getElementById('calendarActiveTimerPill'),
      timerPillDigits: document.getElementById('calTimerPillDigits'),
      timerPillMode: document.getElementById('calTimerPillMode'),
      timerPillTask: document.getElementById('calTimerPillTask'),
      btnReturnToTimer: document.getElementById('btnCalReturnToTimer'),

      // Summary Stats
      statTotalCompleted: document.getElementById('calStatTotalCompleted'),
      statTotalPomos: document.getElementById('calStatTotalPomos'),
      statTotalHours: document.getElementById('calStatTotalHours'),
      statProductiveDays: document.getElementById('calStatProductiveDays'),

      // Month Header Navigation
      monthTitle: document.getElementById('calMonthTitle'),
      btnPrevMonth: document.getElementById('btnCalPrevMonth'),
      btnNextMonth: document.getElementById('btnCalNextMonth'),
      btnToday: document.getElementById('btnCalToday'),

      // Sub-Tabs
      subTabMonth: document.getElementById('calSubTabMonth'),
      subTabAll: document.getElementById('calSubTabAll'),
      panelMonthView: document.getElementById('calPanelMonthView'),
      panelAllView: document.getElementById('calPanelAllView'),

      // Calendar Grid
      daysGrid: document.getElementById('calDaysGrid'),

      // Selected Day Details
      selectedDayTitle: document.getElementById('calSelectedDayTitle'),
      selectedDayBadge: document.getElementById('calSelectedDayBadge'),
      dayTasksList: document.getElementById('calDayTasksList'),

      // All-Time Section
      searchInput: document.getElementById('calSearchInput'),
      sortSelect: document.getElementById('calSortSelect'),
      allTasksList: document.getElementById('calAllTasksList'),
      allTasksCountBadge: document.getElementById('calAllTasksCountBadge')
    };
  },

  _bindEvents() {
    const el = this.elements;

    // Month Navigation
    if (el.btnPrevMonth) {
      el.btnPrevMonth.addEventListener('click', () => {
        this.changeMonth(-1);
      });
    }

    if (el.btnNextMonth) {
      el.btnNextMonth.addEventListener('click', () => {
        this.changeMonth(1);
      });
    }

    if (el.btnToday) {
      el.btnToday.addEventListener('click', () => {
        const today = new Date();
        this.state.currentYear = today.getFullYear();
        this.state.currentMonth = today.getMonth();
        this.state.selectedDateStr = Storage._formatLocalDate(today);
        this.render();
      });
    }

    // Sub-Tabs Switcher
    if (el.subTabMonth && el.subTabAll) {
      el.subTabMonth.addEventListener('click', () => {
        this.switchSubTab('month');
      });

      el.subTabAll.addEventListener('click', () => {
        this.switchSubTab('all');
      });
    }

    // Search and Sort in All-Time View
    if (el.searchInput) {
      el.searchInput.addEventListener('input', (e) => {
        this.state.searchQuery = e.target.value.trim().toLowerCase();
        this.renderAllTasksList();
      });
    }

    if (el.sortSelect) {
      el.sortSelect.addEventListener('change', (e) => {
        this.state.sortBy = e.target.value;
        this.renderAllTasksList();
      });
    }

    // Return to Timer button from pill
    if (el.btnReturnToTimer) {
      el.btnReturnToTimer.addEventListener('click', () => {
        if (typeof window.switchMainView === 'function') {
          window.switchMainView('timer');
        }
      });
    }
  },

  changeMonth(delta) {
    let m = this.state.currentMonth + delta;
    let y = this.state.currentYear;

    if (m < 0) {
      m = 11;
      y -= 1;
    } else if (m > 11) {
      m = 0;
      y += 1;
    }

    this.state.currentMonth = m;
    this.state.currentYear = y;
    this.render();
  },

  switchSubTab(tabName) {
    this.state.activeSubTab = tabName;
    const el = this.elements;

    if (tabName === 'month') {
      if (el.subTabMonth) el.subTabMonth.classList.add('active');
      if (el.subTabAll) el.subTabAll.classList.remove('active');
      if (el.panelMonthView) el.panelMonthView.style.display = 'block';
      if (el.panelAllView) el.panelAllView.style.display = 'none';
    } else {
      if (el.subTabMonth) el.subTabMonth.classList.remove('active');
      if (el.subTabAll) el.subTabAll.classList.add('active');
      if (el.panelMonthView) el.panelMonthView.style.display = 'none';
      if (el.panelAllView) el.panelAllView.style.display = 'block';
      this.renderAllTasksList();
    }
  },

  /**
   * Main render method
   */
  render() {
    const allCompleted = Storage.getAllCompletedTasks();

    // 1. Update navigation badge
    if (this.elements.navBadge) {
      this.elements.navBadge.textContent = allCompleted.length;
      this.elements.navBadge.style.display = allCompleted.length > 0 ? 'inline-block' : 'none';
    }

    // 2. Render Header Metrics
    this.renderMetrics(allCompleted);

    // 3. Render Month Grid
    this.renderMonthGrid(allCompleted);

    // 4. Render Tasks for the Selected Day
    this.renderDayTasks(allCompleted);

    // 5. Render All-Time Tasks List lazily only when that sub-tab is currently active
    if (this.state.activeSubTab === 'all') {
      this.renderAllTasksList(allCompleted);
    }

    // 6. Update Active Timer Pill if running
    this.updateTimerPill();
  },

  /**
   * Render 4 summary metric badges
   */
  renderMetrics(allCompleted) {
    const el = this.elements;
    const count = allCompleted.length;
    const totalPomos = allCompleted.reduce((acc, t) => acc + (t.actCycles || 0), 0);
    const totalMinutes = allCompleted.reduce((acc, t) => acc + (t.totalMinutes || ((t.actCycles || 0) * 25)), 0);
    const totalHours = Number((totalMinutes / 60).toFixed(1));

    // Unique productive days
    const uniqueDays = new Set(allCompleted.map(t => t.completedDate).filter(Boolean));
    const productiveDaysCount = uniqueDays.size;

    const settings = typeof Storage !== 'undefined' && typeof Storage.getSettings === 'function'
      ? Storage.getSettings()
      : { rollingAnimation: true };
    const useRoll = (typeof animateRollingCounter === 'function') && (settings.rollingAnimation !== false);

    if (useRoll) {
      if (el.statTotalCompleted) animateRollingCounter(el.statTotalCompleted, count, 380, '');
      if (el.statTotalPomos) animateRollingCounter(el.statTotalPomos, totalPomos, 380, '');
      if (el.statTotalHours) animateRollingCounter(el.statTotalHours, totalHours, 380, 'h');
      if (el.statProductiveDays) animateRollingCounter(el.statProductiveDays, productiveDaysCount, 380, ' d');
    } else {
      if (el.statTotalCompleted) el.statTotalCompleted.textContent = count;
      if (el.statTotalPomos) el.statTotalPomos.textContent = totalPomos;
      if (el.statTotalHours) el.statTotalHours.textContent = `${totalHours}h`;
      if (el.statProductiveDays) el.statProductiveDays.textContent = `${productiveDaysCount} d`;
    }

    if (el.allTasksCountBadge) el.allTasksCountBadge.textContent = count;
  },

  /**
   * Render the interactive Month Grid
   */
  renderMonthGrid(allCompleted) {
    const el = this.elements;
    if (!el.daysGrid || !el.monthTitle) return;

    const y = this.state.currentYear;
    const m = this.state.currentMonth;

    // Format month title (e.g. "October 2026")
    const dateObj = new Date(y, m, 1);
    const monthName = dateObj.toLocaleDateString('en-US', { month: 'long' });
    const formattedTitle = `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${y}`;
    el.monthTitle.textContent = formattedTitle;

    // Index tasks by date key 'YYYY-MM-DD'
    const tasksByDate = new Map();
    allCompleted.forEach(task => {
      const dKey = task.completedDate;
      if (dKey) {
        if (!tasksByDate.has(dKey)) tasksByDate.set(dKey, []);
        tasksByDate.get(dKey).push(task);
      }
    });

    el.daysGrid.innerHTML = '';

    const firstDayIndex = new Date(y, m, 1).getDay(); // 0 is Sunday
    const daysInCurrentMonth = new Date(y, m + 1, 0).getDate();
    const daysInPrevMonth = new Date(y, m, 0).getDate();

    const todayStr = Storage._formatLocalDate(new Date());

    // 1. Previous Month Overflow days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const prevDate = new Date(y, m - 1, dayNum);
      const prevDateStr = Storage._formatLocalDate(prevDate);
      const cell = this._createDayCell(dayNum, prevDateStr, tasksByDate, todayStr, true);
      el.daysGrid.appendChild(cell);
    }

    // 2. Current Month days
    for (let day = 1; day <= daysInCurrentMonth; day++) {
      const curDate = new Date(y, m, day);
      const curDateStr = Storage._formatLocalDate(curDate);
      const cell = this._createDayCell(day, curDateStr, tasksByDate, todayStr, false);
      el.daysGrid.appendChild(cell);
    }

    // 3. Next Month Overflow days to fill complete grid (multiples of 7)
    const totalCellsSoFar = firstDayIndex + daysInCurrentMonth;
    const remainingCells = (totalCellsSoFar % 7 === 0) ? 0 : 7 - (totalCellsSoFar % 7);
    for (let nextDay = 1; nextDay <= remainingCells; nextDay++) {
      const nextDate = new Date(y, m + 1, nextDay);
      const nextDateStr = Storage._formatLocalDate(nextDate);
      const cell = this._createDayCell(nextDay, nextDateStr, tasksByDate, todayStr, true);
      el.daysGrid.appendChild(cell);
    }
  },

  _createDayCell(dayNum, dateStr, tasksByDate, todayStr, isOtherMonth) {
    const tasksOnDay = tasksByDate.get(dateStr) || [];
    const taskCount = tasksOnDay.length;
    const isToday = dateStr === todayStr;
    const isSelected = dateStr === this.state.selectedDateStr;

    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = `cal-day-cell ${isOtherMonth ? 'is-other-month' : ''} ${isToday ? 'is-today' : ''} ${isSelected ? 'is-selected' : ''} ${taskCount > 0 ? 'has-tasks' : ''}`;
    cell.dataset.date = dateStr;
    cell.setAttribute('aria-label', `${dayNum} - ${taskCount} completed task${taskCount !== 1 ? 's' : ''}`);

    let badgeHtml = '';
    if (taskCount > 0) {
      badgeHtml = `
        <span class="cal-day-badge" title="${taskCount} completed task${taskCount !== 1 ? 's' : ''}">
          <svg viewBox="0 0 24 24" class="cal-badge-check"><polyline points="20 6 9 17 4 12"></polyline></svg>
          <span>${taskCount}</span>
        </span>
      `;
    }

    cell.innerHTML = `
      <span class="cal-day-num">${dayNum}</span>
      ${badgeHtml}
    `;

    cell.addEventListener('click', () => {
      this.state.selectedDateStr = dateStr;
      // If clicking an other-month cell, navigate to that month
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const cellY = parseInt(parts[0], 10);
        const cellM = parseInt(parts[1], 10) - 1;
        if (cellY !== this.state.currentYear || cellM !== this.state.currentMonth) {
          this.state.currentYear = cellY;
          this.state.currentMonth = cellM;
        }
      }
      this.render();
    });

    return cell;
  },

  /**
   * Render tasks completed on the currently selected day
   */
  renderDayTasks(allCompleted = null) {
    const el = this.elements;
    if (!el.dayTasksList) return;

    if (!allCompleted) {
      allCompleted = Storage.getAllCompletedTasks();
    }

    const selDateStr = this.state.selectedDateStr;
    const tasksOnDay = allCompleted.filter(t => t.completedDate === selDateStr);

    // Format selected day title
    if (el.selectedDayTitle) {
      if (selDateStr) {
        const [y, m, d] = selDateStr.split('-').map(Number);
        const dateObj = new Date(y, m - 1, d);
        const formatted = dateObj.toLocaleDateString('en-US', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        });
        el.selectedDayTitle.textContent = formatted.charAt(0).toUpperCase() + formatted.slice(1);
      } else {
        el.selectedDayTitle.textContent = 'Selected Day';
      }
    }

    if (el.selectedDayBadge) {
      el.selectedDayBadge.textContent = `${tasksOnDay.length} task${tasksOnDay.length !== 1 ? 's' : ''}`;
    }

    el.dayTasksList.innerHTML = '';

    if (tasksOnDay.length === 0) {
      el.dayTasksList.innerHTML = `
        <div class="cal-empty-state">
          <svg class="cal-empty-icon" viewBox="0 0 24 24">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
            <path d="M9 16l2 2 4-4"></path>
          </svg>
          <div class="cal-empty-title">No completed tasks on this day</div>
          <div class="cal-empty-desc">Tasks completed on the timer or marked done will appear here automatically.</div>
        </div>
      `;
      return;
    }

    tasksOnDay.forEach(task => {
      const card = this._createTaskCard(task);
      el.dayTasksList.appendChild(card);
    });
  },

  /**
   * Render All-Time Completed Tasks list with search & sorting
   */
  renderAllTasksList(allCompleted = null) {
    const el = this.elements;
    if (!el.allTasksList) return;

    if (!allCompleted) {
      allCompleted = Storage.getAllCompletedTasks();
    }

    let filtered = [...allCompleted];

    // Filter by search query
    if (this.state.searchQuery) {
      filtered = filtered.filter(t => (t.title || '').toLowerCase().includes(this.state.searchQuery));
    }

    // Sort
    const sort = this.state.sortBy;
    if (sort === 'recent') {
      filtered.sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));
    } else if (sort === 'oldest') {
      filtered.sort((a, b) => (a.completedAt || 0) - (b.completedAt || 0));
    } else if (sort === 'pomos') {
      filtered.sort((a, b) => (b.actCycles || 0) - (a.actCycles || 0));
    } else if (sort === 'alpha') {
      filtered.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    }

    el.allTasksList.innerHTML = '';

    if (filtered.length === 0) {
      const isSearching = !!this.state.searchQuery;
      el.allTasksList.innerHTML = `
        <div class="cal-empty-state">
          <svg class="cal-empty-icon" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <div class="cal-empty-title">${isSearching ? 'No tasks found' : 'No completed tasks yet'}</div>
          <div class="cal-empty-desc">${isSearching ? 'Try searching with a different term or clear the filter.' : 'Complete focus cycles and mark tasks done to build your history here!'}</div>
        </div>
      `;
      return;
    }

    // Group tasks by completion date for organized display
    let lastDateKey = null;

    filtered.forEach(task => {
      const dateKey = task.completedDate;
      if (sort === 'recent' || sort === 'oldest') {
        if (dateKey && dateKey !== lastDateKey) {
          lastDateKey = dateKey;
          const [y, m, d] = dateKey.split('-').map(Number);
          const dateObj = new Date(y, m - 1, d);
          const groupTitle = dateObj.toLocaleDateString('en-US', {
            weekday: 'short',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
          });

          const groupDivider = document.createElement('div');
          groupDivider.className = 'cal-history-date-header';
          groupDivider.innerHTML = `
            <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
            <span>${groupTitle.charAt(0).toUpperCase() + groupTitle.slice(1)}</span>
          `;
          el.allTasksList.appendChild(groupDivider);
        }
      }

      const card = this._createTaskCard(task, true);
      el.allTasksList.appendChild(card);
    });
  },

  /**
   * Helper to build a completed task card element
   */
  _createTaskCard(task, showFullDateBadge = false) {
    const card = document.createElement('div');
    card.className = 'cal-task-card';
    card.dataset.id = task.id;

    const act = task.actCycles || 0;
    const est = task.estCycles || 1;
    const timeFormatted = task.completedTimeFormatted || '--:--';
    const dateFormatted = task.completedDate || '';
    const durationFormatted = task.durationFormatted || (task.totalMinutes ? `${task.totalMinutes}m` : (act > 0 ? `${act * 25}m` : '25m'));

    let dateBadgeHtml = '';
    if (showFullDateBadge && dateFormatted) {
      dateBadgeHtml = `<span class="cal-task-date-pill">${dateFormatted} • ${timeFormatted}</span>`;
    } else {
      dateBadgeHtml = `<span class="cal-task-date-pill">${timeFormatted}</span>`;
    }

    card.innerHTML = `
      <div class="cal-task-left">
        <div class="cal-task-check-circle" title="Task completed">
          <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
        </div>
        <div class="cal-task-info">
          <span class="cal-task-title" title="${this._escapeHtml(task.title)}">${this._escapeHtml(task.title)}</span>
          <div class="cal-task-meta">
            <span class="cal-task-time-badge" title="Total focus time on this task">
              <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
              <strong>${durationFormatted}</strong>
            </span>
            ${dateBadgeHtml}
            <span class="cal-task-pomos-pill" title="Completed Pomodoros">
              ${act} pomo${act !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </div>

      <div class="cal-task-right">
        <button class="cal-btn-reopen" type="button" title="Reopen this task in the Timer active list" data-action="reopen">
          <svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg>
          <span>Reopen</span>
        </button>
      </div>
    `;

    // Action listener for reopening task
    const btnReopen = card.querySelector('[data-action="reopen"]');
    if (btnReopen) {
      btnReopen.addEventListener('click', (e) => {
        e.stopPropagation();
        this.reopenTask(task);
      });
    }

    return card;
  },

  /**
   * Reopen a completed task, putting it back into active tasks in the Timer tab
   */
  reopenTask(task) {
    if (!task || !task.id) return;

    let tasks = Storage.getTasks();
    const existingIndex = tasks.findIndex(t => t.id === task.id);

    if (existingIndex !== -1) {
      tasks[existingIndex].completed = false;
      tasks[existingIndex].manuallyUnchecked = true;
    } else {
      // Add back to active task list
      tasks.push({
        id: task.id,
        title: task.title,
        estCycles: task.estCycles || 1,
        actCycles: task.actCycles || 0,
        completed: false,
        manuallyUnchecked: true,
        createdAt: task.createdAt || Date.now()
      });
    }

    Storage.setActiveTaskId(task.id);
    Storage.saveTasks(tasks);

    // Refresh tasks in app.js if present
    if (typeof window.renderTasks === 'function') {
      window.renderTasks();
    }

    // Close modal if open so user returns to the timer
    const statsDialog = document.getElementById('statsDialog');
    if (statsDialog && statsDialog.open) {
      statsDialog.close();
    }

    this.render();
    this.showToast(`Task "${task.title}" reopened in Timer!`);
  },

  /**
   * Live timer banner update when in Calendar view
   */
  updateTimerPill(modeName, digits, taskTitle, isRunning) {
    const el = this.elements;
    if (!el.activeTimerPill) return;

    if (isRunning && digits) {
      el.activeTimerPill.style.display = 'flex';
      if (el.timerPillDigits) el.timerPillDigits.textContent = digits;
      if (el.timerPillMode) el.timerPillMode.textContent = modeName || 'Pomodoro';
      if (el.timerPillTask) {
        el.timerPillTask.textContent = taskTitle ? `• ${taskTitle}` : '';
      }
    } else {
      el.activeTimerPill.style.display = 'none';
    }
  },

  /**
   * Toast notification feedback
   */
  showToast(message) {
    let toast = document.getElementById('calToastNotification');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'calToastNotification';
      toast.className = 'cal-toast-notification';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(this._toastTimeout);
    this._toastTimeout = setTimeout(() => {
      toast.classList.remove('show');
    }, 2800);
  },

  _escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
};

window.Calendar = Calendar;
