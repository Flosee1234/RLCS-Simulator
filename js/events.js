/* ==========================
   RLCS LEAGUE SIMULATOR
   EVENTS.JS
   Events Workspace V2
========================== */

const DEFAULT_EVENT = {
    id: null,
    name: "Regional 1",
    type: "regional",
    region: "EU",
    split: "1",
    splitEventNumber: "",
    seasonEventId: null,
    seasonId: null,
    seasonName: "",
    createdAt: null
};

const EVENT_FORMAT_DETAILS = {
    roundRobin: {
        title: "Round Robin",
        description: "Every selected team plays every other team.",
        badge: "League"
    },
    playoffs: {
        title: "Single Elimination",
        description: "One loss eliminates a team from the bracket.",
        badge: "Bracket"
    },
    swiss: {
        title: "Swiss Stage",
        description: "Teams play opponents with matching records.",
        badge: "Swiss"
    },
    swissPlayoffs: {
        title: "Swiss + Playoffs",
        description: "Swiss qualification followed by a seeded playoff bracket.",
        badge: "Two Stage"
    },
    groupsHybrid: {
        title: "Groups + Hybrid Playoffs",
        description: "Four groups feed into the hybrid upper and lower playoff.",
        badge: "16 Teams"
    },
    groupsDoubleElim: {
        title: "Groups + Double-Elim",
        description: "Four groups feed into a full double-elimination playoff.",
        badge: "16 Teams"
    },
    doubleElim: {
        title: "Double Elimination",
        description: "Teams must lose twice before leaving the tournament.",
        badge: "Bracket"
    },
    regionalLcq: {
        title: "Regional Worlds LCQ",
        description: "Six teams fight for one place in the Worlds Play-In.",
        badge: "6 Teams"
    },
    worldsPlayIn: {
        title: "Worlds Play-In",
        description: "Eight teams play a qualification bracket with four Main Event places available.",
        badge: "8 → 4"
    },
    custom: {
        title: "Custom Bracket",
        description: "Choose the bracket size, base format, and seeding method.",
        badge: "Flexible"
    }
};

const EVENT_PRESETS = {
    regional: {
        type: "regional",
        format: "swissPlayoffs",
        seriesLength: 5,
        openingSeriesLength: 5,
        playoffSeriesLength: 7
    },
    major: {
        type: "major",
        format: "swissPlayoffs",
        seriesLength: 5,
        openingSeriesLength: 5,
        playoffSeriesLength: 7
    },
    worlds: {
        type: "worlds",
        format: "groupsDoubleElim",
        seriesLength: 7,
        openingSeriesLength: 5,
        playoffSeriesLength: 7
    },
    lcq: {
        type: "lcq",
        format: "regionalLcq",
        seriesLength: 7,
        openingSeriesLength: 7,
        playoffSeriesLength: 7
    },
    playin: {
        type: "playin",
        format: "worldsPlayIn",
        seriesLength: 7,
        openingSeriesLength: 7,
        playoffSeriesLength: 7
    },
    custom: {
        type: "custom",
        format: "playoffs",
        seriesLength: 5,
        openingSeriesLength: 5,
        playoffSeriesLength: 7
    }
};

let activeEvent = {
    ...DEFAULT_EVENT
};

let selectedEventsWorkspaceTab = "create";
let selectedActiveEventView = "overview";
let eventsWorkspaceInterval = null;

/* ==========================
   EVENT FORM
========================== */

function getEventFormData() {
    const nameInput = document.getElementById("eventName");
    const typeInput = document.getElementById("eventType");
    const regionInput = document.getElementById("eventRegion");
    const splitInput = document.getElementById("eventSplit");
    const splitEventNumberInput = document.getElementById(
        "eventSplitEventNumber"
    );
    const formatInput = document.getElementById("tournamentFormat");
    const seriesInput = document.getElementById("seriesFormat");
    const swissSeriesInput = document.getElementById("swissSeriesFormat");
    const playoffSeriesInput = document.getElementById("playoffSeriesFormat");

    const type = typeInput?.value || "regional";
    const region = (
        type === "regional" ||
        type === "lcq"
    )
        ? regionInput?.value || "EU"
        : "GLOBAL";

    const seasonEvent = typeof getCurrentSeasonEvent === "function"
        ? getCurrentSeasonEvent()
        : null;

    const split = (
        type === "worlds" ||
        type === "playin"
    )
        ? "season"
        : seasonEvent?.split || splitInput?.value || "1";

    return {
        id:
            seasonEvent?.id ||
            activeEvent.id ||
            `event-${Date.now()}`,

        name:
            nameInput?.value.trim() ||
            seasonEvent?.name ||
            generateDefaultEventName(type, region),

        type,
        region,
        split: String(split),
        splitEventNumber:
            seasonEvent?.splitEventNumber ||
            splitEventNumberInput?.value ||
            "",

        format:
            formatInput?.value ||
            seasonEvent?.format ||
            "roundRobin",

        seriesLength: Number(
            seriesInput?.value ||
            seasonEvent?.seriesLength ||
            5
        ),

        swissSeriesLength: Number(
            swissSeriesInput?.value ||
            seasonEvent?.swissSeriesLength ||
            seriesInput?.value ||
            5
        ),

        playoffSeriesLength: Number(
            playoffSeriesInput?.value ||
            seasonEvent?.playoffSeriesLength ||
            seriesInput?.value ||
            7
        ),

        seasonEventId: seasonEvent?.id || null,
        seasonId: seasonEvent?.seasonId || null,
        seasonName: seasonEvent?.seasonName || "",

        createdAt:
            activeEvent.createdAt ||
            new Date().toISOString()
    };
}

