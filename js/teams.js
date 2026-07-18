/* ==========================
   RLCS LEAGUE SIMULATOR
   TEAM CREATOR V2
========================== */

let teams = [];

const TEAM_STORAGE_KEY = "rlcsTeams";
const TEAM_LAST_REGION_KEY = "rlcsLastTeamRegion";
const TEAM_LAST_RATING_KEY = "rlcsLastPlayerRating";
const DEFAULT_PLAYER_RATING = 75;
const VALID_TEAM_REGIONS = [
    "NA",
    "EU",
    "SAM",
    "MENA",
    "OCE",
    "APAC",
    "SSA"
];

let editingTeamId = null;
let pendingTeamLogo = "";
let teamFormAttemptedSubmit = false;
let teamCreatorInitialised = false;

/* ==========================
   STARTUP
========================== */

window.addEventListener("load", () => {
    initialiseTeamCreator();
    loadTeams();
    resetTeamForm({
        preserveRegion: true,
        focusName: false
    });
});

function initialiseTeamCreator() {
    if (teamCreatorInitialised) return;

    const inputIds = [
        "teamName",
        "teamRegion",
        "player1Name",
        "player1Rating",
        "player2Name",
        "player2Rating",
        "player3Name",
        "player3Rating"
    ];

    inputIds.forEach(id => {
        const element = document.getElementById(id);

        if (!element) return;

        element.addEventListener("input", updateTeamFormState);
        element.addEventListener("change", updateTeamFormState);
    });

    document
        .getElementById("teamSearchInput")
        ?.addEventListener("input", renderTeams);

    document
        .getElementById("teamRegionFilter")
        ?.addEventListener("change", renderTeams);

    document
        .getElementById("teamLogo")
        ?.addEventListener("change", handleTeamLogoInput);

    document
        .getElementById("bulkTeamInput")
        ?.addEventListener("input", renderBulkTeamPreview);

    const dropZone = document.getElementById("teamLogoDropZone");

    if (dropZone) {
        dropZone.addEventListener("dragover", event => {
            event.preventDefault();
            dropZone.classList.add("dragging");
        });

        dropZone.addEventListener("dragleave", () => {
            dropZone.classList.remove("dragging");
        });

        dropZone.addEventListener("drop", event => {
            event.preventDefault();
            dropZone.classList.remove("dragging");

            const file = Array.from(event.dataTransfer?.files || [])
                .find(item => item.type.startsWith("image/"));

            if (file) {
                processTeamLogoFile(file);
            }
        });

        dropZone.addEventListener("paste", event => {
            const file = Array.from(event.clipboardData?.files || [])
                .find(item => item.type.startsWith("image/"));

            if (!file) return;

            event.preventDefault();
            processTeamLogoFile(file);
        });

        dropZone.addEventListener("click", () => {
            document.getElementById("teamLogo")?.click();
        });

        dropZone.addEventListener("keydown", event => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                document.getElementById("teamLogo")?.click();
            }
        });
    }

    teamCreatorInitialised = true;
}

/* ==========================
   CREATE / UPDATE TEAM
========================== */

function createTeam() {
    submitTeamForm(false);
}

function saveAndCreateNextTeam() {
    submitTeamForm(true);
}

