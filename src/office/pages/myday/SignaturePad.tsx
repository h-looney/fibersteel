/**
 * Finger/stylus/mouse signature capture on a canvas. Reports a PNG data URL (or null when cleared).
 * Strokes are kept in relative coordinates, so rotating a phone or resizing the window redraws the
 * signature instead of losing it.
 */
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { Button } from '../../ui/core';

type Point = { x: number; y: number };

export function SignaturePad({ label, onChange }: { label: string; onChange: (image: string | null) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<Point[][]>([]);
  const drawing = useRef(false);
  const [hasInk, setHasInk] = useState(false);

  const ctx = () => canvas.current!.getContext('2d')!;
  const size = () => canvas.current!.getBoundingClientRect();

  /** Draw one stroke (points are 0–1 fractions of the canvas size) */
  const paint = (stroke: Point[], from = 0) => {
    const { width, height } = size();
    const c = ctx();
    const at = (p: Point) => ({ x: p.x * width, y: p.y * height });
    if (stroke.length === 1 && from === 0) {
      const p = at(stroke[0]);
      c.beginPath();
      c.arc(p.x, p.y, 1.2, 0, Math.PI * 2);
      c.fill();
      return;
    }
    for (let i = Math.max(1, from); i < stroke.length; i++) {
      const a = at(stroke[i - 1]);
      const b = at(stroke[i]);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      c.beginPath();
      c.moveTo(a.x, a.y);
      c.quadraticCurveTo(a.x, a.y, mid.x, mid.y);
      c.lineTo(b.x, b.y);
      c.stroke();
    }
  };

  useLayoutEffect(() => {
    const el = canvas.current!;
    const setup = () => {
      const ratio = window.devicePixelRatio || 1;
      const { width, height } = el.getBoundingClientRect();
      el.width = Math.round(width * ratio);
      el.height = Math.round(height * ratio);
      const c = el.getContext('2d')!;
      c.setTransform(ratio, 0, 0, ratio, 0, 0);
      c.lineWidth = 2.4;
      c.lineCap = 'round';
      c.lineJoin = 'round';
      c.strokeStyle = '#0b2545';
      c.fillStyle = '#0b2545';
    };
    setup();
    let lastWidth = el.getBoundingClientRect().width;
    const ro = new ResizeObserver(() => {
      const w = el.getBoundingClientRect().width;
      if (Math.abs(w - lastWidth) < 1) return;
      lastWidth = w;
      setup();
      strokes.current.forEach((s) => paint(s));
      if (strokes.current.length) onChange(el.toDataURL('image/png'));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const point = (e: PointerEvent): Point => {
    const r = size();
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) };
  };

  const finish = () => {
    if (!drawing.current) return;
    drawing.current = false;
    onChange(canvas.current!.toDataURL('image/png'));
  };

  const clear = () => {
    const el = canvas.current!;
    ctx().clearRect(0, 0, el.width, el.height);
    strokes.current = [];
    setHasInk(false);
    onChange(null);
  };

  return (
    <div class="sigpad">
      <canvas
        ref={canvas}
        class="sigpad__canvas"
        role="img"
        aria-label={hasInk ? `${label} — signed` : `${label} — draw a signature here with a finger, stylus or mouse`}
        onPointerDown={(e) => {
          e.preventDefault();
          canvas.current!.setPointerCapture(e.pointerId);
          drawing.current = true;
          const stroke = [point(e)];
          strokes.current.push(stroke);
          paint(stroke);
          if (!hasInk) setHasInk(true);
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return;
          const stroke = strokes.current[strokes.current.length - 1];
          stroke.push(point(e));
          paint(stroke, stroke.length - 1);
        }}
        onPointerUp={finish}
        onPointerCancel={finish}
      />
      <div class="sigpad__base" aria-hidden="true">
        <span>✕</span> Sign above the line
      </div>
      <Button size="sm" variant="ghost" icon="undo" class="sigpad__clear" onClick={clear} disabled={!hasInk}>
        Clear
      </Button>
    </div>
  );
}
