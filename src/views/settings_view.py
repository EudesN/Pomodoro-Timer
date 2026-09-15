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


class SettingsWindow(ctk.CTkToplevel):
    def __init__(self, main_window, pomodoro):
        super().__init__(main_window)
        self.main_window = main_window
        self.pomodoro = pomodoro

        self.title("Settings")
        self.geometry("360x420")
        self.resizable(False, False)
        self.configure(fg_color=BG)

        self._build_ui()
        self.grab_set()

    def _build_ui(self):
        ctk.CTkLabel(
            self, text="Timer Settings",
            font=("Arial Rounded MT Bold", 16),
            text_color=TEXT_WHITE,
        ).pack(pady=(26, 18))

        fields = [
            ("Pomodoro (min)",        "work_time",             self.main_window.pomodoro.work_time // 60),
            ("Short Break (min)",     "short_break",           self.main_window.pomodoro.short_break // 60),
            ("Long Break (min)",      "long_break",            self.main_window.pomodoro.long_break // 60),
            ("Cycles to Long Break",  "cycles_to_long_break",  self.main_window.pomodoro.cycles_to_long_break),
        ]

        self._entries = {}

        for label_text, key, current in fields:
            row = ctk.CTkFrame(self, fg_color=CARD, corner_radius=8)
            row.pack(fill="x", padx=28, pady=5)

            ctk.CTkLabel(
                row, text=label_text,
                font=("Arial", 12), text_color=TEXT_DIM,
                anchor="w",
            ).pack(side="left", padx=14, pady=10)

            entry = ctk.CTkEntry(
                row, width=64, height=30,
                fg_color=TAB_ACTIVE, border_width=0,
                text_color=TEXT_WHITE,
                font=("Arial", 13), justify="center", corner_radius=6,
            )
            entry.insert(0, str(current))
            entry.pack(side="right", padx=12, pady=8)
            self._entries[key] = entry

        # Separador
        ctk.CTkFrame(self, fg_color=HOVER, height=1).pack(fill="x", padx=28, pady=(16, 14))

        ctk.CTkButton(
            self, text="Save Changes",
            command=self._save,
            height=44, corner_radius=8,
            fg_color=BTN_BG, hover_color="#f0f0f0",
            text_color=BTN_FG,
            font=("Arial Rounded MT Bold", 14),
        ).pack(fill="x", padx=28, pady=(0, 22))

    def _save(self):
        try:
            new_settings = {
                "work_time": int(self._entries["work_time"].get()) * 60,
                "short_break": int(self._entries["short_break"].get()) * 60,
                "long_break": int(self._entries["long_break"].get()) * 60,
                "cycles_to_long_break": int(self._entries["cycles_to_long_break"].get()),
            }
            self.pomodoro.apply_settings(new_settings)

            if not self.main_window.is_timer_running:
                self.main_window.pomodoro_ctrl.change_timer_mode(self.pomodoro.current_mode)

            self.destroy()
        except ValueError:
            print("Erro: Informe números inteiros válidos")

    def save_values(self):  
        self._save()