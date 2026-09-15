/**
 * CHART & STATS VISUALIZATION MODULE - POPOMUS
 * Stacked sub-bars per task with dedicated times, matching timer typography.
 * Tooltips are completely disabled per user preference.
 */

var focusChartInstance = null;
var currentPeriodDays = 7;

const TASK_PALETTE = [
  { bg: '#da4d4f', border: '#ffffff' }, // Pomo Red
  { bg: '#f39336', border: '#ffffff' }, // Amber Orange
  { bg: '#38a3a5', border: '#ffffff' }, // Ocean Teal
  { bg: '#9b5de5', border: '#ffffff' }, // Soft Purple
  { bg: '#2a9d8f', border: '#ffffff' }, // Pine Green
  { bg: '#e76f51', border: '#ffffff' }, // Coral
  { bg: '#eab66a', border: '#ffffff' }, // Warm Gold
  { bg: '#457b9d', border: '#ffffff' }, // Steel Blue
  { bg: '#f15bb5', border: '#ffffff' }, // Rose Pink
  { bg: '#57cc99', border: '#ffffff' }, // Mint Green
  { bg: '#80ced6', border: '#ffffff' }, // Light Aqua
  { bg: '#d4a373', border: '#ffffff' }, // Caramel Sand
];

function getTaskColor(index) {
  if (index < TASK_PALETTE.length) {
    return TASK_PALETTE[index];
  }
  const hue = Math.round((index * 137.5) % 360);
  return {
    bg: `hsl(${hue}, 68%, 54%)`,
    border: '#ffffff'
  };
}

