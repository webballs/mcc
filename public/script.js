const socket = io();
const cookie = document.getElementById('cookie');
const clickCountSpan = document.getElementById('click-count');
const clickValueSpan = document.getElementById('click-value');
const upgradeLevelSpan = document.getElementById('upgrade-level');
const upgradeProgressTextSpan = document.getElementById('upgrade-progress-text');
const upgradeProgressBar = document.getElementById('upgrade-progress-bar');
const upgradeButton = document.getElementById('upgrade-button');

// Store the next upgrade cost here so we can use it in update-counter
let nextUpgradeCost = 10;

// Click logic
cookie.addEventListener('click', (event) => {
    socket.emit('click');
    createClickEffect(event);
});

// Upgrade logic
upgradeButton.addEventListener('click', () => {
    socket.emit('buy-upgrade');
});

// Server responses
socket.on('update-counter', (count) => {
    clickCountSpan.textContent = count;
    
    // Calculate and display progress text and bar
    if (nextUpgradeCost > 0) {
        const cookiesNeeded = Math.max(0, nextUpgradeCost - count);
        upgradeProgressTextSpan.textContent = `${count} / ${nextUpgradeCost} Cookies`;
        const percentage = Math.min(100, (count / nextUpgradeCost) * 100);
        upgradeProgressBar.style.width = `${percentage}%`;
        
        if (count >= nextUpgradeCost) {
            upgradeButton.disabled = false;
        } else {
            upgradeButton.disabled = true;
        }
    }
});

socket.on('update-click-value', (value) => {
    clickValueSpan.textContent = value;
});

socket.on('update-upgrade', (data) => {
    upgradeLevelSpan.textContent = data.level;
    
    // Update the cost variable and trigger a counter update to refresh the UI
    nextUpgradeCost = data.nextCost;
    // This call ensures the UI is immediately refreshed after a purchase
    socket.emit('update-counter', clickCountSpan.textContent);
});

socket.on('error-message', (message) => {
    console.error('Server error:', message);
    alert('There was an error: ' + message);
});

// Visual effects
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