export const MODULE_ID = "pf2e-encounter-generator";

const PACK_CACHE = new Map();
const THREATS = {
  trivial: { budget: 40, adjustment: 10 },
  low: { budget: 60, adjustment: 20 },
  moderate: { budget: 80, adjustment: 20 },
  severe: { budget: 120, adjustment: 30 },
  extreme: { budget: 160, adjustment: 40 },
};
const QUICK_GROUPS = {
  random: null,
  bossLackeys: {
    threat: "severe",
    entries: [2, -4, -4, -4, -4],
  },
  bossLieutenant: {
    threat: "severe",
    entries: [2, 0],
  },
  eliteEnemies: {
    threat: "severe",
    entries: [0, 0, 0],
  },
  lieutenantLackeys: {
    threat: "moderate",
    entries: [0, -4, -4, -4, -4],
  },
  matedPair: {
    threat: "moderate",
    entries: [0, 0],
  },
  troop: {
    threat: "moderate",
    entries: [0, -2, -2],
  },
  mookSquad: {
    threat: "low",
    entries: [-4, -4, -4, -4, -4, -4],
  },
};
const ENVIRONMENTS = {
  none: [],
  underwater: ["aquatic", "amphibious", "azarketi", "water", "locathah", "merfolk", "sea-devil"],
  swamp: ["amphibious", "boggard", "fungus", "plant", "ooze", "water", "poison"],
  forest: ["animal", "beast", "fey", "plant", "fungus", "nymph", "wild-hunt"],
  jungle: ["animal", "beast", "plant", "fungus", "dinosaur", "charau-ka", "vanara", "poison"],
  desert: ["fire", "earth", "elemental", "genie", "girtablilu", "ikeshti", "shobhad"],
  mountain: ["earth", "giant", "troll", "oread", "beast", "animal"],
  cavern: ["drow", "duergar", "hryngar", "xulgath", "dero", "morlock", "munavri", "caligni", "ooze", "fungus", "earth"],
  urban: ["humanoid", "construct", "clockwork", "golem", "soulbound", "skelm", "werecreature", "vampire"],
  tomb: ["undead", "skeleton", "zombie", "mummy", "ghost", "wight", "wraith", "spirit", "construct", "golem"],
  haunted: ["undead", "ghost", "wraith", "spirit", "shadow", "shade", "incorporeal", "ethereal", "void"],
  fiendish: ["fiend", "demon", "devil", "daemon", "qlippoth", "asura", "div", "velstrac", "sahkil"],
  celestial: ["celestial", "angel", "archon", "azata", "agathion", "couatl"],
  fire: ["fire", "elemental", "genie"],
  water: ["water", "elemental", "genie", "aquatic", "amphibious"],
  earth: ["earth", "elemental", "genie", "oread"],
  air: ["air", "elemental", "genie"],
  astral: ["astral", "cosmic", "aeon", "monitor", "time", "siktempora"],
  dream: ["dream", "ethereal", "phantom", "spirit", "incorporeal"],
  aberrant: ["aberration", "seugathi", "grioth", "jinsul", "mutant", "experiment"],
};
const CREATURE_XP_BY_DIFF = new Map([
  [-4, 10],
  [-3, 15],
  [-2, 20],
  [-1, 30],
  [0, 40],
  [1, 60],
  [2, 80],
  [3, 120],
  [4, 160],
]);
const CREATURE_ROLES = {
  "-4": "Low-threat lackey",
  "-3": "Low- or moderate-threat lackey",
  "-2": "Lackey",
  "-1": "Low-threat creature",
  0: "Standard creature",
  1: "Low- or moderate-threat boss",
  2: "Moderate- or severe-threat boss",
  3: "Severe- or extreme-threat boss",
  4: "Extreme-threat solo boss",
};
const DEFAULT_CONFIG = {
  encounterName: "",
  partyLevel: 1,
  partySize: 4,
  threat: "moderate",
  quickGroup: "random",
  includeCreatures: true,
  includeHazards: false,
  sourceFilterActive: true,
  environment: "none",
  allowUncommon: true,
  allowRare: false,
  allowUnique: false,
  minLevelOffset: -4,
  maxLevelOffset: 2,
  maxEntries: 8,
  selectedSources: [],
  traits: "",
  labels: "",
};