function generateDefaultEventName(type, region) {
    if (type === "regional") {
        return `${region} Regional`;
    }

    if (type === "major") {
        return "RLCS Major";
    }

    if (type === "worlds") {
        return "World Championship";
    }

    if (type === "playin") {
        return "Worlds Play-In";
    }

    if (type === "lcq") {
        return `${region} Regional Worlds LCQ`;
    }

    return "Custom Event";
}

/* ==========================
   WORKSPACE NAVIGATION
========================== */

function showEventWorkspaceTab(tabName) {
    const validTabs = ["create", "active", "completed"];
    const nextTab = validTabs.includes(tabName)
        ? tabName
        : "create";

    selectedEventsWorkspaceTab = nextTab;

    document.querySelectorAll(".events-workspace-tab")
        .forEach(button => {
            button.classList.toggle(
                "active",
                button.dataset.eventTab === nextTab
            );
        });

    const panels = {
        create: document.getElementById("eventWorkspaceCreate"),
        active: document.getElementById("eventWorkspaceActive"),
        completed: document.getElementById("eventWorkspaceCompleted")
    };

    Object.entries(panels).forEach(([name, panel]) => {
        if (!panel) return;
        panel.classList.toggle("hidden", name !== nextTab);
    });

    if (nextTab === "create") {
        handleEventSettingsChanged();
    }

    if (nextTab === "active") {
        renderActiveEventWorkspace();
    }

    if (nextTab === "completed") {
        renderEventsCompletedList();
    }
}

function showActiveEventView(viewName) {
    const validViews = [
        "overview",
        "matches",
        "standings",
        "bracket",
        "stats"
    ];

    const nextView = validViews.includes(viewName)
        ? viewName
        : "overview";

    selectedActiveEventView = nextView;

    document.querySelectorAll(".active-event-view-tab")
        .forEach(button => {
            button.classList.toggle(
                "active",
                button.dataset.activeEventView === nextView
            );
        });

    validViews.forEach(name => {
        const panel = document.getElementById(
            `activeEventView${capitaliseEventWord(name)}`
        );

        if (panel) {
            panel.classList.toggle("hidden", name !== nextView);
        }
    });
}

/* ==========================
   PRESETS + FORMAT CARDS
========================== */

function applyEventPreset(presetName) {
    if (tournament.running) {
        alert("Finish the active event before changing the event setup.");
        return;
    }

    const preset = EVENT_PRESETS[presetName];
    if (!preset) return;

    setEventInputValue("eventType", preset.type);
    setEventInputValue("tournamentFormat", preset.format);
    setEventInputValue("seriesFormat", preset.seriesLength);
    setEventInputValue("swissSeriesFormat", preset.openingSeriesLength);
    setEventInputValue("playoffSeriesFormat", preset.playoffSeriesLength);

    const region = document.getElementById("eventRegion")?.value || "EU";
    const nameInput = document.getElementById("eventName");

    if (nameInput) {
        nameInput.value = generateDefaultEventName(preset.type, region);
    }

    activeEvent = {
        ...DEFAULT_EVENT,
        id: null,
        type: preset.type,
        region: preset.type === "regional" || preset.type === "lcq"
            ? region
            : "GLOBAL"
    };

    if (!getCurrentSeasonEventSafe()) {
        tournament.selectedTeams = [];
        tournament.seedings = [];
    }

    syncEventPresetButtons(presetName);
    handleEventSettingsChanged();
}

function selectEventFormat(format) {
    if (tournament.running) return;

    const formatInput = document.getElementById("tournamentFormat");
    if (!formatInput) return;

    const allowed = getAllowedEventFormats();
    if (!allowed.includes(format)) return;

    formatInput.value = format;
    handleEventSettingsChanged();
}

function renderEventFormatCards() {
    const container = document.getElementById("eventFormatCards");
    const formatInput = document.getElementById("tournamentFormat");

    if (!container || !formatInput) return;

    const allowed = getAllowedEventFormats();

    container.innerHTML = Object.entries(EVENT_FORMAT_DETAILS)
        .map(([value, detail]) => {
            const isAllowed = allowed.includes(value);
            const isSelected = formatInput.value === value;

            return `
                <button type="button"
                    class="event-format-card ${isSelected ? "selected" : ""} ${!isAllowed ? "disabled" : ""}"
                    onclick="selectEventFormat('${value}')"
                    ${!isAllowed ? "disabled" : ""}>
                    <span class="event-format-badge">
                        ${escapeEventText(detail.badge)}
                    </span>
                    <strong>${escapeEventText(detail.title)}</strong>
                    <span>${escapeEventText(detail.description)}</span>
                    <span class="event-format-check">✓</span>
                </button>
            `;
        })
        .join("");
}

function getAllowedEventFormats() {
    const type = document.getElementById("eventType")?.value || "regional";

    if (typeof getAllowedFormatsForEventType === "function") {
        return getAllowedFormatsForEventType(type);
    }

    if (type === "lcq") return ["regionalLcq"];
    if (type === "playin") return ["worldsPlayIn"];

    return Object.keys(EVENT_FORMAT_DETAILS);
}

function ensureAllowedEventFormat() {
    const input = document.getElementById("tournamentFormat");
    if (!input) return;

    const allowed = getAllowedEventFormats();

    if (!allowed.includes(input.value)) {
        input.value = allowed[0] || "roundRobin";
    }
}

