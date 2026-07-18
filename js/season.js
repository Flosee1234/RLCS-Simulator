/* ==========================
   RLCS LEAGUE SIMULATOR
   SEASON MODE V2
========================== */

const SEASON_KEY = "rlcsSeasonCalendar";
const CURRENT_SEASON_EVENT_KEY = "rlcsCurrentSeasonEventId";

const SEASON_TIEBREAKER_VERSION = 2;
const SEASON_TIEBREAKER_MATCH_SERIES = 7;
const SEASON_TIEBREAKER_TOURNAMENT_SERIES = 5;

let focusedSeasonTiebreakerEventId = null;

const SEASON_REGIONS = [
    "NA",
    "EU",
    "SAM",
    "MENA",
    "OCE",
    "APAC",
    "SSA"
];

const WORLDS_MAIN_AUTO_SLOTS = {
    NA: 4,
    EU: 5,
    SAM: 1,
    MENA: 2
};

const WORLDS_PLAYIN_REGION_SLOTS = {
    OCE: { count: 1, offset: 0 },
    SAM: { count: 1, offset: 1 },
    SSA: { count: 1, offset: 0 },
    APAC: { count: 1, offset: 0 }
};

const SEASON_FORMAT_LABELS = {
    roundRobin: "Round Robin",
    playoffs: "Single Elimination",
    swiss: "Swiss Stage",
    swissPlayoffs: "Swiss + Playoffs",
    groupsHybrid: "Groups + Hybrid Playoffs",
    groupsDoubleElim: "Groups + Double-Elim Playoffs",
    doubleElim: "Double Elimination",
    regionalLcq: "Regional Worlds LCQ",
    worldsPlayIn: "Worlds Play-In",
    custom: "Custom Bracket"
};

const SEASON_FORMAT_OPTIONS = [
    ["swissPlayoffs", "Swiss + Playoffs"],
    ["groupsHybrid", "Groups + Hybrid Playoffs"],
    ["groupsDoubleElim", "Groups + Double-Elim Playoffs"],
    ["swiss", "Swiss Stage"],
    ["roundRobin", "Round Robin"],
    ["playoffs", "Single Elimination"],
    ["doubleElim", "Double Elimination"]
];

/* ==========================
   STORAGE + MIGRATION
========================== */

function getSeasonState() {
    const saved = localStorage.getItem(SEASON_KEY);

    if (!saved) return null;

    try {
        const parsed = JSON.parse(saved);

        if (Array.isArray(parsed)) {
            const migrated = migrateLegacySeasonCalendar(parsed);
            saveSeasonState(migrated);
            return migrated;
        }

        if (
            parsed &&
            typeof parsed === "object" &&
            Array.isArray(parsed.events)
        ) {
            const normalised = normaliseSeasonState(parsed);

            if (JSON.stringify(normalised) !== JSON.stringify(parsed)) {
                localStorage.setItem(
                    SEASON_KEY,
                    JSON.stringify(normalised)
                );
            }

            return normalised;
        }
    } catch (error) {
        console.error("Failed to load season state:", error);
    }

    return null;
}

function saveSeasonState(state) {
    if (!state) return;

    state.version = 5;
    state.updatedAt = new Date().toISOString();

    localStorage.setItem(
        SEASON_KEY,
        JSON.stringify(state)
    );
}

function getSeasonCalendar() {
    return getSeasonState()?.events || [];
}

function saveSeasonCalendar(calendar) {
    const state = getSeasonState();

    if (!state) return;

    state.events = Array.isArray(calendar)
        ? calendar
        : [];

    saveSeasonState(state);
}

function normaliseSeasonState(state) {
    const safeState = {
        version: 5,
        id: state.id || `season-${Date.now()}`,
        name: state.name || "Season 1",
        createdAt: state.createdAt || new Date().toISOString(),
        updatedAt: state.updatedAt || new Date().toISOString(),
        status: state.status || "active",
        splitCount: Math.max(1, Number(state.splitCount || 1)),
        regionalsPerSplit: Math.max(
            1,
            Number(state.regionalsPerSplit || 3)
        ),
        regions: Array.isArray(state.regions) && state.regions.length
            ? state.regions.filter(region => SEASON_REGIONS.includes(region))
            : [...SEASON_REGIONS],
        rules: typeof getRulesForSeason === "function"
            ? getRulesForSeason(state)
            : (state.rules || null),
        splits: Array.isArray(state.splits)
            ? state.splits
            : [],
        worlds: state.worlds || createDefaultSeriesEventSettings(
            "groupsDoubleElim",
            7,
            7,
            7
        ),
        lcq: {
            enabled: state.lcq?.enabled !== false,
            regionCount: Number(
                state.lcq?.regionCount ||
                state.rules?.worlds?.lcq?.regionCount ||
                4
            ),
            teamsPerRegion: Number(
                state.lcq?.teamsPerRegion ||
                state.rules?.worlds?.lcq?.teamsPerRegion ||
                6
            ),
            spotsPerRegion: Number(
                state.lcq?.spotsPerRegion ||
                state.rules?.worlds?.lcq?.qualifiersPerRegion ||
                1
            ),
            seriesLength: Number(
                state.lcq?.seriesLength ||
                state.rules?.worlds?.lcq?.seriesLength ||
                7
            ),
            generatedAt: state.lcq?.generatedAt || null,
            regionRankings: Array.isArray(state.lcq?.regionRankings)
                ? state.lcq.regionRankings
                : []
        },
        playIn: {
            enabled: state.playIn?.enabled !== false,
            teams: Number(
                state.playIn?.teams ||
                state.rules?.worlds?.playIn?.teams ||
                8
            ),
            spots: Number(
                state.playIn?.spots ||
                state.rules?.worlds?.playIn?.qualifyingSpots ||
                4
            ),
            seriesLength: Number(
                state.playIn?.seriesLength ||
                state.rules?.worlds?.playIn?.seriesLength ||
                7
            )
        },
        tiebreakers: state.tiebreakers && typeof state.tiebreakers === "object"
            ? state.tiebreakers
            : {},
        events: Array.isArray(state.events)
            ? state.events
            : []
    };

    if (safeState.splits.length === 0) {
        for (let split = 1; split <= safeState.splitCount; split++) {
            safeState.splits.push(
                createDefaultSplitSettings(String(split))
            );
        }
    }

    safeState.events = safeState.events.map((event, index) => ({
        order: index + 1,
        status: "scheduled",
        champion: null,
        historyRecordId: null,
        completedAt: null,
        ...event,
        id: event.id || `${safeState.id}-event-${index + 1}`,
        seasonId: event.seasonId || safeState.id,
        seasonName: event.seasonName || safeState.name,
        split: String(event.split || "1")
    }));

    const worldsEvent = safeState.events.find(event => event.type === "worlds");
    if (worldsEvent?.status !== "completed" && worldsEvent?.format === "doubleElim") {
        worldsEvent.format = "groupsDoubleElim";
        safeState.worlds = createDefaultSeriesEventSettings(
            "groupsDoubleElim",
            Number(worldsEvent.seriesLength || 7),
            Number(worldsEvent.swissSeriesLength || 5),
            Number(worldsEvent.playoffSeriesLength || 7)
        );
    }

    ensureRegionalLcqEvents(safeState);

    return safeState;
}

function migrateLegacySeasonCalendar(calendar) {
    const first = calendar[0] || {};
    const splitValues = calendar
        .filter(event => event.split !== "season")
        .map(event => Number(event.split || 1))
        .filter(Number.isFinite);

    const splitCount = Math.max(1, ...splitValues, 1);
    const seasonId = `season-${Date.now()}`;
    const seasonName = first.seasonName || "Season 1";

    const splits = [];

    for (let split = 1; split <= splitCount; split++) {
        const regional = calendar.find(event =>
            String(event.split) === String(split) &&
            event.type === "regional"
        );

        const major = calendar.find(event =>
            String(event.split) === String(split) &&
            event.type === "major"
        );

        splits.push({
            split: String(split),
            regional: createDefaultSeriesEventSettings(
                regional?.format || "swissPlayoffs",
                regional?.seriesLength || 5,
                regional?.swissSeriesLength || regional?.seriesLength || 5,
                regional?.playoffSeriesLength || 7
            ),
            major: createDefaultSeriesEventSettings(
                major?.format || "swissPlayoffs",
                major?.seriesLength || 5,
                major?.swissSeriesLength || major?.seriesLength || 5,
                major?.playoffSeriesLength || 7
            )
        });
    }

    const worldsEvent = calendar.find(event => event.type === "worlds");

    return normaliseSeasonState({
        version: 5,
        id: seasonId,
        name: seasonName,
        createdAt: first.createdAt || new Date().toISOString(),
        splitCount,
        regions: [...SEASON_REGIONS],
        splits,
        worlds: createDefaultSeriesEventSettings(
            worldsEvent?.format || "groupsDoubleElim",
            worldsEvent?.seriesLength || 7,
            worldsEvent?.swissSeriesLength || 5,
            worldsEvent?.playoffSeriesLength || 7
        ),
        lcq: createDefaultRegionalLcqSettings(),
        events: calendar.map((event, index) => ({
            ...event,
            id: event.id || `${seasonId}-event-${index + 1}`,
            seasonId,
            seasonName,
            order: index + 1,
            status: event.status || "scheduled"
        }))
    });
}

/* ==========================
   CURRENT EVENT
========================== */

function getCurrentSeasonEventId() {
    return localStorage.getItem(CURRENT_SEASON_EVENT_KEY);
}

function setCurrentSeasonEventId(eventId) {
    if (eventId === null || eventId === undefined || eventId === "") {
        clearCurrentSeasonEventId();
        return;
    }

    localStorage.setItem(
        CURRENT_SEASON_EVENT_KEY,
        String(eventId)
    );

    if (typeof tournament !== "undefined") {
        tournament.currentSeasonEventId = String(eventId);
    }
}

function clearCurrentSeasonEventId() {
    localStorage.removeItem(CURRENT_SEASON_EVENT_KEY);

    if (typeof tournament !== "undefined") {
        tournament.currentSeasonEventId = null;
    }
}

function getSeasonEventById(eventId) {
    if (!eventId) return null;

    return getSeasonCalendar().find(event =>
        String(event.id) === String(eventId)
    ) || null;
}

function getCurrentSeasonEvent() {
    return getSeasonEventById(
        getCurrentSeasonEventId()
    );
}

/* ==========================
   BUILDER SETTINGS
========================== */

function createDefaultSeriesEventSettings(
    format = "swissPlayoffs",
    seriesLength = 5,
    swissSeriesLength = 5,
    playoffSeriesLength = 7
) {
    return {
        format,
        seriesLength: Number(seriesLength || 5),
        swissSeriesLength: Number(swissSeriesLength || seriesLength || 5),
        playoffSeriesLength: Number(playoffSeriesLength || seriesLength || 7)
    };
}

function createDefaultSplitSettings(split) {
    return {
        split: String(split),
        regional: createDefaultSeriesEventSettings(
            "swissPlayoffs",
            5,
            5,
            7
        ),
        major: createDefaultSeriesEventSettings(
            "swissPlayoffs",
            5,
            5,
            7
        )
    };
}

function renderSeasonSplitSettingsBuilder() {
    const container = document.getElementById(
        "seasonSplitSettings"
    );

    if (!container) return;

    const splitCountInput = document.getElementById(
        "seasonSplitCount"
    );

    const splitCount = Math.max(
        1,
        Number(splitCountInput?.value || 1)
    );

    const preserved = collectSeasonBuilderSettings(true);

    container.innerHTML = Array.from(
        { length: splitCount },
        (_, index) => {
            const split = String(index + 1);
            const settings = preserved[index] ||
                createDefaultSplitSettings(split);

            return renderSeasonBuilderSplitCard(
                split,
                settings
            );
        }
    ).join("");
}

function renderSeasonBuilderSplitCard(split, settings) {
    return `
        <div class="season-format-builder-card">
            <div class="season-format-builder-title">
                <h4>Split ${escapeSeasonText(split)}</h4>
                <span>Choose a separate format for this split.</span>
            </div>

            <div class="season-format-builder-grid">
                ${renderSeasonBuilderEventControls(
                    `seasonSplit${split}Regional`,
                    "Regional Events",
                    settings.regional
                )}

                ${renderSeasonBuilderEventControls(
                    `seasonSplit${split}Major`,
                    "Major",
                    settings.major
                )}
            </div>
        </div>
    `;
}

