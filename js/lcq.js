/* ==========================
   RLCS LEAGUE SIMULATOR
   REGIONAL WORLDS LCQ
   6 teams -> 1 Worlds Play-In place
========================== */

function startRegionalLcq(participants) {
    const bracketTeams = (participants || []).slice(0, 6);

    if (bracketTeams.length !== 6) {
        alert("Regional Worlds LCQ requires exactly 6 teams.");
        tournament.running = false;
        return;
    }

    if (typeof setTournamentSeriesLengthForStage === "function") {
        setTournamentSeriesLengthForStage("playoffs");
    }

    tournament.round = "Regional Worlds LCQ";
    tournament.lcq = {
        active: true,
        region:
            tournament.currentEvent?.region ||
            bracketTeams[0]?.region ||
            "Unknown",
        seeds: bracketTeams.map((team, index) => ({
            seed: index + 1,
            team
        })),
        provisionalQualifierIds: [],
        rounds: [],
        qualifiedTeams: [],
        eliminatedTeams: [],
        finalPlacements: []
    };

    renderRegionalLcqBracket();
    runRegionalLcq(bracketTeams);
}

async function runRegionalLcq(bracketTeams) {
    const [seed1, seed2, seed3, seed4, seed5, seed6] = bracketTeams;

    const challengerA = await playRegionalLcqMatch(
        "Challenger Round",
        "Seed 3 vs Seed 6",
        seed3,
        seed6
    );

    await sleep(getTournamentDelay());

    const challengerB = await playRegionalLcqMatch(
        "Challenger Round",
        "Seed 4 vs Seed 5",
        seed4,
        seed5
    );

    await sleep(getTournamentDelay());

    const semifinalA = await playRegionalLcqMatch(
        "LCQ Semifinals",
        "Semifinal 1",
        seed1,
        challengerA.winner
    );

    await sleep(getTournamentDelay());

    const semifinalB = await playRegionalLcqMatch(
        "LCQ Semifinals",
        "Semifinal 2",
        seed2,
        challengerB.winner
    );

    await sleep(getTournamentDelay());

    const final = await playRegionalLcqMatch(
        "LCQ Final",
        "Worlds Play-In Qualification",
        semifinalA.winner,
        semifinalB.winner
    );

    finishRegionalLcq(
        final.winner,
        final.loser,
        [semifinalA.loser, semifinalB.loser],
        [challengerA.loser, challengerB.loser]
    );
}

async function playRegionalLcqMatch(
    roundName,
    matchName,
    teamA,
    teamB
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

    tournament.lcq.rounds.push(match);
    renderRegionalLcqBracket();

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
    renderRegionalLcqBracket();

    return match;
}

function finishRegionalLcq(
    winner,
    finalLoser,
    semifinalLosers,
    challengerLosers
) {
    tournament.lcq.qualifiedTeams = [{
        ...winner,
        qualificationType: "lcq-winner"
    }];

    tournament.lcq.eliminatedTeams = [
        finalLoser,
        ...semifinalLosers,
        ...challengerLosers
    ];

    tournament.lcq.finalPlacements = [
        {
            placement: 1,
            team: winner,
            status: "qualified-playin"
        },
        {
            placement: 2,
            team: finalLoser,
            status: "eliminated-final"
        },
        ...semifinalLosers.map((team, index) => ({
            placement: index + 3,
            team,
            status: "eliminated-semifinal"
        })),
        ...challengerLosers.map((team, index) => ({
            placement: index + 5,
            team,
            status: "eliminated-challenger"
        }))
    ];

    tournament.champion = winner.name;
    tournament.running = false;
    tournament.round = "Complete";

    renderRegionalLcqBracket();
    renderRegionalLcqCompletion();
    saveTournamentToHistoryIfPossible();
}

function createRegionalLcqPlacements() {
    return (tournament.lcq?.finalPlacements || []).map(item => ({
        placement: Number(item.placement || 0),
        teamId: item.team?.id,
        teamName: item.team?.name || "Unknown Team",
        logo: item.team?.logo || "",
        region: item.team?.region || tournament.lcq?.region || "Unknown",
        rating: Number(item.team?.rating || 0),
        status: item.status || ""
    }));
}

