import {expect} from 'chai';
import {
  appId32,
  crc32,
  findOrNextKey,
  gridId64,
  newShortcutEntry,
  parseShortcuts,
  serializeShortcuts,
  VdfMap,
} from '../../electron/steamVdf';

describe('electron/steamVdf', () => {
  describe('crc32 / appId32 / gridId64', () => {
    it('crc32 matches the standard IEEE test vector', () => {
      // The canonical crc32("123456789") check value.
      expect(crc32('123456789')).to.equal(0xCBF43926);
    });

    it('crc32 is stable + differs for different content', () => {
      expect(crc32('abc')).to.equal(crc32('abc'));
      expect(crc32('abc')).to.not.equal(crc32('abd'));
    });

    it('appId32 sets the high bit and is deterministic', () => {
      const a = appId32('"C:\\Games\\tm.exe"Terraforming Mars');
      const b = appId32('"C:\\Games\\tm.exe"Terraforming Mars');
      expect(a).to.equal(b);
      // High bit set → always >= 0x80000000, and a valid unsigned 32-bit int.
      expect(a).to.be.at.least(0x80000000);
      expect(a).to.be.at.most(0xFFFFFFFF);
      expect(Number.isInteger(a)).to.equal(true);
    });

    it('gridId64 = (appid << 32) | 0x02000000', () => {
      const appId = appId32('"x"Y');
      expect(gridId64(appId)).to.equal((BigInt(appId) << 32n) | 0x02000000n);
    });
  });

  describe('VDF round-trip', () => {
    it('serializes and parses a shortcut entry losslessly', () => {
      const appId = appId32('"C:\\tm.exe"Terraforming Mars');
      const entry = newShortcutEntry({
        appId,
        appName: 'Terraforming Mars',
        exeQuoted: '"C:\\tm.exe"',
        startDirQuoted: '"C:\\"',
        icon: 'C:\\art\\header.jpg',
      });
      const root: VdfMap = {shortcuts: {'0': entry}};

      const bytes = serializeShortcuts(root);
      const parsed = parseShortcuts(bytes);

      const back = (parsed.shortcuts as VdfMap)['0'] as VdfMap;
      expect(back.appid).to.equal(appId);
      expect(back.AppName).to.equal('Terraforming Mars');
      expect(back.Exe).to.equal('"C:\\tm.exe"');
      expect(back.StartDir).to.equal('"C:\\"');
      expect(back.icon).to.equal('C:\\art\\header.jpg');
      expect(back.IsHidden).to.equal(0);
      expect(back.AllowOverlay).to.equal(1);
      expect(back.tags).to.deep.equal({});
    });

    it('preserves an existing int64 (0x07) field on re-serialize', () => {
      const root: VdfMap = {shortcuts: {'0': {AppName: 'X', LastPlayTime64: 0x1_0000_0001n}}};
      const parsed = parseShortcuts(serializeShortcuts(root));
      const entry = (parsed.shortcuts as VdfMap)['0'] as VdfMap;
      expect(entry.LastPlayTime64).to.equal(0x1_0000_0001n);
    });

    it('parseShortcuts guarantees a shortcuts map even for an empty root', () => {
      const parsed = parseShortcuts(serializeShortcuts({}));
      expect(parsed.shortcuts).to.deep.equal({});
    });
  });

  describe('findOrNextKey (upsert)', () => {
    const exeQuoted = '"C:\\tm.exe"';
    const appId = appId32(exeQuoted + 'Terraforming Mars');

    it('returns "0" for an empty shortcuts map', () => {
      expect(findOrNextKey({}, exeQuoted, appId)).to.equal('0');
    });

    it('reuses the key of an entry matching by Exe', () => {
      const shortcuts: VdfMap = {
        '0': {AppName: 'Other', Exe: '"C:\\other.exe"', appid: 123},
        '1': {AppName: 'TM', Exe: exeQuoted, appid: 999},
      };
      expect(findOrNextKey(shortcuts, exeQuoted, appId)).to.equal('1');
    });

    it('reuses the key of an entry matching by appid', () => {
      const shortcuts: VdfMap = {
        '0': {AppName: 'TM', Exe: '"C:\\moved.exe"', appid: appId},
      };
      expect(findOrNextKey(shortcuts, exeQuoted, appId)).to.equal('0');
    });

    it('returns the next free numeric index when no entry matches', () => {
      const shortcuts: VdfMap = {
        '0': {AppName: 'A', Exe: '"a"', appid: 1},
        '3': {AppName: 'B', Exe: '"b"', appid: 2},
      };
      expect(findOrNextKey(shortcuts, exeQuoted, appId)).to.equal('4');
    });
  });
});
