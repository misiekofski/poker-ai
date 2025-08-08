# 🃏 Texas Hold'em Poker - Przeglądarkowa Gra

## 📋 Opis

Kompletna przeglądarkowa gra w pokera Texas Hold'em napisana w JavaScript z architekturą modularną. Gra obsługuje zarówno tryb singleplayer (przeciwko AI) jak i multiplayer (WebSocket) z zaawansowanymi funkcjami deweloperskimi.

## ✨ Funkcje

### 🎮 Tryby Gry
- **Singleplayer**: Graj przeciwko inteligentnym botom AI
- **Multiplayer**: Graj z innymi graczami online przez WebSocket
- **Developer Mode**: Zaawansowane narzędzia deweloperskie i debugging

### 🤖 Inteligentne Boty AI
- **6 różnych osobowości**: Tight-Aggressive, Loose-Aggressive, Tight-Passive, Loose-Passive, Maniac, Rock
- **Zaawansowane podejmowanie decyzji**: Analiza siły ręki, pozycji, pot odds
- **Uczenie się**: Boty dostosowują swoją strategię na podstawie historii gier
- **Statystyki**: VPIP, PFR, wskaźniki agresywności

### 🎯 Funkcje Gry
- **Pełne zasady Texas Hold'em**: Preflop, Flop, Turn, River, Showdown
- **Ocena rąk**: Kompletny system oceny wszystkich kombinacji pokerowych
- **Animacje**: Płynne animacje kart, żetonów i akcji graczy
- **Responsywny design**: Działa na desktop i urządzeniach mobilnych
- **Statystyki graczy**: Śledzenie wyników, największe wygrane, style gry

### 🔧 Tryb Deweloperski
- **Debug Panel**: Podgląd stanu gry, kart graczy, statystyk AI
- **Test Cards**: Możliwość ustawienia konkretnych kart do testów
- **Server Stats**: Monitorowanie stanu serwera i pokoi gry
- **Zaawansowane logowanie**: Szczegółowe logi akcji graczy i decyzji AI
- **Bot Management**: Dodawanie/usuwanie botów w czasie rzeczywistym

## 🚀 Szybki Start

### Wymagania
- Node.js 14+ 
- npm lub yarn

### Instalacja i uruchomienie

```bash
# 1. Sklonuj repozytorium
git clone <repository-url>
cd poker

# 2. Zainstaluj zależności
npm install

# 3. Uruchom serwer (tryb deweloperski)
npm run dev

# lub dla trybu produkcyjnego
npm start
```

### 🎮 Rozpoczęcie gry

1. Otwórz przeglądarkę i idź na `http://localhost:3000`
2. Wpisz swoją nazwę gracza
3. Wybierz tryb gry:
   - **Single Player**: Kliknij "Singleplayer" i dodaj boty
   - **Multiplayer**: Kliknij "Multiplayer" i dołącz do pokoju
4. Rozpocznij grę!

## 📁 Struktura Projektu

### Frontend (public/)
```
public/
├── index.html              # Główna strona gry
├── css/
│   └── style.css          # Style gry
└── js/
    ├── shared/            # Moduły współdzielone
    │   ├── Constants.js   # Stałe gry
    │   ├── CardDeck.js    # Karty i talia
    │   └── HandEvaluator.js # Ocena rąk
    ├── utils/             # Narzędzia pomocnicze
    │   ├── Config.js      # Konfiguracja
    │   └── Logger.js      # System logowania
    ├── game/              # Logika gry
    │   ├── Player.js      # Zarządzanie graczami
    │   ├── GameState.js   # Stan gry
    │   ├── GameLogic.js   # Główna logika
    │   └── AI.js          # Sztuczna inteligencja
    ├── ui/                # Interfejs użytkownika
    │   ├── GameTable.js   # Renderowanie stołu
    │   └── GameUI.js      # Kontrolki interfejsu
    ├── network/           # Komunikacja sieciowa
    │   └── NetworkClient.js # Klient WebSocket
    └── main.js            # Inicjalizacja aplikacji
```

### Backend (server/)
```
server/
├── GameServer.js          # Główny serwer gry
├── GameRoom.js           # Zarządzanie pokojami
└── BotManager.js         # Zarządzanie botami AI
```

