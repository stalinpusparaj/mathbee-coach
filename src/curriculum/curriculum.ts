import type { CategoryId, Stage } from '../engine/types';
import type { Source } from '../engine/template';

export interface Category {
  id: CategoryId;
  /** sprite used on the map and menus */
  icon: string;
  /** percentage position on the garden map */
  map: { x: number; y: number };
  /** worksheet topic this category comes from */
  topicKey: string;
  observed: boolean;
}

export const CATEGORIES: Category[] = [
  { id: 'C01', icon: 'flower_potted', map: { x: 14, y: 22 }, topicKey: 'topic.counting', observed: true },
  { id: 'C02', icon: 'boat', map: { x: 38, y: 16 }, topicKey: 'topic.mixed', observed: true },
  { id: 'C03', icon: 'bird:owl', map: { x: 62, y: 14 }, topicKey: 'topic.birds', observed: true },
  { id: 'C04', icon: 'pot_terracotta', map: { x: 86, y: 22 }, topicKey: 'topic.size', observed: true },
  { id: 'C05', icon: 'plank', map: { x: 12, y: 46 }, topicKey: 'topic.length', observed: true },
  { id: 'C06', icon: 'workshop', map: { x: 34, y: 42 }, topicKey: 'topic.shapes', observed: true },
  { id: 'C07', icon: 'rose', map: { x: 58, y: 40 }, topicKey: 'topic.pairs', observed: true },
  { id: 'C08', icon: 'basket', map: { x: 84, y: 48 }, topicKey: 'topic.add', observed: true },
  { id: 'C09', icon: 'penguin', map: { x: 14, y: 72 }, topicKey: 'topic.sub', observed: true },
  { id: 'C10', icon: 'stepping_stone', map: { x: 36, y: 68 }, topicKey: 'topic.sequence', observed: true },
  { id: 'C11', icon: 'notice_board', map: { x: 58, y: 66 }, topicKey: 'topic.days', observed: true },
  { id: 'C12', icon: 'clock_tower', map: { x: 82, y: 74 }, topicKey: 'topic.clock', observed: true },
  { id: 'C13', icon: 'calendar_easel', map: { x: 30, y: 90 }, topicKey: 'topic.calendar', observed: true },
  { id: 'C14', icon: 'help_desk_stall', map: { x: 62, y: 90 }, topicKey: 'topic.word', observed: true },
];
export const CATEGORY_BY_ID = Object.fromEntries(CATEGORIES.map((c) => [c.id, c])) as Record<CategoryId, Category>;

/** Order used by the starting assessment: worksheet topics most central to Grade 1 first. */
export const ASSESSMENT_ORDER: CategoryId[] = ['C01', 'C08', 'C09', 'C10', 'C07', 'C02', 'C14', 'C06', 'C04', 'C05', 'C11', 'C03', 'C12', 'C13'];

export interface Subskill {
  id: string;
  category: CategoryId;
  stage: Stage;
  source: Source;
  /** subskills that should be secure first (used for prerequisite checks) */
  prereq?: string[];
  /** hidden unless unlocked by the parent or by secure prerequisites */
  gated?: boolean;
}

