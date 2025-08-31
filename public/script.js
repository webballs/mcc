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
    createClickEffect();
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
    const upgradeCosts = [10, 100, 1000, 10000];
    const nextCost = upgradeCosts[level];

    if (nextCost) {
        upgradeLevelSpan.textContent = nextLevel;
        upgradeCostSpan.textContent = nextCost;
        upgradeButton.style.display = 'block';
    } else {
        upgradeLevelSpan.textContent = 'Max';
        upgradeCostSpan.textContent = 'N/A';
        upgradeButton.style.display = 'none'; // Versteckt den Button, wenn es keine Upgrades mehr gibt
    }
});

socket.on('error-message', (message) => {
    console.error('Serverfehler:', message);
    alert('Es gab einen Fehler: ' + message);
});

// Visuelle Effekte
function createClickEffect() {
    const effect = document.createElement('div');
    effect.classList.add('click-effect');
    effect.textContent = `+${clickValueSpan.textContent}`; // Zeigt den aktuellen Klickwert an

    const cookieRect = cookie.getBoundingClientRect();
    effect.style.left = `${cookieRect.left + cookieRect.width / 2}px`;
    effect.style.top = `${cookieRect.top + cookieRect.height / 2}px`;
    effect.style.transform = `translate(-50%, -100%)`;

    document.body.appendChild(effect);

    effect.addEventListener('animationend', () => {
        effect.remove();
    });
}