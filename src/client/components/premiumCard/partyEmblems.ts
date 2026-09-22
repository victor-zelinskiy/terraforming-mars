import {PartyName} from '@/common/turmoil/PartyName';
import {ReduxParty} from '@/common/parliament/ParliamentTypes';

/**
 * The party emblems (Turmoil Redux): the fork's own 512px badge set in one
 * language (dark navy badge, thin gold rim, the party's luminous sigil) —
 * crisp from the 40px workspace tile to a resolution's seal and the fullscreen
 * party plaque. The shipped 154px Turmoil PNGs stay for the classic Turmoil
 * surfaces.
 */
const PARTY_EMBLEM: Readonly<Record<ReduxParty, string>> = {
  [PartyName.UNITY]: 'assets/parties/redux/unity.png',
  [PartyName.GREENS]: 'assets/parties/redux/greens.png',
  [PartyName.SCIENTISTS]: 'assets/parties/redux/scientists.png',
  [PartyName.MARS]: 'assets/parties/redux/mars-first.png',
  [PartyName.INDUSTRIALISTS]: 'assets/parties/redux/industrialists.png',
  [PartyName.REDS]: 'assets/parties/redux/reds.png',
};

export function partyEmblemUrl(party: ReduxParty): string {
  return PARTY_EMBLEM[party];
}

/** The party's accent colour (the workspace's tiles, the vote stage's kicker). */
const PARTY_ACCENT: Readonly<Record<ReduxParty, string>> = {
  [PartyName.UNITY]: '#7fa7ff',
  [PartyName.GREENS]: '#5fd18a',
  [PartyName.SCIENTISTS]: '#d9dde6',
  [PartyName.MARS]: '#e0946a',
  [PartyName.INDUSTRIALISTS]: '#d6a94a',
  [PartyName.REDS]: '#e26060',
};

export function partyAccent(party: ReduxParty): string {
  return PARTY_ACCENT[party];
}