export const SUBSKILLS: Subskill[] = [
  { id: 'C01.to5', category: 'C01', stage: 'explore', source: 'observed' },
  { id: 'C01.zero', category: 'C01', stage: 'explore', source: 'prerequisite' },
  { id: 'C01.to20', category: 'C01', stage: 'practise', source: 'observed', prereq: ['C01.to5'] },
  { id: 'C01.groups50', category: 'C01', stage: 'apply', source: 'extension', prereq: ['C01.to20'] },
  { id: 'C02.to5', category: 'C02', stage: 'explore', source: 'observed', prereq: ['C01.to5'] },
  { id: 'C02.to20', category: 'C02', stage: 'practise', source: 'observed', prereq: ['C02.to5', 'C01.to20'] },
  { id: 'C02.grouped50', category: 'C02', stage: 'apply', source: 'extension', prereq: ['C02.to20'] },
  { id: 'C02.partWhole', category: 'C02', stage: 'apply', source: 'extension', prereq: ['C02.to20'] },
  { id: 'C03.vocab', category: 'C03', stage: 'explore', source: 'prerequisite' },
  { id: 'C03.oneTarget', category: 'C03', stage: 'explore', source: 'observed', prereq: ['C01.to5'] },
  { id: 'C03.sortCount', category: 'C03', stage: 'practise', source: 'observed', prereq: ['C03.oneTarget', 'C03.vocab'] },
  { id: 'C03.compare', category: 'C03', stage: 'apply', source: 'extension', prereq: ['C03.sortCount'] },
  { id: 'C04.bigSmall', category: 'C04', stage: 'explore', source: 'observed' },
  { id: 'C04.order', category: 'C04', stage: 'practise', source: 'extension', prereq: ['C04.bigSmall'] },
  { id: 'C04.constraint', category: 'C04', stage: 'apply', source: 'extension', prereq: ['C04.order'] },
  { id: 'C05.longShort', category: 'C05', stage: 'explore', source: 'observed' },
  { id: 'C05.measure', category: 'C05', stage: 'practise', source: 'extension', prereq: ['C05.longShort', 'C01.to5'] },
  { id: 'C05.build', category: 'C05', stage: 'apply', source: 'extension', prereq: ['C05.measure'] },
  { id: 'C06.names', category: 'C06', stage: 'explore', source: 'prerequisite' },
  { id: 'C06.sidesCorners', category: 'C06', stage: 'practise', source: 'observed', prereq: ['C06.names'] },
  { id: 'C06.rotateCompose', category: 'C06', stage: 'apply', source: 'extension', prereq: ['C06.sidesCorners'] },
  { id: 'C06.polygons', category: 'C06', stage: 'apply', source: 'extension', prereq: ['C06.sidesCorners'] },
  { id: 'C07.makePairs', category: 'C07', stage: 'explore', source: 'observed', prereq: ['C01.to5'] },
  { id: 'C07.countPairs', category: 'C07', stage: 'practise', source: 'observed', prereq: ['C07.makePairs'] },
  { id: 'C07.pairsApply', category: 'C07', stage: 'apply', source: 'extension', prereq: ['C07.countPairs'] },
  { id: 'C08.to5', category: 'C08', stage: 'explore', source: 'observed', prereq: ['C01.to5'] },
  { id: 'C08.to20', category: 'C08', stage: 'practise', source: 'observed', prereq: ['C08.to5'] },
  { id: 'C08.makeTen', category: 'C08', stage: 'practise', source: 'observed', prereq: ['C08.to5'] },
  { id: 'C08.twoDigit', category: 'C08', stage: 'apply', source: 'extension', prereq: ['C08.to20'] },
  { id: 'C08.decade', category: 'C08', stage: 'apply', source: 'observed', prereq: ['C08.makeTen'] },
  { id: 'C08.regroup', category: 'C08', stage: 'apply', source: 'extension', prereq: ['C08.twoDigit', 'C08.decade'], gated: true },
  { id: 'C09.to5', category: 'C09', stage: 'explore', source: 'observed', prereq: ['C01.to5'] },
  { id: 'C09.to20', category: 'C09', stage: 'practise', source: 'observed', prereq: ['C09.to5'] },
  { id: 'C09.twoDigit', category: 'C09', stage: 'apply', source: 'observed', prereq: ['C09.to20'] },
  { id: 'C09.regroup', category: 'C09', stage: 'apply', source: 'extension', prereq: ['C09.twoDigit'], gated: true },
  { id: 'C10.beforeAfter10', category: 'C10', stage: 'explore', source: 'observed' },
  { id: 'C10.seq100', category: 'C10', stage: 'practise', source: 'observed', prereq: ['C10.beforeAfter10'] },
  { id: 'C10.multiGap', category: 'C10', stage: 'apply', source: 'observed', prereq: ['C10.seq100'] },
  { id: 'C10.skip', category: 'C10', stage: 'apply', source: 'extension', prereq: ['C10.seq100'] },
  { id: 'C11.order', category: 'C11', stage: 'explore', source: 'observed' },
  { id: 'C11.beforeAfter', category: 'C11', stage: 'practise', source: 'observed', prereq: ['C11.order'] },
  { id: 'C11.offsets', category: 'C11', stage: 'apply', source: 'extension', prereq: ['C11.beforeAfter'] },
  { id: 'C12.hours', category: 'C12', stage: 'explore', source: 'prerequisite' },
  { id: 'C12.halfQuarter', category: 'C12', stage: 'practise', source: 'observed', prereq: ['C12.hours'] },
  { id: 'C12.fiveMin', category: 'C12', stage: 'apply', source: 'observed', prereq: ['C12.halfQuarter'] },
  { id: 'C12.elapsed', category: 'C12', stage: 'apply', source: 'extension', prereq: ['C12.fiveMin'] },
  { id: 'C13.read', category: 'C13', stage: 'explore', source: 'observed' },
  { id: 'C13.named', category: 'C13', stage: 'practise', source: 'observed', prereq: ['C13.read'] },
  { id: 'C13.intervals', category: 'C13', stage: 'apply', source: 'observed', prereq: ['C13.named'] },
  { id: 'C13.transitions', category: 'C13', stage: 'apply', source: 'extension', prereq: ['C13.named'] },
  { id: 'C14.to5', category: 'C14', stage: 'explore', source: 'observed', prereq: ['C08.to5', 'C09.to5'] },
  { id: 'C14.to20', category: 'C14', stage: 'practise', source: 'observed', prereq: ['C14.to5', 'C08.to20', 'C09.to20'] },
  { id: 'C14.twoStep', category: 'C14', stage: 'apply', source: 'extension', prereq: ['C14.to20'] },
  { id: 'C14.missing', category: 'C14', stage: 'apply', source: 'extension', prereq: ['C14.to20'] },
];
export const SUBSKILL_BY_ID = Object.fromEntries(SUBSKILLS.map((s) => [s.id, s])) as Record<string, Subskill>;

