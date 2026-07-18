/* ==========================
   RLCS LEAGUE SIMULATOR
   SEASON ARCHIVES + ROLLOVER
========================== */

const SEASON_ARCHIVE_KEY = "rlcsSeasonArchivesV1";
const SEASON_ARCHIVE_LIMIT = 20;

let selectedSeasonArchiveId = null;

function getSeasonArchives() {
    try {
        const parsed = JSON.parse(
            localStorage.getItem(SEASON_ARCHIVE_KEY) || "[]"
        );

        return Array.isArray(parsed)
            ? parsed
            : [];
    } catch (error) {
        console.error("Failed to read season archives:", error);
        return [];
    }
}

function saveSeasonArchives(archives) {
    localStorage.setItem(
        SEASON_ARCHIVE_KEY,
        JSON.stringify(
            (Array.isArray(archives) ? archives : [])
                .slice(0, SEASON_ARCHIVE_LIMIT)
        )
    );
}

function getCurrentSeasonHistory(state) {
    let history = [];

    if (typeof getTournamentHistory === "function") {
        history = getTournamentHistory();
    } else {
        try {
            history = JSON.parse(
                localStorage.getItem("rlcsTournamentHistory") || "[]"
            );
        } catch {
            history = [];
        }
    }

    const eventIds = new Set(
        (state?.events || []).map(event => String(event.id))
    );

    return history.filter(record => {
        const seasonId = record.event?.seasonId;

        if (seasonId) {
            return String(seasonId) === String(state?.id);
        }

        const seasonEventId =
            record.event?.seasonEventId ||
            record.seasonEventId;

        return seasonEventId && eventIds.has(String(seasonEventId));
    });
}

function isCurrentSeasonComplete(state = null) {
    const season = state || (
        typeof getSeasonState === "function"
            ? getSeasonState()
            : null
    );

    if (!season) return false;

    const worlds = (season.events || []).find(event =>
        event.type === "worlds"
    );

    if (worlds?.status === "completed") {
        return true;
    }

    return (
        (season.events || []).length > 0 &&
        (season.events || []).every(event =>
            event.status === "completed"
        )
    );
}

