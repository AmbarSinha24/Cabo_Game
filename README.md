# 🃏 CABO Online - Multiplayer Card Game

[![Next.js](https://img.shields.io/badge/Frontend-Next.js%2015-black?style=for-the-badge&logo=next.dot.js)](https://nextjs.org/)
[![Socket.io](https://img.shields.io/badge/Sockets-Socket.io-blue?style=for-the-badge&logo=socket.dot.io)](https://socket.io/)
[![MongoDB](https://img.shields.io/badge/Database-MongoDB%20Atlas-green?style=for-the-badge&logo=mongodb)](https://www.mongodb.com/)
[![License](https://img.shields.io/badge/License-MIT-purple?style=for-the-badge)](https://opensource.org/licenses/MIT)

A high-speed, online multiplayer implementation of the **CABO** card game for up to 6 players. Built with a decoupled monorepo architecture featuring a premium dark glassmorphic UI, fluid 3D card flips, real-time reactions, out-of-turn card slapping, and automated round scoring.

---

## 🎮 Game Rules & Mechanics

The goal of CABO is to minimize the total sum of points in your hand. 

### 1. Initial Peeking (2x2 Grid)
* Each player's 4 cards are dealt in a **2x2 grid**.
* At the start of a round, **your bottom two cards (Card 3 and 4) automatically flip face-up** so you can memorize them.
* Clicking **"Done Peeking"** flips them back face-down.
* During active play, all cards remain face-down unless revealed by special action powers or matches.

### 2. Card Value & Points
* **Number Cards (Ace to 10)**: Face value (Ace = 1, 2 to 10 = face value)
* **Jack**: **-1 point** (very good!)
* **Queen & King**: **10 points**

### 3. Discard Action Powers
Drawing a card from the Deck and discarding it unlocks special powers:
* **7 or 8 (Know your Fate)**: Peek (look at one of your own cards).
* **9 or 10**: Spy (look at an opponent's card).
* **Queen**: Swap (swap one of your cards with an opponent's card *without* looking at either).
* **King**: Look & Swap (swap one of your cards with an opponent's card *after* looking at both).

> [!NOTE]
> Action powers are optional. Players can choose to discard a power card and simply let the power go if they do not wish to use it.

---

## ⚡ Real-Time Overloading (Slapping)

At any point during the playing phase, **any player can match a card in play with the top card of the Discard Pile out of turn**.

* **Slap Safety**: Clicking a card highlights it and displays an **"Overload"** confirmation button. Clicking this button confirms the slap, preventing accidental triggers.
* **Race Condition**: Only the first player to successfully submit a match has their card processed. Slower attempts are rejected.
* **Success**:
  * **Your Card**: The matched card is discarded, leaving an empty slot in your hand (your card count decreases).
  * **Opponent's Card**: The opponent's card is discarded. You must immediately **choose one of your own cards to transfer to that opponent** (your card count decreases, theirs stays the same).
* **Failure (Penalties & Exposure)**:
  * If a player mismatches or submits a late match, **their card is exposed face-up on the board to all players for 4 seconds** with a bright red neon alert before flipping back face-down automatically.
  * **Own Card Penalty**: 1 penalty card dealt face-down from the deck.
  * **Opponent Card Penalty**: 3 penalty cards dealt face-down from the deck.

---

## 🏆 Declaring CABO & Scoring
* **Calling CABO**: When you believe your hand has the lowest sum, you can declare **CABO** on your turn. Every other player gets one final turn. All cards are revealed:
  * If the CABO caller has the lowest score: they get **0 points** for the round.
  * Otherwise, the caller gets their sum **+ 10 penalty points**; other players get their normal sums.
* **Scoring Resets**: Reaching exactly 50 cumulative points resets your score to 50. Reaching exactly 100 resets it to 50. The game ends when any player crosses 100 points. The player with the lowest score wins.

---

## 📁 Directory Structure

```
├── package.json          # Monorepo root script coordinator
├── frontend/             # Next.js App Router UI (Port 3000)
│   ├── app/              # Layout, styles, page views, room actions
│   └── package.json      # Frontend dependencies (socket.io-client)
└── backend/              # Standalone Node Server (Port 3001)
    ├── index.js          # Express app + Socket.io gateway (node --watch)
    ├── lib/
    │   ├── game.js       # CABO card game rules engine
    │   └── db.js         # MongoDB Atlas Mongoose adapter
    └── package.json      # Backend dependencies (express, socket.io, mongoose, cors)
```

---

## 🚀 Getting Started

### Prerequisites
* **Node.js**: v18.11.0 or higher (supports native `--watch` mode)
* **npm**: v9.0.0 or higher

### Local Setup

1. **Install Dependencies**:
   Install dependencies for both the `frontend/` and `backend/` directories simultaneously by running this command in the project root:
   ```bash
   npm run install-all
   ```

2. **Configure Environment Variables**:
   * **Backend (`backend/.env`)**:
     Create a `.env` file in the `backend/` directory:
     ```env
     PORT=3001
     CORS_ORIGIN=http://localhost:3000
     MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/cabo?retryWrites=true&w=majority
     ```
     *(Note: If `MONGODB_URI` is omitted, the backend will automatically run in in-memory fallback mode, printing warnings but allowing full gameplay without database requirements).*

   * **Frontend (`frontend/.env.local`)**:
     Create a `.env.local` file in the `frontend/` directory:
     ```env
     NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
     ```

3. **Run in Development Mode**:
   Boot both the frontend and backend servers concurrently by running this command in the root monorepo directory:
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000` in multiple browser windows or private browsing sessions to simulate multiplayer rounds.

---

## 🌐 Deployment

Because the stack is split, deployment is simple and cost-efficient:

### Frontend (e.g., Vercel)
* Connect your repository to Vercel and point the root build directory to the `frontend/` folder.
* Set the environment variable:
  `NEXT_PUBLIC_SOCKET_URL` = Your deployed backend WebSocket server URL (e.g. `https://cabo-backend.onrender.com`).

### Backend (e.g., Render, Railway, or Fly.io)
* Connect your repository and point the build directory to the `backend/` folder.
* Configure start scripts: `npm start` (runs `node index.js`).
* Set environment variables:
  * `PORT`: Automatically assigned by most cloud providers.
  * `CORS_ORIGIN`: Your deployed frontend Vercel URL (e.g. `https://cabo-game.vercel.app`).
  * `MONGODB_URI`: Your MongoDB Atlas database URI string.
