const tournament = {
    format: "roundRobin",
    effectiveFormat: "roundRobin",
    seriesLength: 5,
	
	stageSeries: {
    default: 5,
    swiss: 5,
    playoffs: 7,
    currentStage: "default"
},

    selectedTeams: [],
    seedings: [],
    manualSeedingOverride: false,
    participants: [],

    matches: [],
    standings: [],
    playerStats: {},

    bracket: {
        roundOf16: [],
        quarterFinals: [],
        semiFinals: [],
        grandFinal: null,
        champion: null
    },

    swiss: {
        rounds: [],
        currentRound: 0,
        maxRounds: 5,
        qualifiedTeams: [],
        eliminatedTeams: [],
        advanceToPlayoffs: false,
        playoffTeams: []
    },

    doubleElim: {
        size: 0,
        rounds: [],
        champion: null,
        finalPlacements: []
    },

    groupStage: {
        active: false,
        playoffStyle: "hybrid",
        groups: [],
        playoffRounds: {},
        finalPlacements: [],
        champion: null,
        runnerUp: null
    },

    playIn: {
        active: false,
        seeds: [],
        upperQuarterfinals: [],
        upperSemifinals: [],
        lowerQuarterfinals: [],
        lowerSemifinals: [],
        qualifiedTeams: [],
        eliminatedTeams: [],
        finalPlacements: []
    },

    round: "Setup",
    running: false,

    champion: null,
    mvp: null,
    savedToHistory: false,
    currentEvent: null,

    teamForm: {
        eventRunId: null,
        teams: {},
        finalised: false
    },

    chemistry: {
        eventRunId: null,
        teams: {},
        finalised: false
    },

    manualResults: []
};

/* ==========================
   TEAM SELECTION
========================== */

function renderTournamentTeams() {

    const container =
        document.getElementById("tournamentTeams");

    if (!container) return;

    if (
        typeof teams === "undefined" ||
        !teams ||
        teams.length === 0
    ) {
        container.innerHTML = `
            <p class="small">
                No teams created yet. Create teams first.
            </p>
        `;
        return;
    }

    container.innerHTML =
        teams.map(team => `
            <div
                class="
                    tournament-team-card
                    ${
                        tournament.selectedTeams.includes(team.id)
                        ? "selected-team"
                        : ""
                    }
                "
                onclick="toggleTeam(${team.id})"
            >

                ${
                    team.logo
                    ? `
                        <img
                            src="${team.logo}"
                            class="tournament-team-logo"
                        >
                    `
                    : `
                        <div class="tournament-team-logo"></div>
                    `
                }

                <div class="tournament-team-name">
                    ${safeText(team.name)}
                </div>

                <div class="tournament-team-rating">
                    Rating: ${team.rating}
                </div>

                <div class="tournament-team-region">
                    ${safeText(team.region)}
                </div>

            </div>
        `).join("");

}

function toggleTeam(id) {

    if (tournament.running) return;

    if (tournament.selectedTeams.includes(id)) {

        tournament.selectedTeams =
            tournament.selectedTeams.filter(teamId =>
                teamId !== id
            );

    } else {

        tournament.selectedTeams.push(id);

    }

    tournament.manualSeedingOverride = false;

    syncSeedings();
    renderTournamentTeams();
    renderSeedings();

}

/* ==========================
   SEEDING SYSTEM
========================== */

function getAutomaticSeedingContext() {

    const currentEvent =
        tournament.currentEvent || {};

    const type =
        document.getElementById("eventType")?.value ||
        currentEvent.type ||
        "custom";

    const split =
        currentEvent.split ||
        document.getElementById("eventSplit")?.value ||
        "1";

    const format =
        document.getElementById("tournamentFormat")?.value ||
        currentEvent.format ||
        tournament.format ||
        "roundRobin";

    return {
        eventId: String(
            currentEvent.seasonEventId ||
            currentEvent.id ||
            (typeof getCurrentSeasonEventId === "function"
                ? getCurrentSeasonEventId() || ""
                : "")
        ),
        seasonEventId: String(
            currentEvent.seasonEventId ||
            currentEvent.id ||
            (typeof getCurrentSeasonEventId === "function"
                ? getCurrentSeasonEventId() || ""
                : "")
        ),
        type: String(type),
        split: String(split),
        format: String(format)
    };

}

function isFixedLcqSeeding(context = getAutomaticSeedingContext()) {

    return (
        context.type === "lcq" ||
        context.format === "regionalLcq"
    );

}

function getAutomaticSeedingState() {

    if (typeof getLeagueState === "function") {
        return getLeagueState();
    }

    try {
        return JSON.parse(
            localStorage.getItem("rlcsLeaguePoints") ||
            '{"teams":{},"awardedEvents":[]}'
        );
    } catch {
        return {
            teams: {},
            awardedEvents: []
        };
    }

}

function getAutomaticSeedingMetrics(
    team,
    context = getAutomaticSeedingContext(),
    state = getAutomaticSeedingState()
) {

    const entry =
        state?.teams?.[String(team?.id)] ||
        null;

    const useSeasonPoints =
        context.type === "worlds" ||
        context.type === "custom" ||
        context.split === "season" ||
        context.split === "all";

    const splitEntry =
        entry?.splits?.[String(context.split)] ||
        null;

    const points = useSeasonPoints
        ? Number(entry?.totalPoints || 0)
        : Number(splitEntry?.totalPoints || 0);

    const eventWins = useSeasonPoints
        ? Number(entry?.eventWins || 0)
        : Number(splitEntry?.eventWins || 0);

    const bestPlacement = useSeasonPoints
        ? Number(entry?.bestPlacement || Infinity)
        : Number(splitEntry?.bestPlacement || Infinity);

    return {
        points,
        eventWins,
        bestPlacement,
        totalPoints: Number(entry?.totalPoints || 0),
        rating: Number(team?.rating || entry?.rating || 0)
    };

}

function getAutomaticSeedingPoints(
    team,
    context = getAutomaticSeedingContext()
) {

    return getAutomaticSeedingMetrics(
        team,
        context
    ).points;

}

function getAutomaticSeedingLabel(
    context = getAutomaticSeedingContext()
) {

    if (isFixedLcqSeeding(context)) {
        return "LCQ qualification seed";
    }

    if (
        context.type === "worlds" ||
        context.type === "custom" ||
        context.split === "season" ||
        context.split === "all"
    ) {
        return "Season Points";
    }

    return `Split ${context.split} Points`;

}

function sortTeamsForAutomaticSeeding(
    teamList,
    context = getAutomaticSeedingContext()
) {

    if (!Array.isArray(teamList)) {
        return [];
    }

    if (isFixedLcqSeeding(context)) {
        return [...teamList];
    }

    const state =
        getAutomaticSeedingState();

    const mappedTeams = teamList.map((team, originalIndex) => ({
        team,
        originalIndex,
        metrics: getAutomaticSeedingMetrics(
            team,
            context,
            state
        )
    }));

    const seasonEventId =
        context.eventId ||
        context.seasonEventId ||
        (
            typeof getCurrentSeasonEventId === "function"
                ? getCurrentSeasonEventId()
                : null
        );

    const isSeasonEvent = Boolean(seasonEventId);
    const allTeamsHaveZeroPoints = mappedTeams.every(item =>
        Number(item.metrics.points || 0) === 0
    );

    const tiebreakerRankMap = (
        isSeasonEvent &&
        typeof getSeasonTiebreakerRankMapForTeams === "function"
    )
        ? getSeasonTiebreakerRankMapForTeams(
            teamList,
            {
                ...context,
                eventId: String(seasonEventId),
                seasonEventId: String(seasonEventId)
            }
        )
        : {};

    return mappedTeams
        .sort((a, b) => {
            if (b.metrics.points !== a.metrics.points) {
                return b.metrics.points - a.metrics.points;
            }

            if (isSeasonEvent) {
                const aRank = tiebreakerRankMap[String(a.team?.id)];
                const bRank = tiebreakerRankMap[String(b.team?.id)];
                const aHasRank = Number.isFinite(Number(aRank));
                const bHasRank = Number.isFinite(Number(bRank));

                const aRegion = String(a.team?.region || "").trim().toUpperCase();
                const bRegion = String(b.team?.region || "").trim().toUpperCase();
                const sameRegion = Boolean(
                    aRegion &&
                    bRegion &&
                    aRegion === bRegion
                );

                if (
                    sameRegion &&
                    aHasRank &&
                    bHasRank &&
                    Number(aRank) !== Number(bRank)
                ) {
                    return Number(aRank) - Number(bRank);
                }

                /*
                    Regional tiebreaker results only order teams from the
                    same region. Equal points across different regions keep
                    their existing qualification order.

                    The opening event has no season points yet, so rating is
                    used only for the initial seed.
                */
                if (allTeamsHaveZeroPoints) {
                    return (
                        b.metrics.rating - a.metrics.rating ||
                        String(a.team?.name || "").localeCompare(
                            String(b.team?.name || "")
                        ) ||
                        a.originalIndex - b.originalIndex
                    );
                }

                return a.originalIndex - b.originalIndex;
            }

            return (
                b.metrics.eventWins - a.metrics.eventWins ||
                a.metrics.bestPlacement - b.metrics.bestPlacement ||
                b.metrics.totalPoints - a.metrics.totalPoints ||
                b.metrics.rating - a.metrics.rating ||
                String(a.team?.name || "").localeCompare(
                    String(b.team?.name || "")
                ) ||
                a.originalIndex - b.originalIndex
            );
        })
        .map(item => item.team);

}

function syncSeedings(forceAutomatic = false) {

    if (
        typeof teams === "undefined" ||
        !Array.isArray(teams)
    ) {
        tournament.seedings = [];
        return;
    }

    const selectedIdSet = new Set(
        tournament.selectedTeams.map(id =>
            String(id)
        )
    );

    const selected =
        teams.filter(team =>
            selectedIdSet.has(String(team.id))
        );

    const context =
        getAutomaticSeedingContext();

    const preserveExistingOrder =
        isFixedLcqSeeding(context) ||
        (
            tournament.manualSeedingOverride &&
            !forceAutomatic
        );

    if (!preserveExistingOrder) {
        tournament.seedings =
            sortTeamsForAutomaticSeeding(
                selected,
                context
            );
        return;
    }

    const existingStillSelected =
        tournament.seedings.filter(team =>
            selectedIdSet.has(String(team.id))
        );

    const existingIds = new Set(
        existingStillSelected.map(team =>
            String(team.id)
        )
    );

    const newTeams =
        selected.filter(team =>
            !existingIds.has(String(team.id))
        );

    tournament.seedings = [
        ...existingStillSelected,
        ...sortTeamsForAutomaticSeeding(
            newTeams,
            context
        )
    ];

}

function renderSeedings() {

    const container =
        document.getElementById("seedingList");

    if (!container) return;

    syncSeedings();

    if (tournament.seedings.length === 0) {
        container.innerHTML = `
            <p class="small">
                Select teams to create seedings.
            </p>
        `;
        renderSeedingMatchupPreview();
        return;
    }

    const context =
        getAutomaticSeedingContext();

    const pointsLabel =
        getAutomaticSeedingLabel(context);

    container.innerHTML =
        tournament.seedings.map((team, index) => {

            const points =
                getAutomaticSeedingPoints(
                    team,
                    context
                );

            return `
                <div class="seed-card">

                    <div class="seed-number">
                        #${index + 1}
                    </div>

                    ${
                        team.logo
                        ? `
                            <img
                                src="${team.logo}"
                                class="seed-logo"
                            >
                        `
                        : `
                            <div class="seed-logo"></div>
                        `
                    }

                    <div class="seed-info">

                        <strong>
                            ${safeText(team.name)}
                        </strong>

                        <span>
                            ${safeText(team.region)}
                            |
                            ${safeText(pointsLabel)}: ${points}
                            |
                            Rating ${team.rating}
                        </span>

                    </div>

                    <div class="seed-actions">

                        <button
                            onclick="moveSeed(${index}, -1)"
                            ${index === 0 ? "disabled" : ""}
                            title="Manually override automatic seeding"
                        >
                            ↑
                        </button>

                        <button
                            onclick="moveSeed(${index}, 1)"
                            ${
                                index === tournament.seedings.length - 1
                                ? "disabled"
                                : ""
                            }
                            title="Manually override automatic seeding"
                        >
                            ↓
                        </button>

                    </div>

                </div>
            `;
        }).join("");

    renderSeedingMatchupPreview();

}

