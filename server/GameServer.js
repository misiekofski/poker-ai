// GameServer.js - Główny serwer gry z Socket.IO

const { Server } = require('socket.io');
const GameRoom = require('./GameRoom');
const BotManager = require('./BotManager');

// Importuj moduły współdzielone
const { GameConstants, PokerUtils } = require('../public/js/shared/Constants');
const Constants = GameConstants; // Kompatybilność
const { Card, CardDeck } = require('../public/js/shared/CardDeck');
const HandEvaluator = require('../public/js/shared/HandEvaluator');

class GameServer {
    constructor(httpServer, isDev = false) {
        this.httpServer = httpServer;
        this.isDev = isDev;
        
        // Inicjalizuj Socket.IO
        this.io = new Server(httpServer, {
            cors: {
                origin: isDev ? ["http://localhost:3000", "http://127.0.0.1:3000"] : false,
                methods: ["GET", "POST"]
            },
            transports: ['websocket', 'polling'],
            pingTimeout: 60000,
            pingInterval: 25000
        });
        
        // Pokoje gry
        this.gameRooms = new Map();
        this.defaultRoomName = 'default';
        
        // Manager botów
        this.botManager = new BotManager();
        
        // Statystyki serwera
        this.stats = {
            connectedPlayers: 0,
            activeGames: 0,
            totalGamesPlayed: 0,
            serverStartTime: Date.now()
        };
        
        this.setupSocketHandlers();
        this.startMaintenanceTasks();
        
        this.log('🚀 GameServer zainicjalizowany');
    }
    
    // Konfiguruj obsługę Socket.IO
    setupSocketHandlers() {
        this.io.on('connection', (socket) => {
            this.handleClientConnection(socket);
        });
    }
    
    // Obsługa nowego połączenia klienta
    handleClientConnection(socket) {
        this.stats.connectedPlayers++;
        this.log(`👤 Nowe połączenie: ${socket.id} (Razem: ${this.stats.connectedPlayers})`);
        
        // Wyślij powitanie
        socket.emit('welcome', {
            message: 'Połączono z serwerem poker',
            serverId: 'poker-server-1',
            serverTime: Date.now(),
            isDev: this.isDev
        });
        
        // Obsługa eventów gracza
        socket.on(Constants.SOCKET_EVENTS.JOIN_GAME, (data, callback) => {
            this.handleJoinGame(socket, data, callback);
        });
        
        socket.on(Constants.SOCKET_EVENTS.LEAVE_GAME, (data) => {
            this.handleLeaveGame(socket, data);
        });
        
        socket.on(Constants.SOCKET_EVENTS.PLAYER_ACTION, (data, callback) => {
            this.handlePlayerAction(socket, data, callback);
        });
        
        socket.on(Constants.SOCKET_EVENTS.START_GAME, (data) => {
            this.handleStartGame(socket, data);
        });
        
        socket.on(Constants.SOCKET_EVENTS.ADD_BOTS, (data) => {
            this.handleAddBots(socket, data);
        });
        
        // Eventy systemowe
        socket.on('ping', (timestamp, callback) => {
            if (callback) callback(Date.now());
        });
        
        socket.on('get_stats', (callback) => {
            if (callback) callback(this.getServerStats());
        });
        
        // Rozłączenie
        socket.on('disconnect', (reason) => {
            this.handleClientDisconnection(socket, reason);
        });
    }
    
    // Dołącz gracza do gry
    handleJoinGame(socket, data, callback) {
        try {
            const { playerName, gameRoom = this.defaultRoomName } = data;
            
            if (!playerName || playerName.trim() === '') {
                return this.sendError(callback, 'Nazwa gracza jest wymagana');
            }
            
            // Pobierz lub utwórz pokój
            let room = this.gameRooms.get(gameRoom);
            if (!room) {
                room = new GameRoom(gameRoom, this.isDev);
                this.gameRooms.set(gameRoom, room);
                this.stats.activeGames++;
                this.log(`🏠 Utworzono nowy pokój: ${gameRoom}`);
            }
            
            // Dodaj gracza do pokoju
            const result = room.addPlayer(socket, playerName);
            
            if (result.success) {
                // Dołącz socket do pokoju Socket.IO
                socket.join(gameRoom);
                socket.gameRoom = gameRoom;
                socket.playerId = result.playerId;
                
                // Powiadom innych graczy
                socket.to(gameRoom).emit(Constants.SOCKET_EVENTS.PLAYER_JOINED, {
                    playerId: result.playerId,
                    name: playerName,
                    timestamp: Date.now()
                });
                
                // Wyślij aktualny stan gry
                socket.emit(Constants.SOCKET_EVENTS.GAME_STATE, room.getGameState());
                
                this.log(`➕ ${playerName} dołączył do pokoju ${gameRoom}`);
                
                if (callback) {
                    callback({
                        success: true,
                        playerId: result.playerId,
                        gameRoom: gameRoom
                    });
                }
            } else {
                this.sendError(callback, result.error);
            }
            
        } catch (error) {
            this.logError('Błąd dołączenia do gry:', error);
            this.sendError(callback, 'Wewnętrzny błąd serwera');
        }
    }
    
