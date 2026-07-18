let currentLanQualifiedTeams = [];

const LAN_SLOT_PRESETS = {
    major: {
        NA: 4,
        EU: 4,
        SAM: 2,
        MENA: 2,
        OCE: 1,
        APAC: 1,
        SSA: 1,
        wildcard: 1
    },

    worlds: {
        NA: 4,
        EU: 5,
        SAM: 1,
        MENA: 2,
        OCE: 0,
        APAC: 0,
        SSA: 0,
        wildcard: 0
    }
};

/* ==========================
   PRESET UI
========================== */

function ensureLanPresetControls() {

    const lanType =
        document.getElementById("lanType");

    if (!lanType) return;

    const card =
        lanType.closest(".team-form-card");

    if (!card) return;

    if (
        !document.getElementById(
            "lanPresetControls"
        )
    ) {

        const controls =
            document.createElement("div");

        controls.id = "lanPresetControls";
        controls.className = "lan-preset-controls";

        controls.innerHTML = `
            <h3>Qualification Presets</h3>

            <div class="settings-actions">

                <button class="primary-button"
                    onclick="applyLanPreset('major')">

                    Apply Major Preset

                </button>

                <button class="primary-button"
                    onclick="applyLanPreset('worlds')">

                    Apply Worlds Preset

                </button>

            </div>

            <p class="small">
                Major preset is built for 16 teams. Worlds uses 12 automatic Main Event places plus four qualifiers from the eight-team Play-In.
            </p>
        `;

        const slotGrid =
            card.querySelector(".lan-slots-grid");

        if (slotGrid) {
            slotGrid.after(controls);
        } else {
            card.appendChild(controls);
        }

    }

    ensureLanSplitFilter();

}

function ensureLanSplitFilter() {

    if (
        document.getElementById("lanSplitFilter")
    ) {
        return;
    }

    const lanType =
        document.getElementById("lanType");

    const grid =
        lanType?.closest(".event-creator-grid");

    if (!grid) return;

    const wrapper =
        document.createElement("div");

    wrapper.innerHTML = `
        <label>
            Qualification Split
        </label>

        <select id="lanSplitFilter"
            onchange="renderLanQualification()">

            <option value="1">
                Split 1
            </option>

            <option value="2">
                Split 2
            </option>

            <option value="3">
                Split 3
            </option>

            <option value="all">
                Full Season
            </option>

        </select>
    `;

    grid.appendChild(wrapper);

}

function applyLanPreset(
    presetName,
    shouldRender = true
) {

    let preset = LAN_SLOT_PRESETS[presetName];

    if (
        presetName === "major" &&
        typeof getCompetitionMajorSlots === "function"
    ) {
        preset = getCompetitionMajorSlots(
            typeof getSeasonState === "function"
                ? getSeasonState()
                : null
        );
    }

    if (
        presetName === "worlds" &&
        typeof getCompetitionWorldsDirectSlots === "function"
    ) {
        preset = {
            ...getCompetitionWorldsDirectSlots(
                typeof getSeasonState === "function"
                    ? getSeasonState()
                    : null
            ),
            wildcard: 0
        };
    }

    if (!preset) return;

    setNumberInputValue("slotNA", preset.NA);
    setNumberInputValue("slotEU", preset.EU);
    setNumberInputValue("slotSAM", preset.SAM);
    setNumberInputValue("slotMENA", preset.MENA);
    setNumberInputValue("slotOCE", preset.OCE);
    setNumberInputValue("slotAPAC", preset.APAC);
    setNumberInputValue("slotSSA", preset.SSA);
    setNumberInputValue("slotWildcard", preset.wildcard);

    if (shouldRender) {
        renderLanQualification();
    }

}

function setNumberInputValue(id, value) {

    const input =
        document.getElementById(id);

    if (input) {
        input.value = value;
    }

}

/* ==========================
   SLOT CONFIG
========================== */

function getLanSlotConfig() {

    return {
        NA: getNumberInputValue("slotNA"),
        EU: getNumberInputValue("slotEU"),
        SAM: getNumberInputValue("slotSAM"),
        MENA: getNumberInputValue("slotMENA"),
        OCE: getNumberInputValue("slotOCE"),
        APAC: getNumberInputValue("slotAPAC"),
        SSA: getNumberInputValue("slotSSA"),
        wildcard: getNumberInputValue("slotWildcard")
    };

}

