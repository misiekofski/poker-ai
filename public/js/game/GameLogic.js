// GameLogic.js - Główna logika gry pokerowej

class GameLogic {
    constructor() {
        this.gameState = null;
        this.handEvaluator = null;
        
        // Inicjalizuj HandEvaluator z opóźnieniem
        this.initializeHandEvaluator();
        
        // Ustawienia
        this.settings = {
            autoStart: true,
            enableTimeouts: true,
            logActions: true
        };
        
        logger.info('GameLogic zainicjalizowana');
    }
    
    // Inicjalizuj HandEvaluator
    initializeHandEvaluator() {
        if (typeof HandEvaluator !== 'undefined') {
            this.handEvaluator = new HandEvaluator();
        } else {
            // Spróbuj ponownie za moment
            setTimeout(() => {
                if (typeof HandEvaluator !== 'undefined') {
                    this.handEvaluator = new HandEvaluator();
                    logger.info('HandEvaluator zainicjalizowany z opóźnieniem');
                } else {
                    logger.error('HandEvaluator nadal niedostępny');
                }
            }, 100);
        }
    }
    
    // Utwórz nową grę
    createGame(mode = 'singleplayer') {
        this.gameState = new GameState();
        this.gameState.mode = mode;
        
        // Ustaw obsługę eventów
        this.gameState.setEventHandlers({
            onPlayerAction: (player, action, amount) => this.handlePlayerAction(player, action, amount),
            onPhaseChange: (newPhase) => this.handlePhaseChange(newPhase),
            onGameEnd: (winner) => this.handleGameEnd(winner),
            onPlayerEliminated: (player) => this.handlePlayerEliminated(player)
        });
        
        logger.game(`Utworzono nową grę: ${mode}`);
        return this.gameState;
    }
    
    // Dodaj gracza do gry
    addPlayer(name, chips = 1000, type = 'human') {
        if (!this.gameState) {
            throw new Error('Brak aktywnej gry');
        }
        
        const playerId = this.generatePlayerId();
        const player = new Player(playerId, name, chips, type);
        
        const seatNumber = this.gameState.addPlayer(player);
        
        return { player, seatNumber };
    }
    
    // Dodaj botów do gry
    addBots(count = 3) {
        if (!this.gameState) {
            throw new Error('Brak aktywnej gry');
        }
        
        const botNames = this.generateBotNames();
        const addedBots = [];
        
        for (let i = 0; i < count && i < botNames.length; i++) {
            if (this.gameState.players.length >= this.gameState.maxPlayers) {
                logger.warn('Nie można dodać więcej botów - stół pełny');
                break;
            }
            
            const botName = botNames[i];
            const { player } = this.addPlayer(botName, 1000, 'bot');
            addedBots.push(player);
            
            logger.info(`Dodano bota: ${botName}`);
        }
        
        return addedBots;
    }
    
    // Rozpocznij grę
    startGame() {
        if (!this.gameState) {
            throw new Error('Brak aktywnej gry');
        }
        
        if (this.gameState.players.length < 2) {
            throw new Error('Potrzeba przynajmniej 2 graczy do rozpoczęcia gry');
        }
        
        this.gameState.startGame();
        logger.game('Gra rozpoczęta przez GameLogic');
    }
    
    // Przetwórz akcję gracza
    processAction(playerId, action, amount = 0) {
        if (!this.gameState || !this.gameState.isActive) {
            logger.warn('Próba akcji w nieaktywnej grze');
            return false;
        }
        
        const player = this.gameState.getPlayerById(playerId);
        if (!player) {
            logger.error(`Nie znaleziono gracza: ${playerId}`);
            return false;
        }
        
        // Sprawdź czy to tura tego gracza
        const currentPlayer = this.gameState.getCurrentPlayer();
        if (!currentPlayer || currentPlayer.id !== playerId) {
            logger.warn(`Nie jest tura gracza ${player.name}`);
            return false;
        }
        
        // Waliduj i wykonaj akcję
        return this.gameState.processPlayerAction(playerId, action, amount);
    }
    
