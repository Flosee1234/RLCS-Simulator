/* ==========================
   TEAM PROFILES
========================== */

function renderTeamProfiles() {

    renderTeamProfileSelector();
    renderSelectedTeamProfile();

}

function renderTeamProfileSelector() {

    const select =
        document.getElementById("profileTeamSelect");

    if (!select) return;

    const regionFilter =
        document.getElementById("profileRegionFilter")
            ?.value || "ALL";

    const savedTeams =
        typeof teams !== "undefined" &&
        Array.isArray(teams)
        ? teams
        : [];

    let filteredTeams =
        [...savedTeams];

    if (regionFilter !== "ALL") {
        filteredTeams =
            filteredTeams.filter(team =>
                team.region === regionFilter
            );
    }

    if (filteredTeams.length === 0) {
        select.innerHTML = `
            <option value="">
                No teams available
            </option>
        `;
        renderSelectedTeamProfile();
        return;
    }

    const currentValue =
        select.value;

    select.innerHTML =
        filteredTeams.map(team => `
            <option value="${team.id}">
                ${escapeProfileText(team.name)}
            </option>
        `).join("");

    if (
        currentValue &&
        filteredTeams.some(team =>
            String(team.id) === String(currentValue)
        )
    ) {
        select.value = currentValue;
    }

    renderSelectedTeamProfile();

}

