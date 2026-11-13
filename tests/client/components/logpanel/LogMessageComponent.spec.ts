import {shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import LogMessageComponent from '@/client/components/logpanel/LogMessageComponent.vue';
import {fakePublicPlayerModel, fakeViewModel} from '../testHelpers';
import {LogMessage} from '@/common/logs/LogMessage';
import {LogMessageType} from '@/common/logs/LogMessageType';
import {LogMessageDataType} from '@/common/logs/LogMessageDataType';
import {CardName} from '@/common/cards/CardName';
import {PreferencesManager} from '@/client/utils/PreferencesManager';
import {getSpaceName} from '@/common/boards/spaces';
import {logResourceIconClass, logResourceLabelKey} from '@/client/components/journal/logResourceToken';

describe('LogMessageComponent', () => {
  beforeEach(() => {
    PreferencesManager.resetForTest();
    PreferencesManager.INSTANCE.set('lang', 'en');
  });

  afterEach(() => {
    PreferencesManager.resetForTest();
  });

  it('mounts without errors', () => {
    const wrapper = shallowMount(LogMessageComponent, {
      ...globalConfig,
      props: {
        message: new LogMessage(LogMessageType.DEFAULT, 'Test message', []),
        viewModel: fakeViewModel(),
      },
    });
    expect(wrapper.exists()).to.be.true;
  });

  it('renders CARD type as a single card span', () => {
    const message = new LogMessage(LogMessageType.DEFAULT, '${0}', [
      {type: LogMessageDataType.CARD, value: CardName.ANTS},
    ]);
    const wrapper = shallowMount(LogMessageComponent, {
      ...globalConfig,
      props: {
        message,
        viewModel: fakeViewModel(),
      },
    });

    const cardContainer = wrapper.find('.log-card').element.parentElement!;
    expect(cardContainer.innerHTML).to.equal(
      '<span class="log-card background-color-active">Ants</span>',
    );
  });

  it('renders CARDS type as multiple card spans with locale-correct separator in English', () => {
    const message = new LogMessage(
      LogMessageType.DEFAULT,
      '${0}',
      [{type: LogMessageDataType.CARDS, value: [CardName.ALGAE, CardName.BIRDS, CardName.CELESTIC]}]);

    const wrapper = shallowMount(LogMessageComponent, {
      ...globalConfig,
      props: {message, viewModel: fakeViewModel()},
    });

    const cardsContainer = wrapper.find('.log-card').element.parentElement!;
    expect(cardsContainer.innerHTML).to.equal(
      '<span class="log-card background-color-automated">Algae</span>' +
      ', ' +
      '<span class="log-card background-color-active">Birds</span>' +
      ', and ' +
      '<span class="log-card background-color-corporation">Celestic</span>',
    );
  });

  it('renders CARDS type as multiple card spans', () => {
    const message = new LogMessage(LogMessageType.DEFAULT, '${0}', [
      {type: LogMessageDataType.CARDS, value: [CardName.ANTS, CardName.ECOLINE, CardName.BIRDS]},
    ]);
    const wrapper = shallowMount(LogMessageComponent, {
      ...globalConfig,
      props: {
        message,
        viewModel: fakeViewModel(),
      },
    });

    const cardsContainer = wrapper.find('.log-card').element.parentElement!;
    expect(cardsContainer.innerHTML).to.equal(
      '<span class="log-card background-color-active">Ants</span>' +
      ', ' +
      '<span class="log-card background-color-corporation">Ecoline</span>' +
      ', and ' +
      '<span class="log-card background-color-active">Birds</span>',
    );
  });

  it('renders CARDS with locale-correct separator for French (fr)', () => {
    PreferencesManager.INSTANCE.set('lang', 'fr');
    try {
      const message = new LogMessage(
        LogMessageType.DEFAULT,
        '${0}',
        [{type: LogMessageDataType.CARDS, value: [CardName.ALGAE, CardName.BIRDS, CardName.CELESTIC]}]);
      const wrapper = shallowMount(LogMessageComponent, {
        ...globalConfig,
        props: {message, viewModel: fakeViewModel()},
      });
      // French conjunction list format: "A, B et C" (no Oxford comma)
      const cardsContainer = wrapper.find('.log-card').element.parentElement!;
      expect(cardsContainer.innerHTML).to.equal(
        '<span class="log-card background-color-automated">Algae</span>' +
        ', ' +
        '<span class="log-card background-color-active">Birds</span>' +
        ' et ' +
        '<span class="log-card background-color-corporation">Celestic</span>',
      );
    } finally {
      PreferencesManager.INSTANCE.set('lang', 'en');
    }
  });

  it('renders CARDS with locale-correct separator for Japanese (jp)', () => {
    PreferencesManager.INSTANCE.set('lang', 'jp');
    try {
      const message = new LogMessage(
        LogMessageType.DEFAULT,
        '${0}',
        [{type: LogMessageDataType.CARDS, value: [CardName.ALGAE, CardName.BIRDS, CardName.CELESTIC]}]);
      const wrapper = shallowMount(LogMessageComponent, {
        ...globalConfig,
        props: {message, viewModel: fakeViewModel()},
      });
      // Japanese conjunction list format: "A、B、C" (Japanese comma separator)
      const cardsContainer = wrapper.find('.log-card').element.parentElement!;
      expect(cardsContainer.innerHTML).to.equal(
        '<span class="log-card background-color-automated">Algae</span>' +
        '、' +
        '<span class="log-card background-color-active">Birds</span>' +
        '、' +
        '<span class="log-card background-color-corporation">Celestic</span>',
      );
    } finally {
      PreferencesManager.INSTANCE.set('lang', 'en');
    }
  });

  it('names a PLAYER token by the seat of its view, on the seat\'s colour; a colour nobody holds reads as the colour', () => {
    const message = new LogMessage(LogMessageType.DEFAULT, '${0} and ${1}', [
      {type: LogMessageDataType.PLAYER, value: 'blue'},
      {type: LogMessageDataType.PLAYER, value: 'red'},
    ]);
    const wrapper = shallowMount(LogMessageComponent, {
      ...globalConfig,
      props: {message, viewModel: fakeViewModel({players: [fakePublicPlayerModel({name: 'Ada', color: 'blue'})]})},
    });

    const players = wrapper.findAll('.log-player');
    expect(players.map((player) => player.classes())).to.deep.eq([
      ['log-player', 'player_bg_color_blue'],
      ['log-player', 'player_bg_color_red'],
    ]);
    expect(players.map((player) => player.text())).to.deep.eq(['Ada', 'red']);
    expect(wrapper.findAll('.log-plain-text').map((text) => text.text())).to.include('and');
  });

  it('an announcement wears its class; a RESOURCE token is the shared icon, named for a screen reader', () => {
    const message = new LogMessage(LogMessageType.ANNOUNCEMENT, 'gained ${0}', [
      {type: LogMessageDataType.RESOURCE, value: 'megacredits'},
    ]);
    const wrapper = shallowMount(LogMessageComponent, {
      ...globalConfig,
      props: {message, viewModel: fakeViewModel()},
    });

    expect(wrapper.classes()).to.deep.eq(['log-announcement']);
    const icon = wrapper.find('.log-resource-icon');
    expect(icon.classes()).to.include.members(logResourceIconClass('megacredits').split(' '));
    expect(icon.attributes('role')).to.eq('img');
    expect(icon.attributes('aria-label')).to.eq(logResourceLabelKey('megacredits'));
  });

  it('emits `click` on a click of the row, and `spaceClicked` with the cell\'s id on a click of a SPACE token', async () => {
    const message = new LogMessage(LogMessageType.DEFAULT, 'a tile on ${0}', [
      {type: LogMessageDataType.SPACE, value: '05'},
    ]);
    const wrapper = shallowMount(LogMessageComponent, {
      ...globalConfig,
      props: {message, viewModel: fakeViewModel()},
    });
    const space = wrapper.find('.log-space-id');
    expect(space.text()).to.eq(getSpaceName('05'));
    expect(space.find('circle').attributes('fill'), 'a cell of Mars').to.eq('#b7410e');
    expect(wrapper.emitted('click')).to.eq(undefined);
    expect(wrapper.emitted('spaceClicked')).to.eq(undefined);

    await wrapper.trigger('click');
    expect(wrapper.emitted('click')).to.not.eq(undefined);

    await space.trigger('click');
    expect(wrapper.emitted('spaceClicked')).to.deep.eq([['05']]);
  });
});
