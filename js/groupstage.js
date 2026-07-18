/* ==========================
   RLCS LEAGUE SIMULATOR
   GROUP STAGE TO PLAYOFFS

   Supported formats:
   - groupsHybrid
   - groupsDoubleElim

   Structure:
   - 16 teams
   - 4 groups of 4
   - Single round robin inside each group
   - Top 3 from every group advance
   - 12-team playoff bracket
========================== */

const GROUP_PLAYOFF_FORMATS = [
    "groupsHybrid",
    "groupsDoubleElim"
];

const GROUP_NAMES = [
    "Group A",
    "Group B",
    "Group C",
    "Group D"
];

/* ==========================
   FORMAT START
========================== */

function startGroupStagePlayoffs(
    participants,
    playoffStyle = "hybrid"
) {
    if (!Array.isArray(participants)) {
        tournament.running = false;
        return;
    }

    if (participants.length !== 16) {
        alert(
            "Group Stage to Playoffs requires exactly 16 teams."
        );
        tournament.running = false;
        return;
    }

    if (
        typeof setTournamentSeriesLengthForStage ===
        "function"
    ) {
        setTournamentSeriesLengthForStage("groups");
    }

    tournament.round = "Group Stage";

    tournament.groupStage = {
        active: true,
        playoffStyle,
        groups: createSeededGroups(participants),
        playoffRounds: {},
        finalPlacements: [],
        champion: null,
        runnerUp: null
    };

    tournament.standings = [];

    renderGroupStageBoard();
    renderGroupPlayoffBracket();

    runGroupStageToPlayoffs();
}

async function runGroupStageToPlayoffs() {
    const groupStage = tournament.groupStage;

    if (!groupStage) {
        tournament.running = false;
        return;
    }

    for (let roundIndex = 0; roundIndex < 3; roundIndex++) {
        tournament.round =
            `Group Stage - Round ${roundIndex + 1}`;

        for (const group of groupStage.groups) {
            const round = group.rounds[roundIndex];

            for (const match of round.matches) {
                const result = simulateSeries(
                    match.teamA,
                    match.teamB
                );

                match.result = result;
                match.winner = getTeamFromSeriesResult(
                    match,
                    result,
                    true
                );
                match.loser = getTeamFromSeriesResult(
                    match,
                    result,
                    false
                );

                applyGroupStageResult(
                    group,
                    result
                );

                addMatchCard(result);
                renderGroupStageBoard();
                renderPlayerStats();

                await sleep(getTournamentDelay());
            }
        }
    }

    finaliseGroupStandings();
    renderGroupStageBoard();
    showGroupStageQualificationSummary();

    if (
        typeof setTournamentSeriesLengthForStage ===
        "function"
    ) {
        setTournamentSeriesLengthForStage("playoffs");
    }

    if (
        groupStage.playoffStyle ===
        "doubleElim"
    ) {
        await runTwelveTeamDoubleElimination();
    } else {
        await runTwelveTeamHybridPlayoffs();
    }
}

/* ==========================
   GROUP CREATION + SCHEDULE
========================== */

function createSeededGroups(participants) {
    const seeded = participants.slice(0, 16);

    const groupTeams = [[], [], [], []];

    seeded.forEach((team, index) => {
        const pot = Math.floor(index / 4);
        const position = index % 4;

        const groupIndex = pot % 2 === 0
            ? position
            : 3 - position;

        groupTeams[groupIndex].push(team);
    });

    return groupTeams.map((teamList, index) => {
        const group = {
            id: `group-${index + 1}`,
            name: GROUP_NAMES[index],
            teams: teamList,
            standings: teamList.map(team => ({
                id: team.id,
                name: team.name,
                logo: team.logo,
                region: team.region,
                rating: team.rating,
                seed: getSwissSeedRankSafe(team.id),
                wins: 0,
                losses: 0,
                gameWins: 0,
                gameLosses: 0,
                goalsFor: 0,
                goalsAgainst: 0,
                groupRank: null,
                status: "active"
            })),
            rounds: createFourTeamGroupSchedule(
                teamList
            ),
            finalStandings: []
        };

        return group;
    });
}

