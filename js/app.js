const pages = [
    "dashboard",
    "teams",
    "transfers",
    "offseason",
    "tournament",
    "simulationLab",
    "league",
    "profiles",
    "lans",
    "season",
    "history",
    "rules",
    "system",
    "settings"
];

function showPage(pageName) {

    pages.forEach(page => {

        const pageElement =
            document.getElementById(
                page + "Page"
            );

        if (pageElement) {
            pageElement.classList.add("hidden");
        }

    });

    const selectedPage =
        document.getElementById(
            pageName + "Page"
        );

    if (selectedPage) {
        selectedPage.classList.remove("hidden");
    }

    const buttons =
        document.querySelectorAll(".nav-button");

    buttons.forEach(button => {
        button.classList.remove("active");
    });

    const clickedButton =
        Array.from(buttons).find(button =>
            button.dataset.page === pageName
        );

    if (clickedButton) {
        clickedButton.classList.add("active");
    }

    if (pageName === "dashboard") {
        updateDashboard();
    }

    if (
        pageName === "history" &&
        typeof renderHistory === "function"
    ) {
        renderHistory();
    }


    if (
        pageName === "rules" &&
        typeof renderCompetitionRulesPage === "function"
    ) {
        renderCompetitionRulesPage();
        if (typeof validateRulesEditor === "function") {
            validateRulesEditor();
        }
    }

    if (
        pageName === "system" &&
        typeof renderSystemPage === "function"
    ) {
        renderSystemPage();
    }

    if (
        pageName === "settings" &&
        typeof renderSettings === "function"
    ) {
        renderSettings();
    }

    if (
        pageName === "transfers" &&
        typeof renderTransfers === "function"
    ) {
        renderTransfers();
    }

    if (
        pageName === "offseason" &&
        typeof renderOffseason === "function"
    ) {
        renderOffseason();
    }

    if (
        pageName === "tournament" &&
        typeof updateEventPreview === "function"
    ) {
        updateEventPreview();
    }

    if (
        pageName === "simulationLab" &&
        typeof renderSimulationLab === "function"
    ) {
        renderSimulationLab();
    }

    if (
        pageName === "league" &&
        typeof renderLeagueTable === "function"
    ) {
        renderLeagueTable();
    }

    if (
        pageName === "profiles" &&
        typeof renderTeamProfiles === "function"
    ) {
        renderTeamProfiles();
    }

    if (
        pageName === "lans" &&
        typeof renderLanQualification === "function"
    ) {
        renderLanQualification();
    }

    if (
        pageName === "season" &&
        typeof renderSeasonCalendar === "function"
    ) {
        renderSeasonCalendar();

        if (typeof renderSeasonManagementSummary === "function") {
            renderSeasonManagementSummary();
        }

        if (typeof renderSeasonArchiveHub === "function") {
            renderSeasonArchiveHub();
        }

        if (typeof renderSeasonQualificationSnapshot === "function") {
            renderSeasonQualificationSnapshot();
        }
    }

    rememberSidebarPage(pageName);
    closeMobileSidebar();
    scheduleSidebarStatusUpdate();

}

/* ==========================
   TOURNAMENT ACCORDION
========================== */

function showTournamentPanel(
    panelId,
    forceOpen = false
) {

    const panels =
        document.querySelectorAll(
            ".tournament-panel"
        );

    panels.forEach(panel => {

        if (panel.id === panelId) {

            if (forceOpen) {
                panel.classList.add("open");
            } else {
                panel.classList.toggle("open");
            }

        } else {
            panel.classList.remove("open");
        }

    });

}

/* ==========================
   DASHBOARD STATE
========================== */

function dashboardReadJson(key, fallback) {
    try {
        const saved = localStorage.getItem(key);
        return saved ? JSON.parse(saved) : fallback;
    } catch {
        return fallback;
    }
}

function getDashboardTeams() {
    if (
        typeof teams !== "undefined" &&
        Array.isArray(teams)
    ) {
        return teams;
    }

    return dashboardReadJson("rlcsTeams", []);
}

function getDashboardHistory() {
    if (typeof getTournamentHistory === "function") {
        return getTournamentHistory();
    }

    return dashboardReadJson(
        "rlcsTournamentHistory",
        []
    );
}

function getDashboardSeasonState() {
    if (typeof getSeasonState === "function") {
        return getSeasonState();
    }

    const saved = dashboardReadJson(
        "rlcsSeasonCalendar",
        null
    );

    if (Array.isArray(saved)) {
        return {
            id: "legacy-season",
            name: saved[0]?.seasonName || "Season",
            splits: [],
            events: saved
        };
    }

    return saved;
}

function getDashboardLeagueState() {
    if (typeof getLeagueState === "function") {
        return getLeagueState();
    }

    return dashboardReadJson(
        "rlcsLeaguePoints",
        {
            teams: {},
            awardedEvents: []
        }
    );
}

function getDashboardTransfers() {
    if (typeof getTransferHistory === "function") {
        return getTransferHistory();
    }

    return dashboardReadJson(
        "rlcsTransferHistory",
        []
    );
}

function getDashboardNextEvent(state) {
    if (!state) return null;

    if (typeof getNextAvailableSeasonEvent === "function") {
        return getNextAvailableSeasonEvent(state);
    }

    return [...(state.events || [])]
        .sort((a, b) =>
            Number(a.order || 0) -
            Number(b.order || 0)
        )
        .find(event =>
            event.status !== "completed"
        ) || null;
}

function getDashboardEventStatus(event, state) {
    if (!event) return "scheduled";

    if (typeof getSeasonEventDisplayStatus === "function") {
        return getSeasonEventDisplayStatus(event, state);
    }

    return event.status || "scheduled";
}

