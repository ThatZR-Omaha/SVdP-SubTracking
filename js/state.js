/* ==========================================================================
   State Engine & Database - LocalStorage Sync
   Handles multi-team rosters, custom formations, match history, and the 
   complete live match tracking state machine with sub-second resolution.
   ========================================================================== */

import { STANDARD_FORMATIONS } from './utils/formations.js';

// LocalStorage Keys
const DB_KEY = 'SOCCER_SUB_TRACKER_DB';

export class AppState {
  constructor() {
    this.data = {
      teams: []
    };
    this.activeMatch = null; // Holds the active live match state
    this.loadFromStorage();
    
    // Bootstrap initial high-fidelity team if database is completely empty
    if (this.data.teams.length === 0) {
      this.bootstrapSampleData();
    }
  }

  // Load database from LocalStorage
  loadFromStorage() {
    try {
      const stored = localStorage.getItem(DB_KEY);
      if (stored) {
        this.data = JSON.parse(stored);
      }
      
      const storedActive = localStorage.getItem(DB_KEY + '_ACTIVE_MATCH');
      if (storedActive) {
        this.activeMatch = JSON.parse(storedActive);
      }
    } catch (e) {
      console.error('Error loading database', e);
    }
  }

  // Save database to LocalStorage
  saveToStorage() {
    try {
      localStorage.setItem(DB_KEY, JSON.stringify(this.data));
      if (this.activeMatch) {
        localStorage.setItem(DB_KEY + '_ACTIVE_MATCH', JSON.stringify(this.activeMatch));
      } else {
        localStorage.removeItem(DB_KEY + '_ACTIVE_MATCH');
      }
    } catch (e) {
      console.error('Error saving database', e);
    }
  }

  // ==========================================================
  // TEAMS & ROSTERS MANAGEMENT
  // ==========================================================

  getTeams() {
    return this.data.teams;
  }

  getTeam(teamId) {
    return this.data.teams.find(t => t.id === teamId);
  }

  createTeam(name, color, icon) {
    const newTeam = {
      id: 'team_' + Date.now(),
      name: name,
      color: color || '#15803d',
      icon: icon || '⚽',
      halfLength: 25,
      playerCount: 9,
      defaultFormationId: '9v9-3-3-2',
      players: [],
      history: [],
      customFormations: []
    };
    this.data.teams.push(newTeam);
    this.saveToStorage();
    return newTeam;
  }

  deleteTeam(teamId) {
    this.data.teams = this.data.teams.filter(t => t.id !== teamId);
    if (this.activeMatch && this.activeMatch.teamId === teamId) {
      this.activeMatch = null;
    }
    this.saveToStorage();
  }

  updateTeamSettings(teamId, halfLength, playerCount, defaultFormationId, icon) {
    const team = this.getTeam(teamId);
    if (team) {
      team.halfLength = parseInt(halfLength);
      team.playerCount = parseInt(playerCount);
      team.defaultFormationId = defaultFormationId;
      if (icon !== undefined) team.icon = icon;
      this.saveToStorage();
    }
  }

  updateTeamIcon(teamId, icon) {
    const team = this.getTeam(teamId);
    if (team) {
      team.icon = icon || '⚽';
      this.saveToStorage();
    }
  }

  addPlayer(teamId, name, number, preferredPosition) {
    const team = this.getTeam(teamId);
    if (team) {
      const player = {
        id: 'player_' + Date.now(),
        name: name,
        number: number.toString(),
        preferredPosition: preferredPosition || 'MID',
        stats: { goal: 0, assist: 0, shot: 0, save: 0, foul: 0, yellow: 0, red: 0, matchesPlayed: 0, totalMinutesPlayed: 0 }
      };
      team.players.push(player);
      this.saveToStorage();
      return player;
    }
    return null;
  }

  editPlayer(teamId, playerId, name, number, preferredPosition) {
    const team = this.getTeam(teamId);
    if (team) {
      const player = team.players.find(p => p.id === playerId);
      if (player) {
        player.name = name;
        player.number = number.toString();
        player.preferredPosition = preferredPosition;
        this.saveToStorage();
      }
    }
  }