function buildSeasonArchive(state) {
    const history = getCurrentSeasonHistory(state);
    const leagueState = typeof getLeagueState === "function"
        ? getLeagueState()
        : { teams: {} };
    const savedTeams = typeof teams !== "undefined" && Array.isArray(teams)
        ? teams
        : [];
    const transferHistory = typeof getTransferHistory === "function"
        ? getTransferHistory()
        : [];
    const developmentHistory = typeof getPlayerDevelopmentHistory === "function"
        ? getPlayerDevelopmentHistory()
        : [];

    const createdAtValue = new Date(state.createdAt || 0).getTime();
    const archivedAt = new Date().toISOString();
    const archivedAtValue = new Date(archivedAt).getTime();

    const standings = Object.values(leagueState.teams || {})
        .map(entry => ({
            teamId: entry.teamId,
            teamName: entry.teamName,
            region: entry.region || "Unknown",
            rating: Number(entry.rating || 0),
            totalPoints: Number(entry.totalPoints || 0),
            regionalPoints: Number(entry.regionalPoints || 0),
            majorPoints: Number(entry.lanPoints || 0),
            worldsPoints: Number(entry.worldsPoints || 0),
            eventWins: Number(entry.eventWins || 0),
            eventsPlayed: Number(entry.eventsPlayed || 0),
            bestPlacement: entry.bestPlacement === null
                ? null
                : Number(entry.bestPlacement)
        }))
        .sort((a, b) =>
            b.totalPoints - a.totalPoints ||
            b.eventWins - a.eventWins ||
            Number(a.bestPlacement || 999) - Number(b.bestPlacement || 999) ||
            b.rating - a.rating ||
            a.teamName.localeCompare(b.teamName)
        )
        .map((entry, index) => ({
            ...entry,
            rank: index + 1
        }));

    const eventSummaries = (state.events || [])
        .slice()
        .sort((a, b) => Number(a.order) - Number(b.order))
        .map(event => ({
            id: event.id,
            order: Number(event.order || 0),
            name: event.name,
            type: event.type,
            region: event.region,
            split: String(event.split || "1"),
            splitEventNumber: String(event.splitEventNumber || ""),
            format: event.format,
            status: event.status,
            champion: event.champion || null,
            historyRecordId: event.historyRecordId || null,
            completedAt: event.completedAt || null,
            qualifiedTeamIds: (event.qualifiedTeamIds || []).map(String)
        }));

    const historySummaries = history.map(record => ({
        id: record.id,
        eventRunId: record.eventRunId || null,
        name: record.event?.name || "Event",
        type: record.event?.type || "custom",
        region: record.event?.region || "GLOBAL",
        split: String(record.event?.split || "1"),
        completedAt: record.completedAt || record.date || null,
        champion: record.champion || "Unknown",
        placements: (record.placements || []).map(item => ({
            placement: Number(item.placement || 0),
            teamId: item.teamId,
            teamName: item.teamName,
            region: item.region || "Unknown"
        })),
        pointsAwarded: (record.pointsAwarded || []).map(item => ({
            teamId: item.teamId,
            teamName: item.teamName,
            placement: Number(item.placement || 0),
            points: Number(item.points || 0)
        })),
        topScorer: record.topScorer || null,
        topMVP: record.topMVP || null,
        topSaves: record.topSaves || null
    }));

    const relevantTransfers = transferHistory.filter(record => {
        const value = new Date(record.completedAt || record.date || 0).getTime();
        return (
            Number.isFinite(value) &&
            value >= createdAtValue &&
            value <= archivedAtValue
        );
    }).map(record => ({
        id: record.id,
        type: record.type,
        completedAt: record.completedAt || null,
        period: record.period || "",
        summary: record.summary || "",
        teamIds: (record.teamIds || []).map(String),
        playerIds: (record.playerIds || []).map(String)
    }));

    const relevantDevelopment = developmentHistory.filter(review => {
        const value = new Date(
            review.appliedAt || review.createdAt || 0
        ).getTime();

        return (
            Number.isFinite(value) &&
            value >= createdAtValue &&
            value <= archivedAtValue
        );
    }).map(review => ({
        id: review.id,
        reviewKey: review.reviewKey || null,
        trigger: review.trigger || "manual",
        period: review.period || "",
        createdAt: review.createdAt || null,
        appliedAt: review.appliedAt || null,
        changes: (review.changes || []).map(change => ({
            teamId: change.teamId,
            teamName: change.teamName,
            playerId: change.playerId,
            playerName: change.playerName,
            oldRating: Number(change.oldRating || 0),
            adjustment: Number(change.adjustment || 0),
            newRating: Number(change.newRating || 0)
        }))
    }));

    const worldsEvent = eventSummaries.find(event =>
        event.type === "worlds"
    );
    const majorEvents = eventSummaries.filter(event =>
        event.type === "major"
    );
    const lcqEvents = eventSummaries.filter(event =>
        event.type === "lcq"
    );
    const playInEvent = eventSummaries.find(event =>
        event.type === "playin"
    );

    const mainQualifiers = typeof getWorldsMainEventQualifiers === "function"
        ? getWorldsMainEventQualifiers(state).map(item => ({
            teamId: item.teamId,
            teamName: item.teamName,
            region: item.region,
            qualificationType: item.qualificationType
        }))
        : [];

    const regionPerformance = typeof rankRegionsByMajorPerformance === "function"
        ? rankRegionsByMajorPerformance(state).map(item => ({
            rank: item.rank,
            region: item.region,
            majorPoints: Number(item.majorPoints || 0),
            majorWins: Number(item.majorWins || 0),
            bestMajorPlacement: Number(item.bestMajorPlacement || 999)
        }))
        : [];

    return {
        id: `season-archive-${state.id}`,
        seasonId: state.id,
        name: state.name,
        createdAt: state.createdAt,
        completedAt: worldsEvent?.completedAt || archivedAt,
        archivedAt,
        status: isCurrentSeasonComplete(state)
            ? "completed"
            : "archived-early",
        splitCount: Number(state.splitCount || 1),
        regionalsPerSplit: Number(state.regionalsPerSplit || 3),
        regions: [...(state.regions || [])],
        rules: state.rules
            ? JSON.parse(JSON.stringify(state.rules))
            : (typeof getCompetitionRules === "function"
                ? getCompetitionRules()
                : null),
        eventCount: eventSummaries.length,
        completedEventCount: eventSummaries.filter(event =>
            event.status === "completed"
        ).length,
        worldsChampion: worldsEvent?.champion || "Not completed",
        majorChampions: majorEvents.map(event => ({
            split: event.split,
            name: event.name,
            champion: event.champion || "Unknown"
        })),
        lcqWinners: lcqEvents.map(event => ({
            region: event.region,
            champion: event.champion || "Unknown"
        })),
        playInQualifiers: (playInEvent?.qualifiedTeamIds || []).map(String),
        mainEventQualifiers: mainQualifiers,
        standings,
        events: eventSummaries,
        history: historySummaries,
        transfers: relevantTransfers,
        playerDevelopment: relevantDevelopment,
        regionPerformance,
        teamSnapshot: savedTeams.map(team => ({
            id: team.id,
            name: team.name,
            region: team.region,
            rating: Number(team.rating || 0),
            players: (team.players || []).map(player => ({
                id: player.id || null,
                name: player.name,
                rating: Number(player.rating || 0)
            }))
        }))
    };
}