function renderSeasonBuilderEventControls(
    idPrefix,
    title,
    settings
) {
    return `
        <div class="season-format-event-card">
            <h5>${escapeSeasonText(title)}</h5>

            <label>Format</label>
            <select id="${idPrefix}Format">
                ${renderSeasonFormatOptions(settings.format)}
            </select>

            <label>Default Series</label>
            <select id="${idPrefix}Series">
                ${renderBestOfOptions(settings.seriesLength)}
            </select>

            <label>Swiss / Group Stage Series</label>
            <select id="${idPrefix}SwissSeries">
                ${renderBestOfOptions(settings.swissSeriesLength)}
            </select>

            <label>Playoff Series</label>
            <select id="${idPrefix}PlayoffSeries">
                ${renderBestOfOptions(settings.playoffSeriesLength)}
            </select>
        </div>
    `;
}

function renderSeasonFormatOptions(selectedValue) {
    return SEASON_FORMAT_OPTIONS.map(([value, label]) => `
        <option value="${value}"
            ${value === selectedValue ? "selected" : ""}>
            ${label}
        </option>
    `).join("");
}

function renderBestOfOptions(selectedValue) {
    return [3, 5, 7].map(value => `
        <option value="${value}"
            ${Number(selectedValue) === value ? "selected" : ""}>
            Best of ${value}
        </option>
    `).join("");
}

function collectSeasonBuilderSettings(silent = false) {
    const splitCount = Math.max(
        1,
        Number(
            document.getElementById("seasonSplitCount")?.value || 1
        )
    );

    const settings = [];

    for (let split = 1; split <= splitCount; split++) {
        const regionalFormat = document.getElementById(
            `seasonSplit${split}RegionalFormat`
        );

        const majorFormat = document.getElementById(
            `seasonSplit${split}MajorFormat`
        );

        if (!regionalFormat || !majorFormat) {
            if (!silent) {
                console.warn(
                    `Missing builder controls for Split ${split}.`
                );
            }
            continue;
        }

        settings.push({
            split: String(split),
            regional: readSeriesSettingsFromControls(
                `seasonSplit${split}Regional`
            ),
            major: readSeriesSettingsFromControls(
                `seasonSplit${split}Major`
            )
        });
    }

    return settings;
}

function readSeriesSettingsFromControls(prefix) {
    return createDefaultSeriesEventSettings(
        document.getElementById(`${prefix}Format`)?.value || "swissPlayoffs",
        Number(document.getElementById(`${prefix}Series`)?.value || 5),
        Number(document.getElementById(`${prefix}SwissSeries`)?.value || 5),
        Number(document.getElementById(`${prefix}PlayoffSeries`)?.value || 7)
    );
}

function readWorldsBuilderSettings() {
    return createDefaultSeriesEventSettings(
        document.getElementById("seasonWorldsFormat")?.value || "groupsDoubleElim",
        Number(document.getElementById("seasonWorldsSeries")?.value || 7),
        Number(document.getElementById("seasonWorldsSwissSeries")?.value || 5),
        Number(document.getElementById("seasonWorldsPlayoffSeries")?.value || 7)
    );
}


/* ==========================
   REGIONAL WORLDS LCQ
========================== */

function createDefaultRegionalLcqSettings() {
    const worldsRules = typeof getCompetitionWorldsSettings === "function"
        ? getCompetitionWorldsSettings()
        : null;
    const lcqRules = worldsRules?.lcq || {};

    return {
        enabled: lcqRules.enabled !== false,
        regionCount: Number(lcqRules.regionCount || 4),
        teamsPerRegion: Number(lcqRules.teamsPerRegion || 6),
        spotsPerRegion: Number(lcqRules.qualifiersPerRegion || 1),
        seriesLength: Number(lcqRules.seriesLength || 7),
        generatedAt: null,
        regionRankings: []
    };
}

function createRegionalLcqSeasonEvent(state, order, lcqSlot) {
    return {
        id: `${state.id}-season-lcq-slot-${lcqSlot}`,
        seasonId: state.id,
        seasonName: state.name,
        order,
        split: "season",
        splitEventNumber: `LCQ${lcqSlot}`,
        name: `Regional Worlds LCQ Slot ${lcqSlot}`,
        type: "lcq",
        region: "TBD",
        format: "regionalLcq",
        seriesLength: Number(state.lcq?.seriesLength || 7),
        swissSeriesLength: Number(state.lcq?.seriesLength || 7),
        playoffSeriesLength: Number(state.lcq?.seriesLength || 7),
        lcqSlot,
        regionPerformanceRank: lcqSlot,
        lcqSeedIds: [],
        provisionalQualifierIds: [],
        qualifiedTeamIds: [],
        qualificationOutcomes: [],
        status: "scheduled",
        champion: null,
        historyRecordId: null,
        completedAt: null,
        startedAt: null
    };
}

function createDefaultWorldsPlayInSettings() {
    const worldsRules = typeof getCompetitionWorldsSettings === "function"
        ? getCompetitionWorldsSettings()
        : null;
    const playInRules = worldsRules?.playIn || {};

    return {
        enabled: true,
        teams: Number(playInRules.teams || 8),
        spots: Number(playInRules.qualifyingSpots || 4),
        seriesLength: Number(playInRules.seriesLength || 7)
    };
}

function createWorldsPlayInSeasonEvent(state, order) {
    return {
        id: `${state.id}-season-worlds-playin`,
        seasonId: state.id,
        seasonName: state.name,
        order,
        split: "season",
        splitEventNumber: "PLAYIN",
        name: `${state.name} Worlds Play-In`,
        type: "playin",
        region: "GLOBAL",
        format: "worldsPlayIn",
        seriesLength: Number(state.playIn?.seriesLength || 7),
        swissSeriesLength: Number(state.playIn?.seriesLength || 7),
        playoffSeriesLength: Number(state.playIn?.seriesLength || 7),
        playInTeamIds: [],
        qualifiedTeamIds: [],
        qualificationOutcomes: [],
        status: "scheduled",
        champion: null,
        historyRecordId: null,
        completedAt: null,
        startedAt: null
    };
}

function ensureRegionalLcqEvents(state) {
    if (!state?.lcq?.enabled || !Array.isArray(state.events)) {
        return false;
    }

    const worlds = state.events.find(event => event.type === "worlds");

    if (
        worlds?.status === "completed" &&
        !state.events.some(event => event.type === "lcq")
    ) {
        return false;
    }

    let changed = false;

    const rules = typeof getRulesForSeason === "function"
        ? getRulesForSeason(state)
        : null;

    state.lcq.spotsPerRegion = Number(
        state.lcq.spotsPerRegion ||
        rules?.worlds?.lcq?.qualifiersPerRegion ||
        1
    );
    state.playIn = {
        ...createDefaultWorldsPlayInSettings(),
        ...(state.playIn || {}),
        teams: Number(
            state.playIn?.teams ||
            rules?.worlds?.playIn?.teams ||
            8
        ),
        spots: Number(
            state.playIn?.spots ||
            rules?.worlds?.playIn?.qualifyingSpots ||
            4
        )
    };

    const lcqEvents = state.events.filter(event => event.type === "lcq");
    const requiredCount = Number(state.lcq.regionCount || 4);

    for (let slot = 1; slot <= requiredCount; slot++) {
        let event = lcqEvents.find(item => Number(item.lcqSlot) === slot);

        if (!event) {
            event = createRegionalLcqSeasonEvent(
                state,
                Number(worlds?.order || state.events.length + 1),
                slot
            );
            state.events.push(event);
            lcqEvents.push(event);
            changed = true;
        }

        const defaults = createRegionalLcqSeasonEvent(
            state,
            Number(event.order || 0),
            slot
        );

        Object.keys(defaults).forEach(key => {
            if (event[key] === undefined || event[key] === null) {
                event[key] = defaults[key];
                changed = true;
            }
        });

        if (event.format !== "regionalLcq") {
            event.format = "regionalLcq";
            changed = true;
        }

        if (
            event.status === "completed" &&
            Array.isArray(event.qualifiedTeamIds) &&
            event.qualifiedTeamIds.length > 1
        ) {
            event.qualifiedTeamIds = event.qualifiedTeamIds.slice(
                0,
                Number(state.lcq.spotsPerRegion || 1)
            );
            changed = true;
        }
    }

    let playInEvent = state.events.find(event => event.type === "playin");

    if (!playInEvent && worlds?.status !== "completed") {
        playInEvent = createWorldsPlayInSeasonEvent(
            state,
            Number(worlds?.order || state.events.length + 1)
        );
        state.events.push(playInEvent);
        changed = true;
    }

    if (playInEvent) {
        const defaults = createWorldsPlayInSeasonEvent(
            state,
            Number(playInEvent.order || 0)
        );

        Object.keys(defaults).forEach(key => {
            if (playInEvent[key] === undefined || playInEvent[key] === null) {
                playInEvent[key] = defaults[key];
                changed = true;
            }
        });

        if (playInEvent.format !== "worldsPlayIn") {
            playInEvent.format = "worldsPlayIn";
            changed = true;
        }
    }

    const majorsComplete = areAllSplitMajorsComplete(state.events);

    if (majorsComplete) {
        if (
            !Array.isArray(state.lcq.regionRankings) ||
            state.lcq.regionRankings.length < requiredCount
        ) {
            state.lcq.regionRankings = rankRegionsByMajorPerformance(state);
            state.lcq.generatedAt = new Date().toISOString();
            changed = true;
        }

        state.lcq.regionRankings
            .slice(0, requiredCount)
            .forEach((ranking, index) => {
                const event = lcqEvents.find(item =>
                    Number(item.lcqSlot) === index + 1
                );

                if (!event || event.status === "completed") return;

                const regionChanged = event.region !== ranking.region;

                if (regionChanged) {
                    event.region = ranking.region;
                    event.name = `${ranking.region} Regional Worlds LCQ`;
                    event.regionPerformanceRank = index + 1;
                    event.majorPerformancePoints = ranking.majorPoints;
                    event.majorWins = ranking.majorWins;
                    event.bestMajorPlacement = ranking.bestMajorPlacement;
                    event.lcqSeedIds = [];
                    event.provisionalQualifierIds = [];
                    changed = true;
                }

                const seeds = getRegionalLcqSeedTeams(ranking.region, state);
                const nextIds = seeds.map(team => team.id);

                if (
                    JSON.stringify(event.lcqSeedIds || []) !==
                    JSON.stringify(nextIds)
                ) {
                    event.lcqSeedIds = nextIds;
                    event.provisionalQualifierIds = [];
                    changed = true;
                }
            });
    }

    if (playInEvent && playInEvent.status !== "completed") {
        const participantIds = getWorldsPlayInParticipants(state)
            .map(item => item.teamId);

        if (
            JSON.stringify(playInEvent.playInTeamIds || []) !==
            JSON.stringify(participantIds)
        ) {
            playInEvent.playInTeamIds = participantIds;
            changed = true;
        }
    }

    const nonFinalEvents = state.events
        .filter(event =>
            event.type !== "lcq" &&
            event.type !== "playin" &&
            event.type !== "worlds"
        )
        .sort((a, b) => Number(a.order) - Number(b.order));

    const orderedLcqs = state.events
        .filter(event => event.type === "lcq")
        .sort((a, b) => Number(a.lcqSlot) - Number(b.lcqSlot));

    const ordered = [
        ...nonFinalEvents,
        ...orderedLcqs,
        ...(playInEvent ? [playInEvent] : []),
        ...(worlds ? [worlds] : [])
    ];

    ordered.forEach((event, index) => {
        if (Number(event.order) !== index + 1) {
            event.order = index + 1;
            changed = true;
        }
    });

    state.events = ordered;
    return changed;
}

function rankRegionsByMajorPerformance(state = getSeasonState()) {
    const rankings = new Map(
        SEASON_REGIONS.map(region => [region, {
            region,
            majorPoints: 0,
            majorWins: 0,
            bestMajorPlacement: Infinity,
            seasonPoints: 0,
            topTeamPoints: 0
        }])
    );

    const history = getSeasonHistoryRecords().filter(record => {
        if (record.event?.type !== "major") return false;

        if (record.event?.seasonId) {
            return String(record.event.seasonId) === String(state?.id);
        }

        return state?.events?.some(event =>
            event.type === "major" &&
            String(event.id) === String(record.event?.seasonEventId)
        );
    });

    const savedTeams = typeof teams !== "undefined" && Array.isArray(teams)
        ? teams
        : [];

    history.forEach(record => {
        (record.placements || []).forEach(placement => {
            const team = savedTeams.find(item =>
                String(item.id) === String(placement.teamId)
            );
            const region = placement.region && placement.region !== "Unknown"
                ? placement.region
                : team?.region;

            if (!rankings.has(region)) return;

            const row = rankings.get(region);
            const awarded = (record.pointsAwarded || []).find(item =>
                String(item.teamId) === String(placement.teamId)
            );
            const points = awarded
                ? Number(awarded.points || 0)
                : typeof getEventPointsForPlacement === "function"
                    ? Number(getEventPointsForPlacement("major", placement.placement) || 0)
                    : 0;

            row.majorPoints += points;
            row.bestMajorPlacement = Math.min(
                row.bestMajorPlacement,
                Number(placement.placement || Infinity)
            );

            if (Number(placement.placement) === 1) {
                row.majorWins++;
            }
        });
    });

    const leagueState = typeof getLeagueState === "function"
        ? getLeagueState()
        : { teams: {} };

    savedTeams.forEach(team => {
        if (!rankings.has(team.region)) return;

        const points = Number(
            leagueState.teams?.[String(team.id)]?.totalPoints || 0
        );
        const row = rankings.get(team.region);
        row.seasonPoints += points;
        row.topTeamPoints = Math.max(row.topTeamPoints, points);
    });

    return [...rankings.values()]
        .map(row => ({
            ...row,
            bestMajorPlacement: Number.isFinite(row.bestMajorPlacement)
                ? row.bestMajorPlacement
                : 999
        }))
        .sort((a, b) =>
            b.majorPoints - a.majorPoints ||
            b.majorWins - a.majorWins ||
            a.bestMajorPlacement - b.bestMajorPlacement ||
            b.seasonPoints - a.seasonPoints ||
            b.topTeamPoints - a.topTeamPoints ||
            a.region.localeCompare(b.region)
        )
        .map((row, index) => ({
            ...row,
            rank: index + 1
        }));
}

