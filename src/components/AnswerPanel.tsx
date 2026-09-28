import { useEffect, useState } from 'react';
import type { AnswerSpec, ChoiceOption, Response, Visual } from '../engine/types';
import { useT } from '../i18n/useT';
import { Sprite, Bird, ShapeSvg } from './art';
import { Clock } from './Clock';

interface Props {
  answer: AnswerSpec;
  response: Response | undefined;
  onChange: (r: Response) => void;
  disabled?: boolean;
  /** hide option pictures (e.g. mock/plain mode keeps them — only text) */
  compact?: boolean;
  /** externally requested active field (e.g. tapping a gap stone) */
  activeField?: string | null;
  onActiveField?: (id: string) => void;
}

export function VisualView({ v, size = 44 }: { v: Visual; size?: number }) {
  switch (v.type) {
    case 'sprite': return <Sprite id={v.id} size={size} decorative />;
    case 'bird': return <Bird species={v.species} size={`${size}px`} />;
    case 'shape': return <ShapeSvg shape={v.shape} rotation={v.rotation} w={v.w} h={v.h} size={size + 16} />;
    case 'clock': return <Clock h={v.h} m={v.m} size={size + 40} label="" />;
    case 'text': return <span>{v.text}</span>;
  }
}

export function AnswerPanel({ answer, response, onChange, disabled, activeField, onActiveField }: Props) {
  switch (answer.kind) {
    case 'number':
      return <NumberAnswer value={response?.kind === 'number' ? response.value : null} max={answer.max ?? 100} onChange={(v) => onChange({ kind: 'number', value: v })} disabled={disabled} />;
    case 'choice':
      return <ChoiceAnswer options={answer.options} value={response?.kind === 'choice' ? response.value : null} onChange={(v) => onChange({ kind: 'choice', value: v })} disabled={disabled} />;
    case 'order':
      return <OrderAnswer items={answer.items} value={response?.kind === 'order' ? response.value : []} onChange={(v) => onChange({ kind: 'order', value: v })} disabled={disabled} />;
    case 'fields':
      return (
        <FieldsAnswer
          fields={answer.fields}
          values={response?.kind === 'fields' ? response.values : {}}
          onChange={(values) => onChange({ kind: 'fields', values })}
          disabled={disabled}
          activeField={activeField}
          onActiveField={onActiveField}
        />
      );
    case 'time':
      return null; // the clock itself is the input
  }
}

function useDigitKeys(enabled: boolean, onDigit: (d: number) => void, onBack: () => void) {
  useEffect(() => {
    if (!enabled) return;
    const h = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      if (/^[0-9]$/.test(e.key)) {
        onDigit(Number(e.key));
        e.preventDefault();
      } else if (e.key === 'Backspace') {
        onBack();
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [enabled, onDigit, onBack]);
}

function append(cur: number | null, d: number, max: number): number {
  const next = cur === null ? d : cur * 10 + d;
  return next > Math.max(max, 999) ? cur ?? d : next;
}

export function Keypad({ onDigit, onBack, onClear, disabled }: { onDigit: (d: number) => void; onBack: () => void; onClear: () => void; disabled?: boolean }) {
  const t = useT();
  return (
    <div className="keypad" role="group" aria-label={t('ui.keypad')}>
      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
        <button key={d} type="button" className="key" onClick={() => onDigit(d)} disabled={disabled} data-testid={`key-${d}`}>{d}</button>
      ))}
      <button type="button" className="key alt" onClick={onClear} disabled={disabled} aria-label={t('ui.clear')}>C</button>
      <button type="button" className="key" onClick={() => onDigit(0)} disabled={disabled} data-testid="key-0">0</button>
      <button type="button" className="key alt" onClick={onBack} disabled={disabled} aria-label={t('ui.backspace')}>⌫</button>
    </div>
  );
}

