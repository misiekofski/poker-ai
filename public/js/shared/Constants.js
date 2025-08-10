// Constants.js - Stałe dla gry w pokera Texas Hold'em

// Definicje kart i kolorów
const GameConstants = {
    // Kolory kart
    SUITS: {
        SPADES: '♠',
        HEARTS: '♥', 
        DIAMONDS: '♦',
        CLUBS: '♣'
    },
    
    // Rangi kart
    RANKS: {
        TWO: '2',
        THREE: '3', 
        FOUR: '4',
        FIVE: '5',
        SIX: '6',
        SEVEN: '7',
        EIGHT: '8',
        NINE: '9',
        TEN: 'T',
        JACK: 'J',
        QUEEN: 'Q',
        KING: 'K',
        ACE: 'A'
    },
    
    // Wartości rang dla porównań
    RANK_VALUES: {
        '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
        'T': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14
    },
    
    // Typy układów pokerowych
    HAND_TYPES: {
        HIGH_CARD: 0,
        PAIR: 1,
        TWO_PAIR: 2,
        THREE_OF_A_KIND: 3,
        STRAIGHT: 4,
        FLUSH: 5,
        FULL_HOUSE: 6,
        FOUR_OF_A_KIND: 7,
        STRAIGHT_FLUSH: 8,
        ROYAL_FLUSH: 9
    },
    
    // Nazwy układów po polsku
    HAND_NAMES: {
        0: 'Wysoka karta',
        1: 'Para',
        2: 'Dwie pary',
        3: 'Trójka',
        4: 'Strit',
        5: 'Kolor',
        6: 'Full house',
        7: 'Kareta',
        8: 'Poker',
        9: 'Poker królewski'
    },
    
    // Stany gry
    GAME_STATES: {
        WAITING: 'waiting',
        DEALING: 'dealing', 
        PREFLOP: 'preflop',
        FLOP: 'flop',
        TURN: 'turn',
        RIVER: 'river',
        SHOWDOWN: 'showdown',
        FINISHED: 'finished'
    },
    
    // Eventy Socket.IO
    SOCKET_EVENTS: {
        JOIN_GAME: 'join_game',
        LEAVE_GAME: 'leave_game',
        PLAYER_ACTION: 'player_action',
        START_GAME: 'start_game',
        ADD_BOTS: 'add_bots',
        GAME_STATE: 'game_state',
        PLAYER_JOINED: 'player_joined',
        PLAYER_LEFT: 'player_left',
        GAME_END: 'game_end',
        ERROR: 'error',
        TURN_CHANGE: 'turn_change',
        ROUND_END: 'round_end'
    },
    
    // Typy akcji gracza
    ACTIONS: {
        FOLD: 'fold',
        CALL: 'call',
        RAISE: 'raise',
        CHECK: 'check',
        ALL_IN: 'all_in'
    },
    
    // Pozycje przy stole
    POSITIONS: {
        SMALL_BLIND: 'small_blind',
        BIG_BLIND: 'big_blind', 
        UNDER_THE_GUN: 'under_the_gun',
        MIDDLE: 'middle',
        CUTOFF: 'cutoff',
        BUTTON: 'button'
    },
    
    // Ustawienia gry
    GAME_SETTINGS: {
        MAX_PLAYERS: 6,
        MIN_PLAYERS: 2,
        CARDS_PER_PLAYER: 2,
        COMMUNITY_CARDS: 5,
        DECK_SIZE: 52,
        DEFAULT_STACK: 1000,
        SMALL_BLIND: 10,
        BIG_BLIND: 20
    },
    
    // Ustawienia interfejsu
    UI_SETTINGS: {
        ANIMATION_SPEED: 300,
        CARD_DEAL_DELAY: 100,
        ACTION_TIMEOUT: 30000,
        TOOLTIP_DELAY: 1000
    },
    
    // Kolory interfejsu
    UI_COLORS: {
        PRIMARY: '#2c5aa0',
        SECONDARY: '#4a90e2',
        SUCCESS: '#5cb85c',
        WARNING: '#f0ad4e',
        DANGER: '#d9534f',
        DARK: '#333333',
        LIGHT: '#f8f9fa'
    },
    
    // Komunikaty
    MESSAGES: {
        WAITING_FOR_PLAYERS: 'Oczekiwanie na graczy...',
        YOUR_TURN: 'Twoja kolej!',
        GAME_OVER: 'Koniec gry',
        ROUND_WINNER: 'Zwycięzca rundy',
        INSUFFICIENT_FUNDS: 'Niewystarczające środki',
        INVALID_ACTION: 'Nieprawidłowa akcja'
    },
    
    // Tryby gry
    GAME_MODES: {
        SINGLEPLAYER: 'singleplayer',
        MULTIPLAYER: 'multiplayer',
        TOURNAMENT: 'tournament'
    },
    
    // Typy bot'ów AI
    BOT_PERSONALITIES: {
        TIGHT: 'tight',
        LOOSE: 'loose',
        AGGRESSIVE: 'aggressive',
        PASSIVE: 'passive',
        BALANCED: 'balanced',
        RANDOM: 'random'
    },
    
    // Poziomy trudności
    DIFFICULTY_LEVELS: {
        EASY: 'easy',
        MEDIUM: 'medium',
        HARD: 'hard',
        EXPERT: 'expert'
    }
};

