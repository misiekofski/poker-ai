// GameState.js - Zarządzanie stanem gry

class GameState {
    // Upewnij się że Constants jest dostępne
    ensureConstants() {
        if (typeof Constants === 'undefined') {
            // Utwórz minimalne Constants jeśli nie istnieją
            window.Constants = {
                GAME_MODES: { SINGLEPLAYER: 'singleplayer', MULTIPLAYER: 'multiplayer' },
                GAME_PHASES: { 
                    WAITING: 'waiting', PRE_FLOP: 'preflop', FLOP: 'flop', 
                    TURN: 'turn', RIVER: 'river', SHOWDOWN: 'showdown' 
                },
                PLAYER_TYPES: { HUMAN: 'human', BOT: 'bot' },
                PLAYER_STATUS: { ACTIVE: 'active', FOLDED: 'folded', ALL_IN: 'all_in', WAITING: 'waiting' },
                PLAYER_ACTIONS: { 
                    FOLD: 'fold', CHECK: 'check', CALL: 'call', 
                    RAISE: 'raise', ALL_IN: 'all_in' 
                },
                GAME_SETTINGS: {
                    TURN_TIMEOUT: 30000, STARTING_CHIPS: 1000, MIN_RAISE: 20,
                    SMALL_BLIND: 10, BIG_BLIND: 20, BOT_THINK_TIME: 2000
                },
                AI_AGGRESSION: {
                    CONSERVATIVE: 0.2,
                    NORMAL: 0.5,
                    AGGRESSIVE: 0.8,
                    VERY_AGGRESSIVE: 1.0
                },
                HAND_RANKINGS: {
                    HIGH_CARD: 1,
                    PAIR: 2,
                    TWO_PAIR: 3,
                    THREE_OF_A_KIND: 4,
                    STRAIGHT: 5,
                    FLUSH: 6,
                    FULL_HOUSE: 7,
                    FOUR_OF_A_KIND: 8,
                    STRAIGHT_FLUSH: 9,
                    ROYAL_FLUSH: 10
                },
                CARDS_PER_PLAYER: 2,
                MAX_PLAYERS: 6
            };
        }
    }
    
    constructor() {
        // Upewnij się że Constants jest dostępne lub użyj wartości domyślnych
        this.ensureConstants();
        
        // Podstawowe informacje o grze
        this.gameId = this.generateGameId();
        this.mode = 'singleplayer';
        this.phase = 'waiting';
        this.isActive = false;
        
        // Gracze
        this.players = [];
        this.maxPlayers = 6;
        this.currentPlayerIndex = 0;
        this.dealerIndex = 0;
        
        // Karty i talia
        this.deck = new CardDeck();
        this.communityCards = [];
        
        // Zakłady i pula
        this.pot = 0;
        this.currentBet = 0;
        this.minRaise = 20;
        this.blinds = {
            small: 10,
            big: 20
        };
        
        // Historia gry
        this.roundHistory = [];
        this.currentRoundNumber = 0;
        
        // Timery
        this.turnTimer = null;
        this.turnTimeLeft = 0;
        
        // Ustawienia
        this.settings = {
            turnTimeout: 30000,
            startingChips: 1000,
            enableRebuys: false,
            autoAdvance: true
        };
        
        // Callback'i dla eventów
        this.eventHandlers = {
            onPlayerAction: null,
            onPhaseChange: null,
            onGameEnd: null,
            onPlayerEliminated: null
        };
        
        logger.info(`Utworzono nową grę: ${this.gameId}`);
    }
    
    // Generuje unikalny ID gry
    generateGameId() {
        return 'game_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
    }
    
    // Dodaj gracza do gry
    addPlayer(player) {
        if (this.players.length >= this.maxPlayers) {
            throw new Error('Gra jest pełna');
        }
        
        if (this.isActive) {
            throw new Error('Nie można dołączyć do aktywnej gry');
        }
        
        // Znajdź wolne miejsce przy stole
        const seatNumber = this.findAvailableSeat();
        player.seatNumber = seatNumber;
        
        this.players.push(player);
        
        logger.info(`Gracz ${player.name} dołączył do gry (miejsce ${seatNumber})`);
        
        return seatNumber;
    }
    
