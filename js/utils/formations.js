/* ==========================================================================
   Soccer Formation Coordinates Database
   Grid coordinates represent vertical coaching board layout:
   - x: 0% (Left touchline) to 100% (Right touchline)
   - y: 0% (Opponent Goal/Top) to 100% (Our Goal/Bottom)
   ========================================================================== */

export const STANDARD_FORMATIONS = [
  // ----------------------------------------------------
  // 7v7 Formations (Goalkeeper + 6 Outfield)
  // ----------------------------------------------------
  {
    id: "7v7-2-3-1",
    name: "2-3-1 (Balanced)",
    playerCount: 7,
    positions: [
      { id: "gk", label: "GK", role: "GK", x: 50, y: 90 },
      { id: "ld", label: "LD", role: "DEF", x: 25, y: 70 },
      { id: "rd", label: "RD", role: "DEF", x: 75, y: 70 },
      { id: "lm", label: "LM", role: "MID", x: 20, y: 45 },
      { id: "cm", label: "CM", role: "MID", x: 50, y: 48 },
      { id: "rm", label: "RM", role: "MID", x: 80, y: 45 },
      { id: "st", label: "ST", role: "FW", x: 50, y: 18 }
    ]
  },
  {
    id: "7v7-3-2-1",
    name: "3-2-1 (Solid Defense)",
    playerCount: 7,
    positions: [
      { id: "gk", label: "GK", role: "GK", x: 50, y: 90 },
      { id: "lb", label: "LB", role: "DEF", x: 20, y: 70 },
      { id: "cb", label: "CB", role: "DEF", x: 50, y: 72 },
      { id: "rb", label: "RB", role: "DEF", x: 80, y: 70 },
      { id: "lcm", label: "LCM", role: "MID", x: 33, y: 45 },
      { id: "rcm", label: "RCM", role: "MID", x: 67, y: 45 },
      { id: "st", label: "ST", role: "FW", x: 50, y: 18 }
    ]
  },
  {
    id: "7v7-2-1-2-1",
    name: "2-1-2-1 (Diamond)",
    playerCount: 7,
    positions: [
      { id: "gk", label: "GK", role: "GK", x: 50, y: 90 },
      { id: "ld", label: "LD", role: "DEF", x: 28, y: 72 },
      { id: "rd", label: "RD", role: "DEF", x: 72, y: 72 },
      { id: "dm", label: "DM", role: "MID", x: 50, y: 56 },
      { id: "am", label: "AM", role: "MID", x: 50, y: 36 },
      { id: "lf", label: "LF", role: "FW", x: 28, y: 18 },
      { id: "rf", label: "RF", role: "FW", x: 72, y: 18 }
    ]
  },

  // ----------------------------------------------------
  // 8v8 Formations (Goalkeeper + 7 Outfield)
  // ----------------------------------------------------
  {
    id: "8v8-3-3-1",
    name: "3-3-1 (Classic)",
    playerCount: 8,
    positions: [
      { id: "gk", label: "GK", role: "GK", x: 50, y: 90 },
      { id: "lb", label: "LB", role: "DEF", x: 20, y: 70 },
      { id: "cb", label: "CB", role: "DEF", x: 50, y: 72 },
      { id: "rb", label: "RB", role: "DEF", x: 80, y: 70 },
      { id: "lm", label: "LM", role: "MID", x: 18, y: 45 },
      { id: "cm", label: "CM", role: "MID", x: 50, y: 48 },
      { id: "rm", label: "RM", role: "MID", x: 82, y: 45 },
      { id: "st", label: "ST", role: "FW", x: 50, y: 18 }
    ]
  },
  {
    id: "8v8-3-2-2",
    name: "3-2-2 (Attacking Width)",
    playerCount: 8,
    positions: [
      { id: "gk", label: "GK", role: "GK", x: 50, y: 90 },
      { id: "lb", label: "LB", role: "DEF", x: 20, y: 70 },
      { id: "cb", label: "CB", role: "DEF", x: 50, y: 72 },
      { id: "rb", label: "RB", role: "DEF", x: 80, y: 70 },
      { id: "lcm", label: "LCM", role: "MID", x: 33, y: 46 },
      { id: "rcm", label: "RCM", role: "MID", x: 67, y: 46 },
      { id: "lf", label: "LF", role: "FW", x: 30, y: 18 },
      { id: "rf", label: "RF", role: "FW", x: 70, y: 18 }
    ]
  },

  // ----------------------------------------------------
  // 9v9 Formations (Goalkeeper + 8 Outfield)
  // ----------------------------------------------------
  {
    id: "9v9-3-3-2",
    name: "3-3-2 (Balanced Attack)",
    playerCount: 9,
    positions: [
      { id: "gk", label: "GK", role: "GK", x: 50, y: 90 },
      { id: "lb", label: "LB", role: "DEF", x: 20, y: 70 },
      { id: "cb", label: "CB", role: "DEF", x: 50, y: 72 },
      { id: "rb", label: "RB", role: "DEF", x: 80, y: 70 },
      { id: "lm", label: "LM", role: "MID", x: 18, y: 45 },
      { id: "cm", label: "CM", role: "MID", x: 50, y: 48 },
      { id: "rm", label: "RM", role: "MID", x: 82, y: 45 },
      { id: "lf", label: "LF", role: "FW", x: 30, y: 18 },
      { id: "rf", label: "RF", role: "FW", x: 70, y: 18 }
    ]
  },
  {
    id: "9v9-4-3-1",
    name: "4-3-1 (Defensive Width)",
    playerCount: 9,
    positions: [
      { id: "gk", label: "GK", role: "GK", x: 50, y: 90 },
      { id: "lb", label: "LB", role: "DEF", x: 15, y: 70 },
      { id: "lcb", label: "LCB", role: "DEF", x: 38, y: 72 },
      { id: "rcb", label: "RCB", role: "DEF", x: 62, y: 72 },
      { id: "rb", label: "RB", role: "DEF", x: 85, y: 70 },
      { id: "lcm", label: "LCM", role: "MID", x: 28, y: 45 },
      { id: "rcm", label: "RCM", role: "MID", x: 72, y: 45 },
      { id: "dm", label: "DM", role: "MID", x: 50, y: 55 },
      { id: "st", label: "ST", role: "FW", x: 50, y: 18 }
    ]
  },
  {
    id: "9v9-3-4-1",
    name: "3-4-1 (Midfield Dominance)",
    playerCount: 9,
    positions: [
      { id: "gk", label: "GK", role: "GK", x: 50, y: 90 },
      { id: "lb", label: "LB", role: "DEF", x: 22, y: 70 },
      { id: "cb", label: "CB", role: "DEF", x: 50, y: 72 },
      { id: "rb", label: "RB", role: "DEF", x: 78, y: 70 },
      { id: "lm", label: "LM", role: "MID", x: 16, y: 42 },
      { id: "lcm", label: "LCM", role: "MID", x: 38, y: 45 },
      { id: "rcm", label: "RCM", role: "MID", x: 62, y: 45 },
      { id: "rm", label: "RM", role: "MID", x: 84, y: 42 },
      { id: "st", label: "ST", role: "FW", x: 50, y: 18 }
    ]
  },

  // ----------------------------------------------------
  // 10v10 Formations (Goalkeeper + 9 Outfield)
  // ----------------------------------------------------
  {
    id: "10v10-4-4-1",
    name: "4-4-1 (Standard)",
    playerCount: 10,
    positions: [
      { id: "gk", label: "GK", role: "GK", x: 50, y: 90 },
      { id: "lb", label: "LB", role: "DEF", x: 15, y: 70 },
      { id: "lcb", label: "LCB", role: "DEF", x: 38, y: 72 },
      { id: "rcb", label: "RCB", role: "DEF", x: 62, y: 72 },
      { id: "rb", label: "RB", role: "DEF", x: 85, y: 70 },
      { id: "lm", label: "LM", role: "MID", x: 16, y: 45 },
      { id: "lcm", label: "LCM", role: "MID", x: 38, y: 48 },
      { id: "rcm", label: "RCM", role: "MID", x: 62, y: 48 },
      { id: "rm", label: "RM", role: "MID", x: 84, y: 45 },
      { id: "st", label: "ST", role: "FW", x: 50, y: 18 }
    ]
  },

  // ----------------------------------------------------
  // 11v11 Formations (Goalkeeper + 10 Outfield)
  // ----------------------------------------------------
  {
    id: "11v11-4-3-3",
    name: "4-3-3 (Attacking Wingers)",
    playerCount: 11,
    positions: [
      { id: "gk", label: "GK", role: "GK", x: 50, y: 90 },
      { id: "lb", label: "LB", role: "DEF", x: 15, y: 70 },
      { id: "lcb", label: "LCB", role: "DEF", x: 38, y: 72 },
      { id: "rcb", label: "RCB", role: "DEF", x: 62, y: 72 },
      { id: "rb", label: "RB", role: "DEF", x: 85, y: 70 },
      { id: "dm", label: "DM", role: "MID", x: 50, y: 55 },
      { id: "lcm", label: "LCM", role: "MID", x: 30, y: 44 },
      { id: "rcm", label: "RCM", role: "MID", x: 70, y: 44 },
      { id: "lw", label: "LW", role: "FW", x: 20, y: 20 },
      { id: "st", label: "ST", role: "FW", x: 50, y: 15 },
      { id: "rw", label: "RW", role: "FW", x: 80, y: 20 }
    ]
  },
  {
    id: "11v11-4-4-2",
    name: "4-4-2 (Classic Flat)",
    playerCount: 11,
    positions: [
      { id: "gk", label: "GK", role: "GK", x: 50, y: 90 },
      { id: "lb", label: "LB", role: "DEF", x: 15, y: 70 },
      { id: "lcb", label: "LCB", role: "DEF", x: 38, y: 72 },
      { id: "rcb", label: "RCB", role: "DEF", x: 62, y: 72 },
      { id: "rb", label: "RB", role: "DEF", x: 85, y: 70 },
      { id: "lm", label: "LM", role: "MID", x: 16, y: 45 },
      { id: "lcm", label: "LCM", role: "MID", x: 38, y: 48 },
      { id: "rcm", label: "RCM", role: "MID", x: 62, y: 48 },
      { id: "rm", label: "RM", role: "MID", x: 84, y: 45 },
      { id: "lf", label: "LF", role: "FW", x: 33, y: 18 },
      { id: "rf", label: "RF", role: "FW", x: 67, y: 18 }
    ]
  },
  {
    id: "11v11-3-5-2",
    name: "3-5-2 (Midfield Control)",
    playerCount: 11,
    positions: [
      { id: "gk", label: "GK", role: "GK", x: 50, y: 90 },
      { id: "lcb", label: "LCB", role: "DEF", x: 26, y: 72 },
      { id: "cb", label: "CB", role: "DEF", x: 50, y: 74 },
      { id: "rcb", label: "RCB", role: "DEF", x: 74, y: 72 },
      { id: "lm", label: "LM", role: "MID", x: 14, y: 45 },
      { id: "ldm", label: "LDM", role: "MID", x: 35, y: 52 },
      { id: "rdm", label: "RDM", role: "MID", x: 65, y: 52 },
      { id: "rm", label: "RM", role: "MID", x: 86, y: 45 },
      { id: "am", label: "AM", role: "MID", x: 50, y: 35 },
      { id: "lf", label: "LF", role: "FW", x: 33, y: 18 },
      { id: "rf", label: "RF", role: "FW", x: 67, y: 18 }
    ]
  },
  {
    id: "11v11-4-2-3-1",
    name: "4-2-3-1 (Modern Control)",
    playerCount: 11,
    positions: [
      { id: "gk", label: "GK", role: "GK", x: 50, y: 90 },
      { id: "lb", label: "LB", role: "DEF", x: 15, y: 70 },
      { id: "lcb", label: "LCB", role: "DEF", x: 38, y: 72 },
      { id: "rcb", label: "RCB", role: "DEF", x: 62, y: 72 },
      { id: "rb", label: "RB", role: "DEF", x: 85, y: 70 },
      { id: "ldm", label: "LDM", role: "MID", x: 35, y: 55 },
      { id: "rdm", label: "RDM", role: "MID", x: 65, y: 55 },
      { id: "lam", label: "LAM", role: "MID", x: 22, y: 34 },
      { id: "am", label: "AM", role: "MID", x: 50, y: 32 },
      { id: "ram", label: "RAM", role: "MID", x: 78, y: 34 },
      { id: "st", label: "ST", role: "FW", x: 50, y: 15 }
    ]
  }
];

// Helper to filter preset formations by player count
export function getPresetFormations(playerCount) {
  return STANDARD_FORMATIONS.filter(f => f.playerCount === parseInt(playerCount));
}
