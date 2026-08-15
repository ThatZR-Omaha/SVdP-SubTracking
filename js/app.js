/* ==========================================================================
   Master Application Controller - Coordinating Views and Core Hooks
   ========================================================================== */

import { AppState } from './state.js';
import { TacticalPitch } from './components/pitch.js';
import { SubQueuePanel } from './components/queue.js';
import { FormationDesigner } from './components/designer.js';
import { TacticsBoard } from './components/board.js';
import { openModal, closeModal, setupStatsLoggerModal } from './components/modals.js';
import { formatTime, formatPeriod } from './utils/timers.js';
import { PlayerHeatmap } from './components/heatmap.js';

class AppController {
  constructor() {
    this.state = new AppState();
    
    // Core references
    this.activeTeamId = null;
    this.matchTickerInterval = null;
    this.heatmapBackToHistory = false;
    this.activeHistoryDetailGame = null;

    // Sub-components
    this.pitch = null;
    this.queuePanel = null;
    this.designer = null;
    this.board = null;

    this.init();
  }

  init() {
    // Determine initially active team
    const teams = this.state.getTeams();
    if (teams.length > 0) {
      this.activeTeamId = teams[0].id;
    }

    // Initialize components
    this.initSubComponents();
    // Sync active team into designer right away
    if (this.designer) this.designer.activeTeamId = this.activeTeamId;

    // Bind event listeners
    this.bindNavigationTabs();
    this.bindRosterEvents();
    this.bindMatchSetupEvents();
    this.bindLiveMatchControls();
    this.bindGlobalEvents();
    this.bindIconPickerEvents();

    // Perform initial renders
    this.updateHeaderUI();
    this.renderActiveRoster();
    this.renderMatchHistory();
    this.refreshMatchView();

    // Restore ticking clock if active match was running on page load
    if (this.state.activeMatch && this.state.activeMatch.state === 'live') {
      this.startClockInterval();
    }
  }

  initSubComponents() {
    // 1. Tactical Pitch Renderer
    this.pitch = new TacticalPitch(
      'active-pitch-players',
      this.state,
      (player) => this.openStatsLogger(player)
    );

    // 2. Substitution Queue UI Panel
    this.queuePanel = new SubQueuePanel(this.state, () => {
      // Confirmed Execute Sub callback
      this.pitch.clearSelections();
      this.refreshMatchView();
    });

    // 3. Custom Formation Designer
    this.designer = new FormationDesigner(this.state, () => {
      this.switchView('match');
      this.refreshMatchView();
      this.populateTeamSettingsForm();
      this.renderActiveRoster();
    });

    // 4. Tactics Drawing Board
    this.board = new TacticsBoard(this.state);
  }

  // ==========================================================
  // NAVIGATION & GENERAL UI
  // ==========================================================

