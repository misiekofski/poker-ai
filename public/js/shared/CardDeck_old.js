// CardDeck.js - Klasa do zarządzania talią kart

class Card {
    constructor(suit, rank) {
        this.suit = suit;
        this.rank = rank;
        // Użyj window.Constants w przeglądarce, require w Node.js
        const C = (typeof window !== 'undefined' && window.Constants) || require('./Constants');
        this.value = C ? C.RANK_VALUES[rank] : this.getDefaultRankValue(rank);
    }
    
    // Fallback dla wartości rang
    getDefaultRankValue(rank) {
        const defaultValues = {
            '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
            'T': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14
        };
        return defaultValues[rank] || 0;
    }
    
    // Zwraca reprezentację tekstową karty
    toString() {
        return `${this.rank}${this.suit}`;
    }
    
    // Sprawdza czy karta jest czerwona
    isRed() {
        return this.suit === Constants.SUITS.HEARTS || this.suit === Constants.SUITS.DIAMONDS;
    }
    
    // Sprawdza czy karta jest czarna
    isBlack() {
        return this.suit === Constants.SUITS.CLUBS || this.suit === Constants.SUITS.SPADES;
    }
    
    // Porównuje karty po wartości
    compareTo(otherCard) {
        return this.value - otherCard.value;
    }
    
    // Zwraca obiekt do serializacji JSON
    toJSON() {
        return {
            suit: this.suit,
            rank: this.rank,
            value: this.value
        };
    }
    
    // Tworzy kartę z obiektu JSON
    static fromJSON(cardData) {
        return new Card(cardData.suit, cardData.rank);
    }
}

class CardDeck {
    constructor() {
        this.cards = [];
        this.discardPile = [];
        this.initializeDeck();
    }
    
    // Inicjalizuje pełną talię 52 kart
    initializeDeck() {
        this.cards = [];
        
        // Pobierz Constants
        const C = (typeof window !== 'undefined' && window.Constants) || require('./Constants');
        
        // Fallback jeśli Constants nie jest dostępne
        const suits = C ? Object.values(C.SUITS) : ['♠', '♥', '♦', '♣'];
        const ranks = C ? Object.values(C.RANKS) : ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
        
        for (const suit of suits) {
            for (const rank of ranks) {
                this.cards.push(new Card(suit, rank));
            }
        }
        
        this.shuffle();
    }
    
    // Tasuje talię algorytmem Fisher-Yates
    shuffle() {
        for (let i = this.cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
        }
    }
    
    // Ciągnie kartę z wierzchu talii
    dealCard() {
        if (this.cards.length === 0) {
            throw new Error('Talia jest pusta! Nie można rozdać karty.');
        }
        
        const card = this.cards.pop();
        this.discardPile.push(card);
        return card;
    }
    
    // Ciągnie określoną liczbę kart
    dealCards(count) {
        const dealtCards = [];
        for (let i = 0; i < count; i++) {
            dealtCards.push(this.dealCard());
        }
        return dealtCards;
    }
    
    // Zwraca liczbę pozostałych kart w talii
    remainingCards() {
        return this.cards.length;
    }
    
    // Sprawdza czy talia jest pusta
    isEmpty() {
        return this.cards.length === 0;
    }
    
    // Resetuje talię - zbiera wszystkie karty i tasuje
    reset() {
        this.cards = [...this.cards, ...this.discardPile];
        this.discardPile = [];
        this.shuffle();
    }
    
    // Zwraca kopię talii do debugowania (bez modyfikacji oryginalnej)
    peek(count = 5) {
        return this.cards.slice(-count).map(card => card.toString());
    }
    
    // Ustawia konkretne karty na wierzchu talii (do testów)
    setTopCards(cardStrings) {
        const testCards = [];
        
        for (const cardStr of cardStrings) {
            // Parsowanie karty z stringa np. "AS" -> As pik
            const rank = cardStr.slice(0, -1);
            const suitSymbol = cardStr.slice(-1);
            
            // Znajdź odpowiedni symbol masci
            let suit = '';
            switch(suitSymbol.toLowerCase()) {
                case 's': suit = Constants.SUITS.SPADES; break;
                case 'h': suit = Constants.SUITS.HEARTS; break;
                case 'd': suit = Constants.SUITS.DIAMONDS; break;
                case 'c': suit = Constants.SUITS.CLUBS; break;
                default: 
                    console.warn(`Nieprawidłowy symbol masci: ${suitSymbol}`);
                    continue;
            }
            
            // Usuń kartę z talii jeśli istnieje
            const cardIndex = this.cards.findIndex(card => 
                card.rank === rank && card.suit === suit
            );
            
            if (cardIndex !== -1) {
                const card = this.cards.splice(cardIndex, 1)[0];
                testCards.push(card);
            } else {
                console.warn(`Karta ${cardStr} nie została znaleziona w talii`);
            }
        }
        
        // Dodaj testowe karty na wierzch talii (w odwrotnej kolejności)
        this.cards.push(...testCards.reverse());
    }
    
    // Zwraca stan talii do serializacji
    toJSON() {
        return {
            cards: this.cards,
            discardPile: this.discardPile
        };
    }
    
    // Przywraca talię ze stanu JSON
    static fromJSON(deckData) {
        const deck = new CardDeck();
        deck.cards = deckData.cards.map(cardData => Card.fromJSON(cardData));
        deck.discardPile = deckData.discardPile.map(cardData => Card.fromJSON(cardData));
        return deck;
    }
    
    // Tworzy talię testową z określonymi kartami (dla debugowania)
    static createTestDeck(cardStrings) {
        const deck = new CardDeck();
        deck.cards = [];
        
        for (const cardStr of cardStrings) {
            const rank = cardStr.slice(0, -1);
            const suitSymbol = cardStr.slice(-1);
            
            let suit = '';
            switch(suitSymbol.toLowerCase()) {
                case 's': suit = Constants.SUITS.SPADES; break;
                case 'h': suit = Constants.SUITS.HEARTS; break;
                case 'd': suit = Constants.SUITS.DIAMONDS; break;
                case 'c': suit = Constants.SUITS.CLUBS; break;
            }
            
            if (suit) {
                deck.cards.push(new Card(suit, rank));
            }
        }
        
        return deck;
    }
}

// Eksport dla Node.js lub przeglądarki
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Card, CardDeck };
} else if (typeof window !== 'undefined') {
    window.Card = Card;
    window.CardDeck = CardDeck;
}
