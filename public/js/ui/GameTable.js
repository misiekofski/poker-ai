// GameTable.js - Rendering stołu pokerowego i animacji

class GameTable {
    constructor() {
        this.tableElement = document.querySelector('.poker-table');
        this.communityCardsElement = document.querySelector('.community-cards');
        this.potElement = document.getElementById('pot-display');
        this.playerSeats = {};
        
        // Inicjalizuj miejsca graczy
        this.initializePlayerSeats();
        
        // Konfiguracja animacji
        this.animationConfig = {
            cardDeal: 300,
            chipMovement: 500,
            fadeIn: 200,
            slideIn: 400
        };
        
        logger.debug('GameTable zainicjalizowany');
    }
    
    // Inicjalizuj miejsca graczy
    initializePlayerSeats() {
        const seats = document.querySelectorAll('.player-seat');
        
        seats.forEach((seatElement, index) => {
            this.playerSeats[index] = {
                element: seatElement,
                cardsElement: seatElement.querySelector('.player-cards'),
                infoElement: seatElement.querySelector('.player-info'),
                nameElement: seatElement.querySelector('.player-name'),
                chipsElement: seatElement.querySelector('.player-chips'),
                betElement: seatElement.querySelector('.player-bet'),
                cardSlots: seatElement.querySelectorAll('.player-cards .card-slot'),
                isEmpty: true,
                player: null
            };
        });
    }
    
    // Renderuj stan gry
    renderGameState(gameState) {
        try {
            this.updatePot(gameState.pot);
            this.updateCommunityCards(gameState.communityCards);
            this.updatePlayers(gameState.players);
            this.updateCurrentPlayer(gameState.currentPlayerIndex);
            this.updateDealer(gameState.dealerIndex);
            
        } catch (error) {
            logger.error('Błąd renderowania stanu gry:', error);
        }
    }
    
    // Aktualizuj pulę
    updatePot(amount) {
        if (this.potElement) {
            this.potElement.textContent = amount;
            
            // Animacja pulsowania przy zmianie
            this.potElement.parentElement.classList.add('pulse');
            setTimeout(() => {
                this.potElement.parentElement.classList.remove('pulse');
            }, 500);
        }
    }
    
    // Aktualizuj karty wspólne
    updateCommunityCards(cards) {
        const cardSlots = this.communityCardsElement.querySelectorAll('.card-slot');
        
        cards.forEach((card, index) => {
            if (index < cardSlots.length) {
                this.renderCard(cardSlots[index], card);
            }
        });
        
        // Wyczyść pozostałe sloty
        for (let i = cards.length; i < cardSlots.length; i++) {
            this.clearCard(cardSlots[i]);
        }
    }
    
    // Renderuj kartę
    renderCard(cardSlot, card, hidden = false) {
        if (hidden) {
            cardSlot.textContent = '🂠';
            cardSlot.className = 'card-slot hidden';
        } else {
            cardSlot.textContent = card.toString();
            cardSlot.className = `card-slot revealed ${card.isRed() ? 'red' : 'black'}`;
        }
        
        // Bez animacji skalowania - karty od razu widoczne
        cardSlot.style.transform = 'scale(1)';
    }
    
    // Wyczyść kartę
    clearCard(cardSlot) {
        cardSlot.textContent = '';
        cardSlot.className = 'card-slot';
    }
    
    // Aktualizuj graczy
    updatePlayers(players) {
        // Wyczyść wszystkie miejsca
        Object.values(this.playerSeats).forEach(seat => {
            if (seat.isEmpty) return;
            
            seat.element.style.display = 'none';
            seat.isEmpty = true;
            seat.player = null;
        });
        
        // Umieść graczy
        players.forEach(player => {
            const seat = this.playerSeats[player.seatNumber];
            if (seat) {
                this.renderPlayer(seat, player);
            }
        });
    }
    
    // Renderuj gracza
    renderPlayer(seat, player) {
        seat.element.style.display = 'flex';
        seat.isEmpty = false;
        seat.player = player;
        
        // Aktualizuj informacje
        seat.nameElement.textContent = player.name;
        seat.chipsElement.textContent = `$${player.chips}`;
        seat.betElement.textContent = player.currentBet > 0 ? `$${player.currentBet}` : '';
        
        // Aktualizuj status
        this.updatePlayerStatus(seat, player);
        
        // Aktualizuj karty
        this.updatePlayerCards(seat, player);
    }
    
    // Aktualizuj status gracza
    updatePlayerStatus(seat, player) {
        // Usuń poprzednie klasy statusu
        seat.element.classList.remove('active', 'folded', 'all-in', 'dealer');
        
        // Dodaj odpowiednie klasy
        if (player.status === Constants.PLAYER_STATUS.FOLDED) {
            seat.element.classList.add('folded');
        } else if (player.status === Constants.PLAYER_STATUS.ALL_IN) {
            seat.element.classList.add('all-in');
        }
        
        if (player.isDealer) {
            seat.element.classList.add('dealer');
        }
    }
    
