/* ==========================
   RLCS LEAGUE SIMULATOR
   FORMATS.JS
   Format routing, brackets, double elimination, history-safe finish
========================== */

const FORMAT_LABELS = {
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

/* ==========================
   FORMAT AVAILABILITY
========================== */

function getAllowedFormatsForEventType(eventType) {

    if (eventType === "regional") {
        return [
            "roundRobin",
            "swiss",
            "swissPlayoffs",
            "groupsHybrid",
            "groupsDoubleElim",
            "playoffs",
            "doubleElim",
            "custom"
        ];
    }

    if (eventType === "major") {
        return [
            "swissPlayoffs",
            "groupsHybrid",
            "groupsDoubleElim",
            "doubleElim",
            "playoffs",
            "custom"
        ];
    }

    if (eventType === "worlds") {
        return [
            "swissPlayoffs",
            "groupsHybrid",
            "groupsDoubleElim",
            "custom",
            "playoffs"
        ];
    }

    if (eventType === "lcq") {
        return ["regionalLcq"];
    }

    if (eventType === "playin") {
        return ["worldsPlayIn"];
    }

    return [
        "roundRobin",
        "playoffs",
        "swiss",
        "swissPlayoffs",
        "groupsHybrid",
        "groupsDoubleElim",
        "doubleElim",
        "regionalLcq",
        "worldsPlayIn",
        "custom"
    ];

}

function updateFormatAvailability() {

    const eventTypeInput =
        document.getElementById("eventType");

    const formatInput =
        document.getElementById("tournamentFormat");

    if (!eventTypeInput || !formatInput) return;

    const allowed =
        getAllowedFormatsForEventType(
            eventTypeInput.value
        );

    Array.from(formatInput.options).forEach(option => {
        option.disabled =
            !allowed.includes(option.value);
    });

    if (!allowed.includes(formatInput.value)) {
        formatInput.value = allowed[0];
    }

    toggleCustomBracketSettings();
    updateStageSeriesSettingsVisibilitySafe();

}

function toggleCustomBracketSettings() {

    const formatInput =
        document.getElementById("tournamentFormat");

    const settings =
        document.getElementById("customBracketSettings");

    if (!formatInput || !settings) return;

    if (formatInput.value === "custom") {
        settings.classList.remove("hidden");
    } else {
        settings.classList.add("hidden");
    }

}

function updateStageSeriesSettingsVisibilitySafe() {

    if (
        typeof updateStageSeriesSettingsVisibility ===
        "function"
    ) {
        updateStageSeriesSettingsVisibility();
        return;
    }

    const settings =
        document.getElementById("stageSeriesSettings");

    const formatInput =
        document.getElementById("tournamentFormat");

    if (!settings || !formatInput) return;

    if (formatInput.value === "swissPlayoffs") {
        settings.classList.remove("hidden");
    } else {
        settings.classList.add("hidden");
    }

}

/* ==========================
   SAFE EVENT HANDLER WRAP
========================== */

const baseHandleEventSettingsChanged =
    window.handleEventSettingsChanged;

window.handleEventSettingsChanged = function () {

    if (
        typeof baseHandleEventSettingsChanged ===
        "function"
    ) {
        baseHandleEventSettingsChanged();
    }

    updateFormatAvailability();

};

/* ==========================
   START TOURNAMENT OVERRIDE
========================== */

function startTournament() {

    if (tournament.running) {
        alert("An event is already running. Wait for it to finish.");
        return;
    }

    if (tournament.selectedTeams.length < 2) {
        alert("Select at least 2 teams.");
        return;
    }

    if (
        typeof initialiseStageSeriesSettings ===
        "function"
    ) {
        initialiseStageSeriesSettings();
    }

    if (
        typeof setTournamentSeriesLengthForStage ===
        "function"
    ) {
        setTournamentSeriesLengthForStage("default");
    } else {
        const seriesSelect =
            document.getElementById("seriesFormat");

        tournament.seriesLength =
            seriesSelect
            ? Number(seriesSelect.value)
            : 5;
    }

    const formatSelect =
        document.getElementById("tournamentFormat");

    const requestedFormat =
        formatSelect
        ? formatSelect.value
        : "roundRobin";

    tournament.format =
        requestedFormat;

    tournament.effectiveFormat =
        getEffectiveTournamentFormat(
            requestedFormat
        );

    tournament.customConfig =
        getCustomBracketConfig();

    syncSeedings();

    let participants =
        tournament.seedings.map(seededTeam =>
            teams.find(team =>
                String(team.id) ===
                String(seededTeam.id)
            )
        ).filter(Boolean);

    participants =
        applySeedingMethod(
            participants,
            tournament.customConfig.seedingMethod
        );

    if (
        requestedFormat === "custom" &&
        tournament.customConfig.size > 0
    ) {
        participants =
            participants.slice(
                0,
                tournament.customConfig.size
            );
    }

    tournament.participants =
        participants;

    tournament.running = true;
    tournament.champion = null;
    tournament.mvp = null;
    tournament.savedToHistory = false;

    if (
        typeof createEmptyTournamentFormContext ===
        "function"
    ) {
        tournament.teamForm =
            createEmptyTournamentFormContext();
    }

    if (typeof createEmptyTournamentChemistryContext === "function") {
        tournament.chemistry =
            createEmptyTournamentChemistryContext();
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

    tournament.doubleElim = {
        size: 0,
        rounds: [],
        champion: null,
        finalPlacements: []
    };

    tournament.groupStage = {
        active: false,
        playoffStyle: "hybrid",
        groups: [],
        playoffRounds: {},
        finalPlacements: [],
        champion: null,
        runnerUp: null
    };

    tournament.lcq = {
        active: false,
        region: null,
        seeds: [],
        provisionalQualifierIds: [],
        rounds: [],
        qualifiedTeams: [],
        eliminatedTeams: [],
        finalPlacements: []
    };

    tournament.playIn = {
        active: false,
        seeds: [],
        upperQuarterfinals: [],
        upperSemifinals: [],
        lowerQuarterfinals: [],
        lowerSemifinals: [],
        qualifiedTeams: [],
        eliminatedTeams: [],
        finalPlacements: []
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

    initialisePlayerStats(participants);

    clearTournamentUI();

    renderPlayerStats();

    runFormatRouter(
        tournament.effectiveFormat,
        participants
    );

}

function getEffectiveTournamentFormat(requestedFormat) {

    if (requestedFormat !== "custom") {
        return requestedFormat;
    }

    const config =
        getCustomBracketConfig();

    return config.baseFormat;

}

function getCustomBracketConfig() {

    const sizeInput =
        document.getElementById("customBracketSize");

    const baseInput =
        document.getElementById("customBaseFormat");

    const seedInput =
        document.getElementById("customSeedingMethod");

    return {
        size:
            sizeInput
            ? Number(sizeInput.value)
            : 8,

        baseFormat:
            baseInput
            ? baseInput.value
            : "playoffs",

        seedingMethod:
            seedInput
            ? seedInput.value
            : "manual"
    };

}

function runFormatRouter(format, participants) {

    if (format === "roundRobin") {
        generateRoundRobin(participants);
        return;
    }

    if (format === "playoffs") {
        startPlayoffs(participants);
        return;
    }

    if (format === "swiss") {
        startSwiss(participants, false);
        return;
    }

    if (format === "swissPlayoffs") {
        startSwiss(participants, true);
        return;
    }

    if (format === "doubleElim") {
        startDoubleElimination(participants);
        return;
    }

    if (format === "groupsHybrid") {
        startGroupStagePlayoffs(
            participants,
            "hybrid"
        );
        return;
    }

    if (format === "groupsDoubleElim") {
        startGroupStagePlayoffs(
            participants,
            "doubleElim"
        );
        return;
    }

    if (format === "regionalLcq") {
        if (typeof startRegionalLcq === "function") {
            startRegionalLcq(participants);
        } else {
            alert("The Regional LCQ engine is not loaded.");
            tournament.running = false;
        }
        return;
    }

    if (format === "worldsPlayIn") {
        if (typeof startWorldsPlayIn === "function") {
            startWorldsPlayIn(participants);
        } else {
            alert("The Worlds Play-In engine is not loaded.");
            tournament.running = false;
        }
        return;
    }

    alert("Unknown format selected.");

    tournament.running = false;

}

function applySeedingMethod(participants, method) {

    const list =
        [...participants];

    if (method === "rating") {
        return list.sort((a, b) =>
            Number(b.rating || 0) -
            Number(a.rating || 0)
        );
    }

    if (method === "leaguePoints") {

        const state =
            typeof getLeagueState === "function"
            ? getLeagueState()
            : {
                teams: {}
            };

        return list.sort((a, b) => {

            const aPoints =
                state.teams[String(a.id)]
                    ?.totalPoints || 0;

            const bPoints =
                state.teams[String(b.id)]
                    ?.totalPoints || 0;

            if (bPoints !== aPoints) {
                return bPoints - aPoints;
            }

            return Number(b.rating || 0) -
                Number(a.rating || 0);

        });

    }

    if (method === "random") {
        return list.sort(() =>
            Math.random() - 0.5
        );
    }

    return list;

}

/* ==========================
   HIGH VS LOW SEED PAIRING
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

/* ==========================
   SINGLE ELIMINATION
========================== */

function startPlayoffs(participants) {

    if (participants.length < 4) {
        alert("Single Elimination requires at least 4 teams.");
        tournament.running = false;
        return;
    }

    if (
        typeof setTournamentSeriesLengthForStage ===
        "function"
    ) {
        setTournamentSeriesLengthForStage("playoffs");
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
                createHighLowSeedPairs(
                    participants,
                    16
                ),
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
                createHighLowSeedPairs(
                    participants,
                    8
                ),
                "Quarterfinals"
            );

        renderBracketTree();
        runBracket();

        return;

    }

    tournament.round = "Semifinals";

    tournament.bracket.semiFinals =
        createBracketMatchesFromPairs(
            createHighLowSeedPairs(
                participants,
                4
            ),
            "Semifinals"
        );

    renderBracketTree();
    runBracket();

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
                getWinningTeam(
                    match,
                    result
                );

            quarterFinalists.push(match.winner);

            addMatchCard(result);
            renderBracketTree();
            renderPlayerStats();

            await sleep(getTournamentDelay());

        }

        tournament.round = "Quarterfinals";

        tournament.bracket.quarterFinals =
            createBracketMatchesFromPairs(
                createHighLowSeedPairs(
                    quarterFinalists,
                    8
                ),
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
                getWinningTeam(
                    match,
                    result
                );

            semiFinalists.push(match.winner);

            addMatchCard(result);
            renderBracketTree();
            renderPlayerStats();

            await sleep(getTournamentDelay());

        }

        tournament.round = "Semifinals";

        tournament.bracket.semiFinals =
            createBracketMatchesFromPairs(
                createHighLowSeedPairs(
                    semiFinalists,
                    4
                ),
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
            getWinningTeam(
                match,
                result
            );

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

/* ==========================
   DOUBLE ELIMINATION
========================== */

function startDoubleElimination(participants) {

    const size = participants.length;

    if (![4, 8, 16].includes(size)) {
        alert("Double Elimination requires exactly 4, 8, or 16 teams.");
        tournament.running = false;
        return;
    }

    if (
        typeof setTournamentSeriesLengthForStage ===
        "function"
    ) {
        setTournamentSeriesLengthForStage("playoffs");
    }

    const bracketTeams = participants.slice(0, size);

    tournament.round = "Double Elimination";
    tournament.doubleElim = createDoubleElimBracketState(
        bracketTeams
    );

    renderDoubleElimBracket();
    runDoubleElimination(bracketTeams);

}

function createDoubleElimBracketState(bracketTeams) {

    const size = bracketTeams.length;
    const upperNames = getDoubleElimUpperRoundNames(size);
    const lowerNames = getDoubleElimLowerRoundNames(size);

    const upperCounts = [];
    let upperMatchCount = size / 2;

    while (upperMatchCount >= 1) {
        upperCounts.push(upperMatchCount);
        upperMatchCount /= 2;
    }

    const lowerCounts = getDoubleElimLowerRoundCounts(size);

    const upperRounds = upperNames.map((name, index) =>
        createDoubleElimRoundRecord(
            `de-upper-${index + 1}`,
            name,
            "upper",
            upperCounts[index]
        )
    );

    const lowerRounds = lowerNames.map((name, index) =>
        createDoubleElimRoundRecord(
            `de-lower-${index + 1}`,
            name,
            "lower",
            lowerCounts[index]
        )
    );

    const grandFinalRound = createDoubleElimRoundRecord(
        "de-grand-final",
        "Grand Final",
        "final",
        1
    );

    const resetFinalRound = createDoubleElimRoundRecord(
        "de-bracket-reset",
        "Bracket Reset",
        "final",
        1
    );

    resetFinalRound.status = "waiting";

    const state = {
        size,
        seededTeams: bracketTeams,
        upperRounds,
        lowerRounds,
        grandFinalRound,
        resetFinalRound,
        rounds: [
            ...upperRounds,
            ...lowerRounds,
            grandFinalRound,
            resetFinalRound
        ],
        champion: null,
        runnerUp: null,
        finalPlacements: [],
        eliminationGroups: [],
        remainingTeams: size,
        resetRequired: false
    };

    const openingPairs = createDoubleElimOpeningPairs(
        bracketTeams
    );

    setDoubleElimRoundMatches(
        state.upperRounds[0],
        openingPairs.map((pair, index) => ({
            ...pair,
            sourceA: `Seed ${pair.seedA}`,
            sourceB: `Seed ${pair.seedB}`,
            bracketMatchNumber: index + 1
        }))
    );

    return state;

}

function getDoubleElimUpperRoundNames(size) {

    if (size === 4) {
        return [
            "Upper Bracket Semifinals",
            "Upper Bracket Final"
        ];
    }

    if (size === 8) {
        return [
            "Upper Bracket Quarterfinals",
            "Upper Bracket Semifinals",
            "Upper Bracket Final"
        ];
    }

    return [
        "Upper Bracket Round 1",
        "Upper Bracket Quarterfinals",
        "Upper Bracket Semifinals",
        "Upper Bracket Final"
    ];

}

function getDoubleElimLowerRoundNames(size) {

    if (size === 4) {
        return [
            "Lower Bracket Round 1",
            "Lower Bracket Final"
        ];
    }

    if (size === 8) {
        return [
            "Lower Bracket Round 1",
            "Lower Bracket Round 2",
            "Lower Bracket Semifinal",
            "Lower Bracket Final"
        ];
    }

    return [
        "Lower Bracket Round 1",
        "Lower Bracket Round 2",
        "Lower Bracket Round 3",
        "Lower Bracket Quarterfinals",
        "Lower Bracket Semifinal",
        "Lower Bracket Final"
    ];

}

function getDoubleElimLowerRoundCounts(size) {

    if (size === 4) return [1, 1];
    if (size === 8) return [2, 2, 1, 1];
    return [4, 4, 2, 2, 1, 1];

}

function createDoubleElimRoundRecord(
    id,
    name,
    side,
    matchCount
) {

    return {
        id,
        name,
        side,
        status: "pending",
        matches: Array.from(
            { length: matchCount },
            (_, index) => createDoubleElimPlaceholderMatch(
                `${id}-match-${index + 1}`,
                index + 1
            )
        )
    };

}

function createDoubleElimPlaceholderMatch(id, matchNumber) {

    return {
        id,
        matchNumber,
        teamA: null,
        teamB: null,
        sourceA: "TBD",
        sourceB: "TBD",
        result: null,
        winner: null,
        loser: null
    };

}

function createDoubleElimOpeningPairs(bracketTeams) {

    const seedOrder = getDoubleElimSeedOrder(
        bracketTeams.length
    );

    const pairs = [];

    for (let index = 0; index < seedOrder.length; index += 2) {

        const seedA = seedOrder[index];
        const seedB = seedOrder[index + 1];

        pairs.push({
            teamA: bracketTeams[seedA - 1],
            teamB: bracketTeams[seedB - 1],
            seedA,
            seedB
        });

    }

    return pairs;

}

function getDoubleElimSeedOrder(size) {

    let order = [1, 2];

    while (order.length < size) {
        const nextSize = order.length * 2;

        order = order.flatMap(seed => [
            seed,
            nextSize + 1 - seed
        ]);
    }

    return order;

}

function setDoubleElimRoundMatches(roundRecord, matches) {

    roundRecord.matches = matches.map((match, index) => ({
        id:
            roundRecord.matches[index]?.id ||
            `${roundRecord.id}-match-${index + 1}`,
        matchNumber: index + 1,
        teamA: match.teamA || null,
        teamB: match.teamB || null,
        sourceA: match.sourceA || "TBD",
        sourceB: match.sourceB || "TBD",
        result: null,
        winner: null,
        loser: null
    }));

    roundRecord.status = "ready";

}

async function playDoubleElimRoundRecord(
    roundRecord,
    matches
) {

    setDoubleElimRoundMatches(roundRecord, matches);

    tournament.round = roundRecord.name;
    roundRecord.status = "running";

    renderDoubleElimBracket();

    const winners = [];
    const losers = [];

    for (const match of roundRecord.matches) {

        if (!match.teamA || !match.teamB) {
            throw new Error(
                `Invalid Double Elimination matchup in ${roundRecord.name}.`
            );
        }

        const result = simulateSeries(
            match.teamA,
            match.teamB
        );

        const winner =
            String(result.winnerId) === String(match.teamA.id)
            ? match.teamA
            : match.teamB;

        const loser =
            String(winner.id) === String(match.teamA.id)
            ? match.teamB
            : match.teamA;

        match.result = result;
        match.winner = winner;
        match.loser = loser;

        winners.push(winner);
        losers.push(loser);

        addMatchCard(result);
        renderDoubleElimBracket();
        renderPlayerStats();

        await sleep(getTournamentDelay());

    }

    roundRecord.status = "complete";
    renderDoubleElimBracket();

    return {
        winners,
        losers
    };

}

async function runDoubleElimination(bracketTeams) {

    const state = tournament.doubleElim;

    try {

        let upperResult = await playDoubleElimRoundRecord(
            state.upperRounds[0],
            state.upperRounds[0].matches.map(match => ({
                teamA: match.teamA,
                teamB: match.teamB,
                sourceA: match.sourceA,
                sourceB: match.sourceB
            }))
        );

        let lowerResult = await playDoubleElimRoundRecord(
            state.lowerRounds[0],
            createDoubleElimFirstLowerMatches(
                upperResult.losers,
                state.upperRounds[0]
            )
        );

        registerDoubleElimEliminations(
            lowerResult.losers,
            state.lowerRounds[0].name
        );

        let lowerRoundIndex = 1;

        for (
            let upperRoundIndex = 1;
            upperRoundIndex < state.upperRounds.length;
            upperRoundIndex++
        ) {

            const previousUpperRound =
                state.upperRounds[upperRoundIndex - 1];

            const currentUpperRound =
                state.upperRounds[upperRoundIndex];

            upperResult = await playDoubleElimRoundRecord(
                currentUpperRound,
                createDoubleElimNextUpperMatches(
                    upperResult.winners,
                    previousUpperRound
                )
            );

            const dropRound =
                state.lowerRounds[lowerRoundIndex];

            lowerResult = await playDoubleElimRoundRecord(
                dropRound,
                createDoubleElimDropMatches(
                    lowerResult.winners,
                    upperResult.losers,
                    state.lowerRounds[lowerRoundIndex - 1],
                    currentUpperRound
                )
            );

            registerDoubleElimEliminations(
                lowerResult.losers,
                dropRound.name
            );

            lowerRoundIndex++;

            const upperFinalReached =
                upperRoundIndex === state.upperRounds.length - 1;

            if (!upperFinalReached) {

                const consolidationRound =
                    state.lowerRounds[lowerRoundIndex];

                lowerResult = await playDoubleElimRoundRecord(
                    consolidationRound,
                    createDoubleElimConsolidationMatches(
                        lowerResult.winners,
                        dropRound
                    )
                );

                registerDoubleElimEliminations(
                    lowerResult.losers,
                    consolidationRound.name
                );

                lowerRoundIndex++;

            }

        }

        const upperBracketChampion =
            upperResult.winners[0];

        const lowerBracketChampion =
            lowerResult.winners[0];

        const finalResult = await playDoubleElimGrandFinals(
            upperBracketChampion,
            lowerBracketChampion
        );

        finishDoubleElim(
            finalResult.champion,
            finalResult.runnerUp
        );

    } catch (error) {

        console.error(
            "Double Elimination failed:",
            error
        );

        alert(
            `Double Elimination could not continue: ${error.message}`
        );

    } finally {

        tournament.running = false;

        if (tournament.doubleElim?.champion) {
            saveTournamentToHistoryIfPossible();
        }

    }

}

function createDoubleElimNextUpperMatches(
    winners,
    previousRound
) {

    const matches = [];

    for (let index = 0; index < winners.length; index += 2) {
        matches.push({
            teamA: winners[index],
            teamB: winners[index + 1],
            sourceA:
                `Winner ${previousRound.name} Match ${index + 1}`,
            sourceB:
                `Winner ${previousRound.name} Match ${index + 2}`
        });
    }

    return matches;

}

function createDoubleElimFirstLowerMatches(
    upperLosers,
    upperRound
) {

    const matches = [];

    for (let index = 0; index < upperLosers.length; index += 2) {
        matches.push({
            teamA: upperLosers[index],
            teamB: upperLosers[index + 1],
            sourceA:
                `Loser ${upperRound.name} Match ${index + 1}`,
            sourceB:
                `Loser ${upperRound.name} Match ${index + 2}`
        });
    }

    return matches;

}

function createDoubleElimDropMatches(
    lowerWinners,
    upperLosers,
    previousLowerRound,
    currentUpperRound
) {

    const matches = [];

    for (let index = 0; index < lowerWinners.length; index++) {

        const crossedUpperIndex =
            upperLosers.length === 1
            ? 0
            : index ^ 1;

        matches.push({
            teamA: lowerWinners[index],
            teamB: upperLosers[crossedUpperIndex],
            sourceA:
                `Winner ${previousLowerRound.name} Match ${index + 1}`,
            sourceB:
                `Loser ${currentUpperRound.name} Match ${crossedUpperIndex + 1}`
        });

    }

    return matches;

}

function createDoubleElimConsolidationMatches(
    lowerWinners,
    previousLowerRound
) {

    const matches = [];

    for (let index = 0; index < lowerWinners.length; index += 2) {
        matches.push({
            teamA: lowerWinners[index],
            teamB: lowerWinners[index + 1],
            sourceA:
                `Winner ${previousLowerRound.name} Match ${index + 1}`,
            sourceB:
                `Winner ${previousLowerRound.name} Match ${index + 2}`
        });
    }

    return matches;

}

function registerDoubleElimEliminations(
    eliminatedTeams,
    roundName
) {

    const state = tournament.doubleElim;
    const validTeams = eliminatedTeams.filter(Boolean);

    if (validTeams.length === 0) return;

    const placement =
        state.remainingTeams - validTeams.length + 1;

    state.eliminationGroups.push({
        roundName,
        placement,
        teams: validTeams
    });

    state.remainingTeams -= validTeams.length;

}

async function playDoubleElimGrandFinals(
    upperBracketChampion,
    lowerBracketChampion
) {

    const state = tournament.doubleElim;

    const grandFinal = await playDoubleElimRoundRecord(
        state.grandFinalRound,
        [
            {
                teamA: upperBracketChampion,
                teamB: lowerBracketChampion,
                sourceA: "Upper Bracket Winner",
                sourceB: "Lower Bracket Winner"
            }
        ]
    );

    const lowerBracketWonFirstSeries =
        String(grandFinal.winners[0].id) ===
        String(lowerBracketChampion.id);

    if (!lowerBracketWonFirstSeries) {

        state.resetRequired = false;
        state.resetFinalRound.status = "not_required";

        setDoubleElimRoundMatches(
            state.resetFinalRound,
            [
                {
                    teamA: upperBracketChampion,
                    teamB: lowerBracketChampion,
                    sourceA: "Bracket Reset Not Required",
                    sourceB: "Bracket Reset Not Required"
                }
            ]
        );

        state.resetFinalRound.status = "not_required";
        state.resetFinalRound.matches[0].status = "not_required";
        renderDoubleElimBracket();

        return {
            champion: upperBracketChampion,
            runnerUp: lowerBracketChampion
        };

    }

    state.resetRequired = true;

    const resetFinal = await playDoubleElimRoundRecord(
        state.resetFinalRound,
        [
            {
                teamA: upperBracketChampion,
                teamB: lowerBracketChampion,
                sourceA: "Grand Final Upper-Bracket Team",
                sourceB: "Grand Final Lower-Bracket Team"
            }
        ]
    );

    return {
        champion: resetFinal.winners[0],
        runnerUp: resetFinal.losers[0]
    };

}

function finishDoubleElim(champion, runnerUp) {

    const state = tournament.doubleElim;

    state.champion = champion;
    state.runnerUp = runnerUp;

    tournament.champion = champion.name;

    const placements = [
        {
            team: champion,
            placement: 1
        },
        {
            team: runnerUp,
            placement: 2
        }
    ];

    state.eliminationGroups.forEach(group => {
        group.teams.forEach(team => {
            placements.push({
                team,
                placement: group.placement
            });
        });
    });

    state.finalPlacements = placements
        .filter((item, index, list) =>
            list.findIndex(other =>
                String(other.team.id) === String(item.team.id)
            ) === index
        )
        .sort((a, b) =>
            a.placement - b.placement
        );

    const feed = document.getElementById("matchFeed");

    if (feed) {
        feed.innerHTML += `
            <div class="team-card">

                <div class="team-banner"></div>

                <div class="team-content">

                    <h2>🏆 Double Elimination Champion</h2>

                    <h1 style="
                        font-size:48px;
                        color:gold;
                    ">
                        ${safeText(champion.name)}
                    </h1>

                    <p>
                        ${
                            state.resetRequired
                            ? "Won the bracket-reset Grand Final"
                            : "Won the Grand Final from the upper bracket"
                        }
                    </p>

                </div>

            </div>
        `;
    }

    renderDoubleElimBracket();

}

/* ==========================
   DOUBLE ELIMINATION RENDER
========================== */

function renderDoubleElimBracket() {

    const container = document.getElementById(
        "bracketContainer"
    );

    if (!container) return;

    const state = tournament.doubleElim;

    if (!state || !state.size) {
        container.innerHTML = `
            <div class="double-elim-empty">
                <h3>Double Elimination Bracket</h3>
                <p>
                    Select exactly 4, 8, or 16 teams to generate the bracket.
                </p>
            </div>
        `;
        return;
    }

    const upperHeight = Math.max(
        260,
        (state.size / 2) * 82
    );

    const lowerHeight = Math.max(
        220,
        (state.size / 4) * 86
    );

    container.innerHTML = `
        <div class="de2-wrapper">

            <div class="de2-header">
                <div>
                    <h2>Double Elimination Bracket</h2>
                    <p>
                        Teams must lose twice to be eliminated. A lower-bracket
                        Grand Final win triggers a bracket reset.
                    </p>
                </div>

                <span class="de2-size-badge">
                    ${state.size} Teams
                </span>
            </div>

            <div class="de2-scroll">
                <div class="de2-tree">

                    <div class="de2-section-label">
                        Upper Bracket
                    </div>

                    <div
                        class="de2-track de2-upper-track"
                        style="--de2-track-height:${upperHeight}px"
                    >
                        ${state.upperRounds.map(round =>
                            renderDoubleElimTreeRound(round)
                        ).join("")}

                        ${renderDoubleElimFinalColumn(state)}
                    </div>

                    <div class="de2-section-label de2-lower-label">
                        Lower Bracket
                    </div>

                    <div
                        class="de2-track de2-lower-track"
                        style="--de2-track-height:${lowerHeight}px"
                    >
                        ${state.lowerRounds.map(round =>
                            renderDoubleElimTreeRound(round)
                        ).join("")}
                    </div>

                </div>
            </div>

            ${
                state.champion
                ? `
                    <div class="de2-champion">
                        <span>Champion</span>
                        ${renderChampionSlot(state.champion)}
                    </div>
                `
                : ""
            }

        </div>
    `;

}

function renderDoubleElimTreeRound(round) {

    return `
        <section class="de2-round de2-round-${round.side}">

            <div class="de2-round-heading">
                <span>${safeText(round.name)}</span>

                <small class="de2-round-status de2-status-${round.status}">
                    ${formatDoubleElimRoundStatus(round.status)}
                </small>
            </div>

            <div class="de2-round-matches">
                ${round.matches.map((match, index) =>
                    renderDoubleElimMatch(match, index + 1)
                ).join("")}
            </div>

        </section>
    `;

}

function formatDoubleElimRoundStatus(status) {

    const labels = {
        pending: "Pending",
        ready: "Ready",
        running: "Live",
        complete: "Final",
        waiting: "If Needed",
        not_required: "Not Needed"
    };

    return labels[status] || "Pending";

}

function renderDoubleElimMatch(match, matchNumber) {

    const hasResult = Boolean(match.result);

    return `
        <div
            class="de2-match ${hasResult ? "de2-match-complete" : "de2-match-pending"}"
            title="Match ${matchNumber}"
        >
            ${renderDoubleElimTeam(
                match,
                match.teamA,
                match.sourceA
            )}

            ${renderDoubleElimTeam(
                match,
                match.teamB,
                match.sourceB
            )}
        </div>
    `;

}

function renderDoubleElimTeam(match, team, source) {

    const isWinner =
        team &&
        match.winner &&
        String(match.winner.id) === String(team.id);

    const isLoser =
        team &&
        match.loser &&
        String(match.loser.id) === String(team.id);

    let score = "-";

    if (team && match.result) {
        score =
            String(match.result.teamAId) === String(team.id)
            ? match.result.scoreA
            : match.result.scoreB;
    }

    return `
        <div class="
            de2-team-row
            ${isWinner ? "de2-team-winner" : ""}
            ${isLoser ? "de2-team-loser" : ""}
        ">
            <div class="de2-team-main">
                ${
                    team?.logo
                    ? `
                        <img
                            src="${team.logo}"
                            class="de2-team-logo"
                            alt=""
                        >
                    `
                    : `<div class="de2-team-logo de2-logo-empty"></div>`
                }

                <span title="${safeText(team?.name || source || "TBD")}">
                    ${safeText(team?.name || source || "TBD")}
                </span>
            </div>

            <strong>${score}</strong>
        </div>
    `;

}

function renderDoubleElimFinalColumn(state) {

    const grandMatch = state.grandFinalRound.matches[0];
    const resetMatch = state.resetFinalRound.matches[0];

    const teamA =
        grandMatch.teamA || resetMatch.teamA || null;

    const teamB =
        grandMatch.teamB || resetMatch.teamB || null;

    return `
        <section class="de2-round de2-final-column">

            <div class="de2-round-heading">
                <span>Grand Final</span>
                <small>
                    ${
                        state.resetRequired
                        ? "Reset Played"
                        : state.grandFinalRound.status === "complete"
                            ? "Final"
                            : "Pending"
                    }
                </small>
            </div>

            <div class="de2-round-matches">
                <div class="de2-final-match">

                    <div class="de2-final-score-headings">
                        <span></span>
                        <small>GF</small>
                        <small>Reset</small>
                    </div>

                    ${renderDoubleElimFinalTeamRow(
                        teamA,
                        "Upper Bracket Winner",
                        grandMatch,
                        resetMatch
                    )}

                    ${renderDoubleElimFinalTeamRow(
                        teamB,
                        "Lower Bracket Winner",
                        grandMatch,
                        resetMatch
                    )}

                    ${
                        state.resetFinalRound.status === "not_required"
                        ? `
                            <div class="de2-reset-note">
                                Bracket reset not required
                            </div>
                        `
                        : ""
                    }

                </div>
            </div>

        </section>
    `;

}

function renderDoubleElimFinalTeamRow(
    team,
    fallback,
    grandMatch,
    resetMatch
) {

    return `
        <div class="de2-final-team-row">
            <div class="de2-team-main">
                ${
                    team?.logo
                    ? `
                        <img
                            src="${team.logo}"
                            class="de2-team-logo"
                            alt=""
                        >
                    `
                    : `<div class="de2-team-logo de2-logo-empty"></div>`
                }

                <span>
                    ${safeText(team?.name || fallback)}
                </span>
            </div>

            <strong>
                ${getDoubleElimMatchScoreForTeam(
                    grandMatch,
                    team
                )}
            </strong>

            <strong>
                ${
                    resetMatch.status === "not_required"
                    ? "—"
                    : getDoubleElimMatchScoreForTeam(
                        resetMatch,
                        team
                    )
                }
            </strong>
        </div>
    `;

}

function getDoubleElimMatchScoreForTeam(match, team) {

    if (!match?.result || !team) return "-";

    return String(match.result.teamAId) === String(team.id)
        ? match.result.scoreA
        : match.result.scoreB;

}

/* ==========================
   BRACKET TREE OVERRIDE
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

/* ==========================
   HISTORY OVERRIDES
========================== */

function createEventPlacements() {

    if (
        tournament.format === "worldsPlayIn" ||
        tournament.effectiveFormat === "worldsPlayIn"
    ) {
        return typeof createWorldsPlayInPlacements === "function"
            ? createWorldsPlayInPlacements()
            : [];
    }

    if (
        tournament.format === "regionalLcq" ||
        tournament.effectiveFormat === "regionalLcq"
    ) {
        return typeof createRegionalLcqPlacements === "function"
            ? createRegionalLcqPlacements()
            : [];
    }

    if (
        tournament.format === "groupsHybrid" ||
        tournament.format === "groupsDoubleElim" ||
        tournament.effectiveFormat === "groupsHybrid" ||
        tournament.effectiveFormat === "groupsDoubleElim"
    ) {
        return createGroupStagePlacements();
    }

    if (
        tournament.format === "doubleElim" ||
        tournament.effectiveFormat === "doubleElim"
    ) {
        return createDoubleElimPlacements();
    }

    if (
        tournament.format === "swissPlayoffs" ||
        tournament.effectiveFormat === "swissPlayoffs"
    ) {
        return createSwissPlayoffPlacements();
    }

    if (
        tournament.format === "swiss" ||
        tournament.effectiveFormat === "swiss"
    ) {
        return createSwissPlacements();
    }

    if (
        tournament.format === "playoffs" ||
        tournament.effectiveFormat === "playoffs"
    ) {
        return createPlayoffPlacements();
    }

    return createRoundRobinPlacements();

}

function createDoubleElimPlacements() {

    const placements =
        tournament.doubleElim?.finalPlacements || [];

    return placements.map(item => ({
        placement: item.placement,
        teamId: item.team.id,
        teamName: item.team.name,
        logo: item.team.logo,
        region: item.team.region,
        rating: item.team.rating
    }));

}

function createSwissPlayoffPlacements() {

    const playoffPlacements =
        createPlayoffPlacements();

    const usedTeamIds =
        new Set(
            playoffPlacements.map(item =>
                item.teamId
            )
        );

    const playoffCut =
        tournament.swiss?.playoffTeams?.length ||
        usedTeamIds.size ||
        playoffPlacements.length ||
        8;

    const swissSorted =
        [...(tournament.standings || [])]
            .sort(sortSwissStandings);

    const nonPlayoffTeams =
        swissSorted.filter(team =>
            !usedTeamIds.has(team.id)
        );

    const nonPlayoffPlacements =
        nonPlayoffTeams.map((team, index) => ({
            placement:
                playoffCut + index + 1,

            teamId:
                team.id,

            teamName:
                team.name,

            logo:
                team.logo,

            region:
                getTeamRegionById(team.id),

            rating:
                getTeamRatingById(team.id),

            seriesRecord:
                `${team.wins}-${team.losses}`,

            gameRecord:
                `${team.gameWins}-${team.gameLosses}`
        }));

    return [
        ...playoffPlacements,
        ...nonPlayoffPlacements
    ];

}

function formatTournamentName(record) {

    if (record.format === "doubleElim") {
        return "Double Elimination";
    }

    if (record.format === "custom") {
        return "Custom Bracket";
    }

    if (record.format === "swissPlayoffs") {
        return "Swiss + Playoffs";
    }

    if (record.format === "groupsHybrid") {
        return "Groups + Hybrid Playoffs";
    }

    if (record.format === "groupsDoubleElim") {
        return "Groups + Double-Elim Playoffs";
    }

    if (record.format === "regionalLcq") {
        return "Regional Worlds LCQ";
    }

    if (record.format === "worldsPlayIn") {
        return "Worlds Play-In";
    }

    if (record.format === "swiss") {
        return "Swiss Stage";
    }

    if (record.format === "playoffs") {
        return "Single Elimination";
    }

    return "Round Robin";

}

/* ==========================
   SAFE SAVE / FINISH
========================== */

function saveTournamentToHistoryIfPossible() {

    let latestRecord = null;

    try {

        const beforeHistory =
            JSON.parse(
                localStorage.getItem(
                    "rlcsTournamentHistory"
                ) || "[]"
            );

        const beforeLatestId =
            beforeHistory[0]?.id || null;

        if (
            typeof window.saveCompletedTournament ===
            "function"
        ) {
            window.saveCompletedTournament();
        }

        const afterHistory =
            JSON.parse(
                localStorage.getItem(
                    "rlcsTournamentHistory"
                ) || "[]"
            );

        latestRecord =
            afterHistory[0] || null;

        if (
            latestRecord &&
            latestRecord.id !== beforeLatestId &&
            typeof window.markSeasonEventCompletedFromRecord ===
            "function"
        ) {
            window.markSeasonEventCompletedFromRecord(
                latestRecord
            );
        }

    } catch (error) {

        console.error(
            "Failed to save event history:",
            error
        );

    } finally {

        tournament.running = false;

        if (
            typeof renderHistory === "function"
        ) {
            renderHistory();
        }

        if (
            typeof renderLeagueTable === "function"
        ) {
            renderLeagueTable();
        }

        if (
            typeof renderLanQualification === "function"
        ) {
            renderLanQualification();
        }

        if (
            typeof renderTeamProfiles === "function"
        ) {
            renderTeamProfiles();
        }

        if (
            typeof renderSeasonCalendar === "function"
        ) {
            renderSeasonCalendar();
        }

    }

}

/* ==========================
   INIT
========================== */

window.addEventListener("load", () => {

    setTimeout(() => {

        updateFormatAvailability();

        const formatInput =
            document.getElementById("tournamentFormat");

        if (formatInput) {
            formatInput.addEventListener(
                "change",
                updateFormatAvailability
            );
        }

        const eventType =
            document.getElementById("eventType");

        if (eventType) {
            eventType.addEventListener(
                "change",
                updateFormatAvailability
            );
        }

    }, 900);

});