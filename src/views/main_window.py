import customtkinter as ctk

from models import Pomodoro, TaskManager
from models.pomodoro import TimerMode
from controllers import PomodoroController, TaskController

from repositories import Database, TaskRepository
from config.settings_manager import SettingsManager

from .settings_view import SettingsWindow
from .task_settings_view import TaskSettings
from .task_view import TaskWindow

# ── Paleta Pomofocus ─────────────────────────────────────────
BG           = "#BA4949"   # vermelho principal (fundo)
CARD         = "#C75C5C"   # card do timer (levemente mais claro)
HOVER        = "#CF6E6E"   # hover geral
TAB_ACTIVE   = "#9B3C3C"   # tab/botão ativo (mais escuro)
TAB_HOVER    = "#8A3232"   # hover do tab ativo
TEXT_WHITE   = "#FFFFFF"
TEXT_DIM     = "#E8A8A8"   # texto secundário (branco suave)
BTN_START_BG = "#FFFFFF"
BTN_START_FG = "#BA4949"
TASK_CARD_ACT= "#FFFFFF"   # card de tarefa ativa (branco)
TASK_CARD    = "#C96666"   # card de tarefa normal
SEP          = "#CF6E6E"   # cor do separador
# ─────────────────────────────────────────────────────────────

ctk.set_appearance_mode("light")


