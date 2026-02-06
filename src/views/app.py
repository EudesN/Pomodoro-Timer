import customtkinter as ctk

from controllers.task_controller import TaskController
from models import Pomodoro, TaskManager
from controllers.pomodoro_controller import PomodoroController
from .settings_view import SettingsWindow
from .task_view import TaskWindow
from .task_settings_view import TaskSettings

from database.settings_repository import SettingsRepository
from database.database import Database

class App(ctk.CTk):
    def __init__(self):
        super().__init__()

        db = Database()
        settings_repo = SettingsRepository(db)

# instancia Models
        self.pomodoro = Pomodoro(settings_repo)
        self.task_manager = TaskManager()
#instância Controllers
        self.pomodoro_ctrl = PomodoroController(self, self.pomodoro, self.task_manager)
        self.task_ctrl = TaskController(self, self.task_manager)

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
                                          width=100, fg_color="white", text_color="#BA4949", hover_color= "#f1dada", font=("Arial Rounded MT Bold", 14))
        self.btn_settings.pack(side="right", padx= 10)

# TImer
        self.timer_frame = ctk.CTkFrame(master=self, fg_color="#c96262", corner_radius=20, width=450, height=350)
        self.timer_frame.pack(pady=10, padx=20)
        self.timer_frame.propagate(False)

        self.buttons_frame = ctk.CTkFrame(self.timer_frame, fg_color="transparent")
        self.buttons_frame.pack(pady=(30, 10))

        self.work_button = ctk.CTkButton(self.buttons_frame, text="Pomodoro", command=lambda: self.pomodoro_ctrl.change_timer_mode("Work"),
                                         fg_color="#a44e4e", hover_color="#8f4444", width=80, font=("Arial", 14, "bold"))
        self.work_button.pack(side="left", padx=5)

        self.break_button = ctk.CTkButton(self.buttons_frame, text="Short Break", command=lambda: self.pomodoro_ctrl.change_timer_mode("Short"),
                                          fg_color="transparent", hover_color="#ba4949", width=80, font=("Arial", 14, "bold"))
        self.break_button.pack(side="left", padx=5)

        self.long_button = ctk.CTkButton(self.buttons_frame, text="Long Break", command=lambda: self.pomodoro_ctrl.change_timer_mode("Long"),
                                         fg_color="transparent", hover_color="#ba4949", width=80, font=("Arial", 14, "bold"))
        self.long_button.pack(side="left", padx=5)

# Contador
        self.time_label = ctk.CTkLabel(self.timer_frame, text="00:00", font=("Arial Rounded MT Bold", 100,
                                                                             "bold"), text_color="white")
        self.time_label.pack(pady=(20, 20))

# Informações do ciclo
        self.session_cycles_info = ctk.CTkLabel(master= self.timer_frame, text= f"#{self.pomodoro.session_completed_cycles}",
                                                font=("Arial", 14, "bold"), text_color= "white")
        self.session_cycles_info.place(relx=0.5, rely=0.65, anchor="center")

# Botão start
        self.start_button = ctk.CTkButton(self.timer_frame, text="START", command=self.pomodoro_ctrl.toggle_timer,
                                          width=200, height=60,
                                          fg_color="white", text_color="#BA4949", hover_color="#f0f0f0",
                                          font=("Arial", 22, "bold"))
        self.start_button.pack(side="bottom", pady=40)

#Task
        self.task_header_frame = ctk.CTkFrame(self, fg_color="transparent", height=40)
        self.task_header_frame.pack(fill="x", padx=20, pady=(5, 5))
        self.task_label = ctk.CTkLabel(self.task_header_frame, text="Tasks", font=("Arial", 18, "bold"), text_color="white")
        self.task_label.place(relx=0.5, rely=0.5, anchor="center")

        self.task_settings_button = ctk.CTkButton(self.task_header_frame, text = "Task Settings", command= self.open_tasks_settings,width= 100,
                                                  fg_color= "white", text_color="#BA4949",
                                                  hover_color= "#f1dada", font=("Arial Rounded MT Bold", 14))
        self.task_settings_button.place(relx=1.0, rely=0.5, anchor="e")

        self.add_task_button = ctk.CTkButton(self, text="+ Add Task", command=self.open_add_new_task,
                                             height=35, fg_color="#BA4949", border_width=2, border_color="#BA4949",
                                             border_spacing=10, hover_color="#a84343",font=("Arial Rounded MT Bold", 14),
                                             text_color="white")
        self.add_task_button.pack(side="bottom", fill="x", padx=40, pady=10)


        self.task_container = ctk.CTkScrollableFrame(self, fg_color="transparent")
        self.task_container.pack(fill="both", expand=True, padx=20, pady=5)

        self.update_timer_label()
        self.highlight_button("Work")


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

    def update_timer_label(self):
        minutes = self.time_left // 60
        seconds = self.time_left % 60
        self.time_label.configure(text=f"{minutes:02d}:{seconds:02d}")

    def open_settings(self):
        SettingsWindow(self, self.pomodoro)

    def open_add_new_task(self):
        TaskWindow(self, self.task_manager)

    def open_tasks_settings(self):
        TaskSettings(self, self.task_manager)

    def refresh_task_list(self):
        for widget in self.task_container.winfo_children():
            widget.destroy()

        for index, task in enumerate(self.task_manager.list_tasks):
            self.draw_task_card(index, task)

    def draw_task_card(self, index, task):

        # Define as cores da borda baseado no estado
        if index == self.task_manager.current_index_task:
            current_border_color = "#49baba"  # Cor de destaque
            current_border_width = 2  # Largura da borda visível
            current_title_font = ("Arial", 14, "bold")
            current_text_color = "#BA4949"
            current_card_fg_color = "#fff5f5"
        else:
            current_border_color = "#FFFFFF"   # Cor qualquer
            current_border_width = 0  # Sem largura
            current_title_font = ("Arial", 14)
            current_text_color = "#555555"
            current_card_fg_color = "white"

        #Cria o Frame
        card = ctk.CTkFrame(self.task_container, fg_color= current_card_fg_color, corner_radius=10, height=50,
                            border_color=current_border_color, border_width=current_border_width)
        card.pack(fill="x", pady=5)

        remove_task_button = ctk.CTkButton(master= card, text = "Remove", command= lambda: self.task_ctrl.remove_task(index),
                                                  width= 100, fg_color= current_card_fg_color, text_color= "#BA4949", hover_color="#f0f0f0",
                                           font=("Arial", 14, "bold"))
        remove_task_button.pack(side="right", padx=5)

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
        lbl_title = ctk.CTkLabel(card, text=task.title, font=current_title_font, text_color="#555")
        lbl_title.pack(side="left", pady=15)

        # Contador
        count_text = f"{task.completed_cycles}/{task.total_cycles}"
        lbl_count = ctk.CTkLabel(card, text=count_text, font=("Arial", 14), text_color="#999")
        lbl_count.pack(side="right", padx=15)

        command = lambda event: self.task_ctrl.on_task_click(index)

        card.bind("<Button-1>", command)
        check.bind("<Button-1>", command)
        lbl_title.bind("<Button-1>", command)
        lbl_count.bind("<Button-1>", command)

    def update_session_cycles_info(self):
        self.session_cycles_info.configure(text = f"#{self.pomodoro.session_completed_cycles}")
