// CardDeck.js - Klasa do zarządzania talią kart

class Card {
    constructor(suit, rank) {
        this.suit = suit;
        this.rank = rank;
        this.value = this.getDefaultRankValue(rank);
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
    
    // Sprawdza równość kart
    equals(otherCard) {
        return this.suit === otherCard.suit && this.rank === otherCard.rank;
    }
    
    // Zwraca kolor karty jako tekst
    getColorName() {
        const colors = {
            '♠': 'Pik',
            '♥': 'Kier', 
            '♦': 'Karo',
            '♣': 'Trefl'
        };
        return colors[this.suit] || 'Nieznany';
    }
    
    // Zwraca nazwę figury
    getRankName() {
        const ranks = {
            '2': 'Dwójka', '3': 'Trójka', '4': 'Czwórka', '5': 'Piątka',
            '6': 'Szóstka', '7': 'Siódemka', '8': 'Ósemka', '9': 'Dziewiątka',
            'T': 'Dziesiątka', 'J': 'Walet', 'Q': 'Dama', 'K': 'Król', 'A': 'As'
        };
        return ranks[this.rank] || 'Nieznana';
    }
    
    // Zwraca pełną nazwę karty
    getFullName() {
        return `${this.getRankName()} ${this.getColorName()}`;
    }
    
    // Sprawdza czy karta jest czerwona
    isRed() {
        return this.suit === '♥' || this.suit === '♦';
    }
    
    // Sprawdza czy karta jest czarna  
    isBlack() {
        return this.suit === '♠' || this.suit === '♣';
    }
    
    // Zwraca obiekt JSON
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
        
        const suits = ['♠', '♥', '♦', '♣'];
        const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
        
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
        return this;
    }
    
    // Rozdaje jedną kartę z wierzchu talii
    dealCard() {
        if (this.cards.length === 0) {
            throw new Error('Talia jest pusta - nie można rozdać karty');
        }
        
        const card = this.cards.pop();
        return card;
    }
    
    // Rozdaje określoną liczbę kart
    dealCards(count) {
        const dealtCards = [];
        
        for (let i = 0; i < count; i++) {
            if (this.cards.length === 0) {
                throw new Error(`Nie można rozdać ${count} kart - zostało tylko ${i} kart w talii`);
            }
            dealtCards.push(this.dealCard());
        }
        
        return dealtCards;
    }
    
    // Zwraca liczbę kart pozostałych w talii
    getCardsRemaining() {
        return this.cards.length;
    }
    
    // Sprawdza czy talia jest pusta
    isEmpty() {
        return this.cards.length === 0;
    }
    
    // Resetuje talię do pełnego stanu
    reset() {
        this.cards = [];
        this.discardPile = [];
        this.initializeDeck();
        return this;
    }
    
    // Dodaje kartę do stosu odrzuconych
    discard(card) {
        this.discardPile.push(card);
    }
    
    // Przywraca odrzucone karty do talii i tasuje
    reshuffleDiscards() {
        this.cards.push(...this.discardPile);
        this.discardPile = [];
        this.shuffle();
        return this;
    }
    
    // Zwraca kopię talii (bez modyfikacji oryginału)
    clone() {
        const newDeck = new CardDeck();
        newDeck.cards = this.cards.map(card => new Card(card.suit, card.rank));
        newDeck.discardPile = this.discardPile.map(card => new Card(card.suit, card.rank));
        return newDeck;
    }
    
    // Sprawdza czy talia zawiera określoną kartę
    hasCard(targetCard) {
        return this.cards.some(card => card.equals(targetCard));
    }
    
    // Usuwa określoną kartę z talii (jeśli istnieje)
    removeCard(targetCard) {
        const index = this.cards.findIndex(card => card.equals(targetCard));
        if (index !== -1) {
            return this.cards.splice(index, 1)[0];
        }
        return null;
    }
    
    // Zwraca statystyki talii
    getStats() {
        return {
            cardsInDeck: this.cards.length,
            cardsDiscarded: this.discardPile.length,
            totalCards: this.cards.length + this.discardPile.length,
            isComplete: (this.cards.length + this.discardPile.length) === 52
        };
    }
    
    // Serializuje talię do JSON
    toJSON() {
        return {
            cards: this.cards.map(card => card.toJSON()),
            discardPile: this.discardPile.map(card => card.toJSON())
        };
    }
    
    // Deserializuje talię z JSON
    static fromJSON(deckData) {
        const deck = new CardDeck();
        deck.cards = [];
        deck.discardPile = [];
        
        if (deckData.cards) {
            deck.cards = deckData.cards.map(cardData => Card.fromJSON(cardData));
        }
        
        if (deckData.discardPile) {
            deck.discardPile = deckData.discardPile.map(cardData => Card.fromJSON(cardData));
        }
        
        return deck;
    }
    
    // Debugowanie - wyświetl zawartość talii
    debug() {
        console.log('=== STAN TALII ===');
        console.log(`Karty w talii (${this.cards.length}):`);
        this.cards.forEach((card, index) => {
            console.log(`${index + 1}. ${card.getFullName()}`);
        });
        
        if (this.discardPile.length > 0) {
            console.log(`\nOdrzucone karty (${this.discardPile.length}):`);
            this.discardPile.forEach((card, index) => {
                console.log(`${index + 1}. ${card.getFullName()}`);
            });
        }
        console.log('==================');
    }
}

// Eksport dla Node.js lub przeglądarki
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Card, CardDeck };
} else if (typeof window !== 'undefined') {
    window.Card = Card;
    window.CardDeck = CardDeck;
}
