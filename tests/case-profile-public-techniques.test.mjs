import assert from "node:assert/strict";
import test from "node:test";

import { classifyTechniqueFilter, MECHANISM_FAMILIES } from "../src/techniqueFilterModel.js";
import {
  PROFILE_PUBLIC_TECHNIQUES_SCHEMA,
  applyPublicTechniqueFilter,
  buildPublicTechniqueModel,
  categoryBadgeMarkup,
  profilePublicTechniqueLabel,
  validateProfilePublicTechniques,
} from "../public/entry-cases/__entry_v3_site__/workbench-pure.mjs";

const PROFILE_IDS = [
  "p-mapped",
  "p-multi",
  "p-partial",
  "p-unmapped",
  "p-background",
  "p-missing",
];

const profileIndex = {
  profiles: PROFILE_IDS.map((profileId) => ({
    profile_id: profileId,
    pair_id: `pair-${profileId}`,
  })),
};

const categoryById = new Map(MECHANISM_FAMILIES.map((category) => [category.id, category]));

function classifyTechniqueToken(label) {
  return classifyTechniqueFilter(label).methods[0];
}

function mappedMethod(label, categoryId) {
  const category = categoryById.get(categoryId);
  return {
    label,
    mappingStatus: "mapped",
    categoryId,
    categoryLabel: category.label,
    categoryShortLabel: category.shortLabel,
  };
}

function unmappedMethod(label) {
  return {
    label,
    mappingStatus: "unmapped",
    categoryId: null,
    categoryLabel: null,
    categoryShortLabel: null,
  };
}

function makePayload() {
  return {
    schemaVersion: "profile-public-techniques.v1",
    pdbId: "9WNR",
    authChain: "a",
    profileCount: PROFILE_IDS.length,
    profiles: [
      {
        profileId: "p-mapped",
        classificationStatus: "mapped",
        methods: [mappedMethod("DMS-seq", "dms")],
      },
      {
        profileId: "p-multi",
        classificationStatus: "mapped",
        methods: [mappedMethod("DMS-MaPseq", "dms"), mappedMethod("SHAPE-MaP", "shape")],
      },
      {
        profileId: "p-partial",
        classificationStatus: "partially_mapped",
        methods: [mappedMethod("DMS", "dms"), unmappedMethod("Mystery-seq")],
      },
      {
        profileId: "p-unmapped",
        classificationStatus: "unmapped",
        methods: [unmappedMethod("NoMap-seq")],
      },
      {
        profileId: "p-background",
        classificationStatus: "background",
        methods: [],
      },
      {
        profileId: "p-missing",
        classificationStatus: "missing",
        methods: [],
      },
    ],
  };
}

function makeContext(overrides = {}) {
  return {
    pdbId: "9WNR",
    authChain: "a",
    categories: MECHANISM_FAMILIES,
    classifyTechniqueToken,
    ...overrides,
  };
}

function clone(value) {
  return structuredClone(value);
}

function expectInvalid(mutator, pattern) {
  const payload = makePayload();
  mutator(payload);
  assert.throws(
    () => validateProfilePublicTechniques(payload, profileIndex, makeContext()),
    pattern,
  );
}

test("exports the fixed sidecar schema version", () => {
  assert.equal(PROFILE_PUBLIC_TECHNIQUES_SCHEMA, "profile-public-techniques.v1");
});

test("validates the sidecar and builds one ordered public meta record per profile", () => {
  const payload = makePayload();
  const model = validateProfilePublicTechniques(payload, profileIndex, makeContext());

  assert.equal(model.profileMeta.size, profileIndex.profiles.length);
  assert.equal(model.profileMeta.get("p-multi").categoryIds.size, 2);
  assert.deepEqual([...model.profileMeta.get("p-multi").categoryIds], ["dms", "shape"]);
  assert.equal(model.orderedProfileIds.filter((id) => id === "p-multi").length, 1);
  assert.deepEqual(model.orderedProfileIds, PROFILE_IDS);
  assert.ok(model.profileMeta instanceof Map);
  assert.ok(model.profileMeta.get("p-multi").categoryIds instanceof Set);
  assert.ok(model.profileMeta.get("p-partial").methodLabels instanceof Set);

  const rebuilt = buildPublicTechniqueModel(payload, MECHANISM_FAMILIES);
  assert.deepEqual(rebuilt.orderedProfileIds, PROFILE_IDS);
  assert.deepEqual([...rebuilt.profileMeta.get("p-multi").categoryIds], ["dms", "shape"]);
});

