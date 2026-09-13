import { createHash } from 'node:crypto';
import { TextDecoder } from 'node:util';
import { gunzipSync, gzipSync } from 'node:zlib';

export const LOCAL_GEOMETRY_SCHEMA = 'foldbridge-local-geometry.v1';
export const MODEL_POLICY = 'first_atom_site_model';
export const ALTLOC_POLICY = 'preserve_input_altlocs_dssr_managed';

const textDecoder = new TextDecoder('utf-8', { fatal: true });
const STACK_CLASS = /^(?:pm|mp|mm|pp)\((?:>>|<<|><|<>),(?:forward|backward|inward|outward)\)$/;
const LINKED_COORDINATE_STATUSES = new Set([
  'resolved',
  'sequence_only_no_atom_site_coordinate',
]);
const PREPARE_META_FIELDS = [
  'modelId',
  'modelPolicy',
  'altlocPolicy',
  'structureSha256',
  'dssrInputSha256',
];

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function compareUtf8(left, right) {
  return Buffer.compare(Buffer.from(String(left), 'utf8'), Buffer.from(String(right), 'utf8'));
}

function requireRecord(value, label) {
  if (!isRecord(value)) throw new TypeError(`${label} must be an object`);
  return value;
}

function requireString(value, label) {
  if (typeof value !== 'string' || value.trim() === '' || value.trim() !== value) {
    throw new TypeError(`${label} must be a non-empty string without surrounding whitespace`);
  }
  return value;
}

function requireContainerImageId(value) {
  const imageId = requireString(value, 'containerImageId');
  if (!/^sha256:[0-9a-f]{64}$/.test(imageId)) {
    throw new Error('containerImageId must be a sha256: digest with 64 lowercase hexadecimal digits');
  }
  return imageId;
}

function requireInteger(value, label, { positive = false } = {}) {
  const normalized = typeof value === 'number' ? String(value) : value;
  if (typeof normalized !== 'string' || !/^[+-]?\d+$/.test(normalized.trim())) {
    throw new TypeError(`${label} must be an integer`);
  }
  const parsed = Number(normalized);
  if (!Number.isSafeInteger(parsed) || (positive && parsed < 1)) {
    throw new TypeError(`${label} must be ${positive ? 'a positive safe integer' : 'a safe integer'}`);
  }
  return parsed;
}

function normalizeMissing(value) {
  if (value === undefined || value === null) return '';
  const text = String(value).trim();
  return text === '.' || text === '?' ? '' : text;
}

function requireCifValue(value, label) {
  const normalized = normalizeMissing(value);
  if (!normalized) throw new Error(`${label} is missing`);
  return normalized;
}

function asBuffer(value, label) {
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) return Buffer.from(value);
  throw new TypeError(`${label} must be bytes`);
}

function decodedBytes(value, label) {
  const raw = asBuffer(value, label);
  const decoded = raw.length >= 2 && raw[0] === 0x1f && raw[1] === 0x8b
    ? gunzipSync(raw)
    : raw;
  return { raw, decoded, text: textDecoder.decode(decoded) };
}

export function sha256Bytes(value) {
  return createHash('sha256').update(asBuffer(value, 'SHA-256 input')).digest('hex');
}

function canonicalJsonValue(value, location = '$') {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError(`${location} contains a non-finite number`);
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item, index) => canonicalJsonValue(item, `${location}[${index}]`));
  }
  if (!isRecord(value)) throw new TypeError(`${location} is not JSON-serializable`);
  const output = {};
  for (const key of Object.keys(value).sort(compareUtf8)) {
    const item = value[key];
    if (item === undefined || typeof item === 'function' || typeof item === 'symbol' || typeof item === 'bigint') {
      throw new TypeError(`${location}.${key} is not JSON-serializable`);
    }
    output[key] = canonicalJsonValue(item, `${location}.${key}`);
  }
  return output;
}

export function deterministicJson(payload) {
  return `${JSON.stringify(canonicalJsonValue(payload))}\n`;
}

export function deterministicGzip(payload) {
  const input = Buffer.isBuffer(payload) || payload instanceof Uint8Array
    ? Buffer.from(payload)
    : Buffer.from(typeof payload === 'string' ? payload : deterministicJson(payload), 'utf8');
  const output = gzipSync(input, { level: 9 });
  output.writeUInt32LE(0, 4);
  output[9] = 255;
  return output;
}