function submitTeamForm(createNext) {
    teamFormAttemptedSubmit = true;

    const formData = getTeamFormData();
    const validation = validateTeamForm(formData);

    displayTeamFormValidation(validation, formData);

    if (!validation.valid) {
        setTeamFormNotice(
            "Fix the highlighted fields before saving.",
            "error"
        );
        return;
    }

    const currentTeam = editingTeamId === null
        ? null
        : getTeamById(editingTeamId);

    if (currentTeam) {
        const existingPlayers = Array.isArray(currentTeam.players)
            ? currentTeam.players
            : [];

        const previousRosterSignature =
            typeof getTeamRosterSignature === "function"
                ? getTeamRosterSignature(currentTeam)
                : JSON.stringify(
                    existingPlayers.map(player => ({
                        id: player.id || null,
                        name: player.name || ""
                    }))
                );

        currentTeam.name = formData.name;
        currentTeam.region = formData.region;
        currentTeam.logo = formData.logo;
        currentTeam.players = formData.players.map((player, index) => ({
            id:
                existingPlayers[index]?.id ||
                createPlayerId(currentTeam.id, index, player.name),
            name: player.name,
            rating: player.rating
        }));

        recalculateTeamRating(currentTeam);

        const nextRosterSignature =
            typeof getTeamRosterSignature === "function"
                ? getTeamRosterSignature(currentTeam)
                : JSON.stringify(
                    currentTeam.players.map(player => ({
                        id: player.id || null,
                        name: player.name || ""
                    }))
                );

        if (
            previousRosterSignature !==
            nextRosterSignature &&
            typeof resetTeamFormAfterRosterChange ===
                "function"
        ) {
            resetTeamFormAfterRosterChange(
                currentTeam,
                "Roster edited in Team Creator"
            );
        }

        saveTeams();
        refreshTeamDependentViews();

        setTeamFormNotice(
            `${currentTeam.name} was updated.`,
            "success"
        );

        resetTeamForm({
            preserveRegion: true,
            focusName: true
        });

        return;
    }

    const teamId = createTeamId();

    const team = {
        id: teamId,
        name: formData.name,
        region: formData.region,
        rating: 0,
        logo: formData.logo,
        players: formData.players.map((player, index) => ({
            id: createPlayerId(teamId, index, player.name),
            name: player.name,
            rating: player.rating
        }))
    };

    recalculateTeamRating(team);
    teams.push(team);

    localStorage.setItem(
        TEAM_LAST_REGION_KEY,
        formData.region
    );

    localStorage.setItem(
        TEAM_LAST_RATING_KEY,
        String(
            Math.round(
                formData.players.reduce(
                    (sum, player) => sum + player.rating,
                    0
                ) / formData.players.length
            )
        )
    );

    saveTeams();
    refreshTeamDependentViews();

    const savedName = team.name;

    resetTeamForm({
        preserveRegion: true,
        preserveRatings: createNext,
        focusName: true
    });

    setTeamFormNotice(
        createNext
            ? `${savedName} was created. The form is ready for the next team.`
            : `${savedName} was created successfully.`,
        "success"
    );
}

/* Legacy helper retained for compatibility. */
function saveTeam(name, region, rating, logo, players) {
    const teamId = createTeamId();

    const team = {
        id: teamId,
        name: String(name || "").trim(),
        region: VALID_TEAM_REGIONS.includes(region) ? region : "NA",
        rating: Number(rating || 0),
        logo: String(logo || ""),
        players: normaliseRosterPlayers(players, teamId)
    };

    recalculateTeamRating(team);
    teams.push(team);
    saveTeams();
    refreshTeamDependentViews();
    resetTeamForm({ preserveRegion: true });

    return team;
}

/* ==========================
   EDIT / DUPLICATE / DELETE
========================== */

function editTeam(id) {
    const team = getTeamById(id);
    if (!team) return;

    editingTeamId = team.id;
    teamFormAttemptedSubmit = false;

    setInputValue("teamName", team.name);
    setInputValue("teamRegion", team.region);

    for (let index = 0; index < 3; index++) {
        const player = team.players[index] || {
            name: "",
            rating: DEFAULT_PLAYER_RATING
        };

        setInputValue(`player${index + 1}Name`, player.name);
        setInputValue(`player${index + 1}Rating`, player.rating);
    }

    pendingTeamLogo = team.logo || "";
    setInputValue("teamLogoUrl", "");
    renderTeamLogoPreview();
    updateTeamFormMode();
    updateTeamFormState();
    setTeamFormNotice(
        `Editing ${team.name}. Player identities will be preserved.`,
        "info"
    );

    document
        .getElementById("teamBuilderPanel")
        ?.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });

    document.getElementById("teamName")?.focus();
}

function duplicateTeam(id) {
    const team = getTeamById(id);
    if (!team) return;

    editingTeamId = null;
    teamFormAttemptedSubmit = false;

    setInputValue("teamName", `${team.name} Copy`);
    setInputValue("teamRegion", team.region);

    for (let index = 0; index < 3; index++) {
        const player = team.players[index] || {
            name: "",
            rating: DEFAULT_PLAYER_RATING
        };

        setInputValue(`player${index + 1}Name`, player.name);
        setInputValue(`player${index + 1}Rating`, player.rating);
    }

    pendingTeamLogo = team.logo || "";
    setInputValue("teamLogoUrl", "");
    renderTeamLogoPreview();
    updateTeamFormMode();
    updateTeamFormState();
    setTeamFormNotice(
        `Creating a copy of ${team.name}. Change the team or player names before saving.`,
        "info"
    );

    document
        .getElementById("teamBuilderPanel")
        ?.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });

    document.getElementById("teamName")?.select();
}

