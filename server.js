const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const Redis = require('ioredis');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Initialize Redis client
const redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : 6379,
    password: process.env.REDIS_PASSWORD || undefined
});

const COUNTER_KEY = 'global_cookie_clicks';
const UPGRADE_LEVEL_KEY = 'global_upgrade_level';
const CLICK_VALUE_KEY = 'global_click_value';

// Serve static files from the 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'cookie-clicker.html'));
});

// Dynamic calculation of upgrade costs and click values
function getUpgradeCost(level) {
    // Base cost 10, growth factor 1.5
    return Math.floor(10 * Math.pow(1.5, level));
}
function getClickValue(level) {
    // Click value increases by 1 for each level
    return 1 + level;
}

// API endpoint to reset the game state
app.get('/reset', async (req, res) => {
    const RESET_KEY = process.env.RESET_KEY || 'DEIN_SUPER_GEHEIMES_PASSWORT';
    
    if (req.query.key === RESET_KEY) {
        try {
            await redis.set(COUNTER_KEY, 0);
            await redis.set(UPGRADE_LEVEL_KEY, 0);
            await redis.set(CLICK_VALUE_KEY, 1);
            io.emit('update-counter', 0);
            io.emit('update-upgrade', { level: 0, nextCost: getUpgradeCost(0) });
            io.emit('update-click-value', 1);
            res.send('Game successfully reset!');
            console.log('Game was reset via the API endpoint.');
        } catch (error) {
            console.error('Error resetting the game:', error);
            res.status(500).send('Error resetting the game.');
        }
    } else {
        res.status(403).send('Access denied.');
    }
});

io.on('connection', async (socket) => {
    console.log('A user connected');

    try {
        const [currentCount, upgradeLevel] = await redis.mget(COUNTER_KEY, UPGRADE_LEVEL_KEY);
        const level = parseInt(upgradeLevel || '0', 10);
        const clickValue = getClickValue(level);
        const nextCost = getUpgradeCost(level);

        socket.emit('update-counter', parseInt(currentCount || '0', 10));
        socket.emit('update-upgrade', { level: level, nextCost: nextCost });
        socket.emit('update-click-value', clickValue);
    } catch (error) {
        console.error('Error loading game state from Redis:', error);
        socket.emit('error-message', 'Error loading the game.');
    }

    // On click
    socket.on('click', async () => {
        try {
            const clickValue = parseInt(await redis.get(CLICK_VALUE_KEY) || '1', 10);
            const newCount = await redis.incrby(COUNTER_KEY, clickValue);
            io.emit('update-counter', newCount);
        } catch (error) {
            console.error('Error incrementing counter in Redis:', error);
            socket.emit('error-message', 'Error during click.');
        }
    });

    // On upgrade purchase
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
                socket.emit('error-message', 'Not enough cookies for the upgrade!');
            }
        } catch (error) {
            console.error('Error purchasing upgrade:', error);
            socket.emit('error-message', 'Error purchasing the upgrade.');
        }
    });

    socket.on('disconnect', () => {
        console.log('A user disconnected');
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Open http://localhost:${PORT} in your browser`);
});

// Initialize keys in Redis
async function initializeKeys() {
    try {
        const [counterExists, levelExists, valueExists] = await redis.exists(COUNTER_KEY, UPGRADE_LEVEL_KEY, CLICK_VALUE_KEY);
        if (!counterExists) await redis.set(COUNTER_KEY, 0);
        if (!levelExists) await redis.set(UPGRADE_LEVEL_KEY, 0);
        if (!valueExists) await redis.set(CLICK_VALUE_KEY, 1);
        console.log(`Game state initialized in Redis.`);
    } catch (error) {
        console.error('Error initializing game state:', error);
    }
}
initializeKeys();