// Custom plugin to draw time labels directly on and above bars (no tooltip needed)
const barLabelsPlugin = {
  id: 'barLabelsPlugin',
  afterDatasetsDraw(chart) {
    const ctx = chart.ctx;
    const datasets = chart.data.datasets;
    if (!datasets || datasets.length === 0) return;

    const labelsCount = chart.data.labels.length;
    const timerFont = "700 10px 'Manrope', 'Plus Jakarta Sans', system-ui, sans-serif";
    const headerFont = "800 11px 'Manrope', 'Plus Jakarta Sans', system-ui, sans-serif";

    // 1. Draw segment time labels inside each sub-bar (if height >= 14px)
    datasets.forEach((ds, dsIndex) => {
      const meta = chart.getDatasetMeta(dsIndex);
      if (meta.hidden) return;

      meta.data.forEach((bar, dataIdx) => {
        const val = ds.data[dataIdx];
        if (!val || val <= 0) return;

        const totalMinutes = Math.round(val * 60);
        const h = Math.floor(totalMinutes / 60);
        const m = totalMinutes % 60;
        const text = h > 0 ? (m > 0 ? `${h}h${m}m` : `${h}h`) : `${m}m`;

        const barHeight = Math.abs(bar.base - bar.y);
        if (barHeight >= 14) {
          ctx.save();
          ctx.font = timerFont;
          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const centerY = (bar.y + bar.base) / 2;
          ctx.fillText(text, bar.x, centerY);
          ctx.restore();
        }
      });
    });

    // 2. Draw total day focus time above the topmost sub-bar of each day
    for (let i = 0; i < labelsCount; i++) {
      let totalDayHours = 0;
      let topY = Infinity;
      let barX = null;

      datasets.forEach((ds, dsIndex) => {
        const val = ds.data[i] || 0;
        totalDayHours += val;
        const meta = chart.getDatasetMeta(dsIndex);
        if (meta && meta.data[i] && val > 0) {
          const bar = meta.data[i];
          barX = bar.x;
          if (bar.y < topY) {
            topY = bar.y;
          }
        }
      });

      if (totalDayHours > 0 && barX !== null && isFinite(topY)) {
        const totalMinutes = Math.round(totalDayHours * 60);
        const h = Math.floor(totalMinutes / 60);
        const m = totalMinutes % 60;
        const totalText = h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`;

        ctx.save();
        ctx.font = headerFont;
        ctx.fillStyle = '#333333';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(totalText, barX, Math.max(topY - 4, 12));
        ctx.restore();
      }
    }
  }
};

const StatsChart = {
  /**
   * Initialize or re-render the focus hours chart with stacked sub-bars per task
   * @param {number} daysCount - 7, 14, or 30
   */
  renderChart(daysCount = currentPeriodDays) {
    currentPeriodDays = daysCount;
    const canvas = document.getElementById('focusHoursChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const dailyData = Storage.getDailyFocusData(daysCount);
    const labels = dailyData.map(d => d.label);

    // Aggregate unique tasks and total time across the period
    const taskStatsMap = new Map();
    dailyData.forEach(day => {
      if (day.tasks) {
        Object.entries(day.tasks).forEach(([title, tData]) => {
          const prev = taskStatsMap.get(title) || { totalMinutes: 0, sessionsCount: 0 };
          prev.totalMinutes += tData.minutes;
          prev.sessionsCount += tData.sessionsCount;
          taskStatsMap.set(title, prev);
        });
      }
    });

    // Sort tasks by total time descending
    const sortedTaskTitles = Array.from(taskStatsMap.keys()).sort((a, b) => {
      return taskStatsMap.get(b).totalMinutes - taskStatsMap.get(a).totalMinutes;
    });

    // Compute maximum day focus hours to adapt Y-axis scale smoothly
    const maxDayHours = Math.max(...dailyData.map(d => d.hours), 0);
    let ySuggestedMax = 1.0;
    let yStepSize = 0.25;

    if (maxDayHours <= 0.5) {
      ySuggestedMax = 0.5;
      yStepSize = 0.25;
    } else if (maxDayHours <= 1.0) {
      ySuggestedMax = 1.0;
      yStepSize = 0.25;
    } else if (maxDayHours <= 2.0) {
      ySuggestedMax = 2.0;
      yStepSize = 0.5;
    } else {
      ySuggestedMax = Math.ceil(maxDayHours * 1.2);
      yStepSize = 1.0;
    }

    // Build datasets
    const taskColorMap = new Map();
    sortedTaskTitles.forEach((title, idx) => {
      taskColorMap.set(title, getTaskColor(idx));
    });

    let datasets = [];

    if (sortedTaskTitles.length === 0) {
      datasets = [{
        label: 'Focus Hours',
        data: dailyData.map(() => 0),
        backgroundColor: 'rgba(218, 77, 79, 0.4)',
        borderColor: '#ffffff',
        borderWidth: 2,
        borderRadius: 4,
        stack: 'dailyTasks',
        barPercentage: daysCount === 30 ? 0.85 : 0.65,
        categoryPercentage: 0.8
      }];
    } else {
      datasets = sortedTaskTitles.map(taskTitle => {
        const color = taskColorMap.get(taskTitle);
        const dataForDays = dailyData.map(d => {
          if (d.tasks && d.tasks[taskTitle]) {
            return d.tasks[taskTitle].hours;
          }
          return 0;
        });

        return {
          label: taskTitle,
          data: dataForDays,
          backgroundColor: color.bg,
          borderColor: '#ffffff',
          borderWidth: 2,
          borderRadius: 4,
          borderSkipped: false,
          stack: 'dailyTasks',
          barPercentage: daysCount === 30 ? 0.85 : 0.65,
          categoryPercentage: 0.8
        };
      });
    }

    if (focusChartInstance) {
      focusChartInstance.destroy();
    }

    const timerFontFamily = "'Manrope', 'Plus Jakarta Sans', system-ui, sans-serif";

    focusChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: datasets
      },
      plugins: [barLabelsPlugin],
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 300,
          easing: 'easeOutQuart'
        },
        interaction: {
          mode: 'nearest',
          intersect: false
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            enabled: false // All tooltips disabled per user request
          }
        },
        scales: {
          x: {
            stacked: true,
            grid: {
              display: false
            },
            ticks: {
              color: '#d5c3b1',
              font: {
                family: timerFontFamily,
                size: daysCount === 30 ? 9 : 11,
                weight: '600'
              },
              maxRotation: daysCount === 30 ? 45 : 0,
              minRotation: 0
            }
          },
          y: {
            stacked: true,
            beginAtZero: true,
            suggestedMax: ySuggestedMax,
            grid: {
              color: 'rgba(250, 236, 201, 0.08)',
              drawBorder: false
            },
            ticks: {
              color: '#9c8a7e',
              font: {
                family: timerFontFamily,
                size: 11,
                weight: '600'
              },
              stepSize: yStepSize,
              callback: function(value) {
                if (value === 0) return '0';
                if (value < 1) return Math.round(value * 60) + 'm';
                return value + 'h';
              }
            }
          }
        }
      }
    });

    window.focusChartInstance = focusChartInstance;

    this.renderDailyBreakdown(dailyData, taskColorMap);
    this.updateMetrics(daysCount);
    this.renderSessionLog();
  },

  /**
   * Renders a clear breakdown of each day and its tasks with dedicated times
   * Directly on the UI without requiring any tooltip.
   */
  renderDailyBreakdown(dailyData, taskColorMap) {
    const legendEl = document.getElementById('chartTasksLegend');
    if (!legendEl) return;

    // Filter only days that actually have focus time
    const activeDays = dailyData.filter(d => d.minutes > 0).reverse();

    if (activeDays.length === 0) {
      legendEl.innerHTML = '';
      legendEl.style.display = 'none';
      return;
    }

    legendEl.style.display = 'flex';
    legendEl.className = 'chart-tasks-legend';

    legendEl.innerHTML = `
      <div class="daily-breakdown-container">
        ${activeDays.map(day => {
          const dayH = Math.floor(day.minutes / 60);
          const dayM = day.minutes % 60;
          const dayTimeStr = dayH > 0 ? `${dayH}h ${dayM > 0 ? dayM + 'm' : ''}` : `${dayM} min`;
          const tasksEntries = Object.entries(day.tasks || {}).sort((a, b) => b[1].minutes - a[1].minutes);

          return `
            <div class="day-breakdown-card">
              <div class="day-breakdown-header">
                <span class="day-breakdown-date">${this._escapeHtml(day.label)}</span>
                <span class="day-breakdown-total">${dayTimeStr}</span>
              </div>
              <div class="day-breakdown-tasks">
                ${tasksEntries.map(([title, tData]) => {
                  const color = taskColorMap.get(title) || { bg: '#da4d4f' };
                  const th = Math.floor(tData.minutes / 60);
                  const tm = tData.minutes % 60;
                  const tTime = th > 0 ? `${th}h ${tm > 0 ? tm + 'm' : ''}` : `${tm}m`;
                  return `
                    <div class="day-task-item">
                      <span class="day-task-dot" style="background-color: ${color.bg};"></span>
                      <span class="day-task-title">${this._escapeHtml(title)}:</span>
                      <span class="day-task-time">${tTime}</span>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  },

  updateMetrics(daysCount) {
    const summary = Storage.getMetricsSummary(daysCount);

    const totalHoursEl = document.getElementById('statTotalHours');
    const avgHoursEl = document.getElementById('statAvgHours');
    const streakEl = document.getElementById('statStreak');
    const totalPomosEl = document.getElementById('statTotalPomos');

    if (totalHoursEl) totalHoursEl.textContent = `${summary.totalHours}h`;
    if (avgHoursEl) avgHoursEl.textContent = `${summary.dailyAverageHours}h`;
    if (streakEl) streakEl.textContent = `${summary.streak} ${summary.streak === 1 ? 'day' : 'days'}`;
    if (totalPomosEl) totalPomosEl.textContent = summary.totalSessions;
  },

  renderSessionLog() {
    const listEl = document.getElementById('historyLogList');
    if (!listEl) return;

    const sessions = Storage.getSessions().slice(0, 10);

    if (sessions.length === 0) {
      listEl.innerHTML = `
        <div class="empty-tasks-state">
          No sessions logged yet. Complete your first focus session to view your history.
        </div>
      `;
      return;
    }

    listEl.innerHTML = sessions.map(sess => {
      let dateParts = [];
      if (sess.date) {
        dateParts = sess.date.split('-');
      } else if (sess.timestamp) {
        const d = new Date(sess.timestamp);
        dateParts = [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')];
      }
      const formattedDate = dateParts.length === 3 ? `${dateParts[1]}/${dateParts[2]}` : (sess.date || '');

      return `
        <div class="history-log-item">
          <div>
            <div class="history-log-task">${this._escapeHtml(sess.taskTitle || 'Foco Geral')}</div>
            <div class="history-log-meta">${formattedDate} at ${sess.timeFormatted || '--:--'}</div>
          </div>
          <div class="history-log-duration">+${sess.durationMinutes} min</div>
        </div>
      `;
    }).join('');
  },

  _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
};

window.StatsChart = StatsChart;
