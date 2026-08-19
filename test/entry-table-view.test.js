import test from 'node:test';
import assert from 'node:assert/strict';
import { renderEntryTablePage } from '../src/entryTableView.js';
import { entryCaseHref } from '../src/entryTable.js';

const CASE_BASE = './public/entry-cases';

function makeRow(overrides = {}) {
  return {
    pdbId: '7SYS',
    auth: 'z',
    chainKey: 'I[z]',
    sciName: 'demo',
    partition: 'rRNA',
    probingCategory: '',
    nProfiles: 3,
    confidenceClass: '',
    sourceLanes: '',
    ...overrides
  };
}

test('renderEntryTablePage renders in-site entry-case link for a built (non-missing) PDB', () => {
  const row = makeRow({ pdbId: '7SYS', auth: 'z' });
  const html = renderEntryTablePage({ rows: [row], caseBase: CASE_BASE, missingPdbs: new Set(['OTHR']) });
  assert.ok(html.includes('<a class="entry-table-link"'), 'expected an anchor link');
  const expectedHref = entryCaseHref(CASE_BASE, row);
  assert.equal(expectedHref, '#entry-case?pdb=7SYS&chain=z', 'sanity: href uses the in-site entry-case route');
  assert.ok(
    html.includes('href="#entry-case?pdb=7SYS&amp;chain=z"'),
    'expected HTML-escaped href to point at the in-site entry-case route'
  );
});

test('renderEntryTablePage renders plain text (no <a>) for a missing PDB', () => {
  const row = makeRow({ pdbId: '10PX', auth: 'A' });
  const html = renderEntryTablePage({ rows: [row], caseBase: CASE_BASE, missingPdbs: new Set(['10PX']) });
  assert.ok(!html.includes('<a'), 'expected no anchor for missing PDB');
  assert.ok(html.includes('<td>10PX</td>'), 'expected PDB as plain text in a <td>');
});

test('renderEntryTablePage accepts missingPdbs as an Array (equivalent to Set)', () => {
  const row = makeRow({ pdbId: '10PX', auth: 'A' });
  const html = renderEntryTablePage({ rows: [row], caseBase: CASE_BASE, missingPdbs: ['10PX'] });
  assert.ok(!html.includes('<a'), 'expected no anchor when missingPdbs is an Array');
  assert.ok(html.includes('<td>10PX</td>'), 'expected PDB as plain text in a <td>');
});

test('renderEntryTablePage membership is case-sensitive (no case folding)', () => {
  const row = makeRow({ pdbId: 'abcd', auth: 'A' });
  const html = renderEntryTablePage({ rows: [row], caseBase: CASE_BASE, missingPdbs: new Set(['ABCD']) });
  assert.ok(html.includes('<a class="entry-table-link"'), 'lower-case row must not match upper-case missing entry');
});

test('renderEntryTablePage without missingPdbs keeps legacy behavior (all href rows link)', () => {
  const rows = [
    makeRow({ pdbId: '7SYS', auth: 'z' }),
    makeRow({ pdbId: '10PX', auth: 'A' })
  ];
  const html = renderEntryTablePage({ rows, caseBase: CASE_BASE });
  const anchorCount = html.split('<a class="entry-table-link"').length - 1;
  assert.equal(anchorCount, 2, 'both rows with hrefs should render anchors');
});
