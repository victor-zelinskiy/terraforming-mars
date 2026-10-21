import {expect} from 'chai';
import {ALL_MODULE_MANIFESTS} from '../../src/server/cards/AllManifests';
import {ICard} from '../../src/server/cards/ICard';
import {CardName} from '../../src/common/cards/CardName';
import {Phase} from '../../src/common/Phase';
import {SpaceName} from '../../src/common/boards/SpaceName';
import {Behavior} from '../../src/server/behavior/Behavior';
import {testGame} from '../TestGame';
import {addCity, addGreenery, addOcean, fakeCard} from '../TestingUtils';
import {countedPlayEffects} from '../../src/server/models/actionPreview';
import {cardPlayPreview} from '../../src/server/models/cardPlayPreview';
import {cardsToModel} from '../../src/server/models/ModelUtils';
import {CompostingInitiative} from '../../src/server/cards/turmoilRedux/CompostingInitiative';
import {HabitatScience} from '../../src/server/cards/turmoilRedux/HabitatScience';
import {IchtiologyGrant} from '../../src/server/cards/turmoilRedux/IchtiologyGrant';
import {Algae} from '../../src/server/cards/base/Algae';
import {InterplanetaryTrade} from '../../src/server/cards/promo/InterplanetaryTrade';
import {BactoviralResearch} from '../../src/server/cards/promo/BactoviralResearch';
import {ProductiveOutpost} from '../../src/server/cards/colonies/ProductiveOutpost';
import {IPlayer} from '../../src/server/IPlayer';
import {Tag} from '../../src/common/cards/Tag';
import {CardType} from '../../src/common/cards/CardType';
import {CardResource} from '../../src/common/CardResource';
import {TileType} from '../../src/common/TileType';
import {ActionEffect} from '../../src/common/models/ActionPreviewModel';
import {PREMIUM_SCOPE_MODULES, inPremiumScope} from '../../src/common/cards/premiumScope';

/**
 * THE COUNTED PLAY — the hand's forecast plate as a CLASS (the owner's decision
 * 2026-10-12): every card whose on-play gain is COUNTED off the table carries
 * the play preview's own chips on its hand model (`CardModel.countedPlay` ←
 * `countedPlayEffects`), so the plate, the composer and the play say ONE
 * number. Two worklists: the DECLARATIVE one (every in-scope counted member of
 * a `behavior`, byte-for-byte the composer's chip) and THE ONE BY BEHAVIOUR
 * (2026-10-14 — the owner's report: Miranda Resort wore «+5» and Interplanetary
 * Trade nothing): every chip whose number MOVES with the table, whoever builds
 * it — a declaration or a bespoke card's own `countedPlayForecast` — must be
 * on the plate. Both print their lists.
 */
const SCOPE = PREMIUM_SCOPE_MODULES;

function isVariable(raw: unknown): boolean {
  return raw !== null && typeof raw === 'object';
}

/** Does the TOP-LEVEL declaration hold a counted on-play gain (the members `countedPlayEffects` reads)? */
function hasCountedMember(b: Behavior | undefined, card: ICard): boolean {
  if (b === undefined) {
    return false;
  }
  const additions = b.addResourcesToAnyCard === undefined ? [] : Array.isArray(b.addResourcesToAnyCard) ? b.addResourcesToAnyCard : [b.addResourcesToAnyCard];
  return (isVariable(b.addResources) && card.resourceType !== undefined) ||
    Object.values(b.stock ?? {}).some(isVariable) ||
    Object.values(b.production ?? {}).some(isVariable) ||
    isVariable(b.tr) ||
    (typeof b.drawCard === 'object' && isVariable(b.drawCard.count)) ||
    additions.some((a) => isVariable(a.count));
}

/** Every in-scope card a player can hold in hand (project cards and preludes), fresh. */
function* inScopeCards(): Generator<{name: string, make: () => ICard}> {
  for (const manifest of ALL_MODULE_MANIFESTS) {
    if (!SCOPE.includes(manifest.module)) {
      continue;
    }
    const factories = {...manifest.projectCards, ...manifest.preludeCards} as Record<string, {Factory: new () => ICard} | undefined>;
    for (const [name, entry] of Object.entries(factories)) {
      if (entry !== undefined && inPremiumScope({module: manifest.module, name}, SCOPE)) {
        yield {name, make: () => new entry.Factory()};
      }
    }
  }
}

/**
 * Two tables that differ ONLY in what a play can count — tags of every kind
 * (events and cards with no tags included), the player's and the opponents'
 * tiles on and off Mars, colonies, the hand, resources on cards — and agree on
 * everything else: the same global parameters (the tiles are laid without
 * raising anything), the same stock and production, the same resource HOLDERS
 * (a «to a card» chip stands on both, so only its NUMBER can differ). A chip
 * whose number moves between them is counted off the table, by behaviour.
 */