function getNumberInputValue(id) {

    const input =
        document.getElementById(id);

    if (!input) return 0;

    return Math.max(
        0,
        Number(input.value || 0)
    );

}

/* ==========================
   QUALIFICATION LOGIC
========================== */

function getLanQualifiedTeams() {

    const slotConfig =
        getLanSlotConfig();

    const state =
        typeof getLeagueState === "function"
        ? getLeagueState()
        : {
            teams: {}
        };

    const lanType =
        document.getElementById("lanType")
            ?.value || "major";

    const splitFilter =
        document.getElementById("lanSplitFilter")
            ?.value || "1";

    const savedTeams =
        typeof teams !== "undefined" &&
        Array.isArray(teams)
        ? teams
        : [];

    const leagueTeams =
        savedTeams.map(team => {

            const pointsData =
                state.teams[String(team.id)] || {};

            const displayPoints =
                getLanDisplayPoints(
                    pointsData,
                    lanType,
                    splitFilter
                );

            return {
                teamId: team.id,
                teamName: team.name,
                logo: team.logo,
                region: team.region,
                rating: team.rating,

                totalPoints:
                    displayPoints.totalPoints || 0,

                regionalPoints:
                    displayPoints.regionalPoints || 0,

                lanPoints:
                    displayPoints.lanPoints || 0,

                worldsPoints:
                    displayPoints.worldsPoints || 0,

                eventsPlayed:
                    displayPoints.eventsPlayed || 0,

                eventWins:
                    displayPoints.eventWins || 0
            };

        });

    if (lanType === "worlds") {
        const mainEventTeams = typeof getWorldsMainEventQualifiers === "function"
            ? getWorldsMainEventQualifiers()
            : [];

        if (mainEventTeams.length > 0) {
            return mainEventTeams;
        }

        const directTeams = typeof getWorldsDirectQualifiers === "function"
            ? getWorldsDirectQualifiers()
            : [];

        if (directTeams.length > 0) {
            return directTeams;
        }
    }

    const qualifiedTeams = [];
    const qualifiedIds = new Set();

    Object.keys(slotConfig).forEach(region => {

        if (region === "wildcard") return;

        const slots =
            slotConfig[region];

        if (slots <= 0) return;

        const regionTeams =
            leagueTeams
                .filter(team =>
                    team.region === region
                )
                .sort(sortLanTeams);

        const qualifiers =
            regionTeams.slice(0, slots);

        qualifiers.forEach((team, index) => {

            qualifiedIds.add(team.teamId);

            qualifiedTeams.push({
                ...team,
                qualificationRegion: region,
                qualificationSeed: index + 1,
                qualificationType: "Region Slot"
            });

        });

    });

    const wildcardSlots =
        slotConfig.wildcard || 0;

    if (wildcardSlots > 0) {

        const wildcardTeams =
            leagueTeams
                .filter(team =>
                    !qualifiedIds.has(team.teamId)
                )
                .sort(sortLanTeams)
                .slice(0, wildcardSlots);

        wildcardTeams.forEach((team, index) => {

            qualifiedTeams.push({
                ...team,
                qualificationRegion: "Wildcard",
                qualificationSeed: index + 1,
                qualificationType: "Wildcard"
            });

        });

    }

    return qualifiedTeams;

}

function getLanDisplayPoints(
    pointsData,
    lanType,
    splitFilter
) {

    if (
        lanType === "major" &&
        splitFilter !== "all"
    ) {
        return pointsData.splits
            ?. [String(splitFilter)] || {};
    }

    if (
        splitFilter !== "all" &&
        pointsData.splits
    ) {
        return pointsData.splits
            ?. [String(splitFilter)] || {};
    }

    return pointsData || {};

}

function sortLanTeams(a, b) {

    if (b.totalPoints !== a.totalPoints) {
        return b.totalPoints - a.totalPoints;
    }

    if (b.eventWins !== a.eventWins) {
        return b.eventWins - a.eventWins;
    }

    if (b.regionalPoints !== a.regionalPoints) {
        return b.regionalPoints - a.regionalPoints;
    }

    if (b.rating !== a.rating) {
        return b.rating - a.rating;
    }

    return a.teamName.localeCompare(
        b.teamName
    );

}

