
from flask import Flask, request, jsonify
import sqlite3

app = Flask(__name__)
DATABASE = 'database.db'

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
