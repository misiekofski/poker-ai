// AI.js - Sztuczna inteligencja dla botów pokerowych

class PokerAI {
    constructor(player, aggressionLevel = 'normal') {
        this.player = player;
        this.aggressionLevel = aggressionLevel;
        this.handEvaluator = new HandEvaluator();
        
        // Osobowość bota
        this.personality = this.generatePersonality();
        
        // Historia przeciwników
        this.opponentModels = new Map();
        
        // Statystyki decyzji
        this.decisionHistory = [];
        
        logger.debug(`AI utworzone dla ${player.name} (agresja: ${aggressionLevel})`);
    }
    
    // Generuje osobowość bota
    generatePersonality() {
        return {
            bluffFrequency: Math.random() * 0.3, // 0-30% szans na bluff
            foldThreshold: 0.1 + Math.random() * 0.2, // 10-30% próg foldowania (bardziej agresywne)
            aggressionVariance: Math.random() * 0.2, // Zmienność agresji
            patternRecognition: Math.random() * 0.8, // Zdolność rozpoznawania wzorców
            riskTolerance: Math.random(), // Tolerancja ryzyka
            adaptability: Math.random() * 0.6 // Zdolność adaptacji
        };
    }
    
    // Główna metoda decyzyjna
    makeDecision(gameState) {
        try {
            // Analizuj sytuację
            const situation = this.analyzeSituation(gameState);
            
            // Oblicz prawdopodobieństwa różnych akcji
            const actionProbabilities = this.calculateActionProbabilities(situation);
            
            // Wybierz akcję na podstawie prawdopodobieństw i osobowości
            const decision = this.selectAction(actionProbabilities, situation);
            
            // Zapisz decyzję w historii
            this.recordDecision(decision, situation);
            
            // Aktualizuj modele przeciwników
            this.updateOpponentModels(gameState);
            
            logger.logAIAction(this.player.name, `${decision.type} ${decision.amount || ''}`, decision.reasoning);
            
            return decision;
            
        } catch (error) {
            logger.error(`Błąd AI dla ${this.player.name}: ${error.message}`);
            // Fallback - konserwatywna akcja
            return this.conservativeAction(gameState);
        }
    }
    
    // Analizuj aktualną sytuację gry
    analyzeSituation(gameState) {
        const situation = {
            // Karty i siła ręki
            handStrength: this.calculateHandStrength(gameState),
            potentialHandStrength: this.calculatePotentialHandStrength(gameState),
            nutsPotential: this.calculateNutsPotential(gameState),
            
            // Pozycja i kontekst
            position: this.calculatePosition(gameState),
            phase: gameState.phase,
            
            // Pula i zakłady
            potSize: gameState.pot,
            currentBet: gameState.currentBet,
            callAmount: gameState.currentBet - this.player.currentBet,
            potOdds: this.calculatePotOdds(gameState),
            impliedOdds: this.calculateImpliedOdds(gameState),
            
            // Przeciwnicy
            activePlayers: gameState.getActivePlayers().length,
            aggressiveOpponents: this.countAggressiveOpponents(gameState),
            opponentBehavior: this.analyzeOpponentBehavior(gameState),
            
            // Stack management
            stackSize: this.player.chips,
            stackRatio: this.player.chips / gameState.pot,
            commitmentLevel: this.player.totalBetThisRound / this.player.chips,
            
            // Informacje z poprzednich rund
            recentActions: this.getRecentActions(gameState),
            tableImage: this.calculateTableImage()
        };
        
        return situation;
    }
    