function NumberAnswer({ value, max, onChange, disabled }: { value: number | null; max: number; onChange: (v: number | null) => void; disabled?: boolean }) {
  const t = useT();
  const digit = (d: number) => onChange(append(value, d, max));
  const back = () => onChange(value === null || value < 10 ? null : Math.floor(value / 10));
  useDigitKeys(!disabled, digit, back);
  return (
    <div className="number-answer">
      <output className="answer-display" aria-live="polite" aria-label={t('ui.yourAnswer')} data-testid="answer-display">{value ?? ' '}</output>
      <Keypad onDigit={digit} onBack={back} onClear={() => onChange(null)} disabled={disabled} />
    </div>
  );
}

function ChoiceAnswer({ options, value, onChange, disabled }: { options: ChoiceOption[]; value: string | null; onChange: (v: string) => void; disabled?: boolean }) {
  const t = useT();
  return (
    <div className="choices" role="radiogroup" aria-label={t('ui.chooseAnswer')}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          className={`choice ${value === o.id ? 'on' : ''}`}
          onClick={() => onChange(o.id)}
          disabled={disabled}
          data-testid={`choice-${o.id}`}
        >
          {o.visual && <VisualView v={o.visual} />}
          <span>{t(o.label)}</span>
        </button>
      ))}
    </div>
  );
}

function OrderAnswer({ items, value, onChange, disabled }: { items: ChoiceOption[]; value: string[]; onChange: (v: string[]) => void; disabled?: boolean }) {
  const t = useT();
  const label = (id: string) => t(items.find((i) => i.id === id)!.label);
  return (
    <div className="order-answer">
      <ol className="order-slots" aria-label={t('ui.yourOrder')}>
        {items.map((_, i) => (
          <li key={i} className={value[i] ? 'filled' : ''}>{value[i] ? label(value[i]) : '·'}</li>
        ))}
      </ol>
      <div className="choices">
        {items.filter((i) => !value.includes(i.id)).map((i) => (
          <button key={i.id} type="button" className="choice" onClick={() => onChange([...value, i.id])} disabled={disabled} data-testid={`order-${i.id}`}>
            {t(i.label)}
          </button>
        ))}
      </div>
      <div className="row">
        <button type="button" className="btn small secondary" onClick={() => onChange(value.slice(0, -1))} disabled={disabled || !value.length}>{t('ui.undo')}</button>
        <button type="button" className="btn small secondary" onClick={() => onChange([])} disabled={disabled || !value.length}>{t('ui.clear')}</button>
      </div>
    </div>
  );
}

function FieldsAnswer({ fields, values, onChange, disabled, activeField, onActiveField }: {
  fields: { id: string; label: import('../engine/types').Msg; visual?: Visual }[];
  values: Record<string, number | null>;
  onChange: (v: Record<string, number | null>) => void;
  disabled?: boolean;
  activeField?: string | null;
  onActiveField?: (id: string) => void;
}) {
  const t = useT();
  const [localActive, setLocalActive] = useState(fields[0]?.id);
  const active = activeField ?? localActive;
  const setActive = (id: string) => (onActiveField ? onActiveField(id) : setLocalActive(id));
  const cur = values[active] ?? null;
  const set = (v: number | null) => onChange({ ...values, [active]: v });
  const digit = (d: number) => set(append(cur, d, 100));
  const back = () => set(cur === null || cur < 10 ? null : Math.floor(cur / 10));
  useDigitKeys(!disabled, digit, back);
  return (
    <div className="fields-answer">
      <div className="fields">
        {fields.map((f) => (
          <button key={f.id} type="button" className={`field ${active === f.id ? 'active' : ''}`} onClick={() => setActive(f.id)} disabled={disabled} aria-pressed={active === f.id} data-testid={`field-${f.id}`}>
            {f.visual && <VisualView v={f.visual} size={32} />}
            <span className="field-label">{t(f.label)}</span>
            <output className="field-value">{values[f.id] ?? ' '}</output>
          </button>
        ))}
      </div>
      <Keypad onDigit={digit} onBack={back} onClear={() => set(null)} disabled={disabled} />
    </div>
  );
}
