// main.js - Główny plik inicjalizujący aplikację

// Sprawdź dostępność wymaganych API
function checkBrowserSupport() {
    const required = {
        WebSocket: typeof WebSocket !== 'undefined',
        localStorage: typeof localStorage !== 'undefined',
        ES6: typeof Map !== 'undefined' && typeof Set !== 'undefined',
        Promises: typeof Promise !== 'undefined'
    };
    
    const missing = Object.entries(required)
        .filter(([key, supported]) => !supported)
        .map(([key]) => key);
    
    if (missing.length > 0) {
        alert(`Twoja przeglądarka nie obsługuje wymaganych funkcji: ${missing.join(', ')}\n\nProszę zaktualizować przeglądarkę.`);
        return false;
    }
    
    return true;
}

// Inicjalizacja aplikacji
function initializeApp() {
    logger.info('🃏 Inicjalizacja aplikacji Poker Texas Hold\'em');
    
    // Sprawdź wsparcie przeglądarki
    if (!checkBrowserSupport()) {
        return;
    }
    
    // Inicjalizuj konfigurację
    try {
        config.initialize();
        logger.info('✅ Konfiguracja zainicjalizowana');
    } catch (error) {
        logger.error('❌ Błąd inicjalizacji konfiguracji:', error);
        showCriticalError('Nie udało się zainicjalizować konfiguracji', error.message);
        return;
    }
    
    // Inicjalizuj tryb deweloperski jeśli włączony
    if (config.isDevelopment()) {
        logger.info('🔧 Tryb deweloperski aktywny');
        
        // Dodaj globalne funkcje debugowania
        window.debugPoker = {
            config: config,
            logger: logger,
            showLogs: () => logger.exportLogs(),
            clearLogs: () => logger.clearLogs(),
            getStats: () => gameUI ? gameUI.getStats() : null
        };
        
        console.log('🐛 Funkcje debugowania dostępne w window.debugPoker');
    }
    
    // Inicjalizuj główny interfejs
    try {
        window.gameUI = new GameUI();
        logger.info('✅ UI zainicjalizowane');
    } catch (error) {
        logger.error('❌ Błąd inicjalizacji UI:', error);
        showCriticalError('Nie udało się zainicjalizować interfejsu gry', error.message);
        return;
    }
    
    // Dodaj obsługę błędów globalnych
    window.addEventListener('error', (event) => {
        logger.error('Globalny błąd JavaScript:', event.error);
    });
    
    window.addEventListener('unhandledrejection', (event) => {
        logger.error('Nieobsłużone odrzucenie Promise:', event.reason);
    });
    
    logger.info('🚀 Aplikacja zainicjalizowana pomyślnie');
}

// Funkcja wyświetlania krytycznych błędów
function showCriticalError(title, message) {
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: #dc3545;
        color: white;
        padding: 20px;
        border-radius: 8px;
        box-shadow: 0 4px 8px rgba(0,0,0,0.3);
        z-index: 10000;
        max-width: 400px;
        text-align: center;
    `;
    
    errorDiv.innerHTML = `
        <h3>❌ ${title}</h3>
        <p>${message}</p>
        <button onclick="location.reload()" style="
            background: white;
            color: #dc3545;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            margin-top: 10px;
        ">Odśwież stronę</button>
    `;
    
    document.body.appendChild(errorDiv);
}

// Inicjalizacja po załadowaniu DOM
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(initializeApp, 50);
    });
} else {
    setTimeout(initializeApp, 50);
}

// Eksport funkcji globalnych
window.pokerApp = {
    initializeApp,
    showCriticalError,
    checkBrowserSupport
};

// Wiadomość o załadowaniu skryptu
logger.info('📜 main.js załadowany');
