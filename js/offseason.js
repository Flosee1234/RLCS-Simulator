const OFFSEASON_STATE_KEY = "rlcsOffseasonStateV1";

function getOffseasonState() {
    try { return JSON.parse(localStorage.getItem(OFFSEASON_STATE_KEY) || "null"); } catch { return null; }
}
function saveOffseasonState(state) { localStorage.setItem(OFFSEASON_STATE_KEY, JSON.stringify(state)); }
function createOffseasonId() { return `offseason-${Date.now()}-${Math.floor(Math.random()*100000)}`; }

async function startOffseason() {
    let state=getOffseasonState();
    const season=typeof getSeasonState==="function"?getSeasonState():null;
    const complete=typeof isCurrentSeasonComplete==="function"?isCurrentSeasonComplete(season):!season;
    if(state?.status==="active"){renderOffseason();return;}
    if(season && !complete && !confirm("The active season is not complete. Start an offseason workspace anyway?")) return;
    if(typeof window.createRestorePoint==="function"){try{await window.createRestorePoint("Before starting offseason",true);}catch{}}
    state={id:createOffseasonId(),status:"active",stage:"review",startedAt:new Date().toISOString(),sourceSeasonId:season?.id||null,sourceSeasonName:season?.name||"No active season",developmentComplete:false,transfersReviewed:false,rostersReady:false,completedAt:null};
    saveOffseasonState(state); if(typeof setTransferWindowOpen==="function")setTransferWindowOpen(true); renderOffseason();
}

function renderOffseason() {
    const state=getOffseasonState(); const season=typeof getSeasonState==="function"?getSeasonState():null; const complete=typeof isCurrentSeasonComplete==="function"?isCurrentSeasonComplete(season):false;
    const status=document.getElementById("offseasonStatus"); if(!status)return;
    status.innerHTML=`<div class="offseason-status-card ${state?.status||"inactive"}"><div><span>${state?.status==="active"?"Offseason Active":"Offseason Ready"}</span><strong>${escapeOffseasonText(state?.sourceSeasonName||season?.name||"League")}</strong><small>${state?.status==="active"?`Started ${formatOffseasonDate(state.startedAt)}`:complete?"The season is complete and ready for offseason processing.":"Finish the season or start an offseason workspace manually."}</small></div><button class="${state?.status==="active"?"secondary-button":"primary-button"}" onclick="startOffseason()">${state?.status==="active"?"Refresh Offseason":"Start Offseason"}</button></div>`;
    renderOffseasonProgress(state); renderOffseasonReview(state,season,complete); renderOffseasonDevelopment(state); renderOffseasonTransfers(state); renderOffseasonRosters(state); renderOffseasonFinalise(state,season);
}

function renderOffseasonProgress(state) {
    const container=document.getElementById("offseasonProgress"); if(!container)return; const stages=["review","development","transfers","rosters","complete"]; const current=state?.status==="completed"?4:Math.max(0,stages.indexOf(state?.stage||"review"));
    container.innerHTML=stages.map((stage,index)=>`<div class="offseason-step ${index<current?"done":index===current?"active":""}"><span>${index<current?"✓":index+1}</span><strong>${stage[0].toUpperCase()+stage.slice(1)}</strong></div>`).join("");
}

function renderOffseasonReview(state,season,complete) {
    const c=document.getElementById("offseasonReviewCard"); if(!c)return; const history=typeof getCurrentSeasonHistory==="function"&&season?getCurrentSeasonHistory(season):[]; const champion=history.find(r=>r.event?.type==="worlds")?.champion||"Not decided";
    c.innerHTML=`<span class="card-kicker">Step 1</span><h3>Season Review</h3><div class="offseason-metric-grid"><div><span>Season</span><strong>${escapeOffseasonText(season?.name||state?.sourceSeasonName||"None")}</strong></div><div><span>Events</span><strong>${history.length}</strong></div><div><span>Worlds Champion</span><strong>${escapeOffseasonText(champion)}</strong></div><div><span>Status</span><strong>${complete?"Complete":"In Progress"}</strong></div></div><p class="small">Archive the season before rolling into the next calendar.</p>${season&&complete?'<button class="primary-button" onclick="offseasonArchiveSeason()">Archive Season</button>':'<button class="secondary-button" onclick="showPage(\'season\')">Open Season</button>'}`;
}

function renderOffseasonDevelopment(state) {
    const c=document.getElementById("offseasonDevelopmentCard"); if(!c)return; const review=typeof getPendingDevelopmentReview==="function"?getPendingDevelopmentReview():null; const history=typeof getPlayerDevelopmentHistory==="function"?getPlayerDevelopmentHistory():[];
    c.innerHTML=`<span class="card-kicker">Step 2</span><h3>Player Development</h3><p>${review?.status==="pending"?"A development review is waiting for approval.":"Generate one offseason rating review for every active player."}</p><div class="offseason-inline-stat"><span>Completed reviews</span><strong>${history.length}</strong></div><div class="settings-actions"><button class="primary-button" onclick="offseasonGenerateDevelopment()">${review?.status==="pending"?"Open Pending Review":"Generate Review"}</button>${review?.status==="pending"?'<button class="secondary-button" onclick="offseasonApplyDevelopment()">Apply Review</button>':''}</div>`;
}