/* ==========================
   SEEDING MATCHUP PREVIEW
========================== */

function renderSeedingMatchupPreview() {
    const container =
        document.getElementById(
            "seedingMatchupPreview"
        );

    if (!container) return;

    const setup = getSeedingPreviewSetup();
    const seededTeams = setup.teams;

    if (seededTeams.length === 0) {
        container.innerHTML = `
            <div class="seeding-preview-empty">
                Select teams to preview groups and opening matchups.
            </div>
        `;
        return;
    }

    if (
        setup.format === "groupsHybrid" ||
        setup.format === "groupsDoubleElim"
    ) {
        container.innerHTML =
            renderGroupSeedingPreview(seededTeams);
        return;
    }

    if (setup.format === "roundRobin") {
        container.innerHTML = `
            <div class="seeding-preview-header">
                <div>
                    <span class="seeding-preview-kicker">Schedule Preview</span>
                    <h4>Round Robin Field</h4>
                </div>
                <span class="seeding-preview-count">
                    ${seededTeams.length} teams
                </span>
            </div>

            <div class="seeding-preview-note">
                Every selected team plays every other selected team. Seed order
                controls the displayed field order, but does not create a fixed
                elimination matchup.
            </div>
        `;
        return;
    }

    if (setup.format === "regionalLcq") {
        container.innerHTML =
            renderLcqSeedingPreview(seededTeams);
        return;
    }

    const pairs = setup.format === "worldsPlayIn"
        ? buildIndexedSeedingPreviewPairs(
            seededTeams,
            [
                [0, 7],
                [3, 4],
                [1, 6],
                [2, 5]
            ]
        )
        : buildHighLowSeedingPreviewPairs(
            seededTeams
        );

    container.innerHTML = `
        <div class="seeding-preview-header">
            <div>
                <span class="seeding-preview-kicker">Matchup Preview</span>
                <h4>${safeText(getSeedingPreviewRoundLabel(setup.format))}</h4>
            </div>
            <span class="seeding-preview-count">
                ${pairs.length} matchups
            </span>
        </div>

        <div class="seeding-matchup-grid">
            ${pairs.map((pair, index) =>
                renderSeedingPreviewMatch(
                    pair,
                    index + 1
                )
            ).join("")}
        </div>
    `;
}

function getSeedingPreviewSetup() {
    let format =
        document.getElementById(
            "tournamentFormat"
        )?.value ||
        tournament.format ||
        "roundRobin";

    let teamsForPreview =
        [...(tournament.seedings || [])];

    if (format === "custom") {
        format =
            document.getElementById(
                "customBaseFormat"
            )?.value ||
            "playoffs";

        const customSize = Number(
            document.getElementById(
                "customBracketSize"
            )?.value ||
            teamsForPreview.length
        );

        teamsForPreview =
            teamsForPreview.slice(0, customSize);
    }

    if (
        format === "groupsHybrid" ||
        format === "groupsDoubleElim"
    ) {
        teamsForPreview = teamsForPreview.slice(0, 16);
    } else if (format === "regionalLcq") {
        teamsForPreview = teamsForPreview.slice(0, 6);
    } else if (format === "worldsPlayIn") {
        teamsForPreview = teamsForPreview.slice(0, 8);
    } else if (format === "doubleElim") {
        teamsForPreview = teamsForPreview.slice(
            0,
            teamsForPreview.length >= 8 ? 8 : 4
        );
    } else if (format === "playoffs") {
        const bracketSize = teamsForPreview.length >= 16
            ? 16
            : teamsForPreview.length >= 8
                ? 8
                : teamsForPreview.length >= 4
                    ? 4
                    : teamsForPreview.length;

        teamsForPreview = teamsForPreview.slice(
            0,
            bracketSize
        );
    }

    return {
        format,
        teams: teamsForPreview
    };
}

function getSeedingPreviewRoundLabel(format) {
    const labels = {
        playoffs: "Single-Elimination Round 1",
        doubleElim: "Upper-Bracket Round 1",
        swiss: "Swiss Round 1",
        swissPlayoffs: "Swiss Round 1",
        worldsPlayIn: "Upper-Bracket Quarterfinals"
    };

    return labels[format] || "Round 1 Matchups";
}

function buildIndexedSeedingPreviewPairs(
    teamList,
    pairIndexes
) {
    return pairIndexes
        .map(([indexA, indexB]) => ({
            teamA: teamList[indexA] || null,
            seedA: teamList[indexA] ? indexA + 1 : null,
            teamB: teamList[indexB] || null,
            seedB: teamList[indexB] ? indexB + 1 : null
        }))
        .filter(pair => pair.teamA || pair.teamB);
}

function buildHighLowSeedingPreviewPairs(teamList) {
    const seeded = [...teamList];
    const pairs = [];

    let highIndex = 0;
    let lowIndex = seeded.length - 1;

    while (highIndex < lowIndex) {
        pairs.push({
            teamA: seeded[highIndex],
            seedA: highIndex + 1,
            teamB: seeded[lowIndex],
            seedB: lowIndex + 1
        });

        highIndex++;
        lowIndex--;
    }

    if (highIndex === lowIndex) {
        pairs.push({
            teamA: seeded[highIndex],
            seedA: highIndex + 1,
            teamB: null,
            seedB: null,
            bye: true
        });
    }

    return pairs;
}

function renderGroupSeedingPreview(teamList) {
    const groups = [[], [], [], []];
    const groupNames = [
        "Group A",
        "Group B",
        "Group C",
        "Group D"
    ];

    teamList.forEach((team, index) => {
        const pot = Math.floor(index / 4);
        const position = index % 4;
        const groupIndex = pot % 2 === 0
            ? position
            : 3 - position;

        groups[groupIndex].push({
            team,
            seed: index + 1
        });
    });

    return `
        <div class="seeding-preview-header">
            <div>
                <span class="seeding-preview-kicker">Live Group Draw</span>
                <h4>Groups &amp; Round 1 Matchups</h4>
            </div>
            <span class="seeding-preview-count">
                ${teamList.length} / 16 teams
            </span>
        </div>

        <div class="seeding-group-preview-grid">
            ${groups.map((group, groupIndex) => {
                const firstMatch = {
                    teamA: group[0]?.team || null,
                    seedA: group[0]?.seed || null,
                    teamB: group[3]?.team || null,
                    seedB: group[3]?.seed || null
                };

                const secondMatch = {
                    teamA: group[1]?.team || null,
                    seedA: group[1]?.seed || null,
                    teamB: group[2]?.team || null,
                    seedB: group[2]?.seed || null
                };

                return `
                    <section class="seeding-group-preview-card">
                        <div class="seeding-group-preview-title">
                            <strong>${groupNames[groupIndex]}</strong>
                            <span>${group.length} teams</span>
                        </div>

                        <div class="seeding-group-team-list">
                            ${[0, 1, 2, 3].map(position =>
                                renderSeedingPreviewTeamRow(
                                    group[position]?.team || null,
                                    group[position]?.seed || null
                                )
                            ).join("")}
                        </div>

                        <div class="seeding-group-round-title">
                            Round 1
                        </div>

                        ${renderSeedingPreviewMatch(firstMatch, 1, true)}
                        ${renderSeedingPreviewMatch(secondMatch, 2, true)}
                    </section>
                `;
            }).join("")}
        </div>
    `;
}

function renderLcqSeedingPreview(teamList) {
    const seeded = teamList.map((team, index) => ({
        team,
        seed: index + 1
    }));

    const pairs = [
        {
            teamA: seeded[2]?.team || null,
            seedA: 3,
            teamB: seeded[5]?.team || null,
            seedB: 6
        },
        {
            teamA: seeded[3]?.team || null,
            seedA: 4,
            teamB: seeded[4]?.team || null,
            seedB: 5
        }
    ];

    return `
        <div class="seeding-preview-header">
            <div>
                <span class="seeding-preview-kicker">LCQ Preview</span>
                <h4>Defenders &amp; Challenger Round</h4>
            </div>
            <span class="seeding-preview-count">
                ${teamList.length} / 6 teams
            </span>
        </div>

        <div class="seeding-lcq-defenders">
            ${[0, 1].map(index => `
                <div class="seeding-lcq-defender-card">
                    <span>Defender Seed #${index + 1}</span>
                    ${renderSeedingPreviewTeamRow(
                        seeded[index]?.team || null,
                        index + 1
                    )}
                    <small>Bye to qualification match</small>
                </div>
            `).join("")}
        </div>

        <div class="seeding-group-round-title">
            Challenger Round
        </div>

        <div class="seeding-matchup-grid">
            ${pairs.map((pair, index) =>
                renderSeedingPreviewMatch(
                    pair,
                    index + 1
                )
            ).join("")}
        </div>
    `;
}

function renderSeedingPreviewMatch(
    pair,
    matchNumber,
    compact = false
) {
    return `
        <div class="seeding-preview-match ${compact ? "compact" : ""}">
            <span class="seeding-preview-match-label">
                Match ${matchNumber}
            </span>

            ${renderSeedingPreviewTeamRow(
                pair.teamA,
                pair.seedA
            )}

            <div class="seeding-preview-versus">
                ${pair.bye ? "BYE" : "VS"}
            </div>

            ${renderSeedingPreviewTeamRow(
                pair.teamB,
                pair.seedB,
                pair.bye ? "Bye" : "TBD"
            )}
        </div>
    `;
}

function renderSeedingPreviewTeamRow(
    team,
    seed,
    emptyLabel = "TBD"
) {
    if (!team) {
        return `
            <div class="seeding-preview-team empty">
                <span class="seeding-preview-seed">—</span>
                <div class="seeding-preview-logo"></div>
                <span>${safeText(emptyLabel)}</span>
            </div>
        `;
    }

    return `
        <div class="seeding-preview-team">
            <span class="seeding-preview-seed">
                #${seed}
            </span>

            ${team.logo
                ? `<img src="${team.logo}" class="seeding-preview-logo" alt="">`
                : `<div class="seeding-preview-logo"></div>`}

            <span title="${safeText(team.name)}">
                ${safeText(team.name)}
            </span>
        </div>
    `;
}

function moveSeed(index, direction) {

    if (tournament.running) return;

    const newIndex =
        index + direction;

    if (
        newIndex < 0 ||
        newIndex >= tournament.seedings.length
    ) {
        return;
    }

    const temp =
        tournament.seedings[index];

    tournament.seedings[index] =
        tournament.seedings[newIndex];

    tournament.seedings[newIndex] =
        temp;

    tournament.manualSeedingOverride = true;

    renderSeedings();

    if (typeof renderTournamentTeams === "function") {
        renderTournamentTeams();
    }

}

function resetSeedingsToPoints() {

    if (tournament.running) return;

    tournament.manualSeedingOverride = false;
    syncSeedings(true);
    renderSeedings();

    if (typeof renderTournamentTeams === "function") {
        renderTournamentTeams();
    }

}

/* ==========================
   STAGE SERIES FORMATS
========================== */

function initialiseStageSeriesSettings() {

    const defaultSeries =
        getDefaultSeriesLength();

    const swissSeries =
        getSwissSeriesLength();

    const playoffSeries =
        getPlayoffSeriesLength();

    tournament.stageSeries = {
        default: defaultSeries,
        swiss: swissSeries,
        playoffs: playoffSeries,
        currentStage: "default"
    };

}

function getDefaultSeriesLength() {

    const input =
        document.getElementById("seriesFormat");

    return input
        ? Number(input.value)
        : 5;

}

function getSwissSeriesLength() {

    const input =
        document.getElementById("swissSeriesFormat");

    return input
        ? Number(input.value)
        : getDefaultSeriesLength();

}

function getPlayoffSeriesLength() {

    const input =
        document.getElementById("playoffSeriesFormat");

    return input
        ? Number(input.value)
        : getDefaultSeriesLength();

}

