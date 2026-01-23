import customtkinter as ctk
import main

ctk.set_appearance_mode('dark')
ctk.set_default_color_theme("blue")

class App(ctk.CTk):
    def __init__(self):
        super().__init__()
        self.pomodoro = main.Pomodoro()
        self.task_manager = main.TaskManager()

        self.title('Pomodoro')
        self.geometry('800x650')
        self.configure(fg_color="#BA4949")

# Variáveis
        self.is_timer_running = False
        self.time_left = self.pomodoro.work_time

#  Header
        self.header = ctk.CTkFrame(self, fg_color="#BA4949", height=60)
        self.header.pack(fill= "x", pady = (0, 10))

# Botão config
        self.btn_settings = ctk.CTkButton(master= self.header, text="Settings", command=self.open_settings,
                                          width=100, fg_color="white")
        self.btn_settings.pack(side="right")

# TImer
        self.timer_frame = ctk.CTkFrame(master=self, fg_color="#c96262", corner_radius=20, width=450, height=350)
        self.timer_frame.pack(pady=10, padx=20)
        self.timer_frame.propagate(False)

        self.buttons_frame = ctk.CTkFrame(self.timer_frame, fg_color="transparent")
        self.buttons_frame.pack(pady=(30, 10))

        self.work_button = ctk.CTkButton(self.buttons_frame, text="Pomodoro", command=lambda: self.change_timer_mode("Work"),
                                         fg_color="#a44e4e", hover_color="#8f4444", width=80, font=("Arial", 14, "bold"))
        self.work_button.pack(side="left", padx=5)

        self.break_button = ctk.CTkButton(self.buttons_frame, text="Short Break", command=lambda: self.change_timer_mode("Short"),
                                          fg_color="transparent", hover_color="#ba4949", width=80, font=("Arial", 14, "bold"))
        self.break_button.pack(side="left", padx=5)

        self.long_button = ctk.CTkButton(self.buttons_frame, text="Long Break", command=lambda: self.change_timer_mode("Long"),
                                         fg_color="transparent", hover_color="#ba4949", width=80, font=("Arial", 14, "bold"))
        self.long_button.pack(side="left", padx=5)
# Contador
        self.time_label = ctk.CTkLabel(self.timer_frame, text="00:00", font=("Arial Rounded MT Bold", 100,
                                                                             "bold"), text_color="white")
        self.time_label.pack(pady=(20, 20))

# Informações do ciclo
        self.session_cycles_info = ctk.CTkLabel(master= self.timer_frame, text= f"#{self.pomodoro.session_completed_cycles}", font=("Arial", 14
                                                , "bold"), text_color= "white")
        self.session_cycles_info.place(relx=0.5, rely=0.65, anchor="center")

# Botão start
        self.start_button = ctk.CTkButton(self.timer_frame, text="START", command=self.toggle_timer,
                                          width=200, height=60,
                                          fg_color="white", text_color="#BA4949", hover_color="#f0f0f0",
                                          font=("Arial", 22, "bold"))
        self.start_button.pack(side="bottom", pady=40)

