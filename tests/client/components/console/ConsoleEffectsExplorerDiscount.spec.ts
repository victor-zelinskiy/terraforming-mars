import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import ConsoleEffectsExplorer from '@/client/components/console/ConsoleEffectsExplorer.vue';
import {EffectForecast, emptyEffectForecast} from '@/common/models/EffectForecastModel';
import {EventSource} from '@/common/events/EventSource';
import {CardName} from '@/common/cards/CardName';
import {PartyName} from '@/common/turmoil/PartyName';
import {allResolutions} from '@/client/parliament/ClientParliamentManifest';
import {partyEmblemUrl} from '@/client/components/premiumCard/partyEmblems';
import {translateText} from '@/client/directives/i18n';

/*
 * THE FORECAST'S DISCOUNT GROUP NAMES A POLITICAL SOURCE (Turmoil Redux): a
 * discount the ENACTED RESOLUTION's law took off the price (Heat Capture's
 * 3 M€ on a Building tag) or a party's policy took is a line of the R3
 * «Эффекты» layer titled by the LAW / the party and wearing the party's
 * emblem — never «Other discounts». The server itemizes it under the
 * resolution's source in `getCardCostBreakdown`; this is the client's half:
 * a price that fell for no named reason is the silent loss both halves exist
 * to prevent. A card's own discount keeps the card's name and face.
 */
const BLUE = 'blue';

/** A REAL dealt resolution — found by its declaration, never by name (the client knows no ids). */
function dealtResolution() {
  const found = allResolutions().find((r) => r.copies > 0);
  if (found === undefined) {
    throw new Error('the catalog ships no dealt resolution');
  }
  return found;
}

function forecastWith(source: EventSource): EffectForecast {
  return {...emptyEffectForecast(10), discounts: {base: 10, final: 7, items: [{source, amount: 3}], other: 0}};
}

function mountExplorer(forecast: EffectForecast) {
  return mount(ConsoleEffectsExplorer, {
    global: globalConfig.global,
    props: {
      cards: [],
      color: BLUE,
      mode: 'forecast',
      forecast,
      players: [{color: BLUE, name: 'Blue', tableau: []}],
    },
  });
}

describe('ConsoleEffectsExplorer — a political discount is NAMED', () => {
  it('a discount of the ENACTED RESOLUTION is titled by the law\'s printed name and wears its party\'s emblem', () => {
    const law = dealtResolution();
    const w = mountExplorer(forecastWith({kind: 'resolution', id: law.id, owner: BLUE}));
    const tile = w.find('[data-forecast-item="discount"]');
    expect(tile.exists(), 'the discount group lists the line').to.be.true;
    expect(tile.find('.con-efx__tile-src').text()).to.eq(translateText(law.text.name));
    expect(tile.find('.con-efx__tile-src').text()).to.not.eq(translateText('Other discounts'));
    const emblem = tile.find('.con-efx__party-emblem');
    expect(emblem.exists(), 'the party\'s emblem stands where a card\'s graphic would').to.be.true;
    expect(emblem.attributes('src')).to.eq(partyEmblemUrl(law.party));
    expect(tile.find('.con-efx__meta-num').text(), 'the amount the law takes off').to.eq('−3');
    expect(tile.find('.con-efx__tile-owner').exists(), 'the viewer\'s own law needs no owner plate').to.be.false;
  });

  it('a discount of a PARTY\'s policy is titled by the party and wears its emblem', () => {
    const w = mountExplorer(forecastWith({kind: 'party', name: PartyName.UNITY}));
    const tile = w.find('[data-forecast-item="discount"]');
    expect(tile.find('.con-efx__tile-src').text()).to.eq(translateText(PartyName.UNITY));
    expect(tile.find('.con-efx__party-emblem').attributes('src')).to.eq(partyEmblemUrl(PartyName.UNITY));
  });

  it('a discount of a CARD keeps the card\'s name and no party emblem', () => {
    const w = mountExplorer(forecastWith({kind: 'card', card: CardName.EARTH_CATAPULT, owner: BLUE}));
    const tile = w.find('[data-forecast-item="discount"]');
    expect(tile.find('.con-efx__tile-src').text()).to.eq(translateText(CardName.EARTH_CATAPULT));
    expect(tile.find('.con-efx__party-emblem').exists()).to.be.false;
  });
});
