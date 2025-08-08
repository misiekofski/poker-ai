class MultiplayerPokerGame {
    constructor() {
        console.log('MultiplayerPokerGame constructor uruchomiony');
        this.socket = null;
        this.isConnected = false;
        this.isMultiplayer = false;
        this.currentRoomId = null;
        this.playerId = null;
        this.playerName = null;
        this.gameState = null;
        this.singlePlayerGame = null;
        
        console.log('Inicjalizacja UI...');
        this.initializeUI();
        console.log('Bindowanie eventów...');
        this.bindEvents();
        console.log('Konstruktor zakończony');
    }

    initializeUI() {
        console.log('Pokazywanie menu połączenia...');
        this.showConnectionMenu();
    }

    showConnectionMenu() {
        console.log('showConnectionMenu wywołany');
        const connectionMenu = document.getElementById('connection-menu');
        const waitingRoom = document.getElementById('waiting-room');
        const mainGame = document.getElementById('main-game');
        
        if (!connectionMenu) {
            console.error('Nie można znaleźć connection-menu element!');
            return;
        }
        
        console.log('Pokazywanie menu połączenia');
        connectionMenu.style.display = 'flex';
        if (waitingRoom) waitingRoom.style.display = 'none';
        if (mainGame) mainGame.style.display = 'none';
    }

    bindEvents() {
        // Sprawdź czy elementy istnieją przed dodaniem event listenerów
        const joinRoomBtn = document.getElementById('join-room-btn');
        const singlePlayerBtn = document.getElementById('single-player-btn');
        
        if (!joinRoomBtn || !singlePlayerBtn) {
            console.error('Nie można znaleźć przycisków w HTML!');
            return;
        }
        
        console.log('Bindowanie eventów...');
        
        joinRoomBtn.addEventListener('click', () => {
            console.log('Kliknięto multiplayer button');
            this.joinMultiplayerRoom();
        });

        singlePlayerBtn.addEventListener('click', () => {
            console.log('Kliknięto single-player button');
            this.startSinglePlayerGame();
        });

        const startGameBtn = document.getElementById('start-game-btn');
        if (startGameBtn) {
            startGameBtn.addEventListener('click', () => {
                this.startMultiplayerGame();
            });
        }

        const leaveRoomBtn = document.getElementById('leave-room-btn');
        if (leaveRoomBtn) {
            leaveRoomBtn.addEventListener('click', () => {
                this.leaveRoom();
            });
        }

        // Game controls
        const foldBtn = document.getElementById('fold-btn');
        const checkBtn = document.getElementById('check-btn');
        const callBtn = document.getElementById('call-btn');
        const betBtn = document.getElementById('bet-btn');
        const allInBtn = document.getElementById('all-in-btn');
        
        if (foldBtn) foldBtn.addEventListener('click', () => this.playerAction('fold'));
        if (checkBtn) checkBtn.addEventListener('click', () => this.playerAction('check'));
        if (callBtn) callBtn.addEventListener('click', () => this.playerAction('call'));
        if (betBtn) {
            betBtn.addEventListener('click', () => {
                const amount = parseInt(document.getElementById('bet-input').value) || 0;
                if (amount > 0) this.playerAction('bet', amount);
            });
        }
        if (allInBtn) allInBtn.addEventListener('click', () => this.playerAction('all-in'));

        const betSlider = document.getElementById('bet-slider');
        const betInput = document.getElementById('bet-input');
        
        betSlider.addEventListener('input', (e) => {
            betInput.value = e.target.value;
        });
        
        betInput.addEventListener('input', (e) => {
            betSlider.value = e.target.value;
        });
    }

    joinMultiplayerRoom() {
        const playerName = document.getElementById('player-name').value.trim();
        if (!playerName) {
            this.showConnectionStatus('Wprowadź swoje imię', 'error');
            return;
        }

        let roomId = document.getElementById('room-id').value.trim();
        if (!roomId) {
            roomId = this.generateRoomId();
        }

        this.playerName = playerName;
        console.log('Próba dołączenia do pokoju:', roomId, 'jako:', playerName);
        this.connectToServer(roomId);
    }

    generateRoomId() {
        return Math.random().toString(36).substring(2, 8).toUpperCase();
    }

    connectToServer(roomId) {
        console.log('connectToServer wywołany z roomId:', roomId);
        this.showConnectionStatus('Łączenie z serwerem...', 'info');
        
        // Sprawdź czy Socket.IO jest dostępne
        if (typeof io === 'undefined') {
            console.log('Socket.IO nie jest dostępne');
            this.showConnectionStatus('Socket.IO niedostępne. Uruchom grę z http://localhost:3000', 'error');
            setTimeout(() => {
                this.startSinglePlayerGame();
            }, 3000);
            return;
        }
        
        console.log('Socket.IO jest dostępne');
        const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        console.log('isLocalhost:', isLocalhost, 'port:', window.location.port);
        
        if (isLocalhost && window.location.port === '3000') {
            // Tryb lokalny z serwerem
            console.log('Próba połączenia z lokalnym serwerem...');
            try {
                this.socket = io();
                this.setupSocketEvents();
                this.socket.emit('joinRoom', { roomId, playerName: this.playerName });
                console.log('Wysłano joinRoom event');
                
                // Timeout dla połączenia
                setTimeout(() => {
                    if (!this.isConnected) {
                        console.log('Timeout połączenia');
                        this.showConnectionStatus('Timeout połączenia. Sprawdź czy serwer działa.', 'error');
                        setTimeout(() => {
                            this.startSinglePlayerGame();
                        }, 2000);
                    }
                }, 5000);
                
            } catch (error) {
                console.error('Błąd połączenia Socket.IO:', error);
                this.showConnectionStatus('Błąd połączenia z serwerem: ' + error.message, 'error');
                setTimeout(() => {
                    this.startSinglePlayerGame();
                }, 2000);
            }
        } else {
            // Tryb plikowy lub GitHub Pages - tylko single-player
            console.log('Nie localhost:3000, przełączanie na single-player');
            this.showConnectionStatus('Multiplayer dostępny tylko z http://localhost:3000. Przełączanie na single-player...', 'info');
            setTimeout(() => {
                this.startSinglePlayerGame();
            }, 2000);
        }
    }

    setupSocketEvents() {
        // Timeout dla połączenia
        const connectionTimeout = setTimeout(() => {
            if (!this.isConnected) {
                this.showConnectionStatus('Timeout połączenia. Przełączanie na single-player...', 'error');
                if (this.socket) {
                    this.socket.disconnect();
                }
                setTimeout(() => {
                    this.startSinglePlayerGame();
                }, 1000);
            }
        }, 5000);

        this.socket.on('connect', () => {
            clearTimeout(connectionTimeout);
            this.isConnected = true;
            this.playerId = this.socket.id;
            this.showConnectionStatus('Połączono z serwerem', 'success');
        });

        this.socket.on('connect_error', () => {
            clearTimeout(connectionTimeout);
            this.showConnectionStatus('Błąd połączenia. Przełączanie na single-player...', 'error');
            setTimeout(() => {
                this.startSinglePlayerGame();
            }, 1000);
        });

        this.socket.on('disconnect', () => {
            this.isConnected = false;
            this.showConnectionStatus('Rozłączono z serwerem', 'error');
        });

        this.socket.on('joinedRoom', (data) => {
            if (data.success) {
                this.currentRoomId = data.roomId;
                this.isMultiplayer = true;
                this.showWaitingRoom(data);
            } else {
                this.showConnectionStatus(data.message || 'Błąd dołączania do pokoju', 'error');
            }
        });

        this.socket.on('playerJoined', (data) => {
            this.updatePlayersInRoom(data);
        });

        this.socket.on('playerLeft', (data) => {
            this.updatePlayersInRoom(data);
        });

        this.socket.on('canStartGame', (canStart) => {
            document.getElementById('start-game-btn').style.display = canStart ? 'block' : 'none';
        });

        this.socket.on('gameStarted', () => {
            this.showMainGame();
            document.body.classList.add('multiplayer-mode');
        });

        this.socket.on('gameState', (state) => {
            this.gameState = state;
            this.updateGameDisplay(state);
        });
    }

    showConnectionStatus(message, type) {
        const statusElement = document.getElementById('connection-status');
        statusElement.textContent = message;
        statusElement.className = `connection-status ${type}`;
    }

    showWaitingRoom(data) {
        document.getElementById('connection-menu').style.display = 'none';
        document.getElementById('waiting-room').style.display = 'flex';
        document.getElementById('current-room-id').textContent = data.roomId;
        
        this.updatePlayersInRoom(data);
    }

    updatePlayersInRoom(data) {
        const playersList = document.getElementById('players-list');
        playersList.innerHTML = '';
        
        if (data.players) {
            data.players.forEach(player => {
                const li = document.createElement('li');
                li.innerHTML = `
                    <span>${player.name}</span>
                    <span>$${player.chips}</span>
                `;
                playersList.appendChild(li);
            });
        }

        const statusElement = document.getElementById('room-status');
        if (data.playersCount >= 2) {
            statusElement.textContent = 'Gotowy do rozpoczęcia gry!';
            document.getElementById('start-game-btn').style.display = 'block';
        } else {
            statusElement.textContent = 'Oczekiwanie na więcej graczy...';
            document.getElementById('start-game-btn').style.display = 'none';
        }
    }

    startMultiplayerGame() {
        if (this.socket && this.isConnected) {
            this.socket.emit('startGame', { roomId: this.currentRoomId });
        }
    }

    showMainGame() {
        document.getElementById('waiting-room').style.display = 'none';
        document.getElementById('main-game').style.display = 'flex';
        document.getElementById('game-room-id').textContent = this.currentRoomId;
    }

    startSinglePlayerGame() {
        console.log('Uruchamianie gry single-player...');
        this.isMultiplayer = false;
        document.getElementById('connection-menu').style.display = 'none';
        document.getElementById('main-game').style.display = 'flex';
        document.body.classList.remove('multiplayer-mode');
        document.body.classList.add('single-player-mode');
        
        console.log('Tworzenie instancji PokerGame...');
        this.singlePlayerGame = new PokerGame();
    }

    leaveRoom() {
        if (this.socket) {
            this.socket.disconnect();
        }
        this.showConnectionMenu();
        this.isMultiplayer = false;
        this.currentRoomId = null;
        document.body.classList.remove('multiplayer-mode');
    }

    playerAction(action, amount = 0) {
        if (this.isMultiplayer && this.socket && this.isConnected) {
            this.socket.emit('playerAction', { action, amount });
        } else if (this.singlePlayerGame) {
            switch(action) {
                case 'fold':
                    this.singlePlayerGame.playerFold();
                    break;
                case 'check':
                    this.singlePlayerGame.playerCheck();
                    break;
                case 'call':
                    this.singlePlayerGame.playerCall();
                    break;
                case 'bet':
                    this.singlePlayerGame.playerBet(amount);
                    break;
                case 'all-in':
                    this.singlePlayerGame.playerAllIn();
                    break;
            }
        }
    }

    updateGameDisplay(gameState) {
        if (!gameState) return;

        document.getElementById('pot').textContent = gameState.pot;
        document.getElementById('round').textContent = gameState.round;

        this.displayCommunityCards(gameState.communityCards);
        this.displayPlayers(gameState.players, gameState.yourCards, gameState.currentPlayerIndex, gameState.dealerIndex);
        this.updateControls(gameState);
    }

    displayCommunityCards(communityCards) {
        const communityCardsElement = document.getElementById('community-cards');
        communityCardsElement.innerHTML = '';
        
        for (let i = 0; i < 5; i++) {
            if (i < communityCards.length) {
                const cardElement = this.createCardElement(communityCards[i]);
                communityCardsElement.appendChild(cardElement);
            } else {
                const cardElement = document.createElement('div');
                cardElement.className = 'card hidden';
                communityCardsElement.appendChild(cardElement);
            }
        }
    }

    displayPlayers(players, yourCards, currentPlayerIndex, dealerIndex) {
        const playersContainer = document.getElementById('players-container');
        playersContainer.innerHTML = '';

        players.forEach((player, index) => {
            const playerElement = document.createElement('div');
            playerElement.className = `multiplayer-player position-${player.position}`;
            
            if (index === currentPlayerIndex) {
                playerElement.classList.add('current-turn');
            }
            
            if (index === dealerIndex) {
                playerElement.classList.add('dealer');
            }

            const isYou = player.id === this.playerId;
            const cards = isYou ? yourCards : Array(player.cards).fill({ rank: '?', suit: '?' });

            playerElement.innerHTML = `
                <div class="player-name">${player.name}${isYou ? ' (Ty)' : ''}</div>
                <div class="player-info">
                    <div class="chips">$${player.chips}</div>
                    <div class="bet">Stawka: $${player.bet}</div>
                    ${player.isFolded ? '<div class="folded">Spasował</div>' : ''}
                </div>
                <div class="cards" id="player-${player.id}-cards">
                    ${this.renderPlayerCards(cards, !isYou)}
                </div>
            `;

            playersContainer.appendChild(playerElement);
        });
    }

    renderPlayerCards(cards, hideCards = false) {
        return cards.map(card => {
            if (hideCards) {
                return '<div class="card back"></div>';
            } else {
                const colorClass = (card.suit === '♥' || card.suit === '♦') ? 'red' : 'black';
                return `
                    <div class="card ${colorClass}">
                        <div class="rank">${card.rank}</div>
                        <div class="suit">${card.suit}</div>
                    </div>
                `;
            }
        }).join('');
    }

    createCardElement(card) {
        const cardElement = document.createElement('div');
        cardElement.className = 'card';
        
        if (card.suit === '♥' || card.suit === '♦') {
            cardElement.classList.add('red');
        } else {
            cardElement.classList.add('black');
        }
        
        cardElement.innerHTML = `
            <div class="rank">${card.rank}</div>
            <div class="suit">${card.suit}</div>
        `;
        
        return cardElement;
    }

    updateControls(gameState) {
        const isYourTurn = gameState.players[gameState.currentPlayerIndex]?.id === this.playerId;
        const yourPlayer = gameState.players.find(p => p.id === this.playerId);
        
        if (!yourPlayer) return;

        const callAmount = gameState.currentBet - yourPlayer.bet;
        document.getElementById('call-amount').textContent = callAmount;

        const checkBtn = document.getElementById('check-btn');
        const callBtn = document.getElementById('call-btn');
        const betSlider = document.getElementById('bet-slider');
        const betInput = document.getElementById('bet-input');

        const controls = document.querySelectorAll('#game-controls .btn, #game-controls input');
        controls.forEach(control => {
            control.disabled = !isYourTurn || yourPlayer.isFolded;
        });

        if (isYourTurn && !yourPlayer.isFolded) {
            if (callAmount === 0) {
                checkBtn.style.display = 'block';
                callBtn.style.display = 'none';
            } else {
                checkBtn.style.display = 'none';
                callBtn.style.display = 'block';
            }

            const maxBet = yourPlayer.chips;
            betSlider.max = maxBet;
            betInput.max = maxBet;
        }

        let statusText = '';
        if (yourPlayer.isFolded) {
            statusText = 'Spasowałeś';
        } else if (isYourTurn) {
            statusText = 'Twoja kolej!';
        } else {
            const currentPlayer = gameState.players[gameState.currentPlayerIndex];
            statusText = `Kolej gracza: ${currentPlayer?.name}`;
        }
        
        document.getElementById('game-status').textContent = statusText;
    }
}

