// GameUI.js - Interfejs użytkownika gry

class GameUI {
    constructor() {
        this.gameTable = new GameTable();
        this.gameLogic = null;
        this.networkClient = null;
        this.currentGameMode = null;
        
        // Elementy UI
        this.elements = {
            // Ekrany
            mainMenu: document.getElementById('main-menu'),
            gameScreen: document.getElementById('game-screen'),
            messageOverlay: document.getElementById('message-overlay'),
            
            // Menu
            singleplayerBtn: document.getElementById('singleplayer-btn'),
            multiplayerBtn: document.getElementById('multiplayer-btn'),
            backToMenuBtn: document.getElementById('back-to-menu'),
            
            // Panel developerski
            devPanel: document.getElementById('dev-panel'),
            simulateBotsBtn: document.getElementById('simulate-bots-btn'),
            testCardsBtn: document.getElementById('test-cards-btn'),
            debugModeCheckbox: document.getElementById('debug-mode'),
            
            // Informacje o grze
            gameModeDisplay: document.getElementById('game-mode'),
            potAmountDisplay: document.getElementById('pot-amount'),
            currentBetDisplay: document.getElementById('current-bet'),
            roundStageDisplay: document.getElementById('round-stage'),
            dealerPositionDisplay: document.getElementById('dealer-position'),
            
            // Kontrole gracza
            foldBtn: document.getElementById('fold-btn'),
            checkBtn: document.getElementById('check-btn'),
            callBtn: document.getElementById('call-btn'),
            raiseBtn: document.getElementById('raise-btn'),
            callAmountDisplay: document.getElementById('call-amount'),
            
            // Slider zakładów
            betSlider: document.getElementById('bet-slider'),
            betDisplay: document.getElementById('bet-display'),
            
            // Panel boczny
            playersStatus: document.getElementById('players-status'),
            gameLog: document.getElementById('game-log'),
            logContent: document.getElementById('log-content'),
            
            // Overlay wiadomości
            messageTitle: document.getElementById('message-title'),
            messageText: document.getElementById('message-text'),
            messageClose: document.getElementById('message-close')
        };
        
        // Stan UI
        this.humanPlayerId = null; // ID rzeczywistego gracza
        this.uiState = {
            currentScreen: 'main-menu',
            actionsEnabled: false,
            playerTurn: false,
            availableActions: []
        };
        
        this.initializeEventListeners();
        this.setupDevPanel();
        
        logger.info('GameUI zainicjalizowany');
    }
    
    // Inicjalizuj event listenery
    initializeEventListeners() {
        // Menu główne
        this.elements.singleplayerBtn?.addEventListener('click', () => this.startSingleplayer());
        this.elements.multiplayerBtn?.addEventListener('click', () => this.startMultiplayer());
        this.elements.backToMenuBtn?.addEventListener('click', () => this.returnToMenu());
        
        // Akcje gracza
        this.elements.foldBtn?.addEventListener('click', () => this.playerAction('fold'));
        this.elements.checkBtn?.addEventListener('click', () => this.playerAction('check'));
        this.elements.callBtn?.addEventListener('click', () => this.playerAction('call'));
        this.elements.raiseBtn?.addEventListener('click', () => this.playerAction('raise'));
        
        // Slider zakładów
        this.elements.betSlider?.addEventListener('input', (e) => this.updateBetDisplay(e.target.value));
        
        // Panel developerski
        this.elements.simulateBotsBtn?.addEventListener('click', () => this.simulateBots());
        this.elements.testCardsBtn?.addEventListener('click', () => this.showTestCards());
        this.elements.debugModeCheckbox?.addEventListener('change', (e) => this.toggleDebugMode(e.target.checked));
        
        // Overlay wiadomości
        this.elements.messageClose?.addEventListener('click', () => this.hideMessage());
        
        // Nasłuchuj na zmiany konfiguracji
        window.addEventListener('configChanged', (e) => this.handleConfigChange(e.detail));
        
        // Obsługa klawiszy
        document.addEventListener('keydown', (e) => this.handleKeyPress(e));
    }
    
    // Konfiguruj panel developerski
    setupDevPanel() {
        if (config.isDev()) {
            this.elements.devPanel.style.display = 'block';
            this.elements.gameLog.style.display = 'block';
        } else {
            this.elements.devPanel.style.display = 'none';
            this.elements.gameLog.style.display = 'none';
        }
    }
    
    // Przełącz ekrany
    switchScreen(screenName) {
        // Ukryj wszystkie ekrany
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        
        // Pokaż wybrany ekran
        const targetScreen = document.getElementById(screenName);
        if (targetScreen) {
            targetScreen.classList.add('active');
            this.uiState.currentScreen = screenName;
        }
    }
    
