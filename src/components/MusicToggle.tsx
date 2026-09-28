import { store, useStore } from '../app/store';
import { music } from '../audio/music';
import { useT } from '../i18n/useT';

/** Background-music on/off. Turning it on starts playback inside the same tap (browser audio rule). */
export function MusicToggle({ compact }: { compact?: boolean }) {
  const t = useT();
  const on = useStore((s) => s.app.music !== false);
  const toggle = () => {
    const next = !on;
    store.setMusic(next);
    if (next) music.start();
    else music.stop();
  };
  return (
    <button type="button" className={compact ? 'icon-btn music-btn' : 'btn small secondary'} onClick={toggle} aria-pressed={on}
      aria-label={t(on ? 'ui.musicOn' : 'ui.musicOff')} title={t(on ? 'ui.musicOn' : 'ui.musicOff')} data-testid="music-toggle">
      {on ? '🎵' : '🔇'}{compact ? '' : ` ${t(on ? 'ui.musicOn' : 'ui.musicOff')}`}
    </button>
  );
}