function setTournamentSeriesLengthForStage(stageName) {

    if (!tournament.stageSeries) {
        initialiseStageSeriesSettings();
    }

    if (
        stageName === "swiss" ||
        stageName === "groups"
    ) {

        tournament.seriesLength =
            tournament.stageSeries.swiss;

        tournament.stageSeries.currentStage =
            stageName;

        return;

    }

    if (stageName === "playoffs") {

        tournament.seriesLength =
            tournament.stageSeries.playoffs;

        tournament.stageSeries.currentStage =
            "playoffs";

        return;

    }

    tournament.seriesLength =
        tournament.stageSeries.default;

    tournament.stageSeries.currentStage =
        "default";

}

function updateStageSeriesSettingsVisibility() {

    const settings =
        document.getElementById(
            "stageSeriesSettings"
        );

    const formatInput =
        document.getElementById(
            "tournamentFormat"
        );

    if (!settings || !formatInput) return;

    const stagedFormats = [
        "swissPlayoffs",
        "groupsHybrid",
        "groupsDoubleElim"
    ];

    const openingLabel =
        document.getElementById(
            "openingStageSeriesLabel"
        );

    if (stagedFormats.includes(formatInput.value)) {
        settings.classList.remove("hidden");
    } else {
        settings.classList.add("hidden");
    }

    if (openingLabel) {
        openingLabel.textContent =
            formatInput.value === "swissPlayoffs"
            ? "Swiss Stage Series"
            : "Group Stage Series";
    }

}

/* ==========================
   START TOURNAMENT
========================== */

function startTournament() {

    if (tournament.running) return;

    if (tournament.selectedTeams.length < 2) {
        alert("Select at least 2 teams.");
        return;
    }

    const seriesSelect =
        document.getElementById("seriesFormat");

    tournament.seriesLength =
        seriesSelect
        ? Number(seriesSelect.value)
        : 5;

    const formatSelect =
        document.getElementById("tournamentFormat");

    tournament.format =
        formatSelect
        ? formatSelect.value
        : "roundRobin";

    tournament.effectiveFormat =
        tournament.format;

    syncSeedings();

    tournament.participants =
        tournament.seedings
            .map(seededTeam =>
                teams.find(team =>
                    String(team.id) === String(seededTeam.id)
                )
            )
            .filter(Boolean);

    tournament.running = true;
    tournament.champion = null;
    tournament.mvp = null;
    tournament.savedToHistory = false;

    tournament.teamForm = createEmptyTournamentFormContext();

    if (typeof createEmptyTournamentChemistryContext === "function") {
        tournament.chemistry = createEmptyTournamentChemistryContext();
    }

    tournament.manualResults = [];

    tournament.matches = [];
    tournament.standings = [];

    tournament.bracket = {
        roundOf16: [],
        quarterFinals: [],
        semiFinals: [],
        grandFinal: null,
        champion: null
    };

    tournament.swiss = {
        rounds: [],
        currentRound: 0,
        maxRounds: 5,
        qualifiedTeams: [],
        eliminatedTeams: [],
        advanceToPlayoffs: false,
        playoffTeams: []
    };

    tournament.doubleElim = {
        size: 0,
        rounds: [],
        champion: null,
        finalPlacements: []
    };

    initialisePlayerStats(
        tournament.participants
    );

    clearTournamentUI();
    renderPlayerStats();

    if (tournament.format === "playoffs") {

        startPlayoffs(
            tournament.participants
        );

    } else if (tournament.format === "swiss") {

        startSwiss(
            tournament.participants,
            false
        );

    } else if (tournament.format === "swissPlayoffs") {

        startSwiss(
            tournament.participants,
            true
        );

    } else if (tournament.format === "doubleElim") {

        if (typeof startDoubleElimination === "function") {
            startDoubleElimination(
                tournament.participants
            );
        } else {
            alert("Double Elimination requires formats.js.");
            tournament.running = false;
        }

    } else {

        generateRoundRobin(
            tournament.participants
        );

    }

}

function clearTournamentUI() {

    const feed =
        document.getElementById("matchFeed");

    const standings =
        document.getElementById("standings");

    const bracket =
        document.getElementById("bracketContainer");

    const playerStats =
        document.getElementById("playerStats");

    if (feed) feed.innerHTML = "";
    if (standings) standings.innerHTML = "";
    if (bracket) bracket.innerHTML = "";
    if (playerStats) playerStats.innerHTML = "";

}

/* ==========================
   ROUND ROBIN
========================== */

function generateRoundRobin(participants) {

    tournament.round = "Round Robin";
    tournament.matches = [];

    tournament.standings =
        participants.map(team => ({
            id: team.id,
            name: team.name,
            logo: team.logo,
            rating: team.rating,
            region: team.region,

            wins: 0,
            losses: 0,

            gameWins: 0,
            gameLosses: 0,

            goalsFor: 0,
            goalsAgainst: 0
        }));

    for (let i = 0; i < participants.length; i++) {

        for (let j = i + 1; j < participants.length; j++) {

            tournament.matches.push({
                teamA: participants[i],
                teamB: participants[j]
            });

        }

    }

    runRoundRobin();

}

async function runRoundRobin() {

    for (const match of tournament.matches) {

        const result =
            simulateSeries(
                match.teamA,
                match.teamB
            );

        updateStandings(result);
        addMatchCard(result);
        renderStandings();
        renderPlayerStats();

        await sleep(getTournamentDelay());

    }

    tournament.running = false;

    showChampion();

}

/* ==========================
   SWISS STAGE
========================== */

function startSwiss(
    participants,
    advanceToPlayoffs = false
) {

    if (participants.length < 4) {
        alert("Swiss Stage requires at least 4 teams.");
        tournament.running = false;
        return;
    }

    if (participants.length % 2 !== 0) {
        alert("Swiss Stage currently requires an even number of teams.");
        tournament.running = false;
        return;
    }

    if (
        advanceToPlayoffs &&
        participants.length < 8
    ) {
        alert("Swiss + Playoffs requires at least 8 teams.");
        tournament.running = false;
        return;
    }

    initialiseStageSeriesSettings();

    setTournamentSeriesLengthForStage("swiss");

    tournament.round = "Swiss Round 1";

    tournament.swiss.advanceToPlayoffs =
        advanceToPlayoffs;

    tournament.swiss.maxRounds =
        getSwissMaxRounds(participants.length);

    tournament.standings =
        participants.map(team => ({
            id: team.id,
            name: team.name,
            logo: team.logo,
            rating: team.rating,
            region: team.region,

            wins: 0,
            losses: 0,

            gameWins: 0,
            gameLosses: 0,

            goalsFor: 0,
            goalsAgainst: 0,

            status: "active",
            roundResults: []
        }));

    renderStandings();

    runSwiss();

}

function getSwissMaxRounds(teamCount) {

    if (teamCount <= 8) return 3;

    return 5;

}

async function runSwiss() {

    for (
        let roundNumber = 1;
        roundNumber <= tournament.swiss.maxRounds;
        roundNumber++
    ) {

        const activeTeams =
            getSwissActiveStandings();

        if (activeTeams.length < 2) {
            break;
        }

        const pairings =
            generateSwissPairings(activeTeams);

        if (!pairings || pairings.length === 0) {
            break;
        }

        tournament.swiss.currentRound =
            roundNumber;

        tournament.round =
            `Swiss Round ${roundNumber}`;

        const roundRecord = {
            roundNumber,
            matches: []
        };

        for (const pairing of pairings) {

            if (!pairing.teamA || !pairing.teamB) {
                continue;
            }

            const result =
                simulateSeries(
                    pairing.teamA,
                    pairing.teamB
                );

            applySwissResult(
                result,
                roundNumber
            );

            roundRecord.matches.push({
                teamAId: pairing.teamA.id,
                teamBId: pairing.teamB.id,
                result
            });

            addMatchCard(result);
            renderStandings();
            renderPlayerStats();

            await sleep(getTournamentDelay());

        }

        tournament.swiss.rounds.push(
            roundRecord
        );

        updateSwissStatuses();
        renderStandings();

        if (
            getSwissActiveStandings().length < 2
        ) {
            break;
        }

    }

    if (tournament.swiss.advanceToPlayoffs) {

        startSwissPlayoffs();

    } else {

        tournament.running = false;

        showSwissSummary();

    }

}

function getSwissActiveStandings() {

    return tournament.standings
        .filter(team =>
            team.status === "active"
        )
        .sort(sortSwissStandings);

}

function generateSwissPairings(activeStandings) {

    const standings =
        [...activeStandings].sort((a, b) => {

            if (b.wins !== a.wins) {
                return b.wins - a.wins;
            }

            if (a.losses !== b.losses) {
                return a.losses - b.losses;
            }

            return getSwissSeedRank(a.id) -
                getSwissSeedRank(b.id);

        });

    if (standings.length % 2 !== 0) {
        alert("Swiss pairing error: active teams must be even.");
        return [];
    }

    if (isSwissOpeningRound()) {

        return createSwissOpeningSeedPairs(
            standings
        )
            .map(pair => ({
                teamA: getTeamById(pair.teamA.id),
                teamB: getTeamById(pair.teamB.id)
            }))
            .filter(pair =>
                pair.teamA &&
                pair.teamB
            );

    }

    const result =
        solveSwissPairings(standings);

    if (!result || result.pairs.length === 0) {
        alert(
            "No valid Swiss pairings found without rematches."
        );
        return [];
    }

    return result.pairs
        .map(pair => ({
            teamA: getTeamById(pair.teamA.id),
            teamB: getTeamById(pair.teamB.id)
        }))
        .filter(pair =>
            pair.teamA &&
            pair.teamB
        );

}

function isSwissOpeningRound() {

    return tournament.standings.every(team =>
        team.wins === 0 &&
        team.losses === 0 &&
        (
            !team.roundResults ||
            team.roundResults.length === 0
        )
    );

}

function createSwissOpeningSeedPairs(standings) {

    const seeded =
        [...standings].sort((a, b) =>
            getSwissSeedRank(a.id) -
            getSwissSeedRank(b.id)
        );

    const pairs = [];

    let highSeedIndex = 0;
    let lowSeedIndex = seeded.length - 1;

    while (highSeedIndex < lowSeedIndex) {

        pairs.push({
            teamA: seeded[highSeedIndex],
            teamB: seeded[lowSeedIndex]
        });

        highSeedIndex++;
        lowSeedIndex--;

    }

    return pairs;

}

function solveSwissPairings(standings) {

    const memo = new Map();

    function solve(remainingTeams) {

        if (remainingTeams.length === 0) {
            return {
                pairs: [],
                score: 0
            };
        }

        const sortedRemaining =
            [...remainingTeams].sort((a, b) => {

                if (b.wins !== a.wins) {
                    return b.wins - a.wins;
                }

                if (a.losses !== b.losses) {
                    return a.losses - b.losses;
                }

                return getSwissSeedRank(a.id) -
                    getSwissSeedRank(b.id);

            });

        const key =
            sortedRemaining
                .map(team => String(team.id))
                .sort()
                .join("-");

        if (memo.has(key)) {
            return memo.get(key);
        }

        const teamA =
            sortedRemaining[0];

        const possibleOpponents =
            sortedRemaining
                .slice(1)
                .filter(teamB =>
                    !teamsHavePlayed(
                        teamA.id,
                        teamB.id
                    )
                )
                .sort((a, b) =>
                    getSwissPairingScore(teamA, a) -
                    getSwissPairingScore(teamA, b)
                );

        if (possibleOpponents.length === 0) {
            memo.set(key, null);
            return null;
        }

        let bestResult = null;

        for (const teamB of possibleOpponents) {

            const nextRemaining =
                sortedRemaining.filter(team =>
                    String(team.id) !== String(teamA.id) &&
                    String(team.id) !== String(teamB.id)
                );

            const subResult =
                solve(nextRemaining);

            if (!subResult) continue;

            const pairScore =
                getSwissPairingScore(
                    teamA,
                    teamB
                );

            const totalScore =
                pairScore + subResult.score;

            const candidateResult = {
                pairs: [
                    {
                        teamA,
                        teamB
                    },
                    ...subResult.pairs
                ],
                score: totalScore
            };

            if (
                !bestResult ||
                candidateResult.score < bestResult.score
            ) {
                bestResult = candidateResult;
            }

        }

        memo.set(key, bestResult);

        return bestResult;

    }

    return solve(standings);

}

