/* =====================================================================
   RLCS MATCH CENTER — cinematic series playback
   -----------------------------------------------------------------
   This file does not modify any existing simulation logic. It wraps
   the existing global `addMatchCard(result)` function (defined in
   tournament.js, called after every simulateSeries() across the app)
   to additionally: record the result for replay, attach a "Replay"
   button to the card that was just rendered, and — the first time
   only, per page load — auto-open a full cinematic playback so the
   feature is discoverable without spamming during bulk simulation.
===================================================================== */

(function () {

    const RLCS_MC = {
        history: [],
        maxHistory: 40,
        hasAutoOpened: false,
        playToken: 0
    };

    window.RLCS_MC = RLCS_MC;

    /* -----------------------------------------------------------
       DOM SCAFFOLD
    ----------------------------------------------------------- */

    function buildScaffold() {

        const overlay = document.createElement("div");
        overlay.className = "mc-overlay";
        overlay.id = "mcOverlay";
        overlay.innerHTML = `
            <div class="mc-stage" role="dialog" aria-modal="true" aria-label="Match Center">
                <button class="mc-close" type="button" aria-label="Close match center">&times;</button>
                <div class="mc-header" id="mcHeaderLabel">MATCH CENTER</div>
                <div class="mc-matchup">
                    <div class="mc-side mc-blue">
                        <img id="mcLogoA" alt="">
                        <div class="mc-side-name" id="mcNameA">Team A</div>
                        <div class="mc-side-rating" id="mcRatingA">Rating —</div>
                    </div>
                    <div class="mc-vs">VS</div>
                    <div class="mc-side mc-orange">
                        <img id="mcLogoB" alt="">
                        <div class="mc-side-name" id="mcNameB">Team B</div>
                        <div class="mc-side-rating" id="mcRatingB">Rating —</div>
                    </div>
                </div>
                <div class="mc-prob-bar">
                    <div class="mc-prob-fill-a" id="mcProbA" style="width:50%"></div>
                    <div class="mc-prob-fill-b" id="mcProbB" style="width:50%"></div>
                </div>
                <div class="mc-scoretrack">
                    <span class="mc-score-num" id="mcScoreA">0</span>
                    <span style="color:var(--muted); font-family:var(--font-display);">—</span>
                    <span class="mc-score-num" id="mcScoreB">0</span>
                </div>
                <div class="mc-games" id="mcGames"></div>
                <div class="mc-footer">
                    <div>
                        <div class="mc-winner-banner" id="mcWinnerBanner"></div>
                        <div id="mcMvpChip"></div>
                    </div>
                    <div class="mc-controls">
                        <button type="button" id="mcSkipBtn">Skip &raquo;</button>
                        <button type="button" id="mcCloseBtn2">Close</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        overlay.addEventListener("click", function (event) {
            if (event.target === overlay) closeTheater();
        });
        overlay.querySelector(".mc-close").addEventListener("click", closeTheater);
        overlay.querySelector("#mcCloseBtn2").addEventListener("click", closeTheater);
        overlay.querySelector("#mcSkipBtn").addEventListener("click", function () {
            RLCS_MC.playToken++;
            renderFinalState(RLCS_MC.activeResult);
        });

        const launcher = document.createElement("button");
        launcher.type = "button";
        launcher.className = "mc-launcher";
        launcher.id = "mcLauncher";
        launcher.innerHTML = `
            <span>&#9654;</span>
            <span class="mc-launcher-label">Match Center</span>
            <span class="mc-launcher-badge mc-hidden" id="mcLauncherBadge">0</span>
        `;
        document.body.appendChild(launcher);
        launcher.addEventListener("click", togglePanel);

        const panel = document.createElement("div");
        panel.className = "mc-panel";
        panel.id = "mcPanel";
        panel.innerHTML = `
            <div class="mc-panel-title">Recent Series</div>
            <div id="mcPanelList"></div>
        `;
        document.body.appendChild(panel);

        const toastStack = document.createElement("div");
        toastStack.className = "rl-toast-stack";
        toastStack.id = "rlToastStack";
        document.body.appendChild(toastStack);

        const confettiCanvas = document.createElement("canvas");
        confettiCanvas.className = "rl-confetti-canvas";
        confettiCanvas.id = "rlConfettiCanvas";
        document.body.appendChild(confettiCanvas);

        document.addEventListener("keydown", function (event) {
            if (event.key === "Escape") closeTheater();
        });
    }

    /* -----------------------------------------------------------
       RESULT RECORDING
    ----------------------------------------------------------- */

    function recordResult(result) {
        RLCS_MC.history.unshift(result);
        if (RLCS_MC.history.length > RLCS_MC.maxHistory) {
            RLCS_MC.history.length = RLCS_MC.maxHistory;
        }
        updateLauncherBadge();
        renderPanelList();
    }

    function updateLauncherBadge() {
        const badge = document.getElementById("mcLauncherBadge");
        if (!badge) return;
        const count = RLCS_MC.history.length;
        badge.textContent = count > 99 ? "99+" : String(count);
        badge.classList.toggle("mc-hidden", count === 0);
    }

    function renderPanelList() {
        const list = document.getElementById("mcPanelList");
        if (!list) return;

        if (RLCS_MC.history.length === 0) {
            list.innerHTML = `<div class="mc-panel-empty">No series simulated yet.</div>`;
            return;
        }

        list.innerHTML = RLCS_MC.history.map((result, index) => `
            <div class="mc-panel-item" data-mc-index="${index}">
                <span>${safeMc(result.teamAName)} <strong>${result.scoreA}-${result.scoreB}</strong> ${safeMc(result.teamBName)}
                    <small>${safeMc(result.winner)} won &middot; MVP ${safeMc(result.mvp || "—")}</small>
                </span>
                <span>&#9654;</span>
            </div>
        `).join("");

        list.querySelectorAll("[data-mc-index]").forEach(item => {
            item.addEventListener("click", function () {
                const idx = Number(item.getAttribute("data-mc-index"));
                openTheater(RLCS_MC.history[idx]);
                closePanel();
            });
        });
    }

    function togglePanel() {
        const panel = document.getElementById("mcPanel");
        panel.classList.toggle("mc-open");
    }

    function closePanel() {
        document.getElementById("mcPanel")?.classList.remove("mc-open");
    }

    /* -----------------------------------------------------------
       REPLAY BUTTON INJECTION ONTO LIVE MATCH FEED CARDS
    ----------------------------------------------------------- */

    function attachReplayButton(result) {
        const feed = document.getElementById("matchFeed");
        if (!feed || !feed.lastElementChild) return;

        const footer = feed.lastElementChild.querySelector(".broadcast-footer");
        if (!footer || footer.querySelector(".mc-replay-btn")) return;

        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "mc-replay-btn";
        btn.textContent = "\u25B6 Replay";
        btn.addEventListener("click", function (event) {
            event.stopPropagation();
            openTheater(result);
        });
        footer.appendChild(btn);
    }

    /* -----------------------------------------------------------
       THEATER PLAYBACK
    ----------------------------------------------------------- */

    function safeMc(value) {
        return String(value ?? "").replace(/[<>&]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));
    }

    function teamInitialAvatar(name) {
        const letter = (name || "?").trim().charAt(0).toUpperCase() || "?";
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="72" height="72"><rect width="72" height="72" rx="14" fill="#151f31"/><text x="50%" y="56%" text-anchor="middle" font-family="Rajdhani, sans-serif" font-size="30" fill="#8d96ae">${letter}</text></svg>`;
        return "data:image/svg+xml;base64," + btoa(svg);
    }

    function openTheater(result) {
        if (!result) return;

        RLCS_MC.activeResult = result;
        RLCS_MC.playToken++;
        const myToken = RLCS_MC.playToken;

        const overlay = document.getElementById("mcOverlay");
        document.getElementById("mcHeaderLabel").textContent =
            (result.form && result.form.enabled ? "LIVE FROM THE ARENA" : "MATCH CENTER") + " \u00b7 BEST OF " + (result.games ? result.games.length + (result.games.length % 2) : "?");

        document.getElementById("mcNameA").textContent = result.teamAName || "Team A";
        document.getElementById("mcNameB").textContent = result.teamBName || "Team B";
        document.getElementById("mcLogoA").src = result.teamALogo || teamInitialAvatar(result.teamAName);
        document.getElementById("mcLogoB").src = result.teamBLogo || teamInitialAvatar(result.teamBName);

        const ratingA = result.ratingBreakdown?.teamA?.effectiveRating;
        const ratingB = result.ratingBreakdown?.teamB?.effectiveRating;
        document.getElementById("mcRatingA").textContent = ratingA != null ? `Rating ${ratingA}` : "";
        document.getElementById("mcRatingB").textContent = ratingB != null ? `Rating ${ratingB}` : "";

        const probA = result.form?.probabilityA != null ? result.form.probabilityA : 50;
        document.getElementById("mcProbA").style.width = probA + "%";
        document.getElementById("mcProbB").style.width = (100 - probA) + "%";

        document.getElementById("mcScoreA").textContent = "0";
        document.getElementById("mcScoreB").textContent = "0";
        document.getElementById("mcGames").innerHTML = "";
        document.getElementById("mcWinnerBanner").className = "mc-winner-banner";
        document.getElementById("mcWinnerBanner").textContent = "";
        document.getElementById("mcMvpChip").innerHTML = "";

        overlay.classList.add("mc-open");

        playSequence(result, myToken);
    }

    function playSequence(result, myToken) {
        const games = result.games || [];
        let runningA = 0;
        let runningB = 0;
        const gamesEl = document.getElementById("mcGames");

        games.forEach((game, index) => {
            setTimeout(() => {
                if (myToken !== RLCS_MC.playToken) return;

                const teamAWon = String(game.winnerId) === String(result.teamAId) ||
                    game.winner === result.teamAName;

                if (teamAWon) runningA++; else runningB++;

                const row = document.createElement("div");
                row.className = "mc-game-row " + (teamAWon ? "mc-game-win-a" : "mc-game-win-b");
                row.style.animationDelay = "0ms";
                row.innerHTML = `
                    <span class="mc-game-label">GAME ${game.gameNumber}${game.overtime ? ' <span class="ot-badge">OT</span>' : ""}</span>
                    <span class="mc-game-score">${game.teamAScore} - ${game.teamBScore}</span>
                `;
                gamesEl.appendChild(row);

                const scoreAEl = document.getElementById("mcScoreA");
                const scoreBEl = document.getElementById("mcScoreB");
                scoreAEl.textContent = runningA;
                scoreBEl.textContent = runningB;
                const bumpEl = teamAWon ? scoreAEl : scoreBEl;
                bumpEl.classList.remove("mc-bump");
                void bumpEl.offsetWidth;
                bumpEl.classList.add("mc-bump");

            }, index * 750);
        });

        setTimeout(() => {
            if (myToken !== RLCS_MC.playToken) return;
            renderFinalState(result);
        }, games.length * 750 + 250);
    }

    function renderFinalState(result) {
        if (!result) return;

        const games = result.games || [];
        document.getElementById("mcScoreA").textContent = result.scoreA;
        document.getElementById("mcScoreB").textContent = result.scoreB;

        const gamesEl = document.getElementById("mcGames");
        gamesEl.innerHTML = games.map(game => {
            const teamAWon = String(game.winnerId) === String(result.teamAId) || game.winner === result.teamAName;
            return `
                <div class="mc-game-row ${teamAWon ? "mc-game-win-a" : "mc-game-win-b"}" style="opacity:1; transform:none;">
                    <span class="mc-game-label">GAME ${game.gameNumber}${game.overtime ? ' <span class="ot-badge">OT</span>' : ""}</span>
                    <span class="mc-game-score">${game.teamAScore} - ${game.teamBScore}</span>
                </div>
            `;
        }).join("");

        const banner = document.getElementById("mcWinnerBanner");
        banner.textContent = "\uD83C\uDFC6 " + safeMc(result.winner) + " win the series " + result.scoreA + "-" + result.scoreB;
        banner.classList.add("mc-show");

        if (result.mvp) {
            document.getElementById("mcMvpChip").innerHTML =
                `<span class="mc-mvp-chip">\u2B50 Series MVP &middot; ${safeMc(result.mvp)}</span>`;
        }

        fireConfetti();
    }

    function closeTheater() {
        document.getElementById("mcOverlay")?.classList.remove("mc-open");
        RLCS_MC.playToken++;
    }

    /* -----------------------------------------------------------
       CONFETTI
    ----------------------------------------------------------- */

    function fireConfetti() {
        const canvas = document.getElementById("rlConfettiCanvas");
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        const colors = ["#2f8fff", "#ff6a2b", "#ffc53d", "#f5f7fc"];
        const pieces = Array.from({ length: 90 }, () => ({
            x: canvas.width / 2 + (Math.random() - 0.5) * 300,
            y: canvas.height * 0.35,
            vx: (Math.random() - 0.5) * 9,
            vy: Math.random() * -9 - 3,
            size: Math.random() * 6 + 4,
            color: colors[Math.floor(Math.random() * colors.length)],
            rotation: Math.random() * 360,
            spin: (Math.random() - 0.5) * 14
        }));

        let frame = 0;
        const maxFrames = 110;

        function tick() {
            frame++;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            pieces.forEach(piece => {
                piece.vy += 0.28;
                piece.x += piece.vx;
                piece.y += piece.vy;
                piece.rotation += piece.spin;
                ctx.save();
                ctx.translate(piece.x, piece.y);
                ctx.rotate((piece.rotation * Math.PI) / 180);
                ctx.fillStyle = piece.color;
                ctx.fillRect(-piece.size / 2, -piece.size / 2, piece.size, piece.size * 0.6);
                ctx.restore();
            });
            if (frame < maxFrames) {
                requestAnimationFrame(tick);
            } else {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
        }
        requestAnimationFrame(tick);
    }

    /* -----------------------------------------------------------
       TOASTS (shared utility, also used by insane-upgrades.js)
    ----------------------------------------------------------- */

    window.rlToast = function (title, body, opts) {
        const stack = document.getElementById("rlToastStack");
        if (!stack) return;
        const toast = document.createElement("div");
        toast.className = "rl-toast";
        toast.innerHTML = `<strong>${safeMc(title)}</strong>${body ? safeMc(body) : ""}`;
        toast.addEventListener("click", () => dismiss());
        if (opts && typeof opts.onClick === "function") {
            toast.addEventListener("click", opts.onClick);
        }
        stack.appendChild(toast);

        function dismiss() {
            toast.classList.add("rl-toast-out");
            setTimeout(() => toast.remove(), 260);
        }
        setTimeout(dismiss, (opts && opts.duration) || 4200);
    };

    /* -----------------------------------------------------------
       HOOK INTO EXISTING addMatchCard() WITHOUT MODIFYING IT
    ----------------------------------------------------------- */

    function installHook() {
        if (typeof window.addMatchCard !== "function") {
            // tournament.js not ready yet on this pass — try again shortly.
            setTimeout(installHook, 50);
            return;
        }
        if (window.addMatchCard.__rlcsWrapped) return;

        const original = window.addMatchCard;
        const wrapped = function (result) {
            original(result);
            recordResult(result);
            attachReplayButton(result);

            if (!RLCS_MC.hasAutoOpened) {
                RLCS_MC.hasAutoOpened = true;
                setTimeout(() => openTheater(result), 300);
            }
        };
        wrapped.__rlcsWrapped = true;
        window.addMatchCard = wrapped;
    }

    window.playMatchReplay = openTheater;

    document.addEventListener("DOMContentLoaded", function () {
        buildScaffold();
        installHook();
        renderPanelList();
    });

})();