// Funkcje pomocnicze
const PokerUtils = {
    // Sprawdza czy karta jest prawidłowa
    isValidCard(suit, rank) {
        return Object.values(GameConstants.SUITS).includes(suit) && 
               Object.values(GameConstants.RANKS).includes(rank);
    },
    
    // Zwraca wartość rangi
    getRankValue(rank) {
        return GameConstants.RANK_VALUES[rank] || 0;
    },
    
    // Sprawdza czy akcja jest prawidłowa
    isValidAction(action) {
        return Object.values(GameConstants.ACTIONS).includes(action);
    },
    
    // Formatuje kwotę
    formatChips(amount) {
        if (amount >= 1000000) {
            return (amount / 1000000).toFixed(1) + 'M';
        } else if (amount >= 1000) {
            return (amount / 1000).toFixed(1) + 'K';
        }
        return amount.toString();
    },
    
    // Generuje losowy ID
    generateId() {
        return Math.random().toString(36).substr(2, 9);
    }
};

// Eksport dla Node.js lub przeglądarki
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GameConstants, PokerUtils };
} else if (typeof window !== 'undefined') {
    window.GameConstants = GameConstants;
    window.PokerUtils = PokerUtils;
    
    // Kompatybilność wsteczna - mapowanie starych nazw na nowe
    window.Constants = {
        GAME_MODES: {
            SINGLEPLAYER: 'singleplayer',
            MULTIPLAYER: 'multiplayer'
        },
        GAME_PHASES: {
            WAITING: 'waiting',
            PRE_FLOP: 'preflop',
            FLOP: 'flop',
            TURN: 'turn',
            RIVER: 'river',
            SHOWDOWN: 'showdown'
        },
        PLAYER_TYPES: {
            HUMAN: 'human',
            BOT: 'bot'
        },
        PLAYER_STATUS: {
            ACTIVE: 'active',
            FOLDED: 'folded',
            ALL_IN: 'all_in'
        },
        PLAYER_ACTIONS: {
            FOLD: 'fold',
            CHECK: 'check',
            CALL: 'call',
            RAISE: 'raise',
            ALL_IN: 'all_in'
        },
        HAND_RANKINGS: {
            ROYAL_FLUSH: 10,
            STRAIGHT_FLUSH: 9,
            FOUR_OF_A_KIND: 8,
            FULL_HOUSE: 7,
            FLUSH: 6,
            STRAIGHT: 5,
            THREE_OF_A_KIND: 4,
            TWO_PAIR: 3,
            PAIR: 2,
            HIGH_CARD: 1
        },
        GAME_SETTINGS: {
            MAX_PLAYERS: 6,
            MIN_PLAYERS: 2,
            STARTING_CHIPS: 1000,
            SMALL_BLIND: 10,
            BIG_BLIND: 20,
            MIN_RAISE: 20,
            TURN_TIMEOUT: 30000,
            BOT_THINK_TIME: 2000
        },
        SOCKET_EVENTS: {
            JOIN_GAME: 'join_game',
            LEAVE_GAME: 'leave_game',
            PLAYER_ACTION: 'player_action',
            START_GAME: 'start_game',
            ADD_BOTS: 'add_bots',
            GAME_STATE: 'game_state',
            PLAYER_JOINED: 'player_joined',
            PLAYER_LEFT: 'player_left',
            GAME_END: 'game_end',
            ERROR: 'error',
            TURN_CHANGE: 'turn_change',
            ROUND_END: 'round_end'
        },
        AI_AGGRESSION: {
            PASSIVE: 'passive',
            NORMAL: 'normal',
            AGGRESSIVE: 'aggressive'
        },
        CARDS_PER_PLAYER: 2,
        MAX_PLAYERS: 6
    };
}
