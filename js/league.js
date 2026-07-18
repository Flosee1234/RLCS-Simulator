const LEAGUE_POINTS_KEY =
    "rlcsLeaguePoints";

const LEAGUE_TABLE_UI_KEY =
    "rlcsLeagueTableUiV2";

const LEAGUE_POINTS_SCOPE_VERSION_KEY =
    "rlcsLeaguePointsScopeVersion";

const LEAGUE_POINTS_SCOPE_VERSION = 2;

const EVENT_POINTS_TABLES = {
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
        { min: 9, max: 16, points: 9 },
        { min: 17, max: Infinity, points: 3 }
    ],

    custom: [
        { min: 1, max: 1, points: 16 },
        { min: 2, max: 2, points: 12 },
        { min: 3, max: 4, points: 9 },
        { min: 5, max: 8, points: 6 },
        { min: 9, max: 16, points: 3 },
        { min: 17, max: Infinity, points: 1 }
    ]
};

const LEAGUE_REGIONS = [
    "NA",
    "EU",
    "SAM",
    "MENA",
    "OCE",
    "APAC",
    "SSA"
];

const LEAGUE_MAJOR_SLOT_FALLBACK = {
    NA: 4,
    EU: 4,
    SAM: 2,
    MENA: 2,
    OCE: 1,
    APAC: 1,
    SSA: 1,
    wildcard: 1
};

let leagueTableUi = loadLeagueTableUi();

/* ==========================
   STATE
========================== */

function getLeagueState() {

    const saved =
        localStorage.getItem(
            LEAGUE_POINTS_KEY
        );

    if (!saved) {
        return createEmptyLeagueState();
    }

    try {

        const state =
            JSON.parse(saved);

        if (!state.teams) {
            state.teams = {};
        }

        if (!state.awardedEvents) {
            state.awardedEvents = [];
        }

        return state;

    } catch {

        return createEmptyLeagueState();

    }

}

function createEmptyLeagueState() {

    return {
        teams: {},
        awardedEvents: []
    };

}

function saveLeagueState(state) {

    localStorage.setItem(
        LEAGUE_POINTS_KEY,
        JSON.stringify(state)
    );

}

/* ==========================
   POINTS ELIGIBILITY
========================== */

function getLeagueRecordSeasonEventId(record) {
    return (
        record?.event?.seasonEventId ||
        record?.seasonEventId ||
        null
    );
}

function isLeaguePointsEligibleRecord(
    record,
    seasonState = (
        typeof getSeasonState === "function"
            ? getSeasonState()
            : null
    )
) {
    if (!record) return false;

    const seasonEventId =
        getLeagueRecordSeasonEventId(record);

    /*
        Only events loaded from Season Mode award standings points.
        Standalone Regionals, Majors, Worlds, or Custom events still save
        to History, but they do not alter the active league table.
    */
    if (!seasonEventId || !seasonState) {
        return false;
    }

    const seasonEvents =
        Array.isArray(seasonState.events)
            ? seasonState.events
            : [];

    const linkedEvent = seasonEvents.find(event =>
        String(event.id) === String(seasonEventId)
    );

    if (!linkedEvent) {
        return false;
    }

    const recordSeasonId =
        record?.event?.seasonId ||
        record?.seasonId ||
        null;

    if (
        recordSeasonId &&
        seasonState.id &&
        String(recordSeasonId) !== String(seasonState.id)
    ) {
        return false;
    }

    return true;
}

/* ==========================
   AWARD POINTS
========================== */

function awardEventPoints(record) {

    if (
        !record ||
        !record.id ||
        !record.placements
    ) {
        return [];
    }

    const state =
        getLeagueState();

    const recordId =
        String(record.id);

    if (
        state.awardedEvents.includes(recordId)
    ) {
        return record.pointsAwarded || [];
    }

    const eventType =
        record.event?.type || "custom";

    const split =
        getRecordSplit(record);

    if (!isLeaguePointsEligibleRecord(record)) {
        return [];
    }

    if (
        eventType === "lcq" ||
        eventType === "playin"
    ) {
        state.awardedEvents.push(recordId);
        saveLeagueState(state);
        return [];
    }

    const awarded = [];

    record.placements.forEach(placement => {

        const points =
            getEventPointsForPlacement(
                eventType,
                placement.placement
            );

        const teamEntry =
            ensureLeagueTeam(
                state,
                placement
            );

        const splitEntry =
            ensureLeagueSplit(
                teamEntry,
                split
            );

        teamEntry.totalPoints += points;
        splitEntry.totalPoints += points;

        teamEntry.eventsPlayed++;
        splitEntry.eventsPlayed++;

        if (Number(placement.placement) === 1) {
            teamEntry.eventWins++;
            splitEntry.eventWins++;
        }

        if (
            !teamEntry.bestPlacement ||
            Number(placement.placement) <
            Number(teamEntry.bestPlacement)
        ) {
            teamEntry.bestPlacement =
                Number(placement.placement);
        }

        if (
            !splitEntry.bestPlacement ||
            Number(placement.placement) <
            Number(splitEntry.bestPlacement)
        ) {
            splitEntry.bestPlacement =
                Number(placement.placement);
        }

        if (eventType === "regional") {
            teamEntry.regionalPoints += points;
            splitEntry.regionalPoints += points;
        } else if (eventType === "major") {
            teamEntry.lanPoints += points;
            splitEntry.lanPoints += points;
        } else if (eventType === "worlds") {
            teamEntry.worldsPoints += points;
            splitEntry.worldsPoints += points;
        } else {
            teamEntry.customPoints += points;
            splitEntry.customPoints += points;
        }

        awarded.push({
            teamId: placement.teamId,
            teamName: placement.teamName,
            placement: Number(placement.placement),
            points,
            split
        });

    });

    state.awardedEvents.push(recordId);

    saveLeagueState(state);

    return awarded;

}

function ensureLeagueTeam(state, placement) {

    const key =
        String(placement.teamId);

    if (!state.teams[key]) {

        state.teams[key] = {
            teamId: placement.teamId,
            teamName: placement.teamName,
            logo: placement.logo || "",
            region: placement.region || "Unknown",
            rating: Number(placement.rating || 0),

            totalPoints: 0,
            regionalPoints: 0,
            lanPoints: 0,
            worldsPoints: 0,
            customPoints: 0,

            eventsPlayed: 0,
            eventWins: 0,
            bestPlacement: null,

            splits: {}
        };

    }

    state.teams[key].teamName =
        placement.teamName;

    state.teams[key].logo =
        placement.logo || state.teams[key].logo;

    state.teams[key].region =
        placement.region || state.teams[key].region;

    state.teams[key].rating =
        Number(placement.rating || state.teams[key].rating || 0);

    if (!state.teams[key].splits) {
        state.teams[key].splits = {};
    }

    return state.teams[key];

}

function ensureLeagueSplit(teamEntry, split) {

    const key =
        String(split || 1);

    if (!teamEntry.splits[key]) {

        teamEntry.splits[key] = {
            split: key,

            totalPoints: 0,
            regionalPoints: 0,
            lanPoints: 0,
            worldsPoints: 0,
            customPoints: 0,

            eventsPlayed: 0,
            eventWins: 0,
            bestPlacement: null
        };

    }

    return teamEntry.splits[key];

}

function getEventPointsForPlacement(
    eventType,
    placement
) {

    const numericPlacement =
        Number(placement);

    if (
        !Number.isFinite(numericPlacement) ||
        numericPlacement < 1
    ) {
        return 0;
    }

    let seasonState = null;

    try {
        const rawSeason = JSON.parse(
            localStorage.getItem("rlcsSeasonCalendar") || "null"
        );

        if (
            rawSeason &&
            !Array.isArray(rawSeason) &&
            typeof rawSeason === "object"
        ) {
            seasonState = rawSeason;
        }
    } catch {
        seasonState = null;
    }

    const table = typeof getCompetitionPointsTable === "function"
        ? getCompetitionPointsTable(eventType, seasonState)
        : (
            EVENT_POINTS_TABLES[eventType] ||
            EVENT_POINTS_TABLES.custom
        );

    const matchingRange =
        table.find(range =>
            numericPlacement >= range.min &&
            numericPlacement <= range.max
        );

    return matchingRange
        ? matchingRange.points
        : 0;

}

function getRecordSplit(record) {

    if (record?.event?.split) {
        return String(record.event.split);
    }

    if (record?.split) {
        return String(record.split);
    }

    const name =
        record?.event?.name || "";

    const match =
        String(name).match(/split\s*(\d+)/i);

    if (match) {
        return String(match[1]);
    }

    const input =
        document.getElementById("eventSplit");

    if (input && input.value) {
        return String(input.value);
    }

    return "1";

}

/* ==========================
   EVENT SPLIT INTEGRATION
========================== */

const baseGetEventFormDataForSplits =
    window.getEventFormData;

