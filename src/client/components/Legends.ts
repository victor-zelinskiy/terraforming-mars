import {BoardName} from '@/common/boards/BoardName';

export type Key = {
  position: [number, number],
  text: [string, string],
  line?: {from: [number, number], to: [number, number]},
  secondRowX?: number,
};

export const LEGENDS: Record<BoardName, Array<Key>> = {
  [BoardName.THARSIS]: [],
  [BoardName.HELLAS]: [],
  [BoardName.ELYSIUM]: [],
  [BoardName.ARABIA_TERRA]: [],
  [BoardName.UTOPIA_PLANITIA]: [],
  [BoardName.VASTITAS_BOREALIS_NOVA]: [],
  [BoardName.VASTITAS_BOREALIS]: [],
  [BoardName.AMAZONIS]: [],
  [BoardName.TERRA_CIMMERIA]: [],
  [BoardName.TERRA_CIMMERIA_NOVA]: [],
  [BoardName.HOLLANDIA]: [],
};
