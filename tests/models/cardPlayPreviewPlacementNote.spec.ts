import {expect} from 'chai';
import {testGame} from '../TestGame';
import {cardPlayPreview} from '../../src/server/models/cardPlayPreview';
import {IProjectCard} from '../../src/server/cards/IProjectCard';
import {ActionPreviewStep} from '../../src/common/models/ActionPreviewModel';
import {MiningRights} from '../../src/server/cards/base/MiningRights';
import {MiningArea} from '../../src/server/cards/base/MiningArea';
import {EcologicalZone} from '../../src/server/cards/base/EcologicalZone';
import {ImmigrantCity} from '../../src/server/cards/base/ImmigrantCity';
import {IndustrialCenter} from '../../src/server/cards/base/IndustrialCenter';
import {LandClaim} from '../../src/server/cards/base/LandClaim';
import {UrbanizedArea} from '../../src/server/cards/base/UrbanizedArea';
import {Flooding} from '../../src/server/cards/base/Flooding';
import {KaguyaTech} from '../../src/server/cards/promo/KaguyaTech';
import {MarsNomads} from '../../src/server/cards/promo/MarsNomads';
import {MinorityRefuge} from '../../src/server/cards/colonies/MinorityRefuge';
import {PioneerSettlement} from '../../src/server/cards/colonies/PioneerSettlement';

/**
 * A BESPOKE on-play placement card (a `SelectSpace` / `SelectColony`, not
 * declarative `behavior.tile` which the generic walker already notes) must
 * surface an "after confirming, place it on the board / build the colony" NOTE
 * in its play-modal preview — so the modal is never mute about the board step
 * that follows confirming. The note renders on BOTH surfaces (desktop
 * `HandCardPaymentContent` placement note + console `followUpNotes`).
 */
describe('cardPlayPreview — bespoke placement cards surface a placement note', () => {
  function noteKinds(card: IProjectCard): Array<string> {
    const [/* game */, player] = testGame(2);
    const steps: ReadonlyArray<ActionPreviewStep> = cardPlayPreview(player, card).branches[0].steps;
    return steps
      .filter((s): s is ActionPreviewStep & {noteKind: string} => s.kind === 'note')
      .map((s) => s.noteKind);
  }

  const BOARD: Array<[string, IProjectCard]> = [
    ['Mining Rights', new MiningRights()],
    ['Mining Area', new MiningArea()],
    ['Ecological Zone', new EcologicalZone()],
    ['Immigrant City', new ImmigrantCity()],
    ['Industrial Center', new IndustrialCenter()],
    ['Land Claim', new LandClaim()],
    ['Urbanized Area', new UrbanizedArea()],
    ['Kaguya Tech', new KaguyaTech()],
    ['Mars Nomads', new MarsNomads()],
    ['Flooding', new Flooding()],
  ];
  for (const [name, card] of BOARD) {
    it(`${name} → a 'board' placement note`, () => {
      expect(noteKinds(card)).to.include('board');
    });
  }

  const COLONY: Array<[string, IProjectCard]> = [
    ['Minority Refuge', new MinorityRefuge()],
    ['Pioneer Settlement', new PioneerSettlement()],
  ];
  for (const [name, card] of COLONY) {
    it(`${name} → a 'colony' placement note`, () => {
      expect(noteKinds(card)).to.include('colony');
    });
  }
});
