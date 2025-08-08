// Config.js - Konfiguracja aplikacji

class Config {
    constructor() {
        // Wykryj tryb na podstawie środowiska
        this.isDevelopment = this.detectDevelopmentMode();
        
        // Ustawienia podstawowe
        this.settings = {
            // Tryb deweloperski
            isDev: this.isDevelopment,
            
            // Serwer
            server: {
                host: this.isDevelopment ? 'localhost' : window.location.hostname,
                port: this.isDevelopment ? 3000 : window.location.port || 80,
                protocol: window.location.protocol === 'https:' ? 'wss:' : 'ws:'
            },
            
            // Gra
            game: {
                startingChips: 1000,
                smallBlind: 10,
                bigBlind: 20,
                minRaise: 20,
                turnTimeout: this.isDevelopment ? 60000 : 30000, // Więcej czasu w dev
                botThinkTime: this.isDevelopment ? 1000 : 2000,
                maxPlayers: 8,
                minPlayers: 2
            },
            
            // UI
            ui: {
                animationSpeed: this.isDevelopment ? 100 : 300, // Szybsze animacje w dev
                showDebugInfo: this.isDevelopment,
                enableTestButtons: this.isDevelopment,
                logLevel: this.isDevelopment ? 'DEBUG' : 'INFO'
            },
            
            // AI
            ai: {
                defaultCount: 3, // Domyślna liczba botów w singleplayer
                aggressionVariance: 0.2, // Losowość w agresji AI
                bluffFrequency: 0.1,
                foldThreshold: 0.3
            },
            
            // Debugowanie
            debug: {
                enableLogging: this.isDevelopment,
                logToConsole: true,
                logToUI: this.isDevelopment,
                showHandStrength: this.isDevelopment,
                revealBotCards: this.isDevelopment,
                skipAnimations: false
            }
        };
        
        // Ładuj ustawienia z localStorage jeśli dostępne
        this.loadSavedSettings();
    }
    
    // Wykrywa czy jesteśmy w trybie deweloperskim
    detectDevelopmentMode() {
        // Sprawdź hostname
        if (window.location.hostname === 'localhost' || 
            window.location.hostname === '127.0.0.1' ||
            window.location.hostname.startsWith('192.168.')) {
            return true;
        }
        
        // Sprawdź port developerski
        if (window.location.port === '3000' || window.location.port === '8080') {
            return true;
        }
        
        // Sprawdź parametr URL
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('dev') === 'true') {
            return true;
        }
        
        // Sprawdź localStorage
        if (localStorage.getItem('poker_dev_mode') === 'true') {
            return true;
        }
        
        return false;
    }
    
    // Włącza/wyłącza tryb deweloperski
    setDevelopmentMode(enabled) {
        this.settings.isDev = enabled;
        this.settings.debug.enableLogging = enabled;
        this.settings.debug.logToUI = enabled;
        this.settings.ui.showDebugInfo = enabled;
        this.settings.ui.enableTestButtons = enabled;
        
        // Zapisz w localStorage
        localStorage.setItem('poker_dev_mode', enabled.toString());
        
        // Powiadom aplikację o zmianie
        this.notifyConfigChange('developmentMode', enabled);
    }
    
    // Pobiera ustawienie
    get(path) {
        const keys = path.split('.');
        let value = this.settings;
        
        for (const key of keys) {
            if (value && typeof value === 'object' && key in value) {
                value = value[key];
            } else {
                return undefined;
            }
        }
        
        return value;
    }
    
    // Ustawia wartość
    set(path, value) {
        const keys = path.split('.');
        const lastKey = keys.pop();
        let obj = this.settings;
        
        for (const key of keys) {
            if (!(key in obj)) {
                obj[key] = {};
            }
            obj = obj[key];
        }
        
        obj[lastKey] = value;
        this.saveSettings();
        this.notifyConfigChange(path, value);
    }
    
    // Ładuje zapisane ustawienia
    loadSavedSettings() {
        try {
            const saved = localStorage.getItem('poker_config');
            if (saved) {
                const savedSettings = JSON.parse(saved);
                this.mergeSettings(this.settings, savedSettings);
            }
        } catch (error) {
            console.warn('Nie udało się załadować zapisanych ustawień:', error);
        }
    }
    
    // Zapisuje ustawienia do localStorage
    saveSettings() {
        try {
            localStorage.setItem('poker_config', JSON.stringify(this.settings));
        } catch (error) {
            console.warn('Nie udało się zapisać ustawień:', error);
        }
    }
    
    // Łączy ustawienia (deep merge)
    mergeSettings(target, source) {
        for (const key in source) {
            if (source.hasOwnProperty(key)) {
                if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
                    if (!target[key]) target[key] = {};
                    this.mergeSettings(target[key], source[key]);
                } else {
                    target[key] = source[key];
                }
            }
        }
    }
    
    // Resetuje ustawienia do domyślnych
    reset() {
        localStorage.removeItem('poker_config');
        localStorage.removeItem('poker_dev_mode');
        window.location.reload();
    }
    
    // System powiadomień o zmianie konfiguracji
    notifyConfigChange(path, value) {
        window.dispatchEvent(new CustomEvent('configChanged', {
            detail: { path, value }
        }));
    }
    
    // Metody pomocnicze dla często używanych ustawień
    isDev() {
        return this.settings.isDev;
    }
    
    getServerUrl() {
        const { host, port, protocol } = this.settings.server;
        return `${protocol}//${host}:${port}`;
    }
    
    shouldLog(level) {
        const levels = ['ERROR', 'WARN', 'INFO', 'DEBUG'];
        const currentLevel = this.settings.ui.logLevel;
        const currentIndex = levels.indexOf(currentLevel);
        const messageIndex = levels.indexOf(level);
        
        return messageIndex <= currentIndex;
    }
    
    // Ustawienia specyficzne dla trybu deweloperskiego
    getDevSettings() {
        return {
            showTestCards: this.get('debug.showHandStrength'),
            revealBotCards: this.get('debug.revealBotCards'),
            skipAnimations: this.get('debug.skipAnimations'),
            fastMode: this.get('debug.fastMode') || false,
            autoPlay: this.get('debug.autoPlay') || false
        };
    }
    
    // Eksportuje konfigurację do JSON (do debugowania)
    export() {
        return JSON.stringify(this.settings, null, 2);
    }
    
    // Importuje konfigurację z JSON
    import(jsonConfig) {
        try {
            const imported = JSON.parse(jsonConfig);
            this.settings = imported;
            this.saveSettings();
            window.location.reload();
        } catch (error) {
            console.error('Błąd importu konfiguracji:', error);
            throw new Error('Nieprawidłowy format konfiguracji');
        }
    }
}

// Singleton - jedna instancja konfiguracji dla całej aplikacji
const config = new Config();

// Eksport dla Node.js lub przeglądarki
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Config;
} else if (typeof window !== 'undefined') {
    window.Config = Config;
    window.config = config;
}
