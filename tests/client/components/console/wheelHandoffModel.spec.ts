import {expect} from 'chai';
import {CONFIRM_HANDOFF, WHEEL_HANDOFFS, wheelHandoffSpecFor} from '@/client/console/quickWheel/wheelHandoffModel';
import {buildLtQuickEntries, buildRtQuickEntries} from '@/client/console/consoleQuickModel';

describe('wheelHandoffModel', () => {
  it('every SURFACE-OPENING wheel entry declares an emblem echo (the coverage guard)', () => {
    // Entries whose commit opens a surface with a header emblem. Direct
    // actions (conversions, skip) and the reserved voting slot are exempt:
    // their reveal is the placement mode / the status flip / a HUD pulse.
    const surfaceOpening = new Set(['trading', 'cardActions', 'standardProjects', 'hydro', 'pass']);
    const rt = buildRtQuickEntries({
      cardsPlayable: 1, cardsTotal: 2, actionsAvailable: 1,
      hasColonies: true, hasTurmoil: true, hasHydro: true,
    });
    const lt = buildLtQuickEntries({
      myTurn: true, awaitingInput: true, stdAvailable: true, endTurnAvailable: true,
      passAvailable: true, convertPlantsAvailable: true, convertHeatAvailable: true,
      plantsNeeded: 8, heatNeeded: 8,
    });
    for (const entry of [...rt, ...lt]) {
      if (surfaceOpening.has(entry.id)) {
        expect(wheelHandoffSpecFor(entry.id)?.echo, `'${entry.id}' opens a surface and needs an echo row`).to.be.a('string');
      }
    }
  });

  it('a handoff never declares BOTH an echo and a pulse (one acknowledgement per commit)', () => {
    for (const [id, spec] of Object.entries(WHEEL_HANDOFFS)) {
      expect(spec.echo !== undefined && spec.pulse !== undefined, `'${id}' must pick echo OR pulse`).to.eq(false);
    }
  });

  it('the confirm retarget echoes into the confirm card', () => {
    expect(CONFIRM_HANDOFF.echo).to.eq('confirm');
  });

  it('heat acknowledges on the reservoir; cards on the dock plate', () => {
    expect(wheelHandoffSpecFor('convertHeat')?.pulse).to.deep.eq(['res-heat']);
    expect(wheelHandoffSpecFor('cards')?.pulse).to.deep.eq(['hand-dock']);
  });
});
