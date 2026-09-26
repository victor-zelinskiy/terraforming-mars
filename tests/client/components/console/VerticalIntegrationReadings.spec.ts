import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import {Color} from '@/common/Color';
import {CardName} from '@/common/cards/CardName';
import {CardType} from '@/common/cards/CardType';
import {PartyName} from '@/common/turmoil/PartyName';
import {Resource} from '@/common/Resource';
import {Tag} from '@/common/cards/Tag';
import {
  ParliamentEnactedModel, ParliamentEnactOutcomeModel, ParliamentModel, ParliamentPhaseSummaryModel, ParliamentPlayerModel,
} from '@/common/models/ParliamentModel';
import PremiumCountGlyph from '@/client/components/premiumCard/PremiumCountGlyph.vue';
import {
  enactedYieldsOf, voteLevyOf, voteYieldsOf, yieldCaptionOf, yieldCountPresentation, yieldIconOf, yieldInfluenceEnters, yieldIsFlat,
} from '@/client/console/parliament/influenceYieldModel';
import {voteReadingOf} from '@/client/console/parliament/voteInfoModel';
import {voteLedgerOf, ledgerPartText} from '@/client/console/parliament/voteLedgerModel';
import {familyOf} from '@/client/console/parliament/resolutionFamily';
import {getResolution} from '@/client/parliament/ClientParliamentManifest';

/**
 * VERTICAL INTEGRATION (Turmoil Redux, RX32) — THE READINGS OF A COUNT BY TYPE.
 *
 * The card writes no reading of its own: its formula is Scientists Budget's
 * (RX27) with another count id. What is pinned here is the ONE place the new
 * count had to be told about — how the counted object is DRAWN and NAMED:
 *  · the glyph is the CARD wearing its type's blue band (the face's own
 *    `b.cards(n, {secondaryTag: BLUE})`), never Architecture Award's VP card
 *    (which demands a tag and a plate this rule never asks for) and never a
 *    tag medallion (which would state a rule about tags);
 *  · the rule sentence says out loud what the TYPE rules out, because «blue»
 *    is the one word the engine's own counters read as «blue or green»;
 *  · one card is one unit — the reading lists NAMES and no «×n» column;
 *  · the LEDGER OF OUTCOMES counts a rival by THEIR cards and THEIR influence,
 *    the one place where the viewer's own count would not fail, only lie.
 */
const LAW_ID = 'RDX_INDUSTRIALISTS_VERTICAL_INTEGRATION';
const BLUE = 'blue' as Color;
const RED = 'red' as Color;

const law = () => {
  const resolution = getResolution(LAW_ID);
  if (resolution === undefined) {
    throw new Error(`${LAW_ID} is not in the client manifest`);
  }
  return resolution;
};

/** A seat of the table: the blue-card count the server carries for it, and its influence. */
function seat(color: Color, agenda: number, influence: number, count: number): ParliamentPlayerModel {
  return {
    color, participates: true, lobby: true, reserve: 6, onResolutions: 0, chairman: false, agenda, influence,
    access: [], partyActionUses: {}, resolutionActionUses: 0,
    counts: [{
      id: 'blueCards', count,
      cards: [CardName.AI_CENTRAL, CardName.MEDIA_GROUP, CardName.SEARCH_FOR_LIFE].slice(0, count),
    }],
  };
}

function model(players: Array<ParliamentPlayerModel>, over: Partial<ParliamentModel> = {}): ParliamentModel {
  return {slots: [], rulingParty: PartyName.INDUSTRIALISTS, popularSupport: {}, players, deckSize: 4, discardSize: 0, neutralSupply: 14, botMode: 'none', ...over};
}

const ENACTED: ParliamentEnactedModel = {instance: `${LAW_ID}#0`, resolution: LAW_ID, party: PartyName.INDUSTRIALISTS};

function phase(outcomes: ReadonlyArray<ParliamentEnactOutcomeModel>): ParliamentPhaseSummaryModel {
  return {
    generation: 3, final: false,
    winner: {instance: ENACTED.instance, resolution: LAW_ID, party: PartyName.INDUSTRIALISTS, votes: 2},
    outcomes: [...outcomes], support: [], enacted: ENACTED, refreshed: [], lobbyRefilled: [],
  };
}

