import { useEffect, useRef, useCallback } from 'react';

interface Orb {
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  radius: number;
  colorIdx: number;
  alpha: number;
  vx: number;
  vy: number;
  phase: number;
  speed: number;
}

interface Particle {
  x: number;
  y: number;
  radius: number;
  alpha: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
}

const DARK_COLORS = [
  [99, 102, 241, 0.12],   // indigo
  [139, 92, 246, 0.10],   // violet
  [59, 130, 246, 0.08],   // blue
  [167, 139, 250, 0.09],  // purple
  [96, 165, 250, 0.07],   // sky
  [129, 140, 248, 0.10],  // indigo lighter
];

const LIGHT_COLORS = [
  [99, 102, 241, 0.10],
  [139, 92, 246, 0.08],
  [59, 130, 246, 0.07],
  [167, 139, 250, 0.08],
  [96, 165, 250, 0.06],
  [129, 140, 248, 0.09],
];

export function AnimatedBackground({ isDark = true }: { isDark?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -1000, y: -1000, active: false });
  const orbsRef = useRef<Orb[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const animationRef = useRef<number>(0);
  const timeRef = useRef(0);
  const isDarkRef = useRef(isDark);

  // Keep isDarkRef in sync with the prop
  useEffect(() => {
    isDarkRef.current = isDark;
  }, [isDark]);

  const createOrbs = useCallback((width: number, height: number) => {
    const orbs: Orb[] = [];
    const count = Math.min(8, Math.max(5, Math.floor((width * height) / 200000)));

    for (let i = 0; i < count; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      orbs.push({
        x,
        y,
        baseX: x,
        baseY: y,
        radius: 100 + Math.random() * 250,
        colorIdx: i % 6,
        alpha: 0.5 + Math.random() * 0.5,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        phase: Math.random() * Math.PI * 2,
        speed: 0.3 + Math.random() * 0.5,
      });
    }
    return orbs;
  }, []);

  const spawnParticles = useCallback((x: number, y: number, count: number = 3) => {
    const newParticles: Particle[] = [];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.3 + Math.random() * 1.2;
      newParticles.push({
        x: x + (Math.random() - 0.5) * 20,
        y: y + (Math.random() - 0.5) * 20,
        radius: 1.5 + Math.random() * 2.5,
        alpha: 0.4 + Math.random() * 0.4,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0,
        maxLife: 60 + Math.random() * 80,
      });
    }
    particlesRef.current.push(...newParticles);
    if (particlesRef.current.length > 60) {
      particlesRef.current = particlesRef.current.slice(-60);
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let dpr = window.devicePixelRatio || 1;

    const resize = () => {
      dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = window.innerWidth + 'px';
      canvas.style.height = window.innerHeight + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      orbsRef.current = createOrbs(window.innerWidth, window.innerHeight);
    };

    resize();
    window.addEventListener('resize', resize);

    // Mouse / Touch handlers
    const handlePointerMove = (clientX: number, clientY: number) => {
      mouseRef.current.x = clientX;
      mouseRef.current.y = clientY;
      mouseRef.current.active = true;
      if (Math.random() < 0.3) {
        spawnParticles(clientX, clientY, 1);
      }
    };

    const handleMouseMove = (e: MouseEvent) => handlePointerMove(e.clientX, e.clientY);
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    };
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        const t = e.touches[0];
        mouseRef.current.x = t.clientX;
        mouseRef.current.y = t.clientY;
        mouseRef.current.active = true;
        spawnParticles(t.clientX, t.clientY, 5);
      }
    };
    const handlePointerLeave = () => {
      mouseRef.current.active = false;
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('mouseleave', handlePointerLeave);
    window.addEventListener('touchend', handlePointerLeave);

    // Animation loop — reads isDarkRef.current for real-time theme
    const animate = () => {
      timeRef.current += 0.016;
      const w = window.innerWidth;
      const h = window.innerHeight;
      const dark = isDarkRef.current;

      ctx.clearRect(0, 0, w, h);

      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;
      const mouseActive = mouseRef.current.active;

      const palette = dark ? DARK_COLORS : LIGHT_COLORS;

      // Draw orbs
      orbsRef.current.forEach((orb) => {
        orb.phase += 0.005 * orb.speed;
        const floatX = Math.sin(orb.phase) * 40;
        const floatY = Math.cos(orb.phase * 0.7) * 30;

        orb.baseX += orb.vx;
        orb.baseY += orb.vy;

        if (orb.baseX < -orb.radius) orb.baseX = w + orb.radius;
        if (orb.baseX > w + orb.radius) orb.baseX = -orb.radius;
        if (orb.baseY < -orb.radius) orb.baseY = h + orb.radius;
        if (orb.baseY > h + orb.radius) orb.baseY = -orb.radius;

        let targetX = orb.baseX + floatX;
        let targetY = orb.baseY + floatY;

        if (mouseActive) {
          const dx = mx - targetX;
          const dy = my - targetY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const influence = Math.max(0, 1 - dist / 400);
          targetX += dx * influence * 0.08;
          targetY += dy * influence * 0.08;
          orb.alpha = Math.min(1, 0.5 + influence * 0.5);
        } else {
          orb.alpha += (0.5 - orb.alpha) * 0.02;
        }

        orb.x += (targetX - orb.x) * 0.03;
        orb.y += (targetY - orb.y) * 0.03;

        // Get color from palette based on current theme
        const [r, g, b, baseAlpha] = palette[orb.colorIdx];
        const gradient = ctx.createRadialGradient(
          orb.x, orb.y, 0,
          orb.x, orb.y, orb.radius
        );
        gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${(baseAlpha * orb.alpha * 1.5).toFixed(3)})`);
        gradient.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, ${(baseAlpha * orb.alpha * 0.6).toFixed(3)})`);
        gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

        ctx.beginPath();
        ctx.arc(orb.x, orb.y, orb.radius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
      });

      // Draw mouse glow
      if (mouseActive) {
        const glowRadius = 180;
        const glowGradient = ctx.createRadialGradient(mx, my, 0, mx, my, glowRadius);
        if (dark) {
          glowGradient.addColorStop(0, 'rgba(99, 102, 241, 0.08)');
          glowGradient.addColorStop(0.4, 'rgba(139, 92, 246, 0.04)');
          glowGradient.addColorStop(1, 'rgba(99, 102, 241, 0)');
        } else {
          glowGradient.addColorStop(0, 'rgba(99, 102, 241, 0.06)');
          glowGradient.addColorStop(0.4, 'rgba(139, 92, 246, 0.03)');
          glowGradient.addColorStop(1, 'rgba(99, 102, 241, 0)');
        }
        ctx.beginPath();
        ctx.arc(mx, my, glowRadius, 0, Math.PI * 2);
        ctx.fillStyle = glowGradient;
        ctx.fill();
      }

      // Draw and update particles
      const particleColor = dark ? [167, 139, 250] : [99, 102, 241];
      particlesRef.current = particlesRef.current.filter((p) => {
        p.life++;
        if (p.life >= p.maxLife) return false;

        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.98;
        p.vy *= 0.98;

        const progress = p.life / p.maxLife;
        const fadeAlpha = progress < 0.2
          ? p.alpha * (progress / 0.2)
          : p.alpha * (1 - (progress - 0.2) / 0.8);

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius * (1 - progress * 0.5), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${particleColor[0]}, ${particleColor[1]}, ${particleColor[2]}, ${fadeAlpha.toFixed(3)})`;
        ctx.fill();

        return true;
      });

      // Floating ambient particles
      const ambientCount = 3;
      const ambientColor = dark ? [167, 139, 250] : [99, 102, 241];
      for (let i = 0; i < ambientCount; i++) {
        const t = timeRef.current + i * 100;
        const ax = (Math.sin(t * 0.2 + i * 2.1) * 0.5 + 0.5) * w;
        const ay = (Math.cos(t * 0.15 + i * 1.7) * 0.5 + 0.5) * h;
        const aAlpha = (Math.sin(t * 0.5 + i) * 0.5 + 0.5) * (dark ? 0.15 : 0.08);
        const aRadius = 2 + Math.sin(t * 0.3 + i) * 1;

        ctx.beginPath();
        ctx.arc(ax, ay, aRadius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${ambientColor[0]}, ${ambientColor[1]}, ${ambientColor[2]}, ${aAlpha.toFixed(3)})`;
        ctx.fill();
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationRef.current);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('mouseleave', handlePointerLeave);
      window.removeEventListener('touchend', handlePointerLeave);
    };
  }, [createOrbs, spawnParticles]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0,
      }}
      aria-hidden="true"
    />
  );
}