    // Rozpocznij tryb singleplayer
    startSingleplayer() {
        try {
            // Sprawdź czy wszystkie wymagane klasy są dostępne
            if (typeof GameLogic === 'undefined') {
                throw new Error('GameLogic nie jest zdefiniowany');
            }
            if (typeof HandEvaluator === 'undefined') {
                throw new Error('HandEvaluator nie jest zdefiniowany');
            }
            
            this.currentGameMode = 'singleplayer';
            this.gameLogic = new GameLogic();
            
            // Utwórz grę
            const gameState = this.gameLogic.createGame('singleplayer');
            
            // Dodaj gracza
            const { player: humanPlayer } = this.gameLogic.addPlayer('Ty', 1000, 'human');
            this.humanPlayerId = humanPlayer.id; // Zapamiętaj ID gracza
            
            // Dodaj botów
            this.gameLogic.addBots(3);
            
            // Przełącz na ekran gry
            this.switchScreen('game-screen');
            this.updateGameModeDisplay('Singleplayer vs AI');
            
            // Rozpocznij grę
            this.gameLogic.startGame();
            
            // Rozpocznij cykl aktualizacji UI
            this.startUpdateLoop();
            
            logger.game('Rozpoczęto tryb singleplayer');
            
        } catch (error) {
            logger.error('Błąd rozpoczęcia singleplayer:', error);
            this.showMessage('Błąd', 'Nie udało się rozpocząć gry: ' + error.message);
        }
    }
    
    // Rozpocznij tryb multiplayer
    startMultiplayer() {
        try {
            this.currentGameMode = 'multiplayer';
            
            // Inicjalizuj klienta sieciowego
            if (!this.networkClient) {
                this.networkClient = new NetworkClient();
                this.networkClient.onGameStateUpdate = (gameState) => this.handleGameStateUpdate(gameState);
                this.networkClient.onGameEnd = (winner) => this.handleGameEnd(winner);
                this.networkClient.onError = (error) => this.handleNetworkError(error);
            }
            
            // Połącz z serwerem
            this.networkClient.connect();
            
            // Przełącz na ekran gry
            this.switchScreen('game-screen');
            this.updateGameModeDisplay('Multiplayer (oczekiwanie...)');
            
            logger.game('Rozpoczęto tryb multiplayer');
            
        } catch (error) {
            logger.error('Błąd rozpoczęcia multiplayer:', error);
            this.showMessage('Błąd', 'Nie udało się połączyć z serwerem: ' + error.message);
        }
    }
    
    // Powrót do menu
    returnToMenu() {
        // Zatrzymaj grę
        if (this.gameLogic) {
            this.gameLogic.endGame();
            this.gameLogic = null;
        }
        
        // Rozłącz sieć
        if (this.networkClient) {
            this.networkClient.disconnect();
        }
        
        // Zatrzymaj pętlę aktualizacji
        this.stopUpdateLoop();
        
        // Resetuj stół
        this.gameTable.resetTable();
        
        // Przełącz na menu
        this.switchScreen('main-menu');
        
        logger.info('Powrócono do menu głównego');
    }
    
    // Rozpocznij pętlę aktualizacji UI
    startUpdateLoop() {
        this.updateLoop = setInterval(() => {
            if (this.gameLogic && this.gameLogic.isGameActive()) {
                const gameState = this.gameLogic.getGameState();
                this.updateGameDisplay(gameState);
                this.updatePlayerControls(gameState);
            }
        }, 1000); // Aktualizuj co 1000ms zamiast 100ms aby nie mrugały karty
    }
    
    // Zatrzymaj pętlę aktualizacji
    stopUpdateLoop() {
        if (this.updateLoop) {
            clearInterval(this.updateLoop);
            this.updateLoop = null;
        }
    }
    
    // Aktualizuj wyświetlanie gry
    updateGameDisplay(gameState) {
        // Renderuj stół
        this.gameTable.renderGameState(gameState);
        
        // Aktualizuj informacje
        this.updateGameInfo(gameState);
        
        // Aktualizuj listę graczy
        this.updatePlayersStatus(gameState.players);
        
        // Sprawdź czy to tura gracza
        this.checkPlayerTurn(gameState);
    }
    
    // Aktualizuj informacje o grze
    updateGameInfo(gameState) {
        if (this.elements.potAmountDisplay) {
            this.elements.potAmountDisplay.textContent = `Pula: $${gameState.pot}`;
        }
        
        if (this.elements.currentBetDisplay) {
            this.elements.currentBetDisplay.textContent = `Zakład: $${gameState.currentBet}`;
        }
        
        if (this.elements.roundStageDisplay) {
            const phaseNames = {
                'waiting': 'Oczekiwanie',
                'pre-flop': 'Pre-flop',
                'flop': 'Flop',
                'turn': 'Turn',
                'river': 'River',
                'showdown': 'Showdown',
                'end': 'Koniec'
            };
            this.elements.roundStageDisplay.textContent = phaseNames[gameState.phase] || gameState.phase;
        }
        
        if (this.elements.dealerPositionDisplay && gameState.players[gameState.dealerIndex]) {
            const dealer = gameState.players[gameState.dealerIndex];
            this.elements.dealerPositionDisplay.textContent = `Dealer: ${dealer.name}`;
        }
    }
    
