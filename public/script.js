// public/script.js

const socket = io(); // Stellt eine Verbindung zum Socket.IO-Server her
const cookie = document.getElementById('cookie');
const clickCountSpan = document.getElementById('click-count');
const container = document.querySelector('.container'); // Für Klick-Effekte

// Event-Listener für den Cookie-Klick
cookie.addEventListener('click', () => {
    // Sende ein 'click'-Ereignis an den Server
    socket.emit('click');

    // Optional: Visueller Klick-Effekt (+1 Text)
    createClickEffect();

    // NEU: Cookie-Rotation
    cookie.classList.add('rotate'); // Fügt die 'rotate'-Klasse hinzu
    // Entferne die Klasse nach der Animation, damit sie beim nächsten Klick erneut ausgelöst werden kann
    cookie.addEventListener('animationend', () => {
        cookie.classList.remove('rotate');
    }, { once: true }); // { once: true } sorgt dafür, dass dieser Listener nur einmal ausgelöst wird
});

// Event-Listener für die Aktualisierung des Zählers vom Server
socket.on('update-counter', (count) => {
    clickCountSpan.textContent = count;
});

// Optional: Event-Listener für Fehlermeldungen vom Server
socket.on('error-message', (message) => {
    console.error('Serverfehler:', message);
    alert('Es gab einen Fehler: ' + message);
});

// Funktion für den visuellen Klick-Effekt (+1, das nach oben fliegt)
function createClickEffect() {
    const effect = document.createElement('div');
    effect.classList.add('click-effect');
    effect.textContent = '+1';

    // Positioniere den Effekt relativ zum Cookie
    const cookieRect = cookie.getBoundingClientRect();
    effect.style.left = `${cookieRect.left + cookieRect.width / 2}px`;
    effect.style.top = `${cookieRect.top + cookieRect.height / 2}px`;

    // Passe die Position für den +1-Effekt leicht an, damit er nicht mit der Drehung kollidiert
    effect.style.transform = `translate(-50%, -100%)`; // Zentriert und etwas nach oben versetzt

    document.body.appendChild(effect); // Füge es direkt zum Body hinzu, um über allem zu schweben

    // Entferne das Element nach der Animation
    effect.addEventListener('animationend', () => {
        effect.remove();
    });
}