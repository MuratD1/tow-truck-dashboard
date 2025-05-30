
let map;
let plottedMarkers = [];

function openTab(evt, tabName) {
    const tabs = document.getElementsByClassName("tabcontent");
    for (let i = 0; i < tabs.length; i++) {
        tabs[i].style.display = "none";
    }
    document.getElementById(tabName).style.display = "block";

    if (tabName === 'map' && !map) {
        initMap();
    }
}

function initMap() {
    ymaps.ready(() => {
        map = new ymaps.Map('yandex-map', {
            center: [41.0130, 28.9784],
            zoom: 11
        });
    });
}

// Add new truck/driver row
function addRow() {
    const table = document.getElementById("fleetTable").getElementsByTagName("tbody")[0];
    const newRow = table.insertRow();

    newRow.innerHTML = `
        <td><input type="checkbox" class="row-checkbox"></td>
        <td><input type="text" onchange="updateMapWithAddress(this)" readonly></td>
        <td><input type="text" onchange="updateMapWithAddress(this)" readonly></td>
        <td><input type="text" readonly></td>
        <td><input type="text" onchange="updateMapWithAddress(this)" readonly></td>
        <td>
            <select onchange="updateMapWithAddress(this)" disabled>
                <option>Morning</option>
                <option>Evening</option>
                <option>Night</option>
            </select>
        </td>
        <td>
            <select disabled>
                <option>Available</option>
                <option>On Job</option>
                <option>Break</option>
            </select>
        </td>
        <td><button onclick="editRow(this)">Edit</button></td>
    `;
}

// Edit selected row
function editRow(btn) {
    const row = btn.closest("tr");
    const inputs = row.querySelectorAll("input, select");

    inputs.forEach(input => {
        input.readOnly = false;
        input.disabled = false;
        input.style.backgroundColor = "#fff";
    });

    const cell = btn.parentNode;
    cell.innerHTML = '<button onclick="saveRow(this)">Save</button>';
}

// Save edited row
function saveRow(btn) {
    const row = btn.closest("tr");
    const inputs = row.querySelectorAll("input, select");

    inputs.forEach(input => {
        input.readOnly = true;
        input.disabled = true;
        input.style.backgroundColor = "#f9f9f9";
    });

    const addressInput = row.cells[4]?.children[0];
    if (addressInput) updateMapWithAddress(addressInput);

    const cell = btn.parentNode;
    cell.innerHTML = '<button onclick="editRow(this)">Edit</button>';
}

// Delete selected rows
function deleteSelectedRows() {
    const table = document.getElementById("fleetTable").getElementsByTagName("tbody")[0];
    const rows = table.getElementsByTagName("tr");

    for (let i = rows.length - 1; i >= 0; i--) {
        const checkbox = rows[i].cells[0]?.querySelector("input[type='checkbox']");
        if (checkbox?.checked) {
            if (rows[i].marker) {
                map.geoObjects.remove(rows[i].marker);
            }
            table.deleteRow(i);
        }
    }
}

// Update map based on home address
function updateMapWithAddress(inputCell) {
    const row = inputCell.closest("tr");

    const plateInput = row.cells[1]?.children[0];
    const nameInput = row.cells[2]?.children[0];
    const phoneInput = row.cells[3]?.children[0];
    const addressInput = inputCell;

    const plate = plateInput?.value.trim() || "";
    const name = nameInput?.value.trim() || "";
    const phone = phoneInput?.value.trim() || "";
    const address = addressInput?.value.trim() || "";

    if (!map || !address) return;

    const fullAddress = address + ", Istanbul, Turkey";

    if (row.marker) {
        map.geoObjects.remove(row.marker);
        delete row.marker;
    }

    ymaps.geocode(fullAddress).then(res => {
        const coords = res.geoObjects.get(0).geometry.getCoordinates();

        const placemark = new ymaps.Placemark(coords, {
            balloonContent: `
                <b>Driver:</b> ${name}<br>
                <b>Plate:</b> ${plate}<br>
                <b>Address:</b> ${fullAddress}
            `
        }, {
            preset: 'islands#circleIcon',
            iconColor: '#E63E6D'
        });

        map.geoObjects.add(placemark);
        row.marker = placemark;
        map.setBounds(map.geoObjects.getBounds(), { checkZoomRange: true });
    }).catch(err => {
        console.error("Failed to geocode:", err);
    });
}

function checkAuth() {
    const user = localStorage.getItem("user");
    if (!user) {
        openTab(null, "login");
    } else {
        openTab(null, "dashboard");
    }
}

function login() {
    const user = document.getElementById("loginUser").value;
    const pass = document.getElementById("loginPass").value;

    if (user === "admin" && pass === "admin") {
        localStorage.setItem("user", JSON.stringify({ role: "admin" }));
        alert("Logged in as admin");
        openTab(null, "dashboard");
    } else {
        document.getElementById("loginStatus").innerText = "Invalid credentials.";
    }
}
