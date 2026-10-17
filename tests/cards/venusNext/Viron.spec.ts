import {expect} from 'chai';
import {RestrictedArea} from '../../../src/server/cards/base/RestrictedArea';
import {Viron} from '../../../src/server/cards/venusNext/Viron';
import {testGame} from '../../TestGame';
import {SelectCard} from '../../../src/server/inputs/SelectCard';
import {TestPlayer} from '../../TestPlayer';
import {cast} from '@/common/utils/utils';
import {FocusedOrganization} from '../../../src/server/cards/prelude2/FocusedOrganization';
import {CargoMechs} from '../../../src/server/cards/turmoilRedux/CargoMechs';
import {repeatableActionCards} from '../../../src/server/cards/repeatableActions';
import {CardName} from '../../../src/common/cards/CardName';

describe('Viron', () => {
  let card: Viron;
  let player: TestPlayer;

  beforeEach(() => {
    card = new Viron();
    [/* game */, player] = testGame(1);
  });

  it('Should act', () => {
    const action = card.play(player);

    cast(action, undefined);

    player.playedCards.push(card);
    const restrictedArea = new RestrictedArea();
    player.playedCards.push(restrictedArea);
    player.actionsThisGeneration.add(restrictedArea.name);

    expect(card.canAct(player)).is.not.true;

    player.megaCredits += 2;

    expect(card.canAct(player)).is.true;

    const selectCard = cast(card.action(player), SelectCard);
    expect(selectCard.cards).deep.eq([restrictedArea]);
  });

  it('actionPreview: a single branch with a repeatAction card-pick step', () => {
    player.playedCards.push(card);
    const restrictedArea = new RestrictedArea();
    player.playedCards.push(restrictedArea);
    player.actionsThisGeneration.add(restrictedArea.name);
    player.megaCredits += 2;
    expect(card.canAct(player)).is.true;

    const preview = card.actionPreview(player);
    expect(preview.branches).has.lengthOf(1);
    const steps = preview.branches[0].steps;
    expect(steps).has.lengthOf(1);
    const step = steps[0];
    expect(step.kind).eq('input');
    if (step.kind !== 'input') {
      throw new Error('expected an input step');
    }
    expect(step.input.type).eq('card');
    // Drives the premium "choose an action to repeat" picker + nested confirm.
    expect(step.repeatAction).is.true;
    const input = step.input as {cards: ReadonlyArray<{name: string}>};
    expect(input.cards.map((c) => c.name)).deep.eq([restrictedArea.name]);
  });

  it('Cannot act once Viron is used', () => {
    card.play(player);

    player.playedCards.push(card);
    const restrictedArea = new RestrictedArea();
    player.playedCards.push(restrictedArea);
    player.actionsThisGeneration.add(restrictedArea.name);
    player.actionsThisGeneration.add(card.name);
    player.megaCredits += 2;

    expect(card.canAct(player)).is.not.true;
  });

  it('a second copier at the table (TR61 Cargo Mechs, used too) — `canAct` terminates and the list is honest', () => {
    // Viron → repeatableActionCards(Viron) → CargoMechs.canAct → repeatableActionCards(CargoMechs) → Viron.canAct → …
    // recursed without end. ONE `IHasCheckLoops` counter on the pair (Cargo Mechs') ends it at depth three; Viron
    // needs none of its own — this is the proof that stands here, beside the card it protects.
    card.play(player);
    player.playedCards.push(card);
    const cargo = new CargoMechs();
    cargo.resourceCount = 1;
    const restrictedArea = new RestrictedArea();
    player.playedCards.push(cargo, restrictedArea);
    player.megaCredits += 2;
    player.energy = 0;
    player.actionsThisGeneration.add(restrictedArea.name);
    player.actionsThisGeneration.add(cargo.name);
    expect(card.canAct(player), 'Viron, unused, may copy').is.true;
    expect(repeatableActionCards(player, card).map((c) => c.name)).to.have.members([CardName.RESTRICTED_AREA, CardName.CARGO_MECHS]);
    player.actionsThisGeneration.add(card.name);
    expect(card.canAct(player), 'used, Viron never acts twice').is.false;
  });

  it('Works with active preludes', () => {
    card.play(player);

    player.playedCards.push(card);
    const focusedOrganization = new FocusedOrganization();

    expect(focusedOrganization.canAct(player)).is.false;

    player.cardsInHand.push(new RestrictedArea());
    player.megaCredits = 1;

    expect(focusedOrganization.canAct(player)).is.true;

    player.playedCards.push(focusedOrganization);
    player.actionsThisGeneration.add(focusedOrganization.name);

    expect(card.canAct(player)).is.true;
  });
});
