import customtkinter as ctk
import main

ctk.set_appearance_mode('dark')
ctk.set_default_color_theme("blue")

app = ctk.CTk()

class App(ctk.CTk):
    def __init__(self):
        super().__init__()
        self.config = main.Pomodoro()

        self.title('Pomodoro')
        self.geometry('800x600')
        self.configure(fg_color="#BA4949") 

        # Variáveis
        self.timer_running = False
        self.total_seconds = self.config.work_time 

# pagina principal
        self.timer_frame = ctk.CTkFrame(master=self, fg_color="#c96262", corner_radius=20, width=450, height=350)
        self.timer_frame.pack_propagate(False) 
        self.timer_frame.place(relx=0.5, rely=0.4, anchor="center")

        self.buttons_frame = ctk.CTkFrame(self.timer_frame, fg_color="transparent")
        self.buttons_frame.pack(pady=(30, 10)) 

        self.work_button = ctk.CTkButton(self.buttons_frame, text="Pomodoro", command=lambda: self.change_mode("Work"), 
                                         fg_color="#a44e4e", hover_color="#8f4444", width=80, font=("Arial", 14, "bold"))
        self.work_button.pack(side="left", padx=5)

        self.break_button = ctk.CTkButton(self.buttons_frame, text="Short Break", command=lambda: self.change_mode("Short"),
                                          fg_color="transparent", hover_color="#ba4949", width=80, font=("Arial", 14, "bold"))
        self.break_button.pack(side="left", padx=5)

        self.long_button = ctk.CTkButton(self.buttons_frame, text="Long Break", command=lambda: self.change_mode("Long"),
                                         fg_color="transparent", hover_color="#ba4949", width=80, font=("Arial", 14, "bold"))
        self.long_button.pack(side="left", padx=5)

#Timer
        self.time_label = ctk.CTkLabel(self.timer_frame, text="00:00", font=("Arial Rounded MT Bold", 100, "bold"), text_color="white")
        self.time_label.pack(pady=(20, 20))

# Botão start
        self.start_button = ctk.CTkButton(self.timer_frame, text="START", command=self.toggle_timer, 
                                          width=200, height=60, 
                                          fg_color="white", text_color="#BA4949", hover_color="#f0f0f0",
                                          font=("Arial", 22, "bold"))
        self.start_button.pack(side="bottom", pady=40)

# Botão config
        self.btn_settings = ctk.CTkButton(self, text="Configurações", command=self.openSettings, width=100, fg_color="gray")
        self.btn_settings.place(relx=0.9, rely=0.05, anchor="ne")

        self.update_timer_label()

# Informações do ciclo


    def change_mode(self, mode):
        self.config.set_current_mode(mode)
        self.highlight_button(mode)

        self.total_seconds = self.config.get_current_time()

        self.timer_running = False # Reseta o timer ao mudar de modo
        self.start_button.configure(text="START")
        self.update_timer_label()

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

    def toggle_timer(self):
        if not self.timer_running:
            self.timer_running = True
            self.start_button.configure(text="PAUSE")
            self.count_down()
        else:
            self.timer_running = False
            self.start_button.configure(text="START")

    def count_down(self):
        if self.timer_running and self.total_seconds > 0:
            self.total_seconds -= 1
            self.update_timer_label()
            self.after(1000, self.count_down)
        elif self.total_seconds == 0:
            self.timer_running = False
            self.start_button.configure(text="START")

    def update_timer_label(self):
        minutes = self.total_seconds // 60
        seconds = self.total_seconds % 60
        self.time_label.configure(text=f"{minutes:02d}:{seconds:02d}")

    def openSettings(self):
        SettingsWindow(self, self.config)

class SettingsWindow(ctk.CTkToplevel):
    def __init__(self, mainWin, config):
        super().__init__(mainWin)
        self.mainWin = mainWin
        self.config = config

        self.title("Settings")
        self.geometry("300x300")
        self.resizable(False, False)

        self.label_Pomodoro = ctk.CTkLabel(self, text= "Pomodoro(min)")
        self.label_Pomodoro.pack(pady = (20, 0))
        self.entry_Pomodoro = ctk.CTkEntry(self, width=100)
        self.entry_Pomodoro.pack()
        current_work = self.mainWin.config.work_time // 60
        self.entry_Pomodoro.insert(0, str(current_work))

        self.label_Short = ctk.CTkLabel(self, text="Short Break(min)")
        self.label_Short.pack(pady = (20, 0))
        self.entry_Short = ctk.CTkEntry(self, width= 100)
        self.entry_Short.pack()
        current_Short = self.mainWin.config.short_break // 60
        self.entry_Short.insert(0, str(current_Short))

        self.label_Long = ctk.CTkLabel(self, text="Long Break(min)")
        self.label_Long.pack()
        self.entry_long = ctk.CTkEntry(self, width= 100)
        self.entry_long.pack()
        current_long = self.mainWin.config.long_break // 60
        self.entry_long.insert(0, str(current_long))

        save_button = ctk.CTkButton(self, text="Salvar", command=self.save_values)
        save_button.pack(pady=10)

        self.grab_set()

    def save_values(self):
        try:
            new_pomodoro = int(self.entry_Pomodoro.get()) * 60
            new_short = int(self.entry_Short.get()) * 60
            new_long = int(self.entry_long.get()) * 60

            self.mainWin.config.set_work_time(new_pomodoro)
            self.mainWin.config.set_short_break(new_short)
            self.mainWin.config.set_long_break(new_long)

            current_mode = self.config.get_current_mode()

            if self.mainWin.timer_running == False:
                self.mainWin.change_mode(current_mode)

            self.destroy()

        except ValueError:
            print("Informe números inteiros")


if __name__ == "__main__":
    app = App()
    app.mainloop()