    // Opuść grę
    handleLeaveGame(socket, data) {
        try {
            const gameRoom = socket.gameRoom;
            if (!gameRoom) return;
            
            const room = this.gameRooms.get(gameRoom);
            if (!room) return;
            
            const result = room.removePlayer(socket.playerId);
            
            if (result.success) {
                // Opuść pokój Socket.IO
                socket.leave(gameRoom);
                
                // Powiadom innych graczy
                socket.to(gameRoom).emit(Constants.SOCKET_EVENTS.PLAYER_LEFT, {
                    playerId: socket.playerId,
                    name: result.playerName,
                    timestamp: Date.now()
                });
                
                // Wyślij zaktualizowany stan gry
                this.broadcastGameState(gameRoom);
                
                this.log(`➖ ${result.playerName} opuścił pokój ${gameRoom}`);
                
                // Usuń pokój jeśli pusty
                if (room.getPlayerCount() === 0 && !room.hasActiveBots()) {
                    this.gameRooms.delete(gameRoom);
                    this.stats.activeGames--;
                    this.log(`🗑️ Usunięto pusty pokój: ${gameRoom}`);
                }
            }
            
        } catch (error) {
            this.logError('Błąd opuszczenia gry:', error);
        }
    }
    
    // Obsługa akcji gracza
    handlePlayerAction(socket, data, callback) {
        try {
            const { playerId, action, amount } = data;
            const gameRoom = socket.gameRoom;
            
            if (!gameRoom) {
                return this.sendError(callback, 'Gracz nie jest w pokoju');
            }
            
            const room = this.gameRooms.get(gameRoom);
            if (!room) {
                return this.sendError(callback, 'Pokój nie istnieje');
            }
            
            // Wykonaj akcję
            const result = room.processPlayerAction(playerId, action, amount);
            
            if (result.success) {
                // Wyślij zaktualizowany stan gry do wszystkich graczy
                this.broadcastGameState(gameRoom);
                
                if (callback) {
                    callback({ success: true });
                }
            } else {
                this.sendError(callback, result.error);
            }
            
        } catch (error) {
            this.logError('Błąd akcji gracza:', error);
            this.sendError(callback, 'Wewnętrzny błąd serwera');
        }
    }
    
    // Rozpocznij grę
    handleStartGame(socket, data) {
        try {
            const gameRoom = socket.gameRoom;
            if (!gameRoom) return;
            
            const room = this.gameRooms.get(gameRoom);
            if (!room) return;
            
            const result = room.startGame(socket.playerId);
            
            if (result.success) {
                this.broadcastGameState(gameRoom);
                this.log(`🎮 Rozpoczęto grę w pokoju ${gameRoom}`);
                this.stats.totalGamesPlayed++;
            } else {
                socket.emit(Constants.SOCKET_EVENTS.ERROR, result.error);
            }
            
        } catch (error) {
            this.logError('Błąd rozpoczęcia gry:', error);
        }
    }
    
    // Dodaj boty (tylko tryb dev)
    handleAddBots(socket, data) {
        if (!this.isDev) {
            socket.emit(Constants.SOCKET_EVENTS.ERROR, 'Boty dostępne tylko w trybie deweloperskim');
            return;
        }
        
        try {
            const { count = 3 } = data;
            const gameRoom = socket.gameRoom;
            
            if (!gameRoom) return;
            
            const room = this.gameRooms.get(gameRoom);
            if (!room) return;
            
            const result = room.addBots(count, this.botManager);
            
            if (result.success) {
                this.broadcastGameState(gameRoom);
                this.log(`🤖 Dodano ${result.addedCount} botów do pokoju ${gameRoom}`);
            } else {
                socket.emit(Constants.SOCKET_EVENTS.ERROR, result.error);
            }
            
        } catch (error) {
            this.logError('Błąd dodawania botów:', error);
        }
    }
    
    // Rozłączenie klienta
    handleClientDisconnection(socket, reason) {
        this.stats.connectedPlayers--;
        this.log(`👋 Rozłączenie: ${socket.id} (${reason}) - Pozostało: ${this.stats.connectedPlayers}`);
        
        // Automatycznie opuść grę
        if (socket.gameRoom && socket.playerId) {
            this.handleLeaveGame(socket, { playerId: socket.playerId });
        }
    }
    