async function archiveCurrentSeason(force = false) {
    const state = typeof getSeasonState === "function"
        ? getSeasonState()
        : null;

    if (!state) {
        setSeasonArchiveStatus("There is no active season to archive.", true);
        return null;
    }

    const complete = isCurrentSeasonComplete(state);

    if (!complete && !force) {
        const confirmed = confirm(
            "The current season is not complete. Archive its current state anyway?"
        );

        if (!confirmed) return null;
    }

    if (
        typeof createRestorePoint === "function"
    ) {
        try {
            await createRestorePoint(
                `Before archiving ${state.name}`,
                true
            );
        } catch (error) {
            console.warn("Restore point could not be created:", error);
        }
    }

    const archive = buildSeasonArchive(state);
    const archives = getSeasonArchives();
    const existingIndex = archives.findIndex(item =>
        String(item.seasonId) === String(state.id)
    );

    if (existingIndex >= 0) {
        archives.splice(existingIndex, 1);
    }

    archives.unshift(archive);
    saveSeasonArchives(archives);

    state.status = complete
        ? "completed"
        : "archived-early";
    state.archivedAt = archive.archivedAt;

    if (typeof saveSeasonState === "function") {
        saveSeasonState(state);
    }

    selectedSeasonArchiveId = archive.id;
    renderSeasonArchiveHub();
    renderSeasonManagementSummary();

    setSeasonArchiveStatus(
        `${state.name} was archived successfully.`,
        false
    );

    return archive;
}

async function completeSeasonAndArchive() {
    const state = typeof getSeasonState === "function"
        ? getSeasonState()
        : null;

    if (!state) {
        setSeasonArchiveStatus("Create a season first.", true);
        return;
    }

    if (!isCurrentSeasonComplete(state)) {
        setSeasonArchiveStatus(
            "The World Championship must be completed before finishing the season.",
            true
        );
        return;
    }

    await archiveCurrentSeason(false);
}

