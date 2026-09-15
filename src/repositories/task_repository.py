import sqlite3

from models import Task


class TaskRepository:
    def __init__(self, db):
        self.db = db

    def add_task(self, task):
        try:
            query = '''
            INSERT INTO tasks(title, total_cycles, completed_cycles, completed)
            VALUES(?, ?, ?, ?)
            '''
            values = [task.title, task.total_cycles, task.completed_cycles, int(task.completed)]

            with self.db.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(query, values)
                task.id = cursor.lastrowid
            return task
        except sqlite3.Error as e:
            print(f"Erro ao criar tarefa: {e}")
            return None

    def get_all_tasks(self):
        try:
            query = "SELECT id, title, total_cycles, completed_cycles, completed FROM tasks"
            with self.db.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(query)
                rows = cursor.fetchall()

                tasks = []
                for row in rows:
                    task = Task(
                        id=row[0],
                        title=row[1],
                        total_cycles=row[2],
                        completed_cycles=row[3]
                    )
                    task.completed = bool(row[4])
                    tasks.append(task)
                return tasks
        except sqlite3.Error as e:
            print(f"Erro ao carregar tarefas: {e}")
            return []

    def update_task_progress(self, task):
        try:
            query = '''
            UPDATE tasks 
            SET completed_cycles = ?, completed = ?
            WHERE id = ?
            '''
            values = [task.completed_cycles, int(task.completed), task.id]

            with self.db.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(query, values)
        except sqlite3.Error as e:
            print(f"Erro ao atualizar tarefa: {e}")

    def remove_task(self, task_id):
        try:
            query = "DELETE FROM tasks WHERE id = ?"
            with self.db.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(query, (task_id,))
        except sqlite3.Error as e:
            print(f"Erro ao remover tarefa: {e}")

    def clear_completed_tasks(self):
        try:
            query = "DELETE FROM tasks WHERE completed = 1"
            with self.db.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(query)
        except sqlite3.Error as e:
            print(f"Erro ao limpar tarefas: {e}")