from flask import Flask, request, jsonify, send_from_directory
import sqlite3
import pandas as pd
from io import BytesIO
import openpyxl
from weasyprint import HTML

app = Flask(__name__, static_folder='../frontend', template_folder='../frontend')

DATABASE = 'database.db'

@app.route('/')
def home():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/<path:path>')
def static_proxy(path):
    return send_from_directory(app.static_folder, path)

# Your existing API routes go here...
# Keep your /api/trucks, /api/upload, /api/assign_jobs etc.

def init_db():
    with sqlite3.connect(DATABASE) as conn:
        cur = conn.cursor()
        cur.execute('''
            CREATE TABLE IF NOT EXISTS trucks (
                plate TEXT PRIMARY KEY,
                driver_name TEXT,
                phone TEXT,
                home_address TEXT,
                shift TEXT,
                status TEXT
            )
        ''')

@app.route('/api/trucks', methods=['GET', 'POST'])
def manage_trucks():
    conn = sqlite3.connect(DATABASE)
    cur = conn.cursor()

    if request.method == 'POST':
        data = request.json
        cur.execute('''
            INSERT OR REPLACE INTO trucks VALUES (?, ?, ?, ?, ?, ?)
        ''', (
            data['plate'],
            data['driver_name'],
            data['phone'],
            data['home_address'],
            data['shift'],
            data['status']
        ))
        conn.commit()
        return jsonify({"status": "saved"})
    
    cur.execute("SELECT * FROM trucks")
    rows = cur.fetchall()
    return jsonify(rows)

if __name__ == '__main__':
    init_db()
    app.run(debug=True)