    // Aktualizuj status graczy
    updatePlayersStatus(players) {
        if (!this.elements.playersStatus) return;
        
        const statusHtml = players.map(player => {
            const statusClass = player.status === 'folded' ? 'folded' : 
                               player.status === 'all_in' ? 'all-in' : 'active';
            
            return `
                <div class="player-status ${statusClass}">
                    <span class="player-name">${player.name}</span>
                    <span class="player-chips">$${player.chips}</span>
                </div>
            `;
        }).join('');
        
        this.elements.playersStatus.innerHTML = statusHtml;
    }
    
    // Sprawdź czy to tura gracza
    checkPlayerTurn(gameState) {
        const currentPlayer = gameState.players[gameState.currentPlayerIndex];
        const isPlayerTurn = currentPlayer && currentPlayer.seatNumber === 0; // Gracz zawsze na seat 0
        
        this.uiState.playerTurn = isPlayerTurn;
        this.uiState.actionsEnabled = isPlayerTurn && gameState.isActive;
        
        if (isPlayerTurn) {
            // Pobierz dostępne akcje
            const availableActions = this.gameLogic.getAvailableActions(currentPlayer.id);
            this.updateAvailableActions(availableActions);
        } else {
            this.disableAllActions();
        }
    }
    
    // Aktualizuj dostępne akcje
    updateAvailableActions(actions) {
        this.uiState.availableActions = actions;
        
        // Resetuj wszystkie przyciski
        this.disableAllActions();
        
        // Włącz dostępne akcje
        actions.forEach(action => {
            switch (action.type) {
                case 'fold':
                    this.enableAction('fold');
                    break;
                    
                case 'check':
                    this.enableAction('check');
                    break;
                    
                case 'call':
                    this.enableAction('call', action.amount);
                    break;
                    
                case 'raise':
                    this.enableAction('raise');
                    this.setupRaiseSlider(action.minAmount, action.maxAmount);
                    break;
            }
        });
    }
    
    // Włącz akcję
    enableAction(actionType, amount = null) {
        const button = this.elements[actionType + 'Btn'];
        if (button) {
            button.disabled = false;
            button.classList.remove('disabled');
            
            if (actionType === 'call' && amount !== null && this.elements.callAmountDisplay) {
                this.elements.callAmountDisplay.textContent = amount;
            }
        }
    }
    
    // Wyłącz wszystkie akcje
    disableAllActions() {
        ['fold', 'check', 'call', 'raise'].forEach(actionType => {
            const button = this.elements[actionType + 'Btn'];
            if (button) {
                button.disabled = true;
                button.classList.add('disabled');
            }
        });
    }
    
    // Konfiguruj slider podniesienia
    setupRaiseSlider(minAmount, maxAmount) {
        if (this.elements.betSlider) {
            this.elements.betSlider.min = minAmount;
            this.elements.betSlider.max = maxAmount;
            this.elements.betSlider.value = minAmount;
            this.elements.betSlider.step = 10;
            
            this.updateBetDisplay(minAmount);
        }
    }
    
    // Aktualizuj wyświetlanie kwoty zakładu
    updateBetDisplay(amount) {
        if (this.elements.betDisplay) {
            this.elements.betDisplay.textContent = amount;
        }
    }
    
    // Wykonaj akcję gracza
    playerAction(actionType) {
        if (!this.uiState.actionsEnabled || !this.gameLogic) {
            return;
        }
        
        let amount = 0;
        
        // Sprawdź czy akcja jest dostępna
        const availableAction = this.uiState.availableActions.find(a => a.type === actionType);
        if (!availableAction) {
            this.showMessage('Błąd', 'Ta akcja nie jest dostępna');
            return;
        }
        
        // Oblicz kwotę
        if (actionType === 'raise') {
            amount = parseInt(this.elements.betSlider.value);
        } else if (actionType === 'call') {
            amount = availableAction.amount;
        }
        
        // Wykonaj akcję
        const success = this.gameLogic.processAction(this.humanPlayerId || 'player_human', actionType, amount);
        
        if (!success) {
            this.showMessage('Błąd', 'Nie udało się wykonać akcji');
            this.gameTable.animateShake(this.elements[actionType + 'Btn']);
        } else {
            // Wyłącz akcje do następnej tury
            this.disableAllActions();
            
            logger.game(`Gracz wykonał akcję: ${actionType} ${amount > 0 ? '$' + amount : ''}`);
        }
    }
    