function scanCifTokens(source) {
  if (typeof source !== 'string') throw new TypeError('mmCIF source must be a string');
  const tokens = [];
  let index = 0;
  let lineStart = 0;
  while (index < source.length) {
    while (index < source.length && /\s/.test(source[index])) {
      if (source[index] === '\n') lineStart = index + 1;
      index += 1;
    }
    if (index >= source.length) break;
    if (source[index] === '#') {
      while (index < source.length && source[index] !== '\n') index += 1;
      continue;
    }
    if (source[index] === ';' && index === lineStart) {
      const opening = index;
      let cursor = index + 1;
      let cursorLineStart = lineStart;
      let closing = -1;
      while (cursor < source.length) {
        if (source[cursor] === '\n') {
          cursorLineStart = cursor + 1;
          cursor += 1;
          continue;
        }
        if (source[cursor] === ';' && cursor === cursorLineStart) {
          closing = cursor;
          break;
        }
        cursor += 1;
      }
      if (closing < 0) throw new Error('unterminated semicolon-delimited mmCIF value');
      let contentStart = opening + 1;
      if (source[contentStart] === '\r' && source[contentStart + 1] === '\n') contentStart += 2;
      else if (source[contentStart] === '\n') contentStart += 1;
      let contentEnd = closing;
      if (contentEnd > contentStart && source[contentEnd - 1] === '\n') {
        contentEnd -= 1;
        if (contentEnd > contentStart && source[contentEnd - 1] === '\r') contentEnd -= 1;
      }
      tokens.push({ value: source.slice(contentStart, contentEnd), quoted: true });
      index = closing + 1;
      lineStart = closing;
      continue;
    }
    if (source[index] === "'" || source[index] === '"') {
      const quote = source[index];
      const valueStart = index + 1;
      let cursor = valueStart;
      let closing = -1;
      while (cursor < source.length) {
        if (source[cursor] === '\n') lineStart = cursor + 1;
        if (source[cursor] === quote && (cursor + 1 === source.length || /\s/.test(source[cursor + 1]))) {
          closing = cursor;
          break;
        }
        cursor += 1;
      }
      if (closing < 0) throw new Error(`unterminated ${quote}-quoted mmCIF value`);
      tokens.push({ value: source.slice(valueStart, closing), quoted: true });
      index = closing + 1;
      continue;
    }
    const valueStart = index;
    while (index < source.length && !/\s/.test(source[index])) index += 1;
    tokens.push({ value: source.slice(valueStart, index), quoted: false });
  }
  return tokens;
}

function isTag(token) {
  return !token.quoted && token.value.startsWith('_');
}

function isControl(token, control) {
  return !token.quoted && token.value.toLowerCase() === control;
}

function isDataBlock(token) {
  return !token.quoted && token.value.toLowerCase().startsWith('data_');
}

function isSaveFrameControl(token) {
  return !token.quoted && token.value.toLowerCase().startsWith('save_');
}

function isLoopBoundary(token) {
  return isTag(token)
    || isControl(token, 'loop_')
    || isControl(token, 'stop_')
    || isControl(token, 'global_')
    || isDataBlock(token)
    || isSaveFrameControl(token);
}

function tagCategory(tag) {
  return tag.slice(1).split('.')[0].toLowerCase();
}

function parseCifDocument(source) {
  const tokens = scanCifTokens(source);
  const nodes = [];
  let foundDataBlock = false;
  let index = 0;
  while (index < tokens.length) {
    const token = tokens[index];
    if (isDataBlock(token)) {
      if (token.value.length === 5) throw new Error('mmCIF data block name must not be empty');
      foundDataBlock = true;
      nodes.push({ kind: 'data', value: token.value });
      index += 1;
      continue;
    }
    if (isControl(token, 'loop_')) {
      index += 1;
      const tags = [];
      while (index < tokens.length && isTag(tokens[index])) {
        tags.push(tokens[index].value);
        index += 1;
      }
      if (tags.length === 0) throw new Error('mmCIF loop_ must declare at least one tag');
      const values = [];
      while (index < tokens.length && !isLoopBoundary(tokens[index])) {
        values.push(tokens[index].value);
        index += 1;
      }
      if (values.length % tags.length !== 0) {
        throw new Error(`mmCIF loop value count ${values.length} does not form complete rows of ${tags.length}`);
      }
      const rows = [];
      for (let offset = 0; offset < values.length; offset += tags.length) {
        rows.push(values.slice(offset, offset + tags.length));
      }
      const stop = index < tokens.length && isControl(tokens[index], 'stop_');
      if (stop) index += 1;
      nodes.push({ kind: 'loop', tags, rows, stop });
      continue;
    }
    if (isTag(token)) {
      if (index + 1 >= tokens.length || isLoopBoundary(tokens[index + 1])) {
        throw new Error(`mmCIF item ${token.value} is missing a value`);
      }
      nodes.push({ kind: 'item', tag: token.value, value: tokens[index + 1].value });
      index += 2;
      continue;
    }
    if (isControl(token, 'global_') || isSaveFrameControl(token) || isControl(token, 'stop_')) {
      nodes.push({ kind: 'control', value: token.value });
      index += 1;
      continue;
    }
    throw new Error(`unexpected mmCIF token outside an item or loop: ${token.value}`);
  }
  if (!foundDataBlock) throw new Error('mmCIF source contains no data_ block');
  return nodes;
}