function createFourTeamGroupSchedule(teamList) {
    const roundPairIndexes = [
        [
            [0, 3],
            [1, 2]
        ],
        [
            [0, 2],
            [3, 1]
        ],
        [
            [0, 1],
            [2, 3]
        ]
    ];

    return roundPairIndexes.map((pairs, index) => ({
        roundNumber: index + 1,
        matches: pairs.map(pair => ({
            teamA: teamList[pair[0]],
            teamB: teamList[pair[1]],
            result: null,
            winner: null,
            loser: null
        }))
    }));
}

function applyGroupStageResult(group, result) {
    const teamA = group.standings.find(team =>
        String(team.id) === String(result.teamAId)
    );

    const teamB = group.standings.find(team =>
        String(team.id) === String(result.teamBId)
    );

    if (!teamA || !teamB) return;

    teamA.gameWins += result.scoreA;
    teamA.gameLosses += result.scoreB;
    teamA.goalsFor += result.totalGoalsA;
    teamA.goalsAgainst += result.totalGoalsB;

    teamB.gameWins += result.scoreB;
    teamB.gameLosses += result.scoreA;
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

function finaliseGroupStandings() {
    const flatStandings = [];

    tournament.groupStage.groups.forEach(group => {
        group.finalStandings =
            getSortedGroupStandings(group);

        group.finalStandings.forEach(
            (standing, index) => {
                standing.groupRank = index + 1;
                standing.status = index < 3
                    ? "qualified"
                    : "eliminated";

                flatStandings.push({
                    ...standing,
                    groupName: group.name
                });
            }
        );

        const fourthPlace =
            group.finalStandings[3];

        if (fourthPlace) {
            recordGroupPlayoffPlacement(
                getTeamByIdSafe(fourthPlace.id),
                13,
                "Group Stage"
            );
        }
    });

    tournament.standings = flatStandings;
}

function getSortedGroupStandings(group) {
    return [...group.standings].sort((a, b) => {
        if (b.wins !== a.wins) {
            return b.wins - a.wins;
        }

        const gameDiffA =
            a.gameWins - a.gameLosses;

        const gameDiffB =
            b.gameWins - b.gameLosses;

        if (gameDiffB !== gameDiffA) {
            return gameDiffB - gameDiffA;
        }

        if (b.gameWins !== a.gameWins) {
            return b.gameWins - a.gameWins;
        }

        const goalDiffA =
            a.goalsFor - a.goalsAgainst;

        const goalDiffB =
            b.goalsFor - b.goalsAgainst;

        if (goalDiffB !== goalDiffA) {
            return goalDiffB - goalDiffA;
        }

        const headToHead =
            getGroupHeadToHeadWinner(
                group,
                a.id,
                b.id
            );

        if (headToHead !== null) {
            return String(headToHead) === String(a.id)
                ? -1
                : 1;
        }

        return Number(a.seed || 9999) -
            Number(b.seed || 9999);
    });
}

function getGroupHeadToHeadWinner(
    group,
    teamAId,
    teamBId
) {
    for (const round of group.rounds) {
        for (const match of round.matches) {
            if (!match.result) continue;

            const ids = [
                String(match.teamA.id),
                String(match.teamB.id)
            ];

            if (
                ids.includes(String(teamAId)) &&
                ids.includes(String(teamBId))
            ) {
                return match.result.winnerId;
            }
        }
    }

    return null;
}

function getGroupQualifiers() {
    const qualifiers = {
        first: [],
        second: [],
        third: [],
        fourth: []
    };

    tournament.groupStage.groups.forEach(group => {
        const sorted = group.finalStandings.length
            ? group.finalStandings
            : getSortedGroupStandings(group);

        qualifiers.first.push(
            getTeamByIdSafe(sorted[0]?.id)
        );
        qualifiers.second.push(
            getTeamByIdSafe(sorted[1]?.id)
        );
        qualifiers.third.push(
            getTeamByIdSafe(sorted[2]?.id)
        );
        qualifiers.fourth.push(
            getTeamByIdSafe(sorted[3]?.id)
        );
    });

    Object.keys(qualifiers).forEach(key => {
        qualifiers[key] =
            qualifiers[key].filter(Boolean);
    });

    return qualifiers;
}

/* ==========================
   HYBRID PLAYOFFS
========================== */

async function runTwelveTeamHybridPlayoffs() {
    const qualifiers = getGroupQualifiers();

    tournament.round =
        "Playoffs - Upper Bracket Quarterfinals";

    const upperQuarterfinals =
        await playGroupPlayoffRound(
            "upperQuarterfinals",
            "Upper Bracket Quarterfinals",
            [
                {
                    teamA: qualifiers.first[0],
                    teamB: qualifiers.first[3]
                },
                {
                    teamA: qualifiers.first[1],
                    teamB: qualifiers.first[2]
                }
            ]
        );

    const lowerRound1 =
        await playGroupPlayoffRound(
            "lowerRound1",
            "Lower Bracket Round 1",
            [
                {
                    teamA: qualifiers.second[1],
                    teamB: qualifiers.third[3]
                },
                {
                    teamA: qualifiers.second[3],
                    teamB: qualifiers.third[1]
                },
                {
                    teamA: qualifiers.second[0],
                    teamB: qualifiers.third[2]
                },
                {
                    teamA: qualifiers.second[2],
                    teamB: qualifiers.third[0]
                }
            ]
        );

    recordGroupPlayoffEliminations(
        lowerRound1.losers,
        9,
        "Lower Bracket Round 1"
    );

    const lowerRound2 =
        await playGroupPlayoffRound(
            "lowerRound2",
            "Lower Bracket Round 2",
            [
                {
                    teamA: lowerRound1.winners[0],
                    teamB: lowerRound1.winners[1]
                },
                {
                    teamA: lowerRound1.winners[2],
                    teamB: lowerRound1.winners[3]
                }
            ]
        );

    recordGroupPlayoffEliminations(
        lowerRound2.losers,
        7,
        "Lower Bracket Round 2"
    );

    const lowerQuarterfinals =
        await playGroupPlayoffRound(
            "lowerQuarterfinals",
            "Lower Bracket Quarterfinals",
            [
                {
                    teamA: upperQuarterfinals.losers[0],
                    teamB: lowerRound2.winners[0]
                },
                {
                    teamA: upperQuarterfinals.losers[1],
                    teamB: lowerRound2.winners[1]
                }
            ]
        );

    recordGroupPlayoffEliminations(
        lowerQuarterfinals.losers,
        5,
        "Lower Bracket Quarterfinals"
    );

    const semifinals =
        await playGroupPlayoffRound(
            "semifinals",
            "Semifinals",
            [
                {
                    teamA: upperQuarterfinals.winners[1],
                    teamB: lowerQuarterfinals.winners[0]
                },
                {
                    teamA: upperQuarterfinals.winners[0],
                    teamB: lowerQuarterfinals.winners[1]
                }
            ]
        );

    recordGroupPlayoffEliminations(
        semifinals.losers,
        3,
        "Semifinals"
    );

    const grandFinal =
        await playGroupPlayoffRound(
            "grandFinal",
            "Grand Final",
            [
                {
                    teamA: semifinals.winners[0],
                    teamB: semifinals.winners[1]
                }
            ]
        );

    finishGroupStagePlayoffs(
        grandFinal.winners[0],
        grandFinal.losers[0]
    );
}

/* ==========================
   DOUBLE-ELIMINATION PLAYOFFS
========================== */

async function runTwelveTeamDoubleElimination() {
    const qualifiers = getGroupQualifiers();

    const upperSemifinals =
        await playGroupPlayoffRound(
            "upperSemifinals",
            "Upper Bracket Semifinals",
            [
                {
                    teamA: qualifiers.first[0],
                    teamB: qualifiers.first[3]
                },
                {
                    teamA: qualifiers.first[1],
                    teamB: qualifiers.first[2]
                }
            ]
        );

    const lowerRound1 =
        await playGroupPlayoffRound(
            "lowerRound1",
            "Lower Bracket Round 1",
            [
                {
                    teamA: qualifiers.second[1],
                    teamB: qualifiers.third[3]
                },
                {
                    teamA: qualifiers.second[3],
                    teamB: qualifiers.third[1]
                },
                {
                    teamA: qualifiers.second[0],
                    teamB: qualifiers.third[2]
                },
                {
                    teamA: qualifiers.second[2],
                    teamB: qualifiers.third[0]
                }
            ]
        );

    recordGroupPlayoffEliminations(
        lowerRound1.losers,
        9,
        "Lower Bracket Round 1"
    );

    const lowerRound2 =
        await playGroupPlayoffRound(
            "lowerRound2",
            "Lower Bracket Round 2",
            [
                {
                    teamA: lowerRound1.winners[0],
                    teamB: lowerRound1.winners[1]
                },
                {
                    teamA: lowerRound1.winners[2],
                    teamB: lowerRound1.winners[3]
                }
            ]
        );

    recordGroupPlayoffEliminations(
        lowerRound2.losers,
        7,
        "Lower Bracket Round 2"
    );

    const upperFinal =
        await playGroupPlayoffRound(
            "upperFinal",
            "Upper Bracket Final",
            [
                {
                    teamA: upperSemifinals.winners[0],
                    teamB: upperSemifinals.winners[1]
                }
            ]
        );

    const lowerQuarterfinals =
        await playGroupPlayoffRound(
            "lowerQuarterfinals",
            "Lower Bracket Quarterfinals",
            [
                {
                    teamA: upperSemifinals.losers[0],
                    teamB: lowerRound2.winners[0]
                },
                {
                    teamA: upperSemifinals.losers[1],
                    teamB: lowerRound2.winners[1]
                }
            ]
        );

    recordGroupPlayoffEliminations(
        lowerQuarterfinals.losers,
        5,
        "Lower Bracket Quarterfinals"
    );

    const lowerSemifinal =
        await playGroupPlayoffRound(
            "lowerSemifinal",
            "Lower Bracket Semifinal",
            [
                {
                    teamA: lowerQuarterfinals.winners[0],
                    teamB: lowerQuarterfinals.winners[1]
                }
            ]
        );

    recordGroupPlayoffEliminations(
        lowerSemifinal.losers,
        4,
        "Lower Bracket Semifinal"
    );

    const lowerFinal =
        await playGroupPlayoffRound(
            "lowerFinal",
            "Lower Bracket Final",
            [
                {
                    teamA: lowerSemifinal.winners[0],
                    teamB: upperFinal.losers[0]
                }
            ]
        );

    recordGroupPlayoffEliminations(
        lowerFinal.losers,
        3,
        "Lower Bracket Final"
    );

    const grandFinal =
        await playGroupPlayoffRound(
            "grandFinal",
            "Grand Final",
            [
                {
                    teamA: upperFinal.winners[0],
                    teamB: lowerFinal.winners[0]
                }
            ]
        );

    finishGroupStagePlayoffs(
        grandFinal.winners[0],
        grandFinal.losers[0]
    );
}

/* ==========================
   PLAYOFF ROUND ENGINE
========================== */

async function playGroupPlayoffRound(
    key,
    name,
    pairs
) {
    tournament.round = name;

    const round = {
        key,
        name,
        matches: pairs.map(pair => ({
            teamA: pair.teamA,
            teamB: pair.teamB,
            result: null,
            winner: null,
            loser: null
        }))
    };

    tournament.groupStage.playoffRounds[key] =
        round;

    renderGroupPlayoffBracket();

    const winners = [];
    const losers = [];

    for (const match of round.matches) {
        if (!match.teamA || !match.teamB) {
            continue;
        }

        const result = simulateSeries(
            match.teamA,
            match.teamB
        );

        match.result = result;
        match.winner = getTeamFromSeriesResult(
            match,
            result,
            true
        );
        match.loser = getTeamFromSeriesResult(
            match,
            result,
            false
        );

        winners.push(match.winner);
        losers.push(match.loser);

        addMatchCard(result);
        renderGroupPlayoffBracket();
        renderPlayerStats();

        await sleep(getTournamentDelay());
    }

    return {
        round,
        winners,
        losers
    };
}

function getTeamFromSeriesResult(
    match,
    result,
    returnWinner
) {
    const teamAWon =
        String(result.winnerId) ===
        String(match.teamA.id);

    if (returnWinner) {
        return teamAWon
            ? match.teamA
            : match.teamB;
    }

    return teamAWon
        ? match.teamB
        : match.teamA;
}

function recordGroupPlayoffEliminations(
    teamsList,
    placement,
    eliminatedIn
) {
    teamsList.forEach(team => {
        recordGroupPlayoffPlacement(
            team,
            placement,
            eliminatedIn
        );
    });
}

function recordGroupPlayoffPlacement(
    team,
    placement,
    eliminatedIn
) {
    if (!team || !tournament.groupStage) return;

    const exists =
        tournament.groupStage.finalPlacements
            .some(item =>
                String(item.team.id) ===
                String(team.id)
            );

    if (exists) return;

    tournament.groupStage.finalPlacements.push({
        team,
        placement,
        eliminatedIn
    });
}

function finishGroupStagePlayoffs(
    champion,
    runnerUp
) {
    recordGroupPlayoffPlacement(
        runnerUp,
        2,
        "Grand Final"
    );

    recordGroupPlayoffPlacement(
        champion,
        1,
        "Champion"
    );

    tournament.groupStage.champion = champion;
    tournament.groupStage.runnerUp = runnerUp;
    tournament.champion = champion.name;
    tournament.running = false;

    tournament.groupStage.finalPlacements.sort(
        (a, b) =>
            a.placement - b.placement ||
            Number(b.team.rating || 0) -
            Number(a.team.rating || 0)
    );

    renderGroupPlayoffBracket();
    showGroupPlayoffChampion(champion);
    saveTournamentToHistoryIfPossible();
}

function showGroupPlayoffChampion(champion) {
    const feed = document.getElementById("matchFeed");

    if (!feed || !champion) return;

    const styleLabel =
        tournament.groupStage.playoffStyle ===
        "doubleElim"
        ? "Double-Elimination Playoffs"
        : "Hybrid Playoffs";

    feed.innerHTML += `
        <div class="team-card">
            <div class="team-banner"></div>

            <div class="team-content">
                <h2>🏆 Group Stage Champion</h2>

                <h1 style="font-size:48px;color:gold;">
                    ${safeText(champion.name)}
                </h1>

                <p>
                    4 Groups of 4 → ${safeText(styleLabel)}
                </p>
            </div>
        </div>
    `;
}

/* ==========================
   GROUP STAGE RENDERING
========================== */

function renderGroupStageBoard() {
    const container =
        document.getElementById("standings");

    if (!container) return;

    const groups =
        tournament.groupStage?.groups || [];

    if (groups.length === 0) {
        container.innerHTML = `
            <p class="small">
                Group standings will appear here.
            </p>
        `;
        return;
    }

    container.innerHTML = `
        <div class="group-stage-header">
            <div>
                <h2>Group Stage</h2>
                <p>
                    Four groups of four. The top three teams
                    from each group advance to the playoffs.
                </p>
            </div>

            <div class="group-stage-format-badge">
                Group BO${tournament.stageSeries?.swiss || tournament.seriesLength}
                · Playoffs BO${tournament.stageSeries?.playoffs || tournament.seriesLength}
            </div>
        </div>

        <div class="group-stage-grid">
            ${groups.map(group =>
                renderGroupStageCard(group)
            ).join("")}
        </div>
    `;
}

function renderGroupStageCard(group) {
    const standings =
        group.finalStandings.length
        ? group.finalStandings
        : getSortedGroupStandings(group);

    return `
        <section class="group-stage-card">
            <div class="group-stage-card-title">
                ${safeText(group.name)}
            </div>

            <div class="group-stage-table-wrap">
                <table class="group-stage-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Team</th>
                            <th>Matches</th>
                            <th>Games</th>
                            <th>GD</th>
                        </tr>
                    </thead>

                    <tbody>
                        ${standings.map((standing, index) => {
                            const rank = index + 1;
                            const gameDiff =
                                standing.gameWins -
                                standing.gameLosses;

                            return `
                                <tr class="${
                                    rank <= 3
                                    ? "group-stage-qualified"
                                    : "group-stage-eliminated"
                                }">
                                    <td>${rank}.</td>

                                    <td>
                                        <div class="group-stage-team">
                                            ${renderGroupTeamLogo(standing)}
                                            <span>${safeText(standing.name)}</span>
                                        </div>
                                    </td>

                                    <td>
                                        ${standing.wins}-${standing.losses}
                                    </td>

                                    <td>
                                        ${standing.gameWins}-${standing.gameLosses}
                                    </td>

                                    <td>
                                        ${gameDiff > 0 ? "+" : ""}${gameDiff}
                                    </td>
                                </tr>
                            `;
                        }).join("")}
                    </tbody>
                </table>
            </div>

            <div class="group-stage-round-list">
                ${group.rounds.map(round => `
                    <div class="group-stage-round">
                        <div class="group-stage-round-title">
                            Round ${round.roundNumber}
                        </div>

                        ${round.matches.map(match =>
                            renderGroupStageMatch(match)
                        ).join("")}
                    </div>
                `).join("")}
            </div>
        </section>
    `;
}

