/* ==========================
   RLCS LEAGUE SIMULATOR
   CAREER SYSTEMS
   - AUTOMATED TRANSFER SUGGESTIONS
   - PLAYER DEVELOPMENT
========================== */

const TRANSFER_SUGGESTIONS_KEY = "rlcsTransferSuggestionsV1";
const CAREER_SETTINGS_KEY = "rlcsCareerSettingsV1";
const DEVELOPMENT_PENDING_KEY = "rlcsPendingDevelopmentReviewV1";
const DEVELOPMENT_HISTORY_KEY = "rlcsPlayerDevelopmentHistoryV1";

const DEFAULT_CAREER_SETTINGS = {
    autoGenerateTransfers: true,
    transferSuggestionCount: 6,
    developmentEnabled: true,
    developmentTiming: "afterSplit",
    developmentVolatility: "balanced",
    developmentMaxChange: 2,
    developmentAutoApply: false
};

/* ==========================
   STORAGE
========================== */

function getCareerSettings() {
    try {
        return {
            ...DEFAULT_CAREER_SETTINGS,
            ...JSON.parse(
                localStorage.getItem(CAREER_SETTINGS_KEY) || "{}"
            )
        };
    } catch {
        return { ...DEFAULT_CAREER_SETTINGS };
    }
}

function saveCareerSettings(settings) {
    localStorage.setItem(
        CAREER_SETTINGS_KEY,
        JSON.stringify({
            ...DEFAULT_CAREER_SETTINGS,
            ...(settings || {})
        })
    );
}