    // Oblicz siłę aktualnej ręki
    calculateHandStrength(gameState) {
        if (this.player.hand.length < 2) return 0;
        
        try {
            const handResult = this.handEvaluator.evaluateHand(
                this.player.hand, 
                gameState.communityCards
            );
            
            // Lepsza normalizacja siły ręki (0-1)
            let strength;
            if (handResult.ranking === 0) { // HIGH_CARD
                strength = 0.1;
            } else if (handResult.ranking === 1) { // PAIR
                strength = 0.25;
            } else if (handResult.ranking === 2) { // TWO_PAIR
                strength = 0.45;
            } else if (handResult.ranking === 3) { // THREE_OF_A_KIND
                strength = 0.65;
            } else if (handResult.ranking === 4) { // STRAIGHT
                strength = 0.75;
            } else if (handResult.ranking === 5) { // FLUSH
                strength = 0.8;
            } else if (handResult.ranking === 6) { // FULL_HOUSE
                strength = 0.9;
            } else if (handResult.ranking === 7) { // FOUR_OF_A_KIND
                strength = 0.95;
            } else if (handResult.ranking === 8) { // STRAIGHT_FLUSH
                strength = 0.98;
            } else if (handResult.ranking >= 9) { // ROYAL_FLUSH
                strength = 1.0;
            } else {
                strength = handResult.ranking / 10;
            }
            
            // Dostosuj względem liczby przeciwników
            const activePlayers = gameState.getActivePlayers().length;
            strength *= this.adjustForOpponentCount(strength, activePlayers);
            
            return Math.min(1, Math.max(0, strength));
            
        } catch (error) {
            logger.error(`Błąd oceny ręki dla ${this.player.name}: ${error.message}`);
            return 0;
        }
    }
    
    // Oblicz potencjał ręki (outs i prawdopodobieństwa poprawy)
    calculatePotentialHandStrength(gameState) {
        if (gameState.phase === 'river') {
            return this.calculateHandStrength(gameState);
        }
        
        const outs = this.calculateOuts(gameState);
        const cardsLeft = gameState.phase === 'flop' ? 2 : 1;
        
        // Przybliżona reguła: outs * 2 * liczba_kart_do_rozdania
        let improvementChance = (outs * 2 * cardsLeft) / 100;
        improvementChance = Math.min(1, improvementChance);
        
        const currentStrength = this.calculateHandStrength(gameState);
        const potentialStrength = currentStrength + (improvementChance * 0.3);
        
        return Math.min(1, potentialStrength);
    }
    
    // Oblicz szanse na najsilniejszy układ (nuts)
    calculateNutsPotential(gameState) {
        // Uproszczona implementacja
        const handStrength = this.calculateHandStrength(gameState);
        
        if (handStrength > 0.9) return 1; // Już mamy bardzo silną rękę
        if (handStrength > 0.7) return 0.3; // Dobra ręka z potencjałem
        if (handStrength > 0.5) return 0.1; // Średnia ręka
        
        return 0;
    }
    
    // Oblicz liczbę outs (kart poprawiających rękę)
    calculateOuts(gameState) {
        // Uproszczona kalkulacja - w pełnej implementacji należałoby
        // symulować wszystkie możliwe karty
        
        const handStrength = this.calculateHandStrength(gameState);
        const communityCards = gameState.communityCards.length;
        
        if (handStrength < 0.3) {
            // Słaba ręka - szukamy par, prostych, kolorów
            if (communityCards <= 3) return 8; // Więcej szans na poprawę
            return 4;
        } else if (handStrength < 0.6) {
            // Średnia ręka - szukamy poprawy
            return 6;
        } else {
            // Silna ręka - niewiele outs potrzebnych
            return 2;
        }
    }
    
    // Oblicz pot odds
    calculatePotOdds(gameState) {
        const callAmount = gameState.currentBet - this.player.currentBet;
        if (callAmount <= 0) return 0;
        
        return callAmount / (gameState.pot + callAmount);
    }
    
    // Oblicz implied odds (przyszłe zyski)
    calculateImpliedOdds(gameState) {
        const potOdds = this.calculatePotOdds(gameState);
        const potentialWinnings = this.estimatePotentialWinnings(gameState);
        
        return potOdds * (1 + potentialWinnings / gameState.pot);
    }
    
    // Oszacuj potencjalne przyszłe zyski
    estimatePotentialWinnings(gameState) {
        const activePlayers = gameState.getActivePlayers();
        let potentialWinnings = 0;
        
        for (const opponent of activePlayers) {
            if (opponent.id !== this.player.id) {
                // Oszacuj ile jeszcze może postawić przeciwnik
                const opponentModel = this.opponentModels.get(opponent.id);
                if (opponentModel) {
                    potentialWinnings += opponent.chips * opponentModel.callingness * 0.3;
                } else {
                    potentialWinnings += opponent.chips * 0.1; // Domyślne oszacowanie
                }
            }
        }
        
        return potentialWinnings;
    }
    