  deletePlayer(teamId, playerId) {
    const team = this.getTeam(teamId);
    if (team) {
      team.players = team.players.filter(p => p.id !== playerId);
      this.saveToStorage();
    }
  }

  // Get formations list (Merges standard presets with the team's custom layouts)
  getFormationsForTeam(teamId) {
    const team = this.getTeam(teamId);
    const teamCustom = team ? team.customFormations || [] : [];
    const globalCustom = this.data.customFormations || [];
    
    // Combine them, avoiding duplicates by ID
    const combined = [...globalCustom, ...teamCustom];
    const seen = new Set();
    const unique = [];
    for (const f of combined) {
      if (!seen.has(f.id)) {
        seen.add(f.id);
        unique.push(f);
      }
    }
    return [...unique, ...STANDARD_FORMATIONS];
  }

  addCustomFormation(teamId, name, playerCount, positions) {
    if (!this.data.customFormations) this.data.customFormations = [];
    const newForm = {
      id: 'custom_' + Date.now(),
      name: name + ' (Custom)',
      playerCount: parseInt(playerCount),
      positions: positions,
      isCustom: true
    };
    this.data.customFormations.push(newForm);

    const team = this.getTeam(teamId);
    if (team) {
      if (!team.customFormations) team.customFormations = [];
      team.customFormations.push(newForm);
    }
    this.saveToStorage();
    return newForm;
  }

  // ==========================================================
  // LIVE MATCH ENGINE
  // ==========================================================

  startMatch(teamId, opponent, formationId, playerCount, halfLength) {
    const team = this.getTeam(teamId);
    if (!team) return null;

    const formations = this.getFormationsForTeam(teamId);
    const formation = formations.find(f => f.id === formationId) || formations.find(f => f.playerCount === playerCount);
    
    // Assign players on field vs bench initially
    // Take first 'playerCount' players and assign them positions on pitch
    const matchPlayers = team.players.map((p, idx) => {
      const isOnField = idx < playerCount;
      const positionNode = isOnField && formation ? formation.positions[idx] : null;
      
      const posLog = [];
      if (isOnField && positionNode) {
        posLog.push({
          position: positionNode.label,
          startSecond: 0,
          endSecond: null
        });
      }

      return {
        id: p.id,
        name: p.name,
        number: p.number,
        preferredPosition: p.preferredPosition,
        isOnField: isOnField,
        position: positionNode ? positionNode.label : null,
        positionRole: positionNode ? positionNode.role : null,
        totalSeconds: 0,
        stats: { goal: 0, assist: 0, shot: 0, save: 0, foul: 0, yellow: 0, red: 0 },
        positionLog: posLog
      };
    });

    this.activeMatch = {
      id: 'match_' + Date.now(),
      teamId: teamId,
      teamName: team.name,
      teamColor: team.color,
      opponent: opponent || 'Opponent',
      halfLength: parseInt(halfLength) * 60, // save in seconds
      playerCount: parseInt(playerCount),
      formation: formation,
      score: { us: 0, them: 0 },
      state: 'pre', // 'pre' | 'live' | 'paused' | 'ended'
      elapsedSeconds: 0,
      period: 1, // 1st Half, 2nd Half
      players: matchPlayers,
      events: [
        { type: 'info', detail: `Match configured: ${playerCount}v${playerCount} using ${formation.name}`, second: 0 }
      ],
      subQueue: []
    };

    this.saveToStorage();
    return this.activeMatch;
  }

  // Ticks the master match stopwatch by 1 second
  tickMatchSecond() {
    if (!this.activeMatch || this.activeMatch.state !== 'live') return;

    this.activeMatch.elapsedSeconds++;

    // Increment active play times
    this.activeMatch.players.forEach(p => {
      if (p.isOnField) {
        p.totalSeconds++;
      }
    });

    // Handle auto-pause at half-time limit
    if (this.activeMatch.elapsedSeconds >= this.activeMatch.halfLength * this.activeMatch.period) {
      this.activeMatch.state = 'paused';
      this.activeMatch.events.push({
        type: 'info',
        detail: `Clock paused: End of Period ${this.activeMatch.period}`,
        second: this.activeMatch.elapsedSeconds
      });
    }

    this.saveToStorage();
  }

