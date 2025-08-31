const socket = io();
const cookie = document.getElementById('cookie');
const clickCountSpan = document.getElementById('click-count');
const clickValueSpan = document.getElementById('click-value');
const upgradeLevelSpan = document.getElementById('upgrade-level');
const remainingCookiesSpan = document.getElementById('remaining-cookies');
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
    // New logic: calculate and display remaining cookies
    const remaining = nextUpgradeCost - count;
    
    if (remaining > 0) {
        remainingCookiesSpan.textContent = remaining;
        remainingCookiesSpan.classList.add('red-text');
        upgradeButton.disabled = true;
        upgradeButton.textContent = `Buy Upgrade`;
    } else {
        remainingCookiesSpan.textContent = 'READY!';
        remainingCookiesSpan.classList.remove('red-text');
        upgradeButton.disabled = false;
        upgradeButton.textContent = `Buy Upgrade (${nextUpgradeCost} Cookies)`;
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