import {expect} from 'chai';
import Comp from '@/client/components/card/Card.vue';
describe('probe Card', () => {
  it('imports', () => {
    expect(Comp).to.not.eq(undefined);
  });
});