  pauseMatch() {
    if (this.activeMatch && this.activeMatch.state === 'live') {
      this.activeMatch.state = 'paused';
      this.activeMatch.events.push({
        type: 'info',
        detail: 'Match Paused',
        second: this.activeMatch.elapsedSeconds
      });
      this.saveToStorage();
    }
  }

  resumeMatch() {
    if (this.activeMatch && (this.activeMatch.state === 'paused' || this.activeMatch.state === 'pre')) {
      const wasPreMatch = this.activeMatch.state === 'pre';
      this.activeMatch.state = 'live';
      this.activeMatch.events.push({
        type: 'info',
        detail: wasPreMatch ? 'Match Kick-off! ⚽' : 'Match Resumed',
        second: this.activeMatch.elapsedSeconds
      });
      this.saveToStorage();
    }
  }

  nextPeriodMatch() {
    if (!this.activeMatch) return;
    
    if (this.activeMatch.period === 1) {
      this.activeMatch.period = 2;
      this.activeMatch.state = 'paused';
      
      const targetSeconds = this.activeMatch.halfLength;
      this.activeMatch.elapsedSeconds = targetSeconds;

      // Adjust any player log timestamps that might be greater than targetSeconds
      this.activeMatch.players.forEach(p => {
        p.positionLog.forEach(log => {
          if (log.startSecond > targetSeconds) {
            log.startSecond = targetSeconds;
          }
          if (log.endSecond !== null && log.endSecond > targetSeconds) {
            log.endSecond = targetSeconds;
          }
        });
      });

      // Adjust any event timestamps that might be greater than targetSeconds
      this.activeMatch.events.forEach(ev => {
        if (ev.second > targetSeconds) {
          ev.second = targetSeconds;
        }
      });

      this.activeMatch.events.push({
        type: 'info',
        detail: 'Started 2nd Half',
        second: targetSeconds
      });
    } else {
      // If clicked at end of 2nd half, offer to end match
      this.activeMatch.state = 'paused';
    }
    this.saveToStorage();
  }

  // ==========================================================
  // SUBSTITUTION QUEUE OPERATIONS
  // ==========================================================

  // Queues a sub (Bench player replacing an on-field player)
  // Double-trigger flow: Bench player clicked first, then Active player
  queueSubstitution(benchPlayerId, onFieldPlayerId) {
    if (!this.activeMatch) return;

    const benchPlayer = this.activeMatch.players.find(p => p.id === benchPlayerId && !p.isOnField);
    const onFieldPlayer = this.activeMatch.players.find(p => p.id === onFieldPlayerId && p.isOnField);

    if (!benchPlayer || !onFieldPlayer) return;

    // Check if either player is already in a pending sub
    const exists = this.activeMatch.subQueue.some(q => q.inId === benchPlayerId || q.outId === onFieldPlayerId);
    if (exists) return; // Prevent double queueing the same players

    this.activeMatch.subQueue.push({
      inId: benchPlayerId,
      inName: benchPlayer.name,
      inNumber: benchPlayer.number,
      outId: onFieldPlayerId,
      outName: onFieldPlayer.name,
      outNumber: onFieldPlayer.number,
      outPosition: onFieldPlayer.position,
      outPositionRole: onFieldPlayer.positionRole
    });

    this.saveToStorage();
  }

  removeQueuedSub(index) {
    if (this.activeMatch) {
      this.activeMatch.subQueue.splice(index, 1);
      this.saveToStorage();
    }
  }

  clearSubQueue() {
    if (this.activeMatch) {
      this.activeMatch.subQueue = [];
      this.saveToStorage();
    }
  }