function renderGroupStageMatch(match) {
    const result = match.result;

    return `
        <div class="group-stage-match">
            ${renderGroupStageMatchTeam(
                match.teamA,
                result,
                true
            )}

            <div class="group-stage-match-score">
                ${
                    result
                    ? `${result.scoreA} - ${result.scoreB}`
                    : "vs"
                }
            </div>

            ${renderGroupStageMatchTeam(
                match.teamB,
                result,
                false
            )}
        </div>
    `;
}

function renderGroupStageMatchTeam(
    team,
    result,
    isTeamA
) {
    const won = result && (
        String(result.winnerId) === String(team.id)
    );

    return `
        <div class="group-stage-match-team ${won ? "winner" : ""}">
            ${renderGroupTeamLogo(team)}
            <span>${safeText(team.name)}</span>
        </div>
    `;
}

function renderGroupTeamLogo(team) {
    if (team?.logo) {
        return `
            <img
                src="${team.logo}"
                class="group-stage-logo"
                alt=""
            >
        `;
    }

    return `
        <div class="group-stage-logo logo-placeholder"></div>
    `;
}

function showGroupStageQualificationSummary() {
    const feed = document.getElementById("matchFeed");

    if (!feed) return;

    const qualifiers = getGroupQualifiers();

    feed.innerHTML += `
        <div class="team-card">
            <div class="team-banner"></div>

            <div class="team-content">
                <h2>✅ Group Stage Complete</h2>

                <p>
                    The top three teams from every group
                    have advanced to the 12-team playoffs.
                </p>

                <div class="group-qualifier-grid">
                    ${tournament.groupStage.groups.map(
                        (group, index) => `
                            <div class="group-qualifier-card">
                                <strong>${safeText(group.name)}</strong>
                                <span>1. ${safeText(qualifiers.first[index]?.name)}</span>
                                <span>2. ${safeText(qualifiers.second[index]?.name)}</span>
                                <span>3. ${safeText(qualifiers.third[index]?.name)}</span>
                            </div>
                        `
                    ).join("")}
                </div>
            </div>
        </div>
    `;
}

