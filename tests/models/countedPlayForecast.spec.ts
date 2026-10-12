import {expect} from 'chai';
import {ALL_MODULE_MANIFESTS} from '../../src/server/cards/AllManifests';
import {ICard} from '../../src/server/cards/ICard';
import {GameModule} from '../../src/common/cards/GameModule';
import {CardName} from '../../src/common/cards/CardName';
import {Phase} from '../../src/common/Phase';
import {SpaceName} from '../../src/common/boards/SpaceName';
import {Behavior} from '../../src/server/behavior/Behavior';
import {testGame} from '../TestGame';
import {addCity, addGreenery, addOcean} from '../TestingUtils';
import {countedPlayEffects} from '../../src/server/models/actionPreview';
import {cardPlayPreview} from '../../src/server/models/cardPlayPreview';
import {cardsToModel} from '../../src/server/models/ModelUtils';
import {CompostingInitiative} from '../../src/server/cards/turmoilRedux/CompostingInitiative';
import {HabitatScience} from '../../src/server/cards/turmoilRedux/HabitatScience';
import {IchtiologyGrant} from '../../src/server/cards/turmoilRedux/IchtiologyGrant';
import {Algae} from '../../src/server/cards/base/Algae';
import {IPlayer} from '../../src/server/IPlayer';

/**
 * THE COUNTED PLAY — the hand's forecast plate as a CLASS (the owner's decision
 * 2026-10-12): every card whose on-play gain is COUNTED off the table carries
 * the play preview's own chips on its hand model (`CardModel.countedPlay` ←
 * `countedPlayEffects`), so the plate, the composer and the play say ONE
 * number. The guard below is the WORKLIST: it enumerates every in-scope card
 * with a counted on-play member, asserts the hand model carries it and that it
 * is byte-for-byte the composer's chip — and prints the list.
 */
const SCOPE = new Set<GameModule>(['base', 'corpera', 'promo', 'venus', 'colonies', 'prelude', 'ares', 'deltaProject', 'turmoilRedux']);

function isVariable(raw: unknown): boolean {
  return raw !== null && typeof raw === 'object';
}

/** Does the TOP-LEVEL declaration hold a counted on-play gain (the members `countedPlayEffects` reads)? */
function hasCountedMember(b: Behavior | undefined, card: ICard): boolean {
  if (b === undefined) {
    return false;
  }
  return (isVariable(b.addResources) && card.resourceType !== undefined) ||
    Object.values(b.stock ?? {}).some(isVariable) ||
    Object.values(b.production ?? {}).some(isVariable) ||
    isVariable(b.tr) ||
    (typeof b.drawCard === 'object' && isVariable(b.drawCard.count));
}

/** A table with a little of everything on it, so a counted member counts something. */
function richTable(): {player: IPlayer} {
  const [game, player, opponent] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true, venusNextExtension: true, aresExtension: true, aresHazards: false});
  game.phase = Phase.ACTION;
  addCity(player);
  addCity(opponent);
  addGreenery(player);
  addOcean(opponent);
  addOcean(player);
  addCity(opponent, SpaceName.GANYMEDE_COLONY);
  return {player};
}

describe('countedPlayForecast', () => {
  it('TR45 in hand: the model carries «+N microbes» with the census\'s composition — the composer\'s chip', () => {
    const {player} = richTable();
    const card = new CompostingInitiative();
    player.cardsInHand.push(card);
    const [model] = cardsToModel(player, [card], {showCalculatedCost: true, unplayableReasons: true});
    expect(model.countedPlay).has.length(1);
    const chip = model.countedPlay![0];
    expect(chip).deep.include({direction: 'gain', icon: 'microbe', amount: 5, note: 'on this card'});
    expect(chip.basis![0].parts!.map((p) => [p.kind, p.count])).deep.eq([['city', 2], ['greenery', 1], ['ocean', 2]]);
    expect(chip.basis![0].excluded!.map((p) => p.kind)).deep.eq(['off-mars']);
    const composer = cardPlayPreview(player, card).branches[0].effects.find((e) => e.note === 'on this card');
    expect(chip, 'ONE reading — the plate is the composer\'s chip').deep.eq(composer);
  });

  it('TR23 (colonies in play) and TR43 (M€ production per ocean) stand up by themselves; a fixed play carries nothing', () => {
    const {player} = richTable();
    const models = cardsToModel(player, [new HabitatScience(), new IchtiologyGrant(), new Algae()], {unplayableReasons: true});
    expect(models[0].countedPlay?.map((e) => [e.icon, e.basis?.[0].label])).deep.eq([['data', 'Colonies in play']]);
    expect(models[1].countedPlay?.map((e) => [e.icon, e.note, e.amount, e.basis?.[0].label])).deep.eq([['megacredits', 'production', 2, 'Oceans']]);
    expect(models[2].countedPlay, 'Algae\'s plants are printed, not counted').is.undefined;
  });

  it('only the OWN hand: a model built without the opt-in carries nothing', () => {
    const {player} = richTable();
    const [model] = cardsToModel(player, [new CompostingInitiative()], {showCalculatedCost: true});
    expect(model.countedPlay).is.undefined;
  });

  it('a ZERO is still a reading: «+0» with its basis (the plate shows it quiet, never hides it)', () => {
    const [game, player] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
    game.phase = Phase.ACTION;
    const [model] = cardsToModel(player, [new CompostingInitiative()], {unplayableReasons: true});
    expect(model.countedPlay?.map((e) => [e.amount, e.basis?.[0].count])).deep.eq([[0, 0]]);
  });

  it('THE WORKLIST: every in-scope counted play carries its chips, and they are the composer\'s', () => {
    const {player} = richTable();
    const listed: Array<string> = [];
    const wrong: Array<string> = [];
    for (const manifest of ALL_MODULE_MANIFESTS) {
      if (!SCOPE.has(manifest.module)) {
        continue;
      }
      const factories = {...manifest.projectCards, ...manifest.preludeCards} as Record<string, {Factory: new () => ICard} | undefined>;
      for (const [name, entry] of Object.entries(factories)) {
        if (entry === undefined) {
          continue;
        }
        const card = new entry.Factory();
        if (!hasCountedMember(card.behavior, card)) {
          continue;
        }
        listed.push(name);
        const chips = countedPlayEffects(player, card);
        if (chips.length === 0) {
          wrong.push(`${name}: no chip`);
          continue;
        }
        const preview = cardPlayPreview(player, card);
        if (preview.kind !== 'declarative') {
          continue;
        }
        const effects = preview.branches.flatMap((b) => b.effects);
        for (const chip of chips) {
          const twin = effects.find((e) => e.icon === chip.icon && e.note === chip.note && e.direction === chip.direction);
          if (twin === undefined || twin.amount !== chip.amount || JSON.stringify(twin.basis) !== JSON.stringify(chip.basis)) {
            wrong.push(`${name}: ${chip.icon}/${chip.note ?? ''} ${chip.amount} ≠ composer ${twin?.amount}`);
          }
        }
      }
    }
    // Printed so the class's reach is visible in every run (the worklist IS the list).
    console.log(`      counted plays in scope (${listed.length}): ${listed.join(', ')}`);
    expect(wrong, wrong.join('\n')).deep.eq([]);
    expect(listed).to.include.members([CardName.COMPOSTING_INITIATIVE, CardName.HABITAT_SCIENCE, CardName.ICHTIOLOGY_GRANT]);
    // An anti-vacuous floor: the class reaches upstream cards too.
    expect(listed.length).greaterThan(10);
  });
});