/* ==========================
   RENDER QUALIFIERS
========================== */

let qualificationHubTab = "overview";

function showQualificationTab(tab) {
    qualificationHubTab = tab;
    document.querySelectorAll("[data-qualification-tab]").forEach(button => button.classList.toggle("active", button.dataset.qualificationTab === tab));
    document.querySelectorAll(".qualification-tab-panel").forEach(panel => panel.classList.add("hidden"));
    const map = {overview:"qualificationOverviewPanel",major:"qualificationMajorPanel",worlds:"qualificationWorldsPanel",lcq:"qualificationLcqPanel",playin:"qualificationPlayInPanel",manual:"qualificationManualPanel"};
    document.getElementById(map[tab])?.classList.remove("hidden");
    renderLanQualification();
}

function renderLanQualification() {
    ensureLanPresetControls();
    renderQualificationOverview();
    renderQualificationMajorRace();
    renderQualificationWorldsRace();
    renderQualificationLcqRace();
    renderQualificationPlayIn();
    renderManualLanPreview();
}

function getQualificationSeasonState() { return typeof getSeasonState === "function" ? getSeasonState() : null; }
function getQualificationTeams() { return typeof teams !== "undefined" && Array.isArray(teams) ? teams : []; }
function getQualificationLeagueState() { return typeof getLeagueState === "function" ? getLeagueState() : {teams:{}}; }

function getQualificationCurrentSplit() {
    const state=getQualificationSeasonState();
    const next=typeof getNextAvailableSeasonEvent === "function" ? getNextAvailableSeasonEvent(state) : null;
    return next && next.split !== "season" ? String(next.split) : String(state?.splits?.at(-1)?.split || "1");
}

function renderQualificationOverview() {
    const container=document.getElementById("qualificationOverviewPanel"); if(!container)return;
    const state=getQualificationSeasonState(); const direct=typeof getWorldsDirectQualifiers==="function"?getWorldsDirectQualifiers(state):[]; const playin=typeof getWorldsPlayInParticipants==="function"?getWorldsPlayInParticipants(state):[]; const main=typeof getWorldsMainEventQualifiers==="function"?getWorldsMainEventQualifiers(state):[]; const rankings=typeof rankRegionsByMajorPerformance==="function"?rankRegionsByMajorPerformance(state):[]; const next=typeof getNextAvailableSeasonEvent==="function"?getNextAvailableSeasonEvent(state):null;
    container.innerHTML=`<div class="qualification-stat-grid"><div><span>Worlds Auto Places</span><strong>${direct.length} / 12</strong></div><div><span>Play-In Field</span><strong>${playin.length} / 8</strong></div><div><span>Main Event Field</span><strong>${main.length} / 16</strong></div><div><span>LCQ Regions</span><strong>${rankings.slice(0,4).filter(r=>r.region).length} / 4</strong></div></div>
    <div class="qualification-overview-grid"><div class="team-form-card"><h3>Next Qualification Milestone</h3>${next?`<div class="qualification-next-card"><span>${escapeLanText(next.type?.toUpperCase()||"EVENT")}</span><strong>${escapeLanText(next.name)}</strong><small>${typeof isSeasonEventLocked==="function"&&isSeasonEventLocked(next,state)?escapeLanText(getSeasonEventLockReason?.(next,state)||"Complete prerequisite events"):"Ready to play"}</small><button class="primary-button" onclick="showPage('season')">Open Season</button></div>`:`<p class="small">The season is complete.</p>`}</div><div class="team-form-card"><h3>Top Major Regions</h3>${rankings.slice(0,5).map(r=>`<div class="qualification-ranking-row ${r.rank<=4?"qualified":""}"><span>#${r.rank} ${escapeLanText(r.region)}</span><strong>${r.majorPoints||0} pts</strong></div>`).join("")||'<p class="small">Complete Majors to rank regions.</p>'}</div></div>`;
}

