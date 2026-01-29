import customtkinter as ctk

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

            self.pomodoro.set_work_time(new_pomodoro)
            self.pomodoro.set_short_break(new_short)
            self.pomodoro.set_long_break(new_long)

            current_mode = self.pomodoro.get_current_mode()

            if not self.main_window.is_timer_running:
                self.main_window.pomodoro_ctrl.change_timer_mode(current_mode)
            self.destroy()

        except ValueError:
            print("Erro: Informe números inteiros")


    #def change_timer_colors(self):