export class EncounterGeneratorForm extends FormApplication {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "pf2e-encounter-generator-form",
      title: game.i18n.localize("PF2EEncounterGenerator.Form.Title"),
      template: `modules/${MODULE_ID}/templates/encounter-generator-form.hbs`,
      classes: ["pf2e", "pf2e-encounter-generator"],
      width: 720,
      height: "auto",
      closeOnSubmit: false,
      submitOnChange: false,
      resizable: true,
    });
  }

  async getData() {
    const defaults = getStoredConfig();
    const selectedThreat = getEffectiveThreat(defaults);
    const sourceOptions = await getSourceOptions(defaults.selectedSources);

    return {
      defaults,
      defaultEncounterName: getDefaultEncounterName(defaults),
      budgetLabel: formatBudgetLabel(defaults),
      threats: Object.keys(THREATS).map((threat) => ({
        value: threat,
        label: game.i18n.localize(`PF2EEncounterGenerator.Threat.${capitalize(threat)}`),
        selected: selectedThreat === threat,
      })),
      quickGroups: Object.keys(QUICK_GROUPS).map((quickGroup) => ({
        value: quickGroup,
        label: game.i18n.localize(`PF2EEncounterGenerator.QuickGroup.${capitalize(quickGroup)}`),
        selected: defaults.quickGroup === quickGroup,
        threat: QUICK_GROUPS[quickGroup]?.threat ?? "",
      })),
      sourceOptions,
      environments: Object.keys(ENVIRONMENTS).map((environment) => ({
        value: environment,
        label: game.i18n.localize(`PF2EEncounterGenerator.Environment.${capitalize(environment)}`),
        selected: defaults.environment === environment,
      })),
      selectedTraits: getSelectedTraitOptions(defaults.traits),
      traitOptions: getTraitOptions(),
    };
  }

  activateListeners(html) {
    super.activateListeners(html);

    html.find("[data-action='cancel']").on("click", (event) => {
      event.preventDefault();
      this.close();
    });

    html.find("[data-action='add-trait']").on("click", (event) => {
      event.preventDefault();
      addTraitFromPicker(html[0]);
    });

    html.find("[data-trait-search]").on("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      addTraitFromPicker(html[0]);
    });

    html.find("[data-trait-chips]").on("click", "button[data-trait]", (event) => {
      event.preventDefault();
      removeTraitFromPicker(html[0], event.currentTarget.dataset.trait);
    });

    html.find("[name='partyLevel'], [name='partySize'], [name='threat'], [name='quickGroup']").on("change input", (event) => {
      if (event.currentTarget.name === "quickGroup") syncThreatToQuickGroup(html[0]);
      updateBudgetLabel(html[0]);
    });

    html.find("[data-source-search]").on("input", (event) => {
      filterSourceOptions(html[0], event.currentTarget.value);
    });

    html.find("[data-action='toggle-visible-sources']").on("change", (event) => {
      toggleVisibleSourceOptions(html[0], event.currentTarget.checked);
    });

    html.find("[name='environment']").on("change", (event) => {
      applyEnvironmentPreset(html[0], event.currentTarget.value);
    });

    html.find("[data-trait-chips]").on("change", "[data-trait-operator]", (event) => {
      updateTraitOperator(html[0], event.currentTarget.dataset.trait, event.currentTarget.value);
    });
  }

  async _updateObject(_event, formData) {
    if (game.system.id !== "pf2e") {
      ui.notifications.error(game.i18n.localize("PF2EEncounterGenerator.Notify.NoPf2e"));
      return;
    }

    const config = normalizeFormData(formData);
    if (!config.includeCreatures && !config.includeHazards) {
      ui.notifications.error(game.i18n.localize("PF2EEncounterGenerator.Notify.NoSources"));
      return;
    }

    ui.notifications.info(game.i18n.localize("PF2EEncounterGenerator.Notify.Generating"));
    const candidates = await getEncounterCandidates(config);
    if (!candidates.length) {
      ui.notifications.warn(game.i18n.localize("PF2EEncounterGenerator.Notify.NoMatches"));
      return;
    }

    const encounter = config.quickGroup === "random" ? generateEncounter(candidates, config) : generateQuickEncounter(candidates, config);
    if (!encounter.entries.length) {
      ui.notifications.warn(game.i18n.localize("PF2EEncounterGenerator.Notify.NoEncounter"));
      return;
    }

    encounter.name = config.encounterName;
    encounter.userNamed = config.userNamedEncounter;
    await importEncounterActors(encounter);
    await game.settings.set(MODULE_ID, "lastConfig", serializeConfig(config));
    await postEncounterToChat(encounter, config);
    await this.close({ force: true });

    ui.notifications.info(
      game.i18n.format("PF2EEncounterGenerator.Notify.Generated", {
        count: encounter.entries.length,
        spent: encounter.spent,
        budget: encounter.budget,
      }),
    );
  }
}

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, "lastConfig", {
    scope: "world",
    config: false,
    type: Object,
    default: { ...DEFAULT_CONFIG },
  });
});