/* ==========================
   PLAYOFF BRACKET RENDERING
========================== */

function renderGroupPlayoffBracket() {
    const container =
        document.getElementById("bracketContainer");

    if (!container) return;

    const state = tournament.groupStage;

    if (!state) {
        container.innerHTML = "";
        return;
    }

    const styleLabel = state.playoffStyle === "doubleElim"
        ? "12-Team Double-Elimination Playoffs"
        : "12-Team Hybrid Playoffs";

    container.innerHTML = `
        <div class="group-playoff-wrapper">
            <div class="group-playoff-header">
                <div>
                    <h2>${safeText(styleLabel)}</h2>
                    <p>
                        Group winners receive the strongest
                        playoff path. Second and third-place
                        teams begin in the lower opening round.
                    </p>
                </div>

                <div class="group-playoff-badge">
                    12 Qualified Teams
                </div>
            </div>

            ${
                state.playoffStyle === "doubleElim"
                ? renderTwelveTeamDoubleBracket()
                : renderTwelveTeamHybridBracket()
            }
        </div>
    `;
}

function renderTwelveTeamHybridBracket() {
    return `
        <div class="group-playoff-grid group-playoff-grid-hybrid">
            ${renderGroupPlayoffColumn(
                "Lower Round 1",
                ["lowerRound1"]
            )}

            ${renderGroupPlayoffColumn(
                "Lower Round 2",
                ["lowerRound2"]
            )}

            ${renderGroupPlayoffColumn(
                "Quarterfinal Stage",
                [
                    "upperQuarterfinals",
                    "lowerQuarterfinals"
                ]
            )}

            ${renderGroupPlayoffColumn(
                "Semifinals",
                ["semifinals"]
            )}

            ${renderGroupPlayoffColumn(
                "Grand Final",
                ["grandFinal"]
            )}

            ${renderGroupPlayoffChampionColumn()}
        </div>
    `;
}

