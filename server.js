const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.static(path.join(__dirname)));

// Zarządzanie pokojami i grami
const rooms = new Map();
const players = new Map();

class PokerRoom {
  constructor(roomId, maxPlayers = 6) {
    this.roomId = roomId;
    this.players = [];
    this.maxPlayers = maxPlayers;
    this.game = null;
    this.isGameActive = false;
  }

  addPlayer(playerId, playerName) {
    if (this.players.length >= this.maxPlayers) {
      return false;
    }
    
    const player = {
      id: playerId,
      name: playerName,
      chips: 1000,
      cards: [],
      bet: 0,
      isActive: true,
      isFolded: false,
      position: this.players.length
    };
    
    this.players.push(player);
    return true;
  }

  removePlayer(playerId) {
    this.players = this.players.filter(p => p.id !== playerId);
    if (this.players.length === 0) {
      rooms.delete(this.roomId);
    }
  }

  getPlayer(playerId) {
    return this.players.find(p => p.id === playerId);
  }

  canStartGame() {
    return this.players.length >= 2 && !this.isGameActive;
  }

  startGame() {
    if (!this.canStartGame()) return false;
    
    this.game = new PokerGame(this);
    this.isGameActive = true;
    this.game.startNewHand();
    return true;
  }
}

class PokerGame {
  constructor(room) {
    this.room = room;
    this.deck = [];
    this.communityCards = [];
    this.pot = 0;
    this.currentBet = 0;
    this.round = 'pre-flop';
    this.currentPlayerIndex = 0;
    this.dealerIndex = 0;
    this.smallBlindIndex = 1;
    this.bigBlindIndex = 2;
    this.bettingRounds = 0;
  }

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
    
    // Tasowanie
    for (let i = this.deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
    }
  }

  getCardValue(rank) {
    switch(rank) {
      case 'J': return 11;
      case 'Q': return 12;
      case 'K': return 13;
      case 'A': return 14;
      default: return parseInt(rank);
    }
  }

  startNewHand() {
    this.initDeck();
    this.communityCards = [];
    this.pot = 0;
    this.currentBet = 0;
    this.round = 'pre-flop';
    this.bettingRounds = 0;

    // Reset graczy
    this.room.players.forEach(player => {
      player.cards = [];
      player.bet = 0;
      player.isFolded = false;
      player.isActive = true;
    });

    // Rozdawanie kart
    this.dealPlayerCards();
    
    // Blindy
    this.handleBlinds();
    
    // Rozpoczęcie licytacji
    this.currentPlayerIndex = (this.bigBlindIndex + 1) % this.room.players.length;
    
    this.broadcastGameState();
  }

  dealPlayerCards() {
    this.room.players.forEach(player => {
      player.cards = [this.deck.pop(), this.deck.pop()];
    });
  }

  handleBlinds() {
    const smallBlind = this.room.players[this.smallBlindIndex % this.room.players.length];
    const bigBlind = this.room.players[this.bigBlindIndex % this.room.players.length];
    
    smallBlind.bet = 10;
    smallBlind.chips -= 10;
    bigBlind.bet = 20;
    bigBlind.chips -= 20;
    
    this.pot = 30;
    this.currentBet = 20;
  }

  playerAction(playerId, action, amount = 0) {
    const player = this.room.getPlayer(playerId);
    if (!player || this.room.players[this.currentPlayerIndex].id !== playerId) {
      return false;
    }

    switch(action) {
      case 'fold':
        player.isFolded = true;
        player.isActive = false;
        break;
      case 'check':
        if (this.currentBet > player.bet) return false;
        break;
      case 'call':
        const callAmount = this.currentBet - player.bet;
        if (callAmount > player.chips) return false;
        player.chips -= callAmount;
        player.bet += callAmount;
        this.pot += callAmount;
        break;
      case 'bet':
      case 'raise':
        if (amount < this.currentBet - player.bet) return false;
        player.chips -= amount;
        player.bet += amount;
        this.pot += amount;
        if (player.bet > this.currentBet) {
          this.currentBet = player.bet;
        }
        break;
      case 'all-in':
        const allInAmount = player.chips;
        player.chips = 0;
        player.bet += allInAmount;
        this.pot += allInAmount;
        if (player.bet > this.currentBet) {
          this.currentBet = player.bet;
        }
        break;
    }

    this.nextPlayer();
    return true;
  }

  nextPlayer() {
    do {
      this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.room.players.length;
    } while (this.room.players[this.currentPlayerIndex].isFolded);

    // Sprawdź czy runda licytacji się skończyła
    if (this.isBettingRoundComplete()) {
      this.nextRound();
    } else {
      this.broadcastGameState();
    }
  }

  isBettingRoundComplete() {
    const activePlayers = this.room.players.filter(p => !p.isFolded);
    return activePlayers.every(p => p.bet === this.currentBet) && 
           this.bettingRounds >= activePlayers.length;
  }

  nextRound() {
    this.bettingRounds = 0;
    this.room.players.forEach(player => {
      player.bet = 0;
    });
    this.currentBet = 0;

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

    this.currentPlayerIndex = this.smallBlindIndex;
    this.broadcastGameState();
  }

  showdown() {
    // Implementacja showdown - porównanie rąk
    const activePlayers = this.room.players.filter(p => !p.isFolded);
    // Tutaj byłaby logika porównywania rąk
    
    // Przesunięcie dealera
    this.dealerIndex = (this.dealerIndex + 1) % this.room.players.length;
    this.smallBlindIndex = (this.dealerIndex + 1) % this.room.players.length;
    this.bigBlindIndex = (this.dealerIndex + 2) % this.room.players.length;
    
    // Rozpoczęcie nowej ręki po 3 sekundach
    setTimeout(() => {
      this.startNewHand();
    }, 3000);
  }

  broadcastGameState() {
    const gameState = {
      roomId: this.room.roomId,
      players: this.room.players.map(p => ({
        id: p.id,
        name: p.name,
        chips: p.chips,
        bet: p.bet,
        isActive: p.isActive,
        isFolded: p.isFolded,
        position: p.position,
        cards: p.cards.length // Nie wysyłamy kart innych graczy
      })),
      communityCards: this.communityCards,
      pot: this.pot,
      currentBet: this.currentBet,
      round: this.round,
      currentPlayerIndex: this.currentPlayerIndex,
      dealerIndex: this.dealerIndex
    };

    // Wyślij stan gry do wszystkich graczy w pokoju
    this.room.players.forEach(player => {
      const personalizedState = { ...gameState };
      personalizedState.yourCards = this.room.getPlayer(player.id).cards;
      io.to(player.id).emit('gameState', personalizedState);
    });
  }
}

