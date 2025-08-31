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
const UPGRADE_LEVEL_KEY = 'global_upgrade_level';
const CLICK_VALUE_KEY = 'global_click_value';

// Statische Dateien aus dem 'public'-Ordner servieren
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'cookie-clicker.html'));
});

// Dynamische Berechnung der Upgrade-Werte
function getUpgradeCost(level) {
    return 10 + (level * 20); // Kosten steigen in 20er-Schritten
}
function getClickValue(level) {
    return 1 + level; // Klickwert erhöht sich um 1 pro Level
}

// --- NEUER API-ENDPUNKT ZUM ZURÜCKSETZEN ---
app.get('/reset', async (req, res) => {
    const RESET_KEY = process.env.RESET_KEY || 'reset'; // Ändere das Passwort hier
    
    if (req.query.key === RESET_KEY) {
        try {
            await redis.set(COUNTER_KEY, 0);
            await redis.set(UPGRADE_LEVEL_KEY, 0);
            await redis.set(CLICK_VALUE_KEY, 1);
            io.emit('update-counter', 0);
            io.emit('update-upgrade', { level: 0, nextCost: getUpgradeCost(0) });
            io.emit('update-click-value', 1);
            res.send('Spiel erfolgreich zurückgesetzt!');
            console.log('Spiel wurde über den API-Endpunkt zurückgesetzt.');
        } catch (error) {
            console.error('Fehler beim Zurücksetzen des Spiels:', error);
            res.status(500).send('Fehler beim Zurücksetzen des Spiels.');
        }
    } else {
        res.status(403).send('Zugriff verweigert.');
    }
});
// --- ENDE DES NEUEN CODES ---

io.on('connection', async (socket) => {
    console.log('Ein Benutzer hat sich verbunden');

    try {
        const [currentCount, upgradeLevel] = await redis.mget(COUNTER_KEY, UPGRADE_LEVEL_KEY);
        const level = parseInt(upgradeLevel || '0', 10);
        const clickValue = getClickValue(level);
        const nextCost = getUpgradeCost(level);

        socket.emit('update-counter', parseInt(currentCount || '0', 10));
        socket.emit('update-upgrade', { level: level, nextCost: nextCost });
        socket.emit('update-click-value', clickValue);
    } catch (error) {
        console.error('Fehler beim Laden des Spielstatus von Redis:', error);
        socket.emit('error-message', 'Fehler beim Laden des Spiels.');
    }

    // Beim Klick
    socket.on('click', async () => {
        try {
            const clickValue = parseInt(await redis.get(CLICK_VALUE_KEY) || '1', 10);
            const newCount = await redis.incrby(COUNTER_KEY, clickValue);
            io.emit('update-counter', newCount);
        } catch (error) {
            console.error('Fehler beim Inkrementieren des Zählers in Redis:', error);
            socket.emit('error-message', 'Fehler beim Klick.');
        }
    });

    // Beim Upgrade-Kauf
    socket.on('buy-upgrade', async () => {
        try {
            const [currentCount, currentLevel] = await redis.mget(COUNTER_KEY, UPGRADE_LEVEL_KEY);
            const level = parseInt(currentLevel || '0', 10);
            const cost = getUpgradeCost(level);

            if (parseInt(currentCount) >= cost) {
                const newLevel = level + 1;
                const newClickValue = getClickValue(newLevel);
                const nextCost = getUpgradeCost(newLevel);

                await redis.decrby(COUNTER_KEY, cost);
                await redis.incr(UPGRADE_LEVEL_KEY);
                await redis.set(CLICK_VALUE_KEY, newClickValue);

                const newCount = await redis.get(COUNTER_KEY);
                io.emit('update-counter', parseInt(newCount, 10));
                io.emit('update-upgrade', { level: newLevel, nextCost: nextCost });
                io.emit('update-click-value', newClickValue);
            } else {
                socket.emit('error-message', 'Nicht genug Cookies für das Upgrade!');
            }
        } catch (error) {
            console.error('Fehler beim Kauf des Upgrades:', error);
            socket.emit('error-message', 'Fehler beim Kauf des Upgrades.');
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
async function initializeKeys() {
    try {
        const [counterExists, levelExists, valueExists] = await redis.exists(COUNTER_KEY, UPGRADE_LEVEL_KEY, CLICK_VALUE_KEY);
        if (!counterExists) await redis.set(COUNTER_KEY, 0);
        if (!levelExists) await redis.set(UPGRADE_LEVEL_KEY, 0);
        if (!valueExists) await redis.set(CLICK_VALUE_KEY, 1); // Startwert für Klick = 1

        console.log(`Spielstatus in Redis initialisiert.`);
    } catch (error) {
        console.error('Fehler beim Initialisieren des Spielstatus:', error);
    }
}
initializeKeys();