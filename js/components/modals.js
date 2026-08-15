/* ==========================================================================
   Overlay Modals Utility Component
   Handles show/hide, form clearing, and high-contrast alert overlays.
   ========================================================================== */

/**
 * Opens a modal dialog by its element ID
 * @param {string} modalId - ID of the backdrop container
 */
export function openModal(modalId) {
  const el = document.getElementById(modalId);
  if (el) {
    el.classList.add('active');
    
    // Automatically focus first text input if available
    const firstInput = el.querySelector('input[type="text"]');
    if (firstInput) {
      setTimeout(() => firstInput.focus(), 150);
    }
  }
}

/**
 * Closes a modal dialog by its element ID
 * @param {string} modalId - ID of the backdrop container
 */
export function closeModal(modalId) {
  const el = document.getElementById(modalId);
  if (el) {
    el.classList.remove('active');
  }
// Expose globally for inline HTML onclick handlers
if (typeof window !== 'undefined') {
  window.openModal = openModal;
  window.closeModal = closeModal;
}

/**
 * Configures the active statistics quick logging overlay for a specific player
 * @param {object} player - Active match player object
 * @param {string} currentPlaytimeStr - Formatted active minutes
 * @param {function} onStatLog - Callback trigger when stat button is clicked
 */
export function setupStatsLoggerModal(player, currentPlaytimeStr, onStatLog) {
  const nameEl = document.getElementById('stats-logger-player-name');
  const roleEl = document.getElementById('stats-logger-player-role');
  const timeEl = document.getElementById('stats-logger-playtime');
  
  if (nameEl) nameEl.textContent = `#${player.number} ${player.name}`;
  if (roleEl) roleEl.textContent = `Position: ${player.position || 'BENCH'} (${player.preferredPosition})`;
  if (timeEl) timeEl.textContent = currentPlaytimeStr;

  // Re-bind click events on stats action buttons
  const statButtons = document.querySelectorAll('.stat-log-btn[data-stat]');
  statButtons.forEach(btn => {
    // Clone node to strip previous event listeners cleanly
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    
    const statType = newBtn.getAttribute('data-stat');
    newBtn.addEventListener('click', () => {
      onStatLog(player.id, statType);
      closeModal('modal-stats-logger');
    });
  });

  // Re-bind the Substitute Out button inside stats logger
  const subBtn = document.getElementById('btn-stats-sub-trigger');
  if (subBtn) {
    const newSubBtn = subBtn.cloneNode(true);
    subBtn.parentNode.replaceChild(newSubBtn, subBtn);
    
    // Bench players shouldn't be subbed out!
    if (!player.isOnField) {
      newSubBtn.style.display = 'none';
    } else {
      newSubBtn.style.display = 'block';
      newSubBtn.addEventListener('click', () => {
        closeModal('modal-stats-logger');
        // Initiate double-trigger sub by setting this player as 'out' target
        window.dispatchEvent(new CustomEvent('initiate-sub-out', { detail: { playerId: player.id } }));
      });
    }
  }
}