function getTransferSuggestions() {
    try {
        const parsed = JSON.parse(
            localStorage.getItem(TRANSFER_SUGGESTIONS_KEY) || "[]"
        );
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function saveTransferSuggestions(suggestions) {
    localStorage.setItem(
        TRANSFER_SUGGESTIONS_KEY,
        JSON.stringify((suggestions || []).slice(0, 80))
    );
}

function getPendingDevelopmentReview() {
    try {
        return JSON.parse(
            localStorage.getItem(DEVELOPMENT_PENDING_KEY) || "null"
        );
    } catch {
        return null;
    }
}

function savePendingDevelopmentReview(review) {
    if (!review) {
        localStorage.removeItem(DEVELOPMENT_PENDING_KEY);
        return;
    }

    localStorage.setItem(
        DEVELOPMENT_PENDING_KEY,
        JSON.stringify(review)
    );
}

function getPlayerDevelopmentHistory() {
    try {
        const parsed = JSON.parse(
            localStorage.getItem(DEVELOPMENT_HISTORY_KEY) || "[]"
        );
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function savePlayerDevelopmentHistory(history) {
    localStorage.setItem(
        DEVELOPMENT_HISTORY_KEY,
        JSON.stringify((history || []).slice(0, 100))
    );
}

/* ==========================
   CAREER PAGE RENDERING
========================== */

function renderCareerSystems() {
    renderCareerSettings();
    renderAutomaticTransferSuggestions();
    renderPlayerDevelopmentReview();
    renderPlayerDevelopmentHistory();
}

function renderCareerSettings() {
    const settings = getCareerSettings();

    setCareerInputValue(
        "careerAutoGenerateTransfers",
        settings.autoGenerateTransfers,
        true
    );
    setCareerInputValue(
        "careerTransferSuggestionCount",
        settings.transferSuggestionCount
    );
    setCareerInputValue(
        "careerDevelopmentEnabled",
        settings.developmentEnabled,
        true
    );
    setCareerInputValue(
        "careerDevelopmentTiming",
        settings.developmentTiming
    );
    setCareerInputValue(
        "careerDevelopmentVolatility",
        settings.developmentVolatility
    );
    setCareerInputValue(
        "careerDevelopmentMaxChange",
        settings.developmentMaxChange
    );
    setCareerInputValue(
        "careerDevelopmentAutoApply",
        settings.developmentAutoApply,
        true
    );
}

function setCareerInputValue(id, value, checkbox = false) {
    const input = document.getElementById(id);
    if (!input) return;

    if (checkbox) {
        input.checked = Boolean(value);
    } else {
        input.value = String(value);
    }
}

function saveCareerSettingsFromForm() {
    const settings = {
        autoGenerateTransfers:
            document.getElementById("careerAutoGenerateTransfers")?.checked !== false,
        transferSuggestionCount: Math.max(
            1,
            Math.min(
                12,
                Number(
                    document.getElementById("careerTransferSuggestionCount")?.value || 6
                )
            )
        ),
        developmentEnabled:
            document.getElementById("careerDevelopmentEnabled")?.checked !== false,
        developmentTiming:
            document.getElementById("careerDevelopmentTiming")?.value || "afterSplit",
        developmentVolatility:
            document.getElementById("careerDevelopmentVolatility")?.value || "balanced",
        developmentMaxChange: Math.max(
            1,
            Math.min(
                4,
                Number(
                    document.getElementById("careerDevelopmentMaxChange")?.value || 2
                )
            )
        ),
        developmentAutoApply:
            Boolean(document.getElementById("careerDevelopmentAutoApply")?.checked)
    };

    saveCareerSettings(settings);
    renderCareerSystems();
    alert("Career system settings saved.");
}

/* ==========================
   AUTOMATED TRANSFER MARKET
========================== */

function generateAutomaticTransferSuggestions(options = {}) {
    const silent = Boolean(options.silent);
    const settings = getCareerSettings();

    if (
        typeof teams === "undefined" ||
        !Array.isArray(teams) ||
        teams.length < 2
    ) {
        if (!silent) alert("Create at least two teams first.");
        return [];
    }

    if (
        typeof tournament !== "undefined" &&
        tournament.running
    ) {
        if (!silent) alert("Transfer suggestions cannot be generated during an event.");
        return [];
    }

    const suggestionCount = Math.max(
        1,
        Number(options.count || settings.transferSuggestionCount || 6)
    );
    const period = getCareerPeriodLabel();
    const existing = getTransferSuggestions().filter(item =>
        item.status === "pending"
    );
    const suggestions = [];
    const usedPairs = new Set();
    const usedPlayers = new Set();
    const freeAgents = typeof getFreeAgents === "function"
        ? getFreeAgents()
        : [];

    const rankedTeams = [...teams].sort((a, b) =>
        getTeamTransferNeedScore(b) - getTeamTransferNeedScore(a)
    );

    /* Higher-rated free agents replacing a weak roster slot. */
    rankedTeams.forEach(team => {
        if (suggestions.length >= suggestionCount) return;
        if (!Array.isArray(team.players) || team.players.length === 0) return;

        const weakest = [...team.players].sort((a, b) =>
            Number(a.rating || 0) - Number(b.rating || 0)
        )[0];
        const candidate = [...freeAgents]
            .filter(player =>
                Number(player.rating || 0) >= Number(weakest.rating || 0) + 2
            )
            .sort((a, b) =>
                Number(b.rating || 0) - Number(a.rating || 0)
            )[0];

        if (!candidate || usedPlayers.has(String(candidate.id))) return;

        const key = `fa:${candidate.id}:${team.id}:${weakest.id}`;
        if (usedPairs.has(key)) return;
        usedPairs.add(key);
        usedPlayers.add(String(candidate.id));
        usedPlayers.add(String(weakest.id));

        suggestions.push({
            id: createCareerId("suggestion"),
            type: "freeAgentSigning",
            status: "pending",
            createdAt: new Date().toISOString(),
            period,
            teamId: team.id,
            teamName: team.name,
            incomingPlayerId: candidate.id,
            incomingPlayerName: candidate.name,
            incomingRating: Number(candidate.rating || 0),
            outgoingPlayerId: weakest.id,
            outgoingPlayerName: weakest.name,
            outgoingRating: Number(weakest.rating || 0),
            projectedRating: calculateProjectedTeamRating(
                team,
                weakest.id,
                candidate
            ),
            reason: buildFreeAgentSuggestionReason(
                team,
                weakest,
                candidate
            )
        });
    });

    /* Region-locked player trades */
const regions = [...new Set(rankedTeams.map(team => team.region).filter(Boolean))];

for (const region of regions) {

    const regionalTeams = rankedTeams.filter(
        team => team.region === region
    );

    const usedTeams = new Set();

    for (const teamA of regionalTeams) {

        if (suggestions.length >= suggestionCount) break;

        if (usedTeams.has(teamA.id)) continue;

        let bestTrade = null;
        let bestTeam = null;

        for (const teamB of regionalTeams) {

            if (teamA.id === teamB.id) continue;
            if (usedTeams.has(teamB.id)) continue;

            const pair = findBalancedTradePair(teamA, teamB);

            if (!pair) continue;

            if (
                usedPlayers.has(String(pair.playerA.id)) ||
                usedPlayers.has(String(pair.playerB.id))
            ) {
                continue;
            }

            if (!bestTrade || pair.value < bestTrade.value) {
                bestTrade = pair;
                bestTeam = teamB;
            }
        }

        if (!bestTrade || !bestTeam) continue;

        usedTeams.add(teamA.id);
        usedTeams.add(bestTeam.id);

        usedPlayers.add(String(bestTrade.playerA.id));
        usedPlayers.add(String(bestTrade.playerB.id));

        suggestions.push({
            id: createCareerId("suggestion"),
            type: "trade",
            status: "pending",
            createdAt: new Date().toISOString(),
            period,

            teamAId: teamA.id,
            teamAName: teamA.name,

            playerAId: bestTrade.playerA.id,
            playerAName: bestTrade.playerA.name,
            playerARating: Number(bestTrade.playerA.rating || 0),

            teamBId: bestTeam.id,
            teamBName: bestTeam.name,

            playerBId: bestTrade.playerB.id,
            playerBName: bestTrade.playerB.name,
            playerBRating: Number(bestTrade.playerB.rating || 0),

            projectedTeamARating:
                calculateProjectedTeamRating(
                    teamA,
                    bestTrade.playerA.id,
                    bestTrade.playerB
                ),

            projectedTeamBRating:
                calculateProjectedTeamRating(
                    bestTeam,
                    bestTrade.playerB.id,
                    bestTrade.playerA
                ),

            reason: buildTradeSuggestionReason(
                teamA,
                bestTeam
            )
        });
    }
}
function getTeamTransferNeedScore(team) {
    const formState = readCareerJson("rlcsTeamFormStateV1", {});
    const recent = formState?.[String(team.id)]?.recentEvents || [];
    const recentAverage = recent.length
        ? recent.reduce((sum, event) =>
            sum + Number(event.score || 0), 0
        ) / recent.length
        : 0;
    const points = getCareerTeamPoints(team.id);
    const rating = Number(team.rating || 0);

    return (
        Math.max(0, -recentAverage) * 8 +
        Math.max(0, 90 - rating) * 0.2 +
        Math.max(0, 25 - points) * 0.08
    );
}

function getCareerTeamPoints(teamId) {
    const league = typeof getLeagueState === "function"
        ? getLeagueState()
        : readCareerJson("rlcsLeaguePoints", { teams: {} });
    const entry = league?.teams?.[String(teamId)] || {};

    return Number(
        entry.totalPoints ??
        entry.points ??
        0
    );
}

function findBalancedTradePair(teamA, teamB) {
    const playersA = Array.isArray(teamA.players) ? teamA.players : [];
    const playersB = Array.isArray(teamB.players) ? teamB.players : [];
    let best = null;

    playersA.forEach(playerA => {
        playersB.forEach(playerB => {
            const gap = Math.abs(
                Number(playerA.rating || 0) -
                Number(playerB.rating || 0)
            );

            if (gap > 4) return;

            const value = gap +
                Math.abs(
                    Number(teamA.rating || 0) -
                    Number(teamB.rating || 0)
                ) * 0.05;

            if (!best || value < best.value) {
                best = {
                    playerA,
                    playerB,
                    value
                };
            }
        });
    });

    return best;
}

function calculateProjectedTeamRating(team, outgoingPlayerId, incomingPlayer) {
    const projectedPlayers = (team.players || []).map(player =>
        String(player.id) === String(outgoingPlayerId)
            ? incomingPlayer
            : player
    );

    if (!projectedPlayers.length) return 0;

    return Math.round(
        projectedPlayers.reduce((sum, player) =>
            sum + Number(player.rating || 0), 0
        ) / projectedPlayers.length
    );
}

function buildFreeAgentSuggestionReason(team, outgoing, incoming) {
    const form = getCareerTeamFormLabel(team);
    const improvement =
        Number(incoming.rating || 0) -
        Number(outgoing.rating || 0);

    return `${team.name} is ${form}. Replacing ${outgoing.name} with ${incoming.name} adds ${improvement} player rating points.`;
}

function buildTradeSuggestionReason(teamA, teamB) {
    return `${teamA.name} and ${teamB.name} are being offered a similar-rated roster shake-up based on recent results.`;
}

function getCareerTeamFormLabel(team) {
    const formState = readCareerJson("rlcsTeamFormStateV1", {});
    const recent = formState?.[String(team.id)]?.recentEvents || [];
    const average = recent.length
        ? recent.reduce((sum, event) =>
            sum + Number(event.score || 0), 0
        ) / recent.length
        : 0;

    if (average <= -1.25) return "in poor form";
    if (average < 0) return "slightly underperforming";
    if (average >= 1.5) return "in strong form";
    return "performing around expectations";
}

function renderAutomaticTransferSuggestions() {
    const container = document.getElementById("automaticTransferSuggestionList");
    if (!container) return;

    const suggestions = getTransferSuggestions()
        .filter(item => item.status === "pending");

    if (!suggestions.length) {
        container.innerHTML = `
            <div class="career-empty-state">
                <strong>No pending suggestions</strong>
                <span>Generate a transfer window to receive performance-based roster ideas.</span>
            </div>
        `;
        return;
    }

    container.innerHTML = suggestions.map(suggestion =>
        renderTransferSuggestionCard(suggestion)
    ).join("");
}

function renderTransferSuggestionCard(suggestion) {
    const isTrade = suggestion.type === "trade";

    return `
        <article class="career-suggestion-card">
            <div class="career-suggestion-badge">
                ${isTrade ? "PLAYER TRADE" : "FREE-AGENT SIGNING"}
            </div>

            <h4>
                ${isTrade
                    ? `${escapeCareerText(suggestion.playerAName)} ↔ ${escapeCareerText(suggestion.playerBName)}`
                    : `${escapeCareerText(suggestion.incomingPlayerName)} → ${escapeCareerText(suggestion.teamName)}`}
            </h4>

            <p>${escapeCareerText(suggestion.reason || "Roster change suggested.")}</p>

            <div class="career-suggestion-projections">
                ${isTrade
                    ? `
                        <span>${escapeCareerText(suggestion.teamAName)}: ${suggestion.projectedTeamARating}</span>
                        <span>${escapeCareerText(suggestion.teamBName)}: ${suggestion.projectedTeamBRating}</span>
                    `
                    : `
                        <span>Outgoing: ${escapeCareerText(suggestion.outgoingPlayerName)} (${suggestion.outgoingRating})</span>
                        <span>Projected team rating: ${suggestion.projectedRating}</span>
                    `}
            </div>

            <div class="career-suggestion-actions">
                <button type="button"
                    class="primary-button"
                    onclick="approveTransferSuggestion('${escapeCareerAttribute(suggestion.id)}')">
                    Approve
                </button>
                <button type="button"
                    class="secondary-button"
                    onclick="rejectTransferSuggestion('${escapeCareerAttribute(suggestion.id)}')">
                    Reject
                </button>
            </div>
        </article>
    `;
}

function approveTransferSuggestion(suggestionId) {
    if (typeof canPerformTransfer === "function" && !canPerformTransfer()) {
        return;
    }

    const suggestions = getTransferSuggestions();
    const suggestion = suggestions.find(item =>
        String(item.id) === String(suggestionId)
    );

    if (!suggestion || suggestion.status !== "pending") return;

    const completed = suggestion.type === "trade"
        ? applySuggestedTrade(suggestion)
        : applySuggestedFreeAgentSigning(suggestion);

    if (!completed) {
        alert("The suggested transaction is no longer valid. Regenerate suggestions.");
        return;
    }

    suggestion.status = "approved";
    suggestion.resolvedAt = new Date().toISOString();
    saveTransferSuggestions(suggestions);
    refreshCareerViews();
}

function applySuggestedTrade(suggestion) {
    const teamA = getCareerTeam(suggestion.teamAId);
    const teamB = getCareerTeam(suggestion.teamBId);
    const playerAIndex = teamA?.players?.findIndex(player =>
        String(player.id) === String(suggestion.playerAId)
    );
    const playerBIndex = teamB?.players?.findIndex(player =>
        String(player.id) === String(suggestion.playerBId)
    );

    if (
        !teamA ||
        !teamB ||
        playerAIndex < 0 ||
        playerBIndex < 0
    ) {
        return false;
    }

    const playerA = { ...teamA.players[playerAIndex] };
    const playerB = { ...teamB.players[playerBIndex] };

    teamA.players[playerAIndex] = playerB;
    teamB.players[playerBIndex] = playerA;

    recalculateCareerTeamRating(teamA);
    recalculateCareerTeamRating(teamB);
    resetCareerTeamAfterRosterChange(teamA, "Approved automated trade suggestion");
    resetCareerTeamAfterRosterChange(teamB, "Approved automated trade suggestion");
    saveCareerTeams();

    if (typeof addTransferRecord === "function") {
        addTransferRecord({
            type: "automatedTrade",
            teamIds: [teamA.id, teamB.id],
            playerIds: [playerA.id, playerB.id],
            summary: `${teamA.name} traded ${playerA.name} to ${teamB.name} for ${playerB.name}.`
        });
    }

    return true;
}

function applySuggestedFreeAgentSigning(suggestion) {
    const team = getCareerTeam(suggestion.teamId);
    const freeAgents = typeof getFreeAgents === "function"
        ? getFreeAgents()
        : [];
    const incomingIndex = freeAgents.findIndex(player =>
        String(player.id) === String(suggestion.incomingPlayerId)
    );
    const outgoingIndex = team?.players?.findIndex(player =>
        String(player.id) === String(suggestion.outgoingPlayerId)
    );

    if (!team || incomingIndex < 0 || outgoingIndex < 0) {
        return false;
    }

    const incoming = { ...freeAgents[incomingIndex] };
    const outgoing = { ...team.players[outgoingIndex] };

    team.players[outgoingIndex] = {
        id: incoming.id,
        name: incoming.name,
        rating: incoming.rating
    };

    freeAgents.splice(incomingIndex, 1);
    freeAgents.push({
        ...outgoing,
        previousTeamId: team.id,
        previousTeamName: team.name,
        releasedAt: new Date().toISOString()
    });

    recalculateCareerTeamRating(team);
    resetCareerTeamAfterRosterChange(team, "Approved automated free-agent suggestion");
    saveCareerTeams();

    if (typeof saveFreeAgents === "function") {
        saveFreeAgents(freeAgents);
    }

    if (typeof addTransferRecord === "function") {
        addTransferRecord({
            type: "automatedFreeAgentSigning",
            teamIds: [team.id],
            playerIds: [incoming.id, outgoing.id],
            summary: `${team.name} signed ${incoming.name} and released ${outgoing.name}.`
        });
    }

    return true;
}

function rejectTransferSuggestion(suggestionId) {
    const suggestions = getTransferSuggestions();
    const suggestion = suggestions.find(item =>
        String(item.id) === String(suggestionId)
    );

    if (!suggestion) return;

    suggestion.status = "rejected";
    suggestion.resolvedAt = new Date().toISOString();
    saveTransferSuggestions(suggestions);
    renderAutomaticTransferSuggestions();
}

function clearTransferSuggestions() {
    if (!confirm("Clear every pending automated transfer suggestion?")) {
        return;
    }

    saveTransferSuggestions(
        getTransferSuggestions().filter(item =>
            item.status !== "pending"
        )
    );
    renderAutomaticTransferSuggestions();
}

/* ==========================
   PLAYER DEVELOPMENT
========================== */

function createPlayerDevelopmentReview(options = {}) {
    const settings = getCareerSettings();
    const silent = Boolean(options.silent);

    if (!settings.developmentEnabled) {
        if (!silent) alert("Player development is disabled.");
        return null;
    }

    if (typeof teams === "undefined" || !Array.isArray(teams) || !teams.length) {
        if (!silent) alert("Create teams before running development.");
        return null;
    }

    const period = options.period || getCareerPeriodLabel();
    const reviewKey = options.reviewKey || createCareerReviewKey(period);
    const history = getPlayerDevelopmentHistory();

    if (
        options.preventDuplicate !== false &&
        history.some(item => item.reviewKey === reviewKey)
    ) {
        return null;
    }

    const existingPending = getPendingDevelopmentReview();
    if (
        existingPending &&
        existingPending.status === "pending" &&
        existingPending.reviewKey === reviewKey
    ) {
        renderPlayerDevelopmentReview();
        return existingPending;
    }

    const changes = [];

    teams.forEach(team => {
        const teamPerformance = getTeamDevelopmentPerformance(team);

        (team.players || []).forEach(player => {
            const adjustment = calculatePlayerDevelopmentAdjustment(
                player,
                team,
                teamPerformance,
                settings,
                reviewKey
            );

            changes.push({
                teamId: team.id,
                teamName: team.name,
                playerId: player.id,
                playerName: player.name,
                oldRating: Number(player.rating || 50),
                adjustment,
                newRating: clampCareerRating(
                    Number(player.rating || 50) + adjustment
                ),
                performance: roundCareerNumber(teamPerformance),
                reason: getDevelopmentReason(adjustment, teamPerformance)
            });
        });
    });

    const review = {
        id: createCareerId("development"),
        reviewKey,
        status: "pending",
        trigger: options.trigger || "manual",
        period,
        createdAt: new Date().toISOString(),
        settings: {
            volatility: settings.developmentVolatility,
            maxChange: settings.developmentMaxChange
        },
        changes
    };

    savePendingDevelopmentReview(review);
    renderPlayerDevelopmentReview();

    if (settings.developmentAutoApply || options.autoApply) {
        applyPlayerDevelopmentReview(true);
    } else if (!silent) {
        alert("Player development review generated. Review the changes before applying them.");
    }

    return review;
}

function getTeamDevelopmentPerformance(team) {
    const formState = readCareerJson("rlcsTeamFormStateV1", {});
    const recent = formState?.[String(team.id)]?.recentEvents || [];

    if (!recent.length) return 0;

    const weights = [0.55, 0.30, 0.15];
    let weighted = 0;
    let totalWeight = 0;

    recent.slice(0, 3).forEach((event, index) => {
        const weight = weights[index] || 0;
        weighted += Number(event.score || 0) * weight;
        totalWeight += weight;
    });

    return totalWeight ? weighted / totalWeight : 0;
}

function calculatePlayerDevelopmentAdjustment(
    player,
    team,
    teamPerformance,
    settings,
    reviewKey
) {
    const volatilityValues = {
        conservative: 0.35,
        balanced: 0.65,
        dynamic: 1
    };
    const volatility = volatilityValues[
        settings.developmentVolatility
    ] ?? 0.65;
    const rating = Number(player.rating || 50);
    const growthPotential = Math.max(
        -0.30,
        Math.min(0.55, (82 - rating) / 45)
    );
    const deterministicNoise =
        (seededCareerRandom(`${reviewKey}:${player.id}:${team.id}`) - 0.5) *
        2 * volatility;
    const raw =
        Number(teamPerformance || 0) * 0.34 +
        growthPotential +
        deterministicNoise;
    const maximum = Math.max(1, Number(settings.developmentMaxChange || 2));

    let adjustment = Math.round(raw);
    adjustment = Math.max(-maximum, Math.min(maximum, adjustment));

    if (rating >= 96 && adjustment > 0) adjustment = 0;
    if (rating <= 35 && adjustment < 0) adjustment = 0;

    return adjustment;
}

function getDevelopmentReason(adjustment, performance) {
    if (adjustment >= 2) return "Breakout development after strong recent results";
    if (adjustment === 1) return "Positive progress from recent performances";
    if (adjustment <= -2) return "Major rating review after poor recent results";
    if (adjustment === -1) return "Small regression after recent performances";
    if (performance > 1) return "Strong team results, rating held steady";
    if (performance < -1) return "Poor team results, rating held steady";
    return "No meaningful rating change";
}

function renderPlayerDevelopmentReview() {
    const container = document.getElementById("playerDevelopmentReview");
    if (!container) return;

    const review = getPendingDevelopmentReview();

    if (!review || review.status !== "pending") {
        container.innerHTML = `
            <div class="career-empty-state">
                <strong>No pending development review</strong>
                <span>Run a review manually or wait for the configured split/season trigger.</span>
            </div>
        `;
        return;
    }

    const changed = (review.changes || []).filter(item =>
        Number(item.adjustment || 0) !== 0
    );

    container.innerHTML = `
        <div class="development-review-header">
            <div>
                <span>${escapeCareerText(review.period)}</span>
                <h4>Player Development Preview</h4>
                <p>${changed.length} of ${(review.changes || []).length} players will change rating.</p>
            </div>
            <div class="development-review-actions">
                <button type="button"
                    class="primary-button"
                    onclick="applyPlayerDevelopmentReview()">
                    Apply Changes
                </button>
                <button type="button"
                    class="secondary-button"
                    onclick="discardPlayerDevelopmentReview()">
                    Discard
                </button>
            </div>
        </div>

        <div class="development-change-list">
            ${(review.changes || []).map(item => `
                <div class="development-change-row ${getDevelopmentChangeClass(item.adjustment)}">
                    <div>
                        <strong>${escapeCareerText(item.playerName)}</strong>
                        <span>${escapeCareerText(item.teamName)} · ${escapeCareerText(item.reason)}</span>
                    </div>
                    <div class="development-rating-change">
                        <span>${item.oldRating}</span>
                        <b>→</b>
                        <strong>${item.newRating}</strong>
                        <em>${formatCareerAdjustment(item.adjustment)}</em>
                    </div>
                </div>
            `).join("")}
        </div>
    `;
}

function applyPlayerDevelopmentReview(silent = false) {
    const review = getPendingDevelopmentReview();
    if (!review || review.status !== "pending") return;

    if (
        !silent &&
        !confirm("Apply every rating change in this development review?")
    ) {
        return;
    }

    (review.changes || []).forEach(change => {
        const team = getCareerTeam(change.teamId);
        const player = team?.players?.find(item =>
            String(item.id) === String(change.playerId)
        );

        if (!player) return;
        player.rating = clampCareerRating(change.newRating);
    });

    (teams || []).forEach(recalculateCareerTeamRating);
    saveCareerTeams();

    review.status = "applied";
    review.appliedAt = new Date().toISOString();

    const history = getPlayerDevelopmentHistory();
    history.unshift(review);
    savePlayerDevelopmentHistory(history);
    savePendingDevelopmentReview(null);
    refreshCareerViews();

    if (!silent) {
        alert("Player development changes applied.");
    }
}

function discardPlayerDevelopmentReview() {
    if (!confirm("Discard the current development review?")) return;
    savePendingDevelopmentReview(null);
    renderPlayerDevelopmentReview();
}

function renderPlayerDevelopmentHistory() {
    const container = document.getElementById("playerDevelopmentHistory");
    if (!container) return;

    const history = getPlayerDevelopmentHistory().slice(0, 8);

    if (!history.length) {
        container.innerHTML = `<p class="small">No development reviews have been applied yet.</p>`;
        return;
    }

    container.innerHTML = history.map(review => {
        const increases = (review.changes || []).filter(item => item.adjustment > 0).length;
        const decreases = (review.changes || []).filter(item => item.adjustment < 0).length;

        return `
            <div class="development-history-row">
                <div>
                    <strong>${escapeCareerText(review.period)}</strong>
                    <span>${formatCareerDate(review.appliedAt || review.createdAt)}</span>
                </div>
                <span>${increases} improved · ${decreases} declined</span>
            </div>
        `;
    }).join("");
}

function getDevelopmentChangeClass(adjustment) {
    if (adjustment > 0) return "positive";
    if (adjustment < 0) return "negative";
    return "neutral";
}

/* ==========================
   AUTOMATIC POST-EVENT HOOK
========================== */

function handlePostEventCareerSystems(record) {
    const settings = getCareerSettings();
    const event = record?.event || {};
    const splitCompleted = isCareerSplitCompleted(event.split);
    const seasonCompleted = isCareerSeasonCompleted();
    let trigger = null;
    let period = null;
    let reviewKey = null;

    if (
        settings.developmentTiming === "afterSplit" &&
        splitCompleted &&
        event.split &&
        event.split !== "season"
    ) {
        trigger = "splitComplete";
        period = `Split ${event.split} Development`;
        reviewKey = `split:${getCareerSeasonId()}:${event.split}`;
    }

    if (
        settings.developmentTiming === "afterSeason" &&
        seasonCompleted
    ) {
        trigger = "seasonComplete";
        period = `${getCareerSeasonName()} Development`;
        reviewKey = `season:${getCareerSeasonId()}`;
    }

    if (trigger && settings.developmentEnabled) {
        createPlayerDevelopmentReview({
            silent: true,
            trigger,
            period,
            reviewKey,
            preventDuplicate: true,
            autoApply: settings.developmentAutoApply
        });
    }

    if (
        splitCompleted &&
        settings.autoGenerateTransfers &&
        typeof isTransferWindowOpen === "function" &&
        isTransferWindowOpen()
    ) {
        generateAutomaticTransferSuggestions({
            silent: true,
            count: settings.transferSuggestionCount
        });
    }
}

function isCareerSplitCompleted(split) {
    if (!split || split === "season") return false;

    const state = typeof getSeasonState === "function"
        ? getSeasonState()
        : readCareerJson("rlcsSeasonCalendar", null);
    const events = Array.isArray(state)
        ? state
        : state?.events || [];
    const relevant = events.filter(event =>
        String(event.split) === String(split) &&
        ["regional", "major"].includes(event.type)
    );

    return Boolean(
        relevant.length &&
        relevant.every(event => event.status === "completed")
    );
}

function isCareerSeasonCompleted() {
    const state = typeof getSeasonState === "function"
        ? getSeasonState()
        : readCareerJson("rlcsSeasonCalendar", null);
    const events = Array.isArray(state)
        ? state
        : state?.events || [];
    const worlds = events.filter(event =>
        event.type === "worlds"
    );

    return Boolean(
        worlds.length &&
        worlds.every(event => event.status === "completed")
    );
}

/* ==========================
   HELPERS
========================== */

function getCareerTeam(teamId) {
    return (typeof teams !== "undefined" ? teams : []).find(team =>
        String(team.id) === String(teamId)
    ) || null;
}

function recalculateCareerTeamRating(team) {
    if (typeof recalculateTeamRating === "function") {
        recalculateTeamRating(team);
        return;
    }

    if (!team?.players?.length) {
        team.rating = 0;
        return;
    }

    team.rating = Math.round(
        team.players.reduce((sum, player) =>
            sum + Number(player.rating || 0), 0
        ) / team.players.length
    );
}

function resetCareerTeamAfterRosterChange(team, reason) {
    if (typeof resetTeamFormAfterRosterChange === "function") {
        resetTeamFormAfterRosterChange(team, reason);
    } else if (typeof resetTeamChemistryAfterRosterChange === "function") {
        resetTeamChemistryAfterRosterChange(team, reason);
    }
}

function saveCareerTeams() {
    if (typeof saveTeams === "function") {
        saveTeams();
    } else {
        localStorage.setItem("rlcsTeams", JSON.stringify(teams || []));
    }
}

function refreshCareerViews() {
    if (typeof refreshTransferViews === "function") {
        refreshTransferViews();
    } else {
        if (typeof renderTransfers === "function") renderTransfers();
        if (typeof renderTeams === "function") renderTeams();
        if (typeof renderTeamProfiles === "function") renderTeamProfiles();
        if (typeof renderLeagueTable === "function") renderLeagueTable();
    }

    renderCareerSystems();
}

function getCareerPeriodLabel() {
    if (typeof getTransferPeriodLabel === "function") {
        return getTransferPeriodLabel();
    }

    return getCareerSeasonName();
}

function getCareerSeasonId() {
    const state = typeof getSeasonState === "function"
        ? getSeasonState()
        : readCareerJson("rlcsSeasonCalendar", null);

    return state?.id || "no-season";
}

function getCareerSeasonName() {
    const state = typeof getSeasonState === "function"
        ? getSeasonState()
        : readCareerJson("rlcsSeasonCalendar", null);

    return state?.name || "Current Season";
}

function createCareerReviewKey(period) {
    return `${getCareerSeasonId()}:${String(period || "manual").toLowerCase().replace(/\s+/g, "-")}`;
}

function createCareerId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function clampCareerRating(value) {
    return Math.max(1, Math.min(100, Math.round(Number(value || 50))));
}

function seededCareerRandom(seedText) {
    let hash = 2166136261;
    const text = String(seedText || "seed");

    for (let index = 0; index < text.length; index++) {
        hash ^= text.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }

    hash += hash << 13;
    hash ^= hash >>> 7;
    hash += hash << 3;
    hash ^= hash >>> 17;
    hash += hash << 5;

    return (hash >>> 0) / 4294967295;
}

function readCareerJson(key, fallback) {
    try {
        const parsed = JSON.parse(localStorage.getItem(key) || "null");
        return parsed ?? fallback;
    } catch {
        return fallback;
    }
}

function roundCareerNumber(value) {
    return Math.round(Number(value || 0) * 100) / 100;
}

function formatCareerAdjustment(value) {
    const number = Number(value || 0);
    return number > 0 ? `+${number}` : String(number);
}

function formatCareerDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
        ? String(value || "")
        : date.toLocaleDateString();
}

function escapeCareerText(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function escapeCareerAttribute(value) {
    return escapeCareerText(value).replace(/`/g, "&#096;");
}

window.getCareerSettings = getCareerSettings;
window.renderCareerSystems = renderCareerSystems;
window.saveCareerSettingsFromForm = saveCareerSettingsFromForm;
window.generateAutomaticTransferSuggestions = generateAutomaticTransferSuggestions;
window.approveTransferSuggestion = approveTransferSuggestion;
window.rejectTransferSuggestion = rejectTransferSuggestion;
window.clearTransferSuggestions = clearTransferSuggestions;
window.createPlayerDevelopmentReview = createPlayerDevelopmentReview;
window.applyPlayerDevelopmentReview = applyPlayerDevelopmentReview;
window.discardPlayerDevelopmentReview = discardPlayerDevelopmentReview;
window.getPlayerDevelopmentHistory = getPlayerDevelopmentHistory;
window.handlePostEventCareerSystems = handlePostEventCareerSystems;

window.addEventListener("load", () => {
    setTimeout(renderCareerSystems, 1300);
});