function getDashboardUnresolvedTies(event, state) {
    if (
        !event ||
        typeof getUnresolvedSeasonTiebreakerGroups !== "function"
    ) {
        return [];
    }

    return getUnresolvedSeasonTiebreakerGroups(
        event,
        state
    );
}

function getDashboardWorldsQualifiers() {
    if (
        typeof getWorldsMainEventQualifiers === "function"
    ) {
        return getWorldsMainEventQualifiers();
    }

    if (
        typeof getRegionalLcqWorldsQualifiers === "function"
    ) {
        return getRegionalLcqWorldsQualifiers();
    }

    return [];
}

/* ==========================
   DASHBOARD RENDER
========================== */

function updateDashboard() {
    const savedTeams = getDashboardTeams();
    const history = getDashboardHistory();
    const season = getDashboardSeasonState();
    const league = getDashboardLeagueState();
    const transfers = getDashboardTransfers();
    const events = Array.isArray(season?.events)
        ? season.events
        : [];
    const completedEvents = events.filter(event =>
        event.status === "completed"
    );
    const nextEvent = getDashboardNextEvent(season);
    const worldsQualifiers = getDashboardWorldsQualifiers();

    const totalEvents = events.length;
    const completedCount = completedEvents.length;
    const progress = totalEvents > 0
        ? Math.round(
            completedCount /
            totalEvents *
            100
        )
        : 0;

    dashboardSetText(
        "teamCount",
        savedTeams.length
    );

    dashboardSetText(
        "tournamentCount",
        totalEvents > 0
            ? `${completedCount} / ${totalEvents}`
            : history.length
    );

    dashboardSetText(
        "currentSeasonName",
        getDashboardCurrentStage(
            season,
            nextEvent
        )
    );

    dashboardSetText(
        "dashboardTransferCount",
        transfers.length
    );

    dashboardSetText(
        "dashboardWorldsCount",
        `${worldsQualifiers.length} / 16`
    );

    dashboardSetText(
        "dashboardSeasonName",
        season?.name || "No Active Season"
    );

    dashboardSetText(
        "dashboardSeasonContext",
        getDashboardSeasonContext(
            season,
            nextEvent,
            completedCount,
            totalEvents
        )
    );

    dashboardSetText(
        "dashboardProgressText",
        `${progress}% complete`
    );

    const progressFill = document.getElementById(
        "dashboardProgressFill"
    );

    if (progressFill) {
        progressFill.style.width = `${progress}%`;
    }

    renderDashboardContinueButton(
        season,
        nextEvent
    );
    renderDashboardNextAction(
        season,
        nextEvent
    );
    renderDashboardAlerts(
        season,
        nextEvent,
        savedTeams
    );
    renderDashboardSeasonTimeline(
        season,
        nextEvent
    );
    renderDashboardUpcomingEvents(
        season
    );
    renderDashboardRegionalLeaders(
        savedTeams,
        league
    );
    renderDashboardQualification(
        season,
        nextEvent,
        savedTeams,
        league,
        worldsQualifiers
    );
    renderDashboardRecentResults(history);
    renderDashboardActivity(
        history,
        transfers,
        season,
        nextEvent
    );

    scheduleSidebarStatusUpdate();
}

function dashboardSetText(id, value) {
    const element = document.getElementById(id);

    if (element) {
        element.textContent = value;
    }
}

function getDashboardCurrentStage(season, nextEvent) {
    if (!season) return "Off-season";
    if (!nextEvent) return "Complete";

    if (nextEvent.type === "lcq") {
        return "Regional LCQs";
    }

    if (nextEvent.type === "playin") {
        return "Worlds Play-In";
    }

    if (nextEvent.type === "worlds") {
        return "Worlds Main Event";
    }

    return `Split ${nextEvent.split}`;
}

function getDashboardSeasonContext(
    season,
    nextEvent,
    completedCount,
    totalEvents
) {
    if (!season) {
        return "Create a season to begin tracking your league journey.";
    }

    if (!nextEvent) {
        return `${completedCount} of ${totalEvents} events complete. The season is finished.`;
    }

    return `${completedCount} of ${totalEvents} events complete • Next: ${nextEvent.name}`;
}

function renderDashboardContinueButton(
    season,
    nextEvent
) {
    const button = document.getElementById(
        "dashboardContinueButton"
    );

    if (!button) return;

    const eventRunning = Boolean(
        typeof tournament !== "undefined" &&
        tournament.running
    );

    if (eventRunning) {
        button.disabled = false;
        button.textContent = "View Active Event";
        button.dataset.action = "active";
        return;
    }

    if (!season) {
        button.disabled = false;
        button.textContent = "Create Season";
        button.dataset.action = "season";
        return;
    }

    if (!nextEvent) {
        button.disabled = false;
        button.textContent = "View Completed Season";
        button.dataset.action = "season";
        return;
    }

    const ties = getDashboardUnresolvedTies(
        nextEvent,
        season
    );

    button.disabled = false;
    button.textContent = ties.length > 0
        ? "Resolve Tiebreaker"
        : "Continue Season";
    button.dataset.action = ties.length > 0
        ? "tiebreaker"
        : "event";
}

