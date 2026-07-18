/* ==========================
   RLCS LEAGUE SIMULATOR
   SAVE MANAGER + DATA HEALTH
========================== */

const RLCS_SYSTEM_DB_NAME = "rlcsSystemManagerDB";
const RLCS_SYSTEM_DB_VERSION = 1;
const RLCS_SYSTEM_ACTIVE_SLOT_KEY = "rlcsSystemActiveSaveSlotId";
const RLCS_SYSTEM_LAST_BACKUP_KEY = "rlcsSystemLastAutomaticBackupAt";
const RLCS_SYSTEM_RESERVED_KEYS = new Set([
    RLCS_SYSTEM_ACTIVE_SLOT_KEY,
    RLCS_SYSTEM_LAST_BACKUP_KEY
]);

let rlcsSystemDbPromise = null;
let rlcsLastHealthReport = null;

/* ==========================
   DATABASE
========================== */

function openRlcsSystemDatabase() {
    if (rlcsSystemDbPromise) return rlcsSystemDbPromise;

    rlcsSystemDbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(
            RLCS_SYSTEM_DB_NAME,
            RLCS_SYSTEM_DB_VERSION
        );

        request.onupgradeneeded = event => {
            const database = event.target.result;

            if (!database.objectStoreNames.contains("slots")) {
                database.createObjectStore("slots", {
                    keyPath: "id"
                });
            }

            if (!database.objectStoreNames.contains("restorePoints")) {
                const store = database.createObjectStore(
                    "restorePoints",
                    { keyPath: "id" }
                );

                store.createIndex(
                    "createdAt",
                    "createdAt",
                    { unique: false }
                );
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(
            request.error || new Error("Could not open the system database.")
        );
    });

    return rlcsSystemDbPromise;
}

async function systemStoreRequest(storeName, mode, callback) {
    const database = await openRlcsSystemDatabase();

    return new Promise((resolve, reject) => {
        const transaction = database.transaction(storeName, mode);
        const store = transaction.objectStore(storeName);
        let request;

        try {
            request = callback(store);
        } catch (error) {
            reject(error);
            return;
        }

        if (request) {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        } else {
            transaction.oncomplete = () => resolve(true);
        }

        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(
            transaction.error || new Error("The database transaction was aborted.")
        );
    });
}

function systemDbGet(storeName, key) {
    return systemStoreRequest(
        storeName,
        "readonly",
        store => store.get(key)
    );
}

function systemDbGetAll(storeName) {
    return systemStoreRequest(
        storeName,
        "readonly",
        store => store.getAll()
    );
}

function systemDbPut(storeName, value) {
    return systemStoreRequest(
        storeName,
        "readwrite",
        store => store.put(value)
    );
}

function systemDbDelete(storeName, key) {
    return systemStoreRequest(
        storeName,
        "readwrite",
        store => store.delete(key)
    );
}

/* ==========================
   SNAPSHOTS
========================== */

function getSimulatorLocalStorageSnapshot() {
    const data = {};

    for (let index = 0; index < localStorage.length; index++) {
        const key = localStorage.key(index);

        if (
            !key ||
            !key.startsWith("rlcs") ||
            RLCS_SYSTEM_RESERVED_KEYS.has(key)
        ) {
            continue;
        }

        data[key] = localStorage.getItem(key);
    }

    return data;
}

async function getSimulatorIndexedDbSnapshot() {
    if (
        !window.rlcsDB ||
        typeof window.rlcsDB.getAll !== "function"
    ) {
        return null;
    }

    const stores = {};
    const storeNames = Object.values(window.rlcsDB.stores || {});

    for (const storeName of storeNames) {
        try {
            stores[storeName] = await window.rlcsDB.getAll(storeName);
        } catch (error) {
            console.warn(`Could not snapshot ${storeName}:`, error);
            stores[storeName] = [];
        }
    }

    return {
        databaseName: window.rlcsDB.name,
        databaseVersion: window.rlcsDB.version,
        stores
    };
}

async function createSimulatorSnapshot() {
    return {
        createdAt: new Date().toISOString(),
        localStorage: getSimulatorLocalStorageSnapshot(),
        indexedDB: await getSimulatorIndexedDbSnapshot()
    };
}

function clearSimulatorLocalStorage() {
    const keysToRemove = [];

    for (let index = 0; index < localStorage.length; index++) {
        const key = localStorage.key(index);

        if (
            key &&
            key.startsWith("rlcs") &&
            !RLCS_SYSTEM_RESERVED_KEYS.has(key)
        ) {
            keysToRemove.push(key);
        }
    }

    keysToRemove.forEach(key => localStorage.removeItem(key));
}