function renderTwelveTeamDoubleBracket() {
    return `
        <div class="group-playoff-grid group-playoff-grid-double">
            ${renderGroupPlayoffColumn(
                "Lower Round 1",
                ["lowerRound1"]
            )}

            ${renderGroupPlayoffColumn(
                "Lower Round 2",
                ["lowerRound2"]
            )}

            ${renderGroupPlayoffColumn(
                "Opening Brackets",
                [
                    "upperSemifinals",
                    "lowerQuarterfinals"
                ]
            )}

            ${renderGroupPlayoffColumn(
                "Bracket Finals",
                [
                    "upperFinal",
                    "lowerSemifinal"
                ]
            )}

            ${renderGroupPlayoffColumn(
                "Lower Final",
                ["lowerFinal"]
            )}

            ${renderGroupPlayoffColumn(
                "Grand Final",
                ["grandFinal"]
            )}

            ${renderGroupPlayoffChampionColumn()}
        </div>
    `;
}

function renderGroupPlayoffColumn(
    heading,
    roundKeys
) {
    return `
        <div class="group-playoff-column">
            <h3>${safeText(heading)}</h3>

            ${roundKeys.map(key =>
                renderGroupPlayoffRound(key)
            ).join("")}
        </div>
    `;
}

function renderGroupPlayoffRound(key) {
    const round =
        tournament.groupStage
            ?.playoffRounds?.[key];

    if (!round) {
        return `
            <div class="group-playoff-round-block">
                <div class="group-playoff-round-name">
                    ${safeText(formatGroupRoundKey(key))}
                </div>

                <div class="group-playoff-placeholder">
                    Awaiting teams
                </div>
            </div>
        `;
    }

    return `
        <div class="group-playoff-round-block">
            <div class="group-playoff-round-name">
                ${safeText(round.name)}
            </div>

            <div class="group-playoff-match-list">
                ${round.matches.map(match =>
                    renderGroupPlayoffMatch(match)
                ).join("")}
            </div>
        </div>
    `;
}

