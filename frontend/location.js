/* ================================================================
   location.js — ENVCORE Location Handler
   Manages GPS detection, autocomplete search via Nominatim,
   and localStorage syncing across pages.
================================================================ */

/* ── Debounce helper ── */
let _searchTimer = null;

function updateLocationDisplay(name, lat, lon) {
    const disp = document.getElementById("locationDisplay");
    const icon = document.getElementById("locationIcon");
    if (!disp) return;
    disp.textContent = name;
    localStorage.setItem("user_location", name);

    if (lat !== undefined && lon !== undefined) {
        localStorage.setItem("user_lat", lat);
        localStorage.setItem("user_lon", lon);
        window.dispatchEvent(new Event("locationUpdated"));
    }

    if (icon) {
        icon.classList.remove("pinging");
        icon.classList.add("located");
    }

    // Update dashboard header if present
    const h1 = document.querySelector(".header-center h1");
    if (h1 && window.location.pathname.includes("dashboard")) {
        h1.innerHTML = `Historical Data &mdash; <span class="loc-name-accent">${name}</span>`;
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
        input.parentNode.classList.add("location-input-wrap");  /* CSS class instead of inline style */
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
            // Photon API (OSM based, better for POIs in India like KIIT)
            fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=6`)
                .then(r => r.json())
                .then(data => {
                    const results = data.features;
                    if (!results || !results.length) {
                        dropdown.innerHTML = `<div class="loc-dd-item loc-dd-empty">No results found</div>`;
                        dropdown.style.display = "block";
                        return;
                    }
                    dropdown.innerHTML = results.map(r => {
                        const p = r.properties;
                        const parts = [p.name, p.city || p.town || p.district, p.state, p.country].filter(Boolean);
                        const uniqueParts = [...new Set(parts)];
                        const displayName = uniqueParts.join(", ");
                        const lon = r.geometry.coordinates[0];
                        const lat = r.geometry.coordinates[1];
                        return `<div class="loc-dd-item" data-name="${displayName.replace(/"/g, '&quot;')}" data-lat="${lat}" data-lon="${lon}">${displayName}</div>`;
                    }).join("");
                    dropdown.style.display = "block";

                    // Click handler for each result
                    dropdown.querySelectorAll(".loc-dd-item[data-name]").forEach(item => {
                        item.addEventListener("click", function () {
                            const picked = this.getAttribute("data-name");
                            const lat = this.getAttribute("data-lat");
                            const lon = this.getAttribute("data-lon");
                            input.value = picked;
                            dropdown.style.display = "none";
                            updateLocationDisplay(picked, lat, lon);
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
            // We don't have lat/lon for manual unstructured entry, so just update name
            updateLocationDisplay(val);
            if (typeof closeModal === "function") closeModal("locationModal");
        }
    });
}

function saveManualLocation() {
    const val = document.getElementById("manualLocation")?.value.trim();
    if (!val) return;
    const dropdown = document.getElementById("locationDropdown");
    if (dropdown) dropdown.style.display = "none";
    updateLocationDisplay(val);
    window.closeModal?.("locationModal");
}

function useGPSLocation() {
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

                    updateLocationDisplay(name, lat, lng);
                    window.closeModal?.("locationModal");
                }).catch(() => updateLocationDisplay("Unavailable", lat, lng));
        },
        () => { updateLocationDisplay("GPS Denied/Unavailable"); }
    );
}

/* Auto-initialize on page load */
document.addEventListener("DOMContentLoaded", () => {
    const saved = localStorage.getItem("user_location");
    const savedLat = localStorage.getItem("user_lat");
    if (saved && savedLat) {
        updateLocationDisplay(saved, localStorage.getItem("user_lat"), localStorage.getItem("user_lon"));
    } else if (saved) {
        updateLocationDisplay(saved);
    } else if (document.getElementById("locationDisplay")) {
        useGPSLocation();
    }

    /* Wire up autocomplete */
    setupAutocomplete();

    /* Wire location modal buttons (replaces inline onclick= in HTML) */
    document.getElementById("saveLocationBtn")?.addEventListener("click", saveManualLocation);
    document.getElementById("gpsLocationBtn")?.addEventListener("click", useGPSLocation);
});
