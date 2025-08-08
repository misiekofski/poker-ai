// Player.js - Klasa reprezentująca gracza

class Player {
    constructor(id, name, chips = Constants.GAME_SETTINGS.STARTING_CHIPS, type = Constants.PLAYER_TYPES.HUMAN) {
        this.id = id;
        this.name = name;
        this.chips = chips;
        this.type = type;
        this.status = Constants.PLAYER_STATUS.WAITING;
        
        // Karty gracza
        this.hand = [];
        
        // Stan w aktualnej rundzie
        this.currentBet = 0;
        this.totalBetThisRound = 0;
        this.hasActed = false;
        this.isDealer = false;
        this.isSmallBlind = false;
        this.isBigBlind = false;
        
        // Pozycja przy stole
        this.seatNumber = null;
        
        // Statystyki (do AI i analityki)
        this.stats = {
            handsPlayed: 0,
            handsWon: 0,
            totalWinnings: 0,
            foldFrequency: 0,
            aggressionLevel: type === Constants.PLAYER_TYPES.BOT ? this.generateRandomAggression() : 0.5
        };
        
        // Historia akcji (do analizy AI)
        this.actionHistory = [];
        
        // Socket ID dla graczy multiplayer
        this.socketId = null;
        
        // Czas ostatniej akcji
        this.lastActionTime = Date.now();
    }
    
    // Generuje losowy poziom agresji dla bota
    generateRandomAggression() {
        // Rozkład: 30% konserwatywni, 40% normalni, 20% agresywni, 10% bardzo agresywni
        const rand = Math.random();
        if (rand < 0.3) return Constants.AI_AGGRESSION.CONSERVATIVE;
        if (rand < 0.7) return Constants.AI_AGGRESSION.NORMAL;
        if (rand < 0.9) return Constants.AI_AGGRESSION.AGGRESSIVE;
        return Constants.AI_AGGRESSION.VERY_AGGRESSIVE;
    }
    
    // Rozdaj karty graczowi
    dealCards(cards) {
        this.hand = [...cards];
        logger.logCardDeal(this.name, cards.length, 'hole cards');
    }
    
    // Czy gracz może wykonać akcję
    canAct() {
        return this.status === Constants.PLAYER_STATUS.ACTIVE && 
               this.chips > 0 && 
               !this.hasActed;
    }
    
    // Wykonaj akcję
    performAction(action, amount = 0) {
        const previousBet = this.currentBet;
        
        switch (action) {
            case Constants.PLAYER_ACTIONS.FOLD:
                this.fold();
                break;
                
            case Constants.PLAYER_ACTIONS.CHECK:
                this.check();
                break;
                
            case Constants.PLAYER_ACTIONS.CALL:
                this.call(amount);
                break;
                
            case Constants.PLAYER_ACTIONS.RAISE:
                this.raise(amount);
                break;
                
            case Constants.PLAYER_ACTIONS.ALL_IN:
                this.allIn();
                break;
                
            default:
                logger.error(`Nieznana akcja: ${action}`, { player: this.name });
                return false;
        }
        
        // Zapisz akcję w historii
        this.actionHistory.push({
            action,
            amount,
            previousBet,
            chips: this.chips,
            timestamp: Date.now()
        });
        
        this.hasActed = true;
        this.lastActionTime = Date.now();
        
        logger.logPlayerAction(this.name, action, amount > 0 ? amount : null);
        return true;
    }
    
    // Akcje gracza
    
    fold() {
        this.status = Constants.PLAYER_STATUS.FOLDED;
        this.hand = []; // Ukryj karty
    }
    
    check() {
        // Sprawdź możliwość check (brak zakładu do wyrównania)
        if (this.currentBet === 0) {
            return true;
        }
        return false;
    }
    
    call(callAmount) {
        const amountToCall = Math.min(callAmount - this.currentBet, this.chips);
        this.chips -= amountToCall;
        this.currentBet += amountToCall;
        this.totalBetThisRound += amountToCall;
        
        if (this.chips === 0) {
            this.status = Constants.PLAYER_STATUS.ALL_IN;
        }
        
        return amountToCall;
    }
    
    raise(raiseAmount) {
        const totalAmount = Math.min(raiseAmount, this.chips);
        this.chips -= totalAmount;
        this.currentBet += totalAmount;
        this.totalBetThisRound += totalAmount;
        
        if (this.chips === 0) {
            this.status = Constants.PLAYER_STATUS.ALL_IN;
        }
        
        return totalAmount;
    }
    
    allIn() {
        const allInAmount = this.chips;
        this.chips = 0;
        this.currentBet += allInAmount;
        this.totalBetThisRound += allInAmount;
        this.status = Constants.PLAYER_STATUS.ALL_IN;
        
        return allInAmount;
    }
    
    // Resetuj stan na początek nowej rundy
    resetForNewRound() {
        this.hand = [];
        this.currentBet = 0;
        this.totalBetThisRound = 0;
        this.hasActed = false;
        
        // Resetuj status tylko jeśli gracz nie jest wyeliminowany
        if (this.chips > 0 && this.status !== Constants.PLAYER_STATUS.DISCONNECTED) {
            this.status = Constants.PLAYER_STATUS.ACTIVE;
        }
        
        this.isDealer = false;
        this.isSmallBlind = false;
        this.isBigBlind = false;
    }
    
