import models


class TaskController:
    def __init__(self, view, task_manager):
        self.view = view
        self.task_manager = task_manager

    def remove_task(self, index):
        self.task_manager.remove_task(index)
        self.view.refresh_task_list()

#Define a tarefa como ativa e atualiza a UI
    def on_task_click(self, index):
        self.task_manager.set_active_task(index)
        self.view.refresh_task_list()





