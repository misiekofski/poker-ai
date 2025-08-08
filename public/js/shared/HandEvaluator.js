// HandEvaluator.js - Klasa do oceny układów pokerowych

class HandEvaluator {
    constructor() {
        // Cache dla już obliczonych układów (optymalizacja)
        this.cache = new Map();
    }
    
    // Główna metoda oceny układu - zwraca obiekt z informacjami o układzie
    evaluateHand(playerCards, communityCards) {
        // Walidacja wejścia
        if (!playerCards || !Array.isArray(playerCards)) {
            logger.warn('playerCards nie jest tablicą:', playerCards);
            return this.getDefaultHand();
        }
        
        if (!communityCards || !Array.isArray(communityCards)) {
            logger.warn('communityCards nie jest tablicą:', communityCards);
            communityCards = [];
        }
        
        const allCards = [...playerCards, ...communityCards];
        
        // Sprawdź czy mamy wystarczająco kart
        if (allCards.length < 5) {
            logger.debug(`Pre-flop ocena: ${allCards.length} kart dostępnych`);
            // W pre-flop zwracaj siłę kart gracza
            return this.evaluatePreFlop(playerCards);
        }
        
        // Sprawdź cache
        const cacheKey = this.getHandCacheKey(allCards);
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }
        
        // Znajdź najlepszy układ z 5 kart
        const bestHand = this.findBestFiveCardHand(allCards);
        
        // Zapisz w cache
        this.cache.set(cacheKey, bestHand);
        
