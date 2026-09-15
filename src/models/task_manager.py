class Task:
    def __init__(self, title, total_cycles, id = None, completed_cycles = 0):
        self.id = id
        self.title = title
        self.total_cycles = total_cycles
        self.completed_cycles = completed_cycles
        self.completed = False

class TaskManager:
    def __init__(self, task_repository, active_task_index = None):
        self.task_repository = task_repository
        self.list_tasks = []
        self.active_task_index = active_task_index
        self.load_tasks()

    def add_task(self, title, total_cycles):
        new_task = Task(title = title, total_cycles = total_cycles)
        saved_task = self.task_repository.add_task(new_task)
        if saved_task:
            self.list_tasks.append(saved_task)
            if len(self.list_tasks) == 1:
                self.active_task_index = 0

    def remove_task(self, index):
        if not (0 <= index < len(self.list_tasks)):
            return

        task = self.list_tasks[index]
        if task.id:
            self.task_repository.remove_task(task.id)

        was_active_task = (self.active_task_index == index)
        self.list_tasks.pop(index)

        if not self.list_tasks:
            self.active_task_index = None

        elif was_active_task:
            self.active_task_index = None

        if self.active_task_index is not None and index < self.active_task_index:
            self.active_task_index -= 1

    def load_tasks(self):
        self.list_tasks = self.task_repository.get_all_tasks()
        if self.list_tasks and self.active_task_index is None:
            for i, task in enumerate(self.list_tasks):
                if not task.completed:
                    self.active_task_index = i
                    break


    def get_active_task(self):
        if self.active_task_index is not None and 0 <= self.active_task_index < len(self.list_tasks):
            return self.list_tasks[self.active_task_index]
        return None

    def set_active_task(self, index):
        self.active_task_index = index

    def mark_task_completed(self):
        task = self.get_active_task()
        if task:
            task.completed = True
            self.task_repository.update_task_progress(task)

    def increment_active_task_cycle(self):
        task = self.get_active_task()
        if task is not None:
            task.completed_cycles += 1
            if task.completed_cycles >= task.total_cycles:
                task.completed = True
            self.task_repository.update_task_progress(task)


    def clear_finished_tasks(self):
        self.task_repository.clear_completed_tasks()
        self.list_tasks = [task for task in self.list_tasks if not task.completed]
        self.active_task_index = None