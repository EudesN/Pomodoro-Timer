#!/usr/bin/env python3
"""
Pomus - Wrapper para execução a partir de src/
"""
import os
import sys

root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
app_path = os.path.join(root_dir, "app.py")

if __name__ == "__main__":
    os.execv(sys.executable, [sys.executable, app_path])