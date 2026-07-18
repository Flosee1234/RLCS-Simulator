/* =====================================================================
   RLCS INSANE UPGRADES — surfaces data that already exists in
   rlcsTournamentHistory but was never shown to the user: head-to-head
   rivalries and team MVP leaderboards. Also batches bulk-simulation
   feedback into a single toast instead of nothing at all.

   Everything here reads existing storage and wraps existing render
   functions — it does not change how results are computed or stored.
===================================================================== */

(function () {

    function escapeIU(value) {
        return String(value ?? "").replace(/[<>&]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));
    }

    function readHistory() {
        try {
            return JSON.parse(localStorage.getItem("rlcsTournamentHistory") || "[]");
        } catch (error) {
            return [];
        }
    }

    /* -----------------------------------------------------------
       RIVALRY TRACKER
       Walks every historical event record looking for any nested
       object shaped like a completed match ({teamA/teamB or
       teamAId/teamBId} + scoreA/scoreB + winner) regardless of which
       stage (bracket, groupStage, lcq, playIn, swiss, doubleElim) it
       came from, then aggregates head-to-head results by opponent.
    ----------------------------------------------------------- */

    function collectMatchNodes(node, acc, seen) {
        if (!node || typeof node !== "object") return;
        if (seen.has(node)) return;
        seen.add(node);

        if (Array.isArray(node)) {
            node.forEach(item => collectMatchNodes(item, acc, seen));
            return;
        }

        const teamALabel = node.teamA || node.teamAId;
        const teamBLabel = node.teamB || node.teamBId;
        const hasScores = node.scoreA !== undefined && node.scoreB !== undefined;

        if (teamALabel && teamBLabel && hasScores) {
            acc.push(node);
        }

        Object.keys(node).forEach(key => {
            const value = node[key];
            if (value && typeof value === "object") {
                collectMatchNodes(value, acc, seen);
            }
        });
    }

    function nameOf(matchSide) {
        return typeof matchSide === "string" ? matchSide : (matchSide?.name || String(matchSide || ""));
    }

    function computeRivalries(teamName) {
        const history = readHistory();
        const matches = [];
        const seen = new Set();

        history.forEach(record => {
            collectMatchNodes(record, matches, seen);
        });

        const byOpponent = {};

        matches.forEach(match => {
            const a = nameOf(match.teamA ?? match.teamAId);
            const b = nameOf(match.teamB ?? match.teamBId);
            if (a !== teamName && b !== teamName) return;

            const opponent = a === teamName ? b : a;
            if (!opponent || opponent === teamName) return;

            const scoreA = Number(match.scoreA || 0);
            const scoreB = Number(match.scoreB || 0);
            const teamIsA = a === teamName;
            const teamScore = teamIsA ? scoreA : scoreB;
            const oppScore = teamIsA ? scoreB : scoreA;
            const winnerName = nameOf(match.winner);
            const teamWon = winnerName
                ? winnerName === teamName
                : teamScore > oppScore;

            if (!byOpponent[opponent]) {
                byOpponent[opponent] = { opponent, wins: 0, losses: 0, gamesFor: 0, gamesAgainst: 0 };
            }

            byOpponent[opponent].wins += teamWon ? 1 : 0;
            byOpponent[opponent].losses += teamWon ? 0 : 1;
            byOpponent[opponent].gamesFor += teamScore;
            byOpponent[opponent].gamesAgainst += oppScore;
        });

        return Object.values(byOpponent)
            .sort((x, y) => (y.wins + y.losses) - (x.wins + x.losses))
            .slice(0, 5);
    }

    function renderRivalryCard(teamName) {
        const rivalries = computeRivalries(teamName);

        if (rivalries.length === 0) {
            return "";
        }

        const rows = rivalries.map(r => {
            const total = r.wins + r.losses || 1;
            const pct = Math.round((r.wins / total) * 100);
            return `
                <div class="rl-rivalry-row">
                    <span>${escapeIU(r.opponent)}</span>
                    <div class="rl-rivalry-bar">
                        <div class="rl-rivalry-fill-a" style="width:${pct}%"></div>
                        <div class="rl-rivalry-fill-b" style="width:${100 - pct}%"></div>
                    </div>
                    <span>${r.wins}-${r.losses}</span>
                </div>
            `;
        }).join("");

        return `
            <div class="rl-rivalry-card">
                <div class="rl-rivalry-head"><span>Head-to-Head</span><span>Series W-L</span></div>
                ${rows}
            </div>
        `;
    }

    /* -----------------------------------------------------------
       MVP LEADERBOARD
       Tallies record.topMVP (already saved per historical event)
       for players belonging to this team.
    ----------------------------------------------------------- */

    function computeTeamMvps(teamName) {
        const history = readHistory();
        const tally = {};

        history.forEach(record => {
            const mvp = record.topMVP;
            if (!mvp || mvp.teamName !== teamName) return;
            tally[mvp.name] = (tally[mvp.name] || 0) + 1;
        });

        return Object.entries(tally)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);
    }

    function renderMvpCard(teamName) {
        const leaders = computeTeamMvps(teamName);
        if (leaders.length === 0) return "";

        const rows = leaders.map((entry, index) => `
            <div class="rl-mvp-row">
                <span class="rl-mvp-rank">#${index + 1}</span>
                <span>${escapeIU(entry.name)}</span>
                <strong style="margin-left:auto;">${entry.count} MVP${entry.count === 1 ? "" : "s"}</strong>
            </div>
        `).join("");

        return `
            <div class="rl-mvp-card">
                <div class="rl-rivalry-head"><span>Event MVP Leaders</span></div>
                ${rows}
            </div>
        `;
    }

    /* -----------------------------------------------------------
       WRAP renderSelectedTeamProfile TO APPEND WIDGETS
    ----------------------------------------------------------- */

    function installProfileHook() {
        if (typeof window.renderSelectedTeamProfile !== "function") {
            setTimeout(installProfileHook, 50);
            return;
        }
        if (window.renderSelectedTeamProfile.__rlcsWrapped) return;

        const original = window.renderSelectedTeamProfile;
        const wrapped = function () {
            original.apply(this, arguments);

            const container = document.getElementById("teamProfileView");
            const select = document.getElementById("profileTeamSelect");
            if (!container || !select || !select.value) return;

            const team = typeof getProfileTeamById === "function"
                ? getProfileTeamById(select.value)
                : null;
            if (!team) return;

            const extra = document.createElement("div");
            extra.className = "team-profile-two-column";
            extra.innerHTML = renderRivalryCard(team.name) + renderMvpCard(team.name);

            if (extra.innerHTML.trim()) {
                container.appendChild(extra);
            }
        };
        wrapped.__rlcsWrapped = true;
        window.renderSelectedTeamProfile = wrapped;
    }

    /* -----------------------------------------------------------
       BULK SIMULATION TOAST — batches matchFeed insertions so a
       "simulate whole round/event" action gets one clear summary
       instead of nothing (single matches already get a Replay
       button and, the first time, an auto-opened Match Center).
    ----------------------------------------------------------- */

    function installFeedObserver() {
        const feed = document.getElementById("matchFeed");
        if (!feed) {
            setTimeout(installFeedObserver, 100);
            return;
        }

        let batchCount = 0;
        let debounceTimer = null;

        const observer = new MutationObserver(mutations => {
            const added = mutations.reduce((sum, m) => sum + m.addedNodes.length, 0);
            if (added === 0) return;

            batchCount += added;
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                if (batchCount >= 3 && typeof window.rlToast === "function") {
                    window.rlToast(
                        `${batchCount} series simulated`,
                        "Tap to review results in the Match Center.",
                        { onClick: () => document.getElementById("mcPanel")?.classList.add("mc-open") }
                    );
                }
                batchCount = 0;
            }, 450);
        });

        observer.observe(feed, { childList: true });
    }

    document.addEventListener("DOMContentLoaded", function () {
        installProfileHook();
        installFeedObserver();
    });

})();
