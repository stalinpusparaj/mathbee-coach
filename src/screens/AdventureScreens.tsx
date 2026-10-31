import type { SessionRecord } from '../learning/types';
import { store } from '../app/store';

/** Adventure screens (CONTRACT for WP4). SCAFFOLD STUBS. */
export function AdventureWorldsScreen() {
  return <div className="screen" data-testid="adventure"><button type="button" className="btn" onClick={() => store.setRoute({ name: 'map' })}>←</button></div>;
}
export function WorldMapScreen({ world }: { world: string }) {
  return <div className="screen" data-testid="world-map" data-world={world} />;
}
export function LevelResultsScreen({ levelId }: { levelId: string; record: SessionRecord; newNectar: number; prevStars: number }) {
  return <div className="screen" data-testid="level-results" data-level={levelId} />;
}