if (
    typeof baseGetEventFormDataForSplits ===
    "function"
) {

    window.getEventFormData = function () {

        const event =
            baseGetEventFormDataForSplits();

        const splitInput =
            document.getElementById("eventSplit");

        const splitEventInput =
            document.getElementById(
                "eventSplitEventNumber"
            );

        event.split =
            splitInput
            ? splitInput.value
            : "1";

        event.splitEventNumber =
            splitEventInput
            ? splitEventInput.value
            : "";

        return event;

    };

}

/* ==========================
   LEAGUE TABLE UI STATE
========================== */

function loadLeagueTableUi() {
    const fallback = {
        view: "overall",
        search: "",
        region: "ALL",
        sort: "points",
        status: "ALL",
        compact: false,
        expanded: []
    };

    try {
        const saved = JSON.parse(
            localStorage.getItem(LEAGUE_TABLE_UI_KEY) || "{}"
        );

        return {
            ...fallback,
            ...(saved && typeof saved === "object" ? saved : {}),
            expanded: Array.isArray(saved?.expanded)
                ? saved.expanded.map(String)
                : []
        };
    } catch {
        return fallback;
    }
}

function saveLeagueTableUi() {
    localStorage.setItem(
        LEAGUE_TABLE_UI_KEY,
        JSON.stringify(leagueTableUi)
    );
}

function setLeagueTableView(view) {
    leagueTableUi.view = String(view || "overall");
    leagueTableUi.status = "ALL";
    saveLeagueTableUi();
    renderLeagueTable();
}

function setLeagueTableRegion(value) {
    leagueTableUi.region = value || "ALL";
    saveLeagueTableUi();
    renderLeagueTable();
}

function setLeagueTableSort(value) {
    leagueTableUi.sort = value || "points";
    saveLeagueTableUi();
    renderLeagueTable();
}

function setLeagueTableStatus(value) {
    leagueTableUi.status = value || "ALL";
    saveLeagueTableUi();
    renderLeagueTable();
}

function setLeagueTableSearch(value) {
    const input = document.getElementById("leagueSearchInput");
    const cursor = input?.selectionStart ?? String(value || "").length;

    leagueTableUi.search = String(value || "");
    saveLeagueTableUi();
    renderLeagueTable();

    const replacement = document.getElementById("leagueSearchInput");
    if (replacement) {
        replacement.focus();
        const nextCursor = Math.min(cursor, replacement.value.length);
        replacement.setSelectionRange(nextCursor, nextCursor);
    }
}

function toggleLeagueCompactView() {
    leagueTableUi.compact = !leagueTableUi.compact;
    saveLeagueTableUi();
    renderLeagueTable();
}

function toggleLeagueTeamDetails(teamId) {
    const key = String(teamId);
    const expanded = new Set(
        (leagueTableUi.expanded || []).map(String)
    );

    if (expanded.has(key)) {
        expanded.delete(key);
    } else {
        expanded.add(key);
    }

    leagueTableUi.expanded = [...expanded];
    saveLeagueTableUi();
    renderLeagueTable();
}

/* ==========================
   RENDER LEAGUE HUB
========================== */

function renderLeagueTable() {

    const container =
        document.getElementById("leagueDashboard") ||
        document.getElementById("leagueTable");

    if (!container) return;

    const context = createLeagueTableContext();

    if (!context.validViews.includes(leagueTableUi.view)) {
        leagueTableUi.view = "overall";
    }

    container.innerHTML = `
        <div class="league-hub ${leagueTableUi.compact ? "league-compact" : ""}">
            ${renderLeagueHero(context)}
            ${renderLeagueSummaryCards(context)}
            ${renderLeagueTabs(context)}
            ${renderLeagueControls(context)}
            ${renderLeagueAlert(context)}
            ${renderLeagueRegionPerformance(context)}
            <div class="league-table-stage">
                ${renderLeagueView(context)}
            </div>
        </div>
    `;
}

function createLeagueTableContext() {
    const savedTeams =
        typeof teams !== "undefined" && Array.isArray(teams)
            ? [...teams]
            : [];

    const leagueState = getLeagueState();
    const history = getLeagueHistoryRecords();
    const season =
        typeof getSeasonState === "function"
            ? getSeasonState()
            : null;

    const splitCount = Math.max(
        1,
        Number(season?.splitCount || season?.splits?.length || 3)
    );

    const splits = Array.from(
        { length: splitCount },
        (_, index) => String(index + 1)
    );

    const currentSplit = getLeagueCurrentSplit(season, splits);
    const tiebreaker = getLeagueTiebreakerContext(season);
    const historyStats = buildLeagueHistoryStats(history);

    const rows = savedTeams.map(team =>
        createLeagueHubRow(
            team,
            leagueState,
            historyStats,
            currentSplit,
            splits,
            tiebreaker
        )
    );

    const completedEvents = season?.events
        ? season.events.filter(event => event.status === "completed").length
        : history.length;

    const totalEvents = season?.events?.length || history.length;

    const validViews = [
        "overall",
        "current",
        ...splits.map(split => `split-${split}`),
        "regional",
        "major",
        "worlds"
    ];

    return {
        savedTeams,
        leagueState,
        history,
        season,
        splits,
        splitCount,
        currentSplit,
        tiebreaker,
        historyStats,
        rows,
        completedEvents,
        totalEvents,
        validViews
    };
}

function renderLeagueHero(context) {
    const seasonName = context.season?.name || "League Standings";
    const progress = context.totalEvents > 0
        ? Math.round((context.completedEvents / context.totalEvents) * 100)
        : 0;

    return `
        <div class="league-hero-card">
            <div class="league-hero-copy">
                <span class="league-eyebrow">Standings & Qualification Hub</span>
                <h2>${escapeLeagueText(seasonName)}</h2>
                <p>
                    Track split points, Major performance, Worlds qualification,
                    form, movement and event-by-event points in one place.
                </p>
            </div>

            <div class="league-hero-progress">
                <div>
                    <strong>${progress}%</strong>
                    <span>Season complete</span>
                </div>
                <div class="league-progress-track">
                    <div class="league-progress-fill" style="width:${progress}%"></div>
                </div>
            </div>

            <div class="league-hero-actions">
                <button class="primary-button" onclick="setLeagueTableView('worlds')">
                    View Worlds Race
                </button>
                <button class="secondary-button" onclick="rebuildLeaguePointsFromHistory()">
                    Rebuild Points
                </button>
            </div>
        </div>
    `;
}

function renderLeagueSummaryCards(context) {
    const unresolved = context.tiebreaker.groups
        .filter(group => group.status !== "completed")
        .length;

    const leader = [...context.rows]
        .sort((a, b) => b.overall.totalPoints - a.overall.totalPoints)[0];

    return `
        <div class="league-summary-grid">
            ${renderLeagueSummaryCard(
                "Teams",
                context.rows.length,
                "Active league teams"
            )}
            ${renderLeagueSummaryCard(
                "Events",
                `${context.completedEvents} / ${context.totalEvents}`,
                "Season events completed"
            )}
            ${renderLeagueSummaryCard(
                "Current Split",
                context.currentSplit,
                `Split ${context.currentSplit} standings active`
            )}
            ${renderLeagueSummaryCard(
                "Points Leader",
                leader ? escapeLeagueText(leader.teamName) : "None",
                leader ? `${leader.overall.totalPoints} points` : "No points yet"
            )}
            ${renderLeagueSummaryCard(
                "Tiebreakers",
                unresolved,
                unresolved > 0 ? "Require resolution" : "No active ties"
            )}
        </div>
    `;
}

function renderLeagueSummaryCard(label, value, subtitle) {
    return `
        <div class="league-summary-card">
            <span>${escapeLeagueText(label)}</span>
            <strong>${value}</strong>
            <small>${escapeLeagueText(subtitle)}</small>
        </div>
    `;
}

function renderLeagueTabs(context) {
    const tabs = [
        ["overall", "Overall"],
        ["current", `Current Split (${context.currentSplit})`],
        ...context.splits.map(split => [`split-${split}`, `Split ${split}`]),
        ["regional", "Regional"],
        ["major", "Major Performance"],
        ["worlds", "Worlds Race"]
    ];

    return `
        <div class="league-view-tabs">
            ${tabs.map(([value, label]) => `
                <button
                    class="league-view-tab ${leagueTableUi.view === value ? "active" : ""}"
                    onclick="setLeagueTableView('${value}')">
                    ${escapeLeagueText(label)}
                </button>
            `).join("")}
        </div>
    `;
}