#Task
        self.add_task_button = ctk.CTkButton(self, text="+ Add Task", command=self.open_add_new_task,
                                             height=50, fg_color="#BA4949",
                                             border_width=2, border_color="#BA4949",
                                             border_spacing=10, hover_color="#BA4949", text_color="white")
        self.add_task_button.pack(side="bottom", fill="x", padx=40, pady=20)


        self.task_label = ctk.CTkLabel(self, text="Tasks", font=("Arial", 18, "bold"), text_color="white")
        self.task_label.pack(pady=(5, 5))


        self.task_container = ctk.CTkScrollableFrame(self, fg_color="transparent")
        self.task_container.pack(fill="both", expand=True, padx=20, pady=5)


        self.update_timer_label()
        self.highlight_button("Work")


    #def switch_active_task(self):

    def change_timer_mode(self, mode):
        self.pomodoro.set_current_mode(mode)
        self.highlight_button(mode)

        self.time_left = self.pomodoro.get_current_time()

        self.is_timer_running = False # Reseta o timer ao mudar de modo
        self.start_button.configure(text="START")
        self.update_timer_label()

    def highlight_button(self, active_mode):

        transparent = "transparent"
        active_color = "#a44e4e"

        if active_mode == "Work":
            self.work_button.configure(fg_color=active_color)
            self.break_button.configure(fg_color=transparent)
            self.long_button.configure(fg_color=transparent)
        elif active_mode == "Short":
            self.work_button.configure(fg_color=transparent)
            self.break_button.configure(fg_color=active_color)
            self.long_button.configure(fg_color=transparent)
        else:
            self.work_button.configure(fg_color=transparent)
            self.break_button.configure(fg_color=transparent)
            self.long_button.configure(fg_color=active_color)

    def toggle_timer(self):
        if not self.is_timer_running:
            self.is_timer_running = True
            self.start_button.configure(text="PAUSE")
            self.countdown()
        else:
            self.is_timer_running = False
            self.start_button.configure(text="START")

    def countdown(self):
        if self.is_timer_running and self.time_left > 0:
            self.time_left -= 1
            self.update_timer_label()
            self.after(1000, self.countdown)
        elif self.time_left == 0:
            self.is_timer_running = False
            self.start_button.configure(text="START")


            if self.pomodoro.get_current_mode() == "Work":
                self.task_manager.increment_active_task_cycle()
                self.refresh_task_list()

            self.pomodoro.switch_timer() # mudar de modo

            self.update_session_cycles_info() #atualizar o contador de ciclos totais da sessão
            self.change_timer_mode(self.pomodoro.get_current_mode()) # atualizar o modo de tempo da UI

    def update_timer_label(self):
        minutes = self.time_left // 60
        seconds = self.time_left % 60
        self.time_label.configure(text=f"{minutes:02d}:{seconds:02d}")

    def open_settings(self):
        SettingsWindow(self, self.pomodoro)

    def open_add_new_task(self):
        TaskWindow(self, self.task_manager)

    def refresh_task_list(self):
        for widget in self.task_container.winfo_children():
            widget.destroy()

        for index, task in enumerate(self.task_manager.list_tasks):
            self.draw_task_card(index, task)

    def draw_task_card(self, index, task):

        # Define as cores da borda baseado no estado
        if index == self.task_manager.current_index_task:
            current_border_color = "#000000"  # Cor de destaque
            current_border_width = 3  # Largura da borda visível
        else:
            current_border_color = "#FFFFFF"   # Cor qualquer
            current_border_width = 0  # Sem largura

        #Cria o Frame
        card = ctk.CTkFrame(self.task_container, fg_color="white", corner_radius=10, height=50,
                            border_color=current_border_color, border_width=current_border_width)
        card.pack(fill="x", pady=5)

        # Ícone
        if task.completed:
            icon = "✅"
            icon_color = "#4caf50"  # Verde
        else:
            icon = "⭕"
            icon_color = "#ccc"  # Cinza

        check = ctk.CTkLabel(card, text=icon, font=("Arial", 20), text_color=icon_color)
        check.pack(side="left", padx=10)

        # Título
        lbl_title = ctk.CTkLabel(card, text=task.title, font=("Arial", 14, "bold"), text_color="#555")
        lbl_title.pack(side="left", pady=15)

        # Contador
        count_text = f"{task.completed_cycles}/{task.total_cycles}"
        lbl_count = ctk.CTkLabel(card, text=count_text, font=("Arial", 14), text_color="#999")
        lbl_count.pack(side="right", padx=15)

        command = lambda event: self.on_task_click(index)

        card.bind("<Button-1>", command)
        check.bind("<Button-1>", command)
        lbl_title.bind("<Button-1>", command)
        lbl_count.bind("<Button-1>", command)

    def update_session_cycles_info(self):
        self.session_cycles_info.configure(text = f"#{self.pomodoro.session_completed_cycles}")

    def on_task_click(self, index):
        self.task_manager.set_active_task(index)
        self.refresh_task_list()


class SettingsWindow(ctk.CTkToplevel):
    def __init__(self, main_window, pomodoro):
        super().__init__(main_window)
        self.main_window = main_window
        self.pomodoro = pomodoro

        self.title("Settings")
        self.geometry("300x300")
        self.resizable(False, False)

        self.pomodoro_label = ctk.CTkLabel(self, text= "Pomodoro(min)")
        self.pomodoro_label.pack(pady = (20, 0))
        self.pomodoro_entry = ctk.CTkEntry(self, width=100)
        self.pomodoro_entry.pack()
        current_work = self.main_window.pomodoro.work_time // 60
        self.pomodoro_entry.insert(0, str(current_work))

        self.short_label = ctk.CTkLabel(self, text="Short Break(min)")
        self.short_label.pack(pady = (20, 0))
        self.short_entry = ctk.CTkEntry(self, width= 100)
        self.short_entry.pack()
        current_short = self.main_window.pomodoro.short_break // 60
        self.short_entry.insert(0, str(current_short))

        self.long_label = ctk.CTkLabel(self, text="Long Break(min)")
        self.long_label.pack()
        self.long_entry = ctk.CTkEntry(self, width= 100)
        self.long_entry.pack()
        current_long = self.main_window.pomodoro.long_break // 60
        self.long_entry.insert(0, str(current_long))

        save_button = ctk.CTkButton(self, text="Save", command=self.save_values)
        save_button.pack(pady=10)

        self.grab_set()

    def save_values(self):
        try:
            new_pomodoro = int(self.pomodoro_entry.get()) * 60
            new_short = int(self.short_entry.get()) * 60
            new_long = int(self.long_entry.get()) * 60

            self.main_window.pomodoro.set_work_time(new_pomodoro)
            self.main_window.pomodoro.set_short_break(new_short)
            self.main_window.pomodoro.set_long_break(new_long)

            current_mode = self.pomodoro.get_current_mode()

            if not self.main_window.is_timer_running:
                self.main_window.change_timer_mode(current_mode)

            self.destroy()

        except ValueError:
            print("Erro: Informe números inteiros")


    #def change_timer_colors(self):

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


if __name__ == "__main__":
    app = App()
    app.mainloop()