function getSwissPairingScore(teamA, teamB) {

    const recordDifference =
        Math.abs(teamA.wins - teamB.wins) +
        Math.abs(teamA.losses - teamB.losses);

    const gameDiffA =
        teamA.gameWins - teamA.gameLosses;

    const gameDiffB =
        teamB.gameWins - teamB.gameLosses;

    const gameDiffDifference =
        Math.abs(gameDiffA - gameDiffB);

    const seedDifference =
        Math.abs(
            getSwissSeedRank(teamA.id) -
            getSwissSeedRank(teamB.id)
        );

    return (
        recordDifference * 1000000 +
        gameDiffDifference * 1000 +
        seedDifference
    );

}

function teamsHavePlayed(teamAId, teamBId) {

    const teamAStanding =
        tournament.standings.find(team =>
            String(team.id) === String(teamAId)
        );

    const teamBStanding =
        tournament.standings.find(team =>
            String(team.id) === String(teamBId)
        );

    const teamAPlayed =
        teamAStanding &&
        teamAStanding.roundResults &&
        teamAStanding.roundResults.some(result =>
            String(result.opponentId) === String(teamBId)
        );

    const teamBPlayed =
        teamBStanding &&
        teamBStanding.roundResults &&
        teamBStanding.roundResults.some(result =>
            String(result.opponentId) === String(teamAId)
        );

    return Boolean(
        teamAPlayed ||
        teamBPlayed
    );

}

function getSwissSeedRank(teamId) {

    if (
        tournament.seedings &&
        tournament.seedings.length > 0
    ) {

        const seedIndex =
            tournament.seedings.findIndex(team =>
                String(team.id) === String(teamId)
            );

        if (seedIndex !== -1) {
            return seedIndex + 1;
        }

    }

    if (
        tournament.participants &&
        tournament.participants.length > 0
    ) {

        const participantIndex =
            tournament.participants.findIndex(team =>
                String(team.id) === String(teamId)
            );

        if (participantIndex !== -1) {
            return participantIndex + 1;
        }

    }

    return 9999;

}

function applySwissResult(result, roundNumber) {

    const teamA =
        tournament.standings.find(team =>
            String(team.id) === String(result.teamAId)
        );

    const teamB =
        tournament.standings.find(team =>
            String(team.id) === String(result.teamBId)
        );

    if (!teamA || !teamB) return;

    teamA.gameWins += result.scoreA;
    teamA.gameLosses += result.scoreB;

    teamB.gameWins += result.scoreB;
    teamB.gameLosses += result.scoreA;

    teamA.goalsFor += result.totalGoalsA;
    teamA.goalsAgainst += result.totalGoalsB;

    teamB.goalsFor += result.totalGoalsB;
    teamB.goalsAgainst += result.totalGoalsA;

    if (result.scoreA > result.scoreB) {
        teamA.wins++;
        teamB.losses++;
    } else {
        teamB.wins++;
        teamA.losses++;
    }

    teamA.roundResults.push({
        round: roundNumber,
        opponentId: teamB.id,
        opponentName: teamB.name,
        opponentLogo: teamB.logo,
        resultText: `${result.scoreA}-${result.scoreB}`,
        won: result.scoreA > result.scoreB
    });

    teamB.roundResults.push({
        round: roundNumber,
        opponentId: teamA.id,
        opponentName: teamA.name,
        opponentLogo: teamA.logo,
        resultText: `${result.scoreB}-${result.scoreA}`,
        won: result.scoreB > result.scoreA
    });

}

function updateSwissStatuses() {

    tournament.swiss.qualifiedTeams = [];
    tournament.swiss.eliminatedTeams = [];

    tournament.standings.forEach(team => {

        if (team.wins >= 3) {

            team.status = "qualified";
            tournament.swiss.qualifiedTeams.push(team);

        } else if (team.losses >= 3) {

            team.status = "eliminated";
            tournament.swiss.eliminatedTeams.push(team);

        } else {

            team.status = "active";

        }

    });

}

function startSwissPlayoffs() {

    const sortedSwissTeams =
        [...tournament.standings]
            .sort(sortSwissStandings);

    let playoffCut = 8;

    if (sortedSwissTeams.length <= 8) {
        playoffCut = 4;
    }

    if (sortedSwissTeams.length >= 16) {
        playoffCut = 8;
    }

    const playoffTeams =
        sortedSwissTeams
            .slice(0, playoffCut)
            .map(standing =>
                getTeamById(standing.id)
            )
            .filter(Boolean);

    tournament.swiss.playoffTeams =
        playoffTeams;

    const feed =
        document.getElementById("matchFeed");

    if (feed) {

        const eliminatedTeams =
            sortedSwissTeams.slice(playoffCut);

        feed.innerHTML += `

            <div class="team-card">

                <div class="team-banner"></div>

                <div class="team-content">

                    <h2>✅ Swiss Stage Complete</h2>

                    <h1 style="
                        font-size:42px;
                        color:gold;
                    ">
                        Top ${playoffCut} Qualified
                    </h1>

                    <p>
                        Swiss Stage:
                        BO${tournament.stageSeries.swiss}
                        |
                        Playoffs:
                        BO${tournament.stageSeries.playoffs}
                    </p>

                    <div class="swiss-summary-list">

                        <h3>Qualified Teams</h3>

                        ${playoffTeams.map((team, index) => {

                            const standing =
                                sortedSwissTeams.find(item =>
                                    String(item.id) === String(team.id)
                                );

                            return `
                                <div class="history-row">
                                    <span>
                                        #${index + 1}
                                        ${safeText(team.name)}
                                    </span>

                                    <strong>
                                        ${standing.wins}-${standing.losses}
                                    </strong>
                                </div>
                            `;

                        }).join("")}

                        <h3 style="margin-top:18px;">
                            Eliminated Teams
                        </h3>

                        ${eliminatedTeams.map((team, index) => `
                            <div class="history-row">
                                <span>
                                    #${playoffCut + index + 1}
                                    ${safeText(team.name)}
                                </span>

                                <strong>
                                    ${team.wins}-${team.losses}
                                </strong>
                            </div>
                        `).join("")}

                    </div>

                </div>

            </div>

        `;

    }

    tournament.round = "Playoffs";

    setTournamentSeriesLengthForStage("playoffs");

    renderStandings();

    startPlayoffs(playoffTeams);

}

function showSwissSummary() {

    tournament.standings.sort(sortSwissStandings);

    const leader =
        tournament.standings[0];

    if (leader) {
        tournament.champion =
            leader.name;
    }

    const qualified =
        tournament.standings
            .filter(team =>
                team.status === "qualified"
            )
            .slice(0, 8);

    const feed =
        document.getElementById("matchFeed");

    if (feed) {

        feed.innerHTML += `
            <div class="team-card">

                <div class="team-banner"></div>

                <div class="team-content">

                    <h2>✅ Swiss Stage Complete</h2>

                    <h1 style="
                        font-size:42px;
                        color:gold;
                    ">
                        ${leader ? safeText(leader.name) : "No Leader"}
                    </h1>

                    <p>
                        Top Swiss Seed
                    </p>

                    <div class="swiss-summary-list">

                        <h3>Qualified Teams</h3>

                        ${
                            qualified.length > 0
                            ? qualified.map((team, index) => `
                                <div class="history-row">
                                    <span>
                                        #${index + 1}
                                        ${safeText(team.name)}
                                    </span>

                                    <strong>
                                        ${team.wins}-${team.losses}
                                    </strong>
                                </div>
                            `).join("")
                            : `<p class="small">No teams reached 3 wins.</p>`
                        }

                    </div>

                </div>

            </div>
        `;

    }

    saveTournamentToHistoryIfPossible();

}

function sortSwissStandings(a, b) {

    if (b.wins !== a.wins) {
        return b.wins - a.wins;
    }

    if (a.losses !== b.losses) {
        return a.losses - b.losses;
    }

    const diffA =
        a.gameWins - a.gameLosses;

    const diffB =
        b.gameWins - b.gameLosses;

    if (diffB !== diffA) {
        return diffB - diffA;
    }

    if (b.gameWins !== a.gameWins) {
        return b.gameWins - a.gameWins;
    }

    return getSwissSeedRank(a.id) -
        getSwissSeedRank(b.id);

}

function getTeamById(id) {

    return teams.find(team =>
        String(team.id) === String(id)
    );

}

/* ==========================
   PLAYOFFS
========================== */

function createHighLowSeedPairs(participants, size) {

    const seededTeams =
        participants.slice(0, size);

    const pairs = [];

    let highSeedIndex = 0;
    let lowSeedIndex = seededTeams.length - 1;

    while (highSeedIndex < lowSeedIndex) {

        pairs.push({
            teamA: seededTeams[highSeedIndex],
            teamB: seededTeams[lowSeedIndex]
        });

        highSeedIndex++;
        lowSeedIndex--;

    }

    return pairs;

}

function createBracketMatchesFromPairs(
    pairs,
    roundName
) {

    return pairs.map(pair =>
        createBracketMatch(
            pair.teamA,
            pair.teamB,
            roundName
        )
    );

}

function startPlayoffs(participants) {

    if (participants.length < 4) {
        alert("Single Elimination requires at least 4 teams.");
        tournament.running = false;
        return;
    }

    tournament.bracket.roundOf16 = [];
    tournament.bracket.quarterFinals = [];
    tournament.bracket.semiFinals = [];
    tournament.bracket.grandFinal = null;
    tournament.bracket.champion = null;

    if (participants.length >= 16) {

        tournament.round = "Round of 16";

        tournament.bracket.roundOf16 =
            createBracketMatchesFromPairs(
                createHighLowSeedPairs(participants, 16),
                "Round of 16"
            );

        renderBracketTree();
        runBracket();

        return;

    }

    if (participants.length >= 8) {

        tournament.round = "Quarterfinals";

        tournament.bracket.quarterFinals =
            createBracketMatchesFromPairs(
                createHighLowSeedPairs(participants, 8),
                "Quarterfinals"
            );

        renderBracketTree();
        runBracket();

        return;

    }

    tournament.round = "Semifinals";

    tournament.bracket.semiFinals =
        createBracketMatchesFromPairs(
            createHighLowSeedPairs(participants, 4),
            "Semifinals"
        );

    renderBracketTree();
    runBracket();

}

function createBracketMatch(teamA, teamB, round) {

    return {
        round,
        teamA,
        teamB,
        result: null,
        winner: null
    };

}

async function runBracket() {

    let quarterFinalists = [];
    let semiFinalists = [];

    if (
        tournament.bracket.roundOf16 &&
        tournament.bracket.roundOf16.length > 0
    ) {

        tournament.round = "Round of 16";

        for (const match of tournament.bracket.roundOf16) {

            const result =
                simulateSeries(
                    match.teamA,
                    match.teamB
                );

            match.result = result;
            match.winner =
                getWinningTeam(match, result);

            quarterFinalists.push(match.winner);

            addMatchCard(result);
            renderBracketTree();
            renderPlayerStats();

            await sleep(getTournamentDelay());

        }

        tournament.round = "Quarterfinals";

        tournament.bracket.quarterFinals =
            createBracketMatchesFromPairs(
                createHighLowSeedPairs(quarterFinalists, 8),
                "Quarterfinals"
            );

        renderBracketTree();

        await sleep(getTournamentDelay());

    }

    if (
        tournament.bracket.quarterFinals &&
        tournament.bracket.quarterFinals.length > 0
    ) {

        tournament.round = "Quarterfinals";

        for (const match of tournament.bracket.quarterFinals) {

            const result =
                simulateSeries(
                    match.teamA,
                    match.teamB
                );

            match.result = result;
            match.winner =
                getWinningTeam(match, result);

            semiFinalists.push(match.winner);

            addMatchCard(result);
            renderBracketTree();
            renderPlayerStats();

            await sleep(getTournamentDelay());

        }

        tournament.round = "Semifinals";

        tournament.bracket.semiFinals =
            createBracketMatchesFromPairs(
                createHighLowSeedPairs(semiFinalists, 4),
                "Semifinals"
            );

        renderBracketTree();

        await sleep(getTournamentDelay());

    }

    const finalists = [];

    tournament.round = "Semifinals";

    for (const match of tournament.bracket.semiFinals) {

        const result =
            simulateSeries(
                match.teamA,
                match.teamB
            );

        match.result = result;
        match.winner =
            getWinningTeam(match, result);

        finalists.push(match.winner);

        addMatchCard(result);
        renderBracketTree();
        renderPlayerStats();

        await sleep(getTournamentDelay());

    }

    tournament.round = "Grand Final";

    tournament.bracket.grandFinal =
        createBracketMatch(
            finalists[0],
            finalists[1],
            "Grand Final"
        );

    renderBracketTree();

    await sleep(getTournamentDelay());

    const finalMatch =
        tournament.bracket.grandFinal;

    const finalResult =
        simulateSeries(
            finalMatch.teamA,
            finalMatch.teamB
        );

    finalMatch.result = finalResult;

    finalMatch.winner =
        getWinningTeam(
            finalMatch,
            finalResult
        );

    tournament.bracket.champion =
        finalMatch.winner;

    tournament.champion =
        finalMatch.winner.name;

    addMatchCard(finalResult);
    renderBracketTree();
    renderPlayerStats();

    tournament.running = false;

    showPlayoffChampion();

}

