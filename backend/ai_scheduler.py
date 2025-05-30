
from geopy.distance import great_circle
import pandas as pd

def load_drivers():
    drivers = []
    for i in range(44):
        drivers.append({
            "id": i,
            "name": f"Driver {i+1}",
            "current_lat": 41.0 + (i % 10) * 0.01,
            "current_lon": 29.0 + (i // 10) * 0.01,
            "jobs_assigned": 0
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
                "assigned_to": best_driver["name"]
            })
            best_driver["jobs_assigned"] += 1
            best_driver["current_lat"] = job["location_lat"]
            best_driver["current_lon"] = job["location_lon"]

    return {"assignments": assignments, "drivers": drivers}