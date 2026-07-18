/* ==========================
   RLCS LEAGUE SIMULATOR
   INDEXEDDB DATABASE
========================== */

const RLCS_DB_NAME =
    "rlcsLeagueSimulatorDB";

const RLCS_DB_VERSION =
    1;

const RLCS_DB_STORES = {
    teams: "teams",
    logos: "logos",
    history: "history",
    league: "league",
    seasons: "seasons",
    settings: "settings",
    metadata: "metadata"
};

let rlcsDatabasePromise = null;

/* ==========================
   OPEN DATABASE
========================== */

function openRlcsDatabase() {

    if (rlcsDatabasePromise) {
        return rlcsDatabasePromise;
    }

    rlcsDatabasePromise =
        new Promise((resolve, reject) => {

            if (!("indexedDB" in window)) {

                reject(
                    new Error(
                        "IndexedDB is not supported by this browser."
                    )
                );

                return;
            }

            const request =
                indexedDB.open(
                    RLCS_DB_NAME,
                    RLCS_DB_VERSION
                );

            request.onupgradeneeded = event => {

                const database =
                    event.target.result;

                createRlcsDatabaseStores(
                    database
                );

            };

            request.onsuccess = event => {

                const database =
                    event.target.result;

                database.onversionchange = () => {

                    database.close();

                    console.warn(
                        "RLCS database closed because a newer version is available."
                    );

                };

                resolve(database);

            };

            request.onerror = () => {

                reject(
                    request.error ||
                    new Error(
                        "Failed to open RLCS database."
                    )
                );

            };

            request.onblocked = () => {

                console.warn(
                    "RLCS database update is blocked. Close other simulator tabs and refresh."
                );

            };

        });

    return rlcsDatabasePromise;

}

/* ==========================
   CREATE DATABASE STORES
========================== */

function createRlcsDatabaseStores(database) {

    if (
        !database.objectStoreNames.contains(
            RLCS_DB_STORES.teams
        )
    ) {

        const teamStore =
            database.createObjectStore(
                RLCS_DB_STORES.teams,
                {
                    keyPath: "id"
                }
            );

        teamStore.createIndex(
            "name",
            "name",
            {
                unique: false
            }
        );

        teamStore.createIndex(
            "region",
            "region",
            {
                unique: false
            }
        );

    }

    if (
        !database.objectStoreNames.contains(
            RLCS_DB_STORES.logos
        )
    ) {

        database.createObjectStore(
            RLCS_DB_STORES.logos,
            {
                keyPath: "teamId"
            }
        );

    }

    if (
        !database.objectStoreNames.contains(
            RLCS_DB_STORES.history
        )
    ) {

        const historyStore =
            database.createObjectStore(
                RLCS_DB_STORES.history,
                {
                    keyPath: "id"
                }
            );

        historyStore.createIndex(
            "eventType",
            "event.type",
            {
                unique: false
            }
        );

        historyStore.createIndex(
            "completedAt",
            "completedAt",
            {
                unique: false
            }
        );

    }

    if (
        !database.objectStoreNames.contains(
            RLCS_DB_STORES.league
        )
    ) {

        database.createObjectStore(
            RLCS_DB_STORES.league,
            {
                keyPath: "key"
            }
        );

    }

    if (
        !database.objectStoreNames.contains(
            RLCS_DB_STORES.seasons
        )
    ) {

        database.createObjectStore(
            RLCS_DB_STORES.seasons,
            {
                keyPath: "key"
            }
        );

    }

    if (
        !database.objectStoreNames.contains(
            RLCS_DB_STORES.settings
        )
    ) {

        database.createObjectStore(
            RLCS_DB_STORES.settings,
            {
                keyPath: "key"
            }
        );

    }

    if (
        !database.objectStoreNames.contains(
            RLCS_DB_STORES.metadata
        )
    ) {

        database.createObjectStore(
            RLCS_DB_STORES.metadata,
            {
                keyPath: "key"
            }
        );

    }

}

/* ==========================
   DATABASE HELPERS
========================== */

async function getRlcsDatabaseStore(
    storeName,
    mode = "readonly"
) {

    const database =
        await openRlcsDatabase();

    if (
        !database.objectStoreNames.contains(
            storeName
        )
    ) {
        throw new Error(
            `Database store "${storeName}" does not exist.`
        );
    }

    const transaction =
        database.transaction(
            storeName,
            mode
        );

    const store =
        transaction.objectStore(
            storeName
        );

    return {
        transaction,
        store
    };

}

async function rlcsDbGet(
    storeName,
    key
) {

    const {
        store
    } =
        await getRlcsDatabaseStore(
            storeName,
            "readonly"
        );

    return new Promise((resolve, reject) => {

        const request =
            store.get(key);

        request.onsuccess = () => {
            resolve(
                request.result || null
            );
        };

        request.onerror = () => {
            reject(request.error);
        };

    });

}