async function getEncounterCandidates(config) {
  const cacheKey = [
    config.includeCreatures,
    config.includeHazards,
    config.sourceFilterActive,
    config.quickGroup,
    config.partyLevel,
    config.minLevelOffset,
    config.maxLevelOffset,
    config.allowUncommon,
    config.allowRare,
    config.allowUnique,
    config.selectedSources.join("|"),
    serializeTraitFilters(config.traits),
    config.labels.join("|"),
  ].join(":");

  if (PACK_CACHE.has(cacheKey)) return PACK_CACHE.get(cacheKey);

  const requiredDiffs = getQuickGroupDiffs(config.quickGroup);
  const minLevel = config.partyLevel + (requiredDiffs.length ? Math.min(...requiredDiffs) : config.minLevelOffset);
  const maxLevel = config.partyLevel + (requiredDiffs.length ? Math.max(...requiredDiffs) : config.maxLevelOffset);
  const raritySet = new Set(["common"]);
  const sourceSet = new Set(config.selectedSources);
  if (config.allowUncommon) raritySet.add("uncommon");
  if (config.allowRare) raritySet.add("rare");
  if (config.allowUnique) raritySet.add("unique");

  const candidates = [];
  for (const pack of game.packs) {
    const packageName = pack.metadata.packageName ?? pack.metadata.package;
    if (pack.documentName !== "Actor" || packageName !== "pf2e") continue;
    const index = await pack.getIndex({
      fields: [
        "type",
        "img",
        "system.details.level.value",
        "system.details.publication.title",
        "system.details.source.value",
        "system.traits.value",
        "system.traits.rarity",
      ],
    });

    for (const entry of index) {
      const type = entry.type;
      if (type === "npc" && !config.includeCreatures) continue;
      if (type === "hazard" && !config.includeHazards) continue;
      if (type !== "npc" && type !== "hazard") continue;

      const level = Number(
        foundry.utils.getProperty(entry, "system.details.level.value") ?? foundry.utils.getProperty(entry, "system.level.value"),
      );
      if (!Number.isFinite(level) || level < minLevel || level > maxLevel) continue;

      const diff = level - config.partyLevel;
      const xp = CREATURE_XP_BY_DIFF.get(diff);
      if (!xp) continue;

      const traits = ensureArray(foundry.utils.getProperty(entry, "system.traits.value")).map((trait) => String(trait).toLowerCase());
      const rarity = String(foundry.utils.getProperty(entry, "system.traits.rarity") ?? "common").toLowerCase();
      const source =
        foundry.utils.getProperty(entry, "system.details.publication.title") ??
        foundry.utils.getProperty(entry, "system.details.source.value") ??
        pack.metadata.label;
      const sourceSlug = sluggify(source);
      if (!raritySet.has(rarity)) continue;
      if (config.sourceFilterActive && !sourceSet.has(sourceSlug)) continue;
      if (config.traits.length && !matchesTraitFilters(traits, config.traits)) continue;
      if (config.labels.length && !matchesLabels({ ...entry, pack: pack.collection, source }, config.labels, traits)) continue;

      candidates.push({
        id: entry._id,
        uuid: entry.uuid ?? `Compendium.${pack.collection}.${entry._id}`,
        pack: pack.collection,
        name: entry.name,
        img: entry.img,
        type,
        level,
        diff,
        xp,
        role: CREATURE_ROLES[String(diff)] ?? "",
        rarity,
        traits,
        source,
        sourceSlug,
      });
    }
  }

  PACK_CACHE.set(cacheKey, candidates);
  return candidates;
}

