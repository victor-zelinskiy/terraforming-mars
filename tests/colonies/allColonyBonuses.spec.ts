import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {IColony} from '../../src/server/colonies/IColony';
import {cast} from '../../src/common/utils/utils';
import {runAllActions} from '../TestingUtils';
import {CardName} from '../../src/common/cards/CardName';
import {CardResource} from '../../src/common/CardResource';
import {ColonyName} from '../../src/common/colonies/ColonyName';
import {ColonyBenefit} from '../../src/common/colonies/ColonyBenefit';
import {Resource} from '../../src/common/Resource';
import {ActionPreviewStep} from '../../src/common/models/ActionPreviewModel';
import {SelectCard} from '../../src/server/inputs/SelectCard';
import {ICard} from '../../src/server/cards/ICard';
import {IProjectCard} from '../../src/server/cards/IProjectCard';
import {Luna} from '../../src/server/colonies/Luna';
import {Ceres} from '../../src/server/colonies/Ceres';
import {Titan} from '../../src/server/colonies/Titan';
import {Miranda} from '../../src/server/colonies/Miranda';
import {Pluto} from '../../src/server/colonies/Pluto';
import {Enceladus} from '../../src/server/colonies/Enceladus';
import {Titania} from '../../src/server/cards/community/Titania';
import {Leavitt} from '../../src/server/cards/community/Leavitt';
import {Dirigibles} from '../../src/server/cards/venusNext/Dirigibles';
import {Tardigrades} from '../../src/server/cards/base/Tardigrades';
import {AtmoCollectors} from '../../src/server/cards/colonies/AtmoCollectors';
import {
  allColonyBonusesEffects,
  allColonyBonusesLedger,
  gainAllColonyBonuses,
  NO_VENUS_HOLDER_REASON,
  noHolderReason,
  ownColonyBonuses,
} from '../../src/server/colonies/allColonyBonuses';

/**
 * «ALL YOUR COLONY BONUSES» — the ONE module of the rule (TR23 Habitat
 * Science, Productive Outpost, Yvonne and the resolution RX07 stand on it):
 * who is paid (per CUBE), the payout (one cube at a time, the paying card
 * named on everything it raises), the reading in the ORDER THE ENGINE PAYS,
 * and the sums. The cards' own specs pin their rules; this one pins the layer.
 */
const VIA = CardName.PRODUCTIVE_OUTPOST;

type Table = {game: IGame, p1: TestPlayer, p2: TestPlayer};

function table(...colonies: Array<[IColony, number, number?]>): Table {
  const [game, p1, p2] = testGame(2, {coloniesExtension: true});
  game.colonies = [];
  for (const [colony, mine, theirs] of colonies) {
    game.colonies.push(colony);
    for (let i = 0; i < mine; i++) {
      colony.colonies.push(p1.id);
    }
    for (let i = 0; i < (theirs ?? 0); i++) {
      colony.colonies.push(p2.id);
    }
  }
  return {game, p1, p2};
}

/** The colonies that actually PAID, in the order their first event landed (the bonus's own colony source). */
function paidOrder(game: IGame, from: number): Array<string> {
  const out: Array<string> = [];
  for (const event of game.events.events.slice(from)) {
    const source = event.source as {kind?: string, name?: string} | undefined;
    if (source?.kind === 'colony' && source.name !== undefined && !out.includes(source.name)) {
      out.push(source.name);
    }
  }
  return out;
}

/** Answer every prompt the payout raises (the live route) — a target takes its first candidate, a discard the first card of the hand. */
function answerAll(game: IGame, player: TestPlayer): Array<SelectCard<ICard>> {
  const asked: Array<SelectCard<ICard>> = [];
  runAllActions(game);
  for (let guard = 0; guard < 20; guard++) {
    const waiting = player.getWaitingFor();
    if (waiting === undefined) {
      break;
    }
    const select = cast(waiting, SelectCard<ICard>);
    asked.push(select);
    // Through `process` — the prompt's own captured scope is restored, and its continuation drains the queue.
    player.process({type: 'card', cards: [select.cards[0].name]});
  }
  return asked;
}

