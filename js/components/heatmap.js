import { STANDARD_FORMATIONS } from '../utils/formations.js';

// Pre-calculate fallback coordinates for legacy data
const fallbackCoords = {};
STANDARD_FORMATIONS.forEach(f => {
  if (f.positions) {
    f.positions.forEach(p => {
      if (!fallbackCoords[p.label]) {
        fallbackCoords[p.label] = { x: 0, y: 0, count: 0, role: p.role };
      }
      fallbackCoords[p.label].x += p.x;
      fallbackCoords[p.label].y += p.y;
      fallbackCoords[p.label].count++;
    });
  }
});

Object.keys(fallbackCoords).forEach(label => {
  fallbackCoords[label].x = Math.round(fallbackCoords[label].x / fallbackCoords[label].count);
  fallbackCoords[label].y = Math.round(fallbackCoords[label].y / fallbackCoords[label].count);
});

export class PlayerHeatmap {
  /**
   * Renders the heatmap on the canvas and returns legend info.
   * @param {HTMLCanvasElement} canvas 
   * @param {Object} positionsPlayed 
   * @returns {Object} { legendEntries: Array }
   */
  static renderInto(canvas, positionsPlayed) {
    const ctx = canvas.getContext('2d');
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!positionsPlayed || Object.keys(positionsPlayed).length === 0) {
      return { legendEntries: [] };
    }

    // Determine dimensions
    const rect = canvas.getBoundingClientRect();
    const width = rect.width || canvas.clientWidth || canvas.parentElement.clientWidth || 300;
    const height = rect.height || canvas.clientHeight || canvas.parentElement.clientHeight || 400;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';

    ctx.scale(dpr, dpr);

    // Parse data and calculate max minutes
    let maxMins = 0;
    const items = [];

    Object.entries(positionsPlayed).forEach(([label, entry]) => {
      const isEnriched = typeof entry === 'object' && entry !== null && entry.minutes !== undefined;
      const minutes = isEnriched ? entry.minutes : entry;
      
      if (minutes <= 0) return;

      let x = isEnriched ? entry.x : null;
      let y = isEnriched ? entry.y : null;
      let role = isEnriched ? entry.role : null;

      if (x === null || y === null) {
        const fallback = fallbackCoords[label];
        if (fallback) {
          x = fallback.x;
          y = fallback.y;
          role = fallback.role || role;
        }
      }

      if (minutes > maxMins) {
        maxMins = minutes;
      }

      items.push({
        label,
        minutes,
        x,
        y,
        role: role || 'MID'
      });
    });

    // Sort items by minutes descending
    items.sort((a, b) => b.minutes - a.minutes);

    // Pass 1: Draw heat blobs
    items.forEach(item => {
      if (item.x === null || item.y === null) return;

      const canvasX = (item.x / 100) * width;
      const canvasY = (item.y / 100) * height;

      const ratio = maxMins > 0 ? item.minutes / maxMins : 0;
      const radius = Math.min(80, Math.max(25, 60 * Math.sqrt(ratio)));

      const grad = ctx.createRadialGradient(canvasX, canvasY, 0, canvasX, canvasY, radius);
      grad.addColorStop(0, 'rgba(239, 68, 68, 0.85)');   // Vibrant red center
      grad.addColorStop(0.3, 'rgba(249, 115, 22, 0.55)'); // Bright orange mid
      grad.addColorStop(0.7, 'rgba(234, 179, 8, 0.2)');   // Golden yellow outer
      grad.addColorStop(1, 'rgba(234, 179, 8, 0)');        // Transparent edge

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(canvasX, canvasY, radius, 0, Math.PI * 2);
      ctx.fill();
    });

    // Pass 2: Draw text labels
    items.forEach(item => {
      if (item.x === null || item.y === null) return;

      const canvasX = (item.x / 100) * width;
      const canvasY = (item.y / 100) * height;

      ctx.save();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px Inter, Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.lineWidth = 3;
      ctx.strokeText(item.label, canvasX, canvasY);
      ctx.fillText(item.label, canvasX, canvasY);
      ctx.restore();
    });

    return { legendEntries: items };
  }
}
