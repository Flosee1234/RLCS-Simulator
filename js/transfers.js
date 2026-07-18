/* ==========================
   RLCS LEAGUE SIMULATOR
   TRANSFER SYSTEM V1
========================== */

const TRANSFER_HISTORY_KEY = "rlcsTransferHistory";
const FREE_AGENTS_KEY = "rlcsFreeAgents";
const TRANSFER_WINDOW_KEY = "rlcsTransferWindowOpen";

/* ==========================
   STORAGE
========================== */

function getTransferHistory() {
    try {
        return JSON.parse(
            localStorage.getItem(TRANSFER_HISTORY_KEY) || "[]"
        );
    } catch {
        return [];
    }
}

function saveTransferHistory(history) {
    localStorage.setItem(
        TRANSFER_HISTORY_KEY,
        JSON.stringify(history.slice(0, 250))
    );
}

function getFreeAgents() {
    try {
        return JSON.parse(
            localStorage.getItem(FREE_AGENTS_KEY) || "[]"
        );
    } catch {
        return [];
    }
}

function saveFreeAgents(freeAgents) {
    localStorage.setItem(
        FREE_AGENTS_KEY,
        JSON.stringify(freeAgents)
    );
}

function isTransferWindowOpen() {
    const saved = localStorage.getItem(
        TRANSFER_WINDOW_KEY
    );

    if (saved === null) {
        localStorage.setItem(
            TRANSFER_WINDOW_KEY,
            "true"
        );
        return true;
    }

    return saved === "true";
}

function setTransferWindowOpen(isOpen) {
    localStorage.setItem(
        TRANSFER_WINDOW_KEY,
        String(Boolean(isOpen))
    );

    renderTransfers();
}

function toggleTransferWindow() {
    setTransferWindowOpen(
        !isTransferWindowOpen()
    );
}

/* ==========================
   VALIDATION
========================== */

function canPerformTransfer() {
    if (!isTransferWindowOpen()) {
        alert("The transfer window is closed.");
        return false;
    }

    if (
        typeof tournament !== "undefined" &&
        tournament.running
    ) {
        alert("Transfers are locked while an event is running.");
        return false;
    }

    return true;
}

function getTransferTeamById(teamId) {
    if (
        typeof teams === "undefined" ||
        !Array.isArray(teams)
    ) {
        return null;
    }

    return teams.find(team =>
        String(team.id) === String(teamId)
    ) || null;
}

function getTransferPlayerById(team, playerId) {
    if (!team || !Array.isArray(team.players)) {
        return null;
    }

    return team.players.find(player =>
        String(player.id) === String(playerId)
    ) || null;
}

/* ==========================
   RENDER
========================== */

function renderTransfers() {
    if (typeof normaliseAllTeamRosters === "function") {
        const changed = normaliseAllTeamRosters();
        if (changed && typeof saveTeams === "function") {
            saveTeams();
        }
    }

    renderTransferWindowStatus();
    renderTradeTeamOptions();
    renderFreeAgentControls();
    renderFreeAgentPool();
    renderTransferHistory();

    if (typeof renderCareerSystems === "function") {
        renderCareerSystems();
    }
}

function renderTransferWindowStatus() {
    const container = document.getElementById(
        "transferWindowStatus"
    );

    if (!container) return;

    const isOpen = isTransferWindowOpen();
    const eventRunning = Boolean(
        typeof tournament !== "undefined" &&
        tournament.running
    );

    container.innerHTML = `
        <div class="transfer-window-card ${isOpen ? "transfer-window-open" : "transfer-window-closed"}">
            <div>
                <span>Transfer Window</span>
                <strong>${isOpen ? "Open" : "Closed"}</strong>
                <small>
                    ${eventRunning
                        ? "Transactions are temporarily locked because an event is running."
                        : `Current period: ${escapeTransferText(getTransferPeriodLabel())}`}
                </small>
            </div>

            <button class="primary-button"
                onclick="toggleTransferWindow()">
                ${isOpen ? "Close Window" : "Open Window"}
            </button>
        </div>
    `;
}

function renderTradeTeamOptions() {
    const sourceSelect = document.getElementById(
        "tradeSourceTeam"
    );
    const destinationSelect = document.getElementById(
        "tradeDestinationTeam"
    );

    if (!sourceSelect || !destinationSelect) return;

    const sourceValue = sourceSelect.value;
    const destinationValue = destinationSelect.value;

    const options = renderTransferTeamOptions();

    sourceSelect.innerHTML = options;
    destinationSelect.innerHTML = options;

    restoreSelectValue(sourceSelect, sourceValue);
    restoreSelectValue(destinationSelect, destinationValue);

    if (
        sourceSelect.value &&
        sourceSelect.value === destinationSelect.value
    ) {
        const alternative = Array.from(destinationSelect.options)
            .find(option =>
                option.value &&
                option.value !== sourceSelect.value
            );

        if (alternative) {
            destinationSelect.value = alternative.value;
        }
    }

    updateTradePlayerOptions();
}

