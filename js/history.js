const HISTORY_KEY =
    "rlcsTournamentHistory";

/* ==========================
   SAVE COMPLETED EVENT
========================== */

function saveCompletedTournament() {
    if (typeof tournament === "undefined") return null;

    const history = getTournamentHistory()
        .map(compactHistoryRecord)
        .filter(Boolean);

    const event = resolveHistoryEvent();
    const seasonEventId = resolveHistorySeasonEventId(event);

    const existingRecord = history.find(record => {
        if (
            event.eventRunId &&
            record.eventRunId === event.eventRunId
        ) {
            return true;
        }

        return Boolean(
            seasonEventId &&
            String(
                record.event?.seasonEventId ||
                record.seasonEventId ||
                ""
            ) === String(seasonEventId)
        );
    });

    if (existingRecord) {
        tournament.savedToHistory = true;
        tournament.running = false;
        completeSeasonEventFromHistoryRecord(existingRecord);
        refreshHistoryDependentViews();
        return existingRecord;
    }

    const playerStats = Object.values(
        tournament.playerStats || {}
    );

    const placements = createEventPlacements();

    const formSummary =
        typeof finaliseTournamentFormForHistory === "function"
            ? finaliseTournamentFormForHistory(
                placements,
                event
            )
            : null;

    const chemistrySummary =
        typeof finaliseTournamentChemistryForHistory === "function"
            ? finaliseTournamentChemistryForHistory(
                placements,
                event
            )
            : null;

    let record = compactHistoryRecord({
        id: `history-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
        eventRunId: event.eventRunId || null,
        seasonEventId: seasonEventId || null,

        date: new Date().toLocaleString(),
        completedAt: new Date().toISOString(),

        event: {
            id: event.id || null,
            name: event.name || "Custom Event",
            type: event.type || "custom",
            region: event.region || "GLOBAL",
            split: event.split || "1",
            splitEventNumber: event.splitEventNumber || "",
            seasonEventId: seasonEventId || null,
            seasonId: event.seasonId || null,
            seasonName: event.seasonName || ""
        },

        format: tournament.format,
        effectiveFormat:
            tournament.effectiveFormat ||
            tournament.format,

        seriesLength: tournament.seriesLength,

        stageSeries: tournament.stageSeries
            ? {
                default: tournament.stageSeries.default,
                swiss: tournament.stageSeries.swiss,
                playoffs: tournament.stageSeries.playoffs,
                currentStage: tournament.stageSeries.currentStage
            }
            : null,

        champion:
            tournament.champion ||
            tournament.bracket?.champion?.name ||
            tournament.doubleElim?.champion?.name ||
            tournament.groupStage?.champion?.name ||
            "Unknown",

        teams: (tournament.participants || []).map(team => ({
            id: team.id,
            name: team.name,
            region: team.region,
            rating: team.rating,
            players: (team.players || []).map(player => ({
                id: player.id || null,
                name: player.name,
                rating: player.rating
            }))
        })),

        placements,
        pointsAwarded: [],
        standings: createCompactStandingsSnapshot(),
        bracket: createBracketHistorySnapshot(),
        swiss: createSwissHistorySnapshot(),
        doubleElim: createCompactDoubleElimSnapshot(),
        groupStage: createCompactGroupStageSnapshot(),
        lcq: createCompactLcqSnapshot(),
        playIn: createCompactWorldsPlayInSnapshot(),
        form: formSummary,
        chemistry: chemistrySummary,

        topScorer: getTopPlayerByStat(playerStats, "goals"),
        topMVP: getTopPlayerByStat(playerStats, "mvps"),
        topSaves: getTopPlayerByStat(playerStats, "saves")
    });

    /*
        Save the compact record before awarding points. This makes sure
        a completed event is never lost if another localStorage write fails.
    */
    history.unshift(record);
    saveCompactTournamentHistory(history);

    if (typeof awardEventPoints === "function") {
        record.pointsAwarded = awardEventPoints(record) || [];
        history[0] = compactHistoryRecord(record);
        saveCompactTournamentHistory(history);
    }

    tournament.savedToHistory = true;
    tournament.running = false;

    completeSeasonEventFromHistoryRecord(record);

    if (typeof handlePostEventCareerSystems === "function") {
        try {
            handlePostEventCareerSystems(record);
        } catch (error) {
            console.error("Post-event career systems failed:", error);
        }
    }

    refreshHistoryDependentViews();

    return record;
}

function resolveHistoryEvent() {
    const currentEvent = tournament.currentEvent;

    if (currentEvent && currentEvent.name) {
        return {
            ...currentEvent
        };
    }

    if (typeof getEventFormData === "function") {
        return getEventFormData();
    }

    return {
        name: "Custom Event",
        type: "custom",
        region: "GLOBAL",
        split: "1",
        splitEventNumber: ""
    };
}

function resolveHistorySeasonEventId(event) {
    return (
        event?.seasonEventId ||
        tournament.currentSeasonEventId ||
        (
            typeof getCurrentSeasonEventId === "function"
                ? getCurrentSeasonEventId()
                : null
        ) ||
        null
    );
}

function saveCompactTournamentHistory(history) {
    const compactHistory = (Array.isArray(history) ? history : [])
        .map(compactHistoryRecord)
        .filter(Boolean)
        .slice(0, 150);

    const attempts = [150, 100, 75, 50, 25];
    let lastError = null;

    for (const limit of attempts) {
        try {
            localStorage.setItem(
                HISTORY_KEY,
                JSON.stringify(compactHistory.slice(0, limit))
            );
            return compactHistory.slice(0, limit);
        } catch (error) {
            lastError = error;
        }
    }

    console.error(
        "Unable to save compact tournament history:",
        lastError
    );

    throw lastError || new Error("Unable to save tournament history.");
}

function compactHistoryRecord(record) {
    if (!record || typeof record !== "object") return null;

    return {
        id: record.id || `history-${Date.now()}`,
        eventRunId: record.eventRunId || null,
        seasonEventId:
            record.seasonEventId ||
            record.event?.seasonEventId ||
            null,
        date: record.date || new Date().toLocaleString(),
        completedAt: record.completedAt || null,

        event: {
            id: record.event?.id || null,
            name: record.event?.name || "Custom Event",
            type: record.event?.type || "custom",
            region: record.event?.region || "GLOBAL",
            split: String(record.event?.split || "1"),
            splitEventNumber: String(
                record.event?.splitEventNumber || ""
            ),
            seasonEventId:
                record.event?.seasonEventId ||
                record.seasonEventId ||
                null,
            seasonId: record.event?.seasonId || null,
            seasonName: record.event?.seasonName || ""
        },

        format: record.format || "roundRobin",
        effectiveFormat:
            record.effectiveFormat ||
            record.format ||
            "roundRobin",
        seriesLength: Number(record.seriesLength || 5),
        stageSeries: record.stageSeries
            ? {
                default: Number(record.stageSeries.default || 5),
                swiss: Number(record.stageSeries.swiss || 5),
                playoffs: Number(record.stageSeries.playoffs || 7),
                currentStage: record.stageSeries.currentStage || "default"
            }
            : null,
        champion: record.champion || "Unknown",

        teams: (record.teams || []).map(team => ({
            id: team.id,
            name: team.name,
            region: team.region || "Unknown",
            rating: Number(team.rating || 0),
            players: (team.players || []).map(player => ({
                id: player.id || null,
                name: player.name,
                rating: Number(player.rating || 50)
            }))
        })),

        placements: (record.placements || []).map(item => ({
            placement: Number(item.placement || 0),
            teamId: item.teamId,
            teamName: item.teamName,
            region: item.region || "Unknown",
            rating: Number(item.rating || 0),
            seriesRecord: item.seriesRecord || "",
            gameRecord: item.gameRecord || "",
            gameDiff:
                typeof item.gameDiff === "number"
                    ? item.gameDiff
                    : null,
            status: item.status || ""
        })),

        pointsAwarded: (record.pointsAwarded || []).map(item => ({
            teamId: item.teamId,
            teamName: item.teamName,
            placement: Number(item.placement || 0),
            points: Number(item.points || 0),
            split: String(item.split || record.event?.split || "1")
        })),

        standings: compactStoredStandings(record.standings),
        bracket: compactStoredBracket(record.bracket),
        swiss: compactStoredSwiss(record.swiss),
        doubleElim: compactStoredDoubleElim(record.doubleElim),
        groupStage: compactStoredGroupStage(record.groupStage),
        lcq: compactStoredLcq(record.lcq),
        playIn: compactStoredWorldsPlayIn(record.playIn),
        form: compactStoredForm(record.form),
        chemistry: compactStoredChemistry(record.chemistry),

        topScorer: compactTopPlayer(record.topScorer),
        topMVP: compactTopPlayer(record.topMVP),
        topSaves: compactTopPlayer(record.topSaves)
    };
}

function compactStoredChemistry(chemistry) {
    if (!chemistry || typeof chemistry !== "object") return null;

    return {
        eventRunId: chemistry.eventRunId || null,
        teams: (chemistry.teams || []).map(item => ({
            teamId: item.teamId,
            teamName: item.teamName || "",
            bonusBefore: Number(item.bonusBefore || 0),
            bonusAfter: Number(item.bonusAfter || 0),
            statusBefore: item.statusBefore || "New Roster",
            statusAfter: item.statusAfter || "New Roster",
            seriesPlayed: Number(item.seriesPlayed || 0),
            eventsCompleted: Number(item.eventsCompleted || 0)
        }))
    };
}

function compactStoredForm(form) {
    if (!form || typeof form !== "object") {
        return null;
    }

    return {
        eventRunId: form.eventRunId || null,
        teams: (form.teams || []).map(item => ({
            teamId: item.teamId,
            teamName: item.teamName || "Unknown Team",
            previousForm: Number(item.previousForm || 0),
            finalLiveForm: Number(item.finalLiveForm || 0),
            eventScore: Number(item.eventScore || 0),
            wins: Number(item.wins || 0),
            losses: Number(item.losses || 0),
            gameDiff: Number(item.gameDiff || 0),
            placement: Number(item.placement || 0)
        }))
    };
}

function compactTopPlayer(player) {
    if (!player) return null;

    return {
        name: player.name || "Unknown Player",
        teamName: player.teamName || "Unknown Team",
        value: Number(player.value || 0)
    };
}

function createCompactStandingsSnapshot() {
    return compactStoredStandings(
        tournament.standings || []
    );
}

function compactStoredStandings(standings) {
    return (Array.isArray(standings) ? standings : []).map(team => ({
        id: team.id,
        name: team.name,
        rating: Number(team.rating || 0),
        region: team.region || "Unknown",
        wins: Number(team.wins || 0),
        losses: Number(team.losses || 0),
        gameWins: Number(team.gameWins || 0),
        gameLosses: Number(team.gameLosses || 0),
        goalsFor: Number(team.goalsFor || 0),
        goalsAgainst: Number(team.goalsAgainst || 0),
        status: team.status || "",
        roundResults: (team.roundResults || []).map(result => ({
            round: Number(result.round || 0),
            opponentId: result.opponentId,
            opponentName: result.opponentName,
            resultText: result.resultText || "",
            won: Boolean(result.won)
        }))
    }));
}

function createCompactDoubleElimSnapshot() {
    return compactStoredDoubleElim(
        tournament.doubleElim || null
    );
}

function compactStoredDoubleElim(data) {
    if (!data) return null;

    return {
        size: Number(data.size || 0),
        champion: compactTeamReference(data.champion),
        finalPlacements: (data.finalPlacements || []).map(item => ({
            placement: Number(item.placement || 0),
            team: compactTeamReference(item.team)
        })),
        rounds: (data.rounds || []).map(round => ({
            name: round.name || "Round",
            matches: (round.matches || []).map(match => ({
                teamA: compactTeamReference(match.teamA),
                teamB: compactTeamReference(match.teamB),
                winner: compactTeamReference(match.winner),
                loser: compactTeamReference(match.loser),
                scoreA: Number(match.result?.scoreA || 0),
                scoreB: Number(match.result?.scoreB || 0)
            }))
        }))
    };
}

function createCompactGroupStageSnapshot() {
    if (!tournament.groupStage?.active) return null;

    return compactStoredGroupStage(
        tournament.groupStage
    );
}

function createCompactLcqSnapshot() {
    if (!tournament.lcq?.active) return null;

    return compactStoredLcq(tournament.lcq);
}

function compactStoredLcq(data) {
    if (!data) return null;

    return {
        active: Boolean(data.active),
        region: data.region || "Unknown",
        provisionalQualifierIds: (data.provisionalQualifierIds || []).map(String),
        qualifiedTeams: (data.qualifiedTeams || []).map(team => ({
            id: team.id,
            name: team.name || "Unknown Team",
            region: team.region || data.region || "Unknown",
            qualificationType: team.qualificationType || "claimed"
        })),
        rounds: (data.rounds || []).map(match => ({
            round: match.round || "Round",
            matchName: match.matchName || "Match",
            teamA: compactTeamReference(match.teamA),
            teamB: compactTeamReference(match.teamB),
            winner: compactTeamReference(match.winner),
            loser: compactTeamReference(match.loser),
            scoreA: Number(match.result?.scoreA || 0),
            scoreB: Number(match.result?.scoreB || 0)
        }))
    };
}

function createCompactWorldsPlayInSnapshot() {
    if (!tournament.playIn?.active) return null;
    return compactStoredWorldsPlayIn(tournament.playIn);
}

function compactStoredWorldsPlayIn(data) {
    if (!data) return null;

    const allRounds = [
        ...(data.upperQuarterfinals || []),
        ...(data.upperSemifinals || []),
        ...(data.lowerQuarterfinals || []),
        ...(data.lowerSemifinals || [])
    ];

    return {
        active: Boolean(data.active),
        qualifiedTeams: (data.qualifiedTeams || []).map(team => ({
            id: team.id,
            name: team.name || "Unknown Team",
            region: team.region || "Unknown",
            qualificationPath: team.qualificationPath || "Qualified"
        })),
        rounds: allRounds.map(match => ({
            round: match.round || "Round",
            matchName: match.matchName || "Match",
            teamA: compactTeamReference(match.teamA),
            teamB: compactTeamReference(match.teamB),
            winner: compactTeamReference(match.winner),
            loser: compactTeamReference(match.loser),
            scoreA: Number(match.result?.scoreA || 0),
            scoreB: Number(match.result?.scoreB || 0)
        }))
    };
}

function compactStoredGroupStage(data) {
    if (!data) return null;

    return {
        active: Boolean(data.active),
        playoffStyle: data.playoffStyle || "hybrid",
        champion: compactTeamReference(data.champion),
        runnerUp: compactTeamReference(data.runnerUp),
        finalPlacements: (data.finalPlacements || []).map(item => ({
            placement: Number(item.placement || 0),
            teamId: item.teamId || item.team?.id,
            teamName: item.teamName || item.team?.name
        })),
        groups: (data.groups || []).map(group => ({
            name: group.name || group.id || "Group",
            standings: compactStoredStandings(
                group.standings || []
            )
        }))
    };
}

function compactStoredBracket(bracket) {
    if (!bracket) return null;

    return {
        roundOf16: compactStoredMatches(bracket.roundOf16),
        quarterFinals: compactStoredMatches(bracket.quarterFinals),
        semiFinals: compactStoredMatches(bracket.semiFinals),
        grandFinal: bracket.grandFinal
            ? compactStoredMatch(bracket.grandFinal)
            : null,
        champion:
            typeof bracket.champion === "string"
                ? bracket.champion
                : bracket.champion?.name || null
    };
}

function compactStoredMatches(matches) {
    return (Array.isArray(matches) ? matches : [])
        .map(compactStoredMatch)
        .filter(Boolean);
}

function compactStoredMatch(match) {
    if (!match) return null;

    return {
        round: match.round || "",
        teamA:
            typeof match.teamA === "string"
                ? match.teamA
                : match.teamA?.name || "",
        teamB:
            typeof match.teamB === "string"
                ? match.teamB
                : match.teamB?.name || "",
        scoreA: Number(match.scoreA ?? match.result?.scoreA ?? 0),
        scoreB: Number(match.scoreB ?? match.result?.scoreB ?? 0),
        winner:
            typeof match.winner === "string"
                ? match.winner
                : match.winner?.name || match.result?.winner || ""
    };
}

function compactStoredSwiss(swiss) {
    if (!swiss) return null;

    return {
        rounds: (swiss.rounds || []).map(round => ({
            roundNumber: Number(round.roundNumber || 0),
            matches: (round.matches || []).map(match => ({
                teamAId: match.teamAId,
                teamBId: match.teamBId,
                scoreA: Number(match.scoreA ?? match.result?.scoreA ?? 0),
                scoreB: Number(match.scoreB ?? match.result?.scoreB ?? 0),
                winner: match.winner || match.result?.winner || "Unknown"
            }))
        })),
        qualifiedTeams: (swiss.qualifiedTeams || []).map(team => ({
            teamId: team.teamId || team.id,
            teamName: team.teamName || team.name,
            record: team.record || `${team.wins || 0}-${team.losses || 0}`
        })),
        eliminatedTeams: (swiss.eliminatedTeams || []).map(team => ({
            teamId: team.teamId || team.id,
            teamName: team.teamName || team.name,
            record: team.record || `${team.wins || 0}-${team.losses || 0}`
        }))
    };
}

function compactTeamReference(team) {
    if (!team) return null;

    return {
        id: team.id,
        name: team.name || "Unknown Team",
        region: team.region || "Unknown",
        rating: Number(team.rating || 0)
    };
}

function completeSeasonEventFromHistoryRecord(record) {
    let completed = false;

    if (
        typeof markSeasonEventCompletedFromRecord === "function"
    ) {
        try {
            completed = Boolean(
                markSeasonEventCompletedFromRecord(record)
            );
        } catch (error) {
            console.error(
                "Season completion callback failed:",
                error
            );
        }
    }

    if (!completed) {
        completed = markSeasonEventCompletedDirectly(record);
    }

    return completed;
}

function markSeasonEventCompletedDirectly(record) {
    const seasonEventId =
        record?.event?.seasonEventId ||
        record?.seasonEventId ||
        resolveHistorySeasonEventId(record?.event || {});

    if (!seasonEventId) return false;

    let parsed;

    try {
        parsed = JSON.parse(
            localStorage.getItem("rlcsSeasonCalendar") || "null"
        );
    } catch {
        return false;
    }

    if (!parsed) return false;

    const events = Array.isArray(parsed)
        ? parsed
        : parsed.events;

    if (!Array.isArray(events)) return false;

    const event = events.find(item =>
        String(item.id) === String(seasonEventId)
    );

    if (!event) return false;

    event.status = "completed";
    event.champion = record.champion || "Unknown";
    event.historyRecordId = record.id || null;
    event.completedAt = record.date || new Date().toLocaleString();

    if (
        event.type === "lcq" &&
        typeof window.applyLcqHistoryResultToSeasonEvent === "function"
    ) {
        window.applyLcqHistoryResultToSeasonEvent(event, record);
    }

    localStorage.setItem(
        "rlcsSeasonCalendar",
        JSON.stringify(parsed)
    );

    localStorage.removeItem("rlcsCurrentSeasonEventId");

    if (typeof tournament !== "undefined") {
        tournament.currentSeasonEventId = null;
        tournament.running = false;
    }

    return true;
}

function refreshHistoryDependentViews() {
    const functions = [
        "updateDashboard",
        "renderLeagueTable",
        "renderLanQualification",
        "renderTeamProfiles",
        "renderSeasonCalendar",
        "renderHistory"
    ];

    functions.forEach(name => {
        if (typeof window[name] !== "function") return;

        try {
            window[name]();
        } catch (error) {
            console.error(`${name} failed after event save:`, error);
        }
    });
}

function compactExistingTournamentHistory() {
    const history = getTournamentHistory();

    if (history.length === 0) return;

    try {
        saveCompactTournamentHistory(history);
    } catch (error) {
        console.error(
            "Could not compact existing tournament history:",
            error
        );
    }
}

/* ==========================
   LOAD HISTORY
========================== */

function getTournamentHistory() {
    const saved =
        localStorage.getItem(
            HISTORY_KEY
        );

    if (!saved) return [];

    try {
        return JSON.parse(saved) || [];
    } catch (error) {
        console.error(
            "Failed to load event history",
            error
        );
        return [];
    }
}

/* ==========================
   EVENT PLACEMENTS
========================== */

function createEventPlacements() {
    if (tournament.format === "playoffs") {
        return createPlayoffPlacements();
    }

    if (tournament.format === "swissPlayoffs") {
        return createSwissPlayoffPlacements();
    }

    if (tournament.format === "swiss") {
        return createSwissPlacements();
    }

    return createRoundRobinPlacements();
}

function createRoundRobinPlacements() {
    if (
        !tournament.standings ||
        tournament.standings.length === 0
    ) {
        return [];
    }

    const sorted =
        [...tournament.standings].sort((a, b) => {
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

    return sorted.map((team, index) => ({
        placement: index + 1,
        teamId: team.id,
        teamName: team.name,
        logo: team.logo,
        region:
            getTeamRegionById(team.id),
        rating:
            getTeamRatingById(team.id),
        seriesRecord:
            `${team.wins}-${team.losses}`,
        gameRecord:
            `${team.gameWins}-${team.gameLosses}`
    }));
}

function createSwissPlacements() {
    if (
        !tournament.standings ||
        tournament.standings.length === 0
    ) {
        return [];
    }

    const sorted =
        [...tournament.standings].sort((a, b) => {
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

            return b.rating - a.rating;
        });

    return sorted.map((team, index) => {
        const gameDiff =
            team.gameWins -
            team.gameLosses;

        return {
            placement: index + 1,
            teamId: team.id,
            teamName: team.name,
            logo: team.logo,
            region:
                getTeamRegionById(team.id),
            rating:
                getTeamRatingById(team.id),
            seriesRecord:
                `${team.wins}-${team.losses}`,
            gameRecord:
                `${team.gameWins}-${team.gameLosses}`,
            gameDiff,
            status:
                team.status || "completed",
            roundResults:
                team.roundResults || []
        };
    });
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

    const swissSorted =
        [...(tournament.standings || [])]
            .sort((a, b) => {
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

                return b.rating - a.rating;
            });

    const nonPlayoffTeams =
        swissSorted.filter(team =>
            !usedTeamIds.has(team.id)
        );

    const nonPlayoffPlacements =
        nonPlayoffTeams.map((team, index) => ({
            placement: index + 9,
            teamId: team.id,
            teamName: team.name,
            logo: team.logo,
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


function createPlayoffPlacements() {

    const placements = [];
    const usedTeamIds = new Set();

    function addTeam(team, placement) {

        if (!team || usedTeamIds.has(team.id)) {
            return;
        }

        usedTeamIds.add(team.id);

        placements.push({
            placement,
            teamId: team.id,
            teamName: team.name,
            logo: team.logo,
            region: team.region,
            rating: team.rating
        });

    }

    const final =
        tournament.bracket?.grandFinal;

    if (final && final.winner) {

        const runnerUp =
            getLoserFromBracketMatch(final);

        addTeam(final.winner, 1);
        addTeam(runnerUp, 2);

    }

    const semiFinals =
        tournament.bracket?.semiFinals || [];

    semiFinals.forEach(match => {

        const loser =
            getLoserFromBracketMatch(match);

        addTeam(loser, 3);

    });

    const quarterFinals =
        tournament.bracket?.quarterFinals || [];

    quarterFinals.forEach(match => {

        const loser =
            getLoserFromBracketMatch(match);

        addTeam(loser, 5);

    });

    const roundOf16 =
        tournament.bracket?.roundOf16 || [];

    roundOf16.forEach(match => {

        const loser =
            getLoserFromBracketMatch(match);

        addTeam(loser, 9);

    });

    return placements;

}

function getLoserFromBracketMatch(match) {
    if (
        !match ||
        !match.winner ||
        !match.teamA ||
        !match.teamB
    ) {
        return null;
    }

    return match.winner.id === match.teamA.id
        ? match.teamB
        : match.teamA;
}

function getTeamRegionById(id) {
    if (
        typeof teams === "undefined" ||
        !Array.isArray(teams)
    ) {
        return "Unknown";
    }

    const team =
        teams.find(team =>
            team.id === id
        );

    return team
        ? team.region
        : "Unknown";
}

function getTeamRatingById(id) {
    if (
        typeof teams === "undefined" ||
        !Array.isArray(teams)
    ) {
        return 0;
    }

    const team =
        teams.find(team =>
            team.id === id
        );

    return team
        ? team.rating
        : 0;
}

/* ==========================
   BRACKET SNAPSHOT
========================== */

function createBracketHistorySnapshot() {
if (
    !tournament.bracket ||
    (
        tournament.format !== "playoffs" &&
        tournament.format !== "swissPlayoffs"
    )
) {
    return null;
}

    return {
        quarterFinals:
            tournament.bracket.quarterFinals.map(
                createMatchSnapshot
            ),

        semiFinals:
            tournament.bracket.semiFinals.map(
                createMatchSnapshot
            ),

        grandFinal:
            tournament.bracket.grandFinal
            ? createMatchSnapshot(
                tournament.bracket.grandFinal
            )
            : null,

        champion:
            tournament.bracket.champion
            ? tournament.bracket.champion.name
            : tournament.champion
    };
}

function createSwissHistorySnapshot() {
    if (
        !tournament.swiss ||
        tournament.format !== "swiss"
    ) {
        return null;
    }

    return {
        rounds:
            (tournament.swiss.rounds || []).map(round => ({
                roundNumber:
                    round.roundNumber,
                matches:
                    round.matches.map(match => ({
                        teamAId:
                            match.teamAId,
                        teamBId:
                            match.teamBId,
                        scoreA:
                            match.result?.scoreA || 0,
                        scoreB:
                            match.result?.scoreB || 0,
                        winner:
                            match.result?.winner || "Unknown"
                    }))
            })),

        qualifiedTeams:
            (tournament.swiss.qualifiedTeams || []).map(team => ({
                teamId: team.id,
                teamName: team.name,
                record: `${team.wins}-${team.losses}`
            })),

        eliminatedTeams:
            (tournament.swiss.eliminatedTeams || []).map(team => ({
                teamId: team.id,
                teamName: team.name,
                record: `${team.wins}-${team.losses}`
            }))
    };
}

function createMatchSnapshot(match) {
    if (!match || !match.result) {
        return null;
    }

    return {
        round: match.round,
        teamA: match.teamA.name,
        teamB: match.teamB.name,
        scoreA: match.result.scoreA,
        scoreB: match.result.scoreB,
        winner: match.result.winner
    };
}

/* ==========================
   TOP PLAYERS
========================== */

function getTopPlayerByStat(players, stat) {
    if (
        !players ||
        players.length === 0
    ) {
        return null;
    }

    const sorted =
        [...players].sort((a, b) =>
            b[stat] - a[stat]
        );

    const player =
        sorted[0];

    return {
        name: player.name,
        teamName: player.teamName,
        value: player[stat]
    };
}

/* ==========================
   RENDER HISTORY
========================== */

let historyV2SelectedId = null;
let historyV2SelectedTab = "overview";

function renderHistory() {
    const list = document.getElementById("historyList");
    const detail = document.getElementById("historyDetail");
    if (!list || !detail) return;

    const allHistory = getTournamentHistory();
    populateHistoryV2Filters(allHistory);
    const filtered = getFilteredHistoryRecords(allHistory);

    const summary = document.getElementById("historyResultSummary");
    if (summary) {
        summary.innerHTML = `<strong>${filtered.length}</strong><span>of ${allHistory.length} events</span>`;
    }

    if (!filtered.length) {
        list.innerHTML = `<div class="history-v2-empty">No events match the current filters.</div>`;
        detail.innerHTML = `<div class="history-empty-detail"><strong>No event selected</strong><span>Change the filters or complete another event.</span></div>`;
        return;
    }

    if (!filtered.some(record => String(record.id) === String(historyV2SelectedId))) {
        historyV2SelectedId = filtered[0].id;
    }

    list.innerHTML = filtered.map(record => renderHistoryV2ListCard(record)).join("");
    renderHistoryV2Detail(historyV2SelectedId);
}

function populateHistoryV2Filters(history) {
    populateHistorySelect("historySeasonFilter", [...new Set(history.map(record => record.event?.seasonName).filter(Boolean))], "All Seasons");
    populateHistorySelect("historySplitFilter", [...new Set(history.map(record => record.event?.split).filter(value => value !== undefined && value !== null && value !== ""))], "All Splits");
    populateHistorySelect("historyRegionFilter", [...new Set(history.map(record => record.event?.region || "GLOBAL"))], "All Regions");
}

function populateHistorySelect(id, values, label) {
    const select = document.getElementById(id);
    if (!select) return;
    const current = select.value || "ALL";
    select.innerHTML = `<option value="ALL">${escapeHistoryText(label)}</option>` + values.sort((a,b)=>String(a).localeCompare(String(b), undefined, {numeric:true})).map(value => `<option value="${escapeHistoryText(value)}">${escapeHistoryText(value === "GLOBAL" ? "Global" : value)}</option>`).join("");
    if ([...select.options].some(option => option.value === current)) select.value = current;
}

function getFilteredHistoryRecords(history = getTournamentHistory()) {
    const search = (document.getElementById("historySearch")?.value || "").trim().toLowerCase();
    const season = document.getElementById("historySeasonFilter")?.value || "ALL";
    const split = document.getElementById("historySplitFilter")?.value || "ALL";
    const region = document.getElementById("historyRegionFilter")?.value || "ALL";
    const type = document.getElementById("historyTypeFilter")?.value || "ALL";
    const sort = document.getElementById("historySort")?.value || "newest";

    const filtered = history.filter(record => {
        const haystack = [record.event?.name, record.champion, record.event?.region, record.event?.seasonName, ...(record.teams || []).map(team => team.name)].join(" ").toLowerCase();
        return (!search || haystack.includes(search)) &&
            (season === "ALL" || String(record.event?.seasonName || "") === season) &&
            (split === "ALL" || String(record.event?.split || "") === split) &&
            (region === "ALL" || String(record.event?.region || "GLOBAL") === region) &&
            (type === "ALL" || String(record.event?.type || "custom") === type);
    });

    if (sort === "oldest") filtered.reverse();
    if (sort === "name") filtered.sort((a,b)=>String(a.event?.name||"").localeCompare(String(b.event?.name||"")));
    if (sort === "type") filtered.sort((a,b)=>String(a.event?.type||"").localeCompare(String(b.event?.type||"")));
    return filtered;
}

function renderHistoryV2ListCard(record) {
    const selected = String(record.id) === String(historyV2SelectedId);
    return `<button type="button" class="history-v2-list-card ${selected ? "selected" : ""}" onclick="selectHistoryV2Event('${escapeHistoryText(record.id)}')">
        <div class="history-v2-list-top"><span class="history-type-pill history-type-${escapeHistoryText(record.event?.type || "custom")}">${formatEventBadge(record.event?.type)}</span><small>${escapeHistoryText(record.date || "")}</small></div>
        <strong>${escapeHistoryText(record.event?.name || "Event")}</strong>
        <span>${escapeHistoryText(record.champion || "Unknown")} · ${escapeHistoryText(record.event?.region === "GLOBAL" ? "Global" : record.event?.region || "Global")}</span>
        <div class="history-v2-card-meta"><em>${formatTournamentName(record)}</em><b>${getTotalPointsAwarded(record)} pts</b></div>
    </button>`;
}

function selectHistoryV2Event(recordId) {
    historyV2SelectedId = recordId;
    renderHistory();
}

function showHistoryV2Tab(tab) {
    historyV2SelectedTab = tab;
    renderHistoryV2Detail(historyV2SelectedId);
}

function renderHistoryV2Detail(recordId) {
    const container = document.getElementById("historyDetail");
    const record = getTournamentHistory().find(item => String(item.id) === String(recordId));
    if (!container || !record) return;

    const tabs = [
        ["overview","Overview"],["placements","Placements"],["matches","Matches & Standings"],
        ["rosters","Rosters"],["impact","Form & Qualification"]
    ];

    container.innerHTML = `<div class="history-detail-hero">
        <div><span>${formatEventTypeHistory(record.event?.type)} · ${escapeHistoryText(record.event?.region === "GLOBAL" ? "Global" : record.event?.region || "Global")}</span><h3>${escapeHistoryText(record.event?.name || "Event")}</h3><p>${getHistoryHeadline(record)} · ${formatTournamentName(record)}</p></div>
        <div class="history-detail-actions"><button class="secondary-button" onclick="exportHistoryEvent('${escapeHistoryText(record.id)}')">Export Event</button><button class="danger-button" onclick="deleteTournamentHistoryEvent('${escapeHistoryText(record.id)}')">Remove Event</button></div>
    </div>
    <div class="history-detail-stats">${renderHistoryMiniStat("Champion", record.champion || "Unknown")}${renderHistoryMiniStat("Teams", (record.teams||[]).length)}${renderHistoryMiniStat("Points", getTotalPointsAwarded(record))}${renderHistoryMiniStat("Series", `BO${record.seriesLength || 5}`)}</div>
    <div class="history-detail-tabs">${tabs.map(([id,label])=>`<button class="${historyV2SelectedTab===id?"active":""}" onclick="showHistoryV2Tab('${id}')">${label}</button>`).join("")}</div>
    <div class="history-detail-body">${renderHistoryV2Tab(record, historyV2SelectedTab)}</div>`;
}

function renderHistoryV2Tab(record, tab) {
    if (tab === "placements") return renderHistoryPlacements(record) + renderPointsAwarded(record);
    if (tab === "matches") return renderHistoryV2Matches(record);
    if (tab === "rosters") return renderHistoryV2Rosters(record);
    if (tab === "impact") return renderHistoryV2Impact(record);
    return `<div class="history-overview-grid">
        <div class="history-overview-panel"><h4>Event Details</h4><div class="history-row"><span>Season</span><strong>${escapeHistoryText(record.event?.seasonName || "Standalone")}</strong></div><div class="history-row"><span>Split</span><strong>${escapeHistoryText(record.event?.split || "-")}</strong></div><div class="history-row"><span>Format</span><strong>${formatTournamentName(record)}</strong></div><div class="history-row"><span>Completed</span><strong>${escapeHistoryText(record.date || "-")}</strong></div>${renderHistoryPointsScope(record)}</div>
        <div class="history-overview-panel"><h4>Event Leaders</h4><div class="history-row"><span>Top Scorer</span><strong>${record.topScorer ? `${escapeHistoryText(record.topScorer.name)} (${record.topScorer.value})` : "N/A"}</strong></div><div class="history-row"><span>MVP Leader</span><strong>${record.topMVP ? `${escapeHistoryText(record.topMVP.name)} (${record.topMVP.value})` : "N/A"}</strong></div><div class="history-row"><span>Saves Leader</span><strong>${record.topSaves ? `${escapeHistoryText(record.topSaves.name)} (${record.topSaves.value})` : "N/A"}</strong></div></div>
    </div>`;
}

function renderHistoryV2Matches(record) {
    const sections = [];
    if ((record.standings || []).length) sections.push(`<div class="history-report-section"><h4>Final Standings</h4>${record.standings.map((team,index)=>`<div class="history-row"><span>#${index+1} ${escapeHistoryText(team.name)}</span><strong>${team.wins||0}-${team.losses||0} · Games ${team.gameWins||0}-${team.gameLosses||0}</strong></div>`).join("")}</div>`);
    const matches=[];
    ["roundOf16","quarterFinals","semiFinals"].forEach(round => (record.bracket?.[round]||[]).forEach(match=>matches.push(match)));
    if (record.bracket?.grandFinal) matches.push(record.bracket.grandFinal);
    (record.swiss?.rounds||[]).forEach(round => (round.matches||[]).forEach(match=>matches.push({...match,round:`Swiss Round ${round.roundNumber}`})));
    (record.doubleElim?.rounds||[]).forEach(round => (round.matches||[]).forEach(match=>matches.push({...match,round:round.name})));
    (record.lcq?.rounds||[]).forEach(match=>matches.push(match));
    (record.playIn?.rounds||[]).forEach(match=>matches.push(match));
    if (matches.length) sections.push(`<div class="history-report-section"><h4>Recorded Matches</h4><div class="history-match-list">${matches.map(match=>{const a=match.teamA?.name||match.teamA||findHistoryTeamName(record,match.teamAId);const b=match.teamB?.name||match.teamB||findHistoryTeamName(record,match.teamBId);return `<div class="history-match-row"><span>${escapeHistoryText(match.round||match.matchName||"Match")}</span><strong>${escapeHistoryText(a||"TBD")} ${Number(match.scoreA||0)}–${Number(match.scoreB||0)} ${escapeHistoryText(b||"TBD")}</strong></div>`}).join("")}</div></div>`);
    if ((record.groupStage?.groups||[]).length) sections.push(`<div class="history-report-section"><h4>Group Standings</h4>${record.groupStage.groups.map(group=>`<details><summary>${escapeHistoryText(group.name)}</summary>${(group.standings||[]).map((team,index)=>`<div class="history-row"><span>#${index+1} ${escapeHistoryText(team.name)}</span><strong>${team.wins||0}-${team.losses||0}</strong></div>`).join("")}</details>`).join("")}</div>`);
    return sections.join("") || `<div class="history-v2-empty">Detailed matches were not stored for this older event.</div>`;
}

function findHistoryTeamName(record, id) { return (record.teams||[]).find(team=>String(team.id)===String(id))?.name || ""; }

function renderHistoryV2Rosters(record) {
    return `<div class="history-roster-grid">${(record.teams||[]).map(team=>`<div class="history-roster-card"><div><strong>${escapeHistoryText(team.name)}</strong><span>${escapeHistoryText(team.region||"Unknown")} · Rating ${Number(team.rating||0)}</span></div>${(team.players||[]).map(player=>`<div class="history-roster-player"><span>${escapeHistoryText(player.name)}</span><b>${Number(player.rating||0)}</b></div>`).join("")}</div>`).join("")}</div>`;
}

function renderHistoryV2Impact(record) {
    const formEntries = Array.isArray(record.form) ? record.form : Object.values(record.form || {});
    const chemistryEntries = Array.isArray(record.chemistry) ? record.chemistry : Object.values(record.chemistry || {});
    return `<div class="history-overview-grid"><div class="history-overview-panel"><h4>Qualification & Points</h4>${renderHistoryPointsScope(record)}${renderPointsAwarded(record) || '<p class="small">No standings points awarded.</p>'}${(record.lcq?.qualifiedTeams||record.playIn?.qualifiedTeams||[]).map(team=>`<div class="history-row"><span>${escapeHistoryText(team.name)}</span><strong>Qualified</strong></div>`).join("")}</div><div class="history-overview-panel"><h4>Form & Chemistry</h4><p class="small">Stored end-of-event summaries for the roster used in this event.</p>${formEntries.slice(0,12).map(item=>`<div class="history-row"><span>${escapeHistoryText(item.teamName||item.name||findHistoryTeamName(record,item.teamId))}</span><strong>${Number(item.adjustment||item.form||item.score||0)>0?"+":""}${Number(item.adjustment||item.form||item.score||0).toFixed(1)}</strong></div>`).join("")}${chemistryEntries.length?`<p class="small">Chemistry records stored: ${chemistryEntries.length}</p>`:""}</div></div>`;
}

function exportHistoryEvent(recordId) {
    const record = getTournamentHistory().find(item=>String(item.id)===String(recordId));
    if (!record) return;
    downloadHistoryJson(record, `${record.event?.name || "event"}-history.json`);
}

function exportFilteredHistory() {
    downloadHistoryJson({exportedAt:new Date().toISOString(),events:getFilteredHistoryRecords()}, "rlcs-filtered-history.json");
}

function downloadHistoryJson(data, filename) {
    const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob); const link=document.createElement("a"); link.href=url; link.download=String(filename).replace(/[^a-z0-9._-]+/gi,"-"); link.click(); setTimeout(()=>URL.revokeObjectURL(url),500);
}

/* ==========================
   HISTORY POINTS DISPLAY
========================== */

function hasHistorySeasonLink(record) {
    return Boolean(
        record?.event?.seasonEventId ||
        record?.seasonEventId ||
        record?.event?.seasonId ||
        record?.seasonId
    );
}

function renderHistoryPointsScope(record) {
    if (!hasHistorySeasonLink(record)) {
        return `
            <div class="history-points-scope standalone">
                Standalone event — saved to History, but excluded from league standings points.
            </div>
        `;
    }

    if (
        record?.event?.type === "lcq" ||
        record?.event?.type === "playin"
    ) {
        return `
            <div class="history-points-scope qualification">
                Qualification event — no league points are awarded.
            </div>
        `;
    }

    return "";
}

function getTotalPointsAwarded(record) {
    if (
        !record.pointsAwarded ||
        record.pointsAwarded.length === 0
    ) {
        return "0";
    }

    return record.pointsAwarded.reduce(
        (sum, item) =>
            sum + Number(item.points || 0),
        0
    );
}

function renderPointsAwarded(record) {
    if (
        !record.pointsAwarded ||
        record.pointsAwarded.length === 0
    ) {
        return "";
    }

    return `
    <div class="history-section">

        <h4>Points Awarded</h4>

        ${record.pointsAwarded.map(item => `
            <div class="history-row">

                <span>
                    #${item.placement}
                    ${escapeHistoryText(item.teamName)}
                </span>

                <strong>
                    +${item.points} pts
                </strong>

            </div>
        `).join("")}

    </div>
    `;
}

function renderHistoryPlacements(record) {
    if (
        !record.placements ||
        record.placements.length === 0
    ) {
        return "";
    }

    return `
    <div class="history-section">

        <h4>Final Placements</h4>

        ${record.placements.map(item => `
            <div class="history-row">

                <span>
                    #${item.placement}
                    ${escapeHistoryText(item.teamName)}
                </span>

                <strong>
                    ${
                        item.seriesRecord
                        ? `${escapeHistoryText(item.seriesRecord)}${
                            item.gameRecord
                            ? ` | Games ${escapeHistoryText(item.gameRecord)}`
                            : ""
                        }${
                            typeof item.gameDiff === "number"
                            ? ` | GD ${item.gameDiff > 0 ? "+" : ""}${item.gameDiff}`
                            : ""
                        }${
                            item.status
                            ? ` | ${escapeHistoryText(formatPlacementStatus(item.status))}`
                            : ""
                        }`
                        : "Placed"
                    }
                </strong>

            </div>
        `).join("")}

    </div>
    `;
}


/* ==========================
   FORMAT HELPERS
========================== */

function formatPlacementStatus(status) {
    if (status === "qualified-retained") {
        return "Qualified - Retained Spot";
    }

    if (status === "qualified-claimed") {
        return "Qualified - Claimed Spot";
    }

    if (status === "eliminated-qualification") {
        return "Eliminated in Qualification Match";
    }

    if (status === "eliminated-challenger") {
        return "Eliminated in Challenger Round";
    }

    if (status === "eliminated-final-round") {
        return "Eliminated in Lower Semifinal";
    }

    if (status === "eliminated-lower-quarterfinal") {
        return "Eliminated in Lower Quarterfinal";
    }

    if (status === "qualified-playin") {
        return "Qualified for Worlds Play-In";
    }

    if (status === "qualified") {
        return "Qualified";
    }

    if (status === "eliminated") {
        return "Eliminated";
    }

    if (status === "completed") {
        return "Complete";
    }

    return "Active";
}

function getHistoryHeadline(record) {
    if (record.event?.type === "lcq") {
        return `🌍 ${escapeHistoryText(record.champion)} qualified for the Worlds Play-In`;
    }

    if (record.event?.type === "playin") {
        return `🌍 ${escapeHistoryText(record.champion)} qualified for the Worlds Main Event`;
    }

    return `🏆 ${escapeHistoryText(record.champion)}`;
}

function formatTournamentName(record) {
    const format = record.effectiveFormat || record.format;

    if (format === "playoffs") {
        return "Single Elimination";
    }

    if (format === "swiss") {
        return "Swiss Stage";
    }

    if (format === "swissPlayoffs") {
        return "Swiss + Playoffs";
    }

    if (format === "doubleElim") {
        return "Double Elimination";
    }

    if (format === "groupsHybrid") {
        return "Groups + Hybrid Playoffs";
    }

    if (format === "groupsDoubleElim") {
        return "Groups + Double-Elim Playoffs";
    }

    if (format === "regionalLcq") {
        return "Regional Worlds LCQ";
    }

    if (format === "worldsPlayIn") {
        return "Worlds Play-In";
    }

    if (format === "custom") {
        return "Custom Bracket";
    }

    return "Round Robin";
}

function formatEventTypeHistory(type) {
    if (type === "regional") {
        return "Regional";
    }

    if (type === "major") {
        return "LAN / Major";
    }

    if (type === "worlds") {
        return "World Championship";
    }

    if (type === "playin") {
        return "Worlds Play-In";
    }

    if (type === "lcq") {
        return "Regional Worlds LCQ";
    }

    return "Custom Event";
}

function formatEventBadge(type) {
    if (type === "regional") {
        return "REGIONAL";
    }

    if (type === "major") {
        return "LAN";
    }

    if (type === "worlds") {
        return "WORLDS";
    }

    if (type === "playin") {
        return "PLAY-IN";
    }

    if (type === "lcq") {
        return "LCQ";
    }

    return "CUSTOM";
}

function renderHistoryMiniStat(label, value) {
    return `
    <div class="history-mini-stat">

        <span>
            ${escapeHistoryText(label)}
        </span>

        <strong>
            ${escapeHistoryText(value)}
        </strong>

    </div>
    `;
}

/* ==========================
   REMOVE ONE HISTORY EVENT
========================== */

async function deleteTournamentHistoryEvent(recordId) {
    const history = getTournamentHistory();
    const record = history.find(item =>
        String(item.id) === String(recordId)
    );

    if (!record) {
        alert("That History event could not be found.");
        return;
    }

    const eventName =
        record.event?.name ||
        "this event";

    const isSeasonEvent =
        hasHistorySeasonLink(record);

    const confirmed = confirm(
        `Remove “${eventName}” from History?` +
        `

Any league points awarded by this event will be removed.` +
        (isSeasonEvent
            ? `
The linked Season event will be returned to Scheduled so it can be played again.`
            : "") +
        `

This cannot be undone unless you restore a backup.`
    );

    if (!confirmed) return;

    if (typeof window.createRestorePoint === "function") {
        try {
            await window.createRestorePoint(
                `Before removing History event: ${eventName}`,
                true
            );
        } catch (error) {
            console.warn(
                "Could not create an automatic restore point:",
                error
            );
        }
    }

    const remainingHistory = history.filter(item =>
        String(item.id) !== String(recordId)
    );

    resetSeasonEventAfterHistoryRemoval(record);

    if (
        typeof window.rebuildLeaguePointsFromHistorySilently ===
        "function"
    ) {
        window.rebuildLeaguePointsFromHistorySilently({
            history: remainingHistory,
            refresh: false
        });
    } else {
        saveCompactTournamentHistory(remainingHistory);
    }

    refreshHistoryDependentViews();

    alert(
        `“${eventName}” was removed from History and its league points were recalculated.`
    );
}

function resetSeasonEventAfterHistoryRemoval(record) {
    const seasonEventId =
        record?.event?.seasonEventId ||
        record?.seasonEventId ||
        null;

    if (!seasonEventId) return false;

    const state =
        typeof getSeasonState === "function"
            ? getSeasonState()
            : null;

    if (!state || !Array.isArray(state.events)) {
        return false;
    }

    const event = state.events.find(item =>
        String(item.id) === String(seasonEventId)
    );

    if (!event) return false;

    event.status = "scheduled";
    event.champion = null;
    event.historyRecordId = null;
    event.completedAt = null;
    event.startedAt = null;

    if (
        event.type === "lcq" ||
        event.type === "playin"
    ) {
        event.qualifiedTeamIds = [];
        event.qualificationOutcomes = [];
    }

    if (typeof saveSeasonState === "function") {
        saveSeasonState(state);
    } else {
        localStorage.setItem(
            "rlcsSeasonCalendar",
            JSON.stringify(state)
        );
    }

    const currentSeasonEventId =
        localStorage.getItem(
            "rlcsCurrentSeasonEventId"
        );

    if (
        currentSeasonEventId &&
        String(currentSeasonEventId) ===
            String(seasonEventId)
    ) {
        localStorage.removeItem(
            "rlcsCurrentSeasonEventId"
        );
    }

    if (
        typeof tournament !== "undefined" &&
        String(
            tournament.currentSeasonEventId ||
            tournament.currentEvent?.seasonEventId ||
            ""
        ) === String(seasonEventId)
    ) {
        tournament.currentSeasonEventId = null;
        tournament.currentEvent = null;
        tournament.savedToHistory = false;
        tournament.running = false;
    }

    return true;
}

/* ==========================
   CLEAR HISTORY
========================== */

function clearTournamentHistory() {
    const confirmed =
        confirm(
            "Clear all event history? This will not automatically reset league points."
        );

    if (!confirmed) return;

    localStorage.removeItem(
        HISTORY_KEY
    );

    renderHistory();

    if (typeof updateDashboard === "function") {
        updateDashboard();
    }
}

/* ==========================
   HELPERS
========================== */

function escapeHistoryText(value) {
    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

window.deleteTournamentHistoryEvent =
    deleteTournamentHistoryEvent;
window.resetSeasonEventAfterHistoryRemoval =
    resetSeasonEventAfterHistoryRemoval;

/* ==========================
   INIT
========================== */

window.addEventListener("load", () => {
    compactExistingTournamentHistory();
    renderHistory();
});