function cancelTeamEdit() {
    resetTeamForm({
        preserveRegion: true,
        focusName: true
    });
}

function deleteTeam(id) {
    const team = getTeamById(id);
    if (!team) return;

    const confirmed = confirm(
        `Delete ${team.name}? This cannot be undone.`
    );

    if (!confirmed) return;

    teams = teams.filter(
        item => String(item.id) !== String(team.id)
    );

    if (typeof removeStoredTeamForm === "function") {
        removeStoredTeamForm(team.id);
    }

    if (
        editingTeamId !== null &&
        String(editingTeamId) === String(team.id)
    ) {
        resetTeamForm({
            preserveRegion: true
        });
    }

    saveTeams();
    refreshTeamDependentViews();
}

/* ==========================
   TEAM LIST
========================== */

function renderTeams() {
    const grid = document.getElementById("teamGrid");
    if (!grid) return;

    const searchTerm = String(
        document.getElementById("teamSearchInput")?.value || ""
    )
        .trim()
        .toLowerCase();

    const regionFilter = String(
        document.getElementById("teamRegionFilter")?.value || "all"
    );

    const filteredTeams = teams
        .filter(team => {
            const matchesRegion =
                regionFilter === "all" ||
                team.region === regionFilter;

            if (!matchesRegion) return false;
            if (!searchTerm) return true;

            const playerNames = (team.players || [])
                .map(player => player.name)
                .join(" ");

            return `${team.name} ${team.region} ${playerNames}`
                .toLowerCase()
                .includes(searchTerm);
        })
        .slice()
        .sort((a, b) =>
            String(a.name).localeCompare(String(b.name))
        );

    const summary = document.getElementById("teamListSummary");

    if (summary) {
        summary.textContent = filteredTeams.length === teams.length
            ? `${teams.length} team${teams.length === 1 ? "" : "s"}`
            : `${filteredTeams.length} of ${teams.length} teams`;
    }

    if (teams.length === 0) {
        grid.innerHTML = `
            <div class="team-list-empty">
                <strong>No teams created yet</strong>
                <span>Use the quick creator to add your first roster.</span>
            </div>
        `;
        return;
    }

    if (filteredTeams.length === 0) {
        grid.innerHTML = `
            <div class="team-list-empty">
                <strong>No matching teams</strong>
                <span>Change the search or region filter.</span>
            </div>
        `;
        return;
    }

    grid.innerHTML = filteredTeams.map(team => {
        const teamIdArgument = JSON.stringify(team.id);
        const players = Array.isArray(team.players)
            ? team.players
            : [];

        return `
            <article class="team-list-card ${
                editingTeamId !== null &&
                String(editingTeamId) === String(team.id)
                    ? "editing"
                    : ""
            }">
                <div class="team-list-card-main">
                    ${renderTeamLogo(team)}

                    <div class="team-list-card-details">
                        <div class="team-list-card-heading">
                            <div>
                                <strong>${escapeTeamText(team.name)}</strong>
                                <span>${escapeTeamText(team.region)}</span>
                            </div>

                            <div class="team-rating-pill">
                                ${Number(team.rating || 0)}
                            </div>
                        </div>

                        <div class="team-list-roster">
                            ${players.map(player => `
                                <span>
                                    ${escapeTeamText(player.name)}
                                    <b>${Number(player.rating || 0)}</b>
                                </span>
                            `).join("")}
                        </div>
                    </div>
                </div>

                <div class="team-list-actions">
                    <button class="secondary-button compact-button"
                        onclick='editTeam(${teamIdArgument})'>
                        Edit
                    </button>

                    <button class="secondary-button compact-button"
                        onclick='duplicateTeam(${teamIdArgument})'>
                        Duplicate
                    </button>

                    <button class="danger-button compact-button"
                        onclick='deleteTeam(${teamIdArgument})'>
                        Delete
                    </button>
                </div>
            </article>
        `;
    }).join("");
}

function renderTeamLogo(team) {
    if (team.logo) {
        return `
            <img
                src="${escapeTeamAttribute(team.logo)}"
                alt="${escapeTeamAttribute(team.name)} logo"
                class="team-list-logo">
        `;
    }

    const initials = String(team.name || "T")
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map(part => part.charAt(0).toUpperCase())
        .join("");

    return `
        <div class="team-list-logo team-list-logo-placeholder">
            ${escapeTeamText(initials || "T")}
        </div>
    `;
}

/* ==========================
   FORM STATE / VALIDATION
========================== */

