import {expect} from 'chai';
import {CardName} from '../../src/common/cards/CardName';
import {ALL_MODULE_MANIFESTS} from '../../src/server/cards/AllManifests';
import {GameModule} from '../../src/common/cards/GameModule';
import {ICorporationCard} from '../../src/server/cards/corporation/ICorporationCard';
import {corpFirstActionPreview, previewableFirstActionCorp} from '../../src/server/models/corpFirstActionPreview';
import {testGame} from '../TestGame';
import {TharsisRepublic} from '../../src/server/cards/corporation/TharsisRepublic';
import {Inventrix} from '../../src/server/cards/corporation/Inventrix';
import {Poseidon} from '../../src/server/cards/colonies/Poseidon';
import {ValleyTrust} from '../../src/server/cards/prelude/ValleyTrust';
import {Celestic} from '../../src/server/cards/venusNext/Celestic';
import {Vitor} from '../../src/server/cards/prelude/Vitor';
import {Aridor} from '../../src/server/cards/colonies/Aridor';
import {ArcadianCommunities} from '../../src/server/cards/promo/ArcadianCommunities';
import {PolderTechDutch} from '../../src/server/cards/promo/PolderTechDutch';
import {PREMIUM_SCOPE_MODULES, inPremiumScope} from '../../src/common/cards/premiumScope';
import {LotusInnovations} from '../../src/server/cards/turmoilRedux/LotusInnovations';

// Modules whose corporations flow through the console's dedicated first-action
// confirm modal today. Widen alongside the other preview SCOPE sets when an
// expansion is adapted (the EXPANSION ADAPTATION CHECKLIST).
// This walk has never covered Ares — widening it is its own task, not this guard's.
const SCOPE: ReadonlyArray<GameModule> = PREMIUM_SCOPE_MODULES.filter((m) => m !== 'ares');

function forEachInScopeCorporation(cb: (corp: ICorporationCard, module: GameModule) => void): void {
  for (const manifest of ALL_MODULE_MANIFESTS) {
    if (!SCOPE.includes(manifest.module)) {
      continue;
    }
    for (const name of Object.keys(manifest.corporationCards)) {
      const Factory = (manifest.corporationCards as Record<string, {Factory: new () => ICorporationCard}>)[name]?.Factory;
      if (Factory === undefined || !inPremiumScope({module: manifest.module, name}, SCOPE)) {
        continue;
      }
      let corp: ICorporationCard;
      try {
        corp = new Factory();
      } catch {
        continue;
      }
      cb(corp, manifest.module);
    }
  }
}

describe('corpFirstActionPreview', () => {
  it('every in-scope corporation with a mandatory first action has a NON-MUTE preview (chips or steps)', () => {
    // The coverage guard: a first-action corp whose preview is the bare dynamic
    // fallback (no chips, no steps) would leave the console's mandatory-action
    // modal with nothing to say — add a co-located `firstActionPreview` hook
    // (bespoke `initialAction`) or check why the declarative walkers came up empty.
    const [/* game */, player] = testGame(2);
    // A Turmoil Redux corporation is only ever dealt on a Redux table — its first action may read the Parliament
    // (TR83 The Deimos Group: a delegate from the reserve), so it is previewed where it can be played.
    const [/* reduxGame */, reduxPlayer] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
    const gaps: Array<string> = [];
    forEachInScopeCorporation((corp, module) => {
      // Mirror the Player.ts pendingInitialActions gate: the base class always
      // defines initialAction(), so the text is the discriminator.
      if (corp.initialActionText === undefined) {
        return;
      }
      const preview = corpFirstActionPreview(module === 'turmoilRedux' ? reduxPlayer : player, corp);
      const informative = preview.branches.some((b) => b.effects.length > 0 || b.steps.length > 0);
      if (!informative) {
        gaps.push(corp.name);
      }
    });
    expect(gaps, `first-action corporations with a MUTE preview — add a co-located firstActionPreview hook:\n  ${gaps.join('\n  ')}`).to.be.empty;
  });

  it('declarative corps auto-derive from the firstAction behavior', () => {
    const [/* game */, player] = testGame(2);

    const tharsis = corpFirstActionPreview(player, new TharsisRepublic());
    expect(tharsis.kind).eq('declarative');
    expect(tharsis.branches[0].steps.some((s) => s.kind === 'boardPlacement' && s.placementType === 'city')).is.true;

    const inventrix = corpFirstActionPreview(player, new Inventrix());
    const draw = inventrix.branches[0].effects.find((e) => e.icon === 'cards');
    expect(draw?.direction).eq('gain');
    expect(draw?.amount).eq(3);

    const poseidon = corpFirstActionPreview(player, new Poseidon());
    expect(poseidon.branches[0].steps.some((s) => s.kind === 'boardPlacement' && s.placementType === 'colony')).is.true;
  });

  it('the EFFECT FORECAST rides the preview (law 8): the rating a first action gains, answered by the rating reactors — absent when nothing answers', () => {
    const [/* game */, player] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
    // TR81 Lotus Innovations: «+2 TR, including from this» — the corporation is already in the tableau.
    const lotus = new LotusInnovations();
    player.playedCards.push(lotus);
    const preview = corpFirstActionPreview(player, lotus);
    expect(preview.kind, 'declarative — never the fallback').eq('declarative');
    expect(preview.branches[0].effects.map((e) => [e.direction, e.icon, e.amount])).deep.eq([['gain', 'tr', 2]]);
    const facts = preview.forecast?.facts.filter((f) => f.source.name === CardName.LOTUS_INNOVATIONS) ?? [];
    expect(facts.map((f) => [f.certainty, f.effects.map((e) => [e.icon, e.amount])])).deep.eq([['exact', [['data', 2]]]]);

    // A first action nothing answers carries no forecast at all («absent = nothing reacts»).
    const [/* game */, other] = testGame(2);
    expect(corpFirstActionPreview(other, new Inventrix()).forecast).is.undefined;
  });

  it('bespoke corps supply a co-located hook — never a mute dynamic branch', () => {
    const [/* game */, player] = testGame(2);

    const valleyTrust = corpFirstActionPreview(player, new ValleyTrust());
    expect(valleyTrust.kind).eq('bespoke');
    expect(valleyTrust.branches[0].steps[0]?.kind).eq('note');

    const celestic = corpFirstActionPreview(player, new Celestic());
    const draw = celestic.branches[0].effects.find((e) => e.icon === 'cards');
    expect(draw?.amount).eq(2);
    expect(celestic.branches[0].steps[0]?.kind).eq('note');

    for (const corp of [new Vitor(), new Aridor(), new ArcadianCommunities()]) {
      const preview = corpFirstActionPreview(player, corp);
      expect(preview.kind, corp.name).eq('bespoke');
      expect(preview.branches[0].steps[0]?.kind, corp.name).eq('note');
    }

    const polderTech = corpFirstActionPreview(player, new PolderTechDutch());
    expect(polderTech.branches[0].steps.map((s) => s.kind === 'boardPlacement' ? s.placementType : s.kind)).deep.eq(['ocean', 'greenery']);
  });

  it('previewableFirstActionCorp resolves ONLY a corp the player still owes the action for', () => {
    const [/* game */, player] = testGame(2);
    const corp = new TharsisRepublic();
    expect(previewableFirstActionCorp(player, corp.name)).is.undefined;
    player.pendingInitialActions.push(corp);
    expect(previewableFirstActionCorp(player, corp.name)).eq(corp);
  });
});
