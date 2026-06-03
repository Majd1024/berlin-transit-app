let stationId = null;
let stationName = null;
let currentFilter = "all";
let currentLanguage = "en";
let lastDepartures = [];
let searchTimer = null;
let deferredInstallPrompt = null;

const stationNameEl = document.getElementById("stationName");
const stationInfoEl = document.getElementById("stationInfo");
const updatedEl = document.getElementById("updated");
const departuresEl = document.getElementById("departures");
const resultEl = document.getElementById("stationResult");
const liveClockEl = document.getElementById("liveClock");
const departureSearchInput = document.getElementById("departureSearchInput");
const departureSearchBox = document.getElementById("departureSearchBox");
const btnEnglish = document.getElementById("btnEnglish");
const btnGerman = document.getElementById("btnGerman");
const installBtn = document.getElementById("installBtn");

const translations = {
  en: {
    appTitle: "🚇 Berlin Transit",
    appSubtitle: "Nearest U-Bahn, S-Bahn, bus and tram departures in real time",
    nearestButton: "📍 Find nearest station",
    stationSearchPlaceholder: "Search Berlin station or stop...",
    searchButton: "Search",
    installButton: "📲 Install Berlin Mobil",
    filterAll: "All",
    filterSubway: "🚇 U-Bahn",
    filterSuburban: "🚆 S-Bahn",
    filterBus: "🚌 Bus",
    filterTram: "🚊 Tram",
    noStation: "No station selected",
    stationInfoDefault: "Select a station to see lines",
    waiting: "Waiting...",
    departureSearchPlaceholder: "Search U-Bahn, S-Bahn, bus or tram number...",
    searching: "Searching...",
    noBerlinStation: "No Berlin station or stop found.",
    searchError: "Error searching station.",
    locationNotSupported: "Location is not supported on this device.",
    findingNearest: "Finding nearest station...",
    noNearbyStation: "No nearby Berlin station found.",
    nearestError: "Error finding nearest station.",
    locationDenied: "Location permission denied.",
    loadingDepartures: "Loading departures...",
    loadingStationLines: "Loading station lines...",
    noLineInfo: "No line information available",
    noDepartures: "No departures found.",
    departureError: "Error loading departures.",
    updated: "Updated:",
    platform: "Platform:",
    unknownDirection: "Unknown direction",
    liveTime: "⚪ Live time",
    onTime: "🟢 On time",
    delay: "delay",
    arrivingNow: "⚡ ARRIVING NOW",
    min: "min"
  },
  de: {
    appTitle: "🚇 Berlin Transit",
    appSubtitle: "U-Bahn, S-Bahn, Bus und Tram in Echtzeit",
    nearestButton: "📍 Nächste Station finden",
    stationSearchPlaceholder: "Berliner Station oder Haltestelle suchen...",
    searchButton: "Suchen",
    installButton: "📲 Berlin Mobil installieren",
    filterAll: "Alle",
    filterSubway: "🚇 U-Bahn",
    filterSuburban: "🚆 S-Bahn",
    filterBus: "🚌 Bus",
    filterTram: "🚊 Tram",
    noStation: "Keine Station ausgewählt",
    stationInfoDefault: "Wähle eine Station, um Linien zu sehen",
    waiting: "Warten...",
    departureSearchPlaceholder: "U-Bahn, S-Bahn, Bus oder Tramnummer suchen...",
    searching: "Suche...",
    noBerlinStation: "Keine Berliner Station oder Haltestelle gefunden.",
    searchError: "Fehler beim Suchen der Station.",
    locationNotSupported: "Standort wird auf diesem Gerät nicht unterstützt.",
    findingNearest: "Nächste Station wird gesucht...",
    noNearbyStation: "Keine nahe Berliner Station gefunden.",
    nearestError: "Fehler beim Finden der nächsten Station.",
    locationDenied: "Standortberechtigung verweigert.",
    loadingDepartures: "Abfahrten werden geladen...",
    loadingStationLines: "Linien werden geladen...",
    noLineInfo: "Keine Linieninformationen verfügbar",
    noDepartures: "Keine Abfahrten gefunden.",
    departureError: "Fehler beim Laden der Abfahrten.",
    updated: "Aktualisiert:",
    platform: "Gleis/Steig:",
    unknownDirection: "Unbekannte Richtung",
    liveTime: "⚪ Echtzeit",
    onTime: "🟢 Pünktlich",
    delay: "Verspätung",
    arrivingNow: "⚡ KOMMT JETZT",
    min: "Min"
  }
};

function t(key) {
  return translations[currentLanguage][key];
}

function loadingSpinner(text) {
  return `
    <div class="spinner-wrap">
      <div class="spinner"></div>
      <span>${text}</span>
    </div>
  `;
}

function isAppInstalled() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

