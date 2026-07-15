import {expect} from 'chai';
import {ActionPreviewStep} from '../../../../src/common/models/ActionPreviewModel';
import {isSkippedWarning, skippedEffectView, skippedEffectViews} from '../../../../src/client/components/actions/skippedEffectView';

// The PURE derivation behind every "this effect is skipped" block (the desktop play
// modal, the action notice, both console composers). It has no Vue/DOM dependency,
// so it runs under the server test runner like the other pure view-models.
describe('skippedEffectView', () => {
  const warning = (extra: object = {}): ActionPreviewStep => ({
    kind: 'note',
    noteKind: 'warning',
    text: 'No valid target — this effect is skipped.',
    ...extra,
  } as ActionPreviewStep);

  it('names the skipped effect and carries its magnitude chip', () => {
    const view = skippedEffectView(warning({
      skipped: {
        label: 'Remove plants from another player',
        effect: {direction: 'cost', icon: 'plants', amount: 3},
      },
    }));
    expect(view.title).eq('Remove plants from another player');
    expect(view.reason).eq('No valid target — this effect is skipped.');
    expect(view.effect?.amount).eq(3);
    // The chip renders its own icon; `icon` mirrors it so a host can fall back.
    expect(view.icon).eq('plants');
  });

  it('an either/or attack has a name but NO invented magnitude', () => {
    const view = skippedEffectView(warning({skipped: {label: 'Steal resources from another player'}}));
    expect(view.title).eq('Steal resources from another player');
    expect(view.effect).is.undefined;
    expect(view.icon).eq('');
  });

  it('falls back to the lost card-resource icon when there is no chip', () => {
    const view = skippedEffectView(warning({
      resource: 'microbe',
      skipped: {label: 'Add resources to a card'},
    }));
    expect(view.icon).eq('microbe');
  });

  // A warning built before `skipped` existed (or by a future producer that forgets
  // it) must still render honestly — the reason line alone, never a crash.
  it('degrades to the bare reason when the producer named no effect', () => {
    const view = skippedEffectView(warning());
    expect(view.title).eq('');
    expect(view.reason).eq('No valid target — this effect is skipped.');
    expect(view.effect).is.undefined;
    expect(view.icon).eq('');
  });

  it('a warning with no text at all still states a reason', () => {
    const view = skippedEffectView({kind: 'note', noteKind: 'warning'} as ActionPreviewStep);
    expect(view.reason).eq('No valid target — this effect is skipped.');
  });

  it('resolves a Message text/label to its string', () => {
    const view = skippedEffectView(warning({
      text: {message: 'Plants are protected', data: []},
      skipped: {label: {message: 'Remove plants from another player', data: []}},
    }));
    expect(view.reason).eq('Plants are protected');
    expect(view.title).eq('Remove plants from another player');
  });

  it('isSkippedWarning selects only warning notes', () => {
    expect(isSkippedWarning(warning())).is.true;
    expect(isSkippedWarning({kind: 'note', noteKind: 'board'} as ActionPreviewStep)).is.false;
    expect(isSkippedWarning({kind: 'boardPlacement', placementType: 'ocean'} as ActionPreviewStep)).is.false;
  });

  it('skippedEffectViews keeps emission order and ignores non-warnings', () => {
    const views = skippedEffectViews([
      {kind: 'boardPlacement', placementType: 'ocean'} as ActionPreviewStep,
      warning({skipped: {label: 'Add resources to a card'}}),
      {kind: 'note', noteKind: 'generic'} as ActionPreviewStep,
      warning({skipped: {label: 'Remove plants from another player'}}),
    ]);
    expect(views.map((v) => v.title)).deep.eq(['Add resources to a card', 'Remove plants from another player']);
  });

  it('undefined steps → no warnings', () => {
    expect(skippedEffectViews(undefined)).has.length(0);
  });
});
