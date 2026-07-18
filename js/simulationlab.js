/* ==========================
   RLCS LEAGUE SIMULATOR
   SIMULATION LAB + CHEMISTRY
========================== */

const TEAM_CHEMISTRY_STORAGE_KEY = "rlcsTeamChemistryV1";
const MANUAL_RESULT_QUEUE_LIMIT = 50;

const TEAM_CHEMISTRY_PRESETS = {
    off: {
        maximumBonus: 0,
        eventGrowth: 0,
        seriesGrowth: 0
    },
    light: {
        maximumBonus: 0.75,
        eventGrowth: 0.18,
        seriesGrowth: 0.012
    },
    balanced: {
        maximumBonus: 1.5,
        eventGrowth: 0.30,
        seriesGrowth: 0.022
    },
    strong: {
        maximumBonus: 2.25,
        eventGrowth: 0.42,
        seriesGrowth: 0.032
    }
};

/* ==========================
   CHEMISTRY STORAGE
========================== */

function createEmptyTournamentChemistryContext() {
    return {
        eventRunId: null,
        teams: {},
        finalised: false
    };
}

function getChemistrySettings() {
    const simulationSettings =
        typeof getSimulationSettings === "function"
            ? getSimulationSettings()
            : {};

    const importance = TEAM_CHEMISTRY_PRESETS[
        simulationSettings.chemistryImportance
    ]
        ? simulationSettings.chemistryImportance
        : "balanced";

    return {
        importance,
        ...TEAM_CHEMISTRY_PRESETS[importance]
    };
}

function getStoredTeamChemistryState() {
    try {
        const parsed = JSON.parse(
            localStorage.getItem(
                TEAM_CHEMISTRY_STORAGE_KEY
            ) || "{}"
        );

        return parsed && typeof parsed === "object"
            ? parsed
            : {};
    } catch (error) {
        console.error("Failed to read team chemistry.", error);
        return {};
    }
}

function saveStoredTeamChemistryState(state) {
    try {
        localStorage.setItem(
            TEAM_CHEMISTRY_STORAGE_KEY,
            JSON.stringify(state || {})
        );
    } catch (error) {
        console.error("Failed to save team chemistry.", error);
    }
}

function getChemistryRosterSignature(team) {
    if (typeof getTeamRosterSignature === "function") {
        return getTeamRosterSignature(team);
    }

    return (team?.players || [])
        .map(player => `${player.id || ""}:${String(player.name || "").toLowerCase()}`)
        .join("|");
}

function resetTeamChemistryAfterRosterChange(
    team,
    reason = "Roster changed"
) {
    if (!team?.id) return;

    const state = getStoredTeamChemistryState();

    state[String(team.id)] = {
        teamId: team.id,
        rosterSignature: getChemistryRosterSignature(team),
        eventsCompleted: 0,
        seriesPlayed: 0,
        resetAt: new Date().toISOString(),
        resetReason: reason,
        lastUpdated: new Date().toISOString()
    };

    saveStoredTeamChemistryState(state);

    if (typeof tournament !== "undefined" && tournament?.chemistry?.teams) {
        delete tournament.chemistry.teams[String(team.id)];
    }
}

function removeStoredTeamChemistry(teamId) {
    const state = getStoredTeamChemistryState();
    delete state[String(teamId)];
    saveStoredTeamChemistryState(state);
}

function buildInitialChemistryFromHistory(team, rosterSignature) {
    let history = [];

    try {
        history = JSON.parse(
            localStorage.getItem("rlcsTournamentHistory") || "[]"
        );
    } catch {
        history = [];
    }

    const matchingEvents = history.filter(record => {
        const snapshot = (record.teams || []).find(item =>
            String(item.id) === String(team.id)
        );

        return Boolean(
            snapshot &&
            getChemistryRosterSignature(snapshot) === rosterSignature
        );
    });

    let seriesPlayed = 0;

    matchingEvents.forEach(record => {
        const formEntry = (record.form?.teams || []).find(item =>
            String(item.teamId) === String(team.id)
        );

        if (formEntry) {
            seriesPlayed +=
                Number(formEntry.wins || 0) +
                Number(formEntry.losses || 0);
        }
    });

    return {
        eventsCompleted: matchingEvents.length,
        seriesPlayed
    };
}