function countingTable(rich: boolean): IPlayer {
  const [game, player, opponent] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true, venusNextExtension: true, aresExtension: true, aresHazards: false, preludeExtension: true});
  game.phase = Phase.ACTION;
  for (const resource of [CardResource.FLOATER, CardResource.MICROBE, CardResource.ANIMAL, CardResource.SCIENCE, CardResource.DATA, CardResource.FIGHTER, CardResource.ASTEROID]) {
    const holder = fakeCard({resourceType: resource, tags: [Tag.VENUS]});
    holder.resourceCount = 1;
    player.playedCards.push(holder);
  }
  if (!rich) {
    return player;
  }
  for (const tag of [Tag.BUILDING, Tag.SPACE, Tag.SCIENCE, Tag.POWER, Tag.EARTH, Tag.JOVIAN, Tag.VENUS, Tag.PLANT, Tag.MICROBE, Tag.ANIMAL, Tag.CITY]) {
    player.playedCards.push(fakeCard({tags: [tag, tag, tag]}));
    opponent.playedCards.push(fakeCard({tags: [tag]}));
  }
  player.playedCards.push(fakeCard({type: CardType.EVENT, tags: [Tag.SPACE]}), fakeCard({tags: []}), fakeCard({tags: []}));
  opponent.playedCards.push(fakeCard({type: CardType.EVENT, tags: [Tag.EARTH]}));
  for (const holder of player.playedCards) {
    if (holder.resourceType !== undefined) {
      holder.resourceCount = 3;
    }
  }
  for (let i = 0; i < 4; i++) {
    player.cardsInHand.push(fakeCard({}));
  }
  const land = game.board.getAvailableSpacesOnLand(player);
  game.simpleAddTile(player, land[0], {tileType: TileType.CITY});
  game.simpleAddTile(player, land[5], {tileType: TileType.CITY});
  game.simpleAddTile(player, land[1], {tileType: TileType.GREENERY});
  game.simpleAddTile(opponent, land[10], {tileType: TileType.CITY});
  game.simpleAddTile(opponent, land[11], {tileType: TileType.GREENERY});
  const water = game.board.getAvailableSpacesForOcean(player);
  game.simpleAddTile(player, water[0], {tileType: TileType.OCEAN});
  game.simpleAddTile(player, water[3], {tileType: TileType.OCEAN});
  game.simpleAddTile(player, game.board.getSpaceOrThrow(SpaceName.PHOBOS_SPACE_HAVEN), {tileType: TileType.CITY});
  game.simpleAddTile(opponent, game.board.getSpaceOrThrow(SpaceName.GANYMEDE_COLONY), {tileType: TileType.CITY});
  for (const colony of game.colonies.slice(0, 3)) {
    colony.colonies.push(player.id, opponent.id);
  }
  return player;
}

type PlacedChip = ActionEffect & {branch: number, nth: number};

/** The composer's chips with their place: branch, and the n-th chip of its kind in that branch (two TR chips stay two). */
function placedChips(player: IPlayer, card: ICard): Array<PlacedChip> {
  return cardPlayPreview(player, card).branches.flatMap((b, branch) => {
    const seen = new Map<string, number>();
    return b.effects.map((e) => {
      const key = `${e.icon}|${e.note ?? ''}|${e.direction}`;
      const nth = seen.get(key) ?? 0;
      seen.set(key, nth + 1);
      return {...e, branch, nth};
    });
  });
}

const sameKind = (a: ActionEffect, b: ActionEffect) => a.icon === b.icon && a.note === b.note && a.direction === b.direction;

/**
 * The counted plays whose sums the composer explains with a LEDGER (a row per
 * colony), never with one counted reason — their plate chips carry no basis.
 */