test("filters categories and public methods with cross-level OR while preserving index order", () => {
  const model = validateProfilePublicTechniques(makePayload(), profileIndex, makeContext());

  assert.deepEqual(
    [...applyPublicTechniqueFilter(model, { categories: new Set(["shape"]), methods: new Set() })],
    ["p-multi"],
  );
  assert.deepEqual(
    [...applyPublicTechniqueFilter(model, { categories: new Set(["dms"]), methods: new Set() })],
    ["p-mapped", "p-multi", "p-partial"],
  );
  assert.deepEqual(
    [...applyPublicTechniqueFilter(model, {
      categories: new Set(["shape"]),
      methods: new Set(["NoMap-seq"]),
    })],
    ["p-multi", "p-unmapped"],
  );
  assert.deepEqual(
    [...applyPublicTechniqueFilter(model, { categories: new Set(), methods: new Set(["Mystery-seq"]) })],
    ["p-partial"],
  );
  assert.deepEqual([...applyPublicTechniqueFilter(model, {})], PROFILE_IDS);
});

test("rejects non-object filter selections instead of treating them as empty", () => {
  const model = validateProfilePublicTechniques(makePayload(), profileIndex, makeContext());
  for (const selection of [null, "shape", [], new Map()]) {
    assert.throws(
      () => applyPublicTechniqueFilter(model, selection),
      /selection must be a plain object/i,
    );
  }
  assert.deepEqual([...applyPublicTechniqueFilter(model, undefined)], PROFILE_IDS);
});

test("requires explicitly supplied filter dimensions to be real Sets", () => {
  const model = validateProfilePublicTechniques(makePayload(), profileIndex, makeContext());
  const fakeSet = { size: 0, has: () => false };
  const fakeSetPrototype = Object.create(Set.prototype);
  for (const dimension of ["categories", "methods"]) {
    for (const value of [undefined, false, null, [], fakeSet, fakeSetPrototype]) {
      assert.throws(
        () => applyPublicTechniqueFilter(model, { [dimension]: value }),
        new RegExp(`${dimension} must be a Set`, "i"),
      );
    }
    for (const value of [new Set([""]), new Set(["   "]), new Set([7])]) {
      assert.throws(
        () => applyPublicTechniqueFilter(model, { [dimension]: value }),
        new RegExp(`${dimension}.*non-empty strings`, "i"),
      );
    }
  }
});

test("rejects unknown string and symbol keys in the optional selection schema", () => {
  const model = validateProfilePublicTechniques(makePayload(), profileIndex, makeContext());
  for (const field of ["techniques", "category", "typo"]) {
    assert.throws(
      () => applyPublicTechniqueFilter(model, { [field]: new Set() }),
      /unknown selection field/i,
    );
  }
  const symbolField = Symbol("typo");
  assert.throws(
    () => applyPublicTechniqueFilter(model, { [symbolField]: new Set() }),
    /unknown selection field.*Symbol\(typo\)/i,
  );
});

test("copies genuine Sets before filtering so own size and has properties cannot shadow Set behavior", () => {
  const model = validateProfilePublicTechniques(makePayload(), profileIndex, makeContext());
  const categories = new Set(["shape"]);
  Object.defineProperty(categories, "size", { value: 0 });
  Object.defineProperty(categories, "has", { value: () => false });

  assert.deepEqual(
    [...applyPublicTechniqueFilter(model, { categories })],
    ["p-multi"],
  );
});