async function rlcsDbGetAll(storeName) {

    const {
        store
    } =
        await getRlcsDatabaseStore(
            storeName,
            "readonly"
        );

    return new Promise((resolve, reject) => {

        const request =
            store.getAll();

        request.onsuccess = () => {
            resolve(
                request.result || []
            );
        };

        request.onerror = () => {
            reject(request.error);
        };

    });

}

async function rlcsDbPut(
    storeName,
    value
) {

    const {
        transaction,
        store
    } =
        await getRlcsDatabaseStore(
            storeName,
            "readwrite"
        );

    return new Promise((resolve, reject) => {

        let savedKey = null;

        const request =
            store.put(value);

        request.onsuccess = () => {
            savedKey = request.result;
        };

        request.onerror = () => {
            reject(request.error);
        };

        transaction.oncomplete = () => {
            resolve(savedKey);
        };

        transaction.onerror = () => {
            reject(transaction.error);
        };

        transaction.onabort = () => {
            reject(
                transaction.error ||
                new Error(
                    "Database transaction was aborted."
                )
            );
        };

    });

}

async function rlcsDbPutMany(
    storeName,
    values
) {

    if (!Array.isArray(values)) {
        throw new Error(
            "rlcsDbPutMany requires an array."
        );
    }

    if (values.length === 0) {
        return [];
    }

    const {
        transaction,
        store
    } =
        await getRlcsDatabaseStore(
            storeName,
            "readwrite"
        );

    return new Promise((resolve, reject) => {

        const savedKeys = [];

        values.forEach(value => {

            const request =
                store.put(value);

            request.onsuccess = () => {
                savedKeys.push(
                    request.result
                );
            };

            request.onerror = () => {
                transaction.abort();
            };

        });

        transaction.oncomplete = () => {
            resolve(savedKeys);
        };

        transaction.onerror = () => {
            reject(transaction.error);
        };

        transaction.onabort = () => {
            reject(
                transaction.error ||
                new Error(
                    "Bulk database transaction was aborted."
                )
            );
        };

    });

}

async function rlcsDbDelete(
    storeName,
    key
) {

    const {
        transaction,
        store
    } =
        await getRlcsDatabaseStore(
            storeName,
            "readwrite"
        );

    return new Promise((resolve, reject) => {

        const request =
            store.delete(key);

        request.onerror = () => {
            reject(request.error);
        };

        transaction.oncomplete = () => {
            resolve(true);
        };

        transaction.onerror = () => {
            reject(transaction.error);
        };

    });

}

async function rlcsDbClear(storeName) {

    const {
        transaction,
        store
    } =
        await getRlcsDatabaseStore(
            storeName,
            "readwrite"
        );

    return new Promise((resolve, reject) => {

        const request =
            store.clear();

        request.onerror = () => {
            reject(request.error);
        };

        transaction.oncomplete = () => {
            resolve(true);
        };

        transaction.onerror = () => {
            reject(transaction.error);
        };

    });

}

async function rlcsDbCount(storeName) {

    const {
        store
    } =
        await getRlcsDatabaseStore(
            storeName,
            "readonly"
        );

    return new Promise((resolve, reject) => {

        const request =
            store.count();

        request.onsuccess = () => {
            resolve(request.result);
        };

        request.onerror = () => {
            reject(request.error);
        };

    });

}

/* ==========================
   DATABASE INFORMATION
========================== */

async function getRlcsStorageEstimate() {

    if (
        !navigator.storage ||
        typeof navigator.storage.estimate !==
        "function"
    ) {
        return {
            usage: 0,
            quota: 0,
            usageMegabytes: 0,
            quotaMegabytes: 0,
            percentage: 0
        };
    }

    const estimate =
        await navigator.storage.estimate();

    const usage =
        Number(estimate.usage || 0);

    const quota =
        Number(estimate.quota || 0);

    return {
        usage,
        quota,

        usageMegabytes:
            usage / 1024 / 1024,

        quotaMegabytes:
            quota / 1024 / 1024,

        percentage:
            quota > 0
            ? usage / quota * 100
            : 0
    };

}

/* ==========================
   GLOBAL DATABASE API
========================== */

window.rlcsDB = {
    name:
        RLCS_DB_NAME,

    version:
        RLCS_DB_VERSION,

    stores:
        RLCS_DB_STORES,

    open:
        openRlcsDatabase,

    get:
        rlcsDbGet,

    getAll:
        rlcsDbGetAll,

    put:
        rlcsDbPut,

    putMany:
        rlcsDbPutMany,

    delete:
        rlcsDbDelete,

    clear:
        rlcsDbClear,

    count:
        rlcsDbCount,

    getStorageEstimate:
        getRlcsStorageEstimate
};

/* ==========================
   INITIALISE DATABASE
========================== */

window.addEventListener(
    "DOMContentLoaded",
    async () => {

        try {

            await openRlcsDatabase();

            console.log(
                "RLCS IndexedDB database ready."
            );

        } catch (error) {

            console.error(
                "Failed to initialise RLCS IndexedDB:",
                error
            );

        }

    }
);