/**
 * Worksheet coverage: what the six supplied photographs (pages 10–14) show.
 * A = directly observed. Used by the parent dashboard and docs/CURRICULUM_COVERAGE.md.
 */
export interface WorksheetItem { ref: string; description: string; category: CategoryId; subskills: string[]; readable: 'yes' | 'partial' }
export const WORKSHEET_ITEMS: WorksheetItem[] = [
  { ref: 'Q1–Q7', description: 'Count and write (stars, teddies, bicycles, books, apples in columns, smileys, scattered drops)', category: 'C01', subskills: ['C01.to5', 'C01.to20'], readable: 'yes' },
  { ref: 'Q8', description: '10 − 3 in boxes (choice)', category: 'C09', subskills: ['C09.to20'], readable: 'yes' },
  { ref: 'Q9', description: 'How many figures altogether (dogs, squirrels, turtles)', category: 'C02', subskills: ['C02.to20'], readable: 'yes' },
  { ref: 'Q10', description: 'Which is small? (two circles)', category: 'C04', subskills: ['C04.bigSmall'], readable: 'yes' },
  { ref: 'Q11', description: 'Which is long? (two arrows)', category: 'C05', subskills: ['C05.longShort'], readable: 'yes' },
  { ref: 'Q12–Q13', description: 'Number of sides: rectangle, triangle', category: 'C06', subskills: ['C06.sidesCorners'], readable: 'yes' },
  { ref: 'Q14', description: 'Add and write total balls (3 + 5), answers as words', category: 'C08', subskills: ['C08.to5', 'C08.to20'], readable: 'yes' },
  { ref: 'Q15', description: 'How many pairs of roses (10 roses)', category: 'C07', subskills: ['C07.makePairs', 'C07.countPairs'], readable: 'yes' },
  { ref: 'Q16', description: '20 apples, 6 taken away', category: 'C14', subskills: ['C14.to20'], readable: 'yes' },
  { ref: 'Q17', description: '12 chocolates, 8 added', category: 'C14', subskills: ['C14.to20'], readable: 'yes' },
  { ref: 'Q18', description: '19 − 11', category: 'C09', subskills: ['C09.to20'], readable: 'yes' },
  { ref: 'Q19', description: 'Number before 28', category: 'C10', subskills: ['C10.beforeAfter10', 'C10.seq100'], readable: 'yes' },
  { ref: 'Q20', description: 'Day before Monday', category: 'C11', subskills: ['C11.beforeAfter'], readable: 'yes' },
  { ref: 'Q21', description: 'How many days in a week', category: 'C11', subskills: ['C11.order'], readable: 'yes' },
  { ref: 'Q22', description: '11 birds, 5 more arrive', category: 'C14', subskills: ['C14.to20'], readable: 'yes' },
  { ref: 'Q23', description: '12 coconuts, 2 fall down', category: 'C14', subskills: ['C14.to20'], readable: 'yes' },
  { ref: 'Q24', description: '"Subtract:" picture of penguins with options 4/5/3/2 — full question text not visible in the photo', category: 'C09', subskills: ['C09.to5'], readable: 'partial' },
  { ref: 'Q25', description: 'Read the clock (10:05 / 10:15 / 10:10)', category: 'C12', subskills: ['C12.fiveMin'], readable: 'yes' },
  { ref: 'Q26–Q30', description: 'Missing numbers forwards and backwards (17…22, 59…55, 9…14, 36…31, 69…64)', category: 'C10', subskills: ['C10.seq100', 'C10.multiGap'], readable: 'yes' },
  { ref: 'Q31–Q35', description: 'July calendar (Monday-first): days from 7th to 27th, last Friday, 16th to 28th, weekday of 15th, weekday of 11th', category: 'C13', subskills: ['C13.read', 'C13.named', 'C13.intervals'], readable: 'yes' },
  { ref: 'Q36–Q45', description: 'Evaluate: 20−11, 6+14, 9+11, 10+0, 11+19, 4+12, 8+4, 16−7, 48−20, 27−17', category: 'C08', subskills: ['C08.to20', 'C08.makeTen', 'C08.decade', 'C09.to20', 'C09.twoDigit'], readable: 'yes' },
  { ref: 'Q46–Q50', description: 'Count each bird: owl, swan, parrot, ostrich, cock (with crows, penguins and others mixed in)', category: 'C03', subskills: ['C03.oneTarget', 'C03.sortCount'], readable: 'yes' },
];

