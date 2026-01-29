class Pomodoro:
    #Contrutor padrão
    def __init__(self, work_time = 1500, short_break = 300, long_break = 900, cycles_to_long_break = 4, current_mode = "Work", session_completed_cycles = 0):
        self.work_time = work_time # padrão 25 min de tempo de trabalho
        self.short_break = short_break  # padrão 5 minutos de intervalo curto
        self.long_break = long_break # 15 minutos de descanso longo
        self.cycles_to_long_break = cycles_to_long_break # contador de ciclos para a pausa longa
        self.current_mode = current_mode # Armazena uma string q indica o timer atual exibido
        self.session_completed_cycles = session_completed_cycles # Contador global de pomodoros feitos na sessão

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