async function startNewSeasonRollover() {
    const currentState = typeof getSeasonState === "function"
        ? getSeasonState()
        : null;

    if (currentState) {
        const archived = await archiveCurrentSeason(false);
        if (!archived) return;
    }

    const confirmed = confirm(
        "Start a new season? Current points and team form will reset. Teams, players, event history, transfers, free agents, save slots, and archived seasons will remain."
    );

    if (!confirmed) return;

    if (typeof createRestorePoint === "function") {
        try {
            await createRestorePoint(
                "Before new season rollover",
                true
            );
        } catch (error) {
            console.warn("Restore point could not be created:", error);
        }
    }

    localStorage.removeItem("rlcsLeaguePoints");
    localStorage.removeItem("rlcsTeamFormStateV1");
    localStorage.removeItem("rlcsCurrentSeasonEventId");
    localStorage.removeItem("rlcsSeasonCalendar");

    if (typeof tournament !== "undefined") {
        tournament.running = false;
        tournament.savedToHistory = false;
        tournament.currentEvent = null;
        tournament.currentSeasonEventId = null;
        tournament.participants = [];
        tournament.matches = [];
        tournament.results = [];
        tournament.champion = null;
    }

    const nameInput = document.getElementById("seasonName");
    if (nameInput) {
        nameInput.value = getSuggestedNextSeasonName(
            currentState?.name || "Season 1"
        );
    }

    if (typeof createDefaultSeason === "function") {
        createDefaultSeason();
    }

    if (typeof setTransferWindowOpen === "function") {
        setTransferWindowOpen(true);
    }

    refreshAfterSeasonRollover();

    setSeasonArchiveStatus(
        "New season created. League points and team form were reset.",
        false
    );
}

function getSuggestedNextSeasonName(currentName) {
    const text = String(currentName || "Season 1").trim();
    const match = text.match(/^(.*?)(\d+)$/);

    if (!match) {
        return `${text} 2`;
    }

    return `${match[1]}${Number(match[2]) + 1}`;
}

function renderSeasonManagementSummary() {
    const container = document.getElementById("seasonManagementSummary");
    if (!container) return;

    const state = typeof getSeasonState === "function"
        ? getSeasonState()
        : null;

    if (!state) {
        container.innerHTML = `
            <div class="season-management-empty">
                <strong>No active season</strong>
                <span>Use the Season Builder to create the next league season.</span>
            </div>
        `;
        return;
    }

    const completed = (state.events || []).filter(event =>
        event.status === "completed"
    ).length;
    const total = (state.events || []).length;
    const worlds = (state.events || []).find(event =>
        event.type === "worlds"
    );
    const percentage = total
        ? Math.round((completed / total) * 100)
        : 0;

    container.innerHTML = `
        <div class="season-management-hero">
            <div>
                <span class="season-management-kicker">Active Season</span>
                <h3>${escapeSeasonArchiveText(state.name)}</h3>
                <p>
                    ${completed} of ${total} events complete · ${percentage}% progress
                </p>
            </div>

            <div class="season-management-champion">
                <span>World Champion</span>
                <strong>${escapeSeasonArchiveText(worlds?.champion || "To be decided")}</strong>
            </div>
        </div>

        <div class="season-management-progress">
            <div>
                <span style="width: ${percentage}%"></span>
            </div>
            <strong>${percentage}%</strong>
        </div>

        <div class="season-management-actions">
            <button type="button"
                class="secondary-button"
                onclick="archiveCurrentSeason(false)">
                ${isCurrentSeasonComplete(state) ? "Archive Season" : "Archive Snapshot"}
            </button>

            <button type="button"
                class="primary-button"
                ${isCurrentSeasonComplete(state) ? "" : "disabled"}
                onclick="completeSeasonAndArchive()">
                Complete Season
            </button>

            <button type="button"
                class="primary-button season-rollover-button"
                onclick="startNewSeasonRollover()">
                Archive & Start Next Season
            </button>
        </div>
    `;
}

function renderSeasonArchiveHub() {
    const list = document.getElementById("seasonArchiveList");
    const detail = document.getElementById("seasonArchiveDetail");

    if (!list || !detail) return;

    const archives = getSeasonArchives();

    if (!archives.length) {
        list.innerHTML = `
            <div class="season-archive-empty">
                <strong>No archived seasons</strong>
                <span>Completed seasons will appear here with their final standings and champions.</span>
            </div>
        `;
        detail.innerHTML = "";
        return;
    }

    if (
        !selectedSeasonArchiveId ||
        !archives.some(item => item.id === selectedSeasonArchiveId)
    ) {
        selectedSeasonArchiveId = archives[0].id;
    }

    list.innerHTML = archives.map(archive => `
        <button type="button"
            class="season-archive-card ${archive.id === selectedSeasonArchiveId ? "active" : ""}"
            onclick="selectSeasonArchive('${escapeSeasonArchiveJs(archive.id)}')">

            <div>
                <strong>${escapeSeasonArchiveText(archive.name)}</strong>
                <span>${archive.completedEventCount} / ${archive.eventCount} events</span>
            </div>

            <div>
                <small>World Champion</small>
                <b>${escapeSeasonArchiveText(archive.worldsChampion)}</b>
            </div>

        </button>
    `).join("");

    renderSelectedSeasonArchive();
}

