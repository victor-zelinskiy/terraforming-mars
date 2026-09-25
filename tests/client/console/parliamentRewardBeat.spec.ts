import {expect} from 'chai';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {ParliamentEnactOutcomeModel} from '@/common/models/ParliamentModel';
import {OUTCOME_KINDS, OutcomeKind, REWARD_ADDRESS} from '@/common/parliament/rewardAddress';
import {PartyName} from '@/common/turmoil/PartyName';
import {Resource} from '@/common/Resource';
import {CardResource} from '@/common/CardResource';
import {CardName} from '@/common/cards/CardName';
import {ColonyName} from '@/common/colonies/ColonyName';
import {consoleParliamentUi, resetConsoleParliamentUi} from '@/client/console/parliament/consoleParliamentFlow';
import {
  clearPanelRewardHold, heldProduction, heldStock, panelRewardHold,
} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import {activeAnimationHoldLabels, isAnimationHoldActive} from '@/client/components/presentation/animationHold';
import {
  detectAgendaBonus, detectNewViewerRewards, flushParliamentRewards, markAgendaBonusLanded, markRewardLanded, parliamentParksReveal,
  parliamentRewardDiag, parliamentRewardPending, parliamentRewardState, RATING_RAIL_KEY, releaseParliamentRewards, resetParliamentRewards,
  rewardBeatKey, rewardLanded, seedParliamentRewardHold, sittingKeyOf, takeAgendaBonus, takeOwedRewards, waveSpecOf,
} from '@/client/console/parliament/parliamentRewardBeat';

/*
 * THE REWARD BEAT'S LEDGER (Turmoil Redux, Э5 → v2): DETECT is pure against
 * two views, SEED holds the rail only while the sitting stands, OWE / FLY hand
 * the records to the director one touchdown at a time, and every path ends
 * with the counters released — a reward is never withheld, only shown. v2:
 * NO WALL CLOCK decides a tick — a hold ends by its touchdown, by a named end
 * of the stage, or by the hold registry's own ceiling.
 */
const BLUE = 'blue';
const RED = 'red';

function outcome(over: Partial<ParliamentEnactOutcomeModel> & {kind: ParliamentEnactOutcomeModel['kind']}): ParliamentEnactOutcomeModel {
  return {player: BLUE, step: 'grant', part: 'effect', ...over} as ParliamentEnactOutcomeModel;
}

function view(phase: {generation: number, seq?: number, outcomes?: Array<ParliamentEnactOutcomeModel>, agenda?: {player: string, from: number, to: number, bonus?: 'tr' | 'card'}} | undefined, viewer = BLUE): PlayerViewModel {
  return {
    thisPlayer: {color: viewer},
    game: {
      parliament: phase === undefined ? {} : {
        phase: {
          generation: phase.generation, final: false, step: 'effects', outcomes: phase.outcomes ?? [],
          summary: {generation: phase.generation, seq: phase.seq, agenda: phase.agenda, support: [], refreshed: [], lobbyRefilled: [], outcomes: phase.outcomes ?? []},
        },
      },
    },
  } as unknown as PlayerViewModel;
}

