import {expect} from 'chai';
import {TestPlayer} from '../../TestPlayer';
import {testGame} from '../../TestGame';
import {Phase} from '../../../src/common/Phase';
import {WorldGovernmentAdvisor} from '../../../src/server/cards/prelude2/WorldGovernmentAdvisor';
import {IGame} from '../../../src/server/IGame';
import {maxOutOceans, runAllActions, setOxygenLevel, setTemperature} from '../../TestingUtils';
import {OrOptions} from '../../../src/server/inputs/OrOptions';
import {assertPlaceOcean} from '../../assertions';
import {SelectSpace} from '../../../src/server/inputs/SelectSpace';
import {TileType} from '../../../src/common/TileType';
import {MAX_OXYGEN_LEVEL, MAX_TEMPERATURE} from '../../../src/common/constants';
import {cast} from '../../../src/common/utils/utils';
import {CardName} from '../../../src/common/cards/CardName';
import {GlobalParameter} from '../../../src/common/GlobalParameter';
import {WORLD_GOVERNMENT_ACTING_REASON} from '../../../src/server/Game';
import {Server} from '../../../src/server/models/ServerModel';
import {actionPreview} from '../../../src/server/models/actionPreview';
import {actionFutility} from '../../../src/server/models/actionFutility';
import {effectForecastForAction} from '../../../src/server/models/effectForecast';
import {boardCellPreview} from '../../../src/server/boards/BoardInformationEngine';
import {Aphrodite} from '../../../src/server/cards/venusNext/Aphrodite';
import {
  WORLD_ALL_MAXED_REASON, WORLD_BONUS_OCEAN_NOTE, WORLD_BONUS_TEMPERATURE_NOTE, WORLD_LAST_STEP_NOTE,
  WORLD_MOVE_NO_CELL_BONUS_NOTE, WORLD_MOVE_NO_HEAT_NOTE, WORLD_MOVE_NO_VENUS_CARD_NOTE,
} from '../../../src/server/cards/prelude2/WorldGovernmentAdvisor';

describe('WorldGovernmentAdvisor', () => {
  let card: WorldGovernmentAdvisor;
  let player: TestPlayer;
  let game: IGame;

  beforeEach(() => {
    card = new WorldGovernmentAdvisor();
    [game, player] = testGame(1);
  });

  it('play', () => {
    cast(card.play(player), undefined);
    expect(player.terraformRating).eq(16);
    expect(player.cardsInHand).has.length(1);
  });

  it('action', () => {
    game.phase = Phase.ACTION;
    cast(card.action(player), undefined);
    runAllActions(game);
    const orOptions = cast(player.popWaitingFor(), OrOptions);

    expect(game.phase).eq(Phase.SOLAR);
    expect(orOptions.options[0].title).eq('Increase temperature');
    expect(player.terraformRating).eq(14);

    orOptions.options[0].cb();
    orOptions.cb(undefined);

    runAllActions(game);

    cast(player.popWaitingFor(), undefined);
    expect(game.phase).eq(Phase.ACTION);
    expect(player.terraformRating).eq(14);
    expect(game.getTemperature()).eq(-28);

    // After this player raises temperature and it rewards them.
    game.increaseTemperature(player, 1);
    expect(player.terraformRating).eq(15);
    expect(game.getTemperature()).eq(-26);
  });

  it('action - placing an ocean', () => {
    game.phase = Phase.ACTION;
    cast(card.action(player), undefined);
    runAllActions(game);
    const orOptions = cast(player.popWaitingFor(), OrOptions);


    expect(game.phase).eq(Phase.SOLAR);
    expect(orOptions.options[2].title).eq('Add an ocean');

    const selectSpace = cast(orOptions.options[2], SelectSpace);
    orOptions.cb(undefined);
    assertPlaceOcean(player, selectSpace);

    runAllActions(game);

    cast(player.popWaitingFor(), undefined);
    expect(player.terraformRating).eq(14);
  });

  it('action - placing an ocean', () => {
    cast(card.action(player), undefined);
    runAllActions(game);
    const orOptions = cast(player.popWaitingFor(), OrOptions);

    const oceanSpace = game.board.getAvailableSpacesForOcean(player)[0];
    const adjacentSpace = game.board.getAdjacentSpaces(oceanSpace)[0];
    game.simpleAddTile(player, adjacentSpace, {tileType: TileType.OCEAN});

    const selectSpace = cast(orOptions.options[2], SelectSpace);
    orOptions.cb(undefined);
    selectSpace.cb(oceanSpace);

    runAllActions(game);

    cast(player.popWaitingFor(), undefined);
    expect(player.terraformRating).eq(14);
    expect(player.megaCredits).eq(0);
  });

  it('action - raise temperature to 0', () => {
    cast(card.action(player), undefined);
    runAllActions(game);
    const orOptions = cast(player.popWaitingFor(), OrOptions);

    setTemperature(game, -2);
    orOptions.options[0].cb();
    orOptions.cb(undefined);
    runAllActions(game);

    assertPlaceOcean(player, player.popWaitingFor());

    runAllActions(game);

    cast(player.popWaitingFor(), undefined);
    expect(player.terraformRating).eq(14);
  });

  it('canAct - game is at maximum', () => {
    setTemperature(game, MAX_TEMPERATURE);
    setOxygenLevel(game, MAX_OXYGEN_LEVEL);
    maxOutOceans(player);

    expect(card.canAct(player)).is.true;
    expect(card.warnings.has('marsIsTerraformed')).is.true;
  });

  it('action - game is at maximum', () => {
    setTemperature(game, MAX_TEMPERATURE);
    setOxygenLevel(game, MAX_OXYGEN_LEVEL);
    maxOutOceans(player);

    cast(card.action(player), undefined);
    runAllActions(game);
    cast(player.popWaitingFor(), undefined);
  });
});