function renderLeagueControls(context) {
    const sortOptions = [
        ["points", "Points"],
        ["major", "Major Points"],
        ["wins", "Event Wins"],
        ["best", "Best Finish"],
        ["rating", "Team Rating"],
        ["form", "Form"]
    ];

    return `
        <div class="league-control-card">
            <div class="league-control-grid">
                <div>
                    <label>Search Team</label>
                    <input
                        id="leagueSearchInput"
                        type="search"
                        value="${escapeLeagueAttribute(leagueTableUi.search)}"
                        placeholder="Search by team name..."
                        oninput="setLeagueTableSearch(this.value)">
                </div>

                <div>
                    <label>Region</label>
                    <select onchange="setLeagueTableRegion(this.value)">
                        <option value="ALL" ${leagueTableUi.region === "ALL" ? "selected" : ""}>
                            All Regions
                        </option>
                        ${LEAGUE_REGIONS.map(region => `
                            <option value="${region}" ${leagueTableUi.region === region ? "selected" : ""}>
                                ${region}
                            </option>
                        `).join("")}
                    </select>
                </div>

                <div>
                    <label>Sort By</label>
                    <select onchange="setLeagueTableSort(this.value)">
                        ${sortOptions.map(([value, label]) => `
                            <option value="${value}" ${leagueTableUi.sort === value ? "selected" : ""}>
                                ${escapeLeagueText(label)}
                            </option>
                        `).join("")}
                    </select>
                </div>

                ${leagueTableUi.view === "worlds" ? `
                    <div>
                        <label>Qualification Status</label>
                        <select onchange="setLeagueTableStatus(this.value)">
                            <option value="ALL" ${leagueTableUi.status === "ALL" ? "selected" : ""}>All Teams</option>
                            <option value="qualified" ${leagueTableUi.status === "qualified" ? "selected" : ""}>Qualified / Provisional</option>
                            <option value="lcq" ${leagueTableUi.status === "lcq" ? "selected" : ""}>LCQ Position</option>
                            <option value="outside" ${leagueTableUi.status === "outside" ? "selected" : ""}>Outside</option>
                        </select>
                    </div>
                ` : ""}
            </div>

            <div class="league-control-actions">
                <button class="secondary-button" onclick="toggleLeagueCompactView()">
                    ${leagueTableUi.compact ? "Detailed View" : "Compact View"}
                </button>

                ${context.tiebreaker.unresolvedCount > 0 ? `
                    <button class="league-warning-button"
                        onclick="openLeagueTiebreaker('${escapeLeagueAttribute(context.tiebreaker.event?.id || "")}')">
                        Resolve ${context.tiebreaker.unresolvedCount} Tiebreaker${context.tiebreaker.unresolvedCount === 1 ? "" : "s"}
                    </button>
                ` : ""}

                <button class="danger-button" onclick="clearLeaguePoints()">
                    Reset Points
                </button>
            </div>
        </div>
    `;
}

function renderLeagueAlert(context) {
    if (context.tiebreaker.unresolvedCount <= 0) {
        return "";
    }

    return `
        <div class="league-alert-card">
            <div>
                <strong>Points tiebreaker required</strong>
                <span>
                    ${escapeLeagueText(context.tiebreaker.event?.name || "The next season event")}
                    cannot be seeded until ${context.tiebreaker.unresolvedCount}
                    tied points group${context.tiebreaker.unresolvedCount === 1 ? " is" : "s are"} resolved.
                </span>
            </div>
            <button class="primary-button"
                onclick="openLeagueTiebreaker('${escapeLeagueAttribute(context.tiebreaker.event?.id || "")}')">
                Open Tiebreakers
            </button>
        </div>
    `;
}

function renderLeagueRegionPerformance(context) {
    const rankings = getLeagueRegionPerformance(context);

    if (rankings.length === 0) return "";

    return `
        <div class="league-region-panel">
            <div class="league-section-heading">
                <div>
                    <span class="league-eyebrow">Major Region Rankings</span>
                    <h3>Regional LCQ Race</h3>
                </div>
                <span class="league-section-note">Top four regions earn Regional Worlds LCQs</span>
            </div>

            <div class="league-region-ranking-grid">
                ${rankings.map((row, index) => `
                    <button class="league-region-ranking ${index < 4 ? "lcq-region" : ""}"
                        onclick="setLeagueTableRegion('${row.region}'); setLeagueTableView('major')">
                        <span class="league-region-rank">#${index + 1}</span>
                        <strong>${escapeLeagueText(row.region)}</strong>
                        <span>${Number(row.majorPoints || 0)} Major pts</span>
                        <small>
                            ${index < 4 ? "LCQ position" : "Outside top four"}
                        </small>
                    </button>
                `).join("")}
            </div>
        </div>
    `;
}

function renderLeagueView(context) {
    const view = leagueTableUi.view;

    if (view === "regional") {
        return renderRegionalLeagueView(context);
    }

    const rows = prepareLeagueRowsForView(context, view);

    if (rows.length === 0) {
        return renderLeagueEmptyState();
    }

    if (view === "worlds") {
        return renderWorldsLeagueTable(rows, context);
    }

    return renderStandardLeagueTable(rows, context, view);
}

function renderLeagueEmptyState() {
    return `
        <div class="league-empty-state">
            <strong>No teams match these filters.</strong>
            <span>Change the search, region or qualification filter.</span>
        </div>
    `;
}

/* ==========================
   ROW DATA + FILTERING
========================== */

function createLeagueHubRow(
    team,
    leagueState,
    historyStats,
    currentSplit,
    splits,
    tiebreaker
) {
    const stored = leagueState.teams?.[String(team.id)] || {};
    const overall = normaliseLeagueMetrics(stored);
    const splitMetrics = {};

    splits.forEach(split => {
        splitMetrics[split] = normaliseLeagueMetrics(
            stored.splits?.[String(split)] || {}
        );
    });

    const form = getLeagueTeamForm(team);
    const majorStats = historyStats.major[String(team.id)] || {
        points: Number(overall.lanPoints || 0),
        events: 0,
        wins: 0,
        bestPlacement: null
    };

    return {
        teamId: team.id,
        teamName: team.name,
        logo: team.logo || stored.logo || "",
        region: team.region || stored.region || "Unknown",
        rating: Number(team.rating || stored.rating || 0),
        players: Array.isArray(team.players) ? team.players : [],
        overall,
        splits: splitMetrics,
        currentSplit,
        majorStats,
        recentEvents: historyStats.events[String(team.id)] || [],
        form,
        tiebreaker: tiebreaker.teamMap[String(team.id)] || null,
        qualification: null,
        movement: null,
        rank: null,
        rankTie: false
    };
}

function normaliseLeagueMetrics(data) {
    return {
        totalPoints: Number(data?.totalPoints || 0),
        regionalPoints: Number(data?.regionalPoints || 0),
        lanPoints: Number(data?.lanPoints || 0),
        worldsPoints: Number(data?.worldsPoints || 0),
        customPoints: Number(data?.customPoints || 0),
        eventsPlayed: Number(data?.eventsPlayed || 0),
        eventWins: Number(data?.eventWins || 0),
        bestPlacement: data?.bestPlacement
            ? Number(data.bestPlacement)
            : null
    };
}

function prepareLeagueRowsForView(context, view) {
    let rows = context.rows.map(row => ({ ...row }));

    const region = leagueTableUi.region;
    const search = leagueTableUi.search.trim().toLowerCase();

    if (region !== "ALL") {
        rows = rows.filter(row => row.region === region);
    }

    rows = assignQualificationStatuses(rows, context, view);

    const officialRows = sortLeagueRowsByOfficialPoints(
        rows.map(row => ({ ...row })),
        view,
        context
    );
    assignLeagueRanks(officialRows, view);

    const officialRanks = new Map(
        officialRows.map(row => [String(row.teamId), {
            rank: row.rank,
            rankTie: row.rankTie
        }])
    );

    if (view === "worlds" && leagueTableUi.status !== "ALL") {
        rows = rows.filter(row =>
            getQualificationFilterGroup(row.qualification?.code) ===
            leagueTableUi.status
        );
    }

    const fullScopeRows = [...rows];

    if (search) {
        rows = rows.filter(row =>
            row.teamName.toLowerCase().includes(search) ||
            row.region.toLowerCase().includes(search)
        );
    }

    rows = sortLeagueRows(rows, view, context);
    rows.forEach(row => {
        const official = officialRanks.get(String(row.teamId));
        row.rank = official?.rank || 0;
        row.rankTie = Boolean(official?.rankTie);
    });
    applyLeagueMovement(rows, fullScopeRows, context, view, region);

    return rows;
}

function getLeagueViewSplit(view, context) {
    if (view === "current") {
        return String(context.currentSplit);
    }

    if (String(view).startsWith("split-")) {
        return String(view).replace("split-", "");
    }

    return null;
}

function getLeagueViewMetrics(row, view, context) {
    const split = getLeagueViewSplit(view, context);

    if (split) {
        return row.splits[split] || normaliseLeagueMetrics({});
    }

    if (view === "major") {
        return {
            ...row.overall,
            totalPoints: Number(row.majorStats.points || row.overall.lanPoints || 0),
            eventsPlayed: Number(row.majorStats.events || 0),
            eventWins: Number(row.majorStats.wins || 0),
            bestPlacement: row.majorStats.bestPlacement
        };
    }

    return row.overall;
}

function getLeaguePrimaryPoints(row, view, context) {
    return Number(getLeagueViewMetrics(row, view, context).totalPoints || 0);
}

