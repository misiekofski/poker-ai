// NetworkClient.js - Klient WebSocket do multiplayer

class NetworkClient {
    constructor() {
        this.socket = null;
        this.connected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 2000;
        
        // Callback'i
        this.onGameStateUpdate = null;
        this.onPlayerJoined = null;
        this.onPlayerLeft = null;
        this.onGameEnd = null;
        this.onError = null;
        this.onConnected = null;
        this.onDisconnected = null;
        
        // Stan gracza
        this.playerId = null;
        this.playerName = null;
        this.gameRoom = null;
        
        logger.info('NetworkClient zainicjalizowany');
    }
    
    // Połącz z serwerem
    connect(playerName = 'Gracz', gameRoom = 'default') {
        try {
            this.playerName = playerName;
            this.gameRoom = gameRoom;
            
            // Utwórz połączenie WebSocket
            const serverUrl = this.getServerUrl();
            this.socket = io(serverUrl, {
                transports: ['websocket', 'polling'],
                timeout: 10000,
                forceNew: true
            });
            
            this.setupEventListeners();
            
            logger.info(`Łączenie z serwerem: ${serverUrl}`);
            
        } catch (error) {
            logger.error('Błąd połączenia:', error);
            this.handleError(error);
        }
    }
    
    // Rozłącz z serwerem
    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
        
        this.connected = false;
        this.playerId = null;
        