function generateEncounter(candidates, config) {
  const budget = getAdjustedBudget(config.partyLevel, config.partySize, config.threat).budget;
  let best = { entries: [], spent: 0, budget, score: Number.POSITIVE_INFINITY };

  for (let attempt = 0; attempt < 500; attempt += 1) {
    const entries = [];
    const used = new Map();
    let spent = 0;

    for (let slot = 0; slot < config.maxEntries; slot += 1) {
      const remaining = budget - spent;
      const affordable = candidates.filter((candidate) => {
        if (candidate.xp > remaining) return false;
        const currentCount = used.get(candidate.uuid) ?? 0;
        if (currentCount >= duplicateLimit(candidate)) return false;
        return true;
      });
      if (!affordable.length) break;

      const candidate = weightedPick(affordable, remaining, slot);
      entries.push(createEncounterEntry(candidate));
      used.set(candidate.uuid, (used.get(candidate.uuid) ?? 0) + 1);
      spent += candidate.xp;
      if (spent === budget) break;
    }

    const score = scoreEncounter(entries, spent, budget);
    if (score < best.score) best = { entries, spent, budget, score };
    if (spent === budget && entries.length > 1) break;
  }

  best.entries.sort((a, b) => b.level - a.level || a.name.localeCompare(b.name));
  return best;
}

function generateQuickEncounter(candidates, config) {
  const quickGroup = QUICK_GROUPS[config.quickGroup];
  if (!quickGroup) return generateEncounter(candidates, config);

  const entries = [];
  const used = new Map();
  for (const diff of quickGroup.entries) {
    const pool = candidates.filter((candidate) => {
      if (candidate.type !== "npc") return false;
      if (candidate.diff !== diff) return false;
      const currentCount = used.get(candidate.uuid) ?? 0;
      return currentCount < duplicateLimit(candidate);
    });
    if (!pool.length) return { entries: [], spent: 0, budget: 0, score: Number.POSITIVE_INFINITY, quickGroup: config.quickGroup };

    const candidate = randomElement(pool);
    entries.push(createEncounterEntry(candidate));
    used.set(candidate.uuid, (used.get(candidate.uuid) ?? 0) + 1);
  }

  const budget = quickGroup.entries.reduce((sum, diff) => sum + CREATURE_XP_BY_DIFF.get(diff), 0);
  const spent = entries.reduce((sum, entry) => sum + entry.xp, 0);
  entries.sort((a, b) => b.level - a.level || a.name.localeCompare(b.name));
  return { entries, spent, budget, score: budget - spent, quickGroup: config.quickGroup, threat: quickGroup.threat };
}

async function postEncounterToChat(encounter, config) {
  const threat = encounter.threat ?? config.threat;
  const title = encounter.name || getDefaultEncounterName({ ...config, threat });
  const rows = getEncounterRows(encounter)
    .map((entry) => {
      const icon = entry.type === "hazard" ? "fa-triangle-exclamation" : "fa-skull";
      const diff = entry.diff >= 0 ? `+${entry.diff}` : String(entry.diff);
      const count = entry.count > 1 ? game.i18n.format("PF2EEncounterGenerator.Chat.Count", { count: entry.count }) : "";
      return `
        <li>
          <img src="${entry.img ?? "icons/svg/mystery-man.svg"}" alt="" />
          <div>
            <a class="content-link" draggable="true" data-link data-uuid="${entry.uuid}">
              <i class="fas ${icon}"></i> ${escapeHtml(entry.name)}${count}
            </a>
            <span>${game.i18n.format("PF2EEncounterGenerator.Chat.EntryMeta", {
              level: entry.level,
              diff,
              xp: entry.xp,
              rarity: capitalize(entry.rarity),
            })}</span>
          </div>
        </li>`;
    })
    .join("");

  const content = `
    <section class="pf2e-encounter-generator-chat">
      <h2>${escapeHtml(title)}</h2>
      ${encounter.quickGroup ? `<p>${escapeHtml(game.i18n.localize(`PF2EEncounterGenerator.QuickGroupHint.${capitalize(encounter.quickGroup)}`))}</p>` : ""}
      <p>${game.i18n.format("PF2EEncounterGenerator.Chat.Budget", {
        spent: encounter.spent,
        budget: encounter.budget,
        award: encounter.quickGroup ? encounter.budget : THREATS[config.threat].budget,
        partySize: config.partySize,
      })}</p>
      <ol>${rows}</ol>
    </section>`;

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker(),
    content,
    whisper: ChatMessage.getWhisperRecipients("GM").map((user) => user.id),
  });
}