function sortLeagueRows(rows, view, context) {
    const sortMode = leagueTableUi.sort;

    if (view === "worlds") {
        rows.sort((a, b) => {
            const statusDifference =
                getQualificationStatusOrder(a.qualification?.code) -
                getQualificationStatusOrder(b.qualification?.code);

            if (statusDifference !== 0) {
                return statusDifference;
            }

            return compareLeagueRows(a, b, view, context, sortMode);
        });

        return rows;
    }

    rows.sort((a, b) =>
        compareLeagueRows(a, b, view, context, sortMode)
    );

    return rows;
}

function sortLeagueRowsByOfficialPoints(rows, view, context) {
    if (view === "worlds") {
        rows.sort((a, b) => {
            const statusDifference =
                getQualificationStatusOrder(a.qualification?.code) -
                getQualificationStatusOrder(b.qualification?.code);

            if (statusDifference !== 0) return statusDifference;

            return compareLeagueRows(a, b, view, context, "points");
        });
        return rows;
    }

    rows.sort((a, b) =>
        compareLeagueRows(a, b, view, context, "points")
    );

    return rows;
}

function compareLeagueRows(a, b, view, context, sortMode = "points") {
    const aMetrics = getLeagueViewMetrics(a, view, context);
    const bMetrics = getLeagueViewMetrics(b, view, context);

    let difference = 0;

    if (sortMode === "major") {
        difference = Number(b.majorStats.points || 0) - Number(a.majorStats.points || 0);
    } else if (sortMode === "wins") {
        difference = Number(bMetrics.eventWins || 0) - Number(aMetrics.eventWins || 0);
    } else if (sortMode === "best") {
        difference =
            normaliseBestPlacement(aMetrics.bestPlacement) -
            normaliseBestPlacement(bMetrics.bestPlacement);
    } else if (sortMode === "rating") {
        difference = Number(b.rating || 0) - Number(a.rating || 0);
    } else if (sortMode === "form") {
        difference = Number(b.form.total || 0) - Number(a.form.total || 0);
    } else {
        difference =
            getLeaguePrimaryPoints(b, view, context) -
            getLeaguePrimaryPoints(a, view, context);
    }

    if (difference !== 0) {
        return difference;
    }

    if (sortMode === "points") {
        const tieDifference = compareCompletedLeagueTiebreaker(a, b);
        if (tieDifference !== 0) return tieDifference;
    }

    return a.teamName.localeCompare(b.teamName);
}

function compareCompletedLeagueTiebreaker(a, b) {
    const aTie = a.tiebreaker;
    const bTie = b.tiebreaker;

    if (
        !aTie ||
        !bTie ||
        aTie.signature !== bTie.signature ||
        aTie.status !== "completed" ||
        bTie.status !== "completed"
    ) {
        return 0;
    }

    return Number(aTie.rank || 999) - Number(bTie.rank || 999);
}

function assignLeagueRanks(rows, view) {
    let previousPoints = null;
    let previousRank = 0;

    rows.forEach((row, index) => {
        const points = getLeaguePrimaryPoints(
            row,
            view,
            createRankContext(row)
        );

        const previousRow = rows[index - 1];
        const resolvedTie = previousRow &&
            points === previousPoints &&
            compareCompletedLeagueTiebreaker(previousRow, row) !== 0;

        if (index === 0 || points !== previousPoints || resolvedTie) {
            previousRank = index + 1;
            row.rankTie = false;
        } else {
            row.rankTie = true;
            if (previousRow) previousRow.rankTie = true;
        }

        row.rank = previousRank;
        previousPoints = points;
    });
}

function createRankContext(row) {
    return {
        currentSplit: row.currentSplit
    };
}

function normaliseBestPlacement(value) {
    return value ? Number(value) : 999;
}

/* ==========================
   STANDARD TABLES
========================== */

function renderStandardLeagueTable(rows, context, view) {
    const columns = getLeagueColumns(view, context);

    return `
        <div class="league-table-card">
            ${renderLeagueTableHeading(view, context, rows.length)}
            <div class="league-table-scroll">
                <table class="league-modern-table">
                    <thead>
                        <tr>
                            ${columns.map(column => `
                                <th class="${column.className || ""}">${escapeLeagueText(column.label)}</th>
                            `).join("")}
                        </tr>
                    </thead>
                    <tbody>
                        ${renderLeagueRows(rows, columns, context, view)}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function renderLeagueTableHeading(view, context, count) {
    const labels = {
        overall: ["Full Season Standings", "All points earned across the season"],
        current: [`Split ${context.currentSplit} Standings`, "Current split points used for event seeding"],
        major: ["Major Performance", "Major-only results and points"],
        worlds: ["Worlds Qualification Race", "Direct, LCQ and outside positions"]
    };

    const split = getLeagueViewSplit(view, context);
    const title = split && view !== "current"
        ? `Split ${split} Standings`
        : labels[view]?.[0] || "League Standings";
    const subtitle = split && view !== "current"
        ? `Points earned during Split ${split}`
        : labels[view]?.[1] || "League standings";

    return `
        <div class="league-section-heading league-table-heading">
            <div>
                <h3>${escapeLeagueText(title)}</h3>
                <span>${escapeLeagueText(subtitle)}</span>
            </div>
            <strong>${count} team${count === 1 ? "" : "s"}</strong>
        </div>
    `;
}

function getLeagueColumns(view, context) {
    const base = [
        { key: "rank", label: "#", className: "league-rank-column" },
        { key: "team", label: "Team", className: "league-team-column" }
    ];

    if (view === "overall") {
        return [
            ...base,
            { key: "region", label: "Region" },
            ...context.splits.map(split => ({ key: `split-${split}`, label: `S${split}` })),
            { key: "points", label: "Total" },
            { key: "events", label: "Events" },
            { key: "wins", label: "Wins" },
            { key: "best", label: "Best" },
            { key: "form", label: "Form" },
            { key: "movement", label: "Move" }
        ];
    }

    if (view === "major") {
        return [
            ...base,
            { key: "region", label: "Region" },
            { key: "majorPoints", label: "Major Pts" },
            { key: "majorEvents", label: "Majors" },
            { key: "majorWins", label: "Wins" },
            { key: "majorBest", label: "Best" },
            { key: "overallPoints", label: "Season" },
            { key: "form", label: "Form" },
            { key: "movement", label: "Move" }
        ];
    }

    return [
        ...base,
        { key: "region", label: "Region" },
        { key: "points", label: "Points" },
        { key: "regionalPoints", label: "Regional" },
        { key: "majorPoints", label: "Major" },
        { key: "events", label: "Events" },
        { key: "wins", label: "Wins" },
        { key: "best", label: "Best" },
        { key: "qualification", label: "Status" },
        { key: "form", label: "Form" },
        { key: "movement", label: "Move" }
    ];
}

function renderLeagueRows(rows, columns, context, view, options = {}) {
    const expanded = new Set(
        (leagueTableUi.expanded || []).map(String)
    );

    const lineAfter = Number(options.lineAfter || 0);
    const lineLabel = options.lineLabel || "Major Qualification Line";

    return rows.map((row, index) => {
        const isExpanded = expanded.has(String(row.teamId));
        const main = `
            <tr class="league-modern-row ${isExpanded ? "expanded" : ""} ${row.qualification?.className || ""}"
                onclick="toggleLeagueTeamDetails(${leagueJsString(row.teamId)})">
                ${columns.map(column => `
                    <td class="${column.className || ""}">
                        ${renderLeagueCell(row, column.key, context, view)}
                    </td>
                `).join("")}
            </tr>
            ${isExpanded ? `
                <tr class="league-detail-row">
                    <td colspan="${columns.length}">
                        ${renderLeagueTeamDetails(row, context, view)}
                    </td>
                </tr>
            ` : ""}
        `;

        const line = lineAfter > 0 && index + 1 === lineAfter && index + 1 < rows.length
            ? `
                <tr class="league-qualification-line-row">
                    <td colspan="${columns.length}">
                        <span>${escapeLeagueText(lineLabel)}</span>
                    </td>
                </tr>
            `
            : "";

        return main + line;
    }).join("");
}

function renderLeagueCell(row, key, context, view) {
    const metrics = getLeagueViewMetrics(row, view, context);

    if (key === "rank") {
        return `
            <span class="league-rank-value">
                ${row.rank}${row.rankTie ? "=" : ""}
            </span>
            ${row.tiebreaker ? renderLeagueTiebreakerBadge(row.tiebreaker) : ""}
        `;
    }

    if (key === "team") {
        return `
            <div class="league-team-cell">
                ${row.logo
                    ? `<img src="${escapeLeagueAttribute(row.logo)}" alt="">`
                    : `<span class="league-team-logo-fallback">${escapeLeagueText(row.teamName.slice(0, 1))}</span>`
                }
                <div>
                    <strong>${escapeLeagueText(row.teamName)}</strong>
                    <small>Rating ${row.rating}</small>
                </div>
                <span class="league-expand-indicator">⌄</span>
            </div>
        `;
    }

    if (key === "region") {
        return `<span class="league-region-pill">${escapeLeagueText(row.region)}</span>`;
    }

    if (key.startsWith("split-")) {
        const split = key.replace("split-", "");
        return `<strong>${row.splits[split]?.totalPoints || 0}</strong>`;
    }

    if (key === "points") {
        return `<strong class="league-points-value">${metrics.totalPoints}</strong>`;
    }

    if (key === "overallPoints") {
        return `<strong>${row.overall.totalPoints}</strong>`;
    }

    if (key === "regionalPoints") {
        return String(metrics.regionalPoints || 0);
    }

    if (key === "majorPoints") {
        return `<strong>${view === "major" ? row.majorStats.points : metrics.lanPoints}</strong>`;
    }

    if (key === "events") {
        return String(metrics.eventsPlayed || 0);
    }

    if (key === "wins") {
        return String(metrics.eventWins || 0);
    }

    if (key === "best") {
        return formatLeaguePlacement(metrics.bestPlacement);
    }

    if (key === "majorEvents") {
        return String(row.majorStats.events || 0);
    }

    if (key === "majorWins") {
        return String(row.majorStats.wins || 0);
    }

    if (key === "majorBest") {
        return formatLeaguePlacement(row.majorStats.bestPlacement);
    }

    if (key === "form") {
        return renderLeagueFormBadge(row.form);
    }

    if (key === "movement") {
        return renderLeagueMovement(row.movement);
    }

    if (key === "qualification") {
        return renderLeagueQualificationBadge(row.qualification);
    }

    return "—";
}

/* ==========================
   REGIONAL VIEW
========================== */

function renderRegionalLeagueView(context) {
    const regionList = leagueTableUi.region === "ALL"
        ? LEAGUE_REGIONS
        : [leagueTableUi.region];

    const blocks = regionList.map(region => {
        const regionalContext = {
            ...context,
            rows: context.rows.filter(row => row.region === region)
        };

        let rows = prepareRegionalRows(regionalContext, region);

        if (rows.length === 0) return "";

        const columns = [
            { key: "rank", label: "#", className: "league-rank-column" },
            { key: "team", label: "Team", className: "league-team-column" },
            { key: "points", label: "Total" },
            ...context.splits.map(split => ({ key: `split-${split}`, label: `S${split}` })),
            { key: "regionalPoints", label: "Regional" },
            { key: "majorPoints", label: "Major" },
            { key: "wins", label: "Wins" },
            { key: "best", label: "Best" },
            { key: "form", label: "Form" },
            { key: "movement", label: "Move" }
        ];

        const majorSlots = getLeagueMajorSlots()[region] || 0;

        return `
            <div class="league-table-card league-regional-card">
                <div class="league-section-heading league-table-heading">
                    <div>
                        <h3>${escapeLeagueText(region)} Standings</h3>
                        <span>${majorSlots} guaranteed Major slot${majorSlots === 1 ? "" : "s"} in the current preset</span>
                    </div>
                    <strong>${rows.length} teams</strong>
                </div>
                <div class="league-table-scroll">
                    <table class="league-modern-table">
                        <thead>
                            <tr>
                                ${columns.map(column => `<th class="${column.className || ""}">${escapeLeagueText(column.label)}</th>`).join("")}
                            </tr>
                        </thead>
                        <tbody>
                            ${renderLeagueRows(
                                rows,
                                columns,
                                context,
                                "regional",
                                {
                                    lineAfter: majorSlots,
                                    lineLabel: `${region} Major Qualification Line`
                                }
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }).filter(Boolean);

    return blocks.length > 0
        ? `<div class="league-regional-stack">${blocks.join("")}</div>`
        : renderLeagueEmptyState();
}