    // Wyślij stan gry do wszystkich graczy w pokoju
    broadcastGameState(gameRoom) {
        const room = this.gameRooms.get(gameRoom);
        if (!room) return;
        
        const gameState = room.getGameState();
        this.io.to(gameRoom).emit(Constants.SOCKET_EVENTS.GAME_STATE, gameState);
    }
    
    // Wyślij błąd
    sendError(callback, message) {
        if (callback) {
            callback({
                success: false,
                error: message
            });
        }
    }
    
    // Pobierz statystyki serwera
    getServerStats() {
        const uptime = Date.now() - this.stats.serverStartTime;
        
        return {
            ...this.stats,
            uptime: uptime,
            uptimeFormatted: this.formatUptime(uptime),
            activeRooms: this.gameRooms.size,
            roomDetails: Array.from(this.gameRooms.entries()).map(([name, room]) => ({
                name,
                players: room.getPlayerCount(),
                isActive: room.isGameActive(),
                phase: room.getCurrentPhase()
            }))
        };
    }
    
    // Formatuj czas działania serwera
    formatUptime(uptimeMs) {
        const seconds = Math.floor(uptimeMs / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        
        if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
        if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
        if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
        return `${seconds}s`;
    }
    
    // Uruchom zadania konserwacyjne
    startMaintenanceTasks() {
        // Czyść nieaktywne pokoje co 5 minut
        setInterval(() => {
            this.cleanupInactiveRooms();
        }, 5 * 60 * 1000);
        
        // Loguj statystyki co godzinę
        setInterval(() => {
            this.logServerStats();
        }, 60 * 60 * 1000);
        
        // Ping wszystkich graczy co 30 sekund
        setInterval(() => {
            this.pingAllClients();
        }, 30 * 1000);
    }
    
    // Wyczyść nieaktywne pokoje
    cleanupInactiveRooms() {
        const now = Date.now();
        const inactiveThreshold = 30 * 60 * 1000; // 30 minut
        
        for (const [roomName, room] of this.gameRooms.entries()) {
            if (room.getPlayerCount() === 0 && 
                !room.hasActiveBots() && 
                (now - room.getLastActivity()) > inactiveThreshold) {
                
                this.gameRooms.delete(roomName);
                this.stats.activeGames--;
                this.log(`🧹 Usunięto nieaktywny pokój: ${roomName}`);
            }
        }
    }
    
    // Loguj statystyki serwera
    logServerStats() {
        const stats = this.getServerStats();
        this.log(`📊 Statystyki: ${stats.connectedPlayers} graczy, ${stats.activeGames} gier, uptime: ${stats.uptimeFormatted}`);
    }
    
    // Ping wszystkich klientów
    pingAllClients() {
        this.io.emit('ping', Date.now());
    }
    
    // Logowanie
    log(message) {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] [GameServer] ${message}`);
    }
    
    logError(message, error = null) {
        const timestamp = new Date().toISOString();
        console.error(`[${timestamp}] [GameServer ERROR] ${message}`);
        if (error) {
            console.error(error);
        }
    }
    
    // Graceful shutdown
    shutdown() {
        this.log('🛑 Rozpoczynanie shutdown serwera...');
        
        // Powiadom wszystkich graczy
        this.io.emit('server_shutdown', {
            message: 'Serwer zostanie zamknięty za 10 sekund',
            countdown: 10
        });
        
        // Zamknij wszystkie pokoje
        for (const [roomName, room] of this.gameRooms.entries()) {
            room.endGame('Zamknięcie serwera');
        }
        
        // Rozłącz wszystkich klientów
        setTimeout(() => {
            this.io.disconnectSockets(true);
            this.log('✅ Serwer zamknięty');
        }, 10000);
    }
    
    // API do zarządzania serwerem (HTTP endpoints)
    setupManagementAPI(app) {
        if (!this.isDev) return;
        
        // Status serwera
        app.get('/api/server/status', (req, res) => {
            res.json(this.getServerStats());
        });
        
        // Lista pokoi
        app.get('/api/server/rooms', (req, res) => {
            const rooms = Array.from(this.gameRooms.entries()).map(([name, room]) => ({
                name,
                players: room.getPlayerCount(),
                isActive: room.isGameActive(),
                phase: room.getCurrentPhase(),
                lastActivity: room.getLastActivity()
            }));
            
            res.json(rooms);
        });
        
        // Restart pokoju
        app.post('/api/server/rooms/:roomName/restart', (req, res) => {
            const room = this.gameRooms.get(req.params.roomName);
            if (room) {
                room.endGame('Restart przez administratora');
                res.json({ success: true, message: 'Pokój zrestartowany' });
            } else {
                res.status(404).json({ success: false, error: 'Pokój nie znaleziony' });
            }
        });
        
        this.log('🔧 API zarządzania serwerem dostępne w trybie dev');
    }
}

module.exports = GameServer;