    // Obsługa funkcji developerskich
    
    simulateBots() {
        if (!config.isDev()) return;
        
        if (this.currentGameMode === 'multiplayer' && this.networkClient) {
            // W trybie multiplayer poproś serwer o dodanie botów
            this.networkClient.addBots(5);
            this.showMessage('Info', 'Poproszono serwer o dodanie botów');
        } else {
            this.showMessage('Info', 'Boty są już aktywne w trybie singleplayer');
        }
    }
    
    showTestCards() {
        if (!config.isDev()) return;
        
        this.gameTable.showTestCards();
        
        if (this.gameLogic) {
            // Ustaw przykładowe karty testowe
            const testPlayerCards = {};
            testPlayerCards[this.humanPlayerId || 'player_human'] = ['AS', 'KH'];
            this.gameLogic.setTestCards(
                testPlayerCards, // Karty gracza
                ['QD', 'JC', '10S', '9H', '8D'] // Karty wspólne
            );
        }
    }
    
    toggleDebugMode(enabled) {
        config.setDevelopmentMode(enabled);
        this.setupDevPanel();
        
        if (enabled) {
            this.showMessage('Debug', 'Tryb deweloperski włączony');
        } else {
            this.showMessage('Info', 'Tryb deweloperski wyłączony');
        }
    }
    
    // Obsługa wiadomości
    
    showMessage(title, text, duration = 0) {
        if (this.elements.messageTitle) this.elements.messageTitle.textContent = title;
        if (this.elements.messageText) this.elements.messageText.textContent = text;
        
        this.elements.messageOverlay.classList.add('show');
        
        if (duration > 0) {
            setTimeout(() => this.hideMessage(), duration);
        }
    }
    
    hideMessage() {
        this.elements.messageOverlay.classList.remove('show');
    }
    
    // Obsługa eventów
    
    handleGameStateUpdate(gameState) {
        this.updateGameDisplay(gameState);
    }
    
    handleGameEnd(winner) {
        const message = winner ? `Gra zakończona!\n\nZwycięzca: ${winner.name}` : 'Gra zakończona!';
        this.showMessage('Koniec gry', message);
        
        // Opcjonalnie: automatyczny powrót do menu po 5 sekundach
        setTimeout(() => {
            this.returnToMenu();
        }, 5000);
    }
    
    handleNetworkError(error) {
        logger.error('Błąd sieci:', error);
        this.showMessage('Błąd połączenia', error.message || 'Utracono połączenie z serwerem');
    }
    
    handleConfigChange(change) {
        if (change.path === 'developmentMode') {
            this.setupDevPanel();
        }
    }
    
    handleKeyPress(event) {
        if (!this.uiState.actionsEnabled) return;
        
        // Skróty klawiszowe
        switch (event.key.toLowerCase()) {
            case 'f':
                if (this.uiState.availableActions.some(a => a.type === 'fold')) {
                    this.playerAction('fold');
                }
                break;
                
            case 'c':
                if (this.uiState.availableActions.some(a => a.type === 'check')) {
                    this.playerAction('check');
                } else if (this.uiState.availableActions.some(a => a.type === 'call')) {
                    this.playerAction('call');
                }
                break;
                
            case 'r':
                if (this.uiState.availableActions.some(a => a.type === 'raise')) {
                    this.playerAction('raise');
                }
                break;
        }
    }
    
    // Metody pomocnicze
    
    updateGameModeDisplay(mode) {
        if (this.elements.gameModeDisplay) {
            this.elements.gameModeDisplay.textContent = mode;
        }
    }
    
    updatePlayerControls(gameState) {
        // Aktualizuj kontrole w zależności od fazy gry
        const isActive = gameState.isActive && gameState.phase !== 'showdown';
        
        if (!isActive) {
            this.disableAllActions();
        }
    }
    
    // Podświetl akcje (wywoływane przez GameTable)
    highlightActions(actions) {
        // Usuń poprzednie podświetlenia
        document.querySelectorAll('.action-btn').forEach(btn => {
            btn.classList.remove('highlighted');
        });
        
        // Podświetl dostępne akcje
        actions.forEach(action => {
            const button = this.elements[action.type + 'Btn'];
            if (button && !button.disabled) {
                button.classList.add('highlighted');
            }
        });
    }
    
    // Pobierz stan UI (do debugowania)
    getUIState() {
        return {
            currentScreen: this.uiState.currentScreen,
            gameMode: this.currentGameMode,
            playerTurn: this.uiState.playerTurn,
            actionsEnabled: this.uiState.actionsEnabled,
            availableActions: this.uiState.availableActions,
            tableInfo: this.gameTable.getTableInfo()
        };
    }
}

// Eksport dla przeglądarki
if (typeof window !== 'undefined') {
    window.GameUI = GameUI;
}