function renderTransferTeamOptions() {
    const savedTeams = typeof teams !== "undefined" && Array.isArray(teams)
        ? teams
        : [];

    if (savedTeams.length === 0) {
        return `<option value="">No teams available</option>`;
    }

    return `
        <option value="">Select Team</option>
        ${savedTeams.map(team => `
            <option value="${team.id}">
                ${escapeTransferText(team.name)}
            </option>
        `).join("")}
    `;
}

function updateTradePlayerOptions() {
    renderPlayerSelectForTeam(
        "tradeSourceTeam",
        "tradeSourcePlayer"
    );

    renderPlayerSelectForTeam(
        "tradeDestinationTeam",
        "tradeDestinationPlayer"
    );
}

function renderPlayerSelectForTeam(teamSelectId, playerSelectId) {
    const teamId = document.getElementById(teamSelectId)?.value;
    const playerSelect = document.getElementById(playerSelectId);

    if (!playerSelect) return;

    const currentValue = playerSelect.value;
    const team = getTransferTeamById(teamId);

    if (!team || team.players.length === 0) {
        playerSelect.innerHTML = `
            <option value="">Select a team first</option>
        `;
        return;
    }

    playerSelect.innerHTML = `
        <option value="">Select Player</option>
        ${team.players.map(player => `
            <option value="${player.id}">
                ${escapeTransferText(player.name)} (${player.rating})
            </option>
        `).join("")}
    `;

    restoreSelectValue(playerSelect, currentValue);
}

function renderFreeAgentControls() {
    const teamSelect = document.getElementById(
        "freeAgentTeam"
    );
    const freeAgentSelect = document.getElementById(
        "freeAgentSelect"
    );

    if (teamSelect) {
        const current = teamSelect.value;
        teamSelect.innerHTML = renderTransferTeamOptions();
        restoreSelectValue(teamSelect, current);
    }

    if (freeAgentSelect) {
        const current = freeAgentSelect.value;
        const freeAgents = getFreeAgents();

        freeAgentSelect.innerHTML = freeAgents.length
            ? `
                <option value="">Select Free Agent</option>
                ${freeAgents.map(player => `
                    <option value="${player.id}">
                        ${escapeTransferText(player.name)} (${player.rating})
                    </option>
                `).join("")}
            `
            : `<option value="">No free agents available</option>`;

        restoreSelectValue(freeAgentSelect, current);
    }

    updateFreeAgentReplacementOptions();
}

function updateFreeAgentReplacementOptions() {
    renderPlayerSelectForTeam(
        "freeAgentTeam",
        "freeAgentReplacePlayer"
    );
}

function renderFreeAgentPool() {
    const container = document.getElementById(
        "freeAgentList"
    );

    if (!container) return;

    const freeAgents = getFreeAgents();

    if (freeAgents.length === 0) {
        container.innerHTML = `
            <p class="small">No free agents have been created or released.</p>
        `;
        return;
    }

    container.innerHTML = freeAgents.map(player => `
        <div class="free-agent-row">
            <div>
                <strong>${escapeTransferText(player.name)}</strong>
                <span>Rating ${player.rating}</span>
            </div>

            <span>
                ${player.previousTeamName
                    ? `Last Team: ${escapeTransferText(player.previousTeamName)}`
                    : "Unsigned"}
            </span>

            <button class="danger-button"
                onclick="deleteFreeAgent('${player.id}')">
                Remove
            </button>
        </div>
    `).join("");
}

function renderTransferHistory() {
    const container = document.getElementById(
        "transferHistoryList"
    );

    if (!container) return;

    const history = getTransferHistory();

    if (history.length === 0) {
        container.innerHTML = `
            <p class="small">No completed transfers yet.</p>
        `;
        return;
    }

    container.innerHTML = history.map(record => `
        <div class="transfer-history-row">
            <div class="transfer-history-icon">
                ${record.type === "trade" ? "⇄" : "＋"}
            </div>

            <div class="transfer-history-main">
                <strong>${escapeTransferText(record.summary)}</strong>
                <span>
                    ${escapeTransferText(record.period)}
                    |
                    ${escapeTransferText(record.date)}
                </span>
            </div>
        </div>
    `).join("");
}

/* ==========================
   PLAYER TRADE
========================== */

