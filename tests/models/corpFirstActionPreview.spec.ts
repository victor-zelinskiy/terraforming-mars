import {expect} from 'chai';
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

// Modules whose corporations flow through the console's dedicated first-action
// confirm modal today. Widen alongside the other preview SCOPE sets when an
// expansion is adapted (the EXPANSION ADAPTATION CHECKLIST).
const SCOPE = new Set<GameModule>(['base', 'corpera', 'promo', 'venus', 'colonies', 'prelude']);

function forEachInScopeCorporation(cb: (corp: ICorporationCard, module: GameModule) => void): void {
  for (const manifest of ALL_MODULE_MANIFESTS) {
    if (!SCOPE.has(manifest.module)) {
      continue;
    }
    for (const name of Object.keys(manifest.corporationCards)) {
      const Factory = (manifest.corporationCards as Record<string, {Factory: new () => ICorporationCard}>)[name]?.Factory;
      if (Factory === undefined) {
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
    const gaps: Array<string> = [];
    forEachInScopeCorporation((corp) => {
      // Mirror the Player.ts pendingInitialActions gate: the base class always
      // defines initialAction(), so the text is the discriminator.
      if (corp.initialActionText === undefined) {
        return;
      }
      const preview = corpFirstActionPreview(player, corp);
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