function syncEventPresetButtons(preferredPreset = null) {
    const type = document.getElementById("eventType")?.value || "regional";
    const activePreset = preferredPreset || type;

    document.querySelectorAll(".event-preset-button")
        .forEach(button => {
            button.classList.toggle(
                "active",
                button.dataset.eventPreset === activePreset
            );
        });
}

function syncEventSeriesUi() {
    const format = document.getElementById("tournamentFormat")?.value;
    const stagedFormats = [
        "swissPlayoffs",
        "groupsHybrid",
        "groupsDoubleElim"
    ];

    const stageSettings = document.getElementById("stageSeriesSettings");
    const defaultSetting = document.getElementById("defaultSeriesSetting");
    const openingLabel = document.getElementById("openingStageSeriesLabel");

    const isStaged = stagedFormats.includes(format);

    stageSettings?.classList.toggle("hidden", !isStaged);
    defaultSetting?.classList.toggle("hidden", isStaged);

    if (openingLabel) {
        openingLabel.textContent = format === "swissPlayoffs"
            ? "Swiss Stage Series"
            : "Group Stage Series";
    }
}

/* ==========================
   EVENT SETTINGS CHANGE
========================== */

function handleEventSettingsChanged() {
    updateRegionControlState();
    ensureAllowedEventFormat();

    activeEvent = getEventFormData();

    if (typeof tournament !== "undefined") {
        tournament.manualSeedingOverride = false;
    }

    filterSelectedTeamsForEvent();
    syncEventPresetButtons();
    syncEventSeriesUi();
    renderEventFormatCards();

    if (typeof renderTournamentTeams === "function") {
        renderTournamentTeams();
    }

    if (typeof renderSeedings === "function") {
        renderSeedings();
    }

    updateEventPreview();
    updateEventStartState();
    renderNextSeasonEventShortcut();
}

function updateRegionControlState() {
    const typeInput = document.getElementById("eventType");
    const regionInput = document.getElementById("eventRegion");
    const splitInput = document.getElementById("eventSplit");

    if (!typeInput || !regionInput) return;

    const usesRegion =
        typeInput.value === "regional" ||
        typeInput.value === "lcq";

    regionInput.disabled = !usesRegion;
    regionInput.classList.toggle(
        "disabled-select",
        !usesRegion
    );

    if (splitInput) {
        const isSeasonFinal =
            typeInput.value === "worlds" ||
            typeInput.value === "playin";
        splitInput.disabled = isSeasonFinal;
        splitInput.classList.toggle("disabled-select", isSeasonFinal);
    }
}

function updateEventPreview() {
    activeEvent = getEventFormData();

    const preview = document.getElementById("currentEventPreview");
    if (!preview) return;

    const eligible = getEligibleTeamsForCurrentEvent();
    const validation = getEventSetupValidation();
    const stagedFormats = [
        "swissPlayoffs",
        "groupsHybrid",
        "groupsDoubleElim"
    ];

    const openingStageName = activeEvent.format === "swissPlayoffs"
        ? "Swiss"
        : "Groups";

    const seriesSummary = stagedFormats.includes(activeEvent.format)
        ? `${openingStageName} BO${activeEvent.swissSeriesLength} · Playoffs BO${activeEvent.playoffSeriesLength}`
        : `Best of ${activeEvent.seriesLength}`;

    const selectedCount = tournament.selectedTeams.length;
    const validationClass = validation.valid ? "ready" : "attention";

    preview.innerHTML = `
        <div class="event-preview-hero">
            <span class="event-preview-type">
                ${formatEventType(activeEvent.type)}
            </span>
            <h3>${escapeEventText(activeEvent.name)}</h3>
            <p>${escapeEventText(formatTournamentFormatPreview())}</p>
        </div>

        <div class="event-preview-metrics">
            <div>
                <span>Region</span>
                <strong>${activeEvent.region === "GLOBAL" ? "Global" : escapeEventText(activeEvent.region)}</strong>
            </div>
            <div>
                <span>Split</span>
                <strong>${activeEvent.split === "season" ? "Finals" : `Split ${escapeEventText(activeEvent.split)}`}</strong>
            </div>
            <div>
                <span>Series</span>
                <strong>${escapeEventText(seriesSummary)}</strong>
            </div>
            <div>
                <span>Teams</span>
                <strong>${selectedCount} / ${eligible.length} eligible</strong>
            </div>
        </div>

        ${activeEvent.seasonEventId ? `
            <div class="event-preview-season-link">
                <span>Season Mode</span>
                <strong>Connected to calendar</strong>
            </div>
        ` : ""}

        <div class="event-preview-readiness ${validationClass}">
            <span class="event-readiness-dot"></span>
            <div>
                <strong>${validation.valid ? "Ready to start" : "Setup needs attention"}</strong>
                <span>${escapeEventText(validation.message)}</span>
            </div>
        </div>
    `;
}

/* ==========================
   EVENT TEAM FILTERING
========================== */

function getEligibleTeamsForCurrentEvent() {
    const event = getEventFormData();

    if (
        typeof teams === "undefined" ||
        !Array.isArray(teams) ||
        teams.length === 0
    ) {
        return [];
    }

    if (
        event.type !== "regional" &&
        event.type !== "lcq"
    ) {
        return teams;
    }

    return teams.filter(team => team.region === event.region);
}

function filterSelectedTeamsForEvent() {
    const eligibleIds = new Set(
        getEligibleTeamsForCurrentEvent().map(team => String(team.id))
    );

    tournament.selectedTeams = tournament.selectedTeams.filter(id =>
        eligibleIds.has(String(id))
    );

    tournament.seedings = tournament.seedings.filter(team =>
        eligibleIds.has(String(team.id))
    );
}