function getRegionalLcqSeedTeams(region, state = getSeasonState()) {
    const excludedIds = new Set([
        ...getWorldsDirectQualifiers(state).map(item => String(item.teamId)),
        ...getWorldsFixedPlayInQualifiers(state).map(item => String(item.teamId))
    ]);

    return getSeasonRankedTeamsByRegion(region)
        .filter(team => !excludedIds.has(String(team.id)))
        .slice(
            0,
            Number(state?.lcq?.teamsPerRegion || 6)
        );
}

function getSeasonRankedTeamsByRegion(region) {
    const savedTeams = typeof teams !== "undefined" && Array.isArray(teams)
        ? teams.filter(team => team.region === region)
        : [];
    const leagueState = typeof getLeagueState === "function"
        ? getLeagueState()
        : { teams: {} };

    return [...savedTeams].sort((a, b) => {
        const aData = leagueState.teams?.[String(a.id)] || {};
        const bData = leagueState.teams?.[String(b.id)] || {};

        return (
            Number(bData.totalPoints || 0) - Number(aData.totalPoints || 0) ||
            (typeof compareCompletedLeagueTiebreaker === "function"
                ? compareCompletedLeagueTiebreaker(
                    { teamId: a.id },
                    { teamId: b.id }
                )
                : 0) ||
            Number(bData.lanPoints || 0) - Number(aData.lanPoints || 0) ||
            Number(b.rating || 0) - Number(a.rating || 0) ||
            String(a.name).localeCompare(String(b.name))
        );
    });
}

function createWorldsQualificationEntry(team, qualificationType, qualificationSeed, qualificationRegion) {
    if (!team) return null;

    const leagueState = typeof getLeagueState === "function"
        ? getLeagueState()
        : { teams: {} };
    const pointsData = leagueState.teams?.[String(team.id)] || {};

    return {
        teamId: team.id,
        teamName: team.name,
        logo: team.logo,
        region: team.region,
        rating: team.rating,
        totalPoints: Number(pointsData.totalPoints || 0),
        regionalPoints: Number(pointsData.regionalPoints || 0),
        lanPoints: Number(pointsData.lanPoints || 0),
        worldsPoints: Number(pointsData.worldsPoints || 0),
        eventsPlayed: Number(pointsData.eventsPlayed || 0),
        eventWins: Number(pointsData.eventWins || 0),
        qualificationRegion: qualificationRegion || team.region,
        qualificationSeed,
        qualificationType
    };
}

function getWorldsDirectQualifiers(state = getSeasonState()) {
    const result = [];

    const directSlots = typeof getCompetitionWorldsDirectSlots === "function"
        ? getCompetitionWorldsDirectSlots(state)
        : WORLDS_MAIN_AUTO_SLOTS;

    Object.entries(directSlots).forEach(([region, count]) => {
        getSeasonRankedTeamsByRegion(region)
            .slice(0, Number(count || 0))
            .forEach((team, index) => {
                const entry = createWorldsQualificationEntry(
                    team,
                    "Main Event Auto Qualification",
                    index + 1,
                    region
                );
                if (entry) result.push(entry);
            });
    });

    return result;
}

function getWorldsFixedPlayInQualifiers(state = getSeasonState()) {
    const result = [];

    const regionSlots = typeof getCompetitionWorldsPlayInRegionSlots === "function"
        ? getCompetitionWorldsPlayInRegionSlots(state)
        : WORLDS_PLAYIN_REGION_SLOTS;

    Object.entries(regionSlots)
        .forEach(([region, config]) => {
            getSeasonRankedTeamsByRegion(region)
                .slice(
                    Number(config.offset || 0),
                    Number(config.offset || 0) + Number(config.count || 0)
                )
                .forEach((team, index) => {
                    const entry = createWorldsQualificationEntry(
                        team,
                        "Regional Play-In Qualification",
                        Number(config.offset || 0) + index + 1,
                        region
                    );
                    if (entry) result.push(entry);
                });
        });

    return result;
}

function getRegionalLcqWinners(state = getSeasonState()) {
    if (!state) return [];

    const savedTeams = typeof teams !== "undefined" && Array.isArray(teams)
        ? teams
        : [];

    return state.events
        .filter(event => event.type === "lcq" && event.status === "completed")
        .sort((a, b) => Number(a.lcqSlot) - Number(b.lcqSlot))
        .map((event, index) => {
            const teamId = event.qualifiedTeamIds?.[0];
            const team = savedTeams.find(item =>
                String(item.id) === String(teamId)
            );

            return createWorldsQualificationEntry(
                team,
                `#${index + 1} Major Region LCQ Winner`,
                index + 1,
                event.region
            );
        })
        .filter(Boolean);
}

function getWorldsPlayInParticipants(state = getSeasonState()) {
    if (!state) return [];

    const combined = [
        ...getWorldsFixedPlayInQualifiers(state),
        ...getRegionalLcqWinners(state)
    ];
    const seen = new Set();

    return combined.filter(item => {
        const id = String(item.teamId);
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
    });
}

function getWorldsPlayInQualifiers(state = getSeasonState()) {
    if (!state) return [];

    const event = state.events.find(item => item.type === "playin");

    if (!event || event.status !== "completed") {
        return [];
    }

    const savedTeams = typeof teams !== "undefined" && Array.isArray(teams)
        ? teams
        : [];

    return (event.qualifiedTeamIds || [])
        .slice(0, Number(state.playIn?.spots || 4))
        .map((teamId, index) => {
            const team = savedTeams.find(item =>
                String(item.id) === String(teamId)
            );

            return createWorldsQualificationEntry(
                team,
                "Qualified via Worlds Play-In",
                index + 1,
                "Play-In"
            );
        })
        .filter(Boolean);
}

function getWorldsMainEventQualifiers(state = getSeasonState()) {
    const combined = [
        ...getWorldsDirectQualifiers(state),
        ...getWorldsPlayInQualifiers(state)
    ];
    const seen = new Set();

    return combined.filter(item => {
        const id = String(item.teamId);
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
    }).slice(
        0,
        Number(
            (typeof getCompetitionWorldsSettings === "function"
                ? getCompetitionWorldsSettings(state).mainEventSize
                : 16) || 16
        )
    );
}

function getRegionalLcqWorldsQualifiers() {
    return getWorldsMainEventQualifiers();
}

function applyLcqHistoryResultToSeasonEvent(event, record) {
    if (event?.type !== "lcq") return;

    const winner = (record.placements || [])
        .filter(item => Number(item.placement) === 1)
        .sort((a, b) => Number(a.placement) - Number(b.placement))[0];

    event.qualifiedTeamIds = winner ? [winner.teamId] : [];
    event.qualificationOutcomes = winner ? [{
        teamId: winner.teamId,
        teamName: winner.teamName,
        type: "lcq-winner"
    }] : [];
    event.champion = winner?.teamName || record.champion;
}

function applyPlayInHistoryResultToSeasonEvent(event, record) {
    if (event?.type !== "playin") return;

    const state = getSeasonState();
    const qualifyingSpots = Number(
        state?.playIn?.spots || 4
    );

    const qualifiers = (record.placements || [])
        .filter(item =>
            item.status === "qualified" ||
            Number(item.placement) <= qualifyingSpots
        )
        .sort((a, b) => Number(a.placement) - Number(b.placement))
        .slice(0, qualifyingSpots);

    event.qualifiedTeamIds = qualifiers.map(item => item.teamId);
    event.qualificationOutcomes = qualifiers.map((item, index) => ({
        teamId: item.teamId,
        teamName: item.teamName,
        type: "playin-qualified",
        seed: index + 1
    }));
    event.champion = qualifiers.map(item => item.teamName).join(" & ") || record.champion;
}

function createDefaultSeason() {
    const seasonName = document
        .getElementById("seasonName")
        ?.value
        .trim() || "Season 1";

    const splitCount = Math.max(
        1,
        Number(
            document.getElementById("seasonSplitCount")?.value || 1
        )
    );

    const regionalsPerSplit = Math.max(
        1,
        Number(
            document.getElementById("seasonRegionalsPerSplit")?.value || 3
        )
    );

    const selectedRegions = SEASON_REGIONS.filter(region => {
        const checkbox = document.getElementById(
            `seasonRegion${region}`
        );
        return checkbox ? checkbox.checked : true;
    });

    if (!selectedRegions.length) {
        alert("Select at least one region for the season.");
        return;
    }

    const existing = getSeasonState();

    if (
        existing &&
        !confirm(
            "Creating a new season will replace the current season calendar. Continue?"
        )
    ) {
        return;
    }

    let splitSettings = collectSeasonBuilderSettings();

    if (splitSettings.length !== splitCount) {
        renderSeasonSplitSettingsBuilder();
        splitSettings = collectSeasonBuilderSettings();
    }

    const seasonId = `season-${Date.now()}`;
    const state = {
        version: 5,
        id: seasonId,
        name: seasonName,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: "active",
        splitCount,
        regionalsPerSplit,
        regions: selectedRegions,
        rules: typeof getCompetitionRules === "function"
            ? getCompetitionRules()
            : null,
        splits: splitSettings,
        worlds: readWorldsBuilderSettings(),
        lcq: createDefaultRegionalLcqSettings(),
        playIn: createDefaultWorldsPlayInSettings(),
        tiebreakers: {},
        events: []
    };

    let order = 1;

    splitSettings.forEach(splitSettingsItem => {
        for (
            let regionalNumber = 1;
            regionalNumber <= regionalsPerSplit;
            regionalNumber++
        ) {
            selectedRegions.forEach(region => {
                state.events.push(
                    createSeasonEventRecord({
                        state,
                        order: order++,
                        split: splitSettingsItem.split,
                        splitEventNumber: String(regionalNumber),
                        type: "regional",
                        region,
                        name: `Split ${splitSettingsItem.split} - ${region} Regional ${regionalNumber}`,
                        settings: splitSettingsItem.regional
                    })
                );
            });
        }

        state.events.push(
            createSeasonEventRecord({
                state,
                order: order++,
                split: splitSettingsItem.split,
                splitEventNumber: String(regionalsPerSplit + 1),
                type: "major",
                region: "GLOBAL",
                name: `Split ${splitSettingsItem.split} - RLCS Major`,
                settings: splitSettingsItem.major
            })
        );
    });

    for (let lcqSlot = 1; lcqSlot <= state.lcq.regionCount; lcqSlot++) {
        state.events.push(
            createRegionalLcqSeasonEvent(
                state,
                order++,
                lcqSlot
            )
        );
    }

    state.events.push(
        createWorldsPlayInSeasonEvent(
            state,
            order++
        )
    );

    state.events.push(
        createSeasonEventRecord({
            state,
            order: order++,
            split: "season",
            splitEventNumber: "",
            type: "worlds",
            region: "GLOBAL",
            name: `${seasonName} World Championship`,
            settings: state.worlds
        })
    );

    saveSeasonState(state);
    clearCurrentSeasonEventId();
    renderSeasonCalendar();

    if (typeof renderSeasonManagementSummary === "function") {
        renderSeasonManagementSummary();
    }

    if (typeof updateDashboard === "function") {
        updateDashboard();
    }

    alert(
        `${seasonName} created with ${state.events.length} events, ${splitCount} split${splitCount === 1 ? "" : "s"}, and ${regionalsPerSplit} Regional${regionalsPerSplit === 1 ? "" : "s"} per split.`
    );
}

