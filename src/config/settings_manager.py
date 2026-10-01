import os
import toml

class SettingsManager:
    def __init__(self, filename = "config/settings.toml"):
        self.filename = filename

        if not os.path.exists(self.filename):
            self._create_default_settings()
    
    def save_settings(self, settings):
        try:
            with open(self.filename, 'w', encoding="utf-8") as f:
                toml.dump(settings, f)
        except Exception as e:
            print(f"Erro ao salvar as configurações no arquivo TOML: {e}")
    
    def load_settings(self):
        try:
            with open(self.filename, 'r', encoding="utf-8") as f:
                return toml.load(f)
        except Exception as e:
            print(f"Erro ao carregar configurações do arquivo TOML: {e}")
            return None
        
    def _create_default_settings(self):
        default_values = {
            "work_time": 1500,
            "short_break": 300,
            "long_break": 900,
            "cycles_to_long_break": 4,
            "individual_timers": False
        }
        self.save_settings(default_values)