function getFilteredEligibleEventTeams() {
    const query = (
        document.getElementById("eventTeamSearch")?.value || ""
    ).trim().toLowerCase();

    const sort = document.getElementById("eventTeamSort")?.value || "rating";

    const list = getEligibleTeamsForCurrentEvent()
        .filter(team => {
            if (!query) return true;

            const playerNames = Array.isArray(team.players)
                ? team.players.map(player => player.name).join(" ")
                : "";

            return `${team.name} ${team.region} ${playerNames}`
                .toLowerCase()
                .includes(query);
        });

    return list.sort((a, b) => {
        if (sort === "name") {
            return String(a.name).localeCompare(String(b.name));
        }

        if (sort === "region") {
            return String(a.region).localeCompare(String(b.region)) ||
                String(a.name).localeCompare(String(b.name));
        }

        return Number(b.rating || 0) - Number(a.rating || 0) ||
            String(a.name).localeCompare(String(b.name));
    });
}

/* ==========================
   TEAM SELECTION RENDER
========================== */

function renderTournamentTeams() {
    const container = document.getElementById("tournamentTeams");
    if (!container) return;

    if (typeof syncSeedings === "function") {
        syncSeedings();
    }

    const event = getEventFormData();
    const eligibleTeams = getFilteredEligibleEventTeams();
    const selectedIdSet = new Set(
        tournament.selectedTeams.map(id => String(id))
    );

    const availableTeams = eligibleTeams.filter(team =>
        !selectedIdSet.has(String(team.id))
    );

    const selectedTeams = tournament.seedings.length
        ? tournament.seedings.filter(team =>
            selectedIdSet.has(String(team.id))
        )
        : eligibleTeams.filter(team =>
            selectedIdSet.has(String(team.id))
        );

    const selectedCounter = document.getElementById("eventSelectedTeamCount");
    if (selectedCounter) {
        selectedCounter.textContent = `${selectedIdSet.size} selected`;
    }

    if (getEligibleTeamsForCurrentEvent().length === 0) {
        container.innerHTML = `
            <div class="event-team-empty">
                <strong>No eligible teams</strong>
                <span>
                    ${event.type === "regional" || event.type === "lcq"
                        ? `Create teams in ${escapeEventText(event.region)} or switch the region.`
                        : "Create teams before building this event."}
                </span>
            </div>
        `;
        updateEventStartState();
        return;
    }

    container.innerHTML = `
        <div class="event-team-column">
            <div class="event-team-column-heading">
                <div>
                    <strong>Available Teams</strong>
                    <span>${availableTeams.length} shown</span>
                </div>
            </div>

            <div class="event-team-list">
                ${availableTeams.length
                    ? availableTeams.map(team => renderEventTeamRow(team, false)).join("")
                    : `
                        <div class="event-team-list-empty">
                            ${eligibleTeams.length === 0
                                ? "No teams match your search."
                                : "Every shown team is selected."}
                        </div>
                    `}
            </div>
        </div>

        <div class="event-team-transfer-mark">→</div>

        <div class="event-team-column selected-column">
            <div class="event-team-column-heading">
                <div>
                    <strong>Selected Field</strong>
                    <span>Click a team to remove it</span>
                </div>
            </div>

            <div class="event-team-list">
                ${selectedTeams.length
                    ? selectedTeams.map((team, index) =>
                        renderEventTeamRow(team, true, index + 1)
                    ).join("")
                    : `
                        <div class="event-team-list-empty">
                            Choose teams from the available list.
                        </div>
                    `}
            </div>
        </div>
    `;

    updateEventStartState();
}

