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
    
    // Zainicjalizuj konfigurację
    if (typeof config !== 'undefined') {
        logger.info(`Tryb: ${config.isDev() ? 'DEVELOPMENT' : 'PRODUCTION'}`);
        
        if (config.isDev()) {
            logger.info('🔧 Funkcje deweloperskie dostępne');
            
            // Dodaj globalne funkcje debugowania
            window.debugPoker = {
                config: config,
                logger: logger,
                showLogs: () => logger.getAllLogs(),
                clearLogs: () => logger.clear(),
                exportLogs: () => logger.downloadLogs(),
                getGameState: () => window.gameUI ? window.gameUI.gameLogic?.getGameState() : null,
                testConnection: () => window.gameUI?.networkClient?.testConnection(),
                simulateAction: (action, amount) => {
                    if (window.gameUI?.gameLogic) {
                        const players = window.gameUI.gameLogic.getPlayers();
                        const humanPlayer = players.find(p => p.type === 'human');
                        if (humanPlayer) {
                            return window.gameUI.gameLogic.processAction(humanPlayer.id, action, amount);
                        }
                    }
                    return false;
                }
            };
            
            console.log('🐛 Funkcje debugowania dostępne w window.debugPoker');
        }
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
    setupGlobalErrorHandling();
    
    // Dodaj obsługę zdarzeń okna
    setupWindowEvents();
    
    // Sprawdź czy mamy parametry URL do automatycznego startu
    checkAutoStart();
    
    logger.info('✅ Aplikacja zainicjalizowana pomyślnie');
    
    // Wiadomość powitalna w trybie dev
    if (config.isDev()) {
        setTimeout(() => {
            showWelcomeMessage();
        }, 1000);
    }
}

// Obsługa błędów globalnych
function setupGlobalErrorHandling() {
    // Obsługa błędów JavaScript
    window.addEventListener('error', (event) => {
        logger.error('Global JS Error:', {
            message: event.message,
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno,
            error: event.error
        });
        
        if (config.isDev()) {
            console.error('Global Error Details:', event);
        }
    });
    
    // Obsługa nieobsłużonych promise rejections
    window.addEventListener('unhandledrejection', (event) => {
        logger.error('Unhandled Promise Rejection:', event.reason);
        
        if (config.isDev()) {
            console.error('Promise Rejection:', event);
        }
        
        // Zapobiegnij wyświetleniu błędu w konsoli
        event.preventDefault();
    });
}

// Obsługa zdarzeń okna
function setupWindowEvents() {
    // Obsługa zamknięcia okna/karty
    window.addEventListener('beforeunload', (event) => {
        if (window.gameUI && window.gameUI.gameLogic && window.gameUI.gameLogic.isGameActive()) {
            const message = 'Masz aktywną grę. Czy na pewno chcesz opuścić stronę?';
            event.returnValue = message;
            return message;
        }
    });
    
    // Obsługa utraty/odzyskania fokusa
    let isPageVisible = !document.hidden;
    
    document.addEventListener('visibilitychange', () => {
        const wasVisible = isPageVisible;
        isPageVisible = !document.hidden;
        
        if (wasVisible && !isPageVisible) {
            logger.debug('Strona ukryta');
        } else if (!wasVisible && isPageVisible) {
            logger.debug('Strona widoczna');
            
            // Sprawdź połączenie po powrocie
            if (window.gameUI && window.gameUI.networkClient) {
                setTimeout(() => {
                    window.gameUI.networkClient.ping();
                }, 1000);
            }
        }
    });
    
    // Obsługa zmiany rozmiaru okna
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            logger.debug(`Zmiana rozmiaru okna: ${window.innerWidth}x${window.innerHeight}`);
            
            // Opcjonalnie: dostosuj układ UI
            if (window.gameUI && window.gameUI.gameTable) {
                // Można dodać logikę dostosowania układu
            }
        }, 250);
    });
}

// Sprawdź parametry URL dla automatycznego startu
function checkAutoStart() {
    const urlParams = new URLSearchParams(window.location.search);
    
    // Auto-start trybu singleplayer
    if (urlParams.get('mode') === 'single') {
        setTimeout(() => {
            if (window.gameUI) {
                logger.info('Auto-start: singleplayer');
                window.gameUI.startSingleplayer();
            }
        }, 2000);
    }
    
    // Auto-start trybu multiplayer
    if (urlParams.get('mode') === 'multi') {
        setTimeout(() => {
            if (window.gameUI) {
                logger.info('Auto-start: multiplayer');
                window.gameUI.startMultiplayer();
            }
        }, 2000);
    }
    
    // Włącz debug mode z URL
    if (urlParams.get('debug') === 'true') {
        config.setDevelopmentMode(true);
    }
}

