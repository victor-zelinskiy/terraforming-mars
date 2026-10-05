import {expect} from 'chai';
import {BuildColony} from '../../src/server/deferredActions/BuildColony';
import {TestPlayer} from '../TestPlayer';
import {cast} from '@/common/utils/utils';
import {testGame} from '../TestGame';
import {ColonyName} from '../../src/common/colonies/ColonyName';
import {SelectColony} from '../../src/server/inputs/SelectColony';
import {ColoniesHandler} from '../../src/server/colonies/ColoniesHandler';
import {CardName} from '../../src/common/cards/CardName';
import {ChoiceContextSource} from '../../src/common/models/PlayerInputModel';
import {InputError} from '../../src/server/inputs/InputError';
import {NO_FREE_TRACK_CELL_REASON} from '../../src/server/player/Colonies';
import {trackTop} from '../../src/common/colonies/ColonyMetadata';
import {runAllActions, setRulingParty} from '../TestingUtils';
import {PartyName} from '../../src/common/turmoil/PartyName';
import {IGame} from '../../src/server/IGame';

describe('BuildColony', () => {
  let player: TestPlayer;
  let player2: TestPlayer;
  let player3: TestPlayer;

  beforeEach(() => {
    [/* unused */, player, player2, player3] = testGame(3, {
      coloniesExtension: true,
      customColoniesList: [
        // The important thing is that Europa is absent.
        ColonyName.GANYMEDE,
        ColonyName.LUNA,
        ColonyName.PLUTO,
        ColonyName.TITAN,
        ColonyName.TRITON],
    });
  });

  it('simple', () => {
    const ganymede = ColoniesHandler.getColony(player.game, ColonyName.GANYMEDE);
    expect(ganymede.colonies).deep.eq([]);

    const buildColony = new BuildColony(player);
    const selectColony = cast(buildColony.execute(), SelectColony);
    const colonyName = selectColony.colonies[0].name;

    expect(colonyName).eq(ColonyName.GANYMEDE);

    selectColony.cb(selectColony.colonies[0]);

    expect(player.production.plants).eq(1);
    expect(ganymede.colonies).deep.eq([player.id]);
  });

  it('Does not allow duplicates by default', () => {
    const ganymede = ColoniesHandler.getColony(player.game, ColonyName.GANYMEDE);
    ganymede.colonies = [player.id];

    const buildColony = new BuildColony(player);
    const selectColony = cast(buildColony.execute(), SelectColony);

    expect(selectColony.colonies).does.not.include(ganymede);
  });

  it('Cannot play on full colonies', () => {
    const ganymede = ColoniesHandler.getColony(player.game, ColonyName.GANYMEDE);
    ganymede.colonies = [player2.id, player3.id, player2.id];

    const buildColony = new BuildColony(player);
    const selectColony = cast(buildColony.execute(), SelectColony);

    expect(selectColony.colonies).does.not.include(ganymede);
  });

  it('Cannot play on full colonies, even if duplicates are allowed', () => {
    const ganymede = ColoniesHandler.getColony(player.game, ColonyName.GANYMEDE);
    ganymede.colonies = [player2.id, player3.id, player2.id];

    const buildColony = new BuildColony(player, {allowDuplicate: true});
    const selectColony = cast(buildColony.execute(), SelectColony);

    expect(selectColony.colonies).does.not.include(ganymede);
  });

  it('allows duplicates', () => {
    const ganymede = ColoniesHandler.getColony(player.game, ColonyName.GANYMEDE);
    ganymede.colonies = [player.id];

    const buildColony = new BuildColony(player, {allowDuplicate: true});
    const selectColony = cast(buildColony.execute(), SelectColony);
    const colonyName = selectColony.colonies[0].name;

    expect(colonyName).eq(ColonyName.GANYMEDE);

    selectColony.cb(selectColony.colonies[0]);

    expect(player.production.plants).eq(1);
    expect(ganymede.colonies).deep.eq([player.id, player.id]);
  });

  /*
   * THE 3-COLONY LIMIT IS A RULE OF THE DOOR (docs/TURMOIL_REDUX_EXCLUSIVE_COLONY.md):
   * `ignoreLimit` lifts «Colony is full» and nothing else, independently of
   * `allowDuplicate` — the two printed clauses of Turmoil Redux TR25.
   */
  describe('the door that lifts the 3-colony limit — `ignoreLimit`', () => {
    function reasonOf(select: SelectColony, name: ColonyName): string | undefined {
      const entry = select.disabledColonies.find((d) => d.colony.name === name);
      return entry === undefined ? undefined : String(entry.reason);
    }

    it('ignoreLimit × allowDuplicate on a FULL tile carrying the player\'s own cube — four doors, four answers', () => {
      const ganymede = ColoniesHandler.getColony(player.game, ColonyName.GANYMEDE);
      ganymede.colonies = [player2.id, player.id, player3.id];

      // Neither: the ordinary door — full comes first.
      const plain = cast(new BuildColony(player).execute(), SelectColony);
      expect(plain.colonies).does.not.include(ganymede);
      expect(reasonOf(plain, ColonyName.GANYMEDE)).eq('Colony is full');

      // Duplicates alone: still full.
      const duplicate = cast(new BuildColony(player, {allowDuplicate: true}).execute(), SelectColony);
      expect(duplicate.colonies).does.not.include(ganymede);
      expect(reasonOf(duplicate, ColonyName.GANYMEDE)).eq('Colony is full');

      // The limit alone: the tile is no longer full for this door — but it is already the player's.
      const limit = cast(new BuildColony(player, {ignoreLimit: true}).execute(), SelectColony);
      expect(limit.colonies).does.not.include(ganymede);
      expect(reasonOf(limit, ColonyName.GANYMEDE)).eq('You already have a colony here');

      // Both — the card's two clauses: the tile is a candidate.
      const both = cast(new BuildColony(player, {ignoreLimit: true, allowDuplicate: true}).execute(), SelectColony);
      expect(both.colonies).includes(ganymede);
      expect(reasonOf(both, ColonyName.GANYMEDE)).is.undefined;
    });

    it('a full tile WITHOUT the player\'s cube opens with `ignoreLimit` alone', () => {
      const ganymede = ColoniesHandler.getColony(player.game, ColonyName.GANYMEDE);
      ganymede.colonies = [player2.id, player3.id, player2.id];
      const select = cast(new BuildColony(player, {ignoreLimit: true}).execute(), SelectColony);
      expect(select.colonies).includes(ganymede);
    });

    it('builds the fourth colony: the cube lands, the tile\'s bonus is paid, the marker follows', () => {
      const ganymede = ColoniesHandler.getColony(player.game, ColonyName.GANYMEDE);
      ganymede.colonies = [player2.id, player.id, player3.id];
      ganymede.trackPosition = 3;
      const select = cast(new BuildColony(player, {ignoreLimit: true, allowDuplicate: true}).execute(), SelectColony);
      select.cb(ganymede);
      expect(ganymede.colonies).deep.eq([player2.id, player.id, player3.id, player.id]);
      expect(player.production.plants, 'Ganymede\'s build bonus').eq(1);
      expect(ganymede.trackPosition).eq(4);
    });

    it('an INACTIVE tile is still refused — the door lifts two rules, not this one', () => {
      const titan = ColoniesHandler.getColony(player.game, ColonyName.TITAN);
      titan.isActive = false;
      const select = cast(new BuildColony(player, {ignoreLimit: true, allowDuplicate: true}).execute(), SelectColony);
      expect(select.colonies).does.not.include(titan);
      expect(reasonOf(select, ColonyName.TITAN)).eq('Colony is inactive');
    });

    it('a track with no cell left for a cube is refused by every door, by its own reason', () => {
      const ganymede = ColoniesHandler.getColony(player.game, ColonyName.GANYMEDE);
      ganymede.colonies = Array.from({length: trackTop(ganymede.metadata)}, () => player2.id);
      const select = cast(new BuildColony(player, {ignoreLimit: true, allowDuplicate: true}).execute(), SelectColony);
      expect(select.colonies).does.not.include(ganymede);
      expect(reasonOf(select, ColonyName.GANYMEDE)).eq(NO_FREE_TRACK_CELL_REASON);
    });

    it('the upstream positional form of getPlayableColonies still reads the same door', () => {
      const ganymede = ColoniesHandler.getColony(player.game, ColonyName.GANYMEDE);
      ganymede.colonies = [player2.id, player.id, player3.id];
      expect(player.colonies.getPlayableColonies()).does.not.include(ganymede);
      expect(player.colonies.getPlayableColonies(true)).does.not.include(ganymede);
      expect(player.colonies.getPlayableColonies({ignoreLimit: true})).does.not.include(ganymede);
      expect(player.colonies.getPlayableColonies({ignoreLimit: true, allowDuplicate: true})).includes(ganymede);
    });
  });

  describe('the TR a build bonus costs is still asked (Europa under Reds)', () => {
    let game: IGame;
    let rich: TestPlayer;

    beforeEach(() => {
      [game, rich] = testGame(2, {
        coloniesExtension: true,
        turmoilExtension: true,
        customColoniesList: [ColonyName.EUROPA, ColonyName.LUNA, ColonyName.PLUTO, ColonyName.TITAN, ColonyName.TRITON],
      });
      setRulingParty(game, PartyName.REDS);
    });

    it('a door that lifts both printed rules does not lift the Reds\' tax', () => {
      const europa = ColoniesHandler.getColony(game, ColonyName.EUROPA);
      rich.megaCredits = 0;
      const poor = cast(new BuildColony(rich, {ignoreLimit: true, allowDuplicate: true}).execute(), SelectColony);
      expect(poor.colonies).does.not.include(europa);
      expect(String(poor.disabledColonies.find((d) => d.colony === europa)?.reason)).eq('Cannot afford the TR increase to build here');
      rich.megaCredits = 3;
      const paid = cast(new BuildColony(rich, {ignoreLimit: true, allowDuplicate: true}).execute(), SelectColony);
      expect(paid.colonies).includes(europa);
    });

    it('the PREVIEW folds the unpaid price of the card in — the live step does not', () => {
      const europa = ColoniesHandler.getColony(game, ColonyName.EUROPA);
      rich.megaCredits = 10;
      const live = new BuildColony(rich, {ignoreLimit: true}).previewSelectColony();
      expect(live?.coloniesModel.map((c) => c.name)).includes(europa.name);
      const preview = new BuildColony(rich, {ignoreLimit: true, canAffordOptions: {cost: 10}}).previewSelectColony();
      expect(preview?.coloniesModel.map((c) => c.name)).does.not.include(europa.name);
    });
  });

  /*
   * THE MARKER (`SelectColonyModel.buildSites`) — what makes the pick's act
   * `build` on the client, and the server's projection of the berth on every
   * candidate. It rides EVERY build prompt.
   */
  describe('the `buildSites` marker', () => {
    it('one entry per candidate: the berth, beyond the limit or not, the player\'s own cubes', () => {
      const ganymede = ColoniesHandler.getColony(player.game, ColonyName.GANYMEDE);
      const luna = ColoniesHandler.getColony(player.game, ColonyName.LUNA);
      const pluto = ColoniesHandler.getColony(player.game, ColonyName.PLUTO);
      ganymede.colonies = [player2.id, player.id, player3.id];
      luna.colonies = [player.id];
      pluto.colonies = [player2.id, player3.id];
      const select = cast(new BuildColony(player, {ignoreLimit: true, allowDuplicate: true}).execute(), SelectColony);
      const sites = select.toModel(player).buildSites ?? [];
      expect(sites.map((site) => site.colony)).deep.eq(select.colonies.map((c) => c.name));
      expect(sites.find((site) => site.colony === ColonyName.GANYMEDE)).deep.eq({colony: ColonyName.GANYMEDE, slot: 3, overLimit: true, own: 1});
      expect(sites.find((site) => site.colony === ColonyName.LUNA)).deep.eq({colony: ColonyName.LUNA, slot: 1, overLimit: false, own: 1});
      expect(sites.find((site) => site.colony === ColonyName.PLUTO)).deep.eq({colony: ColonyName.PLUTO, slot: 2, overLimit: false, own: 0});
    });

    it('rides the ordinary build prompt too — and that prompt carries nothing else new', () => {
      const select = cast(new BuildColony(player).execute(), SelectColony);
      const model = select.toModel(player);
      expect(model.buildSites, 'every build prompt is marked').has.length(select.colonies.length);
      expect(model.buildSites?.every((site) => !site.overLimit && site.own === 0)).is.true;
      // The ordinary prompt, field for field: no giver, no cancel context, no other marker
      // (`disabledColonies` — Titan, inactive at this table — is the prompt's own).
      expect(Object.keys(model).sort()).deep.eq(['buildSites', 'buttonLabel', 'coloniesModel', 'disabledColonies', 'purpose', 'title', 'type']);
      expect(model.title).eq('Select where to build a colony');
      expect(model.buttonLabel).eq('Build');
      expect(select.choiceContext).is.undefined;
    });

    it('a caller\'s own subset is marked too (the standard project, Pioneer Settlement)', () => {
      const luna = ColoniesHandler.getColony(player.game, ColonyName.LUNA);
      const select = cast(new BuildColony(player, {colonies: [luna]}).execute(), SelectColony);
      expect(select.toModel(player).buildSites).deep.eq([{colony: ColonyName.LUNA, slot: 0, overLimit: false, own: 0}]);
    });
  });

  /*
   * A CARD's build (`cause`) — the staged colony door's contract: the prompt
   * names its giver (the address of the staged tail), the read-only twin is
   * the live prompt field for field, a build with no tile is a NAMED skip and
   * the door is re-read at the answer.
   */
  describe('a card\'s build — `cause`', () => {
    const CAUSE: ChoiceContextSource = {kind: 'card', card: CardName.MINING_COLONY};

    it('the prompt names its giver', () => {
      const select = cast(new BuildColony(player, {cause: CAUSE}).execute(), SelectColony);
      expect(select.choiceContext).deep.eq({source: CAUSE, mode: 'effect-choice'});
    });

    it('the read-only twin IS the live prompt, field for field — and touches nothing', () => {
      const ganymede = ColoniesHandler.getColony(player.game, ColonyName.GANYMEDE);
      ganymede.colonies = [player2.id, player.id, player3.id];
      const options = {ignoreLimit: true, allowDuplicate: true, cause: CAUSE, title: 'Select where to build the colony'};
      const before = JSON.stringify(player.game.serialize());
      const twin = new BuildColony(player, options).previewSelectColony();
      expect(JSON.stringify(player.game.serialize()), 'the twin is read-only').eq(before);
      const live = cast(new BuildColony(player, options).execute(), SelectColony);
      const model = live.toModel(player);
      model.choiceContext = live.choiceContext;
      expect(twin).deep.eq(model);
      expect(twin?.choiceContext?.source).deep.eq(CAUSE);
    });

    it('no tile takes the colony: the twin has no prompt and promises the skip the live step records', () => {
      for (const colony of player.game.colonies) {
        colony.isActive = false;
      }
      const step = new BuildColony(player, {ignoreLimit: true, allowDuplicate: true, cause: CAUSE});
      expect(step.previewSelectColony()).is.undefined;
      const promised = step.previewSkip();
      expect(promised).deep.eq({reason: 'No colony available to build on', skipped: {label: 'Build a colony'}});
      const events = player.game.events.events.length;
      expect(step.execute()).is.undefined;
      const recorded = player.game.events.events.slice(events).filter((e) => e.type === 'effect-skipped');
      expect(recorded).has.length(1);
      expect(recorded[0].impact.skipped).deep.include({label: promised.skipped.label, reason: promised.reason});
    });

    it('…while a build with no giver stays silent there, as it always was', () => {
      for (const colony of player.game.colonies) {
        colony.isActive = false;
      }
      const events = player.game.events.events.length;
      expect(new BuildColony(player).execute()).is.undefined;
      expect(player.game.events.events.slice(events).filter((e) => e.type === 'effect-skipped')).has.length(0);
    });

    it('the door is re-read at the ANSWER: a tile that closed meanwhile is refused, and nothing is built', () => {
      const ganymede = ColoniesHandler.getColony(player.game, ColonyName.GANYMEDE);
      const select = cast(new BuildColony(player, {cause: CAUSE}).execute(), SelectColony);
      expect(select.colonies).includes(ganymede);
      // The world moves between the question and the answer.
      ganymede.colonies = [player2.id, player3.id, player2.id];
      expect(() => select.cb(ganymede)).to.throw(InputError, 'Colony is full');
      expect(ganymede.colonies).deep.eq([player2.id, player3.id, player2.id]);
      expect(player.production.plants).eq(0);
      runAllActions(player.game);
    });
  });
});