function getMajorRaceRows(split=getQualificationCurrentSplit()) {
    const league=getQualificationLeagueState(); const teamList=getQualificationTeams(); const slots=typeof getCompetitionMajorSlots==="function"?getCompetitionMajorSlots(getQualificationSeasonState()):LAN_SLOT_PRESETS.major;
    return Object.keys(slots).filter(region=>region!=="wildcard"&&Number(slots[region])>0).map(region=>{const rows=teamList.filter(t=>t.region===region).map(team=>{const points=league.teams?.[String(team.id)]?.splits?.[String(split)]||{}; return {team,points:Number(points.totalPoints||0),wins:Number(points.eventWins||0)};}).sort((a,b)=>b.points-a.points||b.wins-a.wins||Number(b.team.rating||0)-Number(a.team.rating||0)); return {region,slots:Number(slots[region]),rows};});
}

function renderQualificationMajorRace() {
    const container=document.getElementById("qualificationMajorPanel"); if(!container)return; const split=getQualificationCurrentSplit(); const groups=getMajorRaceRows(split);
    container.innerHTML=`<div class="qualification-panel-heading"><div><h3>Split ${escapeLanText(split)} Major Race</h3><p>Regional cutoff lines use current split points.</p></div></div><div class="qualification-region-grid">${groups.map(group=>`<div class="qualification-region-card"><div class="qualification-region-title"><strong>${group.region}</strong><span>${group.slots} spots</span></div>${group.rows.slice(0,Math.max(group.slots+3,6)).map((entry,index)=>`<div class="qualification-team-row ${index<group.slots?"inside":"outside"}"><span>${index+1}. ${escapeLanText(entry.team.name)}</span><strong>${entry.points}</strong></div>${index===group.slots-1?'<div class="qualification-cutline">Major cutoff</div>':''}`).join("")}</div>`).join("")}</div>`;
}

function renderQualificationWorldsRace() {
    const container=document.getElementById("qualificationWorldsPanel"); if(!container)return; const state=getQualificationSeasonState(); const direct=typeof getWorldsDirectQualifiers==="function"?getWorldsDirectQualifiers(state):[]; const playinQualifiers=typeof getWorldsPlayInQualifiers==="function"?getWorldsPlayInQualifiers(state):[]; const main=typeof getWorldsMainEventQualifiers==="function"?getWorldsMainEventQualifiers(state):[];
    container.innerHTML=`<div class="qualification-panel-heading"><div><h3>World Championship Race</h3><p>12 automatic places plus four Worlds Play-In qualifiers.</p></div></div><div class="qualification-worlds-columns"><div class="team-form-card"><h3>Automatic Main Event (${direct.length}/12)</h3>${renderQualificationTeamList(direct,"No automatic qualifiers yet.")}</div><div class="team-form-card"><h3>Play-In Qualifiers (${playinQualifiers.length}/4)</h3>${renderQualificationTeamList(playinQualifiers,"Complete the Worlds Play-In.")}</div><div class="team-form-card"><h3>Current Main Event (${main.length}/16)</h3>${renderQualificationTeamList(main,"The field is not complete yet.")}</div></div>`;
}

function renderQualificationLcqRace() {
    const container=document.getElementById("qualificationLcqPanel"); if(!container)return; const state=getQualificationSeasonState(); const rankings=typeof rankRegionsByMajorPerformance==="function"?rankRegionsByMajorPerformance(state):[]; const lcqs=state?.events?.filter(e=>e.type==="lcq")||[];
    container.innerHTML=`<div class="qualification-panel-heading"><div><h3>Regional Last Chance Qualifiers</h3><p>The four strongest Major-performing regions receive one LCQ each.</p></div></div><div class="qualification-region-grid">${rankings.slice(0,7).map(r=>{const event=lcqs.find(e=>Number(e.lcqSlot)===Number(r.rank)); return `<div class="qualification-region-card ${r.rank<=4?"active-path":""}"><div class="qualification-region-title"><strong>#${r.rank} ${escapeLanText(r.region)}</strong><span>${r.majorPoints||0} Major pts</span></div><p>${r.rank<=4?"LCQ position":"Outside LCQ cutoff"}</p>${event?`<div class="qualification-team-row"><span>${escapeLanText(event.name)}</span><strong>${escapeLanText(event.status||"scheduled")}</strong></div>${event.champion?`<div class="qualification-team-row qualified"><span>Winner</span><strong>${escapeLanText(event.champion)}</strong></div>`:""}`:""}</div>`}).join("")||'<p class="small">Region rankings will appear after Majors.</p>'}</div>`;
}

