// GameRoom.js - Zarządzanie pokojem gry

const Constants = require('../public/js/shared/Constants');
const { Card, CardDeck } = require('../public/js/shared/CardDeck');
const HandEvaluator = require('../public/js/shared/HandEvaluator');

class GameRoom {
    constructor(name, isDev = false) {
        this.name = name;
        this.isDev = isDev;
        
        // Gracze i boty
        this.players = new Map(); // playerId -> player object
        this.bots = new Map(); // botId -> bot object
        this.seats = new Array(Constants.MAX_PLAYERS).fill(null); // seatIndex -> playerId
        
        // Stan gry
        this.gameState = {
            phase: Constants.GAME_PHASES.WAITING,
            isActive: false,
            handNumber: 0,
            pot: 0,
            communityCards: [],
            currentBet: 0,
            dealerPosition: 0,
            activePlayer: null,
            lastRaise: 0,
            sidePots: []
        };
        
        // Konfiguracja gry
        this.config = {
            smallBlind: 10,
            bigBlind: 20,
            maxBuyIn: 2000,
            minBuyIn: 200,
            autoStartDelay: 3000, // 3 sekundy do auto-startu
            actionTimeout: 30000, // 30 sekund na akcję
            maxHandsPerHour: 120
        };
        
        // Statystyki pokoju
        this.stats = {
            handsPlayed: 0,
            totalPotSize: 0,
            biggestPot: 0,
            playersJoined: 0,
            createdAt: Date.now(),
            lastActivity: Date.now()
        };
        
        // Timery
        this.actionTimer = null;
        this.autoStartTimer = null;
        
        // Deck i evaluator
        this.deck = new CardDeck();
        this.handEvaluator = new HandEvaluator();
        
        this.log(`🏠 Utworzono pokój: ${name}`);
    }
    
