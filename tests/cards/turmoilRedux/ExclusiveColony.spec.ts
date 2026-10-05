import {expect} from 'chai';
import {EXCLUSIVE_COLONY_TITLE, ExclusiveColony} from '../../../src/server/cards/turmoilRedux/ExclusiveColony';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {IGame} from '../../../src/server/IGame';
import {Game} from '../../../src/server/Game';
import {IProjectCard} from '../../../src/server/cards/IProjectCard';
import {cast} from '../../../src/common/utils/utils';
import {runAllActions} from '../../TestingUtils';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {CardRenderItemType} from '../../../src/common/cards/render/CardRenderItemType';
import {Tag} from '../../../src/common/cards/Tag';
import {Phase} from '../../../src/common/Phase';
import {PartyName} from '../../../src/common/turmoil/PartyName';
import {ColonyName} from '../../../src/common/colonies/ColonyName';
import {trackTop} from '../../../src/common/colonies/ColonyMetadata';
import {requiredPartyOf} from '../../../src/server/cards/requirements/partyRequirementCards';
import {PARTY_REQUIREMENT_REASON, unplayableReasons} from '../../../src/server/models/unplayableReasons';
import {cardPlayPreview} from '../../../src/server/models/cardPlayPreview';
import {effectForecastForPlay} from '../../../src/server/models/effectForecast';
import {SelectColony} from '../../../src/server/inputs/SelectColony';
import {SelectCard} from '../../../src/server/inputs/SelectCard';
import {BuildColony, BUILD_COLONY_LABEL, NO_COLONY_TO_BUILD_ON_REASON} from '../../../src/server/deferredActions/BuildColony';
import {NO_FREE_TRACK_CELL_REASON} from '../../../src/server/player/Colonies';
import {COLONY_TILE_HAS_COLONIES_REASON, ColoniesHandler} from '../../../src/server/colonies/ColoniesHandler';
import {Luna} from '../../../src/server/colonies/Luna';
import {Ceres} from '../../../src/server/colonies/Ceres';
import {Titan} from '../../../src/server/colonies/Titan';
import {Pluto} from '../../../src/server/colonies/Pluto';
import {Titania} from '../../../src/server/cards/community/Titania';
import {Poseidon} from '../../../src/server/cards/colonies/Poseidon';
import {ResearchColony} from '../../../src/server/cards/colonies/ResearchColony';
import {BuildColonyStandardProject} from '../../../src/server/cards/colonies/BuildColonyStandardProject';
import {Dirigibles} from '../../../src/server/cards/venusNext/Dirigibles';
import {JupiterFloatingStation} from '../../../src/server/cards/colonies/JupiterFloatingStation';
import {ALL_MODULE_MANIFESTS} from '../../../src/server/cards/AllManifests';
import {quietResolutionOf, seatEnacted, seatResolution} from '../../parliament/parliamentArrange';
import {ActionPreviewStep} from '../../../src/common/models/ActionPreviewModel';

/**
 * TR25 — EXCLUSIVE COLONY: the set's first build of a colony BEYOND THE
 * 3-COLONY LIMIT. Every rule reading of the card file's header is pinned here
 * at the PLAY; the engine's half — the one writer of the cubes, the build
 * bonus read at a berth beyond the printed ones, the door — has its own specs
 * (tests/colonies/ColonyBerths, tests/deferredActions/BuildColony), the
 * staged tail its own (tests/inputs/deferredInputBatch § the build), MarsBot
 * its own (tests/automa/AutomaColoniesFlow).
 */
const U = PartyName.UNITY;
const EXCLUSIVE = CardName.EXCLUSIVE_COLONY;
const BEYOND_LINE = '${0} built a colony on ${1} beyond the 3-colony limit';
const ORDINARY_LINE = '${0} built a colony on ${1}';

type Table = {game: IGame, p1: TestPlayer, p2: TestPlayer, card: ExclusiveColony, luna: Luna, ceres: Ceres, titan: Titan};

/**
 * In play: Ceres (empty), Luna at its PRINTED LIMIT — two of the rival's cubes
 * and one of the player's, so BOTH lifted rules meet on one tile — and Titan,
 * inactive.
 */