function normalizeFormData(formData) {
  const expanded = foundry.utils.expandObject(formData);
  const minLevelOffset = clampWholeNumber(expanded.minLevelOffset, -4, 4, DEFAULT_CONFIG.minLevelOffset);
  const maxLevelOffset = clampWholeNumber(expanded.maxLevelOffset, -4, 4, DEFAULT_CONFIG.maxLevelOffset);
  const quickGroup = Object.prototype.hasOwnProperty.call(QUICK_GROUPS, expanded.quickGroup) ? expanded.quickGroup : DEFAULT_CONFIG.quickGroup;
  const encounterName = String(expanded.encounterName ?? "").trim();
  const threat =
    quickGroup === "random"
      ? Object.prototype.hasOwnProperty.call(THREATS, expanded.threat)
        ? expanded.threat
        : DEFAULT_CONFIG.threat
      : QUICK_GROUPS[quickGroup].threat;

  return {
    encounterName: getEncounterName(encounterName, {
      partyLevel: clampWholeNumber(expanded.partyLevel, 1, 25, DEFAULT_CONFIG.partyLevel),
      quickGroup,
      threat,
    }),
    userNamedEncounter: Boolean(encounterName),
    partyLevel: clampWholeNumber(expanded.partyLevel, 1, 25, DEFAULT_CONFIG.partyLevel),
    partySize: clampWholeNumber(expanded.partySize, 1, 12, DEFAULT_CONFIG.partySize),
    threat,
    quickGroup,
    includeCreatures: quickGroup !== "random" || Boolean(expanded.includeCreatures),
    includeHazards: Boolean(expanded.includeHazards),
    sourceFilterActive: Boolean(expanded.sourceFilterActive),
    environment: Object.prototype.hasOwnProperty.call(ENVIRONMENTS, expanded.environment) ? expanded.environment : DEFAULT_CONFIG.environment,
    allowUncommon: Boolean(expanded.allowUncommon),
    allowRare: Boolean(expanded.allowRare),
    allowUnique: Boolean(expanded.allowUnique),
    selectedSources: ensureArray(expanded.sources).map((source) => String(source).trim()).filter(Boolean),
    minLevelOffset: Math.min(minLevelOffset, maxLevelOffset),
    maxLevelOffset: Math.max(minLevelOffset, maxLevelOffset),
    maxEntries: clampWholeNumber(expanded.maxEntries, 1, 20, DEFAULT_CONFIG.maxEntries),
    traits: parseTraitFilters(expanded.traits),
    labels: normalizeCsv(expanded.labels),
  };
}

async function getSourceOptions(selectedSources) {
  const sources = await loadEncounterSources();
  const selected = new Set(ensureArray(selectedSources));
  const hasSelection = selected.size > 0;

  return sources.map((source) => ({
    slug: source.slug,
    name: source.name,
    checked: hasSelection ? selected.has(source.slug) : true,
  }));
}

async function loadEncounterSources() {
  if (PACK_CACHE.has("sources")) return PACK_CACHE.get("sources");

  const sources = new Map();
  const fields = ["type", "system.details.publication.title", "system.details.source.value"];

  for (const pack of game.packs) {
    const packageName = pack.metadata.packageName ?? pack.metadata.package;
    if (pack.documentName !== "Actor" || packageName !== "pf2e") continue;

    const index = await pack.getIndex({ fields });
    for (const entry of index) {
      if (entry.type !== "npc" && entry.type !== "hazard") continue;

      const source = String(
        foundry.utils.getProperty(entry, "system.details.publication.title") ??
          foundry.utils.getProperty(entry, "system.details.source.value") ??
          pack.metadata.label,
      ).trim();
      if (!source) continue;

      const slug = sluggify(source);
      if (!sources.has(slug)) sources.set(slug, { slug, name: source });
    }
  }

  const options = Array.from(sources.values()).sort((a, b) => a.name.localeCompare(b.name, game.i18n.lang));
  PACK_CACHE.set("sources", options);
  return options;
}

async function importEncounterActors(encounter) {
  const folder = await getOrCreateActorFolder(encounter.name, { reuseExisting: encounter.userNamed });
  encounter.name = folder.name;
  const imported = [];
  const grouped = getEncounterRows(encounter);

  for (const entry of grouped) {
    const source = await fromUuid(entry.sourceUuid);
    if (!source) continue;

    const data = source.toObject();
    delete data._id;
    data.folder = folder.id;
    data.name = entry.name;

    const actor = await Actor.create(data, { renderSheet: false });
    entry.uuid = actor.uuid;
    entry.id = actor.id;
    entry.imported = true;
    imported.push(actor);
  }

  encounter.groupedEntries = grouped;

  return imported;
}