function restoreSimulatorLocalStorage(data) {
    clearSimulatorLocalStorage();

    Object.entries(data || {}).forEach(([key, value]) => {
        if (
            !key.startsWith("rlcs") ||
            RLCS_SYSTEM_RESERVED_KEYS.has(key) ||
            value === null ||
            typeof value === "undefined"
        ) {
            return;
        }

        localStorage.setItem(key, String(value));
    });
}

async function restoreSimulatorIndexedDb(snapshot) {
    if (
        !snapshot?.stores ||
        !window.rlcsDB ||
        typeof window.rlcsDB.clear !== "function"
    ) {
        return;
    }

    const knownStores = Object.values(window.rlcsDB.stores || {});

    for (const storeName of knownStores) {
        try {
            await window.rlcsDB.clear(storeName);

            const records = Array.isArray(snapshot.stores[storeName])
                ? snapshot.stores[storeName]
                : [];

            if (
                records.length &&
                typeof window.rlcsDB.putMany === "function"
            ) {
                await window.rlcsDB.putMany(storeName, records);
            }
        } catch (error) {
            console.warn(`Could not restore ${storeName}:`, error);
        }
    }
}

async function restoreSimulatorSnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== "object") {
        throw new Error("The selected save does not contain a valid snapshot.");
    }

    restoreSimulatorLocalStorage(snapshot.localStorage || {});
    await restoreSimulatorIndexedDb(snapshot.indexedDB);
}

/* ==========================
   SAVE SLOTS
========================== */

