import {expect} from 'chai';
import {
  automaDisplayName,
  automaDisplayNameWithDifficulty,
  displayNameForColor,
  participantDisplayName,
} from '@/client/components/marsbot/marsBotDisplay';

/**
 * Under the test runner no translation dictionary is loaded, so translateText
 * returns the KEY itself — i.e. the ENGLISH display ('MarsBot'). The Russian
 * dictionary maps the same key to «ИИ» (see src/locales/ru/automa.json);
 * make:json guards the pair. What these specs pin is the ROUTING: humans keep
 * their real name, the Automa seat always goes through the i18n key.
 */
describe('marsBotDisplay — the participant display-name resolver', () => {
  it('a human participant keeps their real name', () => {
    expect(participantDisplayName({name: 'Victor'})).eq('Victor');
    expect(participantDisplayName({name: 'Nastya', isMarsBot: false})).eq('Nastya');
  });

  it('the Automa seat resolves through the i18n key, never the raw server name', () => {
    expect(participantDisplayName({name: 'MarsBot', isMarsBot: true})).eq(automaDisplayName());
    // Even a hypothetical renamed bot seat localizes the same way.
    expect(participantDisplayName({name: 'Bot-3000', isMarsBot: true})).eq(automaDisplayName());
  });

  it('the compact difficulty label joins with the bullet', () => {
    expect(automaDisplayNameWithDifficulty('normal')).eq(`${automaDisplayName()} • Normal`);
    expect(automaDisplayNameWithDifficulty('brutal')).eq(`${automaDisplayName()} • Brutal`);
  });

  it('displayNameForColor resolves a colour to the participant label (bot → the i18n key, never «MarsBot»)', () => {
    const players = [
      {color: 'red', name: 'Victor'},
      {color: 'blue', name: 'MarsBot', isMarsBot: true},
    ];
    expect(displayNameForColor(players, 'red')).eq('Victor');
    expect(displayNameForColor(players, 'blue')).eq(automaDisplayName());
    // An unknown colour falls back to the colour string; undefined → ''.
    expect(displayNameForColor(players, 'green')).eq('green');
    expect(displayNameForColor(players, undefined)).eq('');
  });
});