function getTeamFormData() {
    const players = [1, 2, 3].map(index => ({
        name: String(
            document.getElementById(`player${index}Name`)?.value || ""
        ).trim(),
        rating: Number(
            document.getElementById(`player${index}Rating`)?.value
        )
    }));

    return {
        name: String(
            document.getElementById("teamName")?.value || ""
        ).trim(),
        region: String(
            document.getElementById("teamRegion")?.value || "NA"
        ),
        logo: pendingTeamLogo || "",
        players
    };
}

function validateTeamForm(formData) {
    const errors = {
        teamName: "",
        player1: "",
        player2: "",
        player3: ""
    };

    if (!formData.name) {
        errors.teamName = "Enter a team name.";
    } else {
        const duplicateTeam = teams.find(team =>
            String(team.name || "").trim().toLowerCase() ===
                formData.name.toLowerCase() &&
            (
                editingTeamId === null ||
                String(team.id) !== String(editingTeamId)
            )
        );

        if (duplicateTeam) {
            errors.teamName = "A team with this name already exists.";
        }
    }

    const currentTeam = editingTeamId === null
        ? null
        : getTeamById(editingTeamId);

    const currentPlayerIds = new Set(
        (currentTeam?.players || []).map(player => String(player.id))
    );

    const usedPlayerNames = new Set();

    formData.players.forEach((player, index) => {
        const key = `player${index + 1}`;

        if (!player.name) {
            errors[key] = "Enter a player name.";
            return;
        }

        if (
            !Number.isFinite(player.rating) ||
            player.rating < 1 ||
            player.rating > 100
        ) {
            errors[key] = "Rating must be between 1 and 100.";
            return;
        }

        const normalisedName = player.name.toLowerCase();

        if (usedPlayerNames.has(normalisedName)) {
            errors[key] = "Player names must be unique within the roster.";
            return;
        }

        usedPlayerNames.add(normalisedName);

        const duplicatePlayer = teams
            .flatMap(team => (team.players || []).map(existingPlayer => ({
                team,
                player: existingPlayer
            })))
            .find(item =>
                String(item.player.name || "").trim().toLowerCase() ===
                    normalisedName &&
                !currentPlayerIds.has(String(item.player.id))
            );

        if (duplicatePlayer) {
            errors[key] = `${player.name} already belongs to ${duplicatePlayer.team.name}.`;
        }
    });

    return {
        valid: Object.values(errors).every(message => !message),
        errors
    };
}

function updateTeamFormState() {
    const formData = getTeamFormData();
    const validation = validateTeamForm(formData);

    updateLiveTeamRating(formData.players);
    displayTeamFormValidation(validation, formData);

    const saveButton = document.getElementById("saveTeamButton");
    const saveNextButton = document.getElementById("saveNextTeamButton");

    if (saveButton) {
        saveButton.disabled = !validation.valid;
    }

    if (saveNextButton) {
        saveNextButton.disabled = !validation.valid;
    }
}

function displayTeamFormValidation(validation, formData) {
    setErrorText(
        "teamNameError",
        shouldShowFieldError(formData.name, validation.errors.teamName)
            ? validation.errors.teamName
            : ""
    );

    formData.players.forEach((player, index) => {
        const error = validation.errors[`player${index + 1}`];
        const shouldShow = Boolean(error) && (
            teamFormAttemptedSubmit ||
            Boolean(player.name) ||
            error.includes("already") ||
            error.includes("unique")
        );

        setErrorText(
            `player${index + 1}Error`,
            shouldShow ? error : ""
        );
    });
}

function shouldShowFieldError(hasInput, error) {
    return Boolean(error) && (
        teamFormAttemptedSubmit ||
        Boolean(hasInput) ||
        error.includes("already") ||
        error.includes("unique")
    );
}

function updateLiveTeamRating(players) {
    const validRatings = players
        .map(player => Number(player.rating))
        .filter(rating =>
            Number.isFinite(rating) &&
            rating >= 1 &&
            rating <= 100
        );

    const rating = validRatings.length === 3
        ? Math.round(
            validRatings.reduce((sum, value) => sum + value, 0) /
            validRatings.length
        )
        : "--";

    const ratingElement = document.getElementById("liveTeamRating");
    const ratingFill = document.getElementById("liveTeamRatingFill");

    if (ratingElement) {
        ratingElement.textContent = String(rating);
    }

    if (ratingFill) {
        ratingFill.style.width = rating === "--"
            ? "0%"
            : `${rating}%`;
    }
}