    // Usuń gracza z gry
    removePlayer(playerId) {
        const playerIndex = this.players.findIndex(p => p.id === playerId);
        if (playerIndex === -1) return false;
        
        const player = this.players[playerIndex];
        this.players.splice(playerIndex, 1);
        
        // Dostosuj indeksy jeśli potrzeba
        if (this.dealerIndex >= playerIndex && this.dealerIndex > 0) {
            this.dealerIndex--;
        }
        
        if (this.currentPlayerIndex >= playerIndex && this.currentPlayerIndex > 0) {
            this.currentPlayerIndex--;
        }
        
        logger.info(`Gracz ${player.name} opuścił grę`);
        
        // Sprawdź czy gra może kontynuować
        if (this.isActive && this.getActivePlayers().length < 2) {
            this.endGame('Za mało graczy');
        }
        
        return true;
    }
    
    // Znajdź wolne miejsce przy stole
    findAvailableSeat() {
        const occupiedSeats = new Set(this.players.map(p => p.seatNumber));
        
        for (let i = 0; i < this.maxPlayers; i++) {
            if (!occupiedSeats.has(i)) {
                return i;
            }
        }
        
        throw new Error('Brak wolnych miejsc');
    }
    
    // Rozpocznij grę
    startGame() {
        if (this.players.length < 2) {
            throw new Error('Potrzeba przynajmniej 2 graczy');
        }
        
        this.isActive = true;
        this.phase = Constants.GAME_PHASES.PRE_FLOP;
        this.currentRoundNumber = 1;
        
        // Ustaw wszystkich graczy jako aktywnych
        this.players.forEach(player => {
            if (player.chips > 0) {
                player.status = Constants.PLAYER_STATUS.ACTIVE;
            }
        });
        
        // Wybierz losowego dealera
        this.dealerIndex = Math.floor(Math.random() * this.players.length);
        
        logger.game(`Gra rozpoczęta! Dealer: ${this.getDealer().name}`);
        
        this.startNewRound();
    }
    
    // Rozpocznij nową rundę
    startNewRound() {
        logger.game(`=== RUNDA ${this.currentRoundNumber} ===`);
        
        // Resetuj graczy
        this.players.forEach(player => player.resetForNewRound());
        
        // Resetuj stan gry
        this.pot = 0;
        this.currentBet = 0;
        this.communityCards = [];
        this.phase = Constants.GAME_PHASES.PRE_FLOP;
        
        // Przygotuj nową talię
        this.deck = new CardDeck();
        
        // Ustaw pozycje (dealer, blindy)
        this.setPositions();
        
        // Zbierz blindy
        this.collectBlinds();
        
        // Rozdaj karty
        this.dealHoleCards();
        
        // Rozpocznij licytację
        this.startBettingRound();
    }
    
    // Ustaw pozycje graczy (dealer, blindy)
    setPositions() {
        const activePlayers = this.getActivePlayers();
        if (activePlayers.length < 2) return;
        
        // Dealer
        const dealer = activePlayers[this.dealerIndex % activePlayers.length];
        dealer.isDealer = true;
        
        // Small blind (gracz po dealerze)
        const smallBlindIndex = (this.dealerIndex + 1) % activePlayers.length;
        const smallBlind = activePlayers[smallBlindIndex];
        smallBlind.isSmallBlind = true;
        
        // Big blind (gracz po small blind)
        const bigBlindIndex = (this.dealerIndex + 2) % activePlayers.length;
        const bigBlind = activePlayers[bigBlindIndex % activePlayers.length];
        bigBlind.isBigBlind = true;
        
        // Pierwszy gracz do akcji (po big blind) - znajdź w oryginalnej tablicy players
        const nextActiveIndex = (bigBlindIndex + 1) % activePlayers.length;
        const nextPlayer = activePlayers[nextActiveIndex];
        this.currentPlayerIndex = this.players.findIndex(p => p.id === nextPlayer.id);
        
        logger.debug(`Pozycje: Dealer=${dealer.name}, SB=${smallBlind.name}, BB=${bigBlind.name}`);
    }
    
    // Zbierz blindy
    collectBlinds() {
        const activePlayers = this.getActivePlayers();
        
        // Small blind
        const smallBlind = activePlayers.find(p => p.isSmallBlind);
        if (smallBlind) {
            const sbAmount = smallBlind.payBlind(this.blinds.small);
            this.pot += sbAmount;
            this.currentBet = sbAmount;
            logger.game(`${smallBlind.name} płaci small blind: $${sbAmount}`);
        }
        
        // Big blind
        const bigBlind = activePlayers.find(p => p.isBigBlind);
        if (bigBlind) {
            const bbAmount = bigBlind.payBlind(this.blinds.big);
            this.pot += bbAmount;
            this.currentBet = Math.max(this.currentBet, bbAmount);
            logger.game(`${bigBlind.name} płaci big blind: $${bbAmount}`);
        }
    }
    
