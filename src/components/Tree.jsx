import React, { useRef, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import "./Tree.css";

/* ═══════════════════════════════════════════════════════════════════════════
   Your Goals → Study Tools → [Study Session, Flashcards, Notes, ...]
══════════════════════════════════════════════════════════════════════════ */

const TREE_ROOT = {
  id: "goals",
  label: "YOUR GOALS",
  emoji: "🎯",
  color: "#e879f9",
  glow: "#f0abfc",
  children: [
    {
      id: "study-tools",
      label: "Study Tools",
      emoji: "🛠️",
      color: "#c084fc",
      glow: "#d8b4fe",
      children: [
        { id: "session",    label: "Study Session", emoji: "⏱️", sub: "Focus & Pomodoro",      badge: "✦ Strict Mode",  path: "/session",     color: "#d8b4fe", glow: "#e9d5ff" },
        { id: "flashcards", label: "Flashcards",    emoji: "📇", sub: "Interactive learning",  badge: "✦ Quiz Mode",    path: "/flash-cards", color: "#e879f9", glow: "#f0abfc" },
        { id: "notes",      label: "Notes",         emoji: "📝", sub: "Rich digital notebook", badge: "✦ WikiLinks",    path: "/notes",       color: "#f472b6", glow: "#fbcfe8" },
      ],
    },
    {
      id: "math-graphs",
      label: "Math & Graphs",
      emoji: "📐",
      color: "#a78bfa",
      glow: "#c4b5fd",
      children: [
        { id: "sketch", label: "Sketch Curves", emoji: "📈", sub: "2D math visualization",  badge: "✦ Plotly",    path: "/plot-graph", color: "#f0abfc", glow: "#fce7f3" },
        { id: "3d",     label: "3D Graphs",     emoji: "🧊", sub: "3D mathematical surfaces", badge: "✦ Three.js", path: "/3d-graph",   color: "#f472b6", glow: "#fda4af" },
      ],
    },
    {
      id: "challenges",
      label: "Challenges",
      emoji: "🔥",
      color: "#f472b6",
      glow: "#fbcfe8",
      children: [
        { id: "75hard",        label: "75 Hard",        emoji: "💪", sub: "75-day mental toughness", badge: "✦ Streaks", path: "/75hard",         color: "#fb923c", glow: "#fed7aa" },
        { id: "habit-stack",   label: "Habit Stacking", emoji: "🔗", sub: "Link habits for momentum",  badge: "✦ Chain",   path: "/habit-stacking", color: "#a8edca", glow: "#d1fae5" },
      ],
    },
    {
      id: "analytics",
      label: "Analytics",
      emoji: "📊",
      color: "#a8edca",
      glow: "#d1fae5",
      children: [
        { id: "mastery",     label: "Mastery Tracker", emoji: "🧠", sub: "Confidence heatmap",   badge: "✦ Heatmap",   path: "/mastery",     color: "#a78bfa", glow: "#c4b5fd" },
        { id: "environment", label: "Environment",     emoji: "🌍", sub: "Focus location insights", badge: "✦ Map",    path: "/environment", color: "#c084fc", glow: "#d8b4fe" },
      ],
    },
    {
      id: "library",
      label: "Library",
      emoji: "📚",
      color: "#f0abfc",
      glow: "#fce7f3",
      children: [
        { id: "time-capsule", label: "Time Capsule", emoji: "💌", sub: "Letters to future self", badge: "✦ Scheduled", path: "/time-capsule", color: "#f472b6", glow: "#fda4af" },
        { id: "resources",    label: "Resources",    emoji: "📖", sub: "Curated study materials",  badge: "✦ Smart picks", path: "/resources",  color: "#a8edca", glow: "#d1fae5" },
      ],
    },
  ],
};

/* ═══════════════════════════════════════════════════════════════════════════
   CANVAS TREE COMPONENT
══════════════════════════════════════════════════════════════════════════ */

export default function EcosystemTree({ onNavigate }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const stateRef = useRef({
    nodes: [], edges: [],
    nodeMap: {},
    hoveredNode: null,
    dragNode: null, isDragging: false,
    isPanning: false, panStart: null,
    pan: { x: 0, y: 0 }, zoom: 1,
    time: 0,
  });

  const go = useCallback((path) => {
    if (onNavigate && path) onNavigate(path);
  }, [onNavigate]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const S = stateRef.current;

    const resize = () => {
      const rect = canvas.parentElement.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas.parentElement);

    /* ── Build hierarchical layout ── */
    const W = canvas.width, H = canvas.height;
    const nodeMap = {};
    const allNodes = [];
    const edges = [];

    const centerX = W / 2;
    const rootY = 80;

    // Root: YOUR GOALS
    const root = {
      id: TREE_ROOT.id,
      label: TREE_ROOT.label,
      emoji: TREE_ROOT.emoji,
      color: TREE_ROOT.color,
      glow: TREE_ROOT.glow,
      x: centerX,
      y: rootY,
      vx: 0, vy: 0,
      radius: 36,
      baseRadius: 36,
      level: 0,
      pulsePhase: 0,
    };
    allNodes.push(root);
    nodeMap[root.id] = root;

    // Level 1: Categories (Study Tools, Math & Graphs, etc.)
    const catY = 220;
    const catCount = TREE_ROOT.children.length;
    const catSpacing = Math.min(180, (W - 120) / Math.max(catCount - 1, 1));
    const catStartX = centerX - ((catCount - 1) * catSpacing) / 2;

    TREE_ROOT.children.forEach((cat, i) => {
      const catNode = {
        id: cat.id,
        label: cat.label,
        emoji: cat.emoji,
        color: cat.color,
        glow: cat.glow,
        x: catStartX + i * catSpacing,
        y: catY,
        vx: 0, vy: 0,
        radius: 30,
        baseRadius: 30,
        level: 1,
        pulsePhase: Math.random() * Math.PI * 2,
        parentId: root.id,
      };
      allNodes.push(catNode);
      nodeMap[catNode.id] = catNode;
      edges.push({ from: root.id, to: cat.id });

      // Level 2: Leaf nodes
      const leafCount = cat.children.length;
      const leafSpacing = Math.min(140, (catSpacing - 20) / Math.max(leafCount - 1, 1));
      const leafStartX = catNode.x - ((leafCount - 1) * leafSpacing) / 2;
      const leafY = catY + 160;

      cat.children.forEach((leaf, j) => {
        const leafNode = {
          id: leaf.id,
          label: leaf.label,
          emoji: leaf.emoji,
          sub: leaf.sub,
          badge: leaf.badge,
          path: leaf.path,
          color: leaf.color,
          glow: leaf.glow,
          x: leafStartX + j * leafSpacing,
          y: leafY,
          vx: 0, vy: 0,
          radius: 26,
          baseRadius: 26,
          level: 2,
          pulsePhase: Math.random() * Math.PI * 2,
          parentId: cat.id,
          isLeaf: true,
        };
        allNodes.push(leafNode);
        nodeMap[leafNode.id] = leafNode;
        edges.push({ from: cat.id, to: leaf.id });
      });
    });

    S.nodes = allNodes;
    S.nodeMap = nodeMap;
    S.edges = edges;

    /* ── Physics ── */
    const REPEL = 800;
    const SPRING_K = 0.04;
    const DAMP = 0.92;
    const TARGET_PULL = 0.03;

    const physicsTick = () => {
      const nodes = S.nodes;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[j].x - nodes[i].x;
          const dy = nodes[j].y - nodes[i].y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const f = REPEL / (dist * dist);
          const fx = (dx / dist) * f;
          const fy = (dy / dist) * f;
          nodes[i].vx -= fx; nodes[i].vy -= fy;
          nodes[j].vx += fx; nodes[j].vy += fy;
        }
      }

      S.edges.forEach(({ from, to }) => {
        const a = nodeMap[from], b = nodeMap[to];
        if (!a || !b) return;
        const dx = b.x - a.x, dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const targetLen = a.level === 0 ? 140 : 120;
        const f = (dist - targetLen) * SPRING_K;
        const fx = (dx / dist) * f, fy = (dy / dist) * f;
        a.vx += fx; a.vy += fy;
        b.vx -= fx; b.vy -= fy;
      });

      nodes.forEach((n) => {
        if (n === S.dragNode) return;
        n.vx += (n.x - n.x) * 0; // anchor x roughly
        n.vx *= DAMP; n.vy *= DAMP;
        n.x += n.vx; n.y += n.vy;
      });
    };

    /* ── Draw ── */
    const draw = () => {
      const W2 = canvas.width, H2 = canvas.height;
      S.time += 0.016;
      ctx.clearRect(0, 0, W2, H2);

      ctx.save();
      ctx.translate(S.pan.x, S.pan.y);
      ctx.scale(S.zoom, S.zoom);

      const hov = S.hoveredNode;

      // Draw edges (strings)
      S.edges.forEach(({ from, to }) => {
        const a = nodeMap[from], b = nodeMap[to];
        if (!a || !b) return;
        const isHl = hov && (hov.id === from || hov.id === to);

        // Control point for curve
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2 + 20;

        // Glow under string
        if (isHl) {
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.quadraticCurveTo(mx, my, b.x, b.y);
          ctx.strokeStyle = "rgba(232,121,249,0.15)";
          ctx.lineWidth = 6 / S.zoom;
          ctx.lineCap = "round";
          ctx.stroke();
          ctx.restore();
        }

        // Main string
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.quadraticCurveTo(mx, my, b.x, b.y);
        const grad = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
        grad.addColorStop(0, isHl ? "rgba(244,114,182,0.8)" : "rgba(192,132,252,0.4)");
        grad.addColorStop(1, isHl ? "rgba(192,132,252,0.8)" : "rgba(168,85,247,0.3)");
        ctx.strokeStyle = grad;
        ctx.lineWidth = isHl ? 2.5 / S.zoom : 1.5 / S.zoom;
        ctx.lineCap = "round";
        ctx.stroke();

        // Traveling dot
        const t = (S.time * 0.3) % 1;
        const bx = (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * mx + t * t * b.x;
        const by = (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * my + t * t * b.y;
        ctx.beginPath();
        ctx.arc(bx, by, 2.5 / S.zoom, 0, Math.PI * 2);
        ctx.fillStyle = isHl ? "rgba(249,168,212,0.9)" : "rgba(192,132,252,0.5)";
        ctx.fill();
      });

      // Draw nodes
      S.nodes.forEach((n) => {
        const isHov = n === hov;
        const pulse = Math.sin(S.time * 2 + n.pulsePhase) * 0.5 + 0.5;
        const r = n.baseRadius * (1 + pulse * 0.05);

        // Outer glow
        const glowR = r * (isHov ? 3.5 : 2.5);
        const glowA = isHov ? 0.25 : n.level === 0 ? 0.2 : 0.12;
        const grad = ctx.createRadialGradient(n.x, n.y, r * 0.3, n.x, n.y, glowR);
        grad.addColorStop(0, hexToRgba(n.glow, glowA + pulse * 0.05));
        grad.addColorStop(1, "rgba(0,0,0,0)");
        ctx.beginPath();
        ctx.arc(n.x, n.y, glowR, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();

        // Node body
        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        const bodyGrad = ctx.createRadialGradient(n.x - r * 0.3, n.y - r * 0.3, 0, n.x, n.y, r);
        bodyGrad.addColorStop(0, hexToRgba(n.color, isHov ? 0.5 : 0.35));
        bodyGrad.addColorStop(1, hexToRgba(n.color, isHov ? 0.3 : 0.15));
        ctx.fillStyle = bodyGrad;
        ctx.fill();
        ctx.strokeStyle = hexToRgba(n.glow, isHov ? 0.9 : 0.6);
        ctx.lineWidth = isHov ? 2.5 / S.zoom : 1.5 / S.zoom;
        ctx.stroke();

        // Inner highlight
        ctx.beginPath();
        ctx.arc(n.x, n.y, r * 0.35, 0, Math.PI * 2);
        ctx.fillStyle = isHov ? "rgba(255,255,255,0.9)" : `rgba(255,255,255,${0.4 + pulse * 0.2})`;
        ctx.fill();

        // Emoji
        ctx.font = `${n.level === 0 ? 22 : n.level === 1 ? 18 : 15}px "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(n.emoji, n.x, n.y);

        // Label
        const labelY = n.y + r + 14 / S.zoom;
        ctx.font = `${n.level === 0 ? 700 : 600} ${Math.max(9, (n.level === 0 ? 12 : n.level === 1 ? 11 : 10) / S.zoom)}px "DM Sans", sans-serif`;
        ctx.textAlign = "center";
        ctx.fillStyle = isHov ? "#fce7f3" : n.color;
        ctx.fillText(n.label, n.x, labelY);

        // Subtitle + badge for leaves
        if (n.isLeaf && (isHov || S.zoom > 0.8)) {
          const subY = labelY + 13 / S.zoom;
          ctx.font = `400 ${9 / S.zoom}px "DM Sans", sans-serif`;
          ctx.fillStyle = "rgba(154,127,160,0.8)";
          ctx.fillText(n.sub, n.x, subY);

          // Badge pill
          if (n.badge) {
            const badgeY = subY + 14 / S.zoom;
            ctx.font = `700 ${7.5 / S.zoom}px "DM Sans", sans-serif`;
            const metrics = ctx.measureText(n.badge);
            const padX = 8 / S.zoom, padY = 3 / S.zoom;
            const bw = metrics.width + padX * 2;
            const bh = 14 / S.zoom;

            ctx.fillStyle = hexToRgba(n.color, 0.2);
            ctx.beginPath();
            ctx.roundRect(n.x - bw / 2, badgeY - bh / 2, bw, bh, 6 / S.zoom);
            ctx.fill();
            ctx.strokeStyle = hexToRgba(n.color, 0.3);
            ctx.lineWidth = 1 / S.zoom;
            ctx.stroke();

            ctx.fillStyle = n.color;
            ctx.fillText(n.badge, n.x, badgeY + 1 / S.zoom);
          }
        }
      });

      ctx.restore();

      // Hint
      ctx.font = "10px 'DM Sans', sans-serif";
      ctx.fillStyle = "rgba(90,68,96,0.5)";
      ctx.textAlign = "right";
      ctx.textBaseline = "bottom";
      ctx.fillText("drag nodes · scroll zoom · click to navigate", W2 - 14, H2 - 10);
    };

    const loop = () => {
      physicsTick();
      draw();
      animRef.current = requestAnimationFrame(loop);
    };
    animRef.current = requestAnimationFrame(loop);

    /* ── Input ── */
    const worldPos = (ex, ey) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: (ex - rect.left - S.pan.x) / S.zoom,
        y: (ey - rect.top - S.pan.y) / S.zoom,
      };
    };

    const hitTest = (ex, ey) => {
      const { x, y } = worldPos(ex, ey);
      return S.nodes.find((n) => {
        const dx = x - n.x, dy = y - n.y;
        return Math.sqrt(dx * dx + dy * dy) < n.radius + 8;
      }) || null;
    };

    const onMouseMove = (e) => {
      if (S.isDragging && S.dragNode) {
        const { x, y } = worldPos(e.clientX, e.clientY);
        S.dragNode.x = x; S.dragNode.y = y;
        S.dragNode.vx = 0; S.dragNode.vy = 0;
        return;
      }
      if (S.isPanning && S.panStart) {
        const rect = canvas.getBoundingClientRect();
        S.pan.x = e.clientX - rect.left - S.panStart.ox;
        S.pan.y = e.clientY - rect.top - S.panStart.oy;
        return;
      }
      const hit = hitTest(e.clientX, e.clientY);
      S.hoveredNode = hit;
      canvas.style.cursor = hit ? (hit.isLeaf ? "pointer" : "grab") : "grab";
    };

    const onMouseDown = (e) => {
      const hit = hitTest(e.clientX, e.clientY);
      if (hit && !hit.isLeaf) {
        S.isDragging = true; S.dragNode = hit;
        canvas.style.cursor = "grabbing";
      } else {
        S.isPanning = true;
        const rect = canvas.getBoundingClientRect();
        S.panStart = { ox: e.clientX - rect.left - S.pan.x, oy: e.clientY - rect.top - S.pan.y };
        canvas.style.cursor = "grabbing";
      }
    };

    const onMouseUp = () => {
      S.isDragging = false; S.dragNode = null;
      S.isPanning = false; S.panStart = null;
      canvas.style.cursor = "grab";
    };

    const onClick = (e) => {
      const hit = hitTest(e.clientX, e.clientY);
      if (hit?.isLeaf && hit.path) {
        go(hit.path);
      }
    };

    const onWheel = (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      const delta = e.deltaY > 0 ? 0.9 : 1.11;
      const nz = Math.max(0.4, Math.min(2.5, S.zoom * delta));
      S.pan.x = mx - (mx - S.pan.x) * (nz / S.zoom);
      S.pan.y = my - (my - S.pan.y) * (nz / S.zoom);
      S.zoom = nz;
    };

    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("mousedown", onMouseDown);
    canvas.addEventListener("mouseup", onMouseUp);
    canvas.addEventListener("click", onClick);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("mouseleave", () => {
      S.hoveredNode = null; S.isDragging = false; S.dragNode = null; S.isPanning = false;
    });

    return () => {
      cancelAnimationFrame(animRef.current);
      ro.disconnect();
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("mousedown", onMouseDown);
      canvas.removeEventListener("mouseup", onMouseUp);
      canvas.removeEventListener("click", onClick);
      canvas.removeEventListener("wheel", onWheel);
    };
  }, [go]);

  // Helper: hex to rgba
  function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  return (
    <section className="pk-ecosystem">
      <motion.div
        className="pk-section-header"
        initial={{ opacity: 0, y: 28 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="pk-section-tag">
          <Sparkles size={12} color="var(--lavender-glow)" />
          your study ecosystem
        </div>
        <h2 className="pk-section-title">
          Everything <span className="pk-accent-lavender">connects ✦</span>
        </h2>
        <p className="pk-section-sub">
          Your tools work in harmony — each session feeds into the next.
        </p>
      </motion.div>

      <div className="pk-eco-graph-wrap">
        <canvas
          ref={canvasRef}
          className="pk-eco-graph-canvas"
          style={{ cursor: "grab" }}
        />
      </div>
    </section>
  );
}