function prepareRegionalRows(context, region) {
    let rows = context.rows.map(row => ({ ...row }));
    const search = leagueTableUi.search.trim().toLowerCase();

    rows = assignQualificationStatuses(rows, context, "regional");

    const officialRows = sortLeagueRowsByOfficialPoints(
        rows.map(row => ({ ...row })),
        "regional",
        context
    );
    assignLeagueRanks(officialRows, "regional");

    const officialRanks = new Map(
        officialRows.map(row => [String(row.teamId), {
            rank: row.rank,
            rankTie: row.rankTie
        }])
    );

    const fullScopeRows = [...rows];

    if (search) {
        rows = rows.filter(row =>
            row.teamName.toLowerCase().includes(search)
        );
    }

    rows = sortLeagueRows(rows, "regional", context);
    rows.forEach(row => {
        const official = officialRanks.get(String(row.teamId));
        row.rank = official?.rank || 0;
        row.rankTie = Boolean(official?.rankTie);
    });
    applyLeagueMovement(rows, fullScopeRows, context, "regional", region);

    return rows;
}

/* ==========================
   WORLDS VIEW + QUALIFICATION
========================== */

function renderWorldsLeagueTable(rows, context) {
    const columns = [
        { key: "rank", label: "#", className: "league-rank-column" },
        { key: "team", label: "Team", className: "league-team-column" },
        { key: "region", label: "Region" },
        { key: "points", label: "Season Pts" },
        { key: "majorPoints", label: "Major Pts" },
        { key: "wins", label: "Wins" },
        { key: "best", label: "Best" },
        { key: "qualification", label: "Worlds Status" },
        { key: "form", label: "Form" },
        { key: "movement", label: "Move" }
    ];

    let previousGroup = null;
    let body = "";
    const expanded = new Set((leagueTableUi.expanded || []).map(String));

    rows.forEach(row => {
        const group = getQualificationFilterGroup(row.qualification?.code);

        if (group !== previousGroup) {
            body += `
                <tr class="league-qualification-line-row ${group}">
                    <td colspan="${columns.length}">
                        <span>${escapeLeagueText(getWorldsGroupLabel(group))}</span>
                    </td>
                </tr>
            `;
            previousGroup = group;
        }

        const isExpanded = expanded.has(String(row.teamId));

        body += `
            <tr class="league-modern-row ${isExpanded ? "expanded" : ""} ${row.qualification?.className || ""}"
                onclick="toggleLeagueTeamDetails(${leagueJsString(row.teamId)})">
                ${columns.map(column => `
                    <td class="${column.className || ""}">
                        ${renderLeagueCell(row, column.key, context, "worlds")}
                    </td>
                `).join("")}
            </tr>
            ${isExpanded ? `
                <tr class="league-detail-row">
                    <td colspan="${columns.length}">
                        ${renderLeagueTeamDetails(row, context, "worlds")}
                    </td>
                </tr>
            ` : ""}
        `;
    });

    return `
        <div class="league-qualification-legend">
            ${renderLeagueQualificationBadge({ code: "qualified", label: "Worlds Main Event" })}
            ${renderLeagueQualificationBadge({ code: "lcq", label: "Worlds Play-In / Regional LCQ" })}
            ${renderLeagueQualificationBadge({ code: "outside", label: "Outside Qualification" })}
        </div>

        <div class="league-table-card">
            ${renderLeagueTableHeading("worlds", context, rows.length)}
            <div class="league-table-scroll">
                <table class="league-modern-table">
                    <thead>
                        <tr>
                            ${columns.map(column => `<th class="${column.className || ""}">${escapeLeagueText(column.label)}</th>`).join("")}
                        </tr>
                    </thead>
                    <tbody>${body}</tbody>
                </table>
            </div>
        </div>
    `;
}

function assignQualificationStatuses(rows, context, view) {
    if (view === "worlds") {
        return assignWorldsQualification(rows, context);
    }

    const split = getLeagueViewSplit(view, context);

    if (split || view === "regional") {
        return assignMajorQualification(rows, context, split || context.currentSplit);
    }

    return rows.map(row => ({ ...row, qualification: null }));
}

function assignMajorQualification(rows, context, split) {
    const slots = getLeagueMajorSlots();
    const statusMap = new Map();
    const remaining = [];

    LEAGUE_REGIONS.forEach(region => {
        const regionRows = rows
            .filter(row => row.region === region)
            .sort((a, b) =>
                Number(b.splits[String(split)]?.totalPoints || 0) -
                Number(a.splits[String(split)]?.totalPoints || 0) ||
                compareCompletedLeagueTiebreaker(a, b) ||
                a.teamName.localeCompare(b.teamName)
            );

        const guaranteed = Number(slots[region] || 0);
        const boundaryPoints = guaranteed > 0
            ? Number(regionRows[guaranteed - 1]?.splits[String(split)]?.totalPoints || 0)
            : null;

        regionRows.forEach((row, index) => {
            const points = Number(row.splits[String(split)]?.totalPoints || 0);
            const tiedAtBoundary = guaranteed > 0 &&
                points === boundaryPoints &&
                regionRows.filter(item =>
                    Number(item.splits[String(split)]?.totalPoints || 0) === boundaryPoints
                ).length > 1 &&
                row.tiebreaker?.status !== "completed";

            if (tiedAtBoundary && Math.abs(index - (guaranteed - 1)) <= 2) {
                statusMap.set(String(row.teamId), {
                    code: "tiebreaker",
                    label: "Tiebreaker Required",
                    className: "qualification-tiebreaker"
                });
            } else if (index < guaranteed) {
                statusMap.set(String(row.teamId), {
                    code: "major",
                    label: "Major Position",
                    className: "qualification-major"
                });
            } else {
                remaining.push(row);
            }
        });
    });

    const wildcardCount = Number(slots.wildcard || 0);
    remaining
        .filter(row => !statusMap.has(String(row.teamId)))
        .sort((a, b) =>
            Number(b.splits[String(split)]?.totalPoints || 0) -
            Number(a.splits[String(split)]?.totalPoints || 0) ||
            compareCompletedLeagueTiebreaker(a, b) ||
            a.teamName.localeCompare(b.teamName)
        )
        .slice(0, wildcardCount)
        .forEach(row => {
            statusMap.set(String(row.teamId), {
                code: "major-wildcard",
                label: "Major Wildcard",
                className: "qualification-wildcard"
            });
        });

    return rows.map(row => ({
        ...row,
        qualification: statusMap.get(String(row.teamId)) || {
            code: "outside",
            label: "Outside Cut",
            className: "qualification-outside"
        }
    }));
}

