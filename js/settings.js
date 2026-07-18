/* ==========================
   RLCS SIMULATOR
   SETTINGS.JS
========================== */

const SETTINGS_KEY =
    "rlcsSimulatorSettings";

const DEFAULT_SETTINGS = {

    upsetFactor: 0.20,

    simulationSpeed: 900,

    overtimeChance: 0.18,

    scoringProfile: "normal",

    ratingImportance: "balanced",

    formImportance: "balanced",

    chemistryImportance: "balanced"

};

/* ==========================
   LOAD SETTINGS
========================== */

function getSimulationSettings() {

    const saved =
        localStorage.getItem(
            SETTINGS_KEY
        );

    if (!saved) {

        return {
            ...DEFAULT_SETTINGS
        };

    }

    try {

        return {
            ...DEFAULT_SETTINGS,
            ...JSON.parse(saved)
        };

    } catch (error) {

        console.error(
            "Failed to load settings",
            error
        );

        return {
            ...DEFAULT_SETTINGS
        };

    }

}

/* ==========================
   SAVE SETTINGS
========================== */

function saveSettings(settings) {

    localStorage.setItem(
        SETTINGS_KEY,
        JSON.stringify(settings)
    );

}

function saveSettingsFromForm() {

    const settings = {

        upsetFactor:
            Number(
                document.getElementById(
                    "settingUpsetFactor"
                ).value
            ),

        simulationSpeed:
            Number(
                document.getElementById(
                    "settingSimulationSpeed"
                ).value
            ),

        overtimeChance:
            Number(
                document.getElementById(
                    "settingOvertimeChance"
                ).value
            ),

        scoringProfile:
            document.getElementById(
                "settingScoringProfile"
            ).value,

        ratingImportance:
            document.getElementById(
                "settingRatingImportance"
            ).value,

        formImportance:
            document.getElementById(
                "settingFormImportance"
            )?.value || "balanced",

        chemistryImportance:
            document.getElementById(
                "settingChemistryImportance"
            )?.value || "balanced"

    };

    saveSettings(settings);

    renderSettings();

    alert("Settings saved.");

}

function resetSettings() {

    const confirmed =
        confirm(
            "Reset simulation settings to default?"
        );

    if (!confirmed) return;

    saveSettings({
        ...DEFAULT_SETTINGS
    });

    renderSettings();

}

/* ==========================
   RENDER SETTINGS
========================== */

function renderSettings() {

    const settings =
        getSimulationSettings();

    setInputValue(
        "settingUpsetFactor",
        settings.upsetFactor
    );

    setInputValue(
        "settingSimulationSpeed",
        settings.simulationSpeed
    );

    setInputValue(
        "settingOvertimeChance",
        settings.overtimeChance
    );

    setInputValue(
        "settingScoringProfile",
        settings.scoringProfile
    );

    setInputValue(
        "settingRatingImportance",
        settings.ratingImportance
    );

    setInputValue(
        "settingFormImportance",
        settings.formImportance
    );

    setInputValue(
        "settingChemistryImportance",
        settings.chemistryImportance
    );

    renderSettingsSummary(
        settings
    );

    renderBackupStorageSummary();

}

function setInputValue(id, value) {

    const input =
        document.getElementById(id);

    if (!input) return;

    input.value =
        String(value);

}

function renderSettingsSummary(settings) {

    const container =
        document.getElementById(
            "settingsSummary"
        );

    if (!container) return;

    container.innerHTML = `

        <div class="settings-summary-grid">

            ${renderSettingCard(
                "Upset Factor",
                `${Math.round(settings.upsetFactor * 100)}%`
            )}

            ${renderSettingCard(
                "Simulation Speed",
                `${settings.simulationSpeed}ms`
            )}

            ${renderSettingCard(
                "Overtime Chance",
                `${Math.round(settings.overtimeChance * 100)}%`
            )}

            ${renderSettingCard(
                "Scoring Style",
                formatSettingLabel(
                    settings.scoringProfile
                )
            )}

            ${renderSettingCard(
                "Rating Importance",
                formatSettingLabel(
                    settings.ratingImportance
                )
            )}

            ${renderSettingCard(
                "Team Form",
                formatSettingLabel(
                    settings.formImportance
                )
            )}

            ${renderSettingCard(
                "Roster Chemistry",
                formatSettingLabel(
                    settings.chemistryImportance
                )
            )}

        </div>

    `;

}