function renderEventTeamRow(team, selected, seedNumber = null) {
    const context = typeof getAutomaticSeedingContext === "function"
        ? getAutomaticSeedingContext()
        : null;

    const points = typeof getAutomaticSeedingPoints === "function"
        ? getAutomaticSeedingPoints(team, context || undefined)
        : 0;

    const pointsLabel = typeof getAutomaticSeedingLabel === "function"
        ? getAutomaticSeedingLabel(context || undefined)
        : "Points";

    return `
        <button type="button"
            class="event-team-row ${selected ? "selected" : ""}"
            onclick="toggleTeamByEventId('${escapeEventAttribute(team.id)}')">

            ${seedNumber !== null
                ? `<span class="event-team-seed">#${seedNumber}</span>`
                : ""}

            ${team.logo
                ? `<img src="${escapeEventAttribute(team.logo)}" class="event-team-logo" alt="">`
                : `<div class="event-team-logo event-team-logo-placeholder"></div>`}

            <span class="event-team-row-info">
                <strong>${escapeEventText(team.name)}</strong>
                <span>
                    ${escapeEventText(team.region)}
                    · ${escapeEventText(pointsLabel)} ${points}
                    · Rating ${Number(team.rating || 0)}
                </span>
            </span>

            <span class="event-team-row-action">
                ${selected ? "−" : "+"}
            </span>
        </button>
    `;
}

function toggleTeamByEventId(rawId) {
    const eligible = getEligibleTeamsForCurrentEvent();
    const team = eligible.find(item => String(item.id) === String(rawId));

    if (!team || typeof toggleTeam !== "function") return;

    toggleTeam(team.id);
    updateEventPreview();
    updateEventStartState();
}

function selectAllEligibleEventTeams() {
    if (tournament.running) return;

    const eligible = getEligibleTeamsForCurrentEvent();
    const seeded = typeof sortTeamsForAutomaticSeeding === "function"
        ? sortTeamsForAutomaticSeeding(eligible)
        : [...eligible].sort((a, b) =>
            Number(b.rating || 0) - Number(a.rating || 0)
        );

    tournament.selectedTeams = seeded.map(team => team.id);
    tournament.seedings = [...seeded];
    tournament.manualSeedingOverride = false;

    refreshEventTeamSelectionUi();
}

function selectTopRatedEventTeams() {
    if (tournament.running) return;

    const eligible = getEligibleTeamsForCurrentEvent();
    const ranked = typeof sortTeamsForAutomaticSeeding === "function"
        ? sortTeamsForAutomaticSeeding(eligible)
        : [...eligible].sort((a, b) =>
            Number(b.rating || 0) - Number(a.rating || 0)
        );

    const count = getRecommendedEventTeamCount(ranked.length);
    const selected = ranked.slice(0, count);

    tournament.selectedTeams = selected.map(team => team.id);
    tournament.seedings = [...selected];
    tournament.manualSeedingOverride = false;

    refreshEventTeamSelectionUi();
}

function clearEventTeamSelection() {
    if (tournament.running) return;

    tournament.selectedTeams = [];
    tournament.seedings = [];
    tournament.manualSeedingOverride = false;

    refreshEventTeamSelectionUi();
}

function refreshEventTeamSelectionUi() {
    renderTournamentTeams();

    if (typeof renderSeedings === "function") {
        renderSeedings();
    }

    updateEventPreview();
    updateEventStartState();
}

function getRecommendedEventTeamCount(eligibleCount) {
    const format = document.getElementById("tournamentFormat")?.value || "roundRobin";

    if (format === "regionalLcq") return Math.min(6, eligibleCount);
    if (format === "worldsPlayIn") return Math.min(8, eligibleCount);
    if (format === "groupsHybrid" || format === "groupsDoubleElim") {
        return Math.min(16, eligibleCount);
    }

    if (format === "custom") {
        return Math.min(
            Number(document.getElementById("customBracketSize")?.value || 8),
            eligibleCount
        );
    }

    if (format === "playoffs" || format === "doubleElim") {
        if (eligibleCount >= 16) return 16;
        if (eligibleCount >= 8) return 8;
        if (eligibleCount >= 4) return 4;
        return eligibleCount;
    }

    return Math.min(16, eligibleCount);
}

/* ==========================
   VALIDATION
========================== */

function getEventSetupValidation() {
    const event = getEventFormData();
    const selectedCount = tournament.selectedTeams.length;
    const eligibleIds = new Set(
        getEligibleTeamsForCurrentEvent().map(team => String(team.id))
    );

    const invalidSelected = tournament.selectedTeams.some(id =>
        !eligibleIds.has(String(id))
    );

    if (!event.name.trim()) {
        return {
            valid: false,
            message: "Enter an event name."
        };
    }

    if (invalidSelected) {
        return {
            valid: false,
            message: "One or more selected teams are not eligible for this event."
        };
    }

    if (
        event.seasonEventId &&
        typeof hasUnresolvedSeasonTiebreakersForEvent === "function" &&
        hasUnresolvedSeasonTiebreakersForEvent(event.seasonEventId)
    ) {
        return {
            valid: false,
            message: "Resolve the points tiebreaker in Season Mode before starting this event."
        };
    }

    if (selectedCount < 2) {
        return {
            valid: false,
            message: "Select at least two teams."
        };
    }

    if (event.format === "regionalLcq" && selectedCount !== 6) {
        return {
            valid: false,
            message: `Regional LCQ requires exactly 6 teams. ${selectedCount} selected.`
        };
    }

    if (event.format === "worldsPlayIn" && selectedCount !== 8) {
        return {
            valid: false,
            message: `Worlds Play-In requires exactly 8 teams. ${selectedCount} selected.`
        };
    }

    if (
        (event.format === "groupsHybrid" ||
        event.format === "groupsDoubleElim") &&
        selectedCount !== 16
    ) {
        return {
            valid: false,
            message: `Group Stage to Playoffs requires exactly 16 teams. ${selectedCount} selected.`
        };
    }

    if (event.format === "custom") {
        const required = Number(
            document.getElementById("customBracketSize")?.value || 8
        );

        if (selectedCount < required) {
            return {
                valid: false,
                message: `Custom bracket needs at least ${required} selected teams. ${selectedCount} selected.`
            };
        }
    }

    if (
        (event.format === "playoffs" || event.format === "doubleElim") &&
        ![4, 8, 16].includes(selectedCount)
    ) {
        return {
            valid: false,
            message: "This bracket requires exactly 4, 8, or 16 teams."
        };
    }

    if (
        (event.format === "swiss" || event.format === "swissPlayoffs") &&
        selectedCount % 2 !== 0
    ) {
        return {
            valid: false,
            message: "Swiss formats require an even number of teams."
        };
    }

    if (event.format === "swiss" && selectedCount < 4) {
        return {
            valid: false,
            message: "Swiss Stage requires at least 4 teams."
        };
    }

    if (event.format === "swissPlayoffs" && selectedCount < 8) {
        return {
            valid: false,
            message: "Swiss + Playoffs requires at least 8 teams."
        };
    }

    return {
        valid: true,
        message: `${selectedCount} teams are ready for ${formatTournamentFormatPreview()}.`
    };
}

function updateEventStartState() {
    const validation = getEventSetupValidation();
    const message = document.getElementById("eventValidationMessage");
    const hint = document.getElementById("eventStartHint");
    const button = document.getElementById("startEventButton");

    if (message) {
        message.textContent = validation.message;
        message.classList.toggle("valid", validation.valid);
        message.classList.toggle("invalid", !validation.valid);
    }

    if (hint) {
        hint.textContent = validation.valid
            ? "Review your seedings, then start the event."
            : "The event cannot start until this requirement is fixed.";
    }

    if (button) {
        button.disabled = !validation.valid || tournament.running;
        button.textContent = tournament.running
            ? "Event Running"
            : "Start Event";
    }
}

/* ==========================
   START EVENT
========================== */

function createEventAndStartTournament() {
    if (tournament.running) {
        alert("An event is already running.");
        showEventWorkspaceTab("active");
        return;
    }

    filterSelectedTeamsForEvent();

    const validation = getEventSetupValidation();

    if (!validation.valid) {
        updateEventStartState();
        alert(validation.message);
        return;
    }

    const formEvent = getEventFormData();

    activeEvent = {
        ...formEvent,
        id: formEvent.seasonEventId || `event-${Date.now()}`,
        createdAt: new Date().toISOString(),
        eventRunId: `event-run-${Date.now()}`
    };

    tournament.currentEvent = {
        ...activeEvent
    };

    tournament.savedToHistory = false;

    updateEventPreview();
    showEventWorkspaceTab("active");
    showActiveEventView("overview");

    startTournament();
    renderActiveEventWorkspace();

    if (
        tournament.running &&
        activeEvent.seasonEventId &&
        typeof markSeasonEventInProgress === "function"
    ) {
        markSeasonEventInProgress(activeEvent.seasonEventId);
    }
}

/* ==========================
   ACTIVE EVENT WORKSPACE
========================== */

function renderActiveEventWorkspace() {
    const empty = document.getElementById("activeEventEmptyState");
    const dashboard = document.getElementById("activeEventDashboard");
    const summary = document.getElementById("activeEventSummary");
    const overview = document.getElementById("activeEventOverview");

    if (!empty || !dashboard) return;

    const event = tournament.currentEvent || null;

    if (!event) {
        empty.classList.remove("hidden");
        dashboard.classList.add("hidden");
        updateEventsPageStatus();
        return;
    }

    empty.classList.add("hidden");
    dashboard.classList.remove("hidden");

    const status = tournament.running
        ? "Running"
        : tournament.champion
        ? "Completed"
        : "Ready";

    const championName = getEventTeamDisplayName(tournament.champion);
    const participantCount = tournament.participants?.length ||
        tournament.seedings?.length ||
        tournament.selectedTeams?.length || 0;

    const matchCount = countRenderedEventMatches();
    const format = event.format || tournament.format || "roundRobin";

    if (summary) {
        summary.innerHTML = `
            <div class="active-event-summary-main">
                <span class="active-event-kicker">${formatEventType(event.type)}</span>
                <h3>${escapeEventText(event.name || "Active Event")}</h3>
                <p>
                    ${escapeEventText(EVENT_FORMAT_DETAILS[format]?.title || formatTournamentFormatPreview())}
                    · ${event.region === "GLOBAL" ? "Global" : escapeEventText(event.region || "Global")}
                </p>
            </div>

            <div class="active-event-summary-status ${status.toLowerCase()}">
                <span class="event-status-dot"></span>
                <div>
                    <span>Status</span>
                    <strong>${status}</strong>
                </div>
            </div>

            <button type="button"
                class="secondary-button"
                onclick="showEventWorkspaceTab('create')"
                ${tournament.running ? "disabled" : ""}>
                ${tournament.running ? "Event in Progress" : "Create Next Event"}
            </button>
        `;
    }

    if (overview) {
        overview.innerHTML = `
            ${renderActiveOverviewMetric("Current Stage", tournament.round || "Setup")}
            ${renderActiveOverviewMetric("Teams", participantCount)}
            ${renderActiveOverviewMetric("Matches Shown", matchCount)}
            ${renderActiveOverviewMetric("Series", getActiveEventSeriesSummary(event))}
            ${renderActiveOverviewMetric("Champion", championName || "TBD", championName ? "highlight" : "")}
            ${renderActiveOverviewMetric("History", tournament.savedToHistory ? "Saved" : tournament.running ? "Pending" : "Waiting")}

            <div class="active-event-overview-note">
                <strong>${tournament.running ? "Simulation in progress" : championName ? "Event complete" : "Event loaded"}</strong>
                <span>
                    ${tournament.running
                        ? "Use the tabs above to watch matches, standings, bracket progression, and player statistics."
                        : championName
                        ? `${escapeEventText(championName)} won the event. Open Completed Events to review the saved result.`
                        : "Start the event from the Create Event tab when the team field is ready."}
                </span>
            </div>
        `;
    }

    if (typeof renderManualResultControl === "function") {
        renderManualResultControl();
    }

    showActiveEventView(selectedActiveEventView);
    updateEventsPageStatus();
}

function renderActiveOverviewMetric(label, value, extraClass = "") {
    return `
        <div class="active-overview-metric ${extraClass}">
            <span>${escapeEventText(label)}</span>
            <strong>${escapeEventText(value)}</strong>
        </div>
    `;
}

function getActiveEventSeriesSummary(event) {
    const format = event.format || tournament.format;

    if (["swissPlayoffs", "groupsHybrid", "groupsDoubleElim"].includes(format)) {
        const opening = event.swissSeriesLength || tournament.stageSeries?.swiss || 5;
        const playoffs = event.playoffSeriesLength || tournament.stageSeries?.playoffs || 7;
        return `BO${opening} / BO${playoffs}`;
    }

    return `BO${event.seriesLength || tournament.seriesLength || 5}`;
}

function countRenderedEventMatches() {
    const feed = document.getElementById("matchFeed");
    if (!feed) return 0;

    return feed.querySelectorAll(
        ".broadcast-match, .match-card, .bracket-match, .team-card"
    ).length;
}

function updateEventsPageStatus() {
    const status = document.getElementById("eventPageStatus");
    const badge = document.getElementById("activeEventTabBadge");

    if (!status) return;

    let text = "No active event";
    let stateClass = "idle";

    if (tournament.currentEvent && tournament.running) {
        text = `${tournament.currentEvent.name || "Event"} is running`;
        stateClass = "running";
    } else if (tournament.currentEvent && tournament.champion) {
        text = `${tournament.currentEvent.name || "Event"} completed`;
        stateClass = "completed";
    } else if (tournament.currentEvent) {
        text = `${tournament.currentEvent.name || "Event"} loaded`;
        stateClass = "ready";
    }

    status.className = `event-page-status ${stateClass}`;
    status.innerHTML = `
        <span class="event-status-dot"></span>
        <span>${escapeEventText(text)}</span>
    `;

    if (badge) {
        const hasEvent = Boolean(tournament.currentEvent);
        badge.classList.toggle("hidden", !hasEvent);
        badge.textContent = tournament.running
            ? "Live"
            : tournament.champion
            ? "Finished"
            : "Ready";
    }
}

/* ==========================
   COMPLETED EVENTS
========================== */

function renderEventsCompletedList() {
    const container = document.getElementById("eventsCompletedList");
    const count = document.getElementById("completedEventCount");

    const history = typeof getTournamentHistory === "function"
        ? getTournamentHistory()
        : [];

    if (count) {
        count.textContent = String(history.length);
    }

    if (!container) return;

    const search = (
        document.getElementById("eventHistorySearch")?.value || ""
    ).trim().toLowerCase();

    const type = document.getElementById("eventHistoryTypeFilter")?.value || "ALL";
    const region = document.getElementById("eventHistoryRegionFilter")?.value || "ALL";
    const split = document.getElementById("eventHistorySplitFilter")?.value || "ALL";

    const filtered = history.filter(record => {
        const event = record.event || {};
        const champion = getEventTeamDisplayName(record.champion);
        const haystack = `${event.name || ""} ${event.region || ""} ${champion || ""}`
            .toLowerCase();

        return (
            (!search || haystack.includes(search)) &&
            (type === "ALL" || event.type === type) &&
            (region === "ALL" || (event.region || "GLOBAL") === region) &&
            (split === "ALL" || String(event.split || "1") === String(split))
        );
    });

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="event-empty-state compact">
                <div class="event-empty-icon">✓</div>
                <h3>No completed events match</h3>
                <p>Change the filters or complete an event first.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = filtered.map(record => {
        const event = record.event || {};
        const champion = getEventTeamDisplayName(record.champion) || "Unknown";
        const format = record.format || record.effectiveFormat || "roundRobin";
        const teamCount = Array.isArray(record.teams) ? record.teams.length : 0;
        const points = Array.isArray(record.pointsAwarded)
            ? record.pointsAwarded.reduce((sum, item) => sum + Number(item.points || 0), 0)
            : 0;

        return `
            <article class="event-completed-card">
                <div class="event-completed-card-top">
                    <span class="event-completed-type">
                        ${formatEventType(event.type)}
                    </span>
                    <span class="event-completed-date">
                        ${escapeEventText(formatCompactEventDate(record.completedAt || record.date))}
                    </span>
                </div>

                <h3>${escapeEventText(event.name || "Completed Event")}</h3>

                <div class="event-completed-champion">
                    <span>Champion</span>
                    <strong>${escapeEventText(champion)}</strong>
                </div>

                <div class="event-completed-meta">
                    <span>${escapeEventText(event.region === "GLOBAL" ? "Global" : event.region || "Global")}</span>
                    <span>${escapeEventText(EVENT_FORMAT_DETAILS[format]?.title || format)}</span>
                    <span>${teamCount} Teams</span>
                    <span>${points} Points</span>
                </div>

                <button type="button"
                    class="event-completed-action"
                    onclick="showPage('history')">
                    View Full Results
                    <span>→</span>
                </button>
            </article>
        `;
    }).join("");
}

function formatCompactEventDate(value) {
    if (!value) return "Completed";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    return date.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric"
    });
}

/* ==========================
   SEASON SHORTCUT
========================== */

function renderNextSeasonEventShortcut() {
    const container = document.getElementById("nextSeasonEventShortcut");
    if (!container) return;

    const current = getCurrentSeasonEventSafe();
    const state = typeof getSeasonState === "function"
        ? getSeasonState()
        : null;

    if (!current && !state) {
        container.classList.add("hidden");
        container.innerHTML = "";
        return;
    }

    container.classList.remove("hidden");

    if (current) {
        container.innerHTML = `
            <div>
                <span class="next-season-label">Loaded from Season Mode</span>
                <strong>${escapeEventText(current.name || "Season Event")}</strong>
                <small>${formatEventType(current.type)} · ${current.region === "GLOBAL" ? "Global" : escapeEventText(current.region || "Global")}</small>
            </div>

            <button type="button"
                class="secondary-button compact-button"
                onclick="showPage('season')">
                View Calendar
            </button>
        `;
        return;
    }

    container.innerHTML = `
        <div>
            <span class="next-season-label">Season Mode</span>
            <strong>Continue your season</strong>
            <small>Load the next available event directly into this creator.</small>
        </div>

        <button type="button"
            class="primary-button compact-button"
            onclick="loadNextSeasonEvent()">
            Load Next Event
        </button>
    `;
}

/* ==========================
   HELPERS
========================== */

function formatEventType(type) {
    if (type === "regional") return "Regional";
    if (type === "major") return "LAN / Major";
    if (type === "worlds") return "World Championship";
    if (type === "playin") return "Worlds Play-In";
    if (type === "lcq") return "Regional Worlds LCQ";
    return "Custom Event";
}

function getSelectedTournamentFormat() {
    return document.getElementById("tournamentFormat")?.value ||
        "roundRobin";
}

function getSelectedSeriesLength() {
    return document.getElementById("seriesFormat")?.value || "5";
}

function formatTournamentFormatPreview() {
    const format = getSelectedTournamentFormat();
    return EVENT_FORMAT_DETAILS[format]?.title || "Custom Format";
}

function getEventTeamDisplayName(value) {
    if (!value) return "";
    if (typeof value === "string") return value;
    return value.name || value.teamName || "";
}

function getCurrentSeasonEventSafe() {
    return typeof getCurrentSeasonEvent === "function"
        ? getCurrentSeasonEvent()
        : null;
}

function setEventInputValue(id, value) {
    const input = document.getElementById(id);
    if (input) input.value = String(value);
}

function capitaliseEventWord(value) {
    return String(value).charAt(0).toUpperCase() + String(value).slice(1);
}

function escapeEventText(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function escapeEventAttribute(value) {
    return escapeEventText(value).replace(/`/g, "&#096;");
}