function updateTeamFormMode() {
    const editing = editingTeamId !== null;

    const title = document.getElementById("teamFormTitle");
    const description = document.getElementById("teamFormDescription");
    const saveButton = document.getElementById("saveTeamButton");
    const saveNextButton = document.getElementById("saveNextTeamButton");
    const cancelButton = document.getElementById("cancelTeamEditButton");

    if (title) {
        title.textContent = editing ? "Edit Team" : "Quick Create Team";
    }

    if (description) {
        description.textContent = editing
            ? "Update the selected roster without changing its player identities."
            : "Create a complete three-player roster in one clean form.";
    }

    if (saveButton) {
        saveButton.textContent = editing ? "Save Changes" : "Save Team";
    }

    if (saveNextButton) {
        saveNextButton.classList.toggle("hidden", editing);
    }

    if (cancelButton) {
        cancelButton.classList.toggle("hidden", !editing);
    }
}

function resetTeamForm(options = {}) {
    const preserveRegion = options.preserveRegion !== false;
    const preserveRatings = options.preserveRatings === true;
    const focusName = options.focusName === true;

    const currentRegion = preserveRegion
        ? String(
            document.getElementById("teamRegion")?.value ||
            localStorage.getItem(TEAM_LAST_REGION_KEY) ||
            "NA"
        )
        : "NA";

    const lastRating = preserveRatings
        ? getLastUsedPlayerRating()
        : getLastUsedPlayerRating();

    editingTeamId = null;
    pendingTeamLogo = "";
    teamFormAttemptedSubmit = false;

    setInputValue("teamName", "");
    setInputValue("teamRegion", currentRegion);
    setInputValue("teamLogo", "");
    setInputValue("teamLogoUrl", "");
    setInputValue("rosterPasteInput", "");

    for (let index = 1; index <= 3; index++) {
        setInputValue(`player${index}Name`, "");
        setInputValue(`player${index}Rating`, lastRating);
        setErrorText(`player${index}Error`, "");
    }

    setErrorText("teamNameError", "");
    renderTeamLogoPreview();
    updateTeamFormMode();
    updateTeamFormState();
    renderTeams();

    if (focusName) {
        setTimeout(() => {
            document.getElementById("teamName")?.focus();
        }, 0);
    }
}

function clearForm() {
    resetTeamForm({
        preserveRegion: true
    });
}

function getLastUsedPlayerRating() {
    const value = Number(
        localStorage.getItem(TEAM_LAST_RATING_KEY)
    );

    return Number.isFinite(value) && value >= 1 && value <= 100
        ? value
        : DEFAULT_PLAYER_RATING;
}

/* ==========================
   ROSTER PASTE
========================== */

function fillRosterFromPaste() {
    const textarea = document.getElementById("rosterPasteInput");
    if (!textarea) return;

    const parsedPlayers = parseRosterText(textarea.value);

    if (parsedPlayers.length === 0) {
        setTeamFormNotice(
            "Paste one player per line, such as: Player Name, 82",
            "error"
        );
        return;
    }

    parsedPlayers.slice(0, 3).forEach((player, index) => {
        setInputValue(`player${index + 1}Name`, player.name);
        setInputValue(`player${index + 1}Rating`, player.rating);
    });

    teamFormAttemptedSubmit = false;
    updateTeamFormState();

    setTeamFormNotice(
        `${Math.min(parsedPlayers.length, 3)} player${
            Math.min(parsedPlayers.length, 3) === 1 ? "" : "s"
        } added to the roster.`,
        "success"
    );
}

function parseRosterText(text) {
    return String(text || "")
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean)
        .map(line => parsePlayerEntry(line))
        .filter(Boolean);
}

function parsePlayerEntry(value) {
    const text = String(value || "").trim();
    if (!text) return null;

    const match = text.match(
        /^(.*?)(?:\s*[|,:;]\s*)(\d{1,3}(?:\.\d+)?)$/
    );

    if (!match) {
        return {
            name: text,
            rating: getLastUsedPlayerRating()
        };
    }

    return {
        name: match[1].trim(),
        rating: Math.max(
            1,
            Math.min(100, Number(match[2]))
        )
    };
}

/* ==========================
   BULK TEAM CREATOR
========================== */