function assignWorldsQualification(rows, context) {
    const statusMap = new Map();

    const direct = typeof getWorldsDirectQualifiers === "function"
        ? getWorldsDirectQualifiers()
        : [];
    const fixedPlayIn = typeof getWorldsFixedPlayInQualifiers === "function"
        ? getWorldsFixedPlayInQualifiers()
        : [];
    const lcqWinners = typeof getRegionalLcqWinners === "function"
        ? getRegionalLcqWinners()
        : [];
    const playInQualifiers = typeof getWorldsPlayInQualifiers === "function"
        ? getWorldsPlayInQualifiers()
        : [];

    direct.forEach(item => {
        statusMap.set(String(item.teamId), {
            code: "qualified",
            label: "Worlds Main Event",
            className: "qualification-qualified"
        });
    });

    if (playInQualifiers.length > 0) {
        playInQualifiers.forEach(item => {
            statusMap.set(String(item.teamId), {
                code: "qualified",
                label: "Qualified via Play-In",
                className: "qualification-qualified"
            });
        });
    } else {
        fixedPlayIn.forEach(item => {
            statusMap.set(String(item.teamId), {
                code: "playin",
                label: "Worlds Play-In",
                className: "qualification-wildcard"
            });
        });

        lcqWinners.forEach(item => {
            statusMap.set(String(item.teamId), {
                code: "playin",
                label: "Play-In via Regional LCQ",
                className: "qualification-wildcard"
            });
        });
    }

    const state = context.season;
    const lcqEvents = Array.isArray(state?.events)
        ? state.events.filter(event => event.type === "lcq")
        : [];

    lcqEvents.forEach(event => {
        const seedIds = new Set((event.lcqSeedIds || []).map(String));
        const winnerIds = new Set((event.qualifiedTeamIds || []).map(String));

        rows.forEach(row => {
            const id = String(row.teamId);
            if (!seedIds.has(id) || statusMap.has(id)) return;

            statusMap.set(id, {
                code: winnerIds.has(id) ? "playin" : "lcq",
                label: winnerIds.has(id)
                    ? "Regional LCQ Winner"
                    : event.status === "completed"
                        ? "Eliminated in Regional LCQ"
                        : "Regional LCQ",
                className: winnerIds.has(id)
                    ? "qualification-wildcard"
                    : "qualification-lcq"
            });
        });
    });

    return rows.map(row => ({
        ...row,
        qualification: statusMap.get(String(row.teamId)) || {
            code: "outside",
            label: "Outside Qualification",
            className: "qualification-outside"
        }
    }));
}

function getLeagueMajorSlots() {
    if (typeof getCompetitionMajorSlots === "function") {
        return {
            ...LEAGUE_MAJOR_SLOT_FALLBACK,
            ...getCompetitionMajorSlots(
                typeof getSeasonState === "function"
                    ? getSeasonState()
                    : null
            )
        };
    }

    const preset =
        typeof LAN_SLOT_PRESETS !== "undefined" && LAN_SLOT_PRESETS.major
            ? LAN_SLOT_PRESETS.major
            : LEAGUE_MAJOR_SLOT_FALLBACK;

    return { ...LEAGUE_MAJOR_SLOT_FALLBACK, ...preset };
}

function getQualificationFilterGroup(code) {
    if (["qualified", "major", "major-wildcard"].includes(code)) {
        return "qualified";
    }

    if (["playin", "lcq", "tiebreaker"].includes(code)) {
        return "lcq";
    }

    return "outside";
}

function getQualificationStatusOrder(code) {
    const group = getQualificationFilterGroup(code);
    if (group === "qualified") return 0;
    if (group === "lcq") return 1;
    return 2;
}

function getWorldsGroupLabel(group) {
    if (group === "qualified") return "Direct / Provisional Worlds Qualification";
    if (group === "lcq") return "Worlds Play-In / Regional LCQ";
    return "Outside Worlds Qualification";
}

/* ==========================
   TEAM DETAILS
========================== */

function renderLeagueTeamDetails(row, context, view) {
    const splitCards = context.splits.map(split => {
        const data = row.splits[split] || normaliseLeagueMetrics({});
        return `
            <div class="league-detail-stat">
                <span>Split ${split}</span>
                <strong>${data.totalPoints} pts</strong>
                <small>${data.regionalPoints} regional · ${data.lanPoints} Major</small>
            </div>
        `;
    }).join("");

    const recent = row.recentEvents.slice(0, 5);

    return `
        <div class="league-team-detail-panel" onclick="event.stopPropagation()">
            <div class="league-team-detail-header">
                <div>
                    <span class="league-eyebrow">Points Breakdown</span>
                    <h3>${escapeLeagueText(row.teamName)}</h3>
                </div>
                <button class="primary-button" onclick="openLeagueTeamProfile(${leagueJsString(row.teamId)})">
                    Open Team Profile
                </button>
            </div>

            <div class="league-detail-grid">
                ${splitCards}
                <div class="league-detail-stat form-detail">
                    <span>Current Form</span>
                    <strong>${escapeLeagueText(row.form.label)}</strong>
                    <small>
                        Previous ${formatLeagueSigned(row.form.previous)} ·
                        Live ${formatLeagueSigned(row.form.live)} ·
                        Total ${formatLeagueSigned(row.form.total)}
                    </small>
                </div>
            </div>

            <div class="league-detail-columns">
                <div>
                    <h4>Recent Points</h4>
                    ${recent.length > 0
                        ? recent.map(event => `
                            <div class="league-event-breakdown-row">
                                <div>
                                    <strong>${escapeLeagueText(event.name)}</strong>
                                    <span>${escapeLeagueText(event.typeLabel)} · ${escapeLeagueText(event.region)}</span>
                                </div>
                                <span class="league-event-placement">${formatLeaguePlacement(event.placement)}</span>
                                <strong>+${event.points}</strong>
                            </div>
                        `).join("")
                        : `<p class="small">No completed points events for this team yet.</p>`
                    }
                </div>

                <div>
                    <h4>Team Snapshot</h4>
                    <div class="league-snapshot-list">
                        <span><strong>${row.overall.totalPoints}</strong> season points</span>
                        <span><strong>${row.overall.eventsPlayed}</strong> events played</span>
                        <span><strong>${row.overall.eventWins}</strong> event wins</span>
                        <span><strong>${formatLeaguePlacement(row.overall.bestPlacement)}</strong> best finish</span>
                        <span><strong>${row.rating}</strong> base rating</span>
                        ${row.tiebreaker ? `
                            <button class="league-inline-link"
                                onclick="openLeagueTiebreaker('${escapeLeagueAttribute(row.tiebreaker.eventId || "")}')">
                                ${row.tiebreaker.status === "completed"
                                    ? `Tiebreaker rank: #${row.tiebreaker.rank}`
                                    : "Resolve points tiebreaker"}
                            </button>
                        ` : ""}
                    </div>
                </div>
            </div>
        </div>
    `;
}

/* ==========================
   HISTORY STATS + MOVEMENT
========================== */

function getLeagueHistoryRecords() {
    try {
        const parsed = JSON.parse(
            localStorage.getItem("rlcsTournamentHistory") || "[]"
        );
        const history = Array.isArray(parsed) ? parsed : [];
        const season = typeof getSeasonState === "function"
            ? getSeasonState()
            : null;

        if (!season?.id) return history;

        const eventIds = new Set(
            (season.events || []).map(event => String(event.id))
        );

        return history.filter(record => {
            if (record.event?.seasonId) {
                return String(record.event.seasonId) === String(season.id);
            }

            const seasonEventId =
                record.event?.seasonEventId ||
                record.seasonEventId;

            return seasonEventId && eventIds.has(String(seasonEventId));
        });
    } catch {
        return [];
    }
}