class PokerGame {
    constructor() {
        this.deck = [];
        this.playerCards = [];
        this.aiCards = [];
        this.communityCards = [];
        this.pot = 0;
        this.playerChips = 1000;
        this.aiChips = 1000;
        this.playerBet = 0;
        this.aiBet = 0;
        this.currentBet = 0;
        this.round = 'pre-flop';
        this.gamePhase = 'betting';
        this.playerAction = '';
        this.aiAction = '';
        
        // Bindowanie eventów
        this.bindEvents();
        this.startNewGame();
    }
    
    // Bindowanie eventów dla gry single-player
    bindEvents() {
        console.log('PokerGame: Bindowanie eventów...');
        
        const newGameBtn = document.getElementById('new-game-btn');
        if (newGameBtn) {
            newGameBtn.addEventListener('click', () => {
                console.log('Nowa gra clicked');
                this.startNewGame();
            });
        }
    }
    
    // Inicjalizacja talii kart
    initDeck() {
        const suits = ['♠', '♥', '♦', '♣'];
        const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
        
        this.deck = [];
        for (let suit of suits) {
            for (let rank of ranks) {
                this.deck.push({
                    rank: rank,
                    suit: suit,
                    value: this.getCardValue(rank)
                });
            }
        }
        
        // Tasowanie talii
        for (let i = this.deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
        }
    }
    