test("creates neutral public profile labels for every classification state", () => {
  const model = validateProfilePublicTechniques(makePayload(), profileIndex, makeContext());
  const profileFor = (profileId) => profileIndex.profiles.find((profile) => profile.profile_id === profileId);

  assert.equal(
    profilePublicTechniqueLabel(profileFor("p-mapped"), model.profileMeta.get("p-mapped")),
    "pair-p-mapped | DMS-seq",
  );
  assert.equal(
    profilePublicTechniqueLabel(profileFor("p-multi"), model.profileMeta.get("p-multi")),
    "pair-p-multi | DMS-MaPseq, SHAPE-MaP",
  );
  assert.equal(
    profilePublicTechniqueLabel(profileFor("p-partial"), model.profileMeta.get("p-partial")),
    "pair-p-partial | DMS, Mystery-seq",
  );
  assert.equal(
    profilePublicTechniqueLabel(profileFor("p-unmapped"), model.profileMeta.get("p-unmapped")),
    "pair-p-unmapped | NoMap-seq | Technique category unavailable",
  );
  assert.equal(
    profilePublicTechniqueLabel(profileFor("p-background"), model.profileMeta.get("p-background")),
    "pair-p-background | Background / control",
  );
  assert.equal(
    profilePublicTechniqueLabel(profileFor("p-missing"), model.profileMeta.get("p-missing")),
    "pair-p-missing | Technique metadata unavailable",
  );
  assert.equal(
    profilePublicTechniqueLabel(
      { profile_id: "p-mapped", label: "Existing profile label" },
      model.profileMeta.get("p-mapped"),
    ),
    "Existing profile label | DMS-seq",
  );

  for (const profile of profileIndex.profiles) {
    assert.doesNotMatch(
      profilePublicTechniqueLabel(profile, model.profileMeta.get(profile.profile_id)),
      /\b(?:Family|EF|Tier|LSS)\b/,
    );
  }
});

test("renders each public category badge once in taxonomy order and escapes HTML", () => {
  const model = validateProfilePublicTechniques(makePayload(), profileIndex, makeContext());
  assert.equal(
    categoryBadgeMarkup(model.profileMeta.get("p-multi")),
    '<span class="public-technique-category-badge" data-category="dms" title="DMS-based methods">DMS</span>'
      + '<span class="public-technique-category-badge" data-category="shape" title="SHAPE-based methods">SHAPE</span>',
  );
  assert.equal(categoryBadgeMarkup(model.profileMeta.get("p-background")), "");
  assert.equal(categoryBadgeMarkup(), "");

  const escaped = categoryBadgeMarkup({
    categories: [{ id: 'cat"<&', label: 'A & "B" <C>', shortLabel: "<Short>" }],
  });
  assert.equal(
    escaped,
    '<span class="public-technique-category-badge" data-category="cat&quot;&lt;&amp;" title="A &amp; &quot;B&quot; &lt;C&gt;">&lt;Short&gt;</span>',
  );
  assert.doesNotMatch(escaped, /\b(?:Family|EF|Tier|LSS)\b/);
});

test("rejects a missing, null, array, or otherwise non-object sidecar", () => {
  assert.throws(
    () => validateProfilePublicTechniques(undefined, profileIndex, makeContext()),
    /sidecar is required/i,
  );
  assert.throws(
    () => validateProfilePublicTechniques(null, profileIndex, makeContext()),
    /sidecar is required/i,
  );
  for (const payload of [[], "sidecar", 7]) {
    assert.throws(
      () => validateProfilePublicTechniques(payload, profileIndex, makeContext()),
      /sidecar must be an object/i,
    );
  }
});

test("rejects schema, PDB, and chain drift byte-for-byte", () => {
  expectInvalid((payload) => { payload.schemaVersion = "profile-public-techniques.v2"; }, /schemaVersion/i);
  expectInvalid((payload) => { payload.pdbId = "9wnr"; }, /pdbId/i);
  expectInvalid((payload) => { payload.authChain = "A"; }, /authChain/i);
});

test("rejects invalid PDB and chain identities even when payload and context agree", () => {
  const invalidValuesByField = {
    pdbId: [null, 7, true, "", "   ", " 9WNR "],
    authChain: [null, 7, true, "", "   ", " a "],
  };
  for (const [field, invalidValues] of Object.entries(invalidValuesByField)) {
    for (const value of invalidValues) {
      const payload = makePayload();
      const context = makeContext();
      payload[field] = value;
      context[field] = value;
      assert.throws(
        () => validateProfilePublicTechniques(payload, profileIndex, context),
        new RegExp(`${field} must be a non-empty string without surrounding whitespace`, "i"),
      );
    }
  }
});

test("rejects profile-count drift against both the sidecar and profile index", () => {
  expectInvalid((payload) => { payload.profileCount -= 1; }, /profileCount/i);

  const shortIndex = { profiles: profileIndex.profiles.slice(0, -1) };
  assert.throws(
    () => validateProfilePublicTechniques(makePayload(), shortIndex, makeContext()),
    /profileCount/i,
  );
});

