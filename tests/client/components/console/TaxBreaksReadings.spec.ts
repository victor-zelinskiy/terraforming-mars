import {expect} from 'chai';
import {Color} from '@/common/Color';
import {CardName} from '@/common/cards/CardName';
import {CardResource} from '@/common/CardResource';
import {Resource} from '@/common/Resource';
import {PartyName} from '@/common/turmoil/PartyName';
import {CardRenderItemType} from '@/common/cards/render/CardRenderItemType';
import {AltSecondaryTag} from '@/common/cards/render/AltSecondaryTag';
import {ICardRenderItem} from '@/common/cards/render/Types';
import {ParliamentEnactOutcomeModel, ParliamentModel, ParliamentPlayerModel} from '@/common/models/ParliamentModel';
import {ResolutionCountByCard} from '@/common/parliament/resolutionCounts';
import {yieldAtCap} from '@/common/parliament/influenceScaling';
import {
  countedHolderKinds, enactedYieldsOf, voteYieldsOf, yieldCountPresentation, yieldCountsKinds, yieldIconClasses, yieldIconOf,
} from '@/client/console/parliament/influenceYieldModel';
import {familyOf} from '@/client/console/parliament/resolutionFamily';
import {resultsPayoutPart} from '@/client/console/parliament/parliamentResultsModel';
import {resolutionAnnotations} from '@/client/console/parliament/parliamentAnnotations';
import {holdersReadingOf, kindsReadingOf} from '@/client/console/parliament/voteInfoModel';
import {mechItemIcon} from '@/client/components/premiumCard/premiumCardIcons';
import {getResolution} from '@/client/parliament/ClientParliamentManifest';

/**
 * TAX BREAKS (Turmoil Redux, RX41) — THE READINGS of a count BY KIND. The card writes no reading of its own; pinned
 * here: the count draws as the holder glyph with the face's one «?» (never RX40's three cubes), the vote reads the
 * KINDS with the cards under each (never RX40's «Fish 2 → 3» — nothing lands on them), the cap reads «6 → 5 MAX»,
 * the inspector names the kinds in words, another seat reads its own kinds, the results print the production, and
 * RX40's readings did not move.
 */
const TAX_ID = 'RDX_INDUSTRIALISTS_TAX_BREAKS';
const SPONSORED_ID = 'RDX_SCIENTISTS_SPONSORED_PROJECTS';
const BLUE = 'blue' as Color;
const RED = 'red' as Color;

function law(id: string) {
  const resolution = getResolution(id);
  if (resolution === undefined) {
    throw new Error(`${id} is not in the client manifest`);
  }
  return resolution;
}

/** The server's count by card, as the engine reads it (Pets at 0 is not in it — «already has»). */
const FOUR: ReadonlyArray<ResolutionCountByCard> = [
  {card: CardName.FISH, resource: CardResource.ANIMAL, count: 2},
  {card: CardName.BIRDS, resource: CardResource.ANIMAL, count: 1},
  {card: CardName.DIRIGIBLES, resource: CardResource.FLOATER, count: 1},
  {card: CardName.SUPERCOMPUTER, resource: CardResource.DATA, count: 3},
];

function kindsOf(byCard: ReadonlyArray<ResolutionCountByCard>): number {
  return new Set(byCard.map((e) => e.resource)).size;
}

function seat(color: Color, agenda: number, influence: number, byCard: ReadonlyArray<ResolutionCountByCard> = FOUR): ParliamentPlayerModel {
  return {
    color, participates: true, enactment: true, seatGrant: true, lobby: true, reserve: 6, onResolutions: 0, chairman: false, agenda, influence,
    access: [], partyActionUses: {}, resolutionActionUses: 0,
    counts: [
      {id: 'cardResourceTypes', count: kindsOf(byCard), cards: byCard.map((e) => e.card), byCard: [...byCard]},
      {id: 'cardsWithResources', count: byCard.length, cards: byCard.map((e) => e.card), byCard: [...byCard]},
    ],
  };
}