function getEncounterRows(encounter) {
  if (encounter.groupedEntries) return encounter.groupedEntries;

  const groups = new Map();
  for (const entry of encounter.entries) {
    const key = entry.sourceUuid ?? entry.uuid;
    const grouped = groups.get(key);
    if (grouped) {
      grouped.count += 1;
      continue;
    }
    groups.set(key, { ...entry, sourceUuid: key, count: 1 });
  }

  return Array.from(groups.values()).sort((a, b) => b.level - a.level || a.name.localeCompare(b.name));
}

function createEncounterEntry(candidate) {
  return {
    ...candidate,
    sourceUuid: candidate.uuid,
    count: 1,
  };
}

async function getOrCreateActorFolder(name, { reuseExisting = false } = {}) {
  const existing = game.folders.find((folder) => folder.type === "Actor" && folder.name === name);
  if (existing && reuseExisting) return existing;
  if (!existing) return Folder.create({ name, type: "Actor" });

  const numberedName = getNumberedFolderName(name);
  return Folder.create({ name: numberedName, type: "Actor" });
}

function getNumberedFolderName(name) {
  const escaped = escapeRegExp(name);
  const matcher = new RegExp(`^${escaped}(?: (\\d+))?$`);
  let count = 0;

  for (const folder of game.folders) {
    if (folder.type !== "Actor") continue;
    if (matcher.test(folder.name)) count += 1;
  }

  return `${name} ${count + 1}`;
}

function getQuickGroupDiffs(quickGroup) {
  return QUICK_GROUPS[quickGroup]?.entries ?? [];
}

function getStoredConfig() {
  const stored = game.settings.get(MODULE_ID, "lastConfig") ?? {};
  const config = {
    ...DEFAULT_CONFIG,
    ...stored,
    encounterName: "",
    selectedSources: ensureArray(stored.selectedSources),
    environment: Object.prototype.hasOwnProperty.call(ENVIRONMENTS, stored.environment) ? stored.environment : DEFAULT_CONFIG.environment,
    traits: serializeTraitFilters(parseTraitFilters(stored.traits)),
    labels: ensureArray(stored.labels).join(", "),
  };
  return {
    ...config,
    threat: getEffectiveThreat(config),
  };
}

function serializeConfig(config) {
  return {
    ...config,
    selectedSources: [...config.selectedSources],
    traits: serializeTraitFilters(config.traits),
    labels: [...config.labels],
  };
}

function getAdjustedBudget(_partyLevel, partySize, threat) {
  const threatData = THREATS[threat] ?? THREATS.moderate;
  return {
    budget: Math.max(10, threatData.budget + (partySize - 4) * threatData.adjustment),
    award: threatData.budget,
    adjustment: threatData.adjustment,
  };
}

function formatBudgetLabel(config) {
  const quickGroup = QUICK_GROUPS[config.quickGroup];
  if (quickGroup) {
    const budget = quickGroup.entries.reduce((sum, diff) => sum + CREATURE_XP_BY_DIFF.get(diff), 0);
    return game.i18n.format("PF2EEncounterGenerator.Form.QuickBudget", {
      budget,
      threat: game.i18n.localize(`PF2EEncounterGenerator.Threat.${capitalize(quickGroup.threat)}`),
    });
  }

  return game.i18n.format("PF2EEncounterGenerator.Form.Budget", getAdjustedBudget(config.partyLevel, config.partySize, config.threat));
}

function getEffectiveThreat(config) {
  return QUICK_GROUPS[config.quickGroup]?.threat ?? config.threat ?? DEFAULT_CONFIG.threat;
}

function getEncounterName(value, config) {
  const name = String(value ?? "").trim();
  return name || getDefaultEncounterName(config);
}

function getDefaultEncounterName(config) {
  const quickGroup = config.quickGroup ?? DEFAULT_CONFIG.quickGroup;
  const composition = game.i18n.localize(`PF2EEncounterGenerator.QuickGroup.${capitalize(quickGroup)}`);
  const threat = game.i18n.localize(`PF2EEncounterGenerator.Threat.${capitalize(getEffectiveThreat(config))}`);
  return game.i18n.format("PF2EEncounterGenerator.Form.DefaultEncounterName", {
    composition,
    level: config.partyLevel ?? DEFAULT_CONFIG.partyLevel,
    threat,
  });
}