    // Oblicz pozycję przy stole
    calculatePosition(gameState) {
        const activePlayers = gameState.getActivePlayers();
        const playerIndex = activePlayers.findIndex(p => p.id === this.player.id);
        const dealerIndex = activePlayers.findIndex(p => p.isDealer);
        
        if (playerIndex === -1 || dealerIndex === -1) return 0.5;
        
        // Pozycja względem dealera (1 = dealer/button, 0 = pierwsza pozycja)
        const positionFromDealer = (playerIndex - dealerIndex + activePlayers.length) % activePlayers.length;
        return positionFromDealer / activePlayers.length;
    }
    
    // Dostosuj siłę ręki względem liczby przeciwników
    adjustForOpponentCount(strength, opponentCount) {
        // Im więcej przeciwników, tym silniejsza ręka jest potrzebna
        const adjustment = 1 - ((opponentCount - 2) * 0.1);
        return Math.max(0.5, adjustment);
    }
    
    // Policz agresywnych przeciwników
    countAggressiveOpponents(gameState) {
        let aggressiveCount = 0;
        
        for (const player of gameState.getActivePlayers()) {
            if (player.id === this.player.id) continue;
            
            const model = this.opponentModels.get(player.id);
            if (model && model.aggressionLevel > 0.6) {
                aggressiveCount++;
            }
        }
        
        return aggressiveCount;
    }
    
    // Analizuj zachowanie przeciwników
    analyzeOpponentBehavior(gameState) {
        const behavior = {
            totalAggression: 0,
            raiseFrequency: 0,
            foldFrequency: 0,
            bluffLikelihood: 0
        };
        
        let playerCount = 0;
        
        for (const player of gameState.getActivePlayers()) {
            if (player.id === this.player.id) continue;
            
            const model = this.opponentModels.get(player.id);
            if (model) {
                behavior.totalAggression += model.aggressionLevel;
                behavior.raiseFrequency += model.raiseFrequency;
                behavior.foldFrequency += model.foldFrequency;
                behavior.bluffLikelihood += model.bluffLikelihood;
                playerCount++;
            }
        }
        
        if (playerCount > 0) {
            behavior.totalAggression /= playerCount;
            behavior.raiseFrequency /= playerCount;
            behavior.foldFrequency /= playerCount;
            behavior.bluffLikelihood /= playerCount;
        }
        
        return behavior;
    }
    
    // Oblicz prawdopodobieństwa różnych akcji
    calculateActionProbabilities(situation) {
        const probabilities = {
            fold: 0,
            check: 0,
            call: 0,
            raise: 0,
            allIn: 0
        };
        
        // Bazowe prawdopodobieństwa w zależności od siły ręki
        if (situation.handStrength < this.personality.foldThreshold) {
            probabilities.fold = 0.6; // Zmniejszone z 0.8
            probabilities.call = 0.25; // Zwiększone z 0.15
            probabilities.check = 0.15; // Zwiększone z 0.05
        } else if (situation.handStrength < 0.4) {
            probabilities.fold = 0.2; // Zmniejszone z 0.3
            probabilities.call = 0.5;
            probabilities.check = 0.15;
            probabilities.raise = 0.15; // Zwiększone z 0.05
        } else if (situation.handStrength < 0.7) {
            probabilities.fold = 0.05; // Zmniejszone z 0.1
            probabilities.call = 0.35; // Zmniejszone z 0.4
            probabilities.check = 0.15; // Zmniejszone z 0.2
            probabilities.raise = 0.45; // Zwiększone z 0.3
        } else {
            probabilities.fold = 0.02; // Zmniejszone z 0.05
            probabilities.call = 0.18; // Zmniejszone z 0.25
            probabilities.check = 0.05; // Zmniejszone z 0.1
            probabilities.raise = 0.6; // Zwiększone z 0.5
            probabilities.allIn = 0.15; // Zwiększone z 0.1
        }
        
        // Dostosowania na podstawie pot odds
        if (situation.potOdds > 0) {
            const oddsRatio = situation.handStrength / situation.potOdds;
            if (oddsRatio > 1.5) {
                // Dobre pot odds - zwiększ prawdopodobieństwo call/raise
                probabilities.call *= 1.5;
                probabilities.raise *= 1.3;
                probabilities.fold *= 0.5;
            } else if (oddsRatio < 0.7) {
                // Złe pot odds - zwiększ prawdopodobieństwo fold
                probabilities.fold *= 1.5;
                probabilities.call *= 0.7;
                probabilities.raise *= 0.5;
            }
        }
        
        // Dostosowania na podstawie pozycji
        if (situation.position > 0.7) {
            // Późna pozycja - więcej agresji
            probabilities.raise *= 1.2;
            probabilities.call *= 1.1;
        } else if (situation.position < 0.3) {
            // Wczesna pozycja - mniej agresji
            probabilities.raise *= 0.8;
            probabilities.fold *= 1.1;
        }
        
        // Dostosowania na podstawie agresji przeciwników
        if (situation.aggressiveOpponents > 1) {
            // Dużo agresywnych przeciwników - bądź ostrożny
            probabilities.fold *= 1.2;
            probabilities.raise *= 0.8;
        }
        
        // Dostosowania na podstawie wielkości stacka
        if (situation.stackRatio < 0.2) {
            // Mały stack - więcej all-in
            probabilities.allIn *= 2;
            probabilities.raise *= 0.5;
        }
        
        // Dodaj element losowości i bluffu
        if (Math.random() < this.personality.bluffFrequency) {
            // Bluff - podnieś agresję mimo słabej ręki
            probabilities.raise *= 2;
            probabilities.allIn *= 1.5;
            probabilities.fold *= 0.3;
        }
        
        // Normalizuj prawdopodobieństwa
        const total = Object.values(probabilities).reduce((sum, prob) => sum + prob, 0);
        if (total > 0) {
            Object.keys(probabilities).forEach(action => {
                probabilities[action] /= total;
            });
        }
        
        return probabilities;
    }
    
