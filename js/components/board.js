/* ==========================================================================
   Tactics Board Component
   Handles overlays, draggable player/ball nodes, drawing overlays, and opponents.
   ========================================================================== */

import { STANDARD_FORMATIONS } from '../utils/formations.js';

export class TacticsBoard {
  constructor(state) {
    this.state = state;
    this.activeTeamId = null;

    // DOM Elements
    this.overlay = document.getElementById('board-overlay');
    this.pitchWrapper = document.getElementById('board-pitch-wrapper');
    this.canvas = document.getElementById('tactics-canvas');
    this.playersContainer = document.getElementById('board-players-container');
    this.ball = document.getElementById('tactics-ball');
    
    this.teamTitle = document.getElementById('board-team-title');
    this.formationSubtitle = document.getElementById('board-formation-subtitle');
    
    this.btnClose = document.getElementById('btn-close-board');
    this.btnAddOpponent = document.getElementById('btn-board-add-opponent');
    this.btnReset = document.getElementById('btn-board-reset');
    this.btnClearDrawings = document.getElementById('btn-board-clear-drawings');
    this.btnSetDefense = document.getElementById('btn-board-set-defense');
    this.defenseDropdown = document.getElementById('board-defense-dropdown');
    this.defenseList = document.getElementById('board-defense-list');
    this.defenseLabel = document.getElementById('board-defense-label');
    this.defenseChevron = document.getElementById('board-defense-chevron');

    // Defense state
    this.activeDefenseFormationId = null; // null = No Defense
    this.teamPlayerCount = 9; // updated when board opens

    // Drawing Canvas Variables - literal colors from variables.css
    this.penColors = {
      red:   'hsl(350, 85%, 45%)',  // --danger
      blue:  'hsl(200, 90%, 40%)',  // --info
      black: 'hsl(220, 40%, 10%)'  // --text-main
    };
    this.ctx = null;
    this.isDrawing = false;
    this.penColor = this.penColors.red; // Default to Red
    this.penWidth = 4;
    this.drawingHistory = []; // Array of completed paths
    this.currentPath = null;  // Active path

    // Drag-and-drop state
    this.draggedElement = null;
    this.dragOffset = { x: 0, y: 0 };
    this.loadedPositions = []; // To allow reset to initial state

    if (this.canvas) {
      this.ctx = this.canvas.getContext('2d');
    }

    this.bindEvents();
  }