        return bestHand;
    }
    
    // Oceń siłę kart w pre-flop (tylko karty gracza)
    evaluatePreFlop(playerCards) {
        if (!playerCards || playerCards.length !== 2) {
            return this.getDefaultHand();
        }
        
        const [card1, card2] = playerCards;
        let ranking = 1; // Starting strength
        let name = 'Hole cards';
        
        // Para pocket
        if (card1.value === card2.value) {
            ranking = Math.min(5 + (card1.value - 2) * 0.3, 8); // Para: 5-8 ranking
            name = `Para ${card1.getRankName()}`;
        }
        // Suited cards
        else if (card1.suit === card2.suit) {
            ranking = 2 + Math.max(card1.value, card2.value) * 0.1;
            name = 'Suited cards';
        }
        // High cards
        else {
            const highCard = Math.max(card1.value, card2.value);
            ranking = 1 + highCard * 0.1;
            name = 'High cards';
        }
        
        return {
            ranking: Math.min(ranking, 10),
            name: name,
            cards: playerCards,
            values: [Math.max(card1.value, card2.value), Math.min(card1.value, card2.value)]
        };
    }
    
    // Zwraca domyślny układ gdy nie można ocenić
    getDefaultHand() {
        return {
            ranking: 0,
            name: 'Brak układu',
            cards: [],
            values: [0]
        };
    }
    
    // Znajdź najlepszy układ z 5 kart spośród dostępnych
    findBestFiveCardHand(cards) {
        if (cards.length < 5) {
            throw new Error('Potrzeba minimum 5 kart do oceny układu');
        }
        
        let bestHand = null;
        
        // Jeśli mamy dokładnie 5 kart, oceń je
        if (cards.length === 5) {
            return this.evaluateFiveCardHand(cards);
        }
        
        // Sprawdź wszystkie kombinacje 5 kart
        const combinations = this.getCombinations(cards, 5);
        
        for (const combination of combinations) {
            const hand = this.evaluateFiveCardHand(combination);
            
            if (!bestHand || this.compareHands(hand, bestHand) > 0) {
                bestHand = hand;
            }
        }
        
        return bestHand;
    }
    
    // Oceń układ 5 kart
    evaluateFiveCardHand(cards) {
        // Sortuj karty według wartości (malejąco)
        const sortedCards = [...cards].sort((a, b) => b.value - a.value);
        
        // Sprawdź układy od najsilniejszych do najsłabszych
        return this.checkRoyalFlush(sortedCards) ||
               this.checkStraightFlush(sortedCards) ||
               this.checkFourOfAKind(sortedCards) ||
               this.checkFullHouse(sortedCards) ||
               this.checkFlush(sortedCards) ||
               this.checkStraight(sortedCards) ||
               this.checkThreeOfAKind(sortedCards) ||
               this.checkTwoPair(sortedCards) ||
               this.checkPair(sortedCards) ||
               this.checkHighCard(sortedCards);
    }
    
    // Sprawdza poker królewski
    checkRoyalFlush(cards) {
        const straight = this.checkStraight(cards);
        const flush = this.checkFlush(cards);
        
        if (straight && flush && straight.values[0] === 14) {
            return {
                ranking: 10,
                name: 'Poker królewski',
                cards: cards,
                values: [14]
            };
        }
        return null;
    }
    
    // Sprawdza poker (strit w jednym kolorze)
    checkStraightFlush(cards) {
        const straight = this.checkStraight(cards);
        const flush = this.checkFlush(cards);
        
        if (straight && flush) {
            return {
                ranking: 9,
                name: 'Poker',
                cards: cards,
                values: straight.values
            };
        }
        return null;
    }
    
    // Sprawdza karetę
    checkFourOfAKind(cards) {
        const valueCounts = this.getValueCounts(cards);
        
        for (const [value, count] of valueCounts.entries()) {
            if (count === 4) {
                return {
                    ranking: 8,
                    name: 'Kareta',
                    cards: cards,
                    values: [parseInt(value)]
                };
            }
        }
        return null;
    }
    
    // Sprawdza full house
    checkFullHouse(cards) {
        const valueCounts = this.getValueCounts(cards);
        let threeOfAKind = null;
        let pair = null;
        
        for (const [value, count] of valueCounts.entries()) {
            if (count === 3) threeOfAKind = parseInt(value);
            if (count === 2) pair = parseInt(value);
        }
        
        if (threeOfAKind && pair) {
            return {
                ranking: 7,
                name: 'Full house',
                cards: cards,
                values: [threeOfAKind, pair]
            };
        }
        return null;
    }
    
    // Sprawdza kolor
    checkFlush(cards) {
        const suits = cards.map(card => card.suit);
        const firstSuit = suits[0];
        
        if (suits.every(suit => suit === firstSuit)) {
            return {
                ranking: 6,
                name: 'Kolor',
                cards: cards,
                values: cards.map(card => card.value)
            };
        }
        return null;
    }
    
    // Sprawdza strita
    checkStraight(cards) {
        const values = cards.map(card => card.value).sort((a, b) => b - a);
        
        // Sprawdź normalny strit
        for (let i = 0; i < values.length - 1; i++) {
            if (values[i] - values[i + 1] !== 1) {
                break;
            }
            if (i === 3) { // Mamy 5 kolejnych kart
                return {
                    ranking: 5,
                    name: 'Strit',
                    cards: cards,
                    values: [values[0]]
                };
            }
        }
        
        // Sprawdź strit As-5 (wheel)
        if (values[0] === 14 && values[1] === 5 && values[2] === 4 && 
            values[3] === 3 && values[4] === 2) {
            return {
                ranking: 5,
                name: 'Strit',
                cards: cards,
                values: [5] // W wheel najwyższa karta to 5
            };
        }
        
        return null;
    }
    
    // Sprawdza trójkę
    checkThreeOfAKind(cards) {
        const valueCounts = this.getValueCounts(cards);
        
        for (const [value, count] of valueCounts.entries()) {
            if (count === 3) {
                return {
                    ranking: 4,
                    name: 'Trójka',
                    cards: cards,
                    values: [parseInt(value)]
                };
            }
        }
        return null;
    }
    
    // Sprawdza dwie pary
    checkTwoPair(cards) {
        const valueCounts = this.getValueCounts(cards);
        const pairs = [];
        
        for (const [value, count] of valueCounts.entries()) {
            if (count === 2) {
                pairs.push(parseInt(value));
            }
        }
        
        if (pairs.length === 2) {
            pairs.sort((a, b) => b - a); // Sortuj malejąco
            return {
                ranking: 3,
                name: 'Dwie pary',
                cards: cards,
                values: pairs
            };
        }
        return null;
    }
    
    // Sprawdza parę
    checkPair(cards) {
        const valueCounts = this.getValueCounts(cards);
        
        for (const [value, count] of valueCounts.entries()) {
            if (count === 2) {
                return {
                    ranking: 2,
                    name: 'Para',
                    cards: cards,
                    values: [parseInt(value)]
                };
            }
        }
        return null;
    }
    
    // Sprawdza wysoką kartę
    checkHighCard(cards) {
        return {
            ranking: 1,
            name: 'Wysoka karta',
            cards: cards,
            values: cards.map(card => card.value)
        };
    }
    
    // Zlicza wystąpienia wartości kart
    getValueCounts(cards) {
        const counts = new Map();
        
        for (const card of cards) {
            const value = card.value.toString();
            counts.set(value, (counts.get(value) || 0) + 1);
        }
        
        return counts;
    }
    
    // Porównuje dwa układy (1 = hand1 lepszy, -1 = hand2 lepszy, 0 = remis)
    compareHands(hand1, hand2) {
        // Porównaj ranking
        if (hand1.ranking !== hand2.ranking) {
            return hand1.ranking - hand2.ranking;
        }
        
        // Porównaj wartości kart
        for (let i = 0; i < Math.max(hand1.values.length, hand2.values.length); i++) {
            const value1 = hand1.values[i] || 0;
            const value2 = hand2.values[i] || 0;
            
            if (value1 !== value2) {
                return value1 - value2;
            }
        }
        
        return 0; // Remis
    }
    
    // Generuje kombinacje k elementów z tablicy
    getCombinations(array, k) {
        if (k === 1) return array.map(el => [el]);
        if (k === array.length) return [array];
        
        const combinations = [];
        
        for (let i = 0; i <= array.length - k; i++) {
            const head = array[i];
            const tailCombinations = this.getCombinations(array.slice(i + 1), k - 1);
            
            for (const tail of tailCombinations) {
                combinations.push([head, ...tail]);
            }
        }
        
        return combinations;
    }
    
    // Generuje klucz cache dla układu kart
    getHandCacheKey(cards) {
        return cards
            .map(card => `${card.suit}${card.rank}`)
            .sort()
            .join('');
    }
    
    // Wyczyść cache
    clearCache() {
        this.cache.clear();
    }
}

// Eksport dla Node.js lub przeglądarki
if (typeof module !== 'undefined' && module.exports) {
    module.exports = HandEvaluator;
} else if (typeof window !== 'undefined') {
    window.HandEvaluator = HandEvaluator;
}