    // Pobieranie wartości karty
    getCardValue(rank) {
        switch(rank) {
            case 'J': return 11;
            case 'Q': return 12;
            case 'K': return 13;
            case 'A': return 14;
            default: return parseInt(rank);
        }
    }
    
    // Rozdawanie kart
    dealCards() {
        this.playerCards = [this.deck.pop(), this.deck.pop()];
        this.aiCards = [this.deck.pop(), this.deck.pop()];
        this.communityCards = [];
        
        this.updateDisplay();
    }
    
    // Rozpoczęcie nowej gry
    startNewGame() {
        this.initDeck();
        this.dealCards();
        this.pot = 0;
        this.playerBet = 0;
        this.aiBet = 0;
        this.currentBet = 0;
        this.round = 'pre-flop';
        this.gamePhase = 'betting';
        this.playerAction = '';
        this.aiAction = '';
        
        // Blindy
        this.playerBet = 10; // Small blind
        this.aiBet = 20; // Big blind
        this.currentBet = 20;
        this.playerChips -= 10;
        this.aiChips -= 20;
        this.pot = 30;
        
        this.updateDisplay();
        this.updateControls();
        
        document.getElementById('results').style.display = 'none';
    }
    
    // Aktualizacja wyświetlania
    updateDisplay() {
        // Aktualizacja żetonów i stawek
        document.getElementById('player-chips').textContent = this.playerChips;
        document.getElementById('ai-chips').textContent = this.aiChips;
        document.getElementById('player-bet').textContent = this.playerBet;
        document.getElementById('ai-bet').textContent = this.aiBet;
        document.getElementById('pot').textContent = this.pot;
        document.getElementById('round').textContent = this.round;
        
        // Aktualizacja kart gracza
        this.displayPlayerCards();
        
        // Aktualizacja kart wspólnych
        this.displayCommunityCards();
        
        // Aktualizacja siły ręki gracza
        this.updateHandStrength();
        
        // Aktualizacja akcji AI
        document.getElementById('ai-action').textContent = this.aiAction;
    }
    