// Pokaż krytyczny błąd
function showCriticalError(title, message) {
    const errorDiv = document.createElement('div');
    errorDiv.innerHTML = `
        <div style="
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #ff4444;
            color: white;
            padding: 2rem;
            border-radius: 10px;
            text-align: center;
            z-index: 10000;
            max-width: 400px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.5);
        ">
            <h2>❌ ${title}</h2>
            <p style="margin: 1rem 0;">${message}</p>
            <button onclick="window.location.reload()" style="
                background: white;
                color: #ff4444;
                border: none;
                padding: 0.5rem 1rem;
                border-radius: 5px;
                cursor: pointer;
                font-weight: bold;
            ">Odśwież stronę</button>
        </div>
    `;
    
    document.body.appendChild(errorDiv);
}

// Wiadomość powitalna (tryb dev)
function showWelcomeMessage() {
    if (!config.isDev()) return;
    
    console.log(`
🃏 POKER TEXAS HOLD'EM - TRYB DEWELOPERSKI 🃏

Dostępne funkcje debugowania:
• debugPoker.showLogs() - pokaż wszystkie logi
• debugPoker.clearLogs() - wyczyść logi  
• debugPoker.exportLogs() - pobierz logi jako plik
• debugPoker.getGameState() - aktualny stan gry
• debugPoker.testConnection() - test połączenia z serwerem
• debugPoker.simulateAction(action, amount) - symuluj akcję gracza

Skróty klawiszowe w grze:
• F - Fold
• C - Check/Call  
• R - Raise

Panel deweloperski dostępny w menu głównym.
    `);
    
    // Sprawdź czy localStorage ma zapisane ustawienia
    const savedConfig = localStorage.getItem('poker_config');
    if (savedConfig) {
        console.log('📁 Znaleziono zapisane ustawienia konfiguracji');
    }
    
    // Sprawdź połączenie z serwerem
    fetch('/').then(() => {
        console.log('✅ Połączenie z serwerem OK');
    }).catch(() => {
        console.log('❌ Brak połączenia z serwerem');
    });
}

// Funkcje pomocnicze globalne

// Formatuj czas
function formatTime(timestamp) {
    return new Date(timestamp).toLocaleTimeString();
}

// Sprawdź czy element jest widoczny
function isElementVisible(element) {
    return element && element.offsetParent !== null;
}

// Animacja smooth scroll
function smoothScrollTo(element) {
    if (element && element.scrollIntoView) {
        element.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
        });
    }
}

// Kopiuj tekst do schowka
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (error) {
        logger.warn('Nie udało się skopiować do schowka:', error);
        return false;
    }
}

// Pobierz informacje o urządzeniu
function getDeviceInfo() {
    return {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        cookieEnabled: navigator.cookieEnabled,
        onLine: navigator.onLine,
        screenResolution: `${screen.width}x${screen.height}`,
        viewportSize: `${window.innerWidth}x${window.innerHeight}`,
        devicePixelRatio: window.devicePixelRatio || 1
    };
}

// Sprawdź wydajność
function checkPerformance() {
    if (!window.performance) return null;
    
    const navigation = performance.getEntriesByType('navigation')[0];
    if (!navigation) return null;
    
    return {
        domContentLoaded: Math.round(navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart),
        loadComplete: Math.round(navigation.loadEventEnd - navigation.loadEventStart),
        firstPaint: performance.getEntriesByName('first-paint')[0]?.startTime,
        firstContentfulPaint: performance.getEntriesByName('first-contentful-paint')[0]?.startTime
    };
}

// Test kompatybilności WebSocket
function testWebSocketSupport() {
    return new Promise((resolve) => {
        if (!window.WebSocket) {
            resolve({ supported: false, error: 'WebSocket nie jest obsługiwane' });
            return;
        }
        
        try {
            const testWs = new WebSocket('ws://echo.websocket.org');
            
            testWs.onopen = () => {
                testWs.close();
                resolve({ supported: true });
            };
            
            testWs.onerror = (error) => {
                resolve({ supported: false, error: 'Błąd połączenia WebSocket' });
            };
            
            // Timeout po 5 sekundach
            setTimeout(() => {
                testWs.close();
                resolve({ supported: false, error: 'Timeout połączenia WebSocket' });
            }, 5000);
            
        } catch (error) {
            resolve({ supported: false, error: error.message });
        }
    });
}

// Inicjalizacja po załadowaniu DOM
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    // DOM już załadowany
    initializeApp();
}

// Eksport funkcji globalnych
window.pokerApp = {
    initializeApp,
    showCriticalError,
    formatTime,
    isElementVisible,
    smoothScrollTo,
    copyToClipboard,
    getDeviceInfo,
    checkPerformance,
    testWebSocketSupport
};

// Wiadomość o załadowaniu skryptu
logger.info('📜 main.js załadowany');