    // Wybierz akcję na podstawie prawdopodobieństw
    selectAction(probabilities, situation) {
        // Usuń niedostępne akcje
        const availableActions = this.filterAvailableActions(probabilities, situation);
        
        // Wybierz akcję metodą ruletki
        const selectedAction = this.weightedRandomSelection(availableActions);
        
        // Oblicz kwotę dla raise
        let amount = 0;
        if (selectedAction === 'raise') {
            amount = this.calculateRaiseAmount(situation);
            
            // Fallback: jeśli kwota nie jest prawidłowa, użyj minimum
            const minRaise = situation.currentBet + 20;
            if (amount < minRaise) {
                amount = minRaise;
                logger.warn(`AI ${this.player.name}: skorygowano kwotę raise z ${this.calculateRaiseAmount(situation)} na ${amount}`);
            }
            
            // Sprawdź czy gracz ma wystarczająco żetonów
            const maxPossibleBet = this.player.chips + this.player.currentBet;
            if (amount > maxPossibleBet) {
                // Zmień na all-in
                selectedAction = 'allIn';
                amount = this.player.chips;
                logger.debug(`AI ${this.player.name}: zmiana raise na all-in (brak wystarczających żetonów)`);
            }
        } else if (selectedAction === 'call') {
            amount = situation.callAmount;
        } else if (selectedAction === 'allIn') {
            amount = this.player.chips;
        }
        
        return {
            type: selectedAction,
            amount: amount,
            confidence: availableActions[selectedAction],
            reasoning: this.generateReasoning(selectedAction, situation)
        };
    }
    
    // Filtruj dostępne akcje
    filterAvailableActions(probabilities, situation) {
        const available = {};
        
        // Fold zawsze dostępne
        available.fold = probabilities.fold;
        
        // Check tylko jeśli brak zakładu do wyrównania
        if (situation.callAmount === 0) {
            available.check = probabilities.check;
        }
        
        // Call tylko jeśli jest zakład do wyrównania i mamy wystarczająco żetonów
        if (situation.callAmount > 0 && this.player.chips >= situation.callAmount) {
            available.call = probabilities.call;
        }
        
        // Raise tylko jeśli mamy wystarczająco żetonów
        const minRaise = situation.currentBet + 20; // Minimalny raise
        if (this.player.chips > situation.callAmount && 
            this.player.chips >= minRaise) {
            available.raise = probabilities.raise;
        }
        
        // All-in tylko jeśli mamy żetony
        if (this.player.chips > 0) {
            available.allIn = probabilities.allIn;
        }
        
        return available;
    }
    