    // Dodaj gracza
    addPlayer(socket, playerName) {
        try {
            // Sprawdź czy nazwa jest zajęta
            for (const [id, player] of this.players.entries()) {
                if (player.name === playerName) {
                    return { success: false, error: 'Nazwa gracza jest już zajęta' };
                }
            }
            
            // Znajdź wolne miejsce
            const seatIndex = this.findEmptySeat();
            if (seatIndex === -1) {
                return { success: false, error: 'Pokój jest pełny' };
            }
            
            // Utwórz gracza
            const playerId = `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const player = {
                id: playerId,
                name: playerName,
                socket: socket,
                chips: this.config.maxBuyIn,
                cards: [],
                isActive: true,
                isFolded: false,
                isAllIn: false,
                currentBet: 0,
                totalBet: 0,
                seatIndex: seatIndex,
                stats: {
                    handsPlayed: 0,
                    handsWon: 0,
                    totalWinnings: 0,
                    biggestWin: 0,
                    vpip: 0, // Voluntarily Put money In Pot
                    pfr: 0,  // Pre-Flop Raise
                    aggression: 0
                },
                joinTime: Date.now(),
                lastAction: Date.now(),
                isBot: false
            };
            
            // Dodaj do mapy graczy i zajmij miejsce
            this.players.set(playerId, player);
            this.seats[seatIndex] = playerId;
            
            this.stats.playersJoined++;
            this.updateLastActivity();
            
            this.log(`➕ ${playerName} dołączył (miejsce ${seatIndex + 1})`);
            
            // Sprawdź auto-start
            this.checkAutoStart();
            
            return { success: true, playerId: playerId };
            
        } catch (error) {
            this.logError('Błąd dodawania gracza:', error);
            return { success: false, error: 'Wewnętrzny błąd serwera' };
        }
    }
    
    // Usuń gracza
    removePlayer(playerId) {
        try {
            const player = this.players.get(playerId);
            if (!player) {
                return { success: false, error: 'Gracz nie znaleziony' };
            }
            
            const playerName = player.name;
            const seatIndex = player.seatIndex;
            
            // Usuń z gry jeśli jest aktywna
            if (this.gameState.isActive && player.isActive) {
                this.foldPlayer(playerId, 'Gracz opuścił grę');
            }
            
            // Usuń gracza
            this.players.delete(playerId);
            this.seats[seatIndex] = null;
            
            this.updateLastActivity();
            this.log(`➖ ${playerName} opuścił pokój`);
            
            // Sprawdź czy gra może być kontynuowana
            this.checkGameContinuation();
            
            return { success: true, playerName: playerName };
            
        } catch (error) {
            this.logError('Błąd usuwania gracza:', error);
            return { success: false, error: 'Wewnętrzny błąd serwera' };
        }
    }
    
    // Dodaj boty (tylko dev mode)
    addBots(count, botManager) {
        if (!this.isDev) {
            return { success: false, error: 'Boty dostępne tylko w trybie deweloperskim' };
        }
        
        let addedCount = 0;
        
        for (let i = 0; i < count; i++) {
            const seatIndex = this.findEmptySeat();
            if (seatIndex === -1) break;
            
            const bot = botManager.createBot(seatIndex);
            const botId = bot.id;
            
            // Dodaj bota jak gracza
            this.bots.set(botId, bot);
            this.seats[seatIndex] = botId;
            
            addedCount++;
        }
        
        if (addedCount > 0) {
            this.updateLastActivity();
            this.checkAutoStart();
        }
        
        return { success: true, addedCount: addedCount };
    }
    
    // Rozpocznij grę
    startGame(requestingPlayerId = null) {
        try {
            // Sprawdź czy gracz może rozpocząć grę
            if (requestingPlayerId) {
                const player = this.players.get(requestingPlayerId);
                if (!player) {
                    return { success: false, error: 'Nieautoryzowany gracz' };
                }
            }
            
            // Sprawdź warunki startu
            const totalPlayers = this.getActivePlayerCount();
            if (totalPlayers < 2) {
                return { success: false, error: 'Potrzeba minimum 2 graczy do rozpoczęcia gry' };
            }
            
            if (this.gameState.isActive) {
                return { success: false, error: 'Gra już trwa' };
            }
            
            // Rozpocznij nową rękę
            this.startNewHand();
            
            return { success: true };
            
        } catch (error) {
            this.logError('Błąd rozpoczęcia gry:', error);
            return { success: false, error: 'Nie można rozpocząć gry' };
        }
    }
    
    // Rozpocznij nową rękę
    startNewHand() {
        // Reset stanu gry
        this.gameState.isActive = true;
        this.gameState.phase = Constants.GAME_PHASES.PREFLOP;
        this.gameState.handNumber++;
        this.gameState.pot = 0;
        this.gameState.communityCards = [];
        this.gameState.currentBet = this.config.bigBlind;
        this.gameState.lastRaise = this.config.bigBlind;
        this.gameState.sidePots = [];
        
        // Nowa talia
        this.deck = new CardDeck();
        this.deck.shuffle();
        
        // Reset graczy
        this.resetPlayersForNewHand();
        
        // Znajdź dealer position
        this.setDealerPosition();
        
        // Pobierz blindy
        this.collectBlinds();
        
        // Rozdaj karty
        this.dealCards();
        
        // Ustaw pierwszego gracza do akcji
        this.setNextActivePlayer();
        
        // Uruchom timer akcji
        this.startActionTimer();
        
        this.log(`🎲 Rozpoczęto rękę #${this.gameState.handNumber}`);
        this.updateLastActivity();
    }
    
    // Reset graczy na nową rękę
    resetPlayersForNewHand() {
        // Reset graczy ludzkich
        for (const [id, player] of this.players.entries()) {
            player.cards = [];
            player.isFolded = false;
            player.isAllIn = false;
            player.currentBet = 0;
            player.totalBet = 0;
            player.isActive = player.chips > 0;
            player.lastAction = null;
        }
        
        // Reset botów
        for (const [id, bot] of this.bots.entries()) {
            bot.cards = [];
            bot.isFolded = false;
            bot.isAllIn = false;
            bot.currentBet = 0;
            bot.totalBet = 0;
            bot.isActive = bot.chips > 0;
            bot.lastAction = null;
        }
    }
    
    // Ustaw pozycję dealera
    setDealerPosition() {
        const activePlayers = this.getActivePlayerIds();
        if (activePlayers.length === 0) return;
        
        // Pierwsza gra - losowy dealer
        if (this.gameState.handNumber === 1) {
            const randomIndex = Math.floor(Math.random() * activePlayers.length);
            const randomPlayerId = activePlayers[randomIndex];
            this.gameState.dealerPosition = this.getPlayerSeatIndex(randomPlayerId);
        } else {
            // Następny gracz jako dealer
            this.gameState.dealerPosition = this.getNextActiveSeat(this.gameState.dealerPosition);
        }
    }
    
    // Pobierz blindy
    collectBlinds() {
        const activePlayers = this.getActivePlayerIds();
        if (activePlayers.length < 2) return;
        
        // Small blind
        const smallBlindSeat = this.getNextActiveSeat(this.gameState.dealerPosition);
        const smallBlindPlayerId = this.seats[smallBlindSeat];
        this.placeBet(smallBlindPlayerId, this.config.smallBlind, 'Small Blind');
        
        // Big blind
        let bigBlindSeat;
        if (activePlayers.length === 2) {
            // Heads-up: dealer jest small blind
            bigBlindSeat = this.gameState.dealerPosition;
        } else {
            bigBlindSeat = this.getNextActiveSeat(smallBlindSeat);
        }
        const bigBlindPlayerId = this.seats[bigBlindSeat];
        this.placeBet(bigBlindPlayerId, this.config.bigBlind, 'Big Blind');
    }
    
    // Rozdaj karty
    dealCards() {
        const activePlayers = this.getActivePlayerIds();
        
        // 2 karty dla każdego gracza
        for (let round = 0; round < 2; round++) {
            for (const playerId of activePlayers) {
                const card = this.deck.dealCard();
                const player = this.getPlayer(playerId);
                if (player) {
                    player.cards.push(card);
                }
            }
        }
    }
    
    // Przetwórz akcję gracza
    processPlayerAction(playerId, action, amount = 0) {
        try {
            if (!this.gameState.isActive) {
                return { success: false, error: 'Gra nie jest aktywna' };
            }
            
            if (this.gameState.activePlayer !== playerId) {
                return { success: false, error: 'Nie twoja kolej' };
            }
            
            const player = this.getPlayer(playerId);
            if (!player || player.isFolded || !player.isActive) {
                return { success: false, error: 'Nie możesz wykonać akcji' };
            }
            
            // Sprawdź poprawność akcji
            const validation = this.validateAction(player, action, amount);
            if (!validation.success) {
                return validation;
            }
            
            // Wykonaj akcję
            const result = this.executeAction(player, action, validation.amount);
            if (!result.success) {
                return result;
            }
            
            // Sprawdź czy runda zakończona
            if (this.isRoundComplete()) {
                this.advanceGamePhase();
            } else {
                this.setNextActivePlayer();
                this.startActionTimer();
            }
            
            return { success: true };
            
        } catch (error) {
            this.logError('Błąd przetwarzania akcji:', error);
            return { success: false, error: 'Nie można przetworzyć akcji' };
        }
    }
    
    // Waliduj akcję
    validateAction(player, action, amount) {
        const callAmount = this.gameState.currentBet - player.currentBet;
        
        switch (action) {
            case Constants.ACTIONS.FOLD:
                return { success: true, amount: 0 };
                
            case Constants.ACTIONS.CHECK:
                if (callAmount > 0) {
                    return { success: false, error: 'Nie możesz sprawdzić - musisz dopłacić lub spasować' };
                }
                return { success: true, amount: 0 };
                
            case Constants.ACTIONS.CALL:
                if (callAmount === 0) {
                    return { success: false, error: 'Nie ma nic do dopłacenia' };
                }
                const maxCall = Math.min(callAmount, player.chips);
                return { success: true, amount: maxCall };
                
            case Constants.ACTIONS.RAISE:
                const minRaise = this.gameState.currentBet + this.gameState.lastRaise;
                const maxRaise = player.chips + player.currentBet;
                
                if (amount < minRaise) {
                    return { success: false, error: `Minimalna podbita: ${minRaise}` };
                }
                if (amount > maxRaise) {
                    return { success: false, error: `Maksymalna podbita: ${maxRaise}` };
                }
                return { success: true, amount: amount };
                
            case Constants.ACTIONS.ALL_IN:
                return { success: true, amount: player.chips + player.currentBet };
                
            default:
                return { success: false, error: 'Nieznana akcja' };
        }
    }
    
    // Wykonaj akcję
    executeAction(player, action, amount) {
        this.clearActionTimer();
        
        switch (action) {
            case Constants.ACTIONS.FOLD:
                player.isFolded = true;
                player.lastAction = { type: action, amount: 0 };
                this.log(`${player.name} pasuje`);
                break;
                
            case Constants.ACTIONS.CHECK:
                player.lastAction = { type: action, amount: 0 };
                this.log(`${player.name} sprawdza`);
                break;
                
            case Constants.ACTIONS.CALL:
                this.placeBet(player.id, amount - player.currentBet);
                player.lastAction = { type: action, amount: amount };
                this.log(`${player.name} dopłaca ${amount - player.currentBet}`);
                break;
                
            case Constants.ACTIONS.RAISE:
                const raiseAmount = amount - player.currentBet;
                this.placeBet(player.id, raiseAmount);
                this.gameState.currentBet = amount;
                this.gameState.lastRaise = amount - (this.gameState.currentBet - this.gameState.lastRaise);
                player.lastAction = { type: action, amount: amount };
                this.log(`${player.name} podbija do ${amount}`);
                break;
                
            case Constants.ACTIONS.ALL_IN:
                const allInAmount = player.chips;
                this.placeBet(player.id, allInAmount);
                player.isAllIn = true;
                if (player.currentBet > this.gameState.currentBet) {
                    this.gameState.currentBet = player.currentBet;
                    this.gameState.lastRaise = player.currentBet - this.gameState.currentBet;
                }
                player.lastAction = { type: action, amount: player.currentBet };
                this.log(`${player.name} idzie all-in za ${allInAmount}`);
                break;
        }
        
        this.updateLastActivity();
        return { success: true };
    }
    
    // Postaw zakład
    placeBet(playerId, amount, reason = null) {
        const player = this.getPlayer(playerId);
        if (!player) return false;
        
        const betAmount = Math.min(amount, player.chips);
        player.chips -= betAmount;
        player.currentBet += betAmount;
        player.totalBet += betAmount;
        this.gameState.pot += betAmount;
        
        if (player.chips === 0) {
            player.isAllIn = true;
        }
        
        if (reason) {
            this.log(`${player.name} stawia ${betAmount} (${reason})`);
        }
        
        return true;
    }
    
    // Spasuj gracza
    foldPlayer(playerId, reason = null) {
        const player = this.getPlayer(playerId);
        if (player) {
            player.isFolded = true;
            player.lastAction = { type: Constants.ACTIONS.FOLD, amount: 0 };
            
            if (reason) {
                this.log(`${player.name} pasuje (${reason})`);
            }
        }
    }
    
    // Sprawdź czy runda jest zakończona
    isRoundComplete() {
        const activePlayers = this.getActivePlayerIds().filter(id => {
            const player = this.getPlayer(id);
            return player && !player.isFolded && !player.isAllIn;
        });
        
        if (activePlayers.length <= 1) return true;
        
        // Sprawdź czy wszyscy gracze postawili tyle samo
        let lastBet = null;
        for (const id of activePlayers) {
            const player = this.getPlayer(id);
            if (player.lastAction === null) return false; // Gracz jeszcze nie działał
            
            if (lastBet === null) {
                lastBet = player.currentBet;
            } else if (player.currentBet !== lastBet) {
                return false;
            }
        }
        
        return true;
    }
    
    // Przejdź do następnej fazy gry
    advanceGamePhase() {
        // Przygotuj się do następnej fazy
        this.resetCurrentBets();
        
        switch (this.gameState.phase) {
            case Constants.GAME_PHASES.PREFLOP:
                this.gameState.phase = Constants.GAME_PHASES.FLOP;
                this.dealFlop();
                break;
                
            case Constants.GAME_PHASES.FLOP:
                this.gameState.phase = Constants.GAME_PHASES.TURN;
                this.dealTurn();
                break;
                
            case Constants.GAME_PHASES.TURN:
                this.gameState.phase = Constants.GAME_PHASES.RIVER;
                this.dealRiver();
                break;
                
            case Constants.GAME_PHASES.RIVER:
                this.gameState.phase = Constants.GAME_PHASES.SHOWDOWN;
                this.handleShowdown();
                return; // Showdown nie ma kolejnych akcji
        }
        
        // Ustaw następnego gracza do akcji
        this.gameState.currentBet = 0;
        this.gameState.lastRaise = 0;
        this.setNextActivePlayer();
        this.startActionTimer();
        
        this.log(`🃏 Faza: ${this.gameState.phase}`);
    }
    
    // Rozdaj flop (3 karty)
    dealFlop() {
        this.deck.dealCard(); // Spalona karta
        for (let i = 0; i < 3; i++) {
            this.gameState.communityCards.push(this.deck.dealCard());
        }
    }
    
    // Rozdaj turn (1 karta)
    dealTurn() {
        this.deck.dealCard(); // Spalona karta
        this.gameState.communityCards.push(this.deck.dealCard());
    }
    
    // Rozdaj river (1 karta)
    dealRiver() {
        this.deck.dealCard(); // Spalona karta
        this.gameState.communityCards.push(this.deck.dealCard());
    }
    
    // Obsługa showdown
    handleShowdown() {
        const activePlayers = this.getActivePlayerIds().filter(id => {
            const player = this.getPlayer(id);
            return player && !player.isFolded;
        });
        
        if (activePlayers.length === 1) {
            // Tylko jeden gracz pozostał
            this.awardPot([activePlayers[0]]);
        } else {
            // Oceń ręce i określ zwycięzców
            const playerHands = this.evaluateAllHands(activePlayers);
            const winners = this.determineWinners(playerHands);
            this.awardPot(winners);
        }
        
        // Zakończ rękę
        this.endHand();
    }
    
    // Oceń wszystkie ręce
    evaluateAllHands(playerIds) {
        const results = [];
        
        for (const playerId of playerIds) {
            const player = this.getPlayer(playerId);
            if (!player) continue;
            
            const handResult = this.handEvaluator.evaluateHand(player.cards, this.gameState.communityCards);
            
            results.push({
                playerId: playerId,
                player: player,
                hand: handResult,
                totalBet: player.totalBet
            });
        }
        
        return results;
    }
    
    // Określ zwycięzców
    determineWinners(playerHands) {
        if (playerHands.length === 0) return [];
        
        // Sortuj po sile ręki (najlepsze pierwsze)
        playerHands.sort((a, b) => this.handEvaluator.compareHands(b.hand, a.hand));
        
        // Znajdź wszystkich graczy z najlepszą ręką
        const bestHand = playerHands[0].hand;
        const winners = [];
        
        for (const result of playerHands) {
            if (this.handEvaluator.compareHands(result.hand, bestHand) === 0) {
                winners.push(result.playerId);
            } else {
                break;
            }
        }
        
        return winners;
    }
    
    // Przyznaj pulę
    awardPot(winnerIds) {
        if (winnerIds.length === 0) return;
        
        const totalPot = this.gameState.pot;
        const winningsPerPlayer = Math.floor(totalPot / winnerIds.length);
        const remainder = totalPot % winnerIds.length;
        
        for (let i = 0; i < winnerIds.length; i++) {
            const player = this.getPlayer(winnerIds[i]);
            if (player) {
                const winnings = winningsPerPlayer + (i < remainder ? 1 : 0);
                player.chips += winnings;
                player.stats.totalWinnings += winnings;
                player.stats.handsWon++;
                
                if (winnings > player.stats.biggestWin) {
                    player.stats.biggestWin = winnings;
                }
                
                this.log(`🏆 ${player.name} wygrywa ${winnings} żetonów`);
            }
        }
        
        // Aktualizuj statystyki pokoju
        this.stats.totalPotSize += totalPot;
        if (totalPot > this.stats.biggestPot) {
            this.stats.biggestPot = totalPot;
        }
    }
    
    // Zakończ rękę
    endHand() {
        this.clearActionTimer();
        this.gameState.pot = 0;
        this.stats.handsPlayed++;
        
        // Aktualizuj statystyki graczy
        for (const [id, player] of this.players.entries()) {
            player.stats.handsPlayed++;
        }
        for (const [id, bot] of this.bots.entries()) {
            bot.stats.handsPlayed++;
        }
        
        // Usuń graczy bez żetonów
        this.removePlayersWithoutChips();
        
        // Sprawdź czy można rozpocząć następną rękę
        setTimeout(() => {
            this.checkGameContinuation();
        }, 5000); // 5 sekund przerwy między rękami
    }
    
    // Usuń graczy bez żetonów
    removePlayersWithoutChips() {
        // Usuń graczy ludzkich bez żetonów
        for (const [id, player] of this.players.entries()) {
            if (player.chips <= 0) {
                this.log(`💸 ${player.name} wykluczony (brak żetonów)`);
                this.removePlayer(id);
            }
        }
        
        // Usuń boty bez żetonów
        for (const [id, bot] of this.bots.entries()) {
            if (bot.chips <= 0) {
                this.log(`🤖💸 ${bot.name} usunięty (brak żetonów)`);
                this.bots.delete(id);
                this.seats[bot.seatIndex] = null;
            }
        }
    }
    
    // Sprawdź kontynuację gry
    checkGameContinuation() {
        const activePlayerCount = this.getActivePlayerCount();
        
        if (activePlayerCount < 2) {
            this.endGame('Niewystarczająca liczba graczy');
        } else if (this.gameState.isActive) {
            // Kontynuuj z następną ręką
            setTimeout(() => {
                this.startNewHand();
            }, 2000);
        } else {
            // Sprawdź auto-start
            this.checkAutoStart();
        }
    }
    
    // Zakończ grę
    endGame(reason = 'Gra zakończona') {
        this.clearActionTimer();
        this.clearAutoStartTimer();
        
        this.gameState.isActive = false;
        this.gameState.phase = Constants.GAME_PHASES.WAITING;
        
        this.log(`🏁 Gra zakończona: ${reason}`);
        this.updateLastActivity();
    }
    
    // Sprawdź auto-start
    checkAutoStart() {
        if (this.gameState.isActive) return;
        
        const activePlayerCount = this.getActivePlayerCount();
        if (activePlayerCount >= 2) {
            this.clearAutoStartTimer();
            this.autoStartTimer = setTimeout(() => {
                this.startGame();
            }, this.config.autoStartDelay);
        }
    }
    
    // Timer akcji gracza
    startActionTimer() {
        this.clearActionTimer();
        
        if (!this.gameState.activePlayer) return;
        
        this.actionTimer = setTimeout(() => {
            this.handleActionTimeout();
        }, this.config.actionTimeout);
    }
    
    // Obsługa timeout akcji
    handleActionTimeout() {
        if (!this.gameState.activePlayer) return;
        
        const player = this.getPlayer(this.gameState.activePlayer);
        if (!player) return;
        
        // Auto-fold lub auto-check
        const callAmount = this.gameState.currentBet - player.currentBet;
        if (callAmount === 0) {
            this.processPlayerAction(this.gameState.activePlayer, Constants.ACTIONS.CHECK);
        } else {
            this.processPlayerAction(this.gameState.activePlayer, Constants.ACTIONS.FOLD);
        }
        
        this.log(`⏱️ ${player.name} timeout - automatyczna akcja`);
    }
    
    // Wyczyść timer akcji
    clearActionTimer() {
        if (this.actionTimer) {
            clearTimeout(this.actionTimer);
            this.actionTimer = null;
        }
    }
    
    // Wyczyść timer auto-start
    clearAutoStartTimer() {
        if (this.autoStartTimer) {
            clearTimeout(this.autoStartTimer);
            this.autoStartTimer = null;
        }
    }
    
    // Ustaw następnego aktywnego gracza
    setNextActivePlayer() {
        const currentSeat = this.gameState.activePlayer ? 
            this.getPlayerSeatIndex(this.gameState.activePlayer) : 
            this.gameState.dealerPosition;
        
        const nextSeat = this.getNextActiveSeat(currentSeat);
        this.gameState.activePlayer = this.seats[nextSeat];
        
        // Jeśli to bot, automatycznie wykonaj akcję
        if (this.gameState.activePlayer && this.isBot(this.gameState.activePlayer)) {
            setTimeout(() => {
                this.processBotAction(this.gameState.activePlayer);
            }, 1000 + Math.random() * 2000); // 1-3 sekundy delay
        }
    }
    
    // Przetwórz akcję bota
    processBotAction(botId) {
        const bot = this.bots.get(botId);
        if (!bot) return;
        
        // Proste AI - będzie rozszerzone w BotManager
        const callAmount = this.gameState.currentBet - bot.currentBet;
        let action, amount = 0;
        
        if (callAmount === 0) {
            action = Math.random() < 0.7 ? Constants.ACTIONS.CHECK : Constants.ACTIONS.RAISE;
            if (action === Constants.ACTIONS.RAISE) {
                amount = this.gameState.currentBet + this.config.bigBlind;
            }
        } else {
            const random = Math.random();
            if (random < 0.5) {
                action = Constants.ACTIONS.FOLD;
            } else if (random < 0.8) {
                action = Constants.ACTIONS.CALL;
                amount = callAmount;
            } else {
                action = Constants.ACTIONS.RAISE;
                amount = this.gameState.currentBet + this.config.bigBlind;
            }
        }
        
        this.processPlayerAction(botId, action, amount);
    }
    
    // Reset obecnych zakładów
    resetCurrentBets() {
        for (const [id, player] of this.players.entries()) {
            player.currentBet = 0;
            player.lastAction = null;
        }
        for (const [id, bot] of this.bots.entries()) {
            bot.currentBet = 0;
            bot.lastAction = null;
        }
    }
    
    // Pomocnicze metody
    
    findEmptySeat() {
        for (let i = 0; i < this.seats.length; i++) {
            if (this.seats[i] === null) return i;
        }
        return -1;
    }
    
    getPlayer(playerId) {
        return this.players.get(playerId) || this.bots.get(playerId);
    }
    
    isBot(playerId) {
        return this.bots.has(playerId);
    }
    
    getPlayerCount() {
        return this.players.size;
    }
    
    getActivePlayerCount() {
        return this.players.size + this.bots.size;
    }
    
    hasActiveBots() {
        return this.bots.size > 0;
    }
    
    getActivePlayerIds() {
        const playerIds = Array.from(this.players.keys()).filter(id => {
            const player = this.players.get(id);
            return player && player.isActive && player.chips > 0;
        });
        
        const botIds = Array.from(this.bots.keys()).filter(id => {
            const bot = this.bots.get(id);
            return bot && bot.isActive && bot.chips > 0;
        });
        
        return [...playerIds, ...botIds];
    }
    
    getPlayerSeatIndex(playerId) {
        const player = this.getPlayer(playerId);
        return player ? player.seatIndex : -1;
    }
    
    getNextActiveSeat(currentSeat) {
        for (let i = 1; i <= this.seats.length; i++) {
            const nextSeat = (currentSeat + i) % this.seats.length;
            const playerId = this.seats[nextSeat];
            if (playerId) {
                const player = this.getPlayer(playerId);
                if (player && player.isActive && !player.isFolded && player.chips > 0) {
                    return nextSeat;
                }
            }
        }
        return currentSeat;
    }
    
    // Publiczne API
    
    getGameState() {
        return {
            room: {
                name: this.name,
                config: this.config,
                stats: this.stats
            },
            game: { ...this.gameState },
            players: Array.from(this.players.values()).map(p => ({
                id: p.id,
                name: p.name,
                chips: p.chips,
                cards: p.cards, // W prawdziwej grze ukryte dla innych graczy
                isActive: p.isActive,
                isFolded: p.isFolded,
                isAllIn: p.isAllIn,
                currentBet: p.currentBet,
                totalBet: p.totalBet,
                seatIndex: p.seatIndex,
                stats: p.stats,
                lastAction: p.lastAction,
                isBot: false
            })),
            bots: Array.from(this.bots.values()).map(b => ({
                id: b.id,
                name: b.name,
                chips: b.chips,
                cards: [], // Karty botów zawsze ukryte
                isActive: b.isActive,
                isFolded: b.isFolded,
                isAllIn: b.isAllIn,
                currentBet: b.currentBet,
                totalBet: b.totalBet,
                seatIndex: b.seatIndex,
                stats: b.stats,
                lastAction: b.lastAction,
                isBot: true,
                personality: b.personality
            }))
        };
    }
    
    isGameActive() {
        return this.gameState.isActive;
    }
    
    getCurrentPhase() {
        return this.gameState.phase;
    }
    
    getLastActivity() {
        return this.stats.lastActivity;
    }
    
    updateLastActivity() {
        this.stats.lastActivity = Date.now();
    }
    
    // Logowanie
    log(message) {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] [Room:${this.name}] ${message}`);
    }
    
    logError(message, error = null) {
        const timestamp = new Date().toISOString();
        console.error(`[${timestamp}] [Room:${this.name} ERROR] ${message}`);
        if (error) {
            console.error(error);
        }
    }
}

module.exports = GameRoom;
