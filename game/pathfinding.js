const is_valid = (pos, state) =>
    pos.x >= 0 && pos.x < state.grid_width &&
    pos.y >= 0 && pos.y < state.grid_height &&
    !state.snake.some(segment => segment.x === pos.x && segment.y === pos.y);
  
  const get_neighbors = (pos, state) => {
    const directions = [
      { x: 0, y: -1, name: 'up' },
      { x: 1, y: 0, name: 'right' },
      { x: 0, y: 1, name: 'down' },
      { x: -1, y: 0, name: 'left' }
    ];
    return directions
      .map(dir => ({
        x: pos.x + dir.x,
        y: pos.y + dir.y,
        direction: dir
      }))
      .filter(neighbor => is_valid(neighbor, state));
  };
  
  const heuristic = (pos, target) =>
    Math.abs(pos.x - target.x) + Math.abs(pos.y - target.y);
  
  // direction reconstruction
  const reconstruct_direction = (node) => {
    if (!node || !node.parent) return null;
    let current = node;
    let first_move = null;
    while (current.parent) {
      first_move = current;
      current = current.parent;
    }
    return first_move.direction || null;
  };
  
  // path reconstruction
  const reconstruct_path = (node) => {
    if (!node || !node.parent) return [];
    const path = [];
    let current = node;
    while (current.parent) {
      path.unshift(current.pos);
      current = current.parent;
    }
    return path;
  };
  
  /* A* (f = g + h) */
  const astar = (state, target) => {
    if (!target) return { direction: null, path: [] };
    const start = state.snake[0];
  
    const open_set = new Set([JSON.stringify(start)]);
    const closed_set = new Set();
    let nodes = [{ pos: start, g: 0, f: heuristic(start, target), parent: null }];
  
    while (nodes.length > 0) {
      nodes.sort((a, b) => a.f - b.f);
      const current = nodes.shift();
      open_set.delete(JSON.stringify(current.pos));
      closed_set.add(JSON.stringify(current.pos));
  
      if (current.pos.x === target.x && current.pos.y === target.y) {
        return {
          direction: reconstruct_direction(current),
          path: reconstruct_path(current)
        };
      }
  
      const neighbors = get_neighbors(current.pos, state);
      for (const neighbor of neighbors) {
        const neighbor_key = JSON.stringify(neighbor);
        if (closed_set.has(neighbor_key)) continue;
  
        const tentative_g = current.g + 1;
        let existing = nodes.find(n => n.pos.x === neighbor.x && n.pos.y === neighbor.y);
  
        if (!existing) {
          nodes.push({
            pos: neighbor,
            g: tentative_g,
            f: tentative_g + heuristic(neighbor, target),
            parent: current,
            direction: neighbor.direction
          });
          open_set.add(neighbor_key);
        } else if (tentative_g < existing.g) {
          existing.g = tentative_g;
          existing.f = tentative_g + heuristic(neighbor, target);
          existing.parent = current;
          existing.direction = neighbor.direction;
        }
      }
    }
    return { direction: null, path: [] };
  };
  
  /* BFS */
  const bfs = (state, target) => {
    if (!target) return { direction: null, path: [] };
    const start = state.snake[0];
    const queue = [{ pos: start, parent: null, direction: null }];
    const visited = new Set([JSON.stringify(start)]);
  
    while (queue.length > 0) {
      const current = queue.shift();
      if (current.pos.x === target.x && current.pos.y === target.y) {
        return {
          direction: reconstruct_direction(current),
          path: reconstruct_path(current)
        };
      }
      const neighbors = get_neighbors(current.pos, state);
      for (const neighbor of neighbors) {
        const key = JSON.stringify(neighbor);
        if (!visited.has(key)) {
          visited.add(key);
          queue.push({
            pos: neighbor,
            parent: current,
            direction: neighbor.direction
          });
        }
      }
    }
    return { direction: null, path: [] };
  };
  
  /* DFS */
  const dfs = (state, target) => {
    if (!target) return { direction: null, path: [] };
    const start = state.snake[0];
    const stack = [{ pos: start, parent: null, direction: null }];
    const visited = new Set([JSON.stringify(start)]);
    let best_path = null;
    let min_distance = Infinity;
  
    const sort_neighbors = (arr) => arr.sort((a, b) =>
      heuristic(a, target) - heuristic(b, target)
    );
  
    while (stack.length > 0) {
      const current = stack.pop();
      if (current.pos.x === target.x && current.pos.y === target.y) {
        const dist = heuristic(start, current.pos);
        if (dist < min_distance) {
          min_distance = dist;
          best_path = current;
        }
        continue;
      }
  
      const neighbors = sort_neighbors(get_neighbors(current.pos, state));
      for (const neighbor of neighbors) {
        const key = JSON.stringify(neighbor);
        if (!visited.has(key)) {
          visited.add(key);
          stack.push({
            pos: neighbor,
            parent: current,
            direction: neighbor.direction
          });
        }
      }
    }
  
    if (best_path) {
      return {
        direction: reconstruct_direction(best_path),
        path: reconstruct_path(best_path)
      };
    }
    return { direction: null, path: [] };
  };
  
  export { astar, bfs, dfs };
  