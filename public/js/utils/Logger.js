// Logger.js - System logowania z różnymi poziomami

class Logger {
    constructor() {
        this.logs = [];
        this.maxLogs = 1000; // Maksymalna liczba logów w pamięci
        this.logElement = null; // Element DOM do wyświetlania logów
        this.enabled = true;
        
        // Kolory dla różnych poziomów logów
        this.colors = {
            ERROR: '#ff4444',
            WARN: '#ffaa00',
            INFO: '#4444ff',
            DEBUG: '#888888',
            GAME: '#00aa44'
        };
        
        // Prefixy dla logów
        this.prefixes = {
            ERROR: '❌',
            WARN: '⚠️',
            INFO: 'ℹ️',
            DEBUG: '🔧',
            GAME: '🎮'
        };
        
        this.initializeLogElement();
    }
    
    // Inicjalizuje element DOM dla logów
    initializeLogElement() {
        if (typeof document !== 'undefined') {
            this.logElement = document.getElementById('log-content');
        }
    }
    
    // Główna metoda logowania
    log(level, message, data = null) {
        if (!this.enabled) return;
        
        // Sprawdź czy poziom logowania jest dozwolony
        if (typeof window !== 'undefined' && window.config && !window.config.shouldLog(level)) {
            return;
        }
        
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = {
            level,
            message,
            data,
            timestamp,
            id: Date.now() + Math.random()
        };
        
        // Dodaj do pamięci
        this.logs.push(logEntry);
        
        // Ogranicz rozmiar pamięci logów
        if (this.logs.length > this.maxLogs) {
            this.logs = this.logs.slice(-this.maxLogs);
        }
        
        // Wyświetl w konsoli
        this.logToConsole(logEntry);
        
        // Wyświetl w UI (jeśli włączone)
        if (typeof window !== 'undefined' && window.config && window.config.get('debug.logToUI')) {
            this.logToUI(logEntry);
        }
        
        // Wyślij event dla innych komponentów
        this.dispatchLogEvent(logEntry);
    }
    
    // Metody dla różnych poziomów
    error(message, data = null) {
        this.log('ERROR', message, data);
    }
    
    warn(message, data = null) {
        this.log('WARN', message, data);
    }
    
    info(message, data = null) {
        this.log('INFO', message, data);
    }
    
    debug(message, data = null) {
        this.log('DEBUG', message, data);
    }
    
    game(message, data = null) {
        this.log('GAME', message, data);
    }
    
    // Logowanie do konsoli przeglądarki
    logToConsole(logEntry) {
        const { level, message, data, timestamp } = logEntry;
        const prefix = this.prefixes[level] || '';
        const fullMessage = `${prefix} [${timestamp}] ${message}`;
        
        // Wybierz odpowiednią metodę console
        switch (level) {
            case 'ERROR':
                console.error(fullMessage, data || '');
                break;
            case 'WARN':
                console.warn(fullMessage, data || '');
                break;
            case 'DEBUG':
                console.debug(fullMessage, data || '');
                break;
            default:
                console.log(fullMessage, data || '');
        }
    }
    
    // Logowanie do UI
    logToUI(logEntry) {
        if (!this.logElement) {
            this.initializeLogElement();
        }
        
        if (!this.logElement) return;
        
        const { level, message, timestamp, id } = logEntry;
        
        // Utwórz element logu
        const logDiv = document.createElement('div');
        logDiv.className = `log-entry ${level.toLowerCase()}`;
        logDiv.setAttribute('data-log-id', id);
        
        // Formatuj timestamp
        const timeSpan = document.createElement('span');
        timeSpan.className = 'log-time';
        timeSpan.textContent = `[${timestamp}]`;
        
        // Prefix poziomu
        const prefixSpan = document.createElement('span');
        prefixSpan.className = 'log-prefix';
        prefixSpan.textContent = this.prefixes[level] || '';
        
        // Wiadomość
        const messageSpan = document.createElement('span');
        messageSpan.className = 'log-message';
        messageSpan.textContent = message;
        
        // Złóż elementy
        logDiv.appendChild(timeSpan);
        logDiv.appendChild(prefixSpan);
        logDiv.appendChild(messageSpan);
        
        // Dodaj do kontenera
        this.logElement.appendChild(logDiv);
        
        // Przewiń na dół
        this.logElement.scrollTop = this.logElement.scrollHeight;
        
        // Usuń stare logi z DOM (zachowaj tylko ostatnie 100)
        const logElements = this.logElement.querySelectorAll('.log-entry');
        if (logElements.length > 100) {
            logElements[0].remove();
        }
    }
    