function renderBulkTeamPreview() {
    const input = document.getElementById("bulkTeamInput");
    const preview = document.getElementById("bulkTeamPreview");
    const createButton = document.getElementById("createBulkTeamsButton");

    if (!input || !preview) return;

    const parsed = parseBulkTeams(input.value);

    if (parsed.rows.length === 0) {
        preview.innerHTML = `
            <p class="small">
                Format: Team Name | Region | Player 1:80 | Player 2:80 | Player 3:80
            </p>
        `;

        if (createButton) {
            createButton.disabled = true;
        }

        return;
    }

    const validCount = parsed.rows.filter(row => row.valid).length;
    const errorCount = parsed.rows.length - validCount;

    preview.innerHTML = `
        <div class="bulk-preview-summary ${errorCount ? "has-errors" : "valid"}">
            <strong>${validCount} valid team${validCount === 1 ? "" : "s"}</strong>
            <span>${errorCount} error${errorCount === 1 ? "" : "s"}</span>
        </div>

        <div class="bulk-preview-list">
            ${parsed.rows.map((row, index) => `
                <div class="bulk-preview-row ${row.valid ? "valid" : "invalid"}">
                    <span>${index + 1}</span>
                    <div>
                        <strong>${escapeTeamText(row.name || "Invalid row")}</strong>
                        <small>
                            ${row.valid
                                ? `${escapeTeamText(row.region)} | ${row.players
                                    .map(player => `${escapeTeamText(player.name)} (${player.rating})`)
                                    .join(" | ")}`
                                : escapeTeamText(row.errors.join(" "))
                            }
                        </small>
                    </div>
                </div>
            `).join("")}
        </div>
    `;

    if (createButton) {
        createButton.disabled = errorCount > 0 || validCount === 0;
    }
}

function parseBulkTeams(text) {
    const existingTeamNames = new Set(
        teams.map(team => String(team.name || "").trim().toLowerCase())
    );

    const existingPlayerNames = new Set(
        teams.flatMap(team =>
            (team.players || []).map(player =>
                String(player.name || "").trim().toLowerCase()
            )
        )
    );

    const batchTeamNames = new Set();
    const batchPlayerNames = new Set();

    const rows = String(text || "")
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean)
        .map(line => {
            const parts = line
                .split("|")
                .map(part => part.trim());

            const name = parts[0] || "";
            const region = String(parts[1] || "").toUpperCase();
            const players = parts.slice(2, 5)
                .map(part => parsePlayerEntry(part))
                .filter(Boolean);

            const errors = [];
            const normalisedTeamName = name.toLowerCase();

            if (!name) {
                errors.push("Missing team name.");
            } else if (
                existingTeamNames.has(normalisedTeamName) ||
                batchTeamNames.has(normalisedTeamName)
            ) {
                errors.push("Team name already exists.");
            }

            if (!VALID_TEAM_REGIONS.includes(region)) {
                errors.push("Use a valid region: NA, EU, SAM, MENA, OCE, APAC or SSA.");
            }

            if (players.length !== 3) {
                errors.push("Exactly three players are required.");
            }

            const rowPlayerNames = new Set();

            players.forEach(player => {
                const normalisedPlayerName = player.name.toLowerCase();

                if (!player.name) {
                    errors.push("Every player needs a name.");
                }

                if (
                    !Number.isFinite(player.rating) ||
                    player.rating < 1 ||
                    player.rating > 100
                ) {
                    errors.push(`${player.name || "Player"} needs a rating from 1 to 100.`);
                }

                if (
                    rowPlayerNames.has(normalisedPlayerName) ||
                    existingPlayerNames.has(normalisedPlayerName) ||
                    batchPlayerNames.has(normalisedPlayerName)
                ) {
                    errors.push(`${player.name} is duplicated.`);
                }

                rowPlayerNames.add(normalisedPlayerName);
            });

            if (name) {
                batchTeamNames.add(normalisedTeamName);
            }

            players.forEach(player => {
                if (player.name) {
                    batchPlayerNames.add(player.name.toLowerCase());
                }
            });

            return {
                name,
                region,
                players,
                errors,
                valid: errors.length === 0
            };
        });

    return { rows };
}

