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

// Upgrade-Kosten und -Werte
const UPGRADE_COSTS = [0, 10, 100, 1000, 10000]; // Beispiel-Kosten für Level 0, 1, 2...
const UPGRADE_VALUES = [1, 2, 5, 10, 50]; // Beispiel-Klickwerte für Level 0, 1, 2...

// Statische Dateien aus dem 'public'-Ordner servieren
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'cookie-clicker.html'));
});

io.on('connection', async (socket) => {
    console.log('Ein Benutzer hat sich verbunden');

    try {
        const [currentCount, upgradeLevel, clickValue] = await redis.mget(COUNTER_KEY, UPGRADE_LEVEL_KEY, CLICK_VALUE_KEY);
        socket.emit('update-counter', parseInt(currentCount || '0', 10));
        socket.emit('update-upgrade', parseInt(upgradeLevel || '0', 10));
        socket.emit('update-click-value', parseInt(clickValue || '1', 10));
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
            const nextLevel = parseInt(currentLevel || '0', 10) + 1;

            if (nextLevel < UPGRADE_COSTS.length) {
                const cost = UPGRADE_COSTS[nextLevel];
                if (parseInt(currentCount) >= cost) {
                    await redis.decrby(COUNTER_KEY, cost);
                    await redis.incr(UPGRADE_LEVEL_KEY);
                    await redis.set(CLICK_VALUE_KEY, UPGRADE_VALUES[nextLevel]);

                    const newCount = await redis.get(COUNTER_KEY);
                    io.emit('update-counter', parseInt(newCount, 10));
                    io.emit('update-upgrade', nextLevel);
                    io.emit('update-click-value', UPGRADE_VALUES[nextLevel]);
                } else {
                    socket.emit('error-message', 'Nicht genug Cookies für das Upgrade!');
                }
            } else {
                socket.emit('error-message', 'Keine weiteren Upgrades verfügbar!');
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
        if (!valueExists) await redis.set(CLICK_VALUE_KEY, UPGRADE_VALUES[0]);

        console.log(`Spielstatus in Redis initialisiert.`);
    } catch (error) {
        console.error('Fehler beim Initialisieren des Spielstatus:', error);
    }
}
initializeKeys();