/* ==========================
   LEGACY PANEL COMPATIBILITY
========================== */

const baseShowTournamentPanelForEvents = window.showTournamentPanel;

window.showTournamentPanel = function (panelId, forceOpen = false) {
    if (typeof baseShowTournamentPanelForEvents === "function") {
        baseShowTournamentPanelForEvents(panelId, forceOpen);
    }

    if (panelId === "eventCreatorPanel" || panelId === "setupPanel") {
        showEventWorkspaceTab("create");
        return;
    }

    const viewByPanel = {
        matchFeedPanel: "matches",
        standingsPanel: "standings",
        bracketPanel: "bracket",
        playerStatsPanel: "stats"
    };

    if (viewByPanel[panelId]) {
        showEventWorkspaceTab("active");
        showActiveEventView(viewByPanel[panelId]);
    }
};

/* ==========================
   EXPORTS + STARTUP
========================== */

window.getEventFormData = getEventFormData;
window.handleEventSettingsChanged = handleEventSettingsChanged;
window.updateEventPreview = updateEventPreview;
window.getEligibleTeamsForCurrentEvent = getEligibleTeamsForCurrentEvent;
window.renderTournamentTeams = renderTournamentTeams;
window.createEventAndStartTournament = createEventAndStartTournament;
window.showEventWorkspaceTab = showEventWorkspaceTab;
window.showActiveEventView = showActiveEventView;
window.applyEventPreset = applyEventPreset;
window.selectEventFormat = selectEventFormat;
window.toggleTeamByEventId = toggleTeamByEventId;
window.selectAllEligibleEventTeams = selectAllEligibleEventTeams;
window.selectTopRatedEventTeams = selectTopRatedEventTeams;
window.clearEventTeamSelection = clearEventTeamSelection;
window.renderEventsCompletedList = renderEventsCompletedList;