function table(): Table {
  const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  const luna = new Luna();
  const ceres = new Ceres();
  const titan = new Titan();
  titan.isActive = false;
  game.colonies = [ceres, luna, titan];
  luna.colonies = [p2.id, p2.id, p1.id];
  luna.trackPosition = 3;
  p1.megaCredits = 40;
  return {game, p1, p2, card: new ExclusiveColony(), luna, ceres, titan};
}

/** Three QUIET real resolutions in the voting area: Greens · Unity · Industrialists. */
function parliamentTable(): Table {
  const t = table();
  const parliament = t.game.parliament!;
  ([PartyName.GREENS, U, PartyName.INDUSTRIALISTS] as const).forEach((party, i) => seatResolution(parliament, i, quietResolutionOf(party)));
  return t;
}

/** The same table with Unity RULING — the requirement met, so only the card's own rule decides. */
function unityRules(): Table {
  const t = parliamentTable();
  seatEnacted(t.game.parliament!, quietResolutionOf(U));
  return t;
}

/** Play the card for real (`playCard` is past the requirement's gate) and return its colony prompt. */
function playToPrompt(t: Table): SelectColony {
  t.p1.playCard(t.card);
  runAllActions(t.game);
  return cast(t.p1.popWaitingFor(), SelectColony);
}

function playOn(t: Table, colony: Luna | Ceres | Titan = t.luna): void {
  playToPrompt(t).cb(colony);
  runAllActions(t.game);
}

function colonyPickOf(player: TestPlayer, card: IProjectCard) {
  const steps = cardPlayPreview(player, card).branches[0].steps;
  return steps.find((s): s is Extract<ActionPreviewStep, {kind: 'colonyPick'}> => s.kind === 'colonyPick');
}

function reasonOf(prompt: SelectColony, name: ColonyName): string | undefined {
  const entry = prompt.disabledColonies.find((d) => d.colony.name === name);
  return entry === undefined ? undefined : String(entry.reason);
}

function linesSince(game: IGame, from: number): Array<string> {
  return game.gameLog.slice(from).map((m) => m.message);
}