    // Rozdaj karty początkowe
    dealHoleCards() {
        const activePlayers = this.getActivePlayers();
        
        // Rozdaj po 2 karty każdemu graczowi
        for (const player of activePlayers) {
            const cards = this.deck.dealCards(Constants.CARDS_PER_PLAYER);
            player.dealCards(cards);
        }
        
        logger.game(`Rozdano karty dla ${activePlayers.length} graczy`);
    }
    
    // Rozpocznij rundę licytacji
    startBettingRound() {
        const activePlayers = this.getActivePlayers();
        
        // Resetuj flagi akcji
        activePlayers.forEach(player => {
            player.hasActed = false;
        });
        
        // Znajdź pierwszego gracza do akcji
        this.currentPlayerIndex = this.findNextPlayerToAct();
        
        if (this.currentPlayerIndex === -1) {
            // Wszyscy gracze są all-in lub tylko jeden aktywny
            this.advanceToNextPhase();
            return;
        }
        
        this.startPlayerTurn();
    }
    
    // Rozpocznij turę gracza
    startPlayerTurn() {
        const currentPlayer = this.getCurrentPlayer();
        if (!currentPlayer) {
            this.advanceToNextPhase();
            return;
        }
        
        // Ustaw timer
        this.turnTimeLeft = this.settings.turnTimeout;
        this.startTurnTimer();
        
        logger.debug(`Tura gracza: ${currentPlayer.name}`);
        
        // Jeśli to bot, zaplanuj akcję
        if (currentPlayer.type === Constants.PLAYER_TYPES.BOT) {
            this.scheduleBotAction();
        }
    }
    
    // Timer tury gracza
    startTurnTimer() {
        if (this.turnTimer) {
            clearTimeout(this.turnTimer);
        }
        
        this.turnTimer = setTimeout(() => {
            const currentPlayer = this.getCurrentPlayer();
            if (currentPlayer) {
                logger.warn(`Timeout dla gracza: ${currentPlayer.name}`);
                // Automatyczny fold na timeout
                this.processPlayerAction(currentPlayer.id, Constants.PLAYER_ACTIONS.FOLD);
            }
        }, this.settings.turnTimeout);
    }
    
    // Zatrzymaj timer tury
    stopTurnTimer() {
        if (this.turnTimer) {
            clearTimeout(this.turnTimer);
            this.turnTimer = null;
        }
    }
    
    // Zaplanuj akcję bota
    scheduleBotAction() {
        const delay = Constants.GAME_SETTINGS.BOT_THINK_TIME;
        
        setTimeout(() => {
            const currentPlayer = this.getCurrentPlayer();
            if (currentPlayer && currentPlayer.type === Constants.PLAYER_TYPES.BOT) {
                const action = this.calculateBotAction(currentPlayer);
                this.processPlayerAction(currentPlayer.id, action.type, action.amount);
            }
        }, delay);
    }
    
    // Oblicz akcję bota (używa AI jeśli dostępne)
    calculateBotAction(bot) {
        // Sprawdź czy bot ma AI
        if (!bot.ai && typeof PokerAI !== 'undefined') {
            // Utwórz AI dla bota jeśli nie ma
            bot.ai = new PokerAI(bot, bot.aggressionLevel || 'normal');
        }
        
        // Użyj AI jeśli dostępne
        if (bot.ai) {
            try {
                const action = bot.ai.makeDecision(this);
                logger.debug(`AI decyzja dla ${bot.name}: ${action.type} ${action.amount || ''}`);
                return action;
            } catch (error) {
                logger.error(`Błąd AI dla ${bot.name}:`, error);
                // Spadaj do prostej logiki
            }
        }
        
        // Prosta logika fallback
        const callAmount = this.currentBet - bot.currentBet;
        const handStrength = bot.getHandStrength(this.communityCards);
        
        if (handStrength < 0.3 && callAmount > bot.chips * 0.1) {
            return { type: Constants.PLAYER_ACTIONS.FOLD };
        }
        
        if (callAmount === 0) {
            return { type: Constants.PLAYER_ACTIONS.CHECK };
        }
        
        if (handStrength > 0.7 && Math.random() < 0.3) {
            const raiseAmount = Math.min(this.currentBet * 2, bot.chips);
            return { type: Constants.PLAYER_ACTIONS.RAISE, amount: raiseAmount };
        }
        
        return { type: Constants.PLAYER_ACTIONS.CALL, amount: callAmount };
    }
    