    // Wyślij event o nowym logu
    dispatchLogEvent(logEntry) {
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('newLogEntry', {
                detail: logEntry
            }));
        }
    }
    
    // Czyści logi
    clear() {
        this.logs = [];
        if (this.logElement) {
            this.logElement.innerHTML = '';
        }
        console.clear();
        this.info('Logi zostały wyczyszczone');
    }
    
    // Włącza/wyłącza logowanie
    setEnabled(enabled) {
        this.enabled = enabled;
        if (enabled) {
            this.info('Logowanie zostało włączone');
        }
    }
    
    // Zwraca wszystkie logi
    getAllLogs() {
        return [...this.logs];
    }
    
    // Zwraca logi dla określonego poziomu
    getLogsByLevel(level) {
        return this.logs.filter(log => log.level === level);
    }
    
    // Zwraca ostatnie N logów
    getRecentLogs(count = 50) {
        return this.logs.slice(-count);
    }
    
    // Eksportuje logi do JSON
    exportLogs() {
        return JSON.stringify(this.logs, null, 2);
    }
    
    // Zapisuje logi do pliku (tylko w przeglądarce)
    downloadLogs() {
        if (typeof window === 'undefined') return;
        
        const logsJson = this.exportLogs();
        const blob = new Blob([logsJson], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `poker-logs-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        URL.revokeObjectURL(url);
        this.info('Logi zostały pobrane');
    }
    
    // Metody specjalne dla gry pokerowej
    
    // Loguje akcję gracza
    logPlayerAction(playerName, action, amount = null) {
        const message = amount 
            ? `${playerName} ${action} $${amount}`
            : `${playerName} ${action}`;
        this.game(message);
    }
    
    // Loguje rozdanie kart
    logCardDeal(playerName, cardCount, phase = '') {
        const phaseText = phase ? ` (${phase})` : '';
        this.game(`Rozdano ${cardCount} kart dla ${playerName}${phaseText}`);
    }
    
    // Loguje wynik rundy
    logRoundResult(winner, amount, handDescription = '') {
        const handText = handDescription ? ` z układem: ${handDescription}` : '';
        this.game(`${winner} wygrywa $${amount}${handText}`);
    }
    
    // Loguje błąd gry
    logGameError(error, context = '') {
        const contextText = context ? ` (${context})` : '';
        this.error(`Błąd gry${contextText}: ${error.message || error}`);
    }
    
    // Loguje stan gry (dla debugowania)
    logGameState(gameState) {
        if (typeof window !== 'undefined' && window.config && window.config.isDev()) {
            this.debug('Stan gry:', {
                phase: gameState.phase,
                pot: gameState.pot,
                currentPlayer: gameState.currentPlayer,
                activePlayers: gameState.players?.filter(p => p.status === 'active').length
            });
        }
    }
    
    // Loguje działanie AI
    logAIAction(botName, action, reasoning = '') {
        const reasonText = reasoning ? ` (powód: ${reasoning})` : '';
        this.debug(`AI ${botName}: ${action}${reasonText}`);
    }
    
    // Formatuje czas dla czytelności
    formatTime(timestamp) {
        return new Date(timestamp).toLocaleString();
    }
    
    // Filtruje logi po tekście
    filterLogs(searchText) {
        const searchLower = searchText.toLowerCase();
        return this.logs.filter(log => 
            log.message.toLowerCase().includes(searchLower) ||
            log.level.toLowerCase().includes(searchLower)
        );
    }
}

// Singleton - jedna instancja loggera dla całej aplikacji
const logger = new Logger();

// Eksport dla Node.js lub przeglądarki
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Logger;
} else if (typeof window !== 'undefined') {
    window.Logger = Logger;
    window.logger = logger;
}
