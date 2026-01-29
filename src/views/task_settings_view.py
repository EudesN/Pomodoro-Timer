import customtkinter as ctk

class TaskSettings(ctk.CTkToplevel):
    def __init__(self, main_window, task_manager):
        super().__init__(main_window)
        self.main_window = main_window
        self.task_manager = task_manager

        self.title("Tasks Settings")
        self.geometry("300x250")
        self.attributes("-topmost", True)
        self.grab_set()

        self.clear_finished_button = ctk.CTkButton(self, text="Clear finished tasks", command= self.clear_finished,
                                         fg_color="white",text_color="black", hover_color="#ba4949", width=80,
                                         font=("Arial", 14, "bold"))
        self.clear_finished_button.pack(padx=5, pady=10)


    def clear_finished(self):
        self.task_manager.clear_finished_tasks()
        self.main_window.refresh_task_list()