        logger.info('Rozłączono z serwerem');
    }
    
    // Pobierz URL serwera
    getServerUrl() {
        if (config.isDev()) {
            return `http://localhost:3000`;
        } else {
            return `${window.location.protocol}//${window.location.host}`;
        }
    }
    
    // Konfiguruj event listenery
    setupEventListeners() {
        if (!this.socket) return;
        
        // Połączenie
        this.socket.on('connect', () => {
            this.connected = true;
            this.reconnectAttempts = 0;
            
            logger.info('Połączono z serwerem');
            
            // Dołącz do gry
            this.joinGame();
            
            if (this.onConnected) {
                this.onConnected();
            }
        });
        
        // Rozłączenie
        this.socket.on('disconnect', (reason) => {
            this.connected = false;
            
            logger.warn(`Rozłączono: ${reason}`);
            
            if (this.onDisconnected) {
                this.onDisconnected(reason);
            }
            
            // Próbuj ponownie połączyć jeśli nie było to zamierzone
            if (reason === 'io server disconnect') {
                // Serwer zamknął połączenie - nie próbuj ponownie
                return;
            }
            
            this.attemptReconnect();
        });
        
        // Błędy połączenia
        this.socket.on('connect_error', (error) => {
            logger.error('Błąd połączenia:', error);
            this.handleError(error);
        });
        
        // Eventy gry
        this.socket.on(Constants.SOCKET_EVENTS.GAME_STATE, (gameState) => {
            logger.debug('Otrzymano stan gry');
            if (this.onGameStateUpdate) {
                this.onGameStateUpdate(gameState);
            }
        });
        
        this.socket.on(Constants.SOCKET_EVENTS.PLAYER_JOINED, (playerData) => {
            logger.info(`Gracz dołączył: ${playerData.name}`);
            if (this.onPlayerJoined) {
                this.onPlayerJoined(playerData);
            }
        });
        
        this.socket.on(Constants.SOCKET_EVENTS.PLAYER_LEFT, (playerData) => {
            logger.info(`Gracz opuścił grę: ${playerData.name}`);
            if (this.onPlayerLeft) {
                this.onPlayerLeft(playerData);
            }
        });
        
        this.socket.on(Constants.SOCKET_EVENTS.GAME_END, (winnerData) => {
            logger.game('Gra zakończona');
            if (this.onGameEnd) {
                this.onGameEnd(winnerData);
            }
        });
        
        this.socket.on(Constants.SOCKET_EVENTS.ERROR, (errorData) => {
            logger.error('Błąd serwera:', errorData);
            this.handleError(errorData);
        });
        
        // Event dla zmian tury
        this.socket.on(Constants.SOCKET_EVENTS.TURN_CHANGE, (turnData) => {
            logger.debug(`Tura gracza: ${turnData.playerName}`);
        });
        
        // Event dla końca rundy
        this.socket.on(Constants.SOCKET_EVENTS.ROUND_END, (roundData) => {
            logger.game(`Koniec rundy: ${roundData.winner || 'Brak zwycięzcy'}`);
        });
    }
    
    // Dołącz do gry
    joinGame() {
        if (!this.socket || !this.connected) {
            logger.warn('Brak połączenia - nie można dołączyć do gry');
            return;
        }
        
        const joinData = {
            playerName: this.playerName,
            gameRoom: this.gameRoom,
            timestamp: Date.now()
        };
        
        this.socket.emit(Constants.SOCKET_EVENTS.JOIN_GAME, joinData, (response) => {
            if (response.success) {
                this.playerId = response.playerId;
                logger.info(`Dołączono do gry. ID gracza: ${this.playerId}`);
            } else {
                logger.error('Błąd dołączenia do gry:', response.error);
                this.handleError(response.error);
            }
        });
    }
    
    // Opuść grę
    leaveGame() {
        if (!this.socket || !this.connected) return;
        
        this.socket.emit(Constants.SOCKET_EVENTS.LEAVE_GAME, {
            playerId: this.playerId
        });
        
        logger.info('Opuszczono grę');
    }
    
    // Wyślij akcję gracza
    sendPlayerAction(action, amount = 0) {
        if (!this.socket || !this.connected || !this.playerId) {
            logger.warn('Nie można wysłać akcji - brak połączenia');
            return false;
        }
        
        const actionData = {
            playerId: this.playerId,
            action: action,
            amount: amount,
            timestamp: Date.now()
        };
        
        this.socket.emit(Constants.SOCKET_EVENTS.PLAYER_ACTION, actionData, (response) => {
            if (!response.success) {
                logger.error('Błąd akcji gracza:', response.error);
                this.handleError(response.error);
            }
        });
        
        logger.debug(`Wysłano akcję: ${action} ${amount > 0 ? '$' + amount : ''}`);
        return true;
    }
    
    // Rozpocznij grę (dla hosta)
    startGame() {
        if (!this.socket || !this.connected) return;
        
        this.socket.emit(Constants.SOCKET_EVENTS.START_GAME, {
            playerId: this.playerId
        });
        
        logger.info('Poproszono o rozpoczęcie gry');
    }
    
    // Dodaj boty (tryb deweloperski)
    addBots(count = 3) {
        if (!this.socket || !this.connected) return;
        
        if (!config.isDev()) {
            logger.warn('Dodawanie botów dostępne tylko w trybie deweloperskim');
            return;
        }
        
        this.socket.emit(Constants.SOCKET_EVENTS.ADD_BOTS, {
            playerId: this.playerId,
            count: count
        });
        
        logger.info(`Poproszono o dodanie ${count} botów`);
    }
    
    // Próba ponownego połączenia
    attemptReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            logger.error('Przekroczono maksymalną liczbę prób ponownego połączenia');
            this.handleError(new Error('Nie udało się ponownie połączyć z serwerem'));
            return;
        }
        
        this.reconnectAttempts++;
        
        logger.info(`Próba ponownego połączenia ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
        
        setTimeout(() => {
            if (!this.connected) {
                this.connect(this.playerName, this.gameRoom);
            }
        }, this.reconnectDelay * this.reconnectAttempts);
    }
    
    // Obsługa błędów
    handleError(error) {
        const errorMessage = typeof error === 'string' ? error : 
                           error.message || 'Nieznany błąd sieci';
        
        logger.error('NetworkClient error:', errorMessage);
        
        if (this.onError) {
            this.onError({
                message: errorMessage,
                type: 'network',
                timestamp: Date.now()
            });
        }
    }
    
    // Wyślij wiadomość ping (do testowania połączenia)
    ping() {
        if (!this.socket || !this.connected) return;
        
        const startTime = Date.now();
        
        this.socket.emit('ping', startTime, (response) => {
            const latency = Date.now() - startTime;
            logger.debug(`Ping: ${latency}ms`);
        });
    }
    
    // Sprawdź status połączenia
    isConnected() {
        return this.connected && this.socket && this.socket.connected;
    }
    
    // Pobierz informacje o połączeniu
    getConnectionInfo() {
        return {
            connected: this.connected,
            playerId: this.playerId,
            playerName: this.playerName,
            gameRoom: this.gameRoom,
            reconnectAttempts: this.reconnectAttempts,
            serverUrl: this.getServerUrl(),
            socketId: this.socket ? this.socket.id : null
        };
    }
    
    // Ustaw callback'i
    setCallbacks(callbacks) {
        Object.assign(this, callbacks);
    }
    
    // Wyślij niestandardowy event (dla rozszerzeń)
    emit(eventName, data, callback) {
        if (!this.socket || !this.connected) {
            logger.warn(`Nie można wysłać eventu ${eventName} - brak połączenia`);
            return false;
        }
        
        this.socket.emit(eventName, data, callback);
        return true;
    }
    
    // Nasłuchuj niestandardowego eventu
    on(eventName, handler) {
        if (!this.socket) {
            logger.warn(`Nie można nasłuchiwać eventu ${eventName} - brak socket'a`);
            return;
        }
        
        this.socket.on(eventName, handler);
    }
    
    // Usuń listener eventu
    off(eventName, handler) {
        if (!this.socket) return;
        
        this.socket.off(eventName, handler);
    }
    
    // Debug: pobierz listę aktywnych eventów
    getActiveEvents() {
        if (!this.socket) return [];
        
        return Object.keys(this.socket._callbacks || {});
    }
    
    // Wyślij heartbeat (utrzymanie połączenia)
    startHeartbeat(interval = 30000) {
        this.stopHeartbeat();
        
        this.heartbeatInterval = setInterval(() => {
            if (this.isConnected()) {
                this.ping();
            }
        }, interval);
        
        logger.debug(`Rozpoczęto heartbeat (${interval}ms)`);
    }
    
    // Zatrzymaj heartbeat
    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }
    
    // Statystyki połączenia
    getNetworkStats() {
        if (!this.socket) return null;
        
        return {
            connected: this.connected,
            transport: this.socket.io.engine.transport.name,
            upgraded: this.socket.io.engine.upgraded,
            reconnectAttempts: this.reconnectAttempts,
            playerId: this.playerId,
            gameRoom: this.gameRoom
        };
    }
    
    // Test połączenia
    async testConnection() {
        return new Promise((resolve) => {
            if (!this.isConnected()) {
                resolve({
                    success: false,
                    error: 'Brak połączenia'
                });
                return;
            }
            
            const startTime = Date.now();
            
            this.socket.emit('ping', startTime, (response) => {
                const latency = Date.now() - startTime;
                
                resolve({
                    success: true,
                    latency: latency,
                    serverTime: response,
                    transport: this.socket.io.engine.transport.name
                });
            });
            
            // Timeout po 5 sekundach
            setTimeout(() => {
                resolve({
                    success: false,
                    error: 'Timeout połączenia'
                });
            }, 5000);
        });
    }
    
    // Destruktor
    destroy() {
        this.stopHeartbeat();
        this.disconnect();
        
        // Wyczyść callback'i
        this.onGameStateUpdate = null;
        this.onPlayerJoined = null;
        this.onPlayerLeft = null;
        this.onGameEnd = null;
        this.onError = null;
        this.onConnected = null;
        this.onDisconnected = null;
        
        logger.info('NetworkClient zniszczony');
    }
}

// Eksport dla przeglądarki
if (typeof window !== 'undefined') {
    window.NetworkClient = NetworkClient;
}
