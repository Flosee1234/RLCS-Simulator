/* ==========================
   RLCS LEAGUE SIMULATOR
   COMPETITION RULES EDITOR
========================== */

const COMPETITION_RULES_KEY = "rlcsCompetitionRulesV1";

const COMPETITION_RULE_REGIONS = [
    "NA",
    "EU",
    "SAM",
    "MENA",
    "OCE",
    "APAC",
    "SSA"
];

const COMPETITION_POINT_TYPES = [
    ["regional", "Regional"],
    ["major", "Major"],
    ["worlds", "World Championship"],
    ["custom", "Custom Event"]
];

let competitionRulesDraft = null;

function getDefaultCompetitionRules() {
    return {
        version: 1,
        updatedAt: new Date().toISOString(),

        points: {
            regional: [
                { min: 1, max: 1, points: 15 },
                { min: 2, max: 2, points: 10 },
                { min: 3, max: 4, points: 7 },
                { min: 5, max: 6, points: 5 },
                { min: 7, max: 8, points: 3 },
                { min: 9, max: 12, points: 2 },
                { min: 13, max: 16, points: 1 }
            ],

            major: [
                { min: 1, max: 1, points: 30 },
                { min: 2, max: 2, points: 20 },
                { min: 3, max: 4, points: 14 },
                { min: 5, max: 6, points: 10 },
                { min: 7, max: 8, points: 6 },
                { min: 9, max: 12, points: 5 },
                { min: 13, max: 16, points: 3 }
            ],

            worlds: [
                { min: 1, max: 1, points: 48 },
                { min: 2, max: 2, points: 36 },
                { min: 3, max: 4, points: 27 },
                { min: 5, max: 8, points: 18 },
                { min: 9, max: 16, points: 9 }
            ],

            custom: [
                { min: 1, max: 1, points: 16 },
                { min: 2, max: 2, points: 12 },
                { min: 3, max: 4, points: 9 },
                { min: 5, max: 8, points: 6 },
                { min: 9, max: 16, points: 3 },
                { min: 17, max: null, points: 1 }
            ]
        },

        major: {
            fieldSize: 16,
            slots: {
                NA: 4,
                EU: 4,
                SAM: 2,
                MENA: 2,
                OCE: 1,
                APAC: 1,
                SSA: 1,
                wildcard: 1
            }
        },

        worlds: {
            mainEventSize: 16,

            directSlots: {
                NA: 4,
                EU: 5,
                SAM: 1,
                MENA: 2,
                OCE: 0,
                APAC: 0,
                SSA: 0
            },

            playIn: {
                teams: 8,
                qualifyingSpots: 4,
                seriesLength: 7,
                regionSlots: {
                    OCE: { count: 1, offset: 0 },
                    SAM: { count: 1, offset: 1 },
                    SSA: { count: 1, offset: 0 },
                    APAC: { count: 1, offset: 0 }
                }
            },

            lcq: {
                enabled: true,
                regionCount: 4,
                teamsPerRegion: 6,
                qualifiersPerRegion: 1,
                seriesLength: 7
            }
        }
    };
}

function cloneCompetitionRules(value) {
    return JSON.parse(JSON.stringify(value));
}

