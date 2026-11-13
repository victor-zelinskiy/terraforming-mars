/*
 * BoardPlacementPreviewPopover — the floating host of the placement preview beside a LEGAL board cell. A
 * `<script setup>` component (step A of docs/claude/vapor/RECIPES.md). It owns three things: WHEN the preview stands
 * (there is a preview AND a cell to stand by), its TITLE (by the placement's kind) and WHERE it stands (above the
 * cell, flipped below near the viewport's top, never past a side edge). The facts themselves are the inner
 * component's subject.
 */
import {mount} from '@vue/test-utils';
import {defineComponent, h} from 'vue';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import {$t} from '@/client/directives/i18n';
import {BoardPlacementKind, BoardPlacementPreview} from '@/common/boards/BoardInformationFacts';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {SpaceId} from '@/common/Types';
import BoardPlacementPreviewPopover from '@/client/components/board/BoardPlacementPreviewPopover.vue';

// The preview's content has its own spec; this one reads what the host HANDS it.
// (A render function, not a template string: the runtime compiler is not in this build.)
const ContentStub = defineComponent({
  name: 'BoardPlacementPreviewContent',
  props: ['preview', 'viewerColor', 'players'],
  render: () => h('i', {class: 'content-stub'}),
});

function preview(kind: BoardPlacementKind): BoardPlacementPreview {
  return {
    space: '33' as SpaceId,
    kind,
    legal: true,
    costFacts: [],
    immediateFacts: [],
    recipientFacts: [],
    warningFacts: [],
    futureScoringFacts: [],
    ruleFacts: [],
  };
}

/** A cell's screen rect, as `getBoundingClientRect()` hands it over. */
function rect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    x: left, y: top, left, top, width, height, right: left + width, bottom: top + height,
    toJSON: () => ({}),
  };
}

// The teleport is stubbed so the host is read where it is rendered (its target is the document's body).
function popover(props: Record<string, unknown>) {
  return mount(BoardPlacementPreviewPopover, {
    ...globalConfig,
    props,
    global: {...globalConfig.global, stubs: {teleport: true, BoardPlacementPreviewContent: ContentStub}},
  });
}

function hostStyle(w: ReturnType<typeof popover>): CSSStyleDeclaration {
  return (w.find('.board-preview-host').element as HTMLElement).style;
}

describe('BoardPlacementPreviewPopover — the placement preview beside a legal cell', () => {
  it('stands only with a preview AND a cell to stand by', async () => {
    const w = popover({preview: preview('city')});
    expect(w.find('.board-preview-host').exists(), 'no anchor — nothing').to.eq(false);

    await w.setProps({anchor: rect(400, 400, 60, 60)});
    expect(w.find('.board-preview-host').exists()).to.eq(true);
    expect(w.find('.board-preview-host > .board-preview-host__card > .board-preview-host__title').exists()).to.eq(true);

    await w.setProps({preview: undefined});
    expect(w.find('.board-preview-host').exists(), 'no preview — nothing').to.eq(false);
  });

  it('is titled by the placement\'s kind — and follows it', async () => {
    const w = popover({preview: preview('city'), anchor: rect(400, 400, 60, 60)});
    const title = () => w.find('.board-preview-host__title').text();
    expect(title()).to.eq($t('Place a city'));

    await w.setProps({preview: preview('greenery')});
    expect(title()).to.eq($t('Place a greenery'));

    await w.setProps({preview: preview('upgradeable-ocean')});
    expect(title()).to.eq($t('Place an ocean tile'));

    await w.setProps({preview: preview('volcanic')});
    expect(title(), 'a kind with no title of its own').to.eq($t('Place a tile'));
  });

  it('hands the content the preview, the viewer\'s colour and the players', () => {
    const cityPreview = preview('city');
    const players = [{color: 'red', name: 'Alice'}, {color: 'blue', name: 'Bob'}] as unknown as ReadonlyArray<PublicPlayerModel>;
    const w = popover({preview: cityPreview, anchor: rect(400, 400, 60, 60), viewerColor: 'red', players});
    const inner = w.findComponent(ContentStub);
    expect(inner.props('preview')).to.deep.eq(cityPreview);
    expect(inner.props('viewerColor')).to.eq('red');
    expect(inner.props('players')).to.deep.eq(players);

    const bare = popover({preview: cityPreview, anchor: rect(400, 400, 60, 60)}).findComponent(ContentStub);
    expect(bare.props('viewerColor'), 'no viewer given').to.eq(undefined);
    expect(bare.props('players'), 'no players given').to.deep.eq([]);
  });

  it('stands ABOVE the cell, centred on it — flips BELOW near the viewport\'s top and never spills past a side edge', async () => {
    const w = popover({preview: preview('ocean'), anchor: rect(400, 400, 60, 60)});
    expect(hostStyle(w).left).to.eq('430px');
    expect(hostStyle(w).top, '10px over the cell').to.eq('390px');
    expect(hostStyle(w).transform).to.eq('translate(-50%, -100%)');

    await w.setProps({anchor: rect(400, 100, 60, 60)});
    expect(hostStyle(w).left).to.eq('430px');
    expect(hostStyle(w).top, '10px under the cell').to.eq('170px');
    expect(hostStyle(w).transform).to.eq('translate(-50%, 0)');

    const half = 330 / 2 + 8;
    await w.setProps({anchor: rect(0, 400, 20, 20)});
    expect(hostStyle(w).left, 'the left edge').to.eq(`${half}px`);

    await w.setProps({anchor: rect(window.innerWidth - 20, 400, 20, 20)});
    expect(hostStyle(w).left, 'the right edge').to.eq(`${Math.round(window.innerWidth - half)}px`);
  });
});