function getWinningTeam(match, result) {

    return String(result.winnerId) === String(match.teamA.id)
        ? match.teamA
        : match.teamB;

}

/* ==========================
   PLAYER STATS
========================== */

function initialisePlayerStats(participants) {

    tournament.playerStats = {};

    participants.forEach(team => {

        if (!team.players) return;

        team.players.forEach(player => {

            const key =
                getPlayerKey(team, player);

            tournament.playerStats[key] = {
                key,

                name: player.name,
                rating: player.rating || 50,

                teamId: team.id,
                teamName: team.name,
                teamLogo: team.logo,

                goals: 0,
                assists: 0,
                saves: 0,
                mvps: 0,
                seriesPlayed: 0
            };

        });

    });

}

function getPlayerKey(team, player) {

    return `${team.id}-${player.name}`;

}

function getPlayerStat(team, player) {

    const key =
        getPlayerKey(team, player);

    if (!tournament.playerStats[key]) {

        tournament.playerStats[key] = {
            key,

            name: player.name,
            rating: player.rating || 50,

            teamId: team.id,
            teamName: team.name,
            teamLogo: team.logo,

            goals: 0,
            assists: 0,
            saves: 0,
            mvps: 0,
            seriesPlayed: 0
        };

    }

    return tournament.playerStats[key];

}

function addTeamGamePlayerStats(
    team,
    goalsFor,
    goalsAgainst,
    seriesStats
) {

    if (
        !team.players ||
        team.players.length === 0
    ) {
        return;
    }

    for (let i = 0; i < goalsFor; i++) {

        const scorer =
            getWeightedPlayer(team);

        const scorerStat =
            getPlayerStat(team, scorer);

        scorerStat.goals++;

        addSeriesStat(
            seriesStats,
            team,
            scorer,
            "goals",
            1
        );

        if (
            team.players.length > 1 &&
            Math.random() < 0.72
        ) {

            const assister =
                getDifferentPlayer(
                    team,
                    scorer
                );

            const assistStat =
                getPlayerStat(team, assister);

            assistStat.assists++;

            addSeriesStat(
                seriesStats,
                team,
                assister,
                "assists",
                1
            );

        }

    }

    const saves =
        Math.max(
            1,
            goalsAgainst + randomInt(1, 5)
        );

    for (let i = 0; i < saves; i++) {

        const saver =
            getWeightedPlayer(team);

        const saverStat =
            getPlayerStat(team, saver);

        saverStat.saves++;

        addSeriesStat(
            seriesStats,
            team,
            saver,
            "saves",
            1
        );

    }

}

function addSeriesStat(
    seriesStats,
    team,
    player,
    stat,
    amount
) {

    const key =
        getPlayerKey(team, player);

    if (!seriesStats[key]) {

        seriesStats[key] = {
            key,

            name: player.name,
            rating: player.rating || 50,

            teamId: team.id,
            teamName: team.name,

            goals: 0,
            assists: 0,
            saves: 0
        };

    }

    seriesStats[key][stat] += amount;

}

function getSeriesMVP(
    seriesStats,
    winningTeam
) {

    const players =
        Object.values(seriesStats)
            .filter(player =>
                String(player.teamId) === String(winningTeam.id)
            );

    if (players.length === 0) {
        return {
            name: "Unknown Player"
        };
    }

    players.sort((a, b) => {

        const scoreA =
            a.goals * 3 +
            a.assists * 2 +
            a.saves * 0.35 +
            Number(a.rating || 50) * 0.03;

        const scoreB =
            b.goals * 3 +
            b.assists * 2 +
            b.saves * 0.35 +
            Number(b.rating || 50) * 0.03;

        return scoreB - scoreA;

    });

    const mvp =
        players[0];

    const globalStat =
        tournament.playerStats[mvp.key];

    if (globalStat) {
        globalStat.mvps++;
    }

    return mvp;

}

function markSeriesPlayed(team) {

    if (!team.players) return;

    team.players.forEach(player => {

        const stat =
            getPlayerStat(team, player);

        stat.seriesPlayed++;

    });

}

function renderPlayerStats() {

    const container =
        document.getElementById("playerStats");

    if (!container) return;

    const stats =
        Object.values(tournament.playerStats);

    if (stats.length === 0) {
        container.innerHTML = `
            <p class="small">
                Player statistics will appear after matches are played.
            </p>
        `;
        return;
    }

    const topScorers =
        [...stats]
            .sort((a, b) =>
                b.goals - a.goals ||
                b.assists - a.assists ||
                b.saves - a.saves
            )
            .slice(0, 5);

    const topMVPs =
        [...stats]
            .sort((a, b) =>
                b.mvps - a.mvps ||
                b.goals - a.goals
            )
            .slice(0, 5);

    const topSaves =
        [...stats]
            .sort((a, b) =>
                b.saves - a.saves ||
                b.goals - a.goals
            )
            .slice(0, 5);

    container.innerHTML = `
        <div class="player-stats-grid">

            ${renderStatsPanel(
                "Top Scorers",
                topScorers,
                "goals"
            )}

            ${renderStatsPanel(
                "Series MVPs",
                topMVPs,
                "mvps"
            )}

            ${renderStatsPanel(
                "Most Saves",
                topSaves,
                "saves"
            )}

        </div>
    `;

}

function renderStatsPanel(title, list, statName) {

    return `
        <div class="stats-panel">

            <h4>${safeText(title)}</h4>

            ${list.map((player, index) => `
                <div class="stats-row">

                    <span>
                        #${index + 1}
                        ${safeText(player.name)}
                        <small>
                            ${safeText(player.teamName)}
                        </small>
                    </span>

                    <strong>
                        ${player[statName]}
                    </strong>

                </div>
            `).join("")}

        </div>
    `;

}

/* ==========================
   TEAM FORM SYSTEM
========================== */

const TEAM_FORM_STORAGE_KEY =
    "rlcsTeamFormStateV1";

const TEAM_FORM_EVENT_LIMIT = 3;

const TEAM_FORM_PRESETS = {
    off: {
        previousScale: 0,
        liveScale: 0,
        previousCap: 0,
        liveCap: 0
    },
    light: {
        previousScale: 0.60,
        liveScale: 0.65,
        previousCap: 1.5,
        liveCap: 2
    },
    balanced: {
        previousScale: 1,
        liveScale: 1,
        previousCap: 3,
        liveCap: 3.5
    },
    strong: {
        previousScale: 1.35,
        liveScale: 1.40,
        previousCap: 4.5,
        liveCap: 5.5
    }
};

function createEmptyTournamentFormContext() {
    return {
        eventRunId: null,
        teams: {},
        finalised: false
    };
}

function getTeamFormSettings() {
    const settings =
        typeof getSimulationSettings === "function"
            ? getSimulationSettings()
            : {};

    const importance =
        TEAM_FORM_PRESETS[settings.formImportance]
            ? settings.formImportance
            : "balanced";

    return {
        importance,
        ...TEAM_FORM_PRESETS[importance]
    };
}

function getStoredTeamFormState() {
    try {
        const parsed = JSON.parse(
            localStorage.getItem(
                TEAM_FORM_STORAGE_KEY
            ) || "{}"
        );

        return parsed && typeof parsed === "object"
            ? parsed
            : {};
    } catch (error) {
        console.error(
            "Failed to read team form state.",
            error
        );
        return {};
    }
}

function saveStoredTeamFormState(state) {
    try {
        localStorage.setItem(
            TEAM_FORM_STORAGE_KEY,
            JSON.stringify(state || {})
        );
    } catch (error) {
        console.error(
            "Failed to save team form state.",
            error
        );
    }
}

function getTeamRosterSignature(team) {
    const players = Array.isArray(team?.players)
        ? team.players
        : [];

    return players
        .map(player => {
            const identity =
                player?.id ||
                String(player?.name || "")
                    .trim()
                    .toLowerCase();

            const name = String(player?.name || "")
                .trim()
                .toLowerCase();

            return `${identity}:${name}`;
        })
        .join("|");
}

function resetTeamFormAfterRosterChange(
    team,
    reason = "Roster changed"
) {
    if (!team?.id) return;

    const state = getStoredTeamFormState();

    state[String(team.id)] = {
        teamId: team.id,
        rosterSignature:
            getTeamRosterSignature(team),
        recentEvents: [],
        resetAt: new Date().toISOString(),
        resetReason: reason
    };

    saveStoredTeamFormState(state);

    if (typeof resetTeamChemistryAfterRosterChange === "function") {
        resetTeamChemistryAfterRosterChange(team, reason);
    }

    if (tournament?.teamForm?.teams) {
        delete tournament.teamForm.teams[
            String(team.id)
        ];
    }
}

function removeStoredTeamForm(teamId) {
    const state = getStoredTeamFormState();
    delete state[String(teamId)];
    saveStoredTeamFormState(state);

    if (tournament?.teamForm?.teams) {
        delete tournament.teamForm.teams[
            String(teamId)
        ];
    }
}

function getCurrentFormEventRunId() {
    return (
        tournament?.currentEvent?.eventRunId ||
        tournament?.currentEvent?.seasonEventId ||
        tournament?.currentEvent?.id ||
        "unsaved-event"
    );
}

function ensureTournamentFormContext() {
    const eventRunId =
        getCurrentFormEventRunId();

    if (
        !tournament.teamForm ||
        tournament.teamForm.eventRunId !== eventRunId
    ) {
        tournament.teamForm =
            createEmptyTournamentFormContext();

        tournament.teamForm.eventRunId =
            eventRunId;
    }

    return tournament.teamForm;
}

function getPersistentTeamForm(team) {
    const allState = getStoredTeamFormState();
    const key = String(team.id);
    const rosterSignature =
        getTeamRosterSignature(team);

    let state = allState[key];

    if (!state) {
        state = {
            teamId: team.id,
            rosterSignature,
            recentEvents:
                buildInitialFormFromHistory(
                    team,
                    rosterSignature
                )
        };

        allState[key] = state;
        saveStoredTeamFormState(allState);
    } else if (
        state.rosterSignature !== rosterSignature
    ) {
        state = {
            teamId: team.id,
            rosterSignature,
            recentEvents: [],
            resetAt: new Date().toISOString(),
            resetReason:
                "Roster signature changed"
        };

        allState[key] = state;
        saveStoredTeamFormState(allState);
    }

    state.recentEvents = Array.isArray(
        state.recentEvents
    )
        ? state.recentEvents.slice(
            0,
            TEAM_FORM_EVENT_LIMIT
        )
        : [];

    return state;
}

function buildInitialFormFromHistory(
    team,
    rosterSignature
) {
    let history = [];

    try {
        history = JSON.parse(
            localStorage.getItem(
                "rlcsTournamentHistory"
            ) || "[]"
        );
    } catch {
        history = [];
    }

    return history
        .map(record => {
            const teamSnapshot =
                (record.teams || []).find(item =>
                    String(item.id) ===
                    String(team.id)
                );

            if (!teamSnapshot) return null;

            if (
                getTeamRosterSignature(teamSnapshot) !==
                rosterSignature
            ) {
                return null;
            }

            const placement =
                (record.placements || []).find(item =>
                    String(item.teamId) ===
                    String(team.id)
                );

            if (!placement) return null;

            const teamCount = Math.max(
                2,
                Number(record.teams?.length || 0),
                Number(record.placements?.length || 0)
            );

            return {
                eventRunId:
                    record.eventRunId ||
                    record.id,
                eventName:
                    record.event?.name ||
                    "Previous Event",
                completedAt:
                    record.completedAt ||
                    record.date ||
                    "",
                placement:
                    Number(placement.placement || teamCount),
                teamCount,
                score:
                    calculatePlacementFormScore(
                        Number(placement.placement || teamCount),
                        teamCount
                    )
            };
        })
        .filter(Boolean)
        .slice(0, TEAM_FORM_EVENT_LIMIT);
}