function renderSettingCard(label, value) {

    return `

    <div class="setting-summary-card">

        <span>
            ${escapeSettingsText(label)}
        </span>

        <strong>
            ${escapeSettingsText(value)}
        </strong>

    </div>

    `;

}

function formatSettingLabel(value) {

    return String(value || "")
        .charAt(0)
        .toUpperCase() +
        String(value || "")
        .slice(1);

}

/* ==========================
   SIMULATION HELPERS
========================== */

function calculateWinProbability(ratingA, ratingB) {

    const teamARating = Number(ratingA || 50);
    const teamBRating = Number(ratingB || 50);
    const ratingDifference = teamARating - teamBRating;

    const settings =
        typeof getSimulationSettings === "function"
        ? getSimulationSettings()
        : {};

    const ratingImportance =
        settings.ratingImportance || "balanced";

    const upsetFactor = Math.max(
        0,
        Math.min(
            1,
            Number(settings.upsetFactor ?? 0.10)
        )
    );

    let ratingScale = 16;
    let minimumProbability = 0.06;
    let maximumProbability = 0.94;

    if (ratingImportance === "arcade") {
        ratingScale = 24;
        minimumProbability = 0.14;
        maximumProbability = 0.86;
    } else if (ratingImportance === "realistic") {
        ratingScale = 11;
        minimumProbability = 0.02;
        maximumProbability = 0.98;
    }

    let probability =
        1 /
        (
            1 +
            Math.pow(
                10,
                -ratingDifference / ratingScale
            )
        );

    const ratingStrength =
        1 - upsetFactor * 0.30;

    probability =
        0.5 +
        (probability - 0.5) * ratingStrength;

    return Math.max(
        minimumProbability,
        Math.min(
            maximumProbability,
            probability
        )
    );

}

function getSimulationDelay() {

    return getSimulationSettings()
        .simulationSpeed;

}

function getOvertimeChance() {

    return getSimulationSettings()
        .overtimeChance;

}

function getScoringProfile() {

    return getSimulationSettings()
        .scoringProfile;

}

function getGoalSettings() {

    const profile =
        getScoringProfile();

    if (profile === "low") {

        return {
            loserMin: 0,
            loserMax: 2,
            winnerMin: 1,
            winnerMax: 4
        };

    }

    if (profile === "high") {

        return {
            loserMin: 1,
            loserMax: 5,
            winnerMin: 3,
            winnerMax: 8
        };

    }

    return {
        loserMin: 0,
        loserMax: 3,
        winnerMin: 2,
        winnerMax: 6
    };

}

/* ==========================
   HELPERS
========================== */

function clamp(value, min, max) {

    return Math.min(
        Math.max(value, min),
        max
    );

}

function escapeSettingsText(value) {

    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}

/* ==========================
   DATA BACKUP AND TRANSFER
========================== */

const SIMULATOR_BACKUP_VERSION = 2;

async function exportSimulatorBackup() {

    setBackupStatus(
        "Preparing backup..."
    );

    try {

        const localStorageData =
            collectLocalStorageData();

        const indexedDatabaseData =
            await collectIndexedDatabaseData();

        const backup = {

            app:
                "RLCS League Simulator",

            backupVersion:
                SIMULATOR_BACKUP_VERSION,

            exportedAt:
                new Date().toISOString(),

            sourceOrigin:
                getCurrentStorageOrigin(),

            sourceUrl:
                window.location.href,

            localStorage:
                localStorageData,

            indexedDB:
                indexedDatabaseData

        };

        const backupText =
            JSON.stringify(
                backup,
                null,
                2
            );

        const file =
            new Blob(
                [backupText],
                {
                    type:
                        "application/json"
                }
            );

        const url =
            URL.createObjectURL(file);

        const link =
            document.createElement("a");

        const timestamp =
            new Date()
                .toISOString()
                .replace(/[:.]/g, "-");

        link.href = url;
        link.download =
            `rlcs-league-simulator-backup-${timestamp}.json`;

        document.body.appendChild(link);
        link.click();
        link.remove();

        setTimeout(() => {
            URL.revokeObjectURL(url);
        }, 1000);

        const localCount =
            Object.keys(
                localStorageData
            ).length;

        const databaseCount =
            countIndexedDatabaseRecords(
                indexedDatabaseData
            );

        setBackupStatus(
            `Backup exported successfully: ${localCount} local entries and ${databaseCount} database records.`
        );

        renderBackupStorageSummary();

    } catch (error) {

        console.error(
            "Backup export failed:",
            error
        );

        setBackupStatus(
            `Backup export failed: ${error.message}`,
            true
        );

        alert(
            `Backup export failed: ${error.message}`
        );

    }

}