function renderOffseasonTransfers(state) {
    const c=document.getElementById("offseasonTransfersCard"); if(!c)return; const open=typeof isTransferWindowOpen==="function"?isTransferWindowOpen():false; const suggestions=typeof getTransferSuggestions==="function"?getTransferSuggestions().filter(s=>s.status==="pending"):[]; const transfers=typeof getTransferHistory==="function"?getTransferHistory():[];
    c.innerHTML=`<span class="card-kicker">Step 3</span><h3>Transfer Window</h3><div class="offseason-inline-stat"><span>Window</span><strong>${open?"Open":"Closed"}</strong></div><div class="offseason-inline-stat"><span>Pending suggestions</span><strong>${suggestions.length}</strong></div><div class="offseason-inline-stat"><span>Total transactions</span><strong>${transfers.length}</strong></div><div class="settings-actions"><button class="primary-button" onclick="showPage('transfers')">Manage Transfers</button><button class="secondary-button" onclick="offseasonGenerateTransfers()">Generate Suggestions</button><button class="secondary-button" onclick="toggleTransferWindow(); renderOffseason()">${open?"Close":"Open"} Window</button></div>`;
}

function getOffseasonRosterIssues() {
    const teamList=typeof teams!=="undefined"&&Array.isArray(teams)?teams:[]; const issues=[]; const playerIds=new Set();
    teamList.forEach(team=>{if((team.players||[]).length!==3)issues.push(`${team.name}: ${(team.players||[]).length}/3 players`); (team.players||[]).forEach(player=>{if(!player.id||playerIds.has(String(player.id)))issues.push(`${team.name}: duplicate/missing player ID`); playerIds.add(String(player.id));});}); return issues;
}

function renderOffseasonRosters(state) {
    const c=document.getElementById("offseasonRosterCard"); if(!c)return; const issues=getOffseasonRosterIssues(); const freeAgents=typeof getFreeAgents==="function"?getFreeAgents():[]; const teamCount=typeof teams!=="undefined"&&Array.isArray(teams)?teams.length:0;
    c.innerHTML=`<span class="card-kicker">Step 4</span><h3>Roster Registration</h3><div class="offseason-inline-stat"><span>Teams</span><strong>${teamCount}</strong></div><div class="offseason-inline-stat"><span>Free agents</span><strong>${freeAgents.length}</strong></div><div class="offseason-inline-stat"><span>Roster issues</span><strong class="${issues.length?"text-danger":"text-success"}">${issues.length}</strong></div>${issues.length?`<div class="offseason-issue-list">${issues.slice(0,8).map(issue=>`<span>${escapeOffseasonText(issue)}</span>`).join("")}</div>`:'<p class="offseason-ready-message">Every team has a valid three-player roster.</p>'}<button class="secondary-button" onclick="showPage('teams')">Manage Teams</button>`;
}

function renderOffseasonFinalise(state,season) {
    const c=document.getElementById("offseasonFinaliseCard"); if(!c)return; const issues=getOffseasonRosterIssues(); const ready=state?.status==="active"&&!issues.length;
    c.innerHTML=`<div><span class="card-kicker">Final Step</span><h3>Prepare the Next Season</h3><p>Close the transfer window, confirm every roster and then create the next season calendar.</p></div><div class="settings-actions"><button class="secondary-button" onclick="offseasonMarkReviewed()">Mark Moves Reviewed</button><button class="primary-button" ${ready?"":"disabled"} onclick="completeOffseason()">Complete Offseason</button><button class="primary-button" ${state?.status==="completed"?"":"disabled"} onclick="offseasonStartNextSeason()">Start Next Season</button></div>`;
}

async function offseasonArchiveSeason(){if(typeof archiveCurrentSeason==="function"){await archiveCurrentSeason(); renderOffseason();}}
function offseasonGenerateDevelopment(){const pending=typeof getPendingDevelopmentReview==="function"?getPendingDevelopmentReview():null;if(pending?.status==="pending"){showPage("transfers");return;} if(typeof createPlayerDevelopmentReview==="function")createPlayerDevelopmentReview({period:"Offseason",trigger:"offseason",preventDuplicate:false}); showPage("transfers");}
function offseasonApplyDevelopment(){if(typeof applyPlayerDevelopmentReview==="function")applyPlayerDevelopmentReview(); const s=getOffseasonState();if(s){s.developmentComplete=true;s.stage="transfers";saveOffseasonState(s);}renderOffseason();}
function offseasonGenerateTransfers(){if(typeof generateAutomaticTransferSuggestions==="function")generateAutomaticTransferSuggestions(); showPage("transfers");}
function offseasonMarkReviewed(){const s=getOffseasonState();if(!s)return;s.transfersReviewed=true;s.stage="rosters";saveOffseasonState(s);renderOffseason();}
function completeOffseason(){const s=getOffseasonState();if(!s||getOffseasonRosterIssues().length)return; if(typeof setTransferWindowOpen==="function")setTransferWindowOpen(false); s.status="completed";s.stage="complete";s.rostersReady=true;s.completedAt=new Date().toISOString();saveOffseasonState(s);renderOffseason();}
async function offseasonStartNextSeason(){const s=getOffseasonState();if(s?.status!=="completed")return; if(typeof startNewSeasonRollover==="function")await startNewSeasonRollover(); localStorage.removeItem(OFFSEASON_STATE_KEY); showPage("season"); if(typeof showSeasonTab==="function")showSeasonTab("setup");}
function escapeOffseasonText(v){return String(v||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");}
function formatOffseasonDate(v){try{return new Date(v).toLocaleString();}catch{return "";}}
window.renderOffseason=renderOffseason;
window.startOffseason=startOffseason;
