import { store } from '../app/store';

/** Narrated story intro (CONTRACT for WP6). SCAFFOLD STUB. */
export function IntroStory() {
  return <div className="screen center" data-testid="intro"><button type="button" className="btn primary" onClick={() => store.setRoute({ name: 'controls' })} data-testid="intro-skip">→</button></div>;
}