function createSeasonEventRecord({
    state,
    order,
    split,
    splitEventNumber,
    type,
    region,
    name,
    settings
}) {
    const safeRegion = region || "GLOBAL";
    const id = [
        state.id,
        split,
        type,
        safeRegion,
        splitEventNumber || "final"
    ].join("-");

    return {
        id,
        seasonId: state.id,
        seasonName: state.name,
        order,
        split: String(split),
        splitEventNumber: String(splitEventNumber || ""),
        name,
        type,
        region: safeRegion,
        format: settings.format,
        seriesLength: Number(settings.seriesLength || 5),
        swissSeriesLength: Number(
            settings.swissSeriesLength || settings.seriesLength || 5
        ),
        playoffSeriesLength: Number(
            settings.playoffSeriesLength || settings.seriesLength || 7
        ),
        status: "scheduled",
        champion: null,
        historyRecordId: null,
        completedAt: null,
        startedAt: null
    };
}

function clearSeasonCalendar() {
    if (!confirm("Clear the current season calendar?")) {
        return;
    }

    localStorage.removeItem(SEASON_KEY);
    clearCurrentSeasonEventId();
    renderSeasonCalendar();
}

/* ==========================
   SEASON POINT TIEBREAKERS
========================== */

function getSeasonTiebreakerContext(event) {
    return {
        eventId: String(event?.id || ""),
        seasonEventId: String(event?.id || ""),
        type: String(event?.type || "custom"),
        split: String(event?.split || "1"),
        format: String(event?.format || "roundRobin")
    };
}

function canSeasonEventUsePointTiebreakers(event) {
    return Boolean(
        event &&
        ["regional", "major", "worlds"].includes(event.type)
    );
}

function hasSeasonPointsBeforeEvent(event, state = getSeasonState()) {
    if (!event || !state) return false;

    const eventOrder = Number(event.order || Infinity);

    if (event.type === "regional") {
        return state.events.some(item =>
            item.status === "completed" &&
            item.type === "regional" &&
            String(item.split) === String(event.split) &&
            String(item.region) === String(event.region) &&
            Number(item.order || 0) < eventOrder
        );
    }

    if (event.type === "major") {
        return state.events.some(item =>
            item.status === "completed" &&
            ["regional", "major"].includes(item.type) &&
            String(item.split) === String(event.split) &&
            Number(item.order || 0) < eventOrder
        );
    }

    if (event.type === "worlds") {
        return state.events.some(item =>
            item.status === "completed" &&
            ["regional", "major"].includes(item.type) &&
            Number(item.order || 0) < eventOrder
        );
    }

    return false;
}

function getSeasonTiebreakerPoints(team, event) {
    if (
        typeof getAutomaticSeedingMetrics === "function"
    ) {
        return Number(
            getAutomaticSeedingMetrics(
                team,
                getSeasonTiebreakerContext(event)
            ).points || 0
        );
    }

    const leagueState = typeof getLeagueState === "function"
        ? getLeagueState()
        : { teams: {} };

    const entry = leagueState.teams?.[String(team?.id)] || {};

    if (event.type === "worlds") {
        return Number(entry.totalPoints || 0);
    }

    return Number(
        entry.splits?.[String(event.split)]?.totalPoints || 0
    );
}

function getSeasonTiebreakerParticipants(event) {
    if (!event) return [];

    const savedTeams = typeof teams !== "undefined" && Array.isArray(teams)
        ? [...teams]
        : [];

    if (event.type === "regional") {
        return normaliseParticipantsForSeasonFormat(
            savedTeams.filter(team => team.region === event.region),
            event.format
        );
    }

    return getSeasonEventParticipants(event);
}

function getSeasonTiebreakerRegion(team, event) {
    const region = String(
        team?.region ||
        event?.region ||
        "Unknown"
    ).trim().toUpperCase();

    return region || "UNKNOWN";
}

function createSeasonTiebreakerSignature(event, region, points, teamIds) {
    const raw = [
        event?.id || "event",
        event?.type || "custom",
        event?.split || "1",
        region || "UNKNOWN",
        points,
        [...teamIds].map(String).sort().join("-")
    ].join("|");

    let hash = 0;

    for (let index = 0; index < raw.length; index++) {
        hash = ((hash << 5) - hash) + raw.charCodeAt(index);
        hash |= 0;
    }

    return `tb-${Math.abs(hash)}`;
}

function getSavedSeasonTiebreakerRecord(state, eventId, signature) {
    return state?.tiebreakers?.[String(eventId)]?.groups?.[signature] || null;
}

function getSeasonTiebreakerGroupsForEvent(event, state = getSeasonState()) {
    if (
        !event ||
        !state ||
        !canSeasonEventUsePointTiebreakers(event)
    ) {
        return [];
    }

    const savedEventTiebreakers = state.tiebreakers?.[String(event.id)];

    if (
        event.status === "completed" &&
        Number(savedEventTiebreakers?.version || 0) >= SEASON_TIEBREAKER_VERSION &&
        savedEventTiebreakers?.groups
    ) {
        return Object.values(savedEventTiebreakers.groups)
            .map(record => hydrateSeasonTiebreakerRecord(record))
            .sort((a, b) =>
                String(a.region || "").localeCompare(String(b.region || "")) ||
                Number(b.points) - Number(a.points)
            );
    }

    if (!hasSeasonPointsBeforeEvent(event, state)) {
        return [];
    }

    const participants = getSeasonTiebreakerParticipants(event);
    const grouped = new Map();

    participants.forEach(team => {
        const points = getSeasonTiebreakerPoints(team, event);
        const region = getSeasonTiebreakerRegion(team, event);
        const key = `${region}|${points}`;

        if (!grouped.has(key)) {
            grouped.set(key, {
                region,
                points: Number(points),
                teams: []
            });
        }

        grouped.get(key).teams.push(team);
    });

    return [...grouped.values()]
        .filter(group => group.teams.length > 1)
        .map(group => {
            const tiedTeams = group.teams;
            const teamIds = tiedTeams.map(team => String(team.id));
            const signature = createSeasonTiebreakerSignature(
                event,
                group.region,
                group.points,
                teamIds
            );

            const saved = getSavedSeasonTiebreakerRecord(
                state,
                event.id,
                signature
            );

            return {
                signature,
                eventId: String(event.id),
                region: group.region,
                points: group.points,
                teamIds,
                teams: tiedTeams,
                status: saved?.status || "pending",
                ranking: Array.isArray(saved?.ranking)
                    ? saved.ranking.map(String)
                    : [],
                matches: Array.isArray(saved?.matches)
                    ? saved.matches
                    : [],
                format: saved?.format || (
                    tiedTeams.length === 2
                        ? "BO7 Tiebreaker Match"
                        : `${tiedTeams.length}-Team BO5 Tiebreaker Tournament`
                ),
                completedAt: saved?.completedAt || null
            };
        })
        .sort((a, b) =>
            String(a.region).localeCompare(String(b.region)) ||
            b.points - a.points
        );
}

function hydrateSeasonTiebreakerRecord(record) {
    const savedTeams = typeof teams !== "undefined" && Array.isArray(teams)
        ? teams
        : [];

    const hydratedTeams = (record.teamIds || [])
        .map(teamId => savedTeams.find(team =>
            String(team.id) === String(teamId)
        ))
        .filter(Boolean);

    return {
        ...record,
        region: String(
            record.region ||
            hydratedTeams[0]?.region ||
            "UNKNOWN"
        ).toUpperCase(),
        teamIds: Array.isArray(record.teamIds)
            ? record.teamIds.map(String)
            : [],
        teams: hydratedTeams,
        ranking: Array.isArray(record.ranking)
            ? record.ranking.map(String)
            : [],
        matches: Array.isArray(record.matches)
            ? record.matches
            : []
    };
}

function getUnresolvedSeasonTiebreakerGroups(eventOrId, state = getSeasonState()) {
    if (!state) return [];

    const event = typeof eventOrId === "object"
        ? eventOrId
        : state.events.find(item =>
            String(item.id) === String(eventOrId)
        );

    return getSeasonTiebreakerGroupsForEvent(event, state)
        .filter(group => group.status !== "completed");
}

function hasUnresolvedSeasonTiebreakersForEvent(eventOrId, state = getSeasonState()) {
    return getUnresolvedSeasonTiebreakerGroups(
        eventOrId,
        state
    ).length > 0;
}

function getSeasonTiebreakerRankMapForTeams(teamList, context = {}) {
    if (!Array.isArray(teamList) || teamList.length === 0) {
        return {};
    }

    const state = getSeasonState();

    if (!state) return {};

    const eventId =
        context.eventId ||
        context.seasonEventId ||
        getCurrentSeasonEventId();

    const event = state.events.find(item =>
        String(item.id) === String(eventId)
    );

    if (!event) return {};

    const teamIdSet = new Set(
        teamList.map(team => String(team.id))
    );

    const rankMap = {};

    getSeasonTiebreakerGroupsForEvent(event, state)
        .filter(group => group.status === "completed")
        .forEach(group => {
            group.ranking.forEach((teamId, index) => {
                if (teamIdSet.has(String(teamId))) {
                    rankMap[String(teamId)] = index;
                }
            });
        });

    return rankMap;
}

function simulateSeasonTiebreakerSeries(teamA, teamB, seriesLength) {
    const gamesNeeded = Math.ceil(Number(seriesLength || 7) / 2);
    let scoreA = 0;
    let scoreB = 0;

    while (scoreA < gamesNeeded && scoreB < gamesNeeded) {
        const probability = typeof getTournamentWinProbability === "function"
            ? getTournamentWinProbability(
                Number(teamA.rating || 50),
                Number(teamB.rating || 50)
            )
            : Number(teamA.rating || 50) /
                Math.max(
                    1,
                    Number(teamA.rating || 50) + Number(teamB.rating || 50)
                );

        if (Math.random() < probability) {
            scoreA++;
        } else {
            scoreB++;
        }
    }

    const winner = scoreA > scoreB ? teamA : teamB;

    return {
        teamAId: String(teamA.id),
        teamBId: String(teamB.id),
        teamAName: teamA.name,
        teamBName: teamB.name,
        scoreA,
        scoreB,
        winnerId: String(winner.id),
        winner: winner.name,
        seriesLength: Number(seriesLength || 7)
    };
}

function resolveSeasonTiebreakerExactTie(teamList, matches) {
    if (teamList.length <= 1) {
        return [...teamList];
    }

    const ordered = [teamList[0]];

    for (let index = 1; index < teamList.length; index++) {
        const challenger = teamList[index];
        let insertAt = ordered.length;

        for (let position = ordered.length - 1; position >= 0; position--) {
            const opponent = ordered[position];
            const result = simulateSeasonTiebreakerSeries(
                challenger,
                opponent,
                SEASON_TIEBREAKER_MATCH_SERIES
            );

            matches.push({
                ...result,
                stage: "Placement Tiebreaker"
            });

            if (String(result.winnerId) === String(challenger.id)) {
                insertAt = position;
            } else {
                break;
            }
        }

        ordered.splice(insertAt, 0, challenger);
    }

    return ordered;
}

function runSeasonTiebreakerTournament(group) {
    const tiedTeams = [...group.teams];
    const matches = [];

    if (tiedTeams.length === 2) {
        const result = simulateSeasonTiebreakerSeries(
            tiedTeams[0],
            tiedTeams[1],
            SEASON_TIEBREAKER_MATCH_SERIES
        );

        matches.push({
            ...result,
            stage: "Tiebreaker Match"
        });

        const winner = tiedTeams.find(team =>
            String(team.id) === String(result.winnerId)
        );
        const loser = tiedTeams.find(team =>
            String(team.id) !== String(result.winnerId)
        );

        return {
            ranking: [winner, loser].filter(Boolean),
            matches,
            format: "BO7 Tiebreaker Match"
        };
    }

    const standings = new Map(
        tiedTeams.map(team => [String(team.id), {
            team,
            wins: 0,
            losses: 0,
            gameWins: 0,
            gameLosses: 0
        }])
    );

    for (let first = 0; first < tiedTeams.length; first++) {
        for (let second = first + 1; second < tiedTeams.length; second++) {
            const result = simulateSeasonTiebreakerSeries(
                tiedTeams[first],
                tiedTeams[second],
                SEASON_TIEBREAKER_TOURNAMENT_SERIES
            );

            matches.push({
                ...result,
                stage: "Round Robin"
            });

            const rowA = standings.get(String(result.teamAId));
            const rowB = standings.get(String(result.teamBId));

            rowA.gameWins += result.scoreA;
            rowA.gameLosses += result.scoreB;
            rowB.gameWins += result.scoreB;
            rowB.gameLosses += result.scoreA;

            if (String(result.winnerId) === String(result.teamAId)) {
                rowA.wins++;
                rowB.losses++;
            } else {
                rowB.wins++;
                rowA.losses++;
            }
        }
    }

    const rows = [...standings.values()].sort((a, b) =>
        b.wins - a.wins ||
        (b.gameWins - b.gameLosses) - (a.gameWins - a.gameLosses)
    );

    const finalRanking = [];
    let cursor = 0;

    while (cursor < rows.length) {
        const row = rows[cursor];
        const gameDifference = row.gameWins - row.gameLosses;
        const exactTie = [];

        while (
            cursor < rows.length &&
            rows[cursor].wins === row.wins &&
            (rows[cursor].gameWins - rows[cursor].gameLosses) === gameDifference
        ) {
            exactTie.push(rows[cursor].team);
            cursor++;
        }

        finalRanking.push(
            ...resolveSeasonTiebreakerExactTie(
                exactTie,
                matches
            )
        );
    }

    return {
        ranking: finalRanking,
        matches,
        format: `${tiedTeams.length}-Team BO5 Round Robin`
    };
}