    // Wyświetlanie kart gracza
    displayPlayerCards() {
        const playerCardsElement = document.getElementById('player-cards');
        playerCardsElement.innerHTML = '';
        
        this.playerCards.forEach(card => {
            const cardElement = this.createCardElement(card);
            playerCardsElement.appendChild(cardElement);
        });
    }
    
    // Wyświetlanie kart wspólnych
    displayCommunityCards() {
        const communityCardsElement = document.getElementById('community-cards');
        communityCardsElement.innerHTML = '';
        
        for (let i = 0; i < 5; i++) {
            if (i < this.communityCards.length) {
                const cardElement = this.createCardElement(this.communityCards[i]);
                communityCardsElement.appendChild(cardElement);
            } else {
                const cardElement = document.createElement('div');
                cardElement.className = 'card hidden';
                communityCardsElement.appendChild(cardElement);
            }
        }
    }
    
    // Tworzenie elementu karty
    createCardElement(card) {
        const cardElement = document.createElement('div');
        cardElement.className = 'card';
        
        if (card.suit === '♥' || card.suit === '♦') {
            cardElement.classList.add('red');
        } else {
            cardElement.classList.add('black');
        }
        
        cardElement.innerHTML = `
            <div class="rank">${card.rank}</div>
            <div class="suit">${card.suit}</div>
        `;
        
        return cardElement;
    }
    