function scoreEncounter(entries, spent, budget) {
  const shortfall = budget - spent;
  const singleEnemyPenalty = entries.length === 1 && budget >= 80 ? 25 : 0;
  const tooManyPenalty = Math.max(0, entries.length - 8) * 5;
  return shortfall * 3 + singleEnemyPenalty + tooManyPenalty + Math.random();
}

function weightedPick(candidates, remaining, slot) {
  const weighted = candidates.map((candidate) => {
    const exactness = Math.max(1, remaining - candidate.xp + 5);
    const bossPenalty = slot > 0 && candidate.diff >= 2 ? 0.45 : 1;
    const hazardPenalty = candidate.type === "hazard" ? 0.75 : 1;
    return { candidate, weight: (1 / exactness) * bossPenalty * hazardPenalty * 100 };
  });
  const total = weighted.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = Math.random() * total;
  for (const entry of weighted) {
    roll -= entry.weight;
    if (roll <= 0) return entry.candidate;
  }
  return weighted.at(-1).candidate;
}

function randomElement(values) {
  return values[Math.floor(Math.random() * values.length)];
}

function duplicateLimit(candidate) {
  if (candidate.diff <= -3) return 6;
  if (candidate.diff <= -1) return 3;
  return 1;
}

function matchesLabels(entry, labels, traits) {
  const haystack = [entry.name, entry.type, entry.pack, entry.source, ...traits].join(" ").toLowerCase();
  return labels.every((label) => haystack.includes(label));
}

function matchesTraitFilters(traits, filters) {
  const normalizedTraits = new Set(traits);
  const [first, ...remaining] = filters;
  let matched = normalizedTraits.has(first.value);

  for (const filter of remaining) {
    const hasTrait = normalizedTraits.has(filter.value);
    matched = filter.operator === "or" ? matched || hasTrait : matched && hasTrait;
  }

  return matched;
}

function updateBudgetLabel(root) {
  const partyLevel = clampWholeNumber(root.querySelector("[name='partyLevel']")?.value, 1, 25, DEFAULT_CONFIG.partyLevel);
  const partySize = clampWholeNumber(root.querySelector("[name='partySize']")?.value, 1, 12, DEFAULT_CONFIG.partySize);
  const threat = root.querySelector("[name='threat']")?.value ?? DEFAULT_CONFIG.threat;
  const quickGroup = root.querySelector("[name='quickGroup']")?.value ?? DEFAULT_CONFIG.quickGroup;
  const label = root.querySelector("[data-budget-label]");
  if (!label) return;
  label.textContent = formatBudgetLabel({ partyLevel, partySize, threat, quickGroup });
}

function syncThreatToQuickGroup(root) {
  const quickGroup = root.querySelector("[name='quickGroup']")?.value ?? DEFAULT_CONFIG.quickGroup;
  const threat = QUICK_GROUPS[quickGroup]?.threat;
  const threatSelect = root.querySelector("[name='threat']");
  if (threat && threatSelect) threatSelect.value = threat;
}

function filterSourceOptions(root, value) {
  const needle = String(value ?? "").trim().toLocaleLowerCase(game.i18n.lang);
  for (const element of root.querySelectorAll("[data-source-option]")) {
    const name = element.dataset.name?.toLocaleLowerCase(game.i18n.lang) ?? "";
    element.hidden = Boolean(needle && !name.includes(needle));
  }
  const toggle = root.querySelector("[data-action='toggle-visible-sources']");
  if (toggle) toggle.checked = false;
}

function toggleVisibleSourceOptions(root, checked) {
  for (const element of root.querySelectorAll("[data-source-option]")) {
    if (element.hidden) continue;
    const checkbox = element.querySelector("input[type='checkbox']");
    if (checkbox) checkbox.checked = checked;
  }
}

function applyEnvironmentPreset(root, environment) {
  const traits = ENVIRONMENTS[environment] ?? [];
  const filters = traits.map((trait, index) => ({
    value: trait,
    operator: index === 0 ? "and" : "or",
  }));
  setTraitFilters(root, filters);
}

function addTraitFromPicker(root) {
  const input = root.querySelector("[data-trait-search]");
  const value = normalizeTrait(input?.value);
  if (!value) return;

  const hidden = root.querySelector("[data-traits-value]");
  const filters = parseTraitFilters(hidden.value);
  if (!filters.some((filter) => filter.value === value)) {
    filters.push({ value, operator: filters.length ? "and" : "and" });
  }
  input.value = "";
  setTraitFilters(root, filters);
}