    // Aktualizuj karty gracza
    updatePlayerCards(seat, player) {
        const cardSlots = seat.cardSlots;
        
        if (player.hand && player.hand.length > 0) {
            player.hand.forEach((card, index) => {
                if (index < cardSlots.length) {
                    // Sprawdź czy pokazać kartę czy ukryć
                    const shouldReveal = this.shouldRevealCard(player, index);
                    this.renderCard(cardSlots[index], card, !shouldReveal);
                }
            });
        } else {
            // Wyczyść karty
            cardSlots.forEach(slot => this.clearCard(slot));
        }
    }
    
    // Sprawdź czy pokazać kartę gracza
    shouldRevealCard(player, cardIndex) {
        // Pokaż karty gracza-człowieka (seat 0)
        if (player.seatNumber === 0) return true;
        
        // W trybie dev pokaż karty botów
        if (config.isDev() && config.get('debug.revealBotCards')) return true;
        
        // Pokaż karty po foldzie
        if (player.status === 'folded') return false;
        
        // Domyślnie ukryj karty przeciwników
        return false;
    }
    
    // Aktualizuj aktualnego gracza
    updateCurrentPlayer(currentPlayerIndex) {
        // Usuń poprzednie oznaczenia
        Object.values(this.playerSeats).forEach(seat => {
            seat.element.classList.remove('active');
        });
        
        // Oznacz aktualnego gracza
        if (currentPlayerIndex >= 0) {
            Object.values(this.playerSeats).forEach(seat => {
                if (seat.player && seat.player.seatNumber === currentPlayerIndex) {
                    seat.element.classList.add('active');
                }
            });
        }
    }
    
    // Aktualizuj dealera
    updateDealer(dealerIndex) {
        // Usuń poprzednie oznaczenia dealera
        Object.values(this.playerSeats).forEach(seat => {
            seat.element.classList.remove('dealer');
        });
        
        // Oznacz dealera
        if (dealerIndex >= 0) {
            Object.values(this.playerSeats).forEach(seat => {
                if (seat.player && seat.player.seatNumber === dealerIndex) {
                    seat.element.classList.add('dealer');
                }
            });
        }
    }
    
    // Animacje
    
    // Animuj rozdanie kart
    animateCardDeal(targetElement, delay = 0) {
        return new Promise(resolve => {
            setTimeout(() => {
                targetElement.style.transform = 'rotateY(180deg)';
                setTimeout(() => {
                    targetElement.style.transform = 'rotateY(0deg)';
                    resolve();
                }, this.animationConfig.cardDeal / 2);
            }, delay);
        });
    }
    
    // Animuj ruch żetonów do puli
    animateChipsToPot(fromElement, amount) {
        return new Promise(resolve => {
            // Utwórz animowany element żetonów
            const chipElement = document.createElement('div');
            chipElement.className = 'animated-chips';
            chipElement.textContent = `$${amount}`;
            chipElement.style.position = 'absolute';
            chipElement.style.zIndex = '1000';
            chipElement.style.pointerEvents = 'none';
            chipElement.style.color = '#ffd700';
            chipElement.style.fontWeight = 'bold';
            
            // Pozycja startowa
            const fromRect = fromElement.getBoundingClientRect();
            const tableRect = this.tableElement.getBoundingClientRect();
            
            chipElement.style.left = `${fromRect.left - tableRect.left}px`;
            chipElement.style.top = `${fromRect.top - tableRect.top}px`;
            
            this.tableElement.appendChild(chipElement);
            
            // Pozycja docelowa (środek stołu)
            const potElement = this.potElement.parentElement;
            const potRect = potElement.getBoundingClientRect();
            
            const targetX = potRect.left - tableRect.left;
            const targetY = potRect.top - tableRect.top;
            
            // Animacja
            chipElement.style.transition = `all ${this.animationConfig.chipMovement}ms ease-out`;
            setTimeout(() => {
                chipElement.style.left = `${targetX}px`;
                chipElement.style.top = `${targetY}px`;
                chipElement.style.opacity = '0';
                
                setTimeout(() => {
                    chipElement.remove();
                    resolve();
                }, this.animationConfig.chipMovement);
            }, 50);
        });
    }
    
    // Animuj pulsowanie elementu (wyłączone aby nie mrugały karty)
    animatePulse(element, duration = 1000) {
        // Zamiast animacji pulse, dodajemy subtelny efekt
        element.style.boxShadow = '0 0 20px rgba(40, 167, 69, 0.8)';
        setTimeout(() => {
            element.style.boxShadow = '';
        }, duration);
    }
    
