/* ================================================================
   location.js — ENVCORE Location Handler
   Manages GPS detection, autocomplete search via Nominatim,
   and localStorage syncing across pages.
================================================================ */

/* ── Debounce helper ── */
let _searchTimer = null;

function updateLocationDisplay(name) {
    const disp = document.getElementById("locationDisplay");
    const icon = document.getElementById("locationIcon");
    if (!disp) return;
    disp.textContent = name;
    localStorage.setItem("user_location", name);
    if (icon) {
        icon.classList.remove("pinging");
        icon.classList.add("located");
    }

    // Update dashboard header if present
    const h1 = document.querySelector(".header-center h1");
    if (h1 && window.location.pathname.includes("dashboard")) {
        h1.innerHTML = `Historical Data &mdash; <span style="color:#00e5ff">${name}</span>`;
    }
}

/* ─ Google Maps Integration ─ */
/* Removed in favor of Open-Meteo Free Geocoding API */
function setupAutocomplete() {
    const input = document.getElementById("manualLocation");
    if (!input) return;

    // Create dropdown container
    let dropdown = document.getElementById("locationDropdown");
    if (!dropdown) {
        dropdown = document.createElement("div");
        dropdown.id = "locationDropdown";
        dropdown.className = "location-dropdown";
        input.parentNode.style.position = "relative";
        input.parentNode.insertBefore(dropdown, input.nextSibling);
    }

    input.addEventListener("input", function () {
        const q = this.value.trim();
        if (q.length < 2) {
            dropdown.innerHTML = "";
            dropdown.style.display = "none";
            return;
        }

        clearTimeout(_searchTimer);
        _searchTimer = setTimeout(() => {
            // Open-Meteo Geocoding API
            fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=en&format=json`)
                .then(r => r.json())
                .then(data => {
                    const results = data.results;
                    if (!results || !results.length) {
                        dropdown.innerHTML = `<div class="loc-dd-item loc-dd-empty">No results found</div>`;
                        dropdown.style.display = "block";
                        return;
                    }
                    dropdown.innerHTML = results.map(r => {
                        // r.name (City/Town), r.admin1 (State), r.country
                        const parts = [r.name, r.admin1, r.country].filter(Boolean);
                        // Filter out duplicates (sometimes name and admin1 are the same)
                        const uniqueParts = [...new Set(parts)];
                        const displayName = uniqueParts.join(", ");
                        return `<div class="loc-dd-item" data-name="${displayName.replace(/"/g, '&quot;')}">${displayName}</div>`;
                    }).join("");
                    dropdown.style.display = "block";

                    // Click handler for each result
                    dropdown.querySelectorAll(".loc-dd-item[data-name]").forEach(item => {
                        item.addEventListener("click", function () {
                            const picked = this.getAttribute("data-name");
                            input.value = picked;
                            dropdown.style.display = "none";
                            updateLocationDisplay(picked);
                            if (typeof closeModal === "function") closeModal("locationModal");
                        });
                    });
                })
                .catch(() => {
                    dropdown.innerHTML = `<div class="loc-dd-item loc-dd-empty">Search failed</div>`;
                    dropdown.style.display = "block";
                });
        }, 350); // debounce 350ms
    });

    // Hide dropdown on outside click
    document.addEventListener("click", (e) => {
        if (!dropdown.contains(e.target) && e.target !== input) {
            dropdown.style.display = "none";
        }
    });

    // Allow Enter key to save whatever is typed
    input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            const val = input.value.trim();
            if (!val) return;
            dropdown.style.display = "none";
            updateLocationDisplay(val);
            if (typeof closeModal === "function") closeModal("locationModal");
        }
    });
}

window.saveManualLocation = function () {
    const val = document.getElementById("manualLocation")?.value.trim();
    if (!val) return;
    const dropdown = document.getElementById("locationDropdown");
    if (dropdown) dropdown.style.display = "none";
    updateLocationDisplay(val);
    if (typeof closeModal === "function") {
        closeModal("locationModal");
    }
};

window.useGPSLocation = function () {
    const disp = document.getElementById("locationDisplay");
    const icon = document.getElementById("locationIcon");
    if (!disp) return;
    disp.textContent = "Locating…";
    if (icon) icon.classList.add("pinging");

    if (!navigator.geolocation) {
        updateLocationDisplay("GPS Unavailable in Browser");
        return;
    }

    navigator.geolocation.getCurrentPosition(
        pos => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;

            // BigDataCloud Free API for fast reverse-geocoding without API keys
            fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`)
                .then(r => r.json()).then(d => {
                    const parts = [
                        d.city || d.locality,
                        d.principalSubdivision,
                        d.countryName
                    ].filter(Boolean);

                    const uniqueParts = [...new Set(parts)];
                    const name = uniqueParts.join(", ") || "Unknown Location";

                    updateLocationDisplay(name);
                    if (typeof closeModal === "function") closeModal("locationModal");
                }).catch(() => updateLocationDisplay("Unavailable"));
        },
        () => { updateLocationDisplay("GPS Denied/Unavailable"); }
    );
};

/* Auto-initialize on page load */
document.addEventListener("DOMContentLoaded", () => {
    const saved = localStorage.getItem("user_location");
    if (saved) {
        updateLocationDisplay(saved);
    } else if (document.getElementById("locationDisplay")) {
        window.useGPSLocation();
    }

    // Wire up autocomplete
    setupAutocomplete();
});