    // Przetwórz akcję gracza
    processPlayerAction(playerId, action, amount = 0) {
        const player = this.getPlayerById(playerId);
        if (!player) {
            logger.error(`Nie znaleziono gracza: ${playerId}`);
            return false;
        }
        
        if (!player.canAct()) {
            logger.warn(`Gracz ${player.name} nie może wykonać akcji`);
            return false;
        }
        
        this.stopTurnTimer();
        
        // Sprawdź poprawność akcji
        if (!this.validateAction(player, action, amount)) {
            logger.warn(`Nieprawidłowa akcja: ${action} przez gracza ${player.name}`);
            return false;
        }
        
        // Wykonaj akcję
        const actualAmount = this.executeAction(player, action, amount);
        
        // Aktualizuj stan gry
        this.updateGameStateAfterAction(player, action, actualAmount);
        
        // Sprawdź czy runda licytacji się skończyła
        if (this.isBettingRoundComplete()) {
            this.advanceToNextPhase();
        } else {
            // Przejdź do następnego gracza
            this.currentPlayerIndex = this.findNextPlayerToAct();
            this.startPlayerTurn();
        }
        
        return true;
    }
    
    // Waliduj akcję gracza
    validateAction(player, action, amount) {
        const callAmount = this.currentBet - player.currentBet;
        
        switch (action) {
            case Constants.PLAYER_ACTIONS.FOLD:
                return true;
                
            case Constants.PLAYER_ACTIONS.CHECK:
                return callAmount === 0;
                
            case Constants.PLAYER_ACTIONS.CALL:
                return callAmount > 0 && amount >= Math.min(callAmount, player.chips);
                
            case Constants.PLAYER_ACTIONS.RAISE:
                const minRaise = this.currentBet + this.minRaise;
                return amount >= Math.min(minRaise, player.chips) && amount <= player.chips;
                
            case Constants.PLAYER_ACTIONS.ALL_IN:
                return player.chips > 0;
                
            default:
                return false;
        }
    }
    
    // Wykonaj akcję gracza
    executeAction(player, action, amount) {
        let actualAmount = 0;
        
        switch (action) {
            case Constants.PLAYER_ACTIONS.FOLD:
                player.performAction(action);
                break;
                
            case Constants.PLAYER_ACTIONS.CHECK:
                player.performAction(action);
                break;
                
            case Constants.PLAYER_ACTIONS.CALL:
                const callAmount = this.currentBet - player.currentBet;
                actualAmount = player.call(this.currentBet);
                this.pot += actualAmount;
                player.hasActed = true; // Upewnij się że jest ustawione
                break;
                
            case Constants.PLAYER_ACTIONS.RAISE:
                actualAmount = player.raise(amount);
                this.pot += actualAmount;
                this.currentBet = player.currentBet;
                player.hasActed = true; // Upewnij się że jest ustawione
                break;
                
            case Constants.PLAYER_ACTIONS.ALL_IN:
                actualAmount = player.allIn();
                this.pot += actualAmount;
                this.currentBet = Math.max(this.currentBet, player.currentBet);
                player.hasActed = true; // Upewnij się że jest ustawione
                break;
        }
        
        return actualAmount;
    }
    
    // Aktualizuj stan gry po akcji
    updateGameStateAfterAction(player, action, amount) {
        // Zapisz w historii
        this.roundHistory.push({
            playerId: player.id,
            playerName: player.name,
            action,
            amount,
            pot: this.pot,
            phase: this.phase,
            timestamp: Date.now()
        });
        
        // Wywołaj callback
        if (this.eventHandlers.onPlayerAction) {
            this.eventHandlers.onPlayerAction(player, action, amount);
        }
    }
    
    // Sprawdź czy runda licytacji jest zakończona
    isBettingRoundComplete() {
        const activePlayers = this.getActivePlayers();
        const playersInRound = activePlayers.filter(p => p.status !== Constants.PLAYER_STATUS.FOLDED);
        
        // Jeśli został tylko jeden gracz
        if (playersInRound.length <= 1) {
            return true;
        }
        
        // Sprawdź czy wszyscy gracze wykonali akcję i wyrównali zakłady
        const playersWhoCanAct = playersInRound.filter(p => 
            p.status === Constants.PLAYER_STATUS.ACTIVE && p.chips > 0
        );
        
        if (playersWhoCanAct.length === 0) {
            return true; // Wszyscy są all-in
        }
        
        // Sprawdź czy wszyscy wykonali akcję i mają równe zakłady
        const hasEqualBets = playersWhoCanAct.every(p => 
            p.hasActed && p.currentBet === this.currentBet
        );
        
        return hasEqualBets;
    }
    
