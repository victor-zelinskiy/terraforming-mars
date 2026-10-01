import {expect} from 'chai';
import {SelectColony} from '../../src/server/inputs/SelectColony';
import {ColonyName} from '../../src/common/colonies/ColonyName';
import {IColony} from '../../src/server/colonies/IColony';
import {Luna} from '../../src/server/colonies/Luna';
import {Pluto} from '../../src/server/colonies/Pluto';
import {CardName} from '../../src/common/cards/CardName';
import {InputResponse, isSelectColonyResponse} from '../../src/common/inputs/InputResponse';
import {SelectColonyModel} from '../../src/common/models/PlayerInputModel';
import {InputError} from '../../src/server/inputs/InputError';
import {testGame} from '../TestGame';

describe('SelectColony', () => {
  let luna: Luna;
  let pluto: Pluto;
  let selected: IColony | undefined;
  const cb = (colony: IColony) => {
    selected = colony;
    return undefined;
  };

  beforeEach(() => {
    luna = new Luna();
    pluto = new Pluto();
    selected = undefined;
  });

  it('Simple', () => {
    const selectColony = new SelectColony('', '', [luna, pluto]).andThen(cb);
    selectColony.process({type: 'colony', colonyName: ColonyName.LUNA});
    expect(selected!.name).eq(luna.name);
  });

  it('Cannot select unavailable colony', () => {
    const selectColony = new SelectColony('', '', [luna, pluto]).andThen(cb);
    selectColony.process({type: 'colony', colonyName: ColonyName.LUNA});
    expect(selected!.name).eq(luna.name);
    expect(() => selectColony.process({type: 'colony', colonyName: ColonyName.ENCELADUS}))
      .to.throw(Error, /Colony Enceladus not found/);
  });

  /**
   * THE SECOND FORM OF THE ANSWER — a fleet-dock CARD in place of a colony
   * (`{type: 'colony', fleetDock}`): exactly one of the two fields, a dock the
   * prompt's own marker lists as available, its handler the twin of `cb`.
   */
  describe('the answer\'s two forms — a colony tile OR a fleet-dock card', () => {
    const DOCK = CardName.SKY_DOCKS; // any card name — the input knows docks by the marker alone
    let docked: CardName | undefined;

    function pick(available: boolean, reason?: string): SelectColony {
      const selectColony = new SelectColony('', '', [luna, pluto]).andThen(cb);
      selectColony.fleetDocks = [{card: DOCK, available, effects: [], ...(reason !== undefined ? {reason} : {})}];
      selectColony.onFleetDock = (card) => {
        docked = card;
        return undefined;
      };
      return selectColony;
    }

    beforeEach(() => {
      docked = undefined;
    });

    it('the validator accepts each form alone and rejects both at once, neither, and a stray field', () => {
      expect(isSelectColonyResponse({type: 'colony', colonyName: ColonyName.LUNA})).is.true;
      expect(isSelectColonyResponse({type: 'colony', fleetDock: DOCK})).is.true;
      const loose = (value: unknown) => isSelectColonyResponse(value as InputResponse);
      expect(loose({type: 'colony', colonyName: ColonyName.LUNA, fleetDock: DOCK}), 'both').is.false;
      expect(loose({type: 'colony'}), 'neither').is.false;
      expect(loose({type: 'colony', fleetDock: DOCK, extra: 1}), 'a stray field').is.false;
      expect(loose({type: 'card', fleetDock: DOCK}), 'another type').is.false;
    });

    it('a dock answer reaches the dock handler, never the colony callback', () => {
      pick(true).process({type: 'colony', fleetDock: DOCK});
      expect(docked).eq(DOCK);
      expect(selected).is.undefined;
    });

    it('a colony answer on the same pick is the colony callback, as ever', () => {
      pick(true).process({type: 'colony', colonyName: ColonyName.PLUTO});
      expect(selected!.name).eq(pluto.name);
      expect(docked).is.undefined;
    });

    it('an UNAVAILABLE dock is refused with its own reason, and the handler never runs', () => {
      expect(() => pick(false, 'The trade fleet is already on this card this generation').process({type: 'colony', fleetDock: DOCK}))
        .to.throw(InputError, 'The trade fleet is already on this card this generation');
      expect(docked).is.undefined;
    });

    it('a card the marker does not list is refused; so is any dock on a pick that lists none', () => {
      expect(() => pick(true).process({type: 'colony', fleetDock: CardName.ANTS})).to.throw(InputError, /Fleet dock Ants not found/);
      const plain = new SelectColony('', '', [luna]).andThen(cb);
      expect(() => plain.process({type: 'colony', fleetDock: DOCK})).to.throw(InputError, /Fleet dock Sky Docks not found/);
    });

    it('both fields at once never reach a handler', () => {
      expect(() => pick(true).process({type: 'colony', colonyName: ColonyName.LUNA, fleetDock: DOCK} as unknown as InputResponse))
        .to.throw(InputError, /Not a valid SelectColonyResponse/);
      expect(selected).is.undefined;
      expect(docked).is.undefined;
    });

    it('the marker is published only when the pick carries docks', () => {
      const [, player] = testGame(1, {coloniesExtension: true});
      const plain = new SelectColony('', '', []).toModel(player) as SelectColonyModel;
      expect(plain.fleetDocks).is.undefined;
      const marked = pick(true).toModel(player) as SelectColonyModel;
      expect(marked.fleetDocks).deep.eq([{card: DOCK, available: true, effects: []}]);
    });
  });
});
