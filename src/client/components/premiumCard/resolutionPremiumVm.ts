/*
 * PREMIUM FACES FOR THE MARS PARLIAMENT (Turmoil Redux).
 *
 * A resolution is NOT a project card — it lives in the parliament's own deck
 * and never reaches a hand or a tableau — so its face is built HERE from the
 * client parliament manifest (`genfiles/parliament.json`) and handed to
 * `PremiumCard` through `vmOverride` (the one sanctioned entry for a face
 * outside the card manifest — the MarsBot corporations' precedent). The
 * geometry is the shared premium face; only the theme (`resolution`, the
 * violet family), the medallion and the identity differ. No fictitious
 * project card is ever created to represent a resolution or a party.
 *
 * A PARTY EFFECT gets the same treatment: the board's six printed banners
 * render as premium faces too, so the inspector, the info panel and the
 * parliament workspace all show ONE rendering of «the Greens' effect».
 */
import {CardName} from '@/common/cards/CardName';
import {CardType} from '@/common/cards/CardType';
import {IClientPartyEffect, IClientResolution} from '@/common/parliament/IClientResolution';
import {ReduxParty, ResolutionId} from '@/common/parliament/ParliamentTypes';
import {PremiumCardVM} from './premiumCardViewModel';
import {buildMechanics} from './mechanicsModel';
import {tagClusterPlan} from './tagLayout';
import {getPartyEffect, getResolution} from '@/client/parliament/ClientParliamentManifest';
import {partyAccent, partyEmblemUrl} from './partyEmblems';

/** The face's key for a resolution — the catalog id doubles as the slug. */
export function resolutionSlug(id: ResolutionId): string {
  return id.toLowerCase().replaceAll('_', '-');
}

/**
 * The face of a resolution. `name` carries the RESOLUTION ID (the premium face
 * only uses it as a key and a slug — a ResolutionId never collides with a
 * CardName); the type is the parliament's own, so the theme table, the cost
 * rule (no cost badge) and the medallion all fall out of the shared face.
 */
export function resolutionPremiumVm(resolution: IClientResolution): PremiumCardVM {
  return {
    name: resolution.id as CardName,
    slug: resolutionSlug(resolution.id),
    type: CardType.RESOLUTION,
    theme: 'resolution',
    title: resolution.text.name,
    tags: [],
    tagCluster: tagClusterPlan(0),
    requirements: [],
    // No resolution art pack exists yet: the art window carries the PARTY'S SEAL
    // (its emblem over an accent-tinted field — `pcard--resolution-seal`), so the
    // cards of the voting area are told apart at a glance and none of them reads
    // as a dead placeholder. The window's geometry is the shared face's; real
    // art later swaps the url and drops `sealArt`, nothing moves.
    art: {url: partyEmblemUrl(resolution.party), fallback: false},
    mechanics: buildMechanics(resolution.renderData),
    expansion: 'turmoilRedux',
    compatibility: ['turmoilRedux', ...resolution.compatibility],
    parliament: {
      party: resolution.party,
      emblemUrl: partyEmblemUrl(resolution.party),
      quest: resolution.text.quest,
      questRenderData: resolution.questRenderData,
      dummy: resolution.dummy,
      accent: partyAccent(resolution.party),
      sealArt: true,
    },
  };
}

export function resolutionPremiumVmById(id: ResolutionId): PremiumCardVM | undefined {
  const resolution = getResolution(id);
  return resolution === undefined ? undefined : resolutionPremiumVm(resolution);
}

/** The face of a party's printed effect (the board banner as a card). */
export function partyEffectPremiumVm(effect: IClientPartyEffect): PremiumCardVM {
  return {
    name: `PARTY_${effect.party}` as CardName,
    slug: `party-${effect.party.toLowerCase().replaceAll(' ', '-')}`,
    type: CardType.RESOLUTION,
    theme: 'resolution',
    title: effect.party,
    tags: [],
    tagCluster: tagClusterPlan(0),
    requirements: [],
    art: {url: partyEmblemUrl(effect.party), fallback: false},
    mechanics: buildMechanics(mergedPartyRender(effect)),
    expansion: 'turmoilRedux',
    compatibility: ['turmoilRedux'],
    parliament: {
      party: effect.party,
      emblemUrl: partyEmblemUrl(effect.party),
      partyEffect: true,
    },
  };
}

export function partyEffectPremiumVmOf(party: ReduxParty): PremiumCardVM | undefined {
  const effect = getPartyEffect(party);
  return effect === undefined ? undefined : partyEffectPremiumVm(effect);
}

/** The passive rows and the action rows of a party, as ONE render root (the face prints both). */
function mergedPartyRender(effect: IClientPartyEffect) {
  if (effect.actionRenderData === undefined) {
    return effect.passiveRenderData;
  }
  return {
    ...effect.passiveRenderData,
    rows: [...effect.passiveRenderData.rows, ...effect.actionRenderData.rows],
  };
}