    // Oblicz dostępne akcje dla gracza
    getAvailableActions(playerId) {
        if (!this.gameState || !this.gameState.isActive) {
            return [];
        }
        
        const player = this.gameState.getPlayerById(playerId);
        if (!player || !player.canAct()) {
            return [];
        }
        
        const actions = [];
        const callAmount = this.gameState.currentBet - player.currentBet;
        
        // Fold - zawsze dostępne
        actions.push({
            type: Constants.PLAYER_ACTIONS.FOLD,
            amount: 0,
            label: 'Fold'
        });
        
        // Check - jeśli brak zakładu do wyrównania
        if (callAmount === 0) {
            actions.push({
                type: Constants.PLAYER_ACTIONS.CHECK,
                amount: 0,
                label: 'Check'
            });
        }
        
        // Call - jeśli jest zakład do wyrównania
        if (callAmount > 0 && player.chips >= callAmount) {
            actions.push({
                type: Constants.PLAYER_ACTIONS.CALL,
                amount: callAmount,
                label: `Call $${callAmount}`
            });
        }
        
        // Raise - jeśli gracz ma wystarczająco żetonów
        const minRaiseAmount = this.gameState.currentBet + this.gameState.minRaise;
        if (player.chips > callAmount) {
            const maxRaise = player.chips;
            const minRaise = Math.min(minRaiseAmount, maxRaise);
            
            if (minRaise <= maxRaise) {
                actions.push({
                    type: Constants.PLAYER_ACTIONS.RAISE,
                    amount: minRaise,
                    minAmount: minRaise,
                    maxAmount: maxRaise,
                    label: 'Raise'
                });
            }
        }
        
        // All-in - jeśli gracz ma żetony
        if (player.chips > 0) {
            actions.push({
                type: Constants.PLAYER_ACTIONS.ALL_IN,
                amount: player.chips,
                label: 'All-in'
            });
        }
        
        return actions;
    }
    
    // Oblicz siłę ręki gracza
    calculateHandStrength(playerId) {
        if (!this.gameState) {
            return 0;
        }
        
        const player = this.gameState.getPlayerById(playerId);
        if (!player || player.hand.length === 0) {
            return 0;
        }
        
        try {
            if (!this.handEvaluator) {
                logger.warn('HandEvaluator nie jest zainicjalizowany');
                return 0;
            }
            
            const handResult = this.handEvaluator.evaluateHand(
                player.hand, 
                this.gameState.communityCards
            );
            
            return {
                strength: handResult.ranking / 10, // 10 = ROYAL_FLUSH ranking
                ranking: handResult.ranking,
                name: handResult.name,
                description: handResult.description,
                cards: handResult.cards
            };
        } catch (error) {
            logger.error(`Błąd obliczania siły ręki dla ${player.name}: ${error.message}`);
            return {
                strength: 0,
                ranking: 0,
                name: 'Nieznany',
                description: 'Błąd oceny',
                cards: []
            };
        }
    }
    
    // Symuluj grę (do testów AI)
    simulateGame(players, rounds = 1) {
        const results = [];
        
        for (let round = 0; round < rounds; round++) {
            const game = this.createGame();
            
            // Dodaj graczy
            const gamePlayers = [];
            for (const playerData of players) {
                const { player } = this.addPlayer(
                    playerData.name, 
                    playerData.chips || Constants.GAME_SETTINGS.STARTING_CHIPS,
                    playerData.type || Constants.PLAYER_TYPES.BOT
                );
                gamePlayers.push(player);
            }
            
            // Uruchom grę
            this.startGame();
            
            // Symuluj do końca (uproszczone)
            let safety = 0;
            while (game.isActive && safety < 1000) {
                const currentPlayer = game.getCurrentPlayer();
                if (currentPlayer && currentPlayer.type === Constants.PLAYER_TYPES.BOT) {
                    const action = this.calculateOptimalBotAction(currentPlayer);
                    this.processAction(currentPlayer.id, action.type, action.amount);
                }
                safety++;
            }
            
            // Zapisz wynik
            const winner = game.players.find(p => p.chips > 0);
            results.push({
                round: round + 1,
                winner: winner ? winner.name : 'Brak zwycięzcy',
                finalChips: game.players.map(p => ({ name: p.name, chips: p.chips }))
            });
        }
        
        return results;
    }
    
    // Oblicz optymalną akcję dla bota (zaawansowana wersja)
    calculateOptimalBotAction(bot) {
        // Ta metoda zostanie rozwinięta w AI.js
        // Tutaj tylko podstawowa logika
        
        const handStrength = bot.getHandStrength(this.gameState.communityCards);
        const callAmount = this.gameState.currentBet - bot.currentBet;
        const potOdds = callAmount / (this.gameState.pot + callAmount);
        
        // Proste reguły decyzyjne
        if (handStrength < 0.2) {
            return { type: Constants.PLAYER_ACTIONS.FOLD };
        }
        
        if (callAmount === 0) {
            if (handStrength > 0.7) {
                // Silna ręka - próbuj podnieść
                const raiseAmount = Math.min(
                    this.gameState.pot * 0.5,
                    bot.chips
                );
                return { type: Constants.PLAYER_ACTIONS.RAISE, amount: raiseAmount };
            }
            return { type: Constants.PLAYER_ACTIONS.CHECK };
        }
        
        if (handStrength > potOdds) {
            if (handStrength > 0.8 && Math.random() < bot.stats.aggressionLevel) {
                // Bardzo silna ręka - rozważ podniesienie
                const raiseAmount = Math.min(
                    this.gameState.currentBet * 2,
                    bot.chips
                );
                return { type: Constants.PLAYER_ACTIONS.RAISE, amount: raiseAmount };
            }
            return { type: Constants.PLAYER_ACTIONS.CALL, amount: callAmount };
        }
        
        return { type: Constants.PLAYER_ACTIONS.FOLD };
    }
    