function renderRegionalLcqBracket() {
    const container = document.getElementById("bracketContainer");

    if (!container || !tournament.lcq?.active) return;

    const rounds = tournament.lcq.rounds || [];
    const challengerMatches = rounds.filter(match =>
        match.round === "Challenger Round"
    );
    const semifinalMatches = rounds.filter(match =>
        match.round === "LCQ Semifinals"
    );
    const finalMatch = rounds.find(match =>
        match.round === "LCQ Final"
    );
    const qualifier = tournament.lcq.qualifiedTeams?.[0] || null;
    const seeds = tournament.lcq.seeds || [];

    container.innerHTML = `
        <div class="lcq-bracket-shell">
            <div class="lcq-bracket-header">
                <div>
                    <span>Regional Last Chance Qualifier</span>
                    <h2>${escapeLcqText(tournament.lcq.region)} Worlds LCQ</h2>
                    <p>Six teams compete for one Worlds Play-In place.</p>
                </div>

                <strong>1 Play-In Spot</strong>
            </div>

            <div class="lcq-bracket-grid lcq-single-spot-grid">
                <div class="lcq-bracket-column">
                    <h3>Challenger Round</h3>
                    ${renderLcqMatchCard(
                        challengerMatches[0],
                        seeds[2]?.team,
                        seeds[5]?.team,
                        "Seed 3 vs Seed 6"
                    )}
                    ${renderLcqMatchCard(
                        challengerMatches[1],
                        seeds[3]?.team,
                        seeds[4]?.team,
                        "Seed 4 vs Seed 5"
                    )}
                </div>

                <div class="lcq-bracket-column">
                    <h3>LCQ Semifinals</h3>
                    ${renderLcqMatchCard(
                        semifinalMatches[0],
                        seeds[0]?.team,
                        challengerMatches[0]?.winner,
                        "Semifinal 1"
                    )}
                    ${renderLcqMatchCard(
                        semifinalMatches[1],
                        seeds[1]?.team,
                        challengerMatches[1]?.winner,
                        "Semifinal 2"
                    )}
                </div>

                <div class="lcq-bracket-column">
                    <h3>LCQ Final</h3>
                    ${renderLcqMatchCard(
                        finalMatch,
                        semifinalMatches[0]?.winner,
                        semifinalMatches[1]?.winner,
                        "Worlds Play-In Qualification"
                    )}
                </div>

                <div class="lcq-bracket-column lcq-qualified-column">
                    <h3>Play-In Qualified</h3>
                    ${qualifier
                        ? renderLcqQualifiedCard(qualifier)
                        : `<div class="lcq-empty-card">Awaiting LCQ Final</div>`}
                </div>
            </div>
        </div>
    `;
}

function renderLcqSeedCard(seedEntry, subtitle) {
    if (!seedEntry?.team) {
        return `<div class="lcq-empty-card">Awaiting team</div>`;
    }

    return `
        <div class="lcq-team-card">
            <span class="lcq-seed-badge">#${seedEntry.seed}</span>
            ${renderLcqLogo(seedEntry.team)}
            <div>
                <strong>${escapeLcqText(seedEntry.team.name)}</strong>
                <span>${escapeLcqText(subtitle)}</span>
            </div>
        </div>
    `;
}

function renderLcqMatchCard(
    match,
    fallbackTeamA,
    fallbackTeamB,
    label
) {
    const teamA = match?.teamA || fallbackTeamA;
    const teamB = match?.teamB || fallbackTeamB;
    const result = match?.result;

    return `
        <div class="lcq-match-card ${result ? "lcq-match-complete" : ""}">
            <span class="lcq-match-label">${escapeLcqText(match?.matchName || label)}</span>
            ${renderLcqMatchTeam(teamA, result?.scoreA, match?.winner)}
            ${renderLcqMatchTeam(teamB, result?.scoreB, match?.winner)}
        </div>
    `;
}

function renderLcqMatchTeam(team, score, winner) {
    if (!team) {
        return `
            <div class="lcq-match-team lcq-match-team-empty">
                <span>Awaiting winner</span>
                <strong>-</strong>
            </div>
        `;
    }

    const won = winner && String(winner.id) === String(team.id);

    return `
        <div class="lcq-match-team ${won ? "lcq-match-winner" : ""}">
            ${renderLcqLogo(team)}
            <span>${escapeLcqText(team.name)}</span>
            <strong>${score === undefined ? "-" : score}</strong>
        </div>
    `;
}

function renderLcqQualifiedCard(team) {
    return `
        <div class="lcq-qualified-card">
            ${renderLcqLogo(team)}
            <div>
                <strong>${escapeLcqText(team.name)}</strong>
                <span>Regional LCQ Winner</span>
            </div>
            <b>✓</b>
        </div>
    `;
}

function renderLcqLogo(team) {
    return team?.logo
        ? `<img src="${team.logo}" class="lcq-team-logo" alt="">`
        : `<div class="lcq-team-logo lcq-logo-placeholder"></div>`;
}

function renderRegionalLcqCompletion() {
    const feed = document.getElementById("matchFeed");

    if (!feed) return;

    const qualifier = tournament.lcq?.qualifiedTeams?.[0];

    feed.innerHTML += `
        <div class="team-card lcq-completion-card">
            <div class="team-banner"></div>
            <div class="team-content">
                <h2>🌍 Worlds Play-In Qualification Complete</h2>
                <p>${escapeLcqText(tournament.lcq?.region)} sends one LCQ winner to the Worlds Play-In.</p>

                ${qualifier ? `
                    <div class="lcq-completion-teams">
                        <div class="lcq-completion-team">
                            ${renderLcqLogo(qualifier)}
                            <strong>${escapeLcqText(qualifier.name)}</strong>
                            <span>Regional LCQ Winner</span>
                        </div>
                    </div>
                ` : ""}
            </div>
        </div>
    `;
}

function escapeLcqText(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

window.startRegionalLcq = startRegionalLcq;
window.createRegionalLcqPlacements = createRegionalLcqPlacements;
window.renderRegionalLcqBracket = renderRegionalLcqBracket;