    // Ocena siły ręki
    evaluateHand(cards) {
        const allCards = [...this.playerCards, ...this.communityCards];
        if (allCards.length < 5) return { rank: 0, name: 'Wysoka karta' };
        
        // Sortowanie kart według wartości
        const sortedCards = allCards.sort((a, b) => b.value - a.value);
        
        // Sprawdzanie różnych układów
        if (this.isRoyalFlush(sortedCards)) return { rank: 10, name: 'Poker królewski' };
        if (this.isStraightFlush(sortedCards)) return { rank: 9, name: 'Poker' };
        if (this.isFourOfAKind(sortedCards)) return { rank: 8, name: 'Kareta' };
        if (this.isFullHouse(sortedCards)) return { rank: 7, name: 'Full house' };
        if (this.isFlush(sortedCards)) return { rank: 6, name: 'Kolor' };
        if (this.isStraight(sortedCards)) return { rank: 5, name: 'Strit' };
        if (this.isThreeOfAKind(sortedCards)) return { rank: 4, name: 'Trójka' };
        if (this.isTwoPair(sortedCards)) return { rank: 3, name: 'Dwie pary' };
        if (this.isPair(sortedCards)) return { rank: 2, name: 'Para' };
        
        return { rank: 1, name: 'Wysoka karta' };
    }
    
