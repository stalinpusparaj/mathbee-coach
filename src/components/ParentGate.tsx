import { store } from '../app/store';

/**
 * Parent gate (CONTRACT). <ParentGate> asks an adult-only question; onPass opens the grown-up
 * area. <ParentEntry> is the child-safe entry button (testid "parent-hold") that leads to it.
 * SCAFFOLD STUB: passes immediately. WP6 implements the real gate (keypad multiplication,
 * bilingual, cool-off, e2e bypass via data-answer under ?e2e in non-android builds).
 */
export function ParentGate({ onPass, onCancel }: { onPass: () => void; onCancel: () => void }) {
  return (
    <div className="screen center" data-testid="parent-gate">
      <button type="button" className="btn primary" onClick={onPass} data-testid="gate-pass">OK</button>
      <button type="button" className="btn secondary" onClick={onCancel}>←</button>
    </div>
  );
}

export function ParentEntry({ label }: { label: string }) {
  return (
    <button type="button" className="btn secondary" onClick={() => store.setRoute({ name: 'parent' })} data-testid="parent-hold">{label}</button>
  );
}