function getPersistentTeamChemistry(team) {
    const allState = getStoredTeamChemistryState();
    const key = String(team.id);
    const rosterSignature = getChemistryRosterSignature(team);
    let entry = allState[key];

    if (!entry) {
        const initial = buildInitialChemistryFromHistory(
            team,
            rosterSignature
        );

        entry = {
            teamId: team.id,
            rosterSignature,
            eventsCompleted: initial.eventsCompleted,
            seriesPlayed: initial.seriesPlayed,
            createdAt: new Date().toISOString(),
            lastUpdated: new Date().toISOString()
        };

        allState[key] = entry;
        saveStoredTeamChemistryState(allState);
    } else if (entry.rosterSignature !== rosterSignature) {
        entry = {
            teamId: team.id,
            rosterSignature,
            eventsCompleted: 0,
            seriesPlayed: 0,
            resetAt: new Date().toISOString(),
            resetReason: "Roster signature changed",
            lastUpdated: new Date().toISOString()
        };

        allState[key] = entry;
        saveStoredTeamChemistryState(allState);
    }

    return {
        ...entry,
        eventsCompleted: Math.max(0, Number(entry.eventsCompleted || 0)),
        seriesPlayed: Math.max(0, Number(entry.seriesPlayed || 0))
    };
}

function getCurrentChemistryEventRunId() {
    return (
        tournament?.currentEvent?.eventRunId ||
        tournament?.currentEvent?.seasonEventId ||
        tournament?.currentEvent?.id ||
        "unsaved-event"
    );
}

function ensureTournamentChemistryContext() {
    const eventRunId = getCurrentChemistryEventRunId();

    if (
        !tournament.chemistry ||
        tournament.chemistry.eventRunId !== eventRunId
    ) {
        tournament.chemistry = createEmptyTournamentChemistryContext();
        tournament.chemistry.eventRunId = eventRunId;
    }

    return tournament.chemistry;
}

function calculateChemistryBonus(eventsCompleted, seriesPlayed) {
    const settings = getChemistrySettings();

    if (settings.importance === "off") return 0;

    return roundChemistry(
        Math.min(
            settings.maximumBonus,
            Math.max(0, Number(eventsCompleted || 0)) * settings.eventGrowth +
            Math.max(0, Number(seriesPlayed || 0)) * settings.seriesGrowth
        )
    );
}

function getChemistryStatus(bonus, eventsCompleted = 0) {
    const settings = getChemistrySettings();

    if (settings.importance === "off") return "Disabled";
    if (eventsCompleted <= 0 && bonus < 0.25) return "New Roster";
    if (bonus < settings.maximumBonus * 0.35) return "Developing";
    if (bonus < settings.maximumBonus * 0.75) return "Established";
    return "Excellent Chemistry";
}

function getTournamentChemistryEntry(team) {
    const context = ensureTournamentChemistryContext();
    const key = String(team.id);

    if (!context.teams[key]) {
        const persistent = getPersistentTeamChemistry(team);

        context.teams[key] = {
            teamId: team.id,
            teamName: team.name,
            rosterSignature: getChemistryRosterSignature(team),
            startingEventsCompleted: persistent.eventsCompleted,
            startingSeriesPlayed: persistent.seriesPlayed,
            liveSeriesPlayed: 0,
            bonus: calculateChemistryBonus(
                persistent.eventsCompleted,
                persistent.seriesPlayed
            )
        };
    }

    return context.teams[key];
}

