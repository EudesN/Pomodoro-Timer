from models.pomodoro import TimerMode

class PomodoroController:
    def __init__(self, view, pomodoro, task_manager):
        self.view = view
        self.pomodoro = pomodoro
        self.task_manager = task_manager

    def change_timer_mode(self, mode):
        self.pomodoro.current_mode = mode
        self.view.highlight_button(mode)

        self.view.time_left = self.pomodoro.get_current_time()

        self.view.is_timer_running = False
        self.view.start_button.configure(text="START")
        self.view.update_timer_label()

    def toggle_timer(self):
        if not self.view.is_timer_running:
            self.view.is_timer_running = True
            self.view.start_button.configure(text="PAUSE")
            self.countdown()
        else:
            self.view.is_timer_running = False
            self.view.start_button.configure(text="START")

    def countdown(self):
        if self.view.is_timer_running and self.view.time_left > 0:
            self.view.time_left -= 1
            self.view.update_timer_label()
            self.view.after(1000, self.countdown)
        elif self.view.time_left == 0:
            self.view.is_timer_running = False
            self.view.start_button.configure(text="START")

            if self.view.pomodoro.current_mode == TimerMode.WORK:
                self.view.task_manager.increment_active_task_cycle()
                self.view.refresh_task_list()

            self.pomodoro.switch_timer()
            self.view.update_session_cycles_info()
            self.change_timer_mode(self.pomodoro.current_mode)