function runSeasonTiebreaker(eventId, signature) {
    if (typeof tournament !== "undefined" && tournament.running) {
        alert("Finish the active event before running a season tiebreaker.");
        return;
    }

    const state = getSeasonState();

    if (!state) return;

    const event = state.events.find(item =>
        String(item.id) === String(eventId)
    );

    if (!event) {
        alert("Season event not found.");
        return;
    }

    const group = getSeasonTiebreakerGroupsForEvent(event, state)
        .find(item => item.signature === signature);

    if (!group) {
        alert("This points tie is no longer active.");
        renderSeasonCalendar();
        return;
    }

    const result = runSeasonTiebreakerTournament(group);

    if (!state.tiebreakers || typeof state.tiebreakers !== "object") {
        state.tiebreakers = {};
    }

    if (
        !state.tiebreakers[String(event.id)] ||
        Number(state.tiebreakers[String(event.id)].version || 0) < SEASON_TIEBREAKER_VERSION
    ) {
        state.tiebreakers[String(event.id)] = {
            version: SEASON_TIEBREAKER_VERSION,
            eventId: String(event.id),
            eventName: event.name,
            groups: {}
        };
    }

    state.tiebreakers[String(event.id)].groups[signature] = {
        signature,
        eventId: String(event.id),
        eventName: event.name,
        region: group.region,
        points: group.points,
        teamIds: group.teamIds.map(String),
        status: "completed",
        ranking: result.ranking.map(team => String(team.id)),
        matches: result.matches,
        format: result.format,
        completedAt: new Date().toISOString()
    };

    saveSeasonState(state);
    focusedSeasonTiebreakerEventId = String(event.id);

    if (
        typeof tournament !== "undefined" &&
        String(tournament.currentEvent?.seasonEventId || "") === String(event.id)
    ) {
        tournament.manualSeedingOverride = false;

        if (typeof syncSeedings === "function") {
            syncSeedings(true);
        }

        if (typeof renderSeedings === "function") {
            renderSeedings();
        }

        if (typeof updateEventPreview === "function") {
            updateEventPreview();
        }
    }

    renderSeasonCalendar();

    const winnerName = result.ranking[0]?.name || "Unknown";
    alert(`${winnerName} won the ${group.region} ${group.format}. The regional tie is now resolved.`);
}

function runAllSeasonTiebreakers(eventId) {
    const state = getSeasonState();

    if (!state) return;

    const event = state.events.find(item =>
        String(item.id) === String(eventId)
    );

    if (!event) return;

    const pending = getUnresolvedSeasonTiebreakerGroups(event, state);

    if (pending.length === 0) {
        alert("No unresolved points ties remain for this event.");
        return;
    }

    pending.forEach(group => {
        const latestState = getSeasonState();
        const latestEvent = latestState.events.find(item =>
            String(item.id) === String(event.id)
        );
        const latestGroup = getSeasonTiebreakerGroupsForEvent(
            latestEvent,
            latestState
        ).find(item => item.signature === group.signature);

        if (!latestGroup || latestGroup.status === "completed") return;

        const result = runSeasonTiebreakerTournament(latestGroup);

        if (
            !latestState.tiebreakers[String(event.id)] ||
            Number(latestState.tiebreakers[String(event.id)].version || 0) < SEASON_TIEBREAKER_VERSION
        ) {
            latestState.tiebreakers[String(event.id)] = {
                version: SEASON_TIEBREAKER_VERSION,
                eventId: String(event.id),
                eventName: event.name,
                groups: {}
            };
        }

        latestState.tiebreakers[String(event.id)].groups[group.signature] = {
            signature: group.signature,
            eventId: String(event.id),
            eventName: event.name,
            region: latestGroup.region,
            points: latestGroup.points,
            teamIds: latestGroup.teamIds.map(String),
            status: "completed",
            ranking: result.ranking.map(team => String(team.id)),
            matches: result.matches,
            format: result.format,
            completedAt: new Date().toISOString()
        };

        saveSeasonState(latestState);
    });

    focusedSeasonTiebreakerEventId = String(event.id);
    renderSeasonCalendar();

    if (
        typeof tournament !== "undefined" &&
        String(tournament.currentEvent?.seasonEventId || "") === String(event.id)
    ) {
        tournament.manualSeedingOverride = false;
        syncSeedings(true);
        renderSeedings();
    }

    alert("Every points tie for this event has been resolved.");
}

function focusSeasonTiebreaker(eventId) {
    focusedSeasonTiebreakerEventId = String(eventId || "");
    renderSeasonCalendar();

    setTimeout(() => {
        document.getElementById("seasonTiebreakerHub")
            ?.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });
    }, 50);
}

function renderSeasonTiebreakerHub(state, nextEvent) {
    const focusedEvent = state.events.find(event =>
        String(event.id) === String(focusedSeasonTiebreakerEventId)
    );

    const event = focusedEvent || nextEvent;

    if (!event || !canSeasonEventUsePointTiebreakers(event)) {
        return "";
    }

    const groups = getSeasonTiebreakerGroupsForEvent(event, state);
    const unresolved = groups.filter(group => group.status !== "completed");
    const savedEventIds = Object.keys(state.tiebreakers || {});
    const optionIds = new Set([
        String(event.id),
        ...savedEventIds
    ]);

    const optionEvents = state.events.filter(item =>
        optionIds.has(String(item.id))
    );

    return `
        <div id="seasonTiebreakerHub" class="season-tiebreaker-hub">
            <div class="season-tiebreaker-header">
                <div>
                    <span class="season-tiebreaker-kicker">Points Tiebreakers</span>
                    <h3>${escapeSeasonText(event.name)}</h3>
                    <p>
                        Teams level on points are separated inside their own region.
                        EU teams only face EU teams, NA teams only face NA teams, and so on.
                    </p>
                </div>

                ${optionEvents.length > 1 ? `
                    <label class="season-tiebreaker-event-picker">
                        <span>View event</span>
                        <select onchange="focusSeasonTiebreaker(this.value)">
                            ${optionEvents.map(option => `
                                <option value="${escapeSeasonText(option.id)}"
                                    ${String(option.id) === String(event.id) ? "selected" : ""}>
                                    ${escapeSeasonText(option.name)}
                                </option>
                            `).join("")}
                        </select>
                    </label>
                ` : ""}
            </div>

            ${groups.length === 0 ? `
                <div class="season-tiebreaker-clear">
                    <strong>No tiebreaker required</strong>
                    <span>
                        ${hasSeasonPointsBeforeEvent(event, state)
                            ? "There are no equal-points groups within the same region in this event field."
                            : "This is the first points event for these teams, so initial seeding uses team rating."}
                    </span>
                </div>
            ` : `
                <div class="season-tiebreaker-summary">
                    <span>${groups.length} tied points group${groups.length === 1 ? "" : "s"}</span>
                    <span>${unresolved.length} unresolved</span>

                    <button class="primary-button"
                        onclick="runAllSeasonTiebreakers('${escapeSeasonText(event.id)}')"
                        ${unresolved.length === 0 ? "disabled" : ""}>
                        Run All Required Tiebreakers
                    </button>
                </div>

                <div class="season-tiebreaker-grid">
                    ${groups.map(group => renderSeasonTiebreakerGroup(event, group)).join("")}
                </div>
            `}
        </div>
    `;
}

function renderSeasonTiebreakerGroup(event, group) {
    const completed = group.status === "completed";
    const teamLookup = new Map(
        group.teams.map(team => [String(team.id), team])
    );

    return `
        <div class="season-tiebreaker-card ${completed ? "completed" : "pending"}">
            <div class="season-tiebreaker-card-heading">
                <div>
                    <span>${escapeSeasonText(group.region || event.region || "Region")} • ${group.points} ${event.type === "worlds" ? "Season" : `Split ${event.split}`} Points</span>
                    <strong>${escapeSeasonText(group.format)}</strong>
                </div>

                <span class="season-tiebreaker-state">
                    ${completed ? "Resolved" : "Required"}
                </span>
            </div>

            <div class="season-tiebreaker-team-list">
                ${(completed ? group.ranking : group.teamIds).map((teamId, index) => {
                    const team = teamLookup.get(String(teamId));

                    return `
                        <div class="season-tiebreaker-team-row">
                            <span>#${index + 1}</span>
                            ${team?.logo
                                ? `<img src="${team.logo}" class="season-tiebreaker-logo">`
                                : `<div class="season-tiebreaker-logo"></div>`}
                            <strong>${escapeSeasonText(team?.name || "Unknown Team")}</strong>
                            <small>Rating ${Number(team?.rating || 0)}</small>
                        </div>
                    `;
                }).join("")}
            </div>

            ${completed ? `
                <details class="season-tiebreaker-results">
                    <summary>View ${group.matches.length} tiebreaker match${group.matches.length === 1 ? "" : "es"}</summary>
                    <div>
                        ${group.matches.map(match => `
                            <div class="season-tiebreaker-match-row">
                                <span>${escapeSeasonText(match.stage || "Tiebreaker")}</span>
                                <strong>
                                    ${escapeSeasonText(match.teamAName)}
                                    ${match.scoreA} - ${match.scoreB}
                                    ${escapeSeasonText(match.teamBName)}
                                </strong>
                            </div>
                        `).join("")}
                    </div>
                </details>
            ` : `
                <button class="primary-button"
                    onclick="runSeasonTiebreaker('${escapeSeasonText(event.id)}', '${group.signature}')">
                    ${group.teams.length === 2
                        ? "Play BO7 Tiebreaker"
                        : "Run BO5 Tiebreaker Tournament"}
                </button>
            `}
        </div>
    `;
}

/* ==========================
   LOCKING + PROGRESS
========================== */

function isSeasonEventLocked(event, state = getSeasonState()) {
    if (!event || !state) return false;

    if (event.status === "completed") {
        return false;
    }

    if (event.type === "major") {
        return !areSplitRegionalsComplete(
            state.events,
            event.split
        );
    }

    if (event.type === "lcq") {
        return (
            !areAllSplitMajorsComplete(state.events) ||
            event.region === "TBD" ||
            !Array.isArray(event.lcqSeedIds) ||
            event.lcqSeedIds.length < 6
        );
    }

    if (event.type === "playin") {
        return (
            !areAllRegionalLcqsComplete(state.events) ||
            getWorldsPlayInParticipants(state).length < 8
        );
    }

    if (event.type === "worlds") {
        return (
            !areWorldsPlayInComplete(state.events) ||
            getWorldsMainEventQualifiers(state).length < 16
        );
    }

    return false;
}

function areSplitRegionalsComplete(events, split) {
    const regionals = events.filter(event =>
        String(event.split) === String(split) &&
        event.type === "regional"
    );

    return (
        regionals.length > 0 &&
        regionals.every(event => event.status === "completed")
    );
}

function areAllSplitMajorsComplete(events) {
    const majors = events.filter(event =>
        event.type === "major"
    );

    return (
        majors.length > 0 &&
        majors.every(event => event.status === "completed")
    );
}

function areAllRegionalLcqsComplete(events) {
    const lcqs = events.filter(event => event.type === "lcq");

    return (
        lcqs.length >= 4 &&
        lcqs.every(event => event.status === "completed")
    );
}

function areWorldsPlayInComplete(events) {
    const playIn = events.find(event => event.type === "playin");
    return Boolean(playIn && playIn.status === "completed");
}

function getSeasonEventDisplayStatus(event, state) {
    if (event.status === "completed") {
        return "completed";
    }

    if (
        String(getCurrentSeasonEventId()) === String(event.id)
    ) {
        return event.status === "in_progress"
            ? "in_progress"
            : "loaded";
    }

    if (isSeasonEventLocked(event, state)) {
        return "locked";
    }

    return "scheduled";
}

function getCompletedSeasonCount(events) {
    return events.filter(event =>
        event.status === "completed"
    ).length;
}

function getNextAvailableSeasonEvent(state) {
    if (!state) return null;

    return [...state.events]
        .sort((a, b) => Number(a.order) - Number(b.order))
        .find(event =>
            event.status !== "completed" &&
            !isSeasonEventLocked(event, state)
        ) || null;
}