function getTeamChemistrySnapshot(team, includeLive = true) {
    if (!team) {
        return {
            enabled: false,
            bonus: 0,
            status: "Unknown",
            eventsCompleted: 0,
            seriesPlayed: 0
        };
    }

    const settings = getChemistrySettings();
    const persistent = getPersistentTeamChemistry(team);
    const contextEntry = tournament?.chemistry?.teams?.[String(team.id)];
    const liveSeries = includeLive
        ? Number(contextEntry?.liveSeriesPlayed || 0)
        : 0;
    const totalSeries = persistent.seriesPlayed + liveSeries;
    const bonus = calculateChemistryBonus(
        persistent.eventsCompleted,
        totalSeries
    );

    return {
        enabled: settings.importance !== "off",
        importance: settings.importance,
        bonus,
        status: getChemistryStatus(
            bonus,
            persistent.eventsCompleted
        ),
        eventsCompleted: persistent.eventsCompleted,
        seriesPlayed: totalSeries,
        resetAt: persistent.resetAt || null,
        resetReason: persistent.resetReason || ""
    };
}

function prepareSeriesChemistry(teamA, teamB) {
    const settings = getChemistrySettings();
    const entryA = getTournamentChemistryEntry(teamA);
    const entryB = getTournamentChemistryEntry(teamB);

    const bonusA = calculateChemistryBonus(
        entryA.startingEventsCompleted,
        entryA.startingSeriesPlayed + entryA.liveSeriesPlayed
    );
    const bonusB = calculateChemistryBonus(
        entryB.startingEventsCompleted,
        entryB.startingSeriesPlayed + entryB.liveSeriesPlayed
    );

    return {
        enabled: settings.importance !== "off",
        importance: settings.importance,
        teamA: {
            entry: entryA,
            bonusBefore: bonusA,
            statusBefore: getChemistryStatus(
                bonusA,
                entryA.startingEventsCompleted
            )
        },
        teamB: {
            entry: entryB,
            bonusBefore: bonusB,
            statusBefore: getChemistryStatus(
                bonusB,
                entryB.startingEventsCompleted
            )
        }
    };
}

function applySeriesChemistryResult(prepared) {
    [prepared.teamA, prepared.teamB].forEach(item => {
        if (item?.entry) {
            item.entry.liveSeriesPlayed =
                Number(item.entry.liveSeriesPlayed || 0) + 1;
        }
    });

    return {
        teamA: createSeriesChemistrySnapshot(prepared.teamA),
        teamB: createSeriesChemistrySnapshot(prepared.teamB)
    };
}

function createSeriesChemistrySnapshot(preparedTeam) {
    const entry = preparedTeam.entry;
    const bonusAfter = calculateChemistryBonus(
        entry.startingEventsCompleted,
        entry.startingSeriesPlayed + entry.liveSeriesPlayed
    );

    return {
        bonusBefore: roundChemistry(preparedTeam.bonusBefore || 0),
        bonusAfter,
        statusBefore: preparedTeam.statusBefore || "New Roster",
        statusAfter: getChemistryStatus(
            bonusAfter,
            entry.startingEventsCompleted
        ),
        eventsCompleted: entry.startingEventsCompleted,
        seriesPlayed:
            entry.startingSeriesPlayed + entry.liveSeriesPlayed
    };
}

function finaliseTournamentChemistryForHistory(
    placements = [],
    event = {}
) {
    const context = ensureTournamentChemistryContext();

    if (context.finalised) {
        return createTournamentChemistryHistorySummary(context);
    }

    const allState = getStoredTeamChemistryState();

    (tournament.participants || []).forEach(team => {
        const entry = getTournamentChemistryEntry(team);
        const key = String(team.id);
        const existing = getPersistentTeamChemistry(team);
        const nextEvents = Number(existing.eventsCompleted || 0) + 1;
        const nextSeries =
            Number(existing.seriesPlayed || 0) +
            Number(entry.liveSeriesPlayed || 0);

        const placement = placements.find(item =>
            String(item.teamId) === String(team.id)
        );

        allState[key] = {
            teamId: team.id,
            rosterSignature: getChemistryRosterSignature(team),
            eventsCompleted: nextEvents,
            seriesPlayed: nextSeries,
            lastEventRunId: context.eventRunId,
            lastEventName:
                event.name ||
                tournament.currentEvent?.name ||
                "Tournament",
            lastPlacement: Number(placement?.placement || 0),
            lastUpdated: new Date().toISOString()
        };

        entry.finalBonus = calculateChemistryBonus(
            nextEvents,
            nextSeries
        );
        entry.finalStatus = getChemistryStatus(
            entry.finalBonus,
            nextEvents
        );
    });

    saveStoredTeamChemistryState(allState);
    context.finalised = true;

    return createTournamentChemistryHistorySummary(context);
}

