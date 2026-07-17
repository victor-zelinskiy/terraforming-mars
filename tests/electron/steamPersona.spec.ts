import {expect} from 'chai';
import {personaNameFromLoginUsers} from '../../electron/steamPersona';

describe('electron/steamPersona', () => {
  describe('personaNameFromLoginUsers', () => {
    it('picks the account flagged MostRecent "1"', () => {
      const vdf = `"users"
{
\t"76561198000000001"
\t{
\t\t"AccountName"\t\t"olduser"
\t\t"PersonaName"\t\t"Old Account"
\t\t"MostRecent"\t\t"0"
\t\t"Timestamp"\t\t"1600000000"
\t}
\t"76561198000000002"
\t{
\t\t"AccountName"\t\t"currentuser"
\t\t"PersonaName"\t\t"Виктор"
\t\t"MostRecent"\t\t"1"
\t\t"Timestamp"\t\t"1700000000"
\t}
}`;
      expect(personaNameFromLoginUsers(vdf)).to.equal('Виктор');
    });

    it('falls back to the newest Timestamp when no MostRecent flag is set', () => {
      const vdf = `"users"
{
\t"1"
\t{
\t\t"PersonaName"\t\t"Older"
\t\t"MostRecent"\t\t"0"
\t\t"Timestamp"\t\t"1000"
\t}
\t"2"
\t{
\t\t"PersonaName"\t\t"Newer"
\t\t"MostRecent"\t\t"0"
\t\t"Timestamp"\t\t"2000"
\t}
}`;
      expect(personaNameFromLoginUsers(vdf)).to.equal('Newer');
    });

    it('returns the only account when there is a single user', () => {
      const vdf = `"users"
{
\t"42"
\t{
\t\t"PersonaName"\t\t"Solo Player"
\t\t"MostRecent"\t\t"1"
\t}
}`;
      expect(personaNameFromLoginUsers(vdf)).to.equal('Solo Player');
    });

    it('decodes escaped quotes in the persona name', () => {
      const vdf = `"users" { "1" { "PersonaName" "Ka\\"os" "MostRecent" "1" } }`;
      expect(personaNameFromLoginUsers(vdf)).to.equal('Ka"os');
    });

    it('is case-insensitive about the block + field names', () => {
      const vdf = `"Users" { "1" { "personaname" "Lower" "mostrecent" "1" } }`;
      expect(personaNameFromLoginUsers(vdf)).to.equal('Lower');
    });

    it('skips accounts with a blank PersonaName', () => {
      const vdf = `"users"
{
\t"1" { "PersonaName" "" "MostRecent" "1" }
\t"2" { "PersonaName" "Real Name" "Timestamp" "5" }
}`;
      expect(personaNameFromLoginUsers(vdf)).to.equal('Real Name');
    });

    it('returns undefined for an empty / no-users file', () => {
      expect(personaNameFromLoginUsers('')).to.equal(undefined);
      expect(personaNameFromLoginUsers('"users" { }')).to.equal(undefined);
    });

    it('never throws on malformed input', () => {
      expect(() => personaNameFromLoginUsers('"users" { "1" { "PersonaName"')).to.not.throw();
      expect(() => personaNameFromLoginUsers('garbage }{ "')).to.not.throw();
    });
  });
});
