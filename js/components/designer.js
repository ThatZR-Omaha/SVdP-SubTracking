/* ==========================================================================
   Custom Formation Designer Component
   Calculates coordinates on click, edits node parameters, and saves layouts.
   ========================================================================== */

import { openModal, closeModal } from './modals.js';

export class FormationDesigner {
  /**
   * @param {object} appState - Reference to AppState engine
   * @param {function} onSaveSuccess - Callback on successful layout export
   */
  constructor(appState, onSaveSuccess) {
    this.state = appState;
    this.onSaveSuccess = onSaveSuccess;
    this.activeTeamId = null; // Set from app controller

    this.nodes = []; // Active list of placed position nodes: [{ id, label, role, x, y }]
    this.editingNodeIdx = null; // Track index if editing an existing node
    this.currentCoords = { x: 50, y: 50 }; // Temp click coordinates

    // Grab DOM elements
    this.pitchCanvas = document.getElementById('designer-pitch-canvas');
    this.placedContainer = document.getElementById('designer-placed-nodes');
    
    this.selectPlayerCount = document.getElementById('designer-player-count');
    this.inputName = document.getElementById('input-designer-name');
    
    this.nodeCounter = document.getElementById('designer-node-counter');
    this.maxNodeCounter = document.getElementById('designer-max-node-counter');
    
    this.btnSave = document.getElementById('btn-designer-save');
    this.btnClear = document.getElementById('btn-designer-clear');
    
    // Modal Node Elements
    this.modalNode = document.getElementById('modal-designer-node');
    this.inputNodeLabel = document.getElementById('input-node-label');
    this.selectNodeRole = document.getElementById('select-node-role');
    this.btnNodeSave = document.getElementById('btn-designer-save-node');
    this.btnNodeDelete = document.getElementById('btn-designer-delete-node');

    this.bindEvents();
    this.updateTargetCounts();
  }

  bindEvents() {
    // 1. Click pitch canvas to place a node
    if (this.pitchCanvas) {
      this.pitchCanvas.addEventListener('click', (e) => {
        // Prevent click if clicking an existing node badge inside canvas
        if (e.target.closest('.player-node')) return;

        const maxNodes = parseInt(this.selectPlayerCount.value);
        if (this.nodes.length >= maxNodes) {
          alert(`You have already placed the maximum of ${maxNodes} positions! Edit or delete existing nodes to change.`);
          return;
        }

        // Calculate click coordinates in percentages
        const rect = this.pitchCanvas.getBoundingClientRect();
        const x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
        const y = Math.round(((e.clientY - rect.top) / rect.height) * 100);

        this.currentCoords = { x, y };
        this.editingNodeIdx = null;

        // Clear node inputs and prepare modal
        if (this.inputNodeLabel) this.inputNodeLabel.value = '';
        if (this.selectNodeRole) this.selectNodeRole.value = 'MID';
        if (this.btnNodeDelete) this.btnNodeDelete.style.display = 'none'; // Can't delete a new node

        openModal('modal-designer-node');
      });
    }

    // 2. Format size toggle changes target counts
    if (this.selectPlayerCount) {
      this.selectPlayerCount.addEventListener('change', () => {
        this.resetGrid();
        this.updateTargetCounts();
      });
    }

    // 3. Clear designer canvas
    if (this.btnClear) {
      this.btnClear.addEventListener('click', () => {
        this.resetGrid();
      });
    }

    // 4. Save Node Button (inside Modal)
    if (this.btnNodeSave) {
      this.btnNodeSave.addEventListener('click', () => {
        const label = (this.inputNodeLabel.value || 'POS').toUpperCase().substring(0, 4);
        const role = this.selectNodeRole.value || 'MID';

        if (this.editingNodeIdx !== null) {
          // Edit existing
          this.nodes[this.editingNodeIdx].label = label;
          this.nodes[this.editingNodeIdx].role = role;
        } else {
          // Create new
          this.nodes.push({
            id: 'node_' + Date.now(),
            label: label,
            role: role,
            x: this.currentCoords.x,
            y: this.currentCoords.y
          });
        }

        closeModal('modal-designer-node');
        this.renderPlacedNodes();
        this.updateTargetCounts();
      });
    }

    // 5. Delete Node Button (inside Modal)
    if (this.btnNodeDelete) {
      this.btnNodeDelete.addEventListener('click', () => {
        if (this.editingNodeIdx !== null) {
          this.nodes.splice(this.editingNodeIdx, 1);
        }
        closeModal('modal-designer-node');
        this.renderPlacedNodes();
        this.updateTargetCounts();
      });
    }

    // 6. Save Custom Formation to DB
    if (this.btnSave) {
      this.btnSave.addEventListener('click', () => {
        const name = (this.inputName.value || '').trim();
        const maxNodes = parseInt(this.selectPlayerCount.value);

        if (!name) {
          alert('Please enter a name for this custom formation!');
          if (this.inputName) this.inputName.focus();
          return;
        }

        if (this.nodes.length !== maxNodes) {
          alert(`Error: A custom formation for this size must place exactly ${maxNodes} positions. You currently have ${this.nodes.length} placed.`);
          return;
        }

        // Apply auto-spacing before saving
        this.autoSpaceNodes();
        this.renderPlacedNodes(); // Re-render to show user the spaced version

        // Export to AppState database using the currently active team
        const teamId = this.activeTeamId || (this.state.getTeams()[0] && this.state.getTeams()[0].id);
        if (teamId) {
          this.state.addCustomFormation(teamId, name, maxNodes, this.nodes);
          alert(`Formation "${name}" saved successfully! Nodes were automatically organized into even row spacing.`);
          this.resetGrid();
          if (this.inputName) this.inputName.value = '';
          this.onSaveSuccess();
        } else {
          alert('No active team profile found to save this formation under. Create a team first!');
        }
      });
    }
  }