function selectSeasonArchive(archiveId) {
    selectedSeasonArchiveId = archiveId;
    renderSeasonArchiveHub();
}

function renderSelectedSeasonArchive() {
    const container = document.getElementById("seasonArchiveDetail");
    if (!container) return;

    const archive = getSeasonArchives().find(item =>
        item.id === selectedSeasonArchiveId
    );

    if (!archive) {
        container.innerHTML = "";
        return;
    }

    const topStandings = (archive.standings || []).slice(0, 12);

    container.innerHTML = `
        <div class="season-archive-detail-header">
            <div>
                <span class="season-management-kicker">Season Archive</span>
                <h3>${escapeSeasonArchiveText(archive.name)}</h3>
                <p>
                    Archived ${escapeSeasonArchiveText(formatSeasonArchiveDate(archive.archivedAt))}
                </p>
            </div>

            <div class="season-archive-detail-actions">
                <button type="button"
                    class="secondary-button"
                    onclick="exportSeasonArchive('${escapeSeasonArchiveJs(archive.id)}')">
                    Export Archive
                </button>

                <button type="button"
                    class="danger-button"
                    onclick="deleteSeasonArchive('${escapeSeasonArchiveJs(archive.id)}')">
                    Delete
                </button>
            </div>
        </div>

        <div class="season-archive-stat-grid">
            ${renderSeasonArchiveStat("World Champion", archive.worldsChampion)}
            ${renderSeasonArchiveStat("Events", `${archive.completedEventCount} / ${archive.eventCount}`)}
            ${renderSeasonArchiveStat("Transfers", archive.transfers?.length || 0)}
            ${renderSeasonArchiveStat("Splits", archive.splitCount || 1)}
        </div>

        <div class="season-archive-content-grid">
            <section class="season-archive-panel">
                <h4>Major Champions</h4>
                <div class="season-archive-list">
                    ${(archive.majorChampions || []).length
                        ? archive.majorChampions.map(item => `
                            <div>
                                <span>Split ${escapeSeasonArchiveText(item.split)}</span>
                                <strong>${escapeSeasonArchiveText(item.champion)}</strong>
                            </div>
                        `).join("")
                        : `<p class="small">No Major champions recorded.</p>`}
                </div>
            </section>

            <section class="season-archive-panel">
                <h4>Regional Performance</h4>
                <div class="season-archive-list">
                    ${(archive.regionPerformance || []).slice(0, 7).map(item => `
                        <div>
                            <span>#${Number(item.rank)} ${escapeSeasonArchiveText(item.region)}</span>
                            <strong>${Number(item.majorPoints)} Major pts</strong>
                        </div>
                    `).join("")}
                </div>
            </section>
        </div>

        <section class="season-archive-panel season-archive-standings-panel">
            <h4>Final League Standings</h4>
            <div class="season-archive-table-wrap">
                <table class="season-archive-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Team</th>
                            <th>Region</th>
                            <th>Points</th>
                            <th>Wins</th>
                            <th>Best Finish</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${topStandings.map(item => `
                            <tr>
                                <td>${Number(item.rank)}</td>
                                <td>${escapeSeasonArchiveText(item.teamName)}</td>
                                <td>${escapeSeasonArchiveText(item.region)}</td>
                                <td><strong>${Number(item.totalPoints)}</strong></td>
                                <td>${Number(item.eventWins)}</td>
                                <td>${formatSeasonArchivePlacement(item.bestPlacement)}</td>
                            </tr>
                        `).join("")}
                    </tbody>
                </table>
            </div>
        </section>

        <section class="season-archive-panel">
            <h4>Event Champions</h4>
            <div class="season-archive-event-grid">
                ${(archive.events || [])
                    .filter(event => event.status === "completed")
                    .map(event => `
                        <div class="season-archive-event-card">
                            <span>${escapeSeasonArchiveText(formatSeasonArchiveEventType(event.type))}</span>
                            <strong>${escapeSeasonArchiveText(event.name)}</strong>
                            <small>${escapeSeasonArchiveText(event.champion || "Unknown")}</small>
                        </div>
                    `).join("")}
            </div>
        </section>
    `;
}

