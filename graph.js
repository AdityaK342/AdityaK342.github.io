// Draws hungergames-graph.json (precomputed layout) on a canvas with hover + click.
(function () {
  const canvas = document.getElementById("graph");
  if (!canvas) return;
  const tip = document.getElementById("graph-tip");
  const ctx = canvas.getContext("2d");

  const COLORS = {
    "Simulation": "#8a5a2b",
    "Arena engine": "#c2843a",
    "Math & geometry": "#4f6d4a",
    "Visualization (WPF)": "#9a8d7d",
    "Web (Blazor)": "#2b6a8a",
    "Other": "#7a6f63",
  };
  const EDGE = { inherits: "rgba(43,37,33,0.55)", calls: "rgba(138,90,43,0.28)", references: "rgba(122,111,99,0.14)" };
  const PAD = 28;
  const LABELS = 14; // label the most connected classes

  let data, nodes, links, hovered = null, width = 0, height = 0;

  fetch("hungergames-graph.json")
    .then(r => r.json())
    .then(json => {
      data = json;
      nodes = json.nodes;
      links = json.links;
      const byDegree = [...nodes].sort((a, b) => b.degree - a.degree);
      byDegree.slice(0, LABELS).forEach(n => n.label = true);
      legend();
      summary();
      resize();
      window.addEventListener("resize", resize);
      canvas.addEventListener("mousemove", onMove);
      canvas.addEventListener("mouseleave", () => { hovered = null; tip.hidden = true; draw(); });
      canvas.addEventListener("click", () => {
        if (!hovered) return;
        window.open(`https://github.com/${data.repo}/blob/main/${hovered.path}#L${hovered.line}`, "_blank", "noopener");
      });
    });

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    nodes.forEach(n => {
      n.px = PAD + n.x * (width - 2 * PAD);
      n.py = PAD + n.y * (height - 2 * PAD);
      n.r = 3 + Math.sqrt(n.degree) * 1.1;
    });
    draw();
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);
    const near = hovered ? neighborsOf(hovered) : null;

    for (const l of links) {
      const a = nodes[l.s], b = nodes[l.t];
      const lit = hovered && (a === hovered || b === hovered);
      if (hovered && !lit) ctx.strokeStyle = "rgba(122,111,99,0.05)";
      else ctx.strokeStyle = EDGE[l.k];
      ctx.lineWidth = lit ? 1.6 : (l.k === "inherits" ? 1.1 : 0.8);
      ctx.beginPath();
      ctx.moveTo(a.px, a.py);
      ctx.lineTo(b.px, b.py);
      ctx.stroke();
    }

    for (const n of nodes) {
      const dim = hovered && n !== hovered && !near.has(n);
      ctx.globalAlpha = dim ? 0.25 : 1;
      ctx.fillStyle = COLORS[n.group] || COLORS.Other;
      ctx.beginPath();
      ctx.arc(n.px, n.py, n.r, 0, Math.PI * 2);
      ctx.fill();
      if (n === hovered) {
        ctx.strokeStyle = "#2b2521";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    ctx.font = "13px Newsreader, Georgia, serif";
    ctx.fillStyle = "#2b2521";
    ctx.textBaseline = "middle";
    const placed = [];
    const ordered = [...nodes].sort((a, b) => b.degree - a.degree);
    for (const n of ordered) {
      const show = n.label ? !(hovered && n !== hovered && !near.has(n)) : (hovered && near.has(n));
      if (!show || n === hovered) continue;
      const w = ctx.measureText(n.name).width;
      const box = { x: n.px + n.r + 4, y: n.py - 8, w, h: 16 };
      if (placed.some(b => box.x < b.x + b.w && box.x + box.w > b.x && box.y < b.y + b.h && box.y + box.h > b.y)) continue;
      placed.push(box);
      ctx.fillText(n.name, box.x, n.py);
    }
  }

  function neighborsOf(n) {
    const set = new Set();
    for (const l of links) {
      if (nodes[l.s] === n) set.add(nodes[l.t]);
      if (nodes[l.t] === n) set.add(nodes[l.s]);
    }
    return set;
  }

  function onMove(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    let best = null, bestD = 14;
    for (const n of nodes) {
      const d = Math.hypot(n.px - x, n.py - y) - n.r;
      if (d < bestD) { bestD = d; best = n; }
    }
    if (best !== hovered) {
      hovered = best;
      canvas.style.cursor = best ? "pointer" : "default";
      draw();
    }
    if (!best) { tip.hidden = true; return; }
    const counts = { inherits: 0, calls: 0, references: 0 };
    for (const l of links) if (nodes[l.s] === best || nodes[l.t] === best) counts[l.k]++;
    tip.innerHTML = `<strong>${best.name}</strong><small>${best.path}</small>` +
      `<small>${counts.inherits} inherits · ${counts.calls} calls · ${counts.references} references</small>`;
    tip.hidden = false;
    const tx = x + 14 + 260 > width ? x - 14 - tip.offsetWidth : x + 14;
    tip.style.left = tx + "px";
    tip.style.top = Math.min(y + 14, height - tip.offsetHeight - 8) + "px";
  }

  function legend() {
    const el = document.getElementById("graph-legend");
    const seen = new Set(nodes.map(n => n.group));
    el.innerHTML = data.groups.filter(g => seen.has(g))
      .map(g => `<span><i style="background:${COLORS[g]}"></i>${g}</span>`).join("");
  }

  function summary() {
    const el = document.getElementById("graph-summary");
    const c = { inherits: 0, calls: 0, references: 0 };
    links.forEach(l => c[l.k]++);
    const top = [...nodes].sort((a, b) => b.degree - a.degree).slice(0, 4).map(n => n.name).join(", ");
    el.textContent = `${nodes.length} classes, ${links.length} relationships ` +
      `(${c.inherits} inherits, ${c.calls} calls, ${c.references} references). ` +
      `Most connected: ${top}. The arena engine sits in the middle, geometry on one side, the desktop visualizer on the other, and the student intelligences hang off the simulation cluster.`;
  }
})();
