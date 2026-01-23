class Pomodoro:
    #Contrutor padrão
    def __init__(self, work_time = 1500, short_break = 300, long_break = 900, cycles_to_long_break = 4, current_mode = "Work", session_completed_cycles = 0):
        self.work_time = work_time # padrão 25 min de tempo de trabalho
        self.short_break = short_break  # padrão 5 minutos de intervalo curto
        self.long_break = long_break # 15 minutos de descanso longo
        self.cycles_to_long_break = cycles_to_long_break # contador de ciclos para a pausa longa
        self.current_mode = current_mode # Armazena uma string q indica o timer atual exibido
        self.session_completed_cycles = session_completed_cycles # Contador global de pomodoros feitos na sessão

    def set_work_time(self, new_work_time):
        self.work_time = new_work_time

    def set_short_break(self, new_short_break):
        self.short_break = new_short_break

    def set_long_break(self, new_long_break):
        self.long_break = new_long_break

    def set_cycles_to_long_break(self, new_cycles_to_long_break):
        self.cycles_to_long_break = new_cycles_to_long_break

    def set_current_mode(self, new_current_mode):
        self.current_mode = new_current_mode

    def get_current_mode(self):
        return self.current_mode

    def get_current_time(self):
        if self.current_mode == "Work":
            return self.work_time
        elif self.current_mode == "Short":
            return self.short_break
        elif self.current_mode == "Long":
            return self.long_break

# usado para mudar o timer atual a UI
    def switch_timer(self):
        if self.current_mode == "Work":
            self.session_completed_cycles += 1
            if self.session_completed_cycles %self.cycles_to_long_break == 0:
                self.set_current_mode("Long")
            else:
                self.set_current_mode("Short")
        elif self.current_mode == "Short" or self.current_mode == "Long":
            self.set_current_mode("Work")

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

        if self.current_index_task == index:
            removed_active = index

        self.list_tasks.pop(index)

        if not self.list_tasks:
            self.current_index_task = None
            return

        if removed_active:
            self.current_index_task = None
            return

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

    def task_counter(self):
        count = 0
        for task in self.list_tasks:
            count += 1
        return count












