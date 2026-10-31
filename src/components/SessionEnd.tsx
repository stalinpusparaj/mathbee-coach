import { store } from '../app/store';

/** Natural session end / daily limit reached (CONTRACT for WP5). SCAFFOLD STUB. */
export function SessionEndScreen() {
  return <div className="screen center" data-testid="session-end"><button type="button" className="btn primary" onClick={() => store.setRoute({ name: 'map' })}>OK</button></div>;
}