const EXPLAINED_BY_LEDGER: ReadonlySet<string> = new Set([CardName.PRODUCTIVE_OUTPOST]);

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
  // Holders for the counted «to ANY card» additions (Bactoviral Research's microbes, Hydrogen to Venus's floaters
  // on a Venus card) — with no holder the addition is skipped by name and carries no chip at all.
  player.playedCards.push(fakeCard({resourceType: CardResource.MICROBE}), fakeCard({resourceType: CardResource.FLOATER, tags: [Tag.VENUS]}));
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
      if (!SCOPE.includes(manifest.module)) {
        continue;
      }
      const factories = {...manifest.projectCards, ...manifest.preludeCards} as Record<string, {Factory: new () => ICard} | undefined>;
      for (const [name, entry] of Object.entries(factories)) {
        if (entry === undefined || !inPremiumScope({module: manifest.module, name}, SCOPE)) {
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
    expect(listed).to.include.members([CardName.COMPOSTING_INITIATIVE, CardName.HABITAT_SCIENCE, CardName.ICHTIOLOGY_GRANT, CardName.BACTOVIRAL_RESEARCH, CardName.HYDROGEN_TO_VENUS]);
    // An anti-vacuous floor: the class reaches upstream cards too.
    expect(listed.length).greaterThan(10);
  });

  it('THE WORKLIST BY BEHAVIOUR: every chip whose number moves with the table rides the hand plate — a declaration\'s or a bespoke card\'s', () => {
    const empty = countingTable(false);
    const rich = countingTable(true);
    const listed: Array<string> = [];
    const wrong: Array<string> = [];
    for (const {name, make} of inScopeCards()) {
      const before = placedChips(empty, make());
      const card = make();
      const moved = placedChips(rich, card).filter((chip) => {
        const twin = before.find((b) => b.branch === chip.branch && b.nth === chip.nth && sameKind(b, chip));
        return twin === undefined || twin.amount !== chip.amount;
      });
      if (moved.length === 0) {
        continue;
      }
      listed.push(name);
      const plate = countedPlayEffects(rich, card);
      for (const chip of moved) {
        const label = `${name}: ${chip.direction === 'cost' ? '−' : '+'}${chip.amount} ${chip.icon}${chip.note !== undefined ? ' · ' + chip.note : ''}`;
        const twin = plate.find((p) => sameKind(p, chip) && p.amount === chip.amount);
        if (twin === undefined) {
          wrong.push(`${label} — counted off the table, missing from the hand plate (declare it, or give the card a \`countedPlayForecast\`)`);
        } else if (JSON.stringify(twin.basis) !== JSON.stringify(chip.basis)) {
          wrong.push(`${label} — the plate's basis is not the composer's`);
        } else if (twin.basis === undefined && !EXPLAINED_BY_LEDGER.has(name)) {
          wrong.push(`${label} — no basis: the composer cannot say WHY (\`actionPreviews.counted\`)`);
        }
      }
    }
    console.log(`      counted by behaviour (${listed.length}): ${listed.join(', ')}`);
    expect(wrong, wrong.join('\n')).deep.eq([]);
    // The owner's report, and every bespoke counted play the audit of 2026-10-14 found.
    expect(listed).to.include.members([
      CardName.MIRANDA_RESORT, CardName.INTERPLANETARY_TRADE, CardName.TERRAFORMING_GANYMEDE, CardName.COMMUNITY_SERVICES,
      CardName.QUANTUM_COMMUNICATIONS, CardName.MEDIA_ARCHIVES, CardName.HERMETIC_ORDER_OF_MARS, CardName.NITROGEN_RICH_ASTEROID,
      CardName.PRODUCTIVE_OUTPOST, CardName.HEAD_START, CardName.BACTOVIRAL_RESEARCH, CardName.HYDROGEN_TO_VENUS,
    ]);
    // Anti-vacuous: the two tables really do differ in what a play counts.
    expect(listed.length).greaterThan(35);
  });

  it('a bespoke card\'s `countedPlayForecast` IS its composer\'s chip, byte for byte — one reading', () => {
    const rich = countingTable(true);
    const wrong: Array<string> = [];
    let hooks = 0;
    for (const {name, make} of inScopeCards()) {
      const card = make();
      if (card.countedPlayForecast === undefined) {
        continue;
      }
      hooks++;
      const effects = cardPlayPreview(rich, card).branches.flatMap((b) => b.effects);
      for (const chip of card.countedPlayForecast(rich)) {
        if (!effects.some((e) => JSON.stringify(e) === JSON.stringify(chip))) {
          wrong.push(`${name}: ${chip.icon} ${chip.amount} is not a chip of its own composer`);
        }
      }
    }
    expect(wrong, wrong.join('\n')).deep.eq([]);
    expect(hooks).greaterThanOrEqual(9);
  });

  it('the owner\'s report: Interplanetary Trade in hand wears «+N M€ production» with WHAT it counted — beside Miranda Resort', () => {
    const rich = countingTable(true);
    const [model] = cardsToModel(rich, [new InterplanetaryTrade()], {showCalculatedCost: true, unplayableReasons: true});
    expect(model.countedPlay).has.length(1);
    const chip: ActionEffect = model.countedPlay![0];
    expect(chip).deep.include({direction: 'gain', icon: 'megacredits', note: 'production'});
    expect(chip.basis).deep.eq([{count: chip.amount, label: 'Your different tags'}]);
    expect(chip.amount, 'eleven kinds in play + the Space tag is among them').eq(11);
  });

  it('a counted «to ANY card» addition names its count; a fixed one stays printed', () => {
    const rich = countingTable(true);
    const chips = countedPlayEffects(rich, new BactoviralResearch());
    // 3 science tags in play + the card's own.
    expect(chips.map((e) => [e.icon, e.note, e.amount, e.basis?.[0].label, e.basis?.[0].tag])).deep.eq([['microbe', 'to a card', 4, 'Your tags', Tag.SCIENCE]]);
    expect(countedPlayEffects(rich, new Algae())).deep.eq([]);
  });

  it('Productive Outpost: every colony bonus on the plate, explained by the composer\'s ledger (no basis)', () => {
    const rich = countingTable(true);
    const card = new ProductiveOutpost();
    const chips = countedPlayEffects(rich, card);
    expect(chips.length).greaterThan(0);
    expect(chips.every((e) => e.basis === undefined)).is.true;
    expect(countedPlayEffects(countingTable(false), card), 'no colony, nothing to show').deep.eq([]);
  });
});