function normaliseCompetitionRules(input) {
    const defaults = getDefaultCompetitionRules();
    const source = input && typeof input === "object"
        ? input
        : {};

    const result = cloneCompetitionRules(defaults);

    result.version = 1;
    result.updatedAt = source.updatedAt || defaults.updatedAt;

    COMPETITION_POINT_TYPES.forEach(([type]) => {
        const rows = Array.isArray(source.points?.[type])
            ? source.points[type]
            : defaults.points[type];

        result.points[type] = rows
            .map(row => ({
                min: Math.max(1, Number(row.min || 1)),
                max: row.max === null || row.max === ""
                    ? null
                    : Math.max(1, Number(row.max || row.min || 1)),
                points: Math.max(0, Number(row.points || 0))
            }))
            .sort((a, b) => a.min - b.min);
    });

    result.major.fieldSize = Math.max(
        2,
        Number(source.major?.fieldSize || defaults.major.fieldSize)
    );

    Object.keys(defaults.major.slots).forEach(region => {
        result.major.slots[region] = Math.max(
            0,
            Number(source.major?.slots?.[region] ?? defaults.major.slots[region])
        );
    });

    result.worlds.mainEventSize = Math.max(
        2,
        Number(source.worlds?.mainEventSize || defaults.worlds.mainEventSize)
    );

    COMPETITION_RULE_REGIONS.forEach(region => {
        result.worlds.directSlots[region] = Math.max(
            0,
            Number(
                source.worlds?.directSlots?.[region] ??
                defaults.worlds.directSlots[region]
            )
        );
    });

    result.worlds.playIn.teams = 8;
    result.worlds.playIn.qualifyingSpots = 4;
    result.worlds.playIn.seriesLength = [3, 5, 7].includes(
        Number(source.worlds?.playIn?.seriesLength)
    )
        ? Number(source.worlds.playIn.seriesLength)
        : defaults.worlds.playIn.seriesLength;

    COMPETITION_RULE_REGIONS.forEach(region => {
        const fallback = defaults.worlds.playIn.regionSlots[region] || {
            count: 0,
            offset: 0
        };
        const supplied = source.worlds?.playIn?.regionSlots?.[region] || {};

        result.worlds.playIn.regionSlots[region] = {
            count: Math.max(0, Number(supplied.count ?? fallback.count)),
            offset: Math.max(0, Number(supplied.offset ?? fallback.offset))
        };
    });

    result.worlds.lcq.enabled = source.worlds?.lcq?.enabled !== false;
    result.worlds.lcq.regionCount = 4;
    result.worlds.lcq.teamsPerRegion = 6;
    result.worlds.lcq.qualifiersPerRegion = 1;
    result.worlds.lcq.seriesLength = [3, 5, 7].includes(
        Number(source.worlds?.lcq?.seriesLength)
    )
        ? Number(source.worlds.lcq.seriesLength)
        : defaults.worlds.lcq.seriesLength;

    return result;
}

function getCompetitionRules() {
    try {
        const parsed = JSON.parse(
            localStorage.getItem(COMPETITION_RULES_KEY) || "null"
        );

        if (parsed) {
            return normaliseCompetitionRules(parsed);
        }
    } catch (error) {
        console.error("Failed to read competition rules:", error);
    }

    const defaults = getDefaultCompetitionRules();
    saveCompetitionRules(defaults, false);
    return defaults;
}

function saveCompetitionRules(rules, refresh = true) {
    const normalised = normaliseCompetitionRules(rules);
    normalised.updatedAt = new Date().toISOString();

    localStorage.setItem(
        COMPETITION_RULES_KEY,
        JSON.stringify(normalised)
    );

    if (refresh) {
        renderCompetitionRulesPage();
        refreshCompetitionRuleViews();
    }

    return normalised;
}

function getRulesForSeason(state) {
    if (state?.rules) {
        return normaliseCompetitionRules(state.rules);
    }

    return getCompetitionRules();
}

function getCompetitionPointsTable(eventType, state = null) {
    const rules = state
        ? getRulesForSeason(state)
        : getCompetitionRules();

    return cloneCompetitionRules(
        rules.points?.[eventType] || rules.points.custom || []
    );
}

function getCompetitionMajorSlots(state = null) {
    const rules = state
        ? getRulesForSeason(state)
        : getCompetitionRules();

    return {
        ...rules.major.slots
    };
}

function getCompetitionWorldsDirectSlots(state = null) {
    const rules = state
        ? getRulesForSeason(state)
        : getCompetitionRules();

    return {
        ...rules.worlds.directSlots
    };
}

function getCompetitionWorldsPlayInRegionSlots(state = null) {
    const rules = state
        ? getRulesForSeason(state)
        : getCompetitionRules();
    const result = {};

    Object.entries(rules.worlds.playIn.regionSlots || {})
        .forEach(([region, config]) => {
            result[region] = {
                count: Number(config.count || 0),
                offset: Number(config.offset || 0)
            };
        });

    return result;
}

