class Pomodoro:
    #Contrutor padrão
    def __init__(self, work_time = 1500, short_break = 300, long_break = 900, cycles = 1, current_mode = "Work"):
        self.work_time = work_time
        self.short_break = short_break  # padrão 5 minutos de intervalo curto
        self.long_break = long_break # 15 minutos de descanso longo
        self.cycles = cycles
        self.current_mode = current_mode

    def set_work_time(self, new_work_time):
        self.work_time = new_work_time

    def set_short_break(self, new_short_break):
        self.short_break = new_short_break

    def set_long_break(self, new_long_break):
        self.long_break = new_long_break

    def set_cycles(self, new_cycles):
        self.cycles = new_cycles

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




