  // Applies all queued subs simultaneously with a single confirmation log
  executeSubQueue() {
    if (!this.activeMatch || this.activeMatch.subQueue.length === 0) return;

    const currentSecond = this.activeMatch.elapsedSeconds;
    const subLogs = [];

    this.activeMatch.subQueue.forEach(sub => {
      const inPlayer = this.activeMatch.players.find(p => p.id === sub.inId);
      const outPlayer = this.activeMatch.players.find(p => p.id === sub.outId);

      if (inPlayer && outPlayer) {
        // 1. Log Outgoing Player position end
        const lastLog = outPlayer.positionLog[outPlayer.positionLog.length - 1];
        if (lastLog) {
          lastLog.endSecond = currentSecond;
        }

        // 2. Perform Swap
        outPlayer.isOnField = false;
        outPlayer.position = null;
        outPlayer.positionRole = null;

        inPlayer.isOnField = true;
        inPlayer.position = sub.outPosition;
        inPlayer.positionRole = sub.outPositionRole;

        // 3. Log Incoming Player position start
        inPlayer.positionLog.push({
          position: sub.outPosition,
          startSecond: currentSecond,
          endSecond: null
        });

        subLogs.push(`#${inPlayer.number} ${inPlayer.name} for #${outPlayer.number} ${outPlayer.name} [${sub.outPosition}]`);
      }
    });

    // Record Event on Timeline
    this.activeMatch.events.push({
      type: 'sub',
      detail: `Subs Executed: ` + subLogs.join(', '),
      second: currentSecond
    });

    // Clear the queue
    this.activeMatch.subQueue = [];
    this.saveToStorage();
  }

  // ==========================================================
  // ON-FIELD POSITION SWAPPING
  // ==========================================================

  // Exchanges the positions of two players currently active on the field
  swapPositions(player1Id, player2Id) {
    if (!this.activeMatch) return;

    const p1 = this.activeMatch.players.find(p => p.id === player1Id && p.isOnField);
    const p2 = this.activeMatch.players.find(p => p.id === player2Id && p.isOnField);

    if (!p1 || !p2) return;

    const currentSecond = this.activeMatch.elapsedSeconds;

    // End current position logs for both
    const p1Last = p1.positionLog[p1.positionLog.length - 1];
    if (p1Last) p1Last.endSecond = currentSecond;

    const p2Last = p2.positionLog[p2.positionLog.length - 1];
    if (p2Last) p2Last.endSecond = currentSecond;

    // Exchange details
    const tempPos = p1.position;
    const tempRole = p1.positionRole;

    p1.position = p2.position;
    p1.positionRole = p2.positionRole;

    p2.position = tempPos;
    p2.positionRole = tempRole;

    // Start new position logs
    p1.positionLog.push({ position: p1.position, startSecond: currentSecond, endSecond: null });
    p2.positionLog.push({ position: p2.position, startSecond: currentSecond, endSecond: null });

    this.activeMatch.events.push({
      type: 'swap',
      detail: `Tactical Swap: #${p1.number} ${p1.name} and #${p2.number} ${p2.name} swapped positions`,
      second: currentSecond
    });

    this.saveToStorage();
  }

  // ==========================================================
  // PERFORMANCE STATISTICS LOGGING
  // ==========================================================

  logPlayerStat(playerId, statType) {
    if (!this.activeMatch) return;

    const player = this.activeMatch.players.find(p => p.id === playerId);
    if (!player) return;

    // Increment local stats in match record
    if (player.stats[statType] !== undefined) {
      player.stats[statType]++;
    }

    const currentSecond = this.activeMatch.elapsedSeconds;
    const minStr = Math.floor(currentSecond / 60) + "'";

    // If goal, update team score and log event
    if (statType === 'goal') {
      this.activeMatch.score.us++;
      this.activeMatch.events.push({
        type: 'goal',
        detail: `⚽ GOAL! #${player.number} ${player.name} scores!`,
        second: currentSecond
      });
    } else {
      let icon = '';
      if (statType === 'assist') icon = '👟 Assist';
      if (statType === 'shot') icon = '🎯 Shot on Target';
      if (statType === 'save') icon = '🧤 Goalkeeper Save';
      if (statType === 'foul') icon = '⚠️ Foul';
      if (statType === 'yellow') icon = '🟨 Yellow Card';
      if (statType === 'red') icon = '🟥 RED CARD';

      this.activeMatch.events.push({
        type: statType,
        detail: `${icon}: #${player.number} ${player.name}`,
        second: currentSecond
      });
      
      if (statType === 'red') {
        // Red card sends them off the pitch!
        this.sendOffPlayer(playerId);
      }
    }

    this.saveToStorage();
  }