function setupInstallButton() {
  if (!installBtn) return;

  if (isAppInstalled()) {
    installBtn.hidden = true;
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();

    if (isAppInstalled()) {
      installBtn.hidden = true;
      return;
    }

    deferredInstallPrompt = event;
    installBtn.hidden = false;
  });

  installBtn.addEventListener("click", async () => {
    if (!deferredInstallPrompt) return;

    deferredInstallPrompt.prompt();

    await deferredInstallPrompt.userChoice;

    deferredInstallPrompt = null;
    installBtn.hidden = true;
  });

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    installBtn.hidden = true;
  });
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        console.log("Service worker registration failed.");
      });
    });
  }
}

function setLanguage(language) {
  currentLanguage = language;
  document.documentElement.lang = language;

  btnEnglish.classList.toggle("active", language === "en");
  btnGerman.classList.toggle("active", language === "de");

  document.querySelectorAll("[data-i18n]").forEach((element) => {
    const key = element.getAttribute("data-i18n");
    element.textContent = t(key);
  });

  document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
    const key = element.getAttribute("data-i18n-placeholder");
    element.placeholder = t(key);
  });

  if (stationName) {
    stationNameEl.textContent = stationName;
  }

  if (lastDepartures.length > 0) {
    stationInfoEl.textContent = getStationInfoFromDepartures(lastDepartures);
    displayDepartures();
  }

  updateClock();
}

function updateClock() {
  const now = new Date();

  liveClockEl.textContent = now.toLocaleTimeString(
    currentLanguage === "de" ? "de-DE" : "en-GB",
    {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    }
  );
}

setInterval(updateClock, 1000);
updateClock();

function isBerlinTransitStation(station) {
  return (
    station &&
    station.type === "stop" &&
    station.id &&
    station.id.startsWith("900") &&
    station.products &&
    (
      station.products.subway === true ||
      station.products.suburban === true ||
      station.products.bus === true ||
      station.products.tram === true
    )
  );
}

function getTransportIcon(product) {
  if (product === "subway") return "🚇";
  if (product === "suburban") return "🚆";
  if (product === "bus") return "🚌";
  if (product === "tram") return "🚊";
  return "🚉";
}

function getDelayInfo(dep) {
  if (!dep.when || !dep.plannedWhen) {
    return {
      text: t("liveTime"),
      className: "status-live"
    };
  }

  const actualTime = new Date(dep.when);
  const plannedTime = new Date(dep.plannedWhen);
  const delayMinutes = Math.round((actualTime - plannedTime) / 60000);

  if (delayMinutes <= 1) {
    return {
      text: t("onTime"),
      className: "status-ok"
    };
  }

  return {
    text: `🔴 +${delayMinutes} ${t("min")} ${t("delay")}`,
    className: "status-delay"
  };
}

function getStationInfoFromDepartures(departures) {
  const groups = {
    subway: new Set(),
    suburban: new Set(),
    bus: new Set(),
    tram: new Set()
  };

  departures.forEach((dep) => {
    const product = dep.line?.product;
    const name = dep.line?.name;

    if (groups[product] && name) {
      groups[product].add(name);
    }
  });

  const parts = [];

  if (groups.subway.size > 0) {
    parts.push(`🚇 ${Array.from(groups.subway).sort().join(" ")}`);
  }

  if (groups.suburban.size > 0) {
    parts.push(`🚆 ${Array.from(groups.suburban).sort().join(" ")}`);
  }

  if (groups.bus.size > 0) {
    parts.push(`🚌 ${Array.from(groups.bus).sort().join(" ")}`);
  }

  if (groups.tram.size > 0) {
    parts.push(`🚊 ${Array.from(groups.tram).sort().join(" ")}`);
  }

  if (parts.length === 0) {
    return t("noLineInfo");
  }

  return parts.join(" | ");
}

function selectStation(station) {
  stationId = station.id;
  stationName = station.name;

  stationNameEl.textContent = stationName;
  stationInfoEl.textContent = t("loadingStationLines");
  resultEl.innerHTML = "";

  departureSearchBox.hidden = false;
  departureSearchInput.value = "";

  loadDepartures();
}

function autoSearchStation() {
  clearTimeout(searchTimer);

  const query = document.getElementById("stationInput").value.trim();

  if (query.length < 2) {
    resultEl.innerHTML = "";
    return;
  }

  searchTimer = setTimeout(() => {
    searchStation();
  }, 500);
}

async function searchStation() {
  const query = document.getElementById("stationInput").value.trim();

  if (!query) return;

  resultEl.innerHTML = loadingSpinner(t("searching"));

  try {
    const res = await fetch(
      `https://v6.bvg.transport.rest/locations?query=${encodeURIComponent(query)}&results=12&poi=false&addresses=false`
    );

    const stations = await res.json();
    const berlinStations = stations.filter(isBerlinTransitStation);

    resultEl.innerHTML = "";

    if (berlinStations.length === 0) {
      resultEl.innerHTML =
        `<div class="loading">${t("noBerlinStation")}</div>`;
      return;
    }

    berlinStations.forEach((station) => {
      const div = document.createElement("div");

      div.className = "station-option";
      div.textContent = `🚉 ${station.name}`;

      div.onclick = () => {
        selectStation(station);
      };

      resultEl.appendChild(div);
    });
  } catch {
    resultEl.innerHTML =
      `<div class="loading">${t("searchError")}</div>`;
  }
}