function renderDashboardNextAction(
    season,
    nextEvent
) {
    const container = document.getElementById(
        "dashboardNextAction"
    );

    if (!container) return;

    const eventRunning = Boolean(
        typeof tournament !== "undefined" &&
        tournament.running
    );

    if (eventRunning) {
        const eventName =
            tournament.currentEvent?.name ||
            "Active Event";

        container.innerHTML = `
            <span class="dashboard-action-kicker">In Progress</span>
            <strong>${dashboardEscape(eventName)}</strong>
            <p>
                ${dashboardEscape(
                    tournament.round ||
                    "Tournament currently running"
                )}
            </p>
            <button class="dashboard-link-button"
                onclick="dashboardOpenEventsPage('active')">
                Open event
            </button>
        `;
        return;
    }

    if (!season) {
        container.innerHTML = `
            <span class="dashboard-action-kicker">Get Started</span>
            <strong>Create your first season</strong>
            <p>
                Build the full regional, Major, LCQ, and Worlds calendar.
            </p>
            <button class="dashboard-link-button"
                onclick="dashboardOpenSeasonPage()">
                Open Season Mode
            </button>
        `;
        return;
    }

    if (!nextEvent) {
        container.innerHTML = `
            <span class="dashboard-action-kicker">Season Complete</span>
            <strong>${dashboardEscape(season.name)}</strong>
            <p>
                Every scheduled event has been completed.
            </p>
            <button class="dashboard-link-button"
                onclick="dashboardOpenHistory()">
                View season history
            </button>
        `;
        return;
    }

    const ties = getDashboardUnresolvedTies(
        nextEvent,
        season
    );
    const status = ties.length > 0
        ? "Tiebreaker Required"
        : dashboardFormatEventStatus(
            getDashboardEventStatus(
                nextEvent,
                season
            )
        );

    container.innerHTML = `
        <span class="dashboard-action-kicker">
            ${dashboardEscape(status)}
        </span>
        <strong>${dashboardEscape(nextEvent.name)}</strong>
        <p>
            ${dashboardEscape(
                dashboardFormatEventType(nextEvent.type)
            )}
            •
            ${dashboardEscape(
                nextEvent.region === "GLOBAL"
                    ? "Global"
                    : nextEvent.region
            )}
            •
            ${dashboardEscape(
                dashboardFormatEventFormat(nextEvent.format)
            )}
        </p>
        <button class="dashboard-link-button"
            onclick="dashboardContinueSeason()">
            ${ties.length > 0
                ? "Resolve points tie"
                : "Load next event"}
        </button>
    `;
}

function renderDashboardAlerts(
    season,
    nextEvent,
    savedTeams
) {
    const container = document.getElementById(
        "dashboardAlerts"
    );

    if (!container) return;

    const alerts = [];
    const eventRunning = Boolean(
        typeof tournament !== "undefined" &&
        tournament.running
    );

    if (eventRunning) {
        alerts.push({
            tone: "info",
            title: "An event is currently running.",
            detail: tournament.currentEvent?.name || "Open the active event to continue.",
            label: "Open Event",
            action: "dashboardOpenEventsPage('active')"
        });
    }

    if (season && nextEvent) {
        const ties = getDashboardUnresolvedTies(
            nextEvent,
            season
        );

        if (ties.length > 0) {
            alerts.push({
                tone: "warning",
                title: `${nextEvent.name} needs a points tiebreaker.`,
                detail: `${ties.length} tied group${ties.length === 1 ? "" : "s"} must be resolved before the event can begin.`,
                label: "Resolve",
                action: `dashboardResolveTiebreaker('${dashboardJsString(nextEvent.id)}')`
            });
        }
    }

    const transferOpen =
        typeof isTransferWindowOpen === "function"
            ? isTransferWindowOpen()
            : localStorage.getItem("rlcsTransferWindowOpen") !== "false";

    if (transferOpen) {
        alerts.push({
            tone: "success",
            title: "The transfer window is open.",
            detail: "Teams can trade players and sign free agents.",
            label: "Manage Transfers",
            action: "dashboardOpenTransfers()"
        });
    }

    if (savedTeams.length === 0) {
        alerts.push({
            tone: "warning",
            title: "No teams have been created yet.",
            detail: "Create teams before setting up events or starting a season.",
            label: "Create Team",
            action: "dashboardOpenTeamsCreator()"
        });
    } else if (!season) {
        alerts.push({
            tone: "info",
            title: "Your teams are ready for a season.",
            detail: "Generate a calendar to begin regional qualification.",
            label: "Create Season",
            action: "dashboardOpenSeasonPage()"
        });
    }

    if (alerts.length === 0) {
        container.innerHTML = "";
        container.classList.add("hidden");
        return;
    }

    container.classList.remove("hidden");
    container.innerHTML = alerts
        .slice(0, 3)
        .map(alert => `
            <div class="dashboard-alert dashboard-alert-${alert.tone}">
                <div class="dashboard-alert-mark"></div>
                <div class="dashboard-alert-copy">
                    <strong>${dashboardEscape(alert.title)}</strong>
                    <span>${dashboardEscape(alert.detail)}</span>
                </div>
                <button type="button"
                    onclick="${alert.action}">
                    ${dashboardEscape(alert.label)}
                </button>
            </div>
        `)
        .join("");
}