function getSeasonCurrentSplit() {
    const state = getSeasonState();

    if (!state) return "Off-season";

    const nextEvent = getNextAvailableSeasonEvent(state);

    if (!nextEvent) return "Season Complete";

    if (nextEvent.type === "lcq") {
        return "Regional Worlds LCQs";
    }

    if (nextEvent.type === "playin") {
        return "Worlds Play-In";
    }

    return nextEvent.split === "season"
        ? "Season Finals"
        : `Split ${nextEvent.split}`;
}

/* ==========================
   RENDER SEASON
========================== */

function renderSeasonCalendar() {
    syncSeasonCalendarFromHistory();

    if (typeof renderSeasonManagementSummary === "function") {
        renderSeasonManagementSummary();
    }

    if (typeof renderSeasonArchiveHub === "function") {
        renderSeasonArchiveHub();
    }

    const container = document.getElementById(
        "seasonCalendar"
    );

    if (!container) return;

    const state = getSeasonState();

    if (!state || state.events.length === 0) {
        container.innerHTML = `
            <p class="small">
                No season created yet. Configure each split above and create a season.
            </p>
        `;
        return;
    }

    const completed = getCompletedSeasonCount(state.events);
    const nextEvent = getNextAvailableSeasonEvent(state);
    const progress = Math.round(
        (completed / state.events.length) * 100
    );

    const nextEventTiebreakers = nextEvent
        ? getUnresolvedSeasonTiebreakerGroups(nextEvent, state)
        : [];

    container.innerHTML = `
        <div class="season-overview-card season-overview-v2">
            <div>
                <span>Current Season</span>
                <strong>${escapeSeasonText(state.name)}</strong>
            </div>

            <div>
                <span>Progress</span>
                <strong>${completed} / ${state.events.length}</strong>
            </div>

            <div>
                <span>Current Stage</span>
                <strong>${escapeSeasonText(getSeasonCurrentSplit())}</strong>
            </div>

            <div class="season-overview-actions">
                <button class="primary-button"
                    onclick="${nextEventTiebreakers.length > 0
                        ? `focusSeasonTiebreaker('${nextEvent?.id || ""}')`
                        : "loadNextSeasonEvent()"}"
                    ${nextEvent ? "" : "disabled"}>
                    ${nextEvent
                        ? nextEventTiebreakers.length > 0
                            ? "Resolve Next Tiebreaker"
                            : "Load Next Event"
                        : "Season Complete"}
                </button>

                <button class="secondary-button"
                    onclick="repairSeasonProgressFromHistory()">
                    Repair Progress
                </button>
            </div>
        </div>

        <div class="season-progress-track">
            <div class="season-progress-fill"
                style="width:${progress}%"></div>
        </div>

        ${state.splits.map(splitSettings =>
            renderSeasonSplitBlock(state, splitSettings)
        ).join("")}

        ${renderSeasonFinalsBlock(state)}
    `;

    renderSeasonTiebreakerTab(state, nextEvent);
    applySeasonCalendarFilters();

    if (typeof renderSeasonQualificationSnapshot === "function") {
        renderSeasonQualificationSnapshot();
    }
}

function renderSeasonSplitBlock(state, splitSettings) {
    const split = String(splitSettings.split);
    const splitEvents = state.events
        .filter(event => String(event.split) === split)
        .sort((a, b) => Number(a.order) - Number(b.order));

    const completed = getCompletedSeasonCount(splitEvents);

    return `
        <div class="season-split-block">
            <div class="season-split-header">
                <div>
                    <h3>Split ${escapeSeasonText(split)}</h3>
                    <p>
                        ${completed} / ${splitEvents.length} events completed
                    </p>
                </div>

                <div class="season-split-summary">
                    <span>
                        Regionals: ${formatSeasonFormat(splitSettings.regional.format)}
                    </span>
                    <span>
                        Major: ${formatSeasonFormat(splitSettings.major.format)}
                    </span>
                </div>
            </div>

            ${renderExistingSplitFormatEditor(splitSettings)}

            <div class="season-calendar-list">
                ${splitEvents.map((event, index) =>
                    renderSeasonEventCard(event, index, state)
                ).join("")}
            </div>
        </div>
    `;
}

function renderExistingSplitFormatEditor(splitSettings) {
    const split = String(splitSettings.split);

    return `
        <details class="season-inline-editor">
            <summary>Change Split ${escapeSeasonText(split)} Formats</summary>

            <div class="season-format-builder-grid">
                ${renderSeasonBuilderEventControls(
                    `activeSplit${split}Regional`,
                    "Remaining Regional Events",
                    splitSettings.regional
                )}

                ${renderSeasonBuilderEventControls(
                    `activeSplit${split}Major`,
                    "Major",
                    splitSettings.major
                )}
            </div>

            <button class="primary-button"
                onclick="saveExistingSplitSettings('${split}')">
                Save Split ${escapeSeasonText(split)} Formats
            </button>

            <p class="small">
                Completed events keep their original format. Changes apply only to unplayed events.
            </p>
        </details>
    `;
}

function renderSeasonFinalsBlock(state) {
    const worldsEvent = state.events.find(event =>
        event.type === "worlds"
    );
    const playInEvent = state.events.find(event =>
        event.type === "playin"
    );
    const lcqEvents = state.events
        .filter(event => event.type === "lcq")
        .sort((a, b) => Number(a.lcqSlot) - Number(b.lcqSlot));

    if (!worldsEvent) return "";

    const rankings = state.lcq?.regionRankings || [];
    const majorsComplete = areAllSplitMajorsComplete(state.events);

    return `
        <div class="season-split-block season-lcq-block">
            <div class="season-split-header">
                <div>
                    <h3>Regional Last Chance Qualifiers</h3>
                    <p>
                        The four best Major-performing regions receive an LCQ.
                        Six non-qualified teams compete for one Worlds Play-In place.
                    </p>
                </div>

                <div class="season-split-summary">
                    <span>${majorsComplete ? "Top 4 regions confirmed" : "Locked until all Majors finish"}</span>
                    <span>6 teams | 1 Play-In spot</span>
                </div>
            </div>

            ${rankings.length > 0 ? `
                <div class="lcq-region-ranking-grid">
                    ${rankings.slice(0, 4).map(ranking => `
                        <div class="lcq-region-ranking-card">
                            <span>#${ranking.rank} Region</span>
                            <strong>${escapeSeasonText(ranking.region)}</strong>
                            <small>
                                ${ranking.majorPoints} Major pts
                                | ${ranking.majorWins} Major win${ranking.majorWins === 1 ? "" : "s"}
                                | Best #${ranking.bestMajorPlacement === 999 ? "-" : ranking.bestMajorPlacement}
                            </small>
                        </div>
                    `).join("")}
                </div>
            ` : `
                <p class="small season-lcq-waiting">
                    Region rankings will be generated automatically after the final Major.
                </p>
            `}

            <div class="season-calendar-list">
                ${lcqEvents.map((event, index) =>
                    renderSeasonEventCard(event, index, state)
                ).join("")}
            </div>
        </div>

        <div class="season-split-block season-playin-block">
            <div class="season-split-header">
                <div>
                    <h3>Worlds Play-In</h3>
                    <p>
                        OCE #1, SAM #2, SSA #1, APAC #1 and the four Regional LCQ winners
                        play an eight-team qualification bracket. Four teams advance.
                    </p>
                </div>

                <div class="season-split-summary">
                    <span>8 teams</span>
                    <span>4 Main Event spots</span>
                </div>
            </div>

            <div class="season-calendar-list">
                ${playInEvent ? renderSeasonEventCard(playInEvent, 0, state) : ""}
            </div>
        </div>

        <div class="season-split-block season-finals-block">
            <div class="season-split-header">
                <div>
                    <h3>World Championship Main Event</h3>
                    <p>
                        Twelve teams auto-qualify: NA 1–4, EU 1–5, SAM 1 and MENA 1–2.
                        The four Worlds Play-In qualifiers complete the 16-team field.
                    </p>
                </div>

                <div class="season-split-summary">
                    <span>${formatSeasonFormat(worldsEvent.format)}</span>
                    <span>16 teams | BO${worldsEvent.seriesLength}</span>
                </div>
            </div>

            <div class="season-calendar-list">
                ${renderSeasonEventCard(worldsEvent, 0, state)}
            </div>
        </div>
    `;
}

function renderSeasonEventCard(event, index, state) {
    const displayStatus = getSeasonEventDisplayStatus(
        event,
        state
    );

    const completed = displayStatus === "completed";
    const structurallyLocked = displayStatus === "locked";
    const unresolvedTiebreakers = (
        !completed &&
        !structurallyLocked
    )
        ? getUnresolvedSeasonTiebreakerGroups(event, state)
        : [];
    const tiebreakerRequired = unresolvedTiebreakers.length > 0;
    const locked = structurallyLocked || tiebreakerRequired;
    const effectiveStatus = tiebreakerRequired
        ? "tiebreaker"
        : displayStatus;

    const stagedFormats = [
        "swissPlayoffs",
        "groupsHybrid",
        "groupsDoubleElim"
    ];

    const openingName = event.format === "swissPlayoffs"
        ? "Swiss"
        : "Groups";

    const seriesText = stagedFormats.includes(event.format)
        ? `${openingName} BO${event.swissSeriesLength} | Playoffs BO${event.playoffSeriesLength}`
        : `BO${event.seriesLength}`;

    return `
        <div class="season-event-card season-event-${effectiveStatus}"
            data-season-status="${effectiveStatus}"
            data-season-split="${escapeSeasonText(event.split || "season")}"
            data-season-type="${escapeSeasonText(event.type || "custom")}">
            <div class="season-event-number">
                ${index + 1}
            </div>

            <div class="season-event-main">
                <strong>${escapeSeasonText(event.name)}</strong>

                <span>
                    ${formatSeasonEventType(event.type)}
                    |
                    ${event.region === "GLOBAL"
                        ? "Global"
                        : escapeSeasonText(event.region)}
                    |
                    ${formatSeasonFormat(event.format)}
                    |
                    ${seriesText}
                </span>

                ${structurallyLocked ? `<span class="season-event-lock-reason">${escapeSeasonText(getSeasonEventLockReason(event, state))}</span>` : ""}

                ${event.champion ? `
                    <span class="season-event-champion">
                        ${event.type === "lcq"
                            ? "Play-In Qualified"
                            : event.type === "playin"
                            ? "Main Event Qualified"
                            : "Champion"}:
                        ${escapeSeasonText(event.champion)}
                    </span>
                ` : ""}
            </div>

            <div class="season-status-badge season-status-${effectiveStatus}">
                ${formatSeasonStatus(effectiveStatus)}
            </div>

            <button class="primary-button"
                onclick="${completed
                    ? `viewSeasonEventResult('${event.id}')`
                    : tiebreakerRequired
                    ? `focusSeasonTiebreaker('${event.id}')`
                    : `loadSeasonEvent('${event.id}')`}"
                ${structurallyLocked ? "disabled" : ""}>
                ${completed
                    ? "View Result"
                    : tiebreakerRequired
                    ? "Resolve Tie"
                    : displayStatus === "loaded"
                    ? "Reload Event"
                    : "Load Event"}
            </button>
        </div>
    `;
}

let activeSeasonTab = "calendar";
let activeSeasonCalendarFilter = "all";

function showSeasonTab(tab) {
    activeSeasonTab = tab;
    document.querySelectorAll("[data-season-tab]").forEach(button => button.classList.toggle("active", button.dataset.seasonTab === tab));
    document.querySelectorAll(".season-tab-panel").forEach(panel => panel.classList.add("hidden"));
    const map = {calendar:"seasonCalendarTab",qualification:"seasonQualificationTab",tiebreakers:"seasonTiebreakersTab",setup:"seasonSetupTab",archives:"seasonArchivesTab"};
    document.getElementById(map[tab])?.classList.remove("hidden");
    if (tab === "calendar") renderSeasonCalendar();
    if (tab === "qualification" && typeof renderSeasonQualificationSnapshot === "function") renderSeasonQualificationSnapshot();
    if (tab === "tiebreakers") renderSeasonTiebreakerTab(getSeasonState(), getNextAvailableSeasonEvent(getSeasonState()));
    if (tab === "setup") renderSeasonSplitSettingsBuilder();
    if (tab === "archives" && typeof renderSeasonArchiveHub === "function") renderSeasonArchiveHub();
}

function setSeasonCalendarFilter(filter) {
    activeSeasonCalendarFilter = filter;
    document.querySelectorAll("[data-season-filter]").forEach(button => button.classList.toggle("active", button.dataset.seasonFilter === filter));
    applySeasonCalendarFilters();
}

