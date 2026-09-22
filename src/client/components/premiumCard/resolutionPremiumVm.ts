/*
 * THE FACE OF A RESOLUTION (Turmoil Redux, the Mars Parliament).
 *
 * A resolution is NOT a project card — it lives in the parliament's own deck
 * and never reaches a hand or a tableau — so its face is built HERE from the
 * client parliament manifest (`genfiles/parliament.json`) and handed to
 * `PremiumCard` through `vmOverride` (the one sanctioned entry for a face
 * outside the card manifest — the MarsBot corporations' precedent). The type
 * is the parliament's own, and `PremiumCard` answers it with the resolution's
 * OWN anatomy (`PremiumResolutionFace` — the bill: a folded page, a vellum
 * band, the author's seal), never the project's. The box (320×460) and the
 * formula renderer are the shared ones. No fictitious project card is ever
 * created to represent a resolution.
 *
 * A PARTY is not a face at all: its printed effect is the party PLAQUE
 * (`ConsolePartyPlaque` / `ConsolePartyFormula`) on every surface.
 */
import {CardName} from '@/common/cards/CardName';
import {CardType} from '@/common/cards/CardType';
import {IClientResolution} from '@/common/parliament/IClientResolution';
import {ResolutionId} from '@/common/parliament/ParliamentTypes';
import {PremiumCardVM} from './premiumCardViewModel';
import {buildMechanics, BuildMechanicsOptions} from './mechanicsModel';
import {tagClusterPlan} from './tagLayout';
import {getResolution} from '@/client/parliament/ClientParliamentManifest';
import {partyAccent, partyEmblemUrl} from './partyEmblems';
import {premiumCardArtForKey} from '@/client/cards/cardArt';

/**
 * How EVERY parliament graphic is read (a resolution's effect, a chairman
 * quest, a party's formula): nothing here is ever «played», so no surface
 * draws the project card's «при розыгрыше» rail over it.
 */
export const PARLIAMENT_GRAPHIC: BuildMechanicsOptions = {noPlayZone: true};

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
  // THE ART is keyed by the printed CODE through the one card-art pipeline
  // (`assets/card-images/RX01.webp`, indexed by `make:cards`): a resolution
  // with an illustration heads its page with it, whole (the pack is authored
  // 3:2 and the window IS 3:2 — `pcard--resolution-art`); one without (a
  // never-dealt dev example) carries the PARTY'S SEAL over its accent field
  // instead (`pcard--resolution-seal`) — never the project fallback.
  const art = premiumCardArtForKey(resolution.code);
  return {
    name: resolution.id as CardName,
    slug: resolutionSlug(resolution.id),
    type: CardType.RESOLUTION,
    theme: 'resolution',
    title: resolution.text.name,
    code: resolution.code,
    tags: [],
    tagCluster: tagClusterPlan(0),
    requirements: [],
    art: art ?? {url: partyEmblemUrl(resolution.party), fallback: false},
    mechanics: buildMechanics(resolution.renderData, PARLIAMENT_GRAPHIC),
    expansion: 'turmoilRedux',
    compatibility: ['turmoilRedux', ...resolution.compatibility],
    parliament: {
      party: resolution.party,
      emblemUrl: partyEmblemUrl(resolution.party),
      quest: resolution.text.quest,
      questRenderData: resolution.questRenderData,
      accent: partyAccent(resolution.party),
      sealArt: art === undefined,
    },
  };
}

export function resolutionPremiumVmById(id: ResolutionId): PremiumCardVM | undefined {
  const resolution = getResolution(id);
  return resolution === undefined ? undefined : resolutionPremiumVm(resolution);
}
