import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import ConsoleNotificationCard from '@/client/components/console/ConsoleNotificationCard.vue';
import {LiveNotification, NOTIFICATION_PRIORITY, NOTIFICATION_TTL} from '@/client/components/notifications/notificationTypes';

/**
 * THE DETAIL ACTION'S LABEL FOLLOWS THE MODEL'S CTA (PL-025): a card whose
 * chain is ABOUT THE PARLIAMENT (the chairmanship, a card's delegates / rally
 * / support / walk — the model sets `open-parliament`) reads «Открыть
 * Парламент» on its hold action, never «Журнал» over an action that opens the
 * table. Every other card keeps the journal.
 */
function card(over: Partial<LiveNotification>): LiveNotification {
  return {
    id: 'g1', kind: 'normal', variant: 'play-card', priority: NOTIFICATION_PRIORITY.normal, sign: 'neutral', importance: 'ambient',
    typeLabelKey: 'Card played', actor: 'red', pills: [], detailCount: 1, ttl: NOTIFICATION_TTL.normal, persistent: false,
    createdAt: 1, generation: 1, expanded: false, correlationId: 7, ...over,
  };
}

function mountCard(n: LiveNotification) {
  return mount(ConsoleNotificationCard, {...globalConfig, props: {notification: n, players: [], viewerColor: 'blue'}});
}

describe('ConsoleNotificationCard — the detail action\'s label follows the CTA', () => {
  it('a card ABOUT THE PARLIAMENT reads «Open the Parliament» on its hold action', () => {
    const w = mountCard(card({cta: {labelKey: 'Open the Parliament', action: 'open-parliament'}}));
    expect(w.find('.con-notif__action--detail').text()).contains('Open the Parliament');
    expect(w.find('.con-notif__action--detail').text()).not.contains('Log');
    w.unmount();
  });

  it('every other card keeps the journal', () => {
    const w = mountCard(card({cta: {labelKey: 'To journal', action: 'open-journal'}}));
    expect(w.find('.con-notif__action--detail').text()).contains('Log');
    w.unmount();
  });
});
