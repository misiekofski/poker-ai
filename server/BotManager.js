// BotManager.js - Zarządzanie botami AI

const { GameConstants, PokerUtils } = require('../public/js/shared/Constants');
const Constants = GameConstants;

class BotManager {
    constructor() {
        // Lista dostępnych nazw botów
        this.botNames = [
            'AlphaBot', 'BetaMind', 'GammaAI', 'DeltaChip', 'EpsilonCard',
            'ZetaBluff', 'EtaFold', 'ThetaCall', 'IotaRaise', 'KappaAll',
            'LambdaTight', 'MuLoose', 'NuAggressive', 'XiPassive', 'OmicronSmart',
            'PiRandom', 'RhoCalculated', 'SigmaStrong', 'TauWeak', 'UpsilonMedium'
        ];
        
        // Osobowości botów
        this.personalities = {
            TIGHT_AGGRESSIVE: {
                name: 'Tight-Aggressive',
                vpip: 0.15,      // 15% rąk
                pfr: 0.12,       // 12% pre-flop raise
                aggression: 3.5,  // Wysoka agresywność
                bluffFreq: 0.1,   // 10% blefów
                foldToPressure: 0.3
            },
            LOOSE_AGGRESSIVE: {
                name: 'Loose-Aggressive',
                vpip: 0.35,      // 35% rąk
                pfr: 0.25,       // 25% pre-flop raise
                aggression: 4.0,  // Bardzo wysoka agresywność
                bluffFreq: 0.25,  // 25% blefów
                foldToPressure: 0.2
            },
            TIGHT_PASSIVE: {
                name: 'Tight-Passive',
                vpip: 0.12,      // 12% rąk
                pfr: 0.05,       // 5% pre-flop raise
                aggression: 1.5,  // Niska agresywność
                bluffFreq: 0.02,  // 2% blefów
                foldToPressure: 0.6
            },
            LOOSE_PASSIVE: {
                name: 'Loose-Passive',
                vpip: 0.40,      // 40% rąk
                pfr: 0.10,       // 10% pre-flop raise
                aggression: 1.8,  // Niska agresywność
                bluffFreq: 0.05,  // 5% blefów
                foldToPressure: 0.4
            },
            MANIAC: {
                name: 'Maniac',
                vpip: 0.60,      // 60% rąk
                pfr: 0.45,       // 45% pre-flop raise
                aggression: 5.0,  // Maksymalna agresywność
                bluffFreq: 0.40,  // 40% blefów
                foldToPressure: 0.1
            },
            ROCK: {
                name: 'Rock',
                vpip: 0.08,      // 8% rąk
                pfr: 0.06,       // 6% pre-flop raise
                aggression: 1.2,  // Bardzo niska agresywność
                bluffFreq: 0.01,  // 1% blefów
                foldToPressure: 0.8
            }
        };
        
        this.usedNames = new Set();
        this.createdBots = new Map();
    }
    
