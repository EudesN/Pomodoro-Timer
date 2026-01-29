import customtkinter as ctk


class TaskWindow(ctk.CTkToplevel):
    def __init__(self, main_window, task_manager):
        super().__init__(main_window)
        self.main_window = main_window
        self.task_manager = task_manager

        self.title("Task Manager")
        self.geometry("300x250")

        self.attributes("-topmost", True)
        self.grab_set()

        self.title_task_label = ctk.CTkLabel(self, text="What are we going to focus on now?").pack(pady = (20, 5))
        self.title_task_entry = ctk.CTkEntry(self, width= 200)
        self.title_task_entry.pack()
        self.title_task_entry.focus()

        self.cycles_task_label = ctk.CTkLabel(self, text="Est. Pomodoros").pack(pady = (15, 5))
        self.cycles_entry = ctk.CTkEntry(self, width= 80)
        self.cycles_entry.insert(0, "1") # valor padrão
        self.cycles_entry.pack()

        self.save_button = ctk.CTkButton(self, text= "Save", command= self.save_task, fg_color="#444", hover_color="#333")
        self.save_button.pack(pady = 20)


    def save_task(self):
        title = self.title_task_entry.get()
        cycles = self.cycles_entry.get()

        if title and cycles.isdigit():
            self.task_manager.add_task(title, int(cycles))

            self.main_window.refresh_task_list()
            self.destroy()

        else:
            print("Erro: Digite um título e número válido")