function applySeasonCalendarFilters() {
    const state = getSeasonState();
    const currentSplit = typeof getSeasonCurrentSplit === "function" ? getSeasonCurrentSplit() : "";
    document.querySelectorAll("#seasonCalendar .season-event-card").forEach(card => {
        const status=card.dataset.seasonStatus; const split=card.dataset.seasonSplit; const type=card.dataset.seasonType;
        let visible=true;
        if(activeSeasonCalendarFilter==="completed") visible=status==="completed";
        if(activeSeasonCalendarFilter==="locked") visible=status==="locked"||status==="tiebreaker";
        if(activeSeasonCalendarFilter==="ready") visible=["scheduled","loaded","in_progress"].includes(status);
        if(activeSeasonCalendarFilter==="postseason") visible=["lcq","playin","worlds"].includes(type);
        if(activeSeasonCalendarFilter==="current") {
            const match=String(currentSplit).match(/\d+/); visible=match ? split===match[0] : ["lcq","playin","worlds"].includes(type);
        }
        card.classList.toggle("season-filter-hidden", !visible);
    });
    document.querySelectorAll("#seasonCalendar .season-split-block").forEach(block => {
        const visible=block.querySelectorAll(".season-event-card:not(.season-filter-hidden)").length>0;
        block.classList.toggle("season-filter-hidden", !visible);
    });
}

function renderSeasonTiebreakerTab(state = getSeasonState(), nextEvent = null) {
    const container=document.getElementById("seasonTiebreakerPanel"); if(!container)return;
    if(!state){container.innerHTML='<p class="small">Create a season first.</p>';return;}
    const events=state.events.filter(event=>event.status!=="completed");
    const affected=events.map(event=>({event,groups:getUnresolvedSeasonTiebreakerGroups(event,state)})).filter(item=>item.groups.length);
    if(!affected.length){container.innerHTML='<div class="season-tiebreaker-clear"><strong>No required tiebreakers</strong><span>Current ties do not block event seeding or qualification.</span></div>';return;}
    container.innerHTML=affected.map(item=>`<div class="season-tiebreaker-event-group"><div class="section-heading-row"><div><h4>${escapeSeasonText(item.event.name)}</h4><p class="small">${item.groups.length} unresolved tie group${item.groups.length===1?"":"s"}</p></div><button class="primary-button" onclick="runAllSeasonTiebreakers('${escapeSeasonText(item.event.id)}')">Resolve All</button></div>${item.groups.map(group=>renderSeasonTiebreakerGroup(item.event,group)).join("")}</div>`).join("");
}

function getSeasonEventLockReason(event, state = getSeasonState()) {
    if(!event||!state)return "Complete prerequisite events";
    if(event.type==="major") { const remaining=state.events.filter(item=>String(item.split)===String(event.split)&&item.type==="regional"&&item.status!=="completed").length; return `${remaining} Regional event${remaining===1?"":"s"} remaining in Split ${event.split}`; }
    if(event.type==="lcq") { if(!areAllSplitMajorsComplete(state.events)) return "Complete every Major to confirm the top four LCQ regions"; if(event.region==="TBD") return "Major region rankings have not been confirmed"; return "LCQ field is not complete"; }
    if(event.type==="playin") { const remaining=state.events.filter(item=>item.type==="lcq"&&item.status!=="completed").length; return remaining?`${remaining} Regional LCQ${remaining===1?"":"s"} remaining`:"Eight Play-In participants are required"; }
    if(event.type==="worlds") { const playin=state.events.find(item=>item.type==="playin"); return playin?.status!=="completed"?"Complete the Worlds Play-In":"Sixteen Main Event qualifiers are required"; }
    return "Complete prerequisite events";
}

function saveExistingSplitSettings(split) {
    if (typeof tournament !== "undefined" && tournament.running) {
        alert("Finish the running event before changing split formats.");
        return;
    }

    const state = getSeasonState();

    if (!state) return;

    const splitSettings = state.splits.find(item =>
        String(item.split) === String(split)
    );

    if (!splitSettings) return;

    splitSettings.regional = readSeriesSettingsFromControls(
        `activeSplit${split}Regional`
    );

    splitSettings.major = readSeriesSettingsFromControls(
        `activeSplit${split}Major`
    );

    state.events.forEach(event => {
        if (
            String(event.split) !== String(split) ||
            event.status === "completed"
        ) {
            return;
        }

        const settings = event.type === "major"
            ? splitSettings.major
            : splitSettings.regional;

        applySettingsToSeasonEvent(event, settings);
    });

    saveSeasonState(state);
    renderSeasonCalendar();

    alert(`Split ${split} formats updated for all unplayed events.`);
}

function applySettingsToSeasonEvent(event, settings) {
    event.format = settings.format;
    event.seriesLength = Number(settings.seriesLength || 5);
    event.swissSeriesLength = Number(
        settings.swissSeriesLength || settings.seriesLength || 5
    );
    event.playoffSeriesLength = Number(
        settings.playoffSeriesLength || settings.seriesLength || 7
    );
}

/* ==========================
   LOAD EVENTS
========================== */

function loadNextSeasonEvent() {
    const state = getSeasonState();
    const event = getNextAvailableSeasonEvent(state);

    if (!event) {
        alert("The season is complete.");
        return;
    }

    loadSeasonEvent(event.id);
}

