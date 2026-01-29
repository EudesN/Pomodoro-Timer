import sqlite3

class Database:
    def __init__(self, db_name = "pomodoro_data.db"):
        self.db_name = db_name
        self.create_tables()

    
    def get_connection(self):
        return sqlite3.connect(self.db_name)
    
    def create_tables(self):
        try:
            query = '''
            CREATE TABLE IF NOT EXISTS tasks(
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                total_cycles INTEGER NOT NULL,
                completed_cycles INTEGER DEFAULT 0,
                completed INTEGER DEFAULT 0
            );
            '''
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(query)
        except sqlite3.Error as e:
            print(f"Erro ao cruar tabelas: {e}")





