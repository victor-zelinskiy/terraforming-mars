/*
 * THE CARD FACE OF A PARTY (Turmoil Redux — ONE FRAMEWORK, the owner's decision Р2 of 2026-10-24).
 *
 * A party's action is composed by THE card composer, and its hero is a CARD: the party drawn in the PROJECT card's
 * anatomy («это то же самое действие, что у синей карты, — только с печатью партии»). The face is built HERE from the
 * client parliament manifest and handed to `PremiumCard` through `vmOverride` (the one sanctioned entry for a face
 * outside the card manifest — the resolutions' and the MarsBot corporations' precedent):
 *
 *   · the nameplate carries the party's NAME (`partyNameKey`), never a card name;
 *   · the art window carries the party's SEAL over its accent field (`sealArt` — the emblem whole, never cropped as
 *     an illustration; `pcard--party-face`);
 *   · the rules block prints the party's own render data through the ONE formula renderer — its standing effect
 *     above, its action below, exactly as a blue card prints an effect and an action; the action's nodes carry the
 *     `data-graphic-node` anchors the ACTION COMMIT's impulse runs over;
 *   · no cost, no tags, no requirement — a party is played by nobody.
 *
 * No fictitious project card is created: `name` is the party's tile KEY (a key, never a CardName in the manifest).
 */
import {CardName} from '@/common/cards/CardName';
import {CardType} from '@/common/cards/CardType';
import {ICardRenderRoot} from '@/common/cards/render/Types';
import {ReduxParty} from '@/common/parliament/ParliamentTypes';
import {getPartyEffect} from '@/client/parliament/ClientParliamentManifest';
import {partyNameKey} from '@/client/console/parliament/partyNames';
import {PremiumCardVM} from './premiumCardViewModel';
import {buildMechanics} from './mechanicsModel';
import {tagClusterPlan} from './tagLayout';
import {partyAccent, partyEmblemUrl} from './partyEmblems';
import {PARLIAMENT_GRAPHIC} from './resolutionPremiumVm';

/** The printed rows of a render root that say something (an empty passive builder is `[[]]`). */
function printedRows(root: ICardRenderRoot | undefined): ICardRenderRoot['rows'] {
  return (root?.rows ?? []).filter((row) => row.length > 0);
}

/** The card face of a party — `undefined` for a party the manifest does not know. */
export function partyPremiumVm(party: ReduxParty): PremiumCardVM | undefined {
  const effect = getPartyEffect(party);
  if (effect === undefined) {
    return undefined;
  }
  const rows = [...printedRows(effect.passiveRenderData), ...printedRows(effect.actionRenderData)];
  const root: ICardRenderRoot = {...(effect.actionRenderData ?? effect.passiveRenderData), is: 'root', rows};
  return {
    name: `PARTY_${party}` as CardName,
    slug: `party-${party.toLowerCase().replace(/\s+/g, '-')}`,
    type: CardType.ACTIVE,
    theme: 'azure',
    title: partyNameKey(party),
    tags: [],
    tagCluster: tagClusterPlan(0),
    requirements: [],
    art: {url: partyEmblemUrl(party), fallback: false},
    mechanics: buildMechanics(root, PARLIAMENT_GRAPHIC),
    expansion: 'turmoilRedux',
    compatibility: ['turmoilRedux'],
    parliament: {
      party,
      emblemUrl: partyEmblemUrl(party),
      accent: partyAccent(party),
      sealArt: true,
    },
  };
}
