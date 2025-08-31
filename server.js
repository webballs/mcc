const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const Redis = require('ioredis');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Redis-Client initialisieren
const redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : 6379,
    password: process.env.REDIS_PASSWORD || undefined
});

const COUNTER_KEY = 'global_cookie_clicks';

// Statische Dateien aus dem 'public'-Ordner servieren
app.use(express.static(path.join(__dirname, 'public')));

// Standard-Route für die HTML-Datei
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'cookie-clicker.html'));
});

// WebSocket-Verbindungen handhaben
io.on('connection', async (socket) => {
    console.log('Ein Benutzer hat sich verbunden');

    try {
        const currentCount = await redis.get(COUNTER_KEY);
        socket.emit('update-counter', parseInt(currentCount || '0', 10));
    } catch (error) {
        console.error('Fehler beim Abrufen des Zählers von Redis:', error);
        socket.emit('error-message', 'Fehler beim Laden des Zählers.');
    }

    // Wenn ein Client ein 'click'-Ereignis sendet
    socket.on('click', async () => {
        try {
            const newCount = await redis.incr(COUNTER_KEY);
            console.log(`Zähler inkrementiert: ${newCount}`);
            io.emit('update-counter', newCount);
        } catch (error) {
            console.error('Fehler beim Inkrementieren des Zählers in Redis:', error);
            socket.emit('error-message', 'Fehler beim Inkrementieren des Klicks.');
        }
    });

    socket.on('disconnect', () => {
        console.log('Ein Benutzer hat sich getrennt');
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server läuft auf Port ${PORT}`);
    console.log(`Öffne http://localhost:${PORT} in deinem Browser`);
});

// Zähler in Redis initialisieren
async function initializeCounter() {
    try {
        const exists = await redis.exists(COUNTER_KEY);
        if (!exists) {
            await redis.set(COUNTER_KEY, 0);
            console.log(`Zähler ${COUNTER_KEY} auf 0 initialisiert.`);
        } else {
            console.log(`Zähler ${COUNTER_KEY} existiert bereits mit Wert: ${await redis.get(COUNTER_KEY)}`);
        }
    } catch (error) {
        console.error('Fehler beim Initialisieren des Zählers in Redis:', error);
    }
}
initializeCounter();