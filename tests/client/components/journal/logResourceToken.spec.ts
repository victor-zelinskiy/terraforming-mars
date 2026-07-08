import {expect} from 'chai';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {logResourceIconClass, logResourceLabelKey} from '@/client/components/journal/logResourceToken';

// PURE (no Vue) — the icon-KEY resolution shared by the journal RESOURCE token,
// the legacy log renderer, and the notification renderers. Runs under the server
// runner because it only touches pure TS.
describe('log RESOURCE token icon resolution', () => {
  it('maps standard resources to the resource_icon sprite family', () => {
    expect(iconClassFor('steel')).eq('resource_icon resource_icon--steel');
    expect(iconClassFor('megacredits')).eq('resource_icon resource_icon--megacredits');
    expect(iconClassFor('heat')).eq('resource_icon resource_icon--heat');
  });

  it('maps card resources (CardResource enum values) to the card-resource family', () => {
    expect(iconClassFor('Floater')).eq('card-resource card-resource-floater');
    expect(iconClassFor('Microbe')).eq('card-resource card-resource-microbe');
  });

  it('maps global parameters to the wgt-icon family', () => {
    expect(iconClassFor('temperature')).eq('wgt-icon wgt-icon--temperature');
    expect(iconClassFor('oxygen')).eq('wgt-icon wgt-icon--oxygen');
    expect(iconClassFor('venus')).eq('wgt-icon wgt-icon--venus');
  });

  it('aliases the PLURAL GlobalParameter "oceans" to the singular ocean icon', () => {
    // The bug fix: 'oceans' (the enum value) must resolve to wgt-icon--ocean, not
    // a non-existent card-resource-oceans sprite.
    expect(iconClassFor('oceans')).eq('wgt-icon wgt-icon--ocean');
  });

  it('maps the TR / draw pseudo-resources to the real game sprites', () => {
    expect(iconClassFor('tr')).eq('resource_icon resource_icon--rating');
    expect(iconClassFor('cards')).eq('resource_icon resource_icon--cards');
  });

  it('logResourceIconClass delegates to the shared iconClassFor', () => {
    expect(logResourceIconClass('oceans')).eq(iconClassFor('oceans'));
    expect(logResourceIconClass('Floater')).eq(iconClassFor('Floater'));
  });

  it('logResourceLabelKey provides an accessible label key (card resources are already words)', () => {
    expect(logResourceLabelKey('steel')).eq('Steel');
    expect(logResourceLabelKey('tr')).eq('TR');
    expect(logResourceLabelKey('oceans')).eq('Oceans');
    expect(logResourceLabelKey('Floater')).eq('Floater');
  });
});