    // Przejdź do następnej fazy
    advanceToNextPhase() {
        // Resetuj flagi akcji
        this.players.forEach(player => player.resetForNewPhase());
        
        switch (this.phase) {
            case Constants.GAME_PHASES.PRE_FLOP:
                this.dealFlop();
                break;
                
            case Constants.GAME_PHASES.FLOP:
                this.dealTurn();
                break;
                
            case Constants.GAME_PHASES.TURN:
                this.dealRiver();
                break;
                
            case Constants.GAME_PHASES.RIVER:
                this.showdown();
                return;
                
            default:
                this.endRound();
                return;
        }
        
        // Rozpocznij nową rundę licytacji
        this.currentBet = 0;
        this.startBettingRound();
    }
    
    // Rozdaj flop (3 karty)
    dealFlop() {
        this.phase = Constants.GAME_PHASES.FLOP;
        this.deck.dealCard(); // Burn card
        
        for (let i = 0; i < 3; i++) {
            this.communityCards.push(this.deck.dealCard());
        }
        
        logger.game(`Flop: ${this.communityCards.slice(0, 3).map(c => c.toString()).join(', ')}`);
    }
    
    // Rozdaj turn (4. karta)
    dealTurn() {
        this.phase = Constants.GAME_PHASES.TURN;
        this.deck.dealCard(); // Burn card
        this.communityCards.push(this.deck.dealCard());
        
        logger.game(`Turn: ${this.communityCards[3].toString()}`);
    }
    
    // Rozdaj river (5. karta)
    dealRiver() {
        this.phase = Constants.GAME_PHASES.RIVER;
        this.deck.dealCard(); // Burn card
        this.communityCards.push(this.deck.dealCard());
        
        logger.game(`River: ${this.communityCards[4].toString()}`);
    }
    
    // Showdown - porównanie kart
    showdown() {
        this.phase = Constants.GAME_PHASES.SHOWDOWN;
        logger.game('=== SHOWDOWN ===');
        
        const playersInShowdown = this.players.filter(p => 
            p.status !== Constants.PLAYER_STATUS.FOLDED
        );
        
        if (playersInShowdown.length === 1) {
            // Tylko jeden gracz pozostał
            const winner = playersInShowdown[0];
            winner.winPot(this.pot);
            logger.game(`${winner.name} wygrywa przez fold przeciwników: $${this.pot}`);
        } else {
            // Porównaj ręce
            this.compareHands(playersInShowdown);
        }
        
        setTimeout(() => {
            this.endRound();
        }, 3000); // 3 sekundy na pokazanie wyniku
    }
    
    // Porównaj ręce graczy
    compareHands(players) {
        const evaluator = new HandEvaluator();
        const handResults = [];
        
        // Oceń wszystkie ręce
        for (const player of players) {
            try {
                const handResult = evaluator.evaluateHand(player.hand, this.communityCards);
                handResults.push({
                    player,
                    hand: handResult
                });
                
                logger.game(`${player.name}: ${handResult.description}`);
            } catch (error) {
                logger.error(`Błąd oceny ręki dla ${player.name}: ${error.message}`);
            }
        }
        
        // Sortuj według siły ręki
        handResults.sort((a, b) => evaluator.compareHands(b.hand, a.hand));
        
        // Znajdź zwycięzców (może być remis)
        const winners = [handResults[0]];
        for (let i = 1; i < handResults.length; i++) {
            if (evaluator.compareHands(handResults[i].hand, handResults[0].hand) === 0) {
                winners.push(handResults[i]);
            } else {
                break;
            }
        }
        
        // Podziel pulę między zwycięzców
        const winAmount = Math.floor(this.pot / winners.length);
        const remainder = this.pot % winners.length;
        
        for (let i = 0; i < winners.length; i++) {
            const amount = winAmount + (i < remainder ? 1 : 0);
            winners[i].player.winPot(amount);
            
            logger.game(`${winners[i].player.name} wygrywa $${amount} z układem: ${winners[i].hand.description}`);
        }
    }
    
