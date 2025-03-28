import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import fs from 'fs';
import path from 'path';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import GameLogic from './game/game_logic.js';

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server);

app.use(helmet());
app.use(cors());
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use(limiter);
app.use(express.json());
app.use(express.static(path.join(path.resolve(), 'public')));

const MAX_HIGH_SCORES = 10;
const high_scores_file = path.join(path.resolve(), 'highScores.json');
let high_scores = [];
try {
  high_scores = JSON.parse(fs.readFileSync(high_scores_file, 'utf8'));
} catch (e) {
  high_scores = [];
  fs.writeFileSync(high_scores_file, JSON.stringify([], null, 2));
}

app.get('/api/highscores', (req, res) => res.json(high_scores));
app.post('/api/settings', (req, res) => {
  res.json({ status: "Settings updated", settings: req.body });
});

const game = new GameLogic({
  grid_width: 200,
  grid_height: 200,
  game_speed: 10, // default snake speed
  pathfinding: 'astar'
});

setInterval(() => {
  game.update();
  io.emit('game_state', game.get_state());
}, 50);

io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);
  socket.emit('game_state', game.get_state());

  socket.on('control', (data) => {
    const { action, settings } = data;
    if (action === 'start') game.start();
    else if (action === 'pause') game.pause();
    else if (action === 'reset') game.reset();
    else if (action === 'update_settings') {
      game.update_config(settings);
    }
  });

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

game.on('gameOver', (score, length, elapsed_time) => {
  const new_score = {
    score: Math.floor(score),
    length: Math.floor(length),
    elapsed_time: Math.floor(elapsed_time),
    date: new Date().toISOString()
  };
  high_scores.push(new_score);
  high_scores = high_scores.sort((a, b) => b.score - a.score).slice(0, MAX_HIGH_SCORES);
  try {
    fs.writeFileSync(high_scores_file, JSON.stringify(high_scores, null, 2));
  } catch (error) {
    console.error('Error saving high scores:', error);
  }
  io.emit('game_over', new_score);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Auto-Snake server running on port ${PORT}`));
