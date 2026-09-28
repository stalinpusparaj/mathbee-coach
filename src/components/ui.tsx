import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Sprite } from './art';

export function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose?: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>('button, [href], input, select')?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', key, true);
    return () => {
      window.removeEventListener('keydown', key, true);
      prev?.focus?.();
    };
  }, [onClose]);
  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}

/** Press-and-hold button: a convenience gate against accidental taps (not security). */
export function HoldButton({ onDone, label, holdMs = 1500, testId }: { onDone: () => void; label: string; holdMs?: number; testId?: string }) {
  const [p, setP] = useState(0);
  const timer = useRef<number | null>(null);
  const startT = useRef(0);
  const stop = () => {
    if (timer.current) cancelAnimationFrame(timer.current);
    timer.current = null;
    setP(0);
  };
  const tick = () => {
    const f = Math.min(1, (performance.now() - startT.current) / holdMs);
    setP(f);
    if (f >= 1) {
      stop();
      onDone();
    } else timer.current = requestAnimationFrame(tick);
  };
  const start = () => {
    startT.current = performance.now();
    timer.current = requestAnimationFrame(tick);
  };
  return (
    <button
      type="button"
      className="btn secondary hold"
      onPointerDown={start}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !timer.current) { e.preventDefault(); start(); } }}
      onKeyUp={stop}
      data-testid={testId}
      style={{ ['--hold' as string]: `${p * 100}%` }}
    >
      <span className="hold-fill" aria-hidden />
      <span className="hold-label">{label}</span>
    </button>
  );
}

export function BeeSays({ children, pose = 'bee' }: { children: ReactNode; pose?: string }) {
  return (
    <div className="guide-bubble">
      <Sprite id={pose} size={56} decorative className="bee-idle" />
      <div>{children}</div>
    </div>
  );
}

export function BackButton({ onClick, label }: { onClick: () => void; label: string }) {
  return <button type="button" className="icon-btn back" onClick={onClick} aria-label={label} data-testid="back">←</button>;
}
