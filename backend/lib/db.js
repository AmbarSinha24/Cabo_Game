// MongoDB Atlas Connection and History Logging
const mongoose = require('mongoose');

let isConnected = false;

async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.warn('\x1b[33m%s\x1b[0m', '⚠️ WARNING: MONGODB_URI is not defined. Game results will not be saved to the database. Running in in-memory mode.');
    return false;
  }

  if (isConnected) {
    return true;
  }

  try {
    await mongoose.connect(uri);
    isConnected = true;
    console.log('> Successfully connected to MongoDB Atlas.');
    return true;
  } catch (error) {
    console.error('❌ MongoDB Connection Error:', error.message);
    console.warn('\x1b[33m%s\x1b[0m', '⚠️ Continuing in in-memory fallback mode.');
    return false;
  }
}

// Define Game Schema
const GameHistorySchema = new mongoose.Schema({
  roomCode: { type: String, required: true },
  roundNumber: { type: Number, required: true },
  players: [
    {
      name: String,
      playerId: String,
      score: Number
    }
  ],
  winnerName: { type: String, required: true },
  playedAt: { type: Date, default: Date.now }
});

const GameHistory = mongoose.models.GameHistory || mongoose.model('GameHistory', GameHistorySchema);

// Save game history to database
async function saveGameHistory(gameData) {
  if (!isConnected) {
    console.log('> In-memory mode: skipped saving game history.');
    return null;
  }

  try {
    const historyRecord = new GameHistory(gameData);
    await historyRecord.save();
    return historyRecord;
  } catch (error) {
    console.error('❌ Failed to save game history:', error.message);
    return null;
  }
}

module.exports = {
  connectDB,
  saveGameHistory
};