function renderDashboardSeasonTimeline(
    season,
    nextEvent
) {
    const container = document.getElementById(
        "dashboardSeasonTimeline"
    );

    if (!container) return;

    if (!season || !Array.isArray(season.events)) {
        container.innerHTML = dashboardEmptyState(
            "No season calendar",
            "Create a season to see Split progress, LCQs, and Worlds here.",
            "Create Season",
            "dashboardOpenSeasonPage()"
        );
        return;
    }

    const splitNumbers = Array.from(
        new Set(
            season.events
                .filter(event =>
                    event.type === "regional" ||
                    event.type === "major"
                )
                .map(event => String(event.split))
        )
    ).sort((a, b) => Number(a) - Number(b));

    const groups = splitNumbers.map(split => ({
        key: `split-${split}`,
        label: `Split ${split}`,
        events: season.events.filter(event =>
            String(event.split) === String(split) &&
            (
                event.type === "regional" ||
                event.type === "major"
            )
        )
    }));

    const postseasonEvents = season.events.filter(event =>
        event.type === "lcq" ||
        event.type === "playin" ||
        event.type === "worlds"
    );

    if (postseasonEvents.length > 0) {
        groups.push({
            key: "postseason",
            label: "Postseason",
            events: postseasonEvents
        });
    }

    container.innerHTML = groups.map(group => {
        const completed = group.events.filter(event =>
            event.status === "completed"
        ).length;
        const containsNext = group.events.some(event =>
            String(event.id) === String(nextEvent?.id)
        );
        const complete =
            group.events.length > 0 &&
            completed === group.events.length;
        const allLocked =
            group.events.length > 0 &&
            group.events
                .filter(event => event.status !== "completed")
                .every(event =>
                    getDashboardEventStatus(event, season) === "locked"
                );
        const stateClass = complete
            ? "complete"
            : containsNext
            ? "current"
            : allLocked
            ? "locked"
            : "upcoming";

        return `
            <button type="button"
                class="dashboard-timeline-step dashboard-timeline-${stateClass}"
                onclick="dashboardOpenSeasonPage()">
                <span class="dashboard-timeline-node">
                    ${complete
                        ? "✓"
                        : containsNext
                        ? "•"
                        : allLocked
                        ? "×"
                        : ""}
                </span>
                <span class="dashboard-timeline-copy">
                    <strong>${dashboardEscape(group.label)}</strong>
                    <small>${completed} / ${group.events.length} complete</small>
                </span>
                <span class="dashboard-timeline-events">
                    ${group.events.map(event => {
                        const eventStatus =
                            event.status === "completed"
                                ? "complete"
                                : String(event.id) === String(nextEvent?.id)
                                ? "current"
                                : getDashboardEventStatus(event, season) === "locked"
                                ? "locked"
                                : "upcoming";

                        return `
                            <i class="dashboard-event-dot dashboard-event-dot-${eventStatus}"
                                title="${dashboardEscapeAttribute(event.name)}"></i>
                        `;
                    }).join("")}
                </span>
            </button>
        `;
    }).join("");
}

function renderDashboardUpcomingEvents(season) {
    const container = document.getElementById(
        "dashboardUpcomingEvents"
    );

    if (!container) return;

    if (!season || !Array.isArray(season.events)) {
        container.innerHTML = dashboardEmptyState(
            "No upcoming events",
            "Create a season calendar or build a custom event.",
            "Create Event",
            "dashboardOpenEventsPage('create')"
        );
        return;
    }

    const upcoming = [...season.events]
        .sort((a, b) =>
            Number(a.order || 0) -
            Number(b.order || 0)
        )
        .filter(event =>
            event.status !== "completed"
        )
        .slice(0, 5);

    if (upcoming.length === 0) {
        container.innerHTML = dashboardEmptyState(
            "Season complete",
            "Every scheduled event has been played.",
            "View History",
            "dashboardOpenHistory()"
        );
        return;
    }

    container.innerHTML = upcoming.map(event => {
        const ties = getDashboardUnresolvedTies(
            event,
            season
        );
        const status = getDashboardEventStatus(
            event,
            season
        );
        const locked = status === "locked";
        const actionLabel = ties.length > 0
            ? "Resolve"
            : status === "loaded" || status === "in_progress"
            ? "Open"
            : "Load";
        const action = ties.length > 0
            ? `dashboardResolveTiebreaker('${dashboardJsString(event.id)}')`
            : `dashboardLoadSeasonEvent('${dashboardJsString(event.id)}')`;

        return `
            <div class="dashboard-event-row ${locked ? "dashboard-event-row-locked" : ""}">
                <div class="dashboard-event-date">
                    <span>${dashboardEscape(
                        event.type === "regional"
                            ? `R${event.splitEventNumber || ""}`
                            : event.type === "major"
                            ? "M"
                            : event.type === "lcq"
                            ? "LCQ"
                            : event.type === "playin"
                            ? "PI"
                            : "W"
                    )}</span>
                </div>
                <div class="dashboard-event-row-main">
                    <strong>${dashboardEscape(event.name)}</strong>
                    <small>
                        ${dashboardEscape(
                            dashboardFormatEventType(event.type)
                        )}
                        •
                        ${dashboardEscape(
                            event.region === "GLOBAL"
                                ? "Global"
                                : event.region
                        )}
                        •
                        ${ties.length > 0
                            ? "Tiebreaker required"
                            : dashboardEscape(
                                dashboardFormatEventStatus(status)
                            )}
                    </small>
                </div>
                <button type="button"
                    onclick="${action}"
                    ${locked ? "disabled" : ""}>
                    ${locked ? "Locked" : actionLabel}
                </button>
            </div>
        `;
    }).join("");
}

function renderDashboardRegionalLeaders(
    savedTeams,
    league
) {
    const container = document.getElementById(
        "dashboardRegionalLeaders"
    );

    if (!container) return;

    const regions = [
        "NA",
        "EU",
        "SAM",
        "MENA",
        "OCE",
        "APAC",
        "SSA"
    ];

    const leaders = regions
        .map(region => {
            const regionTeams = savedTeams
                .filter(team =>
                    team.region === region
                )
                .map(team => ({
                    ...team,
                    points: Number(
                        league.teams?.[String(team.id)]
                            ?.totalPoints || 0
                    )
                }))
                .sort((a, b) =>
                    b.points - a.points ||
                    Number(b.rating || 0) -
                    Number(a.rating || 0) ||
                    a.name.localeCompare(b.name)
                );

            return {
                region,
                team: regionTeams[0] || null
            };
        })
        .filter(entry => entry.team);

    if (leaders.length === 0) {
        container.innerHTML = dashboardEmptyState(
            "No regional leaders yet",
            "Create teams and run point-awarding events.",
            "Open Teams",
            "dashboardOpenTeamsCreator()"
        );
        return;
    }

    container.innerHTML = leaders.map(entry => `
        <button type="button"
            class="dashboard-leader-row"
            onclick="dashboardOpenTeamProfile('${dashboardJsString(entry.team.id)}')">
            <span class="dashboard-region-badge">
                ${dashboardEscape(entry.region)}
            </span>
            <span class="dashboard-leader-logo">
                ${entry.team.logo
                    ? `<img src="${dashboardEscapeAttribute(entry.team.logo)}"
                        alt="">`
                    : `<span>${dashboardEscape(
                        String(entry.team.name || "?")
                            .charAt(0)
                            .toUpperCase()
                    )}</span>`}
            </span>
            <span class="dashboard-leader-copy">
                <strong>${dashboardEscape(entry.team.name)}</strong>
                <small>Rating ${Number(entry.team.rating || 0)}</small>
            </span>
            <span class="dashboard-leader-points">
                ${entry.team.points}
                <small>pts</small>
            </span>
        </button>
    `).join("");
}