function calculatePlacementFormScore(
    placement,
    teamCount
) {
    if (teamCount <= 1) return 0;

    const normalised =
        1 -
        (
            2 *
            (Math.max(1, placement) - 1)
        ) /
        (teamCount - 1);

    return clampTeamForm(
        normalised * 4.5,
        -5,
        5
    );
}

function calculatePreviousTournamentForm(team) {
    const settings = getTeamFormSettings();

    if (settings.importance === "off") {
        return 0;
    }

    const state = getPersistentTeamForm(team);
    const events = state.recentEvents || [];
    const weights = [0.55, 0.30, 0.15];

    let weightedTotal = 0;
    let totalWeight = 0;

    events.forEach((event, index) => {
        const weight = weights[index] || 0;
        weightedTotal +=
            Number(event.score || 0) * weight;
        totalWeight += weight;
    });

    const raw = totalWeight > 0
        ? weightedTotal / totalWeight
        : 0;

    return clampTeamForm(
        raw * settings.previousScale,
        -settings.previousCap,
        settings.previousCap
    );
}

function getTournamentTeamFormEntry(team) {
    const context = ensureTournamentFormContext();
    const key = String(team.id);

    if (!context.teams[key]) {
        context.teams[key] = {
            teamId: team.id,
            teamName: team.name,
            rosterSignature:
                getTeamRosterSignature(team),
            previousForm:
                calculatePreviousTournamentForm(team),
            liveRaw: 0,
            liveForm: 0,
            wins: 0,
            losses: 0,
            streak: 0,
            matches: 0,
            gameDiff: 0
        };
    }

    return context.teams[key];
}

function prepareSeriesForm(teamA, teamB) {
    const settings = getTeamFormSettings();
    const entryA =
        getTournamentTeamFormEntry(teamA);
    const entryB =
        getTournamentTeamFormEntry(teamB);

    return {
        settings,
        teamA: {
            entry: entryA,
            baseRating: Number(teamA.rating || 50),
            previousForm:
                Number(entryA.previousForm || 0),
            liveForm:
                Number(entryA.liveForm || 0)
        },
        teamB: {
            entry: entryB,
            baseRating: Number(teamB.rating || 50),
            previousForm:
                Number(entryB.previousForm || 0),
            liveForm:
                Number(entryB.liveForm || 0)
        }
    };
}

function getEffectiveFormRating(preparedTeam) {
    return (
        preparedTeam.baseRating +
        preparedTeam.previousForm +
        preparedTeam.liveForm
    );
}

function applySeriesFormResult(
    prepared,
    scoreA,
    scoreB,
    probabilityA
) {
    const entryA = prepared.teamA.entry;
    const entryB = prepared.teamB.entry;
    const teamAWon = scoreA > scoreB;
    const totalGames = Math.max(1, scoreA + scoreB);
    const marginA =
        (scoreA - scoreB) / totalGames;
    const actualA = teamAWon ? 1 : 0;

    let deltaA =
        (actualA - probabilityA) * 1.8 +
        marginA * 0.5;

    deltaA = teamAWon
        ? Math.max(0.20, deltaA)
        : Math.min(-0.20, deltaA);

    entryA.streak = teamAWon
        ? Math.max(1, entryA.streak + 1)
        : Math.min(-1, entryA.streak - 1);

    entryB.streak = teamAWon
        ? Math.min(-1, entryB.streak - 1)
        : Math.max(1, entryB.streak + 1);

    const streakBonusA =
        Math.sign(entryA.streak) *
        Math.min(
            0.4,
            Math.max(
                0,
                Math.abs(entryA.streak) - 1
            ) * 0.20
        );

    deltaA += streakBonusA;

    const deltaB = -deltaA;

    entryA.liveRaw = clampTeamForm(
        Number(entryA.liveRaw || 0) + deltaA,
        -7,
        7
    );

    entryB.liveRaw = clampTeamForm(
        Number(entryB.liveRaw || 0) + deltaB,
        -7,
        7
    );

    entryA.liveForm = clampTeamForm(
        entryA.liveRaw *
            prepared.settings.liveScale,
        -prepared.settings.liveCap,
        prepared.settings.liveCap
    );

    entryB.liveForm = clampTeamForm(
        entryB.liveRaw *
            prepared.settings.liveScale,
        -prepared.settings.liveCap,
        prepared.settings.liveCap
    );

    entryA.matches++;
    entryB.matches++;

    entryA.gameDiff += scoreA - scoreB;
    entryB.gameDiff += scoreB - scoreA;

    if (teamAWon) {
        entryA.wins++;
        entryB.losses++;
    } else {
        entryB.wins++;
        entryA.losses++;
    }

    return {
        teamA: createSeriesFormSnapshot(
            prepared.teamA,
            entryA
        ),
        teamB: createSeriesFormSnapshot(
            prepared.teamB,
            entryB
        )
    };
}

function createSeriesFormSnapshot(
    preparedTeam,
    updatedEntry
) {
    const beforeAdjustment =
        preparedTeam.previousForm +
        preparedTeam.liveForm;

    const afterAdjustment =
        Number(updatedEntry.previousForm || 0) +
        Number(updatedEntry.liveForm || 0);

    return {
        baseRating:
            roundTeamForm(
                preparedTeam.baseRating
            ),
        previousForm:
            roundTeamForm(
                preparedTeam.previousForm
            ),
        liveFormBefore:
            roundTeamForm(
                preparedTeam.liveForm
            ),
        liveFormAfter:
            roundTeamForm(
                updatedEntry.liveForm
            ),
        totalFormBefore:
            roundTeamForm(beforeAdjustment),
        totalFormAfter:
            roundTeamForm(afterAdjustment),
        effectiveRatingBefore:
            roundTeamForm(
                preparedTeam.baseRating +
                beforeAdjustment
            ),
        effectiveRatingAfter:
            roundTeamForm(
                preparedTeam.baseRating +
                afterAdjustment
            )
    };
}

function finaliseTournamentFormForHistory(
    placements = [],
    event = {}
) {
    const context = ensureTournamentFormContext();

    if (context.finalised) {
        return createTournamentFormHistorySummary(
            context
        );
    }

    const allState = getStoredTeamFormState();
    const participantCount = Math.max(
        2,
        Number(tournament.participants?.length || 0),
        Number(placements.length || 0)
    );

    (tournament.participants || []).forEach(team => {
        const entry =
            getTournamentTeamFormEntry(team);

        const placement = placements.find(item =>
            String(item.teamId) ===
            String(team.id)
        );

        const placementNumber = Number(
            placement?.placement ||
            participantCount
        );

        const placementScore =
            calculatePlacementFormScore(
                placementNumber,
                participantCount
            );

        const matchBalance = entry.matches > 0
            ? (
                (entry.wins - entry.losses) /
                entry.matches
            ) * 3
            : 0;

        const eventScore = clampTeamForm(
            Number(entry.liveRaw || 0) * 0.45 +
            placementScore * 0.40 +
            matchBalance * 0.15,
            -5,
            5
        );

        const key = String(team.id);
        const rosterSignature =
            getTeamRosterSignature(team);
        const existing =
            allState[key] || {
                teamId: team.id,
                rosterSignature,
                recentEvents: []
            };

        const recentEvents = Array.isArray(
            existing.recentEvents
        )
            ? existing.recentEvents.filter(item =>
                String(item.eventRunId) !==
                String(context.eventRunId)
            )
            : [];

        recentEvents.unshift({
            eventRunId: context.eventRunId,
            eventName:
                event.name ||
                tournament.currentEvent?.name ||
                "Tournament",
            completedAt:
                new Date().toISOString(),
            placement: placementNumber,
            teamCount: participantCount,
            wins: entry.wins,
            losses: entry.losses,
            gameDiff: entry.gameDiff,
            score: roundTeamForm(eventScore)
        });

        allState[key] = {
            teamId: team.id,
            rosterSignature,
            recentEvents: recentEvents.slice(
                0,
                TEAM_FORM_EVENT_LIMIT
            ),
            lastUpdated:
                new Date().toISOString()
        };

        entry.eventScore = eventScore;
        entry.finalPlacement = placementNumber;
    });

    saveStoredTeamFormState(allState);
    context.finalised = true;

    return createTournamentFormHistorySummary(
        context
    );
}

function createTournamentFormHistorySummary(context) {
    return {
        eventRunId: context.eventRunId,
        teams: Object.values(
            context.teams || {}
        ).map(entry => ({
            teamId: entry.teamId,
            teamName: entry.teamName,
            previousForm:
                roundTeamForm(
                    entry.previousForm || 0
                ),
            finalLiveForm:
                roundTeamForm(
                    entry.liveForm || 0
                ),
            eventScore:
                roundTeamForm(
                    entry.eventScore || 0
                ),
            wins: Number(entry.wins || 0),
            losses: Number(entry.losses || 0),
            gameDiff:
                Number(entry.gameDiff || 0),
            placement:
                Number(entry.finalPlacement || 0)
        }))
    };
}

function getTeamCurrentForm(team) {
    if (!team) {
        return {
            previousForm: 0,
            liveForm: 0,
            totalForm: 0,
            effectiveRating: 0
        };
    }

    const previousForm =
        calculatePreviousTournamentForm(team);
    const context = tournament?.teamForm;
    const entry = context?.teams?.[
        String(team.id)
    ];
    const liveForm = Number(
        entry?.liveForm || 0
    );

    return {
        previousForm:
            roundTeamForm(previousForm),
        liveForm:
            roundTeamForm(liveForm),
        totalForm:
            roundTeamForm(
                previousForm + liveForm
            ),
        effectiveRating:
            roundTeamForm(
                Number(team.rating || 0) +
                previousForm + liveForm
            )
    };
}

function formatTeamFormValue(value) {
    const number = roundTeamForm(value);

    if (number > 0) return `+${number}`;
    return String(number);
}

function roundTeamForm(value) {
    return Math.round(
        Number(value || 0) * 10
    ) / 10;
}

function clampTeamForm(value, minimum, maximum) {
    return Math.max(
        minimum,
        Math.min(maximum, Number(value || 0))
    );
}

/* ==========================
   SERIES SIMULATION
========================== */