## 🎮 Instrukcja Gry

### Podstawowe Akcje
- **Fold** (Pas): Odrzuć karty i wyjdź z ręki
- **Check** (Sprawdź): Przejdź dalej bez stawiania (gdy nikt nie podbił)
- **Call** (Dopłać): Dorównaj do najwyższej stawki
- **Raise** (Podbij): Zwiększ stawkę
- **All-in**: Postaw wszystkie żetony

### Fazy Gry
1. **Preflop**: Każdy gracz otrzymuje 2 karty zakryte
2. **Flop**: Odkrywane są 3 karty wspólne
3. **Turn**: Odkrywana jest 4. karta wspólna
4. **River**: Odkrywana jest 5. karta wspólna
5. **Showdown**: Porównanie rąk i wyłonienie zwycięzcy

### Ranking Rąk (od najsilniejszej)
1. **Royal Flush**: A♠ K♠ Q♠ J♠ 10♠
2. **Straight Flush**: 5 kart w sekwencji, ten sam kolor
3. **Four of a Kind**: 4 karty tej samej wartości
4. **Full House**: Trójka + para
5. **Flush**: 5 kart tego samego koloru
6. **Straight**: 5 kart w sekwencji
7. **Three of a Kind**: 3 karty tej samej wartości
8. **Two Pair**: Dwie pary
9. **One Pair**: Jedna para
10. **High Card**: Najwyższa karta

## 🔧 Tryb Deweloperski

### Aktywacja
Tryb deweloperski jest automatycznie aktywny podczas uruchamiania przez `npm run dev`.

### Dostępne Funkcje

#### Debug Panel
- **Game State**: Aktualny stan gry, faza, pula
- **Player Cards**: Karty wszystkich graczy (włącznie z botami)
- **AI Decisions**: Szczegółowe informacje o decyzjach AI
- **Statistics**: Statystyki graczy i botów w czasie rzeczywistym

#### Test Cards
- Możliwość ustawienia konkretnych kart dla gracza
- Przydatne do testowania konkretnych scenariuszy
- Resetowanie do losowych kart

#### Console Commands
```javascript
// Pobierz stan gry
game.getGameState()

// Dodaj bota
game.addBot()

// Ustaw karty gracza
game.setPlayerCards(['AS', 'KS'])

// Pokaż statystyki
game.showStats()
```

### API Zarządzania (Tryb Dev)
- `GET /api/server/status` - Status serwera
- `GET /api/server/rooms` - Lista aktywnych pokoi
- `POST /api/server/rooms/:roomName/restart` - Restart pokoju

## 🌐 Multiplayer

### Połączenie
Gra automatycznie łączy się z serwerem WebSocket i dołącza do domyślnego pokoju.

### Wydarzenia Sieciowe
- **Player Joined/Left**: Informacje o dołączających/opuszczających graczach
- **Game State Updates**: Aktualizacje stanu gry w czasie rzeczywistym
- **Player Actions**: Synchronizacja akcji wszystkich graczy
- **Reconnection**: Automatyczne ponowne łączenie przy utracie połączenia

### Pokoje Gry
- Automatyczne tworzenie pokoi według potrzeb
- Maksymalnie 9 graczy na pokój
- Auto-start gdy jest co najmniej 2 graczy
- Automatyczne usuwanie pustych pokoi

## 🤖 Boty AI

### Osobowości Botów

#### Tight-Aggressive (TAG)
- Gra tylko mocne ręce (15% VPIP)
- Agresywny w grze (high aggression)
- Rzadko blefuje (10%)

#### Loose-Aggressive (LAG)
- Gra dużo rąk (35% VPIP)
- Bardzo agresywny
- Często blefuje (25%)

#### Tight-Passive (Nit)
- Gra bardzo mało rąk (12% VPIP)
- Unika konfrontacji
- Rzadko podnosi

#### Loose-Passive (Calling Station)
- Gra dużo rąk (40% VPIP)
- Często sprawdza i dopłaca
- Rzadko agresywny

#### Maniac
- Gra prawie wszystkie ręce (60% VPIP)
- Maksymalnie agresywny
- Bardzo dużo blefów (40%)

#### Rock
- Gra najmniej rąk (8% VPIP)
- Bardzo konserwatywny
- Prawie nigdy nie blefuje

