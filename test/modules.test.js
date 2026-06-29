import test from 'node:test';
import assert from 'node:assert/strict';
import { renderVisualizationShowcase } from '../src/modules.js';

test('visualization showcase includes core modules requested by comparison matrix', () => {
  const html = renderVisualizationShowcase();
  const requiredIds = [
    'V-MULTISELECT-001',
    'V-RNA3D-001',
    'V-SECONDARY-001',
    'V-PIE-001',
    'V-HIST-001',
    'V-TABLE-001',
    'V-SEARCH-001'
  ];

  for (const id of requiredIds) {
    assert.ok(html.includes(id), `missing module: ${id}`);
  }

  assert.match(html, /Aptamer-style Multi-selection Module/);
  assert.match(html, /RNA 3D Structure Viewer \(Mol\*\)/);
  assert.match(html, /RNA Secondary Structure Viewer \(Forna\)/);
  assert.match(html, /Category Distribution/);
  assert.match(html, /Year Distribution/);
  assert.match(html, /Data Details/);
  assert.match(html, /Data Filtering/);
});
