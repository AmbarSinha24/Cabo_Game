'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { io } from 'socket.io-client';

const EMOJIS = ['😮', '😂', '😭', '👑', '🕵️', '🃏'];

export default function RoomClient({ code }) {
  const router = useRouter();
  const socketRef = useRef(null);
  
  // Game states
  const [roomCode, setRoomCode] = useState(code);
  const [players, setPlayers] = useState([]);
  const [isHost, setIsHost] = useState(false);
  const [gameState, setGameState] = useState(null);
  
  // Local interaction states
  const [selectedHandIndices, setSelectedHandIndices] = useState([]);
  const [peekedIndices, setPeekedIndices] = useState([]);
  const [actionRevealCard, setActionRevealCard] = useState(null);
  const [actionRevealTitle, setActionRevealTitle] = useState('');
  
  // Swap action local selections
  const [swapMyCardIndex, setSwapMyCardIndex] = useState(null);
  const [swapTarget, setSwapTarget] = useState(null);
  const [lookSwapReveal, setLookSwapReveal] = useState(null);
  const [transferCardIndex, setTransferCardIndex] = useState(null);
  const [overloadSelect, setOverloadSelect] = useState(null); // { playerId, cardIndex }
  
  // Floating emoji state
  const [floatingEmojis, setFloatingEmojis] = useState([]);
  
  // Connection states
  const [connected, setConnected] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const name = localStorage.getItem('cabo_player_name');
    const playerId = localStorage.getItem('cabo_player_id');

    if (!name || !playerId) {
      router.push('/');
      return;
    }

    // Connect to the backend socket server
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';
    console.log('> Connecting to socket backend:', socketUrl);
    const socket = io(socketUrl);
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      if (code === 'new') {
        socket.emit('create_room', { playerName: name, playerId });
      } else {
        socket.emit('join_room', { roomCode: code, playerName: name, playerId });
      }
    });

    socket.on('room_joined', ({ roomCode: joinedCode, players: initialPlayers, isHost: hostStatus, gameState: activeGame }) => {
      setRoomCode(joinedCode);
      setPlayers(initialPlayers);
      setIsHost(hostStatus);
      if (activeGame) {
        setGameState(activeGame);
      }
      
      if (code === 'new') {
        window.history.replaceState(null, '', `/room/${joinedCode}`);
      }
    });

    socket.on('room_updated', (updatedPlayers) => {
      setPlayers(updatedPlayers);
    });

    socket.on('game_started', (state) => {
      setGameState(state);
      setSelectedHandIndices([]);
      setPeekedIndices([]);
      setInitialRevealedCards({});
      setSwapMyCardIndex(null);
      setSwapTarget(null);
    });

    socket.on('game_state_updated', (state) => {
      setGameState(state);
    });

    socket.on('emoji_received', ({ playerId: senderId, emoji }) => {
      triggerFloatingEmoji(senderId, emoji);
    });

    socket.on('error_message', (msg) => {
      setErrorMsg(msg);
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    return () => {
      socket.disconnect();
    };
  }, [code, router]);

  const triggerFloatingEmoji = (senderId, emoji) => {
    const id = Date.now() + Math.random().toString();
    const leftOffset = Math.random() * 40 - 20;
    const newEmoji = { id, playerId: senderId, emoji, left: leftOffset };
    
    setFloatingEmojis(prev => [...prev, newEmoji]);
    
    setTimeout(() => {
      setFloatingEmojis(prev => prev.filter(e => e.id !== id));
    }, 2500);
  };

  const handleSendEmoji = (emoji) => {
    if (socketRef.current && connected) {
      socketRef.current.emit('send_emoji', { roomCode, emoji });
    }
  };

  const handleStartGame = () => {
    if (socketRef.current) {
      socketRef.current.emit('start_game', { roomCode });
    }
  };

  const handleDrawDeck = () => {
    if (socketRef.current && isMyTurn()) {
      socketRef.current.emit('draw_deck', { roomCode });
    }
  };

  const handleDrawDiscard = () => {
    if (socketRef.current && isMyTurn() && !gameState.activeDrawnCard) {
      socketRef.current.emit('draw_discard', { roomCode });
    }
  };

  const handleDiscardDrawn = (triggerAction = false) => {
    if (socketRef.current && isMyTurn() && gameState.activeDrawnCard) {
      socketRef.current.emit('discard_drawn', { roomCode, triggerAction });
      setSelectedHandIndices([]);
    }
  };

  const handleConfirmReplacement = () => {
    if (socketRef.current && isMyTurn() && gameState.activeDrawnCard && selectedHandIndices.length > 0) {
      socketRef.current.emit('replace_card', { roomCode, handIndices: selectedHandIndices });
      setSelectedHandIndices([]);
    }
  };

  const handleDonePeeking = () => {
    if (socketRef.current) {
      socketRef.current.emit('done_peeking', { roomCode });
    }
  };

  const handleCallCabo = () => {
    if (socketRef.current && isMyTurn() && gameState?.caboPlayerId === null) {
      socketRef.current.emit('call_cabo', { roomCode });
    }
  };

  const handleNextRound = () => {
    if (socketRef.current && isHost) {
      socketRef.current.emit('next_round', { roomCode });
    }
  };

  const handleBackToLobby = () => {
    router.push('/');
  };

  const handleHandCardClick = (idx) => {
    if (!gameState) return;

    const selfPlayer = getSelfPlayer();
    if (!selfPlayer || !selfPlayer.cards[idx]) return;

    if (gameState.status === 'initial_peeking') {
      return;
    }

    // 2. Transfer State active (selecting own card to give away)
    if (gameState.overloadTransferState) {
      if (gameState.overloadTransferState.sourcePlayerId === socketRef.current?.id) {
        setTransferCardIndex(idx);
      }
      return;
    }

    // 3. Turn action checks
    if (isMyTurn()) {
      if (gameState.actionState.type === 'peek' && gameState.actionState.sourcePlayerId === socketRef.current?.id) {
        if (socketRef.current) {
          socketRef.current.emit('execute_action', { roomCode, actionData: { cardIndex: idx } }, (response) => {
            if (response.success) {
              setActionRevealTitle('Peek Card Power');
              setActionRevealCard(response.card);
            }
          });
        }
        return;
      }

      if ((gameState.actionState.type === 'swap' || gameState.actionState.type === 'look_and_swap') && gameState.actionState.sourcePlayerId === socketRef.current?.id) {
        setSwapMyCardIndex(idx);
        return;
      }

      if (gameState.activeDrawnCard) {
        setSelectedHandIndices(prev => {
          if (prev.includes(idx)) {
            return prev.filter(i => i !== idx);
          } else {
            return [...prev, idx];
          }
        });
        return;
      }
    }

    // 4. Otherwise: Select for Overload! (Slapping card out-of-turn or during turn when not matching replace)
    setOverloadSelect({ playerId: socketRef.current?.id, cardIndex: idx });
  };

  const handleOpponentCardClick = (targetPlayerId, cardIndex) => {
    if (!gameState) return;

    if (gameState.actionState.type !== 'none' && gameState.actionState.sourcePlayerId === socketRef.current?.id) {
      if (gameState.actionState.type === 'spy') {
        if (socketRef.current) {
          socketRef.current.emit('execute_action', { 
            roomCode, 
            actionData: { targetPlayerId, cardIndex } 
          }, (response) => {
            if (response.success) {
              const targetName = gameState.players.find(p => p.id === targetPlayerId)?.name || 'Opponent';
              setActionRevealTitle(`Spying on ${targetName}'s Card`);
              setActionRevealCard(response.card);
            }
          });
        }
        return;
      }

      if ((gameState.actionState.type === 'swap' || gameState.actionState.type === 'look_and_swap')) {
        setSwapTarget({ playerId: targetPlayerId, cardIndex });
        return;
      }
    }

    // Otherwise: Select for Overload!
    setOverloadSelect({ playerId: targetPlayerId, cardIndex });
  };

  const handleConfirmSwap = () => {
    if (socketRef.current && isMyTurn() && swapMyCardIndex !== null && swapTarget !== null) {
      const currentActionType = gameState.actionState.type;
      socketRef.current.emit('execute_action', {
        roomCode,
        actionData: {
          myCardIndex: swapMyCardIndex,
          targetPlayerId: swapTarget.playerId,
          targetCardIndex: swapTarget.cardIndex
        }
      }, (response) => {
        if (response.success) {
          if (currentActionType === 'look_and_swap') {
            const targetName = gameState.players.find(p => p.id === swapTarget.playerId)?.name || 'Opponent';
            setLookSwapReveal({
              myCard: response.myCard,
              targetCard: response.targetCard,
              targetName
            });
          }
          setSwapMyCardIndex(null);
          setSwapTarget(null);
        }
      });
    }
  };

  const handleOverloadAttempt = (targetPlayerId, cardIndex) => {
    setOverloadSelect(null);
    if (socketRef.current && gameState && gameState.status === 'playing') {
      if (gameState.overloadTransferState) return;

      socketRef.current.emit('overload_card', { 
        roomCode, 
        targetPlayerId, 
        cardIndex 
      }, (response) => {
        if (!response.success && response.revealCard) {
          const targetName = gameState.players.find(p => p.id === response.revealPlayerId)?.name || 'Player';
          setActionRevealTitle(`Overload Fail - Exposed ${targetName}'s Card`);
          setActionRevealCard(response.revealCard);
        }
      });
    }
  };

  const handleConfirmTransfer = () => {
    if (socketRef.current && transferCardIndex !== null && gameState.overloadTransferState) {
      socketRef.current.emit('transfer_overload_card', { 
        roomCode, 
        cardIndex: transferCardIndex 
      }, (response) => {
        if (response.success) {
          setTransferCardIndex(null);
        }
      });
    }
  };

  const getSelfPlayer = () => {
    return gameState?.players.find(p => p.id === socketRef.current?.id) || 
           players.find(p => p.id === socketRef.current?.id);
  };

  const getOpponents = () => {
    if (!gameState) return players.filter(p => p.id !== socketRef.current?.id);
    return gameState.players.filter(p => p.id !== socketRef.current?.id);
  };

  const isMyTurn = () => {
    if (!gameState || gameState.status !== 'playing') return false;
    const activePlayer = gameState.players[gameState.turnIndex];
    return activePlayer && activePlayer.id === socketRef.current?.id;
  };

  const getActivePlayerName = () => {
    if (!gameState) return '';
    return gameState.players[gameState.turnIndex]?.name || '';
  };

  const getSuitSymbol = (suit) => {
    if (suit === 'hearts') return '♥';
    if (suit === 'diamonds') return '♦';
    if (suit === 'spades') return '♠';
    if (suit === 'clubs') return '♣';
    return '';
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const renderCard = (card, onClick, isSelectable = false, isSelected = false, index = null) => {
    if (!card) {
      return (
        <div className="card-container" style={{ cursor: 'default' }}>
          <div className="card-inner" style={{ border: '1.5px dashed rgba(255, 255, 255, 0.1)', background: 'transparent', height: '100%', borderRadius: '12px' }}>
            <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'rgba(255, 255, 255, 0.15)', fontSize: '0.75rem', fontWeight: 600 }}>
              EMPTY
            </div>
          </div>
        </div>
      );
    }

    const isFlipped = !card.hidden;
    
    const self = getSelfPlayer();
    const isExposed = gameState?.exposedCard && 
                      gameState.exposedCard.playerId === self?.id && 
                      gameState.exposedCard.cardIndex === index;
    
    let powerClass = '';
    let badgeText = '';
    if (isFlipped) {
      if (isExposed) {
        powerClass = 'power-exposed';
        badgeText = 'exposed';
      } else if (card.action === 'peek') {
        powerClass = 'power-peek';
        badgeText = 'peek';
      } else if (card.action === 'spy') {
        powerClass = 'power-spy';
        badgeText = 'spy';
      } else if (card.action === 'swap') {
        powerClass = 'power-swap';
        badgeText = 'swap';
      }
      
      if (!isExposed && card.value === 'K') {
        if (card.points === 0) {
          powerClass = 'power-zero';
          badgeText = '0 pts';
        } else {
          powerClass = 'power-king';
          badgeText = '13 pts';
        }
      }
    }

    const showPeekOverlay = gameState?.status === 'initial_peeking' && !isFlipped && (index === 2 || index === 3);

    return (
      <div 
        onClick={onClick}
        className={`card-container ${isFlipped ? 'flipped' : ''} ${isSelectable ? 'interactive' : ''} ${isSelected ? 'selected' : ''}`}
      >
        <div className="card-inner">
          <div className="card-face card-back">
            <div className="card-back-pattern">
              {showPeekOverlay ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '1.4rem' }}>👁️</span>
                  <span style={{ fontSize: '0.6rem', letterSpacing: '0.05em', opacity: 0.8 }}>PEEK</span>
                </div>
              ) : '♠'}
            </div>
          </div>

          {isFlipped && (
            <div className={`card-face card-front ${powerClass} ${card.suit}`}>
              <div className="card-corner top">
                <span className="card-value">{card.value}</span>
                <span className="card-suit">{getSuitSymbol(card.suit)}</span>
              </div>
              
              {badgeText ? (
                <div className="card-badge">{badgeText}</div>
              ) : (
                <div className="card-center-icon">{getSuitSymbol(card.suit)}</div>
              )}

              <div className="card-corner bottom">
                <span className="card-value">{card.value}</span>
                <span className="card-suit">{getSuitSymbol(card.suit)}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (errorMsg) {
    return (
      <main className="flex-center" style={{ minHeight: '100vh', padding: '24px' }}>
        <div className="glass glass-card" style={{ maxWidth: '400px', width: '100%', textAlign: 'center' }}>
          <h2 style={{ color: 'var(--color-rose)', fontWeight: 800, fontSize: '1.5rem', marginBottom: '16px' }}>Error</h2>
          <p style={{ color: 'var(--foreground-muted)', marginBottom: '24px' }}>{errorMsg}</p>
          <button onClick={handleBackToLobby} className="button-glow" style={{ width: '100%' }}>Back to Home</button>
        </div>
      </main>
    );
  }

  // --- LOBBY SCREEN ---
  if (!gameState || gameState.status === 'lobby') {
    return (
      <main className="flex-center" style={{ minHeight: '100vh', padding: '24px' }}>
        <div className="glass glass-card" style={{ maxWidth: '540px', width: '100%', borderRadius: '24px' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
            <div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Game Lobby</h2>
              <p style={{ color: 'var(--foreground-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
                {connected ? 'Waiting for players...' : 'Connecting to server...'}
              </p>
            </div>
            
            <div onClick={copyRoomCode} style={{ cursor: 'pointer', textAlign: 'right' }}>
              <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--foreground-muted)', fontWeight: 600, letterSpacing: '0.05em' }}>Room Code</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                <span style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-cyan)', letterSpacing: '0.05em' }}>{roomCode}</span>
                <span style={{ fontSize: '1.1rem' }}>{copied ? '✅' : '📋'}</span>
              </div>
            </div>
          </div>

          <div style={{ marginBottom: '32px' }}>
            <h3 style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--foreground-muted)', letterSpacing: '0.1em', marginBottom: '12px', fontWeight: 700 }}>
              Joined Players ({players.length}/6)
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {players.map((p) => (
                <div 
                  key={p.playerId} 
                  className="glass" 
                  style={{ 
                    padding: '12px 16px', 
                    borderRadius: '12px', 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    borderLeft: p.isHost ? '3px solid var(--color-gold)' : '1px solid var(--border-glass)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div className="status-dot online"></div>
                    <span style={{ fontWeight: 600 }}>{p.name} {p.id === socketRef.current?.id && '(You)'}</span>
                  </div>
                  
                  {p.isHost && (
                    <span style={{ fontSize: '0.75rem', background: 'rgba(245, 158, 11, 0.15)', color: 'var(--color-gold)', padding: '2px 8px', borderRadius: '999px', fontWeight: 700 }}>
                      HOST
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {isHost ? (
              <button 
                onClick={handleStartGame} 
                className="button-glow" 
                style={{ width: '100%', padding: '14px' }}
                disabled={players.length < 2 || !connected}
              >
                {players.length < 2 ? 'Need at least 2 players' : 'Start CABO Game'}
              </button>
            ) : (
              <div className="banner" style={{ background: 'rgba(6, 182, 212, 0.1)', color: 'var(--color-cyan)', fontSize: '0.95rem' }}>
                Waiting for the host to start the game...
              </div>
            )}
            
            <button onClick={handleBackToLobby} className="button-outline" style={{ width: '100%' }}>
              Leave Room
            </button>
          </div>

        </div>
      </main>
    );
  }

  // --- GAME BOARD SCREEN ---
  const selfPlayer = getSelfPlayer();
  const opponents = getOpponents();
  const activePlayer = gameState.players[gameState.turnIndex];
  const isMyTurnActive = isMyTurn();
  const canDraw = isMyTurnActive && gameState.status === 'playing' && !gameState.activeDrawnCard;

  return (
    <div className="game-table">
      
      {/* 1. Opponent Ring */}
      <div className="opponents-container">
        {opponents.map((opponent) => {
          const isActive = activePlayer && activePlayer.playerId === opponent.playerId;
          const isCaboCaller = gameState.caboPlayerId === opponent.id;
          
          return (
            <div key={opponent.id || opponent.playerId} className={`glass opponent-box ${isActive ? 'active' : ''}`} style={{ position: 'relative' }}>
              
              {floatingEmojis.filter(e => e.playerId === opponent.playerId).map(e => (
                <span key={e.id} className="floating-emoji" style={{ left: `calc(50% + ${e.left}px)`, top: '-10px' }}>
                  {e.emoji}
                </span>
              ))}

              <div className="player-avatar">
                {opponent.name.charAt(0).toUpperCase()}
                {!opponent.active && (
                  <span style={{ position: 'absolute', bottom: 0, right: 0, width: '12px', height: '12px', background: 'var(--color-rose)', borderRadius: '50%', border: '2px solid var(--bg-deep)' }}></span>
                )}
              </div>
              
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{opponent.name}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--foreground-muted)', marginTop: '2px' }}>
                  Score: <strong style={{ color: 'white' }}>{opponent.score}</strong>
                </div>
              </div>

              {isCaboCaller && (
                <div style={{ 
                  position: 'absolute', 
                  top: '-8px', 
                  right: '-8px', 
                  background: 'var(--color-rose)', 
                  color: 'white', 
                  fontSize: '0.65rem', 
                  padding: '2px 6px', 
                  borderRadius: '6px', 
                  fontWeight: 800,
                  boxShadow: '0 0 8px var(--color-rose)'
                }}>
                  CABO CALLER
                </div>
              )}

              <div className="opponent-cards">
                {opponent.cards.map((c, cIdx) => {
                  if (!c) return <div key={cIdx} style={{ width: '20px', height: '30px', border: '1px dashed rgba(255, 255, 255, 0.1)', borderRadius: '4px' }}></div>;
                  
                  const isFlipped = !c.hidden;
                  const isTargetable = isMyTurnActive && (
                    gameState.actionState.type === 'spy' || 
                    ((gameState.actionState.type === 'swap' || gameState.actionState.type === 'look_and_swap') && swapMyCardIndex !== null)
                  );
                  
                  const isOpponentClickable = gameState.status === 'playing';
                  const isSelectedSwap = swapTarget && swapTarget.playerId === opponent.id && swapTarget.cardIndex === cIdx;
                  const isSelectedOverload = overloadSelect && overloadSelect.playerId === opponent.id && overloadSelect.cardIndex === cIdx;
                  const isOpponentExposed = gameState?.exposedCard && 
                                            gameState.exposedCard.playerId === opponent.id && 
                                            gameState.exposedCard.cardIndex === cIdx;

                  return (
                    <div 
                      key={c.id || cIdx} 
                      onClick={() => isOpponentClickable && handleOpponentCardClick(opponent.id, cIdx)}
                      className={`opponent-card-back ${isFlipped ? 'flipped' : ''}`}
                      style={{ 
                        position: 'relative',
                        cursor: isOpponentClickable ? 'pointer' : 'default',
                        border: isOpponentExposed ? '2.5px solid var(--color-rose)' : isSelectedSwap ? '2px solid var(--color-cyan)' : isTargetable ? '1.5px solid var(--color-violet)' : '1px solid rgba(255, 255, 255, 0.1)',
                        transform: isSelectedSwap ? 'scale(1.15) translateY(-2px)' : 'none',
                        boxShadow: isOpponentExposed ? '0 0 14px var(--color-rose)' : isSelectedSwap ? '0 0 10px var(--color-cyan)' : isTargetable ? '0 0 8px rgba(139, 92, 246, 0.4)' : 'none',
                        transition: 'all 0.2s ease',
                        background: isFlipped ? '#1f2937' : 'linear-gradient(135deg, #1e1b4b 0%, #311042 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: isFlipped ? (c.suit === 'hearts' || c.suit === 'diamonds' ? 'var(--color-rose)' : 'white') : 'transparent',
                        fontSize: '0.65rem',
                        fontWeight: 800
                      }}
                    >
                      {isFlipped && c.value}
                      {isSelectedOverload && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOverloadAttempt(opponent.id, cIdx);
                          }}
                          className="button-glow"
                          style={{ 
                            position: 'absolute', 
                            top: '50%', 
                            left: '50%', 
                            transform: 'translate(-50%, -50%)', 
                            zIndex: 10, 
                            padding: '4px 8px', 
                            fontSize: '0.6rem',
                            background: 'linear-gradient(135deg, var(--color-rose) 0%, var(--color-orange) 100%)',
                            border: 'none',
                            boxShadow: '0 0 10px var(--color-rose)'
                          }}
                        >
                          Overload
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

            </div>
          );
        })}
      </div>

      {/* 2. Central Area */}
      <div className="center-board">
        
        {/* Draw Pile */}
        <div className="pile-container">
          <span className="pile-label">Draw Pile ({gameState.deckCount})</span>
          <div 
            onClick={handleDrawDeck}
            className={`card-container ${canDraw ? 'interactive' : ''}`}
            style={{ 
              pointerEvents: canDraw ? 'auto' : 'none',
              filter: canDraw ? 'none' : 'brightness(0.7)'
            }}
          >
            <div className="card-inner">
              <div className="card-face card-back" style={{ border: canDraw ? '2.5px solid var(--color-cyan)' : '1.5px solid var(--border-glass)' }}>
                <div className="card-back-pattern">♠</div>
              </div>
            </div>
          </div>
        </div>

        {/* Drawn Card */}
        {gameState.activeDrawnCard && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--color-cyan)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Drawn Card
            </span>
            <div className="animate-draw">
              {renderCard(gameState.activeDrawnCard, null, false, false)}
            </div>
            
            {isMyTurnActive && (
              <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                {gameState.drawnCardSource === 'deck' && (
                  <>
                    <button 
                      onClick={() => handleDiscardDrawn(false)} 
                      className="button-outline"
                      style={{ padding: '6px 12px', fontSize: '0.8rem', borderRadius: '8px' }}
                    >
                      Discard
                    </button>
                    {gameState.activeDrawnCard.action !== 'none' && (
                      <button 
                        onClick={() => handleDiscardDrawn(true)} 
                        className="button-glow"
                        style={{ padding: '6px 12px', fontSize: '0.8rem', borderRadius: '8px', background: 'linear-gradient(135deg, var(--color-emerald) 0%, var(--color-cyan) 100%)', boxShadow: 'none' }}
                      >
                        Discard & Act
                      </button>
                    )}
                  </>
                )}
                {gameState.drawnCardSource === 'discard' && (
                  <span style={{ fontSize: '0.8rem', color: 'var(--foreground-muted)', fontWeight: 600 }}>Replace hand card</span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Discard Pile */}
        <div className="pile-container">
          <span className="pile-label">Discard Pile</span>
          {gameState.topDiscard ? (
            <div className="animate-deal" key={gameState.topDiscard.id}>
              {renderCard(
                gameState.topDiscard, 
                handleDrawDiscard, 
                canDraw, 
                false
              )}
            </div>
          ) : (
            <div className="card-container" style={{ border: '2px dashed rgba(255, 255, 255, 0.1)', borderRadius: '12px', height: '135px' }}></div>
          )}
        </div>

      </div>

      {/* 3. Bottom Player Dashboard */}
      <div className="glass player-dashboard" style={{ borderTop: '1px solid var(--border-glass-glow)' }}>
        
        {selfPlayer && floatingEmojis.filter(e => e.playerId === selfPlayer.playerId).map(e => (
          <span key={e.id} className="floating-emoji" style={{ left: `calc(50% + ${e.left}px)`, bottom: '130px' }}>
            {e.emoji}
          </span>
        ))}

        <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="status-dot online"></span>
              <strong style={{ fontSize: '1.05rem' }}>{selfPlayer?.name} (You)</strong>
              <span style={{ fontSize: '0.8rem', background: 'rgba(255,255,255,0.08)', padding: '2px 8px', borderRadius: '6px', color: 'var(--foreground-muted)' }}>
                Score: {selfPlayer?.score}
              </span>
            </div>
            
            <div style={{ color: 'var(--color-cyan)', fontSize: '0.9rem', marginTop: '6px', fontWeight: 600 }}>
              {gameState.status === 'initial_peeking' && (
                <span>👁️ Initial Peek: Memorize your bottom two cards (Card 3 and 4) of the 2x2 grid, then click "Done Peeking" when ready.</span>
              )}
              {gameState.status === 'playing' && isMyTurnActive && !gameState.activeDrawnCard && (
                <span>👉 Your Turn: Draw from the Deck or Discard pile. Or call CABO if ready.</span>
              )}
              {gameState.status === 'playing' && isMyTurnActive && gameState.activeDrawnCard && (
                <span>🃏 Select hand card(s) to replace. Use matching values to discard multiple!</span>
              )}
              {gameState.status === 'playing' && !isMyTurnActive && (
                <span style={{ color: 'var(--foreground-muted)' }}>⏳ Waiting for {getActivePlayerName()}'s turn...</span>
              )}
              
              {gameState.actionState.type === 'peek' && gameState.actionState.sourcePlayerId === socketRef.current?.id && (
                <span style={{ color: 'var(--color-emerald)' }}>🔍 Action Peek: Click one of your own hand cards to peek.</span>
              )}
              {gameState.actionState.type === 'spy' && gameState.actionState.sourcePlayerId === socketRef.current?.id && (
                <span style={{ color: 'var(--color-cyan)' }}>🕵️ Action Spy: Click any card of an opponent to spy.</span>
              )}
              {(gameState.actionState.type === 'swap' || gameState.actionState.type === 'look_and_swap') && gameState.actionState.sourcePlayerId === socketRef.current?.id && (
                <span style={{ color: 'var(--color-violet)' }}>
                  {gameState.actionState.type === 'swap' ? '🔄 Action Swap: Swap cards without looking.' : '👁️ Action Look & Swap: Swap cards after looking at both.'}
                  <br />
                  Select one of your cards and one opponent card.
                  {swapMyCardIndex !== null && ` (Selected My Card #${swapMyCardIndex + 1})`}
                  {swapTarget !== null && ` (Selected Opponent Card)`}
                </span>
              )}
              {gameState.overloadTransferState && (
                <span style={{ color: 'var(--color-gold)' }}>
                  {gameState.overloadTransferState.sourcePlayerId === socketRef.current?.id ? (
                    `👉 Overload Successful! Choose one of your own cards to transfer to ${gameState.players.find(p => p.id === gameState.overloadTransferState.targetPlayerId)?.name || 'Opponent'}.`
                  ) : (
                    `⏳ ${gameState.players.find(p => p.id === gameState.overloadTransferState.sourcePlayerId)?.name || 'Someone'} is transferring a card...`
                  )}
                </span>
              )}
            </div>
          </div>

          <div>
            {gameState.status === 'initial_peeking' && !selfPlayer?.peeked && (
              <button onClick={handleDonePeeking} className="button-glow" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
                Done Peeking
              </button>
            )}
            
             {(gameState.actionState.type === 'swap' || gameState.actionState.type === 'look_and_swap') && gameState.actionState.sourcePlayerId === socketRef.current?.id && (
              <button 
                onClick={handleConfirmSwap} 
                className="button-glow" 
                style={{ padding: '8px 16px', fontSize: '0.85rem', background: 'linear-gradient(135deg, var(--color-violet) 0%, var(--color-cyan) 100%)' }}
                disabled={swapMyCardIndex === null || swapTarget === null}
              >
                Confirm Swap
              </button>
            )}

            {gameState.overloadTransferState && gameState.overloadTransferState.sourcePlayerId === socketRef.current?.id && (
              <button 
                onClick={handleConfirmTransfer} 
                className="button-glow" 
                style={{ padding: '8px 16px', fontSize: '0.85rem', background: 'linear-gradient(135deg, var(--color-gold) 0%, var(--color-orange) 100%)' }}
                disabled={transferCardIndex === null}
              >
                Confirm Transfer
              </button>
            )}

            {isMyTurnActive && gameState.activeDrawnCard && selectedHandIndices.length > 0 && (
              <button 
                onClick={handleConfirmReplacement} 
                className="button-glow" 
                style={{ padding: '8px 16px', fontSize: '0.85rem' }}
              >
                {selectedHandIndices.length > 1 ? 'Match & Replace' : 'Replace Card'}
              </button>
            )}

            {isMyTurnActive && !gameState.activeDrawnCard && gameState.caboPlayerId === null && (
              <button 
                onClick={handleCallCabo} 
                className="button-glow" 
                style={{ padding: '8px 16px', fontSize: '0.85rem', background: 'linear-gradient(135deg, var(--color-rose) 0%, var(--color-violet) 100%)', boxShadow: '0 4px 15px rgba(244,63,94,0.3)' }}
              >
                Call CABO!
              </button>
            )}
          </div>
        </div>

        {/* Hand Cards */}
        <div className="player-cards-hand">
          {selfPlayer?.cards.map((card, idx) => {
            const isSelectable = (isMyTurnActive && (
                                  gameState.activeDrawnCard || 
                                  gameState.actionState.type === 'peek' || 
                                  gameState.actionState.type === 'swap' ||
                                  gameState.actionState.type === 'look_and_swap'
                                )) || (
                                  gameState.overloadTransferState && 
                                  gameState.overloadTransferState.sourcePlayerId === socketRef.current?.id
                                );
                                
            const isClickable = gameState.status === 'playing';
            const isSelected = selectedHandIndices.includes(idx) || (swapMyCardIndex === idx) || (transferCardIndex === idx);

            const isSelectedOverload = overloadSelect && overloadSelect.playerId === socketRef.current?.id && overloadSelect.cardIndex === idx;

            return (
              <div key={card?.id || idx} className="animate-deal" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', position: 'relative' }}>
                {renderCard(
                  card, 
                  () => isClickable && handleHandCardClick(idx), 
                  isClickable || isSelectable, 
                  isSelected,
                  idx
                )}
                {isSelectedOverload && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOverloadAttempt(socketRef.current?.id, idx);
                    }}
                    className="button-glow"
                    style={{ 
                      position: 'absolute', 
                      top: '38%', 
                      left: '50%', 
                      transform: 'translate(-50%, -50%)', 
                      zIndex: 10, 
                      padding: '6px 10px', 
                      fontSize: '0.7rem',
                      background: 'linear-gradient(135deg, var(--color-rose) 0%, var(--color-orange) 100%)',
                      border: 'none',
                      boxShadow: '0 0 12px var(--color-rose)'
                    }}
                  >
                    Overload
                  </button>
                )}
                <span style={{ fontSize: '0.7rem', color: 'var(--foreground-muted)', fontWeight: 700 }}>Card {idx + 1}</span>
              </div>
            );
          })}
        </div>

        <div style={{ width: '100%', display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px', marginTop: '8px', borderTop: '1px solid var(--border-glass)', paddingTop: '16px' }}>
          
          {/* Reaction Tray */}
          <div>
            <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--foreground-muted)', fontWeight: 700, display: 'block', marginBottom: '8px' }}>
              Quick Reactions
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {EMOJIS.map(e => (
                <button 
                  key={e} 
                  onClick={() => handleSendEmoji(e)} 
                  className="glass flex-center" 
                  style={{ width: '36px', height: '36px', borderRadius: '50%', border: '1px solid var(--border-glass-glow)', background: 'rgba(255,255,255,0.03)', cursor: 'pointer', fontSize: '1.25rem', transition: 'all 0.15s ease' }}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          {/* Activity Log */}
          <div>
            <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--foreground-muted)', fontWeight: 700, display: 'block', marginBottom: '8px' }}>
              Game Log
            </span>
            <div className="glass log-panel">
              {gameState.logs.slice().reverse().map((log, idx) => {
                let logClass = 'system';
                if (log.includes('called CABO')) logClass = 'cabo';
                else if (log.includes("turn")) logClass = 'active-turn';
                
                return (
                  <div key={idx} className={`log-entry ${logClass}`}>
                    {log}
                  </div>
                );
              })}
            </div>
          </div>

        </div>

      </div>

      {/* --- ACTION POWER REVEAL DIALOG MODAL --- */}
      {actionRevealCard && (
        <div className="flex-center" style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.8)', zIndex: 2000 }}>
          <div className="glass glass-card" style={{ maxWidth: '320px', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '20px', color: 'var(--color-cyan)', textAlign: 'center' }}>
              {actionRevealTitle}
            </h3>
            
            {renderCard({ ...actionRevealCard, hidden: false }, null, false, false)}
            
            <button 
              onClick={() => {
                setActionRevealCard(null);
                setActionRevealTitle('');
              }} 
              className="button-glow" 
              style={{ width: '100%', marginTop: '28px' }}
            >
              OK, End Turn
            </button>
          </div>
        </div>
      )}
      {/* --- LOOK & SWAP REVEAL DIALOG MODAL --- */}
      {lookSwapReveal && (
        <div className="flex-center" style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.85)', zIndex: 2000 }}>
          <div className="glass glass-card" style={{ maxWidth: '420px', width: '90%', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '20px', color: 'var(--color-cyan)', textAlign: 'center' }}>
              Look & Swap Complete
            </h3>
            
            <p style={{ fontSize: '0.9rem', color: 'var(--foreground-muted)', textAlign: 'center', marginBottom: '20px' }}>
              Here are the cards before they were swapped:
            </p>

            <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', marginBottom: '24px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>Your Card</span>
                {renderCard({ ...lookSwapReveal.myCard, hidden: false }, null, false, false)}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>{lookSwapReveal.targetName}'s Card</span>
                {renderCard({ ...lookSwapReveal.targetCard, hidden: false }, null, false, false)}
              </div>
            </div>
            
            <button 
              onClick={() => setLookSwapReveal(null)} 
              className="button-glow" 
              style={{ width: '100%' }}
            >
              OK, End Turn
            </button>
          </div>
        </div>
      )}


      {/* --- ROUND END SCORE MODAL --- */}
      {gameState.status === 'round_end' && (
        <div className="flex-center" style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.85)', zIndex: 1500 }}>
          <div className="glass glass-card" style={{ maxWidth: '520px', width: '90%', borderRadius: '24px', padding: '32px' }}>
            <h2 style={{ fontSize: '1.75rem', fontWeight: 800, textShadow: '0 4px 10px rgba(0,0,0,0.4)', textAlign: 'center', marginBottom: '24px', background: 'linear-gradient(135deg, var(--color-cyan) 0%, var(--color-violet) 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Round {gameState.roundNumber} Scoring
            </h2>

            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '28px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-glass-glow)', color: 'var(--foreground-muted)' }}>
                  <th style={{ textAlign: 'left', padding: '10px', fontSize: '0.8rem', textTransform: 'uppercase', fontWeight: 700 }}>Player</th>
                  <th style={{ textAlign: 'center', padding: '10px', fontSize: '0.8rem', textTransform: 'uppercase', fontWeight: 700 }}>Round Score</th>
                  <th style={{ textAlign: 'right', padding: '10px', fontSize: '0.8rem', textTransform: 'uppercase', fontWeight: 700 }}>Total Score</th>
                </tr>
              </thead>
              <tbody>
                {gameState.players.map((p) => {
                  const isCabo = p.id === gameState.caboPlayerId;
                  return (
                    <tr key={p.playerId} style={{ borderBottom: '1px solid var(--border-glass)' }}>
                      <td style={{ padding: '12px 10px', fontWeight: 600 }}>
                        {p.name} {p.id === socketRef.current?.id && '(You)'}
                        {isCabo && <span style={{ marginLeft: '8px', fontSize: '0.65rem', background: 'var(--color-rose)', color: 'white', padding: '2px 6px', borderRadius: '4px', fontWeight: 800 }}>CABO</span>}
                      </td>
                      <td style={{ padding: '12px 10px', textAlign: 'center', fontWeight: 700, color: 'var(--color-cyan)' }}>
                        {p.roundScore}
                      </td>
                      <td style={{ padding: '12px 10px', textAlign: 'right', fontWeight: 800 }}>
                        {p.score}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {isHost ? (
              <button onClick={handleNextRound} className="button-glow" style={{ width: '100%', padding: '14px' }}>
                Start Next Round
              </button>
            ) : (
              <div className="banner" style={{ background: 'rgba(6, 182, 212, 0.1)', color: 'var(--color-cyan)', fontSize: '0.9rem' }}>
                Waiting for the host to start the next round...
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- GAME OVER FINAL SCORE MODAL --- */}
      {gameState.status === 'game_over' && (
        <div className="flex-center" style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.9)', zIndex: 1800 }}>
          <div className="glass glass-card" style={{ maxWidth: '480px', width: '90%', borderRadius: '24px', padding: '36px', textAlign: 'center' }}>
            
            <div style={{ fontSize: '3.5rem', marginBottom: '16px' }}>🏆</div>
            
            <h2 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '6px', background: 'linear-gradient(135deg, var(--color-gold) 0%, #f97316) 100%', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Game Finished!
            </h2>
            
            <p style={{ color: 'var(--foreground-muted)', fontSize: '1rem', marginBottom: '24px' }}>
              Final Standings after {gameState.roundNumber} rounds:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '32px' }}>
              {gameState.players
                .slice()
                .sort((a, b) => a.score - b.score)
                .map((p, rank) => (
                  <div 
                    key={p.playerId} 
                    className="glass" 
                    style={{ 
                      padding: '12px 16px', 
                      borderRadius: '12px', 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      borderLeft: rank === 0 ? '3px solid var(--color-gold)' : '1px solid var(--border-glass)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '1.1rem', fontWeight: 800 }}>
                        {rank === 0 ? '🥇' : rank === 1 ? '🥈' : rank === 2 ? '🥉' : `#${rank + 1}`}
                      </span>
                      <span style={{ fontWeight: 600 }}>{p.name}</span>
                    </div>
                    <span style={{ fontWeight: 800, color: rank === 0 ? 'var(--color-gold)' : 'white' }}>
                      {p.score} pts
                    </span>
                  </div>
                ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {isHost ? (
                <button onClick={handleNextRound} className="button-glow" style={{ width: '100%', padding: '14px' }}>
                  Play Again
                </button>
              ) : (
                <div className="banner" style={{ background: 'rgba(245, 158, 11, 0.1)', color: 'var(--color-gold)', fontSize: '0.9rem', marginBottom: '12px' }}>
                  Waiting for host to restart game...
                </div>
              )}
              <button onClick={handleBackToLobby} className="button-outline" style={{ width: '100%' }}>
                Exit to Lobby
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