function buildLeagueHistoryStats(history) {
    const major = {};
    const events = {};

    history.forEach(record => {
        const type = record.event?.type || "custom";
        const region = record.event?.region || "GLOBAL";
        const split = String(record.event?.split || "1");

        (record.placements || []).forEach(placement => {
            const key = String(placement.teamId);
            const awarded = (record.pointsAwarded || []).find(item =>
                String(item.teamId) === key
            );
            const points = awarded
                ? Number(awarded.points || 0)
                : (type === "lcq" || type === "playin")
                    ? 0
                    : getEventPointsForPlacement(type, placement.placement);

            if (!events[key]) events[key] = [];

            events[key].push({
                recordId: record.id,
                name: record.event?.name || "Event",
                type,
                typeLabel: formatLeagueEventType(type),
                region,
                split,
                placement: Number(placement.placement || 0),
                points,
                completedAt: record.completedAt || record.date || ""
            });

            if (type === "major") {
                if (!major[key]) {
                    major[key] = {
                        points: 0,
                        events: 0,
                        wins: 0,
                        bestPlacement: null
                    };
                }

                major[key].points += points;
                major[key].events++;

                if (Number(placement.placement) === 1) {
                    major[key].wins++;
                }

                if (
                    !major[key].bestPlacement ||
                    Number(placement.placement) < major[key].bestPlacement
                ) {
                    major[key].bestPlacement = Number(placement.placement);
                }
            }
        });
    });

    Object.values(events).forEach(teamEvents => {
        teamEvents.sort((a, b) =>
            getLeagueDateValue(b.completedAt) - getLeagueDateValue(a.completedAt)
        );
    });

    return { major, events };
}

function applyLeagueMovement(rows, scopeRows, context, view, region) {
    const record = getLatestLeagueMovementRecord(
        context.history,
        view,
        context,
        region
    );

    if (!record) {
        rows.forEach(row => { row.movement = { value: 0, label: "—" }; });
        return;
    }

    const pointsAwarded = new Map(
        (record.pointsAwarded || []).map(item => [
            String(item.teamId),
            Number(item.points || 0)
        ])
    );

    const currentOrdered = [...scopeRows].sort((a, b) =>
        getLeaguePrimaryPoints(b, view, context) -
        getLeaguePrimaryPoints(a, view, context) ||
        a.teamName.localeCompare(b.teamName)
    );

    const previousOrdered = [...scopeRows].sort((a, b) => {
        const aPrevious = getLeaguePrimaryPoints(a, view, context) -
            getMovementDeduction(a, record, pointsAwarded, view, context);
        const bPrevious = getLeaguePrimaryPoints(b, view, context) -
            getMovementDeduction(b, record, pointsAwarded, view, context);

        return bPrevious - aPrevious || a.teamName.localeCompare(b.teamName);
    });

    const currentRanks = buildLeagueRankMap(currentOrdered, row =>
        getLeaguePrimaryPoints(row, view, context)
    );

    const previousRanks = buildLeagueRankMap(previousOrdered, row =>
        getLeaguePrimaryPoints(row, view, context) -
        getMovementDeduction(row, record, pointsAwarded, view, context)
    );

    rows.forEach(row => {
        const currentRank = currentRanks[String(row.teamId)] || 0;
        const previousRank = previousRanks[String(row.teamId)] || currentRank;
        const value = previousRank - currentRank;

        row.movement = {
            value,
            label: value > 0
                ? `↑ ${value}`
                : value < 0
                    ? `↓ ${Math.abs(value)}`
                    : "—",
            eventName: record.event?.name || "Latest Event"
        };
    });
}

function getLatestLeagueMovementRecord(history, view, context, region) {
    return history.find(record => {
        if (!Array.isArray(record.pointsAwarded) || record.pointsAwarded.length === 0) {
            return false;
        }

        if (["lcq", "playin"].includes(record.event?.type)) return false;

        const split = getLeagueViewSplit(view, context);

        if (split && String(record.event?.split || "1") !== String(split)) {
            return false;
        }

        if (view === "major" && record.event?.type !== "major") {
            return false;
        }

        if (view === "regional" && region && region !== "ALL") {
            return record.event?.region === region || record.event?.region === "GLOBAL";
        }

        return true;
    }) || null;
}

function getMovementDeduction(row, record, pointsAwarded, view, context) {
    const points = Number(pointsAwarded.get(String(row.teamId)) || 0);
    if (points <= 0) return 0;

    if (view === "major" && record.event?.type !== "major") return 0;

    const split = getLeagueViewSplit(view, context);
    if (split && String(record.event?.split || "1") !== String(split)) return 0;

    return points;
}

function buildLeagueRankMap(rows, metric) {
    const map = {};
    let previousValue = null;
    let rank = 0;

    rows.forEach((row, index) => {
        const value = Number(metric(row) || 0);
        if (index === 0 || value !== previousValue) {
            rank = index + 1;
        }
        map[String(row.teamId)] = rank;
        previousValue = value;
    });

    return map;
}

/* ==========================
   FORM + TIEBREAKERS
========================== */

function getLeagueTeamForm(team) {
    let previous = 0;
    let live = 0;
    let reset = false;

    try {
        if (typeof calculatePreviousTournamentForm === "function") {
            previous = Number(calculatePreviousTournamentForm(team) || 0);
        }

        const liveEntry = tournament?.teamForm?.teams?.[String(team.id)];
        if (tournament?.running && liveEntry) {
            live = Number(liveEntry.liveForm || 0);
        }

        if (typeof getStoredTeamFormState === "function") {
            const stored = getStoredTeamFormState()?.[String(team.id)];
            reset = Boolean(
                stored?.resetAt &&
                (!Array.isArray(stored.recentEvents) || stored.recentEvents.length === 0)
            );
        }
    } catch {
        previous = 0;
        live = 0;
    }

    const total = previous + live;
    let label = "Neutral";
    let tone = "neutral";
    let icon = "→";

    if (reset && Math.abs(total) < 0.01) {
        label = "Reset";
        tone = "reset";
        icon = "↻";
    } else if (total >= 3) {
        label = "Hot";
        tone = "hot";
        icon = "🔥";
    } else if (total >= 1) {
        label = "Improving";
        tone = "positive";
        icon = "↑";
    } else if (total <= -3) {
        label = "Cold";
        tone = "cold";
        icon = "❄";
    } else if (total <= -1) {
        label = "Declining";
        tone = "negative";
        icon = "↓";
    }

    return {
        previous,
        live,
        total,
        reset,
        label,
        tone,
        icon
    };
}

function getLeagueTiebreakerContext(season) {
    const empty = {
        event: null,
        groups: [],
        teamMap: {},
        unresolvedCount: 0
    };

    if (!season || typeof getSeasonTiebreakerGroupsForEvent !== "function") {
        return empty;
    }

    const event = typeof getNextAvailableSeasonEvent === "function"
        ? getNextAvailableSeasonEvent(season)
        : season.events?.find(item => item.status !== "completed");

    if (!event) return empty;

    let groups = [];

    try {
        groups = getSeasonTiebreakerGroupsForEvent(event, season) || [];
    } catch {
        groups = [];
    }

    const teamMap = {};

    groups.forEach(group => {
        const ranking = Array.isArray(group.ranking)
            ? group.ranking.map(String)
            : [];

        (group.teamIds || []).forEach(teamId => {
            const rankIndex = ranking.indexOf(String(teamId));

            teamMap[String(teamId)] = {
                eventId: String(event.id),
                eventName: event.name,
                signature: group.signature,
                points: Number(group.points || 0),
                status: group.status || "pending",
                rank: rankIndex >= 0 ? rankIndex + 1 : null,
                teamCount: group.teamIds?.length || 0
            };
        });
    });

    return {
        event,
        groups,
        teamMap,
        unresolvedCount: groups.filter(group => group.status !== "completed").length
    };
}

function renderLeagueTiebreakerBadge(tie) {
    if (!tie) return "";

    if (tie.status === "completed") {
        return `<span class="league-tb-badge resolved">TB #${tie.rank || "—"}</span>`;
    }

    return `<span class="league-tb-badge pending">TB</span>`;
}

function openLeagueTiebreaker(eventId) {
    if (!eventId) return;

    if (typeof showPage === "function") {
        showPage("season");
    }

    if (typeof focusSeasonTiebreaker === "function") {
        setTimeout(() => focusSeasonTiebreaker(eventId), 0);
    }
}

/* ==========================
   REGION PERFORMANCE
========================== */

function getLeagueRegionPerformance(context) {
    if (
        context.season &&
        typeof rankRegionsByMajorPerformance === "function"
    ) {
        try {
            return rankRegionsByMajorPerformance(context.season);
        } catch {
            // Fall through to local calculation.
        }
    }

    return LEAGUE_REGIONS.map(region => {
        const regionRows = context.rows.filter(row => row.region === region);
        return {
            region,
            majorPoints: regionRows.reduce(
                (sum, row) => sum + Number(row.majorStats.points || 0),
                0
            ),
            majorWins: regionRows.reduce(
                (sum, row) => sum + Number(row.majorStats.wins || 0),
                0
            ),
            bestMajorPlacement: Math.min(
                ...regionRows.map(row => normaliseBestPlacement(row.majorStats.bestPlacement)),
                999
            )
        };
    }).sort((a, b) =>
        b.majorPoints - a.majorPoints ||
        b.majorWins - a.majorWins ||
        a.bestMajorPlacement - b.bestMajorPlacement ||
        a.region.localeCompare(b.region)
    );
}

