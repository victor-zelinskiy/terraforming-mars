import {expect} from 'chai';
import {rootPresentable} from '@/client/components/notifications/notificationIngest';
import {NotificationModel} from '@/client/components/notifications/notificationTypes';

function root(over: Partial<NotificationModel>): NotificationModel {
  return {kind: 'positive', variant: 'card-play', sign: 'neutral', ...over} as unknown as NotificationModel;
}

/**
 * The ORDINARY feed presents a root card only for a group that has NO
 * dedicated presenter: a MarsBot turn is told by the bot turn card, a
 * sitting of the Mars Parliament by the sitting flow itself (every
 * participant is walked through the verdict, the enactment and their own
 * reward on the server's gates), a milestone / award by the ceremony.
 */
describe('notificationIngest — which roots the ordinary feed presents', () => {
  it('a card play / an ordinary action root is presentable', () => {
    expect(rootPresentable(root({category: 'card-play'}))).to.eq(true);
    expect(rootPresentable(root({category: 'standard-project'}))).to.eq(true);
  });

  it('a MarsBot turn root is NOT (the bot turn card owns it)', () => {
    expect(rootPresentable(root({category: 'automa-turn'}))).to.eq(false);
  });

  it('a sitting of the Mars Parliament root is NOT (the sitting flow owns it)', () => {
    expect(rootPresentable(root({category: 'political-phase'}))).to.eq(false);
  });

  it('a milestone / award root is NOT (the ceremony owns it)', () => {
    expect(rootPresentable(root({variant: 'milestone'}))).to.eq(false);
    expect(rootPresentable(root({variant: 'award'}))).to.eq(false);
  });
});
