// ✅ GLOBALS
let logs = [];
let active = {};
let history = [];
let allHistory = [];

let currentDetailsData = [];
let loadLimit = 200;

let currentPage = 1;
let rowsPerPage = 100;

let chart;


/* ✅ TIME FORMAT */
function formatDuration(mins){
    let h = Math.floor(mins / 60);
    let m = Math.floor(mins % 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/* ✅ RISK */
function risk(m){
    if(m < 30) return "LOW";
    if(m <= 180) return "MEDIUM";
    return "HIGH";
}

/* ✅ HOME EXIT */
function isAfterOfficeHours(date){
    return date.getHours() >= 18;
}


/* ✅ LOAD CSV */
window.onload = () => {

    fetch("logFile.csv")
    .then(r => r.text())
    .then(csv => {

        Papa.parse(csv,{
            header:true,
            skipEmptyLines:true,

            complete:(res)=>{

                logs = res.data.map(row=>{

                    let dir = "";
                    if(row.Direction){
                        let d = row.Direction.toUpperCase();
                        if(d.includes("OUT")) dir="OUT";
                        if(d.includes("IN")) dir="IN";
                    }

                    return {
                        name: row.ObjectName1,
                        id: Number(row.EmployeeID),
                        time: new Date(row.LocaleMessageTime),
                        direction: dir,
                        door: row.Door
                    };

                }).filter(x => x.id && !isNaN(x.time));

                process();
            }
        });

    });
};


/* ✅ PROCESS DATA */
function process(){

    active = {};
    allHistory = [];

    logs.sort((a,b)=>a.time - b.time);

    logs.forEach(r => {

        if(r.direction==="OUT"){
            active[r.id] = {
                name:r.name,
                id:r.id,
                exit:r.time,
                outDoor:r.door,
                homeExit:isAfterOfficeHours(r.time)
            };
        }

        if(r.direction==="IN" && active[r.id]){

            let mins = (r.time - active[r.id].exit)/60000;

            allHistory.push({
                name:r.name,
                id:r.id,
                outDoor:active[r.id].outDoor,
                entry:r.time,
                exit:active[r.id].exit,
                duration:mins,
                status:risk(mins)
            });

            delete active[r.id];
        }
    });

    history = [...allHistory];
    update();
}


/* ✅ DASHBOARD */
function update(){

    document.getElementById("total").innerText =
        new Set(logs.map(x=>x.id)).size;

    document.getElementById("outside").innerText =
        Object.keys(active).length;

    document.getElementById("high").innerText =
        history.filter(x=>x.status==="HIGH").length;

    document.getElementById("homeCount").innerText =
        Object.values(active).filter(x=>x.homeExit).length;

    document.getElementById("shiftEndCount").innerText =
        Object.values(active).filter(x=>{
            let mins=(new Date()-x.exit)/60000;
            return mins > 240;
        }).length;

    renderLive();
}


/* ✅ LIVE TABLE */
function renderLive(){

    let body = document.querySelector("#liveTable tbody");
    body.innerHTML = "";

    Object.values(active).slice(0,100).forEach(e=>{

        let mins = (new Date()-e.exit)/60000;
        let st = risk(mins);

        body.innerHTML += `
        <tr class="${st.toLowerCase()}"
    onclick="openProfile('${emp.name}', '${emp.id}', ${emp.duration})">
            <td>${e.name}</td>
            <td>${e.id}</td>
            <td>${e.outDoor}</td>
            <td>${e.exit.toLocaleString()}</td>
            <td>${formatDuration(mins)}</td>
            <td>${st}</td>
        </tr>`;
    });
}


/* ✅ HISTORY PAGE */
function showHistory(){

    document.getElementById("dashboard").classList.add("hidden");
    document.getElementById("history").classList.remove("hidden");
    document.getElementById("violators").classList.add("hidden");
    document.getElementById("detailsPage").classList.add("hidden");

    currentPage = 1;
    renderHistory();
}

function renderHistory(){

    let body = document.querySelector("#historyTable tbody");
    body.innerHTML = "";

    let start = (currentPage-1)*rowsPerPage;
    let end = start + rowsPerPage;

    history.slice(start,end).forEach(h=>{
        body.innerHTML += `
        <tr class="${h.status.toLowerCase()}">
            <td>${h.name}</td>
            <td>${h.id}</td>
            <td>${h.outDoor}</td>
            <td>-</td>
            <td>${new Date(h.exit).toLocaleString()}</td>
            <td>${new Date(h.entry).toLocaleString()}</td>
            <td>${formatDuration(h.duration)}</td>
            <td>${h.status}</td>
        </tr>`;
    });

    document.getElementById("pageInfo").innerText =
        `Page ${currentPage} / ${Math.ceil(history.length / rowsPerPage)}`;
}


/* ✅ PAGINATION */
function nextPage(){
    if(currentPage * rowsPerPage < history.length){
        currentPage++;
        renderHistory();
    }
}
function prevPage(){
    if(currentPage > 1){
        currentPage--;
        renderHistory();
    }
}


/* ✅ TOP VIOLATORS */
function showViolators(){

    document.getElementById("dashboard").classList.add("hidden");
    document.getElementById("history").classList.add("hidden");
    document.getElementById("violators").classList.remove("hidden");
    document.getElementById("detailsPage").classList.add("hidden");

    drawChart();
}

function drawChart(){

    let data = {};

    allHistory.forEach(h=>{
        data[h.name] = (data[h.name] || 0) + h.duration;
    });

    let top = Object.entries(data)
        .sort((a,b)=>b[1]-a[1])
        .slice(0,10);

    if(chart) chart.destroy();

    chart = new Chart(document.getElementById("chart"),{
        type:"bar",
        data:{
            labels: top.map(x=>x[0]),
            datasets:[{data:top.map(x=>x[1]/60),backgroundColor:"#ffcc00"}]
        },
        options:{plugins:{legend:{display:false}}}
    });
}


/* ✅ OPEN DETAILS (FINAL FIX) */
function openPage(type){

    document.getElementById("dashboard").classList.add("hidden");
    document.getElementById("detailsPage").classList.remove("hidden");

    let data = [];

    if(type==="total") data = history;

    if(type==="outside") data = Object.values(active);

    if(type==="high") data = history.filter(x=>x.status==="HIGH");

    if(type==="home"){
        data = Object.values(active).filter(x=>x.homeExit === true);
    }

    if(type==="shift"){
        data = Object.values(active).filter(x=>{
            let mins=(new Date()-x.exit)/60000;
            return mins > 240;
        });
    }

    // ✅ FIX: correct aggregation
    let map = {};

    data.forEach(emp=>{

        let mins = emp.duration
            ? emp.duration
            : emp.exit
                ? (new Date()-emp.exit)/60000
                : 0;

        if(!map[emp.id]){
            map[emp.id] = {
                name: emp.name || "-",
                id: emp.id,
                duration: 0
            };
        }

        map[emp.id].duration += mins;
    });

    currentDetailsData = Object.values(map);
    loadLimit = 200;

    renderDetails(currentDetailsData);
}


/* ✅ DETAILS TABLE */
function renderDetails(data){

    let body = document.querySelector("#detailsTable tbody");
    body.innerHTML = "";

    data.slice(0,loadLimit).forEach(emp=>{

        let st = risk(emp.duration);

        body.innerHTML += `
        <tr class="${st.toLowerCase()}">
            <td>${emp.name}</td>
            <td>${emp.id}</td>
            <td>${formatDuration(emp.duration)}</td>
            <td>${st}</td>
        </tr>`;
    });
}


/* ✅ SEARCH (FINAL FIX) */
function applySearchFilter(){

    let search = document.getElementById("searchInput").value.toLowerCase().trim();
    let status = document.getElementById("statusFilter").value;

    let filtered = currentDetailsData.filter(emp => {

        let name = emp.name ? emp.name.toLowerCase() : "";
        let id = emp.id ? emp.id.toString() : "";

        let st = risk(emp.duration);

        return (
            name.includes(search) ||
            id.includes(search)
        ) &&
        (status === "ALL" || st === status);
    });

    renderDetails(filtered);
}


/* ✅ SORT */
function sortByDuration(){
    currentDetailsData.sort((a,b)=>b.duration-a.duration);
    renderDetails(currentDetailsData);
}


/* ✅ BACK */
function showDashboard(){

    document.getElementById("dashboard").classList.remove("hidden");

    document.getElementById("history").classList.add("hidden");
    document.getElementById("violators").classList.add("hidden");
    document.getElementById("detailsPage").classList.add("hidden");
}
function goBack(){

    document.getElementById("detailsPage").classList.add("hidden");

    document.getElementById("dashboard").classList.remove("hidden");

    document.getElementById("history").classList.add("hidden");
    document.getElementById("violators").classList.add("hidden");
}
/* ✅ OPEN PROFILE */
function openProfile(name,id,duration){

    document.getElementById("profileModal").classList.remove("hidden");

    document.getElementById("pName").innerText = name;
    document.getElementById("pId").innerText = id;
    document.getElementById("pDuration").innerText = formatDuration(duration);
    document.getElementById("pStatus").innerText = risk(duration);
}

/* ✅ CLOSE PROFILE */
function closeProfile(){
    document.getElementById("profileModal").classList.add("hidden");
}