function createBulkTeams() {
    const input = document.getElementById("bulkTeamInput");
    if (!input) return;

    const parsed = parseBulkTeams(input.value);
    const invalidRows = parsed.rows.filter(row => !row.valid);

    if (parsed.rows.length === 0) {
        alert("Paste at least one team first.");
        return;
    }

    if (invalidRows.length > 0) {
        alert("Fix every bulk creator error before creating the teams.");
        renderBulkTeamPreview();
        return;
    }

    parsed.rows.forEach(row => {
        const teamId = createTeamId();

        const team = {
            id: teamId,
            name: row.name,
            region: row.region,
            rating: 0,
            logo: "",
            players: row.players.map((player, index) => ({
                id: createPlayerId(teamId, index, player.name),
                name: player.name,
                rating: player.rating
            }))
        };

        recalculateTeamRating(team);
        teams.push(team);
    });

    saveTeams();
    refreshTeamDependentViews();

    const createdCount = parsed.rows.length;
    input.value = "";
    renderBulkTeamPreview();

    setTeamFormNotice(
        `${createdCount} teams were created successfully.`,
        "success"
    );
}

function insertBulkTeamExample() {
    const input = document.getElementById("bulkTeamInput");
    if (!input) return;

    input.value = [
        "Example Alpha | EU | Player One:82 | Player Two:79 | Player Three:84",
        "Example Bravo | NA | Player Four:80 | Player Five:83 | Player Six:78"
    ].join("\n");

    renderBulkTeamPreview();
}

/* ==========================
   LOGO HANDLING
========================== */

function handleTeamLogoInput(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    processTeamLogoFile(file);
}

async function processTeamLogoFile(file) {
    if (!file.type.startsWith("image/")) {
        setTeamFormNotice("Select an image file for the team logo.", "error");
        return;
    }

    try {
        setTeamFormNotice("Optimising logo...", "info");
        pendingTeamLogo = await optimiseTeamLogo(file);
        setInputValue("teamLogoUrl", "");
        renderTeamLogoPreview();
        setTeamFormNotice("Logo added and resized for storage.", "success");
    } catch (error) {
        console.error("Failed to process team logo:", error);
        setTeamFormNotice("The selected logo could not be processed.", "error");
    }
}

function optimiseTeamLogo(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onerror = () => reject(reader.error);

        reader.onload = () => {
            const image = new Image();

            image.onerror = () => reject(new Error("Image could not be loaded."));

            image.onload = () => {
                const maximumSize = 256;
                const scale = Math.min(
                    1,
                    maximumSize / Math.max(image.width, image.height)
                );

                const width = Math.max(1, Math.round(image.width * scale));
                const height = Math.max(1, Math.round(image.height * scale));

                const canvas = document.createElement("canvas");
                canvas.width = width;
                canvas.height = height;

                const context = canvas.getContext("2d");

                if (!context) {
                    reject(new Error("Canvas is unavailable."));
                    return;
                }

                context.clearRect(0, 0, width, height);
                context.drawImage(image, 0, 0, width, height);

                let result = canvas.toDataURL("image/webp", 0.86);

                if (!result.startsWith("data:image/webp")) {
                    result = canvas.toDataURL("image/png");
                }

                resolve(result);
            };

            image.src = String(reader.result || "");
        };

        reader.readAsDataURL(file);
    });
}

function useTeamLogoUrl() {
    const input = document.getElementById("teamLogoUrl");
    const value = String(input?.value || "").trim();

    if (!value) {
        setTeamFormNotice("Paste a logo URL first.", "error");
        return;
    }

    pendingTeamLogo = value;
    setInputValue("teamLogo", "");
    renderTeamLogoPreview();
    setTeamFormNotice("Logo URL added.", "success");
}

function removeTeamLogo() {
    pendingTeamLogo = "";
    setInputValue("teamLogo", "");
    setInputValue("teamLogoUrl", "");
    renderTeamLogoPreview();
}

function renderTeamLogoPreview() {
    const image = document.getElementById("teamLogoPreview");
    const placeholder = document.getElementById("teamLogoPlaceholder");
    const removeButton = document.getElementById("removeTeamLogoButton");

    if (image) {
        image.src = pendingTeamLogo || "";
        image.classList.toggle("hidden", !pendingTeamLogo);
    }

    if (placeholder) {
        placeholder.classList.toggle("hidden", Boolean(pendingTeamLogo));
    }

    if (removeButton) {
        removeButton.classList.toggle("hidden", !pendingTeamLogo);
    }
}

/* ==========================
   STORAGE / NORMALISATION
========================== */

function saveTeams() {
    normaliseAllTeamRosters();

    localStorage.setItem(
        TEAM_STORAGE_KEY,
        JSON.stringify(teams)
    );
}

