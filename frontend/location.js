/* ================================================================
   location.js — ENVCORE Location Handler
   Manages GPS detection, manual fallback, and localStorage syncing
================================================================ */

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

window.saveManualLocation = function () {
    const val = document.getElementById("manualLocation")?.value.trim();
    if (!val) return;
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
            fetch(`https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json`)
                .then(r => r.json()).then(d => {
                    const parts = [
                        d.address?.city || d.address?.town || d.address?.village,
                        d.address?.state, d.address?.country,
                    ].filter(Boolean);
                    const name = parts.join(", ") || "Unknown Location";
                    updateLocationDisplay(name);
                    if (typeof closeModal === "function") {
                        closeModal("locationModal");
                    }
                }).catch(() => { updateLocationDisplay("Unavailable"); });
        },
        () => { updateLocationDisplay("GPS Denied/Unavailable"); }
    );
};

/* Auto-initialize / Retrieve Location on page load */
document.addEventListener("DOMContentLoaded", () => {
    const saved = localStorage.getItem("user_location");
    if (saved) {
        updateLocationDisplay(saved);
    } else if (document.getElementById("locationDisplay")) {
        window.useGPSLocation();
    }
});
