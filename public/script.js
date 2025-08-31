const socket = io();
const cookie = document.getElementById('cookie');
const clickCountSpan = document.getElementById('click-count');
const clickValueSpan = document.getElementById('click-value');
const upgradeLevelSpan = document.getElementById('upgrade-level');
const upgradeCostSpan = document.getElementById('upgrade-cost');
const upgradeButton = document.getElementById('upgrade-button');

// Klick-Logik
cookie.addEventListener('click', (event) => { // 'event' wird für die Position des Effekts benötigt
    socket.emit('click');
    createClickEffect(event); // Übergebe das event an die Funktion
});

// Upgrade-Logik
upgradeButton.addEventListener('click', () => {
    socket.emit('buy-upgrade');
});

// Server-Antworten
socket.on('update-counter', (count) => {
    clickCountSpan.textContent = count;
});

socket.on('update-click-value', (value) => {
    clickValueSpan.textContent = value;
});

socket.on('update-upgrade', (level) => {
    const nextLevel = level + 1;
    const upgradeCosts = [10, 100, 1000, 10000]; // Muss mit UPGRADE_COSTS im Server übereinstimmen!
    const nextCost = upgradeCosts[level]; // Kosten für das aktuelle Level

    if (level < upgradeCosts.length -1) { // -1, weil das Array 0-basiert ist und das letzte Element der Max-Level ist
        upgradeLevelSpan.textContent = nextLevel;
        upgradeCostSpan.textContent = nextCost;
        upgradeButton.textContent = `Upgrade Kaufen (${nextCost} Cookies)`;
        upgradeButton.disabled = false; // Button aktivieren
    } else {
        upgradeLevelSpan.textContent = 'Max';
        upgradeCostSpan.textContent = 'N/A';
        upgradeButton.textContent = 'Max Level Erreicht';
        upgradeButton.disabled = true; // Button deaktivieren
        // upgradeButton.style.display = 'none'; // Optional: Button ganz ausblenden
    }
});

socket.on('error-message', (message) => {
    console.error('Serverfehler:', message);
    alert('Es gab einen Fehler: ' + message);
});

// Visuelle Effekte
function createClickEffect(event) { // event als Parameter übergeben
    const effect = document.createElement('div');
    effect.classList.add('click-effect');
    effect.textContent = `+${clickValueSpan.textContent}`;

    // Positioniere den Effekt direkt an der Klickposition
    effect.style.left = `${event.clientX}px`;
    effect.style.top = `${event.clientY}px`;
    effect.style.transform = `translate(-50%, -100%)`; // Zentriert horizontal und leicht nach oben verschoben

    document.body.appendChild(effect);

    effect.addEventListener('animationend', () => {
        effect.remove();
    });
}