test("rejects reordered, duplicate, missing, and extra profile ids", () => {
  expectInvalid((payload) => {
    [payload.profiles[0], payload.profiles[1]] = [payload.profiles[1], payload.profiles[0]];
  }, /order/i);
  expectInvalid((payload) => { payload.profiles[1].profileId = payload.profiles[0].profileId; }, /duplicate/i);
  expectInvalid((payload) => { payload.profiles.at(-1).profileId = "p-extra"; }, /missing|extra|coverage/i);

  const payloadWithExtra = makePayload();
  payloadWithExtra.profiles.push({
    profileId: "p-extra",
    classificationStatus: "missing",
    methods: [],
  });
  payloadWithExtra.profileCount += 1;
  assert.throws(
    () => validateProfilePublicTechniques(payloadWithExtra, profileIndex, makeContext()),
    /profileCount|extra/i,
  );

  const payloadWithMissing = makePayload();
  payloadWithMissing.profiles.pop();
  payloadWithMissing.profileCount -= 1;
  assert.throws(
    () => validateProfilePublicTechniques(payloadWithMissing, profileIndex, makeContext()),
    /profileCount|missing/i,
  );
});

test("rejects unknown and internal fields at every sidecar level", () => {
  for (const [level, field] of [
    ["top", "family"],
    ["top", "ef"],
    ["profile", "tier"],
    ["profile", "lss"],
    ["method", "family"],
    ["method", "ef"],
  ]) {
    expectInvalid((payload) => {
      if (level === "top") payload[field] = "internal";
      if (level === "profile") payload.profiles[0][field] = "internal";
      if (level === "method") payload.profiles[0].methods[0][field] = "internal";
    }, /unknown field/i);
  }
});

test("rejects invalid classification statuses and method combinations", () => {
  expectInvalid((payload) => { payload.profiles[0].classificationStatus = "classified"; }, /classificationStatus/i);
  expectInvalid((payload) => { payload.profiles[0].methods = []; }, /mapped.*methods/i);
  expectInvalid((payload) => { payload.profiles[0].methods.push(unmappedMethod("Unknown")); }, /mapped.*methods/i);
  expectInvalid((payload) => {
    payload.profiles[2].methods = [mappedMethod("DMS", "dms")];
  }, /partially_mapped.*methods/i);
  expectInvalid((payload) => {
    payload.profiles[3].methods = [mappedMethod("DMS", "dms")];
  }, /unmapped.*methods/i);
  expectInvalid((payload) => {
    payload.profiles[4].methods = [unmappedMethod("Control")];
  }, /background.*methods/i);
  expectInvalid((payload) => {
    payload.profiles[5].methods = [unmappedMethod("Unknown")];
  }, /missing.*methods/i);
});

test("rejects mapped category id and public-label drift", () => {
  expectInvalid((payload) => { payload.profiles[0].methods[0].categoryId = "unknown"; }, /categoryId/i);
  expectInvalid((payload) => { payload.profiles[0].methods[0].categoryLabel = "DMS drift"; }, /categoryLabel/i);
  expectInvalid((payload) => { payload.profiles[0].methods[0].categoryShortLabel = "DMS drift"; }, /categoryShortLabel/i);
  expectInvalid((payload) => { payload.profiles[0].methods[0].categoryId = ""; }, /categoryId/i);
});

test("closes mapped and unmapped method labels against the injected shared classifier", () => {
  expectInvalid((payload) => {
    payload.profiles[0].methods[0].label = "SHAPE-MaP";
  }, /canonical method.*category|category.*canonical method|classifier.*category/i);
  expectInvalid((payload) => {
    payload.profiles[0].methods[0].label = "Fabricated-seq";
  }, /mapped method.*(?:canonical|classified as unmapped)/i);
  expectInvalid((payload) => {
    payload.profiles[3].methods[0].label = "DMS";
  }, /unmapped method.*(?:canonical|classified as mapped)/i);
});