function simulateSeries(teamA, teamB) {

    const gamesNeeded =
        Math.ceil(
            tournament.seriesLength / 2
        );

    const preparedForm =
        prepareSeriesForm(teamA, teamB);

    const preparedChemistry =
        typeof prepareSeriesChemistry === "function"
            ? prepareSeriesChemistry(teamA, teamB)
            : {
                enabled: false,
                teamA: { bonusBefore: 0, statusBefore: "Neutral" },
                teamB: { bonusBefore: 0, statusBefore: "Neutral" }
            };

    const effectiveRatingA =
        getEffectiveFormRating(
            preparedForm.teamA
        ) + Number(preparedChemistry.teamA?.bonusBefore || 0);

    const effectiveRatingB =
        getEffectiveFormRating(
            preparedForm.teamB
        ) + Number(preparedChemistry.teamB?.bonusBefore || 0);

    const seriesWinProbabilityA =
        getTournamentWinProbability(
            effectiveRatingA,
            effectiveRatingB
        );

    let scoreA = 0;
    let scoreB = 0;

    let totalGoalsA = 0;
    let totalGoalsB = 0;

    const games = [];
    const seriesStats = {};

    markSeriesPlayed(teamA);
    markSeriesPlayed(teamB);

    const manualOverride =
        typeof consumeManualSeriesOverride === "function"
            ? consumeManualSeriesOverride(
                teamA,
                teamB,
                tournament.seriesLength
            )
            : null;

    const forcedGameWinners = manualOverride
        ? buildManualGameWinnerSequence(
            manualOverride.scoreA,
            manualOverride.scoreB
        )
        : [];

    while (
        scoreA < gamesNeeded &&
        scoreB < gamesNeeded
    ) {

        const teamAWinsGame = manualOverride
            ? forcedGameWinners[games.length] === "A"
            : Math.random() < seriesWinProbabilityA;

        const gameScore =
            generateGameScore();

        const gameNumber =
            games.length + 1;

        if (teamAWinsGame) {

            scoreA++;

            totalGoalsA += gameScore.winnerGoals;
            totalGoalsB += gameScore.loserGoals;

            addTeamGamePlayerStats(
                teamA,
                gameScore.winnerGoals,
                gameScore.loserGoals,
                seriesStats
            );

            addTeamGamePlayerStats(
                teamB,
                gameScore.loserGoals,
                gameScore.winnerGoals,
                seriesStats
            );

            games.push({
                gameNumber,
                winner: teamA.name,
                winnerId: teamA.id,
                teamAScore: gameScore.winnerGoals,
                teamBScore: gameScore.loserGoals,
                overtime: gameScore.overtime
            });

        } else {

            scoreB++;

            totalGoalsA += gameScore.loserGoals;
            totalGoalsB += gameScore.winnerGoals;

            addTeamGamePlayerStats(
                teamA,
                gameScore.loserGoals,
                gameScore.winnerGoals,
                seriesStats
            );

            addTeamGamePlayerStats(
                teamB,
                gameScore.winnerGoals,
                gameScore.loserGoals,
                seriesStats
            );

            games.push({
                gameNumber,
                winner: teamB.name,
                winnerId: teamB.id,
                teamAScore: gameScore.loserGoals,
                teamBScore: gameScore.winnerGoals,
                overtime: gameScore.overtime
            });

        }

    }

    const winningTeam =
        scoreA > scoreB
        ? teamA
        : teamB;

    const formResult =
        applySeriesFormResult(
            preparedForm,
            scoreA,
            scoreB,
            seriesWinProbabilityA
        );

    const chemistryResult =
        typeof applySeriesChemistryResult === "function"
            ? applySeriesChemistryResult(
                preparedChemistry,
                teamA,
                teamB
            )
            : {
                teamA: preparedChemistry.teamA || {},
                teamB: preparedChemistry.teamB || {}
            };

    const mvp =
        getSeriesMVP(
            seriesStats,
            winningTeam
        );

    return {
        teamAId: teamA.id,
        teamBId: teamB.id,

        teamAName: teamA.name,
        teamBName: teamB.name,

        teamALogo: teamA.logo,
        teamBLogo: teamB.logo,

        scoreA,
        scoreB,

        totalGoalsA,
        totalGoalsB,

        games,

        winnerId: winningTeam.id,
        winner: winningTeam.name,

        mvp: mvp.name,

        manualOverride: Boolean(manualOverride),
        manualOverrideId: manualOverride?.id || null,

        form: {
            enabled:
                preparedForm.settings.importance !==
                "off",
            importance:
                preparedForm.settings.importance,
            probabilityA:
                roundTeamForm(
                    seriesWinProbabilityA * 100
                ),
            teamA: formResult.teamA,
            teamB: formResult.teamB
        },

        chemistry: {
            enabled: Boolean(preparedChemistry.enabled),
            importance: preparedChemistry.importance || "off",
            teamA: chemistryResult.teamA || preparedChemistry.teamA || {},
            teamB: chemistryResult.teamB || preparedChemistry.teamB || {}
        },

        ratingBreakdown: {
            teamA: {
                baseRating: roundTeamForm(preparedForm.teamA.baseRating),
                form: roundTeamForm(
                    preparedForm.teamA.previousForm +
                    preparedForm.teamA.liveForm
                ),
                chemistry: roundTeamForm(
                    preparedChemistry.teamA?.bonusBefore || 0
                ),
                effectiveRating: roundTeamForm(effectiveRatingA)
            },
            teamB: {
                baseRating: roundTeamForm(preparedForm.teamB.baseRating),
                form: roundTeamForm(
                    preparedForm.teamB.previousForm +
                    preparedForm.teamB.liveForm
                ),
                chemistry: roundTeamForm(
                    preparedChemistry.teamB?.bonusBefore || 0
                ),
                effectiveRating: roundTeamForm(effectiveRatingB)
            }
        }
    };

}

function generateGameScore() {

    const overtime =
        Math.random() <
        getTournamentOvertimeChance();

    const goalSettings =
        getTournamentGoalSettings();

    if (overtime) {

        const loserGoals =
            randomInt(
                Math.max(1, goalSettings.loserMin),
                Math.max(2, goalSettings.loserMax)
            );

        return {
            winnerGoals: loserGoals + 1,
            loserGoals,
            overtime: true
        };

    }

    const loserGoals =
        randomInt(
            goalSettings.loserMin,
            goalSettings.loserMax
        );

    const winnerGoals =
        randomInt(
            Math.max(
                loserGoals + 1,
                goalSettings.winnerMin
            ),
            goalSettings.winnerMax
        );

    return {
        winnerGoals,
        loserGoals,
        overtime: false
    };

}

function getWeightedPlayer(team) {

    if (
        !team.players ||
        team.players.length === 0
    ) {
        return {
            name: "Unknown Player",
            rating: 50
        };
    }

    const totalRating =
        team.players.reduce((sum, player) =>
            sum + Number(player.rating || 50),
            0
        );

    let roll =
        Math.random() * totalRating;

    for (const player of team.players) {

        roll -= Number(player.rating || 50);

        if (roll <= 0) {
            return player;
        }

    }

    return team.players[0];

}

function getDifferentPlayer(team, playerToAvoid) {

    const options =
        team.players.filter(player =>
            player.name !== playerToAvoid.name
        );

    if (options.length === 0) {
        return playerToAvoid;
    }

    return options[
        Math.floor(
            Math.random() *
            options.length
        )
    ];

}

/* ==========================
   STANDINGS
========================== */

function updateStandings(result) {

    const teamA =
        tournament.standings.find(team =>
            String(team.id) === String(result.teamAId)
        );

    const teamB =
        tournament.standings.find(team =>
            String(team.id) === String(result.teamBId)
        );

    if (!teamA || !teamB) return;

    teamA.gameWins += result.scoreA;
    teamA.gameLosses += result.scoreB;

    teamB.gameWins += result.scoreB;
    teamB.gameLosses += result.scoreA;

    teamA.goalsFor += result.totalGoalsA;
    teamA.goalsAgainst += result.totalGoalsB;

    teamB.goalsFor += result.totalGoalsB;
    teamB.goalsAgainst += result.totalGoalsA;

    if (result.scoreA > result.scoreB) {
        teamA.wins++;
        teamB.losses++;
    } else {
        teamB.wins++;
        teamA.losses++;
    }

}

function renderStandings() {

    if (
        tournament.format === "swiss" ||
        tournament.format === "swissPlayoffs" ||
        tournament.effectiveFormat === "swiss" ||
        tournament.effectiveFormat === "swissPlayoffs"
    ) {
        renderSwissStandings();
        return;
    }

    const container =
        document.getElementById("standings");

    if (!container) return;

    if (
        !tournament.standings ||
        tournament.standings.length === 0
    ) {
        container.innerHTML = `
            <p class="small">
                Standings will appear after matches are played.
            </p>
        `;
        return;
    }

    tournament.standings.sort((a, b) => {

        if (b.wins !== a.wins) {
            return b.wins - a.wins;
        }

        const diffA =
            a.gameWins - a.gameLosses;

        const diffB =
            b.gameWins - b.gameLosses;

        if (diffB !== diffA) {
            return diffB - diffA;
        }

        const goalDiffA =
            a.goalsFor - a.goalsAgainst;

        const goalDiffB =
            b.goalsFor - b.goalsAgainst;

        return goalDiffB - goalDiffA;

    });

    container.innerHTML = `
        <div class="league-table-wrap">

            <table class="league-table">

                <thead>
                    <tr>
                        <th>#</th>
                        <th>Logo</th>
                        <th class="team-name-heading">
                            Team
                        </th>
                        <th>Series</th>
                        <th>Games</th>
                        <th>+/-</th>
                    </tr>
                </thead>

                <tbody>

                    ${tournament.standings.map((team, index) => {

                        const gameDiff =
                            team.gameWins -
                            team.gameLosses;

                        const diffText =
                            gameDiff > 0
                            ? `+${gameDiff}`
                            : `${gameDiff}`;

                        return `
                            <tr class="league-row rank-${index + 1}">

                                <td class="placement-cell">
                                    ${index + 1}.
                                </td>

                                <td class="logo-cell">
                                    ${
                                        team.logo
                                        ? `
                                            <img
                                                src="${team.logo}"
                                                class="league-team-logo"
                                            >
                                        `
                                        : `
                                            <div class="league-team-logo logo-placeholder"></div>
                                        `
                                    }
                                </td>

                                <td class="league-team-name">
                                    ${safeText(team.name)}
                                </td>

                                <td class="record-cell">
                                    ${team.wins}-${team.losses}
                                </td>

                                <td class="record-cell">
                                    ${team.gameWins}-${team.gameLosses}
                                </td>

                                <td class="
                                    diff-cell
                                    ${
                                        gameDiff > 0
                                        ? "positive-diff"
                                        : gameDiff < 0
                                        ? "negative-diff"
                                        : "neutral-diff"
                                    }
                                ">
                                    ${diffText}
                                </td>

                            </tr>
                        `;

                    }).join("")}

                </tbody>

            </table>

        </div>
    `;

}

function renderSwissStandings() {

    const container =
        document.getElementById("standings");

    if (!container) return;

    if (
        !tournament.standings ||
        tournament.standings.length === 0
    ) {
        container.innerHTML = `
            <p class="small">
                Swiss standings will appear after matches are played.
            </p>
        `;
        return;
    }

    const sorted =
        [...tournament.standings]
            .sort(sortSwissStandings);

    const maxRounds =
        Math.max(
            5,
            tournament.swiss.maxRounds || 5,
            ...sorted.map(team =>
                team.roundResults
                ? team.roundResults.length
                : 0
            )
        );

    container.innerHTML = `
        <div class="swiss-table-wrap">

            <table class="swiss-table">

                <thead>
                    <tr>
                        <th>#</th>
                        <th class="swiss-team-heading">Team</th>
                        <th>Matches</th>
                        <th>Games</th>
                        <th>GD</th>

                        ${Array.from(
                            { length: maxRounds },
                            (_, index) => `
                                <th>Round ${index + 1}</th>
                            `
                        ).join("")}
                    </tr>
                </thead>

                <tbody>

                    ${sorted.map((team, index) => {

                        const gameDiff =
                            team.gameWins -
                            team.gameLosses;

                        return `
                            <tr class="
                                swiss-row
                                ${
                                    team.status === "qualified"
                                    ? "swiss-qualified"
                                    : team.status === "eliminated"
                                    ? "swiss-eliminated"
                                    : "swiss-active"
                                }
                            ">

                                <td class="swiss-rank-cell">
                                    ${index + 1}.
                                </td>

                                <td class="swiss-team-cell">

                                    <div class="swiss-team-info">

                                        ${
                                            team.logo
                                            ? `
                                                <img
                                                    src="${team.logo}"
                                                    class="swiss-team-logo"
                                                >
                                            `
                                            : `
                                                <div class="swiss-team-logo logo-placeholder"></div>
                                            `
                                        }

                                        <span>
                                            ${safeText(team.name)}
                                        </span>

                                    </div>

                                </td>

                                <td class="swiss-record-cell">
                                    ${team.wins}-${team.losses}
                                </td>

                                <td class="swiss-record-cell">
                                    ${team.gameWins}-${team.gameLosses}
                                </td>

                                <td class="swiss-record-cell">
                                    ${
                                        gameDiff > 0
                                        ? `+${gameDiff}`
                                        : gameDiff
                                    }
                                </td>

                                ${Array.from(
                                    { length: maxRounds },
                                    (_, roundIndex) => {

                                        const result =
                                            team.roundResults[roundIndex];

                                        if (!result) {
                                            return `
                                                <td class="swiss-round-empty">
                                                    -
                                                </td>
                                            `;
                                        }

                                        return `
                                            <td class="
                                                swiss-round-cell
                                                ${
                                                    result.won
                                                    ? "swiss-round-win"
                                                    : "swiss-round-loss"
                                                }
                                            ">

                                                <div class="swiss-round-box">

                                                    ${
                                                        result.opponentLogo
                                                        ? `
                                                            <img
                                                                src="${result.opponentLogo}"
                                                                class="swiss-round-logo"
                                                            >
                                                        `
                                                        : `
                                                            <div class="swiss-round-logo logo-placeholder"></div>
                                                        `
                                                    }

                                                    <div class="swiss-round-meta">

                                                        <span class="swiss-round-opponent">
                                                            ${safeText(result.opponentName)}
                                                        </span>

                                                        <strong>
                                                            ${result.resultText}
                                                        </strong>

                                                    </div>

                                                </div>

                                            </td>
                                        `;

                                    }
                                ).join("")}

                            </tr>
                        `;

                    }).join("")}

                </tbody>

            </table>

        </div>
    `;

}