function loadSeasonEvent(eventId) {
    const state = getSeasonState();

    if (!state) return;

    const event = state.events.find(item =>
        String(item.id) === String(eventId)
    );

    if (!event) {
        alert("Season event not found.");
        return;
    }

    if (event.status === "completed") {
        viewSeasonEventResult(event.id);
        return;
    }

    if (isSeasonEventLocked(event, state)) {
        alert(
            event.type === "major"
                ? "Complete every Regional in this split before loading the Major."
                : event.type === "lcq"
                ? "Complete every Major and make sure this region has six eligible non-qualified teams before loading the LCQ."
                : event.type === "playin"
                ? "Complete all four Regional LCQs before loading the Worlds Play-In."
                : "Complete the Worlds Play-In before loading the World Championship Main Event."
        );
        return;
    }

    const unresolvedTiebreakers =
        getUnresolvedSeasonTiebreakerGroups(event, state);

    if (unresolvedTiebreakers.length > 0) {
        focusedSeasonTiebreakerEventId = String(event.id);
        renderSeasonCalendar();

        setTimeout(() => {
            document.getElementById("seasonTiebreakerHub")
                ?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 50);

        alert(
            `${event.name} has ${unresolvedTiebreakers.length} unresolved points tie${unresolvedTiebreakers.length === 1 ? "" : "s"}. Play the tiebreaker matchup or tournament first.`
        );
        return;
    }

    if (typeof tournament !== "undefined" && tournament.running) {
        alert("Finish the current event before loading another season event.");
        return;
    }

    state.events.forEach(item => {
        if (
            item.status === "loaded" ||
            item.status === "in_progress"
        ) {
            item.status = "scheduled";
        }
    });

    event.status = "loaded";
    setCurrentSeasonEventId(event.id);
    saveSeasonState(state);

    loadSeasonEventIntoCreator(event);
    renderSeasonCalendar();
}

function loadSeasonEventIntoCreator(event) {
    resetTournamentForSeasonEvent(event);

    setFormValue("eventName", event.name);
    setFormValue("eventType", event.type);
    setFormValue("eventRegion", event.region);
    setFormValue("eventSplit", event.split === "season" ? "1" : event.split);
    setFormValue("eventSplitEventNumber", event.splitEventNumber || "");
    setFormValue("tournamentFormat", event.format);
    setFormValue("seriesFormat", event.seriesLength);
    setFormValue("swissSeriesFormat", event.swissSeriesLength);
    setFormValue("playoffSeriesFormat", event.playoffSeriesLength);

    if (typeof updateFormatAvailability === "function") {
        updateFormatAvailability();
    }

    if (typeof handleEventSettingsChanged === "function") {
        handleEventSettingsChanged();
    }

    const participants = getSeasonEventParticipants(event);

    tournament.selectedTeams = participants.map(team => team.id);
    tournament.manualSeedingOverride = false;
    tournament.seedings = typeof sortTeamsForAutomaticSeeding === "function"
        ? sortTeamsForAutomaticSeeding(
            participants,
            {
                eventId: String(event.id),
                seasonEventId: String(event.id),
                type: String(event.type || "custom"),
                split: String(event.split || "1"),
                format: String(event.format || "roundRobin")
            }
        )
        : [...participants];
    tournament.currentEvent = createTournamentEventFromSeasonEvent(event);

    if (typeof renderTournamentTeams === "function") {
        renderTournamentTeams();
    }

    if (typeof renderSeedings === "function") {
        renderSeedings();
    }

    if (typeof updateEventPreview === "function") {
        updateEventPreview();
    }

    if (typeof showPage === "function") {
        showPage("tournament");
    }

    if (typeof showTournamentPanel === "function") {
        showTournamentPanel("setupPanel", true);
    }

    const minimum = getMinimumTeamsForFormat(event.format);

    if (participants.length < minimum) {
        alert(
            `${event.name} was loaded, but only ${participants.length} eligible team${participants.length === 1 ? "" : "s"} were found. This format needs at least ${minimum}.`
        );
    }
}

function resetTournamentForSeasonEvent(event) {
    if (typeof tournament === "undefined") return;

    tournament.running = false;
    tournament.selectedTeams = [];
    tournament.seedings = [];
    tournament.manualSeedingOverride = false;
    tournament.participants = [];
    tournament.matches = [];
    tournament.standings = [];
    tournament.playerStats = {};
    tournament.round = "Setup";
    tournament.champion = null;
    tournament.mvp = null;
    tournament.savedToHistory = false;
    tournament.currentSeasonEventId = String(event.id);
    tournament.currentEvent = createTournamentEventFromSeasonEvent(event);
}

function createTournamentEventFromSeasonEvent(event) {
    return {
        id: event.id,
        seasonEventId: event.id,
        seasonId: event.seasonId,
        seasonName: event.seasonName,
        name: event.name,
        type: event.type,
        region: event.region,
        split: event.split,
        splitEventNumber: event.splitEventNumber,
        format: event.format,
        seriesLength: event.seriesLength,
        swissSeriesLength: event.swissSeriesLength,
        playoffSeriesLength: event.playoffSeriesLength,
        lcqSlot: event.lcqSlot || null,
        lcqSeedIds: Array.isArray(event.lcqSeedIds) ? [...event.lcqSeedIds] : [],
        provisionalQualifierIds: Array.isArray(event.provisionalQualifierIds)
            ? [...event.provisionalQualifierIds]
            : [],
        createdAt: event.startedAt || new Date().toISOString()
    };
}

function getSeasonEventParticipants(event) {
    const savedTeams = typeof teams !== "undefined" && Array.isArray(teams)
        ? [...teams]
        : [];

    let candidates = [];

    if (event.type === "regional") {
        const regionalTeams = savedTeams
            .filter(team => team.region === event.region);

        candidates = typeof sortTeamsForAutomaticSeeding === "function"
            ? sortTeamsForAutomaticSeeding(
                regionalTeams,
                {
                    eventId: String(event.id),
                    seasonEventId: String(event.id),
                    type: "regional",
                    split: String(event.split || "1"),
                    format: String(event.format || "roundRobin")
                }
            )
            : regionalTeams.sort((a, b) =>
                Number(b.rating || 0) - Number(a.rating || 0)
            );
    } else if (event.type === "lcq") {
        const seedIds = Array.isArray(event.lcqSeedIds)
            ? event.lcqSeedIds
            : [];

        candidates = seedIds
            .map(teamId => savedTeams.find(team =>
                String(team.id) === String(teamId)
            ))
            .filter(Boolean);

        if (candidates.length < 6 && event.region !== "TBD") {
            candidates = getRegionalLcqSeedTeams(event.region);
        }
    } else if (event.type === "playin") {
        candidates = getWorldsPlayInParticipants()
            .map(item => savedTeams.find(team =>
                String(team.id) === String(item.teamId)
            ))
            .filter(Boolean);
    } else if (event.type === "worlds") {
        candidates = getWorldsMainEventQualifiers()
            .map(item => savedTeams.find(team =>
                String(team.id) === String(item.teamId)
            ))
            .filter(Boolean);
    } else {
        candidates = getQualifiedSeasonTeams(event, savedTeams);
    }

    return normaliseParticipantsForSeasonFormat(
        candidates,
        event.format
    );
}

function getQualifiedSeasonTeams(event, savedTeams) {
    if (typeof getLanQualifiedTeams === "function") {
        setLanControlsForSeasonEvent(
            event.type === "worlds" ? "worlds" : "major",
            event.type === "worlds" ? "all" : event.split,
            event.type === "worlds" ? "worlds" : "major"
        );

        const qualified = getLanQualifiedTeams();

        if (qualified.length > 0) {
            return qualified
                .map(item => savedTeams.find(team =>
                    String(team.id) === String(item.teamId)
                ))
                .filter(Boolean);
        }
    }

    const state = typeof getLeagueState === "function"
        ? getLeagueState()
        : { teams: {} };

    return [...savedTeams].sort((a, b) => {
        const aPoints = getSeasonQualificationPoints(
            state.teams?.[String(a.id)],
            event
        );
        const bPoints = getSeasonQualificationPoints(
            state.teams?.[String(b.id)],
            event
        );

        return (
            bPoints - aPoints ||
            Number(b.rating || 0) - Number(a.rating || 0)
        );
    });
}

function getSeasonQualificationPoints(pointsData, event) {
    if (!pointsData) return 0;

    if (event.type === "worlds") {
        return Number(pointsData.totalPoints || 0);
    }

    const splitData = pointsData.splits?.[String(event.split)];

    return Number(
        splitData?.totalPoints ||
        pointsData.totalPoints ||
        0
    );
}

function normaliseParticipantsForSeasonFormat(candidates, format) {
    const unique = [];
    const seen = new Set();

    candidates.forEach(team => {
        const id = String(team.id);
        if (seen.has(id)) return;
        seen.add(id);
        unique.push(team);
    });

    if (format === "regionalLcq") {
        return unique.slice(0, 6);
    }

    if (format === "worldsPlayIn") {
        return unique.slice(0, 8);
    }

    if (
        format === "groupsHybrid" ||
        format === "groupsDoubleElim"
    ) {
        return unique.slice(0, 16);
    }

    if (format === "doubleElim") {
        if (unique.length >= 16) return unique.slice(0, 16);
        if (unique.length >= 8) return unique.slice(0, 8);
        return unique.slice(0, 4);
    }

    if (format === "playoffs") {
        if (unique.length >= 16) return unique.slice(0, 16);
        if (unique.length >= 8) return unique.slice(0, 8);
        return unique.slice(0, 4);
    }

    return unique;
}

function getMinimumTeamsForFormat(format) {
    if (format === "regionalLcq") return 6;
    if (format === "worldsPlayIn") return 8;
    if (format === "groupsHybrid" || format === "groupsDoubleElim") return 16;
    if (format === "doubleElim" || format === "playoffs") return 4;
    if (format === "swiss" || format === "swissPlayoffs") return 4;
    return 2;
}

function markSeasonEventInProgress(eventId) {
    const state = getSeasonState();

    if (!state) return;

    const event = state.events.find(item =>
        String(item.id) === String(eventId)
    );

    if (!event || event.status === "completed") return;

    event.status = "in_progress";
    event.startedAt = event.startedAt || new Date().toISOString();

    saveSeasonState(state);
    renderSeasonCalendar();
}

function viewSeasonEventResult(eventId) {
    const event = getSeasonEventById(eventId);

    if (!event) return;

    if (typeof showPage === "function") {
        showPage("history");
    }

    if (typeof renderHistory === "function") {
        renderHistory();
    }
}

function setFormValue(id, value) {
    const input = document.getElementById(id);

    if (input && value !== undefined && value !== null) {
        input.value = String(value);
    }
}

function setLanControlsForSeasonEvent(lanType, split, preset) {
    setFormValue("lanType", lanType);
    setFormValue("lanSplitFilter", split);

    if (typeof applyLanPreset === "function") {
        applyLanPreset(preset, false);
    }
}

function generateSplitMajorFromSeason(split) {
    const state = getSeasonState();

    if (!state) return;

    const major = state.events.find(event =>
        event.type === "major" &&
        String(event.split) === String(split)
    );

    if (!major) {
        alert("No Major exists for this split.");
        return;
    }

    loadSeasonEvent(major.id);
}

function generateWorldsFromSeason() {
    const state = getSeasonState();

    if (!state) return;

    const worlds = state.events.find(event =>
        event.type === "worlds"
    );

    if (!worlds) {
        alert("No World Championship exists in this season.");
        return;
    }

    loadSeasonEvent(worlds.id);
}

/* ==========================
   COMPLETION + HISTORY SYNC
========================== */

function markSeasonEventCompletedFromRecord(record) {
    if (!record) return false;

    const state = getSeasonState();

    if (!state) return false;

    const event = findSeasonEventForHistoryRecord(
        state,
        record
    );

    if (!event) {
        console.warn(
            "No season event matched the completed history record:",
            record
        );
        return false;
    }

    event.status = "completed";
    event.champion = record.champion || "Unknown";
    event.historyRecordId = record.id || event.historyRecordId;
    event.completedAt = record.date || new Date().toLocaleString();
    applyLcqHistoryResultToSeasonEvent(event, record);
    applyPlayInHistoryResultToSeasonEvent(event, record);

    state.events.forEach(item => {
        if (
            item.id !== event.id &&
            (item.status === "loaded" || item.status === "in_progress")
        ) {
            item.status = "scheduled";
        }
    });

    saveSeasonState(state);

    if (
        String(getCurrentSeasonEventId()) === String(event.id)
    ) {
        clearCurrentSeasonEventId();
    }

    if (typeof tournament !== "undefined") {
        tournament.currentSeasonEventId = null;
        tournament.running = false;
    }

    renderSeasonCalendar();

    if (typeof updateDashboard === "function") {
        updateDashboard();
    }

    return true;
}

function findSeasonEventForHistoryRecord(state, record) {
    const recordEvent = record.event || {};
    const explicitId =
        recordEvent.seasonEventId ||
        record.seasonEventId ||
        getCurrentSeasonEventId() ||
        (typeof tournament !== "undefined"
            ? tournament.currentSeasonEventId
            : null);

    if (explicitId) {
        const exact = state.events.find(event =>
            String(event.id) === String(explicitId)
        );

        if (exact) return exact;
    }

    return state.events.find(event =>
        doesHistoryRecordMatchSeasonEvent(
            record,
            event,
            state
        )
    ) || null;
}

function doesHistoryRecordMatchSeasonEvent(
    record,
    event,
    state = getSeasonState(),
    allowLegacy = false
) {
    if (!record || !event) return false;

    const recordEvent = record.event || {};

    if (
        recordEvent.seasonEventId &&
        String(recordEvent.seasonEventId) === String(event.id)
    ) {
        return true;
    }

    if (recordEvent.seasonName && state?.name) {
        if (
            normalizeSeasonText(recordEvent.seasonName) !==
            normalizeSeasonText(state.name)
        ) {
            return false;
        }
    } else if (!allowLegacy) {
        return false;
    } else if (state?.createdAt) {
        const recordTime = Date.parse(
            record.completedAt || record.date || ""
        );
        const seasonTime = Date.parse(state.createdAt);

        if (
            Number.isFinite(recordTime) &&
            Number.isFinite(seasonTime) &&
            recordTime < seasonTime
        ) {
            return false;
        }
    }

    return (
        normalizeSeasonText(recordEvent.name) ===
            normalizeSeasonText(event.name) &&
        normalizeSeasonText(recordEvent.type) ===
            normalizeSeasonText(event.type) &&
        normalizeSeasonText(recordEvent.region || "GLOBAL") ===
            normalizeSeasonText(event.region || "GLOBAL") &&
        normalizeSeasonText(recordEvent.split || "1") ===
            normalizeSeasonText(event.split || "1") &&
        normalizeSeasonText(recordEvent.splitEventNumber || "") ===
            normalizeSeasonText(event.splitEventNumber || "")
    );
}

function syncSeasonCalendarFromHistory(allowLegacy = false) {
    const state = getSeasonState();

    if (!state) return false;

    const history = getSeasonHistoryRecords();

    if (history.length === 0) return false;

    let changed = false;

    state.events.forEach(event => {
        if (event.status === "completed") return;

        const record = history.find(item =>
            doesHistoryRecordMatchSeasonEvent(
                item,
                event,
                state,
                allowLegacy
            )
        );

        if (!record) return;

        event.status = "completed";
        event.champion = record.champion || "Unknown";
        event.historyRecordId = record.id || null;
        event.completedAt = record.date || null;
        applyLcqHistoryResultToSeasonEvent(event, record);
        applyPlayInHistoryResultToSeasonEvent(event, record);
        changed = true;
    });

    if (changed) {
        saveSeasonState(state);
    }

    return changed;
}

function getSeasonHistoryRecords() {
    try {
        return JSON.parse(
            localStorage.getItem("rlcsTournamentHistory") || "[]"
        );
    } catch {
        return [];
    }
}

function repairSeasonProgressFromHistory() {
    const changed = syncSeasonCalendarFromHistory(true);
    renderSeasonCalendar();

    alert(
        changed
            ? "Season progress was repaired from event history."
            : "No additional completed season events were found in history."
    );
}

/* ==========================
   HELPERS
========================== */

function formatSeasonEventType(type) {
    if (type === "regional") return "Regional";
    if (type === "major") return "LAN / Major";
    if (type === "worlds") return "World Championship";
    if (type === "playin") return "Worlds Play-In";
    if (type === "lcq") return "Regional Worlds LCQ";
    return "Custom Event";
}

function formatSeasonFormat(format) {
    return SEASON_FORMAT_LABELS[format] || format || "Unknown";
}

function formatSeasonStatus(status) {
    if (status === "completed") return "Completed";
    if (status === "locked") return "Locked";
    if (status === "tiebreaker") return "Tiebreaker Required";
    if (status === "loaded") return "Ready";
    if (status === "in_progress") return "In Progress";
    return "Scheduled";
}

function normalizeSeasonText(value) {
    return String(value || "")
        .trim()
        .toLowerCase();
}

function escapeSeasonText(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/* ==========================
   GLOBAL EXPORTS
========================== */

window.getSeasonState = getSeasonState;
window.getSeasonCalendar = getSeasonCalendar;
window.getSeasonEventById = getSeasonEventById;
window.getCurrentSeasonEvent = getCurrentSeasonEvent;
window.getCurrentSeasonEventId = getCurrentSeasonEventId;
window.getSeasonCurrentSplit = getSeasonCurrentSplit;
window.getRegionalLcqWorldsQualifiers = getRegionalLcqWorldsQualifiers;
window.getWorldsDirectQualifiers = getWorldsDirectQualifiers;
window.getWorldsFixedPlayInQualifiers = getWorldsFixedPlayInQualifiers;
window.getRegionalLcqWinners = getRegionalLcqWinners;
window.getWorldsPlayInParticipants = getWorldsPlayInParticipants;
window.getWorldsPlayInQualifiers = getWorldsPlayInQualifiers;
window.getWorldsMainEventQualifiers = getWorldsMainEventQualifiers;
window.applyPlayInHistoryResultToSeasonEvent = applyPlayInHistoryResultToSeasonEvent;

window.rankRegionsByMajorPerformance = rankRegionsByMajorPerformance;
window.applyLcqHistoryResultToSeasonEvent = applyLcqHistoryResultToSeasonEvent;
window.createDefaultSeason = createDefaultSeason;
window.clearSeasonCalendar = clearSeasonCalendar;
window.renderSeasonCalendar = renderSeasonCalendar;
window.renderSeasonSplitSettingsBuilder = renderSeasonSplitSettingsBuilder;
window.loadSeasonEvent = loadSeasonEvent;
window.loadNextSeasonEvent = loadNextSeasonEvent;
window.viewSeasonEventResult = viewSeasonEventResult;
window.generateSplitMajorFromSeason = generateSplitMajorFromSeason;
window.generateWorldsFromSeason = generateWorldsFromSeason;
window.markSeasonEventInProgress = markSeasonEventInProgress;
window.markSeasonEventCompletedFromRecord = markSeasonEventCompletedFromRecord;
window.repairSeasonProgressFromHistory = repairSeasonProgressFromHistory;
window.saveExistingSplitSettings = saveExistingSplitSettings;
window.getSeasonTiebreakerGroupsForEvent = getSeasonTiebreakerGroupsForEvent;
window.getUnresolvedSeasonTiebreakerGroups = getUnresolvedSeasonTiebreakerGroups;
window.hasUnresolvedSeasonTiebreakersForEvent = hasUnresolvedSeasonTiebreakersForEvent;
window.getSeasonTiebreakerRankMapForTeams = getSeasonTiebreakerRankMapForTeams;
window.runSeasonTiebreaker = runSeasonTiebreaker;
window.runAllSeasonTiebreakers = runAllSeasonTiebreakers;
window.focusSeasonTiebreaker = focusSeasonTiebreaker;

/* ==========================
   INIT
========================== */

window.addEventListener("load", () => {
    setTimeout(() => {
        renderSeasonSplitSettingsBuilder();

        const splitCount = document.getElementById(
            "seasonSplitCount"
        );

        if (splitCount) {
            splitCount.addEventListener(
                "change",
                renderSeasonSplitSettingsBuilder
            );
        }

        renderSeasonCalendar();
    }, 900);
});