function renderDashboardQualification(
    season,
    nextEvent,
    savedTeams,
    league,
    worldsQualifiers
) {
    const container = document.getElementById(
        "dashboardQualificationPreview"
    );

    if (!container) return;

    if (worldsQualifiers.length > 0) {
        container.innerHTML = `
            <div class="dashboard-panel-subheading">
                <div>
                    <strong>Worlds Field</strong>
                    <span>${worldsQualifiers.length} of 16 qualified</span>
                </div>
                <button onclick="dashboardOpenLans()">View LANs</button>
            </div>
            <div class="dashboard-qualification-list">
                ${worldsQualifiers.slice(0, 16).map((team, index) =>
                    renderDashboardQualificationRow(
                        team,
                        index + 1,
                        index === 15
                    )
                ).join("")}
            </div>
        `;
        return;
    }

    const allMajorsComplete = Boolean(
        season?.events?.filter(event =>
            event.type === "major"
        ).length &&
        season.events
            .filter(event => event.type === "major")
            .every(event => event.status === "completed")
    );

    if (
        allMajorsComplete &&
        typeof rankRegionsByMajorPerformance === "function"
    ) {
        const rankings = rankRegionsByMajorPerformance(
            season
        );

        container.innerHTML = `
            <div class="dashboard-panel-subheading">
                <div>
                    <strong>Regional LCQ Race</strong>
                    <span>Top four regions earn an LCQ</span>
                </div>
                <button onclick="dashboardOpenSeasonPage()">View Season</button>
            </div>
            <div class="dashboard-region-race-list">
                ${rankings.slice(0, 7).map((row, index) => `
                    <div class="dashboard-region-race-row ${index === 3 ? "dashboard-cutoff-row" : ""}">
                        <span>#${index + 1}</span>
                        <strong>${dashboardEscape(row.region)}</strong>
                        <small>${Number(row.majorPoints || 0)} Major pts</small>
                        <em>${index < 4 ? "LCQ" : "Outside"}</em>
                    </div>
                `).join("")}
            </div>
        `;
        return;
    }

    const split = nextEvent && nextEvent.split !== "season"
        ? String(nextEvent.split || "1")
        : "all";

    const rankedTeams = savedTeams
        .map(team => {
            const data = league.teams?.[String(team.id)] || {};
            const display = split === "all"
                ? data
                : data.splits?.[split] || {};

            return {
                teamId: team.id,
                teamName: team.name,
                logo: team.logo,
                region: team.region,
                rating: team.rating,
                totalPoints: Number(display.totalPoints || 0),
                eventWins: Number(display.eventWins || 0)
            };
        })
        .sort((a, b) =>
            b.totalPoints - a.totalPoints ||
            b.eventWins - a.eventWins ||
            Number(b.rating || 0) -
            Number(a.rating || 0)
        )
        .slice(0, 8);

    if (rankedTeams.length === 0) {
        container.innerHTML = dashboardEmptyState(
            "No qualification data",
            "League points will appear after completed events.",
            "View League Table",
            "dashboardOpenLeague()"
        );
        return;
    }

    container.innerHTML = `
        <div class="dashboard-panel-subheading">
            <div>
                <strong>${split === "all" ? "Season Points Leaders" : `Split ${split} Points Leaders`}</strong>
                <span>Automatic seeding and qualification form guide</span>
            </div>
            <button onclick="dashboardOpenLeague()">Full Table</button>
        </div>
        <div class="dashboard-qualification-list">
            ${rankedTeams.slice(0, 6).map((team, index) =>
                renderDashboardQualificationRow(
                    team,
                    index + 1,
                    false
                )
            ).join("")}
        </div>
    `;
}

function renderDashboardQualificationRow(
    team,
    seed,
    cutoff
) {
    const teamId = team.teamId ?? team.id;
    const teamName = team.teamName ?? team.name;

    return `
        <button type="button"
            class="dashboard-qualification-row ${cutoff ? "dashboard-cutoff-row" : ""}"
            onclick="dashboardOpenTeamProfile('${dashboardJsString(teamId)}')">
            <span class="dashboard-qualification-seed">${seed}</span>
            <span class="dashboard-qualification-logo">
                ${team.logo
                    ? `<img src="${dashboardEscapeAttribute(team.logo)}" alt="">`
                    : `<span>${dashboardEscape(
                        String(teamName || "?")
                            .charAt(0)
                            .toUpperCase()
                    )}</span>`}
            </span>
            <span class="dashboard-qualification-team">
                <strong>${dashboardEscape(teamName)}</strong>
                <small>${dashboardEscape(team.region || "Unknown")}</small>
            </span>
            <span class="dashboard-qualification-points">
                ${Number(team.totalPoints || 0)} pts
            </span>
        </button>
    `;
}

