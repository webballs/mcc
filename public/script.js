const socket = io();
const cookie = document.getElementById('cookie');
const clickCountSpan = document.getElementById('click-count');

cookie.addEventListener('click', (event) => {
    socket.emit('click');
    createClickEffect();
    createRedSquareEffect(event);
    cookie.classList.add('rotate');
    cookie.addEventListener('animationend', () => {
        cookie.classList.remove('rotate');
    }, { once: true });
});

socket.on('update-counter', (count) => {
    clickCountSpan.textContent = count;
});

socket.on('error-message', (message) => {
    console.error('Serverfehler:', message);
    alert('Es gab einen Fehler: ' + message);
});

function createClickEffect() {
    const effect = document.createElement('div');
    effect.classList.add('click-effect');
    effect.textContent = '+1';

    const cookieRect = cookie.getBoundingClientRect();
    effect.style.left = `${cookieRect.left + cookieRect.width / 2}px`;
    effect.style.top = `${cookieRect.top + cookieRect.height / 2}px`;
    effect.style.transform = `translate(-50%, -100%)`;

    document.body.appendChild(effect);

    effect.addEventListener('animationend', () => {
        effect.remove();
    });
}

function createRedSquareEffect(event) {
    const square = document.createElement('div');
    square.classList.add('red-square');

    square.style.left = `${event.clientX}px`;
    square.style.top = `${event.clientY}px`;
    square.style.transform = `translate(-50%, -50%)`;

    document.body.appendChild(square);

    square.addEventListener('animationend', () => {
        square.remove();
    }, { once: true });
}