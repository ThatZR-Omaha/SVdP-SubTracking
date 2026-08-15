/* ==========================================================================
   Substitution Queue Component - List & Execute Bindings
   ========================================================================== */

export class SubQueuePanel {
  /**
   * @param {object} appState - Reference to AppState engine
   * @param {function} onExecuteCallback - Callback when substitutions are confirmed
   */
  constructor(appState, onExecuteCallback) {
    this.state = appState;
    this.onExecuteCallback = onExecuteCallback;

    // Grab DOM elements
    this.panelContainer = document.getElementById('match-sub-queue-container');
    this.listContainer = document.getElementById('sub-queue-list');
    this.executeBtn = document.getElementById('btn-execute-sub-queue');
    this.clearBtn = document.getElementById('btn-clear-sub-queue');

    this.bindEvents();
  }

  bindEvents() {
    if (this.clearBtn) {
      this.clearBtn.addEventListener('click', () => {
        this.state.clearSubQueue();
        this.render();
        // Trigger a pitch redraw
        window.dispatchEvent(new CustomEvent('sub-queue-cleared'));
      });
    }

    if (this.executeBtn) {
      this.executeBtn.addEventListener('click', () => {
        // Execute substitutions in state engine
        this.state.executeSubQueue();
        this.render();
        // Invoke app controller redraws
        this.onExecuteCallback();
      });
    }
  }

  /**
   * Refreshes the pending queue visual rows and handles hide/show
   */
  render() {
    if (!this.panelContainer || !this.listContainer) return;

    const match = this.state.activeMatch;
    if (!match || !match.subQueue || match.subQueue.length === 0) {
      this.panelContainer.style.display = 'none';
      return;
    }

    // Unhide panel and populate list
    this.panelContainer.style.display = 'flex';
    this.listContainer.innerHTML = '';

    match.subQueue.forEach((sub, idx) => {
      const row = document.createElement('div');
      row.className = 'queue-item';

      row.innerHTML = `
        <div class="queue-item-details">
          <span style="color: var(--danger); text-decoration: line-through; font-weight: 800;">
            #${sub.outNumber} ${sub.outName.split(' ')[0]} [${sub.outPosition}]
          </span>
          <span class="arrow-divider">➔</span>
          <span style="color: var(--primary-dark); font-weight: 800;">
            #${sub.inNumber} ${sub.inName.split(' ')[0]}
          </span>
        </div>
        <button class="btn btn-sm btn-secondary" style="min-height: 24px; padding: 2px 6px;" data-remove-idx="${idx}">✖</button>
      `;

      // Bind individual delete button
      row.querySelector('[data-remove-idx]').addEventListener('click', () => {
        this.state.removeQueuedSub(idx);
        this.render();
        window.dispatchEvent(new CustomEvent('sub-queue-cleared'));
      });

      this.listContainer.appendChild(row);
    });

    // Update main confirmation button count
    if (this.executeBtn) {
      this.executeBtn.textContent = `Confirm & Execute Plan (${match.subQueue.length})`;
    }
  }
}
