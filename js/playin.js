/* ==========================
   RLCS LEAGUE SIMULATOR
   WORLDS PLAY-IN
   8 teams -> 4 World Championship places
========================== */

function startWorldsPlayIn(participants) {
    const bracketTeams = (participants || []).slice(0, 8);

    if (bracketTeams.length !== 8) {
        alert("Worlds Play-In requires exactly 8 teams.");
        tournament.running = false;
        return;
    }

    if (typeof setTournamentSeriesLengthForStage === "function") {
        setTournamentSeriesLengthForStage("playoffs");
    }

    tournament.round = "Worlds Play-In";
    tournament.playIn = {
        active: true,
        seeds: bracketTeams.map((team, index) => ({
            seed: index + 1,
            team
        })),
        upperQuarterfinals: [],
        upperSemifinals: [],
        lowerQuarterfinals: [],
        lowerSemifinals: [],
        qualifiedTeams: [],
        eliminatedTeams: [],
        finalPlacements: []
    };

    renderWorldsPlayInBracket();
    runWorldsPlayIn(bracketTeams);
}

async function runWorldsPlayIn(bracketTeams) {
    const [seed1, seed2, seed3, seed4, seed5, seed6, seed7, seed8] = bracketTeams;

    const uqf1 = await playWorldsPlayInMatch(
        "Upper Bracket Quarterfinals",
        "Upper Quarterfinal 1",
        seed1,
        seed8,
        "upperQuarterfinals"
    );
    await sleep(getTournamentDelay());

    const uqf2 = await playWorldsPlayInMatch(
        "Upper Bracket Quarterfinals",
        "Upper Quarterfinal 2",
        seed4,
        seed5,
        "upperQuarterfinals"
    );
    await sleep(getTournamentDelay());

    const uqf3 = await playWorldsPlayInMatch(
        "Upper Bracket Quarterfinals",
        "Upper Quarterfinal 3",
        seed2,
        seed7,
        "upperQuarterfinals"
    );
    await sleep(getTournamentDelay());

    const uqf4 = await playWorldsPlayInMatch(
        "Upper Bracket Quarterfinals",
        "Upper Quarterfinal 4",
        seed3,
        seed6,
        "upperQuarterfinals"
    );
    await sleep(getTournamentDelay());

    const usf1 = await playWorldsPlayInMatch(
        "Upper Bracket Semifinals",
        "Upper Qualification Match 1",
        uqf1.winner,
        uqf2.winner,
        "upperSemifinals"
    );
    await sleep(getTournamentDelay());

    const usf2 = await playWorldsPlayInMatch(
        "Upper Bracket Semifinals",
        "Upper Qualification Match 2",
        uqf3.winner,
        uqf4.winner,
        "upperSemifinals"
    );
    await sleep(getTournamentDelay());

    const lqf1 = await playWorldsPlayInMatch(
        "Lower Bracket Quarterfinals",
        "Lower Quarterfinal 1",
        uqf1.loser,
        uqf2.loser,
        "lowerQuarterfinals"
    );
    await sleep(getTournamentDelay());

    const lqf2 = await playWorldsPlayInMatch(
        "Lower Bracket Quarterfinals",
        "Lower Quarterfinal 2",
        uqf3.loser,
        uqf4.loser,
        "lowerQuarterfinals"
    );
    await sleep(getTournamentDelay());

    const lsf1 = await playWorldsPlayInMatch(
        "Lower Bracket Semifinals",
        "Lower Qualification Match 1",
        usf1.loser,
        lqf2.winner,
        "lowerSemifinals"
    );
    await sleep(getTournamentDelay());

    const lsf2 = await playWorldsPlayInMatch(
        "Lower Bracket Semifinals",
        "Lower Qualification Match 2",
        usf2.loser,
        lqf1.winner,
        "lowerSemifinals"
    );

    finishWorldsPlayIn(
        [usf1.winner, usf2.winner, lsf1.winner, lsf2.winner],
        [lsf1.loser, lsf2.loser],
        [lqf1.loser, lqf2.loser]
    );
}

async function playWorldsPlayInMatch(
    roundName,
    matchName,
    teamA,
    teamB,
    bucketName
) {
    tournament.round = roundName;

    const match = {
        round: roundName,
        matchName,
        teamA,
        teamB,
        result: null,
        winner: null,
        loser: null
    };

    tournament.playIn[bucketName].push(match);
    renderWorldsPlayInBracket();

    const result = simulateSeries(teamA, teamB);
    const winner = String(result.winnerId) === String(teamA.id)
        ? teamA
        : teamB;
    const loser = String(winner.id) === String(teamA.id)
        ? teamB
        : teamA;

    match.result = result;
    match.winner = winner;
    match.loser = loser;

    addMatchCard(result);
    renderPlayerStats();
    renderWorldsPlayInBracket();

    return match;
}