function createTournamentChemistryHistorySummary(context) {
    return {
        eventRunId: context.eventRunId,
        teams: Object.values(context.teams || {}).map(entry => ({
            teamId: entry.teamId,
            teamName: entry.teamName,
            bonusBefore: calculateChemistryBonus(
                entry.startingEventsCompleted,
                entry.startingSeriesPlayed
            ),
            bonusAfter: roundChemistry(
                entry.finalBonus ?? calculateChemistryBonus(
                    entry.startingEventsCompleted,
                    entry.startingSeriesPlayed + entry.liveSeriesPlayed
                )
            ),
            statusBefore: getChemistryStatus(
                calculateChemistryBonus(
                    entry.startingEventsCompleted,
                    entry.startingSeriesPlayed
                ),
                entry.startingEventsCompleted
            ),
            statusAfter:
                entry.finalStatus ||
                getChemistryStatus(
                    entry.finalBonus || 0,
                    entry.startingEventsCompleted + 1
                ),
            seriesPlayed: Number(entry.liveSeriesPlayed || 0),
            eventsCompleted: Number(entry.startingEventsCompleted || 0) + 1
        }))
    };
}

function roundChemistry(value) {
    return Math.round(Number(value || 0) * 100) / 100;
}

/* ==========================
   MANUAL RESULT QUEUE
========================== */

function getManualResultQueue() {
    if (!Array.isArray(tournament.manualResults)) {
        tournament.manualResults = [];
    }

    return tournament.manualResults;
}