    // Resetuj stan na początek nowej fazy
    resetForNewPhase() {
        this.currentBet = 0;
        this.hasActed = false;
    }
    
    // Wygraj pulę
    winPot(amount) {
        this.chips += amount;
        this.stats.totalWinnings += amount;
        this.stats.handsWon++;
        
        logger.logRoundResult(this.name, amount);
    }
    
    // Zapłać blindy
    payBlind(amount) {
        const blindAmount = Math.min(amount, this.chips);
        this.chips -= blindAmount;
        this.currentBet = blindAmount;
        this.totalBetThisRound = blindAmount;
        
        if (this.chips === 0) {
            this.status = Constants.PLAYER_STATUS.ALL_IN;
        }
        
        return blindAmount;
    }
    
    // Sprawdź czy gracz jest aktywny w grze
    isActive() {
        return this.status === Constants.PLAYER_STATUS.ACTIVE || 
               this.status === Constants.PLAYER_STATUS.ALL_IN;
    }
    
    // Sprawdź czy gracz może być dealkiem
    canBeDealer() {
        return this.chips > 0 && 
               this.status !== Constants.PLAYER_STATUS.DISCONNECTED;
    }
    
    // Czy gracz może kontynuować grę
    canContinue() {
        return this.chips > 0 || this.status === Constants.PLAYER_STATUS.ALL_IN;
    }
    
    // Oblicz siłę ręki (0-1, gdzie 1 to najsilniejsza)
    getHandStrength(communityCards = []) {
        if (this.hand.length === 0) return 0;
        
        try {
            const evaluator = new HandEvaluator();
            const handResult = evaluator.evaluateHand(this.hand, communityCards);
            
            // Normalizuj ranking do skali 0-1
            return handResult.ranking / Constants.HAND_RANKINGS.ROYAL_FLUSH;
        } catch (error) {
            logger.debug(`Błąd oceny ręki dla ${this.name}: ${error.message}`);
            return 0;
        }
    }
    
    // Aktualizuj statystyki po rundzie
    updateStats(wonHand = false, folded = false) {
        this.stats.handsPlayed++;
        
        if (folded) {
            // Aktualizuj częstotliwość foldowania
            const foldCount = this.actionHistory.filter(a => a.action === Constants.PLAYER_ACTIONS.FOLD).length;
            this.stats.foldFrequency = foldCount / this.stats.handsPlayed;
        }
        
        // Aktualizuj poziom agresji na podstawie historii akcji
        if (this.type === Constants.PLAYER_TYPES.BOT) {
            this.updateAggressionLevel();
        }
    }
    
    // Aktualizuj poziom agresji na podstawie akcji
    updateAggressionLevel() {
        const recentActions = this.actionHistory.slice(-10); // Ostatnie 10 akcji
        if (recentActions.length === 0) return;
        
        let aggressiveActions = 0;
        for (const action of recentActions) {
            if (action.action === Constants.PLAYER_ACTIONS.RAISE || 
                action.action === Constants.PLAYER_ACTIONS.ALL_IN) {
                aggressiveActions++;
            }
        }
        
        const aggressionRatio = aggressiveActions / recentActions.length;
        
        // Delikatnie dostosuj poziom agresji
        this.stats.aggressionLevel = (this.stats.aggressionLevel * 0.8) + (aggressionRatio * 0.2);
        this.stats.aggressionLevel = Math.max(0.1, Math.min(0.9, this.stats.aggressionLevel));
    }
    
    // Zwraca informacje o graczu do wysłania do klientów
    getPublicInfo() {
        return {
            id: this.id,
            name: this.name,
            chips: this.chips,
            type: this.type,
            status: this.status,
            currentBet: this.currentBet,
            seatNumber: this.seatNumber,
            isDealer: this.isDealer,
            isSmallBlind: this.isSmallBlind,
            isBigBlind: this.isBigBlind,
            handCount: this.hand.length,
            hasActed: this.hasActed
        };
    }
    
    // Zwraca informacje prywatne (włącznie z kartami)
    getPrivateInfo() {
        return {
            ...this.getPublicInfo(),
            hand: this.hand,
            stats: this.stats,
            lastActionTime: this.lastActionTime
        };
    }
    
    // Serializacja do JSON
    toJSON() {
        return {
            id: this.id,
            name: this.name,
            chips: this.chips,
            type: this.type,
            status: this.status,
            hand: this.hand,
            currentBet: this.currentBet,
            totalBetThisRound: this.totalBetThisRound,
            seatNumber: this.seatNumber,
            stats: this.stats,
            actionHistory: this.actionHistory.slice(-20), // Ostatnie 20 akcji
            socketId: this.socketId
        };
    }
    
    // Tworzenie gracza z JSON
    static fromJSON(data) {
        const player = new Player(data.id, data.name, data.chips, data.type);
        
        player.status = data.status;
        player.hand = data.hand || [];
        player.currentBet = data.currentBet || 0;
        player.totalBetThisRound = data.totalBetThisRound || 0;
        player.seatNumber = data.seatNumber;
        player.stats = { ...player.stats, ...data.stats };
        player.actionHistory = data.actionHistory || [];
        player.socketId = data.socketId;
        
        return player;
    }
    
    // Klonuj gracza (do symulacji)
    clone() {
        return Player.fromJSON(this.toJSON());
    }
}

// Eksport dla Node.js lub przeglądarki
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Player;
} else if (typeof window !== 'undefined') {
    window.Player = Player;
}