### Zaawansowane AI
- **Hand Strength Evaluation**: Precyzyjna ocena siły ręki
- **Position Awareness**: Dostosowanie strategii do pozycji przy stole
- **Pot Odds Calculation**: Matematyczne podejście do decyzji
- **Opponent Modeling**: Uczenie się stylów gry przeciwników
- **Adaptive Strategy**: Dostosowanie strategii na podstawie wyników

## 📊 Statystyki

### Statystyki Graczy
- **Hands Played**: Liczba rozegranych rąk
- **Hands Won**: Liczba wygranych rąk
- **Total Winnings**: Łączne wygrane
- **Biggest Win**: Największa wygrana w jednej ręce
- **VPIP**: Voluntarily Put money In Pot
- **PFR**: Pre-Flop Raise percentage
- **Aggression Factor**: Wskaźnik agresywności

### Statystyki Pokoju
- **Hands Played**: Liczba rozegranych rąk w pokoju
- **Total Pot Size**: Łączna wartość pul
- **Biggest Pot**: Największa pula
- **Players Joined**: Liczba graczy, którzy dołączyli

## 🔍 Debugging i Rozwiązywanie Problemów

### Logi
Wszystkie akcje są logowane w konsoli przeglądarki i w debug panelu.

### Częste Problemy

#### Nie można połączyć się z serwerem
```bash
# Sprawdź czy serwer działa
npm run dev

# Sprawdź port
netstat -an | grep 3000
```

#### Gra się zawiesza
- Otwórz narzędzia deweloperskie (F12)
- Sprawdź konsole pod kątem błędów
- Restartuj serwer jeśli potrzeba

#### Boty nie działają
- Upewnij się, że jesteś w trybie deweloperskim
- Sprawdź czy zostały dodane przez debug panel

### Support
W przypadku problemów:
1. Sprawdź konsole przeglądarki (F12)
2. Sprawdź logi serwera w terminalu
3. Użyj debug panelu do analizy stanu gry

## 📝 Scripts

```json
{
  "start": "node server.js",           // Produkcja
  "dev": "NODE_ENV=development node server.js",  // Development
  "test": "echo \"No tests yet\"",     // Testy (TODO)
  "lint": "echo \"No linting yet\""    // Linting (TODO)
}
```

## 🏗️ Architektura Techniczna

### Frontend
- **Vanilla JavaScript ES6+**: Bez frameworków, czysta wydajność
- **Modular Architecture**: Podział na logiczne moduły
- **WebSocket Client**: Komunikacja w czasie rzeczywistym
- **Responsive CSS**: Optymalizacja dla różnych urządzeń

### Backend
- **Node.js + Express**: Serwer HTTP
- **Socket.IO**: WebSocket dla multiplayer
- **Modular Game Logic**: Rozdzielone komponenty gry
- **AI Engine**: Zaawansowane boty z różnymi strategiami

### Komunikacja
- **RESTful API**: Podstawowe operacje
- **WebSocket Events**: Real-time game updates
- **JSON Protocols**: Standaryzowane formaty danych

## 🔮 Roadmap (Przyszłe Funkcje)

### v2.0
- [ ] Tournamnets (turnieje)
- [ ] Sit & Go games
- [ ] Hand history
- [ ] Replay system

### v2.1
- [ ] Achievement system
- [ ] Player profiles
- [ ] Friends system
- [ ] Private rooms

### v2.2
- [ ] Different poker variants (Omaha, 7-Card Stud)
- [ ] Advanced statistics
- [ ] Hand strength trainer
- [ ] AI difficulty levels

## 🤝 Współpraca

Projekt jest open source i przyjmuje pull requesty. 

### Development Setup
```bash
git clone <repo>
cd poker
npm install
npm run dev
```

### Coding Standards
- ES6+ JavaScript
- Modular architecture
- Comprehensive logging
- Error handling
- Comments in Polish for business logic

## 📄 Licencja

MIT License - Zobacz plik LICENSE dla szczegółów.

---

## 🎉 Miłej Gry!

Stworzono z ❤️ dla miłośników pokera i programowania.

**Remember**: Poker to gra umiejętności. Graj odpowiedzialnie! 🃏