  // Sends player off the field immediately due to a red card
  sendOffPlayer(playerId) {
    const player = this.activeMatch.players.find(p => p.id === playerId);
    if (player && player.isOnField) {
      const currentSecond = this.activeMatch.elapsedSeconds;
      const lastLog = player.positionLog[player.positionLog.length - 1];
      if (lastLog) lastLog.endSecond = currentSecond;
      
      player.isOnField = false;
      player.position = null;
      player.positionRole = null;
    }
  }

  adjustGoals(side, change) {
    if (!this.activeMatch) return;
    
    if (side === 'us') {
      this.activeMatch.score.us = Math.max(0, this.activeMatch.score.us + change);
    } else {
      this.activeMatch.score.them = Math.max(0, this.activeMatch.score.them + change);
    }
    
    this.activeMatch.events.push({
      type: 'info',
      detail: `Score adjusted to: ${this.activeMatch.score.us} - ${this.activeMatch.score.them}`,
      second: this.activeMatch.elapsedSeconds
    });

    this.saveToStorage();
  }

  // ==========================================================
  // MATCH PERSISTENCE & HISTORY SAVE
  // ==========================================================

  endAndSaveMatch() {
    if (!this.activeMatch) return;

    const match = this.activeMatch;
    const currentSecond = match.elapsedSeconds;

    // 1. Close out any active position logs
    match.players.forEach(p => {
      if (p.isOnField) {
        const lastLog = p.positionLog[p.positionLog.length - 1];
        if (lastLog) {
          lastLog.endSecond = currentSecond;
        }
      }
    });

    // 2. Format detailed historical record
    const historyItem = {
      id: match.id,
      opponent: match.opponent,
      date: new Date().toLocaleDateString(),
      score: { us: match.score.us, them: match.score.them },
      playerCount: match.playerCount,
      formationName: match.formation.name,
      totalSeconds: currentSecond,
      players: match.players.map(p => {
        // Calculate breakdown of position minutes
        const activeMinutes = Math.round(p.totalSeconds / 60);
        
        // Breakdown of exact positions played
        const posBreakdown = {};
        p.positionLog.forEach(log => {
          const endSec = log.endSecond !== null ? log.endSecond : currentSecond;
          const durationMins = Math.round((endSec - log.startSecond) / 60);
          if (durationMins > 0) {
            const formationPos = match.formation && match.formation.positions
              ? match.formation.positions.find(fp => fp.label === log.position)
              : null;
            if (!posBreakdown[log.position]) {
              posBreakdown[log.position] = {
                minutes: 0,
                x: formationPos ? formationPos.x : null,
                y: formationPos ? formationPos.y : null,
                role: formationPos ? formationPos.role : null
              };
            }
            posBreakdown[log.position].minutes += durationMins;
          }
        });

        return {
          id: p.id,
          name: p.name,
          number: p.number,
          totalMinutes: activeMinutes,
          positionsPlayed: posBreakdown,
          stats: p.stats
        };
      }),
      events: match.events
    };

    // 3. Aggregate cumulative statistics inside team squad record
    const team = this.getTeam(match.teamId);
    if (team) {
      if (!team.history) team.history = [];
      team.history.unshift(historyItem); // Add to beginning of log

      // Update player lifetime totals
      match.players.forEach(matchPlayer => {
        const rosterPlayer = team.players.find(p => p.id === matchPlayer.id);
        if (rosterPlayer) {
          if (!rosterPlayer.stats) {
            rosterPlayer.stats = { goal: 0, assist: 0, shot: 0, save: 0, foul: 0, yellow: 0, red: 0, matchesPlayed: 0, totalMinutesPlayed: 0 };
          }
          
          rosterPlayer.stats.matchesPlayed++;
          rosterPlayer.stats.totalMinutesPlayed += Math.round(matchPlayer.totalSeconds / 60);
          
          Object.keys(matchPlayer.stats).forEach(stat => {
            rosterPlayer.stats[stat] = (rosterPlayer.stats[stat] || 0) + matchPlayer.stats[stat];
          });
        }
      });
    }

    // 4. Wipe active match state
    this.activeMatch = null;
    this.saveToStorage();
  }