    // Utwórz nowego bota
    createBot(seatIndex) {
        const botId = `bot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const name = this.getRandomBotName();
        const personality = this.getRandomPersonality();
        
        const bot = {
            id: botId,
            name: name,
            chips: 2000, // Standardowa ilość żetonów
            cards: [],
            isActive: true,
            isFolded: false,
            isAllIn: false,
            currentBet: 0,
            totalBet: 0,
            seatIndex: seatIndex,
            isBot: true,
            
            // Osobowość i AI
            personality: personality,
            
            // Statystyki
            stats: {
                handsPlayed: 0,
                handsWon: 0,
                totalWinnings: 0,
                biggestWin: 0,
                vpip: 0,
                pfr: 0,
                aggression: 0,
                decisionsTracked: 0
            },
            
            // Historia i uczenie się
            history: {
                actions: [],
                opponentModeling: new Map(), // playerId -> traits
                recentResults: [],
                adaptationLevel: 0
            },
            
            // Czasowe stany
            lastAction: null,
            lastHandStrength: 0,
            currentMood: 'normal', // normal, tilted, confident
            joinTime: Date.now()
        };
        
        this.createdBots.set(botId, bot);
        this.log(`🤖 Utworzono bota: ${name} (${personality.name})`);
        
        return bot;
    }
    
    // Podejmij decyzję za bota
    makeDecision(bot, gameState, communityCards, opponents) {
        try {
            // Oceń siłę ręki
            const handStrength = this.evaluateHandStrength(bot.cards, communityCards);
            bot.lastHandStrength = handStrength;
            
            // Analizuj sytuację
            const situation = this.analyzeSituation(bot, gameState, opponents);
            
            // Podejmij decyzję bazując na osobowości i sytuacji
            const decision = this.calculateDecision(bot, handStrength, situation, gameState);
            
            // Zapisz akcję w historii
            this.recordAction(bot, decision, handStrength, situation);
            
            // Aktualizuj nastrój
            this.updateMood(bot, decision, situation);
            
            return decision;
            
        } catch (error) {
            this.logError(`Błąd podejmowania decyzji dla ${bot.name}:`, error);
            
            // Fallback do prostej strategii
            return this.makeFallbackDecision(bot, gameState);
        }
    }
    
    // Oceń siłę ręki (0-1)
    evaluateHandStrength(holeCards, communityCards) {
        if (holeCards.length !== 2) return 0;
        
        const card1 = holeCards[0];
        const card2 = holeCards[1];
        
        // Pre-flop evaluation
        if (communityCards.length === 0) {
            return this.evaluatePreflop(card1, card2);
        }
        
        // Post-flop evaluation (uproszczona)
        const allCards = [...holeCards, ...communityCards];
        return this.evaluatePostflop(allCards);
    }
    
    // Oceń pre-flop
    evaluatePreflop(card1, card2) {
        const value1 = this.getCardValue(card1.value);
        const value2 = this.getCardValue(card2.value);
        const suited = card1.suit === card2.suit;
        const pair = value1 === value2;
        const connected = Math.abs(value1 - value2) === 1;
        const gap = Math.abs(value1 - value2);
        
        let strength = 0;
        
        // Pary
        if (pair) {
            if (value1 >= 14) strength = 0.95; // AA
            else if (value1 >= 13) strength = 0.90; // KK
            else if (value1 >= 12) strength = 0.85; // QQ
            else if (value1 >= 11) strength = 0.80; // JJ
            else if (value1 >= 10) strength = 0.75; // TT
            else if (value1 >= 8) strength = 0.65; // 88-99
            else strength = 0.45; // Małe pary
        }
        // Wysokie karty
        else if (value1 >= 14 || value2 >= 14) {
            strength = 0.70; // Ace
            if ((value1 >= 13 && value2 >= 13) || (value1 >= 12 && value2 >= 12)) {
                strength = 0.80; // AK, AQ
            }
        }
        else if (value1 >= 13 && value2 >= 13) {
            strength = 0.75; // KQ
        }
        else if (value1 >= 12 && value2 >= 10) {
            strength = 0.60; // Broadway cards
        }
        // Średnie karty
        else if (value1 >= 9 || value2 >= 9) {
            strength = 0.35;
        }
        // Niskie karty
        else {
            strength = 0.15;
        }
        
        // Bonusy
        if (suited) strength += 0.05;
        if (connected) strength += 0.03;
        if (gap === 2) strength += 0.01;
        
        return Math.min(strength, 1.0);
    }
    
    // Oceń post-flop (uproszczona wersja)
    evaluatePostflop(allCards) {
        // Tu byłaby pełna ocena ręki
        // Na razie uproszczona wersja
        
        const holeCards = allCards.slice(0, 2);
        const board = allCards.slice(2);
        
        // Sprawdź podstawowe kombinacje
        const hasFlush = this.hasFlushDraw(holeCards, board);
        const hasStraight = this.hasStraightDraw(holeCards, board);
        const hasPair = this.hasPair(holeCards, board);
        const hasOvercards = this.hasOvercards(holeCards, board);
        
        let strength = 0.1; // Bazowa wartość
        
        if (hasFlush) strength += 0.3;
        if (hasStraight) strength += 0.25;
        if (hasPair) strength += 0.4;
        if (hasOvercards) strength += 0.15;
        
        return Math.min(strength, 1.0);
    }
    
    // Analizuj sytuację przy stole
    analyzeSituation(bot, gameState, opponents) {
        const situation = {
            position: this.getPosition(bot.seatIndex, gameState.dealerPosition, opponents.length),
            potOdds: this.calculatePotOdds(gameState, bot),
            aggression: this.analyzeTableAggression(opponents),
            playersInHand: opponents.filter(p => !p.isFolded).length,
            stackSizes: this.analyzeStackSizes(opponents),
            phase: gameState.phase,
            betSizing: this.analyzeBetSizing(gameState, opponents)
        };
        
        return situation;
    }
    
    // Oblicz decyzję
    calculateDecision(bot, handStrength, situation, gameState) {
        const personality = bot.personality;
        const callAmount = gameState.currentBet - bot.currentBet;
        
        // Bazowe prawdopodobieństwa akcji
        let foldProb = 0;
        let callProb = 0;
        let raiseProb = 0;
        
        // Modyfikuj na podstawie siły ręki
        if (handStrength < 0.2) {
            foldProb = 0.8;
            callProb = 0.15;
            raiseProb = 0.05;
        } else if (handStrength < 0.4) {
            foldProb = 0.4;
            callProb = 0.5;
            raiseProb = 0.1;
        } else if (handStrength < 0.7) {
            foldProb = 0.1;
            callProb = 0.6;
            raiseProb = 0.3;
        } else {
            foldProb = 0.05;
            callProb = 0.3;
            raiseProb = 0.65;
        }
        
        // Modyfikuj na podstawie osobowości
        foldProb *= personality.foldToPressure;
        raiseProb *= (personality.aggression / 3.0);
        
        // Modyfikuj na podstawie pot odds
        if (situation.potOdds > 3.0) {
            callProb *= 1.5;
            foldProb *= 0.5;
        }
        
        // Modyfikuj na podstawie pozycji
        if (situation.position === 'early') {
            raiseProb *= 0.7;
            foldProb *= 1.2;
        } else if (situation.position === 'late') {
            raiseProb *= 1.3;
            foldProb *= 0.8;
        }
        
        // Normalizuj prawdopodobieństwa
        const total = foldProb + callProb + raiseProb;
        foldProb /= total;
        callProb /= total;
        raiseProb /= total;
        
        // Wybierz akcję
        const random = Math.random();
        let action, amount = 0;
        
        if (callAmount === 0) {
            // Sprawdź lub podnieś
            if (random < raiseProb) {
                action = Constants.ACTIONS.RAISE;
                amount = this.calculateRaiseSize(bot, gameState, situation);
            } else {
                action = Constants.ACTIONS.CHECK;
            }
        } else {
            // Spasuj, dopłać lub podnieś
            if (random < foldProb) {
                action = Constants.ACTIONS.FOLD;
            } else if (random < foldProb + callProb) {
                action = Constants.ACTIONS.CALL;
                amount = Math.min(callAmount, bot.chips);
            } else {
                action = Constants.ACTIONS.RAISE;
                amount = this.calculateRaiseSize(bot, gameState, situation);
            }
        }
        
        // Sprawdź all-in
        if (action === Constants.ACTIONS.RAISE && amount >= bot.chips) {
            action = Constants.ACTIONS.ALL_IN;
            amount = bot.chips + bot.currentBet;
        }
        
        return { action, amount };
    }
    
    // Oblicz rozmiar podbicia
    calculateRaiseSize(bot, gameState, situation) {
        const personality = bot.personality;
        const minRaise = gameState.currentBet + gameState.lastRaise;
        const maxRaise = bot.chips + bot.currentBet;
        
        // Bazowy rozmiar (2.5-4x big blind)
        let multiplier = 2.5 + (personality.aggression * 0.5);
        
        // Modyfikuj na podstawie fazy gry
        if (gameState.phase === Constants.GAME_PHASES.PREFLOP) {
            multiplier *= 1.2;
        } else if (gameState.phase === Constants.GAME_PHASES.RIVER) {
            multiplier *= 0.8;
        }
        
        // Modyfikuj na podstawie pozycji
        if (situation.position === 'early') {
            multiplier *= 1.1;
        } else if (situation.position === 'late') {
            multiplier *= 0.9;
        }
        
        let raiseSize = Math.floor(gameState.currentBet * multiplier);
        
        // Ograniczenia
        raiseSize = Math.max(raiseSize, minRaise);
        raiseSize = Math.min(raiseSize, maxRaise);
        
        return raiseSize;
    }
    
    // Zapisz akcję w historii
    recordAction(bot, decision, handStrength, situation) {
        const action = {
            timestamp: Date.now(),
            decision: decision,
            handStrength: handStrength,
            situation: situation,
            phase: situation.phase
        };
        
        bot.history.actions.push(action);
        
        // Ogranicz historię do ostatnich 100 akcji
        if (bot.history.actions.length > 100) {
            bot.history.actions.shift();
        }
        
        bot.stats.decisionsTracked++;
    }
    
    // Aktualizuj nastrój bota
    updateMood(bot, decision, situation) {
        // Proste zarządzanie nastrojem
        if (decision.action === Constants.ACTIONS.FOLD && bot.lastHandStrength > 0.6) {
            bot.currentMood = 'tilted';
        } else if (decision.action === Constants.ACTIONS.RAISE && bot.lastHandStrength > 0.8) {
            bot.currentMood = 'confident';
        } else {
            bot.currentMood = 'normal';
        }
    }
    
    // Fallback decision
    makeFallbackDecision(bot, gameState) {
        const callAmount = gameState.currentBet - bot.currentBet;
        
        if (callAmount === 0) {
            return { action: Constants.ACTIONS.CHECK, amount: 0 };
        } else if (callAmount > bot.chips * 0.5) {
            return { action: Constants.ACTIONS.FOLD, amount: 0 };
        } else {
            return { action: Constants.ACTIONS.CALL, amount: Math.min(callAmount, bot.chips) };
        }
    }
    
    // Pomocnicze metody
    
    getRandomBotName() {
        const availableNames = this.botNames.filter(name => !this.usedNames.has(name));
        
        if (availableNames.length === 0) {
            // Reset jeśli wszystkie nazwy zostały użyte
            this.usedNames.clear();
            return this.botNames[Math.floor(Math.random() * this.botNames.length)];
        }
        
        const name = availableNames[Math.floor(Math.random() * availableNames.length)];
        this.usedNames.add(name);
        return name;
    }
    
    getRandomPersonality() {
        const personalities = Object.values(this.personalities);
        return personalities[Math.floor(Math.random() * personalities.length)];
    }
    
    getCardValue(value) {
        const valueMap = {
            '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
            'T': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14
        };
        return valueMap[value] || 0;
    }
    
    getPosition(seatIndex, dealerPosition, totalPlayers) {
        const relativePosition = (seatIndex - dealerPosition + totalPlayers) % totalPlayers;
        
        if (totalPlayers <= 3) {
            return relativePosition === 0 ? 'late' : 'early';
        } else if (totalPlayers <= 6) {
            if (relativePosition <= 2) return 'early';
            if (relativePosition <= 4) return 'middle';
            return 'late';
        } else {
            if (relativePosition <= 3) return 'early';
            if (relativePosition <= 6) return 'middle';
            return 'late';
        }
    }
    
    calculatePotOdds(gameState, bot) {
        const callAmount = gameState.currentBet - bot.currentBet;
        if (callAmount === 0) return Infinity;
        return (gameState.pot + callAmount) / callAmount;
    }
    
    analyzeTableAggression(opponents) {
        let totalAggression = 0;
        let count = 0;
        
        for (const opponent of opponents) {
            if (opponent.stats && opponent.stats.aggression) {
                totalAggression += opponent.stats.aggression;
                count++;
            }
        }
        
        return count > 0 ? totalAggression / count : 2.0;
    }
    
    analyzeStackSizes(opponents) {
        const stacks = opponents.map(p => p.chips).sort((a, b) => b - a);
        return {
            largest: stacks[0] || 0,
            smallest: stacks[stacks.length - 1] || 0,
            average: stacks.reduce((sum, stack) => sum + stack, 0) / stacks.length || 0
        };
    }
    
    analyzeBetSizing(gameState, opponents) {
        return {
            currentBet: gameState.currentBet,
            potSize: gameState.pot,
            betToPotRatio: gameState.currentBet / Math.max(gameState.pot, 1)
        };
    }
    
    hasFlushDraw(holeCards, board) {
        // Uproszczona implementacja
        const suits = [...holeCards, ...board].map(card => card.suit);
        const suitCounts = {};
        
        for (const suit of suits) {
            suitCounts[suit] = (suitCounts[suit] || 0) + 1;
        }
        
        return Object.values(suitCounts).some(count => count >= 4);
    }
    
    hasStraightDraw(holeCards, board) {
        // Uproszczona implementacja
        const values = [...holeCards, ...board]
            .map(card => this.getCardValue(card.value))
            .sort((a, b) => a - b);
        
        for (let i = 0; i < values.length - 3; i++) {
            let consecutive = 1;
            for (let j = i + 1; j < values.length; j++) {
                if (values[j] === values[j-1] + 1) {
                    consecutive++;
                    if (consecutive >= 4) return true;
                } else if (values[j] !== values[j-1]) {
                    break;
                }
            }
        }
        
        return false;
    }
    
    hasPair(holeCards, board) {
        const allCards = [...holeCards, ...board];
        const values = allCards.map(card => card.value);
        const valueCounts = {};
        
        for (const value of values) {
            valueCounts[value] = (valueCounts[value] || 0) + 1;
        }
        
        return Object.values(valueCounts).some(count => count >= 2);
    }
    
    hasOvercards(holeCards, board) {
        if (board.length === 0) return false;
        
        const boardValues = board.map(card => this.getCardValue(card.value));
        const maxBoardValue = Math.max(...boardValues);
        
        return holeCards.some(card => this.getCardValue(card.value) > maxBoardValue);
    }
    
    // API publiczne
    
    getBotStats(botId) {
        const bot = this.createdBots.get(botId);
        return bot ? bot.stats : null;
    }
    
    updateBotStats(botId, result) {
        const bot = this.createdBots.get(botId);
        if (!bot) return;
        
        if (result.won) {
            bot.stats.handsWon++;
            bot.stats.totalWinnings += result.amount;
            
            if (result.amount > bot.stats.biggestWin) {
                bot.stats.biggestWin = result.amount;
            }
        }
        
        // Aktualizuj inne statystyki
        this.updateAdvancedStats(bot, result);
    }
    
    updateAdvancedStats(bot, result) {
        // VPIP, PFR, Aggression itp.
        const recentActions = bot.history.actions.slice(-20); // Ostatnie 20 akcji
        
        if (recentActions.length > 0) {
            // Oblicz VPIP
            const voluntaryActions = recentActions.filter(a => 
                a.decision.action !== Constants.ACTIONS.FOLD || a.situation.phase !== Constants.GAME_PHASES.PREFLOP
            );
            bot.stats.vpip = voluntaryActions.length / recentActions.length;
            
            // Oblicz PFR
            const preflopRaises = recentActions.filter(a => 
                a.situation.phase === Constants.GAME_PHASES.PREFLOP && 
                a.decision.action === Constants.ACTIONS.RAISE
            );
            const preflopActions = recentActions.filter(a => 
                a.situation.phase === Constants.GAME_PHASES.PREFLOP
            );
            bot.stats.pfr = preflopActions.length > 0 ? preflopRaises.length / preflopActions.length : 0;
            
            // Oblicz agresywność
            const aggressiveActions = recentActions.filter(a => 
                a.decision.action === Constants.ACTIONS.RAISE || a.decision.action === Constants.ACTIONS.ALL_IN
            );
            const passiveActions = recentActions.filter(a => 
                a.decision.action === Constants.ACTIONS.CALL || a.decision.action === Constants.ACTIONS.CHECK
            );
            
            if (passiveActions.length > 0) {
                bot.stats.aggression = aggressiveActions.length / passiveActions.length;
            }
        }
    }
    
    removeBot(botId) {
        const bot = this.createdBots.get(botId);
        if (bot) {
            this.usedNames.delete(bot.name);
            this.createdBots.delete(botId);
            this.log(`🤖❌ Usunięto bota: ${bot.name}`);
            return true;
        }
        return false;
    }
    
    // Logowanie
    log(message) {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] [BotManager] ${message}`);
    }
    
    logError(message, error = null) {
        const timestamp = new Date().toISOString();
        console.error(`[${timestamp}] [BotManager ERROR] ${message}`);
        if (error) {
            console.error(error);
        }
    }
}

module.exports = BotManager;
