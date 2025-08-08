# Texas Hold'em Poker - Multiplayer Web Game

Gra w pokera Texas Hold'em z możliwością gry online dla maksymalnie 6 graczy lub w trybie single-player przeciwko AI.

## Funkcjonalności

### 🎮 **Tryby gry**
- **Multiplayer Online** - gra online dla 2-6 graczy
- **Single Player** - gra przeciwko inteligentnym AI

### 🃏 **Rozgrywka**
- Pełne rundy Texas Hold'em: Pre-flop, Flop, Turn, River
- System blindów i normalnych reguł licytacji
- Wszystkie standardowe układy pokerowe
- Responsywny design dla urządzeń mobilnych

### 🌐 **Multiplayer**
- Tworzenie i dołączanie do pokojów gier
- Real-time komunikacja przez WebSocket
- Automatyczne zarządzanie turnami
- Wyświetlanie pozycji dealera i aktualnego gracza

## Jak grać

### Tryb Online
1. Wprowadź swoje imię
2. Opcjonalnie wprowadź ID pokoju (lub zostanie wygenerowany automatycznie)
3. Poczekaj na innych graczy (minimum 2)
4. Rozpocznij grę!

### Tryb Single Player
1. Kliknij "Gra z AI"
2. Graj przeciwko inteligentnemu komputerowi

## Technologie

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Backend**: Node.js, Express, Socket.IO
- **Deployment**: GitHub Pages + GitHub Actions

## Instalacja lokalna

1. Sklonuj repozytorium
2. Zainstaluj zależności: `npm install`
3. Uruchom serwer: `npm start`
4. Otwórz `http://localhost:3000` w przeglądarce

## Deployment

Aplikacja automatycznie deployuje się na GitHub Pages przy każdym push do brancha `main`.

### Frontend (GitHub Pages)
- Strona statyczna z klientem gry
- Automatyczny fallback do trybu single-player

### Backend (Heroku/Railway)
- Serwer Socket.IO dla funkcjonalności multiplayer
- Zarządzanie pokojami i stanem gry

## Struktura projektu

```
poker/
├── index.html          # Główna strona aplikacji
├── style.css           # Style CSS
├── script.js           # Logika gry (frontend)
├── server.js           # Serwer multiplayer
├── package.json        # Zależności npm
└── .github/
    └── workflows/
        └── deploy.yml  # GitHub Actions
```

## Reguły gry

- **Blindy**: Mały blind $10, duży blind $20
- **Wszystkie standardowe akcje**: Fold, Check, Call, Bet, Raise, All-in
- **Układy kart**: Od wysokiej karty do pokera królewskiego
- **Wygrywanie**: Najlepszy układ z 5 kart (2 w ręce + 5 wspólnych)

Miłej gry! 🎲🃏