function executePlayerTrade() {
    if (!canPerformTransfer()) return;

    const sourceTeamId = document.getElementById(
        "tradeSourceTeam"
    )?.value;
    const sourcePlayerId = document.getElementById(
        "tradeSourcePlayer"
    )?.value;
    const destinationTeamId = document.getElementById(
        "tradeDestinationTeam"
    )?.value;
    const destinationPlayerId = document.getElementById(
        "tradeDestinationPlayer"
    )?.value;

    if (
        !sourceTeamId ||
        !sourcePlayerId ||
        !destinationTeamId ||
        !destinationPlayerId
    ) {
        alert("Select both teams and both players.");
        return;
    }

    if (String(sourceTeamId) === String(destinationTeamId)) {
        alert("Choose two different teams.");
        return;
    }

    const sourceTeam = getTransferTeamById(sourceTeamId);
    const destinationTeam = getTransferTeamById(destinationTeamId);
    const sourcePlayer = getTransferPlayerById(
        sourceTeam,
        sourcePlayerId
    );
    const destinationPlayer = getTransferPlayerById(
        destinationTeam,
        destinationPlayerId
    );

    if (
        !sourceTeam ||
        !destinationTeam ||
        !sourcePlayer ||
        !destinationPlayer
    ) {
        alert("One of the selected teams or players could not be found.");
        return;
    }

    const sourceIndex = sourceTeam.players.findIndex(player =>
        String(player.id) === String(sourcePlayer.id)
    );
    const destinationIndex = destinationTeam.players.findIndex(player =>
        String(player.id) === String(destinationPlayer.id)
    );

    sourceTeam.players[sourceIndex] = {
        ...destinationPlayer
    };

    destinationTeam.players[destinationIndex] = {
        ...sourcePlayer
    };

    recalculateTeamRatingSafe(sourceTeam);
    recalculateTeamRatingSafe(destinationTeam);

    if (
        typeof resetTeamFormAfterRosterChange ===
        "function"
    ) {
        resetTeamFormAfterRosterChange(
            sourceTeam,
            "Player trade completed"
        );
        resetTeamFormAfterRosterChange(
            destinationTeam,
            "Player trade completed"
        );
    }

    saveTeamsSafe();

    addTransferRecord({
        type: "trade",
        teamIds: [sourceTeam.id, destinationTeam.id],
        playerIds: [sourcePlayer.id, destinationPlayer.id],
        summary:
            `${sourceTeam.name} traded ${sourcePlayer.name} to ${destinationTeam.name} for ${destinationPlayer.name}.`
    });

    refreshTransferViews();

    alert("Player trade completed.");
}

/* ==========================
   FREE AGENTS
========================== */

