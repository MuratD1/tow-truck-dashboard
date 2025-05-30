
let map;
let geocodingQueue = [];
let plottedObjects = [];
let showRoutes = true;

let heatmapLayer = null;

function checkAuth() {
    const user = localStorage.getItem("user");
    if (!user) {
        openTab(null, "login");
    } else {
        document.getElementById("login").style.display = "none";
        openTab(null, "dashboard");
    }
}

function openTab(evt, tabName) {
    const tabs = document.getElementsByClassName("tabcontent");
    for (let i = 0; i < tabs.length; i++) {
        tabs[i].style.display = "none";
    }

    document.getElementById(tabName).style.display = "block";

    if (tabName === 'heatmap') initHeatmap();
    if (tabName === 'map') initMap();
    if (tabName === 'schedule') fetchAssignments();
}

// Handle CSV Upload
function uploadCSV() {
    const fileInput = document.getElementById('csvFile');
    const file = fileInput.files[0];
    if (!file) {
        alert("Please select a CSV file.");
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        const text = e.target.result;
        parseAndPlotCSV(text);
    };
    reader.readAsText(file);
}

function parseAndPlotCSV(csvData) {
    const rows = csvData.split(/\r\n|\n/);
    const headers = rows[0].split(',');
    const requestIndex = headers.indexOf('request_location');
    const workshopIndex = headers.indexOf('workshop_location');

    if (requestIndex === -1 || workshopIndex === -1) {
        alert("CSV must contain 'request_location' and 'workshop_location' columns.");
        return;
    }

    geocodingQueue = [];

    for (let i = 1; i < rows.length; i++) {
        const cols = rows[i].split(',');
        if (cols.length < Math.max(requestIndex, workshopIndex) + 1) continue;

        const requestLocation = cols[requestIndex].trim();
        const workshopLocation = cols[workshopIndex].trim();

        geocodingQueue.push({
            type: 'pair',
            requestAddress: requestLocation,
            workshopAddress: workshopLocation
        });
    }

    processNextGeocodePair();
}

function initMap() {
    ymaps.ready(function () {
        map = new ymaps.Map('yandex-map', {
            center: [41.0130, 28.9784], // Istanbul
            zoom: 11
        });

        plotSampleLocations(); // Initial sample points
    });
}

function plotSampleLocations() {
    plottedObjects.forEach(obj => map.geoObjects.remove(obj));
    plottedObjects = [];

    const locations = [
        { name: "Request Location", coords: [41.0200, 29.0000], color: 'blue' },
        { name: "Workshop", coords: [41.0300, 28.9900], color: 'green' }
    ];

    locations.forEach(loc => {
        const placemark = new ymaps.Placemark(loc.coords, {
            balloonContent: loc.name
        }, {
            preset: `islands#circleIcon`,
            iconColor: loc.color
        });
        map.geoObjects.add(placemark);
        plottedObjects.push(placemark);
    });

    map.setBounds(map.geoObjects.getBounds(), { checkZoomRange: true });
}

function processNextGeocodePair() {
    if (geocodingQueue.length === 0) {
        alert("All locations have been plotted!");
        return;
    }

    const item = geocodingQueue.shift();

    let requestCoordsPromise = geocodeAddress(item.requestAddress + ", Istanbul, Turkey");
    let workshopCoordsPromise = geocodeAddress(item.workshopAddress + ", Istanbul, Turkey");

    Promise.all([requestCoordsPromise, workshopCoordsPromise])
        .then(([requestCoords, workshopCoords]) => {
            const requestMarker = new ymaps.Placemark(requestCoords, {
                balloonContent: "Request: " + item.requestAddress
            }, {
                preset: `islands#circleIcon`,
                iconColor: 'blue'
            });
            map.geoObjects.add(requestMarker);
            plottedObjects.push(requestMarker);

            const workshopMarker = new ymaps.Placemark(workshopCoords, {
                balloonContent: "Workshop: " + item.workshopAddress
            }, {
                preset: `islands#circleIcon`,
                iconColor: 'green'
            });
            map.geoObjects.add(workshopMarker);
            plottedObjects.push(workshopMarker);

            setTimeout(() => {
                map.setBounds(map.geoObjects.getBounds(), { checkZoomRange: true });
            }, 500);

            processNextGeocodePair();
        })
        .catch(err => {
            console.error("Failed to geocode pair:", err);
            processNextGeocodePair();
        });
}

function geocodeAddress(address) {
    return ymaps.geocode(address).then(res => {
        return res.geoObjects.get(0).geometry.getCoordinates();
    });
}

function initHeatmap() {
    plottedObjects.forEach(obj => map.geoObjects.remove(obj));
    plottedObjects = [];

    const fileInput = document.getElementById('csvFile');
    const file = fileInput.files[0];
    if (!file) {
        alert("No CSV uploaded yet.");
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        const csvData = e.target.result;
        parseCSVForHeatmap(csvData);
    };
    reader.readAsText(file);
}

function parseCSVForHeatmap(csvData) {
    const rows = csvData.split(/\r\n|\n/);
    const headers = rows[0].split(',');
    const requestIndex = headers.indexOf('request_location');

    if (requestIndex === -1) {
        alert("CSV must contain 'request_location' column.");
        return;
    }

    const requestLocations = [];

    for (let i = 1; i < rows.length; i++) {
        const cols = rows[i].split(',');
        if (cols.length <= requestIndex) continue;

        const requestLocation = cols[requestIndex].trim();
        requestLocations.push(requestLocation + ", Istanbul, Turkey");
    }

    createHeatmap(requestLocations);
}

function createHeatmap(requestLocations) {
    const promises = requestLocations.map(addr => {
        return ymaps.geocode(addr).then(res => {
            return res.geoObjects.get(0).geometry.getCoordinates();
        }).catch(() => null);
    });

    Promise.all(promises).then(coordsList => {
        const validCoords = coordsList.filter(coord => coord !== null);

        if (!heatmapLayer) {
            heatmapLayer = new ymaps.heat.Map(map, validCoords, {
                radius: 15,
                dissipating: false,
                opacity: 0.6,
                colorScheme: 'hot'
            });
        } else {
            heatmapLayer.setPoints(validCoords);
        }

        map.setBounds(heatmapLayer.getBounds(), { checkZoomRange: true });
    });
}

function fetchAssignments() {
    fetch("/api/assign_jobs")
        .then(res => res.json())
        .then(data => {
            let html = "<ul>";
            data.forEach(assign => {
                html += `
                    <li>
                        Job ${assign.job_id} → Assigned to Driver ${assign.driver_id + 1} (${assign.assigned_to}), 
                        ${assign.distance_km} km away
                    </li>
                `;
            });
            html += "</ul>";
            document.getElementById("scheduleOutput").innerHTML = html;
        })
        .catch(err => {
            document.getElementById("scheduleOutput").innerHTML = "<p>Error fetching assignments.</p>";
            console.error("Assignment error:", err);
        });
}

function exportToExcel() {
    window.open("/api/export_excel");
}

function exportToPDF() {
    window.open("/api/export_pdf");
}

function login() {
    const user = document.getElementById("loginUser").value;
    const pass = document.getElementById("loginPass").value;

    fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: user, password: pass })
    }).then(res => res.json())
      .then(data => {
          if (data.status === "success") {
              localStorage.setItem("user", JSON.stringify(data));
              alert("Logged in as " + data.role);
              openTab(null, "dashboard");
          } else {
              document.getElementById("loginStatus").innerText = "Invalid credentials.";
          }
      });
}