function renderDashboardRecentResults(history) {
    const container = document.getElementById(
        "dashboardRecentResults"
    );

    if (!container) return;

    const recent = history.slice(0, 4);

    if (recent.length === 0) {
        container.innerHTML = dashboardEmptyState(
            "No completed events",
            "Recent champions and runners-up will appear here.",
            "Create Event",
            "dashboardOpenEventsPage('create')"
        );
        return;
    }

    container.innerHTML = recent.map(record => {
        const runnerUp = (record.placements || [])
            .find(placement =>
                Number(placement.placement) === 2
            );

        return `
            <button type="button"
                class="dashboard-result-row"
                onclick="dashboardOpenHistory()">
                <span class="dashboard-result-type">
                    ${dashboardEscape(
                        dashboardEventBadge(record.event?.type)
                    )}
                </span>
                <span class="dashboard-result-main">
                    <strong>${dashboardEscape(
                        record.event?.name || "Event"
                    )}</strong>
                    <small>
                        ${dashboardEscape(
                            record.champion || "Unknown Champion"
                        )}
                        ${runnerUp
                            ? `def. ${dashboardEscape(runnerUp.teamName)}`
                            : ""}
                    </small>
                </span>
                <span class="dashboard-result-date">
                    ${dashboardEscape(
                        dashboardCompactDate(
                            record.completedAt ||
                            record.date
                        )
                    )}
                </span>
            </button>
        `;
    }).join("");
}

function renderDashboardActivity(
    history,
    transfers,
    season,
    nextEvent
) {
    const container = document.getElementById(
        "dashboardActivityFeed"
    );

    if (!container) return;

    const activity = [];

    history.slice(0, 8).forEach(record => {
        activity.push({
            type: "result",
            time: dashboardDateValue(
                record.completedAt ||
                record.date
            ),
            label: `${record.champion || "A team"} won ${record.event?.name || "an event"}.`,
            meta: dashboardCompactDate(
                record.completedAt ||
                record.date
            )
        });
    });

    transfers.slice(0, 8).forEach(record => {
        activity.push({
            type: "transfer",
            time: dashboardDateValue(
                record.completedAt ||
                record.date
            ),
            label: record.summary || "A transfer was completed.",
            meta: record.period || dashboardCompactDate(record.date)
        });
    });

    if (season && nextEvent) {
        const ties = getDashboardUnresolvedTies(
            nextEvent,
            season
        );

        if (ties.length > 0) {
            activity.push({
                type: "warning",
                time: Date.now() + 1,
                label: `${nextEvent.name} requires a points tiebreaker.`,
                meta: "Action required"
            });
        }
    }

    activity.sort((a, b) => b.time - a.time);

    const visible = activity.slice(0, 6);

    if (visible.length === 0) {
        container.innerHTML = dashboardEmptyState(
            "No league activity",
            "Results and roster moves will appear here.",
            "Open Transfers",
            "dashboardOpenTransfers()"
        );
        return;
    }

    container.innerHTML = visible.map(item => `
        <div class="dashboard-activity-row">
            <span class="dashboard-activity-icon dashboard-activity-${item.type}">
                ${item.type === "transfer"
                    ? "T"
                    : item.type === "warning"
                    ? "!"
                    : "R"}
            </span>
            <span class="dashboard-activity-copy">
                <strong>${dashboardEscape(item.label)}</strong>
                <small>${dashboardEscape(item.meta)}</small>
            </span>
        </div>
    `).join("");
}

/* ==========================
   DASHBOARD ACTIONS
========================== */

function dashboardContinueSeason() {
    const eventRunning = Boolean(
        typeof tournament !== "undefined" &&
        tournament.running
    );

    if (eventRunning) {
        dashboardOpenEventsPage("active");
        return;
    }

    const state = getDashboardSeasonState();

    if (!state) {
        dashboardOpenSeasonPage();
        return;
    }

    const nextEvent = getDashboardNextEvent(state);

    if (!nextEvent) {
        dashboardOpenSeasonPage();
        return;
    }

    const ties = getDashboardUnresolvedTies(
        nextEvent,
        state
    );

    if (ties.length > 0) {
        dashboardResolveTiebreaker(nextEvent.id);
        return;
    }

    dashboardLoadSeasonEvent(nextEvent.id);
}

function dashboardLoadSeasonEvent(eventId) {
    if (typeof loadSeasonEvent === "function") {
        loadSeasonEvent(eventId);
        return;
    }

    dashboardOpenSeasonPage();
}

function dashboardResolveTiebreaker(eventId) {
    dashboardOpenSeasonPage();

    if (typeof focusSeasonTiebreaker === "function") {
        setTimeout(() => {
            focusSeasonTiebreaker(eventId);
        }, 0);
    }
}

function dashboardOpenSeasonPage() {
    showPage("season");
}

function dashboardOpenEventsPage(tabName = "create") {
    showPage("tournament");

    if (typeof showEventWorkspaceTab === "function") {
        showEventWorkspaceTab(tabName);
    }
}

function dashboardOpenTeamsCreator() {
    showPage("teams");

    if (typeof cancelTeamEdit === "function") {
        cancelTeamEdit();
    }

    setTimeout(() => {
        document.getElementById("teamName")?.focus();
    }, 0);
}

function dashboardOpenTransfers() {
    showPage("transfers");
}

function dashboardOpenLeague() {
    showPage("league");
}

function dashboardOpenLans() {
    showPage("lans");
}

function dashboardOpenHistory() {
    showPage("history");
}

function dashboardOpenSettings() {
    showPage("settings");
}

function dashboardOpenTeamProfile(teamId) {
    showPage("profiles");

    if (typeof renderTeamProfileSelector === "function") {
        renderTeamProfileSelector();
    }

    const select = document.getElementById(
        "profileTeamSelect"
    );

    if (select) {
        select.value = String(teamId);
    }

    if (typeof renderSelectedTeamProfile === "function") {
        renderSelectedTeamProfile();
    }
}

/* ==========================
   DASHBOARD HELPERS
========================== */

