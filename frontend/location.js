// location.js — handles everything related to user location in ENVCORE
// the user can either let the browser use GPS or manually search for a city
// the chosen location is saved in localStorage and used by script.js when fetching weather

// timer ID for debouncing the search input (so we don't fire a request on every keypress)
let _searchTimer = null;

// updates the location display in the header and saves to localStorage
// if lat/lon are provided, also fires a "locationUpdated" event so script.js can
// re-fetch the weather for the new location
function updateLocationDisplay(name, lat, lon) {
  const disp = document.getElementById("locationDisplay");
  const icon = document.getElementById("locationIcon");
  if (!disp) return;
  disp.textContent = name;
  localStorage.setItem("user_location", name);

  if (lat !== undefined && lon !== undefined) {
    localStorage.setItem("user_lat", lat);
    localStorage.setItem("user_lon", lon);
    window.dispatchEvent(new Event("locationUpdated"));  // tells script.js to re-fetch weather
  }

  if (icon) {
    icon.classList.remove("pinging");  // stop the pulsing animation
    icon.classList.add("located");     // switch to a static "found" state
  }

  // if we're on the dashboard page, update the heading to include the location name
  const h1 = document.querySelector(".header-center h1");
  if (h1 && window.location.pathname.includes("dashboard")) {
    h1.innerHTML = `Historical Data &mdash; <span class="loc-name-accent">${name}</span>`;
  }
}

// sets up the location search box with an autocomplete dropdown
// we switched from Google Maps to the Photon API (OpenStreetMap based, totally free, no key needed)
function setupAutocomplete() {
  const input = document.getElementById("manualLocation");
  if (!input) return;

  // create a dropdown div below the input if it doesn't already exist
  let dropdown = document.getElementById("locationDropdown");
  if (!dropdown) {
    dropdown = document.createElement("div");
    dropdown.id = "locationDropdown";
    dropdown.className = "location-dropdown";
    input.parentNode.classList.add("location-input-wrap");
    input.parentNode.insertBefore(dropdown, input.nextSibling);
  }

  input.addEventListener("input", function () {
    const q = this.value.trim();
    if (q.length < 2) {
      dropdown.innerHTML = "";
      dropdown.style.display = "none";
      return;  // don't search until user has typed at least 2 characters
    }

    // debounce: wait 350ms after the user stops typing before sending the request
    // prevents spamming the API on every keystroke
    clearTimeout(_searchTimer);
    _searchTimer = setTimeout(() => {
      // Photon is OSM-based and works well for Indian cities and POIs like KIIT, IIT, etc.
      fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=6`)
        .then(r => r.json())
        .then(data => {
          const results = data.features;
          if (!results || !results.length) {
            dropdown.innerHTML = `<div class="loc-dd-item loc-dd-empty">No results found</div>`;
            dropdown.style.display = "block";
            return;
          }
          // build dropdown items from the search results
          dropdown.innerHTML = results.map(r => {
            const p = r.properties;
            // combine available fields into a readable address, removing duplicates
            const parts = [p.name, p.city || p.town || p.district, p.state, p.country].filter(Boolean);
            const uniqueParts = [...new Set(parts)];
            const displayName = uniqueParts.join(", ");
            const lon = r.geometry.coordinates[0];
            const lat = r.geometry.coordinates[1];
            // store lat/lon as data attributes so we can read them on click
            return `<div class="loc-dd-item" data-name="${displayName.replace(/"/g, '&quot;')}" data-lat="${lat}" data-lon="${lon}">${displayName}</div>`;
          }).join("");
          dropdown.style.display = "block";

          // when user clicks a result, save it and close the modal
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
    }, 350);  // debounce delay in ms
  });

  // hide dropdown when user clicks somewhere else on the page
  document.addEventListener("click", (e) => {
    if (!dropdown.contains(e.target) && e.target !== input) {
      dropdown.style.display = "none";
    }
  });

  // pressing Enter saves whatever is in the input as a manual location name
  // note: we won't have lat/lon for manually typed names — weather API will try to geocode it
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const val = input.value.trim();
      if (!val) return;
      dropdown.style.display = "none";
      updateLocationDisplay(val);  // no lat/lon here since user typed it manually
      if (typeof closeModal === "function") closeModal("locationModal");
    }
  });
}

// called when user clicks "Save" in the manual location modal
function saveManualLocation() {
  const val = document.getElementById("manualLocation")?.value.trim();
  if (!val) return;
  const dropdown = document.getElementById("locationDropdown");
  if (dropdown) dropdown.style.display = "none";
  updateLocationDisplay(val);
  window.closeModal?.("locationModal");
}

// uses the browser's Geolocation API to get the user's current coordinates
// then does a reverse geocode via BigDataCloud (free, no API key) to get a readable city name
function useGPSLocation() {
  const disp = document.getElementById("locationDisplay");
  const icon = document.getElementById("locationIcon");
  if (!disp) return;
  disp.textContent = "Locating…";
  if (icon) icon.classList.add("pinging");  // start the pulsing icon animation

  if (!navigator.geolocation) {
    updateLocationDisplay("GPS Unavailable in Browser");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    pos => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;

      // reverse geocode the coordinates → get a human-readable city/state/country name
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
    () => { updateLocationDisplay("GPS Denied/Unavailable"); }  // user denied GPS permission
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// INIT — runs when the page loads
// restores the last saved location from localStorage, or tries GPS if nothing is saved
// ─────────────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  const saved = localStorage.getItem("user_location");
  const savedLat = localStorage.getItem("user_lat");
  if (saved && savedLat) {
    // we have both name and coordinates saved → full restore
    updateLocationDisplay(saved, localStorage.getItem("user_lat"), localStorage.getItem("user_lon"));
  } else if (saved) {
    // we have a name but no coordinates → partial restore
    updateLocationDisplay(saved);
  } else if (document.getElementById("locationDisplay")) {
    // nothing saved at all → try GPS automatically
    useGPSLocation();
  }

  setupAutocomplete();  // attach the type-ahead search to the manual location input

  // wire up the modal action buttons
  document.getElementById("saveLocationBtn")?.addEventListener("click", saveManualLocation);
  document.getElementById("gpsLocationBtn")?.addEventListener("click", useGPSLocation);
});
