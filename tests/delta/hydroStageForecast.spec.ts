import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {Phase} from '../../src/common/Phase';
import {Resource} from '../../src/common/Resource';
import {Tag} from '../../src/common/cards/Tag';
import {PartyName} from '../../src/common/turmoil/PartyName';
import {ActionEffect} from '../../src/common/models/ActionPreviewModel';
import {DELTA_TRACK_TAGS, DeltaProjectExpansion} from '../../src/server/delta/DeltaProjectExpansion';
import {SolarPower} from '../../src/server/cards/base/SolarPower';
import {Algae} from '../../src/server/cards/base/Algae';
import {runAllActions} from '../TestingUtils';

/**
 * «СРАБОТАЕТ» IN THE HYDRONETWORK (iteration 6 of «СРАБАТЫВАНИЕ КАРТЫ» — the owner, 2026-10-27): the forecast twin
 * of `resolveReward` promises exactly what the stage GRANTS — pinned here against the live grant for every stage of
 * the track (the preview ↔ commit law), and the table's answer rides the preview per destination: the ruling Greens'
 * M€ production for the power stage's HEAT option, nothing for its energy option.
 */
/** The parity table has NO parliament (a party's answer is a fact beside the grant, never the grant); the preview case seats the Greens. */
function table(redux = false): {game: IGame, player: TestPlayer} {
  const [game, player] = testGame(2, redux ? {deltaProjectExpansion: true, turmoilReduxExpansion: true, coloniesExtension: true} : {deltaProjectExpansion: true});
  game.phase = Phase.ACTION;
  player.playedCards.push(new SolarPower());
  player.energy = 4;
  player.megaCredits = 40;
  return {game, player};
}

/** The grant's own numbers: production and stock, as the twin's effects read them. */
function snapshot(player: TestPlayer): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of [Resource.MEGACREDITS, Resource.STEEL, Resource.TITANIUM, Resource.PLANTS, Resource.ENERGY, Resource.HEAT]) {
    out[`stock:${r}`] = player.stock.get(r);
    out[`production:${r}`] = player.production.get(r);
  }
  return out;
}

function deltasOf(before: Record<string, number>, after: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const key of Object.keys(before)) {
    if (after[key] !== before[key]) {
      out[key] = after[key] - before[key];
    }
  }
  return out;
}

/** The twin's effects as the same deltas (a production chip on its plate, a stock chip on its row). */
function promised(effects: ReadonlyArray<ActionEffect>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of effects) {
    if (e.note === 'production') {
      out[`production:${e.icon}`] = (out[`production:${e.icon}`] ?? 0) + e.amount;
    } else if (e.direction === 'gain') {
      out[`stock:${e.icon}`] = (out[`stock:${e.icon}`] ?? 0) + e.amount;
    }
  }
  return out;
}

describe('hydroStageForecast — the forecast twin promises what the stage grants', () => {
  const resourceStages = [1, 2, 3, 4, 6].map((position) => ({position, tag: DELTA_TRACK_TAGS[position]}));

  for (const {position, tag} of resourceStages) {
    const choices: Array<0 | 1 | undefined> = DeltaProjectExpansion.stageChoiceCount(position) === 2 ? [0, 1] : [undefined];
    for (const choice of choices) {
      it(`position ${position} (${tag}${choice === undefined ? '' : `, option ${choice}`}): the twin's deltas are the live grant's`, () => {
        const {game, player} = table();
        if (tag === Tag.PLANT) {
          player.playedCards.push(new Algae()); // one plant tag on the table: the plant stage pays per plant tag
        }
        const effects = DeltaProjectExpansion.stageRewardEffects(player, position, choice);
        const before = snapshot(player);
        // The live grant, through the resolver's own closure (a declared answer consumes the choice).
        DeltaProjectExpansion['resolveReward'](player, position, false, choice === undefined ? undefined : {position, rewardChoice: choice}, false);
        runAllActions(game);
        expect(deltasOf(before, snapshot(player)), `position ${position}`).deep.eq(promised(effects));
      });
    }
  }

  it('a CHOICE stage answers nothing by itself — the option decides', () => {
    const {player} = table();
    expect(DeltaProjectExpansion.stageRewardEffects(player, 2, undefined)).deep.eq([]);
    expect(DeltaProjectExpansion.stageChoiceCount(2)).eq(2);
    expect(DeltaProjectExpansion.stageChoiceCount(3)).eq(1);
  });

  it('the preview carries the table\'s answer per destination: the Greens\' M€ production for the heat option of the power stage, nothing for the energy option, nothing on the building stage', () => {
    const {game, player} = table(true);
    expect(game.parliament?.hasPartyEffect(player, PartyName.GREENS), 'the Greens rule the first generation').is.true;
    const preview = DeltaProjectExpansion.getPreview(player);
    const power = preview.destinations.find((d) => d.position === 2);
    expect(power, 'the power stage is a destination').is.not.undefined;
    expect(power!.forecast, 'a choice stage carries no single forecast').is.undefined;
    expect(power!.forecastOptions, 'one slot per option').to.have.lengthOf(2);
    expect(power!.forecastOptions![0], 'energy production wakes nobody').is.undefined;
    const heat = power!.forecastOptions![1];
    expect(heat, 'the heat option wakes the Greens').is.not.undefined;
    const greens = heat!.facts.find((f) => f.source.kind === 'party' && f.source.name === PartyName.GREENS);
    expect(greens, 'the Greens\' fact').is.not.undefined;
    expect(greens!.source.channel).eq('production-gain');
    expect(greens!.effects.map((c) => ({icon: c.icon, amount: c.amount, note: c.note}))).deep.eq([{icon: 'megacredits', amount: 1, note: 'production'}]);
    const building = preview.destinations.find((d) => d.position === 1);
    expect(building!.forecast).is.undefined;
    expect(building!.forecastOptions, 'steel / plants wake nobody at this table').is.undefined;
  });
});