function dashboardEmptyState(
    title,
    detail,
    actionLabel,
    action
) {
    return `
        <div class="dashboard-empty-state">
            <strong>${dashboardEscape(title)}</strong>
            <span>${dashboardEscape(detail)}</span>
            ${actionLabel && action
                ? `<button type="button" onclick="${action}">${dashboardEscape(actionLabel)}</button>`
                : ""}
        </div>
    `;
}

function dashboardFormatEventType(type) {
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

function dashboardFormatEventFormat(format) {
    const labels = {
        roundRobin: "Round Robin",
        playoffs: "Single Elimination",
        swiss: "Swiss Stage",
        swissPlayoffs: "Swiss + Playoffs",
        doubleElim: "Double Elimination",
        groupsHybrid: "Groups + Hybrid Playoffs",
        groupsDoubleElim: "Groups + Double-Elim Playoffs",
        regionalLcq: "Regional LCQ",
        worldsPlayIn: "Worlds Play-In",
        custom: "Custom Bracket"
    };

    return labels[format] || "Tournament";
}

function dashboardFormatEventStatus(status) {
    const labels = {
        completed: "Completed",
        loaded: "Loaded",
        in_progress: "In Progress",
        locked: "Locked",
        scheduled: "Ready"
    };

    return labels[status] || "Ready";
}

function dashboardEventBadge(type) {
    const labels = {
        regional: "REG",
        major: "MAJ",
        lcq: "LCQ",
        playin: "PI",
        worlds: "WOR",
        custom: "EVT"
    };

    return labels[type] || "EVT";
}

function dashboardCompactDate(value) {
    if (!value) return "";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return String(value).split(",")[0];
    }

    return date.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short"
    });
}

function dashboardDateValue(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
        ? 0
        : date.getTime();
}