function openSimulatorBackupPicker() {

    const input =
        document.getElementById(
            "simulatorBackupFile"
        );

    if (!input) {

        alert(
            "The backup file selector could not be found."
        );

        return;

    }

    input.value = "";
    input.click();

}

async function importSimulatorBackup(event) {

    const input =
        event?.target;

    const file =
        input?.files?.[0];

    if (!file) return;

    setBackupStatus(
        "Reading backup file..."
    );

    try {

        const text =
            await file.text();

        const parsed =
            JSON.parse(text);

        const backup =
            normaliseSimulatorBackup(
                parsed
            );

        const confirmed =
            confirm(
                "Import this RLCS Simulator backup? Data with matching keys will be replaced, and included database stores will be restored."
            );

        if (!confirmed) {

            setBackupStatus(
                "Backup import cancelled."
            );

            return;

        }

        setBackupStatus(
            "Importing simulator data..."
        );

        const localCount =
            restoreLocalStorageData(
                backup.localStorage
            );

        const databaseCount =
            await restoreIndexedDatabaseData(
                backup.indexedDB
            );

        setBackupStatus(
            `Import complete: ${localCount} local entries and ${databaseCount} database records restored. Reloading...`
        );

        alert(
            "Simulator backup imported successfully. The page will now reload."
        );

        window.location.reload();

    } catch (error) {

        console.error(
            "Backup import failed:",
            error
        );

        setBackupStatus(
            `Backup import failed: ${error.message}`,
            true
        );

        alert(
            `Backup import failed: ${error.message}`
        );

    } finally {

        if (input) {
            input.value = "";
        }

    }

}

function collectLocalStorageData() {

    const data = {};

    for (
        let index = 0;
        index < localStorage.length;
        index++
    ) {

        const key =
            localStorage.key(index);

        if (!key) continue;

        data[key] =
            localStorage.getItem(key);

    }

    return data;

}

async function collectIndexedDatabaseData() {

    if (
        !window.rlcsDB ||
        typeof window.rlcsDB.getAll !==
            "function"
    ) {
        return null;
    }

    const storeNames =
        getRlcsDatabaseStoreNames();

    const stores = {};

    for (const storeName of storeNames) {

        try {

            stores[storeName] =
                await window.rlcsDB.getAll(
                    storeName
                );

        } catch (error) {

            console.warn(
                `Could not export IndexedDB store "${storeName}":`,
                error
            );

            stores[storeName] = [];

        }

    }

    return {
        name:
            window.rlcsDB.name || null,
        version:
            window.rlcsDB.version || null,
        stores
    };

}

function normaliseSimulatorBackup(parsed) {

    if (
        !parsed ||
        typeof parsed !== "object" ||
        Array.isArray(parsed)
    ) {
        throw new Error(
            "The selected file is not a valid simulator backup."
        );
    }

    let localStorageData = null;

    if (
        parsed.localStorage &&
        typeof parsed.localStorage ===
            "object" &&
        !Array.isArray(
            parsed.localStorage
        )
    ) {

        localStorageData =
            parsed.localStorage;

    } else if (
        parsed.data &&
        typeof parsed.data === "object" &&
        !Array.isArray(parsed.data)
    ) {

        /*
            Supports backups made with the
            earlier Console export script.
        */

        localStorageData =
            parsed.data;

    } else if (
        !parsed.app &&
        !parsed.backupVersion &&
        !parsed.indexedDB
    ) {

        /*
            Supports a plain object containing
            localStorage key/value pairs.
        */

        localStorageData =
            parsed;

    }

    if (
        !localStorageData ||
        typeof localStorageData !==
            "object" ||
        Array.isArray(localStorageData)
    ) {
        throw new Error(
            "The backup does not contain local simulator data."
        );
    }

    return {
        localStorage:
            localStorageData,
        indexedDB:
            parsed.indexedDB || null
    };

}