/** The payout under an action scope — what a real turn opens (the bonus events need a root to hang on). */
function payUnderScope(t: Table, options: {via?: CardName, times?: number}): {asked: Array<SelectCard<ICard>>, from: number} {
  const events = t.game.events;
  const from = events.events.length;
  events.beginAction(t.p1, {kind: 'card', card: VIA, owner: t.p1.color}, {category: 'card-action'});
  let asked: Array<SelectCard<ICard>> = [];
  try {
    gainAllColonyBonuses(t.p1, options);
    asked = answerAll(t.game, t.p1);
  } finally {
    events.endScope();
  }
  return {asked, from};
}

function snapshot(game: IGame): string {
  return JSON.stringify(game.serialize());
}

describe('allColonyBonuses — the one module of «gain all your colony bonuses»', () => {
  describe('ownColonyBonuses — who is paid: the tiles and their CUBES, in the table\'s order', () => {
    it('one row per tile, two cubes on a tile are `cubes: 2`, another seat\'s cube is nobody\'s row', () => {
      const luna = new Luna();
      const titan = new Titan();
      const pluto = new Pluto();
      const t = table([titan, 1], [luna, 2, 1], [pluto, 0, 2]);
      expect(ownColonyBonuses(t.game, t.p1).map((b) => [b.colony.name, b.cubes])).deep.eq([[ColonyName.TITAN, 1], [ColonyName.LUNA, 2]]);
      expect(ownColonyBonuses(t.game, t.p2).map((b) => [b.colony.name, b.cubes])).deep.eq([[ColonyName.LUNA, 1], [ColonyName.PLUTO, 2]]);
    });

    it('a player with no cube anywhere has no rows', () => {
      const t = table([new Luna(), 0, 1]);
      expect(ownColonyBonuses(t.game, t.p1)).deep.eq([]);
    });
  });

  describe('gainAllColonyBonuses — the payout: per cube, never merged, the paying card named', () => {
    it('two cubes on Luna pay the bonus twice (4 M€); the rival\'s cube pays the player nothing', () => {
      const t = table([new Luna(), 2, 1], [new Ceres(), 1]);
      gainAllColonyBonuses(t.p1, {via: VIA});
      runAllActions(t.game);
      expect(t.p1.megaCredits).eq(4);
      expect(t.p1.steel).eq(2);
      expect(t.p2.megaCredits, 'only the player\'s own colonies pay').eq(0);
    });

    it('`times: 2` (Yvonne) pays every cube twice', () => {
      const t = table([new Luna(), 2]);
      gainAllColonyBonuses(t.p1, {via: CardName.YVONNE, times: 2});
      runAllActions(t.game);
      expect(t.p1.megaCredits).eq(8);
    });

    it('Titania is paid FIRST and Leavitt LAST whatever the table\'s order (Productive Outpost\'s order, kept)', () => {
      const t = table([new Leavitt(), 1], [new Luna(), 1], [new Titania(), 1]);
      t.p1.megaCredits = 1;
      gainAllColonyBonuses(t.p1, {via: VIA});
      runAllActions(t.game);
      // Titania took the 1 M€ that was there (min(1, 3)) BEFORE Luna paid 2.
      expect(t.p1.megaCredits).eq(2);
      // Leavitt's paid reveal is what stands at the end.
      cast(t.p1.popWaitingFor(), SelectCard);
    });

    it('a plain draw names the colony AND the paying card on its reveal batch (Miranda)', () => {
      const t = table([new Miranda(), 1]);
      gainAllColonyBonuses(t.p1, {via: VIA});
      runAllActions(t.game);
      expect(t.p1.cardsInHand).has.length(1);
      expect(t.p1.cardDrawReveals.map((r) => r.source)).deep.eq([{type: 'colony', colonyName: ColonyName.MIRANDA, via: VIA}]);
    });

    it('a resource onto a card with ONE holder is still ASKED (no auto-select), its cause the colony + the card', () => {
      const t = table([new Titan(), 1]);
      const dirigibles = new Dirigibles();
      t.p1.playedCards.push(dirigibles);
      gainAllColonyBonuses(t.p1, {via: VIA});
      runAllActions(t.game);
      expect(dirigibles.resourceCount, 'nothing landed behind the player\'s back').eq(0);
      const pick = cast(t.p1.popWaitingFor(), SelectCard<ICard>);
      expect(pick.cards).deep.eq([dirigibles]);
      expect(pick.choiceContext?.source).deep.eq({kind: 'colony', name: ColonyName.TITAN, via: VIA});
      pick.cb([dirigibles]);
      runAllActions(t.game);
      expect(dirigibles.resourceCount).eq(1);
    });

    it('two cubes on Titan are two picks, one after the other', () => {
      const t = table([new Titan(), 2]);
      const dirigibles = new Dirigibles();
      const atmo = new AtmoCollectors();
      t.p1.playedCards.push(dirigibles, atmo);
      gainAllColonyBonuses(t.p1, {via: VIA});
      const asked = answerAll(t.game, t.p1);
      expect(asked).has.length(2);
      expect(dirigibles.resourceCount).eq(2);
    });

    it('Pluto ×2 cubes: two PAIRS — «1 of 2», then «2 of 2»; the card is the discard\'s source, `colonyRepeat` its marker, NEVER `colonyBonus`; the second card is not drawn before the first discard', () => {
      const t = table([new Pluto(), 2]);
      t.p1.cardsInHand.push(...t.game.projectDeck.drawN(t.game, 2) as Array<IProjectCard>);
      gainAllColonyBonuses(t.p1, {via: VIA});
      runAllActions(t.game);

      expect(t.p1.cardsInHand, 'ONE card drawn — the second pair has not started').has.length(3);
      const first = cast(t.p1.popWaitingFor(), SelectCard<IProjectCard>);
      expect(first.discardPrompt?.source).deep.eq({kind: 'card', card: VIA});
      expect(first.discardPrompt?.colonyRepeat).deep.eq({colonyName: ColonyName.PLUTO, index: 1, total: 2});
      expect(first.discardPrompt?.colonyBonus, 'the marker that routes the COLONY workspace is absent').is.undefined;
      expect(t.p1.cardDrawReveals.map((r) => r.source)).deep.eq([{type: 'colony', colonyName: ColonyName.PLUTO, via: VIA}]);
      expect(t.p1.cardDrawReveals[0].sealed, 'the pair seals its batch').is.true;

      first.cb([first.cards[0]]);
      runAllActions(t.game);
      expect(t.p1.cardsInHand, 'discarded one, drew the second pair\'s card').has.length(3);
      const second = cast(t.p1.popWaitingFor(), SelectCard<IProjectCard>);
      expect(second.discardPrompt?.colonyRepeat).deep.eq({colonyName: ColonyName.PLUTO, index: 2, total: 2});
      second.cb([second.cards[0]]);
      runAllActions(t.game);
      expect(t.p1.popWaitingFor()).is.undefined;
      expect(t.p1.cardsInHand).has.length(2);
    });

    it('a resource with NO holder is a recorded skip of ITS size, per cube (the shared step\'s record)', () => {
      const t = table([new Titan(), 2]);
      const {from} = payUnderScope(t, {via: VIA});
      const skips = t.game.events.events.slice(from).filter((e) => e.type === 'effect-skipped');
      expect(skips).has.length(2);
      for (const skip of skips) {
        expect(skip.impact.skipped).deep.include({label: 'Add resources to a card', reason: 'No eligible card'});
        expect(skip.impact.skipped?.effect).deep.include({icon: 'floater', amount: 1});
      }
    });
  });

  describe('a TRADE and a bare grant are untouched (`via` is the card\'s alone)', () => {
    it('a bare `giveColonyBonus(player)` keeps the anonymous colony source, the auto-select and the `colonyBonus` marker', () => {
      const titan = new Titan();
      const pluto = new Pluto();
      const t = table([titan, 1], [pluto, 1]);
      const dirigibles = new Dirigibles();
      t.p1.playedCards.push(dirigibles);
      t.p1.cardsInHand.push(...t.game.projectDeck.drawN(t.game, 2) as Array<IProjectCard>);

      titan.giveColonyBonus(t.p1);
      runAllActions(t.game);
      expect(dirigibles.resourceCount, 'one holder auto-applies, as before').eq(1);
      expect(t.p1.popWaitingFor()).is.undefined;

      pluto.giveColonyBonus(t.p1);
      runAllActions(t.game);
      expect(t.p1.cardDrawReveals[0].source).deep.eq({type: 'colony', colonyName: ColonyName.PLUTO});
      const discard = cast(t.p1.popWaitingFor(), SelectCard<IProjectCard>);
      expect(discard.discardPrompt?.source).deep.eq({kind: 'colony'});
      expect(discard.discardPrompt?.colonyBonus).deep.eq({colonyName: ColonyName.PLUTO, index: 1, total: 1});
      expect(discard.discardPrompt?.colonyRepeat).is.undefined;
    });
  });

  describe('allColonyBonusesLedger — the reading, in the order the engine PAYS', () => {
    it('a row per tile with its printed bonus, its cubes and what it will ask', () => {
      const t = table([new Luna(), 2], [new Titan(), 1], [new Miranda(), 1], [new Pluto(), 1]);
      t.p1.playedCards.push(new Dirigibles());
      const ledger = allColonyBonusesLedger(t.p1, {via: VIA});
      expect(ledger.times).is.undefined;
      const byName = new Map(ledger.entries.map((e) => [e.colony, e]));
      expect(byName.get(ColonyName.LUNA)).deep.eq({
        colony: ColonyName.LUNA, grant: {benefit: ColonyBenefit.GAIN_RESOURCES, quantity: 2, resource: Resource.MEGACREDITS}, description: 'Gain 2 M€', cubes: 2,
      });
      expect(byName.get(ColonyName.TITAN)).deep.include({cubes: 1, asks: 'card'});
      expect(byName.get(ColonyName.TITAN)?.grant).deep.eq({benefit: ColonyBenefit.ADD_RESOURCES_TO_CARD, quantity: 1, cardResource: CardResource.FLOATER});
      expect(byName.get(ColonyName.MIRANDA)).deep.include({cubes: 1, asks: 'draw'});
      expect(byName.get(ColonyName.PLUTO)).deep.include({cubes: 1, asks: 'draw-discard'});
    });

    it('a resource no card can hold is a row REFUSED with its size (cubes × quantity), not an ask', () => {
      const t = table([new Titan(), 2], [new Enceladus(), 1]);
      const ledger = allColonyBonusesLedger(t.p1, {via: VIA});
      expect(ledger.entries.map((e) => [e.colony, e.asks, e.skipped])).deep.eq([
        [ColonyName.TITAN, undefined, {reason: noHolderReason(CardResource.FLOATER), amount: 2}],
        [ColonyName.ENCELADUS, undefined, {reason: noHolderReason(CardResource.MICROBE), amount: 1}],
      ]);
      expect(NO_VENUS_HOLDER_REASON).eq('No Venus card can hold resources');
    });

    it('`times` rides the model (Yvonne\'s «twice») and the refusal\'s size', () => {
      const t = table([new Luna(), 1], [new Titan(), 1]);
      const ledger = allColonyBonusesLedger(t.p1, {via: CardName.YVONNE, times: 2});
      expect(ledger.times).eq(2);
      expect(ledger.entries[1].skipped?.amount).eq(2);
    });

    it('no colonies: an empty ledger', () => {
      const t = table([new Luna(), 0, 1]);
      expect(allColonyBonusesLedger(t.p1, {via: VIA}).entries).deep.eq([]);
    });

    // THE LEDGER IS THE PAYOUT: the rows' order is the order the bonuses really land in — on three tables.
    const TABLES: Array<{name: string, build: () => Table}> = [
      {
        name: 'supply only (the table\'s order)',
        build: () => table([new Ceres(), 1], [new Luna(), 2]),
      },
      {
        name: 'with steps: the gains and the plain draw in table order, then Pluto\'s pairs, then the resources onto cards',
        build: () => {
          const t = table([new Titan(), 1], [new Pluto(), 2], [new Luna(), 1], [new Miranda(), 1], [new Enceladus(), 1]);
          t.p1.playedCards.push(new Dirigibles(), new Tardigrades());
          t.p1.cardsInHand.push(...t.game.projectDeck.drawN(t.game, 2) as Array<IProjectCard>);
          return t;
        },
      },
      {
        name: 'with a skip: the row that cannot land keeps its place',
        build: () => {
          const t = table([new Titan(), 1], [new Luna(), 1], [new Miranda(), 1]);
          return t;
        },
      },
    ];
    for (const scenario of TABLES) {
      it(`the ledger is the payout — ${scenario.name}`, () => {
        const t = scenario.build();
        const ledger = allColonyBonusesLedger(t.p1, {via: VIA}).entries.map((e) => String(e.colony));
        const {from} = payUnderScope(t, {via: VIA});
        expect(paidOrder(t.game, from), 'every row paid (or named its skip), in the ledger\'s order').deep.eq(ledger);
      });
    }

    it('…and that order is NOT simply the table\'s: Titan stands first on the table and is paid last', () => {
      const t = table([new Titan(), 1], [new Pluto(), 1], [new Luna(), 1]);
      t.p1.playedCards.push(new Dirigibles());
      expect(allColonyBonusesLedger(t.p1, {via: VIA}).entries.map((e) => e.colony)).deep.eq([ColonyName.LUNA, ColonyName.PLUTO, ColonyName.TITAN]);
    });
  });

  describe('allColonyBonusesEffects — the sums and the steps', () => {
    it('sums per cube: Luna ×2 → +4 M€ (current → resulting), Ceres → +2 steel, Miranda → +1 card', () => {
      const t = table([new Luna(), 2], [new Ceres(), 1], [new Miranda(), 1]);
      t.p1.megaCredits = 5;
      const {effects, steps} = allColonyBonusesEffects(t.p1, {via: VIA});
      expect(effects.find((e) => e.icon === Resource.MEGACREDITS)).deep.include({direction: 'gain', amount: 4, current: 5, resulting: 9});
      expect(effects.find((e) => e.icon === Resource.STEEL)).deep.include({amount: 2});
      expect(effects.find((e) => e.icon === 'cards')).deep.include({amount: 1});
      expect(steps).deep.eq([]);
    });

    it('a resource onto a card: one chip of the sum, and ONE TARGET STEP PER CUBE — even with a single holder', () => {
      const t = table([new Titan(), 2]);
      const dirigibles = new Dirigibles();
      t.p1.playedCards.push(dirigibles);
      const {effects, steps} = allColonyBonusesEffects(t.p1, {via: VIA});
      expect(effects.find((e) => e.icon === 'floater')).deep.include({amount: 2, note: 'to a card'});
      const inputs = steps.filter((s): s is Extract<ActionPreviewStep, {kind: 'input'}> => s?.kind === 'input');
      expect(inputs).has.length(2);
      for (const step of inputs) {
        expect(step.amount).eq(1);
        expect(step.input.type).eq('card');
        expect(step.input.choiceContext?.source).deep.eq({kind: 'colony', name: ColonyName.TITAN, via: VIA});
      }
    });

    it('no holder: the chip is suppressed and a NAMED warning stands per cube, in the step\'s own words', () => {
      const t = table([new Titan(), 2]);
      const {effects, steps} = allColonyBonusesEffects(t.p1, {via: VIA});
      expect(effects.some((e) => e.icon === 'floater')).is.false;
      const warnings = steps.filter((s): s is Extract<ActionPreviewStep, {kind: 'note'}> => s?.kind === 'note' && s.noteKind === 'warning');
      expect(warnings).has.length(2);
      for (const warning of warnings) {
        expect(warning.skipped?.label).eq('Add resources to a card');
        expect(warning.skipped?.effect).deep.include({icon: 'floater', amount: 1, note: 'to a card'});
      }
    });

    it('Pluto\'s pair is decided after the confirm — named by the one note, never pre-collected', () => {
      const t = table([new Pluto(), 1]);
      const {steps} = allColonyBonusesEffects(t.p1, {via: VIA});
      expect(steps.map((s) => s?.kind)).deep.eq(['note']);
    });
  });

  describe('read-only: the three readings change nothing', () => {
    it('ownColonyBonuses, the ledger and the sums leave the game as it was', () => {
      const t = table([new Titan(), 2], [new Pluto(), 1], [new Luna(), 1], [new Miranda(), 1]);
      t.p1.playedCards.push(new Dirigibles());
      const before = snapshot(t.game);
      const events = t.game.events.events.length;
      const queued = t.game.deferredActions.length;
      ownColonyBonuses(t.game, t.p1);
      allColonyBonusesLedger(t.p1, {via: VIA});
      allColonyBonusesEffects(t.p1, {via: VIA});
      expect(snapshot(t.game)).eq(before);
      expect(t.game.events.events.length, 'no event').eq(events);
      expect(t.game.deferredActions.length, 'nothing deferred').eq(queued);
    });
  });
});
