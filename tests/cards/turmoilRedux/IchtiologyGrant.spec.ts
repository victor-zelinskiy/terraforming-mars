import {expect} from 'chai';
import {ANIMALS_BRANCH, ANIMALS_TO_ANY_CARD, IchtiologyGrant, MICROBES_BRANCH, MICROBES_TO_ANY_CARD} from '../../../src/server/cards/turmoilRedux/IchtiologyGrant';
import {BiologicalSimulations} from '../../../src/server/cards/turmoilRedux/BiologicalSimulations';
import {CouncilSeat} from '../../../src/server/cards/turmoilRedux/CouncilSeat';
import {Decomposers} from '../../../src/server/cards/base/Decomposers';
import {EcologicalZone} from '../../../src/server/cards/base/EcologicalZone';
import {Pets} from '../../../src/server/cards/base/Pets';
import {Tardigrades} from '../../../src/server/cards/base/Tardigrades';
import {Birds} from '../../../src/server/cards/base/Birds';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {testAutomaGame} from '../../automa/AutomaTestGame';
import {IGame} from '../../../src/server/IGame';
import {Game} from '../../../src/server/Game';
import {Parliament} from '../../../src/server/parliament/Parliament';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {CardResource} from '../../../src/common/CardResource';
import {Tag} from '../../../src/common/cards/Tag';
import {Phase} from '../../../src/common/Phase';
import {TileType} from '../../../src/common/TileType';
import {PartyName} from '../../../src/common/turmoil/PartyName';
import {Payment} from '../../../src/common/inputs/Payment';
import {InputResponse} from '../../../src/common/inputs/InputResponse';
import {ALL_MODULE_MANIFESTS} from '../../../src/server/cards/AllManifests';
import {cardPlayPreview} from '../../../src/server/models/cardPlayPreview';
import {effectForecastForPlay} from '../../../src/server/models/effectForecast';
import {PARTY_REQUIREMENT_REASON, unplayableReasons} from '../../../src/server/models/unplayableReasons';
import {requiredPartyOf} from '../../../src/server/cards/requirements/partyRequirementCards';
import {buildCardInformation} from '../../../src/server/tools/cardInfo/buildCardInformation';
import {NO_HOLDER_WARNING, SKIP_REASON} from '../../../src/server/cards/actionPreviews';
import {SelectCard} from '../../../src/server/inputs/SelectCard';
import {OrOptions} from '../../../src/server/inputs/OrOptions';
import {IProjectCard} from '../../../src/server/cards/IProjectCard';
import {cast} from '../../../src/common/utils/utils';
import {quietResolutionOf, seatEnacted, seatResolution} from '../../parliament/parliamentArrange';
import {addOcean, formatMessage, runAllActions} from '../../TestingUtils';
import {parkedBatchTailLength, replayBatch} from '../../../src/server/inputs/deferredInputBatch';
import {recomputeRootImpact} from '../../../src/client/components/notifications/notificationModel';
import {isActionMenuTitle} from '../../../src/common/inputs/actionMenuTitles';

/**
 * TR43 — ICHTIOLOGY GRANT: the Greens' sixth plate, ONE declaration of a
 * COUNTED production (M€ per ocean on the board) beside an OPTIONAL choice
 * of two «add to ANY card» branches — the set's first play with a card
 * target inside an `or` branch, and the first card pin of the pre-select
 * iteration: BOTH batch forms (`[play, {or}, {card}]` and the collapsed
 * `[play, {card}]`) land whole through `replayBatch`, nothing asked twice.
 * Every rule reading of the card file's header is pinned here on the real
 * card, and the preview's promise is held to the play's result.
 */
const G = PartyName.GREENS;
const COST = 10;

type Table = {game: IGame, player: TestPlayer, opponent: TestPlayer, parliament: Parliament, card: IchtiologyGrant};

/** A two-seat Redux table in the action phase: generation 1, nothing enacted — the Greens rule by the STARTING RULE. */
function table(): Table {
  const [game, player, opponent] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  const card = new IchtiologyGrant();
  player.cardsInHand.push(card);
  player.megaCredits = 20;
  return {game, player, opponent, parliament: game.parliament!, card};
}

function redsRule(t: Table): void {
  seatEnacted(t.parliament, quietResolutionOf(PartyName.REDS));
  expect(t.parliament.rulingParty()).eq(PartyName.REDS);
}