function getCompetitionWorldsSettings(state = null) {
    const rules = state
        ? getRulesForSeason(state)
        : getCompetitionRules();

    return cloneCompetitionRules(rules.worlds);
}

function validateCompetitionRules(rules) {
    const errors = [];
    const warnings = [];
    const safeRules = normaliseCompetitionRules(rules);

    COMPETITION_POINT_TYPES.forEach(([type, label]) => {
        const rows = safeRules.points[type] || [];

        if (rows.length === 0) {
            errors.push(`${label} requires at least one points range.`);
            return;
        }

        let expectedMin = 1;

        rows.forEach((row, index) => {
            const max = row.max === null
                ? Infinity
                : Number(row.max);

            if (Number(row.min) !== expectedMin) {
                errors.push(
                    `${label} points have a gap or overlap before row ${index + 1}.`
                );
            }

            if (max < Number(row.min)) {
                errors.push(
                    `${label} row ${index + 1} has an ending placement below its starting placement.`
                );
            }

            expectedMin = Number.isFinite(max)
                ? max + 1
                : Infinity;
        });
    });

    const majorTotal = Object.values(safeRules.major.slots)
        .reduce((sum, value) => sum + Number(value || 0), 0);

    if (majorTotal !== Number(safeRules.major.fieldSize)) {
        errors.push(
            `Major allocations total ${majorTotal}, but the Major field size is ${safeRules.major.fieldSize}.`
        );
    }

    const directTotal = Object.values(safeRules.worlds.directSlots)
        .reduce((sum, value) => sum + Number(value || 0), 0);
    const playInSpots = Number(
        safeRules.worlds.playIn.qualifyingSpots || 0
    );

    if (
        directTotal + playInSpots !==
        Number(safeRules.worlds.mainEventSize)
    ) {
        errors.push(
            `Worlds direct spots (${directTotal}) plus Play-In spots (${playInSpots}) must equal the ${safeRules.worlds.mainEventSize}-team Main Event.`
        );
    }

    const fixedPlayInTotal = Object.values(
        safeRules.worlds.playIn.regionSlots
    ).reduce(
        (sum, config) => sum + Number(config.count || 0),
        0
    );

    const lcqTotal =
        Number(safeRules.worlds.lcq.regionCount || 0) *
        Number(safeRules.worlds.lcq.qualifiersPerRegion || 0);

    if (
        fixedPlayInTotal + lcqTotal !==
        Number(safeRules.worlds.playIn.teams)
    ) {
        errors.push(
            `Play-In entries total ${fixedPlayInTotal + lcqTotal}. The current Play-In bracket requires exactly ${safeRules.worlds.playIn.teams} teams.`
        );
    }

    Object.entries(safeRules.worlds.playIn.regionSlots)
        .forEach(([region, config]) => {
            const direct = Number(
                safeRules.worlds.directSlots[region] || 0
            );

            if (
                Number(config.count || 0) > 0 &&
                Number(config.offset || 0) < direct
            ) {
                warnings.push(
                    `${region}'s Play-In offset overlaps its direct Worlds places. Offset ${config.offset} begins before seed ${direct + 1}.`
                );
            }
        });

    return {
        valid: errors.length === 0,
        errors,
        warnings,
        rules: safeRules
    };
}

/* ==========================
   RULES PAGE
========================== */

function renderCompetitionRulesPage() {
    const page = document.getElementById("rulesPage");
    if (!page) return;

    const rules = competitionRulesDraft
        ? normaliseCompetitionRules(competitionRulesDraft)
        : getCompetitionRules();

    renderRulesPointsEditors(rules);
    renderRulesMajorSlots(rules);
    renderRulesWorldsDirectSlots(rules);
    renderRulesWorldsPlayInSlots(rules);
    renderRulesSummary(rules);
}