function renderSeasonArchiveStat(label, value) {
    return `
        <div class="season-archive-stat">
            <span>${escapeSeasonArchiveText(label)}</span>
            <strong>${escapeSeasonArchiveText(value)}</strong>
        </div>
    `;
}

function exportSeasonArchive(archiveId) {
    const archive = getSeasonArchives().find(item =>
        item.id === archiveId
    );

    if (!archive) return;

    const blob = new Blob([
        JSON.stringify(archive, null, 2)
    ], {
        type: "application/json"
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${safeSeasonArchiveFileName(archive.name)}-archive.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function deleteSeasonArchive(archiveId) {
    const archive = getSeasonArchives().find(item =>
        item.id === archiveId
    );

    if (!archive) return;

    if (!confirm(`Delete the archive for ${archive.name}?`)) {
        return;
    }

    saveSeasonArchives(
        getSeasonArchives().filter(item =>
            item.id !== archiveId
        )
    );

    selectedSeasonArchiveId = null;
    renderSeasonArchiveHub();
}

function refreshAfterSeasonRollover() {
    if (typeof renderSeasonCalendar === "function") {
        renderSeasonCalendar();
    }

    renderSeasonManagementSummary();
    renderSeasonArchiveHub();

    if (typeof renderLeagueTable === "function") {
        renderLeagueTable();
    }

    if (typeof renderLanQualification === "function") {
        renderLanQualification();
    }

    if (typeof renderTeamProfiles === "function") {
        renderTeamProfiles();
    }

    if (typeof updateDashboard === "function") {
        updateDashboard();
    }
}

function setSeasonArchiveStatus(message, isError = false) {
    const status = document.getElementById("seasonArchiveStatus");
    if (!status) return;

    status.textContent = message;
    status.classList.toggle("season-archive-status-error", Boolean(isError));
}

function formatSeasonArchiveEventType(type) {
    const labels = {
        regional: "Regional",
        major: "Major",
        lcq: "Regional LCQ",
        playin: "Worlds Play-In",
        worlds: "World Championship",
        custom: "Custom Event"
    };

    return labels[type] || "Event";
}

function formatSeasonArchivePlacement(value) {
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) return "—";
    if (number === 1) return "1st";
    if (number === 2) return "2nd";
    if (number === 3) return "3rd";
    return `${number}th`;
}

function formatSeasonArchiveDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Unknown date";

    return date.toLocaleString([], {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}

function safeSeasonArchiveFileName(value) {
    return String(value || "season")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "season";
}

function escapeSeasonArchiveText(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function escapeSeasonArchiveJs(value) {
    return String(value ?? "")
        .replace(/\\/g, "\\\\")
        .replace(/'/g, "\\'")
        .replace(/\r/g, "\\r")
        .replace(/\n/g, "\\n");
}

window.addEventListener("load", () => {
    renderSeasonManagementSummary();
    renderSeasonArchiveHub();
});

window.getSeasonArchives = getSeasonArchives;
window.isCurrentSeasonComplete = isCurrentSeasonComplete;
window.archiveCurrentSeason = archiveCurrentSeason;
window.completeSeasonAndArchive = completeSeasonAndArchive;
window.startNewSeasonRollover = startNewSeasonRollover;
window.renderSeasonManagementSummary = renderSeasonManagementSummary;
window.renderSeasonArchiveHub = renderSeasonArchiveHub;
window.selectSeasonArchive = selectSeasonArchive;
window.exportSeasonArchive = exportSeasonArchive;
window.deleteSeasonArchive = deleteSeasonArchive;