function finishWorldsPlayIn(
    qualifiedTeams,
    lowerSemifinalLosers,
    lowerQuarterfinalLosers
) {
    tournament.playIn.qualifiedTeams = qualifiedTeams.map((team, index) => ({
        ...team,
        qualificationSeed: index + 1,
        qualificationPath: index < 2 ? "Upper Bracket" : "Lower Bracket"
    }));

    tournament.playIn.eliminatedTeams = [
        ...lowerSemifinalLosers,
        ...lowerQuarterfinalLosers
    ];

    tournament.playIn.finalPlacements = [
        ...tournament.playIn.qualifiedTeams.map((team, index) => ({
            placement: index + 1,
            team,
            status: "qualified"
        })),
        ...lowerSemifinalLosers.map((team, index) => ({
            placement: index + 5,
            team,
            status: "eliminated-final-round"
        })),
        ...lowerQuarterfinalLosers.map((team, index) => ({
            placement: index + 7,
            team,
            status: "eliminated-lower-quarterfinal"
        }))
    ];

    tournament.champion = qualifiedTeams
        .map(team => team.name)
        .join(" & ");

    tournament.running = false;
    tournament.round = "Complete";

    renderWorldsPlayInBracket();
    renderWorldsPlayInCompletion();
    saveTournamentToHistoryIfPossible();
}

function createWorldsPlayInPlacements() {
    return (tournament.playIn?.finalPlacements || []).map(item => ({
        placement: Number(item.placement || 0),
        teamId: item.team?.id,
        teamName: item.team?.name || "Unknown Team",
        logo: item.team?.logo || "",
        region: item.team?.region || "Unknown",
        rating: Number(item.team?.rating || 0),
        status: item.status || ""
    }));
}

function renderWorldsPlayInBracket() {
    const container = document.getElementById("bracketContainer");

    if (!container || !tournament.playIn?.active) return;

    const playIn = tournament.playIn;

    container.innerHTML = `
        <div class="worlds-playin-shell">
            <div class="worlds-playin-header">
                <div>
                    <span>World Championship</span>
                    <h2>Play-In Stage</h2>
                    <p>Win twice before losing twice to qualify for the Main Event.</p>
                </div>
                <strong>8 Teams · 4 Qualify</strong>
            </div>

            <div class="worlds-playin-section">
                <h3>Upper Bracket</h3>
                <div class="worlds-playin-grid worlds-playin-upper-grid">
                    ${renderWorldsPlayInColumn(
                        "Upper Bracket Quarterfinals",
                        playIn.upperQuarterfinals,
                        buildPlayInFallbackPairs(playIn.seeds, [[0, 7], [3, 4], [1, 6], [2, 5]])
                    )}
                    ${renderWorldsPlayInColumn(
                        "Upper Bracket Semifinals",
                        playIn.upperSemifinals,
                        [
                            [playIn.upperQuarterfinals[0]?.winner, playIn.upperQuarterfinals[1]?.winner],
                            [playIn.upperQuarterfinals[2]?.winner, playIn.upperQuarterfinals[3]?.winner]
                        ]
                    )}
                    ${renderWorldsPlayInQualifiedColumn(
                        playIn.qualifiedTeams.slice(0, 2),
                        "Upper Qualified"
                    )}
                </div>
            </div>

            <div class="worlds-playin-section worlds-playin-lower-section">
                <h3>Lower Bracket</h3>
                <div class="worlds-playin-grid worlds-playin-lower-grid">
                    ${renderWorldsPlayInColumn(
                        "Lower Bracket Quarterfinals",
                        playIn.lowerQuarterfinals,
                        [
                            [playIn.upperQuarterfinals[0]?.loser, playIn.upperQuarterfinals[1]?.loser],
                            [playIn.upperQuarterfinals[2]?.loser, playIn.upperQuarterfinals[3]?.loser]
                        ]
                    )}
                    ${renderWorldsPlayInColumn(
                        "Lower Bracket Semifinals",
                        playIn.lowerSemifinals,
                        [
                            [playIn.upperSemifinals[0]?.loser, playIn.lowerQuarterfinals[1]?.winner],
                            [playIn.upperSemifinals[1]?.loser, playIn.lowerQuarterfinals[0]?.winner]
                        ]
                    )}
                    ${renderWorldsPlayInQualifiedColumn(
                        playIn.qualifiedTeams.slice(2, 4),
                        "Lower Qualified"
                    )}
                </div>
            </div>
        </div>
    `;
}

