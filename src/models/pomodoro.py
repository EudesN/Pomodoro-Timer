from enum import Enum

class TimerMode(Enum):
    WORK = "Work"
    SHORT_BREAK = "Short"
    LONG_BREAK = "Long"

class Pomodoro:
    #Contrutor padrão
    def __init__(self, manager, current_mode = TimerMode.WORK, session_completed_cycles = 0):

        self.settings_manager = manager
        settings = manager.load_settings()

        self.work_time = settings["work_time"]
        self.short_break = settings["short_break"]
        self.long_break = settings["long_break"]
        self.cycles_to_long_break = settings["cycles_to_long_break"]

        # contador de ciclos da sessão como um todo
        self.session_completed_cycles = session_completed_cycles

        self.current_mode = current_mode

    def get_current_time(self):
        if self.current_mode == TimerMode.WORK:
            return self.work_time
        elif self.current_mode == TimerMode.SHORT_BREAK:
            return self.short_break
        elif self.current_mode == TimerMode.LONG_BREAK:
            return self.long_break

# usado para mudar o timer atual a UI
    def switch_timer(self):
        if self.current_mode == TimerMode.WORK:
            self.session_completed_cycles += 1
            if self.session_completed_cycles %self.cycles_to_long_break == 0:
                self.current_mode = TimerMode.LONG_BREAK
            else:
                self.current_mode = TimerMode.SHORT_BREAK
        elif self.current_mode in (TimerMode.SHORT_BREAK, TimerMode.LONG_BREAK):
            self.current_mode = TimerMode.WORK

# metodo para atualizar os valores no banco de dados    
    def apply_settings(self, new_settings):
        self.work_time = new_settings["work_time"]
        self.short_break = new_settings["short_break"]
        self.long_break = new_settings["long_break"]
        self.cycles_to_long_break = new_settings["cycles_to_long_break"]

        self.settings_manager.save_settings(new_settings)