function renderQualificationPlayIn() {
    const container=document.getElementById("qualificationPlayInPanel"); if(!container)return; const state=getQualificationSeasonState(); const participants=typeof getWorldsPlayInParticipants==="function"?getWorldsPlayInParticipants(state):[]; const qualifiers=typeof getWorldsPlayInQualifiers==="function"?getWorldsPlayInQualifiers(state):[]; const event=state?.events?.find(e=>e.type==="playin");
    container.innerHTML=`<div class="qualification-panel-heading"><div><h3>Worlds Play-In</h3><p>Eight teams compete for four Main Event places.</p></div><span class="qualification-status-pill">${escapeLanText(event?.status||"scheduled")}</span></div><div class="qualification-worlds-columns"><div class="team-form-card"><h3>Play-In Field (${participants.length}/8)</h3>${renderQualificationTeamList(participants,"Complete regional LCQs and fixed regional qualification.")}</div><div class="team-form-card"><h3>Qualified (${qualifiers.length}/4)</h3>${renderQualificationTeamList(qualifiers,"Complete the Play-In bracket.")}</div><div class="team-form-card"><h3>Format</h3><p>Upper Quarterfinals → Upper Semifinals</p><p>Lower Quarterfinals → Lower Semifinals</p><p><strong>Four winners qualify.</strong></p>${event&&!isSeasonEventLocked(event,state)?`<button class="primary-button" onclick="loadSeasonEvent('${escapeLanText(event.id)}')">Load Play-In</button>`:""}</div></div>`;
}

function renderQualificationTeamList(list, empty) { return list.length ? `<div class="qualification-team-list">${list.map((entry,index)=>{const team=entry.team||entry; return `<div class="qualification-team-row"><span>${index+1}. ${escapeLanText(team.teamName||team.name||"Unknown")}</span><strong>${escapeLanText(entry.qualificationRegion||entry.qualificationType||team.region||"")}</strong></div>`}).join("")}</div>` : `<p class="small">${escapeLanText(empty)}</p>`; }

function renderManualLanPreview() {
    const container=document.getElementById("lanQualifiedTeams"); if(!container)return; currentLanQualifiedTeams=getLanQualifiedTeams(); const lanType=document.getElementById("lanType")?.value||"major"; const splitFilter=document.getElementById("lanSplitFilter")?.value||"1";
    if(!currentLanQualifiedTeams.length){container.innerHTML='<p class="small">No teams qualified yet. Run events first or check the slot settings.</p>';return;}
    const grouped=groupQualifiedTeamsByRegion(currentLanQualifiedTeams); container.innerHTML=`<div class="lan-summary-card"><strong>${currentLanQualifiedTeams.length} Teams Qualified</strong><span>${lanType==="major"?`Using ${splitFilter==="all"?"full season":`Split ${splitFilter}`} points.`:"Using the current Worlds qualification field."}</span></div>${Object.keys(grouped).map(region=>`<div class="lan-region-block"><h3>${escapeLanText(region)} Qualifiers</h3>${renderQualificationTeamList(grouped[region],"")}</div>`).join("")}`;
}

function renderSeasonQualificationSnapshot() {
    const container=document.getElementById("seasonQualificationSnapshot"); if(!container)return; const state=getQualificationSeasonState(); const direct=typeof getWorldsDirectQualifiers==="function"?getWorldsDirectQualifiers(state):[]; const playin=typeof getWorldsPlayInParticipants==="function"?getWorldsPlayInParticipants(state):[]; const rankings=typeof rankRegionsByMajorPerformance==="function"?rankRegionsByMajorPerformance(state):[];
    container.innerHTML=`<div class="qualification-stat-grid"><div><span>Worlds Auto</span><strong>${direct.length}/12</strong></div><div><span>Play-In</span><strong>${playin.length}/8</strong></div><div><span>LCQ Regions</span><strong>${rankings.slice(0,4).length}/4</strong></div></div><div class="qualification-overview-grid"><div><h4>Current Direct Qualifiers</h4>${renderQualificationTeamList(direct.slice(0,12),"None yet")}</div><div><h4>Top Major Regions</h4>${rankings.slice(0,4).map(r=>`<div class="qualification-ranking-row qualified"><span>#${r.rank} ${escapeLanText(r.region)}</span><strong>${r.majorPoints||0}</strong></div>`).join("")||'<p class="small">Complete Majors first.</p>'}</div></div>`;
}

