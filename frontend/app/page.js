'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [error, setError] = useState('');
  const rulesDialogRef = useRef(null);

  useEffect(() => {
    const savedName = localStorage.getItem('cabo_player_name');
    if (savedName) {
      setPlayerName(savedName);
    }
  }, []);

  const getOrCreatePlayerId = () => {
    let playerId = localStorage.getItem('cabo_player_id');
    if (!playerId) {
      playerId = 'cabo_player_' + Math.random().toString(36).substring(2, 11);
      localStorage.setItem('cabo_player_id', playerId);
    }
    return playerId;
  };

  const handleCreateRoom = (e) => {
    e.preventDefault();
    if (!playerName.trim()) {
      setError('Please enter your name.');
      return;
    }
    
    localStorage.setItem('cabo_player_name', playerName.trim());
    getOrCreatePlayerId();
    setError('');

    router.push('/room/new');
  };

  const handleJoinRoom = (e) => {
    e.preventDefault();
    if (!playerName.trim()) {
      setError('Please enter your name.');
      return;
    }
    if (!roomCode.trim() || roomCode.trim().length !== 4) {
      setError('Please enter a valid 4-character room code.');
      return;
    }

    localStorage.setItem('cabo_player_name', playerName.trim());
    getOrCreatePlayerId();
    setError('');

    router.push(`/room/${roomCode.trim().toUpperCase()}`);
  };

  const handleBackdropClick = (e) => {
    const dialog = rulesDialogRef.current;
    if (dialog && e.target === dialog) {
      const rect = dialog.getBoundingClientRect();
      const isInside = (
        rect.top <= e.clientY &&
        e.clientY <= rect.top + rect.height &&
        rect.left <= e.clientX &&
        e.clientX <= rect.left + rect.width
      );
      if (!isInside) {
        dialog.close();
      }
    }
  };

  return (
    <main className="flex-center" style={{ minHeight: '100vh', padding: '24px' }}>
      <div className="glass glass-card" style={{ maxWidth: '480px', width: '100%', borderRadius: '24px' }}>
        
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h1 style={{ 
            fontSize: '3rem', 
            fontWeight: 800, 
            background: 'linear-gradient(135deg, #06b6d4 0%, #8b5cf6 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            textShadow: '0 4px 20px rgba(6, 182, 212, 0.15)',
            marginBottom: '8px'
          }}>
            CABO
          </h1>
          <p style={{ color: 'var(--foreground-muted)', fontWeight: 500 }}>
            Play online with up to 6 friends
          </p>
        </div>

        {error && (
          <div className="banner" style={{ 
            background: 'rgba(244, 63, 94, 0.15)', 
            border: '1px solid var(--color-rose)',
            color: '#fda4af',
            marginBottom: '20px',
            fontSize: '0.9rem'
          }}>
            {error}
          </div>
        )}

        <div style={{ marginBottom: '24px' }}>
          <label style={{ 
            display: 'block', 
            fontSize: '0.85rem', 
            textTransform: 'uppercase', 
            color: 'var(--foreground-muted)',
            letterSpacing: '0.1em',
            marginBottom: '8px',
            fontWeight: 600
          }}>
            Your Display Name
          </label>
          <input 
            type="text" 
            className="glass-input" 
            placeholder="e.g. SecretSpy007" 
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            maxLength={15}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          <button onClick={handleCreateRoom} className="button-glow" style={{ width: '100%', padding: '14px' }}>
            Create New Room
          </button>

          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            color: 'var(--foreground-muted)', 
            fontSize: '0.85rem',
            margin: '8px 0'
          }}>
            <hr style={{ flex: 1, borderColor: 'var(--border-glass)' }} />
            <span style={{ padding: '0 12px', fontWeight: 600 }}>OR</span>
            <hr style={{ flex: 1, borderColor: 'var(--border-glass)' }} />
          </div>

          <form onSubmit={handleJoinRoom} style={{ display: 'flex', gap: '12px' }}>
            <input 
              type="text" 
              className="glass-input" 
              placeholder="ROOM CODE" 
              style={{ flex: 1, textTransform: 'uppercase', textAlign: 'center', fontWeight: 700, letterSpacing: '0.15em' }}
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value)}
              maxLength={4}
            />
            <button type="submit" className="button-outline" style={{ padding: '14px 24px' }}>
              Join
            </button>
          </form>

          <button 
            onClick={() => rulesDialogRef.current?.showModal()} 
            className="button-outline" 
            style={{ border: 'none', background: 'transparent', color: 'var(--color-cyan)', marginTop: '16px', fontWeight: 700 }}
          >
            📖 How to Play & Rules
          </button>

        </div>

      </div>

      <dialog 
        ref={rulesDialogRef} 
        onClick={handleBackdropClick}
        className="glass-heavy"
        style={{ padding: '28px', maxWidth: '560px' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ 
            fontSize: '1.75rem', 
            fontWeight: 800, 
            background: 'linear-gradient(135deg, var(--color-cyan) 0%, var(--color-violet) 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            How to Play CABO
          </h2>
          <button 
            onClick={() => rulesDialogRef.current?.close()} 
            style={{ background: 'transparent', border: 'none', color: 'var(--foreground-muted)', fontSize: '1.5rem', cursor: 'pointer' }}
          >
            &times;
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto', maxHeight: '60vh', fontSize: '0.95rem', lineHeight: '1.6', paddingRight: '8px' }}>
          
          <div><strong>Objective:</strong> End the game with the lowest total card points. You start with 4 face-down cards and must swap/match to minimize their values.</div>
          
          <hr style={{ borderColor: 'var(--border-glass)' }} />
          
          <div><strong>1. Setup & Peeking:</strong> At the start of the round, you get 4 cards in a 2x2 matrix. You can peek at your **bottom two cards** (Card 3 and 4) to memorize their values.</div>

          <div><strong>2. On Your Turn:</strong> Draw a card. You can:
            <ul style={{ paddingLeft: '20px', marginTop: '4px' }}>
              <li>Draw from **Deck**: peek at the card, then either **replace** one of your cards with it, or **discard** it.</li>
              <li>Draw from **Discard Pile**: you *must* use it to replace one of your cards.</li>
            </ul>
          </div>

          <div><strong>3. Special Card Actions (activated when discarded from Deck):</strong>
            <ul style={{ paddingLeft: '20px', marginTop: '4px' }}>
              <li><strong style={{ color: 'var(--color-emerald)' }}>7 or 8 (Know your Fate):</strong> Peek at one of your own cards.</li>
              <li><strong style={{ color: 'var(--color-cyan)' }}>9 or 10:</strong> Peek at one card of any of the opponents.</li>
              <li><strong style={{ color: 'var(--color-violet)' }}>Queen:</strong> Swap one of your cards with an opponent's card without looking.</li>
              <li><strong style={{ color: 'var(--color-gold)' }}>King:</strong> Swap one of your cards with an opponent's card after looking at both.</li>
            </ul>
          </div>

          <div><strong>4. Card Points:</strong>
            <ul style={{ paddingLeft: '20px', marginTop: '4px' }}>
              <li>Aces = 1 point | 2 to 10 = face value | Queen & King = 10 points</li>
              <li><strong style={{ color: 'var(--color-rose)' }}>Jack = -1 point! (Negative scoring card)</strong></li>
            </ul>
          </div>

          <div><strong>5. Card Matching (Reduce Hand Size):</strong> When replacing a card, you can select **multiple matching cards** from your hand (e.g. two 5s). If they match, they are all discarded, and the new card takes the slot of the first one (reducing your hand size). If you mismatch, you keep your cards and get a penalty card face down from the deck!</div>

          <div><strong>6. Calling CABO:</strong> When it is your turn, if you believe you have the lowest sum of card points, you can call **CABO**. You do not draw. Every other player gets one final turn. Then, all cards are revealed.
            <ul style={{ paddingLeft: '20px', marginTop: '4px' }}>
              <li>If the CABO caller has the lowest score: they get **0 points** for the round.</li>
              <li>If another player has a score equal to or lower: the CABO caller gets their sum **+ 10 penalty points**; other players get their normal sums.</li>
            </ul>
          </div>

          <div><strong>7. Game End:</strong> When a player reaches 100 cumulative points, the game ends. Lowest score wins. If you reach exactly 100 points, your score **resets to 50**!</div>

        </div>

        <button 
          onClick={() => rulesDialogRef.current?.close()} 
          className="button-glow" 
          style={{ width: '100%', marginTop: '24px' }}
        >
          Got it, let's play!
        </button>
      </dialog>
    </main>
  );
}
