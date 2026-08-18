const dashboards={
  zreport:{title:"Z-Report Category-Wise Sales & Footfall",kicker:"Z-REPORT",url:"/zreport-dual-dashboard/"},
  visit:{title:"Visit Compliance Dashboard",kicker:"VISIT COMPLIANCE",url:"/visit-compliance-dashboard/"},
  zone:{title:"Zone Distribution Dashboard",kicker:"ZONE DISTRIBUTION",url:"/zone-distribution-dashboard/"},
  feasibility:{title:"Feasibility Command Center",kicker:"FEASIBILITY",url:"https://aftabz-lab.github.io/Feasibility_FInal/"}  // lives in the aftabz-lab account, repo Feasibility_FInal
};
const $=id=>document.getElementById(id);
const navButtons=[...document.querySelectorAll(".nav-btn")];
const frame=$("dashboard-frame");
const frameShell=document.querySelector(".frame-shell");

function setActiveNav(page){navButtons.forEach(btn=>btn.classList.toggle("active",btn.dataset.page===page));}
function showHome(){
  document.body.classList.remove("dashboard-active");
  $("home-view").classList.remove("hidden");
  $("dashboard-view").classList.add("hidden");
  setActiveNav("home");
  history.replaceState(null,"",location.pathname);
}
function openDashboard(key){
  const d=dashboards[key]; if(!d) return;
  document.body.classList.add("dashboard-active");
  $("home-view").classList.add("hidden");
  $("dashboard-view").classList.remove("hidden");
  $("dashboard-title").textContent=d.title;
  $("dashboard-kicker").textContent=d.kicker;
  $("open-direct").href=d.url;
  setActiveNav(key);
  frameShell.classList.remove("loaded");
  if(frame.getAttribute("src")!==d.url) frame.setAttribute("src",d.url);
  else frameShell.classList.add("loaded");
  history.replaceState(null,"",`#${key}`);
}
frame.addEventListener("load",()=>frameShell.classList.add("loaded"));
navButtons.forEach(btn=>btn.addEventListener("click",()=>btn.dataset.page==="home"?showHome():openDashboard(btn.dataset.page)));
document.querySelectorAll("[data-open]").forEach(card=>card.addEventListener("click",()=>openDashboard(card.dataset.open)));
$("back-home").addEventListener("click",showHome);
const initial=location.hash.replace("#","");
if(dashboards[initial]) openDashboard(initial); else showHome();