window.addEventListener("load", () => {
    setTimeout(() => {
        const watchedIds = [
            "eventName",
            "eventType",
            "eventRegion",
            "eventSplit",
            "tournamentFormat",
            "seriesFormat",
            "swissSeriesFormat",
            "playoffSeriesFormat",
            "customBracketSize",
            "customBaseFormat",
            "customSeedingMethod"
        ];

        watchedIds.forEach(id => {
            const input = document.getElementById(id);
            if (!input || input.dataset.eventsListenerAttached === "true") return;

            input.dataset.eventsListenerAttached = "true";
            input.addEventListener(
                id === "eventName" ? "input" : "change",
                handleEventSettingsChanged
            );
        });

        updateRegionControlState();
        showEventWorkspaceTab("create");
        showActiveEventView("overview");
        handleEventSettingsChanged();
        renderActiveEventWorkspace();
        renderEventsCompletedList();
        updateEventsPageStatus();

        ["matchFeed", "standings", "bracketContainer", "playerStats"]
            .forEach(id => {
                const target = document.getElementById(id);
                if (!target) return;

                const observer = new MutationObserver(() => {
                    renderActiveEventWorkspace();
                });

                observer.observe(target, {
                    childList: true,
                    subtree: true,
                    characterData: true
                });
            });

        if (eventsWorkspaceInterval) {
            clearInterval(eventsWorkspaceInterval);
        }

        eventsWorkspaceInterval = setInterval(() => {
            updateEventsPageStatus();
            updateEventStartState();

            if (selectedEventsWorkspaceTab === "active") {
                renderActiveEventWorkspace();
            }

            if (selectedEventsWorkspaceTab === "completed") {
                renderEventsCompletedList();
            } else {
                const count = document.getElementById("completedEventCount");
                if (count && typeof getTournamentHistory === "function") {
                    count.textContent = String(getTournamentHistory().length);
                }
            }
        }, 900);
    }, 650);
});
