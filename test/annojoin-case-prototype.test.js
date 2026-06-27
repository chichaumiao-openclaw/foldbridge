import test from 'node:test';
import assert from 'node:assert/strict';
import { renderAnnojointCasePrototypePage } from '../src/annojoinCasePrototypeView.js';

test('ANNOJOIN case prototype renders VARNA and Molstar integration targets', () => {
  const html = renderAnnojointCasePrototypePage({
    caseAsset: {
      case: { caseId: '10ZT', pdbId: '10ZT', assayFamilies: ['rmdb_chemical_probing'] },
      summary: { recommendedDefaultPreset: 'balanced_segment_view' },
      visualPreview: {
        pairArcs: [{ segmentLabel: '10ZT:2-69', start: 2, end: 69, lssStatus: 'LSS_MODERATE_CANDIDATE' }],
        reactivity1d: {
          points: [
            { pdbResidue: 'A:2 T', reactivityValue: 0.6, colorBin: 'mid' },
            { pdbResidue: 'A:3 G', reactivityValue: 1.4, colorBin: 'high' }
          ]
        },
        structureColoring: {
          structureUrl: '/api/annojoin/structure?path=CONFIDENCE%2F10_structure_context%2Fx%2F10zt.cif',
          structureFilePath: 'CONFIDENCE/10_structure_context/x/10zt.cif'
        }
      }
    },
    caseId: '10ZT'
  });

  assert.match(html, /data-annojoin-varna-prototype/);
  assert.match(html, /data-annojoin-molstar/);
  assert.match(html, /data-structure-url="\/api\/annojoin\/structure\?path=CONFIDENCE/);
});