function createSystemId(prefix) {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function getActiveSaveSlotId() {
    return localStorage.getItem(RLCS_SYSTEM_ACTIVE_SLOT_KEY);
}

function setActiveSaveSlotId(slotId) {
    localStorage.setItem(RLCS_SYSTEM_ACTIVE_SLOT_KEY, slotId);
}

async function initialiseSaveManager() {
    const slots = await systemDbGetAll("slots");
    let activeSlotId = getActiveSaveSlotId();

    if (!slots.length) {
        const id = createSystemId("save");
        const now = new Date().toISOString();

        await systemDbPut("slots", {
            id,
            name: "Main League",
            createdAt: now,
            updatedAt: now,
            snapshot: await createSimulatorSnapshot()
        });

        setActiveSaveSlotId(id);
        return id;
    }

    if (!activeSlotId || !slots.some(slot => slot.id === activeSlotId)) {
        activeSlotId = slots[0].id;
        setActiveSaveSlotId(activeSlotId);
    }

    return activeSlotId;
}

async function saveCurrentSlot(showMessage = true) {
    const activeSlotId = await initialiseSaveManager();
    const slot = await systemDbGet("slots", activeSlotId);

    if (!slot) {
        throw new Error("The active save slot could not be found.");
    }

    slot.updatedAt = new Date().toISOString();
    slot.snapshot = await createSimulatorSnapshot();
    await systemDbPut("slots", slot);

    if (showMessage) {
        setSystemStatus(`Saved “${slot.name}” successfully.`);
        await renderSystemPage();
    }

    return slot;
}

async function createEmptySaveSlot() {
    const name = prompt("Name the new save:", "New League");
    if (!name?.trim()) return;

    await saveCurrentSlot(false);

    const id = createSystemId("save");
    const now = new Date().toISOString();

    const emptySnapshot = {
        createdAt: now,
        localStorage: {},
        indexedDB: {
            stores: {}
        }
    };

    await systemDbPut("slots", {
        id,
        name: name.trim(),
        createdAt: now,
        updatedAt: now,
        snapshot: emptySnapshot
    });

    setActiveSaveSlotId(id);
    await restoreSimulatorSnapshot(emptySnapshot);
    window.location.reload();
}

async function duplicateCurrentSaveSlot() {
    const activeSlotId = await initialiseSaveManager();
    const current = await saveCurrentSlot(false);
    const name = prompt(
        "Name the duplicated save:",
        `${current.name} Copy`
    );

    if (!name?.trim()) return;

    const id = createSystemId("save");
    const now = new Date().toISOString();

    await systemDbPut("slots", {
        id,
        name: name.trim(),
        createdAt: now,
        updatedAt: now,
        snapshot: structuredClone(current.snapshot)
    });

    setSystemStatus(`Created a copy of “${current.name}”.`);
    await renderSystemPage();
}

async function switchSaveSlot(slotId) {
    const activeSlotId = await initialiseSaveManager();

    if (slotId === activeSlotId) return;

    const target = await systemDbGet("slots", slotId);
    if (!target) {
        alert("That save slot no longer exists.");
        return;
    }

    const confirmed = confirm(
        `Switch to “${target.name}”? The current save will be saved first.`
    );

    if (!confirmed) return;

    await saveCurrentSlot(false);
    await restoreSimulatorSnapshot(target.snapshot);
    setActiveSaveSlotId(target.id);
    window.location.reload();
}

async function renameSaveSlot(slotId) {
    const slot = await systemDbGet("slots", slotId);
    if (!slot) return;

    const name = prompt("Rename this save:", slot.name);
    if (!name?.trim()) return;

    slot.name = name.trim();
    slot.updatedAt = new Date().toISOString();
    await systemDbPut("slots", slot);
    await renderSystemPage();
}

async function deleteSaveSlot(slotId) {
    const slots = await systemDbGetAll("slots");
    const slot = slots.find(item => item.id === slotId);

    if (!slot) return;

    if (slots.length <= 1) {
        alert("You must keep at least one save slot.");
        return;
    }

    if (slotId === getActiveSaveSlotId()) {
        alert("Switch to another save before deleting this one.");
        return;
    }

    const confirmed = confirm(
        `Delete “${slot.name}”? This cannot be undone.`
    );

    if (!confirmed) return;

    await systemDbDelete("slots", slotId);
    await renderSystemPage();
}

async function exportSaveSlot(slotId) {
    const slot = await systemDbGet("slots", slotId);
    if (!slot) return;

    if (slotId === getActiveSaveSlotId()) {
        await saveCurrentSlot(false);
    }

    const latestSlot = await systemDbGet("slots", slotId);
    const payload = {
        app: "RLCS League Simulator",
        type: "save-slot",
        version: 1,
        exportedAt: new Date().toISOString(),
        slot: latestSlot
    };

    downloadSystemJson(
        payload,
        `rlcs-save-${safeSystemFileName(latestSlot.name)}.json`
    );
}

function openSaveSlotImportPicker() {
    const input = document.getElementById("systemSaveImportFile");
    if (!input) return;
    input.value = "";
    input.click();
}

async function importSaveSlot(event) {
    const file = event?.target?.files?.[0];
    if (!file) return;

    try {
        const parsed = JSON.parse(await file.text());
        const imported = parsed?.slot || parsed;

        if (!imported?.snapshot || typeof imported.snapshot !== "object") {
            throw new Error("This file does not contain an RLCS save slot.");
        }

        const id = createSystemId("save");
        const now = new Date().toISOString();

        await systemDbPut("slots", {
            id,
            name: `${imported.name || "Imported League"} (Imported)`,
            createdAt: now,
            updatedAt: now,
            snapshot: imported.snapshot
        });

        setSystemStatus("Save slot imported successfully.");
        await renderSystemPage();
    } catch (error) {
        alert(`Save import failed: ${error.message}`);
    } finally {
        if (event?.target) event.target.value = "";
    }
}

/* ==========================
   RESTORE POINTS
========================== */

async function createRestorePoint(reason = "Manual restore point", silent = false) {
    const activeSlotId = await initialiseSaveManager();
    const activeSlot = await systemDbGet("slots", activeSlotId);
    const now = new Date().toISOString();

    const restorePoint = {
        id: createSystemId("restore"),
        slotId: activeSlotId,
        slotName: activeSlot?.name || "League",
        reason,
        createdAt: now,
        snapshot: await createSimulatorSnapshot()
    };

    await systemDbPut("restorePoints", restorePoint);
    await trimRestorePoints();

    if (!silent) {
        setSystemStatus(`Restore point created: ${reason}.`);
        await renderSystemPage();
    }

    return restorePoint;
}

async function trimRestorePoints(maximum = 12) {
    const points = await systemDbGetAll("restorePoints");
    const sorted = points.sort((a, b) =>
        new Date(b.createdAt) - new Date(a.createdAt)
    );

    for (const point of sorted.slice(maximum)) {
        await systemDbDelete("restorePoints", point.id);
    }
}

async function restoreRestorePoint(pointId) {
    const point = await systemDbGet("restorePoints", pointId);
    if (!point) return;

    const confirmed = confirm(
        `Restore the league to “${formatSystemDate(point.createdAt)}”? Your current data will first be saved as a new restore point.`
    );

    if (!confirmed) return;

    await createRestorePoint("Before restoring an older backup", true);
    await restoreSimulatorSnapshot(point.snapshot);
    window.location.reload();
}

async function deleteRestorePoint(pointId) {
    await systemDbDelete("restorePoints", pointId);
    await renderSystemPage();
}

async function createDailyAutomaticRestorePoint() {
    const last = localStorage.getItem(RLCS_SYSTEM_LAST_BACKUP_KEY);
    const lastTime = last ? new Date(last).getTime() : 0;
    const oneDay = 24 * 60 * 60 * 1000;

    if (Date.now() - lastTime < oneDay) return;

    try {
        await createRestorePoint("Automatic daily backup", true);
        localStorage.setItem(
            RLCS_SYSTEM_LAST_BACKUP_KEY,
            new Date().toISOString()
        );
    } catch (error) {
        console.warn("Automatic restore point failed:", error);
    }
}

/* ==========================
   DATA HEALTH
========================== */

function readSystemJson(key, fallback) {
    try {
        const value = localStorage.getItem(key);
        return value ? JSON.parse(value) : fallback;
    } catch {
        return fallback;
    }
}

function createHealthIssue(level, title, detail, repairable = false) {
    return {
        level,
        title,
        detail,
        repairable
    };
}

async function runDataHealthCheck() {
    const issues = [];
    const teams = readSystemJson("rlcsTeams", []);
    const history = readSystemJson("rlcsTournamentHistory", []);
    const season = readSystemJson("rlcsSeasonCalendar", null);
    const league = readSystemJson("rlcsLeaguePoints", {
        teams: {},
        awardedEvents: []
    });
    const freeAgents = readSystemJson("rlcsFreeAgents", []);
    const events = Array.isArray(season)
        ? season
        : Array.isArray(season?.events)
            ? season.events
            : [];

    const teamIds = new Map();
    const teamNames = new Map();
    const playerIds = new Map();
    const playerNames = new Map();

    teams.forEach((team, teamIndex) => {
        if (!team?.id) {
            issues.push(createHealthIssue(
                "error",
                "Team missing an ID",
                `${team?.name || `Team ${teamIndex + 1}`} needs a permanent ID.`,
                true
            ));
        } else {
            teamIds.set(team.id, (teamIds.get(team.id) || 0) + 1);
        }

        const normalisedName = String(team?.name || "").trim().toLowerCase();
        if (!normalisedName) {
            issues.push(createHealthIssue(
                "error",
                "Team missing a name",
                `Team entry ${teamIndex + 1} has no name.`,
                false
            ));
        } else {
            teamNames.set(normalisedName, (teamNames.get(normalisedName) || 0) + 1);
        }

        if (!Array.isArray(team?.players) || team.players.length !== 3) {
            issues.push(createHealthIssue(
                "warning",
                "Invalid roster size",
                `${team?.name || "Unknown team"} has ${team?.players?.length || 0} active players instead of 3.`,
                false
            ));
        }

        (team?.players || []).forEach((player, playerIndex) => {
            if (!player?.id) {
                issues.push(createHealthIssue(
                    "warning",
                    "Player missing an ID",
                    `${player?.name || `Player ${playerIndex + 1}`} on ${team?.name || "Unknown team"} needs an ID.`,
                    true
                ));
            } else {
                playerIds.set(player.id, (playerIds.get(player.id) || 0) + 1);
            }

            const playerName = String(player?.name || "").trim().toLowerCase();
            if (playerName) {
                playerNames.set(playerName, (playerNames.get(playerName) || 0) + 1);
            }

            const rating = Number(player?.rating);
            if (!Number.isFinite(rating) || rating < 1 || rating > 100) {
                issues.push(createHealthIssue(
                    "error",
                    "Invalid player rating",
                    `${player?.name || "Unknown player"} on ${team?.name || "Unknown team"} has an invalid rating.`,
                    false
                ));
            }
        });

        const calculatedRating = calculateSystemTeamRating(team);
        if (
            Number.isFinite(calculatedRating) &&
            Math.abs(Number(team?.rating || 0) - calculatedRating) > 0.01
        ) {
            issues.push(createHealthIssue(
                "warning",
                "Team rating is out of date",
                `${team?.name || "Unknown team"} should be rated ${calculatedRating.toFixed(1)}.`,
                true
            ));
        }
    });

    addDuplicateMapIssues(issues, teamIds, "Duplicate team ID", "team records share the same ID");
    addDuplicateMapIssues(issues, teamNames, "Duplicate team name", "teams share the same name");
    addDuplicateMapIssues(issues, playerIds, "Duplicate player ID", "players share the same ID");

    const freeAgentIds = new Set();
    freeAgents.forEach(player => {
        if (player?.id) freeAgentIds.add(player.id);
    });

    playerIds.forEach((count, id) => {
        if (freeAgentIds.has(id)) {
            issues.push(createHealthIssue(
                "error",
                "Player exists on a team and in free agency",
                `Player ID ${id} appears in both systems.`,
                false
            ));
        }
    });

    const historyIds = new Map();
    const historySeasonIds = new Set();

    history.forEach((record, index) => {
        if (!record?.id) {
            issues.push(createHealthIssue(
                "warning",
                "History record missing an ID",
                `${record?.event?.name || `History record ${index + 1}`} needs an ID.`,
                true
            ));
        } else {
            historyIds.set(record.id, (historyIds.get(record.id) || 0) + 1);
        }

        if (record?.event?.seasonEventId) {
            historySeasonIds.add(record.event.seasonEventId);
        }
    });

    addDuplicateMapIssues(issues, historyIds, "Duplicate history ID", "history records share the same ID");

    const eventIds = new Map();
    events.forEach(event => {
        if (!event?.id) {
            issues.push(createHealthIssue(
                "error",
                "Season event missing an ID",
                `${event?.name || "A season event"} cannot reliably connect to History.`,
                false
            ));
        } else {
            eventIds.set(event.id, (eventIds.get(event.id) || 0) + 1);
        }

        if (
            event?.status === "completed" &&
            !historySeasonIds.has(event.id) &&
            !event.historyRecordId
        ) {
            issues.push(createHealthIssue(
                "warning",
                "Completed season event is not linked to History",
                `${event?.name || event?.id} is completed but has no matching History record.`,
                false
            ));
        }
    });

    addDuplicateMapIssues(issues, eventIds, "Duplicate season event ID", "season events share the same ID");

    historySeasonIds.forEach(seasonEventId => {
        if (!events.some(event => event.id === seasonEventId)) {
            issues.push(createHealthIssue(
                "warning",
                "Orphaned History link",
                `A History record points to missing season event ${seasonEventId}.`,
                false
            ));
        }
    });

    const currentEventId = localStorage.getItem("rlcsCurrentSeasonEventId");
    if (currentEventId && !events.some(event => event.id === currentEventId)) {
        issues.push(createHealthIssue(
            "warning",
            "Current event pointer is orphaned",
            `${currentEventId} does not exist in the current season.`,
            true
        ));
    }

    const awardedEvents = Array.isArray(league?.awardedEvents)
        ? league.awardedEvents
        : [];
    const uniqueAwarded = new Set(awardedEvents);

    if (uniqueAwarded.size !== awardedEvents.length) {
        issues.push(createHealthIssue(
            "warning",
            "Duplicate points-award records",
            `${awardedEvents.length - uniqueAwarded.size} event IDs appear more than once.`,
            true
        ));
    }

    Object.keys(league?.teams || {}).forEach(teamId => {
        if (!teams.some(team => String(team.id) === String(teamId))) {
            issues.push(createHealthIssue(
                "info",
                "Points remain for a missing team",
                `League points contain team ID ${teamId}, which is no longer in the team library.`,
                false
            ));
        }
    });

    const storage = await getSystemStorageSummary();

    if (storage.localStoragePercentage >= 85) {
        issues.push(createHealthIssue(
            "error",
            "Local storage is nearly full",
            `${storage.localStoragePercentage.toFixed(1)}% of the estimated 5 MB localStorage allowance is in use.`,
            true
        ));
    } else if (storage.localStoragePercentage >= 65) {
        issues.push(createHealthIssue(
            "warning",
            "Local storage usage is high",
            `${storage.localStoragePercentage.toFixed(1)}% of the estimated localStorage allowance is in use.`,
            true
        ));
    }

    if (!issues.length) {
        issues.push(createHealthIssue(
            "success",
            "No data problems found",
            "Teams, players, History, Season and league points passed the available checks.",
            false
        ));
    }

    rlcsLastHealthReport = {
        checkedAt: new Date().toISOString(),
        issues,
        storage,
        counts: {
            teams: teams.length,
            players: teams.reduce((total, team) => total + (team.players?.length || 0), 0),
            history: history.length,
            seasonEvents: events.length,
            freeAgents: freeAgents.length
        }
    };

    renderDataHealthReport();
    return rlcsLastHealthReport;
}

function addDuplicateMapIssues(issues, map, title, suffix) {
    map.forEach((count, value) => {
        if (count > 1) {
            issues.push(createHealthIssue(
                "error",
                title,
                `${count} ${suffix}: ${value}`,
                false
            ));
        }
    });
}

function calculateSystemTeamRating(team) {
    const ratings = (team?.players || [])
        .map(player => Number(player?.rating))
        .filter(Number.isFinite);

    if (!ratings.length) return Number(team?.rating || 0);

    return ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
}

async function runSafeDataRepair() {
    const confirmed = confirm(
        "Run safe repairs? A restore point will be created first. This adds missing IDs, recalculates team ratings, compacts History, removes duplicate point-award IDs and repairs Season links where possible."
    );

    if (!confirmed) return;

    await createRestorePoint("Before safe data repair", true);

    const teams = readSystemJson("rlcsTeams", []);
    const usedPlayerIds = new Set();

    teams.forEach(team => {
        if (!team.id) team.id = createSystemId("team");

        (team.players || []).forEach(player => {
            if (!player.id || usedPlayerIds.has(player.id)) {
                player.id = createSystemId("player");
            }
            usedPlayerIds.add(player.id);
        });

        team.rating = Number(calculateSystemTeamRating(team).toFixed(2));
    });

    localStorage.setItem("rlcsTeams", JSON.stringify(teams));

    const history = readSystemJson("rlcsTournamentHistory", []);
    history.forEach(record => {
        if (!record.id) record.id = createSystemId("history");
    });
    localStorage.setItem("rlcsTournamentHistory", JSON.stringify(history));

    const league = readSystemJson("rlcsLeaguePoints", {
        teams: {},
        awardedEvents: []
    });

    if (Array.isArray(league.awardedEvents)) {
        league.awardedEvents = [...new Set(league.awardedEvents)];
        localStorage.setItem("rlcsLeaguePoints", JSON.stringify(league));
    }

    const currentEventId = localStorage.getItem("rlcsCurrentSeasonEventId");
    const season = readSystemJson("rlcsSeasonCalendar", null);
    const events = Array.isArray(season)
        ? season
        : Array.isArray(season?.events)
            ? season.events
            : [];

    if (currentEventId && !events.some(event => event.id === currentEventId)) {
        localStorage.removeItem("rlcsCurrentSeasonEventId");
    }

    if (typeof compactExistingTournamentHistory === "function") {
        compactExistingTournamentHistory();
    }

    if (typeof repairSeasonProgressFromHistory === "function") {
        repairSeasonProgressFromHistory(true);
    }

    if (typeof loadTeams === "function") {
        loadTeams();
    }

    setSystemStatus("Safe repairs completed. Run the health check again to review the result.");
    await saveCurrentSlot(false);
    await runDataHealthCheck();
    await renderSystemPage();
}

function rebuildSystemLeaguePoints() {
    if (typeof rebuildLeaguePointsFromHistory === "function") {
        rebuildLeaguePointsFromHistory();
    } else {
        alert("The league points rebuild function is unavailable.");
    }
}

function compactSystemHistory() {
    const confirmed = confirm(
        "Compact tournament History now? A restore point will be created first."
    );

    if (!confirmed) return;

    createRestorePoint("Before History compaction", true)
        .then(() => {
            if (typeof compactExistingTournamentHistory === "function") {
                compactExistingTournamentHistory();
                setSystemStatus("Tournament History was compacted successfully.");
                renderSystemPage();
            } else {
                alert("The History compaction function is unavailable.");
            }
        });
}

/* ==========================
   STORAGE
========================== */

function getLocalStorageSizeBytes() {
    let bytes = 0;

    for (let index = 0; index < localStorage.length; index++) {
        const key = localStorage.key(index) || "";
        const value = localStorage.getItem(key) || "";
        bytes += (key.length + value.length) * 2;
    }

    return bytes;
}

async function getSystemStorageSummary() {
    const localStorageBytes = getLocalStorageSizeBytes();
    const estimatedLocalLimit = 5 * 1024 * 1024;
    let browserUsage = 0;
    let browserQuota = 0;

    try {
        const estimate = await navigator.storage?.estimate?.();
        browserUsage = Number(estimate?.usage || 0);
        browserQuota = Number(estimate?.quota || 0);
    } catch {
        // Storage estimates are optional.
    }

    return {
        localStorageBytes,
        localStorageMegabytes: localStorageBytes / 1024 / 1024,
        localStoragePercentage: localStorageBytes / estimatedLocalLimit * 100,
        browserUsage,
        browserQuota,
        browserUsageMegabytes: browserUsage / 1024 / 1024,
        browserQuotaMegabytes: browserQuota / 1024 / 1024,
        browserPercentage: browserQuota > 0
            ? browserUsage / browserQuota * 100
            : 0
    };
}

/* ==========================
   RENDER
========================== */

async function renderSystemPage() {
    const page = document.getElementById("systemPage");
    if (!page) return;

    await initialiseSaveManager();
    await renderSaveSlots();
    await renderRestorePoints();
    await renderSystemStorage();

    if (!rlcsLastHealthReport) {
        await runDataHealthCheck();
    } else {
        renderDataHealthReport();
    }
}

async function renderSaveSlots() {
    const container = document.getElementById("systemSaveSlots");
    if (!container) return;

    const activeSlotId = getActiveSaveSlotId();
    const slots = (await systemDbGetAll("slots"))
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    container.innerHTML = slots.map(slot => {
        const active = slot.id === activeSlotId;
        const summary = getSnapshotSummary(slot.snapshot);

        return `
            <article class="system-save-card ${active ? "active" : ""}">
                <div class="system-save-card-header">
                    <div>
                        <span class="system-card-kicker">
                            ${active ? "Active Save" : "Save Slot"}
                        </span>
                        <h4>${escapeSystemText(slot.name)}</h4>
                    </div>
                    ${active ? '<span class="system-active-badge">ACTIVE</span>' : ""}
                </div>

                <div class="system-save-stats">
                    <span>${summary.teams} teams</span>
                    <span>${summary.history} events</span>
                    <span>${summary.seasonEvents} scheduled</span>
                </div>

                <p class="small">Updated ${formatSystemDate(slot.updatedAt)}</p>

                <div class="system-card-actions">
                    ${active
                        ? '<button class="primary-button" onclick="saveCurrentSlot()">Save Now</button>'
                        : `<button class="primary-button" onclick="switchSaveSlot('${slot.id}')">Switch</button>`
                    }
                    <button class="secondary-button" onclick="renameSaveSlot('${slot.id}')">Rename</button>
                    <button class="secondary-button" onclick="exportSaveSlot('${slot.id}')">Export</button>
                    ${!active
                        ? `<button class="danger-button" onclick="deleteSaveSlot('${slot.id}')">Delete</button>`
                        : ""
                    }
                </div>
            </article>
        `;
    }).join("");
}

function getSnapshotSummary(snapshot) {
    const local = snapshot?.localStorage || {};
    const teams = parseSystemSnapshotJson(local.rlcsTeams, []);
    const history = parseSystemSnapshotJson(local.rlcsTournamentHistory, []);
    const season = parseSystemSnapshotJson(local.rlcsSeasonCalendar, null);
    const events = Array.isArray(season)
        ? season
        : Array.isArray(season?.events)
            ? season.events
            : [];

    return {
        teams: teams.length,
        history: history.length,
        seasonEvents: events.length
    };
}

function parseSystemSnapshotJson(value, fallback) {
    try {
        return value ? JSON.parse(value) : fallback;
    } catch {
        return fallback;
    }
}

async function renderRestorePoints() {
    const container = document.getElementById("systemRestorePoints");
    if (!container) return;

    const activeSlotId = getActiveSaveSlotId();
    const points = (await systemDbGetAll("restorePoints"))
        .filter(point => point.slotId === activeSlotId)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    if (!points.length) {
        container.innerHTML = `
            <div class="system-empty-state">
                No restore points yet. Create one before a risky change.
            </div>
        `;
        return;
    }

    container.innerHTML = points.slice(0, 8).map(point => `
        <div class="system-restore-row">
            <div>
                <strong>${escapeSystemText(point.reason)}</strong>
                <span>${formatSystemDate(point.createdAt)}</span>
            </div>
            <div class="system-card-actions">
                <button class="secondary-button" onclick="restoreRestorePoint('${point.id}')">
                    Restore
                </button>
                <button class="danger-button" onclick="deleteRestorePoint('${point.id}')">
                    Delete
                </button>
            </div>
        </div>
    `).join("");
}

function renderDataHealthReport() {
    const container = document.getElementById("systemHealthResults");
    if (!container || !rlcsLastHealthReport) return;

    const report = rlcsLastHealthReport;
    const totals = report.issues.reduce((result, issue) => {
        result[issue.level] = (result[issue.level] || 0) + 1;
        return result;
    }, {});

    container.innerHTML = `
        <div class="system-health-summary">
            <div><strong>${report.counts.teams}</strong><span>Teams</span></div>
            <div><strong>${report.counts.players}</strong><span>Players</span></div>
            <div><strong>${report.counts.history}</strong><span>History Events</span></div>
            <div><strong>${report.counts.seasonEvents}</strong><span>Season Events</span></div>
            <div><strong>${totals.error || 0}</strong><span>Errors</span></div>
            <div><strong>${totals.warning || 0}</strong><span>Warnings</span></div>
        </div>

        <div class="system-health-list">
            ${report.issues.map(issue => `
                <article class="system-health-item ${issue.level}">
                    <span class="system-health-dot"></span>
                    <div>
                        <strong>${escapeSystemText(issue.title)}</strong>
                        <p>${escapeSystemText(issue.detail)}</p>
                    </div>
                    ${issue.repairable
                        ? '<span class="system-repairable-badge">SAFE REPAIR</span>'
                        : ""
                    }
                </article>
            `).join("")}
        </div>

        <p class="small">Last checked ${formatSystemDate(report.checkedAt)}</p>
    `;
}

async function renderSystemStorage() {
    const container = document.getElementById("systemStorageSummary");
    if (!container) return;

    const storage = await getSystemStorageSummary();
    const localPercentage = Math.min(storage.localStoragePercentage, 100);
    const browserPercentage = Math.min(storage.browserPercentage, 100);

    container.innerHTML = `
        <div class="system-storage-grid">
            <div class="system-storage-card">
                <div class="system-storage-title">
                    <span>Simulator localStorage</span>
                    <strong>${storage.localStorageMegabytes.toFixed(2)} MB</strong>
                </div>
                <div class="system-storage-track">
                    <div style="width:${localPercentage}%"></div>
                </div>
                <small>${storage.localStoragePercentage.toFixed(1)}% of the estimated 5 MB allowance</small>
            </div>

            <div class="system-storage-card">
                <div class="system-storage-title">
                    <span>Total browser storage</span>
                    <strong>${storage.browserUsageMegabytes.toFixed(2)} MB</strong>
                </div>
                <div class="system-storage-track">
                    <div style="width:${browserPercentage}%"></div>
                </div>
                <small>${storage.browserQuotaMegabytes > 0
                    ? `${storage.browserPercentage.toFixed(2)}% of ${storage.browserQuotaMegabytes.toFixed(0)} MB available`
                    : "Browser quota estimate unavailable"
                }</small>
            </div>
        </div>
    `;
}

function setSystemStatus(message, isError = false) {
    const element = document.getElementById("systemStatus");
    if (!element) return;

    element.textContent = message;
    element.classList.toggle("error", Boolean(isError));
}

/* ==========================
   HELPERS
========================== */

function downloadSystemJson(data, filename) {
    const blob = new Blob([
        JSON.stringify(data, null, 2)
    ], {
        type: "application/json"
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function safeSystemFileName(value) {
    return String(value || "league")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "league";
}

function formatSystemDate(value) {
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

function escapeSystemText(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/* ==========================
   INITIALISE
========================== */

window.addEventListener("DOMContentLoaded", async () => {
    try {
        await initialiseSaveManager();
        await createDailyAutomaticRestorePoint();
    } catch (error) {
        console.error("System manager failed to initialise:", error);
    }
});

window.renderSystemPage = renderSystemPage;
window.saveCurrentSlot = saveCurrentSlot;
window.createEmptySaveSlot = createEmptySaveSlot;
window.duplicateCurrentSaveSlot = duplicateCurrentSaveSlot;
window.switchSaveSlot = switchSaveSlot;
window.renameSaveSlot = renameSaveSlot;
window.deleteSaveSlot = deleteSaveSlot;
window.exportSaveSlot = exportSaveSlot;
window.openSaveSlotImportPicker = openSaveSlotImportPicker;
window.importSaveSlot = importSaveSlot;
window.createRestorePoint = createRestorePoint;
window.restoreRestorePoint = restoreRestorePoint;
window.deleteRestorePoint = deleteRestorePoint;
window.runDataHealthCheck = runDataHealthCheck;
window.runSafeDataRepair = runSafeDataRepair;
window.rebuildSystemLeaguePoints = rebuildSystemLeaguePoints;
window.compactSystemHistory = compactSystemHistory;