function formatCifValue(value) {
  const text = String(value);
  const lower = text.toLowerCase();
  const reserved = lower === 'loop_' || lower === 'stop_' || lower === 'global_'
    || lower.startsWith('data_') || lower.startsWith('save_');
  if (text && !reserved && !text.startsWith('_') && !text.startsWith(';') && /^[^\s#'\"]+$/.test(text)) {
    return text;
  }
  if (!text.includes("'") && !text.includes('\n') && !text.includes('\r')) return `'${text}'`;
  if (!text.includes('"') && !text.includes('\n') && !text.includes('\r')) return `"${text}"`;
  if (text.split(/\r?\n/).some((line) => line.startsWith(';'))) {
    throw new Error('cannot serialize an mmCIF multiline value containing a line-leading semicolon');
  }
  return `;\n${text}\n;`;
}

function serializeAtomSiteLoop(node, lines) {
  const loweredTags = node.tags.map((tag) => tag.toLowerCase());
  const groupIndex = loweredTags.indexOf('_atom_site.group_pdb');
  if (groupIndex < 0) throw new Error('_atom_site loop is missing _atom_site.group_PDB');
  const columnOrder = [groupIndex, ...node.tags.keys()].filter((index, position, values) => {
    return values.indexOf(index) === position;
  });
  lines.push('loop_', ...columnOrder.map((index) => node.tags[index]));
  for (const row of node.rows) {
    const group = row[groupIndex];
    if (group !== 'ATOM' && group !== 'HETATM') {
      throw new Error('_atom_site.group_PDB must be ATOM or HETATM');
    }
    const values = columnOrder.map((index) => {
      const value = row[index];
      if (String(value).includes('\n') || String(value).includes('\r')) {
        throw new Error('_atom_site value contains a newline and cannot occupy a single physical line');
      }
      const formatted = formatCifValue(value);
      if (formatted.includes('\n') || formatted.includes('\r')) {
        throw new Error('_atom_site value cannot be serialized on a single physical line');
      }
      return formatted;
    });
    lines.push(values.join(' '));
  }
  if (node.stop) lines.push('stop_');
  lines.push('#');
}

function serializeCifDocument(nodes) {
  const lines = [];
  for (const node of nodes) {
    if (node.kind === 'data' || node.kind === 'control') {
      lines.push(node.value);
      continue;
    }
    if (node.kind === 'item') {
      lines.push(node.tag, formatCifValue(node.value));
      continue;
    }
    if (node.kind === 'loop') {
      if (node.tags.every((tag) => tagCategory(tag) === 'atom_site')) {
        serializeAtomSiteLoop(node, lines);
        continue;
      }
      lines.push('loop_', ...node.tags);
      for (const row of node.rows) {
        for (const value of row) lines.push(formatCifValue(value));
      }
      if (node.stop) lines.push('stop_');
      lines.push('#');
      continue;
    }
    throw new Error(`unknown mmCIF document node ${node.kind}`);
  }
  return `${lines.join('\n')}\n`;
}

function atomSiteLoopInfo(node) {
  if (node.kind !== 'loop') return null;
  const categories = new Set(node.tags.map((tag) => tagCategory(tag)));
  if (!categories.has('atom_site')) return null;
  if (categories.size !== 1) throw new Error('an _atom_site loop must not mix mmCIF categories');
  const tags = node.tags.map((tag) => tag.toLowerCase());
  if (new Set(tags).size !== tags.length) throw new Error('_atom_site loop contains duplicate tags');
  const modelIndex = tags.indexOf('_atom_site.pdbx_pdb_model_num');
  if (modelIndex < 0) throw new Error('_atom_site loop is missing _atom_site.pdbx_PDB_model_num');
  return { tags, modelIndex };
}

export function prepareDssrInput(structureBytes) {
  const source = decodedBytes(structureBytes, 'source structure');
  const nodes = parseCifDocument(source.text);
  for (const node of nodes) {
    if (node.kind === 'item' && tagCategory(node.tag) === 'atom_site') {
      throw new Error('_atom_site must be represented as loop_ data');
    }
  }
  const atomLoops = nodes.map((node) => ({ node, info: atomSiteLoopInfo(node) })).filter(({ info }) => info);
  if (atomLoops.length === 0) throw new Error('mmCIF contains no _atom_site loop');
  const firstRow = atomLoops.find(({ node }) => node.rows.length > 0)?.node.rows[0];
  if (!firstRow) throw new Error('mmCIF _atom_site contains no rows');
  const firstLoop = atomLoops.find(({ node }) => node.rows.length > 0);
  const modelId = requireCifValue(firstRow[firstLoop.info.modelIndex], 'first _atom_site model');
  let selectedRows = 0;
  for (const { node, info } of atomLoops) {
    node.rows = node.rows.filter((row) => {
      const rowModel = requireCifValue(row[info.modelIndex], '_atom_site model');
      if (rowModel !== modelId) return false;
      selectedRows += 1;
      return true;
    });
  }
  if (selectedRows === 0) throw new Error(`first _atom_site model ${modelId} has no rows`);
  const bytes = Buffer.from(serializeCifDocument(nodes), 'utf8');
  return {
    bytes,
    meta: {
      modelId,
      modelPolicy: MODEL_POLICY,
      altlocPolicy: ALTLOC_POLICY,
      structureSha256: sha256Bytes(source.raw),
      dssrInputSha256: sha256Bytes(bytes),
    },
  };
}

function rowObject(tags, row) {
  return Object.fromEntries(tags.map((tag, index) => [tag, row[index]]));
}

function residueLocatorIdentity(locator) {
  return [
    locator.modelId,
    locator.labelAsymId,
    locator.authAsymId,
    locator.labelSeqId,
    locator.authSeqId,
    locator.insertionCode,
    locator.componentId,
  ].map((value) => JSON.stringify(value)).join('|');
}

function labelLocatorIdentity(locator) {
  return [locator.modelId, locator.labelAsymId, locator.labelSeqId]
    .map((value) => JSON.stringify(value)).join('|');
}

function authorLocatorIdentity(locator, component = locator.authComponentId ?? locator.componentId) {
  return [locator.modelId, locator.authAsymId, locator.authSeqId, locator.insertionCode, component]
    .map((value) => JSON.stringify(value)).join('|');
}

export function parseAtomSiteResidues(cifBytes) {
  const input = decodedBytes(cifBytes, 'DSSR input mmCIF');
  const nodes = parseCifDocument(input.text);
  const atomRows = [];
  let modelId = null;
  for (const node of nodes) {
    const info = atomSiteLoopInfo(node);
    if (!info) continue;
    const requiredTags = [
      '_atom_site.label_asym_id',
      '_atom_site.auth_asym_id',
      '_atom_site.label_seq_id',
      '_atom_site.auth_seq_id',
      '_atom_site.label_comp_id',
      '_atom_site.pdbx_pdb_model_num',
    ];
    for (const tag of requiredTags) {
      if (!info.tags.includes(tag)) throw new Error(`_atom_site loop is missing ${tag}`);
    }
    const rowMaps = node.rows.map((row) => rowObject(info.tags, row));
    for (const row of rowMaps) {
      const rowModel = requireCifValue(row['_atom_site.pdbx_pdb_model_num'], '_atom_site model');
      if (modelId === null) modelId = rowModel;
      if (rowModel !== modelId) throw new Error('DSSR input mmCIF contains multiple atom-site models');
      const labelSeqText = normalizeMissing(row['_atom_site.label_seq_id']);
      const authSeqText = normalizeMissing(row['_atom_site.auth_seq_id']);
      const atomRow = {
        modelId: rowModel,
        labelAsymId: requireCifValue(row['_atom_site.label_asym_id'], '_atom_site label asym id'),
        authAsymId: requireCifValue(row['_atom_site.auth_asym_id'], '_atom_site auth asym id'),
        labelSeqId: labelSeqText ? requireInteger(labelSeqText, '_atom_site label seq id', { positive: true }) : null,
        authSeqId: authSeqText ? requireInteger(authSeqText, '_atom_site auth seq id') : null,
        insertionCode: normalizeMissing(row['_atom_site.pdbx_pdb_ins_code']),
        componentId: requireCifValue(row['_atom_site.label_comp_id'], '_atom_site label component id'),
        authComponentId: normalizeMissing(row['_atom_site.auth_comp_id'])
          || requireCifValue(row['_atom_site.label_comp_id'], '_atom_site label component id'),
        altId: normalizeMissing(row['_atom_site.label_alt_id']),
      };
      atomRows.push(atomRow);
    }
  }
  if (modelId === null) throw new Error('DSSR input mmCIF has no atom-site rows');
  const residuesByIdentity = new Map();
  const labels = new Map();
  const authors = new Map();
  for (const row of atomRows) {
    if (row.labelSeqId === null || row.authSeqId === null) continue;
    const identity = residueLocatorIdentity(row);
    const locator = {
      modelId: row.modelId,
      labelAsymId: row.labelAsymId,
      authAsymId: row.authAsymId,
      labelSeqId: row.labelSeqId,
      authSeqId: row.authSeqId,
      insertionCode: row.insertionCode,
      componentId: row.componentId,
      authComponentId: row.authComponentId,
    };
    if (!residuesByIdentity.has(identity)) residuesByIdentity.set(identity, locator);
    const labelKey = labelLocatorIdentity(locator);
    const authorKey = authorLocatorIdentity(locator);
    const priorLabel = labels.get(labelKey);
    const priorAuthor = authors.get(authorKey);
    if (priorLabel && residueLocatorIdentity(priorLabel) !== identity) {
      throw new Error(`ambiguous _atom_site label residue identity ${labelKey}`);
    }
    if (priorAuthor && residueLocatorIdentity(priorAuthor) !== identity) {
      throw new Error(`ambiguous _atom_site author residue identity ${authorKey}`);
    }
    labels.set(labelKey, locator);
    authors.set(authorKey, locator);
  }
  const residues = [...residuesByIdentity.values()].sort((left, right) => {
    return compareUtf8(labelLocatorIdentity(left), labelLocatorIdentity(right));
  });
  return { modelId, atomRows, residues };
}

function linkedField(record, names, label, { optional = false } = {}) {
  const present = names.filter((name) => Object.hasOwn(record, name));
  if (present.length === 0) {
    if (optional) return undefined;
    throw new Error(`${label} is missing`);
  }
  const values = present.map((name) => record[name]);
  if (values.some((value) => value !== values[0])) throw new Error(`${label} is ambiguous`);
  return values[0];
}

function publicLocator(locator) {
  return {
    modelId: locator.modelId,
    labelAsymId: locator.labelAsymId,
    authAsymId: locator.authAsymId,
    labelSeqId: locator.labelSeqId,
    authSeqId: locator.authSeqId,
    insertionCode: locator.insertionCode,
    componentId: locator.componentId,
  };
}

function linkedLocator(locus, residue, modelId) {
  const input = requireRecord(locus.locator, `structureContexts locator for ${locus.residueKey}`);
  const contextModel = linkedField(
    input,
    ['modelId', 'model_id', 'pdbx_PDB_model_num'],
    'linked model id',
    { optional: true },
  );
  if (contextModel !== undefined
      && requireString(contextModel, 'linked model id') !== modelId) {
    throw new Error(`linked model identity for ${locus.residueKey} does not match controlled model ${modelId}`);
  }
  const labelSeqId = requireInteger(
    linkedField(input, ['labelSeqId', 'label_seq_id'], 'linked label sequence id'),
    'linked label sequence id', { positive: true },
  );
  const authSeqId = requireInteger(
    linkedField(input, ['authSeqId', 'auth_seq_id'], 'linked auth sequence id'),
    'linked auth sequence id',
  );
  const residueComponent = requireString(
    residue.compId,
    `residueIndex compId for ${residue.residueKey}`,
  );
  const contextComponent = linkedField(
    input,
    ['componentId', 'label_comp_id', 'comp_id'],
    'linked component id',
    { optional: true },
  );
  if (contextComponent !== undefined
      && requireString(contextComponent, 'linked component id') !== residueComponent) {
    throw new Error(`linked component identity for ${locus.residueKey} does not match residueIndex compId`);
  }
  return {
    modelId,
    labelAsymId: requireString(String(linkedField(input, ['labelAsymId', 'label_asym_id'], 'linked label asym id')), 'linked label asym id'),
    authAsymId: requireString(String(linkedField(input, ['authAsymId', 'auth_asym_id'], 'linked auth asym id')), 'linked auth asym id'),
    labelSeqId,
    authSeqId,
    insertionCode: normalizeMissing(linkedField(input, ['insertionCode', 'pdbx_PDB_ins_code'], 'linked insertion code', { optional: true })),
    componentId: residueComponent,
    residueBase: requireString(String(residue.parentBase ?? residue.base), `residueIndex base for ${residue.residueKey}`),
  };
}

function locatorWithoutComponentIdentity(locator) {
  return [
    locator.modelId, locator.labelAsymId, locator.authAsymId,
    locator.labelSeqId, locator.authSeqId, locator.insertionCode,
  ].map((value) => JSON.stringify(value)).join('|');
}

function buildLinkedChain(linkedView, caseId, chainId, atomSite) {
  requireRecord(linkedView, 'linked-view bundle');
  const residues = linkedView.residueIndex?.residues;
  const loci = linkedView.structureContexts?.loci;
  if (!Array.isArray(residues)) throw new TypeError('linkedView.residueIndex.residues must be an array');
  if (!Array.isArray(loci)) throw new TypeError('linkedView.structureContexts.loci must be an array');
  const residueByKey = new Map();
  for (const residue of residues) {
    requireRecord(residue, 'linked residue');
    const key = requireString(residue.residueKey, 'linked residueKey');
    if (residueByKey.has(key)) throw new Error(`duplicate linked residueKey ${key}`);
    residueByKey.set(key, residue);
  }
  const locusByKey = new Map();
  for (const locus of loci) {
    requireRecord(locus, 'structureContexts locus');
    const key = requireString(locus.residueKey, 'structureContexts residueKey');
    if (!residueByKey.has(key)) throw new Error(`structureContexts references unknown residue ${key}`);
    if (locusByKey.has(key)) throw new Error(`duplicate or ambiguous structureContexts locus for ${key}`);
    locusByKey.set(key, locus);
  }
  const targetKeysFromIndex = new Set();
  const expectedChainKey = `${caseId}|chain|${chainId}`;
  for (const residue of residues) {
    const chainKey = requireString(residue.chainKey, `linked chainKey for ${residue.residueKey}`);
    if (chainKey !== expectedChainKey) {
      throw new Error(`linked chainKey ${chainKey} does not match canonical ${expectedChainKey}`);
    }
    if (!residue.residueKey.startsWith(`${expectedChainKey}|`)) {
      throw new Error(`linked residueKey ${residue.residueKey} does not match canonical chainKey ${expectedChainKey}`);
    }
    targetKeysFromIndex.add(residue.residueKey);
  }
  if (targetKeysFromIndex.size === 0) {
    throw new Error(`linked-view residueIndex has no residues for caseId ${caseId} and chainId ${chainId}`);
  }
  const target = [];
  for (const [key, locus] of locusByKey) {
    const residue = residueByKey.get(key);
    const candidate = linkedLocator(locus, residue, atomSite.modelId);
    if (candidate.authAsymId !== chainId) continue;
    if (!targetKeysFromIndex.has(key)) {
      throw new Error(`linked structureContexts chain identity does not match residueIndex for ${key}`);
    }
    target.push({ key, locus, residue, candidate });
  }
  if (target.length === 0) throw new Error(`linked-view contains no residues for chain ${chainId}`);
  const targetKeySet = new Set(target.map(({ key }) => key));
  const missingContexts = [...targetKeysFromIndex].filter((key) => !targetKeySet.has(key));
  if (missingContexts.length) {
    throw new Error(`linked-view target-chain residue coverage mismatch: ${missingContexts.join(', ')}`);
  }
  const matchedAtomIdentities = new Set();
  const atomTarget = atomSite.residues.filter((locator) => locator.authAsymId === chainId);
  const chain = target.map(({ key, locus, residue, candidate }) => {
    const position = requireInteger(residue.labelSeqId ?? residue.position, `position for ${key}`, { positive: true });
    if (position !== candidate.labelSeqId) throw new Error(`linked residue position does not match locator for ${key}`);
    const coordinateStatus = requireString(locus.coordinateStatus, `coordinateStatus for ${key}`);
    if (!LINKED_COORDINATE_STATUSES.has(coordinateStatus)) {
      throw new Error(`coordinateStatus for ${key} must be a recognized linked-view status`);
    }
    const resolved = coordinateStatus === 'resolved';
    const matches = atomTarget.filter((locator) => locatorWithoutComponentIdentity(locator) === locatorWithoutComponentIdentity(candidate));
    if (resolved && matches.length !== 1) {
      throw new Error(`resolved linked residue ${key} has ${matches.length} atom-site identities; expected one`);
    }
    if (!resolved && matches.length !== 0) {
      throw new Error(`unresolved linked residue ${key} unexpectedly maps to atom-site coordinates`);
    }
    const matched = matches[0];
    if (matched && candidate.componentId !== matched.componentId) {
      throw new Error(`linked component identity does not match atom-site for ${key}`);
    }
    if (matched) matchedAtomIdentities.add(residueLocatorIdentity(matched));
    const finalLocator = matched ?? candidate;
    return {
      residueKey: key,
      position,
      base: candidate.residueBase,
      locator: publicLocator(finalLocator),
      resolved,
      atomLocator: matched ?? null,
    };
  });
  const extraAtoms = atomTarget.filter((locator) => !matchedAtomIdentities.has(residueLocatorIdentity(locator)));
  if (extraAtoms.length) {
    throw new Error(`linked-view and atom-site target-chain residue coverage mismatch; ${extraAtoms.length} extra atom-site residues`);
  }
  const positions = new Set();
  for (const residue of chain) {
    if (positions.has(residue.position)) throw new Error(`duplicate linked residue position ${residue.position}`);
    positions.add(residue.position);
  }
  return chain.sort((left, right) => left.position - right.position || compareUtf8(left.residueKey, right.residueKey));
}

function parseDssrResidueNumber(value, label) {
  const text = typeof value === 'number' ? String(value) : requireString(value, label);
  const match = text.match(/^([+-]?\d+)(?:\^(.+))?$/);
  if (!match) throw new Error(`${label} must contain an integer residue number and optional ^ insertion code`);
  return { number: requireInteger(match[1], label), insertionCode: match[2] ?? '' };
}

function parseDssrNtId(ntId, component) {
  const dot = ntId.lastIndexOf('.');
  if (dot < 1) throw new Error(`DSSR nt_id ${ntId} must contain chain.component-and-number`);
  const chain = ntId.slice(0, dot);
  const residue = ntId.slice(dot + 1);
  if (!residue.startsWith(component)) throw new Error(`DSSR nt_id ${ntId} does not match nt_name ${component}`);
  const parsed = parseDssrResidueNumber(residue.slice(component.length), `DSSR nt_id ${ntId}`);
  return { chain, ...parsed };
}

function buildDssrIndex(dssr, atomSite) {
  requireRecord(dssr, 'DSSR JSON');
  if (!Array.isArray(dssr.nts)) throw new TypeError('DSSR JSON nts must be an array');
  const byId = new Map();
  const byAtomIdentity = new Map();
  for (const [index, rawNt] of dssr.nts.entries()) {
    const nt = requireRecord(rawNt, `DSSR nts[${index}]`);
    const ntId = requireString(nt.nt_id, `DSSR nts[${index}].nt_id`);
    if (byId.has(ntId)) throw new Error(`duplicate DSSR nt_id ${ntId}`);
    const component = requireString(nt.nt_name, `DSSR nts[${index}].nt_name`);
    const parsedId = parseDssrNtId(ntId, component);
    const chain = requireString(nt.chain_name, `DSSR nts[${index}].chain_name`);
    if (chain !== parsedId.chain) throw new Error(`DSSR nt_id and chain_name disagree for ${ntId}`);
    const residueNumber = parseDssrResidueNumber(nt.nt_resnum, `DSSR nts[${index}].nt_resnum`);
    if (residueNumber.number !== parsedId.number) throw new Error(`DSSR nt_id and nt_resnum disagree for ${ntId}`);
    const explicitInsertion = normalizeMissing(nt.nt_ins_code);
    const insertionCode = explicitInsertion || residueNumber.insertionCode || parsedId.insertionCode;
    for (const candidate of [explicitInsertion, residueNumber.insertionCode, parsedId.insertionCode]) {
      if (candidate && candidate !== insertionCode) throw new Error(`DSSR insertion-code identity is ambiguous for ${ntId}`);
    }
    const authorKey = authorLocatorIdentity({
      modelId: atomSite.modelId,
      authAsymId: chain,
      authSeqId: residueNumber.number,
      insertionCode,
    }, component);
    const matches = atomSite.residues.filter((locator) => authorLocatorIdentity(locator) === authorKey);
    if (matches.length !== 1) throw new Error(`DSSR nucleotide ${ntId} has ${matches.length} atom-site identities; expected one`);
    const locator = matches[0];
    const identity = residueLocatorIdentity(locator);
    if (byAtomIdentity.has(identity)) throw new Error(`multiple DSSR nucleotides map to atom-site residue ${identity}`);
    const indexed = {
      raw: nt,
      ntId,
      locator,
      base: requireString(nt.nt_code ?? component, `DSSR nts[${index}] base`),
    };
    byId.set(ntId, indexed);
    byAtomIdentity.set(identity, indexed);
  }
  return { byId, byAtomIdentity };
}

function puckerForNt(nt) {
  if (!nt) return { status: 'not_computable', reason: 'DSSR nucleotide absent' };
  const { puckering, phase_angle: phaseDeg, amplitude: amplitudeDeg } = nt.raw;
  if (typeof puckering !== 'string' || puckering.trim() === '' || puckering.trim() !== puckering
      || typeof phaseDeg !== 'number' || !Number.isFinite(phaseDeg)
      || typeof amplitudeDeg !== 'number' || !Number.isFinite(amplitudeDeg)) {
    return { status: 'not_computable', reason: 'DSSR pucker incomplete' };
  }
  return { status: 'computed', class: puckering, phaseDeg, amplitudeDeg };
}

function partnerSortKey(partner) {
  return [
    partner.partnerLocator.authAsymId,
    String(partner.partnerLocator.authSeqId).padStart(16, '0'),
    partner.partnerLocator.insertionCode,
    partner.partnerLocator.componentId,
    partner.dssrStackClass,
    String(partner.sourcePairIndex).padStart(16, '0'),
  ].join('|');
}

function buildStacking(dssr, dssrIndex, linkedChain) {
  const outputPresent = Array.isArray(dssr.nonPairs);
  if (!outputPresent && dssr.nonPairs !== undefined) throw new TypeError('DSSR JSON nonPairs must be an array');
  const linkedByAtom = new Map(linkedChain.filter(({ atomLocator }) => atomLocator)
    .map((residue) => [residueLocatorIdentity(residue.atomLocator), residue]));
  const partnersByResidue = new Map(linkedChain.map(({ residueKey }) => [residueKey, []]));
  if (outputPresent) {
    for (const [index, rawPair] of dssr.nonPairs.entries()) {
      const pair = requireRecord(rawPair, `DSSR nonPairs[${index}]`);
      if (pair.stacking === undefined || pair.stacking === null) continue;
      const stacking = requireRecord(pair.stacking, `DSSR nonPairs[${index}].stacking`);
      const stackClass = requireString(stacking.type, `DSSR nonPairs[${index}].stacking.type`);
      if (!STACK_CLASS.test(stackClass)) {
        throw new Error(`DSSR nonPairs[${index}].stacking.type must retain pm/mp/mm/pp DSSR syntax`);
      }
      for (const field of ['oArea', 'oArea_ring']) {
        if (typeof stacking[field] !== 'number' || !Number.isFinite(stacking[field])) {
          throw new TypeError(`DSSR nonPairs[${index}].stacking.${field} must be a finite number`);
        }
      }
      const nt1 = dssrIndex.byId.get(requireString(pair.nt1, `DSSR nonPairs[${index}].nt1`));
      const nt2 = dssrIndex.byId.get(requireString(pair.nt2, `DSSR nonPairs[${index}].nt2`));
      if (!nt1 || !nt2) throw new Error(`DSSR nonPairs[${index}] references an unknown nucleotide`);
      if (nt1.ntId === nt2.ntId) throw new Error(`DSSR nonPairs[${index}] is a self pair`);
      for (const [currentNt, partnerNt] of [[nt1, nt2], [nt2, nt1]]) {
        const current = linkedByAtom.get(residueLocatorIdentity(currentNt.locator));
        if (!current) continue;
        const sameChain = partnerNt.locator.authAsymId === current.locator.authAsymId;
        const partnerResidue = sameChain
          ? linkedByAtom.get(residueLocatorIdentity(partnerNt.locator))
          : null;
        if (sameChain && !partnerResidue) {
          throw new Error(`same-chain DSSR partner ${partnerNt.ntId} is absent from linked-view target residues`);
        }
        const topology = !sameChain
          ? 'interchain'
          : partnerResidue.position === current.position + 1
            ? 'three_prime_adjacent'
            : partnerResidue.position === current.position - 1
              ? 'five_prime_adjacent'
              : 'non_adjacent_intrachain';
        partnersByResidue.get(current.residueKey).push({
          partnerResidueKey: sameChain ? partnerResidue.residueKey : null,
          partnerLocator: publicLocator(partnerNt.locator),
          partnerPosition: sameChain ? partnerResidue.position : null,
          partnerBase: sameChain ? partnerResidue.base : partnerNt.base,
          topology,
          dssrStackClass: stackClass,
          overlapArea: stacking.oArea,
          ringOverlapArea: stacking.oArea_ring,
          sourcePairIndex: index,
        });
      }
    }
  }
  for (const partners of partnersByResidue.values()) {
    partners.sort((left, right) => compareUtf8(partnerSortKey(left), partnerSortKey(right)));
    const seen = new Set();
    for (const partner of partners) {
      const identity = `${residueLocatorIdentity(partner.partnerLocator)}|${partner.dssrStackClass}`;
      if (seen.has(identity)) throw new Error('duplicate DSSR stacking partner identity and class');
      seen.add(identity);
    }
  }
  return { outputPresent, partnersByResidue };
}

function validatePrepareMeta(meta, canonical, sourceSha, inputSha) {
  requireRecord(meta, 'prepare meta');
  const fields = Object.keys(meta).sort(compareUtf8);
  if (fields.length !== PREPARE_META_FIELDS.length
      || fields.some((field, index) => field !== [...PREPARE_META_FIELDS].sort(compareUtf8)[index])) {
    throw new Error('prepare meta must contain exactly the controlled provenance fields');
  }
  if (meta.modelPolicy !== MODEL_POLICY || meta.altlocPolicy !== ALTLOC_POLICY) {
    throw new Error('prepare meta model/altloc policy mismatch');
  }
  if (meta.structureSha256 !== sourceSha || meta.structureSha256 !== canonical.meta.structureSha256) {
    throw new Error('source structure SHA-256 mismatch');
  }
  if (meta.dssrInputSha256 !== inputSha || meta.dssrInputSha256 !== canonical.meta.dssrInputSha256) {
    throw new Error('DSSR input SHA-256 mismatch');
  }
  if (meta.modelId !== canonical.meta.modelId) throw new Error('prepare meta modelId mismatch');
}

export function buildLocalGeometrySidecar(options) {
  requireRecord(options, 'build options');
  const structureBytes = asBuffer(options.structureBytes, 'source structure');
  const dssrInputBytes = asBuffer(options.dssrInputBytes, 'DSSR input');
  const sourceSha = sha256Bytes(structureBytes);
  const inputSha = sha256Bytes(dssrInputBytes);
  const canonical = prepareDssrInput(structureBytes);
  const prepareMeta = requireRecord(options.prepareMeta, 'prepare meta required');
  validatePrepareMeta(prepareMeta, canonical, sourceSha, inputSha);
  const atomSite = parseAtomSiteResidues(dssrInputBytes);
  if (atomSite.modelId !== prepareMeta.modelId) throw new Error('DSSR input modelId mismatch');
  const caseId = requireString(options.caseId, 'caseId');
  const chainId = requireString(options.chainId, 'chainId');
  const linkedChain = buildLinkedChain(options.linkedView, caseId, chainId, atomSite);
  const dssrIndex = buildDssrIndex(options.dssr, atomSite);
  const stacking = buildStacking(options.dssr, dssrIndex, linkedChain);
  const residues = linkedChain.map((residue) => {
    const nt = residue.atomLocator
      ? dssrIndex.byAtomIdentity.get(residueLocatorIdentity(residue.atomLocator))
      : null;
    let stackingValue;
    if (!residue.resolved) {
      stackingValue = { status: 'not_computable', reason: 'coordinates absent' };
    } else if (!nt) {
      stackingValue = { status: 'not_computable', reason: 'DSSR nucleotide absent' };
    } else if (!stacking.outputPresent) {
      stackingValue = { status: 'not_computable', reason: 'DSSR nonPairs output absent' };
    } else {
      stackingValue = { status: 'computed', partners: stacking.partnersByResidue.get(residue.residueKey) };
    }
    return {
      residueKey: residue.residueKey,
      position: residue.position,
      base: residue.base,
      locator: residue.locator,
      pucker: residue.resolved ? puckerForNt(nt) : { status: 'not_computable', reason: 'coordinates absent' },
      stacking: stackingValue,
    };
  });
  return {
    schemaVersion: LOCAL_GEOMETRY_SCHEMA,
    caseId,
    chainId,
    source: {
      tool: requireString(options.tool, 'tool'),
      toolVersion: requireString(options.toolVersion, 'toolVersion'),
      containerImage: requireString(options.containerImage, 'containerImage'),
      containerImageId: requireContainerImageId(options.containerImageId),
      command: requireString(options.command, 'command'),
      structureSha256: sourceSha,
      dssrInputSha256: inputSha,
      modelId: prepareMeta.modelId,
      modelPolicy: MODEL_POLICY,
      altlocPolicy: ALTLOC_POLICY,
    },
    residues,
  };
}

export function parseJsonBytes(bytes, label = 'JSON input') {
  const input = decodedBytes(bytes, label);
  let value;
  try {
    value = JSON.parse(input.text);
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${error.message}`);
  }
  return value;
}