function dashboardEscape(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function dashboardEscapeAttribute(value) {
    return dashboardEscape(value)
        .replace(/`/g, "&#096;");
}

function dashboardJsString(value) {
    return String(value ?? "")
        .replace(/\\/g, "\\\\")
        .replace(/'/g, "\\'")
        .replace(/\r/g, "\\r")
        .replace(/\n/g, "\\n");
}

/* ==========================
   SIDEBAR CONTROLLER
========================== */

const RLCS_SIDEBAR_COLLAPSED_KEY =
    "rlcsSidebarCollapsedV2";

const RLCS_SIDEBAR_LAST_PAGE_KEY =
    "rlcsSidebarLastPageV2";

let rlcsSidebarStatusTimeout = null;
let rlcsSidebarStatusInterval = null;

function initialiseSidebar() {
    const savedCollapsed =
        localStorage.getItem(
            RLCS_SIDEBAR_COLLAPSED_KEY
        ) === "true";

    document.body.classList.toggle(
        "sidebar-collapsed",
        savedCollapsed
    );

    updateSidebarCollapseAccessibility();

    const hashPage = String(
        window.location.hash || ""
    )
        .replace(/^#\/?/, "")
        .trim();

    const savedPage =
        localStorage.getItem(
            RLCS_SIDEBAR_LAST_PAGE_KEY
        );

    const initialPage = pages.includes(hashPage)
        ? hashPage
        : pages.includes(savedPage)
            ? savedPage
            : "dashboard";

    showPage(initialPage);
    updateSidebarStatus();

    if (rlcsSidebarStatusInterval) {
        window.clearInterval(
            rlcsSidebarStatusInterval
        );
    }

    rlcsSidebarStatusInterval =
        window.setInterval(() => {
            if (!document.hidden) {
                updateSidebarStatus();
            }
        }, 5000);
}

function toggleSidebar() {
    if (window.innerWidth <= 980) {
        closeMobileSidebar();
        return;
    }

    const collapsed =
        document.body.classList.toggle(
            "sidebar-collapsed"
        );

    localStorage.setItem(
        RLCS_SIDEBAR_COLLAPSED_KEY,
        String(collapsed)
    );

    updateSidebarCollapseAccessibility();
}

function updateSidebarCollapseAccessibility() {
    const button = document.querySelector(
        ".sidebar-collapse-button"
    );

    if (!button) return;

    const collapsed =
        document.body.classList.contains(
            "sidebar-collapsed"
        );

    button.setAttribute(
        "aria-label",
        collapsed
            ? "Expand sidebar"
            : "Collapse sidebar"
    );

    button.setAttribute(
        "aria-expanded",
        String(!collapsed)
    );

    button.title = collapsed
        ? "Expand sidebar"
        : "Collapse sidebar";
}

function openMobileSidebar() {
    document.body.classList.add(
        "sidebar-mobile-open"
    );

    document
        .querySelector(".sidebar-mobile-toggle")
        ?.setAttribute("aria-expanded", "true");
}

function closeMobileSidebar() {
    document.body.classList.remove(
        "sidebar-mobile-open"
    );

    document
        .querySelector(".sidebar-mobile-toggle")
        ?.setAttribute("aria-expanded", "false");
}

function rememberSidebarPage(pageName) {
    if (!pages.includes(pageName)) return;

    localStorage.setItem(
        RLCS_SIDEBAR_LAST_PAGE_KEY,
        pageName
    );

    const nextHash = `#${pageName}`;

    if (window.location.hash !== nextHash) {
        window.history.replaceState(
            null,
            "",
            nextHash
        );
    }

    const pageLabels = {
        dashboard: "Dashboard",
        teams: "Teams",
        transfers: "Transfers",
        offseason: "Offseason",
        tournament: "Events",
        simulationLab: "Simulation Lab",
        league: "League Table",
        profiles: "Team Hub",
        lans: "LAN Qualification",
        season: "Season",
        history: "History",
        rules: "Rules",
        system: "System",
        settings: "Settings"
    };

    document.title =
        `${pageLabels[pageName] || "RLCS"} — RLCS League Simulator`;
}

function scheduleSidebarStatusUpdate() {
    window.clearTimeout(
        rlcsSidebarStatusTimeout
    );

    rlcsSidebarStatusTimeout =
        window.setTimeout(
            updateSidebarStatus,
            40
        );
}

function updateSidebarStatus() {
    const season = getDashboardSeasonState();
    const events = Array.isArray(season?.events)
        ? season.events
        : [];

    const completed = events.filter(event =>
        event?.status === "completed"
    ).length;

    const total = events.length;
    const progress = total > 0
        ? Math.round(completed / total * 100)
        : 0;

    setSidebarText(
        "sidebarSeasonName",
        season?.name || "No active season"
    );

    setSidebarText(
        "sidebarSeasonProgressText",
        total > 0
            ? `${completed} of ${total} events · ${progress}%`
            : "Create a season to begin"
    );

    const progressFill = document.getElementById(
        "sidebarSeasonProgressFill"
    );

    if (progressFill) {
        progressFill.style.width = `${progress}%`;
    }

    const nextEvent = getDashboardNextEvent(
        season
    );

    const unresolvedTies = nextEvent
        ? getDashboardUnresolvedTies(
            nextEvent,
            season
        )
        : [];

    const eventRunning = Boolean(
        typeof tournament !== "undefined" &&
        tournament?.running
    );

    const continueButton =
        document.getElementById(
            "sidebarContinueButton"
        );

    if (continueButton) {
        if (eventRunning) {
            continueButton.textContent =
                "Open Active Event";
        } else if (!season) {
            continueButton.textContent =
                "Create Season";
        } else if (!nextEvent) {
            continueButton.textContent =
                "View Completed Season";
        } else if (unresolvedTies.length > 0) {
            continueButton.textContent =
                "Resolve Tiebreaker";
        } else {
            continueButton.textContent =
                "Continue Season";
        }
    }

    updateSidebarBadge(
        "sidebarSeasonBadge",
        unresolvedTies.length > 0
            ? "!"
            : total > 0
                ? `${completed}/${total}`
                : "",
        unresolvedTies.length > 0
            ? "warning"
            : ""
    );

    updateSidebarBadge(
        "sidebarEventBadge",
        eventRunning ? "LIVE" : "",
        eventRunning ? "live" : ""
    );

    const pendingTransfers =
        getSidebarPendingTransferCount();

    updateSidebarBadge(
        "sidebarTransferBadge",
        pendingTransfers > 0
            ? String(pendingTransfers)
            : "",
        ""
    );

    const storagePercentage =
        getSidebarLocalStoragePercentage();

    updateSidebarBadge(
        "sidebarSystemBadge",
        storagePercentage >= 65 ? "!" : "",
        storagePercentage >= 65
            ? "warning"
            : ""
    );

    updateSidebarSaveIndicator();
}

function setSidebarText(id, value) {
    const element = document.getElementById(id);

    if (element) {
        element.textContent = String(value ?? "");
    }
}

function updateSidebarBadge(
    id,
    value,
    variant = ""
) {
    const badge = document.getElementById(id);

    if (!badge) return;

    const displayValue = String(value ?? "").trim();

    badge.textContent = displayValue;
    badge.classList.toggle(
        "hidden",
        !displayValue
    );
    badge.classList.toggle(
        "warning",
        variant === "warning"
    );
    badge.classList.toggle(
        "live",
        variant === "live"
    );
}

function getSidebarPendingTransferCount() {
    try {
        const suggestions =
            typeof getTransferSuggestions ===
            "function"
                ? getTransferSuggestions()
                : JSON.parse(
                    localStorage.getItem(
                        "rlcsTransferSuggestionsV1"
                    ) || "[]"
                );

        return (suggestions || []).filter(item =>
            item?.status === "pending"
        ).length;
    } catch {
        return 0;
    }
}

function getSidebarLocalStoragePercentage() {
    let characters = 0;

    for (
        let index = 0;
        index < localStorage.length;
        index++
    ) {
        const key = localStorage.key(index) || "";
        const value = localStorage.getItem(key) || "";
        characters += key.length + value.length;
    }

    const estimatedBytes = characters * 2;
    const estimatedLimit = 5 * 1024 * 1024;

    return estimatedBytes /
        estimatedLimit *
        100;
}

async function updateSidebarSaveIndicator() {
    const indicator = document.getElementById(
        "sidebarSaveIndicator"
    );

    if (!indicator) return;

    indicator.textContent = "Saved locally";

    try {
        if (
            typeof getActiveSaveSlotId !==
                "function" ||
            typeof systemDbGet !== "function"
        ) {
            return;
        }

        const activeId = getActiveSaveSlotId();

        if (!activeId) return;

        const slot = await systemDbGet(
            "slots",
            activeId
        );

        if (slot?.name) {
            indicator.textContent =
                `Save: ${slot.name}`;
            indicator.title =
                `Active save slot: ${slot.name}`;
        }
    } catch {
        indicator.textContent = "Saved locally";
    }
}

/* ==========================
   STARTUP
========================== */

window.addEventListener("load", () => {
    initialiseSidebar();
    updateDashboard();

    showTournamentPanel(
        "eventCreatorPanel",
        true
    );
});

window.addEventListener("storage", () => {
    scheduleSidebarStatusUpdate();
});

window.addEventListener("resize", () => {
    if (window.innerWidth > 980) {
        closeMobileSidebar();
    }
});

window.addEventListener("keydown", event => {
    if (event.key === "Escape") {
        closeMobileSidebar();
    }
});

window.addEventListener("hashchange", () => {
    const hashPage = String(
        window.location.hash || ""
    )
        .replace(/^#\/?/, "")
        .trim();

    if (pages.includes(hashPage)) {
        showPage(hashPage);
    }
});

window.toggleSidebar = toggleSidebar;
window.openMobileSidebar = openMobileSidebar;
window.closeMobileSidebar = closeMobileSidebar;
window.updateSidebarStatus = updateSidebarStatus;
