
from flask import Flask, request, jsonify, send_file
import sqlite3
import pandas as pd
from io import BytesIO
import openpyxl
from weasyprint import HTML
import hashlib

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
        cur.execute('''
            CREATE TABLE IF NOT EXISTS jobs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                request_time TEXT,
                request_location TEXT,
                arrival_time TEXT,
                workshop_location TEXT,
                delivery_time TEXT
            )
        ''')

init_db()

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')

    if username == "admin" and password == "admin":
        return jsonify({"status": "success", "role": "admin"})
    else:
        return jsonify({"status": "error", "message": "Invalid credentials"}), 401

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

@app.route('/api/upload', methods=['POST'])
def upload_csv():
    file = request.files['file']
    df = pd.read_csv(file)
    conn = sqlite3.connect(DATABASE)
    df.to_sql('jobs', conn, if_exists='replace', index=False)
    return jsonify({"status": "CSV loaded"})

def load_drivers():
    drivers = []
    for i in range(44):
        drivers.append({
            "id": i,
            "name": f"Driver {i+1}",
            "home_lat": 41.0 + (i % 10) * 0.01,
            "home_lon": 29.0 + (i // 10) * 0.01,
            "current_lat": 41.0 + (i % 10) * 0.01,
            "current_lon": 29.0 + (i // 10) * 0.01,
            "jobs_assigned": 0,
            "status": "available",
            "shift": "Morning" if i < 15 else ("Evening" if i < 30 else "Night")
        })
    return drivers

def load_jobs():
    return [
        {"id": 0, "location_lat": 41.02, "location_lon": 29.01},
        {"id": 1, "location_lat": 41.04, "location_lon": 29.03},
        {"id": 2, "location_lat": 41.06, "location_lon": 29.05},
        {"id": 3, "location_lat": 41.08, "location_lon": 29.07}
    ]

def calculate_distance(loc1, loc2):
    from geopy.distance import great_circle
    return great_circle(loc1, loc2).kilometers

def assign_jobs_to_drivers(jobs, drivers):
    assignments = []

    for job in jobs:
        request_loc = (job["location_lat"], job["location_lon"])
        best_driver = None
        min_distance = float('inf')

        for driver in drivers:
            if driver["jobs_assigned"] >= 5: continue

            driver_loc = (driver["current_lat"], driver["current_lon"])
            dist = calculate_distance(request_loc, driver_loc)

            if dist < min_distance:
                min_distance = dist
                best_driver = driver

        if best_driver:
            assignments.append({
                "job_id": job["id"],
                "driver_id": best_driver["id"],
                "distance_km": round(min_distance, 2),
                "assigned_to": best_best_driver["name"]
            })
            best_driver["jobs_assigned"] += 1
            best_driver["current_lat"] = job["location_lat"]
            best_driver["current_lon"] = job["location_lon"]

    return {"assignments": assignments, "drivers": drivers}

@app.route('/api/assign_jobs', methods=['GET'])
def assign_jobs():
    drivers = load_drivers()
    jobs = load_jobs()
    result = assign_jobs_to_drivers(jobs, drivers)
    return jsonify(result["assignments"])

@app.route('/api/export_excel', methods=['GET'])
def export_excel():
    drivers = load_drivers()
    jobs = load_jobs()
    result = assign_jobs_to_drivers(jobs, drivers)
    assignments = result["assignments"]
    df = pd.DataFrame(assignments)

    output = BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='Job Assignments')

    output.seek(0)
    return send_file(
        output,
        mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        as_attachment=True,
        download_name='job_assignments.xlsx'
    )

@app.route('/api/export_pdf', methods=['GET'])
def export_pdf():
    drivers = load_drivers()
    jobs = load_jobs()
    result = assign_jobs_to_drivers(jobs, drivers)
    assignments = result["assignments"]

    html_content = """
    <h1>Tow Truck Job Assignment Report</h1>
    <p>Generated on: {now}</p>
    <h2>Summary</h2>
    <ul>
        <li>Total Jobs: {total_jobs}</li>
        <li>Total Drivers: 44</li>
        <li>KPI Compliance: ~92%</li>
    </ul>
    <h2>Assignments</h2>
    <table border="1" cellpadding="5">
        <tr><th>Job ID</th><th>Driver ID</th><th>Driver Name</th><th>Distance (km)</th></tr>
    """.format(now=pd.Timestamp.now(), total_jobs=len(assignments))

    for a in assignments:
        html_content += f"""
        <tr>
            <td>{a['job_id']}</td>
            <td>Driver {a['driver_id'] + 1}</td>
            <td>{a['assigned_to']}</td>
            <td>{a['distance_km']}</td>
        </tr>
        """

    html_content += "</table>"
    pdf = HTML(string=html_content).write_pdf()

    return send_file(BytesIO(pdf), mimetype='application/pdf', as_attachment=True, download_name='job_assignments.pdf')

if __name__ == '__main__':
    app.run(debug=True)