/* ==========================
   MATCH CENTER
========================== */

function renderMatchFormSummary(result) {
    const breakdownA = result?.ratingBreakdown?.teamA || {};
    const breakdownB = result?.ratingBreakdown?.teamB || {};

    if (
        !result?.form?.enabled &&
        !result?.chemistry?.enabled &&
        !result?.manualOverride
    ) {
        return "";
    }

    const manualBadge = result.manualOverride
        ? `<strong class="manual-result-badge">Manual Result</strong>`
        : "";

    return `
        <div class="match-form-summary">
            ${manualBadge}

            <span>
                ${safeText(result.teamAName)}:
                Rating ${breakdownA.baseRating ?? result.form?.teamA?.baseRating ?? "-"}
                · Form ${formatTeamFormValue(breakdownA.form || 0)}
                · Chemistry ${formatTeamFormValue(breakdownA.chemistry || 0)}
                · Effective ${breakdownA.effectiveRating ?? result.form?.teamA?.effectiveRatingBefore ?? "-"}
            </span>

            <strong>
                Adjusted per-game chance:
                ${result.form?.probabilityA ?? 50}%
                / ${roundTeamForm(100 - Number(result.form?.probabilityA ?? 50))}%
            </strong>

            <span>
                ${safeText(result.teamBName)}:
                Rating ${breakdownB.baseRating ?? result.form?.teamB?.baseRating ?? "-"}
                · Form ${formatTeamFormValue(breakdownB.form || 0)}
                · Chemistry ${formatTeamFormValue(breakdownB.chemistry || 0)}
                · Effective ${breakdownB.effectiveRating ?? result.form?.teamB?.effectiveRatingBefore ?? "-"}
            </span>
        </div>
    `;
}

function addMatchCard(result) {

    const feed =
        document.getElementById("matchFeed");

    if (!feed) return;

    const gameList =
        result.games.map(game => `
            <div class="series-game detailed-game-row">

                <span>
                    Game ${game.gameNumber}
                    ${
                        game.overtime
                        ? "<strong class='ot-badge'>OT</strong>"
                        : ""
                    }
                </span>

                <span>
                    ${safeText(result.teamAName)}
                    ${game.teamAScore}
                    -
                    ${game.teamBScore}
                    ${safeText(result.teamBName)}
                </span>

                <strong>
                    ${safeText(game.winner)}
                </strong>

            </div>
        `).join("");

    feed.innerHTML += `
        <div class="broadcast-match">

            <div class="match-stage-label">
                ${safeText(tournament.round)}
                |
                Best of ${tournament.seriesLength}
            </div>

            <div class="broadcast-scoreboard">

                <div class="broadcast-team">

                    ${
                        result.teamALogo
                        ? `
                            <img
                                src="${result.teamALogo}"
                                class="broadcast-logo"
                            >
                        `
                        : ""
                    }

                    <span>
                        ${safeText(result.teamAName)}
                    </span>

                </div>

                <div class="broadcast-score">
                    ${result.scoreA} - ${result.scoreB}
                </div>

                <div class="broadcast-team">

                    ${
                        result.teamBLogo
                        ? `
                            <img
                                src="${result.teamBLogo}"
                                class="broadcast-logo"
                            >
                        `
                        : ""
                    }

                    <span>
                        ${safeText(result.teamBName)}
                    </span>

                </div>

            </div>

            <div class="series-total-goals">
                Total Goals:
                ${safeText(result.teamAName)}
                ${result.totalGoalsA}
                -
                ${result.totalGoalsB}
                ${safeText(result.teamBName)}
            </div>

            ${renderMatchFormSummary(result)}

            <div class="broadcast-details">
                ${gameList}
            </div>

            <div class="broadcast-footer">
                🏆 Winner: ${safeText(result.winner)}
                <br>
                ⭐ Series MVP: ${safeText(result.mvp)}
            </div>

        </div>
    `;

}

/* ==========================
   BRACKET TREE
========================== */

function renderBracketTree() {

    const container =
        document.getElementById("bracketContainer");

    if (!container) return;

    const hasRoundOf16 =
        tournament.bracket.roundOf16 &&
        tournament.bracket.roundOf16.length > 0;

    const hasQuarterFinals =
        tournament.bracket.quarterFinals &&
        tournament.bracket.quarterFinals.length > 0;

    container.innerHTML = `

        <div class="bracket-tree">

            ${
                hasRoundOf16
                ? `
                    <div class="bracket-column">

                        <h3>Round of 16</h3>

                        ${
                            tournament.bracket.roundOf16
                                .map(match =>
                                    renderBracketCard(match)
                                )
                                .join("")
                        }

                    </div>
                `
                : ""
            }

            ${
                hasQuarterFinals
                ? `
                    <div class="bracket-column">

                        <h3>Quarterfinals</h3>

                        ${
                            tournament.bracket.quarterFinals
                                .map(match =>
                                    renderBracketCard(match)
                                )
                                .join("")
                        }

                    </div>
                `
                : ""
            }

            <div class="bracket-column">

                <h3>Semifinals</h3>

                ${
                    tournament.bracket.semiFinals.length
                    ? tournament.bracket.semiFinals
                        .map(match =>
                            renderBracketCard(match)
                        )
                        .join("")
                    : renderEmptyBracketCard(
                        hasQuarterFinals
                        ? "Awaiting Quarterfinals"
                        : hasRoundOf16
                        ? "Awaiting Round of 16"
                        : "Awaiting Teams"
                    )
                }

            </div>

            <div class="bracket-column">

                <h3>Grand Final</h3>

                ${
                    tournament.bracket.grandFinal
                    ? renderBracketCard(
                        tournament.bracket.grandFinal
                    )
                    : renderEmptyBracketCard(
                        "Awaiting Semifinals"
                    )
                }

            </div>

            <div class="bracket-column champion-column">

                <h3>Champion</h3>

                ${
                    tournament.bracket.champion
                    ? renderChampionSlot(
                        tournament.bracket.champion
                    )
                    : renderEmptyBracketCard(
                        "Awaiting Final"
                    )
                }

            </div>

        </div>

    `;

}

function renderBracketCard(match) {

    return `
        <div class="bracket-card">
            ${renderBracketTeam(match, match.teamA)}
            ${renderBracketTeam(match, match.teamB)}
        </div>
    `;

}

function renderBracketTeam(match, team) {

    const hasResult =
        Boolean(match.result);

    const isWinner =
        hasResult &&
        String(match.result.winnerId) === String(team.id);

    let score = "";

    if (hasResult) {

        score =
            String(match.result.teamAId) === String(team.id)
            ? match.result.scoreA
            : match.result.scoreB;

    }

    return `
        <div
            class="
                bracket-team-row
                ${isWinner ? "bracket-winner" : ""}
            "
        >

            ${
                team.logo
                ? `
                    <img
                        src="${team.logo}"
                        class="bracket-logo"
                    >
                `
                : `
                    <div class="bracket-logo"></div>
                `
            }

            <span class="bracket-name">
                ${safeText(team.name)}
            </span>

            <span class="bracket-score">
                ${score}
            </span>

        </div>
    `;

}

function renderEmptyBracketCard(text) {

    return `
        <div class="bracket-card bracket-empty">
            ${safeText(text)}
        </div>
    `;

}

function renderChampionSlot(team) {

    return `
        <div class="bracket-champion-card">

            ${
                team.logo
                ? `
                    <img
                        src="${team.logo}"
                        class="bracket-champion-logo"
                    >
                `
                : `
                    <div class="bracket-champion-logo"></div>
                `
            }

            <div>
                🏆
            </div>

            <strong>
                ${safeText(team.name)}
            </strong>

        </div>
    `;

}

/* ==========================
   CHAMPIONS
========================== */

function showPlayoffChampion() {

    const feed =
        document.getElementById("matchFeed");

    if (
        !feed ||
        !tournament.bracket.champion
    ) {
        return;
    }

    const champion =
        tournament.bracket.champion;

    feed.innerHTML += `
        <div class="team-card">

            <div class="team-banner"></div>

            <div class="team-content">

                <h2>🏆 Champion</h2>

                <h1 style="
                    font-size:48px;
                    color:gold;
                ">
                    ${safeText(champion.name)}
                </h1>

                <p>
                    Tournament Winner
                </p>

            </div>

        </div>
    `;

    saveTournamentToHistoryIfPossible();

}

function showChampion() {

    tournament.standings.sort((a, b) => {

        if (b.wins !== a.wins) {
            return b.wins - a.wins;
        }

        const diffA =
            a.gameWins - a.gameLosses;

        const diffB =
            b.gameWins - b.gameLosses;

        if (diffB !== diffA) {
            return diffB - diffA;
        }

        const goalDiffA =
            a.goalsFor - a.goalsAgainst;

        const goalDiffB =
            b.goalsFor - b.goalsAgainst;

        return goalDiffB - goalDiffA;

    });

    const champion =
        tournament.standings[0];

    if (!champion) return;

    tournament.champion =
        champion.name;

    const feed =
        document.getElementById("matchFeed");

    if (!feed) return;

    feed.innerHTML += `
        <div class="team-card">

            <div class="team-banner"></div>

            <div class="team-content">

                <h2>🏆 Champion</h2>

                <h1 style="
                    font-size:48px;
                    color:gold;
                ">
                    ${safeText(champion.name)}
                </h1>

                <p>
                    Tournament Winner
                </p>

                <p>
                    ${champion.wins}
                    Match Wins
                </p>

            </div>

        </div>
    `;

    saveTournamentToHistoryIfPossible();

}

function saveTournamentToHistoryIfPossible() {

    if (
        typeof saveCompletedTournament === "function"
    ) {
        saveCompletedTournament();
    }

    if (
        typeof renderHistory === "function"
    ) {
        renderHistory();
    }

}

/* ==========================
   SETTINGS HELPERS
========================== */

function getTournamentWinProbability(
    ratingA,
    ratingB
) {

    if (
        typeof calculateWinProbability ===
        "function"
    ) {
        return calculateWinProbability(
            ratingA,
            ratingB
        );
    }

    const teamARating = Number(ratingA || 50);
    const teamBRating = Number(ratingB || 50);
    const ratingDifference = teamARating - teamBRating;

    let probability =
        1 /
        (
            1 +
            Math.pow(
                10,
                -ratingDifference / 16
            )
        );

    return Math.max(
        0.06,
        Math.min(
            0.94,
            probability
        )
    );

}

function getTournamentDelay() {

    if (
        typeof getSimulationDelay === "function"
    ) {
        return getSimulationDelay();
    }

    return 900;

}

function getTournamentOvertimeChance() {

    if (
        typeof getOvertimeChance === "function"
    ) {
        return getOvertimeChance();
    }

    return 0.18;

}

function getTournamentGoalSettings() {

    if (
        typeof getGoalSettings === "function"
    ) {
        return getGoalSettings();
    }

    return {
        loserMin: 0,
        loserMax: 3,
        winnerMin: 2,
        winnerMax: 6
    };

}

/* ==========================
   HELPERS
========================== */

function sleep(ms) {

    return new Promise(resolve =>
        setTimeout(resolve, ms)
    );

}

function randomInt(min, max) {

    return Math.floor(
        Math.random() *
        (max - min + 1)
    ) + min;

}

function safeText(value) {

    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}

/* ==========================
   INIT
========================== */

window.addEventListener("load", () => {

    setTimeout(() => {

        renderTournamentTeams();
        renderSeedings();
        renderPlayerStats();
        renderStandings();

        updateStageSeriesSettingsVisibility();

        const formatInput =
            document.getElementById(
                "tournamentFormat"
            );

        if (formatInput) {
            formatInput.addEventListener(
                "change",
                updateStageSeriesSettingsVisibility
            );
        }

    }, 500);

});