function restoreLocalStorageData(data) {

    let restoredCount = 0;

    for (
        const [key, value]
        of Object.entries(data)
    ) {

        if (value === null) continue;

        try {

            localStorage.setItem(
                key,
                String(value)
            );

            restoredCount++;

        } catch (error) {

            throw new Error(
                `Local storage ran out of space while importing "${key}". ${error.message}`
            );

        }

    }

    return restoredCount;

}

async function restoreIndexedDatabaseData(
    indexedDatabaseData
) {

    if (
        !indexedDatabaseData ||
        !indexedDatabaseData.stores
    ) {
        return 0;
    }

    if (
        !window.rlcsDB ||
        typeof window.rlcsDB.clear !==
            "function" ||
        typeof window.rlcsDB.putMany !==
            "function"
    ) {

        console.warn(
            "IndexedDB data was present in the backup but this simulator version does not expose the database API."
        );

        return 0;

    }

    const availableStoreNames =
        new Set(
            getRlcsDatabaseStoreNames()
        );

    let restoredCount = 0;

    for (
        const [storeName, records]
        of Object.entries(
            indexedDatabaseData.stores
        )
    ) {

        if (
            !availableStoreNames.has(
                storeName
            ) ||
            !Array.isArray(records)
        ) {
            continue;
        }

        await window.rlcsDB.clear(
            storeName
        );

        if (records.length > 0) {

            await window.rlcsDB.putMany(
                storeName,
                records
            );

            restoredCount +=
                records.length;

        }

    }

    return restoredCount;

}

function getRlcsDatabaseStoreNames() {

    if (!window.rlcsDB?.stores) {
        return [];
    }

    return [
        ...new Set(
            Object.values(
                window.rlcsDB.stores
            )
        )
    ];

}

function countIndexedDatabaseRecords(
    indexedDatabaseData
) {

    if (
        !indexedDatabaseData ||
        !indexedDatabaseData.stores
    ) {
        return 0;
    }

    return Object.values(
        indexedDatabaseData.stores
    ).reduce(
        (total, records) =>
            total +
            (
                Array.isArray(records)
                ? records.length
                : 0
            ),
        0
    );

}

async function renderBackupStorageSummary() {

    const container =
        document.getElementById(
            "backupStorageSummary"
        );

    if (!container) return;

    const localCount =
        localStorage.length;

    let databaseCount = 0;

    if (
        window.rlcsDB &&
        typeof window.rlcsDB.count ===
            "function"
    ) {

        const storeNames =
            getRlcsDatabaseStoreNames();

        for (const storeName of storeNames) {

            try {

                databaseCount +=
                    await window.rlcsDB.count(
                        storeName
                    );

            } catch (error) {

                console.warn(
                    `Could not count IndexedDB store "${storeName}":`,
                    error
                );

            }

        }

    }

    container.innerHTML = `

        <div class="settings-summary-grid">

            ${renderSettingCard(
                "Current Storage Address",
                getCurrentStorageOrigin()
            )}

            ${renderSettingCard(
                "Local Data Entries",
                String(localCount)
            )}

            ${renderSettingCard(
                "Database Records",
                String(databaseCount)
            )}

        </div>

    `;

}

function getCurrentStorageOrigin() {

    if (
        window.location.protocol ===
        "file:"
    ) {
        return "Direct file version";
    }

    return window.location.origin;

}

function setBackupStatus(
    message,
    isError = false
) {

    const status =
        document.getElementById(
            "backupStatus"
        );

    if (!status) return;

    status.textContent =
        String(message || "");

    status.style.fontWeight =
        "600";

    status.style.opacity =
        "1";

    status.style.color =
        isError
        ? "#ff6b6b"
        : "";

}

/* ==========================
   STARTUP
========================== */

window.addEventListener(
    "load",
    () => {

        renderSettings();

    }
);