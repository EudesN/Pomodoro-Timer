import customtkinter as ctk

BG         = "#BA4949"
CARD       = "#C75C5C"
TAB_ACTIVE = "#9B3C3C"
HOVER      = "#CF6E6E"
TEXT_WHITE = "#FFFFFF"
TEXT_DIM   = "#E8A8A8"
BTN_BG     = "#FFFFFF"
BTN_FG     = "#BA4949"


class TaskWindow(ctk.CTkToplevel):
    def __init__(self, main_window, task_manager):
        super().__init__(main_window)
        self.main_window = main_window
        self.task_manager = task_manager

        self.title("New Task")
        self.geometry("360x290")
        self.resizable(False, False)
        self.configure(fg_color=BG)

        self.attributes("-topmost", True)
        self.grab_set()
        self._build_ui()

    def _build_ui(self):
        ctk.CTkLabel(
            self, text="What are you focusing on?",
            font=("Arial Rounded MT Bold", 15),
            text_color=TEXT_WHITE,
        ).pack(pady=(26, 14))

        self.title_task_entry = ctk.CTkEntry(
            self, height=40,
            fg_color=CARD, border_color=HOVER, border_width=1,
            text_color=TEXT_WHITE,
            font=("Arial", 13), corner_radius=8,
            placeholder_text="Task name...",
            placeholder_text_color=TEXT_DIM,
        )
        self.title_task_entry.pack(fill="x", padx=28)
        self.title_task_entry.focus()

        ctk.CTkLabel(
            self, text="Est. Pomodoros",
            font=("Arial", 12), text_color=TEXT_DIM,
        ).pack(pady=(14, 4))

        self.cycles_entry = ctk.CTkEntry(
            self, width=70, height=36,
            fg_color=CARD, border_color=HOVER, border_width=1,
            text_color=TEXT_WHITE,
            font=("Arial", 13), justify="center", corner_radius=8,
        )
        self.cycles_entry.insert(0, "1")
        self.cycles_entry.pack()

        ctk.CTkButton(
            self, text="Save Task",
            command=self._save,
            height=44, corner_radius=8,
            fg_color=BTN_BG, hover_color="#f0f0f0",
            text_color=BTN_FG,
            font=("Arial Rounded MT Bold", 14),
        ).pack(fill="x", padx=28, pady=(18, 24))

    def _save(self):
        title  = self.title_task_entry.get().strip()
        cycles = self.cycles_entry.get()
        if title and cycles.isdigit():
            self.task_manager.add_task(title, int(cycles))
            self.main_window.refresh_task_list()
            self.destroy()
        else:
            print("Erro: preencha o título e um número válido")

    def save_task(self): 
        self._save()