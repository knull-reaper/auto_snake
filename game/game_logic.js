import EventEmitter from 'events';
import * as Pathfinding from './pathfinding.js';

export default class GameLogic extends EventEmitter {
  constructor(config = {}) {
    super();
    // default configuration on load
    this.config = {
      grid_width: 20,
      grid_height: 20,
      game_speed: 100,
      pathfinding: 'astar',
      ...config
    };

    this.status = 'ready';
    this.paused_at = null;
    this.reset();
  }

  reset() {
    this.snake = [{
      x: Math.floor(this.config.grid_width / 2),
      y: Math.floor(this.config.grid_height / 2)
    }];
    this.direction = { x: 1, y: 0 };
    this.spawn_apple();
    this.score = 0;
    this.length = 1;
    this.elapsed_time = 0;
    this.status = 'ready';
    this.paused_at = null;
    this.last_update_time = Date.now();
    this.last_apple_time = Date.now();
  }

  spawn_apple() {
    const { grid_width, grid_height } = this.config;
    let valid = false;
    let apple;
    do {
      apple = {
        x: Math.floor(Math.random() * grid_width),
        y: Math.floor(Math.random() * grid_height)
      };
      // don't spawn apple on snake
      valid = !this.snake.some(seg => seg.x === apple.x && seg.y === apple.y);
    } while (!valid);
    this.apple = apple;
    this.last_apple_time = Date.now();
    // console.log('Spawned apple at:', apple.x, apple.y); // debug
  }

  start() {
    this.status = 'running';
    this.paused_at = null;
    this.last_update_time = Date.now();
  }

  pause() {
    this.status = 'paused';
    this.paused_at = Date.now();
  }

  update_config(new_config) {
    this.config = { ...this.config, ...new_config };
  }

  update() {
    if (this.status === 'paused') return;

    const now = Date.now();
    const delta = now - this.last_update_time;
    if (delta < this.config.game_speed) return;

    this.elapsed_time += delta;
    this.last_update_time = now;

    const target = this.apple;
    let new_direction;
    let current_path = [];

    try {
      const pathfinding_result = Pathfinding[this.config.pathfinding]?.(this.get_state(), target);
      if (pathfinding_result) {
        new_direction = pathfinding_result.direction;
        current_path = pathfinding_result.path;
        if (new_direction && this.is_valid_move(new_direction)) {
          this.direction = new_direction;
        }
      }
    } catch (error) {
      console.error('Pathfinding error:', error);
    }
    this.current_path = current_path;

    const new_head = {
      x: this.snake[0].x + this.direction.x,
      y: this.snake[0].y + this.direction.y
    };

    // check if snake collides with itself or wall
    if (this.is_collision(new_head)) {
      this.status = 'gameover';
      this.emit('gameOver', this.score, this.length, this.elapsed_time);
      this.reset();
      return;
    }

    this.snake.unshift(new_head);

    // check if apple is eaten
    if (this.is_apple_eaten(new_head)) {
      const time_since_apple = Date.now() - this.last_apple_time;
      const bonus = Math.max(0, Math.floor((5000 - time_since_apple) / 1000));
      this.score += 10 + bonus;
      this.length++;
      this.spawn_apple();
    } else {
      this.snake.pop();
    }
  }

  is_collision(pos) {
    return (
      pos.x < 0 ||
      pos.x >= this.config.grid_width ||
      pos.y < 0 ||
      pos.y >= this.config.grid_height ||
      this.snake.some(s => s.x === pos.x && s.y === pos.y)
    );
  }

  is_valid_move(direction) {
    if (!direction) return false;
    const new_head = {
      x: this.snake[0].x + direction.x,
      y: this.snake[0].y + direction.y
    };
    return !this.is_collision(new_head);
  }

  is_apple_eaten(pos) {
    return pos.x === this.apple.x && pos.y === this.apple.y;
  }

  get_state() {
    return {
      snake: [...this.snake],
      apple: { ...this.apple },
      score: this.score,
      length: this.length,
      elapsed_time: this.elapsed_time,
      time_since_apple: Date.now() - this.last_apple_time,
      grid_width: this.config.grid_width,
      grid_height: this.config.grid_height,
      status: this.status,
      path: this.current_path || []
    };
  }
}
