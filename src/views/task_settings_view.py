import customtkinter as ctk

BG         = "#BA4949"
CARD       = "#C75C5C"
TAB_ACTIVE = "#9B3C3C"
TAB_HOVER  = "#8A3232"
HOVER      = "#CF6E6E"
TEXT_WHITE = "#FFFFFF"
TEXT_DIM   = "#E8A8A8"
BTN_BG     = "#FFFFFF"
BTN_FG     = "#BA4949"


class TaskSettings(ctk.CTkToplevel):
    def __init__(self, main_window, task_manager):
        super().__init__(main_window)
        self.main_window = main_window
        self.task_manager = task_manager

        self.title("Task Settings")
        self.geometry("300x210")
        self.resizable(False, False)
        self.configure(fg_color=BG)

        self.attributes("-topmost", True)
        self.grab_set()
        self._build_ui()

    def _build_ui(self):
        ctk.CTkLabel(
            self, text="Task Settings",
            font=("Arial Rounded MT Bold", 16),
            text_color=TEXT_WHITE,
        ).pack(pady=(26, 6))

        ctk.CTkLabel(
            self, text="Manage your task list",
            font=("Arial", 12), text_color=TEXT_DIM,
        ).pack(pady=(0, 18))

        ctk.CTkFrame(self, fg_color=HOVER, height=1).pack(fill="x", padx=28, pady=(0, 16))

        ctk.CTkButton(
            self, text="Clear Finished Tasks",
            command=self._clear_finished,
            height=42, corner_radius=8,
            fg_color=BTN_BG, hover_color="#f0f0f0",
            text_color=BTN_FG,
            font=("Arial Rounded MT Bold", 13),
        ).pack(fill="x", padx=28, pady=(0, 22))

    def _clear_finished(self):
        self.task_manager.clear_finished_tasks()
        self.main_window.refresh_task_list()

    def clear_finished(self):  # compatibilidade
        self._clear_finished()