  // ==========================================================
  // SAMPLE DATA BOOTSTRAPPING
  // ==========================================================

  bootstrapSampleData() {
    // Two sample rosters — one is randomly selected on first launch
    const mockMensPlayers = [
      // Starting IX
      { name: 'Marco Vianello', number: 1, pos: 'GK' },
      { name: 'Harrison Pike', number: 2, pos: 'DEF' },
      { name: 'Devon Smith', number: 3, pos: 'DEF' },
      { name: 'Bram van der Meer', number: 4, pos: 'DEF' },
      { name: 'Mateo Ramos', number: 5, pos: 'DEF' },
      { name: 'Ibrahima Diop', number: 6, pos: 'MID' },
      { name: 'Mat\u00edas Delgado', number: 7, pos: 'FW' },
      { name: 'Luka Horvat', number: 8, pos: 'MID' },
      { name: 'Henrik Lindqvist', number: 9, pos: 'FW' },
      // Subs
      { name: 'Tobias Kroll', number: 13, pos: 'GK' },
      { name: 'Diogo Morais', number: 14, pos: 'DEF' },
      { name: 'Lucas Vega', number: 15, pos: 'DEF' },
      { name: 'Daniel O\u2019Connor', number: 16, pos: 'MID' },
      { name: 'Paul Gautier', number: 19, pos: 'FW' }
    ];

    const mockWomensPlayers = [
      // Starting IX
      { name: 'Clara Lindholm', number: 1, pos: 'GK' },
      { name: 'Fiona Westwood', number: 2, pos: 'DEF' },
      { name: 'Nuria Ruiz', number: 3, pos: 'DEF' },
      { name: 'Axelle Laurent', number: 4, pos: 'DEF' },
      { name: 'Cassidy Siemek', number: 5, pos: 'DEF' },
      { name: 'Siobhan Stone', number: 6, pos: 'MID' },
      { name: 'Ingrid Hansen', number: 7, pos: 'FW' },
      { name: 'Elena Vidal', number: 8, pos: 'MID' },
      { name: 'Harper Miller', number: 9, pos: 'FW' },
      // Subs
      { name: 'Maeve Wood', number: 13, pos: 'GK' },
      { name: 'Sarah Shaw', number: 14, pos: 'DEF' },
      { name: 'Maya Smyth', number: 15, pos: 'DEF' },
      { name: 'Brenna Green', number: 16, pos: 'MID' },
      { name: 'Amara Adebayo', number: 19, pos: 'FW' }
    ];

    const isMens = Math.random() < 0.5;
    const mockPlayers = isMens ? mockMensPlayers : mockWomensPlayers;
    const defaultIcon = isMens ? '⚽' : '⭐';
    const t = this.createTeam(teamName, '#15803d', defaultIcon);

    // Add 14 players (9 field positions + 5 sub options)
    mockPlayers.forEach(p => {
      this.addPlayer(t.id, p.name, p.number, p.pos);
    });

    // Populate a sample past match report
    const team = this.getTeam(t.id);
    const mockHistoryItem = {
      id: 'sample_match_history',
      opponent: 'Strikers Academy',
      date: '2026-05-12',
      score: { us: 3, them: 2 },
      playerCount: 9,
      formationName: '3-3-2 (Balanced Attack)',
      totalSeconds: 3000, // 50 mins
      players: team.players.map((p, idx) => {
        const isSub = idx >= 9;
        const mins = isSub ? 15 : 35;
        // idx 8 (#9 FW) scores 2, idx 13 (FW sub #19) scores 1
        const goals = idx === 8 ? 2 : (idx === 13 ? 1 : 0);
        // idx 7 (#8 MID) assists 2, idx 5 (#6 MID) assists 1
        const assists = idx === 7 ? 2 : (idx === 5 ? 1 : 0);

        // Position mapping for 3-3-2 formation + subs
        let label = 'CM', x = 50, y = 48, role = 'MID';
        if (idx === 0)       { label = 'GK';  x = 50; y = 90; role = 'GK'; }
        else if (idx === 1)  { label = 'RB';  x = 80; y = 70; role = 'DEF'; }
        else if (idx === 2)  { label = 'CB';  x = 50; y = 72; role = 'DEF'; }
        else if (idx === 3)  { label = 'LB';  x = 20; y = 70; role = 'DEF'; }
        else if (idx === 4)  { label = 'CDM'; x = 50; y = 55; role = 'MID'; }
        else if (idx === 5)  { label = 'RM';  x = 82; y = 45; role = 'MID'; }
        else if (idx === 6)  { label = 'RF';  x = 70; y = 18; role = 'FW'; }
        else if (idx === 7)  { label = 'LM';  x = 18; y = 45; role = 'MID'; }
        else if (idx === 8)  { label = 'LF';  x = 30; y = 18; role = 'FW'; }
        else if (idx === 9)  { label = 'GK';  x = 50; y = 90; role = 'GK'; }
        else if (idx === 10) { label = 'CB';  x = 50; y = 72; role = 'DEF'; }
        else if (idx === 11) { label = 'LB';  x = 20; y = 70; role = 'DEF'; }
        else if (idx === 12) { label = 'RM';  x = 82; y = 45; role = 'MID'; }
        else if (idx === 13) { label = 'RF';  x = 70; y = 18; role = 'FW'; }

        return {
          id: p.id,
          name: p.name,
          number: p.number,
          totalMinutes: mins,
          positionsPlayed: {
            [label]: { minutes: mins, x, y, role }
          },
          stats: { goal: goals, assist: assists, shot: goals + 1, save: idx === 0 ? 6 : 0, foul: idx === 2 ? 2 : 0, yellow: idx === 2 ? 1 : 0, red: 0 }
        };
      }),
      events: [
        { type: 'info', detail: 'Match Kick-off!', second: 0 },
        { type: 'goal', detail: `⚽ GOAL! #${team.players[8].number} ${team.players[8].name} scores!`, second: 360 },
        { type: 'assist', detail: `👟 Assist: #${team.players[7].number} ${team.players[7].name}`, second: 360 },
        { type: 'goal', detail: `⚽ GOAL! #${team.players[8].number} ${team.players[8].name} scores again!`, second: 1220 },
        { type: 'sub', detail: `Subs Executed: #${team.players[13].number} ${team.players[13].name} for #${team.players[6].number} ${team.players[6].name} [FW]`, second: 1500 },
        { type: 'goal', detail: `⚽ GOAL! #${team.players[13].number} ${team.players[13].name} scores immediately!`, second: 1840 },
        { type: 'info', detail: 'Clock ended. Match complete.', second: 3000 }
      ]
    };

    team.history.push(mockHistoryItem);

    // Apply cumulative stats to roster players from the sample match
    team.players.forEach((p, idx) => {
      const isSub = idx >= 9;
      p.stats.matchesPlayed = 1;
      p.stats.totalMinutesPlayed = isSub ? 15 : 35;
      p.stats.goal = idx === 8 ? 2 : (idx === 13 ? 1 : 0);
      p.stats.assist = idx === 7 ? 2 : (idx === 5 ? 1 : 0);
      p.stats.shot = p.stats.goal + 1;
      p.stats.save = idx === 0 ? 6 : 0;
      p.stats.foul = idx === 2 ? 2 : 0;
      p.stats.yellow = idx === 2 ? 1 : 0;
    });

    this.saveToStorage();
  }


  // ==========================================================
  // DELETE MATCH HISTORY
  // ==========================================================

  deleteMatch(teamId, matchId) {
    const team = this.getTeam(teamId);
    if (!team || !team.history) return false;
    const idx = team.history.findIndex(m => m.id === matchId);
    if (idx === -1) return false;
    team.history.splice(idx, 1);
    this.saveToStorage();
    return true;
  }
}