function findNearestStation() {
  if (!navigator.geolocation) {
    resultEl.innerHTML =
      `<div class="loading">${t("locationNotSupported")}</div>`;
    return;
  }

  resultEl.innerHTML = loadingSpinner(t("findingNearest"));

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const lat = position.coords.latitude;
      const lon = position.coords.longitude;

      try {
        const res = await fetch(
          `https://v6.bvg.transport.rest/locations/nearby?latitude=${lat}&longitude=${lon}&results=30&distance=3000&poi=false`
        );

        const nearby = await res.json();
        const nearestStation = nearby.find(isBerlinTransitStation);

        if (!nearestStation) {
          resultEl.innerHTML =
            `<div class="loading">${t("noNearbyStation")}</div>`;
          return;
        }

        selectStation(nearestStation);
      } catch {
        resultEl.innerHTML =
          `<div class="loading">${t("nearestError")}</div>`;
      }
    },
    () => {
      resultEl.innerHTML =
        `<div class="loading">${t("locationDenied")}</div>`;
    }
  );
}

function setFilter(filter, button) {
  currentFilter = filter;

  document.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.classList.remove("active");
  });

  button.classList.add("active");

  displayDepartures();
}

async function loadDepartures() {
  if (!stationId) return;

  departuresEl.innerHTML = loadingSpinner(t("loadingDepartures"));

  try {
    const res = await fetch(
      `https://v6.bvg.transport.rest/stops/${stationId}/departures?results=40&duration=60&subway=true&suburban=true&tram=true&bus=true&ferry=false&regional=false&express=false`
    );

    const data = await res.json();

    lastDepartures = data.departures || data;

    stationInfoEl.textContent = getStationInfoFromDepartures(lastDepartures);

    displayDepartures();

    updatedEl.textContent =
      `${t("updated")} ${new Date().toLocaleTimeString()}`;
  } catch {
    departuresEl.innerHTML =
      `<div class="loading">${t("departureError")}</div>`;
  }
}

function displayDepartures() {
  departuresEl.innerHTML = "";

  let filteredDepartures = lastDepartures;

  if (currentFilter !== "all") {
    filteredDepartures = filteredDepartures.filter((dep) => {
      return dep.line?.product === currentFilter;
    });
  }

  const searchValue = departureSearchInput.value.trim().toLowerCase();

  if (searchValue) {
    filteredDepartures = filteredDepartures.filter((dep) => {
      const lineName = dep.line?.name?.toLowerCase() || "";
      const direction = dep.direction?.toLowerCase() || "";

      return (
        lineName.includes(searchValue) ||
        direction.includes(searchValue)
      );
    });
  }

  filteredDepartures.sort((a, b) => {
    const timeA = new Date(a.when || a.plannedWhen);
    const timeB = new Date(b.when || b.plannedWhen);

    return timeA - timeB;
  });

  if (!filteredDepartures.length) {
    departuresEl.innerHTML =
      `<div class="loading">${t("noDepartures")}</div>`;
    return;
  }

  filteredDepartures.forEach((dep) => {
    const product = dep.line?.product || "";
    const icon = getTransportIcon(product);
    const delayInfo = getDelayInfo(dep);

    const departureTime = new Date(dep.when || dep.plannedWhen);
    const secondsLeft = Math.max(0, Math.round((departureTime - new Date()) / 1000));
    const minutes = Math.max(0, Math.round(secondsLeft / 60));

    const isArrivingNow = secondsLeft <= 60;

    const card = document.createElement("div");
    card.className = isArrivingNow ? "departure arriving-now" : "departure";

    card.innerHTML = `
      <div class="left">

        <div class="line">
          <span>${icon}</span>
          <span>${dep.line?.name || "?"}</span>
        </div>

        <div>
          <div class="direction">
            ${dep.direction || t("unknownDirection")}
          </div>

          <div class="platform">
            ${t("platform")} ${dep.platform || "-"}
          </div>

          <div class="delay-status ${delayInfo.className}">
            ${delayInfo.text}
          </div>
        </div>

      </div>

      <div class="time ${isArrivingNow ? "arriving-text" : ""}">
        ${isArrivingNow ? t("arrivingNow") : `${minutes} ${t("min")}`}
      </div>
    `;

    departuresEl.appendChild(card);
  });
}

setInterval(() => {
  if (stationId) {
    loadDepartures();
  }
}, 30000);

setInterval(() => {
  if (lastDepartures.length > 0) {
    displayDepartures();
  }
}, 1000);

setupInstallButton();
registerServiceWorker();
setLanguage("en");