function renderGroupPlayoffMatch(match) {
    return `
        <div class="group-playoff-match-card ${
            match.result
            ? "complete"
            : "pending"
        }">
            ${renderGroupPlayoffTeamRow(
                match.teamA,
                match,
                true
            )}

            ${renderGroupPlayoffTeamRow(
                match.teamB,
                match,
                false
            )}
        </div>
    `;
}

function renderGroupPlayoffTeamRow(
    team,
    match,
    isTeamA
) {
    if (!team) {
        return `
            <div class="group-playoff-team-row">
                <div class="group-playoff-team-left">
                    <div class="group-playoff-logo logo-placeholder"></div>
                    <span>TBD</span>
                </div>
                <strong>-</strong>
            </div>
        `;
    }

    const winner =
        match.winner &&
        String(match.winner.id) === String(team.id);

    const loser =
        match.loser &&
        String(match.loser.id) === String(team.id);

    let score = "-";

    if (match.result) {
        score = isTeamA
            ? match.result.scoreA
            : match.result.scoreB;
    }

    return `
        <div class="group-playoff-team-row
            ${winner ? "winner" : ""}
            ${loser ? "loser" : ""}">

            <div class="group-playoff-team-left">
                ${
                    team.logo
                    ? `
                        <img
                            src="${team.logo}"
                            class="group-playoff-logo"
                            alt=""
                        >
                    `
                    : `
                        <div class="group-playoff-logo logo-placeholder"></div>
                    `
                }

                <span>${safeText(team.name)}</span>
            </div>

            <strong>${score}</strong>
        </div>
    `;
}

