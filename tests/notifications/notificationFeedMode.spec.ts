import {expect} from 'chai';
import {
  FEED_MODE_CHOICES,
  FEED_MODE_LABELS,
  notificationFeedModeState,
  setNotificationFeedMode,
} from '@/client/components/notifications/notificationFeedMode';

describe('notificationFeedMode (the persisted quick-toast mode)', () => {
  afterEach(() => {
    setNotificationFeedMode('all');
  });

  it("defaults to 'all' — the pre-setting behaviour survives an update untouched", () => {
    expect(notificationFeedModeState.mode).to.eq('all');
  });

  it('the settings ring covers exactly the two modes, each with an i18n label', () => {
    expect(FEED_MODE_CHOICES).to.deep.eq(['all', 'personal']);
    expect(FEED_MODE_LABELS.all).to.eq('All events');
    expect(FEED_MODE_LABELS.personal).to.eq('Only involving me');
  });

  it('the setter applies reactively and persists through the canonical tm_ storage', () => {
    const globals = globalThis as {localStorage?: Storage};
    const hadOwn = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    const written = new Map<string, string>();
    const fake = {
      getItem: (k: string) => written.get(k) ?? null,
      setItem: (k: string, v: string) => void written.set(k, v),
    } as unknown as Storage;
    Object.defineProperty(globalThis, 'localStorage', {value: fake, configurable: true});
    try {
      setNotificationFeedMode('personal');
      expect(notificationFeedModeState.mode).to.eq('personal');
      expect(written.get('tm_notification_feed'), 'the restart-surviving record').to.eq('personal');
      setNotificationFeedMode('all');
      expect(written.get('tm_notification_feed')).to.eq('all');
    } finally {
      if (hadOwn !== undefined) {
        Object.defineProperty(globalThis, 'localStorage', hadOwn);
      } else {
        delete globals.localStorage;
      }
    }
  });

  it('a missing / throwing storage still applies the mode in-session', () => {
    const hadOwn = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    Object.defineProperty(globalThis, 'localStorage', {
      get() {
        throw new Error('SecurityError');
      },
      configurable: true,
    });
    try {
      setNotificationFeedMode('personal');
      expect(notificationFeedModeState.mode).to.eq('personal');
    } finally {
      if (hadOwn !== undefined) {
        Object.defineProperty(globalThis, 'localStorage', hadOwn);
      } else {
        delete (globalThis as {localStorage?: Storage}).localStorage;
      }
    }
  });
});
