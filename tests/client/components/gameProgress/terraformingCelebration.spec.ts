import {expect} from 'chai';
import {
  finalGenerationActive,
  observeTerraformingProgress,
  resetTerraformingCelebration,
  terraformingCelebrationState,
  TerraformingObservationView,
} from '@/client/components/gameProgress/terraformingCelebration';

function view(overrides: {
  temperature?: number;
  oxygenLevel?: number;
  oceans?: number;
  isTerraformed?: boolean;
  generation?: number;
  lastSoloGeneration?: number;
  players?: number;
} = {}): TerraformingObservationView {
  return {
    game: {
      temperature: overrides.temperature ?? -30,
      oxygenLevel: overrides.oxygenLevel ?? 0,
      oceans: overrides.oceans ?? 0,
      isTerraformed: overrides.isTerraformed ?? false,
      generation: overrides.generation ?? 5,
      lastSoloGeneration: overrides.lastSoloGeneration ?? 14,
    },
    players: {length: overrides.players ?? 2},
  };
}

const COMPLETE = {temperature: 8, oxygenLevel: 14, oceans: 9};

describe('terraformingCelebration', () => {
  beforeEach(() => {
    resetTerraformingCelebration();
  });

  it('seeds silently on the first observation of an incomplete game', () => {
    const fresh = observeTerraformingProgress(view());
    expect(fresh).to.be.false;
    expect(terraformingCelebrationState.seeded).to.be.true;
    expect(terraformingCelebrationState.complete).to.be.false;
  });

  it('reload into an ALREADY terraformed game: persistent state only, never the cinematic', () => {
    const nonce = terraformingCelebrationState.celebrationNonce;
    const fresh = observeTerraformingProgress(view({...COMPLETE, isTerraformed: true}));
    expect(fresh).to.be.false; // seed — no celebration
    expect(terraformingCelebrationState.complete).to.be.true;
    expect(terraformingCelebrationState.finalGeneration).to.be.true;
    expect(terraformingCelebrationState.celebrationNonce).to.eq(nonce);
  });

  it('fires EXACTLY ONCE on the live not-complete → complete transition', () => {
    observeTerraformingProgress(view());
    const nonce = terraformingCelebrationState.celebrationNonce;
    const fresh = observeTerraformingProgress(view({...COMPLETE, isTerraformed: true, generation: 9}));
    expect(fresh).to.be.true;
    expect(terraformingCelebrationState.celebrationNonce).to.eq(nonce + 1);
    expect(terraformingCelebrationState.celebrationFinal).to.be.true;
    expect(terraformingCelebrationState.celebrationGeneration).to.eq(9);
    // Re-observing the same completed state never re-fires.
    expect(observeTerraformingProgress(view({...COMPLETE, isTerraformed: true, generation: 9}))).to.be.false;
    expect(terraformingCelebrationState.celebrationNonce).to.eq(nonce + 1);
  });

  it('does NOT wait for Venus: completion is Temperature + Oxygen + Oceans only', () => {
    observeTerraformingProgress(view());
    // Venus-required game-end variant: the server says NOT terraformed yet,
    // but the three parameters are done → the event still fires…
    const fresh = observeTerraformingProgress(view({...COMPLETE, isTerraformed: false}));
    expect(fresh).to.be.true;
    // …just without falsely claiming the last generation.
    expect(terraformingCelebrationState.celebrationFinal).to.be.false;
    expect(terraformingCelebrationState.finalGeneration).to.be.false;
  });

  it('solo: completion mid-run celebrates without the final-generation claim', () => {
    observeTerraformingProgress(view({players: 1, generation: 7}));
    const fresh = observeTerraformingProgress(view({...COMPLETE, players: 1, generation: 8, isTerraformed: true}));
    expect(fresh).to.be.true;
    // Solo games run to the fixed last generation regardless of terraforming.
    expect(terraformingCelebrationState.celebrationFinal).to.be.false;
  });

  it('solo: the final-generation marker is generation-based', () => {
    expect(finalGenerationActive(view({players: 1, generation: 13, lastSoloGeneration: 14}))).to.be.false;
    expect(finalGenerationActive(view({players: 1, generation: 14, lastSoloGeneration: 14}))).to.be.true;
  });

  it('multiplayer: the final-generation marker follows the authoritative isTerraformed', () => {
    expect(finalGenerationActive(view({isTerraformed: false}))).to.be.false;
    expect(finalGenerationActive(view({isTerraformed: true}))).to.be.true;
  });

  it('reset re-arms seeding without rewinding the nonce', () => {
    observeTerraformingProgress(view());
    observeTerraformingProgress(view({...COMPLETE, isTerraformed: true}));
    const nonce = terraformingCelebrationState.celebrationNonce;
    resetTerraformingCelebration();
    expect(terraformingCelebrationState.seeded).to.be.false;
    expect(terraformingCelebrationState.celebrationNonce).to.eq(nonce); // monotonic
    // A new game seeds silently even if it is already complete.
    expect(observeTerraformingProgress(view({...COMPLETE, isTerraformed: true}))).to.be.false;
    expect(terraformingCelebrationState.celebrationNonce).to.eq(nonce);
  });
});