  autoSpaceNodes() {
    if (this.nodes.length === 0) return;

    // 1. Separate GK (y > 82 or role GK) from outfield
    const gkNodes = this.nodes.filter(n => n.role === 'GK' || n.y > 82);
    const outfieldNodes = this.nodes.filter(n => n.role !== 'GK' && n.y <= 82);

    // Center GK
    gkNodes.forEach(gk => {
      gk.x = 50;
      gk.y = 90;
    });

    if (outfieldNodes.length === 0) return;

    // 2. Sort outfield by y ascending (from opponent goals down to defense)
    outfieldNodes.sort((a, b) => a.y - b.y);

    // 3. Cluster into rows based on y proximity (threshold of 8%)
    const rows = [];
    let currentRow = [outfieldNodes[0]];

    for (let i = 1; i < outfieldNodes.length; i++) {
      const node = outfieldNodes[i];
      const prevNode = outfieldNodes[i - 1];
      if (Math.abs(node.y - prevNode.y) <= 8) {
        currentRow.push(node);
      } else {
        rows.push(currentRow);
        currentRow = [node];
      }
    }
    if (currentRow.length > 0) {
      rows.push(currentRow);
    }

    // 4. For each row, sort left-to-right (by x) and distribute x evenly
    rows.forEach(row => {
      row.sort((a, b) => a.x - b.x);

      // Average y of cluster to align horizontally
      const avgY = Math.round(row.reduce((sum, n) => sum + n.y, 0) / row.length);

      const N = row.length;
      if (N === 1) {
        row[0].x = 50;
        row[0].y = avgY;
      } else {
        // Dynamic horizontal width boundaries matching standard presets
        let startX = 15;
        let endX = 85;
        if (N === 2) {
          startX = 30;
          endX = 70;
        } else if (N === 3) {
          startX = 20;
          endX = 80;
        } else if (N === 4) {
          startX = 15;
          endX = 85;
        } else if (N >= 5) {
          startX = 10;
          endX = 90;
        }

        const step = (endX - startX) / (N - 1);
        row.forEach((node, idx) => {
          node.x = Math.round(startX + idx * step);
          node.y = avgY;
        });
      }
    });

    // Recombine GK and outfield
    this.nodes = [...gkNodes, ...outfieldNodes];
  }

  updateTargetCounts() {
    const target = parseInt(this.selectPlayerCount.value);
    if (this.nodeCounter) this.nodeCounter.textContent = this.nodes.length;
    if (this.maxNodeCounter) this.maxNodeCounter.textContent = target;
  }

  resetGrid() {
    this.nodes = [];
    this.editingNodeIdx = null;
    this.renderPlacedNodes();
    this.updateTargetCounts();
  }

  /**
   * Redraws the placed positions on the designer field
   */
  renderPlacedNodes() {
    if (!this.placedContainer) return;
    this.placedContainer.innerHTML = '';

    this.nodes.forEach((node, idx) => {
      const nodeEl = document.createElement('div');
      nodeEl.className = 'player-node running';
      nodeEl.style.left = `${node.x}%`;
      nodeEl.style.top = `${node.y}%`;

      nodeEl.innerHTML = `
        <div class="player-node-badge" style="border-color: var(--text-main);">
          <span class="player-node-pos-tag" style="background-color: ${this.getRoleColor(node.role)};">${node.label}</span>
          <span class="player-node-number" style="font-size:12px;">★</span>
        </div>
      `;

      // Allow editing or deleting by clicking the node
      nodeEl.addEventListener('click', (e) => {
        e.stopPropagation(); // Stop click bubbling to grid placement!
        this.editingNodeIdx = idx;
        
        if (this.inputNodeLabel) this.inputNodeLabel.value = node.label;
        if (this.selectNodeRole) this.selectNodeRole.value = node.role;
        if (this.btnNodeDelete) this.btnNodeDelete.style.display = 'block'; // Allow deletion

        openModal('modal-designer-node');
      });

      this.placedContainer.appendChild(nodeEl);
    });
  }

  getRoleColor(role) {
    if (role === 'FW') return 'var(--danger)';
    if (role === 'MID') return 'var(--accent)';
    if (role === 'DEF') return 'var(--primary)';
    if (role === 'GK') return 'var(--text-main)';
    return 'var(--text-sub)';
  }
}