    // Zakończ rundę
    endRound() {
        // Aktualizuj statystyki graczy
        this.players.forEach(player => {
            const wonHand = player.stats.handsWon > 0; // Uproszczone
            const folded = player.status === Constants.PLAYER_STATUS.FOLDED;
            player.updateStats(wonHand, folded);
        });
        
        // Sprawdź eliminowanych graczy
        const eliminatedPlayers = this.players.filter(p => p.chips === 0);
        for (const player of eliminatedPlayers) {
            logger.game(`${player.name} został wyeliminowany`);
            if (this.eventHandlers.onPlayerEliminated) {
                this.eventHandlers.onPlayerEliminated(player);
            }
        }
        
        // Sprawdź warunki końca gry
        const remainingPlayers = this.players.filter(p => p.chips > 0);
        if (remainingPlayers.length <= 1) {
            this.endGame(remainingPlayers.length === 1 ? remainingPlayers[0] : null);
            return;
        }
        
        // Przesuń dealera
        this.dealerIndex = (this.dealerIndex + 1) % this.players.length;
        
        // Rozpocznij nową rundę
        this.currentRoundNumber++;
        setTimeout(() => {
            this.startNewRound();
        }, 2000);
    }
    
    // Zakończ grę
    endGame(winner = null) {
        this.isActive = false;
        this.phase = Constants.GAME_PHASES.END;
        
        if (winner) {
            logger.game(`🏆 KONIEC GRY! Zwycięzca: ${winner.name} z $${winner.chips}`);
        } else {
            logger.game('🏁 KONIEC GRY!');
        }
        
        if (this.eventHandlers.onGameEnd) {
            this.eventHandlers.onGameEnd(winner);
        }
    }
    
    // Metody pomocnicze
    
    getActivePlayers() {
        return this.players.filter(p => 
            p.status !== Constants.PLAYER_STATUS.DISCONNECTED && p.chips > 0
        );
    }
    
    getCurrentPlayer() {
        if (this.currentPlayerIndex >= 0 && this.currentPlayerIndex < this.players.length) {
            return this.players[this.currentPlayerIndex];
        }
        return null;
    }
    
    getPlayerById(playerId) {
        return this.players.find(p => p.id === playerId);
    }
    
    getDealer() {
        return this.players[this.dealerIndex];
    }
    
    findNextPlayerToAct() {
        const activePlayers = this.getActivePlayers();
        const playersWhoCanAct = activePlayers.filter(p => 
            p.status === Constants.PLAYER_STATUS.ACTIVE && 
            !p.hasActed && 
            p.chips > 0
        );
        
        if (playersWhoCanAct.length === 0) {
            return -1;
        }
        
        // Znajdź aktualnego gracza w tablicy aktywnych graczy
        let currentActiveIndex = -1;
        if (this.currentPlayerIndex >= 0) {
            const currentPlayer = this.players[this.currentPlayerIndex];
            if (currentPlayer) {
                currentActiveIndex = activePlayers.findIndex(p => p.id === currentPlayer.id);
            }
        }
        
        // Znajdź następnego gracza w kolejności
        for (let i = 1; i <= activePlayers.length; i++) {
            const index = (currentActiveIndex + i) % activePlayers.length;
            const player = activePlayers[index];
            
            if (player && player.status === Constants.PLAYER_STATUS.ACTIVE && 
                !player.hasActed && 
                player.chips > 0) {
                // Zwróć indeks z oryginalnej tablicy players
                return this.players.findIndex(p => p.id === player.id);
            }
        }
        
        return -1;
    }
    
    // Zwraca stan gry do wysłania do klientów
    getGameState() {
        return {
            gameId: this.gameId,
            mode: this.mode,
            phase: this.phase,
            isActive: this.isActive,
            pot: this.pot,
            currentBet: this.currentBet,
            minRaise: this.minRaise,
            communityCards: this.communityCards,
            players: this.players.map(p => p.getPublicInfo()),
            currentPlayerIndex: this.currentPlayerIndex,
            dealerIndex: this.dealerIndex,
            roundNumber: this.currentRoundNumber,
            turnTimeLeft: this.turnTimeLeft
        };
    }
    
    // Ustaw callback'i
    setEventHandlers(handlers) {
        this.eventHandlers = { ...this.eventHandlers, ...handlers };
    }
    
}

// Eksport dla Node.js lub przeglądarki
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GameState;
} else if (typeof window !== 'undefined') {
    window.GameState = GameState;
}