function removeTraitFromPicker(root, trait) {
  const hidden = root.querySelector("[data-traits-value]");
  const filters = parseTraitFilters(hidden.value).filter((filter) => filter.value !== trait);
  setTraitFilters(root, filters);
}

function updateTraitOperator(root, trait, operator) {
  const hidden = root.querySelector("[data-traits-value]");
  const filters = parseTraitFilters(hidden.value).map((filter, index) => ({
    ...filter,
    operator: filter.value === trait && index > 0 && operator === "or" ? "or" : filter.value === trait ? "and" : filter.operator,
  }));
  setTraitFilters(root, filters);
}

function setTraitFilters(root, filters) {
  const hidden = root.querySelector("[data-traits-value]");
  if (hidden) hidden.value = serializeTraitFilters(filters);
  renderTraitChips(root, filters);
}

function renderTraitChips(root, filters) {
  const chips = root.querySelector("[data-trait-chips]");
  if (!chips) return;
  chips.replaceChildren(
    ...filters.map((filter, index) => {
      const chip = document.createElement("div");
      chip.className = "trait-chip";
      chip.dataset.trait = filter.value;
      if (index > 0) {
        const select = document.createElement("select");
        select.dataset.traitOperator = "";
        select.dataset.trait = filter.value;
        select.innerHTML = `
          <option value="and"${filter.operator === "and" ? " selected" : ""}>${escapeHtml(game.i18n.localize("PF2EEncounterGenerator.Form.TraitAnd"))}</option>
          <option value="or"${filter.operator === "or" ? " selected" : ""}>${escapeHtml(game.i18n.localize("PF2EEncounterGenerator.Form.TraitOr"))}</option>`;
        chip.append(select);
      }
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.trait = filter.value;
      button.innerHTML = `<span>${escapeHtml(getTraitLabel(filter.value))}</span><i class="fas fa-times"></i>`;
      chip.append(button);
      return chip;
    }),
  );
}

function getSelectedTraitOptions(traits) {
  return parseTraitFilters(traits).map((filter, index) => ({
    value: filter.value,
    label: getTraitLabel(filter.value),
    operator: filter.operator,
    showOperator: index > 0,
    andOperator: filter.operator === "and",
    orOperator: filter.operator === "or",
  }));
}

function getTraitOptions() {
  const traits = CONFIG.PF2E?.creatureTraits ?? CONFIG.PF2E?.traits ?? {};
  return Object.entries(traits)
    .map(([value, label]) => ({
      value,
      label: game.i18n.localize(label),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function getTraitLabel(trait) {
  const label = CONFIG.PF2E?.creatureTraits?.[trait] ?? CONFIG.PF2E?.traits?.[trait] ?? trait;
  return game.i18n.localize(label);
}

function normalizeTrait(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function parseTraitFilters(value) {
  const entries = Array.isArray(value) ? value : normalizeCsv(value);
  return entries
    .map((entry, index) => {
      if (typeof entry === "object" && entry?.value) {
        return {
          value: normalizeTrait(entry.value),
          operator: index === 0 ? "and" : entry.operator === "or" ? "or" : "and",
        };
      }

      const text = String(entry ?? "").trim().toLowerCase();
      const match = /^(and|or):(.+)$/.exec(text);
      return {
        value: normalizeTrait(match ? match[2] : text),
        operator: index === 0 ? "and" : match?.[1] === "or" ? "or" : "and",
      };
    })
    .filter((filter) => filter.value);
}

function serializeTraitFilters(filters) {
  return parseTraitFilters(filters)
    .map((filter, index) => (index === 0 ? filter.value : `${filter.operator}:${filter.value}`))
    .join(", ");
}

function normalizeCsv(value) {
  return String(value ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

function sluggify(value) {
  if (typeof globalThis.sluggify === "function") return globalThis.sluggify(value);
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function ensureArray(value) {
  if (Array.isArray(value)) return value;
  if (value instanceof Set) return [...value];
  if (!value) return [];
  return [value];
}

function clampWholeNumber(value, min, max, fallback) {
  const number = Math.trunc(Number(value));
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function capitalize(value) {
  const text = String(value ?? "");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = String(value ?? "");
  return div.innerHTML;
}

function escapeRegExp(value) {
  return String(value ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
