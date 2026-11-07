// Campaign Map — the presentation registry of MISSION MODIFIERS
// (`common/campaign/missionModifiers.ts`). ONE row per modifier id: its short
// badge word, its full name and its one-sentence rule. Every surface that
// shows a modifier (the route card's badge, the mission dossier) reads this
// table — a new modifier is a new row here and nothing else on the client.

import {MissionModifier, MissionModifierId} from '@/common/campaign/CampaignTypes';

export type MissionModifierMeta = {
  id: MissionModifierId;
  /** The badge's one word-pair (English i18n key). */
  shortKey: string;
  /** The full name (English i18n key). */
  labelKey: string;
  /** What the modifier changes, one sentence (English i18n key). */
  descKey: string;
  /** The glyph the badge draws (`CampaignModifierBadge`). */
  glyph: 'dice' | 'shuffle';
};

const MISSION_MODIFIER_META: Record<MissionModifierId, MissionModifierMeta> = {
  randomMA: {
    id: 'randomMA',
    shortKey: 'Random goals',
    labelKey: 'Random milestones and awards',
    descKey: 'Milestones and awards of this mission are drawn at random instead of the board’s printed row.',
    glyph: 'dice',
  },
  shuffleMap: {
    id: 'shuffleMap',
    shortKey: 'Shuffled cells',
    labelKey: 'Random tile placement',
    descKey: 'The bonuses on this mission’s board are shuffled at the launch — the printed layout does not hold.',
    glyph: 'shuffle',
  },
};

/** The known modifiers of a slot, in the slot's order — an unknown id (a newer server) is skipped, never guessed. */
export function missionModifierMetas(modifiers: ReadonlyArray<MissionModifier> | undefined): ReadonlyArray<MissionModifierMeta> {
  const out: Array<MissionModifierMeta> = [];
  for (const m of modifiers ?? []) {
    const meta = MISSION_MODIFIER_META[m.id];
    if (meta !== undefined && !out.includes(meta)) {
      out.push(meta);
    }
  }
  return out;
}