/** The server's own record for one seat: two blue cards and influence 3. */
const PAYOUT: ParliamentEnactOutcomeModel = {
  player: BLUE, step: 'megacredits', part: 'effect', effect: 'megacredits', kind: 'stock', stock: Resource.MEGACREDITS,
  amount: 5, influence: 3, count: 2, counted: [CardName.AI_CENTRAL, CardName.MEDIA_GROUP], before: 30, after: 35,
};

describe('Vertical Integration — the readings of a count by card type', () => {
  it('the shipped manifest declares RX27\'s formula over the blue-card count — no levy, no cap, one part', () => {
    const resolution = law();
    expect(resolution.code).eq('RX32');
    expect(resolution.party).eq(PartyName.INDUSTRIALISTS);
    expect(resolution.levy, 'nothing is paid for it').is.undefined;
    const [money, ...rest] = resolution.scaled ?? [];
    expect(rest, 'one part and no other').is.empty;
    expect(money).deep.eq({
      id: 'megacredits', unit: {kind: 'stock', resource: Resource.MEGACREDITS}, perInfluence: 1,
      count: {id: 'blueCards', per: 1}, recipient: 'each',
    });
    expect(yieldIconOf(money)).deep.eq({family: 'resource', resource: Resource.MEGACREDITS, production: false});
    expect(yieldIsFlat(money), 'a counted part is not «the same for every player»').is.false;
    expect(yieldInfluenceEnters(money), 'the card prints «+ [influence]» beside the rate').is.true;
    expect(money.cap, 'no maximum is printed').is.undefined;
    expect(resolution.quest).deep.eq({goal: {kind: 'cardsPlayed', cardType: 'active'}, count: 2});
    expect(familyOf(resolution), 'a CARDS count — Architecture Award\'s family').eq('counted');
  });

  it('the counted object is the CARD WITH ITS BLUE BAND — not the VP card of RX02, not a tag medallion', () => {
    expect(yieldCountPresentation('blueCards')).deep.eq({
      glyph: {kind: 'type-card', cardType: CardType.ACTIVE},
      pluralKey: '${0} blue card(s)',
      ruleKey: 'Each blue (active) project card in play counts once, whatever it prints. Green cards, events, preludes, CEOs and your corporation do not count.',
      skipReasonKey: 'No blue cards and no influence',
    });
    // The other CARDS count of the catalog keeps its own drawing and its own sentence.
    expect(yieldCountPresentation('buildingCardsWithNonNegativeVp').glyph).deep.eq({kind: 'vp-card', tag: Tag.BUILDING});
    // …and the tag counts keep theirs — a card of a TYPE is none of them.
    expect(yieldCountPresentation('scienceTags').glyph).deep.eq({kind: 'tag', tag: Tag.SCIENCE});
  });

  it('the glyph draws the face\'s OWN card cover and the face\'s OWN band class — one blue card everywhere', () => {
    const wrapper = mount(PremiumCountGlyph, {props: {glyph: {kind: 'type-card', cardType: CardType.ACTIVE}}});
    const box = wrapper.find('[data-count-card-type]');
    expect(box.exists()).is.true;
    expect(box.attributes('data-count-card-type')).eq(CardType.ACTIVE);
    const card = wrapper.find('.pcglyph__card');
    expect(card.classes(), 'the band modifier the mechanics renderer puts on the same cover').includes('pcard-ic--type-blue');
    expect(card.attributes('style')).includes('card.webp');
    // The green band is the same drawing with the other modifier — never a second asset.
    const green = mount(PremiumCountGlyph, {props: {glyph: {kind: 'type-card', cardType: CardType.AUTOMATED}}});
    expect(green.find('.pcglyph__card').classes()).includes('pcard-ic--type-green');
  });

  it('the vote reading: «2 blue cards + influence 2 → +4 M€», with the cards that made the count and no «×n» column', () => {
    const resolution = law();
    const m = model([seat(BLUE, 4, 2, 2)]);
    const yields = voteYieldsOf(resolution, m, BLUE);
    expect(yields.map((y) => `${y.effect.id}:${y.context}`)).deep.eq(['megacredits:estimate', 'megacredits:forecast']);
    expect(yields[0]).deep.include({count: 2, amount: 4, influence: 2});
    expect(yields[0].counted).deep.eq([CardName.AI_CENTRAL, CardName.MEDIA_GROUP]);
    expect(yields[0].countedUnits, 'a card has no second blueness to weigh').is.undefined;
    expect(yieldCaptionOf(yields[0]), 'a counted term is preliminary and says so').deep.eq({key: 'If enacted now'});
    // Winning takes the marker one Agenda step first, and only the influence term moves with it.
    expect(yields[1]).deep.include({count: 2, influence: 3, amount: 5, agendaStep: 5});
    expect(voteLevyOf(resolution, m, BLUE), 'no levy, so no net line to state').is.undefined;
  });

  it('a seat with no blue card is still paid by its influence; both at zero is the ONE named skip', () => {
    const resolution = law();
    const influenceOnly = voteYieldsOf(resolution, model([seat(BLUE, 4, 2, 0)]), BLUE);
    expect(influenceOnly[0]).deep.include({count: 0, amount: 2, influence: 2});
    const nothing = voteYieldsOf(resolution, model([seat(BLUE, 0, 0, 0)]), BLUE);
    expect(nothing[0]).deep.include({count: 0, amount: 0, influence: 0});
    expect(yieldCountPresentation('blueCards').skipReasonKey, 'the server\'s own words for it')
      .eq('No blue cards and no influence');
  });

  it('an ENACTED law reads the RECORD — the frozen count and the cards behind it — never today\'s tableau', () => {
    const resolution = law();
    // Today the seat has grown to five blue cards and influence 5; the reading is the record.
    const m = model([seat(BLUE, 8, 5, 3)], {enacted: ENACTED, lastPhase: phase([PAYOUT])});
    const [paid] = enactedYieldsOf(resolution, m, BLUE);
    expect(paid).deep.include({context: 'applied', amount: 5, count: 2, influence: 3});
    expect(paid.counted).deep.eq([CardName.AI_CENTRAL, CardName.MEDIA_GROUP]);
    expect(paid.countedUnits).is.undefined;
    expect(yieldCaptionOf(paid)).deep.eq({key: 'Received'});

    const skipped = model([seat(BLUE, 0, 0, 0)], {enacted: ENACTED, lastPhase: phase([
      {...PAYOUT, kind: 'skipped', amount: 0, count: 0, counted: [], influence: 0,
        reason: 'No blue cards and no influence', before: undefined, after: undefined},
    ])});
    const [none] = enactedYieldsOf(resolution, skipped, BLUE);
    expect(none).deep.include({context: 'applied', amount: 0, skipped: 'No blue cards and no influence'});
    expect(yieldCaptionOf(none)).deep.eq({key: 'No blue cards and no influence'});
  });

  it('THE LEDGER OF OUTCOMES counts a RIVAL by THEIR blue cards and THEIR influence — never the viewer\'s', () => {
    const resolution = law();
    // The viewer has one blue card and influence 1; the rival has three and influence 3.
    const m = model([seat(BLUE, 1, 1, 1), seat(RED, 5, 3, 3)]);
    const chips = voteLedgerOf({resolution, model: m, viewer: BLUE, players: [{color: BLUE, tableau: []}, {color: RED, tableau: []}]});
    expect(chips.map((c) => c.color), 'the viewer first, then the model\'s own order').deep.eq([BLUE, RED]);
    expect(chips[0].you).is.true;
    expect(chips[0].parts.map((p) => `${p.key}:${ledgerPartText(p)}`)).deep.eq(['megacredits:+2']);
    expect(chips[1].you).is.false;
    expect(chips[1].parts.map((p) => `${p.key}:${ledgerPartText(p)}`), 'the rival\'s own count and own influence').deep.eq(['megacredits:+6']);
    // …and the viewer's own big reading is unchanged by the row beside it.
    expect(voteYieldsOf(resolution, m, BLUE)[0]).deep.include({count: 1, amount: 2});
  });

  it('the vote panel reads the seat\'s number, and the formula alone for one outside the table', () => {
    const resolution = law();
    const m = model([seat(BLUE, 4, 2, 2)]);
    const reading = voteReadingOf(resolution, m, BLUE, []);
    expect(reading?.yields.map((y) => y.effect.id)).includes('megacredits');
    const stranger = voteReadingOf(resolution, m, RED, []);
    expect((stranger?.yields ?? []).every((y) => y.context === 'reference'), 'a seat outside the table reads the formula alone').is.true;
  });
});