// Socket.IO obsługa
io.on('connection', (socket) => {
  console.log('Gracz połączony:', socket.id);

  socket.on('joinRoom', (data) => {
    const { roomId, playerName } = data;
    
    if (!rooms.has(roomId)) {
      rooms.set(roomId, new PokerRoom(roomId));
    }
    
    const room = rooms.get(roomId);
    
    if (room.addPlayer(socket.id, playerName)) {
      players.set(socket.id, { roomId, playerName });
      socket.join(roomId);
      
      socket.emit('joinedRoom', {
        success: true,
        roomId: roomId,
        playersCount: room.players.length,
        players: room.players.map(p => ({ id: p.id, name: p.name, chips: p.chips }))
      });
      
      socket.to(roomId).emit('playerJoined', {
        playerId: socket.id,
        playerName: playerName,
        playersCount: room.players.length
      });
      
      if (room.canStartGame()) {
        io.to(roomId).emit('canStartGame', true);
      }
    } else {
      socket.emit('joinedRoom', { success: false, message: 'Pokój jest pełny' });
    }
  });

  socket.on('startGame', (data) => {
    const playerData = players.get(socket.id);
    if (!playerData) return;
    
    const room = rooms.get(playerData.roomId);
    if (room && room.startGame()) {
      io.to(playerData.roomId).emit('gameStarted');
    }
  });

  socket.on('playerAction', (data) => {
    const playerData = players.get(socket.id);
    if (!playerData) return;
    
    const room = rooms.get(playerData.roomId);
    if (room && room.game) {
      room.game.playerAction(socket.id, data.action, data.amount);
    }
  });

  socket.on('disconnect', () => {
    console.log('Gracz rozłączony:', socket.id);
    
    const playerData = players.get(socket.id);
    if (playerData) {
      const room = rooms.get(playerData.roomId);
      if (room) {
        room.removePlayer(socket.id);
        socket.to(playerData.roomId).emit('playerLeft', {
          playerId: socket.id,
          playersCount: room.players.length
        });
      }
      players.delete(socket.id);
    }
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Serwer uruchomiony na porcie ${PORT}`);
});