function greensCubes(t: Table, player: TestPlayer, n: number): void {
  let slot = t.parliament.slotOf(G);
  if (slot === undefined) {
    seatResolution(t.parliament, 0, quietResolutionOf(G));
    slot = t.parliament.slotOf(G)!;
  }
  for (let i = 0; i < n; i++) {
    t.parliament.placeVote(player, slot, t.parliament.lobby.has(player.id) ? 'lobby' : 'reserve');
  }
}

function oceans(t: Table, n: number): void {
  for (let i = 0; i < n; i++) {
    addOcean(t.opponent);
  }
}

function play(t: Table): void {
  t.player.playCard(t.card, Payment.of({megacredits: COST}));
  runAllActions(t.game);
}

/** The action menu's «Play project card» branch — the batch's head, as the composer wraps it. */
function playHead(t: Table): InputResponse {
  t.player.takeAction();
  const menu = cast(t.player.getWaitingFor(), OrOptions);
  const index = menu.options.findIndex((o) => o.title === 'Play project card');
  expect(index).is.greaterThan(-1);
  return {type: 'or', index, response: {type: 'projectCard', card: t.card.name, payment: Payment.of({megacredits: COST})}};
}

/** After a whole batch the player stands at the NEXT action menu — no question of the card's is left. */
function expectActionMenu(t: Table): void {
  const wf = cast(t.player.getWaitingFor(), OrOptions);
  expect(isActionMenuTitle(typeof wf.title === 'string' ? wf.title : wf.title.message), 'the next action menu, not a prompt of the card').is.true;
  expect(wf.choiceContext).is.undefined;
}

