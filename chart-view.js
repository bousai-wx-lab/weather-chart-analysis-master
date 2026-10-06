"use strict";
// Frames use original image coordinates; the atlas has already checked the source hash.
const ChartView = (() => {
  const diagramRows = {
    "axjp130-axjp140": { size: [2048,2789], frames: [[40,140,2008,1435],[40,1550,2008,2775]] },
    "fcvx14": { size: [2048,2803], frames: [[110,185,1915,655],[110,1870,1915,2785]] },
    "fcvx24": { size: [2048,2803], frames: [[110,185,1915,655],[110,2310,1915,2785]] },
    // These sheets mix maps and diagrams of different heights in the same row.
    "fcvx11": { size: [2803,2048], frames: [[120,280,2260,1020],[120,1540,2260,2048]] },
    "fcvx21": { size: [2048,2803], frames: [[75,260,1975,970],[75,1480,1935,2600]] },
    "fxxn519": { size: [2048,2803], frames: [[85,145,2020,1160],[85,2320,2020,2785]] }
  };
  function rows(selected, atlas) {
    if (!selected || !atlas || atlas.width !== selected.page.width || atlas.height !== selected.page.height) return null;
    const {width,height} = atlas, profile = diagramRows[selected.product.id];
    if (profile && profile.size[0] === width && profile.size[1] === height) return profile.frames.map(f => [...f]);
    const bounds = atlas.panels.map(p => p.bounds);
    if (bounds.length < 2 || bounds.some(b => b.length !== 4 || b.some(x => !Number.isFinite(x)) || b[0] < 0 || b[1] < 0 || b[2] > width || b[3] > height || b[0] >= b[2] || b[1] >= b[3])) return null;
    const tolerance = Math.min(...bounds.map(b => b[3]-b[1])) * 0.22;
    const groups = [];
    for (const b of [...bounds].sort((a,b) => a[1]-b[1])) {
      const last = groups.at(-1);
      if (last && b[1]-last.top <= tolerance) last.bounds.push(b);
      else groups.push({top:b[1],bounds:[b]});
    }
    if (groups.length < 2) return null;
    const unions = groups.map(g => [Math.min(...g.bounds.map(b=>b[0])),Math.min(...g.bounds.map(b=>b[1])),Math.max(...g.bounds.map(b=>b[2])),Math.max(...g.bounds.map(b=>b[3]))]);
    // Leave room for row captions; do not cross into a neighbouring row.
    function padded(i) {
      const b = unions[i], h = b[3]-b[1];
      return [Math.max(0,b[0]-width*0.012), Math.max(i ? (unions[i-1][3]+b[1])/2 : 0,b[1]-h*0.025),
        Math.min(width,b[2]+width*0.012), Math.min(i+1 < unions.length ? (b[3]+unions[i+1][1])/2 : height,b[3]+h*0.06)];
    }
    return [padded(0),padded(unions.length-1)];
  }
  function fittedWidth(frame, imageWidth, viewport) {
    return Math.floor(imageWidth * Math.min(viewport.width/(frame[2]-frame[0]),viewport.height/(frame[3]-frame[1])));
  }
  return Object.freeze({rows,fittedWidth});
})();
if (typeof module !== "undefined") module.exports = ChartView;
