const socket = io();
const cookie = document.getElementById('cookie');
const clickCountSpan = document.getElementById('click-count');
const clickValueSpan = document.getElementById('click-value');
const upgradeLevelSpan = document.getElementById('upgrade-level');
const upgradeCostSpan = document.getElementById('upgrade-cost');
const upgradeButton = document.getElementById('upgrade-button');

// Klick-Logik
cookie.addEventListener('click', (event) => {
    socket.emit('click');
    createClickEffect(event);
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

socket.on('update-upgrade', (data) => {
    upgradeLevelSpan.textContent = data.level;
    upgradeCostSpan.textContent = data.nextCost;
    upgradeButton.textContent = `Upgrade Kaufen (${data.nextCost} Cookies)`;
    upgradeButton.disabled = false; // Button immer aktivieren, da es kein Max-Level gibt
});

socket.on('error-message', (message) => {
    console.error('Serverfehler:', message);
    alert('Es gab einen Fehler: ' + message);
});

// Visuelle Effekte
function createClickEffect(event) {
    const effect = document.createElement('div');
    effect.classList.add('click-effect');
    effect.textContent = `+${clickValueSpan.textContent}`;

    effect.style.left = `${event.clientX}px`;
    effect.style.top = `${event.clientY}px`;
    effect.style.transform = `translate(-50%, -100%)`;

    document.body.appendChild(effect);

    effect.addEventListener('animationend', () => {
        effect.remove();
    });
}