import {expect} from 'chai';
import {
  amountResponse, deltaProjectResponse, emptyUnits, optionConfirmResponse,
  orOptionResponse, orWrappedResponse, playerResponse, productionToLoseResponse,
  resourceResponse, resourcesResponse, unitsFrom,
} from '@/client/console/taskResponses';
import {Color} from '@/common/Color';

/**
 * CTS-3.3 BYTE-PARITY: every builder must equal what the desktop premium
 * input POSTs for the same choice (shapes from common/inputs/InputResponse).
 */
describe('taskResponses (submission byte-parity)', () => {
  it('option / or-option / or-wrapped', () => {
    expect(optionConfirmResponse()).to.deep.eq({type: 'option'});
    expect(orOptionResponse(2)).to.deep.eq({type: 'or', index: 2, response: {type: 'option'}});
    expect(orWrappedResponse(1, {type: 'space', spaceId: '09'})).to.deep.eq(
      {type: 'or', index: 1, response: {type: 'space', spaceId: '09'}});
  });

  it('player / amount / deltaProject / resource', () => {
    expect(playerResponse('red' as Color)).to.deep.eq({type: 'player', player: 'red'});
    expect(amountResponse(7)).to.deep.eq({type: 'amount', amount: 7});
    expect(deltaProjectResponse(3)).to.deep.eq({type: 'deltaProject', amount: 3});
    expect(resourceResponse('heat')).to.deep.eq({type: 'resource', resource: 'heat'});
  });

  it('units payloads are ALWAYS full Units objects (server contract)', () => {
    expect(emptyUnits()).to.deep.eq({megacredits: 0, steel: 0, titanium: 0, plants: 0, energy: 0, heat: 0});
    expect(unitsFrom({steel: 2})).to.deep.eq({megacredits: 0, steel: 2, titanium: 0, plants: 0, energy: 0, heat: 0});
    expect(resourcesResponse({plants: 1, heat: 3})).to.deep.eq(
      {type: 'resources', units: {megacredits: 0, steel: 0, titanium: 0, plants: 1, energy: 0, heat: 3}});
    expect(productionToLoseResponse({energy: 2})).to.deep.eq(
      {type: 'productionToLose', units: {megacredits: 0, steel: 0, titanium: 0, plants: 0, energy: 2, heat: 0}});
  });
});