function renderRulesPointsEditors(rules) {
    COMPETITION_POINT_TYPES.forEach(([type, label]) => {
        const container = document.getElementById(
            `rulesPoints${capitaliseRulesText(type)}`
        );

        if (!container) return;

        container.innerHTML = (rules.points[type] || [])
            .map((row, index) => `
                <div class="rules-points-row"
                    data-rules-points-type="${escapeRulesText(type)}"
                    data-rules-points-index="${index}">

                    <label>
                        From
                        <input type="number"
                            min="1"
                            value="${Number(row.min || 1)}"
                            data-rules-field="min">
                    </label>

                    <label>
                        To
                        <input type="number"
                            min="1"
                            value="${row.max === null ? "" : Number(row.max)}"
                            placeholder="No limit"
                            data-rules-field="max">
                    </label>

                    <label>
                        Points
                        <input type="number"
                            min="0"
                            value="${Number(row.points || 0)}"
                            data-rules-field="points">
                    </label>

                    <button type="button"
                        class="rules-icon-button"
                        title="Remove range"
                        onclick="removeCompetitionPointsRow('${escapeRulesJs(type)}', ${index})">
                        ×
                    </button>

                </div>
            `)
            .join("");

        container.insertAdjacentHTML(
            "beforeend",
            `
                <button type="button"
                    class="secondary-button rules-add-range"
                    onclick="addCompetitionPointsRow('${escapeRulesJs(type)}')">
                    Add ${escapeRulesText(label)} Range
                </button>
            `
        );
    });
}

function renderRulesMajorSlots(rules) {
    const container = document.getElementById("rulesMajorSlots");
    if (!container) return;

    const slotOrder = [
        ...COMPETITION_RULE_REGIONS,
        "wildcard"
    ];

    container.innerHTML = slotOrder.map(region => `
        <label class="rules-slot-field">
            <span>${escapeRulesText(region === "wildcard" ? "Wildcard" : region)}</span>
            <input type="number"
                min="0"
                value="${Number(rules.major.slots[region] || 0)}"
                data-rules-major-slot="${escapeRulesText(region)}">
        </label>
    `).join("");

    const fieldSize = document.getElementById("rulesMajorFieldSize");
    if (fieldSize) {
        fieldSize.value = Number(rules.major.fieldSize || 16);
    }
}

function renderRulesWorldsDirectSlots(rules) {
    const container = document.getElementById("rulesWorldsDirectSlots");
    if (!container) return;

    container.innerHTML = COMPETITION_RULE_REGIONS.map(region => `
        <label class="rules-slot-field">
            <span>${escapeRulesText(region)}</span>
            <input type="number"
                min="0"
                value="${Number(rules.worlds.directSlots[region] || 0)}"
                data-rules-worlds-direct="${escapeRulesText(region)}">
        </label>
    `).join("");

    const mainSize = document.getElementById("rulesWorldsMainSize");
    if (mainSize) {
        mainSize.value = Number(rules.worlds.mainEventSize || 16);
    }
}

function renderRulesWorldsPlayInSlots(rules) {
    const container = document.getElementById("rulesWorldsPlayInSlots");
    if (!container) return;

    container.innerHTML = COMPETITION_RULE_REGIONS.map(region => {
        const config = rules.worlds.playIn.regionSlots[region] || {
            count: 0,
            offset: 0
        };

        return `
            <div class="rules-playin-region-row">
                <strong>${escapeRulesText(region)}</strong>

                <label>
                    Spots
                    <input type="number"
                        min="0"
                        value="${Number(config.count || 0)}"
                        data-rules-playin-count="${escapeRulesText(region)}">
                </label>

                <label>
                    Seed offset
                    <input type="number"
                        min="0"
                        value="${Number(config.offset || 0)}"
                        data-rules-playin-offset="${escapeRulesText(region)}">
                </label>
            </div>
        `;
    }).join("");

    const lcqSeries = document.getElementById("rulesLcqSeriesLength");
    const playInSeries = document.getElementById("rulesPlayInSeriesLength");

    if (lcqSeries) {
        lcqSeries.value = String(rules.worlds.lcq.seriesLength || 7);
    }

    if (playInSeries) {
        playInSeries.value = String(rules.worlds.playIn.seriesLength || 7);
    }
}

