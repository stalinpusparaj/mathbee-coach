import { useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { hourAngle, minuteAngle } from '../engine/math';

interface Props {
  h: number;
  m: number;
  size?: number;
  /** when provided, the hands can be set by dragging, keys or the buttons around the clock */
  onChange?: (h: number, m: number) => void;
  label: string;
  bw?: boolean;
  controlsLabel?: { hourUp: string; hourDown: string; minUp: string; minDown: string };
}

const rad = (deg: number) => ((deg - 90) * Math.PI) / 180;

/** Analog clock drawn from the time: minute hand 6°/min, hour hand 30°/h + 0.5°/min. */
export function Clock({ h, m, size = 220, onChange, label, bw, controlsLabel }: Props) {
  const ref = useRef<SVGSVGElement>(null);
  const drag = useRef<'hour' | 'minute' | null>(null);
  const ha = hourAngle(h, m);
  const ma = minuteAngle(m);

  const angleFromEvent = (e: PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    const x = e.clientX - (r.left + r.width / 2);
    const y = e.clientY - (r.top + r.height / 2);
    return ((Math.atan2(y, x) * 180) / Math.PI + 90 + 360) % 360;
  };
  const onMove = (e: PointerEvent) => {
    if (!drag.current || !onChange) return;
    const a = angleFromEvent(e);
    if (drag.current === 'minute') onChange(h, (Math.round(a / 30) * 5) % 60);
    else {
      const hh = Math.floor(((a - 0.5 * m + 360) % 360) / 30 + 0.5) % 12;
      onChange(hh === 0 ? 12 : hh, m);
    }
  };
  const step = (dh: number, dm: number) => {
    if (!onChange) return;
    const hh = (((h - 1 + dh) % 12) + 12) % 12 + 1;
    const mm = (((m + dm) % 60) + 60) % 60;
    onChange(hh, mm);
  };
  const onKey = (e: KeyboardEvent) => {
    if (!onChange) return;
    const map: Record<string, [number, number]> = { ArrowUp: [1, 0], ArrowDown: [-1, 0], ArrowRight: [0, 5], ArrowLeft: [0, -5] };
    const d = map[e.key];
    if (d) {
      e.preventDefault();
      step(...d);
    }
  };
  const hand = (angle: number, len: number, width: number, color: string, which: 'hour' | 'minute') => (
    <line
      x1="0" y1="0" x2={Math.cos(rad(angle)) * len} y2={Math.sin(rad(angle)) * len}
      stroke={color} strokeWidth={width} strokeLinecap="round"
      style={onChange ? { cursor: 'grab', touchAction: 'none' } : undefined}
      onPointerDown={onChange ? (e) => { drag.current = which; (e.target as Element).setPointerCapture?.(e.pointerId); } : undefined}
      data-testid={`${which}-hand`}
      data-angle={angle}
    />
  );
  const face = bw ? '#fff' : '#fffdf5';
  return (
    <div className="clock-wrap">
      <svg
        ref={ref}
        viewBox="-110 -110 220 220"
        width={size}
        height={size}
        role={onChange ? 'slider' : 'img'}
        aria-label={label}
        aria-valuetext={onChange ? `${h}:${String(m).padStart(2, '0')}` : undefined}
        tabIndex={onChange ? 0 : undefined}
        onKeyDown={onKey}
        onPointerMove={onMove}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
        className="clock-svg"
      >
        <circle r="104" fill={bw ? '#fff' : '#c98b3a'} stroke="#3d2b1f" strokeWidth="4" />
        <circle r="94" fill={face} stroke="#3d2b1f" strokeWidth="2" />
        {Array.from({ length: 60 }, (_, i) => {
          const a = rad(i * 6);
          const long = i % 5 === 0;
          return <line key={i} x1={Math.cos(a) * (long ? 80 : 86)} y1={Math.sin(a) * (long ? 80 : 86)} x2={Math.cos(a) * 92} y2={Math.sin(a) * 92} stroke="#3d2b1f" strokeWidth={long ? 3 : 1} />;
        })}
        {Array.from({ length: 12 }, (_, i) => {
          const n = i + 1;
          const a = rad(n * 30);
          return <text key={n} x={Math.cos(a) * 66} y={Math.sin(a) * 66 + 7} textAnchor="middle" fontSize="20" fontWeight="700" fill="#3d2b1f">{n}</text>;
        })}
        {hand(ha, 48, 9, '#3d2b1f', 'hour')}
        {hand(ma, 78, 5, bw ? '#3d2b1f' : '#c0392b', 'minute')}
        <circle r="7" fill="#F7BF35" stroke="#3d2b1f" strokeWidth="2" />
      </svg>
      {onChange && controlsLabel && (
        <div className="clock-buttons" role="group">
          <button type="button" className="btn small" onClick={() => step(-1, 0)} aria-label={controlsLabel.hourDown}>◀ h</button>
          <button type="button" className="btn small" onClick={() => step(1, 0)} aria-label={controlsLabel.hourUp}>h ▶</button>
          <button type="button" className="btn small" onClick={() => step(0, -5)} aria-label={controlsLabel.minDown}>◀ min</button>
          <button type="button" className="btn small" onClick={() => step(0, 5)} aria-label={controlsLabel.minUp}>min ▶</button>
        </div>
      )}
    </div>
  );
}