class MainWindow(ctk.CTk):
    def __init__(self):
        super().__init__()

        db = Database()
        settings = SettingsManager()
        task_repo = TaskRepository(db)

        self.pomodoro = Pomodoro(settings)
        self.task_manager = TaskManager(task_repo)
        self.pomodoro_ctrl = PomodoroController(self, self.pomodoro, self.task_manager)
        self.task_ctrl = TaskController(self, self.task_manager)

        self.title("Pomodoro")
        self.geometry("520x700")
        self.resizable(False, False)
        self.configure(fg_color=BG)

        self.is_timer_running = False
        self.time_left = self.pomodoro.work_time

        self._build_ui()
        self.update_timer_label()
        self.highlight_button(TimerMode.WORK)
        self.refresh_task_list()

    # ─────────────────────────────────────────────────────────

    def _build_ui(self):
        self._build_header()
        self._build_timer_card()
        self._build_cycle_info()
        self._build_task_section()

    def _build_header(self):
        header = ctk.CTkFrame(self, fg_color="transparent", height=50)
        header.pack(fill="x", padx=22, pady=(14, 6))

        ctk.CTkLabel(
            header, text="● Pomodoro",
            font=("Arial Rounded MT Bold", 17),
            text_color=TEXT_WHITE,
        ).pack(side="left")

        self.btn_settings = ctk.CTkButton(
            header, text="⚙  Settings",
            command=self.open_settings,
            width=100, height=32,
            fg_color=TAB_ACTIVE, hover_color=TAB_HOVER,
            text_color=TEXT_WHITE,
            font=("Arial", 12),
            corner_radius=6,
        )
        self.btn_settings.pack(side="right", padx=(4, 0))

    def _build_timer_card(self):
        card = ctk.CTkFrame(self, fg_color=CARD, corner_radius=14)
        card.pack(fill="x", padx=30, pady=(4, 0))

        # Tabs
        tabs = ctk.CTkFrame(card, fg_color="transparent")
        tabs.pack(pady=(22, 0))

        tab_kw = dict(height=32, corner_radius=6, font=("Arial", 13, "bold"), border_width=0)

        self.work_button = ctk.CTkButton(
            tabs, text="Pomodoro",
            command=lambda: self.pomodoro_ctrl.change_timer_mode(TimerMode.WORK),
            fg_color=TAB_ACTIVE, hover_color=TAB_HOVER,
            text_color=TEXT_WHITE, width=112, **tab_kw,
        )
        self.work_button.pack(side="left", padx=4)

        self.break_button = ctk.CTkButton(
            tabs, text="Short Break",
            command=lambda: self.pomodoro_ctrl.change_timer_mode(TimerMode.SHORT_BREAK),
            fg_color="transparent", hover_color=HOVER,
            text_color=TEXT_DIM, width=112, **tab_kw,
        )
        self.break_button.pack(side="left", padx=4)

        self.long_button = ctk.CTkButton(
            tabs, text="Long Break",
            command=lambda: self.pomodoro_ctrl.change_timer_mode(TimerMode.LONG_BREAK),
            fg_color="transparent", hover_color=HOVER,
            text_color=TEXT_DIM, width=112, **tab_kw,
        )
        self.long_button.pack(side="left", padx=4)

        # Contador
        self.time_label = ctk.CTkLabel(
            card, text="00:00",
            font=("Arial Rounded MT Bold", 96, "bold"),
            text_color=TEXT_WHITE,
        )
        self.time_label.pack(pady=(12, 10))

        # START
        self.start_button = ctk.CTkButton(
            card, text="START",
            command=self.pomodoro_ctrl.toggle_timer,
            width=210, height=54,
            fg_color=BTN_START_BG, hover_color="#f0f0f0",
            text_color=BTN_START_FG,
            font=("Arial Rounded MT Bold", 18),
            corner_radius=8,
        )
        self.start_button.pack(pady=(0, 28))

    def _build_cycle_info(self):
        info = ctk.CTkFrame(self, fg_color="transparent")
        info.pack(pady=(10, 2))

        self.session_cycles_info = ctk.CTkLabel(
            info, text=f"#{self.pomodoro.session_completed_cycles}",
            font=("Arial", 12), text_color=TEXT_DIM,
        )
        self.session_cycles_info.pack()

        ctk.CTkLabel(
            info, text="Time to focus!",
            font=("Arial", 14, "bold"), text_color=TEXT_WHITE,
        ).pack()

    def _build_task_section(self):
        # Cabeçalho Tasks
        hdr = ctk.CTkFrame(self, fg_color="transparent", height=36)
        hdr.pack(fill="x", padx=30, pady=(12, 0))

        ctk.CTkLabel(
            hdr, text="Tasks",
            font=("Arial", 15, "bold"), text_color=TEXT_WHITE,
        ).pack(side="left")

        ctk.CTkButton(
            hdr, text="⋮",
            command=self.open_tasks_settings,
            width=32, height=28,
            fg_color=TAB_ACTIVE, hover_color=TAB_HOVER,
            text_color=TEXT_WHITE, font=("Arial", 16),
            corner_radius=6,
        ).pack(side="right")

        # Separador
        ctk.CTkFrame(self, fg_color=SEP, height=1).pack(fill="x", padx=30, pady=(4, 4))

        # Lista
        self.task_container = ctk.CTkScrollableFrame(
            self, fg_color="transparent",
            scrollbar_button_color=HOVER,
            scrollbar_button_hover_color=TAB_ACTIVE,
        )
        self.task_container.pack(fill="both", expand=True, padx=30)

        # Botão adicionar
        self.add_task_button = ctk.CTkButton(
            self, text="+ Add Task",
            command=self.open_add_new_task,
            height=44,
            fg_color="transparent", hover_color=HOVER,
            text_color=TEXT_WHITE,
            font=("Arial", 13),
            corner_radius=8,
            border_width=2, border_color=HOVER,
        )
        self.add_task_button.pack(fill="x", padx=30, pady=(6, 18))

    # ── Métodos públicos ─────────────────────────────────────

    def highlight_button(self, active_mode):
        on  = {"fg_color": TAB_ACTIVE, "text_color": TEXT_WHITE, "hover_color": TAB_HOVER}
        off = {"fg_color": "transparent", "text_color": TEXT_DIM, "hover_color": HOVER}

        self.work_button.configure(**(on  if active_mode == TimerMode.WORK        else off))
        self.break_button.configure(**(on if active_mode == TimerMode.SHORT_BREAK else off))
        self.long_button.configure(**(on  if active_mode == TimerMode.LONG_BREAK  else off))

    def update_timer_label(self):
        m, s = divmod(self.time_left, 60)
        self.time_label.configure(text=f"{m:02d}:{s:02d}")

    def update_session_cycles_info(self):
        self.session_cycles_info.configure(text=f"#{self.pomodoro.session_completed_cycles}")

    def open_settings(self):        SettingsWindow(self, self.pomodoro)
    def open_add_new_task(self):    TaskWindow(self, self.task_manager)
    def open_tasks_settings(self):  TaskSettings(self, self.task_manager)

    def refresh_task_list(self):
        for w in self.task_container.winfo_children():
            w.destroy()
        for idx, task in enumerate(self.task_manager.list_tasks):
            self._draw_task_card(idx, task)

    def _draw_task_card(self, index, task):
        is_active = index == self.task_manager.active_task_index

        card = ctk.CTkFrame(
            self.task_container,
            fg_color=TASK_CARD_ACT if is_active else TASK_CARD,
            corner_radius=8, height=54,
        )
        card.pack(fill="x", pady=4)
        card.pack_propagate(False)

        title_col = BTN_START_FG if is_active else TEXT_WHITE
        dim_col   = "#BA4949"    if is_active else TEXT_DIM

        # ícone
        check = ctk.CTkLabel(
            card, text="✓" if task.completed else "○",
            font=("Arial", 16),
            text_color="#4CAF50" if task.completed else dim_col, width=32,
        )
        check.pack(side="left", padx=(12, 4))

        # título
        lbl_title = ctk.CTkLabel(
            card, text=task.title,
            font=("Arial", 13, "bold"), text_color=title_col,
        )
        lbl_title.pack(side="left", pady=16)

        # ciclos
        lbl_count = ctk.CTkLabel(
            card, text=f"{task.completed_cycles}/{task.total_cycles}",
            font=("Arial", 11), text_color=dim_col,
        )
        lbl_count.pack(side="right", padx=(0, 6))

        # remover
        btn_remove = ctk.CTkButton(
            card, text="Remove",
            command=lambda: self.task_ctrl.remove_task(index),
            width=28, height=28,
            fg_color="transparent",
            hover_color="#f0f0f0" if is_active else HOVER,
            text_color=dim_col, font=("Arial", 12), corner_radius=6,
        )
        btn_remove.pack(side="right", padx=4)

        cmd = lambda e: self.task_ctrl.on_task_click(index)
        for w in (card, check, lbl_title, lbl_count):
            w.bind("<Button-1>", cmd)