    // Sprawdzanie układów kart
    isRoyalFlush(cards) {
        return this.isStraightFlush(cards) && cards[0].value === 14;
    }
    
    isStraightFlush(cards) {
        return this.isFlush(cards) && this.isStraight(cards);
    }
    
    isFourOfAKind(cards) {
        const values = cards.map(card => card.value);
        return values.some(value => values.filter(v => v === value).length === 4);
    }
    
    isFullHouse(cards) {
        return this.isThreeOfAKind(cards) && this.isPair(cards);
    }
    
    isFlush(cards) {
        const suits = cards.map(card => card.suit);
        return suits.some(suit => suits.filter(s => s === suit).length >= 5);
    }
    
    isStraight(cards) {
        const values = [...new Set(cards.map(card => card.value))].sort((a, b) => b - a);
        if (values.length < 5) return false;
        
        for (let i = 0; i <= values.length - 5; i++) {
            let consecutive = true;
            for (let j = 1; j < 5; j++) {
                if (values[i + j] !== values[i] - j) {
                    consecutive = false;
                    break;
                }
            }
            if (consecutive) return true;
        }
        
        // Sprawdzenie A-2-3-4-5
        if (values.includes(14) && values.includes(2) && values.includes(3) && values.includes(4) && values.includes(5)) {
            return true;
        }
        
        return false;
    }
    
    isThreeOfAKind(cards) {
        const values = cards.map(card => card.value);
        return values.some(value => values.filter(v => v === value).length === 3);
    }
    
    isTwoPair(cards) {
        const values = cards.map(card => card.value);
        const pairs = values.filter((value, index) => values.indexOf(value) !== index);
        return new Set(pairs).size >= 2;
    }
    
    isPair(cards) {
        const values = cards.map(card => card.value);
        return values.some(value => values.filter(v => v === value).length === 2);
    }
    
    // Aktualizacja siły ręki gracza
    updateHandStrength() {
        if (this.communityCards.length > 0) {
            const hand = this.evaluateHand([...this.playerCards, ...this.communityCards]);
            document.getElementById('hand-strength').textContent = hand.name;
        } else {
            document.getElementById('hand-strength').textContent = '';
        }
    }
    
    // Aktualizacja kontrolek
    updateControls() {
        const callAmount = this.currentBet - this.playerBet;
        document.getElementById('call-amount').textContent = callAmount;
        
        const checkBtn = document.getElementById('check-btn');
        const callBtn = document.getElementById('call-btn');
        const betSlider = document.getElementById('bet-slider');
        const betInput = document.getElementById('bet-input');
        
        // Sprawdzenie czy gracz może sprawdzić
        if (callAmount === 0) {
            checkBtn.style.display = 'block';
            callBtn.style.display = 'none';
        } else {
            checkBtn.style.display = 'none';
            callBtn.style.display = 'block';
        }
        
        // Ustawienie maksymalnej stawki
        const maxBet = this.playerChips;
        betSlider.max = maxBet;
        betInput.max = maxBet;
        
        // Wyłączenie przycisków jeśli gracz nie ma żetonów
        if (this.playerChips === 0) {
            checkBtn.disabled = true;
            callBtn.disabled = true;
            document.getElementById('bet-btn').disabled = true;
            document.getElementById('all-in-btn').disabled = true;
        }
    }
    
