/*
 * THE CARD FACE OF A PARTY (Turmoil Redux — ONE FRAMEWORK, the owner's decision Р2 of 2026-10-24).
 *
 * A party's action is composed by THE card composer, and its hero is a CARD. Since 2026-10-25 that card is the party's
 * OWN anatomy — THE CHARTER (`PremiumPartyFace`, theme `charter`; the owner: «не повтор проектных карточек … свой
 * неповторимый НАСТОЛЬНЫЙ дизайн, логотипу не должно быть отдано так много места»), the project anatomy with the seal in
 * its art window (Р2 of 2026-10-24) retired. The face is built HERE from the client parliament manifest and handed to
 * `PremiumCard` through `vmOverride` (the one sanctioned entry for a face outside the card manifest — the resolutions'
 * and the MarsBot corporations' precedent):
 *
 *   · the banner carries the party's NAME (`partyNameKey`) under its crest, never a card name;
 *   · the clauses print the party's own render data through the ONE formula renderer — its standing effect, then its
 *     action, each under its label (`charter`); the action's nodes carry the `data-graphic-node` anchors the ACTION
 *     COMMIT's impulse runs over (the combined `mechanics` stays the face's whole formula for every other reader);
 *   · no cost, no tags, no requirement — a party is played by nobody.
 *
 * No fictitious project card is created: `name` is the party's tile KEY (a key, never a CardName in the manifest).
 */
import {CardName} from '@/common/cards/CardName';
import {Color} from '@/common/Color';
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

/**
 * The card face of a party — `undefined` for a party the manifest does not know. `bannerCubes` — the seats whose cube
 * stands on the party's banner (Septem Tribus:redux), handed in by a host that knows the table; absent = none drawn.
 */
export function partyPremiumVm(party: ReduxParty, opts: {bannerCubes?: ReadonlyArray<Color>} = {}): PremiumCardVM | undefined {
  const effect = getPartyEffect(party);
  if (effect === undefined) {
    return undefined;
  }
  const passive = printedRows(effect.passiveRenderData);
  const action = printedRows(effect.actionRenderData);
  const rows = [...passive, ...action];
  const root: ICardRenderRoot = {...(effect.actionRenderData ?? effect.passiveRenderData), is: 'root', rows};
  // THE CLAUSES — each its own mechanics over the SAME row references (never copies): the face prints the standing
  // effect and the action under their own labels, and the commit's `data-graphic-node` tokens still resolve.
  const clause = (part: ICardRenderRoot['rows']) => {
    const clauseRoot: ICardRenderRoot = {...root, rows: part};
    return part.length === 0 ? undefined : buildMechanics(clauseRoot, PARLIAMENT_GRAPHIC);
  };
  return {
    name: `PARTY_${party}` as CardName,
    slug: `party-${party.toLowerCase().replace(/\s+/g, '-')}`,
    type: CardType.ACTIVE,
    theme: 'charter',
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
      charter: {effect: clause(passive), action: clause(action)},
      ...(opts.bannerCubes === undefined || opts.bannerCubes.length === 0 ? {} : {bannerCubes: opts.bannerCubes}),
    },
  };
}
