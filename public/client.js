// client.js – Handles client-side rendering, animations, and UI interactions.
const socket = io({
    reconnection: true,
    reconnection_delay: 1000,
    reconnection_delay_max: 5000,
  });
  
  // Game states
  const GAME_STATE = {
    RUNNING: 'running',
    PAUSED: 'paused',
    GAME_OVER: 'gameover'
  };
  
  // DOM Elements
  const canvas = document.getElementById('game_canvas');
  const ctx = canvas.getContext('2d');
  const score_el = document.getElementById('score');
  const length_el = document.getElementById('length');
  const time_el = document.getElementById('time');
  const start_btn = document.getElementById('start_btn');
  const pause_btn = document.getElementById('pause_btn');
  const reset_btn = document.getElementById('reset_btn');
  const grid_size_input = document.getElementById('grid_size');
  const snake_speed_input = document.getElementById('snake_speed');
  const pathfinding_select = document.getElementById('pathfinding');
  const snake_gradient_select = document.getElementById('snake_gradient');
  const food_gradient_select = document.getElementById('food_gradient');
  
  // Animation and state interpolation
  let last_state = null;
  let current_state = null;
  let state_timestamp = Date.now();
  let client_tick_interval = parseInt(snake_speed_input.value) || 100;
  
  // Responsive canvas
  const resize_canvas = () => {
    const max_width = window.innerWidth * 0.6;
    const max_height = window.innerHeight * 0.8;
    const ASPECT_RATIO = 4 / 3;
    if (max_width / max_height > ASPECT_RATIO) {
      canvas.height = max_height;
      canvas.width = max_height * ASPECT_RATIO;
    } else {
      canvas.width = max_width;
      canvas.height = max_width / ASPECT_RATIO;
    }
  };
  window.addEventListener('resize', resize_canvas);
  resize_canvas();
  
  // Lerp helper
  const lerp = (a, b, t) => a + (b - a) * t;
  
  // Snake gradient
  const get_snake_gradient = () => {
    let gradient;
    switch (snake_gradient_select.value) {
      case 'blue':
        gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        gradient.addColorStop(0, '#2196F3');
        gradient.addColorStop(1, '#0D47A1');
        break;
      case 'rainbow':
        gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        gradient.addColorStop(0, 'red');
        gradient.addColorStop(0.16, 'orange');
        gradient.addColorStop(0.33, 'yellow');
        gradient.addColorStop(0.5, 'green');
        gradient.addColorStop(0.66, 'blue');
        gradient.addColorStop(0.83, 'indigo');
        gradient.addColorStop(1, 'violet');
        break;
      default:
        gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        gradient.addColorStop(0, '#4CAF50');
        gradient.addColorStop(1, '#2E7D32');
        break;
    }
    return gradient;
  };
  
  // Food gradient
  const get_food_gradient = (cx, cy, r) => {
    const grad = ctx.createRadialGradient(cx, cy, 5, cx, cy, r);
    switch (food_gradient_select.value) {
      case 'green':
        grad.addColorStop(0, 'limegreen');
        grad.addColorStop(1, 'green');
        break;
      case 'gold':
        grad.addColorStop(0, 'gold');
        grad.addColorStop(1, 'orange');
        break;
      default:
        grad.addColorStop(0, 'red');
        grad.addColorStop(1, 'darkred');
        break;
    }
    return grad;
  };
  
  // Main loop
  const game_loop = () => {
    requestAnimationFrame(game_loop);
    const now = Date.now();
    const t = Math.min(1, (now - state_timestamp) / client_tick_interval);
    const smooth_t = t * t * (3 - 2 * t); // ease in-out
    render(smooth_t);
  };
  
  const render = (smooth_t) => {
    if (!current_state) return;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  
    const tile_w = canvas.width / current_state.grid_width;
    const tile_h = canvas.height / current_state.grid_height;
  
    // Interpolate snake
    const interpolated_snake = current_state.snake.map((seg, i) => {
      const prev = (last_state && last_state.snake[i]) ? last_state.snake[i] : seg;
      return {
        x: lerp(prev.x, seg.x, smooth_t),
        y: lerp(prev.y, seg.y, smooth_t)
      };
    });
  
    // Snap turning segments
    const final_snake = interpolated_snake.map((seg, i) => {
      if (i > 0 && i < current_state.snake.length - 1) {
        return { x: current_state.snake[i].x, y: current_state.snake[i].y };
      }
      return seg;
    });
  
    // Path visualization
    if (current_state.path && current_state.path.length > 0) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
      ctx.lineWidth = Math.min(tile_w, tile_h) * 0.2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      const head = current_state.snake[0];
      ctx.moveTo(head.x * tile_w + tile_w / 2, head.y * tile_h + tile_h / 2);
      current_state.path.forEach(pt => {
        ctx.lineTo(pt.x * tile_w + tile_w / 2, pt.y * tile_h + tile_h / 2);
      });
      ctx.stroke();
      ctx.restore();
    }
  
    // Draw apple
    if (current_state.apple) {
      const apple_x = current_state.apple.x * tile_w + tile_w / 2;
      const apple_y = current_state.apple.y * tile_h + tile_h / 2;
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      ctx.shadowBlur = 15;
      ctx.fillStyle = get_food_gradient(apple_x, apple_y, Math.min(tile_w, tile_h) / 2);
      ctx.beginPath();
      ctx.arc(apple_x, apple_y, Math.min(tile_w, tile_h) / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  
    // Draw snake
    const snake_width = Math.min(tile_w, tile_h) * 0.8;
    ctx.lineWidth = snake_width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = get_snake_gradient();
    ctx.beginPath();
    final_snake.forEach((seg, idx) => {
      const x = seg.x * tile_w + tile_w / 2;
      const y = seg.y * tile_h + tile_h / 2;
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  
    // Snake head highlight
    const head = interpolated_snake[0];
    ctx.fillStyle = '#81C784';
    ctx.beginPath();
    ctx.arc(
      head.x * tile_w + tile_w / 2,
      head.y * tile_h + tile_h / 2,
      Math.min(tile_w, tile_h) / 2,
      0,
      Math.PI * 2
    );
    ctx.fill();
  };
  
  // Debounced settings
  let settings_timeout;
  const update_settings = () => {
    clearTimeout(settings_timeout);
    settings_timeout = setTimeout(() => {
      client_tick_interval = Math.max(50, Math.min(500, parseInt(snake_speed_input.value) || 100));
      const settings = {
        grid_width: Math.max(10, Math.min(40, parseInt(grid_size_input.value) || 20)),
        grid_height: Math.max(10, Math.min(40, parseInt(grid_size_input.value) || 20)),
        game_speed: client_tick_interval,
        pathfinding: pathfinding_select.value,
        snake_gradient: snake_gradient_select.value,
        food_gradient: food_gradient_select.value
      };
      socket.emit('control', { action: 'update_settings', settings });
      fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      }).catch(err => console.error('Settings update failed:', err));
    }, 250);
  };
  
  // Socket events
  socket.on('game_state', (state) => {
    if (!state || typeof state !== 'object') return;
  
    if (!current_state) {
      current_state = state;
      last_state = state;
    } else {
      last_state = current_state;
      current_state = state;
    }
    state_timestamp = Date.now();
    score_el.textContent = state.score || 0;
    length_el.textContent = state.length || 1;
    time_el.textContent = Math.floor((state.elapsed_time || 0) / 1000);
  });
  
  socket.on('game_over', (data) => {
    if (current_state) current_state.status = GAME_STATE.GAME_OVER;
    console.log('Game Over:', data);
  });
  
  socket.on('connect_error', (error) => {
    console.error('Connection error:', error);
  });
  
  // Buttons
  [start_btn, pause_btn, reset_btn].forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.id.replace('Btn', '');
      socket.emit('control', { action });
    });
  });
  
  // Listen for settings changes
  [
    grid_size_input,
    snake_speed_input,
    pathfinding_select,
    snake_gradient_select,
    food_gradient_select
  ].forEach(el => el.addEventListener('change', update_settings));
  
  // Start render loop
  requestAnimationFrame(game_loop);
  