describe('parliamentRewardBeat — the ledger of what the sitting still owes', () => {
  beforeEach(() => {
    resetParliamentRewards();
    clearPanelRewardHold();
    resetConsoleParliamentUi();
  });
  after(() => {
    resetParliamentRewards();
    clearPanelRewardHold();
    resetConsoleParliamentUi();
  });

  it('a record\'s key is structural: seat · step · part · kind (a reaction shares its cause\'s step)', () => {
    expect(rewardBeatKey(outcome({kind: 'production', step: 'heat-production'}))).eq('blue:heat-production:effect:production');
    expect(rewardBeatKey(outcome({kind: 'reaction', step: 'heat-production', part: undefined}))).eq('blue:heat-production::reaction');
  });

  it('the rail chip of a record: production / stock on their rows, a reaction on the row of what it paid; nothing for the other kinds or a zero', () => {
    expect(waveSpecOf(outcome({kind: 'production', production: Resource.HEAT, amount: 2}))).deep.eq({channel: 'production', resource: 'heat', amount: 2});
    expect(waveSpecOf(outcome({kind: 'stock', stock: Resource.PLANTS, amount: 4}))).deep.eq({channel: 'stock', resource: 'plants', amount: 4});
    expect(waveSpecOf(outcome({kind: 'reaction', party: PartyName.GREENS, production: Resource.MEGACREDITS, amount: 2}))).deep.eq({channel: 'production', resource: 'megacredits', amount: 2});
    expect(waveSpecOf(outcome({kind: 'reaction', party: PartyName.GREENS, stock: Resource.MEGACREDITS, amount: 2}))).deep.eq({channel: 'stock', resource: 'megacredits', amount: 2});
    expect(waveSpecOf(outcome({kind: 'production', production: Resource.HEAT, amount: 0}))).is.undefined;
    expect(waveSpecOf(outcome({kind: 'cards', amount: 2}))).is.undefined;
    expect(waveSpecOf(outcome({kind: 'cardResource', resource: CardResource.ANIMAL, amount: 2}))).is.undefined;
    expect(waveSpecOf(outcome({kind: 'skipped', reason: 'No influence', amount: 2}))).is.undefined;
  });

  it('a LOSS (a levy: a negative stock / production record) flies its row BACKWARDS — the size as the amount, `direction: loss`; a reaction never flies a loss', () => {
    expect(waveSpecOf(outcome({kind: 'stock', stock: Resource.MEGACREDITS, amount: -10, owed: 10}))).deep.eq({channel: 'stock', resource: 'megacredits', amount: 10, direction: 'loss'});
    expect(waveSpecOf(outcome({kind: 'stock', stock: Resource.MEGACREDITS, amount: -4, owed: 10}))).deep.eq({channel: 'stock', resource: 'megacredits', amount: 4, direction: 'loss'});
    expect(waveSpecOf(outcome({kind: 'production', production: Resource.ENERGY, amount: -1}))).deep.eq({channel: 'production', resource: 'energy', amount: 1, direction: 'loss'});
    expect(waveSpecOf(outcome({kind: 'reaction', party: PartyName.GREENS, stock: Resource.MEGACREDITS, amount: -2}))).is.undefined;
    // A gain carries no direction at all (the ordinary language, unchanged).
    expect(waveSpecOf(outcome({kind: 'stock', stock: Resource.MEGACREDITS, amount: 7}))?.direction).is.undefined;
    // DETECT owes the loss like any rail record — with the address walked backwards.
    const before = view({generation: 3, outcomes: []});
    const after = view({generation: 3, outcomes: [outcome({kind: 'stock', step: 'levy', stock: Resource.MEGACREDITS, amount: -10, owed: 10})]});
    const owed = detectNewViewerRewards(before, after);
    expect(owed.map((r) => r.key)).deep.eq(['blue:levy:effect:stock']);
    expect(owed[0].delivery.direction).eq('loss');
    expect(owed[0].delivery.source, 'the address\'s source is where the loss LANDS').eq('card-icon');
    expect(owed[0].spec).deep.eq({channel: 'stock', resource: 'megacredits', amount: 10, direction: 'loss'});
  });

  it('the wave and the ADDRESS agree: exactly the kinds addressed to the rail fly a rail chip, on the address\'s own unit', () => {
    const sample: Record<OutcomeKind, ParliamentEnactOutcomeModel> = {
      production: outcome({kind: 'production', production: Resource.HEAT, amount: 2}),
      stock: outcome({kind: 'stock', stock: Resource.PLANTS, amount: 3}),
      reaction: outcome({kind: 'reaction', production: Resource.MEGACREDITS, amount: 2, party: PartyName.GREENS}),
      cardResource: outcome({kind: 'cardResource', resource: CardResource.ANIMAL, amount: 2, card: CardName.BIRDS}),
      cards: outcome({kind: 'cards', amount: 2, drawn: 2}),
      ocean: outcome({kind: 'ocean', parameter: {id: 'oceans', before: 0, after: 1}}),
      greenery: outcome({kind: 'greenery'}),
      skipped: outcome({kind: 'skipped', reason: 'no-influence'}),
      // Colonial Affairs' two kinds: a discard rides the hand (the discard scene's own flight), a HUD-side
      // colony bonus commits through its own counter — neither flies a rail chip.
      discard: outcome({kind: 'discard', amount: 1, card: CardName.BIRDS, colony: 'Pluto' as never}),
      colonyBonus: outcome({kind: 'colonyBonus', amount: 2, colony: 'Iapetus' as never, description: 'Pay 1 M€ less for cards this generation'}),
      // Colony Contest's winner colony: built on the colonies screen (the sitting's own step) — no rail chip either.
      colony: outcome({kind: 'colony', colony: 'Luna' as never}),
      // Skyscrapers' city tier: the board scene builds the stack — no rail chip.
      city: outcome({kind: 'city', space: '05' as never, stackHeight: 2}),
      // Gas Export's WORLD move: the board's scale, no seat, no rail chip.
      globalParameter: {step: 'oxygen', part: 'world', kind: 'globalParameter', amount: -1, parameter: {id: 'oxygen', before: 5, after: 4}, unrewarded: true},
    };
    for (const kind of OUTCOME_KINDS) {
      const spec = waveSpecOf(sample[kind]);
      const address = REWARD_ADDRESS[kind];
      if (address.surface === 'rail') {
        expect(spec, `${kind} is addressed to the rail — it flies`).is.not.undefined;
        // The party's answer speaks the unit its RECORD carries (Greens answer a production step with production);
        // the table's row is the nominal default. A production / stock record IS its address's unit.
        const recorded = sample[kind].production !== undefined ? 'production' : 'stock';
        expect(spec?.channel, `${kind} flies on its unit`).eq(kind === 'reaction' ? recorded : address.unit);
      } else {
        expect(spec, `${kind} is addressed to ${address.surface} — nothing flies to the rail`).is.undefined;
      }
    }
  });

  it('DETECT: the viewer\'s NEW rail records of this response — never another seat\'s, never a record already known, never across a generation or from a first view', () => {
    const before = view({generation: 3, outcomes: [outcome({kind: 'production', production: Resource.HEAT, amount: 2, step: 'a'})]});
    const after = view({generation: 3, outcomes: [
      outcome({kind: 'production', production: Resource.HEAT, amount: 2, step: 'a'}),
      outcome({kind: 'reaction', party: PartyName.GREENS, production: Resource.MEGACREDITS, amount: 2, step: 'a', part: undefined}),
      outcome({kind: 'stock', stock: Resource.PLANTS, amount: 4, step: 'b'}),
      outcome({kind: 'cards', amount: 2, step: 'c'}),
      outcome({kind: 'stock', stock: Resource.PLANTS, amount: 6, step: 'b', player: RED}),
    ]});
    const fresh = detectNewViewerRewards(before, after);
    expect(fresh.map((r) => r.key)).deep.eq(['blue:a::reaction', 'blue:b:effect:stock']);
    expect(fresh[0].delivery.address.source).eq('party-plaque');
    expect(fresh[1].delivery.address.source).eq('card-icon');
    expect(detectNewViewerRewards(undefined, after), 'a first view (a reload) replays nothing').deep.eq([]);
    expect(detectNewViewerRewards(view({generation: 2}), after), 'a new generation is a new sitting — nothing to replay').deep.eq([]);
  });

  /* Colonial Affairs (RX07): a rail record that names its COLONY is owed like any other — and its flight
   * leaves the LEDGER ROW of that tile (the bonus cell the player read the amount in), never the card's icon;
   * a Pluto pair (a draw, a discard) and a HUD-side bonus (a loss) fly no rail chip and are never owed. */
  it('DETECT: a colony-tagged rail record is owed with the ledger row as its flight source; the pairs and the HUD-side bonuses are not', () => {
    const before = view({generation: 3, outcomes: []});
    const after = view({generation: 3, outcomes: [
      outcome({kind: 'stock', stock: Resource.MEGACREDITS, amount: 6, step: 'colony:Luna', colony: ColonyName.LUNA, multiplier: 3}),
      outcome({kind: 'production', production: Resource.ENERGY, amount: 3, step: 'colony:Europa', colony: ColonyName.EUROPA, multiplier: 3}),
      outcome({kind: 'cards', amount: 1, step: 'colony:Pluto:1:draw', colony: ColonyName.PLUTO, multiplier: 3}),
      outcome({kind: 'discard', amount: 1, step: 'colony:Pluto:1:discard', colony: ColonyName.PLUTO, multiplier: 3}),
      outcome({kind: 'colonyBonus', stock: Resource.MEGACREDITS, amount: -9, step: 'colony:Titania', colony: ColonyName.TITANIA, multiplier: 3}),
    ]});
    const fresh = detectNewViewerRewards(before, after);
    expect(fresh.map((r) => r.outcome.colony)).deep.eq([ColonyName.LUNA, ColonyName.EUROPA]);
    expect(fresh.map((r) => r.delivery.source)).deep.eq(['colony-row', 'colony-row']);
    expect(fresh.map((r) => r.delivery.address.source), 'the ADDRESS still says the card — the row is the record\'s own birthplace').deep.eq(['card-icon', 'card-icon']);
    expect(fresh[1].spec).deep.eq({channel: 'production', resource: 'energy', amount: 3});
  });

  it('DETECT: the viewer\'s Agenda TR bonus is new with the phase\'s first view of the move; a card step or another seat\'s move is not', () => {
    const start = view({generation: 3, agenda: {player: BLUE, from: 1, to: 2, bonus: 'tr'}});
    const bonus = detectAgendaBonus(view(undefined), start);
    expect(bonus).deep.eq({generation: 3, player: BLUE, step: 2, kind: 'tr', spec: {channel: 'stock', resource: RATING_RAIL_KEY, amount: 1}});
    expect(detectAgendaBonus(start, start), 'already seen').is.undefined;
    expect(detectAgendaBonus(undefined, start), 'a first view (a reload) holds nothing').is.undefined;
    expect(detectAgendaBonus(view(undefined), view({generation: 3, agenda: {player: BLUE, from: 6, to: 7, bonus: 'card'}})), 'a CARD step is a bonus of its own kind')
      .deep.eq({generation: 3, player: BLUE, step: 7, kind: 'card'});
    expect(detectAgendaBonus(view(undefined), view({generation: 3, agenda: {player: BLUE, from: 0, to: 1}})), 'an influence step pays nothing to carry').is.undefined;
    expect(detectAgendaBonus(view(undefined), view({generation: 3, agenda: {player: RED, from: 1, to: 2, bonus: 'tr'}}))).is.undefined;
  });

  it('the Agenda CARD bonus PARKS the agenda reveal (nothing on the rail) until the director lands the glide; the park is scoped to that batch', () => {
    consoleParliamentUi.stageStanding = true;
    seedParliamentRewardHold(view(undefined), view({generation: 3, seq: 7, agenda: {player: BLUE, from: 6, to: 7, bonus: 'card'}}));
    expect(heldStock(RATING_RAIL_KEY), 'a card step holds no rating').eq(0);
    expect(parliamentParksReveal({type: 'agenda'}), 'the agenda batch is parked').is.true;
    expect(parliamentParksReveal({type: 'tile'}), 'another batch is not').is.false;
    expect(parliamentParksReveal(undefined)).is.false;
    const bonus = takeAgendaBonus(3);
    expect(bonus?.kind).eq('card');
    expect(parliamentParksReveal({type: 'agenda'}), 'still parked while the glide flies').is.true;
    markAgendaBonusLanded();
    expect(parliamentParksReveal({type: 'agenda'}), 'released at the landing — the cover scene may lift it now').is.false;
    // A TR step never parks a batch.
    seedParliamentRewardHold(view(undefined), view({generation: 4, seq: 8, agenda: {player: BLUE, from: 1, to: 2, bonus: 'tr'}}));
    expect(parliamentParksReveal({type: 'agenda'})).is.false;
    expect(heldStock(RATING_RAIL_KEY)).eq(1);
  });

  it('SEED with the sitting ON SCREEN: the rail is held by the records\' amounts, the records are owed; a touchdown releases its own hold and reads «landed»', () => {
    consoleParliamentUi.stageStanding = true;
    const before = view({generation: 3, seq: 7});
    const after = view({generation: 3, seq: 7, outcomes: [
      outcome({kind: 'production', production: Resource.HEAT, amount: 2, step: 'a'}),
      outcome({kind: 'reaction', party: PartyName.GREENS, production: Resource.MEGACREDITS, amount: 2, step: 'a', part: undefined}),
    ]});
    seedParliamentRewardHold(before, after);
    expect(parliamentRewardState.sitting).eq('3:7');
    expect(parliamentRewardPending()).is.true;
    expect(heldProduction('heat')).eq(2);
    expect(heldProduction('megacredits')).eq(2);
    expect(rewardLanded(after.game.parliament!.phase!.outcomes![0])).is.false;
    const taken = takeOwedRewards();
    expect(taken).has.length(2);
    expect(parliamentRewardState.owed).deep.eq([]);
    expect(parliamentRewardPending(), 'in the air').is.true;
    markRewardLanded(taken[0]);
    expect(heldProduction('heat')).eq(0);
    expect(heldProduction('megacredits'), 'the other chip still flies').eq(2);
    expect(rewardLanded(taken[0].outcome)).is.true;
    expect(rewardLanded(taken[1].outcome)).is.false;
    markRewardLanded(taken[1]);
    expect(parliamentRewardPending()).is.false;
    expect(panelRewardHold.active).is.false;
  });

  it('SEED with the sitting OFF SCREEN (parked / absent): no hold, nothing owed — the counter ticks with the commit and the record reads «landed»; the Agenda bonus too', () => {
    consoleParliamentUi.stageStanding = false;
    const before = view({generation: 3, seq: 7});
    const record = outcome({kind: 'stock', stock: Resource.PLANTS, amount: 4, step: 'b'});
    seedParliamentRewardHold(before, view({generation: 3, seq: 7, outcomes: [record], agenda: {player: BLUE, from: 1, to: 2, bonus: 'tr'}}));
    expect(parliamentRewardPending()).is.false;
    expect(heldStock('plants')).eq(0);
    expect(rewardLanded(record)).is.true;
    expect(heldStock(RATING_RAIL_KEY), 'no track on screen to fly the bonus on — the rating ticks with the commit').eq(0);
    expect(parliamentRewardState.agendaBonus).is.undefined;
  });

  it('a new sitting drops what the old one still owed (its holds released), and the phase\'s end clears the ledger', () => {
    consoleParliamentUi.stageStanding = true;
    seedParliamentRewardHold(view({generation: 3, seq: 7}), view({generation: 3, seq: 7, outcomes: [outcome({kind: 'stock', stock: Resource.PLANTS, amount: 4})]}));
    expect(heldStock('plants')).eq(4);
    seedParliamentRewardHold(view({generation: 4, seq: 8}), view({generation: 4, seq: 8}));
    expect(parliamentRewardState.sitting).eq('4:8');
    expect(parliamentRewardPending()).is.false;
    expect(heldStock('plants'), 'the old hold is released, not leaked').eq(0);
    seedParliamentRewardHold(view({generation: 4, seq: 8}), view(undefined));
    expect(parliamentRewardState.sitting).eq('');
    expect(sittingKeyOf(view(undefined))).eq('');
  });

  it('the Agenda TR bonus holds the rating on the rail until the director takes it and its chip lands', () => {
    consoleParliamentUi.stageStanding = true;
    seedParliamentRewardHold(view(undefined), view({generation: 3, seq: 7, agenda: {player: BLUE, from: 1, to: 2, bonus: 'tr'}}));
    expect(heldStock(RATING_RAIL_KEY)).eq(1);
    expect(takeAgendaBonus(2), 'another generation\'s bonus is not this one').is.undefined;
    const bonus = takeAgendaBonus(3);
    expect(bonus?.step).eq(2);
    expect(heldStock(RATING_RAIL_KEY), 'still held while the chip flies').eq(1);
    markAgendaBonusLanded();
    expect(heldStock(RATING_RAIL_KEY)).eq(0);
    expect(parliamentRewardState.agendaBonus).is.undefined;
  });

  it('v2 — NO WALL CLOCK: seeding arms no timer; a hold outlives any pause and ends only by a touchdown, an explicit end of the stage, or the registry\'s ceiling', () => {
    const armed: Array<number> = [];
    const realSet = globalThis.setTimeout;
    (globalThis as unknown as {setTimeout: unknown}).setTimeout = (_fn: () => void, ms: number) => {
      armed.push(ms);
      return 0;
    };
    try {
      consoleParliamentUi.stageStanding = true;
      seedParliamentRewardHold(view({generation: 3, seq: 7}), view({generation: 3, seq: 7,
        outcomes: [outcome({kind: 'stock', stock: Resource.PLANTS, amount: 4, step: 'a'})], agenda: {player: BLUE, from: 1, to: 2, bonus: 'tr'}}));
    } finally {
      globalThis.setTimeout = realSet;
    }
    // The ONLY timers around a seed are the hold registry's own ceilings (the wedge net every critical animation
    // shares) — the ledger itself arms none: nothing here ticks by the clock.
    expect(armed.every((ms) => ms >= 30_000), `the ledger armed no net of its own (${armed.join(',')})`).is.true;
    expect(heldStock('plants')).eq(4);
    expect(heldStock(RATING_RAIL_KEY)).eq(1);
    // The blocking suppliers stand for both (the door the placement / host families wait on).
    expect(isAnimationHoldActive()).is.true;
    const labels = activeAnimationHoldLabels();
    expect(labels.some((l) => l.startsWith('parliament-reward-owed')), labels.join(',')).is.true;
    expect(labels.some((l) => l.startsWith('parliament-agenda-bonus-owed')), labels.join(',')).is.true;
    // An explicit END OF THE STAGE releases everything at once, with its reason in the trail.
    releaseParliamentRewards('board');
    expect(parliamentRewardPending()).is.false;
    expect(heldStock('plants')).eq(0);
    expect(heldStock(RATING_RAIL_KEY)).eq(0);
    expect(parliamentRewardState.agendaBonus).is.undefined;
    const trail = parliamentRewardDiag().trail.map((e) => `${e.ev}:${(e.detail as {why?: string} | undefined)?.why ?? ''}`);
    expect(trail).includes('flush:board');
    expect(trail).includes('flush-agenda:board');
    expect(activeAnimationHoldLabels().some((l) => l.startsWith('parliament-'))).is.false;
  });

  it('flush releases every owed and flying hold at once — a beat that cannot play is announced by its counter, never withheld', () => {
    consoleParliamentUi.stageStanding = true;
    seedParliamentRewardHold(view({generation: 3, seq: 7}), view({generation: 3, seq: 7, outcomes: [
      outcome({kind: 'stock', stock: Resource.PLANTS, amount: 4, step: 'a'}),
      outcome({kind: 'production', production: Resource.HEAT, amount: 1, step: 'b'}),
    ]}));
    takeOwedRewards();
    flushParliamentRewards();
    expect(parliamentRewardPending()).is.false;
    expect(heldStock('plants')).eq(0);
    expect(heldProduction('heat')).eq(0);
    expect(parliamentRewardState.landed).has.length(2);
  });
});