function renderGroupPlayoffChampionColumn() {
    const champion =
        tournament.groupStage?.champion;

    return `
        <div class="group-playoff-column champion-column">
            <h3>Champion</h3>

            ${
                champion
                ? renderChampionSlot(champion)
                : `
                    <div class="group-playoff-placeholder champion-placeholder">
                        Awaiting Grand Final
                    </div>
                `
            }
        </div>
    `;
}

function formatGroupRoundKey(key) {
    const labels = {
        upperQuarterfinals:
            "Upper Bracket Quarterfinals",
        upperSemifinals:
            "Upper Bracket Semifinals",
        upperFinal:
            "Upper Bracket Final",
        lowerRound1:
            "Lower Bracket Round 1",
        lowerRound2:
            "Lower Bracket Round 2",
        lowerQuarterfinals:
            "Lower Bracket Quarterfinals",
        lowerSemifinal:
            "Lower Bracket Semifinal",
        lowerFinal:
            "Lower Bracket Final",
        semifinals:
            "Semifinals",
        grandFinal:
            "Grand Final"
    };

    return labels[key] || key;
}

/* ==========================
   HISTORY PLACEMENTS
========================== */

function createGroupStagePlacements() {
    const placements =
        tournament.groupStage?.finalPlacements || [];

    return [...placements]
        .sort((a, b) =>
            a.placement - b.placement ||
            Number(b.team.rating || 0) -
            Number(a.team.rating || 0)
        )
        .map(item => ({
            placement: item.placement,
            teamId: item.team.id,
            teamName: item.team.name,
            logo: item.team.logo,
            region: item.team.region,
            rating: item.team.rating,
            eliminatedIn: item.eliminatedIn
        }));
}

/* ==========================
   SAFE HELPERS
========================== */

function getTeamByIdSafe(id) {
    if (typeof getTeamById === "function") {
        return getTeamById(id);
    }

    if (
        typeof teams !== "undefined" &&
        Array.isArray(teams)
    ) {
        return teams.find(team =>
            String(team.id) === String(id)
        ) || null;
    }

    return null;
}

function getSwissSeedRankSafe(teamId) {
    if (typeof getSwissSeedRank === "function") {
        return getSwissSeedRank(teamId);
    }

    const index =
        tournament.participants.findIndex(team =>
            String(team.id) === String(teamId)
        );

    return index === -1
        ? 9999
        : index + 1;
}

/* ==========================
   EXPORTS
========================== */

window.startGroupStagePlayoffs =
    startGroupStagePlayoffs;

window.renderGroupStageBoard =
    renderGroupStageBoard;

window.renderGroupPlayoffBracket =
    renderGroupPlayoffBracket;

window.createGroupStagePlacements =
    createGroupStagePlacements;