function loadTeams() {
    const savedTeams = localStorage.getItem(TEAM_STORAGE_KEY);

    if (savedTeams) {
        try {
            teams = JSON.parse(savedTeams) || [];
        } catch (error) {
            console.error("Failed to load teams:", error);
            teams = [];
        }
    }

    const changed = normaliseAllTeamRosters();

    if (changed) {
        localStorage.setItem(
            TEAM_STORAGE_KEY,
            JSON.stringify(teams)
        );
    }

    renderTeams();
    updateTeamFormState();
}

function createTeamId() {
    let id = Date.now();

    while (teams.some(team => String(team.id) === String(id))) {
        id += 1;
    }

    return id;
}

function createPlayerId(teamId, index, name) {
    const safeName = String(name || "player")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

    const randomPart = Math.random()
        .toString(36)
        .slice(2, 8);

    return `player-${teamId}-${index + 1}-${safeName || "unknown"}-${randomPart}`;
}

function normaliseRosterPlayers(players, teamId) {
    return (Array.isArray(players) ? players : [])
        .slice(0, 3)
        .map((player, index) => ({
            id:
                player.id ||
                createPlayerId(teamId, index, player.name),
            name: String(player.name || `Player ${index + 1}`).trim(),
            rating: Math.max(
                1,
                Math.min(100, Number(player.rating || 50))
            )
        }));
}

function recalculateTeamRating(team) {
    if (!team) return 0;

    team.players = normaliseRosterPlayers(
        team.players,
        team.id
    );

    if (team.players.length === 0) {
        team.rating = 0;
        return team.rating;
    }

    team.rating = Math.round(
        team.players.reduce(
            (sum, player) => sum + Number(player.rating || 0),
            0
        ) / team.players.length
    );

    return team.rating;
}

function normaliseAllTeamRosters() {
    let changed = false;

    teams.forEach(team => {
        const before = JSON.stringify({
            players: team.players,
            rating: team.rating
        });

        team.players = normaliseRosterPlayers(
            team.players,
            team.id
        );

        recalculateTeamRating(team);

        const after = JSON.stringify({
            players: team.players,
            rating: team.rating
        });

        if (before !== after) {
            changed = true;
        }
    });

    return changed;
}

function refreshTeamDependentViews() {
    renderTeams();

    if (typeof renderTournamentTeams === "function") {
        renderTournamentTeams();
    }

    if (typeof renderSeedings === "function") {
        renderSeedings();
    }

    if (typeof renderTeamProfiles === "function") {
        renderTeamProfiles();
    }

    if (typeof renderLeagueTable === "function") {
        renderLeagueTable();
    }

    if (typeof renderTransfers === "function") {
        renderTransfers();
    }

    if (typeof updateDashboard === "function") {
        updateDashboard();
    }
}

/* ==========================
   SMALL HELPERS
========================== */

function getTeamById(id) {
    return teams.find(team =>
        String(team.id) === String(id)
    ) || null;
}

function setInputValue(id, value) {
    const element = document.getElementById(id);
    if (!element) return;

    element.value = value ?? "";
}

function setErrorText(id, value) {
    const element = document.getElementById(id);
    if (!element) return;

    element.textContent = value || "";
    element.classList.toggle("visible", Boolean(value));
}

function setTeamFormNotice(message, type = "info") {
    const element = document.getElementById("teamFormNotice");
    if (!element) return;

    element.textContent = message || "";
    element.className = `team-form-notice ${type}`;
    element.classList.toggle("hidden", !message);
}

function escapeTeamText(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function escapeTeamAttribute(value) {
    return escapeTeamText(value).replace(/`/g, "&#096;");
}

window.createTeam = createTeam;
window.saveAndCreateNextTeam = saveAndCreateNextTeam;
window.saveTeam = saveTeam;
window.editTeam = editTeam;
window.duplicateTeam = duplicateTeam;
window.cancelTeamEdit = cancelTeamEdit;
window.deleteTeam = deleteTeam;
window.fillRosterFromPaste = fillRosterFromPaste;
window.createBulkTeams = createBulkTeams;
window.insertBulkTeamExample = insertBulkTeamExample;
window.useTeamLogoUrl = useTeamLogoUrl;
window.removeTeamLogo = removeTeamLogo;
window.saveTeams = saveTeams;
window.loadTeams = loadTeams;
window.recalculateTeamRating = recalculateTeamRating;
window.normaliseRosterPlayers = normaliseRosterPlayers;
window.normaliseAllTeamRosters = normaliseAllTeamRosters;
window.refreshTeamDependentViews = refreshTeamDependentViews;
window.renderTeams = renderTeams;