function renderRulesSummary(rules) {
    const container = document.getElementById("rulesAllocationSummary");
    if (!container) return;

    const majorTotal = Object.values(rules.major.slots)
        .reduce((sum, value) => sum + Number(value || 0), 0);
    const directTotal = Object.values(rules.worlds.directSlots)
        .reduce((sum, value) => sum + Number(value || 0), 0);
    const fixedPlayIn = Object.values(rules.worlds.playIn.regionSlots)
        .reduce((sum, config) => sum + Number(config.count || 0), 0);
    const lcqEntries =
        Number(rules.worlds.lcq.regionCount || 0) *
        Number(rules.worlds.lcq.qualifiersPerRegion || 0);

    container.innerHTML = `
        <div class="rules-summary-card">
            <span>Major Field</span>
            <strong>${majorTotal} / ${Number(rules.major.fieldSize || 16)}</strong>
        </div>

        <div class="rules-summary-card">
            <span>Worlds Direct</span>
            <strong>${directTotal}</strong>
        </div>

        <div class="rules-summary-card">
            <span>Play-In Field</span>
            <strong>${fixedPlayIn + lcqEntries} / ${Number(rules.worlds.playIn.teams || 8)}</strong>
        </div>

        <div class="rules-summary-card">
            <span>Worlds Main Event</span>
            <strong>${directTotal + Number(rules.worlds.playIn.qualifyingSpots || 4)} / ${Number(rules.worlds.mainEventSize || 16)}</strong>
        </div>
    `;
}

function collectCompetitionRulesFromEditor() {
    const current = getCompetitionRules();
    const rules = cloneCompetitionRules(current);

    COMPETITION_POINT_TYPES.forEach(([type]) => {
        const rows = Array.from(
            document.querySelectorAll(
                `[data-rules-points-type="${type}"]`
            )
        );

        rules.points[type] = rows.map(row => {
            const min = row.querySelector('[data-rules-field="min"]')?.value;
            const max = row.querySelector('[data-rules-field="max"]')?.value;
            const points = row.querySelector('[data-rules-field="points"]')?.value;

            return {
                min: Number(min || 1),
                max: String(max || "").trim() === ""
                    ? null
                    : Number(max),
                points: Number(points || 0)
            };
        });
    });

    rules.major.fieldSize = Number(
        document.getElementById("rulesMajorFieldSize")?.value || 16
    );

    document.querySelectorAll("[data-rules-major-slot]")
        .forEach(input => {
            rules.major.slots[input.dataset.rulesMajorSlot] = Number(
                input.value || 0
            );
        });

    rules.worlds.mainEventSize = Number(
        document.getElementById("rulesWorldsMainSize")?.value || 16
    );

    document.querySelectorAll("[data-rules-worlds-direct]")
        .forEach(input => {
            rules.worlds.directSlots[input.dataset.rulesWorldsDirect] = Number(
                input.value || 0
            );
        });

    document.querySelectorAll("[data-rules-playin-count]")
        .forEach(input => {
            const region = input.dataset.rulesPlayinCount;
            rules.worlds.playIn.regionSlots[region] = {
                ...(rules.worlds.playIn.regionSlots[region] || {}),
                count: Number(input.value || 0)
            };
        });

    document.querySelectorAll("[data-rules-playin-offset]")
        .forEach(input => {
            const region = input.dataset.rulesPlayinOffset;
            rules.worlds.playIn.regionSlots[region] = {
                ...(rules.worlds.playIn.regionSlots[region] || {}),
                offset: Number(input.value || 0)
            };
        });

    rules.worlds.lcq.seriesLength = Number(
        document.getElementById("rulesLcqSeriesLength")?.value || 7
    );
    rules.worlds.playIn.seriesLength = Number(
        document.getElementById("rulesPlayInSeriesLength")?.value || 7
    );

    return normaliseCompetitionRules(rules);
}