  bindNavigationTabs() {
    const tabs = document.querySelectorAll('.nav-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        const viewId = tab.getAttribute('data-view');
        this.switchView(viewId);
      });
    });
  }

  switchView(viewId) {
    const views = document.querySelectorAll('.app-view');
    views.forEach(v => v.classList.remove('active'));
    
    const target = document.getElementById('view-' + viewId);
    if (target) {
      target.classList.add('active');
    }

    // Contextual redraws on tab activation
    if (viewId === 'match') {
      this.refreshMatchView();
    } else if (viewId === 'squad') {
      this.renderActiveRoster();
      this.populateTeamSettingsForm();
    } else if (viewId === 'history') {
      this.renderMatchHistory();
    } else if (viewId === 'tactics') {
      // Sync active team into designer
      if (this.designer) this.designer.activeTeamId = this.activeTeamId;
    }
  }

  renderIconElement(iconData, size = 24) {
    if (!iconData) iconData = '⚽';
    if (iconData.startsWith('data:image') || iconData.startsWith('http') || iconData.startsWith('blob:')) {
      return `<img src="${iconData}" alt="Team Icon" style="width: ${size}px; height: ${size}px; object-fit: contain; border-radius: 4px; display: block;">`;
    }
    return `<span style="font-size: ${size}px; line-height: 1; display: inline-block;">${iconData}</span>`;
  }

  updateHeaderUI() {
    const teamNameEl = document.getElementById('header-team-name');
    const statusEl = document.getElementById('header-match-status');
    const headerIconEl = document.getElementById('header-team-icon');
    const team = this.state.getTeam(this.activeTeamId);

    if (team) {
      if (headerIconEl) {
        headerIconEl.innerHTML = this.renderIconElement(team.icon, 24);
      }
      if (teamNameEl) {
        teamNameEl.textContent = team.name;
        teamNameEl.style.color = team.color || 'var(--primary)';
      }
      
      if (statusEl) {
        if (this.state.activeMatch) {
          statusEl.textContent = `Live: vs ${this.state.activeMatch.opponent}`;
          statusEl.style.color = 'var(--accent)';
        } else {
          statusEl.textContent = 'SOCCER COACHING TRACKER';
          statusEl.style.color = 'var(--text-sub)';
        }
      }
    } else {
      if (headerIconEl) headerIconEl.innerHTML = this.renderIconElement('⚽', 24);
      if (teamNameEl) teamNameEl.textContent = 'Select Team';
      if (statusEl) statusEl.textContent = 'SOCCER COACHING TRACKER';
    }
  }

  // ==========================================================
  // TEAM & ROSTER SCREEN
  // ==========================================================

  populateTeamSettingsForm() {
    const card = document.getElementById('squad-settings-card');
    const selector = document.getElementById('squad-team-selector');
    const team = this.state.getTeam(this.activeTeamId);

    if (!team) {
      if (card) card.style.display = 'none';
      return;
    }

    if (card) card.style.display = 'flex';
    
    // Fill team switch select option list
    if (selector) {
      selector.innerHTML = '';
      this.state.getTeams().forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.id;
        opt.textContent = t.name;
        opt.selected = t.id === this.activeTeamId;
        selector.appendChild(opt);
      });
    }

    // Populate team icon preview
    const iconPreview = document.getElementById('squad-team-icon-preview');
    if (iconPreview) {
      iconPreview.innerHTML = this.renderIconElement(team.icon, 28);
    }

    // Populate input settings parameters
    const halfInput = document.getElementById('input-team-half-length');
    const formatSelect = document.getElementById('select-team-player-count');
    const formSelect = document.getElementById('select-team-formation');

    if (halfInput) halfInput.value = team.halfLength || 25;
    if (formatSelect) formatSelect.value = team.playerCount || 9;

    // Populate standard and custom formations list
    if (formSelect) {
      formSelect.innerHTML = '';
      const forms = this.state.getFormationsForTeam(this.activeTeamId);
      const filtered = forms.filter(f => f.playerCount === parseInt(team.playerCount));
      
      filtered.forEach(f => {
        const opt = document.createElement('option');
        opt.value = f.id;
        opt.textContent = f.name;
        opt.selected = f.id === team.defaultFormationId;
        formSelect.appendChild(opt);
      });
    }
  }

  renderActiveRoster() {
    const listEl = document.getElementById('squad-player-list');
    const countEl = document.getElementById('squad-count-label');
    const card = document.getElementById('squad-roster-card');
    const team = this.state.getTeam(this.activeTeamId);

    if (!team) {
      if (card) card.style.display = 'none';
      return;
    }

    if (card) card.style.display = 'flex';
    if (countEl) countEl.textContent = team.players.length;
    if (!listEl) return;

    listEl.innerHTML = '';

    if (team.players.length === 0) {
      listEl.innerHTML = '<p style="text-align:center; padding:20px; color:var(--text-sub); font-size:13px;">No players in roster. Add players below!</p>';
      return;
    }

    team.players.forEach(p => {
      const row = document.createElement('div');
      row.className = 'list-item';

      // Compile stats labels
      const goals = p.stats ? p.stats.goal || 0 : 0;
      const mins = p.stats ? p.stats.totalMinutesPlayed || 0 : 0;
      const matches = p.stats ? p.stats.matchesPlayed || 0 : 0;

      row.innerHTML = `
        <div style="display:flex; align-items:center; gap:12px;">
          <span style="display:flex; align-items:center; justify-content:center; width:34px; height:34px; border:2px solid var(--text-main); border-radius:50%; font-weight:800; font-size:14px; background:var(--primary-light);">
            ${p.number}
          </span>
          <div>
            <h4 style="font-size:14px; font-weight:700;">${p.name}</h4>
            <span style="font-size:11px; font-weight:700; color:var(--text-sub); text-transform:uppercase;">
              Pref Role: ${p.preferredPosition}
            </span>
          </div>
        </div>
        
        <div style="display:flex; align-items:center; gap:16px;">
          <div style="text-align:right; font-size:11px; font-weight:700; color:var(--text-sub);">
            <div>${mins} mins (${matches} GP)</div>
            <div style="color:var(--primary-dark);">⚽ ${goals} Goals</div>
          </div>
          
          <div style="display:flex; gap:4px;">
            <button class="btn btn-sm btn-secondary" style="min-height:30px; padding:4px 8px;" data-heatmap-p="${p.id}" title="View Heatmap">📊</button>
            <button class="btn btn-sm btn-secondary" style="min-height:30px; padding:4px 8px;" data-edit-p="${p.id}">✏️</button>
            <button class="btn btn-sm btn-danger" style="min-height:30px; padding:4px 8px;" data-delete-p="${p.id}">🗑️</button>
          </div>
        </div>
      `;

      // Bind heatmap, edit and delete triggers
      row.querySelector(`[data-heatmap-p="${p.id}"]`).addEventListener('click', () => {
        const aggregated = this.aggregatePlayerPositions(this.activeTeamId, p.id);
        const matches = p.stats ? p.stats.matchesPlayed || 0 : 0;
        const totalMins = p.stats ? p.stats.totalMinutesPlayed || 0 : 0;
        const role = p.preferredPosition || 'MID';

        this.openPlayerHeatmapModal(
          `#${p.number} ${p.name}`,
          `Career: ${matches} matches · ${totalMins} mins · ${role}`,
          aggregated,
          p.stats,
          totalMins
        );
      });
      row.querySelector(`[data-edit-p="${p.id}"]`).addEventListener('click', () => this.openEditPlayerModal(p));
      row.querySelector(`[data-delete-p="${p.id}"]`).addEventListener('click', () => {
        if (confirm(`Remove ${p.name} from squad?`)) {
          this.state.deletePlayer(this.activeTeamId, p.id);
          this.renderActiveRoster();
        }
      });

      listEl.appendChild(row);
    });
  }

  bindRosterEvents() {
    // 0. Squad view team selector change — switch active team
    const squadTeamSelector = document.getElementById('squad-team-selector');
    if (squadTeamSelector) {
      squadTeamSelector.addEventListener('change', () => {
        this.activeTeamId = squadTeamSelector.value;
        if (this.designer) this.designer.activeTeamId = this.activeTeamId;
        this.updateHeaderUI();
        this.populateTeamSettingsForm();
        this.renderActiveRoster();
        this.renderMatchHistory();
      });
    }

    // 1. Team configuration save
    const btnSaveSettings = document.getElementById('btn-save-team-settings');
    if (btnSaveSettings) {
      btnSaveSettings.addEventListener('click', () => {
        const halfLength = document.getElementById('input-team-half-length').value;
        const playerCount = document.getElementById('select-team-player-count').value;
        const defaultFormationId = document.getElementById('select-team-formation').value;

        this.state.updateTeamSettings(this.activeTeamId, halfLength, playerCount, defaultFormationId);
        alert('Team match parameters updated successfully!');
        this.populateTeamSettingsForm();
      });
    }

    // Update formations list on pitch size adjustments
    const selectPlayerCount = document.getElementById('select-team-player-count');
    if (selectPlayerCount) {
      selectPlayerCount.addEventListener('change', () => {
        const count = selectPlayerCount.value;
        const formSelect = document.getElementById('select-team-formation');
        if (formSelect) {
          formSelect.innerHTML = '';
          const forms = this.state.getFormationsForTeam(this.activeTeamId);
          forms.filter(f => f.playerCount === parseInt(count)).forEach(f => {
            const opt = document.createElement('option');
            opt.value = f.id;
            opt.textContent = f.name;
            formSelect.appendChild(opt);
          });
        }
      });
    }

    // 2. Team creation panel modal triggers
    const btnCreateTeamModal = document.getElementById('btn-create-team-modal');
    if (btnCreateTeamModal) {
      btnCreateTeamModal.addEventListener('click', () => {
        const nameInput = document.getElementById('input-new-team-name');
        if (nameInput) nameInput.value = '';
        openModal('modal-create-team');
      });
    }

    const btnSaveNewTeam = document.getElementById('btn-save-new-team');
    if (btnSaveNewTeam) {
      btnSaveNewTeam.addEventListener('click', () => {
        const name = document.getElementById('input-new-team-name').value;
        const color = document.getElementById('input-new-team-color').value;

        if (!name.trim()) {
          alert('Please enter a team name!');
          return;
        }

        const newTeam = this.state.createTeam(name, color);
        this.activeTeamId = newTeam.id;
        
        closeModal('modal-create-team');
        this.updateHeaderUI();
        this.populateTeamSettingsForm();
        this.renderActiveRoster();
      });
    }

    // 3. Team deletion trigger
    const btnDeleteTeam = document.getElementById('btn-delete-team');
    if (btnDeleteTeam) {
      btnDeleteTeam.addEventListener('click', () => {
        const team = this.state.getTeam(this.activeTeamId);
        if (team && confirm(`Are you sure you want to delete the team "${team.name}" and all historical stats?`)) {
          this.state.deleteTeam(this.activeTeamId);
          const teams = this.state.getTeams();
          this.activeTeamId = teams.length > 0 ? teams[0].id : null;
          
          this.updateHeaderUI();
          this.populateTeamSettingsForm();
          this.renderActiveRoster();
        }
      });
    }

    // 4. Player editor triggers
    const btnAddPlayer = document.getElementById('btn-add-player-modal');
    if (btnAddPlayer) {
      btnAddPlayer.addEventListener('click', () => {
        document.getElementById('player-modal-title').textContent = 'Add Squad Player';
        document.getElementById('input-player-id').value = '';
        document.getElementById('input-player-name').value = '';
        document.getElementById('input-player-number').value = '';
        document.getElementById('select-player-pos').value = 'MID';
        openModal('modal-player-editor');
      });
    }

    const btnSavePlayer = document.getElementById('btn-save-player');
    if (btnSavePlayer) {
      btnSavePlayer.addEventListener('click', () => {
        const pid = document.getElementById('input-player-id').value;
        const name = document.getElementById('input-player-name').value;
        const num = document.getElementById('input-player-number').value;
        const pos = document.getElementById('select-player-pos').value;

        if (!name.trim() || !num) {
          alert('Please enter player name and jersey number!');
          return;
        }

        if (pid) {
          // Edit
          this.state.editPlayer(this.activeTeamId, pid, name, num, pos);
        } else {
          // Add
          this.state.addPlayer(this.activeTeamId, name, num, pos);
        }

        closeModal('modal-player-editor');
        this.renderActiveRoster();
      });
    }
  }

  openEditPlayerModal(p) {
    document.getElementById('player-modal-title').textContent = 'Modify Player details';
    document.getElementById('input-player-id').value = p.id;
    document.getElementById('input-player-name').value = p.name;
    document.getElementById('input-player-number').value = p.number;
    document.getElementById('select-player-pos').value = p.preferredPosition;
    openModal('modal-player-editor');
  }

  // ==========================================================
  // MATCH CONFIGURATION & SETUP FLOW
  // ==========================================================

  bindMatchSetupEvents() {
    const btnSwitchTeam = document.getElementById('btn-switch-team');
    if (btnSwitchTeam) {
      btnSwitchTeam.addEventListener('click', () => {
        const switcherList = document.getElementById('team-switcher-list');
        if (switcherList) {
          switcherList.innerHTML = '';
          this.state.getTeams().forEach(t => {
            const row = document.createElement('button');
            row.className = 'btn';
            row.style.width = '100%';
            row.style.borderColor = t.color;
            row.style.color = t.color;
            row.style.display = 'flex';
            row.style.alignItems = 'center';
            row.style.gap = '10px';
            row.style.justify = 'flex-start';
            row.innerHTML = `${this.renderIconElement(t.icon, 22)} <span style="flex:1; text-align:left; font-weight:700;">${t.name}</span>`;
            
            row.addEventListener('click', () => {
              this.activeTeamId = t.id;
              closeModal('modal-team-switcher');
              this.updateHeaderUI();
              this.populateTeamSettingsForm();
              this.renderActiveRoster();
              this.renderMatchHistory();
              this.refreshMatchView();
            });
            switcherList.appendChild(row);
          });
        }
        openModal('modal-team-switcher');
      });
    }
  }

  // ==========================================================
  // THE LIVE MATCH BOARD & CLOCK
  // ==========================================================

  refreshMatchView() {
    const match = this.state.activeMatch;
    const view = document.getElementById('view-match');
    if (!view) return;

    // Check if we render standard match setup card vs live match board
    let setupCard = document.getElementById('match-setup-dashboard');
    
    if (!match) {
      // Clear timers
      this.stopClockInterval();
      
      // Render Setup Screen
      if (this.matchTickerInterval) clearInterval(this.matchTickerInterval);
      
      if (!setupCard) {
        setupCard = document.createElement('div');
        setupCard.id = 'match-setup-dashboard';
        setupCard.className = 'card';
        setupCard.style.gap = '16px';
        view.insertBefore(setupCard, view.firstChild);
      }

      // Hide all standard match controls
      this.toggleLiveMatchUI(false);
      this.renderSetupDashboard(setupCard);
    } else {
      // Remove setup card if visible
      if (setupCard) setupCard.remove();
      
      // Show controls and update values
      this.toggleLiveMatchUI(true);
      
      // Update scoreboards
      const scoreUs = document.getElementById('score-us');
      const scoreThem = document.getElementById('score-them');
      const usName = document.getElementById('match-us-name');
      const themName = document.getElementById('match-them-name');
      const timerLabel = document.getElementById('match-timer-label');
      const periodLabel = document.getElementById('match-period-label');
      const pitchFormatSize = document.getElementById('field-count-label');

      if (scoreUs) scoreUs.textContent = match.score.us;
      if (scoreThem) scoreThem.textContent = match.score.them;
      if (usName) usName.textContent = match.teamName;
      if (themName) themName.textContent = match.opponent;
      if (timerLabel) timerLabel.textContent = formatTime(match.elapsedSeconds);
      if (periodLabel) periodLabel.textContent = formatPeriod(match.period);
      if (pitchFormatSize) pitchFormatSize.textContent = `${match.playerCount}v${match.playerCount} Format`;

      // Update Active play buttons
      const btnPlay = document.getElementById('btn-match-play-pause');
      const icon = document.getElementById('play-pause-icon');
      const txt = document.getElementById('play-pause-text');

      if (btnPlay) {
        if (match.state === 'live') {
          btnPlay.className = 'btn btn-secondary';
          if (icon) icon.textContent = '⏸';
          if (txt) txt.textContent = 'Pause';
        } else {
          btnPlay.className = 'btn btn-primary';
          if (icon) icon.textContent = '▶';
          if (txt) txt.textContent = 'Play';
        }
      }

      // Render components
      this.pitch.render();
      this.queuePanel.render();
      this.renderBenchList();
      this.renderMatchTimeline();
    }
  }

  toggleLiveMatchUI(visible) {
    // Only toggle these specific section-level elements, NOT their parent cards
    const sectionIds = [
      'match-controller-section', 'match-score-section', 'match-pitch-section',
      'match-sub-queue-container', 'match-bench-section', 'match-timeline-section',
      'btn-end-match', 'btn-cancel-match'
    ];
    sectionIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = visible ? '' : 'none';
    });
  }

  renderBenchList() {
    const listEl = document.getElementById('match-bench-list');
    if (!listEl) return;
    
    const match = this.state.activeMatch;
    if (!match) return;

    listEl.innerHTML = '';
    const benchPlayers = match.players.filter(p => !p.isOnField);

    if (benchPlayers.length === 0) {
      listEl.innerHTML = '<p style="color: var(--text-sub); font-size: 12px; grid-column: 1 / -1; text-align: center; padding: 8px 0;">All players are currently on the pitch!</p>';
      return;
    }

    benchPlayers.forEach(p => {
      const item = document.createElement('div');
      item.className = 'list-item';
      item.style.padding = '8px 10px';
      item.style.cursor = 'pointer';
      
      const mins = Math.round(p.totalSeconds / 60);
      item.innerHTML = `
        <div>
          <span style="font-weight: 800; color: var(--primary); margin-right: 4px;">#${p.number}</span>
          <span style="font-weight: 600; font-size: 13px;">${p.name}</span>
        </div>
        <span style="font-size: 11px; color: var(--text-sub); font-weight: 600;">${mins}m</span>
      `;
      item.addEventListener('click', () => this.openStatsLogger(p));
      listEl.appendChild(item);
    });
  }

  renderMatchTimeline() {
    const listEl = document.getElementById('match-event-timeline');
    if (!listEl) return;

    const match = this.state.activeMatch;
    if (!match || !match.events || match.events.length === 0) {
      listEl.innerHTML = '<p style="color: var(--text-sub); text-align: center; padding: 12px 0;">No match events yet. Start the timer!</p>';
      return;
    }

    listEl.innerHTML = '';
    const reversedEvents = [...match.events].reverse();
    reversedEvents.forEach(evt => {
      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.alignItems = 'center';
      row.style.justifyContent = 'space-between';
      row.style.padding = '4px 8px';
      row.style.borderRadius = '4px';
      row.style.background = 'rgba(0, 0, 0, 0.05)';
      row.style.fontSize = '12px';

      const timeStr = formatTime(evt.second || 0);
      row.innerHTML = `
        <span style="font-weight: 600; color: var(--text-main);">${evt.detail}</span>
        <span style="font-size: 10px; color: var(--text-sub); font-weight: 700; margin-left: 8px;">${timeStr}</span>
      `;
      listEl.appendChild(row);
    });
  }

  renderSetupDashboard(container) {
    const team = this.state.getTeam(this.activeTeamId);
    if (!team) {
      container.innerHTML = '<p style="text-align:center; padding:20px;">No team profile loaded. Create a team first in the <b>Squad</b> tab!</p>';
      return;
    }

    if (team.players.length < team.playerCount) {
      container.innerHTML = `
        <h2 class="card-title">Roster Alert</h2>
        <p style="font-size:13px; color:var(--danger);">
          Alert: Your active team profile has only <b>${team.players.length} players</b> saved, but your default match format is set to <b>${team.playerCount}v${team.playerCount}</b>.
        </p>
        <p style="font-size:12px; color:var(--text-sub);">
          Please navigate to the <b>Squad</b> tab to add more players, or adjust the default squad size to begin!
        </p>
      `;
      return;
    }

    // Populate custom formations select list
    const forms = this.state.getFormationsForTeam(this.activeTeamId);
    const filtered = forms.filter(f => f.playerCount === parseInt(team.playerCount));
    let optionsStr = '';
    filtered.forEach(f => {
      optionsStr += `<option value="${f.id}" ${f.id === team.defaultFormationId ? 'selected' : ''}>${f.name}</option>`;
    });

    container.innerHTML = `
      <div class="card-header">
        <h2 class="card-title">Kick Off Setup</h2>
        <span class="period-val">${team.name}</span>
      </div>
      
      <div class="form-group">
        <label class="form-label" for="setup-opponent-name">Opponent Club Name</label>
        <input class="form-input" type="text" id="setup-opponent-name" placeholder="e.g. Eagles FC">
      </div>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
        <div class="form-group">
          <label class="form-label" for="setup-half-length">Match Half (mins)</label>
          <input class="form-input" type="number" id="setup-half-length" value="${team.halfLength}">
        </div>
        <div class="form-group">
          <label class="form-label" for="setup-player-count">Field Format Size</label>
          <select class="form-select" id="setup-player-count">
            <option value="7" ${team.playerCount === 7 ? 'selected' : ''}>7v7</option>
            <option value="8" ${team.playerCount === 8 ? 'selected' : ''}>8v8</option>
            <option value="9" ${team.playerCount === 9 ? 'selected' : ''}>9v9</option>
            <option value="10" ${team.playerCount === 10 ? 'selected' : ''}>10v10</option>
            <option value="11" ${team.playerCount === 11 ? 'selected' : ''}>11v11</option>
          </select>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label" for="setup-formation">Starting Formation</label>
        <select class="form-select" id="setup-formation">
          ${optionsStr}
        </select>
      </div>

      <button class="btn btn-primary" id="btn-kickoff" style="width:100%; margin-top:8px;">
        ⚽ Start & Kick Off!
      </button>
    `;

    // Bind setup dashboard event triggers
    const formatSelect = document.getElementById('setup-player-count');
    if (formatSelect) {
      formatSelect.addEventListener('change', () => {
        const size = parseInt(formatSelect.value);
        const formSelect = document.getElementById('setup-formation');
        if (formSelect) {
          formSelect.innerHTML = '';
          const teamForms = this.state.getFormationsForTeam(this.activeTeamId);
          teamForms.filter(f => f.playerCount === size).forEach(f => {
            const opt = document.createElement('option');
            opt.value = f.id;
            opt.textContent = f.name;
            formSelect.appendChild(opt);
          });
        }
      });
    }

    const btnKickoff = document.getElementById('btn-kickoff');
    if (btnKickoff) {
      btnKickoff.addEventListener('click', () => {
        const oppName = document.getElementById('setup-opponent-name').value;
        const halfVal = document.getElementById('setup-half-length').value;
        const sizeVal = document.getElementById('setup-player-count').value;
        const formVal = document.getElementById('setup-formation').value;

        if (!formVal) {
          alert('Please select a valid formation to start!');
          return;
        }

        this.state.startMatch(
          this.activeTeamId,
          oppName,
          formVal,
          parseInt(sizeVal),
          parseInt(halfVal)
        );

        this.updateHeaderUI();
        this.refreshMatchView();
      });
    }
  }

  // ==========================================================
  // TIMERS INTERVAL ENGINE
  // ==========================================================

  startClockInterval() {
    if (this.matchTickerInterval) clearInterval(this.matchTickerInterval);

    this.matchTickerInterval = setInterval(() => {
      this.state.tickMatchSecond();
      
      // Update UI Ticks
      const timerLabel = document.getElementById('match-timer-label');
      if (timerLabel && this.state.activeMatch) {
        timerLabel.textContent = formatTime(this.state.activeMatch.elapsedSeconds);
      }

      // Redraw active positions minutes and bench timers
      this.pitch.render();
      this.renderBenchList();
      
      // Trigger auto-pauses at half-time limit
      if (this.state.activeMatch && this.state.activeMatch.state !== 'live') {
        this.stopClockInterval();
        this.refreshMatchView();
      }
    }, 1000);
  }

  stopClockInterval() {
    if (this.matchTickerInterval) {
      clearInterval(this.matchTickerInterval);
      this.matchTickerInterval = null;
    }
  }

  // ==========================================================
  // PLAY CONTROLLER ACTIONS
  // ==========================================================

  bindLiveMatchControls() {
    // 1. Play / Pause stopwatch
    const btnPlay = document.getElementById('btn-match-play-pause');
    if (btnPlay) {
      btnPlay.addEventListener('click', () => {
        const match = this.state.activeMatch;
        if (!match) return;

        if (match.state === 'live') {
          this.state.pauseMatch();
          this.stopClockInterval();
        } else {
          this.state.resumeMatch();
          this.startClockInterval();
        }
        this.refreshMatchView();
      });
    }

    // 2. Advance Period
    const btnPeriod = document.getElementById('btn-match-next-period');
    if (btnPeriod) {
      btnPeriod.addEventListener('click', () => {
        this.state.nextPeriodMatch();
        this.refreshMatchView();
      });
    }

    // 3. Goal adjustment triggers
    const btnUsPlus = document.getElementById('btn-score-us-plus');
    const btnThemPlus = document.getElementById('btn-score-them-plus');
    const btnUsMinus = document.getElementById('btn-score-us-minus');

    if (btnUsPlus) btnUsPlus.addEventListener('click', () => { this.state.adjustGoals('us', 1); this.refreshMatchView(); });
    if (btnThemPlus) btnThemPlus.addEventListener('click', () => { this.state.adjustGoals('them', 1); this.refreshMatchView(); });
    if (btnUsMinus) btnUsMinus.addEventListener('click', () => { this.state.adjustGoals('us', -1); this.refreshMatchView(); });

    // 4. End or Cancel match
    const btnCancel = document.getElementById('btn-cancel-match');
    if (btnCancel) {
      btnCancel.addEventListener('click', () => {
        if (confirm('Discard this active match and return to the Kick Off setup screen? Stats for this active match will be lost.')) {
          this.state.activeMatch = null;
          this.state.saveToStorage();
          this.stopClockInterval();
          this.updateHeaderUI();
          this.refreshMatchView();
        }
      });
    }

    const btnEnd = document.getElementById('btn-end-match');
    if (btnEnd) {
      btnEnd.addEventListener('click', () => {
        if (confirm('Are you absolutely sure you want to end this game and log all team playtimes to statistics history?')) {
          this.state.endAndSaveMatch();
          this.updateHeaderUI();
          this.refreshMatchView();
          this.switchView('history');
        }
      });
    }

    // 5. Position Swap Mode Button
    const btnSwapToggle = document.getElementById('btn-match-swap-toggle');
    if (btnSwapToggle) {
      btnSwapToggle.addEventListener('click', () => {
        const isSwapping = btnSwapToggle.classList.toggle('btn-primary');
        btnSwapToggle.classList.toggle('btn-secondary');
        
        if (isSwapping) {
          btnSwapToggle.textContent = '❌ Cancel Swap';
          this.pitch.setSwapMode(true);
        } else {
          btnSwapToggle.textContent = '🔄 Swap';
          this.pitch.setSwapMode(false);
        }
      });
    }
  }

  // Renders Bench players with individual playtime and sub action triggers
  renderBenchList() {
    const listEl = document.getElementById('match-bench-list');
    if (!listEl) return;

    listEl.innerHTML = '';
    const match = this.state.activeMatch;
    if (!match) return;

    const bench = match.players.filter(p => !p.isOnField);

    if (bench.length === 0) {
      listEl.innerHTML = '<p style="grid-column: span 2; text-align:center; padding:10px; font-size:12px; color:var(--text-sub);">Whole roster is currently on pitch!</p>';
      return;
    }

    bench.forEach(p => {
      const btn = document.createElement('button');
      btn.className = 'btn btn-secondary';
      btn.style.display = 'flex';
      btn.style.flexDirection = 'column';
      btn.style.alignItems = 'flex-start';
      btn.style.padding = '8px 12px';
      btn.style.minHeight = '50px';

      // Highlight if this bench player is selected as the sub out source
      const isSelectedSource = this.pitch.pendingSubBenchId === p.id;
      if (isSelectedSource) {
        btn.className = 'btn btn-accent';
      }

      // Check if player is already queued in a pending sub
      const isQueued = match.subQueue.some(q => q.inId === p.id);
      if (isQueued) {
        btn.style.border = '2px solid var(--accent)';
        btn.style.opacity = '0.7';
      }

      const activeMins = Math.round(p.totalSeconds / 60);

      btn.innerHTML = `
        <div style="display:flex; justify-content:space-between; width:100%; font-size:12px; font-weight:800; line-height:1;">
          <span style="color:var(--text-main);">#${p.number} ${p.name.split(' ')[0]}</span>
          <span style="color:var(--primary-dark); background:var(--primary-light); padding:1px 4px; border-radius:3px; font-size:9px;">
            ${activeMins} mins
          </span>
        </div>
        <span style="font-size:9px; font-weight:600; color:var(--text-sub); margin-top:2px;">
          ${isQueued ? ' Queued ⏳' : 'Tap to Sub In ➔'}
        </span>
      `;

      btn.addEventListener('click', () => {
        if (isQueued) return; // Wait until cleared or executed

        if (this.pitch.pendingSubBenchId === p.id) {
          // Toggle off
          this.pitch.clearSelections();
        } else {
          // Prime substitution out
          this.pitch.setPendingSubSource(p.id);
        }
        this.renderBenchList();
      });

      listEl.appendChild(btn);
    });
  }

  // Renders the chronological match events timeline
  renderMatchTimeline() {
    const listEl = document.getElementById('match-event-timeline');
    if (!listEl) return;

    listEl.innerHTML = '';
    const match = this.state.activeMatch;
    if (!match || match.events.length === 0) return;

    match.events.forEach(ev => {
      const row = document.createElement('div');
      row.style.borderBottom = '1px solid var(--border-color)';
      row.style.paddingBottom = '4px';
      row.style.display = 'flex';
      row.style.gap = '8px';

      // Match timestamp
      const timestamp = Math.floor(ev.second / 60) + "'";

      row.innerHTML = `
        <strong style="color:var(--primary-dark); font-variant-numeric:tabular-nums; width:30px;">${timestamp}</strong>
        <span style="color:var(--text-main); font-weight:600;">${ev.detail}</span>
      `;
      listEl.appendChild(row);
    });

    // Auto-scroll timeline to bottom
    setTimeout(() => {
      listEl.scrollTop = listEl.scrollHeight;
    }, 100);
  }

  // ==========================================================
  // PERFORMANCE STATISTICS OVERLAY LOGS
  // ==========================================================

  openStatsLogger(player) {
    const currentPlaytimeStr = formatTime(player.totalSeconds) + ' mins';
    setupStatsLoggerModal(player, currentPlaytimeStr, (pid, type) => {
      // Callback inside stats modal clicking Goal, Assist, Shot, Save, Foul, Cards
      this.state.logPlayerStat(pid, type);
      this.refreshMatchView();
    });
    openModal('modal-stats-logger');
  }

  // ==========================================================
  // MATCH HISTORY ARCS
  // ==========================================================

  renderMatchHistory() {
    const listEl = document.getElementById('history-games-list');
    if (!listEl) return;

    listEl.innerHTML = '';
    const team = this.state.getTeam(this.activeTeamId);
    if (!team || !team.history || team.history.length === 0) {
      listEl.innerHTML = '<p style="text-align:center; padding:40px; color:var(--text-sub);">No match records logged. Kick off a match to log stats!</p>';
      return;
    }

    team.history.forEach(game => {
      const row = document.createElement('div');
      row.className = 'list-item';
      row.style.cursor = 'pointer';

      // Highlight result color
      let borderClr = 'var(--border-color)';
      if (game.score.us > game.score.them) borderClr = '2px solid var(--primary)';
      if (game.score.us < game.score.them) borderClr = '2px solid var(--danger)';
      row.style.border = borderClr;

      row.innerHTML = `
        <div style="flex:1; min-width:0;">
          <h4 style="font-size:14px; font-weight:700;">vs ${game.opponent}</h4>
          <span style="font-size:11px; color:var(--text-sub); font-weight:600;">
            ${game.date} • ${game.formationName} • ${Math.round(game.totalSeconds / 60)} mins
          </span>
        </div>
        <div style="display:flex; align-items:center; gap:10px; flex-shrink:0;">
          <span style="font-size:18px; font-weight:800; color:var(--text-main);">
            ${game.score.us} - ${game.score.them}
          </span>
          <span style="font-size:16px; color:var(--text-sub);">➔</span>
          <button class="history-delete-btn" title="Delete this match" data-match-id="${game.id}"
            style="background:none; border:none; cursor:pointer; color:var(--danger); font-size:18px;
                   padding:4px 6px; border-radius:6px; line-height:1; opacity:0.75;
                   transition:opacity 0.2s, background 0.2s;"
            onmouseover="this.style.opacity='1';this.style.background='rgba(239,68,68,0.12)'"
            onmouseout="this.style.opacity='0.75';this.style.background='none'">
            🗑
          </button>
        </div>
      `;

      row.addEventListener('click', () => this.openMatchHistoryDetailModal(game));

      // Delete button — confirm then remove
      const deleteBtn = row.querySelector('.history-delete-btn');
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // don't open match detail
        const confirmed = confirm(
          `Delete match vs "${game.opponent}" (${game.date})?\n\nThis cannot be undone.`
        );
        if (confirmed) {
          this.state.deleteMatch(this.activeTeamId, game.id);
          this.renderMatchHistory();
        }
      });

      listEl.appendChild(row);
    });
  }

  openMatchHistoryDetailModal(game) {
    this.activeHistoryDetailGame = game;
    const title = document.getElementById('history-detail-title');
    const date = document.getElementById('history-detail-date');
    const usLabel = document.getElementById('history-detail-us');
    const themLabel = document.getElementById('history-detail-them');
    const scoreVal = document.getElementById('history-detail-score');
    
    if (title) title.textContent = `vs ${game.opponent}`;
    if (date) date.textContent = game.date;
    if (usLabel) usLabel.textContent = this.state.getTeam(this.activeTeamId).name;
    if (themLabel) themLabel.textContent = game.opponent;
    if (scoreVal) scoreVal.textContent = `${game.score.us} - ${game.score.them}`;

    // Renders players summary and playtime position distributions
    const playersList = document.getElementById('history-detail-player-stats');
    if (playersList) {
      playersList.innerHTML = '';
      game.players.forEach(p => {
        const item = document.createElement('div');
        item.style.padding = '8px';
        item.style.borderBottom = '1px solid var(--border-color)';
        item.style.display = 'flex';
        item.style.justifyContent = 'space-between';
        
        // Format position breakdown labels
        const breakdownKeys = Object.keys(p.positionsPlayed);
        let breakdownStr = '';
        if (breakdownKeys.length > 0) {
          breakdownStr = ': ' + breakdownKeys.map(k => {
            const entry = p.positionsPlayed[k];
            const mins = typeof entry === 'object' && entry !== null && entry.minutes !== undefined ? entry.minutes : entry;
            return `${k} (${mins}m)`;
          }).join(', ');
        }

        // Stats markers
        let statsStr = '';
        if (p.stats.goal > 0) statsStr += `⚽ ${p.stats.goal}G `;
        if (p.stats.assist > 0) statsStr += `👟 ${p.stats.assist}A `;
        if (p.stats.save > 0) statsStr += `🧤 ${p.stats.save}Sv `;
        if (p.stats.yellow > 0) statsStr += `🟨 `;
        if (p.stats.red > 0) statsStr += `🟥 `;

        item.innerHTML = `
          <div>
            <strong>#${p.number} ${p.name}</strong>
            <div style="font-size:10px; color:var(--text-sub);">${p.totalMinutes} mins played${breakdownStr}</div>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:12px; font-weight:800; color:var(--primary-dark);">${statsStr}</span>
            <span style="font-size:14px; color:var(--text-sub); margin-left:4px;">📍</span>
          </div>
        `;
        item.style.cursor = 'pointer';
        item.title = 'Click to view player positional heatmap';
        item.addEventListener('click', () => {
          closeModal('modal-history-detail');
          this.openPlayerHeatmapModal(
            `#${p.number} ${p.name}`,
            `Match vs ${game.opponent} — ${game.date}`,
            p.positionsPlayed,
            p.stats,
            p.totalMinutes,
            true
          );
        });
        playersList.appendChild(item);
      });
    }

    // Chronological event logger details inside reports
    const eventsList = document.getElementById('history-detail-events');
    if (eventsList) {
      eventsList.innerHTML = '';
      game.events.forEach(ev => {
        const item = document.createElement('div');
        item.style.padding = '3px 0';
        item.style.borderBottom = '1px solid rgba(0,0,0,0.05)';
        
        const timestamp = Math.floor(ev.second / 60) + "'";
        item.innerHTML = `<strong>${timestamp}</strong>: ${ev.detail}`;
        eventsList.appendChild(item);
      });
    }

    openModal('modal-history-detail');
  }

  // ==========================================================
  // DISPATCH CUSTOM EVENT TRIGGERS
  // ==========================================================

  bindGlobalEvents() {
    // Listens for triggers from Sub Out button in stats logger
    window.addEventListener('initiate-sub-out', (e) => {
      const pid = e.detail.playerId;
      this.pitch.setPendingSubSource(pid);
      this.renderBenchList();
    });

    // Sub queue confirmations re-sync bench lists and score controllers
    window.addEventListener('sub-queue-updated', () => {
      this.queuePanel.render();
      this.renderBenchList();
    });

    window.addEventListener('sub-queue-cleared', () => {
      this.pitch.clearSelections();
      this.renderBenchList();
    });

    // Deactivate swap controls when position swaps complete
    window.addEventListener('position-swap-complete', () => {
      const btnSwapToggle = document.getElementById('btn-match-swap-toggle');
      if (btnSwapToggle) {
        btnSwapToggle.className = 'btn btn-secondary';
        btnSwapToggle.textContent = '🔄 Swap';
      }
      this.refreshMatchView();
    });

    // Tactics Board Triggers
    const btnMatchBoard = document.getElementById('btn-match-board-trigger');
    if (btnMatchBoard) {
      btnMatchBoard.addEventListener('click', () => {
        if (this.board) this.board.open(this.activeTeamId);
      });
    }

    const btnSquadBoard = document.getElementById('btn-squad-board-trigger');
    if (btnSquadBoard) {
      btnSquadBoard.addEventListener('click', () => {
        if (this.board) this.board.open(this.activeTeamId);
      });
    }

    // Bind close events on player heatmap modal
    const closeHeatmapX = document.getElementById('btn-close-heatmap-x');
    if (closeHeatmapX) {
      closeHeatmapX.addEventListener('click', () => this.closePlayerHeatmapModal());
    }
    const closeHeatmapFooter = document.getElementById('btn-close-heatmap-footer');
    if (closeHeatmapFooter) {
      closeHeatmapFooter.addEventListener('click', () => this.closePlayerHeatmapModal());
    }
  }

  aggregatePlayerPositions(teamId, playerId) {
    const team = this.state.getTeam(teamId);
    if (!team || !team.history) return {};

    const aggregated = {};
    
    // Scan team history to find all matches where this player participated
    team.history.forEach(game => {
      const matchPlayer = game.players.find(p => p.id === playerId);
      if (matchPlayer && matchPlayer.positionsPlayed) {
        Object.entries(matchPlayer.positionsPlayed).forEach(([label, entry]) => {
          const isEnriched = typeof entry === 'object' && entry !== null && entry.minutes !== undefined;
          const mins = isEnriched ? entry.minutes : entry;
          
          if (mins <= 0) return;

          if (!aggregated[label]) {
            aggregated[label] = {
              minutes: 0,
              x: isEnriched ? entry.x : null,
              y: isEnriched ? entry.y : null,
              role: isEnriched ? entry.role : null
            };
          }
          aggregated[label].minutes += mins;
          
          // If coords are still null in our aggregated object but present in this match record, copy them over!
          if (aggregated[label].x === null && isEnriched && entry.x !== null) {
            aggregated[label].x = entry.x;
            aggregated[label].y = entry.y;
            aggregated[label].role = entry.role || aggregated[label].role;
          }
        });
      }
    });

    return aggregated;
  }

  openPlayerHeatmapModal(name, subtitle, positionsPlayed, stats, totalMins, backToHistory = false) {
    this.heatmapBackToHistory = backToHistory;
    const nameEl = document.getElementById('heatmap-player-name');
    const metaEl = document.getElementById('heatmap-player-meta');
    if (nameEl) nameEl.textContent = name;
    if (metaEl) metaEl.textContent = subtitle;

    const pillsEl = document.getElementById('heatmap-stat-pills');
    if (pillsEl) {
      pillsEl.innerHTML = '';
      if (stats) {
        const statsToRender = [
          { value: stats.goal || 0, label: '⚽ Goals' },
          { value: stats.assist || 0, label: '👟 Assists' },
          { value: stats.shot || 0, label: '🎯 Shots' },
          { value: stats.save || 0, label: '🧤 Saves' },
          { value: stats.foul || 0, label: '⚠️ Fouls' }
        ];
        
        statsToRender.forEach(s => {
          const pill = document.createElement('div');
          pill.className = 'heatmap-stat-pill';
          pill.innerHTML = `
            <span class="heatmap-stat-val">${s.value}</span>
            <span class="heatmap-stat-lbl">${s.label}</span>
          `;
          pillsEl.appendChild(pill);
        });
      }
    }

    const canvas = document.getElementById('heatmap-canvas');
    const legendTable = document.getElementById('heatmap-legend-table');
    
    if (canvas && legendTable) {
      legendTable.innerHTML = '';
      
      const { legendEntries } = PlayerHeatmap.renderInto(canvas, positionsPlayed);

      if (!legendEntries || legendEntries.length === 0) {
        legendTable.innerHTML = `
          <div style="text-align: center; padding: 24px 0; color: var(--text-muted); font-size: 13px; font-weight: 600;">
            No position tracking data available.
          </div>
        `;
      } else {
        legendEntries.forEach(item => {
          const row = document.createElement('div');
          row.className = 'heatmap-legend-row';
          
          const roleClass = 'role-' + (item.role || 'MID').toLowerCase();
          const roleText = item.role || 'MID';

          const pct = totalMins > 0 ? Math.round((item.minutes / totalMins) * 100) : 0;

          row.innerHTML = `
            <div class="heatmap-legend-label">
              <span class="role-badge ${roleClass}">${roleText}</span>
              <strong>${item.label}</strong>
            </div>
            <div style="color: var(--text-main); font-weight: 700;">
              ${item.minutes} mins <span style="color: var(--text-sub); font-size: 11px; font-weight: 600; margin-left: 4px;">(${pct}%)</span>
            </div>
          `;
          legendTable.appendChild(row);
        });
      }
    }

    openModal('modal-player-heatmap');
    
    // Trigger canvas resizing right after modal displays to guarantee bounds mapping
    setTimeout(() => {
      if (canvas) {
        PlayerHeatmap.renderInto(canvas, positionsPlayed);
      }
    }, 100);
  }

  closePlayerHeatmapModal() {
    closeModal('modal-player-heatmap');
    if (this.heatmapBackToHistory && this.activeHistoryDetailGame) {
      openModal('modal-history-detail');
    }
    this.heatmapBackToHistory = false;
  }

  // ==========================================================
  // TEAM ICON PICKER & CUSTOM IMAGE UPLOADER
  // ==========================================================

  bindIconPickerEvents() {
    const presets = ['⚽', '🏆', '⚡', '🛡️', '🦁', '🦅', '🌟', '🔥', '🐺', '🎯', '👑', '🐉', '🥇', '💥', '⚓', '⚔️', '🚀'];

    // Header logo click trigger
    const headerIcon = document.getElementById('header-team-icon');
    if (headerIcon) {
      headerIcon.addEventListener('click', () => this.openIconPickerModal());
    }

    // Squad settings icon preview & edit button
    const squadIconPreview = document.getElementById('squad-team-icon-preview');
    if (squadIconPreview) {
      squadIconPreview.addEventListener('click', () => this.openIconPickerModal());
    }
    const btnEditIcon = document.getElementById('btn-edit-team-icon');
    if (btnEditIcon) {
      btnEditIcon.addEventListener('click', () => this.openIconPickerModal());
    }

    // Custom image file upload listener
    const fileInput = document.getElementById('input-custom-team-icon');
    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
          const img = new Image();
          img.onload = () => {
            // Resize to max 128x128 to stay lightweight in localStorage
            const canvas = document.createElement('canvas');
            const maxSize = 128;
            let width = img.width;
            let height = img.height;

            if (width > height) {
              if (width > maxSize) {
                height = Math.round((height * maxSize) / width);
                width = maxSize;
              }
            } else {
              if (height > maxSize) {
                width = Math.round((width * maxSize) / height);
                height = maxSize;
              }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            const dataUrl = canvas.toDataURL('image/png');
            this.tempSelectedIcon = dataUrl;
            this.updateIconPickerPreviewUI(presets);
          };
          img.src = event.target.result;
        };
        reader.readAsDataURL(file);
        fileInput.value = '';
      });
    }

    // Reset button trigger
    const btnResetIcon = document.getElementById('btn-reset-team-icon');
    if (btnResetIcon) {
      btnResetIcon.addEventListener('click', () => {
        this.tempSelectedIcon = '⚽';
        this.updateIconPickerPreviewUI(presets);
      });
    }

    // Save icon trigger
    const btnSaveIcon = document.getElementById('btn-save-team-icon');
    if (btnSaveIcon) {
      btnSaveIcon.addEventListener('click', () => {
        if (this.activeTeamId && this.tempSelectedIcon) {
          this.state.updateTeamIcon(this.activeTeamId, this.tempSelectedIcon);
          this.updateHeaderUI();
          this.populateTeamSettingsForm();
        }
        closeModal('modal-team-icon');
      });
    }
  }

  openIconPickerModal() {
    const team = this.state.getTeam(this.activeTeamId);
    if (!team) return;

    this.tempSelectedIcon = team.icon || '⚽';
    const presets = ['⚽', '🏆', '⚡', '🛡️', '🦁', '🦅', '🌟', '🔥', '🐺', '🎯', '👑', '🐉', '🥇', '💥', '⚓', '⚔️', '🚀'];
    
    this.updateIconPickerPreviewUI(presets);
    openModal('modal-team-icon');
  }

  updateIconPickerPreviewUI(presets) {
    const previewEl = document.getElementById('icon-picker-preview');
    if (previewEl) {
      previewEl.innerHTML = this.renderIconElement(this.tempSelectedIcon, 36);
    }

    const gridEl = document.getElementById('icon-presets-grid');
    if (gridEl) {
      gridEl.innerHTML = '';
      presets.forEach(p => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `icon-preset-btn ${this.tempSelectedIcon === p ? 'active' : ''}`;
        btn.textContent = p;
        btn.addEventListener('click', () => {
          this.tempSelectedIcon = p;
          this.updateIconPickerPreviewUI(presets);
        });
        gridEl.appendChild(btn);
      });
    }
  }
}

// Instantiate master controller when page finishes loading
window.addEventListener('DOMContentLoaded', () => {
  new AppController();

  // Register PWA service worker for full offline field operations
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js')
      .then(reg => console.log('Service Worker registered successfully!', reg.scope))
      .catch(err => console.error('Service Worker registration failed:', err));
  }
});
