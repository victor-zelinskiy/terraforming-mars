import {expect} from 'chai';
import {buildTabbedTargets} from '@/client/console/consoleOrChoice';
import {tabbedTargetZone, tableTargetStandKey, isTableTargetStand} from '@/client/console/played/tableTargetZone';
import {TabbedTargetsStep} from '@/common/models/ActionPreviewModel';

/*
 * VIRUS AS ONE ZONE («ЦЕЛЬ НА СТОЛЕ — ОДНА ЗОНА», the owner 2026-10-30): the animal cards stand in their owners' groups,
 * every PLAYER target — the bot's animals, each player's plants — a stand-in tile reading the unit attacked. The answer
 * is the step's own target key (`buildTabbedTargets`), so the draft and the batch stay the historical ones.
 */
function virus(): TabbedTargetsStep {
  return {
    kind: 'tabbedTargets',
    animal: {
      label: 'Animals', icon: 'animal', amount: 2, branchIndex: 0,
      input: {type: 'card', cards: [{name: 'Pets', resources: 3}, {name: 'Birds', resources: 1, isDisabled: true, disabledReason: 'protected'}]},
      targets: [{color: 'green', name: 'MarsBot', current: 4, resulting: 2, optionIndex: 1}],
    },
    plant: {
      label: 'Plants', icon: 'plants', amount: 5,
      targets: [
        {color: 'red', name: 'Red', current: 6, resulting: 1, optionIndex: 2},
        {color: 'yellow', name: 'Yellow', current: 3, resulting: 3, optionIndex: -1, disabled: true, reason: 'Plants are protected'},
      ],
    },
    decline: {optionIndex: 3, label: 'Do not remove'},
  } as unknown as TabbedTargetsStep;
}

describe('tabbedTargetZone — Virus as one zone', () => {
  it('cards are cards, players are stand-ins reading the unit attacked', () => {
    const zone = tabbedTargetZone(virus());
    expect(zone.cards.map((c) => c.name), 'a refused card stays out, like every protected holder').to.deep.eq(['Pets']);
    expect(zone.stands.map((s) => s.key)).to.deep.eq([
      tableTargetStandKey('green', 'animal'), tableTargetStandKey('red', 'plants'), tableTargetStandKey('yellow', 'plants'),
    ]);
    expect(zone.stands.every((s) => isTableTargetStand(s.key))).to.eq(true);
    const bot = zone.stands[0];
    expect(bot.changes, 'the bot loses ANIMALS — never an M€ row').to.deep.eq([{icon: 'animal', from: 4, to: 2, scope: 'stock'}]);
    expect(zone.stands[2].refused, 'protected plants are SHOWN, refused with the server reason').to.eq('Plants are protected');
  });

  it('every choosable candidate answers through the step\'s own target key — its response verbatim', () => {
    const step = virus();
    const zone = tabbedTargetZone(step);
    const targets = buildTabbedTargets(step);
    expect([...zone.pickKeys.keys()]).to.deep.eq(['Pets', tableTargetStandKey('green', 'animal'), tableTargetStandKey('red', 'plants')]);
    for (const [zoneKey, pickKey] of zone.pickKeys) {
      const target = targets.find((t) => t.key === pickKey);
      expect(target, `${zoneKey} → ${pickKey}`).not.to.eq(undefined);
      expect(target!.disabled).to.eq(false);
    }
    expect(targets.find((t) => t.key === zone.pickKeys.get('Pets'))!.response).to.deep.eq({type: 'or', index: 0, response: {type: 'card', cards: ['Pets']}});
    expect(targets.find((t) => t.key === zone.pickKeys.get(tableTargetStandKey('green', 'animal')))!.response)
      .to.deep.eq({type: 'or', index: 1, response: {type: 'option'}});
    expect(zone.pickKeys.has(tableTargetStandKey('yellow', 'plants')), 'a refused stand answers nothing').to.eq(false);
  });
});