// ── THE FORK (P67 · ledgers GK + GL) — the upstream block above stays byte for byte ────────────────────────────────

describe('WorldGovernmentAdvisor — the World Government acts in the middle of the action phase', () => {
  let card: WorldGovernmentAdvisor;
  let player: TestPlayer;
  let rival: TestPlayer;
  let game: IGame;
  const OWN = {source: 'card', card: CardName.WORLD_GOVERNMENT_ADVISOR} as const;

  beforeEach(() => {
    card = new WorldGovernmentAdvisor();
    [game, player, rival] = testGame(2, {venusNextExtension: true});
    game.phase = Phase.ACTION;
    player.playedCards.push(card);
  });

  function question(): OrOptions {
    cast(card.action(player), undefined);
    runAllActions(game);
    return cast(player.popWaitingFor(), OrOptions);
  }

  it('the question is MARKED as this card\'s (never read by its title), addressed to it, and every option names its parameter', () => {
    const or = question();
    expect(or.worldGovernmentPrompt).deep.eq(OWN);
    expect(or.choiceContext?.source).deep.eq({kind: 'card', card: CardName.WORLD_GOVERNMENT_ADVISOR});
    expect(or.options.map((o) => o.annotation)).deep.eq([GlobalParameter.TEMPERATURE, GlobalParameter.OXYGEN, GlobalParameter.OCEANS, GlobalParameter.VENUS]);
    const ocean = cast(or.options[2], SelectSpace);
    expect(ocean.placementContext).deep.eq({cancellable: false, reason: WORLD_GOVERNMENT_ACTING_REASON, source: {kind: 'card', card: CardName.WORLD_GOVERNMENT_ADVISOR}});
    expect(or.toModel(player).worldGovernmentPrompt).deep.eq(OWN);
  });

  it('the generation\'s own World Government step keeps its own marker and names the government as the ocean\'s source', () => {
    const or = game.worldGovernmentTerraformingInput(player);
    expect(or.worldGovernmentPrompt).deep.eq({source: 'solar-phase'});
    expect(or.choiceContext).is.undefined;
    expect(cast(or.options[2], SelectSpace).placementContext?.source).deep.eq({kind: 'system', name: 'World Government'});
  });

  it('`worldGovernmentAct` stands exactly while the borrowed phase does — the question, then the 0 °C ocean — and the model says so', () => {
    setTemperature(game, -2);
    const or = question();
    expect(game.worldGovernmentAct?.player).eq(player);
    expect(game.worldGovernmentAct?.asker).deep.eq(OWN);
    expect(Server.getGameModel(game).worldGovernmentAct).deep.eq({player: player.color, asker: OWN});
    or.options[0].cb();
    runAllActions(game);
    const ocean = cast(player.popWaitingFor(), SelectSpace);
    expect(game.phase).eq(Phase.SOLAR);
    expect(game.worldGovernmentAct).is.not.undefined;
    ocean.cb(ocean.spaces[0]);
    runAllActions(game);
    expect(game.phase).eq(Phase.ACTION);
    expect(game.worldGovernmentAct).is.undefined;
    expect(Server.getGameModel(game).worldGovernmentAct).is.undefined;
    expect(player.terraformRating).eq(20);
  });

  it('no save is taken while the borrowed phase stands (A10): the action saves once its deferred queue — the restore included — has drained', () => {
    const phases: Array<Phase> = [];
    const save = game.save.bind(game);
    game.save = () => {
      phases.push(game.phase);
      save();
    };
    const or = question();
    or.options[0].cb();
    runAllActions(game);
    expect(phases).deep.eq([]);
    player.takeAction();
    expect(phases.every((p) => p !== Phase.SOLAR)).is.true;
  });

  describe('the preview IS the live question — branches in the printed order, each with its live index', () => {
    it('ocean · oxygen · temperature · Venus, every chip a World Government move with no rating after it', () => {
      const preview = actionPreview(player, card);
      expect(preview.branches.map((b) => b.title)).deep.eq(['Add an ocean', 'Increase oxygen', 'Increase temperature', 'Increase Venus scale']);
      const live = game.worldGovernmentTerraformingInput(player, OWN);
      for (const branch of preview.branches) {
        expect(live.options[branch.index].title, String(branch.title)).eq(branch.title);
        expect(branch.effects.every((e) => e.world === true), String(branch.title)).is.true;
        expect(branch.effects.some((e) => e.icon === 'tr'), String(branch.title)).is.false;
        expect(branch.for).deep.eq({role: 'or', source: {kind: 'card', card: CardName.WORLD_GOVERNMENT_ADVISOR}});
      }
      expect(preview.branches[2].effects[0]).deep.include({icon: 'temperature', current: -30, resulting: -28, world: true});
      // A plain step names nothing: «as the World Government, no TR» is the card's own rule line above the tiles.
      expect(preview.branches[2].effects[0].note).is.undefined;
    });

    it('the pre-collected answer lands on the live question and raises the branch\'s parameter — no TR', () => {
      const oxygen = actionPreview(player, card).branches.find((b) => b.title === 'Increase oxygen')!;
      const or = question();
      or.process({type: 'or', index: oxygen.index, response: {type: 'option'}}, player);
      runAllActions(game);
      expect(game.getOxygenLevel()).eq(1);
      expect(player.terraformRating).eq(20);
      expect(game.phase).eq(Phase.ACTION);
    });

    it('the ocean\'s cell is a staged pick NESTED in the branch pick, read in the government\'s mode; the nested answer pays nothing', () => {
      const ocean = actionPreview(player, card).branches[0];
      const step = ocean.steps.find((s) => s.kind === 'boardPlacement');
      const staged = step?.kind === 'boardPlacement' ? step.staged : undefined;
      expect(staged?.nestedInBranch).is.true;
      expect(staged?.government).is.true;
      expect(ocean.effects[0]).deep.include({icon: 'oceans', note: WORLD_MOVE_NO_CELL_BONUS_NOTE});
      const or = question();
      const before = player.megaCredits;
      or.process({type: 'or', index: ocean.index, response: {type: 'space', spaceId: staged!.spaces[0]}}, player);
      runAllActions(game);
      expect(game.board.getOceanSpaces()).has.length(1);
      expect(player.terraformRating).eq(20);
      expect(player.megaCredits).eq(before);
    });

    it('a parameter at its maximum is SHOWN refused with its reason; the live indices of the rest still match', () => {
      setOxygenLevel(game, MAX_OXYGEN_LEVEL);
      const preview = actionPreview(player, card);
      const oxygen = preview.branches.find((b) => b.title === 'Increase oxygen')!;
      expect(oxygen.available).is.false;
      expect(oxygen.unavailableReason).eq('Oxygen is at its maximum');
      const live = game.worldGovernmentTerraformingInput(player, OWN);
      for (const branch of preview.branches.filter((b) => b.available)) {
        expect(live.options[branch.index].title).eq(branch.title);
      }
    });

    it('without Venus Next the Venus branch is not printed', () => {
      const [g2, p2] = testGame(1);
      g2.phase = Phase.ACTION;
      expect(actionPreview(p2, card).branches.map((b) => b.title)).deep.eq(['Add an ocean', 'Increase oxygen', 'Increase temperature']);
    });

    it('the EDGES name themselves: −2 °C sets off the government\'s ocean, −26 °C withholds the heat production, 7 % oxygen the temperature step', () => {
      setTemperature(game, -2);
      let temperature = actionPreview(player, card).branches[2].effects;
      expect(temperature.map((e) => e.icon)).deep.eq(['temperature', 'oceans']);
      expect(temperature[1]).deep.include({world: true, note: WORLD_BONUS_OCEAN_NOTE});
      setTemperature(game, -26);
      temperature = actionPreview(player, card).branches[2].effects;
      expect(temperature[0].note).eq(WORLD_MOVE_NO_HEAT_NOTE);
      setOxygenLevel(game, 7);
      const oxygen = actionPreview(player, card).branches[1].effects;
      expect(oxygen.map((e) => e.icon)).deep.eq(['oxygen', 'temperature']);
      expect(oxygen[1].note).eq(WORLD_BONUS_TEMPERATURE_NOTE);
      // …and the engine does exactly that: the 8 % step's temperature step, for nobody.
      const or = question();
      or.process({type: 'or', index: 1, response: {type: 'option'}}, player);
      runAllActions(game);
      expect(game.getOxygenLevel()).eq(8);
      expect(game.getTemperature()).eq(-24);
      expect(player.terraformRating).eq(20);
      expect(player.production.heat).eq(0);
    });

    it('Venus 6 → 8 % withholds the card; the last Martian step says Mars is terraformed', () => {
      game.increaseVenusScaleLevel(rival, 3);
      expect(actionPreview(player, card).branches[3].effects[0].note).eq(WORLD_MOVE_NO_VENUS_CARD_NOTE);
      setTemperature(game, MAX_TEMPERATURE);
      maxOutOceans(player);
      setOxygenLevel(game, MAX_OXYGEN_LEVEL - 1);
      const oxygen = actionPreview(player, card).branches[1];
      expect(oxygen.steps.some((s) => s.kind === 'note' && s.text === WORLD_LAST_STEP_NOTE)).is.true;
    });
  });

  it('a rival\'s Aphrodite answers the Venus branch (the forecast by branch) — and is paid; no rating answer anywhere', () => {
    rival.playedCards.push(new Aphrodite());
    const preview = actionPreview(player, card);
    const forecast = effectForecastForAction(player, card, preview);
    const venusPos = preview.branches.findIndex((b) => b.title === 'Increase Venus scale');
    const answers = forecast.byBranch?.[venusPos] ?? [];
    expect(answers.some((f) => f.source.name === CardName.APHRODITE && f.recipient.kind === 'player')).is.true;
    const before = rival.megaCredits;
    const or = question();
    or.process({type: 'or', index: preview.branches[venusPos].index, response: {type: 'option'}}, player);
    runAllActions(game);
    expect(rival.megaCredits).eq(before + 2);
    expect(player.terraformRating).eq(20);
  });

  it('everything at the maximum: one empty branch, the action legal, the futility verdict names it', () => {
    setTemperature(game, MAX_TEMPERATURE);
    setOxygenLevel(game, MAX_OXYGEN_LEVEL);
    maxOutOceans(player);
    while (game.getVenusScaleLevel() < 30) {
      game.increaseVenusScaleLevel(rival, 3);
    }
    const preview = actionPreview(player, card);
    expect(preview.branches).has.length(1);
    expect(preview.branches[0].available).is.true;
    expect(preview.branches[0].futile?.reason).eq(WORLD_ALL_MAXED_REASON);
    expect(actionFutility(player, card)?.verdict?.kind).eq('parameter-maxed');
  });

  it('the cell dossier in the government\'s mode promises nobody anything — no printed bonus, no rating', () => {
    const space = game.board.getAvailableSpacesForOcean(player).find((s) => s.bonus.length > 0)!;
    const gains = (government: boolean) => {
      const p = boardCellPreview(player, space, 'ocean', {government});
      return [...p.immediateFacts, ...p.recipientFacts].filter((f) => f.recipient.kind === 'current-player' && f.delta?.direction === 'gain' && f.id !== 'effect-ocean');
    };
    expect(gains(false)).is.not.empty;
    expect(gains(true)).is.empty;
  });
});