    // Wybór ważony losowo
    weightedRandomSelection(probabilities) {
        const rand = Math.random();
        let cumulative = 0;
        
        for (const [action, probability] of Object.entries(probabilities)) {
            cumulative += probability;
            if (rand <= cumulative) {
                return action;
            }
        }
        
        // Fallback
        return Object.keys(probabilities)[0] || 'fold';
    }
    
    // Oblicz kwotę podniesienia
    calculateRaiseAmount(situation) {
        const minRaise = situation.currentBet + 20; // Minimum raise amount (total bet)
        const baseRaise = situation.currentBet + 20;
        const potSizeRaise = situation.currentBet + (situation.potSize * 0.5);
        const aggressionRaise = situation.currentBet + (situation.potSize * this.personality.aggression);
        
        // Wybierz na podstawie sytuacji i osobowości
        let raiseAmount;
        
        if (situation.handStrength > 0.8) {
            // Bardzo silna ręka - wartościowe podniesienie
            raiseAmount = Math.max(potSizeRaise, baseRaise);
        } else if (situation.handStrength > 0.6) {
            // Dobra ręka - umiarkowane podniesienie
            raiseAmount = Math.max(baseRaise, potSizeRaise * 0.7);
        } else {
            // Bluff lub semi-bluff
            raiseAmount = Math.max(baseRaise, aggressionRaise);
        }
        
        // Upewnij się że nie jest mniejsze niż minimum
        raiseAmount = Math.max(raiseAmount, minRaise);
        
        // Ogranicz do dostępnych żetonów (total bet nie może przekroczyć chips + currentBet)
        const maxPossibleBet = this.player.chips + this.player.currentBet;
        raiseAmount = Math.min(raiseAmount, maxPossibleBet);
        
        // Zaokrąglij do wielokrotności 10
        return Math.round(raiseAmount / 10) * 10;
    }
    
    // Generuj uzasadnienie decyzji
    generateReasoning(action, situation) {
        const handStrength = situation.handStrength;
        const potOdds = situation.potOdds;
        
        switch (action) {
            case 'fold':
                if (handStrength < 0.3) return 'Słaba ręka';
                if (potOdds > handStrength * 1.5) return 'Złe pot odds';
                return 'Ostrożna gra';
                
            case 'check':
                return 'Kontrola puli';
                
            case 'call':
                if (potOdds < handStrength) return 'Dobre pot odds';
                return 'Pasywna gra';
                
            case 'raise':
                if (handStrength > 0.7) return 'Silna ręka';
                if (Math.random() < this.personality.bluffFrequency) return 'Bluff';
                return 'Agresywna gra';
                
            case 'allIn':
                if (handStrength > 0.8) return 'Bardzo silna ręka';
                return 'Desperacka gra';
                
            default:
                return 'Nieznany powód';
        }
    }
    
    // Konserwatywna akcja (fallback)
    conservativeAction(gameState) {
        const callAmount = gameState.currentBet - this.player.currentBet;
        
        if (callAmount === 0) {
            return { type: 'check', amount: 0 };
        } else if (callAmount <= this.player.chips * 0.1) {
            return { type: 'call', amount: callAmount };
        } else {
            return { type: 'fold', amount: 0 };
        }
    }
    
    // Zapisz decyzję w historii
    recordDecision(decision, situation) {
        this.decisionHistory.push({
            decision,
            situation: {
                handStrength: situation.handStrength,
                potOdds: situation.potOdds,
                position: situation.position,
                phase: situation.phase
            },
            timestamp: Date.now()
        });
        
        // Ogranicz historię do ostatnich 50 decyzji
        if (this.decisionHistory.length > 50) {
            this.decisionHistory = this.decisionHistory.slice(-50);
        }
    }
    
    // Aktualizuj modele przeciwników
    updateOpponentModels(gameState) {
        for (const player of gameState.players) {
            if (player.id === this.player.id) continue;
            
            if (!this.opponentModels.has(player.id)) {
                this.opponentModels.set(player.id, this.createOpponentModel(player));
            }
            
            const model = this.opponentModels.get(player.id);
            this.updateOpponentModel(model, player, gameState);
        }
    }
    
