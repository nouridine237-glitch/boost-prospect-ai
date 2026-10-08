export function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function fireConfetti(duration = 1500) {
  if (typeof document === "undefined" || prefersReducedMotion()) return;
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:9999";
  const dpr = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * dpr; canvas.height = window.innerHeight * dpr;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  if (!ctx) { canvas.remove(); return; }
  ctx.scale(dpr, dpr);
  const colors = ["#3b82f6", "#22d3ee", "#60a5fa", "#a5f3fc", "#ffffff", "#facc15"];
  const w = window.innerWidth;
  const parts = Array.from({ length: 120 }, () => ({
    x: w / 2 + (Math.random() - 0.5) * w * 0.4, y: window.innerHeight * 0.35,
    vx: (Math.random() - 0.5) * 12, vy: -Math.random() * 12 - 4,
    s: Math.random() * 6 + 4, r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3,
    c: colors[Math.floor(Math.random() * colors.length)]!,
  }));
  const start = performance.now();
  function frame(now: number) {
    const t = now - start;
    ctx!.clearRect(0, 0, w, window.innerHeight);
    ctx!.globalAlpha = Math.max(0, 1 - t / duration);
    for (const p of parts) {
      p.vy += 0.35; p.x += p.vx; p.y += p.vy; p.r += p.vr; p.vx *= 0.99;
      ctx!.save(); ctx!.translate(p.x, p.y); ctx!.rotate(p.r); ctx!.fillStyle = p.c; ctx!.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); ctx!.restore();
    }
    if (t < duration) requestAnimationFrame(frame); else canvas.remove();
  }
  requestAnimationFrame(frame);
}
