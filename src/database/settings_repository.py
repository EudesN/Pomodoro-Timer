import sqlite3

class SettingsRepository:
    def __init__(self, db):
        self.db = db
        self._create_default_settings()


#Update
# recebe um dicionario settings com as configurações
    def save_settings(self, settings): 

        try:
            query = '''
            UPDATE settings
            SET work_time = ?, short_break = ?, long_break = ?, cycles_to_long_break = ?
            WHERE id = 1'''


            values = [
                settings["work_time"],
                settings["short_break"],
                settings["long_break"],
                settings["cycles_to_long_break"]
            ]
            
            with self.db.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(query, values)
        except sqlite3.Error as e:
            print(f"Erro ao atualizar as configurações: {e}")
    

#Read
    def load_settings(self):
        query = "SELECT work_time, short_break, long_break, cycles_to_long_break FROM settings WHERE id = 1"
        settings = None
        try:
            with self.db.get_connection() as conn:
                cursor = conn.cursor()

                cursor.execute(query)

                row = cursor.fetchone()

                if row:
                    settings = {
                        "work_time": row[0],
                        "short_break": row[1],
                        "long_break": row[2],
                        "cycles_to_long_break": row[3]
                    }
        except sqlite3.Error as e:
            print(f"Erro ao carregar as configurações do banco: {e}")

        return settings

    def _create_default_settings(self):

        try:
            query_default_settings = '''
                INSERT OR IGNORE INTO settings (
                id, work_time, short_break, long_break, cycles_to_long_break)
                VALUES (1, 1500, 300, 900, 4);'''
            with  self.db.get_connection() as conn:
                cursor = conn.cursor()

                cursor.execute(query_default_settings)

        except sqlite3.Error as e:
            print(f"Erro ao carregar as configurações padrões: {e}")