    // Utwórz model przeciwnika
    createOpponentModel(player) {
        return {
            playerId: player.id,
            name: player.name,
            aggressionLevel: 0.5,
            raiseFrequency: 0.2,
            foldFrequency: 0.4,
            callingness: 0.5,
            bluffLikelihood: 0.1,
            observationCount: 0,
            lastActions: []
        };
    }
    
    // Aktualizuj model przeciwnika
    updateOpponentModel(model, player, gameState) {
        // Dodaj ostatnią akcję do historii
        if (player.actionHistory.length > 0) {
            const lastAction = player.actionHistory[player.actionHistory.length - 1];
            model.lastActions.push(lastAction);
            
            // Ogranicz historię
            if (model.lastActions.length > 20) {
                model.lastActions = model.lastActions.slice(-20);
            }
            
            // Aktualizuj statystyki
            this.updateModelStatistics(model);
        }
        
        model.observationCount++;
    }
    
    // Aktualizuj statystyki modelu
    updateModelStatistics(model) {
        if (model.lastActions.length === 0) return;
        
        const actions = model.lastActions;
        const actionCounts = {
            fold: 0,
            check: 0,
            call: 0,
            raise: 0,
            allIn: 0
        };
        
        // Policz akcje
        for (const action of actions) {
            if (actionCounts[action.action] !== undefined) {
                actionCounts[action.action]++;
            }
        }
        
        const totalActions = actions.length;
        
        // Aktualizuj częstotliwości
        model.foldFrequency = actionCounts.fold / totalActions;
        model.raiseFrequency = (actionCounts.raise + actionCounts.allIn) / totalActions;
        model.callingness = (actionCounts.call + actionCounts.check) / totalActions;
        
        // Szacuj poziom agresji
        model.aggressionLevel = (actionCounts.raise * 2 + actionCounts.allIn * 3) / (totalActions * 2);
        
        // Szacuj prawdopodobieństwo bluffu (uproszczone)
        model.bluffLikelihood = Math.min(0.3, model.raiseFrequency * 0.5);
    }
    
    // Pobierz ostatnie akcje
    getRecentActions(gameState) {
        return gameState.roundHistory.slice(-10); // Ostatnie 10 akcji
    }
    
    // Oblicz wizerunek przy stole
    calculateTableImage() {
        if (this.decisionHistory.length < 5) return 0.5; // Neutralny
        
        const recentDecisions = this.decisionHistory.slice(-10);
        let aggressionScore = 0;
        
        for (const record of recentDecisions) {
            switch (record.decision.action) {
                case 'raise':
                    aggressionScore += 2;
                    break;
                case 'allIn':
                    aggressionScore += 3;
                    break;
                case 'call':
                    aggressionScore += 1;
                    break;
                case 'fold':
                    aggressionScore -= 1;
                    break;
            }
        }
        
        // Normalizuj do zakresu 0-1
        return Math.max(0, Math.min(1, (aggressionScore + 10) / 20));
    }
    
    // Dostosuj agresję na podstawie doświadczenia
    adaptAggression() {
        if (this.decisionHistory.length < 20) return;
        
        const recentResults = this.decisionHistory.slice(-20);
        let successRate = 0;
        
        // Uproszczona ocena sukcesu - w rzeczywistości należałoby śledzić wyniki
        for (const record of recentResults) {
            if (record.decision.action === 'raise' || record.decision.action === 'allIn') {
                // Założmy że agresywne akcje czasem się opłacają
                successRate += Math.random() < 0.4 ? 1 : 0;
            }
        }
        
        successRate /= recentResults.length;
        
        // Dostosuj agresję
        if (successRate > 0.6) {
            this.aggressionLevel = Math.min(0.9, this.aggressionLevel + 0.1);
        } else if (successRate < 0.3) {
            this.aggressionLevel = Math.max(0.1, this.aggressionLevel - 0.1);
        }
        
        // Aktualizuj osobowość
        this.personality.bluffFrequency = Math.max(0, Math.min(0.3, 
            this.personality.bluffFrequency + (successRate - 0.5) * 0.1
        ));
    }
}

// Eksport dla Node.js lub przeglądarki
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PokerAI;
} else if (typeof window !== 'undefined') {
    window.PokerAI = PokerAI;
}
