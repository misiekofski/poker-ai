const express = require('express');
const http = require('http');
const path = require('path');
const GameServer = require('./server/GameServer');

const app = express();
const server = http.createServer(app);

// Ustaw porty
const PORT = process.env.PORT || 3000;
const isDev = process.env.NODE_ENV !== 'production';

// Serwuj pliki statyczne z folderu public
app.use(express.static(path.join(__dirname, 'public')));

// Główna strona
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Inicjalizuj serwer gry
const gameServer = new GameServer(server, isDev);

// Uruchom serwer
server.listen(PORT, () => {
    console.log(`🃏 Poker Server running on http://localhost:${PORT}`);
    console.log(`📊 Mode: ${isDev ? 'DEVELOPMENT' : 'PRODUCTION'}`);
    if (isDev) {
        console.log('🔧 Dev mode enabled - enhanced logging and debugging features active');
        console.log('🤖 Bots available for testing multiplayer locally');
    }
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 Server shutting down...');
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});
