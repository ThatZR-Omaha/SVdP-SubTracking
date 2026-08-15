/* ==========================================================================
   Tactical Pitch Component - Field & Node Renderer
   Manages grid positions, active overlays, and node click transitions.
   ========================================================================== */

import { formatTime } from '../utils/timers.js';

export class TacticalPitch {
  /**
   * @param {string} containerId - Element ID where players will render
   * @param {object} appState - Reference to AppState engine
   * @param {function} onNodeClick - Callback when a node is clicked in standard mode
   */
  constructor(containerId, appState, onNodeClick) {
    this.container = document.getElementById(containerId);
    this.state = appState;
    this.onNodeClick = onNodeClick;

    // Interaction flags
    this.pendingSubBenchId = null; // Stored bench player ID when starting a sub
    this.pendingSwapPlayerId = null; // Stored first player ID when swapping on-field
    this.isSwapModeActive = false; // Toggled by coach via "Position Swap" button
  }

  // Set position swap state active/inactive
  setSwapMode(active) {
    this.isSwapModeActive = active;
    this.pendingSwapPlayerId = null;
    this.pendingSubBenchId = null;
    this.render();
  }

  // Triggers double-trigger sub-out from clicking a bench player
  setPendingSubSource(benchPlayerId) {
    this.pendingSubBenchId = benchPlayerId;
    this.pendingSwapPlayerId = null;
    this.isSwapModeActive = false;
    this.render();
  }

  clearSelections() {
    this.pendingSubBenchId = null;
    this.pendingSwapPlayerId = null;
    this.render();
  }

  /**
   * Redraws the tactical pitch layout based on the current active match state
   */
  render() {
    if (!this.container) return;
    this.container.innerHTML = '';

    const match = this.state.activeMatch;
    if (!match) {
      this.container.innerHTML = '<p style="text-align:center; padding:40px; color:var(--text-sub);">No active match loaded</p>';
      return;
    }

    const formation = match.formation;
    const activeOnField = match.players.filter(p => p.isOnField);

    // Map players to positions defined in active formation
    formation.positions.forEach((posNode, idx) => {
      // Find the player currently occupying this position label (e.g. ST, LCB)
      const player = activeOnField.find(p => p.position === posNode.label);
      
      const nodeEl = document.createElement('div');
      nodeEl.className = 'player-node';
      nodeEl.style.left = `${posNode.x}%`;
      nodeEl.style.top = `${posNode.y}%`;

      if (player) {
        // Render Active Player Badge
        nodeEl.classList.add('running');
        
        // Status highlighting
        const isQueuedOut = match.subQueue.some(q => q.outId === player.id);
        const isSwapSource = this.pendingSwapPlayerId === player.id;
        
        if (isQueuedOut) nodeEl.classList.add('queued-out');
        if (isSwapSource) nodeEl.classList.add('swap-selected');

        const activeMins = Math.round(player.totalSeconds / 60);

        let badgeClass = 'player-node-badge';
        let badgeStyle = '';
        if (posNode.role !== 'GK' && match.elapsedSeconds > 0 && !isQueuedOut && !isSwapSource) {
          const pct = Math.min(100, Math.max(0, (player.totalSeconds / match.elapsedSeconds) * 100));
          badgeClass += ' has-gradient';
          badgeStyle = `style="--playtime-pct: ${pct}%;"`;
        }

        nodeEl.innerHTML = `
          <div class="${badgeClass}" ${badgeStyle}>
            <span class="player-node-pos-tag" style="background-color: ${this.getRoleColor(posNode.role)};">${posNode.label}</span>
            <span class="player-node-number">${player.number}</span>
            <span class="player-node-time">${activeMins}'</span>
          </div>
          <span class="player-node-name">${player.name.split(' ')[0]}</span>
        `;

        // Bind clicks
        nodeEl.addEventListener('click', () => this.handleOnFieldNodeClick(player));

      } else {
        // Renders an empty position placeholder node
        nodeEl.innerHTML = `
          <div class="player-node-badge" style="border: 2px dashed var(--border-color-dark); background: transparent;">
            <span class="player-node-pos-tag" style="background-color: var(--text-muted);">${posNode.label}</span>
            <span class="player-node-number" style="color: var(--text-sub); opacity:0.4;">+</span>
          </div>
          <span class="player-node-name" style="color: var(--text-sub); opacity: 0.6;">Empty</span>
        `;
        
        nodeEl.addEventListener('click', () => this.handleEmptyNodeClick(posNode.label, posNode.role));
      }

      this.container.appendChild(nodeEl);
    });
  }

  /**
   * Action handler for active players on the field
   */
  handleOnFieldNodeClick(player) {
    const match = this.state.activeMatch;

    // 1. Double-trigger substitution execution
    if (this.pendingSubBenchId) {
      this.state.queueSubstitution(this.pendingSubBenchId, player.id);
      this.pendingSubBenchId = null;
      // Emit event to update sub queue UI
      window.dispatchEvent(new CustomEvent('sub-queue-updated'));
      this.render();
      return;
    }

    // 2. Position Swap Mode handling
    if (this.isSwapModeActive) {
      if (!this.pendingSwapPlayerId) {
        // Select first swap source
        this.pendingSwapPlayerId = player.id;
        this.render();
      } else {
        if (this.pendingSwapPlayerId !== player.id) {
          // Perform swap!
          this.state.swapPositions(this.pendingSwapPlayerId, player.id);
          this.pendingSwapPlayerId = null;
          this.isSwapModeActive = false;
          // Notify app controller to reset buttons
          window.dispatchEvent(new CustomEvent('position-swap-complete'));
        } else {
          // Deselect
          this.pendingSwapPlayerId = null;
        }
        this.render();
      }
      return;
    }

    // 3. Default: open stats logger overlay
    this.onNodeClick(player);
  }

  /**
   * Action handler for tapping empty pitch slots (allows manual slot assignments)
   */
  handleEmptyNodeClick(posLabel, posRole) {
    // If we have a pending bench player, assign them directly to this empty spot!
    if (this.pendingSubBenchId) {
      const match = this.state.activeMatch;
      const benchPlayer = match.players.find(p => p.id === this.pendingSubBenchId && !p.isOnField);
      
      if (benchPlayer) {
        // Direct assignment sub
        const currentSecond = match.elapsedSeconds;
        
        benchPlayer.isOnField = true;
        benchPlayer.position = posLabel;
        benchPlayer.positionRole = posRole;
        benchPlayer.positionLog.push({
          position: posLabel,
          startSecond: currentSecond,
          endSecond: null
        });

        match.events.push({
          type: 'sub',
          detail: `Tactical entry: #${benchPlayer.number} ${benchPlayer.name} placed in empty slot [${posLabel}]`,
          second: currentSecond
        });

        this.pendingSubBenchId = null;
        window.dispatchEvent(new CustomEvent('sub-queue-updated'));
        this.state.saveToStorage();
        this.render();
      }
    }
  }

  // Get color code by role category
  getRoleColor(role) {
    if (role === 'FW') return 'var(--danger)';
    if (role === 'MID') return 'var(--accent)';
    if (role === 'DEF') return 'var(--primary)';
    if (role === 'GK') return 'var(--text-main)';
    return 'var(--text-sub)';
  }
}
