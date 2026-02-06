class Pomodoro:
    #Contrutor padrão
    def __init__(self, repository, current_mode = "Work", session_completed_cycles = 0):

        self.settings_repository = repository
        settings = repository.load_settings()

        self.work_time = settings["work_time"]
        self.short_break = settings["short_break"]
        self.long_break = settings["long_break"]
        self.cycles_to_long_break = settings["cycles_to_long_break"]

        # contador de ciclos da sessão
        self.session_completed_cycles = session_completed_cycles

        self.current_mode = current_mode

    def set_work_time(self, new_work_time):
        self.work_time = new_work_time

    def set_short_break(self, new_short_break):
        self.short_break = new_short_break

    def set_long_break(self, new_long_break):
        self.long_break = new_long_break

    def set_cycles_to_long_break(self, new_cycles_to_long_break):
        self.cycles_to_long_break = new_cycles_to_long_break

    def set_current_mode(self, new_current_mode):
        self.current_mode = new_current_mode

    def get_current_mode(self):
        return self.current_mode

    def get_current_time(self):
        if self.current_mode == "Work":
            return self.work_time
        elif self.current_mode == "Short":
            return self.short_break
        elif self.current_mode == "Long":
            return self.long_break

# usado para mudar o timer atual a UI
    def switch_timer(self):
        if self.current_mode == "Work":
            self.session_completed_cycles += 1
            if self.session_completed_cycles %self.cycles_to_long_break == 0:
                self.set_current_mode("Long")
            else:
                self.set_current_mode("Short")
        elif self.current_mode == "Short" or self.current_mode == "Long":
            self.set_current_mode("Work")

# metodo para atualizar os valores no banco de dados
    def apply_settings(self, new_settings):
        self.work_time = new_settings["work_time"]
        self.short_break = new_settings["short_break"]
        self.long_break = new_settings["long_break"]
        self.cycles_to_long_break = new_settings["cycles_to_long_break"]

        self.settings_repository.save_settings(new_settings)

        