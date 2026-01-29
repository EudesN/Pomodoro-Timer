class Task:
    def __init__(self, title, total_cycles, completed_cycles = 0):
        self.title = title
        self.total_cycles = total_cycles
        self.completed_cycles = completed_cycles
        self.completed = False

class TaskManager:
    def __init__(self, current_index_task = None):
        self.list_tasks = []
        self.current_index_task = current_index_task

    def add_task(self, title, total_cycles):
        new_task = Task(title, total_cycles)
        self.list_tasks.append(new_task)

        if len(self.list_tasks) == 1:
            self.current_index_task = 0

    def remove_task(self, index):
        if not (0 <= index < len(self.list_tasks)):
            return

        was_active_task = (self.current_index_task == index)
        self.list_tasks.pop(index)

        if not self.list_tasks:
            self.current_index_task = None

        elif was_active_task:
            self.current_index_task = None

        if self.current_index_task is not None and index < self.current_index_task:
            self.current_index_task -= 1


    def get_active_task(self):
        if self.current_index_task is not None and 0 <= self.current_index_task < len(self.list_tasks):
            return self.list_tasks[self.current_index_task]
        return None

    def set_active_task(self, index):
        self.current_index_task = index

    def mark_task_completed(self):
        task = self.get_active_task()
        if task:
            task.completed = True

    def increment_active_task_cycle(self):
        task = self.get_active_task()
        if task is not None:
            if not task.completed:
                task.completed_cycles += 1
                if task.completed_cycles >= task.total_cycles:
                    task.completed = True


    def clear_finished_tasks(self):
        self.list_tasks = [task for task in self.list_tasks if not task.completed]
        self.current_index_task = None


    def task_counter(self):
        count = 0
        for task in self.list_tasks:
            count += 1
        return count