    // Akcje gracza
    playerFold() {
        this.aiChips += this.pot;
        this.showResult('AI wygrywa!', 'Spasowałeś');
    }
    
    playerCheck() {
        this.playerAction = 'Check';
        this.aiTurn();
    }
    
    playerCall() {
        const callAmount = this.currentBet - this.playerBet;
        if (callAmount <= this.playerChips) {
            this.playerChips -= callAmount;
            this.playerBet += callAmount;
            this.pot += callAmount;
            this.playerAction = 'Call';
            this.updateDisplay();
            this.aiTurn();
        }
    }
    
    playerBet(amount) {
        if (amount > this.playerChips) amount = this.playerChips;
        if (amount + this.playerBet <= this.currentBet) return;
        
        this.playerChips -= amount;
        this.playerBet += amount;
        this.pot += amount;
        this.currentBet = this.playerBet;
        
        if (this.playerChips === 0) {
            this.playerAction = 'All-in';
        } else {
            this.playerAction = amount > this.currentBet - this.playerBet ? 'Raise' : 'Bet';
        }
        
        this.updateDisplay();
        this.aiTurn();
    }
    
    playerAllIn() {
        this.playerBet(this.playerChips);
    }
    
    // Logika AI
    aiTurn() {
        setTimeout(() => {
            const handStrength = this.evaluateAIHand();
            const callAmount = this.currentBet - this.aiBet;
            
            if (handStrength < 0.3 && callAmount > 50) {
                // AI składa słabe karty przy wysokiej stawce
                this.aiFold();
            } else if (handStrength > 0.7) {
                // AI podnosi przy mocnych kartach
                this.aiRaise();
            } else if (callAmount === 0) {
                // AI sprawdza jeśli może
                this.aiCheck();
            } else if (handStrength > 0.4 || callAmount < 50) {
                // AI sprawdza przy średnich kartach lub niskiej stawce
                this.aiCall();
            } else {
                // AI składa przy słabych kartach
                this.aiFold();
            }
            
            this.checkRoundEnd();
        }, 1500);
    }
    
    evaluateAIHand() {
        // Prosta ocena siły ręki AI (od 0 do 1)
        const allCards = [...this.aiCards, ...this.communityCards];
        const hand = this.evaluateHand(allCards);
        
        // Bazowa siła na podstawie układu
        let strength = hand.rank / 10;
        
        // Dodatkowe punkty za wysokie karty
        const highCards = this.aiCards.filter(card => card.value >= 10).length;
        strength += highCards * 0.1;
        
        // Dodatkowe punkty za parę w ręce
        if (this.aiCards[0].value === this.aiCards[1].value) {
            strength += 0.3;
        }
        
        return Math.min(strength, 1);
    }
    
    aiFold() {
        this.aiAction = 'Fold';
        this.playerChips += this.pot;
        this.showResult('Wygrywasz!', 'AI spasował');
    }
    
    aiCheck() {
        this.aiAction = 'Check';
        this.updateDisplay();
        this.nextRound();
    }
    
    aiCall() {
        const callAmount = this.currentBet - this.aiBet;
        if (callAmount <= this.aiChips) {
            this.aiChips -= callAmount;
            this.aiBet += callAmount;
            this.pot += callAmount;
            this.aiAction = 'Call';
            this.updateDisplay();
            this.nextRound();
        } else {
            this.aiFold();
        }
    }
    
    aiRaise() {
        const raiseAmount = Math.min(this.aiChips, Math.max(50, this.currentBet * 0.5));
        this.aiChips -= raiseAmount;
        this.aiBet += raiseAmount;
        this.pot += raiseAmount;
        this.currentBet = this.aiBet;
        this.aiAction = 'Raise $' + raiseAmount;
        this.updateDisplay();
        this.updateControls();
    }
    