function queueManualSeriesOverride() {
    if (!tournament.currentEvent) {
        alert("Load or create an event first.");
        return;
    }

    const teamAId = document.getElementById("manualResultTeamA")?.value;
    const teamBId = document.getElementById("manualResultTeamB")?.value;
    const scoreA = Number(
        document.getElementById("manualResultScoreA")?.value
    );
    const scoreB = Number(
        document.getElementById("manualResultScoreB")?.value
    );

    if (!teamAId || !teamBId || teamAId === teamBId) {
        alert("Choose two different teams.");
        return;
    }

    if (
        !Number.isInteger(scoreA) ||
        !Number.isInteger(scoreB) ||
        scoreA < 0 ||
        scoreB < 0 ||
        scoreA === scoreB
    ) {
        alert("Enter a valid non-tied series score.");
        return;
    }

    const maximumWins = Math.max(scoreA, scoreB);
    const requiredWins = Math.ceil(
        Number(tournament.seriesLength || 5) / 2
    );

    if (maximumWins !== requiredWins) {
        alert(
            `For the current BO${tournament.seriesLength || 5}, the winner must reach ${requiredWins} games.`
        );
        return;
    }

    const teamA = getManualResultTeam(teamAId);
    const teamB = getManualResultTeam(teamBId);

    if (!teamA || !teamB) {
        alert("One of the selected teams could not be found.");
        return;
    }

    const queue = getManualResultQueue();

    queue.push({
        id: `manual-result-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        eventRunId: getCurrentChemistryEventRunId(),
        teamAId: teamA.id,
        teamBId: teamB.id,
        teamAName: teamA.name,
        teamBName: teamB.name,
        scoreA,
        scoreB,
        createdAt: new Date().toISOString()
    });

    tournament.manualResults = queue.slice(
        -MANUAL_RESULT_QUEUE_LIMIT
    );

    renderManualResultControl();
}

function getManualResultTeam(teamId) {
    return (tournament.participants || [])
        .concat(typeof teams !== "undefined" ? teams : [])
        .find(team => String(team.id) === String(teamId)) || null;
}

function consumeManualSeriesOverride(
    teamA,
    teamB,
    seriesLength
) {
    const queue = getManualResultQueue();
    const index = queue.findIndex(item => {
        const direct =
            String(item.teamAId) === String(teamA.id) &&
            String(item.teamBId) === String(teamB.id);
        const reverse =
            String(item.teamAId) === String(teamB.id) &&
            String(item.teamBId) === String(teamA.id);

        return (
            (direct || reverse) &&
            String(item.eventRunId) ===
                String(getCurrentChemistryEventRunId())
        );
    });

    if (index === -1) return null;

    const [item] = queue.splice(index, 1);
    const direct =
        String(item.teamAId) === String(teamA.id);
    const gamesNeeded = Math.ceil(Number(seriesLength || 5) / 2);
    let scoreA = direct ? item.scoreA : item.scoreB;
    let scoreB = direct ? item.scoreB : item.scoreA;

    if (Math.max(scoreA, scoreB) !== gamesNeeded) {
        const teamAWon = scoreA > scoreB;
        const loserScore = Math.min(
            gamesNeeded - 1,
            Math.max(0, Math.min(scoreA, scoreB))
        );

        scoreA = teamAWon ? gamesNeeded : loserScore;
        scoreB = teamAWon ? loserScore : gamesNeeded;
    }

    setTimeout(renderManualResultControl, 0);

    return {
        ...item,
        scoreA,
        scoreB
    };
}

function buildManualGameWinnerSequence(scoreA, scoreB) {
    const sequence = [];
    let remainingA = Number(scoreA || 0);
    let remainingB = Number(scoreB || 0);
    const winner = remainingA > remainingB ? "A" : "B";

    while (remainingA > 0 || remainingB > 0) {
        const shouldUseA =
            remainingA > 0 &&
            (
                remainingB === 0 ||
                (sequence.length % 2 === 0 && winner !== "A") ||
                (sequence.length % 2 === 1 && winner === "A")
            );

        if (shouldUseA) {
            sequence.push("A");
            remainingA--;
        } else if (remainingB > 0) {
            sequence.push("B");
            remainingB--;
        }
    }

    const clinchingIndex = sequence.lastIndexOf(winner);

    if (clinchingIndex !== sequence.length - 1) {
        sequence.splice(clinchingIndex, 1);
        sequence.push(winner);
    }

    return sequence;
}

function deleteManualResultOverride(resultId) {
    tournament.manualResults = getManualResultQueue().filter(item =>
        String(item.id) !== String(resultId)
    );

    renderManualResultControl();
}

function renderManualResultControl() {
    const container = document.getElementById("manualResultControl");
    if (!container) return;

    const participants = tournament.participants || [];
    const queue = getManualResultQueue().filter(item =>
        String(item.eventRunId) ===
        String(getCurrentChemistryEventRunId())
    );

    if (!tournament.currentEvent || participants.length < 2) {
        container.innerHTML = "";
        container.classList.add("hidden");
        return;
    }

    container.classList.remove("hidden");

    const options = participants.map(team => `
        <option value="${escapeSimulationLabAttribute(team.id)}">
            ${escapeSimulationLabText(team.name)}
        </option>
    `).join("");

    const requiredWins = Math.ceil(
        Number(tournament.seriesLength || 5) / 2
    );

    container.innerHTML = `
        <div class="manual-result-card">
            <div class="manual-result-heading">
                <div>
                    <span>Result Control</span>
                    <h4>Queue a Manual Match Result</h4>
                    <p>
                        The override is consumed only when these teams next meet.
                        Form still reacts to the entered result.
                    </p>
                </div>
                <strong>BO${Number(tournament.seriesLength || 5)}</strong>
            </div>

            <div class="manual-result-grid">
                <select id="manualResultTeamA">${options}</select>
                <input id="manualResultScoreA"
                    type="number"
                    min="0"
                    max="${requiredWins}"
                    value="${requiredWins}">
                <span class="manual-result-versus">vs</span>
                <input id="manualResultScoreB"
                    type="number"
                    min="0"
                    max="${Math.max(0, requiredWins - 1)}"
                    value="${Math.max(0, requiredWins - 1)}">
                <select id="manualResultTeamB">${options}</select>
                <button type="button"
                    class="secondary-button"
                    onclick="queueManualSeriesOverride()">
                    Queue Result
                </button>
            </div>

            <div class="manual-result-queue">
                ${queue.length === 0
                    ? `<span class="small">No manual results queued.</span>`
                    : queue.map(item => `
                        <div class="manual-result-queue-item">
                            <span>
                                ${escapeSimulationLabText(item.teamAName)}
                                <strong>${item.scoreA}-${item.scoreB}</strong>
                                ${escapeSimulationLabText(item.teamBName)}
                            </span>
                            <button type="button"
                                onclick="deleteManualResultOverride('${escapeSimulationLabAttribute(item.id)}')">
                                Remove
                            </button>
                        </div>
                    `).join("")}
            </div>
        </div>
    `;

    const teamASelect = document.getElementById("manualResultTeamA");
    const teamBSelect = document.getElementById("manualResultTeamB");

    if (teamASelect && teamBSelect && participants.length > 1) {
        teamASelect.value = String(participants[0].id);
        teamBSelect.value = String(participants[1].id);
    }
}

/* ==========================
   SIMULATION LAB
========================== */

function renderSimulationLab() {
    renderSimulationLabTeamOptions();
    renderSimulationLabTeamBreakdowns();
}

function renderSimulationLabTeamOptions() {
    const selectA = document.getElementById("simulationLabTeamA");
    const selectB = document.getElementById("simulationLabTeamB");

    if (!selectA || !selectB) return;

    const savedA = selectA.value;
    const savedB = selectB.value;
    const availableTeams = typeof teams !== "undefined" && Array.isArray(teams) ? teams : [];
    const options = availableTeams.map(team => `
        <option value="${escapeSimulationLabAttribute(team.id)}">
            ${escapeSimulationLabText(team.name)} · ${escapeSimulationLabText(team.region)} · ${Number(team.rating || 0)}
        </option>
    `).join("");

    selectA.innerHTML = options || `<option value="">No teams created</option>`;
    selectB.innerHTML = options || `<option value="">No teams created</option>`;

    restoreSimulationLabSelection(selectA, savedA, 0);
    restoreSimulationLabSelection(selectB, savedB, 1);

    if (selectA.value === selectB.value && availableTeams.length > 1) {
        selectB.value = String(availableTeams[1].id);
    }
}

function restoreSimulationLabSelection(select, savedValue, fallbackIndex) {
    const hasSaved = Array.from(select.options).some(option =>
        option.value === String(savedValue)
    );

    if (hasSaved) {
        select.value = String(savedValue);
    } else if (select.options[fallbackIndex]) {
        select.value = select.options[fallbackIndex].value;
    }
}

function getSimulationLabTeam(selectId) {
    const id = document.getElementById(selectId)?.value;
    return (typeof teams !== "undefined" ? teams : []).find(team =>
        String(team.id) === String(id)
    ) || null;
}

function getSimulationLabProfile(team, useForm, useChemistry) {
    const form = useForm && typeof getTeamCurrentForm === "function"
        ? getTeamCurrentForm(team)
        : {
            previousForm: 0,
            liveForm: 0,
            totalForm: 0
        };

    const chemistry = useChemistry
        ? getTeamChemistrySnapshot(team, true)
        : {
            bonus: 0,
            status: "Ignored",
            eventsCompleted: 0,
            seriesPlayed: 0
        };

    const baseRating = Number(team?.rating || 50);
    const formAdjustment = Number(form.totalForm || 0);
    const chemistryAdjustment = Number(chemistry.bonus || 0);

    return {
        team,
        baseRating,
        form,
        chemistry,
        effectiveRating: roundChemistry(
            baseRating + formAdjustment + chemistryAdjustment
        )
    };
}

function renderSimulationLabTeamBreakdowns() {
    const container = document.getElementById("simulationLabBreakdown");
    if (!container) return;

    const teamA = getSimulationLabTeam("simulationLabTeamA");
    const teamB = getSimulationLabTeam("simulationLabTeamB");
    const useForm = document.getElementById("simulationLabUseForm")?.checked !== false;
    const useChemistry = document.getElementById("simulationLabUseChemistry")?.checked !== false;

    if (!teamA || !teamB) {
        container.innerHTML = `<p class="small">Create at least two teams to use the laboratory.</p>`;
        return;
    }

    const profileA = getSimulationLabProfile(teamA, useForm, useChemistry);
    const profileB = getSimulationLabProfile(teamB, useForm, useChemistry);
    const chanceA = typeof calculateWinProbability === "function"
        ? calculateWinProbability(
            profileA.effectiveRating,
            profileB.effectiveRating
        )
        : 0.5;

    container.innerHTML = `
        ${renderSimulationLabProfileCard(profileA, chanceA * 100)}
        ${renderSimulationLabProfileCard(profileB, (1 - chanceA) * 100)}
    `;
}

function renderSimulationLabProfileCard(profile, gameChance) {
    return `
        <article class="simulation-lab-profile-card">
            <div class="simulation-lab-profile-head">
                ${profile.team.logo
                    ? `<img src="${escapeSimulationLabAttribute(profile.team.logo)}" alt="">`
                    : `<div class="simulation-lab-logo-placeholder"></div>`}
                <div>
                    <span>${escapeSimulationLabText(profile.team.region)}</span>
                    <h4>${escapeSimulationLabText(profile.team.name)}</h4>
                </div>
            </div>

            <dl>
                <div><dt>Base rating</dt><dd>${profile.baseRating}</dd></div>
                <div><dt>Form</dt><dd>${formatSimulationAdjustment(profile.form.totalForm)}</dd></div>
                <div><dt>Chemistry</dt><dd>${formatSimulationAdjustment(profile.chemistry.bonus)}</dd></div>
                <div><dt>Effective</dt><dd>${profile.effectiveRating}</dd></div>
                <div><dt>Chemistry status</dt><dd>${escapeSimulationLabText(profile.chemistry.status)}</dd></div>
                <div><dt>Per-game chance</dt><dd>${roundChemistry(gameChance)}%</dd></div>
            </dl>
        </article>
    `;
}

function runSimulationLaboratory() {
    const teamA = getSimulationLabTeam("simulationLabTeamA");
    const teamB = getSimulationLabTeam("simulationLabTeamB");
    const resultContainer = document.getElementById("simulationLabResults");

    if (!teamA || !teamB || teamA.id === teamB.id) {
        alert("Choose two different teams.");
        return;
    }

    const seriesLength = Number(
        document.getElementById("simulationLabSeries")?.value || 7
    );
    const simulations = Math.min(
        20000,
        Math.max(
            10,
            Number(document.getElementById("simulationLabRuns")?.value || 1000)
        )
    );
    const useForm = document.getElementById("simulationLabUseForm")?.checked !== false;
    const useChemistry = document.getElementById("simulationLabUseChemistry")?.checked !== false;
    const profileA = getSimulationLabProfile(teamA, useForm, useChemistry);
    const profileB = getSimulationLabProfile(teamB, useForm, useChemistry);
    const gameProbabilityA = typeof calculateWinProbability === "function"
        ? calculateWinProbability(
            profileA.effectiveRating,
            profileB.effectiveRating
        )
        : 0.5;
    const requiredWins = Math.ceil(seriesLength / 2);

    let winsA = 0;
    let winsB = 0;
    let totalScoreA = 0;
    let totalScoreB = 0;
    let sweepsA = 0;
    let sweepsB = 0;
    const scorelines = {};

    for (let run = 0; run < simulations; run++) {
        let scoreA = 0;
        let scoreB = 0;

        while (scoreA < requiredWins && scoreB < requiredWins) {
            if (Math.random() < gameProbabilityA) {
                scoreA++;
            } else {
                scoreB++;
            }
        }

        totalScoreA += scoreA;
        totalScoreB += scoreB;

        if (scoreA > scoreB) {
            winsA++;
            if (scoreB === 0) sweepsA++;
        } else {
            winsB++;
            if (scoreA === 0) sweepsB++;
        }

        const scoreKey = `${scoreA}-${scoreB}`;
        scorelines[scoreKey] = Number(scorelines[scoreKey] || 0) + 1;
    }

    const sortedScorelines = Object.entries(scorelines)
        .sort((a, b) => b[1] - a[1]);

    if (resultContainer) {
        resultContainer.innerHTML = `
            <div class="simulation-lab-results-header">
                <div>
                    <span>${simulations.toLocaleString()} simulated BO${seriesLength} series</span>
                    <h3>${escapeSimulationLabText(teamA.name)} vs ${escapeSimulationLabText(teamB.name)}</h3>
                </div>
                <strong>${roundChemistry(gameProbabilityA * 100)}% per-game chance for ${escapeSimulationLabText(teamA.name)}</strong>
            </div>

            <div class="simulation-lab-metrics">
                ${renderSimulationLabMetric(
                    `${teamA.name} series wins`,
                    `${roundChemistry(winsA / simulations * 100)}%`
                )}
                ${renderSimulationLabMetric(
                    `${teamB.name} series wins`,
                    `${roundChemistry(winsB / simulations * 100)}%`
                )}
                ${renderSimulationLabMetric(
                    "Average score",
                    `${roundChemistry(totalScoreA / simulations)}-${roundChemistry(totalScoreB / simulations)}`
                )}
                ${renderSimulationLabMetric(
                    "Sweep rate",
                    `${roundChemistry((sweepsA + sweepsB) / simulations * 100)}%`
                )}
            </div>

            <div class="simulation-lab-scorelines">
                <h4>Most common scorelines</h4>
                ${sortedScorelines.map(([score, count]) => `
                    <div class="simulation-lab-scoreline-row">
                        <span>${score}</span>
                        <div><i style="width:${Math.max(2, count / simulations * 100)}%"></i></div>
                        <strong>${roundChemistry(count / simulations * 100)}%</strong>
                    </div>
                `).join("")}
            </div>
        `;
    }
}

function renderSimulationLabMetric(label, value) {
    return `
        <div class="simulation-lab-metric">
            <span>${escapeSimulationLabText(label)}</span>
            <strong>${escapeSimulationLabText(value)}</strong>
        </div>
    `;
}

function swapSimulationLabTeams() {
    const selectA = document.getElementById("simulationLabTeamA");
    const selectB = document.getElementById("simulationLabTeamB");
    if (!selectA || !selectB) return;

    const valueA = selectA.value;
    selectA.value = selectB.value;
    selectB.value = valueA;
    renderSimulationLabTeamBreakdowns();
}

function formatSimulationAdjustment(value) {
    const number = roundChemistry(value);
    return number > 0 ? `+${number}` : String(number);
}

function escapeSimulationLabText(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function escapeSimulationLabAttribute(value) {
    return escapeSimulationLabText(value)
        .replace(/`/g, "&#096;");
}

window.createEmptyTournamentChemistryContext = createEmptyTournamentChemistryContext;
window.resetTeamChemistryAfterRosterChange = resetTeamChemistryAfterRosterChange;
window.removeStoredTeamChemistry = removeStoredTeamChemistry;
window.getTeamChemistrySnapshot = getTeamChemistrySnapshot;
window.prepareSeriesChemistry = prepareSeriesChemistry;
window.applySeriesChemistryResult = applySeriesChemistryResult;
window.finaliseTournamentChemistryForHistory = finaliseTournamentChemistryForHistory;
window.consumeManualSeriesOverride = consumeManualSeriesOverride;
window.buildManualGameWinnerSequence = buildManualGameWinnerSequence;
window.renderManualResultControl = renderManualResultControl;
window.queueManualSeriesOverride = queueManualSeriesOverride;
window.deleteManualResultOverride = deleteManualResultOverride;
window.renderSimulationLab = renderSimulationLab;
window.renderSimulationLabTeamBreakdowns = renderSimulationLabTeamBreakdowns;
window.runSimulationLaboratory = runSimulationLaboratory;
window.swapSimulationLabTeams = swapSimulationLabTeams;

window.addEventListener("load", () => {
    setTimeout(() => {
        renderSimulationLab();
        renderManualResultControl();
    }, 1200);
});