function saveCompetitionRulesFromEditor(applyToSeason = false) {
    const collected = collectCompetitionRulesFromEditor();
    const validation = validateCompetitionRules(collected);

    renderRulesValidation(validation);

    if (!validation.valid) {
        setRulesStatus(
            "Rules were not saved. Fix the highlighted validation errors first.",
            true
        );
        return false;
    }

    const saved = saveCompetitionRules(validation.rules, false);
    competitionRulesDraft = null;

    let applied = false;

    if (applyToSeason) {
        applied = applyCompetitionRulesToActiveSeason(saved);
    }

    renderCompetitionRulesPage();
    refreshCompetitionRuleViews();

    setRulesStatus(
        applyToSeason
            ? (applied
                ? "Rules saved and applied to unfinished events in the active season."
                : "Rules saved for future seasons, but the active season was not changed.")
            : "Competition rules saved. New seasons will use these settings.",
        applyToSeason && !applied
    );

    return true;
}

function applyCompetitionRulesToActiveSeason(rules = getCompetitionRules()) {
    if (typeof getSeasonState !== "function") return false;

    const state = getSeasonState();
    if (!state) {
        setRulesStatus("There is no active season to update.", true);
        return false;
    }

    const finalStageStarted = (state.events || []).some(event =>
        ["lcq", "playin", "worlds"].includes(event.type) &&
        ["in_progress", "completed"].includes(event.status)
    );

    if (finalStageStarted) {
        setRulesStatus(
            "Qualification rules cannot be applied after an LCQ, Play-In, or Worlds event has started.",
            true
        );
        return false;
    }

    state.rules = cloneCompetitionRules(rules);

    state.lcq = {
        ...(state.lcq || {}),
        enabled: rules.worlds.lcq.enabled,
        regionCount: rules.worlds.lcq.regionCount,
        teamsPerRegion: rules.worlds.lcq.teamsPerRegion,
        spotsPerRegion: rules.worlds.lcq.qualifiersPerRegion,
        seriesLength: rules.worlds.lcq.seriesLength,
        regionRankings: []
    };

    state.playIn = {
        ...(state.playIn || {}),
        enabled: true,
        teams: rules.worlds.playIn.teams,
        spots: rules.worlds.playIn.qualifyingSpots,
        seriesLength: rules.worlds.playIn.seriesLength
    };

    (state.events || []).forEach(event => {
        if (event.status === "completed") return;

        if (event.type === "lcq") {
            event.seriesLength = rules.worlds.lcq.seriesLength;
            event.swissSeriesLength = rules.worlds.lcq.seriesLength;
            event.playoffSeriesLength = rules.worlds.lcq.seriesLength;
        }

        if (event.type === "playin") {
            event.seriesLength = rules.worlds.playIn.seriesLength;
            event.swissSeriesLength = rules.worlds.playIn.seriesLength;
            event.playoffSeriesLength = rules.worlds.playIn.seriesLength;
        }
    });

    if (typeof ensureRegionalLcqEvents === "function") {
        ensureRegionalLcqEvents(state);
    }

    if (typeof saveSeasonState === "function") {
        saveSeasonState(state);
    }

    if (typeof renderSeasonCalendar === "function") {
        renderSeasonCalendar();
    }

    return true;
}

function resetCompetitionRulesToDefaults() {
    if (!confirm("Reset all points and qualification rules to the simulator defaults?")) {
        return;
    }

    competitionRulesDraft = null;
    saveCompetitionRules(getDefaultCompetitionRules());
    renderRulesValidation({ valid: true, errors: [], warnings: [] });
    setRulesStatus("Default competition rules restored.", false);
}

function addCompetitionPointsRow(type) {
    const rules = collectCompetitionRulesFromEditor();
    const rows = rules.points[type] || [];
    const previous = rows[rows.length - 1];
    const previousMax = previous?.max === null
        ? Number(previous.min || 1)
        : Number(previous?.max || 0);

    if (previous?.max === null) {
        previous.max = previousMax;
    }

    rows.push({
        min: previousMax + 1,
        max: previousMax + 1,
        points: 0
    });

    rules.points[type] = rows;
    competitionRulesDraft = rules;
    renderCompetitionRulesPage();
}

function removeCompetitionPointsRow(type, index) {
    const rules = collectCompetitionRulesFromEditor();
    const rows = rules.points[type] || [];

    if (rows.length <= 1) {
        setRulesStatus("A points table needs at least one range.", true);
        return;
    }

    rows.splice(index, 1);
    rules.points[type] = rows;
    competitionRulesDraft = rules;
    renderCompetitionRulesPage();
}

