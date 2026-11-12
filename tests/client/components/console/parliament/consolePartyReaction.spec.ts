/*
 * ConsolePartyReaction — the ruling party's ANSWER (Turmoil Redux): one graphic row for what a resolution's own party
 * pays on top of the resolution's effect. A `<script setup>` component (step A of docs/claude/vapor/RECIPES.md):
 * nothing here computes — the reading arrives from `partyReactionModel.ts`; the row says WHOSE rule it is, what it
 * pays, what it answered and (unless the host's own kicker already does) which moment. It emits and exposes nothing.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {globalConfig} from '../../getLocalVue';
import {$t, translateText} from '@/client/directives/i18n';
import {Resource} from '@/common/Resource';
import {PartyName} from '@/common/turmoil/PartyName';
import {PartyReaction} from '@/common/parliament/partyReactions';
import {PartyReactionReading, reactionCaptionOf} from '@/client/console/parliament/partyReactionModel';
import {partyNameKey} from '@/client/console/parliament/partyNames';
import {partyEmblemUrl} from '@/client/components/premiumCard/partyEmblems';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import ConsolePartyReaction from '@/client/components/console/parliament/ConsolePartyReaction.vue';

/** The Greens' rule in its declared shape: a step of plant OR heat production → M€ production. */
const greens: PartyReaction = {
  id: 'greens-production',
  trigger: {kind: 'production-gain', resources: [Resource.PLANTS, Resource.HEAT]},
  gain: {kind: 'production', resource: Resource.MEGACREDITS},
  per: 1,
};

const reading = (over: Partial<PartyReactionReading> = {}): PartyReactionReading => ({
  party: PartyName.GREENS,
  reaction: greens,
  moment: 'conditional',
  units: 2,
  amount: 2,
  trigger: {kind: 'production', resource: Resource.HEAT},
  ...over,
});

const row = (props: {reading: PartyReactionReading, size?: string, withCaption?: boolean}, attrs: Record<string, unknown> = {}) =>
  mount(ConsolePartyReaction, {...globalConfig, props, attrs});

const sprite = (resource: Resource) => iconClassFor(resource).split(' ').filter((c) => c !== '');

describe('ConsolePartyReaction — the ruling party\'s answer', () => {
  it('says WHOSE rule it is, what it pays and what it ANSWERED — and carries the reading on its root', () => {
    const w = row({reading: reading()});
    expect(w.classes()).to.include.members(['con-preact', 'con-preact--compact', 'con-preact--conditional']);
    expect(w.attributes('data-party-reaction')).to.not.eq(undefined);
    expect(w.attributes('data-reaction-party')).to.eq(PartyName.GREENS);
    expect(w.attributes('data-reaction-moment')).to.eq('conditional');
    expect(w.attributes('data-reaction-units')).to.eq('2');
    expect(w.attributes('data-reaction-amount')).to.eq('2');

    expect(w.find('.con-preact__who img.con-preact__emblem').attributes('src')).to.eq(partyEmblemUrl(PartyName.GREENS));
    expect(w.find('.con-preact__who .con-preact__party').text(), 'the Parliament\'s own name of the party').to.eq($t(partyNameKey(PartyName.GREENS)));

    expect(w.find('.con-preact__amount').text()).to.eq('+2');
    // The gain in the game's own production frame; «per» what it answered — the reading's trigger (heat), not the
    // first resource of the rule's list (plants).
    const gain = w.find('.con-preact__body > i.con-preact__unit');
    expect(gain.classes()).to.include.members([...sprite(Resource.MEGACREDITS), 'con-preact__unit--prod']);
    const trigger = w.find('.con-preact__per i.con-preact__unit--trigger');
    expect(trigger.classes()).to.include.members([...sprite(Resource.HEAT), 'con-preact__unit--prod']);
    expect(trigger.classes(), 'never the first resource of the rule\'s list').to.not.include('resource_icon--plants');

    expect(w.find('[data-reaction-caption]').text(), 'the moment\'s caption, by default').to.eq(translateText(reactionCaptionOf(reading())));
  });

  it('a STOCK gain or trigger wears no production frame', () => {
    const stock = reading({
      reaction: {...greens, gain: {kind: 'stock', resource: Resource.PLANTS}},
      trigger: {kind: 'stock', resource: Resource.HEAT},
      amount: 3,
    });
    const w = row({reading: stock});
    expect(w.find('.con-preact__amount').text()).to.eq('+3');
    expect(w.find('.con-preact__body > i.con-preact__unit').classes()).to.include.members(sprite(Resource.PLANTS));
    for (const unit of w.findAll('i.con-preact__unit')) {
      expect(unit.classes()).to.not.include('con-preact__unit--prod');
    }
  });

  it('the size and the caption are the host\'s: `normal` on a stage, no caption under a kicker that states the moment', () => {
    const w = row({reading: reading({moment: 'applied'}), size: 'normal', withCaption: false});
    expect(w.classes()).to.include.members(['con-preact--normal', 'con-preact--applied']);
    expect(w.classes()).to.not.include('con-preact--compact');
    expect(w.find('[data-reaction-caption]').exists()).to.eq(false);
    expect(w.find('.con-preact__party').text(), 'the name still says whose rule pays').to.eq($t(partyNameKey(PartyName.GREENS)));
  });

  it('the template STARTS WITH ITS ROOT and follows its reading — another party, another amount, the same row', async () => {
    const w = row({reading: reading()}, {'class': 'from-host', 'data-from-host': 'yes'});
    expect((w.element as HTMLElement).tagName).to.eq('DIV');
    expect(w.classes()).to.include.members(['con-preact', 'from-host']);
    expect(w.attributes('data-from-host')).to.eq('yes');
    await w.setProps({reading: reading({party: PartyName.MARS, units: 3, amount: 6, moment: 'resolving'})});
    expect(w.attributes('data-reaction-party')).to.eq(PartyName.MARS);
    expect(w.attributes('data-reaction-amount')).to.eq('6');
    expect(w.classes()).to.include('con-preact--resolving');
    expect(w.find('img.con-preact__emblem').attributes('src')).to.eq(partyEmblemUrl(PartyName.MARS));
    expect(w.find('.con-preact__party').text()).to.eq($t(partyNameKey(PartyName.MARS)));
    expect(w.find('.con-preact__amount').text()).to.eq('+6');
  });
});
