import {expect} from 'chai';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {CardResource} from '@/common/CardResource';

// Pure helper (no Vue deps) — runs under the server runner too:
//   npx mocha --import=tsx --require tests/testing/setup.ts "tests/client/components/modalInputs/optionIcons.spec.ts"
describe('iconClassFor', () => {
  it('resolves standard resources and global parameters', () => {
    expect(iconClassFor('energy')).to.eq('resource_icon resource_icon--energy');
    expect(iconClassFor('tr')).to.eq('resource_icon resource_icon--rating');
    expect(iconClassFor('cards')).to.eq('resource_icon resource_icon--cards');
    expect(iconClassFor('temperature')).to.eq('wgt-icon wgt-icon--temperature');
  });

  it('normalises a RAW CardResource enum value to the generated card-resource class', () => {
    // The journal's impactChips forwards the raw CardResource ('Microbe', not
    // 'microbe'); the generated CSS classes are lowercase + spaces→hyphens.
    expect(iconClassFor(CardResource.MICROBE)).to.eq('card-resource card-resource-microbe');
    expect(iconClassFor(CardResource.ANIMAL)).to.eq('card-resource card-resource-animal');
    expect(iconClassFor(CardResource.SYNDICATE_FLEET)).to.eq('card-resource card-resource-syndicate-fleet');
    expect(iconClassFor(CardResource.HYDROELECTRIC_RESOURCE)).to.eq('card-resource card-resource-hydroelectric-resource');
    // EVA Mechs (TR09): the literal `'Mech'` is what makes the generated class
    // (`@card_resource_types` in cards_v2.less) and the sprite name line up.
    expect(iconClassFor(CardResource.MECH)).to.eq('card-resource card-resource-mech');
  });

  it('is idempotent on an already-normalised card-resource key', () => {
    expect(iconClassFor('microbe')).to.eq('card-resource card-resource-microbe');
    expect(iconClassFor('')).to.eq('');
  });
});
