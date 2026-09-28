import { monthGrid, WEEKDAY_KEYS } from '../engine/math';
import { useT } from '../i18n/useT';

interface Props {
  year: number;
  month: number;
  marks?: number[];
  range?: [number, number];
  selected?: number | null;
  onSelect?: (d: number) => void;
  highlightColumn?: number | null;
  bw?: boolean;
}

/** Monday-first calendar grid generated from real dates (matches the worksheet layout). */
export function Calendar({ year, month, marks = [], range, selected, onSelect, highlightColumn, bw }: Props) {
  const t = useT();
  const rows = monthGrid(year, month);
  return (
    <table className={`calendar ${bw ? 'bw' : ''}`} aria-label={`${t(`month.${month}`)} ${year}`}>
      <caption>{t(`month.${month}`)} {year}</caption>
      <thead>
        <tr>
          {WEEKDAY_KEYS.map((k, i) => (
            <th key={k} scope="col" className={highlightColumn === i ? 'hl' : ''}>
              <abbr title={t(`day.${k}`)}>{t(`dayShort.${k}`)}</abbr>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, r) => (
          <tr key={r}>
            {row.map((d, c) => {
              if (d === null) return <td key={c} className="empty" />;
              const inRange = range && d >= range[0] && d <= range[1];
              const cls = [marks.includes(d) ? 'mark' : '', inRange ? 'range' : '', selected === d ? 'sel' : '', highlightColumn === c ? 'hl' : ''].join(' ');
              return (
                <td key={c} className={cls}>
                  {onSelect ? (
                    <button type="button" onClick={() => onSelect(d)} aria-pressed={selected === d} aria-label={`${t(`month.${month}`)} ${d}, ${t(`day.${WEEKDAY_KEYS[c]}`)}`}>
                      {d}{marks.includes(d) && <span className="flower-mark" aria-hidden>✿</span>}
                    </button>
                  ) : (
                    <span>{d}{marks.includes(d) && <span className="flower-mark" aria-label="flower">✿</span>}</span>
                  )}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
