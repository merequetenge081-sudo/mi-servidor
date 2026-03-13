import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const helpersFile = path.resolve(__dirname, '../../public/js/utils/skills-ui.helpers.js');

const sandbox = {
  module: { exports: {} },
  exports: {},
  window: {}
};

vm.runInNewContext(fs.readFileSync(helpersFile, 'utf8'), sandbox);
const helpers = sandbox.module.exports;

describe('skills-ui.helpers', () => {
  test('formatDuration formats seconds and minutes', () => {
    expect(helpers.formatDuration('2026-03-08T10:00:00.000Z', '2026-03-08T10:00:20.000Z')).toBe('20s');
    expect(helpers.formatDuration('2026-03-08T10:00:00.000Z', '2026-03-08T10:02:05.000Z')).toBe('2m 5s');
  });

  test('summarizeSkillOutput returns dedup summary', () => {
    const text = helpers.summarizeSkillOutput('deduplication', {
      byType: {
        exact_duplicate: 2,
        probable_duplicate: 1,
        repeated_phone: 4,
        orphan_record: 1,
        puesto_localidad_mismatch: 3
      }
    });
    expect(text).toContain('exact=2');
    expect(text).toContain('probable=1');
    expect(text).toContain('mismatch=3');
  });

  test('summarizeSkillOutput returns scoring distribution', () => {
    const text = helpers.summarizeSkillOutput('scoring', {}, [
      { output: { priority: 'high' } },
      { output: { priority: 'medium' } },
      { output: { priority: 'low' } }
    ]);
    expect(text).toContain('Alta: 1');
    expect(text).toContain('Media: 1');
    expect(text).toContain('Baja: 1');
  });
});