  bindEvents() {
    // Close overlay
    if (this.btnClose) {
      this.btnClose.addEventListener('click', () => this.close());
    }

    // Controls
    if (this.btnAddOpponent) {
      this.btnAddOpponent.addEventListener('click', () => this.addOpponent());
    }
    if (this.btnReset) {
      this.btnReset.addEventListener('click', () => this.resetField());
    }
    if (this.btnClearDrawings) {
      this.btnClearDrawings.addEventListener('click', () => this.clearDrawings());
    }

    // Defense Formation Picker
    if (this.btnSetDefense) {
      this.btnSetDefense.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleDefenseDropdown();
      });
    }

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (this.defenseDropdown && this.defenseDropdown.classList.contains('open')) {
        if (!this.btnSetDefense.contains(e.target) && !this.defenseDropdown.contains(e.target)) {
          this.closeDefenseDropdown();
        }
      }
    });

    // Color Pickers
    const colorDots = document.querySelectorAll('.color-dot');
    colorDots.forEach(dot => {
      dot.addEventListener('click', () => {
        colorDots.forEach(d => d.classList.remove('active'));
        dot.classList.add('active');
        
        const color = dot.getAttribute('data-color');
        this.penColor = this.penColors[color] || this.penColors.red;
      });
    });

    // Canvas Drawing Event Listeners (Mouse & Touch)
    if (this.canvas) {
      // Mouse events
      this.canvas.addEventListener('mousedown', (e) => this.startDrawing(e.clientX, e.clientY));
      this.canvas.addEventListener('mousemove', (e) => this.draw(e.clientX, e.clientY));
      this.canvas.addEventListener('mouseup', () => this.stopDrawing());
      this.canvas.addEventListener('mouseleave', () => this.stopDrawing());

      // Touch events
      this.canvas.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
          const t = e.touches[0];
          this.startDrawing(t.clientX, t.clientY);
        }
      });
      this.canvas.addEventListener('touchmove', (e) => {
        if (e.touches.length === 1) {
          e.preventDefault(); // Stop mobile scrolling while sketching
          const t = e.touches[0];
          this.draw(t.clientX, t.clientY);
        }
      });
      this.canvas.addEventListener('touchend', () => this.stopDrawing());
    }

    // Draggable events for Ball
    if (this.ball) {
      this.makeElementDraggable(this.ball);
    }

    // Global drag move / end listeners to ensure smooth sliding even outside boundaries
    window.addEventListener('mousemove', (e) => this.dragMove(e.clientX, e.clientY));
    window.addEventListener('mouseup', () => this.dragEnd());

    window.addEventListener('touchmove', (e) => {
      if (this.draggedElement && e.touches.length === 1) {
        e.preventDefault();
        const t = e.touches[0];
        this.dragMove(t.clientX, t.clientY);
      }
    }, { passive: false });
    window.addEventListener('touchend', () => this.dragEnd());

    // Window resize handler
    window.addEventListener('resize', () => this.resizeCanvas());
  }

  /**
   * Open the overlay and populate current formation layout
   * @param {string} teamId 
   */
  open(teamId) {
    this.activeTeamId = teamId;
    const team = this.state.getTeam(teamId);
    if (team) {
      this.teamPlayerCount = team.playerCount || 9;
    }
    // Rebuild defense dropdown for this team's player count
    this.buildDefenseDropdown();
    if (!team) return;

    if (this.overlay) {
      this.overlay.classList.add('active');
    }

    // Set headers
    if (this.teamTitle) this.teamTitle.textContent = team.name;

    // Load active match lineup if live, otherwise fall back to squad default
    const match = this.state.activeMatch;
    let positionsToLoad = [];
    let titleStr = '';

    if (match && match.teamId === teamId) {
      // Live match - load on-field players and coordinates
      titleStr = `Match Lineup: ${match.formation.name}`;
      
      // We align the player positions on field
      const activePlayers = match.players.filter(p => p.isOnField && p.position);
      const formation = match.formation;
      
      activePlayers.forEach(p => {
        // Find coordinate preset for position tag
        const coord = formation.positions.find(pos => pos.label === p.position);
        positionsToLoad.push({
          id: p.id,
          name: p.name,
          number: p.number,
          role: p.positionRole || 'MID',
          label: p.position,
          x: coord ? coord.x : 50,
          y: coord ? coord.y : 50
        });
      });
    } else {
      // Not in-game - load squad settings and roster default
      const forms = this.state.getFormationsForTeam(teamId);
      const formation = forms.find(f => f.id === team.defaultFormationId) || forms.find(f => f.playerCount === team.playerCount);
      
      titleStr = `Tactical Preset: ${formation ? formation.name : team.playerCount + 'v' + team.playerCount}`;
      
      if (formation) {
        // Assign roster players to formation nodes
        formation.positions.forEach((pos, idx) => {
          const player = team.players[idx];
          positionsToLoad.push({
            id: player ? player.id : `generic_${idx}`,
            name: player ? player.name : '',
            number: player ? player.number : '',
            role: pos.role,
            label: pos.label,
            x: pos.x,
            y: pos.y
          });
        });
      }
    }

    if (this.formationSubtitle) {
      this.formationSubtitle.textContent = titleStr;
    }

    this.loadedPositions = JSON.parse(JSON.stringify(positionsToLoad));
    this.renderPlayers(positionsToLoad);
    
    // Reset ball position to center
    if (this.ball) {
      this.ball.style.left = '50%';
      this.ball.style.top = '50%';
    }

    // Resize canvas and clear
    setTimeout(() => {
      this.resizeCanvas();
      this.clearDrawings();
    }, 50);
  }

  close() {
    if (this.overlay) {
      this.overlay.classList.remove('active');
    }
  }

  renderPlayers(players) {
    if (!this.playersContainer) return;
    this.playersContainer.innerHTML = '';

    players.forEach(p => {
      const nodeEl = document.createElement('div');
      nodeEl.className = 'player-node running board-player';
      nodeEl.style.left = `${p.x}%`;
      nodeEl.style.top = `${p.y}%`;

      const roleColor = this.getRoleColor(p.role);

      nodeEl.innerHTML = `
        <div class="player-node-badge" style="border-color: var(--text-main);">
          <span class="player-node-pos-tag" style="background-color: ${roleColor};">${p.label}</span>
          <span class="player-node-number">${p.number || '★'}</span>
        </div>
        ${p.name ? `<div class="player-node-name" style="text-shadow: 0 1px 2px white;">${p.name}</div>` : ''}
      `;

      this.makeElementDraggable(nodeEl);
      this.playersContainer.appendChild(nodeEl);
    });
  }

  /**
   * Defense Formation Picker
   */
  buildDefenseDropdown() {
    if (!this.defenseList) return;
    this.defenseList.innerHTML = '';

    const formations = STANDARD_FORMATIONS.filter(f => f.playerCount === this.teamPlayerCount);

    // "No Defense" option first
    const noDefBtn = document.createElement('button');
    noDefBtn.className = 'board-defense-option no-defense-option' + (this.activeDefenseFormationId === null ? ' active-defense' : '');
    noDefBtn.innerHTML = '<span>&#x26D4;</span> No Defense (Clear All)';
    noDefBtn.addEventListener('click', () => {
      this.applyDefenseFormation(null);
    });
    this.defenseList.appendChild(noDefBtn);

    formations.forEach(f => {
      const btn = document.createElement('button');
      btn.className = 'board-defense-option' + (this.activeDefenseFormationId === f.id ? ' active-defense' : '');
      btn.innerHTML = `<span>&#x1F6E1;&#xFE0F;</span> ${f.name}`;
      btn.dataset.formationId = f.id;
      btn.addEventListener('click', () => {
        this.applyDefenseFormation(f.id);
      });
      this.defenseList.appendChild(btn);
    });
  }

  toggleDefenseDropdown() {
    if (!this.defenseDropdown) return;
    const isOpen = this.defenseDropdown.classList.contains('open');
    if (isOpen) {
      this.closeDefenseDropdown();
    } else {
      this.defenseDropdown.classList.add('open');
      if (this.defenseChevron) this.defenseChevron.style.transform = 'rotate(180deg)';
    }
  }

  closeDefenseDropdown() {
    if (!this.defenseDropdown) return;
    this.defenseDropdown.classList.remove('open');
    if (this.defenseChevron) this.defenseChevron.style.transform = '';
  }

  /**
   * Apply a defensive formation preset, placing opponent nodes at mirrored DEF positions.
   * @param {string|null} formationId - The formation ID or null for No Defense.
   */
  applyDefenseFormation(formationId) {
    this.closeDefenseDropdown();

    if (formationId === null) {
      // Clear all opponent nodes
      this.clearOpponents();
      this.activeDefenseFormationId = null;
      if (this.defenseLabel) this.defenseLabel.textContent = 'No Defense';
      this.buildDefenseDropdown();
      return;
    }

    const formation = STANDARD_FORMATIONS.find(f => f.id === formationId);
    if (!formation) return;

    // Clear existing opponents before placing new ones
    this.clearOpponents();

    // Extract only DEF-role positions (excludes GK, MID, FW)
    const defPositions = formation.positions.filter(p => p.role === 'DEF');

    defPositions.forEach((pos, idx) => {
      // Mirror the y-coordinate to the attacking half (top of field)
      // DEF positions sit at y~70-75%, mirrored to ~25-30%
      const mirroredY = 100 - pos.y;

      const oppEl = document.createElement('div');
      oppEl.className = 'player-node opponent-node board-player';
      oppEl.style.left = `${pos.x}%`;
      oppEl.style.top = `${mirroredY}%`;

      oppEl.innerHTML = `
        <div class="player-node-badge" style="border-color: var(--danger); background-color: var(--danger-light);">
          <span class="player-node-pos-tag" style="background-color: var(--danger); color: white; font-size: 9px;">${pos.label}</span>
          <span class="player-node-number" style="color: var(--danger); font-size: 13px;">DEF</span>
        </div>
      `;

      // Double click / double-tap to remove
      oppEl.addEventListener('dblclick', (e) => { e.stopPropagation(); oppEl.remove(); });
      let lastTap = 0;
      oppEl.addEventListener('touchend', (e) => {
        const now = Date.now();
        if (now - lastTap < 300 && now - lastTap > 0) { e.preventDefault(); oppEl.remove(); }
        lastTap = now;
      });

      this.makeElementDraggable(oppEl);
      if (this.playersContainer) this.playersContainer.appendChild(oppEl);
    });

    this.activeDefenseFormationId = formationId;
    if (this.defenseLabel) this.defenseLabel.textContent = formation.name;
    this.buildDefenseDropdown(); // Refresh to show active-defense highlight
  }

  clearOpponents() {
    if (!this.playersContainer) return;
    const opps = this.playersContainer.querySelectorAll('.opponent-node');
    opps.forEach(o => o.remove());
  }

  addOpponent() {
    if (!this.playersContainer) return;

    // Create a red defender/opponent node
    const oppEl = document.createElement('div');
    oppEl.className = 'player-node opponent-node board-player';
    oppEl.style.left = '50%';
    oppEl.style.top = '35%'; // Spawn near attacking half

    oppEl.innerHTML = `
      <div class="player-node-badge" style="border-color: var(--danger); background-color: var(--danger-light);">
        <span class="player-node-number" style="color: var(--danger); font-size: 14px;">OPP</span>
      </div>
      <div class="player-node-name" style="color: var(--danger); text-shadow: 0 1px 2px white; font-weight: 800;">Defender</div>
    `;

    // Double click to remove opponent
    oppEl.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      oppEl.remove();
    });

    // Support double tap for touch devices
    let lastTap = 0;
    oppEl.addEventListener('touchend', (e) => {
      const currentTime = new Date().getTime();
      const tapLength = currentTime - lastTap;
      if (tapLength < 300 && tapLength > 0) {
        e.preventDefault();
        oppEl.remove();
      }
      lastTap = currentTime;
    });

    this.makeElementDraggable(oppEl);
    this.playersContainer.appendChild(oppEl);
  }

  resetField() {
    this.renderPlayers(this.loadedPositions);
    if (this.ball) {
      this.ball.style.left = '50%';
      this.ball.style.top = '50%';
    }
  }

  /**
   * Drag-and-drop helpers
   */
  makeElementDraggable(el) {
    const startDrag = (clientX, clientY) => {
      this.draggedElement = el;
      el.classList.add('dragging');
      
      const rect = el.getBoundingClientRect();
      // dragOffset represents distance from center of badge to touch point
      this.dragOffset = {
        x: clientX - (rect.left + rect.width / 2),
        y: clientY - (rect.top + rect.height / 2)
      };
    };

    el.addEventListener('mousedown', (e) => {
      e.stopPropagation(); // Stop drawing on empty field
      startDrag(e.clientX, e.clientY);
    });

    el.addEventListener('touchstart', (e) => {
      e.stopPropagation(); // Stop drawing
      if (e.touches.length === 1) {
        const t = e.touches[0];
        startDrag(t.clientX, t.clientY);
      }
    }, { passive: false });
  }

  dragMove(clientX, clientY) {
    if (!this.draggedElement || !this.pitchWrapper) return;

    const rect = this.pitchWrapper.getBoundingClientRect();
    
    // Position client coords relative to pitch canvas container boundaries
    let x = clientX - rect.left - this.dragOffset.x;
    let y = clientY - rect.top - this.dragOffset.y;

    // Convert to percentage
    let xPercent = (x / rect.width) * 100;
    let yPercent = (y / rect.height) * 100;

    // Constrain elements on the pitch
    xPercent = Math.max(3, Math.min(97, xPercent));
    yPercent = Math.max(3, Math.min(97, yPercent));

    this.draggedElement.style.left = `${xPercent}%`;
    this.draggedElement.style.top = `${yPercent}%`;
  }

  dragEnd() {
    if (this.draggedElement) {
      this.draggedElement.classList.remove('dragging');
      this.draggedElement = null;
    }
  }

  /**
   * Canvas Drawing Engine
   */
  resizeCanvas() {
    if (!this.canvas || !this.pitchWrapper) return;
    
    // Set internal resolution matching the container size
    this.canvas.width = this.pitchWrapper.clientWidth;
    this.canvas.height = this.pitchWrapper.clientHeight;
    
    this.redrawCanvas();
  }

  clearDrawings() {
    this.drawingHistory = [];
    this.currentPath = null;
    this.redrawCanvas();
  }

  startDrawing(clientX, clientY) {
    if (!this.ctx || !this.canvas) return;
    this.isDrawing = true;
    
    const rect = this.canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    this.currentPath = {
      points: [{ x, y }],
      color: this.penColor,
      width: this.penWidth
    };
    
    this.redrawCanvas();
  }

  draw(clientX, clientY) {
    if (!this.isDrawing || !this.currentPath || !this.canvas) return;

    const rect = this.canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    const points = this.currentPath.points;
    const lastPoint = points[points.length - 1];

    // Throttle duplicate points
    if (Math.hypot(x - lastPoint.x, y - lastPoint.y) > 1.5) {
      points.push({ x, y });
      this.redrawCanvas();
    }
  }

  stopDrawing() {
    if (this.isDrawing && this.currentPath) {
      if (this.currentPath.points.length >= 2) {
        this.drawingHistory.push(this.currentPath);
      }
      this.currentPath = null;
      this.isDrawing = false;
      this.redrawCanvas();
    }
  }

  redrawCanvas() {
    if (!this.ctx || !this.canvas) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Render completed paths (smooth lines + arrows)
    this.drawingHistory.forEach(path => {
      this.drawSmoothPath(path);
      this.drawArrowhead(path);
    });

    // Render active path
    if (this.currentPath) {
      this.drawSmoothPath(this.currentPath);
    }
  }

  drawSmoothPath(path) {
    const pts = path.points;
    if (pts.length < 2) return;

    this.ctx.beginPath();
    this.ctx.strokeStyle = path.color;
    this.ctx.lineWidth = path.width;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';

    this.ctx.moveTo(pts[0].x, pts[0].y);

    if (pts.length === 2) {
      this.ctx.lineTo(pts[1].x, pts[1].y);
      this.ctx.stroke();
      return;
    }

    // Quadratic curve smoothing
    let i;
    for (i = 1; i < pts.length - 2; i++) {
      const xc = (pts[i].x + pts[i + 1].x) / 2;
      const yc = (pts[i].y + pts[i + 1].y) / 2;
      this.ctx.quadraticCurveTo(pts[i].x, pts[i].y, xc, yc);
    }

    this.ctx.quadraticCurveTo(
      pts[i].x,
      pts[i].y,
      pts[i + 1].x,
      pts[i + 1].y
    );
    this.ctx.stroke();
  }

  drawArrowhead(path) {
    const pts = path.points;
    if (pts.length < 2) return;

    const endPoint = pts[pts.length - 1];
    
    // Find stable direction vector by walking back a few points
    let prevIdx = pts.length - 2;
    let prevPoint = pts[prevIdx];
    
    while (prevIdx > 0 && Math.hypot(endPoint.x - prevPoint.x, endPoint.y - prevPoint.y) < 6) {
      prevIdx--;
      prevPoint = pts[prevIdx];
    }

    const dx = endPoint.x - prevPoint.x;
    const dy = endPoint.y - prevPoint.y;
    const dist = Math.hypot(dx, dy);
    if (dist === 0) return;

    const angle = Math.atan2(dy, dx);
    const arrowLength = Math.max(12, path.width * 2.5);
    const arrowAngle = Math.PI / 6; // 30 degrees

    this.ctx.beginPath();
    this.ctx.strokeStyle = path.color;
    this.ctx.fillStyle = path.color;
    this.ctx.lineWidth = path.width;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';

    this.ctx.moveTo(endPoint.x, endPoint.y);
    this.ctx.lineTo(
      endPoint.x - arrowLength * Math.cos(angle - arrowAngle),
      endPoint.y - arrowLength * Math.sin(angle - arrowAngle)
    );
    this.ctx.moveTo(endPoint.x, endPoint.y);
    this.ctx.lineTo(
      endPoint.x - arrowLength * Math.cos(angle + arrowAngle),
      endPoint.y - arrowLength * Math.sin(angle + arrowAngle)
    );
    this.ctx.stroke();
  }

  getRoleColor(role) {
    if (role === 'FW') return 'var(--danger)';
    if (role === 'MID') return 'var(--accent)';
    if (role === 'DEF') return 'var(--primary)';
    if (role === 'GK') return 'var(--text-main)';
    return 'var(--text-sub)';
  }

  // getThemeColor removed — colors are hardcoded in this.penColors to avoid
  // canvas context incompatibility with getComputedStyle output formats.
}