function groupQualifiedTeamsByRegion(qualifiedTeams) {

    const grouped = {};

    qualifiedTeams.forEach(team => {

        if (!grouped[team.qualificationRegion]) {
            grouped[team.qualificationRegion] = [];
        }

        grouped[team.qualificationRegion].push(team);

    });

    return grouped;

}

/* ==========================
   CREATE LAN EVENT
========================== */

function createLanEventFromQualifiedTeams() {

    currentLanQualifiedTeams =
        getLanQualifiedTeams();

    if (currentLanQualifiedTeams.length < 2) {
        alert("You need at least 2 qualified teams.");
        return;
    }

    const lanNameInput =
        document.getElementById("lanName");

    const lanTypeInput =
        document.getElementById("lanType");

    const lanSplitInput =
        document.getElementById("lanSplitFilter");

    const lanName =
        lanNameInput &&
        lanNameInput.value.trim()
        ? lanNameInput.value.trim()
        : "RLCS Major";

    const lanType =
        lanTypeInput
        ? lanTypeInput.value
        : "major";

    const split =
        lanSplitInput
        ? lanSplitInput.value
        : "1";

    const eventNameInput =
        document.getElementById("eventName");

    const eventTypeInput =
        document.getElementById("eventType");

    const tournamentFormatInput =
        document.getElementById("tournamentFormat");

    const seriesFormatInput =
        document.getElementById("seriesFormat");

    const eventSplitInput =
        document.getElementById("eventSplit");

    const eventSplitEventNumberInput =
        document.getElementById(
            "eventSplitEventNumber"
        );

    if (eventNameInput) {
        eventNameInput.value =
            split === "all"
            ? lanName
            : `Split ${split} - ${lanName}`;
    }

    if (eventTypeInput) {
        eventTypeInput.value = lanType;
    }

    if (eventSplitInput && split !== "all") {
        eventSplitInput.value = split;
    }

    if (eventSplitEventNumberInput) {
        eventSplitEventNumberInput.value =
            lanType === "major"
            ? "4"
            : "";
    }

    if (tournamentFormatInput) {
        tournamentFormatInput.value =
            lanType === "worlds"
            ? "doubleElim"
            : "swissPlayoffs";
    }

    if (seriesFormatInput) {
        seriesFormatInput.value =
            lanType === "worlds"
            ? "7"
            : "5";
    }

    const qualifiedIds =
        currentLanQualifiedTeams.map(team =>
            team.teamId
        );

    tournament.selectedTeams =
        qualifiedIds;

    tournament.manualSeedingOverride = false;

    tournament.seedings =
        currentLanQualifiedTeams.map(team => {
            return teams.find(savedTeam =>
                savedTeam.id === team.teamId
            );
        }).filter(Boolean);

    if (
        typeof handleEventSettingsChanged ===
        "function"
    ) {
        handleEventSettingsChanged();
    }

    if (
        typeof renderTournamentTeams ===
        "function"
    ) {
        renderTournamentTeams();
    }

    if (
        typeof renderSeedings === "function"
    ) {
        renderSeedings();
    }

    if (
        typeof updateEventPreview === "function"
    ) {
        updateEventPreview();
    }

    showPage("tournament");

    showTournamentPanel(
        "setupPanel",
        true
    );

    alert(
        `${lanName} created with ${currentLanQualifiedTeams.length} qualified teams.`
    );

}

/* ==========================
   HELPERS
========================== */

function escapeLanText(value) {

    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}

window.applyLanPreset =
    applyLanPreset;

window.getLanQualifiedTeams =
    getLanQualifiedTeams;

window.renderLanQualification =
    renderLanQualification;
window.showQualificationTab = showQualificationTab;
window.renderSeasonQualificationSnapshot = renderSeasonQualificationSnapshot;

window.createLanEventFromQualifiedTeams =
    createLanEventFromQualifiedTeams;

window.addEventListener("load", () => {
    setTimeout(() => {
        ensureLanPresetControls();
        renderLanQualification();
    }, 800);
});