    // Przejście do następnej rundy
    nextRound() {
        this.playerBet = 0;
        this.aiBet = 0;
        this.currentBet = 0;
        this.playerAction = '';
        this.aiAction = '';
        
        switch(this.round) {
            case 'pre-flop':
                this.round = 'flop';
                this.communityCards.push(this.deck.pop(), this.deck.pop(), this.deck.pop());
                break;
            case 'flop':
                this.round = 'turn';
                this.communityCards.push(this.deck.pop());
                break;
            case 'turn':
                this.round = 'river';
                this.communityCards.push(this.deck.pop());
                break;
            case 'river':
                this.showdown();
                return;
        }
        
        this.updateDisplay();
        this.updateControls();
    }
    
    // Sprawdzenie końca rundy
    checkRoundEnd() {
        if (this.playerBet === this.aiBet && this.aiAction !== '') {
            this.nextRound();
        } else {
            this.updateControls();
        }
    }
    
    // Showdown - porównanie rąk
    showdown() {
        const playerHand = this.evaluateHand([...this.playerCards, ...this.communityCards]);
        const aiHand = this.evaluateHand([...this.aiCards, ...this.communityCards]);
        
        let result;
        if (playerHand.rank > aiHand.rank) {
            result = 'Wygrywasz!';
            this.playerChips += this.pot;
        } else if (aiHand.rank > playerHand.rank) {
            result = 'AI wygrywa!';
            this.aiChips += this.pot;
        } else {
            result = 'Remis!';
            this.playerChips += this.pot / 2;
            this.aiChips += this.pot / 2;
        }
        
        this.showResult(result, '', playerHand.name, aiHand.name);
    }
    
    // Wyświetlenie wyniku
    showResult(title, subtitle = '', playerHandName = '', aiHandName = '') {
        document.getElementById('result-title').textContent = title;
        
        // Pokazanie kart AI
        const aiCardsElement = document.getElementById('ai-cards');
        if (aiCardsElement) {
            aiCardsElement.innerHTML = '';
            this.aiCards.forEach(card => {
                const cardElement = this.createCardElement(card);
                aiCardsElement.appendChild(cardElement);
            });
        }
        
        // Pokazanie finalnych rąk w result-hands
        const resultHands = document.getElementById('result-hands');
        if (resultHands) {
            if (playerHandName) {
                resultHands.innerHTML = `
                    <div class="player-hand">
                        <h4>Twoja ręka:</h4>
                        <div>${playerHandName}</div>
                    </div>
                    <div class="ai-hand">
                        <h4>Ręka komputera:</h4>
                        <div>${aiHandName}</div>
                    </div>
                `;
            } else {
                resultHands.innerHTML = `<div>${subtitle}</div>`;
            }
        }
        
        document.getElementById('results').style.display = 'flex';
        
        // Dodaj event listener dla continue button
        const continueBtn = document.getElementById('continue-btn');
        if (continueBtn) {
            continueBtn.onclick = () => {
                document.getElementById('results').style.display = 'none';
                if (this.playerChips > 0 && this.aiChips > 0) {
                    this.startNewGame();
                }
            };
        }
    }
    
    // Bindowanie eventów
    bindEvents() {
        document.getElementById('fold-btn').addEventListener('click', () => this.playerFold());
        document.getElementById('check-btn').addEventListener('click', () => this.playerCheck());
        document.getElementById('call-btn').addEventListener('click', () => this.playerCall());
        document.getElementById('bet-btn').addEventListener('click', () => {
            const amount = parseInt(document.getElementById('bet-input').value) || 0;
            if (amount > 0) this.playerBet(amount);
        });
        document.getElementById('all-in-btn').addEventListener('click', () => this.playerAllIn());
        document.getElementById('new-game-btn').addEventListener('click', () => this.startNewGame());
        document.getElementById('continue-btn').addEventListener('click', () => {
            document.getElementById('results').style.display = 'none';
            if (this.playerChips > 0 && this.aiChips > 0) {
                this.startNewGame();
            }
        });
        
        // Synchronizacja suwaka i pola input
        const betSlider = document.getElementById('bet-slider');
        const betInput = document.getElementById('bet-input');
        
        betSlider.addEventListener('input', (e) => {
            betInput.value = e.target.value;
        });
        
        betInput.addEventListener('input', (e) => {
            betSlider.value = e.target.value;
        });
    }
}

// Uruchomienie aplikacji
document.addEventListener('DOMContentLoaded', () => {
    new MultiplayerPokerGame();
});