function renderSelectedTeamProfile() {

    const container =
        document.getElementById("teamProfileView");

    if (!container) return;

    const select =
        document.getElementById("profileTeamSelect");

    const teamId =
        select?.value;

    if (!teamId) {
        container.innerHTML = `
            <div class="team-form-card">
                <p class="small">
                    Select a team to view its profile.
                </p>
            </div>
        `;
        return;
    }

    const team =
        getProfileTeamById(teamId);

    if (!team) {
        container.innerHTML = `
            <div class="team-form-card">
                <p class="small">
                    Team not found.
                </p>
            </div>
        `;
        return;
    }

    const state =
        typeof getLeagueState === "function"
        ? getLeagueState()
        : {
            teams: {}
        };

    const points =
        state.teams[String(team.id)] ||
        createEmptyProfilePoints(team);

    const history =
        getTeamProfileHistory(team.id);

    const transferHistory =
        typeof getTeamTransferHistory === "function"
        ? getTeamTransferHistory(team.id)
        : [];

    const trophies =
        history.filter(result =>
            result.placement === 1
        );

    const majorAppearances =
        history.filter(result =>
            result.eventType === "major"
        ).length;

    const worldsAppearances =
        history.filter(result =>
            result.eventType === "worlds"
        ).length;

    const recentForm =
        history.slice(0, 6);

    const simulationForm =
        typeof getTeamCurrentForm === "function"
            ? getTeamCurrentForm(team)
            : { totalForm: 0, effectiveRating: team.rating };

    const chemistry =
        typeof getTeamChemistrySnapshot === "function"
            ? getTeamChemistrySnapshot(team, true)
            : { bonus: 0, status: "Unavailable" };

    container.innerHTML = `

        <div class="team-profile-hero">

            <div class="team-profile-logo-wrap">

                ${
                    team.logo
                    ? `<img src="${team.logo}" class="team-profile-logo">`
                    : `<div class="team-profile-logo logo-placeholder"></div>`
                }

            </div>

            <div class="team-profile-main">

                <h2>
                    ${escapeProfileText(team.name)}
                </h2>

                <span>
                    ${escapeProfileText(team.region)}
                    |
                    Rating ${team.rating}
                </span>

                <div class="team-profile-form">

                    ${
                        recentForm.length
                        ? recentForm.map(result =>
                            renderFormBadge(result)
                        ).join("")
                        : `<span class="form-badge form-empty">No form</span>`
                    }

                </div>

            </div>

            <div class="team-profile-trophy">

                🏆
                ${points.eventWins || 0}

            </div>

        </div>

        <div class="team-profile-grid">

            ${renderProfileStatCard(
                "Total Points",
                points.totalPoints || 0
            )}

            ${renderProfileStatCard(
                "Regional Points",
                points.regionalPoints || 0
            )}

            ${renderProfileStatCard(
                "Major Points",
                points.lanPoints || 0
            )}

            ${renderProfileStatCard(
                "Worlds Points",
                points.worldsPoints || 0
            )}

            ${renderProfileStatCard(
                "Events Played",
                points.eventsPlayed || 0
            )}

            ${renderProfileStatCard(
                "Event Wins",
                points.eventWins || 0
            )}

            ${renderProfileStatCard(
                "Best Placement",
                points.bestPlacement
                ? `#${points.bestPlacement}`
                : "N/A"
            )}

            ${renderProfileStatCard(
                "Major Apps",
                majorAppearances
            )}

            ${renderProfileStatCard(
                "Worlds Apps",
                worldsAppearances
            )}

            ${renderProfileStatCard(
                "Current Form",
                formatProfileAdjustment(simulationForm.totalForm || 0)
            )}

            ${renderProfileStatCard(
                "Chemistry",
                `${chemistry.status} (${formatProfileAdjustment(chemistry.bonus || 0)})`
            )}

            ${renderProfileStatCard(
                "Effective Rating",
                Math.round(
                    (Number(team.rating || 0) +
                    Number(simulationForm.totalForm || 0) +
                    Number(chemistry.bonus || 0)) * 10
                ) / 10
            )}

        </div>

        <div class="team-profile-two-column">

            <div class="team-form-card">

                <h3>Split Points</h3>

                ${renderTeamSplitTable(points)}

            </div>

            <div class="team-form-card">

                <h3>Trophy Cabinet</h3>

                ${renderTeamTrophies(trophies)}

            </div>

        </div>

        <div class="team-profile-two-column">

            <div class="team-form-card">

                <h3>Current Roster</h3>

                ${renderTeamProfileRoster(team)}

            </div>

            <div class="team-form-card">

                <h3>Transfer History</h3>

                ${renderTeamProfileTransfers(transferHistory)}

            </div>

        </div>

        <div class="team-form-card">

            <h3>Recent Results</h3>

            ${renderTeamRecentResults(history)}

        </div>

    `;

}

function renderTeamProfileRoster(team) {

    if (!team.players || team.players.length === 0) {
        return `
            <p class="small">
                No active players on this roster.
            </p>
        `;
    }

    return team.players.map((player, index) => `
        <div class="profile-roster-row">
            <span>
                #${index + 1}
                ${escapeProfileText(player.name)}
            </span>

            <strong>
                ${player.rating}
            </strong>
        </div>
    `).join("");

}

function renderTeamProfileTransfers(history) {

    if (!history || history.length === 0) {
        return `
            <p class="small">
                No transfers involving this team yet.
            </p>
        `;
    }

    return history.slice(0, 8).map(record => `
        <div class="profile-transfer-row">
            <strong>
                ${escapeProfileText(record.summary)}
            </strong>

            <span>
                ${escapeProfileText(record.period)}
                |
                ${escapeProfileText(record.date)}
            </span>
        </div>
    `).join("");

}

function createEmptyProfilePoints(team) {

    return {
        teamId: team.id,
        teamName: team.name,
        logo: team.logo,
        region: team.region,
        rating: team.rating,

        totalPoints: 0,
        regionalPoints: 0,
        lanPoints: 0,
        worldsPoints: 0,
        eventsPlayed: 0,
        eventWins: 0,
        bestPlacement: null,
        splits: {}
    };

}

function renderProfileStatCard(label, value) {

    return `
        <div class="team-profile-stat-card">

            <span>
                ${escapeProfileText(label)}
            </span>

            <strong>
                ${escapeProfileText(value)}
            </strong>

        </div>
    `;

}

function renderFormBadge(result) {

    let text = "OUT";
    let className = "form-out";

    if (result.placement === 1) {
        text = "W";
        className = "form-win";
    } else if (result.placement === 2) {
        text = "F";
        className = "form-final";
    } else if (result.placement <= 4) {
        text = "T4";
        className = "form-top4";
    } else if (result.placement <= 8) {
        text = "T8";
        className = "form-top8";
    }

    return `
        <span class="form-badge ${className}"
            title="${escapeProfileText(result.eventName)}">
            ${text}
        </span>
    `;

}

function renderTeamSplitTable(points) {

    const splits =
        ["1", "2", "3"];

    return `

        <div class="points-table-wrap">

            <table class="points-table">

                <thead>
                    <tr>
                        <th>Split</th>
                        <th>Total</th>
                        <th>Regional</th>
                        <th>Major</th>
                        <th>Events</th>
                        <th>Wins</th>
                        <th>Best</th>
                    </tr>
                </thead>

                <tbody>

                    ${splits.map(split => {

                        const data =
                            points.splits?.[split] || {};

                        return `

                            <tr class="points-row">

                                <td class="points-team-name">
                                    Split ${split}
                                </td>

                                <td class="points-total-cell">
                                    ${data.totalPoints || 0}
                                </td>

                                <td class="record-cell">
                                    ${data.regionalPoints || 0}
                                </td>

                                <td class="record-cell">
                                    ${data.lanPoints || 0}
                                </td>

                                <td class="record-cell">
                                    ${data.eventsPlayed || 0}
                                </td>

                                <td class="record-cell">
                                    ${data.eventWins || 0}
                                </td>

                                <td class="record-cell">
                                    ${
                                        data.bestPlacement
                                        ? `#${data.bestPlacement}`
                                        : "N/A"
                                    }
                                </td>

                            </tr>

                        `;

                    }).join("")}

                </tbody>

            </table>

        </div>

    `;

}

function renderTeamTrophies(trophies) {

    if (!trophies || trophies.length === 0) {
        return `
            <p class="small">
                No trophies won yet.
            </p>
        `;
    }

    return trophies.slice(0, 8).map(trophy => `
        <div class="team-profile-trophy-row">

            <span>
                🏆
                ${escapeProfileText(trophy.eventName)}
            </span>

            <strong>
                Split ${escapeProfileText(trophy.split)}
            </strong>

        </div>
    `).join("");

}

function getTeamProfileHistory(teamId) {

    const history =
        JSON.parse(
            localStorage.getItem(
                "rlcsTournamentHistory"
            ) || "[]"
        );

    const results = [];

    history.forEach(record => {

        const placement =
            record.placements?.find(item =>
                String(item.teamId) ===
                String(teamId)
            );

        if (!placement) return;

        const pointsAwarded =
            record.pointsAwarded?.find(item =>
                String(item.teamId) ===
                String(teamId)
            );

        results.push({
            eventName:
                record.event?.name || "Event",

            eventType:
                record.event?.type || "custom",

            split:
                record.event?.split ||
                getProfileSplitFromName(
                    record.event?.name
                ),

            format:
                record.format,

            date:
                record.date,

            placement:
                placement.placement,

            seriesRecord:
                placement.seriesRecord || "",

            gameRecord:
                placement.gameRecord || "",

            points:
                pointsAwarded?.points || 0
        });

    });

    return results;

}

function renderTeamRecentResults(history) {

    if (!history || history.length === 0) {
        return `
            <p class="small">
                No event results for this team yet.
            </p>
        `;
    }

    return history.slice(0, 12).map(result => `

        <div class="team-profile-result-row">

            <div>

                <strong>
                    ${escapeProfileText(result.eventName)}
                </strong>

                <span>
                    ${
                        result.split === "season"
                        ? "Season Finals"
                        : `Split ${escapeProfileText(result.split)}`
                    }
                    |
                    ${formatProfileEventType(result.eventType)}
                    |
                    ${escapeProfileText(result.date)}
                </span>

            </div>

            <div class="team-profile-result-meta">

                <strong>
                    #${result.placement}
                </strong>

                <span>
                    +${result.points} pts
                </span>

            </div>

        </div>

    `).join("");

}

function getProfileTeamById(teamId) {

    if (
        typeof teams === "undefined" ||
        !Array.isArray(teams)
    ) {
        return null;
    }

    return teams.find(team =>
        String(team.id) === String(teamId)
    );

}

function getProfileSplitFromName(name) {

    const match =
        String(name || "")
            .match(/split\s*(\d+)/i);

    return match
        ? match[1]
        : "1";

}

function formatProfileEventType(type) {

    if (type === "regional") {
        return "Regional";
    }

    if (type === "major") {
        return "Major";
    }

    if (type === "worlds") {
        return "Worlds";
    }

    return "Custom";

}

function formatProfileAdjustment(value) {
    const number = Math.round(Number(value || 0) * 10) / 10;
    return number > 0 ? `+${number}` : String(number);
}

function escapeProfileText(value) {

    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}

window.renderTeamProfiles =
    renderTeamProfiles;

window.renderTeamProfileSelector =
    renderTeamProfileSelector;

window.renderSelectedTeamProfile =
    renderSelectedTeamProfile;

window.addEventListener("load", () => {
    setTimeout(() => {
        renderTeamProfiles();
    }, 1000);
});