test("uses the shared classifier output rather than taxonomy declaration aliases", () => {
  const aliasCases = [
    ["Cotranscriptional_SHAPE-seq", "SHAPE-Seq", "shape"],
    ["Nuc-SHAPE-Structure-Seq", "SHAPE-Seq", "shape"],
    ["icLASER", "LASER-seq", "nucleotide"],
  ];

  for (const [alias, canonical, categoryId] of aliasCases) {
    const mappedAlias = makePayload();
    mappedAlias.profiles[0].methods = [mappedMethod(alias, categoryId)];
    assert.throws(
      () => validateProfilePublicTechniques(mappedAlias, profileIndex, makeContext()),
      /canonical label/i,
    );

    const unmappedAlias = makePayload();
    unmappedAlias.profiles[3].methods = [unmappedMethod(alias)];
    assert.throws(
      () => validateProfilePublicTechniques(unmappedAlias, profileIndex, makeContext()),
      /unmapped method.*(?:classified as mapped|canonical method)/i,
    );

    const canonicalPayload = makePayload();
    canonicalPayload.profiles[0].methods = [mappedMethod(canonical, categoryId)];
    assert.doesNotThrow(
      () => validateProfilePublicTechniques(canonicalPayload, profileIndex, makeContext()),
    );
  }

  const unknownPayload = makePayload();
  unknownPayload.profiles[3].methods = [unmappedMethod("Fabricated-seq")];
  assert.doesNotThrow(
    () => validateProfilePublicTechniques(unknownPayload, profileIndex, makeContext()),
  );
});

test("fails loudly when the shared single-token classifier is unavailable or malformed", () => {
  for (const classifyTechniqueTokenValue of [undefined, null, "classifier"]) {
    assert.throws(
      () => validateProfilePublicTechniques(
        makePayload(),
        profileIndex,
        makeContext({ classifyTechniqueToken: classifyTechniqueTokenValue }),
      ),
      /classifyTechniqueToken must be a function/i,
    );
  }
  assert.throws(
    () => validateProfilePublicTechniques(
      makePayload(),
      profileIndex,
      makeContext({ classifyTechniqueToken: () => { throw new Error("classifier exploded"); } }),
    ),
    /classifyTechniqueToken failed.*classifier exploded/i,
  );
  for (const malformedResult of [null, [], {}, { label: "DMS", mappingStatus: "mapped" }]) {
    assert.throws(
      () => validateProfilePublicTechniques(
        makePayload(),
        profileIndex,
        makeContext({ classifyTechniqueToken: () => malformedResult }),
      ),
      /malformed classifyTechniqueToken result/i,
    );
  }
});

test("requires every unmapped category field to be explicitly null", () => {
  for (const field of ["categoryId", "categoryLabel", "categoryShortLabel"]) {
    expectInvalid((payload) => { payload.profiles[3].methods[0][field] = "not-null"; }, new RegExp(field, "i"));
  }

  const payload = makePayload();
  delete payload.profiles[3].methods[0].categoryId;
  assert.throws(
    () => validateProfilePublicTechniques(payload, profileIndex, makeContext()),
    /missing field.*categoryId|categoryId.*required/i,
  );
});

test("rejects duplicate or empty method labels and invalid mapping statuses", () => {
  expectInvalid((payload) => {
    payload.profiles[1].methods.push(clone(payload.profiles[1].methods[0]));
  }, /duplicate method label/i);
  expectInvalid((payload) => { payload.profiles[0].methods[0].label = ""; }, /method label/i);
  expectInvalid((payload) => { payload.profiles[0].methods[0].label = "   "; }, /method label/i);
  expectInvalid((payload) => { payload.profiles[0].methods[0].mappingStatus = "partial"; }, /mappingStatus/i);
});

test("rejects duplicate category ids in the supplied taxonomy", () => {
  const categories = MECHANISM_FAMILIES.map((category) => ({ ...category }));
  categories[1] = { ...categories[1], id: categories[0].id };
  assert.throws(
    () => validateProfilePublicTechniques(makePayload(), profileIndex, makeContext({ categories })),
    /duplicate category id/i,
  );
});

test("does not use category technique declarations as a canonical method registry", () => {
  const categories = MECHANISM_FAMILIES.map(({ id, label, shortLabel }) => ({ id, label, shortLabel }));
  assert.doesNotThrow(
    () => validateProfilePublicTechniques(makePayload(), profileIndex, makeContext({ categories })),
  );
});
