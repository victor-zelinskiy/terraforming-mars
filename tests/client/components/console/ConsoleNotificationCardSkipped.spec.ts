import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import ConsoleNotificationCard from '@/client/components/console/ConsoleNotificationCard.vue';
import {LiveNotification, NOTIFICATION_PRIORITY, NOTIFICATION_TTL} from '@/client/components/notifications/notificationTypes';

/**
 * NO SILENT LOSS on the console notification card: an effect of the action
 * that could not apply stands as its own «Пропущено» line — the label, the
 * struck magnitude, the cause, the owner's cube when it was not the actor's —
 * and nothing about it rides the pills (nothing moved).
 */
function card(skipped: LiveNotification['skipped']): LiveNotification {
  return {
    id: 'g1', kind: 'normal', variant: 'play-card', priority: NOTIFICATION_PRIORITY.normal, sign: 'neutral', importance: 'ambient',
    typeLabelKey: 'Card played', actor: 'red', pills: [], detailCount: 1, ttl: NOTIFICATION_TTL.normal, persistent: false,
    createdAt: 1, generation: 1, expanded: false, ...(skipped === undefined ? {} : {skipped}),
  };
}

function mountCard(n: LiveNotification) {
  return mount(ConsoleNotificationCard, {...globalConfig, props: {notification: n, players: [], viewerColor: 'blue'}});
}

describe('ConsoleNotificationCard — the «Пропущено» line', () => {
  it('names the lost effect, strikes its magnitude and states the cause', () => {
    const w = mountCard(card([{label: 'Add resources to a card', reason: 'No eligible card', chip: {icon: 'data', text: '+4'}}]));
    const line = w.find('.con-notif__skip');
    expect(line.exists()).is.true;
    expect(line.find('.con-notif__skip-label').text()).eq('Add resources to a card');
    expect(line.find('.con-notif__skip-reason').text()).eq('No eligible card');
    expect(line.find('.con-notif__chip--skipped').text()).eq('+4');
    expect(line.find('.con-notif__chip--pos').exists(), 'never a gain chip').is.false;
    expect(line.find('.con-notif__who').exists(), 'the actor\'s own loss needs no owner').is.false;
  });

  it('an effect lost by someone other than the actor carries its owner; at most two lines', () => {
    const lost = {label: 'Add resources to a card', reason: 'No eligible card', owner: 'blue' as const};
    const w = mountCard(card([lost, lost, lost]));
    expect(w.findAll('.con-notif__skip')).has.lengthOf(2);
    expect(w.find('.con-notif__skip .con-notif__dot').classes()).to.include('player_bg_color_blue');
  });

  it('no skip → no block', () => {
    expect(mountCard(card(undefined)).find('.con-notif__skips').exists()).is.false;
  });
});