/* ==========================
   BADGES + HELPERS
========================== */

function renderLeagueFormBadge(form) {
    return `
        <span class="league-form-badge ${form.tone}"
            title="Previous ${formatLeagueSigned(form.previous)} · Live ${formatLeagueSigned(form.live)}">
            <span>${form.icon}</span>
            ${escapeLeagueText(form.label)}
            <small>${formatLeagueSigned(form.total)}</small>
        </span>
    `;
}

function renderLeagueMovement(movement) {
    if (!movement) return `<span class="league-movement neutral">—</span>`;

    const tone = movement.value > 0
        ? "up"
        : movement.value < 0
            ? "down"
            : "neutral";

    return `
        <span class="league-movement ${tone}"
            title="Movement after ${escapeLeagueAttribute(movement.eventName || "the latest event")}">
            ${escapeLeagueText(movement.label)}
        </span>
    `;
}

function renderLeagueQualificationBadge(status) {
    if (!status) return `<span class="league-status-badge neutral">—</span>`;

    return `
        <span class="league-status-badge ${escapeLeagueAttribute(status.code || "neutral")}">
            ${escapeLeagueText(status.label || "—")}
        </span>
    `;
}

function formatLeaguePlacement(value) {
    const placement = Number(value || 0);
    if (!placement) return "—";

    const suffix = placement % 100 >= 11 && placement % 100 <= 13
        ? "th"
        : placement % 10 === 1
            ? "st"
            : placement % 10 === 2
                ? "nd"
                : placement % 10 === 3
                    ? "rd"
                    : "th";

    return `${placement}${suffix}`;
}

function formatLeagueSigned(value) {
    const rounded = Math.round(Number(value || 0) * 10) / 10;
    return `${rounded > 0 ? "+" : ""}${rounded.toFixed(1)}`;
}

function formatLeagueEventType(type) {
    const labels = {
        regional: "Regional",
        major: "Major",
        worlds: "World Championship",
        lcq: "Regional LCQ",
        playin: "Worlds Play-In",
        custom: "Custom Event"
    };

    return labels[type] || "Event";
}

function getLeagueCurrentSplit(season, splits) {
    if (!season?.events?.length) return splits[0] || "1";

    const next = typeof getNextAvailableSeasonEvent === "function"
        ? getNextAvailableSeasonEvent(season)
        : season.events.find(event => event.status !== "completed");

    if (next && /^\d+$/.test(String(next.split || ""))) {
        return String(next.split);
    }

    const completedNumeric = season.events
        .filter(event => event.status === "completed" && /^\d+$/.test(String(event.split || "")))
        .map(event => Number(event.split));

    return String(Math.max(1, ...completedNumeric, 1));
}

function getLeagueDateValue(value) {
    const timestamp = Date.parse(value || "");
    return Number.isFinite(timestamp) ? timestamp : 0;
}

function openLeagueTeamProfile(teamId) {
    if (typeof dashboardOpenTeamProfile === "function") {
        dashboardOpenTeamProfile(teamId);
        return;
    }

    if (typeof showPage === "function") {
        showPage("profiles");
    }

    const select = document.getElementById("profileTeamSelect");
    if (select) select.value = String(teamId);

    if (typeof renderSelectedTeamProfile === "function") {
        renderSelectedTeamProfile();
    }
}

/* ==========================
   RESET / REBUILD
========================== */

function clearLeaguePoints() {

    const confirmed =
        confirm(
            "Reset all league points? Event history will stay saved."
        );

    if (!confirmed) return;

    localStorage.removeItem(
        LEAGUE_POINTS_KEY
    );

    renderLeagueTable();

    if (
        typeof renderLanQualification ===
        "function"
    ) {
        renderLanQualification();
    }

    if (
        typeof renderTeamProfiles ===
        "function"
    ) {
        renderTeamProfiles();
    }

}

function getLeagueHistoryForPointsRebuild() {
    try {
        const parsed = JSON.parse(
            localStorage.getItem(
                "rlcsTournamentHistory"
            ) || "[]"
        );

        return Array.isArray(parsed)
            ? parsed
            : [];
    } catch {
        return [];
    }
}

function saveLeagueHistoryAfterPointsRebuild(history) {
    if (
        typeof saveCompactTournamentHistory === "function"
    ) {
        saveCompactTournamentHistory(history);
        return;
    }

    localStorage.setItem(
        "rlcsTournamentHistory",
        JSON.stringify(history)
    );
}

function refreshLeaguePointsDependentViews() {
    const renderers = [
        "renderLeagueTable",
        "renderHistory",
        "renderLanQualification",
        "renderTeamProfiles",
        "updateDashboard"
    ];

    renderers.forEach(name => {
        if (typeof window[name] !== "function") return;

        try {
            window[name]();
        } catch (error) {
            console.error(
                `Failed to refresh ${name}:`,
                error
            );
        }
    });
}

function rebuildLeaguePointsFromHistorySilently(
    options = {}
) {
    const {
        refresh = true,
        history: suppliedHistory = null
    } = options;

    localStorage.removeItem(
        LEAGUE_POINTS_KEY
    );

    const history = Array.isArray(suppliedHistory)
        ? suppliedHistory
        : getLeagueHistoryForPointsRebuild();

    const season = typeof getSeasonState === "function"
        ? getSeasonState()
        : null;

    /*
        Preserve archived-season point summaries, but remove point displays
        from standalone events because those events are not league events.
    */
    history.forEach(record => {
        const hasSeasonLink = Boolean(
            getLeagueRecordSeasonEventId(record) ||
            record?.event?.seasonId ||
            record?.seasonId
        );

        if (!hasSeasonLink) {
            record.pointsAwarded = [];
        }
    });

    history
        .filter(record =>
            isLeaguePointsEligibleRecord(
                record,
                season
            )
        )
        .slice()
        .reverse()
        .forEach(record => {
            record.pointsAwarded =
                awardEventPoints(record);
        });

    saveLeagueHistoryAfterPointsRebuild(history);

    localStorage.setItem(
        LEAGUE_POINTS_SCOPE_VERSION_KEY,
        String(LEAGUE_POINTS_SCOPE_VERSION)
    );

    if (refresh) {
        refreshLeaguePointsDependentViews();
    }

    return history;
}

function rebuildLeaguePointsFromHistory() {
    const confirmed =
        confirm(
            "Rebuild current-season league points from Season Mode event history? Standalone events will keep their History records but receive no standings points."
        );

    if (!confirmed) return;

    rebuildLeaguePointsFromHistorySilently();

    alert(
        "Current-season league points were rebuilt successfully. Standalone events were excluded."
    );
}

function ensureSeasonOnlyLeaguePointsMigration() {
    const savedVersion = Number(
        localStorage.getItem(
            LEAGUE_POINTS_SCOPE_VERSION_KEY
        ) || 0
    );

    if (
        savedVersion >=
        LEAGUE_POINTS_SCOPE_VERSION
    ) {
        return false;
    }

    try {
        rebuildLeaguePointsFromHistorySilently({
            refresh: false
        });
        return true;
    } catch (error) {
        console.error(
            "Unable to migrate league points to Season-only scoring:",
            error
        );
        return false;
    }
}

/* ==========================
   ESCAPING
========================== */

function escapeLeagueText(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}

function escapeLeagueAttribute(value) {
    return escapeLeagueText(value);
}

function leagueJsString(value) {
    return JSON.stringify(String(value ?? ""));
}

window.getLeagueState = getLeagueState;
window.awardEventPoints = awardEventPoints;
window.isLeaguePointsEligibleRecord = isLeaguePointsEligibleRecord;
window.rebuildLeaguePointsFromHistorySilently =
    rebuildLeaguePointsFromHistorySilently;
window.getEventPointsForPlacement = getEventPointsForPlacement;
window.renderLeagueTable = renderLeagueTable;
window.setLeagueTableView = setLeagueTableView;
window.setLeagueTableRegion = setLeagueTableRegion;
window.setLeagueTableSort = setLeagueTableSort;
window.setLeagueTableStatus = setLeagueTableStatus;
window.setLeagueTableSearch = setLeagueTableSearch;
window.toggleLeagueCompactView = toggleLeagueCompactView;
window.toggleLeagueTeamDetails = toggleLeagueTeamDetails;
window.openLeagueTeamProfile = openLeagueTeamProfile;
window.openLeagueTiebreaker = openLeagueTiebreaker;
window.rebuildLeaguePointsFromHistory = rebuildLeaguePointsFromHistory;
window.clearLeaguePoints = clearLeaguePoints;

window.addEventListener("load", () => {
    setTimeout(() => {
        const migrated =
            ensureSeasonOnlyLeaguePointsMigration();

        renderLeagueTable();

        if (
            migrated &&
            typeof renderHistory === "function"
        ) {
            renderHistory();
        }
    }, 900);
});