    // Zakończ aktualną grę
    endGame() {
        if (this.gameState) {
            this.gameState.endGame();
        }
    }
    
    // Metody testowe (tryb developerski)
    
    // Ustaw testowe karty
    setTestCards(playerCards, communityCards) {
        if (!this.gameState || !config.isDev()) {
            logger.warn('Testowe karty dostępne tylko w trybie deweloperskim');
            return false;
        }
        
        try {
            // Ustaw karty graczy
            if (playerCards) {
                for (const [playerId, cards] of Object.entries(playerCards)) {
                    const player = this.gameState.getPlayerById(playerId);
                    if (player) {
                        player.hand = cards.map(cardStr => this.parseCard(cardStr));
                    }
                }
            }
            
            // Ustaw karty wspólne
            if (communityCards) {
                this.gameState.communityCards = communityCards.map(cardStr => this.parseCard(cardStr));
            }
            
            logger.debug('Ustawiono testowe karty');
            return true;
        } catch (error) {
            logger.error(`Błąd ustawiania testowych kart: ${error.message}`);
            return false;
        }
    }
    
    // Parsuj kartę z stringa (np. "AS" -> As pik)
    parseCard(cardStr) {
        const rank = cardStr.slice(0, -1);
        const suitChar = cardStr.slice(-1).toLowerCase();
        
        const suitMap = {
            's': Constants.SUITS.SPADES,
            'h': Constants.SUITS.HEARTS,
            'd': Constants.SUITS.DIAMONDS,
            'c': Constants.SUITS.CLUBS
        };
        
        const suit = suitMap[suitChar];
        if (!suit) {
            throw new Error(`Nieprawidłowy symbol masci: ${suitChar}`);
        }
        
        return new Card(suit, rank);
    }
    
    // Przyspiesz grę (tryb testowy)
    enableFastMode() {
        if (this.gameState) {
            this.gameState.settings.turnTimeout = 1000; // 1 sekunda
            Constants.GAME_SETTINGS.BOT_THINK_TIME = 500; // 0.5 sekundy
            logger.debug('Włączono tryb szybki');
        }
    }
    
    // Obsługa eventów
    
    handlePlayerAction(player, action, amount) {
        logger.logPlayerAction(player.name, action, amount);
        
        // Tutaj można dodać dodatkową logikę po akcji gracza
        this.updateGameAnalytics(player, action, amount);
    }
    
    handlePhaseChange(newPhase) {
        logger.game(`Nowa faza: ${newPhase}`);
        
        // Wyczyść cache oceny rąk (nowe karty wspólne)
        if (this.handEvaluator && this.handEvaluator.clearCache) {
            this.handEvaluator.clearCache();
        }
    }
    
    handleGameEnd(winner) {
        if (winner) {
            logger.game(`🏆 Koniec gry! Zwycięzca: ${winner.name}`);
        } else {
            logger.game('🏁 Gra zakończona');
        }
        
        // Zapisz statystyki gry
        this.saveGameStatistics();
    }
    
    handlePlayerEliminated(player) {
        logger.game(`${player.name} został wyeliminowany`);
    }
    
    // Metody pomocnicze
    
    generatePlayerId() {
        return 'player_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
    }
    
    generateBotNames() {
        return [
            'Bot Alpha', 'Bot Beta', 'Bot Gamma', 'Bot Delta', 
            'Bot Epsilon', 'Bot Zeta', 'Bot Eta', 'Bot Theta'
        ];
    }
    
    updateGameAnalytics(player, action, amount) {
        // Placeholder dla analityki gry
        if (config.isDev()) {
            logger.debug(`Analytics: ${player.name} ${action} ${amount || ''}`);
        }
    }
    
    saveGameStatistics() {
        // Placeholder dla zapisywania statystyk
        if (this.gameState && config.isDev()) {
            const stats = {
                gameId: this.gameState.gameId,
                rounds: this.gameState.currentRoundNumber,
                players: this.gameState.players.map(p => ({
                    name: p.name,
                    type: p.type,
                    finalChips: p.chips,
                    handsPlayed: p.stats.handsPlayed,
                    handsWon: p.stats.handsWon
                })),
                timestamp: Date.now()
            };
            
            logger.debug('Statystyki gry:', stats);
        }
    }
    
    // Getters
    
    getGameState() {
        return this.gameState;
    }
    
    isGameActive() {
        return this.gameState && this.gameState.isActive;
    }
    
    getCurrentPhase() {
        return this.gameState ? this.gameState.phase : Constants.GAME_PHASES.WAITING;
    }
    
    getPot() {
        return this.gameState ? this.gameState.pot : 0;
    }
    
    getCommunityCards() {
        return this.gameState ? this.gameState.communityCards : [];
    }
    
    getPlayers() {
        return this.gameState ? this.gameState.players : [];
    }
}

// Eksport dla Node.js lub przeglądarki
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GameLogic;
} else if (typeof window !== 'undefined') {
    window.GameLogic = GameLogic;
}