/** Nectar-restorable garden features (fixed, visible costs; purely cosmetic). */
export const GARDEN_ITEMS: { id: string; sprite: string; cost: number; x: number; y: number }[] = [
  { id: 'lily_pad', sprite: 'lily_pad', cost: 3, x: 47, y: 55 },
  { id: 'cattails', sprite: 'cattails', cost: 4, x: 3, y: 60 },
  { id: 'chair', sprite: 'chair', cost: 5, x: 72, y: 30 },
  { id: 'watering_can', sprite: 'watering_can_flowers', cost: 5, x: 24, y: 32 },
  { id: 'frog', sprite: 'frog', cost: 6, x: 48, y: 78 },
  { id: 'lantern', sprite: 'lantern', cost: 6, x: 94, y: 60 },
  { id: 'firefly', sprite: 'firefly', cost: 7, x: 72, y: 56 },
  { id: 'bunting', sprite: 'bunting', cost: 8, x: 48, y: 4 },
  { id: 'wreath', sprite: 'wreath', cost: 8, x: 4, y: 88 },
  { id: 'gate', sprite: 'gate', cost: 10, x: 94, y: 90 },
  { id: 'picnic', sprite: 'picnic_hamper', cost: 10, x: 76, y: 94 },
  { id: 'bunny', sprite: 'bunny_sleeping', cost: 12, x: 46, y: 96 },
  // shown only when the generated art exists (tools/generate_art.mjs)
  { id: 'butterflies', sprite: 'garden_butterflies', cost: 6, x: 24, y: 8 },
  { id: 'birdhouse', sprite: 'garden_birdhouse', cost: 9, x: 96, y: 36 },
  { id: 'arch', sprite: 'garden_arch', cost: 11, x: 3, y: 34 },
  { id: 'fountain', sprite: 'garden_fountain', cost: 14, x: 60, y: 54 },
];