function rebuildPointsAfterRuleChange() {
    if (typeof rebuildLeaguePointsFromHistory !== "function") {
        setRulesStatus("The league points rebuild function is unavailable.", true);
        return;
    }

    rebuildLeaguePointsFromHistory();
    setRulesStatus("League points were rebuilt using the saved rules.", false);
}

function renderRulesValidation(validation) {
    const container = document.getElementById("rulesValidation");
    if (!container) return;

    const errors = validation.errors || [];
    const warnings = validation.warnings || [];

    if (!errors.length && !warnings.length) {
        container.className = "rules-validation rules-validation-success";
        container.innerHTML = `
            <strong>Rules valid</strong>
            <span>Qualification totals and points ranges are consistent.</span>
        `;
        return;
    }

    container.className = errors.length
        ? "rules-validation rules-validation-error"
        : "rules-validation rules-validation-warning";

    container.innerHTML = `
        ${errors.length
            ? `<strong>${errors.length} error${errors.length === 1 ? "" : "s"}</strong>`
            : `<strong>${warnings.length} warning${warnings.length === 1 ? "" : "s"}</strong>`}

        <ul>
            ${[...errors, ...warnings]
                .map(item => `<li>${escapeRulesText(item)}</li>`)
                .join("")}
        </ul>
    `;
}

function validateRulesEditor() {
    const validation = validateCompetitionRules(
        collectCompetitionRulesFromEditor()
    );

    renderRulesValidation(validation);
    renderRulesSummary(validation.rules);
    return validation;
}

function refreshCompetitionRuleViews() {
    if (typeof renderLeagueTable === "function") {
        renderLeagueTable();
    }

    if (typeof renderLanQualification === "function") {
        renderLanQualification();
    }

    if (typeof updateDashboard === "function") {
        updateDashboard();
    }
}

function setRulesStatus(message, isError = false) {
    const status = document.getElementById("rulesStatus");
    if (!status) return;

    status.textContent = message;
    status.classList.toggle("rules-status-error", Boolean(isError));
}

function capitaliseRulesText(value) {
    const text = String(value || "");
    return text.charAt(0).toUpperCase() + text.slice(1);
}

function escapeRulesText(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function escapeRulesJs(value) {
    return String(value ?? "")
        .replace(/\\/g, "\\\\")
        .replace(/'/g, "\\'")
        .replace(/\r/g, "\\r")
        .replace(/\n/g, "\\n");
}

window.addEventListener("load", () => {
    renderCompetitionRulesPage();

    const page = document.getElementById("rulesPage");
    if (page) {
        page.addEventListener("input", event => {
            if (
                event.target.matches(
                    "input, select"
                )
            ) {
                validateRulesEditor();
            }
        });
    }
});

window.getCompetitionRules = getCompetitionRules;
window.getRulesForSeason = getRulesForSeason;
window.getCompetitionPointsTable = getCompetitionPointsTable;
window.getCompetitionMajorSlots = getCompetitionMajorSlots;
window.getCompetitionWorldsDirectSlots = getCompetitionWorldsDirectSlots;
window.getCompetitionWorldsPlayInRegionSlots = getCompetitionWorldsPlayInRegionSlots;
window.getCompetitionWorldsSettings = getCompetitionWorldsSettings;
window.renderCompetitionRulesPage = renderCompetitionRulesPage;
window.saveCompetitionRulesFromEditor = saveCompetitionRulesFromEditor;
window.applyCompetitionRulesToActiveSeason = applyCompetitionRulesToActiveSeason;
window.resetCompetitionRulesToDefaults = resetCompetitionRulesToDefaults;
window.addCompetitionPointsRow = addCompetitionPointsRow;
window.removeCompetitionPointsRow = removeCompetitionPointsRow;
window.rebuildPointsAfterRuleChange = rebuildPointsAfterRuleChange;
window.validateRulesEditor = validateRulesEditor;