function addFreeAgent() {
    if (!canPerformTransfer()) return;

    const nameInput = document.getElementById(
        "freeAgentName"
    );
    const ratingInput = document.getElementById(
        "freeAgentRating"
    );

    const name = nameInput?.value.trim() || "";
    const rating = Number(ratingInput?.value || 0);

    if (!name) {
        alert("Enter a free-agent name.");
        return;
    }

    if (!Number.isFinite(rating) || rating < 1 || rating > 100) {
        alert("Enter a rating from 1 to 100.");
        return;
    }

    const freeAgents = getFreeAgents();

    const duplicate = [
        ...freeAgents,
        ...(typeof teams !== "undefined"
            ? teams.flatMap(team => team.players || [])
            : [])
    ].some(player =>
        String(player.name).trim().toLowerCase() ===
        name.toLowerCase()
    );

    if (duplicate) {
        alert("A player with that name already exists.");
        return;
    }

    freeAgents.push({
        id: `free-agent-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        name,
        rating,
        createdAt: new Date().toISOString(),
        previousTeamId: null,
        previousTeamName: ""
    });

    saveFreeAgents(freeAgents);

    if (nameInput) nameInput.value = "";
    if (ratingInput) ratingInput.value = "";

    renderTransfers();
}

function signFreeAgent() {
    if (!canPerformTransfer()) return;

    const freeAgentId = document.getElementById(
        "freeAgentSelect"
    )?.value;
    const teamId = document.getElementById(
        "freeAgentTeam"
    )?.value;
    const replacePlayerId = document.getElementById(
        "freeAgentReplacePlayer"
    )?.value;

    if (!freeAgentId || !teamId || !replacePlayerId) {
        alert(
            "Select a free agent, a team, and the player being replaced."
        );
        return;
    }

    const freeAgents = getFreeAgents();
    const freeAgentIndex = freeAgents.findIndex(player =>
        String(player.id) === String(freeAgentId)
    );
    const team = getTransferTeamById(teamId);
    const replacedPlayer = getTransferPlayerById(
        team,
        replacePlayerId
    );

    if (
        freeAgentIndex === -1 ||
        !team ||
        !replacedPlayer
    ) {
        alert("The selected signing could not be completed.");
        return;
    }

    const freeAgent = freeAgents[freeAgentIndex];
    const rosterIndex = team.players.findIndex(player =>
        String(player.id) === String(replacedPlayer.id)
    );

    team.players[rosterIndex] = {
        id: freeAgent.id,
        name: freeAgent.name,
        rating: freeAgent.rating
    };

    freeAgents.splice(freeAgentIndex, 1);

    freeAgents.push({
        ...replacedPlayer,
        previousTeamId: team.id,
        previousTeamName: team.name,
        releasedAt: new Date().toISOString()
    });

    recalculateTeamRatingSafe(team);

    if (
        typeof resetTeamFormAfterRosterChange ===
        "function"
    ) {
        resetTeamFormAfterRosterChange(
            team,
            "Free-agent signing completed"
        );
    }

    saveTeamsSafe();
    saveFreeAgents(freeAgents);

    addTransferRecord({
        type: "freeAgentSigning",
        teamIds: [team.id],
        playerIds: [freeAgent.id, replacedPlayer.id],
        summary:
            `${team.name} signed ${freeAgent.name} and released ${replacedPlayer.name}.`
    });

    refreshTransferViews();

    alert("Free-agent signing completed.");
}

function deleteFreeAgent(playerId) {
    if (!canPerformTransfer()) return;

    const freeAgents = getFreeAgents();
    const player = freeAgents.find(item =>
        String(item.id) === String(playerId)
    );

    if (!player) return;

    if (!confirm(`Remove ${player.name} from the free-agent pool?`)) {
        return;
    }

    saveFreeAgents(
        freeAgents.filter(item =>
            String(item.id) !== String(playerId)
        )
    );

    renderTransfers();
}

/* ==========================
   TRANSACTION HISTORY
========================== */

function addTransferRecord(record) {
    const history = getTransferHistory();

    history.unshift({
        id: `transfer-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        date: new Date().toLocaleString(),
        completedAt: new Date().toISOString(),
        period: getTransferPeriodLabel(),
        ...record
    });

    saveTransferHistory(history);
}

function getTeamTransferHistory(teamId) {
    return getTransferHistory().filter(record =>
        (record.teamIds || []).some(id =>
            String(id) === String(teamId)
        )
    );
}

function clearTransferHistory() {
    if (!confirm("Clear all transfer history?")) {
        return;
    }

    localStorage.removeItem(TRANSFER_HISTORY_KEY);
    renderTransferHistory();
}

/* ==========================
   HELPERS
========================== */

function getTransferPeriodLabel() {
    if (typeof getSeasonCurrentSplit === "function") {
        return getSeasonCurrentSplit();
    }

    return "Off-season";
}

function recalculateTeamRatingSafe(team) {
    if (typeof recalculateTeamRating === "function") {
        recalculateTeamRating(team);
        return;
    }

    if (!team?.players?.length) {
        team.rating = 0;
        return;
    }

    team.rating = Math.round(
        team.players.reduce(
            (sum, player) => sum + Number(player.rating || 0),
            0
        ) / team.players.length
    );
}

function saveTeamsSafe() {
    if (typeof saveTeams === "function") {
        saveTeams();
        return;
    }

    localStorage.setItem(
        "rlcsTeams",
        JSON.stringify(teams || [])
    );
}

function refreshTransferViews() {
    if (typeof refreshTeamDependentViews === "function") {
        refreshTeamDependentViews();
    } else {
        if (typeof renderTeams === "function") renderTeams();
        if (typeof renderTeamProfiles === "function") renderTeamProfiles();
    }

    renderTransfers();
}

function restoreSelectValue(select, value) {
    if (
        value &&
        Array.from(select.options).some(option =>
            option.value === value
        )
    ) {
        select.value = value;
    }
}

function escapeTransferText(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/* ==========================
   EXPORTS + INIT
========================== */

window.renderTransfers = renderTransfers;
window.toggleTransferWindow = toggleTransferWindow;
window.updateTradePlayerOptions = updateTradePlayerOptions;
window.updateFreeAgentReplacementOptions = updateFreeAgentReplacementOptions;
window.executePlayerTrade = executePlayerTrade;
window.addFreeAgent = addFreeAgent;
window.signFreeAgent = signFreeAgent;
window.deleteFreeAgent = deleteFreeAgent;
window.getTeamTransferHistory = getTeamTransferHistory;
window.clearTransferHistory = clearTransferHistory;

window.addEventListener("load", () => {
    setTimeout(() => {
        renderTransfers();
    }, 1100);
});