function buildPlayInFallbackPairs(seeds, indexes) {
    return indexes.map(([a, b]) => [
        seeds[a]?.team,
        seeds[b]?.team
    ]);
}

function renderWorldsPlayInColumn(title, matches, fallbackPairs) {
    const count = Math.max(matches.length, fallbackPairs.length);

    return `
        <div class="worlds-playin-column">
            <h4>${escapePlayInText(title)}</h4>
            <div class="worlds-playin-column-matches">
                ${Array.from({ length: count }, (_, index) =>
                    renderWorldsPlayInMatchCard(
                        matches[index],
                        fallbackPairs[index]?.[0],
                        fallbackPairs[index]?.[1]
                    )
                ).join("")}
            </div>
        </div>
    `;
}

function renderWorldsPlayInMatchCard(match, fallbackTeamA, fallbackTeamB) {
    const teamA = match?.teamA || fallbackTeamA;
    const teamB = match?.teamB || fallbackTeamB;
    const result = match?.result;

    return `
        <div class="worlds-playin-match ${result ? "worlds-playin-match-complete" : ""}">
            ${renderWorldsPlayInMatchTeam(teamA, result?.scoreA, match?.winner)}
            ${renderWorldsPlayInMatchTeam(teamB, result?.scoreB, match?.winner)}
        </div>
    `;
}

function renderWorldsPlayInMatchTeam(team, score, winner) {
    if (!team) {
        return `
            <div class="worlds-playin-match-team worlds-playin-empty-team">
                <span>Awaiting team</span>
                <strong>-</strong>
            </div>
        `;
    }

    const won = winner && String(winner.id) === String(team.id);

    return `
        <div class="worlds-playin-match-team ${won ? "worlds-playin-winner" : ""}">
            ${renderWorldsPlayInLogo(team)}
            <span>${escapePlayInText(team.name)}</span>
            <strong>${score === undefined ? "-" : score}</strong>
        </div>
    `;
}

function renderWorldsPlayInQualifiedColumn(teamsList, title) {
    return `
        <div class="worlds-playin-column worlds-playin-qualified-column">
            <h4>${escapePlayInText(title)}</h4>
            <div class="worlds-playin-column-matches">
                ${teamsList.length > 0
                    ? teamsList.map(team => `
                        <div class="worlds-playin-qualified-card">
                            ${renderWorldsPlayInLogo(team)}
                            <div>
                                <strong>${escapePlayInText(team.name)}</strong>
                                <span>${escapePlayInText(team.qualificationPath || "Qualified")}</span>
                            </div>
                            <b>✓</b>
                        </div>
                    `).join("")
                    : `
                        <div class="worlds-playin-qualified-card worlds-playin-qualified-empty">Awaiting qualifier</div>
                        <div class="worlds-playin-qualified-card worlds-playin-qualified-empty">Awaiting qualifier</div>
                    `}
            </div>
        </div>
    `;
}

function renderWorldsPlayInLogo(team) {
    return team?.logo
        ? `<img src="${team.logo}" class="worlds-playin-logo" alt="">`
        : `<div class="worlds-playin-logo worlds-playin-logo-placeholder"></div>`;
}

function renderWorldsPlayInCompletion() {
    const feed = document.getElementById("matchFeed");

    if (!feed) return;

    const qualifiers = tournament.playIn?.qualifiedTeams || [];

    feed.innerHTML += `
        <div class="team-card worlds-playin-completion-card">
            <div class="team-banner"></div>
            <div class="team-content">
                <h2>🌍 Worlds Main Event Field Complete</h2>
                <p>Four teams advanced from the Play-In Stage.</p>
                <div class="worlds-playin-completion-grid">
                    ${qualifiers.map(team => `
                        <div class="worlds-playin-completion-team">
                            ${renderWorldsPlayInLogo(team)}
                            <strong>${escapePlayInText(team.name)}</strong>
                            <span>${escapePlayInText(team.qualificationPath)}</span>
                        </div>
                    `).join("")}
                </div>
            </div>
        </div>
    `;
}

function escapePlayInText(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

window.startWorldsPlayIn = startWorldsPlayIn;
window.createWorldsPlayInPlacements = createWorldsPlayInPlacements;
window.renderWorldsPlayInBracket = renderWorldsPlayInBracket;
