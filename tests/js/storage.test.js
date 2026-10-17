const test = require('node:test');
const assert = require('node:assert/strict');
const { load, global } = require('./helpers');

load('storage.js');
const Storage = global('Storage');
const STORAGE_KEYS = global('STORAGE_KEYS');

test.beforeEach(() => {
  localStorage.clear();
  Storage._sessionsCache = null;
});

test('backups store raw history, not entries derived from the session log', () => {
  Storage.logCompletedSession(25, 'Deep work');
  Storage.recordCompletedTask({ id: 'task_1', title: 'Write report', actCycles: 2, estCycles: 2 });

  const titlesShown = Storage.getAllCompletedTasks().map(t => t.title).sort();
  assert.deepEqual(titlesShown, ['Deep work', 'Write report']);

  const backup = JSON.parse(Storage.exportData());
  assert.deepEqual(backup.completedHistory.map(t => t.id), ['task_1']);
});

test('clearing history also clears it from the calendar after a reload of old data', () => {
  // Data written by older versions: session aggregates saved as completed tasks
  localStorage.setItem(STORAGE_KEYS.COMPLETED_HISTORY, JSON.stringify([
    { id: 'sess_task_2026-01-01_Deep_work', title: 'Deep work', completedDate: '2026-01-01', fromDatabase: true },
    { id: 'task_1', title: 'Write report', completedDate: '2026-01-01', fromDatabase: true, durationFormatted: '50m' }
  ]));
  Storage.logCompletedSession(25, 'Deep work');

  Storage.clearHistory();

  const remaining = Storage.getAllCompletedTasks();
  assert.deepEqual(remaining.map(t => t.title), ['Write report']);
  const [record] = Storage.getCompletedTasksHistory();
  assert.equal('fromDatabase' in record, false, 'display-only fields are stripped');
  assert.equal('durationFormatted' in record, false);
});

test('importData rejects files that are not backups', () => {
  assert.equal(Storage.importData('{"hello": "world"}'), false);
  assert.equal(Storage.importData('[1, 2, 3]'), false);
  assert.equal(Storage.importData('not json'), false);
});

test('importData keeps only well-formed tasks', () => {
  const ok = Storage.importData(JSON.stringify({
    tasks: [{ id: 'a', title: 'Valid' }, { title: 'No id' }, 'junk', null]
  }));
  assert.equal(ok, true);
  assert.deepEqual(Storage.getTasks().map(t => t.id), ['a']);
});

test('saveTasks announces the saved list so other views can adopt it', () => {
  const tasks = [{ id: 'x', title: 'Shared' }];
  let received = null;
  const listener = (e) => { received = e.detail.tasks; };
  window.addEventListener('pomus:tasks-changed', listener);
  Storage.saveTasks(tasks);
  window.removeEventListener('pomus:tasks-changed', listener);
  assert.equal(received, tasks, 'the same array reference lets the owner ignore its own saves');
});

test('sessions without a task are logged as General Focus', () => {
  const session = Storage.logCompletedSession(25);
  assert.equal(session.taskTitle, 'General Focus');
});
