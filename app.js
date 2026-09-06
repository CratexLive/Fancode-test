const JSON_URL = "https://raw.githubusercontent.com/drmlive/fancode-live-events/refs/heads/main/fancode.json";

let events = [];
let filters = { q: "", status: "all" };

const toast = (msg) => {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("is-show");
  setTimeout(() => t.classList.remove("is-show"), 2000);
};

function hexToStr(hex){
  try {
    hex = String(hex || "").trim();
    let s = "";
    for(let i = 0; i < hex.length; i += 2) s += String.fromCharCode(parseInt(hex.substr(i,2), 16));
    return s;
  } catch { return ""; }
}

function extractStreams(obj){
  const out = [];
  const push = (label, url) => {
    if(url && typeof url === "string" && url.startsWith("http")) out.push({ label, url });
  };
  push("Primary", obj.stream_url || obj.adfree_url || obj.dai_url);
  
  const hexKeys = Object.keys(obj).filter(k => /hex/i.test(k));
  hexKeys.forEach(k => {
    const dec = hexToStr(obj[k]);
    const m = dec.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/g);
    if(m) m.forEach((u, i) => push(`Stream ${i+1}`, u));
  });
  return out;
}

async function fetchEvents(){
  try {
    const res = await fetch(JSON_URL + `?t=${Date.now()}`);
    const data = await res.json();
    let arr = Array.isArray(data) ? data : (data.matches || data.data || Object.values(data));
    events = arr.map((r, i) => ({
      id: r.id || i,
      title: r.title || r.match_name || "CricXCrate Match",
      image: r.src || r.image || "",
      category: r.category || "Cricket",
      status: (r.status || "").toLowerCase().includes("live") ? "live" : "upcoming",
      streams: extractStreams(r)
    }));
    render();
  } catch(e) {
    toast("Failed to update live feed");
  }
}

function renderFeatured(list){
  const live = list.filter(e => e.status === "live" && e.streams.length > 0);
  const featuredSec = document.getElementById("featured");
  if(!live.length){ featuredSec.hidden = true; return; }
  const f = live[0];
  featuredSec.hidden = false;
  document.getElementById("heroMedia").innerHTML = f.image ? `<img src="${f.image}" onerror="this.style.display='none'">` : "";
  document.getElementById("heroTitle").textContent = f.title;
  document.getElementById("heroMeta").textContent = f.category + " • CricXCrate Broadcast";
  document.getElementById("heroPlayBtn").onclick = () => playEvent(f);
}

function render(){
  let list = events;
  if(filters.status !== "all") list = list.filter(e => e.status === filters.status);
  if(filters.q) list = list.filter(e => e.title.toLowerCase().includes(filters.q.toLowerCase()));
  
  renderFeatured(events);
  document.getElementById("emptyState").hidden = list.length > 0;
  
  document.getElementById("grid").innerHTML = list.map(e => `
    <article class="card" onclick="playEventById('${e.id}')">
      <div class="card__media">
        ${e.image ? `<img src="${e.image}" onerror="this.style.display='none'">` : ``}
        <div class="card__topbar">
          <span class="badge ${e.status==='live'?'badge--live':''}">${e.status.toUpperCase()}</span>
          <span class="badge">${e.category.toUpperCase()}</span>
        </div>
        ${e.streams.length ? `<div class="card__play"><span>▶</span></div>` : ``}
      </div>
      <div class="card__body">
        <h3 class="card__title">${e.title}</h3>
        <div class="card__actions">
          <button class="btn btn--primary" ${e.streams.length?'':'disabled'}>${e.streams.length?'▶ Watch':'Upcoming'}</button>
        </div>
      </div>
    </article>
  `).join("");
}

function playEvent(ev){
  if(!ev.streams.length) return toast("No stream available yet");
  const url = ev.streams[0].url;
  const pid = Date.now().toString(36) + Math.random().toString(36).slice(2,8);
  const payload = { url, title: ev.title, ts: Date.now() };
  try {
    sessionStorage.setItem('_fc_play_'+pid, JSON.stringify(payload));
    localStorage.setItem('_fc_play_'+pid, JSON.stringify(payload));
  } catch {}
  window.open('watch.html?play=' + pid, '_blank', 'noopener');
  toast("Launching secure player...");
}

function playEventById(id){
  const ev = events.find(x => String(x.id) === String(id));
  if(ev) playEvent(ev);
}

document.getElementById("searchInput").oninput = (e) => { filters.q = e.target.value; render(); };
document.getElementById("statusTabs").onclick = (e) => {
  const b = e.target.closest("button[data-status]");
  if(!b) return;
  filters.status = b.dataset.status;
  [...document.getElementById("statusTabs").children].forEach(c => c.classList.toggle("is-active", c === b));
  render();
};
document.getElementById("refreshBtn").onclick = fetchEvents;

fetchEvents();