    // Animuj shake (błąd)
    animateShake(element) {
        element.style.animation = 'shake 500ms ease-in-out';
        setTimeout(() => {
            element.style.animation = '';
        }, 500);
    }
    
    // Animuj fade in
    animateFadeIn(element, duration = null) {
        const animDuration = duration || this.animationConfig.fadeIn;
        element.style.opacity = '0';
        element.style.transition = `opacity ${animDuration}ms ease-in`;
        
        setTimeout(() => {
            element.style.opacity = '1';
        }, 50);
    }
    
    // Animuj slide in
    animateSlideIn(element, direction = 'up', duration = null) {
        const animDuration = duration || this.animationConfig.slideIn;
        const transform = {
            up: 'translateY(20px)',
            down: 'translateY(-20px)',
            left: 'translateX(20px)',
            right: 'translateX(-20px)'
        };
        
        element.style.transform = transform[direction] || transform.up;
        element.style.opacity = '0';
        element.style.transition = `all ${animDuration}ms ease-out`;
        
        setTimeout(() => {
            element.style.transform = 'translateX(0) translateY(0)';
            element.style.opacity = '1';
        }, 50);
    }
    
    // Wyświetl wiadomość na stole
    showTableMessage(message, type = 'info', duration = 3000) {
        const messageElement = document.createElement('div');
        messageElement.className = `table-message ${type}`;
        messageElement.textContent = message;
        messageElement.style.position = 'absolute';
        messageElement.style.top = '50%';
        messageElement.style.left = '50%';
        messageElement.style.transform = 'translate(-50%, -50%)';
        messageElement.style.background = 'rgba(0, 0, 0, 0.8)';
        messageElement.style.color = '#fff';
        messageElement.style.padding = '1rem 2rem';
        messageElement.style.borderRadius = '10px';
        messageElement.style.zIndex = '1000';
        messageElement.style.fontSize = '1.2rem';
        messageElement.style.fontWeight = 'bold';
        
        this.tableElement.appendChild(messageElement);
        
        // Animacja pojawienia się
        this.animateFadeIn(messageElement);
        
        // Usuń po określonym czasie
        setTimeout(() => {
            messageElement.style.opacity = '0';
            setTimeout(() => {
                if (messageElement.parentNode) {
                    messageElement.remove();
                }
            }, 300);
        }, duration);
    }
    
    // Podświetl dostępne akcje
    highlightAvailableActions(actions) {
        // Ta metoda będzie implementowana w GameUI.js
        if (window.gameUI) {
            window.gameUI.highlightActions(actions);
        }
    }
    
    // Resetuj stół
    resetTable() {
        // Wyczyść karty wspólne
        const communitySlots = this.communityCardsElement.querySelectorAll('.card-slot');
        communitySlots.forEach(slot => this.clearCard(slot));
        
        // Wyczyść karty graczy
        Object.values(this.playerSeats).forEach(seat => {
            if (!seat.isEmpty) {
                seat.cardSlots.forEach(slot => this.clearCard(slot));
                seat.betElement.textContent = '';
                seat.element.classList.remove('active', 'folded', 'all-in', 'dealer');
            }
        });
        
        // Resetuj pulę
        this.updatePot(0);
        
        logger.debug('Stół zresetowany');
    }
    
    // Testowe funkcje (tryb dev)
    
    // Pokaż testowe karty
    showTestCards() {
        if (!config.isDev()) return;
        
        // Przykładowe karty do testów
        const testCommunity = [
            new Card(Constants.SUITS.HEARTS, 'A'),
            new Card(Constants.SUITS.SPADES, 'K'),
            new Card(Constants.SUITS.DIAMONDS, 'Q'),
            new Card(Constants.SUITS.CLUBS, 'J'),
            new Card(Constants.SUITS.HEARTS, '10')
        ];
        
        this.updateCommunityCards(testCommunity);
        this.showTableMessage('Testowe karty ustawione', 'info', 2000);
    }
    
    // Symuluj animację rozdania
    simulateCardDeal() {
        if (!config.isDev()) return;
        
        // Wyłączone aby karty nie mrugały
        // const communitySlots = this.communityCardsElement.querySelectorAll('.card-slot');
        // communitySlots.forEach((slot, index) => {
        //     setTimeout(() => {
        //         this.animateCardDeal(slot);
        //     }, index * 200);
        // });
    }
    
    // Uzyskaj informacje o stole (do debugowania)
    getTableInfo() {
        return {
            activePlayers: Object.values(this.playerSeats).filter(seat => !seat.isEmpty).length,
            communityCards: this.communityCardsElement.querySelectorAll('.card-slot.revealed').length,
            currentPot: this.potElement.textContent,
            tableElement: this.tableElement,
            playerSeats: this.playerSeats
        };
    }
}

// Eksport dla przeglądarki
if (typeof window !== 'undefined') {
    window.GameTable = GameTable;
}