describe('ExclusiveColony', () => {
  it('registers with source-backed metadata (the scan: 10 · Space · green · Unity · «[colony]*» · no VP)', () => {
    const card = new ExclusiveColony();
    expect(card.name).eq(EXCLUSIVE);
    expect(card.type).eq(CardType.AUTOMATED);
    expect(card.cost).eq(10);
    expect(card.tags, 'ONE tag in the corner').deep.eq([Tag.SPACE]);
    expect(card.metadata.cardNumber).eq('TR25');
    expect(requiredPartyOf(card), 'the MIN plate holds Unity\'s emblem').eq(U);
    expect(card.requirements).has.length(1);
    expect(card.victoryPoints).is.undefined;
    expect(card.resourceType).is.undefined;
    // The play is the shared step's — never a declarative `buildColony` (it carries no staged address).
    expect(card.behavior).is.undefined;
    // The face, one row: «[colony]*».
    type Node = {is?: string, type?: string};
    const rows = (card.metadata.renderData as unknown as {rows: Array<Array<Node>>}).rows;
    expect(rows).has.length(1);
    expect(rows[0].map((n) => n.type ?? n.is)).deep.eq([CardRenderItemType.COLONIES, '*']);
  });

  it('is in the Turmoil Redux manifest and needs Colonies (the grey ▲)', () => {
    const manifest = ALL_MODULE_MANIFESTS.find((m) => m.module === 'turmoilRedux')!;
    const entry = manifest.projectCards[EXCLUSIVE]!;
    expect(new entry.Factory().name).eq(EXCLUSIVE);
    expect(entry.compatibility).eq('colonies');
  });

  describe('rule 1 — the requirement: Unity rules, or 2 of your delegates on its resolution', () => {
    it('neither road: unplayable with the TR15 class\'s NAMED reason — Unity\'s, and only it', () => {
      const t = parliamentTable();
      expect(t.p1.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.p1, t.card)).deep.eq([{
        type: 'party', message: PARTY_REQUIREMENT_REASON, params: [U, '2'], party: U, current: 0,
        requirement: true, requirementKey: 'req:party',
      }]);
    });

    it('Unity rules: playable', () => {
      const t = unityRules();
      expect(t.p1.canPlay(t.card)).is.true;
      expect(unplayableReasons(t.p1, t.card)).deep.eq([]);
    });

    it('two delegates on its resolution: playable', () => {
      const t = parliamentTable();
      const parliament = t.game.parliament!;
      parliament.placeVote(t.p1, parliament.slots[1], 'reserve');
      expect(t.p1.canPlay(t.card), 'one delegate is not two').is.false;
      parliament.placeVote(t.p1, parliament.slots[1], 'lobby');
      expect(t.p1.canPlay(t.card)).is.true;
    });
  });

  describe('rule 2 — it is an ORDINARY build of a colony (the engine\'s `addColony`, nothing programmed here)', () => {
    it('the cube lands, the tile\'s build bonus is paid, the card is played', () => {
      const t = table();
      playOn(t, t.ceres);
      expect(t.ceres.colonies).deep.eq([t.p1.id]);
      expect(t.p1.steel, 'Ceres\'s build bonus: +1 steel production — and nothing invented beside it').eq(0);
      expect(t.p1.production.steel).eq(1);
      expect(t.p1.playedCards.has(EXCLUSIVE)).is.true;
    });

    it('every «colony built» reactor answers (Poseidon: +1 M€ production for its owner)', () => {
      const t = table();
      t.p2.playedCards.push(new Poseidon());
      playOn(t);
      expect(t.p2.production.megacredits).eq(1);
    });

    it('rule 8 — every count of colonies reads the cubes: +1, as from any build', () => {
      const t = table();
      const before = t.p1.getColoniesCount();
      playOn(t);
      expect(t.p1.getColoniesCount()).eq(before + 1);
      expect(ColoniesHandler.coloniesOf(t.game, t.p1).filter((c) => c.name === ColonyName.LUNA)).has.length(2);
    });
  });

  describe('rule 3 — EXACTLY two rules are lifted', () => {
    it('«it has 3 colonies» and «you already have a colony there»: Luna, carrying both, is a candidate', () => {
      const t = table();
      const prompt = playToPrompt(t);
      expect(prompt.title).eq(EXCLUSIVE_COLONY_TITLE);
      expect(prompt.buttonLabel).eq('Build');
      expect(prompt.colonies).deep.eq([t.ceres, t.luna]);
      expect(reasonOf(prompt, ColonyName.LUNA)).is.undefined;
    });

    it('an INACTIVE tile is NOT a place — shown disabled, by its own reason', () => {
      const t = table();
      const prompt = playToPrompt(t);
      expect(prompt.colonies).does.not.include(t.titan);
      expect(reasonOf(prompt, ColonyName.TITAN)).eq('Colony is inactive');
    });

    it('a tile of the RESERVE is not in play — never offered, never listed', () => {
      const t = table();
      t.game.discardedColonies.push(new Pluto());
      const prompt = playToPrompt(t);
      const names = [...prompt.colonies.map((c) => c.name), ...prompt.disabledColonies.map((d) => d.colony.name)];
      expect(names).does.not.include(ColonyName.PLUTO);
    });

    it('the card holds no build of its own: the step is the shared `BuildColony` with the door\'s two flags', () => {
      const t = table();
      t.card.play(t.p1);
      const step = t.game.deferredActions.pop();
      expect(step).instanceOf(BuildColony);
    });
  });

  describe('rule 4 — the limit is lifted for THIS build, not for the tile', () => {
    it('afterwards the tile is at its limit for everybody — the builder, Research Colony, the standard project', () => {
      const t = table();
      playOn(t);
      expect(t.luna.colonies).has.length(4);
      expect(t.luna.isFull()).is.true;
      for (const seat of [t.p1, t.p2]) {
        // The ordinary door (the standard project's, Colony Contest's, a cell's bonus)…
        expect(seat.colonies.buildBlockedReason(t.luna), seat.color).eq('Colony is full');
        // …and the duplicate-allowing one (Research Colony).
        expect(seat.colonies.buildBlockedReason(t.luna, {allowDuplicate: true}), seat.color).eq('Colony is full');
        const standard = cast(new BuildColony(seat).execute(), SelectColony);
        expect(reasonOf(standard, ColonyName.LUNA), seat.color).eq('Colony is full');
      }
      // Research Colony's own playability reads the same door: with Luna its only hope, it has none.
      t.game.colonies = [t.luna];
      expect(t.p2.colonies.getPlayableColonies(true)).deep.eq([]);
      expect(new ResearchColony().canPlay(t.p2)).is.false;
      expect(new BuildColonyStandardProject().canAct(t.p2)).is.false;
    });

    it('a SECOND copy of the rule cannot make a fifth: the tile stays a candidate only while the track has a cell', () => {
      const t = table();
      playOn(t);
      // (No second copy exists in the deck — the door's own answer is what is pinned.)
      expect(t.p1.colonies.buildBlockedReason(t.luna, {ignoreLimit: true, allowDuplicate: true}), 'the door of this very card').is.undefined;
      t.luna.colonies = Array.from({length: trackTop(t.luna.metadata)}, () => t.p2.id);
      expect(t.p1.colonies.buildBlockedReason(t.luna, {ignoreLimit: true, allowDuplicate: true})).eq(NO_FREE_TRACK_CELL_REASON);
    });

    it('played UNDER the limit it is an ordinary build — a second colony of one\'s own — and the limit stays three', () => {
      const t = table();
      t.ceres.colonies = [t.p1.id];
      const from = t.game.gameLog.length;
      playOn(t, t.ceres);
      expect(t.ceres.colonies).deep.eq([t.p1.id, t.p1.id]);
      expect(t.ceres.isFull()).is.false;
      expect(linesSince(t.game, from)).includes(ORDINARY_LINE).and.does.not.include(BEYOND_LINE);
      // One more ordinary build fills it, and the fourth then needs the card's door again.
      expect(t.p2.colonies.buildBlockedReason(t.ceres)).is.undefined;
      t.ceres.addColony(t.p2);
      expect(t.p2.colonies.buildBlockedReason(t.ceres)).eq('Colony is full');
    });
  });

  describe('rule 5 — the fourth colony\'s build bonus is the tile\'s', () => {
    it('a uniform tile pays its number (Luna: +2 M€ production)', () => {
      const t = table();
      playOn(t);
      expect(t.p1.production.megacredits).eq(2);
    });

    it('a descending row pays its LAST printed cell (Titania 5 / 3 / 2 → 2 VP)', () => {
      const t = table();
      const titania = new Titania();
      titania.colonies = [t.p2.id, t.p2.id, t.p2.id];
      t.game.colonies.push(titania);
      playToPrompt(t).cb(titania);
      runAllActions(t.game);
      expect(t.p1.colonies.victoryPoints).eq(2);
    });

    it('a bonus that ASKS, asks (Titan beyond the limit: 3 floaters on the chosen card)', () => {
      const t = table();
      t.titan.isActive = true;
      t.titan.colonies = [t.p2.id, t.p2.id, t.p2.id];
      const station = new JupiterFloatingStation();
      t.p1.playedCards.push(new Dirigibles(), station);
      playToPrompt(t).cb(t.titan);
      runAllActions(t.game);
      const pick = cast(t.p1.popWaitingFor(), SelectCard);
      pick.cb([station]);
      expect(station.resourceCount).eq(3);
    });
  });

  describe('rule 6 — the track', () => {
    it('a marker that stood on the third cell is lifted to the fourth; a trade brings it back to four', () => {
      const t = table();
      playOn(t);
      expect(t.luna.trackPosition).eq(4);
      t.luna.trackPosition = 6;
      t.luna.trade(t.p2);
      runAllActions(t.game);
      expect(t.luna.trackPosition).eq(4);
      t.luna.decreaseTrack(4);
      expect(t.luna.trackPosition, 'the floor is the number of colonies').eq(4);
    });

    it('THE PHYSICAL LIMIT is not lifted: a track with no cell left is refused by its own reason', () => {
      const t = table();
      t.luna.colonies = Array.from({length: trackTop(t.luna.metadata)}, () => t.p2.id);
      const prompt = playToPrompt(t);
      expect(prompt.colonies).does.not.include(t.luna);
      expect(reasonOf(prompt, ColonyName.LUNA)).eq(NO_FREE_TRACK_CELL_REASON);
    });
  });

  it('rule 7 — a trade pays the owners\' bonus PER CUBE: four cubes, four payouts', () => {
    const t = table();
    playOn(t);
    runAllActions(t.game);
    const before = [t.p1.megaCredits, t.p2.megaCredits];
    const income = t.luna.metadata.trade.quantity[t.luna.trackPosition];
    t.luna.trade(t.p2);
    runAllActions(t.game);
    expect(t.p1.megaCredits - before[0], 'two cubes of the player\'s').eq(4);
    expect(t.p2.megaCredits - before[1], 'two cubes of the rival\'s + the trade income').eq(4 + income);
  });

  it('rule 9 — a tile carrying colonies does not leave the game (TR10), four or one', () => {
    const t = table();
    playOn(t);
    expect(ColoniesHandler.colonyTileOccupiedReason(t.luna)).eq(COLONY_TILE_HAS_COLONIES_REASON);
  });

  describe('rule 11 — unplayable: ONE reason, in order', () => {
    it('nowhere to build: «No colony available to build on» — and it is the card\'s own', () => {
      const t = unityRules();
      t.ceres.isActive = false;
      t.luna.isActive = false;
      expect(t.p1.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.p1, t.card)).deep.eq([{type: 'target', message: NO_COLONY_TO_BUILD_ON_REASON}]);
    });

    it('the requirement comes first, alone, while it is unmet', () => {
      const t = parliamentTable();
      t.ceres.isActive = false;
      t.luna.isActive = false;
      const reasons = unplayableReasons(t.p1, t.card);
      expect(reasons[0].type).eq('party');
    });

    it('in the door every refused tile is named by ITS OWN reason', () => {
      const t = table();
      const full = new Pluto();
      full.colonies = Array.from({length: trackTop(full.metadata)}, () => t.p2.id);
      t.game.colonies.push(full);
      const prompt = playToPrompt(t);
      expect(prompt.disabledColonies.map((d) => [d.colony.name, String(d.reason)])).deep.eq([
        [ColonyName.TITAN, 'Colony is inactive'],
        [ColonyName.PLUTO, NO_FREE_TRACK_CELL_REASON],
      ]);
    });

    it('a play that finds no tile after all is a NAMED skip — the engine\'s floor', () => {
      const t = table();
      t.ceres.isActive = false;
      t.luna.isActive = false;
      const events = t.game.events.events.length;
      t.p1.playCard(t.card);
      runAllActions(t.game);
      expect(t.p1.getWaitingFor()).is.undefined;
      const skipped = t.game.events.events.slice(events).filter((e) => e.type === 'effect-skipped');
      expect(skipped).has.length(1);
      expect(skipped[0].impact.skipped).deep.include({label: BUILD_COLONY_LABEL, reason: NO_COLONY_TO_BUILD_ON_REASON});
    });
  });

  it('rule 12 — a SINGLE candidate is still chosen by a press', () => {
    const t = table();
    t.game.colonies = [t.luna];
    const prompt = playToPrompt(t);
    expect(prompt.colonies).deep.eq([t.luna]);
    expect(t.luna.colonies, 'nothing lands before the answer').has.length(3);
    prompt.cb(t.luna);
    expect(t.luna.colonies).has.length(4);
  });

  describe('rule 13 — the journal names the rule the build lifted', () => {
    it('beyond the limit: its own line instead of the ordinary one', () => {
      const t = table();
      const from = t.game.gameLog.length;
      playOn(t);
      expect(linesSince(t.game, from)).includes(BEYOND_LINE).and.does.not.include(ORDINARY_LINE);
    });
  });

  it('rule 14 — four cubes survive a save / load; nothing is added to the save', () => {
    const t = table();
    playOn(t);
    runAllActions(t.game);
    const serialized = t.game.serialize();
    const saved = serialized.colonies?.find((c) => c.name === ColonyName.LUNA);
    expect(Object.keys(saved!).sort()).deep.eq(['colonies', 'isActive', 'name', 'trackPosition', 'visitor']);
    const restored = Game.deserialize(JSON.parse(JSON.stringify(serialized)));
    const luna = restored.colonies.find((c) => c.name === ColonyName.LUNA)!;
    expect(luna.colonies).deep.eq([t.p2.id, t.p2.id, t.p1.id, t.p1.id]);
    expect(luna.trackPosition).eq(4);
    expect(luna.isFull()).is.true;
  });

  describe('the staged door — the play preview', () => {
    it('one branch, no chips: the DOOR — a `colonyPick` step carrying the card\'s own prompt', () => {
      const t = table();
      const preview = cardPlayPreview(t.p1, t.card);
      expect(preview.branches).has.length(1);
      expect(preview.branches[0].effects, 'the build bonus depends on the tile — the composer promises none').deep.eq([]);
      const step = colonyPickOf(t.p1, t.card)!;
      expect(step.staged.sourceCard).eq(EXCLUSIVE);
      expect(step.staged.prompt.title).eq(EXCLUSIVE_COLONY_TITLE);
      expect(step.staged.prompt.choiceContext?.source).deep.eq({kind: 'card', card: EXCLUSIVE});
    });

    it('the prompt it shows IS the prompt the commit asks — candidates, refusals, `buildSites`', () => {
      const t = table();
      t.ceres.colonies = [t.p1.id];
      const twin = colonyPickOf(t.p1, t.card)!.staged.prompt;
      const live = playToPrompt(t);
      const model = live.toModel(t.p1);
      model.choiceContext = live.choiceContext;
      expect(twin).deep.eq(model);
      expect(twin.buildSites).deep.eq([
        {colony: ColonyName.CERES, slot: 1, overLimit: false, own: 1},
        {colony: ColonyName.LUNA, slot: 3, overLimit: true, own: 1},
      ]);
      expect(twin.disabledColonies).deep.eq([{name: ColonyName.TITAN, reason: 'Colony is inactive'}]);
    });

    it('is read-only', () => {
      const t = table();
      const before = JSON.stringify(t.game.serialize());
      cardPlayPreview(t.p1, t.card);
      colonyPickOf(t.p1, t.card);
      expect(JSON.stringify(t.game.serialize())).eq(before);
    });

    it('with no tile to build on there is no door: the branch carries the NAMED skip the live step records', () => {
      const t = table();
      t.ceres.isActive = false;
      t.luna.isActive = false;
      expect(colonyPickOf(t.p1, t.card)).is.undefined;
      const steps = cardPlayPreview(t.p1, t.card).branches[0].steps;
      const warning = steps.find((s) => s.kind === 'note');
      expect(warning, 'the skip is stated before the commit').is.not.undefined;
      expect(JSON.stringify(warning)).includes(BUILD_COLONY_LABEL).and.includes(NO_COLONY_TO_BUILD_ON_REASON);
    });

    it('the forecast states the colony\'s reactions: Poseidon «will fire», whichever tile is picked', () => {
      const t = table();
      t.p2.playedCards.push(new Poseidon());
      const forecast = effectForecastForPlay(t.p1, t.card, cardPlayPreview(t.p1, t.card));
      const facts = forecast.facts.filter((f) => f.source.name === CardName.POSEIDON);
      expect(facts.map((f) => [f.certainty, f.source.channel, f.recipient.kind])).deep.eq([['exact', 'colony-added', 'player']]);
      expect(facts[0].effects.map((e) => [e.icon, e.amount, e.note])).deep.eq([['megacredits', 1, 'production']]);
      expect(forecast.coverage).eq('complete');
    });
  });
});