describe('IchtiologyGrant', () => {
  let t: Table;

  beforeEach(() => {
    t = table();
  });

  describe('the card as printed', () => {
    it('is a green card for 10, Microbe + Animal, no VP, no storage, the GREENS\' plate, TR43 — in the Redux manifest without compatibility', () => {
      const card = t.card;
      expect(card.name).eq(CardName.ICHTIOLOGY_GRANT);
      expect(card.type).eq(CardType.AUTOMATED);
      expect(card.cost).eq(COST);
      expect(card.tags).deep.eq([Tag.MICROBE, Tag.ANIMAL]);
      expect(card.resourceType).is.undefined;
      expect(card.victoryPoints, 'no VP badge').is.undefined;
      expect(requiredPartyOf(card), 'the MIN plate holds the Greens\' emblem — a requirement, not a tag').eq(G);
      expect(card.requirements).has.length(1);
      expect(card.metadata.cardNumber).eq('TR43');
      expect(card.metadata.description).eq('Requires the Greens to be ruling or that you have 2 delegates there. Increase your M€ production 1 step for each ocean in play. Add 2 animals or 4 microbes to ANY card.');
      const manifest = ALL_MODULE_MANIFESTS.find((m) => m.module === 'turmoilRedux')!;
      const entry = (manifest.projectCards as Record<string, {compatibility?: unknown}>)[CardName.ICHTIOLOGY_GRANT];
      expect(entry, 'registered in the Redux manifest').is.not.undefined;
      expect(entry.compatibility, 'only the module\'s icon at the bottom left: the module is the gate').is.undefined;
      expect(ANIMALS_TO_ANY_CARD).eq(2);
      expect(MICROBES_TO_ANY_CARD).eq(4);
      // ONE declaration: a counted production and an OPTIONAL, auto-collapsing choice of two holder-gated branches.
      expect(card.behavior?.production).deep.eq({megacredits: {oceans: {}}});
      expect(card.behavior?.or?.optional).is.true;
      expect(card.behavior?.or?.autoSelect).is.true;
      expect(card.behavior?.or?.behaviors.map((b) => [b.title, b.addResourcesToAnyCard])).deep.eq([
        [ANIMALS_BRANCH, {type: CardResource.ANIMAL, count: 2, mustHaveCard: true}],
        [MICROBES_BRANCH, {type: CardResource.MICROBE, count: 4, mustHaveCard: true}],
      ]);
      expect(card.cardPlayPreview, 'no hook — the declaration is the preview').is.undefined;
      expect(card.bespokePlay === IchtiologyGrant.prototype.bespokePlay || (card as unknown as {bespokePlay?: unknown}).bespokePlay === undefined, 'no bespoke play').is.true;
    });

    it('the structured text prints the rule itself — the requirement line, the production, the choice', () => {
      const info = buildCardInformation(t.card, 'turmoilRedux');
      const blocks = info?.groups.flatMap((g) => g.blocks) ?? [];
      expect(blocks.map((b) => b.text)).deep.eq([
        'Requires Greens to be ruling or that you have 2 delegates on its resolution.',
        'Increase your M€ production 1 step for each ocean in play.',
        'Add 2 animals or 4 microbes to ANY card.',
      ]);
    });
  });

  describe('rule 1 — the requirement: the Greens rule (the starting rule counts), or 2 of your delegates on their resolution', () => {
    it('generation 1, nothing enacted: the Greens rule by the STARTING RULE — playable with no delegate anywhere', () => {
      expect(t.parliament.rulingParty()).eq(G);
      expect(t.player.canPlay(t.card)).is.true;
      expect(unplayableReasons(t.player, t.card)).deep.eq([]);
    });

    it('the Reds ruling: «0 of 2» with the named reason; one cube: «1 of 2»; two: playable', () => {
      redsRule(t);
      expect(t.player.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.player, t.card)[0]).deep.include({
        type: 'party', message: PARTY_REQUIREMENT_REASON, params: [G, '2'], party: G, current: 0, requirement: true, requirementKey: 'req:party',
      });
      greensCubes(t, t.player, 1);
      expect(t.player.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.player, t.card)[0]).deep.include({party: G, current: 1});
      greensCubes(t, t.player, 1);
      expect(t.player.canPlay(t.card)).is.true;
    });

    it('TR36 Council Seat lowers the EFFECT\'s threshold, never a REQUIREMENT\'s: with one cube the card still reads «1 of 2»', () => {
      redsRule(t);
      t.player.playedCards.push(new CouncilSeat());
      greensCubes(t, t.player, 1);
      expect(t.parliament.hasPartyEffect(t.player, G)).is.true;
      expect(t.player.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.player, t.card)[0]).deep.include({party: G, current: 1, params: [G, '2']});
    });
  });

  describe('rule 2 — the production: the oceans ON THE BOARD at the play, all of them, counted once', () => {
    it('0 oceans → +0, and the zero is NAMED by the chip\'s basis («0 → 0 · Oceans: 0»)', () => {
      const chip = cardPlayPreview(t.player, t.card).branches[0].effects.find((e) => e.icon === 'megacredits' && e.note === 'production')!;
      expect(chip).deep.include({direction: 'gain', amount: 0, current: 0, resulting: 0});
      expect(chip.basis).deep.eq([{count: 0, label: 'Oceans'}]);
      play(t);
      expect(t.player.production.megacredits).eq(0);
      expect(t.player.getWaitingFor()).is.undefined;
    });

    it('3 oceans — the OPPONENT\'s — → +3 with the basis «Oceans: 3»; 9 → +9', () => {
      oceans(t, 3);
      const chip = cardPlayPreview(t.player, t.card).branches[0].effects.find((e) => e.icon === 'megacredits')!;
      expect(chip).deep.include({amount: 3, current: 0, resulting: 3});
      expect(chip.basis).deep.eq([{count: 3, label: 'Oceans'}]);
      play(t);
      expect(t.player.production.megacredits).eq(3);
      const nine = table();
      oceans(nine, 9);
      play(nine);
      expect(nine.player.production.megacredits).eq(9);
    });

    it('an UPGRADED ocean (Ares) and a WETLANDS tile count — the board\'s own reading, never this card\'s arithmetic', () => {
      const upgraded = addOcean(t.opponent);
      upgraded.tile = {tileType: TileType.OCEAN_CITY};
      const wet = addOcean(t.opponent);
      wet.tile = {tileType: TileType.WETLANDS};
      addOcean(t.opponent);
      expect(t.game.board.getOceanSpaces({upgradedOceans: true, wetlands: true})).has.length(3);
      play(t);
      expect(t.player.production.megacredits).eq(3);
    });

    it('counted ONCE at the play: an ocean placed later adds nothing', () => {
      oceans(t, 2);
      play(t);
      expect(t.player.production.megacredits).eq(2);
      addOcean(t.opponent);
      runAllActions(t.game);
      expect(t.player.production.megacredits).eq(2);
    });

    it('the journal names the step with its number', () => {
      oceans(t, 3);
      play(t);
      const lines = t.game.gameLog.map((m) => formatMessage(m));
      expect(lines.some((l) => l.includes('production') && l.includes('3')), lines.join('\n')).is.true;
    });
  });

  describe('rules 3–4 — the choice: holder-gated branches, a shown target, never automatic; no holder at all — still a play', () => {
    it('holders of BOTH kinds: an OrOptions of two sourced by the card, then the target pick of the chosen kind', () => {
      const pets = new Pets();
      const tardigrades = new Tardigrades();
      t.player.playedCards.push(pets, tardigrades);
      play(t);
      const or = cast(t.player.getWaitingFor(), OrOptions);
      expect(or.options.map((o) => o.title)).deep.eq([ANIMALS_BRANCH, MICROBES_BRANCH]);
      expect(or.choiceContext).deep.include({mode: 'effect-choice'});
      expect(or.choiceContext?.source).deep.include({kind: 'card', card: CardName.ICHTIOLOGY_GRANT});
      or.process({type: 'or', index: 1, response: {type: 'option'}}, t.player);
      runAllActions(t.game);
      const target = cast(t.player.getWaitingFor(), SelectCard);
      expect(target.cards.map((c) => c.name)).deep.eq([CardName.TARDIGRADES]);
      expect(tardigrades.resourceCount, 'nothing lands before the pick').eq(0);
      target.process({type: 'card', cards: [CardName.TARDIGRADES]}, t.player);
      expect(tardigrades.resourceCount).eq(4);
      expect(pets.resourceCount).eq(0);
    });

    it('ONE holder: the lone branch collapses to its bare target pick — the pick is SHOWN, never applied silently', () => {
      const pets = new Pets();
      t.player.playedCards.push(pets);
      play(t);
      const target = cast(t.player.getWaitingFor(), SelectCard);
      expect(target.cards.map((c) => c.name)).deep.eq([CardName.PETS]);
      expect(pets.resourceCount).eq(0);
      target.process({type: 'card', cards: [CardName.PETS]}, t.player);
      expect(pets.resourceCount).eq(2);
    });

    it('«ANY card» is any of YOUR cards: an opponent\'s holder is never a candidate', () => {
      t.opponent.playedCards.push(new Pets());
      const birds = new Birds();
      t.player.playedCards.push(birds);
      play(t);
      const target = cast(t.player.getWaitingFor(), SelectCard);
      expect(target.cards.map((c) => c.name)).deep.eq([CardName.BIRDS]);
    });

    it('NO holder of either kind: the card is PLAYABLE, the production stands, nothing is asked, and each branch is skipped BY NAME', () => {
      oceans(t, 2);
      expect(t.player.canPlay(t.card)).is.true;
      expect(unplayableReasons(t.player, t.card)).deep.eq([]);
      play(t);
      expect(t.player.production.megacredits).eq(2);
      expect(t.player.getWaitingFor()).is.undefined;
      const skipped = t.game.events.events.filter((e) => e.type === 'effect-skipped').map((e) => e.impact.skipped!);
      expect(skipped).deep.eq([
        {label: ANIMALS_BRANCH, reason: SKIP_REASON.noHolder, effect: {direction: 'gain', icon: 'animal', amount: 2, note: 'to a card'}},
        {label: MICROBES_BRANCH, reason: SKIP_REASON.noHolder, effect: {direction: 'gain', icon: 'microbe', amount: 4, note: 'to a card'}},
      ]);
      const lines = t.game.gameLog.map((m) => formatMessage(m)).filter((l) => l.includes('effect skipped'));
      expect(lines).deep.eq([
        `${t.player.color} — effect skipped: ${ANIMALS_BRANCH} (${SKIP_REASON.noHolder})`,
        `${t.player.color} — effect skipped: ${MICROBES_BRANCH} (${SKIP_REASON.noHolder})`,
      ]);
    });
  });

  describe('the PREVIEW — what the composer promises, per holder set', () => {
    it('both kinds: two variants, runtime indices 0 / 1, each with the production chip then its own gain, each with ONE target step', () => {
      t.player.playedCards.push(new Pets(), new Tardigrades());
      oceans(t, 3);
      const preview = cardPlayPreview(t.player, t.card);
      expect(preview.kind).eq('declarative');
      expect(preview.branches.map((b) => [b.index, b.title, b.available])).deep.eq([[0, ANIMALS_BRANCH, true], [1, MICROBES_BRANCH, true]]);
      for (const b of preview.branches) {
        expect(b.effects.map((e) => [e.icon, e.amount, e.note])[0]).deep.eq(['megacredits', 3, 'production']);
        expect(b.steps.map((s) => s.kind)).deep.eq(['input']);
      }
      expect(preview.branches[0].effects[1]).deep.include({icon: 'animal', amount: 2, note: 'to a card'});
      expect(preview.branches[1].effects[1]).deep.include({icon: 'microbe', amount: 4, note: 'to a card'});
      const step = preview.branches[0].steps[0];
      expect(step.kind === 'input' && step.amount).eq(2);
      expect(step.kind === 'input' && step.cardResource).eq('animal');
      expect(step.kind === 'input' && step.input.type === 'card' && step.input.cards.map((c) => c.name)).deep.eq([CardName.PETS]);
    });

    it('one kind: the lone branch at index −1 (no OrOptions), the other greyed with the holder reason — the row never disappears', () => {
      t.player.playedCards.push(new Pets());
      const preview = cardPlayPreview(t.player, t.card);
      expect(preview.branches.map((b) => [b.index, b.title, b.available])).deep.eq([[-1, ANIMALS_BRANCH, true], [-1, MICROBES_BRANCH, false]]);
      expect(preview.branches[1].unavailableReason).eq('No card to add the resource to');
      expect(preview.branches[0].steps.map((s) => s.kind)).deep.eq(['input']);
    });

    it('no holder: ONE general branch (the production, a named warning per skipped branch) and both variants greyed', () => {
      oceans(t, 1);
      const preview = cardPlayPreview(t.player, t.card);
      expect(preview.branches.map((b) => [b.index, b.title, b.available])).deep.eq([
        [-1, '', true], [-1, ANIMALS_BRANCH, false], [-1, MICROBES_BRANCH, false],
      ]);
      const general = preview.branches[0];
      expect(general.effects.map((e) => [e.icon, e.amount])).deep.eq([['megacredits', 1]]);
      expect(general.steps.map((s) => s.kind === 'note' ? [s.noteKind, s.text, s.skipped?.label] : s.kind)).deep.eq([
        ['warning', NO_HOLDER_WARNING, ANIMALS_BRANCH],
        ['warning', NO_HOLDER_WARNING, MICROBES_BRANCH],
      ]);
    });
  });

  describe('rule 5 — the BATCH lands WHOLE through `replayBatch` (the pre-select iteration\'s first card pin)', () => {
    it('[play, {or, index 1, {option}}, {card: Tardigrades}] — both pre-selects land, nothing is asked, nothing parks', () => {
      const pets = new Pets();
      const tardigrades = new Tardigrades();
      t.player.playedCards.push(pets, tardigrades);
      oceans(t, 2);
      const preview = cardPlayPreview(t.player, t.card);
      const microbes = preview.branches.find((b) => b.title === MICROBES_BRANCH)!;
      expect(microbes.index).eq(1);
      replayBatch(t.player, [
        playHead(t),
        {type: 'or', index: microbes.index, response: {type: 'option'}},
        {type: 'card', cards: [CardName.TARDIGRADES]},
      ]);
      expectActionMenu(t);
      expect(parkedBatchTailLength(t.player)).eq(0);
      expect(tardigrades.resourceCount).eq(4);
      expect(pets.resourceCount).eq(0);
      expect(t.player.production.megacredits).eq(2);
      expect(t.player.playedCards.get(CardName.ICHTIOLOGY_GRANT)).eq(t.card);
    });

    it('collapsed — [play, {card: Pets}] — the bare target answer meets the bare target prompt', () => {
      const pets = new Pets();
      t.player.playedCards.push(pets);
      const preview = cardPlayPreview(t.player, t.card);
      expect(preview.branches[0].index, 'the lone branch: no OrOptions, the batch sends the target alone').eq(-1);
      replayBatch(t.player, [playHead(t), {type: 'card', cards: [CardName.PETS]}]);
      expectActionMenu(t);
      expect(parkedBatchTailLength(t.player)).eq(0);
      expect(pets.resourceCount).eq(2);
    });

    it('no holder — [play] alone — the play completes with the skips recorded', () => {
      replayBatch(t.player, [playHead(t)]);
      expectActionMenu(t);
      expect(parkedBatchTailLength(t.player)).eq(0);
      expect(t.game.events.events.filter((e) => e.type === 'effect-skipped')).has.length(2);
    });
  });

  describe('rule 6 — two tags wake the neighbours BY TAG', () => {
    it('TR38 takes +2 data in ONE answer; Decomposers +2 microbes; Ecological Zone +1 animal — and the forecast names them before the press', () => {
      const simulations = new BiologicalSimulations();
      simulations.resourceCount = 2;
      const decomposers = new Decomposers();
      const zone = new EcologicalZone();
      t.player.playedCards.push(simulations, decomposers, zone);
      const facts = effectForecastForPlay(t.player, t.card, cardPlayPreview(t.player, t.card)).facts;
      const bio = facts.find((f) => f.source.name === CardName.BIOLOGICAL_SIMULATIONS)!;
      expect(bio.effects[0]).deep.include({icon: 'data', amount: 2, current: 2, resulting: 4});
      expect(facts.find((f) => f.source.name === CardName.DECOMPOSERS)?.effects[0]).deep.include({icon: 'microbe', amount: 2});
      expect(facts.find((f) => f.source.name === CardName.ECOLOGICAL_ZONE)?.effects[0]).deep.include({icon: 'animal', amount: 1});
      play(t);
      expect(simulations.resourceCount).eq(4);
      expect(decomposers.resourceCount).eq(2);
      expect(zone.resourceCount).eq(1);
      // The card's own choice stood too: three holders of two kinds → the OrOptions.
      cast(t.player.getWaitingFor(), OrOptions);
      const dataEvents = t.game.events.events.filter((e) => e.type === 'card-resource-changed' && e.impact.cardResources?.some((r) => r.target === CardName.BIOLOGICAL_SIMULATIONS));
      expect(dataEvents, 'one event of +2, never two of +1').has.length(1);
      expect(dataEvents[0].impact.cardResources?.[0].amount).eq(2);
    });
  });

  describe('rule 7 — the journal and the rival', () => {
    it('the rival\'s notification carries the production chip; with no holder the skipped lines name both branches', () => {
      oceans(t, 2);
      play(t);
      const root = t.game.events.events.find((e) => e.type === 'action' && e.source?.kind === 'card' && e.source.card === CardName.ICHTIOLOGY_GRANT)!.id;
      const impact = recomputeRootImpact(t.game.events.events, root, t.player.color, t.opponent.color);
      const actor = impact.pillGroups.find((group) => group.scope === 'actor');
      expect(actor?.chips.map((chip) => chip.icon)).to.include('megacredits');
      expect(impact.skipped.map((s) => s.label)).deep.eq([ANIMALS_BRANCH, MICROBES_BRANCH]);
    });
  });

  describe('rule 8 — MarsBot', () => {
    it('the bot holds no card: with the bot as the only other seat «any card» is still the human\'s own table', () => {
      const [game, human] = testAutomaGame({coloniesExtension: true, turmoilReduxExpansion: true});
      game.phase = Phase.ACTION;
      const card = new IchtiologyGrant();
      const pets = new Pets();
      human.playedCards.push(pets);
      human.cardsInHand.push(card);
      human.megaCredits = 20;
      expect(human.canPlay(card)).is.true;
      human.playCard(card, Payment.of({megacredits: COST}));
      runAllActions(game);
      const target = cast(human.getWaitingFor(), SelectCard);
      expect(target.cards.map((c) => c.name)).deep.eq([CardName.PETS]);
    });
  });

  describe('rule 9 — save / load adds nothing', () => {
    it('the production and the holder\'s resources survive a reload as ordinary fields', () => {
      const pets = new Pets();
      t.player.playedCards.push(pets);
      oceans(t, 3);
      play(t);
      cast(t.player.getWaitingFor(), SelectCard).process({type: 'card', cards: [CardName.PETS]}, t.player);
      const reloaded = Game.deserialize(structuredClone(t.game.serialize()));
      const again = reloaded.getPlayerById(t.player.id);
      expect(again.production.megacredits).eq(3);
      expect((again.playedCards.get(CardName.PETS) as IProjectCard).resourceCount).eq(2);
      expect(again.playedCards.get(CardName.ICHTIOLOGY_GRANT)).is.not.undefined;
    });
  });
});