function upForVote(id: string, players: Array<ParliamentPlayerModel>): ParliamentModel {
  return {
    slots: [{instance: `${id}#0`, resolution: id, party: PartyName.INDUSTRIALISTS, votes: []} as never],
    rulingParty: PartyName.GREENS, popularSupport: {}, players, deckSize: 4, discardSize: 0, neutralSupply: 14, botMode: 'none',
  } as ParliamentModel;
}

function productionRecord(player: Color, amount: number, influence: number, byCard: ReadonlyArray<ResolutionCountByCard>, uncapped: number): ParliamentEnactOutcomeModel {
  return {
    player, step: 'production', part: 'effect', kind: 'production', effect: 'production', production: Resource.MEGACREDITS, influence,
    amount, count: kindsOf(byCard), counted: byCard.map((e) => e.card), countedByCard: [...byCard], uncapped, before: 2, after: 2 + amount,
  } as ParliamentEnactOutcomeModel;
}

describe('Tax Breaks — the readings of a count by KIND', () => {
  it('the shipped manifest: a production part by the count of types + influence, max 5 — the counted-holders family', () => {
    const taxBreaks = law(TAX_ID);
    expect(taxBreaks.code).eq('RX41');
    const production = (taxBreaks.scaled ?? [])[0];
    expect(production.unit).deep.eq({kind: 'production', resource: Resource.MEGACREDITS});
    expect(production.count).deep.eq({id: 'cardResourceTypes', per: 1});
    expect(production.cap).eq(5);
    expect(familyOf(taxBreaks)).eq('counted-holders');
    expect(yieldCountsKinds(production)).is.true;
    expect(yieldCountPresentation('cardResourceTypes')).deep.eq({
      glyph: {kind: 'resource-card', wild: true},
      pluralKey: '${0} resource type(s)',
      ruleKey: 'Each different type of resource on your cards counts once, your corporation included: two animal cards are one type. A card that can hold resources but has none yet adds no type.',
      skipReasonKey: 'No resources on your cards and no influence',
    });
    // The unit is the ordinary M€ production plate — the count's glyph is the only new drawing.
    expect(yieldIconClasses(yieldIconOf(production))[0]).includes('con-iyield__unit--prod');
  });

  it('the face: the holder carries the printed «?» (the wild square) — RX40\'s holder keeps its three cubes', () => {
    const item = {type: CardRenderItemType.RESOURCE_CARD, amount: 1, secondaryTag: AltSecondaryTag.WILD_RESOURCE} as ICardRenderItem;
    expect(mechItemIcon(item)).deep.eq({kind: 'resourceCard', wild: true});
    expect(mechItemIcon({type: CardRenderItemType.RESOURCE_CARD, amount: 1} as ICardRenderItem)).deep.eq({kind: 'resourceCard'});
    expect(JSON.stringify(law(TAX_ID).renderData)).includes(`"secondaryTag":"${AltSecondaryTag.WILD_RESOURCE}"`);
    expect(JSON.stringify(law(SPONSORED_ID).renderData)).not.includes(`"secondaryTag":"${AltSecondaryTag.WILD_RESOURCE}"`);
  });

  it('the vote: 3 types + influence 3 = 6 → +5 MAX; the KINDS with their cards under each — never «2 → 3»', () => {
    const table = upForVote(TAX_ID, [seat(BLUE, 5, 3), seat(RED, 0, 0, [{card: CardName.TARDIGRADES, resource: CardResource.MICROBE, count: 2}])]);
    const yields = voteYieldsOf(law(TAX_ID), table, BLUE);
    const estimate = yields.find((y) => y.context === 'estimate')!;
    expect(estimate).deep.include({amount: 5, count: 3, influence: 3, uncapped: 6});
    expect(yieldAtCap(estimate), 'the cap is part of the number').is.true;
    expect(countedHolderKinds(estimate).map((k) => [k.resource, k.cards.map((c) => c.card)])).deep.eq([
      [CardResource.ANIMAL, [CardName.FISH, CardName.BIRDS]],
      [CardResource.FLOATER, [CardName.DIRIGIBLES]],
      [CardResource.DATA, [CardName.SUPERCOMPUTER]],
    ]);
    expect(kindsReadingOf(yields)).deep.eq({
      rows: [
        {resource: CardResource.ANIMAL, cards: [CardName.FISH, CardName.BIRDS]},
        {resource: CardResource.FLOATER, cards: [CardName.DIRIGIBLES]},
        {resource: CardResource.DATA, cards: [CardName.SUPERCOMPUTER]},
      ],
      totalKey: '${0} resource type(s)',
    });
    expect(holdersReadingOf(yields), 'a count by kind feeds no card — no holders\' line').is.undefined;
    // Another seat's column reads ITS OWN kinds.
    const red = voteYieldsOf(law(TAX_ID), table, RED);
    expect(red.find((y) => y.context === 'estimate')).deep.include({count: 1, amount: 1});
    expect(kindsReadingOf(red)?.rows).deep.eq([{resource: CardResource.MICROBE, cards: [CardName.TARDIGRADES]}]);
  });

  it('a seat holding nothing reads no kinds line — the count\'s own zero names it', () => {
    const table = upForVote(TAX_ID, [seat(BLUE, 0, 0, []), seat(RED, 0, 0, [])]);
    const yields = voteYieldsOf(law(TAX_ID), table, BLUE);
    expect(yields.find((y) => y.context === 'estimate')).deep.include({amount: 0, count: 0});
    expect(kindsReadingOf(yields)).is.undefined;
  });

  it('the inspector («ДЛЯ ВАС»): the kinds in words with their cards; no «→» of a payout that lands nowhere', () => {
    const table = upForVote(TAX_ID, [seat(BLUE, 5, 3), seat(RED, 0, 0, [])]);
    const forYou = resolutionAnnotations(TAX_ID, voteYieldsOf(law(TAX_ID), table, BLUE)).find((block) => block.id === 'group:you');
    const text = JSON.stringify(forYou);
    expect(text).includes('Counted right now: ${0}');
    expect(text).includes(`${CardName.FISH}, ${CardName.BIRDS}`);
    expect(text).not.includes(`${CardName.FISH} 2 → 3`);
    // Recorded: the enactment's own words, frozen.
    const enacted = {
      ...table, enacted: {instance: `${TAX_ID}#0`, resolution: TAX_ID, party: PartyName.INDUSTRIALISTS},
      lastPhase: {outcomes: [productionRecord(BLUE, 5, 3, FOUR, 6)]},
    } as unknown as ParliamentModel;
    const applied = enactedYieldsOf(law(TAX_ID), enacted, BLUE);
    expect(applied.find((y) => y.context === 'applied')).deep.include({amount: 5, count: 3, uncapped: 6});
    const recorded = JSON.stringify(resolutionAnnotations(TAX_ID, applied).find((block) => block.id === 'group:you'));
    expect(recorded).includes('Counted at the enactment: ${0}');
    expect(recorded).includes(`${CardName.FISH}, ${CardName.BIRDS}`);
  });

  it('the results: «+5 M€ production» from the record — the kinds ride it for the inspector', () => {
    const part = resultsPayoutPart(productionRecord(BLUE, 5, 3, FOUR, 6), 0);
    expect(part).deep.include({kind: 'production', amount: 5, production: true});
    expect(part.eachCard, 'a production is no card payout').is.undefined;
  });

  it('RX40 did not move: its count is by card, its line is the holders\' «2 → 3», no kinds line', () => {
    const sponsored = law(SPONSORED_ID);
    const resources = (sponsored.scaled ?? []).find((e) => e.id === 'resources')!;
    expect(yieldCountsKinds(resources)).is.false;
    expect(familyOf(sponsored)).eq('each-card');
    expect(yieldCountPresentation('cardsWithResources').glyph).deep.eq({kind: 'resource-card'});
    const table = upForVote(SPONSORED_ID, [seat(BLUE, 3, 2), seat(RED, 0, 0, [])]);
    const yields = voteYieldsOf(sponsored, table, BLUE);
    expect(kindsReadingOf(yields)).is.undefined;
    expect(holdersReadingOf(yields)?.rows.map((r) => [r.card, r.before, r.after])).deep.eq([
      [CardName.FISH, 2, 3], [CardName.BIRDS, 1, 2], [CardName.DIRIGIBLES, 1, 2], [CardName.SUPERCOMPUTER, 3, 4],
    ]);
  });
});
