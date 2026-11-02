'use strict';
/* =========================================================================
   92 App · Arbeits-Tool für 92 Aufbereitung
   Daten liegen in IndexedDB auf dem Gerät (dauerhaft, mit Sicherung als Datei).
   ========================================================================= */
const VERSION = '1.0';

/* ---------------- Konstanten ---------------- */
const KLASSEN = [['klein','Kleinwagen'],['limo','Limousine / Kombi'],['suv','SUV']];
const STATUS = [['anfrage','Anfrage'],['angebot','Angebot raus'],['bestaetigt','Gebucht'],['erledigt','Erledigt'],['bezahlt','Bezahlt'],['abgesagt','Abgesagt']];
const STELLPLATZ = ['Hof / Einfahrt','Straße','Garage','Tiefgarage','Parkplatz','Sonstiges'];
const KANAELE = [['whatsapp','WhatsApp','💬'],['instagram','Instagram','📸'],['tiktok','TikTok','🎵'],['facebook','Facebook','👍'],['website','Website','🌐'],['telefon','Telefon','📞'],['empfehlung','Empfehlung','🤝'],['sonstiges','Sonstiges','•']];
const PLATTFORMEN = [['tiktok','TikTok'],['instagram','Instagram'],['facebook','Facebook'],['youtube','YouTube']];
const MONATE = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
const MON = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
const WT = ['So','Mo','Di','Mi','Do','Fr','Sa'], WTL = ['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'];
const UMSATZ_STATUS = new Set(['erledigt','bezahlt']);
const OFFEN_STATUS = new Set(['anfrage','angebot','bestaetigt']);

const DEFAULT_SETTINGS = {
  name: 'Efekan', anrede: 'du',
  pakete: [
    {id:'signature', name:'Signature', nr:1, info:'Gründlicher Durchgang durch alle sichtbaren Bereiche', preise:{klein:55, limo:65, suv:75}, dauer:2},
    {id:'prestige',  name:'Prestige',  nr:2, info:'Paket 1 + Kofferraum, Lüftungsdüsen, unter den Sitzen, schwer erreichbare Bereiche', preise:{klein:75, limo:85, suv:95}, dauer:2.5},
    {id:'ultimate',  name:'Ultimate',  nr:3, info:'Paket 2 + Scheiben innen & außen, Pedale, Sitzschienen, Türfalze, Abschlusskontrolle', preise:{klein:95, limo:110, suv:125}, dauer:3.5}
  ],
  extras: [
    {id:'sio2',   name:'SiO₂ Glasversiegelung', preis:25},
    {id:'gummi',  name:'Gummi- & Dichtungspflege', preis:15},
    {id:'geruch', name:'Geruchsneutralisierung', preis:20}
  ],
  aufwand: [{name:'klein', preis:20, std:.5},{name:'mittel', preis:50, std:1},{name:'groß', preis:100, std:2}],
  anfahrtAbKm: 110, anfahrtPreis: 40,
  kmKosten: 0.30, material: 6, zielStundenlohn: 25, monatsziel: 650, kmh: 60,
  notif: false, lastBackup: null, googleReview: '',
  // Obi-Schichtplan: Woche ab refMonday = refTyp, danach wöchentlich abwechselnd. Freitag & Sonntag frei.
  schicht: {aktiv: true, refMonday: '2026-11-02', refTyp: 'frueh',
    frueh: {wd: '08:00-17:00', sa: '08:00-14:00'}, spaet: {wd: '11:20-20:00', sa: '14:00-20:00'}},
  slotStart: '08:00', puffer: 30, minStd: 2.5, lichtNach: 25, sonntag: false,
  lat: 51.17, lon: 7.08,
  // KI-Assistent
  apiKey: '', assistentLink: 'https://claude.ai/code/project/chan_01D3Bx2bgxHvMmUwzPhrNuqW',
  profil: `Ich bin Efekan und betreibe 92 Aufbereitung (NINETYTWO Aufbereitung): mobile Innenraumaufbereitung in Solingen und Umgebung (bis ca. 60 km). Wir kommen zum Kunden.
Gestartet im September 2026, Kleingewerbe, nebenberuflich neben dem dualen Studium. Zusätzlich arbeite ich bei Obi im wöchentlichen Wechsel Früh-/Spätschicht, freitags frei.
Schwerpunkt: Innenraum (Fußräume, Kunststoff, Armaturenbrett, Displays, Sitze, Kofferraum, Scheiben). Ehrliche Handarbeit, keine Garantie auf Fleckentfernung.
Produkte: Glart Innenreiniger (bitte ergänzen: weitere Reiniger, Maschinen, Sauger …).
Ziel: langfristig davon leben, später eigene Halle, Mitarbeiter und eigene Produkte.
Social: TikTok und Instagram @92.aufbereitung, Facebook „92 Aufbereitung“. Ton auf Social Media: du, auf der Website: Sie. Ehrlich und direkt.
Slogans: „Sauber. Gepflegt. Wie neu.“, „Fühlen wie im Neuwagen“, „Weil dein Auto das Beste verdient“.
Website: 92aufbereitung.de (Anfragen über /buchen), WhatsApp 0179 1710983.
Wie ich angefangen habe / meine Geschichte: (bitte ergänzen)`
};

/* ---------------- Speicher (IndexedDB) ---------------- */
const Store = {
  db: null,
  open(){ return new Promise((res, rej) => {
    const r = indexedDB.open('92app', 1);
    r.onupgradeneeded = () => { const d = r.result; d.createObjectStore('kv'); d.createObjectStore('files'); };
    r.onsuccess = () => { this.db = r.result; res(); };
    r.onerror = () => rej(r.error);
  });},
  tx(store, mode, fn){ return new Promise((res, rej) => {
    const t = this.db.transaction(store, mode), s = t.objectStore(store); const req = fn(s);
    t.oncomplete = () => res(req && req.result); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
  });},
  get(store, k){ return this.tx(store, 'readonly', s => s.get(k)); },
  put(store, k, v){ return this.tx(store, 'readwrite', s => s.put(v, k)); },
  del(store, k){ return this.tx(store, 'readwrite', s => s.delete(k)); },
  clear(store){ return this.tx(store, 'readwrite', s => s.clear()); }
};

let db = null;
function emptyDb(){ return {v:1, settings: structuredClone(DEFAULT_SETTINGS), kunden:[], auftraege:[], files:[], videos:[], social:[], chat:[], wetter:{fetched:0, days:{}}, seeded:false}; }
function normalize(d){
  const base = emptyDb();
  d = Object.assign(base, d || {});
  d.settings = Object.assign(structuredClone(DEFAULT_SETTINGS), d.settings || {});
  d.settings.schicht = Object.assign(structuredClone(DEFAULT_SETTINGS.schicht), d.settings.schicht || {});
  if (!d.wetter) d.wetter = {fetched: 0, days: {}};
  if (!Array.isArray(d.chat)) d.chat = [];
  for (const k of ['kunden','auftraege','files','videos','social']) if (!Array.isArray(d[k])) d[k] = [];
  return d;
}
function seed(){
  if (db.seeded) return;
  db.seeded = true;
  db.videos.push(
    {id:uid(), plattform:'tiktok', titel:'Wie kriege ich das Auto wieder sauber?', datum:'', url:'', aufrufe:105800, likes:null, kommentare:null, shares:null, saves:null, follower:null, notiz:''},
    {id:uid(), plattform:'tiktok', titel:'Audi A3 Komplettpaket 65 €', datum:'', url:'', aufrufe:38400, likes:null, kommentare:null, shares:null, saves:null, follower:null, notiz:''}
  );
  db.social.push(
    {id:uid(), datum:'2026-10-15', plattform:'tiktok', follower:353, likes:14560},
    {id:uid(), datum:'2026-10-15', plattform:'instagram', follower:96, likes:null}
  );
}
let dbVer = 0, kCountCache = null, kCountVer = -1, aIdx = null, aIdxVer = -1;
function kCount(){ if (kCountVer !== dbVer || !kCountCache) { kCountCache = new Map(); for (const x of db.auftraege) if (x.status !== 'abgesagt') kCountCache.set(x.kundeId, (kCountCache.get(x.kundeId) || 0) + 1); kCountVer = dbVer; } return kCountCache; }
let saveTimer = null;
function save(now){
  dbVer++;
  clearTimeout(saveTimer);
  const run = () => Store.put('kv', 'data', db).catch(() => toast('Speichern fehlgeschlagen'));
  if (now) return run();
  saveTimer = setTimeout(run, 120);
}
const S = () => db.settings;

/* ---------------- Helfer ---------------- */
const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num = v => (v === '' || v == null || isNaN(Number(v))) ? null : Number(v);
const eur = (n, d) => (n == null ? '–' : (Math.round(n*100)/100).toLocaleString('de-DE', {minimumFractionDigits: d ?? (n % 1 ? 2 : 0), maximumFractionDigits: d ?? 2}) + ' €');
const fmtN = n => n == null ? '–' : Number(n).toLocaleString('de-DE');
const fmtK = n => n == null ? '–' : n >= 10000 ? (n/1000).toLocaleString('de-DE',{maximumFractionDigits:1}) + 'k' : fmtN(n);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const pad = n => String(n).padStart(2, '0');
const iso = d => d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate());
const todayIso = (off=0) => { const d = new Date(); d.setDate(d.getDate()+off); return iso(d); };
const dLocal = s => { const [y,m,d] = s.split('-').map(Number); return new Date(y, m-1, d); };
const fmtDate = (s, long) => { if (!s) return 'ohne Datum'; const d = dLocal(s); return (long ? WTL : WT)[d.getDay()] + ', ' + d.getDate() + '. ' + (long ? MONATE : MON)[d.getMonth()] + (long ? ' ' + d.getFullYear() : ''); };
const relDay = s => s === todayIso() ? 'heute' : s === todayIso(1) ? 'morgen' : s === todayIso(-1) ? 'gestern' : null;
const monthKey = s => (s || '').slice(0, 7);
const monthLabel = k => { const [y, m] = k.split('-'); return MONATE[+m-1] + ' ' + y; };
const round05 = x => Math.round(x * 2) / 2;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
function waNumber(tel){
  let t = (tel || '').replace(/[^\d+]/g, '');
  if (t.startsWith('+')) t = t.slice(1); else if (t.startsWith('00')) t = t.slice(2); else if (t.startsWith('0')) t = '49' + t.slice(1);
  return t;
}
function toast(msg){ const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 1900); }
function haptic(){ try { navigator.vibrate && navigator.vibrate(8); } catch(e){} }
async function copy(text){ try { await navigator.clipboard.writeText(text); return true; } catch(e){ const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); let ok = false; try { ok = document.execCommand('copy'); } catch(_){} ta.remove(); return ok; } }
function openUrl(u){ const a = document.createElement('a'); a.href = u; if (/^https?:/.test(u)) { a.target = '_blank'; a.rel = 'noopener'; } document.body.appendChild(a); a.click(); a.remove(); }
function download(name, data, type){
  const blob = data instanceof Blob ? data : new Blob([data], {type});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}
const kanal = id => KANAELE.find(k => k[0] === id) || KANAELE[KANAELE.length-1];
const statusLabel = id => (STATUS.find(s => s[0] === id) || STATUS[0])[1];

/* ---------------- Kunden & Aufträge ---------------- */
const kundeById = id => db.kunden.find(k => k.id === id);
const auftragById = id => { if (aIdxVer !== dbVer || !aIdx) { aIdx = new Map(db.auftraege.map(a => [a.id, a])); aIdxVer = dbVer; } return aIdx.get(id); };
const kName = k => k ? ([k.vorname, k.nachname].filter(Boolean).join(' ') || 'Ohne Namen') : 'Ohne Namen';
const auftraegeVon = kid => db.auftraege.filter(a => a.kundeId === kid).sort(byDateDesc);
function byDateAsc(a, b){ return ((a.datum||'9999') + (a.zeit||'99')).localeCompare((b.datum||'9999') + (b.zeit||'99')); }
function byDateDesc(a, b){ return byDateAsc(b, a); }
function adresse(k){ return k ? [k.strasse, [k.plz, k.ort].filter(Boolean).join(' ')].filter(Boolean).join(', ') : ''; }

function paketOf(a){ return S().pakete.find(p => p.id === a.paket) || S().pakete[0]; }
function anfahrtAuto(a){ return (num(a.km) || 0) > S().anfahrtAbKm ? S().anfahrtPreis : 0; }
function anfahrt(a){ return num(a.anfahrt) ?? anfahrtAuto(a); }
function preisLines(a){
  const s = S(), p = paketOf(a), lines = [];
  lines.push([`${p.name} · ${(KLASSEN.find(k => k[0] === a.klasse) || KLASSEN[1])[1]}`, num(p.preise[a.klasse]) || 0]);
  for (const id of a.extras || []) { const e = s.extras.find(x => x.id === id); if (e) lines.push([e.name, num(e.preis) || 0]); }
  if (num(a.aufwand)) { const st = s.aufwand.find(x => x.preis === num(a.aufwand)); lines.push([`Aufwandspauschale${st ? ' ' + st.name : ''}`, num(a.aufwand)]); }
  const an = anfahrt(a); if (an) lines.push([`Anfahrt${num(a.km) ? ' (' + num(a.km) + ' km)' : ''}`, an]);
  if (num(a.rabatt)) lines.push(['Rabatt', -num(a.rabatt)]);
  return lines;
}
const autoPreis = a => preisLines(a).reduce((s, l) => s + l[1], 0);
const preis = a => num(a.preis) ?? autoPreis(a);
function dauerAuto(a){
  const s = S(); let h = paketOf(a).dauer || 2.5;
  const st = s.aufwand.find(x => x.preis === num(a.aufwand)); if (st) h += st.std;
  h += (a.extras || []).length * 0.25;
  if (a.klasse === 'suv') h += .25;
  return h;
}
const dauer = a => num(a.dauer) ?? dauerAuto(a);
const fahrzeit = a => (num(a.km) || 0) / (S().kmh || 60);

/* -------- 92-Score: Bewertung eines Auftrags von 0 bis 10 -------- */
const PREMIUM = /porsche|range\s?rover|land\s?rover|mercedes|amg|bmw|audi|tesla|cupra|maserati|bentley|ferrari|lamborghini|mclaren|jaguar|volvo xc9|g-klasse|rs\s?\d|m\d\b/i;
function scoreAuto(a){
  const s = S(), why = [];
  const p = preis(a), km = num(a.km) || 0;
  const kosten = km * s.kmKosten + s.material;
  const stunden = dauer(a) + fahrzeit(a);
  const lohn = stunden > 0 ? (p - kosten) / stunden : 0;
  const z = s.zielStundenlohn || 25;
  let sc = lohn <= 0 ? 0 : lohn <= z ? 7 * lohn / z : 7 + 3 * Math.min(1, (lohn - z) / (0.6 * z));
  why.push([`${eur(lohn, 0)}/Std. effektiv (${stunden.toLocaleString('de-DE',{maximumFractionDigits:1})} Std. inkl. Fahrt, ${eur(kosten,0)} Kosten)`, lohn >= z ? '+' : '–']);
  if ((a.extras || []).length) { sc += .5; why.push(['Zusatzleistung gebucht', '+']); }
  if (num(a.aufwand)) { sc += .25; why.push(['Aufwandspauschale vereinbart', '+']); }
  if (a.kundeId && (kCount().get(a.kundeId) || 0) - (auftragById(a.id) && a.status !== 'abgesagt' ? 1 : 0) > 0) { sc += .5; why.push(['Stammkunde', '+']); }
  const fz = a.fahrzeug || '';
  if (PREMIUM.test(fz)) { sc += .5; why.push(['Starkes Auto für Content (Vorher/Nachher)', '+']); }
  if (km > s.anfahrtAbKm && !anfahrt(a)) { sc -= 1; why.push(['Lange Strecke ohne Anfahrtspauschale', '–']); }
  if (km > 2 * s.anfahrtAbKm) { sc -= .5; why.push(['Sehr weite Anfahrt', '–']); }
  if (num(a.rabatt)) { sc -= .25; why.push(['Rabatt gegeben', '–']); }
  return {score: clamp(round05(sc), 0, 10), why, lohn};
}
let scCache = new Map(), scVer = -1;
const score = a => {
  const man = num(a.scoreManuell); if (man != null) return man;
  if (scVer !== dbVer) { scCache = new Map(); scVer = dbVer; }
  if (auftragById(a.id) !== a) return scoreAuto(a).score;   // Entwurf: immer frisch
  let v = scCache.get(a.id); if (v == null) { v = scoreAuto(a).score; scCache.set(a.id, v); } return v;
};
const scoreCls = x => x >= 8 ? 's-hi' : x >= 6 ? 's-mid' : x >= 4 ? 's-lo' : 's-bad';
const scoreFmt = x => x == null ? '–' : x.toLocaleString('de-DE', {minimumFractionDigits: x % 1 ? 1 : 0});
const scoreHtml = x => `<span class="score ${scoreCls(x)}">${scoreFmt(x)}</span>`;

/* ---------------- Sonne, Schicht, freie Lücken ---------------- */
const toMin = t => { const [h, m] = (t || '0:0').split(':').map(Number); return h * 60 + (m || 0); };
const fromMin = m => pad(Math.floor(m / 60)) + ':' + pad(Math.round(m % 60));
const durTxt = m => { const h = Math.floor(m / 60), r = Math.round(m % 60); return h + (r ? ':' + pad(r) : '') + ' Std.'; };
const sunCache = {};
function sunTimes(s){ // Sonnenauf-/untergang in Minuten Ortszeit (NOAA-Näherung)
  if (sunCache[s]) return sunCache[s];
  const d = dLocal(s), lat = S().lat, lon = S().lon, R = Math.PI / 180;
  const N = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 864e5), lh = lon / 15;
  const calc = rise => {
    const t = N + ((rise ? 6 : 18) - lh) / 24, M = 0.9856 * t - 3.289;
    let L = (M + 1.916 * Math.sin(M * R) + 0.020 * Math.sin(2 * M * R) + 282.634 + 360) % 360;
    let RA = (Math.atan(0.91764 * Math.tan(L * R)) / R + 360) % 360;
    RA = (RA + Math.floor(L / 90) * 90 - Math.floor(RA / 90) * 90) / 15;
    const sinD = 0.39782 * Math.sin(L * R), cosD = Math.cos(Math.asin(sinD));
    const cosH = (Math.cos(90.833 * R) - sinD * Math.sin(lat * R)) / (cosD * Math.cos(lat * R));
    const H = (rise ? 360 - Math.acos(cosH) / R : Math.acos(cosH) / R) / 15;
    const UT = ((H + RA - 0.06571 * t - 6.622 - lh) % 24 + 24) % 24;
    const off = -new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12).getTimezoneOffset() / 60;
    return ((UT + off) % 24) * 60;
  };
  return (sunCache[s] = {rise: calc(true), set: calc(false)});
}
function sunset(s){ const w = db.wetter.days[s]; return w?.sunset ? toMin(w.sunset.slice(11, 16)) : sunTimes(s).set; }
function schichtFuer(s, roh){
  const sc = S().schicht; if (!sc.aktiv) return null;
  const d = dLocal(s), wd = d.getDay();
  if (!roh && sc.frei && sc.frei[s] && wd !== 5 && wd !== 0) return {typ: 'frei', manuell: true, label: 'Frei 🌴'};
  if (wd === 5 || wd === 0) return {typ: 'frei', label: wd === 5 ? 'Frei (Freitag)' : 'Sonntag'};
  const mon = new Date(d); mon.setDate(d.getDate() - ((wd + 6) % 7));
  const weeks = Math.round((mon - dLocal(sc.refMonday)) / (7 * 864e5));
  const typ = (((weeks % 2) + 2) % 2 === 0) ? sc.refTyp : (sc.refTyp === 'frueh' ? 'spaet' : 'frueh');
  const range = (wd === 6 ? sc[typ].sa : sc[typ].wd) || '';
  const [a, b] = range.split('-');
  if (!a || !b) return {typ, label: typ === 'frueh' ? 'Frühschicht' : 'Spätschicht'};
  return {typ, von: toMin(a), bis: toMin(b), label: `${typ === 'frueh' ? 'Früh' : 'Spät'} ${a.replace(/^0/, '')}–${b.replace(/^0/, '')}`};
}
function freieLuecken(s){
  const st = S(); if (s < todayIso()) return [];
  if (dLocal(s).getDay() === 0 && !st.sonntag) return [];
  const p = st.puffer || 0;
  let start = Math.max(toMin(st.slotStart), Math.ceil(sunTimes(s).rise / 15) * 15);
  const ende = Math.floor((sunset(s) + (st.lichtNach || 0)) / 15) * 15;
  if (s === todayIso()) { const n = new Date(); start = Math.max(start, Math.ceil((n.getHours() * 60 + n.getMinutes() + 30) / 15) * 15); }
  const busy = [];
  const sc = schichtFuer(s); if (sc && sc.von != null) busy.push([sc.von - p, sc.bis + p]);
  for (const a of db.auftraege) if (a.datum === s && a.zeit && OFFEN_STATUS.has(a.status) || (a.datum === s && a.zeit && UMSATZ_STATUS.has(a.status))) {
    const v = toMin(a.zeit); busy.push([v - p - fahrzeit(a) * 30, v + (dauer(a) + fahrzeit(a) / 2) * 60 + p]);
  }
  busy.sort((x, y) => x[0] - y[0]);
  const out = []; let cur = start;
  for (const [a, b] of busy) { if (a > cur) out.push([cur, Math.min(a, ende)]); cur = Math.max(cur, b); }
  if (cur < ende) out.push([cur, ende]);
  return out.map(([a, b]) => [Math.ceil(a / 15) * 15, Math.floor(b / 15) * 15]).filter(([a, b]) => b - a >= (st.minStd || 2.5) * 60);
}
function naechsteLuecken(tage = 14, max = 6){
  const out = [];
  for (let i = 0; i <= tage && out.length < max; i++) { const s = todayIso(i); for (const l of freieLuecken(s)) { out.push({s, l}); if (out.length >= max) break; } }
  return out;
}

/* ---------------- Wetter (Open-Meteo, kostenlos, ohne Schlüssel) ---------------- */
const WCODE = c => c == null ? ['', ''] : c === 0 ? ['☀️', 'sonnig'] : c <= 2 ? ['🌤️', 'heiter'] : c === 3 ? ['☁️', 'bewölkt'] : c <= 48 ? ['🌫️', 'Nebel'] : c <= 57 ? ['🌦️', 'Niesel'] : c <= 67 ? ['🌧️', 'Regen'] : c <= 77 ? ['❄️', 'Schnee'] : c <= 82 ? ['🌧️', 'Schauer'] : c <= 86 ? ['🌨️', 'Schneeschauer'] : ['⛈️', 'Gewitter'];
async function ladeWetter(force){
  if (!navigator.onLine) return;
  if (!force && Date.now() - (db.wetter.fetched || 0) < 3 * 3600e3) return;
  try {
    const u = `https://api.open-meteo.com/v1/forecast?latitude=${S().lat}&longitude=${S().lon}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunset&timezone=Europe%2FBerlin&forecast_days=16`;
    const r = await fetch(u); if (!r.ok) return;
    const j = await r.json(), d = j.daily, days = {};
    d.time.forEach((t, i) => { days[t] = {code: d.weather_code[i], tmax: d.temperature_2m_max[i], tmin: d.temperature_2m_min[i], pp: d.precipitation_probability_max[i], sunset: d.sunset[i]}; });
    db.wetter = {fetched: Date.now(), days}; save();
    if (!$('#sheet').classList.contains('open') && (tab === 'start' || tab === 'kalender')) render();
  } catch(e) {}
}
function wetterTxt(s, long){
  const w = db.wetter.days[s]; if (!w) return '';
  const [ic, txt] = WCODE(w.code);
  const rain = w.pp != null && w.pp >= 20 ? `${w.pp} % Regen` : '';
  return long ? `${ic} ${Math.round(w.tmax)}° ${txt}${rain ? ', ' + rain : ''}` : `${ic} ${Math.round(w.tmax)}°${rain ? ' · ' + rain : ''}`;
}

/* ---------------- Prognose ---------------- */
function prognose(mk){
  const [y, m] = mk.split('-').map(Number), tageImMonat = new Date(y, m, 0).getDate();
  const heute = todayIso(); if (mk !== monthKey(heute)) return null;
  const sicher = db.auftraege.filter(a => monthKey(a.datum) === mk && UMSATZ_STATUS.has(a.status)).reduce((s, a) => s + preis(a), 0);
  const gebucht = db.auftraege.filter(a => monthKey(a.datum) === mk && a.datum >= heute && (a.status === 'bestaetigt' || a.status === 'angebot')).reduce((s, a) => s + preis(a), 0);
  const restTage = tageImMonat - new Date().getDate();
  // Tempo der letzten 8 Wochen (erledigte Aufträge)
  const von = todayIso(-56);
  const hist = db.auftraege.filter(a => a.datum >= von && a.datum < heute && UMSATZ_STATUS.has(a.status));
  const proTag = hist.reduce((s, a) => s + preis(a), 0) / 56;
  const tempo = hist.length >= 3 ? sicher + Math.max(gebucht, proTag * restTage) : null;
  return {sicher, gebucht, basis: sicher + gebucht, tempo, restTage};
}

/* ---------------- Nachrichten ---------------- */
const du = () => S().anrede !== 'sie';
function wann(a){ const r = relDay(a.datum); return (r ? r + ', ' : '') + fmtDate(a.datum, true) + (a.zeit ? ` um ${a.zeit} Uhr` : ''); }
function grussName(k){ return du() ? (k?.vorname || '') : ([k?.vorname, k?.nachname].filter(Boolean).join(' ')); }
function msgAngebot(a, k){
  const pos = preisLines(a).map(l => `• ${l[0]}: ${eur(l[1])}`).join('\n');
  const tot = eur(preis(a));
  return du()
? `Hi${grussName(k) ? ' ' + grussName(k) : ''}, danke für deine Anfrage bei 92 Aufbereitung! 🙌

Für dein Auto${a.fahrzeug ? ' (' + a.fahrzeug + ')' : ''} sieht das so aus:
${pos}
Gesamt: ${tot}

Wir kommen zu dir. Sag mir einfach, welcher Tag dir passt und wo das Auto steht.`
: `Guten Tag${grussName(k) ? ' ' + grussName(k) : ''}, vielen Dank für Ihre Anfrage bei 92 Aufbereitung!

Für Ihr Fahrzeug${a.fahrzeug ? ' (' + a.fahrzeug + ')' : ''} sieht das Angebot so aus:
${pos}
Gesamt: ${tot}

Wir kommen zu Ihnen. Teilen Sie mir gern einen Wunschtermin und den Stellplatz mit.`;
}
function msgBestaetigung(a, k){
  const ort = adresse(k) || 'Adresse folgt';
  return du()
? `Hi ${grussName(k)}, dein Termin bei 92 Aufbereitung ist bestätigt ✅

📅 ${wann(a)}
📍 ${ort}
🚗 ${paketOf(a).name}${a.fahrzeug ? ' · ' + a.fahrzeug : ''}
💶 ${eur(preis(a))}${anfahrt(a) ? ' inkl. Anfahrt' : ''}

Bitte räum vorher persönliche Sachen aus dem Auto. Bis dann!`
: `Guten Tag ${grussName(k)}, Ihr Termin bei 92 Aufbereitung ist bestätigt ✅

📅 ${wann(a)}
📍 ${ort}
🚗 ${paketOf(a).name}${a.fahrzeug ? ' · ' + a.fahrzeug : ''}
💶 ${eur(preis(a))}${anfahrt(a) ? ' inkl. Anfahrt' : ''}

Bitte entfernen Sie vorab persönliche Gegenstände aus dem Fahrzeug. Bis dann!`;
}
function msgErinnerung(a, k){
  return du()
? `Hi ${grussName(k)}, kurze Erinnerung: ${wann(a)} komme ich für die Innenraumaufbereitung zu dir 🚗✨ Passt alles noch? Bitte vorher persönliche Sachen rausnehmen. Bis dann! 92 Aufbereitung`
: `Guten Tag ${grussName(k)}, eine kurze Erinnerung: ${wann(a)} komme ich für die Innenraumaufbereitung zu Ihnen. Passt alles? Bitte entfernen Sie vorab persönliche Gegenstände. Viele Grüße, 92 Aufbereitung`;
}
function msgDanke(a, k){
  const g = (S().googleReview || '').trim();
  return du()
? `Danke dir, ${grussName(k)}, dass du 92 Aufbereitung gebucht hast! 🙏 Ich hoffe, du fühlst dich wieder wie im Neuwagen 🚗✨

Wenn du zufrieden bist, würde mir eine kurze Bewertung mega helfen${g ? ':\n' + g : '.'}

Und folg uns gern auf Instagram und TikTok: @92.aufbereitung`
: `Vielen Dank, ${grussName(k)}, dass Sie 92 Aufbereitung gebucht haben! Ich hoffe, Sie sind mit dem Ergebnis zufrieden.

Über eine kurze Bewertung würde ich mich sehr freuen${g ? ':\n' + g : '.'}

Auf Instagram und TikTok finden Sie uns unter @92.aufbereitung.`;
}

/* Kontakt über den Kanal, über den der Kunde geschrieben hat */
function handleClean(h){ return (h || '').trim().replace(/^https?:\/\/(www\.)?(instagram\.com|tiktok\.com|facebook\.com|m\.me)\/@?/i, '').replace(/^@/, '').replace(/\/.*$/, ''); }
function chatLink(k, text){
  const h = handleClean(k?.handle);
  switch (k?.kanal) {
    case 'instagram': if (h) return {url:`https://ig.me/m/${h}`, copy:true, label:'Instagram-Chat'}; break;
    case 'tiktok': if (h) return {url:`https://www.tiktok.com/@${h}`, copy:true, label:'TikTok-Profil'}; break;
    case 'facebook': if (h) return {url:`https://m.me/${h}`, copy:true, label:'Messenger'}; break;
    case 'website': if (k.email && !k.tel) return {url:`mailto:${k.email}?subject=${encodeURIComponent('92 Aufbereitung')}&body=${encodeURIComponent(text||'')}`, label:'E-Mail'}; break;
    case 'telefon': if (k.tel) return {url:`sms:${k.tel.replace(/\s/g,'')}${/iP(hone|ad)/.test(navigator.userAgent)?'&':'?'}body=${encodeURIComponent(text||'')}`, label:'SMS'}; break;
  }
  if (k?.tel) return {url:`https://wa.me/${waNumber(k.tel)}?text=${encodeURIComponent(text||'')}`, label:'WhatsApp'};
  if (k?.email) return {url:`mailto:${k.email}?subject=${encodeURIComponent('92 Aufbereitung')}&body=${encodeURIComponent(text||'')}`, label:'E-Mail'};
  return {url:`https://wa.me/?text=${encodeURIComponent(text||'')}`, label:'WhatsApp'};
}
function sendText(k, text){
  const l = chatLink(k, text);
  if (l.copy) { copy(text); toast('Text kopiert · im Chat einfügen'); }
  openUrl(l.url);   // sofort im Tipp öffnen, sonst blockiert iOS
}

/* ---------------- Kalender-Export ---------------- */
function icsEvent(a){
  const k = kundeById(a.kundeId);
  const [y, m, d] = a.datum.split('-'); const [hh, mm] = (a.zeit || '09:00').split(':');
  const start = new Date(+y, m-1, +d, +hh, +mm), end = new Date(start.getTime() + dauer(a) * 3600e3);
  const z = x => x.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const e = s => String(s || '').replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');
  return ['BEGIN:VEVENT', 'UID:' + a.id + '@92app', 'DTSTAMP:' + z(new Date()), 'DTSTART:' + z(start), 'DTEND:' + z(end),
    'SUMMARY:' + e(`92 · ${kName(k)} · ${paketOf(a).name}`), 'LOCATION:' + e(adresse(k)),
    'DESCRIPTION:' + e(`${a.fahrzeug || ''}\n${eur(preis(a))}\nTel: ${k?.tel || ''}\n${a.notiz || ''}`),
    'BEGIN:VALARM', 'TRIGGER:-P1D', 'ACTION:DISPLAY', 'DESCRIPTION:Morgen: 92 Termin', 'END:VALARM',
    'BEGIN:VALARM', 'TRIGGER:-PT1H', 'ACTION:DISPLAY', 'DESCRIPTION:In 1 Stunde: 92 Termin', 'END:VALARM',
    'END:VEVENT'].join('\r\n');
}
const icsWrap = evs => ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//92 Aufbereitung//92 App//DE', 'CALSCALE:GREGORIAN', ...evs, 'END:VCALENDAR'].join('\r\n');
function gcalLink(a){
  const k = kundeById(a.kundeId);
  const [y, m, d] = a.datum.split('-'); const [hh, mm] = (a.zeit || '09:00').split(':');
  const start = new Date(+y, m-1, +d, +hh, +mm), end = new Date(start.getTime() + dauer(a) * 3600e3);
  const f = x => iso(x).replace(/-/g, '') + 'T' + pad(x.getHours()) + pad(x.getMinutes()) + '00';
  return 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(`92 · ${kName(k)} · ${paketOf(a).name}`) +
    '&dates=' + f(start) + '/' + f(end) + '&location=' + encodeURIComponent(adresse(k)) +
    '&details=' + encodeURIComponent(`${a.fahrzeug || ''}\n${eur(preis(a))}\nTel: ${k?.tel || ''}\n${a.notiz || ''}`);
}

/* ---------------- Benachrichtigungen ---------------- */
async function notify(title, body, tag){
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) return reg.showNotification(title, {body, tag, icon:'icons/icon-192.png', badge:'icons/icon-192.png'});
    new Notification(title, {body, tag, icon:'icons/icon-192.png'});
  } catch(e){}
}
function checkNotifs(){
  if (!S().notif || !('Notification' in window) || Notification.permission !== 'granted') return;
  const now = Date.now(); let changed = false;
  for (const a of db.auftraege) {
    if (!OFFEN_STATUS.has(a.status) || !a.datum) continue;
    const [y, m, d] = a.datum.split('-'); const [hh, mm] = (a.zeit || '09:00').split(':');
    const t = new Date(+y, m-1, +d, +hh, +mm).getTime(), diff = t - now;
    if (diff < -3600e3) continue;
    a.notified = a.notified || {};
    const k = kundeById(a.kundeId);
    if (diff <= 24 * 3600e3 && !a.notified.d) { a.notified.d = true; changed = true; notify(`${relDay(a.datum) === 'heute' ? 'Heute' : 'Morgen'} ${a.zeit || ''}: ${kName(k)}`, `${paketOf(a).name} · ${a.fahrzeug || ''} · ${adresse(k)}`, a.id + 'd'); }
    if (diff <= 75 * 60e3 && diff > -30 * 60e3 && !a.notified.h) { a.notified.h = true; changed = true; notify(`Gleich los: ${kName(k)} um ${a.zeit || ''}`, adresse(k) || 'Adresse prüfen', a.id + 'h'); }
  }
  // Kunden-Erinnerungen für morgen noch offen?
  const offen = remindList().filter(x => !x.a.erinnert);
  const key = 'rem' + todayIso();
  if (offen.length && new Date().getHours() >= 12 && !db[key]) { db[key] = true; changed = true; notify('Kunden erinnern', `${offen.length} Kunde${offen.length > 1 ? 'n' : ''} für morgen noch nicht erinnert. Ein Tipp in der App genügt.`, 'rem'); }
  if (changed) save();
}

/* ---------------- Bilder (Rechnungen) ---------------- */
async function compressImage(file){
  const max = 2000;
  let bmp;
  try { bmp = await createImageBitmap(file, {imageOrientation: 'from-image'}); } catch(e) {
    bmp = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(file); });
  }
  const w = bmp.width, h = bmp.height, f = Math.min(1, max / Math.max(w, h));
  const c = document.createElement('canvas'); c.width = Math.round(w * f); c.height = Math.round(h * f);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return await new Promise(res => c.toBlob(b => res(b || file), 'image/jpeg', 0.86));
}
async function addFiles(fileList, kundeId, auftragId){
  const added = [];
  for (const f of fileList) {
    const blob = f.type.startsWith('image/') ? await compressImage(f) : f;
    const id = uid();
    await Store.put('files', id, blob);
    const meta = {id, kundeId, auftragId: auftragId || null, name: f.name || 'Rechnung', type: blob.type, size: blob.size, created: new Date().toISOString()};
    db.files.push(meta); added.push(meta);
  }
  save(); return added;
}
const urlCache = new Map();
async function fileUrl(id){
  if (urlCache.has(id)) return urlCache.get(id);
  const b = await Store.get('files', id); if (!b) return '';
  const u = URL.createObjectURL(b); urlCache.set(id, u); return u;
}
async function hydrateThumbs(root){
  for (const img of $$('img[data-file]', root)) { const u = await fileUrl(img.dataset.file); if (u) img.src = u; }
}
function thumbsHtml(files, addAttrs){
  return `<div class="thumbs">${files.map(f => `<button class="th" data-act="viewFile" data-id="${f.id}"><img data-file="${f.id}" alt="" decoding="async"><small>${esc(f.auftragDatum || (f.created || '').slice(0,10))}</small></button>`).join('')}
  ${addAttrs ? `<button class="th add" ${addAttrs}>+ Rechnung<br>als Bild</button>` : ''}</div>`;
}

/* ---------------- Router ---------------- */
let tab = 'start';
const TITLES = {start:'Start', kalender:'Kalender', kunden:'Kunden', umsatz:'Umsatz', social:'Social'};
const VIEWS = {};
const scrollPos = {};
function go(t, keepScroll){
  if (t && t !== tab) { scrollPos[tab] = window.scrollY; }
  const same = !t || t === tab;
  if (t) tab = t;
  $$('#nav button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  $('#title').textContent = TITLES[tab];
  render();
  if (keepScroll) return;
  if (same) window.scrollTo({top: 0, behavior: 'smooth'}); else window.scrollTo(0, scrollPos[tab] || 0);
}
function render(){
  const v = $('#view');
  v.innerHTML = VIEWS[tab]();
  v.classList.remove('view-enter'); void v.offsetWidth; v.classList.add('view-enter');
  hydrateThumbs(v);
  $('.fab').hidden = tab === 'social' || tab === 'umsatz';
}

/* ---------------- Sheet ---------------- */
let sheetStack = [], onSheetClose = null;
function openSheet(html, onClose){
  const s = $('#sheet');
  s.innerHTML = '<div class="grab"></div>' + html;
  s.scrollTop = 0;
  requestAnimationFrame(() => { s.classList.add('open'); $('#sheetBg').classList.add('open'); });
  document.body.classList.add('lock');
  onSheetClose = onClose || null;
  hydrateThumbs(s);
}
function closeSheet(){
  $('#sheet').classList.remove('open'); $('#sheetBg').classList.remove('open'); document.body.classList.remove('lock');
  const f = onSheetClose; onSheetClose = null; if (f) f();
}
function sheetHead(title){ return `<div class="sheet-h"><h3>${title}</h3><button class="x" data-act="close" aria-label="Schließen">×</button></div>`; }

/* =========================================================================
   VIEW: START
   ========================================================================= */
function remindList(){
  const morgen = todayIso(1);
  return db.auftraege.filter(a => a.datum === morgen && OFFEN_STATUS.has(a.status)).sort(byDateAsc).map(a => ({a, k: kundeById(a.kundeId)}));
}
const mapsLink = k => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(adresse(k))}&travelmode=driving`;
function terminItem(a, opts = {}){
  const k = kundeById(a.kundeId);
  const w = a.datum && OFFEN_STATUS.has(a.status) ? wetterTxt(a.datum) : '';
  let konflikt = false;
  if (a.datum && a.zeit && OFFEN_STATUS.has(a.status) && S().schicht.aktiv) { const sc = schichtFuer(a.datum); if (sc && sc.von != null) { const v = toMin(a.zeit), e = v + dauer(a) * 60; konflikt = v < sc.bis && e > sc.von; } }
  return `<div class="card tap" role="button" tabindex="0" data-act="openAuftrag" data-id="${a.id}">
    <div class="ti"><div class="time"><b>${esc(a.zeit || '--:--')}</b><span>${opts.date ? esc(fmtDate(a.datum)) : (dauer(a).toLocaleString('de-DE') + ' Std.')}</span></div>
    <div class="body"><div class="card-h"><b class="ellipsis">${esc(kName(k))}</b>${scoreHtml(score(a))}</div>
    <div class="meta ellipsis">${esc(paketOf(a).name)} · ${esc(a.fahrzeug || 'Fahrzeug?')} · <span class="cyan">${eur(preis(a))}</span></div>
    <div class="meta ellipsis">${esc(adresse(k) || 'Adresse fehlt')}${w ? ' · ' + w : ''}</div>
    <div class="tags"><span class="badge b-${a.status}">${statusLabel(a.status)}</span>${k?.kanal ? `<span class="kanal">${kanal(k.kanal)[2]} ${kanal(k.kanal)[1]}</span>` : ''}${a.erinnert ? '<span class="kanal">✓ erinnert</span>' : ''}${konflikt ? '<span class="badge b-abgesagt">⚠ Schicht</span>' : ''}${opts.route && adresse(k) ? `<a class="btn sm route" href="${mapsLink(k)}" target="_blank" rel="noopener">📍 Route</a>` : ''}</div></div></div></div>`;
}
VIEWS.start = () => {
  const h = new Date().getHours();
  const gruss = h < 11 ? 'Guten Morgen' : h < 18 ? 'Hi' : 'Guten Abend';
  const heute = db.auftraege.filter(a => a.datum === todayIso() && a.status !== 'abgesagt').sort(byDateAsc);
  const morgen = db.auftraege.filter(a => a.datum === todayIso(1) && a.status !== 'abgesagt').sort(byDateAsc);
  const rem = remindList(), remOffen = rem.filter(x => !x.a.erinnert).length;
  const mk = monthKey(todayIso());
  const mon = db.auftraege.filter(a => monthKey(a.datum) === mk && UMSATZ_STATUS.has(a.status));
  const ums = mon.reduce((s, a) => s + preis(a), 0);
  const unbezahlt = db.auftraege.filter(a => a.status === 'erledigt');
  const anfragen = db.auftraege.filter(a => a.status === 'anfrage' && (!a.datum || a.datum > todayIso(1))).sort(byDateAsc);
  const next = db.auftraege.filter(a => a.datum > todayIso(1) && a.status === 'bestaetigt').sort(byDateAsc).slice(0, 5);
  const ueberfaellig = db.auftraege.filter(a => a.datum && a.datum < todayIso() && OFFEN_STATUS.has(a.status));
  const lb = S().lastBackup, tageSeitBackup = lb ? Math.floor((Date.now() - new Date(lb)) / 864e5) : null;
  const ziel = S().monatsziel || 0;
  let html = `<div class="muted small">${esc(fmtDate(todayIso(), true))}</div><div class="h-big">${gruss}${S().name ? ', ' + esc(S().name) : ''}</div>
  <div class="quick">
    <button class="q" data-act="schnellAngebot"><span>💬</span>Angebot</button>
    <button class="q" data-act="nachtragen"><span>↺</span>Nachtragen</button>
    <button class="q" data-act="assistent"><span>✦</span>Assistent</button></div>`;
  if (db.auftraege.length && (tageSeitBackup == null || tageSeitBackup >= 14))
    html += `<div class="card row-card" style="margin-top:10px"><div><b>💾 Sicherung fällig</b><div class="meta">${tageSeitBackup == null ? 'Noch nie gesichert' : `Letzte vor ${tageSeitBackup} Tagen`}</div></div><button class="btn pri sm" data-act="backup">Sichern</button></div>`;
  const md = monatsDaten(mk), pg = prognose(mk);
  html += `<button class="card tap glow" data-act="goUmsatz" style="margin-top:12px"><div class="card-h"><div><div class="muted small">Umsatz ${MONATE[new Date().getMonth()]}</div><div class="h-big num" style="font-size:34px">${eur(ums)}</div></div><div style="text-align:right"><div class="muted small">Ziel</div><b style="font:900 italic 20px var(--head)">${eur(ziel)}</b></div></div>
  ${ziel ? `<div class="progress"><i style="width:${clamp(ums / ziel * 100, 0, 100)}%"></i>${pg && pg.basis > ums ? `<i class="ghost" style="width:${clamp((pg.basis - ums) / ziel * 100, 0, 100 - clamp(ums / ziel * 100, 0, 100))}%"></i>` : ''}</div>` : ''}
  <div class="mini3"><span><b>${mon.length}</b> Aufträge</span><span><b>${md.n ? eur(md.lohn, 0) : '–'}</b> Gewinn/Std.</span><span><b>${pg ? eur(pg.tempo ?? pg.basis, 0) : '–'}</b> Prognose</span></div>
  ${unbezahlt.length ? `<div class="meta amber">💶 ${unbezahlt.length} erledigt, noch nicht bezahlt: ${eur(unbezahlt.reduce((s, a) => s + preis(a), 0))}</div>` : ''}</button>`;
  html += `<div class="label">Heute${S().schicht.aktiv ? ` <span class="muted lbl-extra">${esc(schichtFuer(todayIso())?.label || '')}</span>${freiKnopf(todayIso(), 'lbl-btn')}` : ''}</div>` + (heute.length ? heute.map(a => terminItem(a, {route: true})).join('') : `<div class="card muted">Heute keine Termine.</div>`);
  html += `<div class="label">Morgen${S().schicht.aktiv ? ` <span class="muted lbl-extra">${esc(schichtFuer(todayIso(1))?.label || '')}</span>${freiKnopf(todayIso(1), 'lbl-btn')}` : ''}</div>`;
  if (rem.length) html += `<button class="btn ${remOffen ? 'pri' : ''}" style="width:100%;margin-bottom:10px" data-act="reminders">🔔 ${remOffen ? `${remOffen} Kunde${remOffen > 1 ? 'n' : ''} für morgen erinnern` : 'Alle für morgen erinnert ✓'}</button>`;
  html += morgen.length ? morgen.map(a => terminItem(a, {route: true})).join('') : `<div class="card muted">Morgen keine Termine.</div>`;
  const bew = db.auftraege.filter(a => UMSATZ_STATUS.has(a.status) && a.datum >= todayIso(-10) && a.datum <= todayIso() && !a.bewertung).sort(byDateDesc);
  if (bew.length) html += `<div class="label">Bewertung anfragen</div>` + bew.map(a => { const k = kundeById(a.kundeId); return `<div class="card row-card"><div style="min-width:0"><b class="ellipsis" style="display:block">${esc(kName(k))}</b><div class="meta">${esc(fmtDate(a.datum))} · ${esc(paketOf(a).name)}</div></div><button class="btn sm wa" data-act="bewertung" data-id="${a.id}">⭐ Anfragen</button></div>`; }).join('');
  const lk = naechsteLuecken(14, 3);
  if (S().schicht.aktiv && lk.length) html += `<div class="label">Nächste freie Zeiten</div><div class="card" style="padding:4px 14px">${lk.map(x => `<div class="row"><span>${esc(relDay(x.s) ? relDay(x.s)[0].toUpperCase() + relDay(x.s).slice(1) : fmtDate(x.s))} · <b>${fromMin(x.l[0])}–${fromMin(x.l[1])}</b> <span class="muted small">${wetterTxt(x.s)}</span></span><button class="btn sm" data-act="slotTermin" data-v="${x.s}" data-t="${fromMin(x.l[0])}">+</button></div>`).join('')}</div>`;
  if (ueberfaellig.length) html += `<div class="label">Abschließen</div><div class="card muted small" style="margin-bottom:8px">Diese Termine sind vorbei. Auf Erledigt oder Bezahlt setzen, damit der Umsatz stimmt.</div>` + ueberfaellig.sort(byDateDesc).map(a => terminItem(a, {date:true})).join('');
  if (anfragen.length) html += `<div class="label">Offene Anfragen</div>` + anfragen.map(a => terminItem(a, {date:true})).join('');
  const angebote = db.auftraege.filter(a => a.status === 'angebot' && (!a.datum || a.datum > todayIso(1))).sort(byDateAsc);
  if (angebote.length) html += `<div class="label">Angebot raus · wartet auf Antwort</div>` + angebote.map(a => terminItem(a, {date:true})).join('');
  if (next.length) html += `<div class="label">Demnächst</div>` + next.map(a => terminItem(a, {date:true})).join('');

  if (!db.auftraege.length) html += `<div class="card" style="margin-top:14px"><b>So startest du</b><div class="meta">Tipp auf <b class="cyan">+</b> unten rechts und leg deinen ersten Auftrag an. Alte Kunden von letzten Wochen kannst du mit „Vergangenen Kunden nachtragen“ samt Datum und Rechnungsbild eintragen.</div></div>`;
  return html;
};

/* Kunden für morgen erinnern */
function openReminders(){
  const list = remindList();
  openSheet(sheetHead('Morgen erinnern') + `<p class="muted small" style="margin-top:0">Tipp auf „Senden“: Der Chat öffnet sich mit fertigem Text, du drückst nur noch auf Senden. Danach kommt automatisch der Nächste dran.</p>
  ${list.map(({a, k}, i) => `<div class="card" id="rem_${a.id}"><div class="card-h"><div><b>${esc(kName(k))}</b><div class="meta">${esc(a.zeit || '')} Uhr · ${esc(paketOf(a).name)} · ${esc(adresse(k))}</div></div>${a.erinnert ? '<span class="badge b-bezahlt">✓ erinnert</span>' : ''}</div>
  <div class="btns"><button class="btn ${a.erinnert ? '' : 'wa'}" data-act="remSend" data-id="${a.id}">${a.erinnert ? 'Nochmal senden' : 'Senden über ' + chatLink(k, '').label}</button></div></div>`).join('') || '<div class="empty">Morgen keine Termine.</div>'}`);
}

/* =========================================================================
   VIEW: KALENDER
   ========================================================================= */
let calY = new Date().getFullYear(), calM = new Date().getMonth(), calSel = todayIso();
VIEWS.kalender = () => {
  const first = new Date(calY, calM, 1), startOff = (first.getDay() + 6) % 7;
  const start = new Date(calY, calM, 1 - startOff);
  const byDay = {};
  for (const a of db.auftraege) if (a.datum && a.status !== 'abgesagt') (byDay[a.datum] = byDay[a.datum] || []).push(a);
  let cells = ['Mo','Di','Mi','Do','Fr','Sa','So'].map(w => `<div class="wd">${w}</div>`).join('');
  for (let i = 0; i < 42; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i); const s = iso(d);
    if (i >= 35 && d.getMonth() !== calM) break;
    const evs = byDay[s] || [];
    const sc = S().schicht.aktiv ? schichtFuer(s) : null;
    const frei = s >= todayIso() && freieLuecken(s).length;
    cells += `<button data-act="calDay" data-v="${s}" class="${d.getMonth() !== calM ? 'out' : ''} ${s === todayIso() ? 'today' : ''} ${s === calSel ? 'sel' : ''} ${frei ? 'frei' : ''}">${d.getDate()}<span class="dots">${evs.slice(0, 3).map(a => `<i class="d-${a.status}"></i>`).join('')}</span>${sc && d.getDay() !== 0 ? `<small class="sh sh-${sc.typ}">${sc.typ === 'frueh' ? 'F' : sc.typ === 'spaet' ? 'S' : 'frei'}</small>` : ''}</button>`;
  }
  const sel = (byDay[calSel] || []).sort(byDateAsc);
  const monthSum = db.auftraege.filter(a => monthKey(a.datum) === `${calY}-${pad(calM+1)}` && a.status !== 'abgesagt');
  return `<div class="cal-head"><button class="btn sm" data-act="calPrev">‹</button><b>${MONATE[calM]} ${calY}</b><button class="btn sm" data-act="calNext">›</button></div>
  <div class="cal">${cells}</div>
  <div class="meta" style="margin-top:8px">${monthSum.length} Termine in diesem Monat · ${eur(monthSum.reduce((s, a) => s + preis(a), 0))} geplant/gemacht</div>
  ${S().schicht.aktiv ? `<div class="legend" style="margin-top:6px"><span><b>F</b> Frühschicht</span><span><b>S</b> Spätschicht</span><span><i style="background:var(--green);border-radius:50%"></i>freie Zeit</span></div>` : ''}
  <div class="label">${esc(fmtDate(calSel, true))}</div>
  ${dayInfoHtml(calSel)}
  ${sel.length ? sel.map(a => terminItem(a, {route: calSel >= todayIso()})).join('') : '<div class="card muted">Keine Termine an diesem Tag.</div>'}
  <div class="btns"><button class="btn pri" data-act="neuAmTag">+ Termin am ${esc(fmtDate(calSel))}</button><button class="btn" data-act="today">Heute</button></div>
  ${S().schicht.aktiv ? `<div class="label">Freie Zeiten · nächste 14 Tage</div><div class="card" style="padding:4px 14px">${naechsteLuecken(14, 8).map(x => `<div class="row"><span>${esc(fmtDate(x.s))} · <b>${fromMin(x.l[0])}–${fromMin(x.l[1])}</b> <span class="muted small">${durTxt(x.l[1] - x.l[0])} ${wetterTxt(x.s)}</span></span><button class="btn sm" data-act="slotTermin" data-v="${x.s}" data-t="${fromMin(x.l[0])}">+</button></div>`).join('') || '<div class="muted" style="padding:10px 0">Keine freien Lücken gefunden.</div>'}</div>` : ''}
  <div class="label">Handy-Kalender</div>
  <div class="card small"><div class="muted">Damit du auch bei geschlossener App sicher erinnert wirst: alle kommenden Termine in deinen Handy-Kalender übernehmen (mit Erinnerung 1 Tag und 1 Stunde vorher).</div>
  <div class="btns"><button class="btn" data-act="icsAll">Alle kommenden Termine exportieren</button></div></div>`;
};

// Knopf "Frei" / "Doch Schicht" für einen Tag, nur an Tagen mit Schicht laut Plan.
function freiKnopf(s, cls = ''){
  if (!S().schicht.aktiv || s < todayIso()) return '';
  const plan = schichtFuer(s, true); if (!plan || plan.typ === 'frei') return '';
  const frei = !!S().schicht.frei?.[s];
  return `<button class="btn sm ${frei ? '' : 'pri'} ${cls}" data-act="freiTag" data-v="${s}">${frei ? '↺ Doch Schicht' : '🌴 Hab frei'}</button>`;
}
function dayInfoHtml(s){
  const sc = S().schicht.aktiv ? schichtFuer(s) : null, w = wetterTxt(s, true), lk = freieLuecken(s);
  const parts = [];
  if (sc) parts.push(`🏬 ${esc(sc.label)}`);
  parts.push(`🌇 hell bis ca. ${fromMin(sunset(s) + (S().lichtNach || 0))}`);
  if (w) parts.push(w);
  const fk = freiKnopf(s);
  return `<div class="card small"><div class="day-info">${parts.map(p => `<span>${p}</span>`).join('')}</div>${fk ? `<div class="btns">${fk}</div>` : ''}
  ${s >= todayIso() ? (lk.length ? `<div class="btns">${lk.map(l => `<button class="btn sm slot" data-act="slotTermin" data-v="${s}" data-t="${fromMin(l[0])}">Frei ${fromMin(l[0])}–${fromMin(l[1])}</button>`).join('')}</div>` : `<div class="meta">Keine Lücke ab ${String(S().minStd).replace('.', ',')} Std. bei Tageslicht. Tiefgarage oder Garage mit Licht? Dann geht auch später.</div>`) : ''}</div>`;
}

/* =========================================================================
   VIEW: KUNDEN (Archiv über Jahre, nach Jahr und Monat)
   ========================================================================= */
let kSuche = '', kJahr = 'alle', kMonat = 'alle', kSort = 'zuletzt';
function kundenStats(){
  const st = new Map();
  for (const k of db.kunden) st.set(k.id, {k, n:0, umsatz:0, last:'', months:new Set(), scoreSum:0});
  for (const a of db.auftraege) {
    const x = st.get(a.kundeId); if (!x || a.status === 'abgesagt') continue;
    x.n++; if (UMSATZ_STATUS.has(a.status)) x.umsatz += preis(a);
    if ((a.datum || '') > x.last) x.last = a.datum || '';
    if (a.datum) x.months.add(monthKey(a.datum));
    x.scoreSum += score(a);
  }
  return [...st.values()];
}
VIEWS.kunden = () => {
  const all = kundenStats();
  const months = new Set(); all.forEach(x => x.months.forEach(m => months.add(m)));
  const years = [...new Set([...months].map(m => m.slice(0, 4)))].sort().reverse();
  if (kJahr !== 'alle' && !years.includes(kJahr)) kJahr = 'alle';
  const monthsOfYear = [...months].filter(m => kJahr === 'alle' || m.startsWith(kJahr)).sort().reverse();
  const q = kSuche.toLowerCase().trim();
  let list = all.filter(x => {
    if (kJahr !== 'alle' && ![...x.months].some(m => m.startsWith(kJahr))) return false;
    if (kMonat !== 'alle' && !x.months.has(kMonat)) return false;
    if (!q) return true;
    const k = x.k; return [k.vorname, k.nachname, k.tel, k.email, k.ort, k.plz, k.strasse, k.fahrzeug, k.handle].join(' ').toLowerCase().includes(q);
  });
  list.sort(kSort === 'umsatz' ? (a, b) => b.umsatz - a.umsatz : kSort === 'name' ? (a, b) => kName(a.k).localeCompare(kName(b.k)) : (a, b) => (b.last || '').localeCompare(a.last || ''));
  const sumU = list.reduce((s, x) => s + x.umsatz, 0);
  return `<input type="search" placeholder="Suchen: Name, Ort, Auto, Telefon …" data-inp="kSuche" value="${esc(kSuche)}" autocomplete="off">
  <div class="chips scroll" style="margin-top:10px"><button class="chip ${kJahr === 'alle' ? 'on' : ''}" data-act="kJahr" data-v="alle">Alle Jahre</button>${years.map(y => `<button class="chip ${kJahr === y ? 'on' : ''}" data-act="kJahr" data-v="${y}">${y}</button>`).join('')}</div>
  ${monthsOfYear.length ? `<div class="chips scroll" style="margin-top:8px"><button class="chip ${kMonat === 'alle' ? 'on' : ''}" data-act="kMonat" data-v="alle">Alle Monate</button>${monthsOfYear.map(m => `<button class="chip ${kMonat === m ? 'on' : ''}" data-act="kMonat" data-v="${m}">${kJahr === 'alle' ? MON[+m.slice(5)-1] + ' ' + m.slice(2,4) : MONATE[+m.slice(5)-1]}</button>`).join('')}</div>` : ''}
  <div class="card-h" style="margin:12px 0 8px"><span class="muted small">${list.length} Kunde${list.length === 1 ? '' : 'n'} · ${eur(sumU)} Umsatz</span>
  <select style="width:auto;padding:6px 30px 6px 10px;font-size:14px" data-inp="kSort"><option value="zuletzt" ${kSort === 'zuletzt' ? 'selected' : ''}>Zuletzt</option><option value="umsatz" ${kSort === 'umsatz' ? 'selected' : ''}>Umsatz</option><option value="name" ${kSort === 'name' ? 'selected' : ''}>Name</option></select></div>
  <div id="kList">${kundenListHtml(list)}</div>
  <div class="btns"><button class="btn" data-act="nachtragen">Vergangenen Kunden nachtragen</button></div>`;
};
function kundenListHtml(list){
  if (!list.length) return `<div class="empty">${db.kunden.length ? 'Keine Treffer.' : 'Noch keine Kunden. Leg mit + einen Auftrag an.'}</div>`;
  return list.map(x => { const k = x.k, kn = kanal(k.kanal);
    return `<button class="card tap" data-act="openKunde" data-id="${k.id}"><div class="card-h"><b class="ellipsis">${esc(kName(k))}</b>${x.n ? scoreHtml(round05(x.scoreSum / x.n)) : ''}</div>
    <div class="meta ellipsis">${esc([k.ort, k.fahrzeug].filter(Boolean).join(' · ') || k.tel || '')}</div>
    <div class="meta">${x.n} Auftr${x.n === 1 ? 'ag' : 'äge'} · <span class="cyan">${eur(x.umsatz)}</span>${x.last ? ' · zuletzt ' + esc(fmtDate(x.last)) + ' ' + x.last.slice(0, 4) : ''}${x.n > 1 ? ' · <span class="green">Stammkunde</span>' : ''}</div>
    ${k.kanal ? `<div style="margin-top:6px"><span class="kanal">${kn[2]} ${kn[1]}</span></div>` : ''}</button>`; }).join('');
}

/* Kunden-Detail mit Tabs */
let kTab = 'info';
function openKunde(id, tabName){
  const k = kundeById(id); if (!k) return;
  if (tabName) kTab = tabName;
  const auf = auftraegeVon(id);
  const files = db.files.filter(f => f.kundeId === id).map(f => Object.assign({}, f, {auftragDatum: auftragById(f.auftragId)?.datum ? fmtDate(auftragById(f.auftragId).datum) + ' ' + auftragById(f.auftragId).datum.slice(2,4) : ''}));
  const umsatz = auf.filter(a => UMSATZ_STATUS.has(a.status)).reduce((s, a) => s + preis(a), 0);
  const kn = kanal(k.kanal), cl = chatLink(k, '');
  let body = '';
  if (kTab === 'info') body = `
    <div class="btns" style="margin-top:0">
      <button class="btn wa" data-act="kChat" data-id="${k.id}">${{WhatsApp: '💬', 'Instagram-Chat': '📸', 'TikTok-Profil': '🎵', Messenger: '👍', 'E-Mail': '✉️', SMS: '💬'}[cl.label] || '💬'} ${esc(cl.label)}</button>
      ${k.tel ? `<a class="btn" href="tel:${esc(k.tel.replace(/\s/g, ''))}">📞 Anrufen</a>` : ''}
      ${k.email && cl.label !== 'E-Mail' ? `<a class="btn" href="mailto:${esc(k.email)}">✉️ E-Mail</a>` : ''}
      ${k.tel && cl.label !== 'WhatsApp' ? `<a class="btn" target="_blank" rel="noopener" href="https://wa.me/${waNumber(k.tel)}">💬 WhatsApp</a>` : ''}
      ${adresse(k) ? `<a class="btn" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(adresse(k))}">📍 Route</a>` : ''}
    </div>
    <div class="grid3" style="margin-top:12px"><div class="stat"><b>${auf.filter(a => a.status !== 'abgesagt').length}</b><span>Aufträge</span></div><div class="stat"><b>${eur(umsatz)}</b><span>Umsatz</span></div><div class="stat"><b>${files.length}</b><span>Rechnungen</span></div></div>
    <div class="card" style="margin-top:10px">
      ${[['Telefon', k.tel], ['E-Mail', k.email], ['Adresse', adresse(k)], ['Fahrzeug', k.fahrzeug], ['Klasse', (KLASSEN.find(x => x[0] === k.klasse) || [])[1]], ['Stellplatz', k.stellplatz], ['Kanal', k.kanal ? kn[1] + (k.handle ? ' · @' + handleClean(k.handle) : '') : ''], ['Kunde seit', k.created ? fmtDate(k.created.slice(0, 10), true) : ''], ['Notiz', k.notiz]].filter(r => r[1]).map(r => `<div class="row"><span class="muted">${r[0]}</span><span style="text-align:right">${esc(r[1])}</span></div>`).join('')}
    </div>
    <div class="btns"><button class="btn pri" data-act="auftragFuerKunde" data-id="${k.id}">+ Neuer Auftrag</button><button class="btn" data-act="editKunde" data-id="${k.id}">Bearbeiten</button></div>`;
  if (kTab === 'auftraege') body = auf.length ? auf.map(a => terminItem(a, {date:true})).join('') : '<div class="empty">Noch keine Aufträge.</div>';
  if (kTab === 'rechnungen') body = `<p class="muted small" style="margin-top:0">Rechnung fotografieren oder Screenshot auswählen. Wird auf dem Handy gespeichert und ist in jeder Sicherung enthalten.</p>
    ${auf.length ? `<label class="f"><span>Zu welchem Auftrag?</span><select id="rechAuftrag">${auf.map(a => `<option value="${a.id}">${esc(fmtDate(a.datum))} ${a.datum ? a.datum.slice(0,4) : ''} · ${esc(paketOf(a).name)} · ${eur(preis(a))}</option>`).join('')}<option value="">Ohne Auftrag</option></select></label>` : ''}
    ${thumbsHtml(files.sort((a, b) => (b.created || '').localeCompare(a.created || '')), `data-act="addRechnungKunde" data-id="${k.id}"`)}`;
  openSheet(sheetHead(esc(kName(k))) + `
    <div class="seg" style="margin-bottom:12px"><button data-act="kTab" data-v="info" data-id="${k.id}" class="${kTab === 'info' ? 'on' : ''}">Übersicht</button><button data-act="kTab" data-v="auftraege" data-id="${k.id}" class="${kTab === 'auftraege' ? 'on' : ''}">Aufträge</button><button data-act="kTab" data-v="rechnungen" data-id="${k.id}" class="${kTab === 'rechnungen' ? 'on' : ''}">Rechnungen</button></div>
    ${body}`);
}
function kundeFields(k = {}){
  return `<div class="grid2"><label class="f"><span>Vorname *</span><input name="vorname" value="${esc(k.vorname)}" autocomplete="off" autocapitalize="words"></label>
    <label class="f"><span>Nachname</span><input name="nachname" value="${esc(k.nachname)}" autocomplete="off" autocapitalize="words"></label></div>
    <div class="grid2"><label class="f"><span>Telefon / WhatsApp</span><input name="tel" type="tel" value="${esc(k.tel)}" placeholder="0176 …" autocomplete="off"></label>
    <label class="f"><span>E-Mail</span><input name="email" type="email" value="${esc(k.email)}" autocomplete="off" autocapitalize="off"></label></div>
    <label class="f"><span>Straße, Hausnummer</span><input name="strasse" value="${esc(k.strasse)}" autocomplete="off"></label>
    <div class="grid2" style="grid-template-columns:110px 1fr"><label class="f"><span>PLZ</span><input name="plz" inputmode="numeric" value="${esc(k.plz)}" autocomplete="off"></label>
    <label class="f"><span>Ort</span><input name="ort" value="${esc(k.ort)}" placeholder="Solingen" autocomplete="off"></label></div>
    <div class="grid2"><label class="f"><span>Angefragt über</span><select name="kanal"><option value="">–</option>${KANAELE.map(c => `<option value="${c[0]}" ${k.kanal === c[0] ? 'selected' : ''}>${c[2]} ${c[1]}</option>`).join('')}</select></label>
    <label class="f"><span>Profil / @Name</span><input name="handle" value="${esc(k.handle)}" placeholder="@name" autocomplete="off" autocapitalize="off"></label></div>`;
}
function editKunde(id){
  const k = kundeById(id);
  openSheet(sheetHead('Kunde bearbeiten') + `<form id="kf">${kundeFields(k)}
    <label class="f"><span>Notiz zum Kunden</span><textarea name="notiz">${esc(k.notiz)}</textarea></label>
    <div class="btns"><button class="btn pri" type="submit">Speichern</button></div>
    <div class="btns"><button class="btn sm danger" type="button" data-act="delKunde" data-id="${k.id}">Kunde mit allen Aufträgen löschen</button></div></form>`);
  $('#kf').onsubmit = e => { e.preventDefault(); Object.assign(k, Object.fromEntries(new FormData(e.target))); save(); toast('Gespeichert'); openKunde(k.id, 'info'); if (tab === 'kunden') render(); };
}

/* =========================================================================
   AUFTRAG-FORMULAR (Kunde + Fahrzeug + Paket + Preis + Score + Rechnung)
   ========================================================================= */
let draft = null, draftNew = false, draftFiles = [];
function newDraft(extra = {}){
  return Object.assign({id: uid(), kundeId: null, klasse: 'limo', paket: 'signature', extras: [], aufwand: 0, km: '', anfahrt: '', rabatt: '', preis: '', dauer: '', datum: '', zeit: '', status: 'anfrage', fahrzeug: '', stellplatz: '', videoId: '', scoreManuell: '', notiz: '', created: new Date().toISOString()}, extra);
}
function openAuftrag(a, opts = {}){
  draftNew = !a;
  draft = a ? structuredClone(a) : newDraft(opts.preset);
  draftFiles = [];
  const k = kundeById(draft.kundeId) || opts.kunde || {};
  const s = S();
  const videos = [...db.videos].sort((x, y) => (y.aufrufe || 0) - (x.aufrufe || 0));
  openSheet(sheetHead(draftNew ? (opts.title || 'Neuer Auftrag') : 'Auftrag') + `<form id="af" autocomplete="off">
  <div class="label" style="margin-top:0">Kunde</div>
  ${db.kunden.length ? `<div style="position:relative"><input type="search" id="kSearch" placeholder="Bestehenden Kunden suchen …" autocomplete="off"><div id="kHits"></div></div>
  <div id="kChosen" class="meta" style="margin:6px 0 10px">${draft.kundeId ? `Bestehender Kunde: <b class="cyan">${esc(kName(k))}</b> · <a href="#" data-act="kundeLoesen">als neuen Kunden anlegen</a>` : 'Neuer Kunde · oder oben suchen'}</div>` : ''}
  ${kundeFields(k)}
  <div class="label">Fahrzeug</div>
  <label class="f"><span>Marke & Modell</span><input name="fahrzeug" value="${esc(draft.fahrzeug || k.fahrzeug || '')}" placeholder="z. B. Audi A3 Sportback"></label>
  <div class="seg" id="klasseSeg">${KLASSEN.map(x => `<button type="button" data-act="dKlasse" data-v="${x[0]}" class="${draft.klasse === x[0] ? 'on' : ''}">${x[1]}</button>`).join('')}</div>
  <label class="f" style="margin-top:10px"><span>Stellplatz</span><select name="stellplatz"><option value="">–</option>${STELLPLATZ.map(x => `<option ${(draft.stellplatz || k.stellplatz) === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
  <div class="label">Paket</div>
  <div id="pkList">${pkListHtml()}</div>
  <div class="label">Zusatzleistungen</div>
  <div class="card" style="padding:2px 14px">${s.extras.map(e => `<div class="check"><input type="checkbox" id="ex_${e.id}" data-ex="${e.id}" ${draft.extras.includes(e.id) ? 'checked' : ''}><label for="ex_${e.id}">${esc(e.name)}</label><span class="p">+${eur(e.preis)}</span></div>`).join('')}</div>
  <div class="label">Aufwandspauschale</div>
  <div class="chips" id="aufChips">${[{name:'keine', preis:0}, ...s.aufwand].map(x => `<button type="button" class="chip ${num(draft.aufwand) === x.preis || (!num(draft.aufwand) && !x.preis) ? 'on' : ''}" data-act="dAufwand" data-v="${x.preis}">${x.preis ? x.name + ' +' + x.preis + ' €' : 'Keine'}</button>`).join('')}</div>
  <div class="label">Termin</div>
  <div class="grid2"><label class="f"><span>Datum</span><input name="datum" type="date" value="${esc(draft.datum)}"></label>
  <label class="f"><span>Uhrzeit</span><input name="zeit" type="time" value="${esc(draft.zeit)}"></label></div>
  <div id="dayHint" class="day-hint"></div>
  <div class="grid2"><label class="f"><span>Dauer Aufbereitung (Std.)</span><input name="dauer" type="number" inputmode="decimal" step="0.25" min="0" value="${esc(draft.dauer)}" placeholder="ca. ${dauerAuto(draft).toLocaleString('de-DE')}" id="dauerIn"></label>
  <label class="f"><span>Status</span><select name="status">${STATUS.map(x => `<option value="${x[0]}" ${draft.status === x[0] ? 'selected' : ''}>${x[1]}</option>`).join('')}</select></label></div>
  <div class="label">Strecke & Preis</div>
  <div class="grid2"><label class="f"><span>Strecke gesamt hin + zurück (km)</span><input name="km" type="number" inputmode="decimal" value="${esc(draft.km)}" placeholder="z. B. 40"></label>
  <label class="f"><span>Anfahrtskosten (€)</span><input name="anfahrt" type="number" inputmode="decimal" value="${esc(draft.anfahrt)}" id="anfIn"></label></div>
  <div class="grid2"><label class="f"><span>Rabatt (€)</span><input name="rabatt" type="number" inputmode="decimal" value="${esc(draft.rabatt)}" placeholder="0"></label>
  <label class="f"><span>Mein Preis gesamt (€)</span><input name="preis" type="number" inputmode="decimal" step="0.01" value="${esc(draft.preis)}" id="preisIn"></label></div>
  <div class="total" id="totBox"></div>
  <div class="label">92-Score · lohnt sich der Auftrag?</div>
  <div class="card" id="scoreBox"></div>
  <label class="f"><span>Eigene Bewertung (überschreibt den Score)</span><select name="scoreManuell"><option value="">Automatisch berechnen</option>${Array.from({length:21}, (_, i) => i / 2).reverse().map(v => `<option value="${v}" ${num(draft.scoreManuell) === v ? 'selected' : ''}>${scoreFmt(v)} / 10</option>`).join('')}</select></label>
  <div class="label">Herkunft</div>
  <label class="f"><span>Über welches Video kam die Anfrage?</span><select name="videoId"><option value="">– kein / unbekannt –</option>${videos.map(v => `<option value="${v.id}" ${draft.videoId === v.id ? 'selected' : ''}>${esc((PLATTFORMEN.find(p => p[0] === v.plattform) || ['', v.plattform])[1])} · ${esc(v.titel || 'Video')}</option>`).join('')}</select></label>
  <label class="f"><span>Notiz</span><textarea name="notiz" placeholder="z. B. Hundehaare, Flecken Rücksitz, Schlüssel beim Nachbarn">${esc(draft.notiz)}</textarea></label>
  <div class="label">Rechnung</div>
  <div id="afThumbs"></div>
  <div class="btns" style="position:sticky;bottom:calc(-24px - var(--sb));background:var(--bg2);padding:10px 0 4px;margin-top:16px"><button class="btn pri" type="submit" style="flex:2" id="saveBtn">Speichern</button></div>
  <div class="label">Aktionen</div>
  <div class="btns" style="margin-top:0">
    <button type="button" class="btn sm wa" data-act="dSend" data-k="angebot">Angebot senden</button>
    <button type="button" class="btn sm wa" data-act="dSend" data-k="best">Bestätigung</button>
    <button type="button" class="btn sm wa" data-act="dSend" data-k="erin">Erinnerung</button>
    <button type="button" class="btn sm wa" data-act="dSend" data-k="danke">Danke + Bewertung</button>
    <button type="button" class="btn sm" data-act="dRoute">📍 Route</button>
    <button type="button" class="btn sm" data-act="dIcs">In Kalender</button>
    <button type="button" class="btn sm" data-act="dGcal">Google Kalender</button>
    ${draftNew ? '' : `<button type="button" class="btn sm" data-act="dDup">Neuer Termin für Kunden</button><button type="button" class="btn sm danger" data-act="dDel">Löschen</button>`}
  </div></form>`, () => {
    if (draftNew && draftFiles.length && !auftragById(draft.id)) { for (const f of draftFiles) { db.files = db.files.filter(x => x.id !== f.id); Store.del('files', f.id); } save(); }
    draft = null;
  });
  updateDraftUi();
  renderDraftThumbs();
  const f = $('#af');
  f.addEventListener('input', onDraftInput);
  f.addEventListener('change', onDraftInput);
  f.onsubmit = e => { e.preventDefault(); saveDraft(); };
  const ks = $('#kSearch');
  if (ks) ks.addEventListener('input', () => {
    const q = ks.value.toLowerCase().trim();
    const hits = q ? db.kunden.filter(k => [k.vorname, k.nachname, k.tel, k.ort, k.fahrzeug].join(' ').toLowerCase().includes(q)).slice(0, 6) : [];
    $('#kHits').innerHTML = hits.map(k => `<button type="button" class="card tap" style="padding:10px;margin:6px 0" data-act="kundeWaehlen" data-id="${k.id}"><b>${esc(kName(k))}</b><div class="meta">${esc([k.tel, k.ort, k.fahrzeug].filter(Boolean).join(' · '))}</div></button>`).join('');
  });
}
function pkListHtml(){
  return S().pakete.map(p => `<button type="button" class="pk ${draft.paket === p.id ? 'on' : ''}" data-act="dPaket" data-v="${p.id}"><span class="p">${eur(num(p.preise[draft.klasse]) || 0)}</span><span class="t">${p.nr} · ${esc(p.name)}</span><small>${esc(p.info)}</small></button>`).join('');
}
function readDraftForm(){
  const f = $('#af'); if (!f) return;
  const fd = new FormData(f);
  for (const key of ['fahrzeug','stellplatz','datum','zeit','dauer','status','km','anfahrt','rabatt','preis','scoreManuell','videoId','notiz']) draft[key] = fd.get(key) ?? '';
  draft.extras = $$('[data-ex]', f).filter(x => x.checked).map(x => x.dataset.ex);
}
function onDraftInput(e){
  if (e.target.id === 'kSearch') return;
  readDraftForm(); updateDraftUi();
}
function updateDraftUi(){
  const tb = $('#totBox'); if (!tb) return;
  const lines = preisLines(draft), auto = autoPreis(draft), p = preis(draft);
  tb.innerHTML = lines.map(l => `<div class="ln"><span>${esc(l[0])}</span><span>${eur(l[1])}</span></div>`).join('') +
    (num(draft.preis) != null && num(draft.preis) !== auto ? `<div class="ln amber"><span>Eigener Preis statt ${eur(auto)}</span><span></span></div>` : '') +
    `<div class="sum"><span>Gesamt</span><b>${eur(p)}</b></div>`;
  const sb = $('#saveBtn'); if (sb) sb.textContent = `Speichern · ${eur(p)}`;
  $('#preisIn').placeholder = 'auto: ' + eur(auto).replace(' €', '');
  $('#anfIn').placeholder = 'auto: ' + anfahrtAuto(draft);
  $('#dauerIn').placeholder = 'ca. ' + dauerAuto(draft).toLocaleString('de-DE');
  const dh = $('#dayHint');
  if (dh) { if (draft.datum) { const sc = S().schicht.aktiv ? schichtFuer(draft.datum) : null, lk = freieLuecken(draft.datum), w = wetterTxt(draft.datum, true);
      const zeitM = draft.zeit ? toMin(draft.zeit) : null, endM = zeitM != null ? zeitM + dauer(draft) * 60 : null;
      const kollision = zeitM != null && sc && sc.von != null && zeitM < sc.bis + (S().puffer || 0) && endM > sc.von - (S().puffer || 0);
      const dunkel = endM != null && endM > sunset(draft.datum) + (S().lichtNach || 0);
      dh.innerHTML = [sc ? '🏬 ' + esc(sc.label) : '', w, '🌇 hell bis ' + fromMin(sunset(draft.datum) + (S().lichtNach || 0)),
        kollision ? '<span class="red">⚠ überschneidet sich mit deiner Schicht</span>' : '', dunkel && !kollision ? `<span class="amber">⚠ Ende ca. ${fromMin(endM)}, dann ist es dunkel</span>` : '',
        !draft.zeit && lk.length ? 'Frei: ' + lk.map(l => `<a href="#" data-act="setZeit" data-t="${fromMin(l[0])}">${fromMin(l[0])}–${fromMin(l[1])}</a>`).join(', ') : ''].filter(Boolean).join(' · ');
    } else dh.innerHTML = ''; }
  const sa = scoreAuto(draft), man = num(draft.scoreManuell);
  const shown = man ?? sa.score;
  $('#scoreBox').innerHTML = `<div class="score-box"><div class="score-big ${shown >= 8 ? 'green' : shown >= 6 ? 'cyan' : shown >= 4 ? 'amber' : 'red'}">${scoreFmt(shown)}</div><div><b>${shown >= 8.5 ? 'Top-Auftrag' : shown >= 7 ? 'Guter Auftrag' : shown >= 5 ? 'Geht so' : 'Lohnt sich kaum'}</b><div class="meta">${man != null ? 'Eigene Bewertung · automatisch wären ' + scoreFmt(sa.score) : 'Automatisch berechnet'}</div></div></div>
  <ul class="reasons">${sa.why.map(w => `<li><span class="${w[1] === '+' ? 'green' : 'amber'}">${w[1]}</span> ${esc(w[0])}</li>`).join('')}</ul>`;
}
async function renderDraftThumbs(){
  const box = $('#afThumbs'); if (!box || !draft) return;
  const files = db.files.filter(f => f.auftragId === draft.id);
  box.innerHTML = thumbsHtml(files, 'data-act="addRechnungDraft"');
  hydrateThumbs(box);
}
function collectKunde(){
  const fd = new FormData($('#af')); const k = {};
  for (const key of ['vorname','nachname','tel','email','strasse','plz','ort','kanal','handle']) k[key] = (fd.get(key) || '').trim();
  return k;
}
function saveDraft(){
  readDraftForm();
  const kd = collectKunde();
  if (!kd.vorname && !kd.nachname && !draft.kundeId) { toast('Bitte Namen eintragen'); $('[name=vorname]').focus(); return; }
  let k = kundeById(draft.kundeId);
  if (!k && kd.tel) k = db.kunden.find(x => waNumber(x.tel) && waNumber(x.tel) === waNumber(kd.tel));
  if (!k) { k = {id: uid(), created: draft.datum ? new Date(draft.datum).toISOString() : new Date().toISOString(), notiz: ''}; db.kunden.push(k); }
  Object.assign(k, kd);
  if (draft.fahrzeug) k.fahrzeug = draft.fahrzeug;
  k.klasse = draft.klasse; if (draft.stellplatz) k.stellplatz = draft.stellplatz;
  if (draft.datum && (!k.created || draft.datum < k.created.slice(0, 10))) k.created = new Date(draft.datum).toISOString();
  draft.kundeId = k.id;
  for (const f of db.files) if (f.auftragId === draft.id) f.kundeId = k.id;
  const i = db.auftraege.findIndex(a => a.id === draft.id);
  const old = i >= 0 ? db.auftraege[i] : null;
  if (old && (old.datum !== draft.datum || old.zeit !== draft.zeit)) { draft.notified = {}; draft.erinnert = null; }
  if (i >= 0) db.auftraege[i] = draft; else db.auftraege.push(draft);
  draftNew = false;
  save(); haptic(); toast('Gespeichert ✓');
  closeSheet(); render();
}

/* =========================================================================
   VIEW: UMSATZ (Monate, Jahre, Bewertung)
   ========================================================================= */
let uJahr = String(new Date().getFullYear()), uMonat = monthKey(todayIso());
function monatsDaten(mk){
  const list = db.auftraege.filter(a => monthKey(a.datum) === mk && UMSATZ_STATUS.has(a.status));
  const umsatz = list.reduce((s, a) => s + preis(a), 0);
  const km = list.reduce((s, a) => s + (num(a.km) || 0), 0);
  const kosten = km * S().kmKosten + list.length * S().material;
  const std = list.reduce((s, a) => s + dauer(a) + fahrzeit(a), 0);
  const sc = list.length ? list.reduce((s, a) => s + score(a), 0) / list.length : null;
  return {mk, list, umsatz, km, kosten, gewinn: umsatz - kosten, std, lohn: std ? (umsatz - kosten) / std : 0, score: sc, n: list.length, extras: list.filter(a => (a.extras || []).length).length};
}
function monatsBewertung(m, prev){
  const s = S(), out = [], z = s.monatsziel || 600, wochen = 4.33;
  if (!m.n) return {note: null, items: [['💤', 'In diesem Monat ist noch kein erledigter Auftrag eingetragen.']]};
  let note = 5;
  const zielQ = m.umsatz / z; note += clamp((zielQ - 1) * 4, -3, 2.5);
  note += clamp((m.lohn - s.zielStundenlohn) / s.zielStundenlohn * 3, -2, 1.5);
  if (prev && prev.umsatz) note += clamp((m.umsatz - prev.umsatz) / prev.umsatz * 2, -1, 1);
  if (m.score != null) note += (m.score - 7) * 0.3;
  note = clamp(round05(note), 0, 10);
  out.push(['💶', `${eur(m.umsatz)} Umsatz aus ${m.n} Auftr${m.n === 1 ? 'ag' : 'ägen'}, Ø ${eur(m.umsatz / m.n, 0)} pro Auto. Nach Fahrt- und Materialkosten bleiben ca. ${eur(m.gewinn, 0)}.`]);
  out.push([zielQ >= 1 ? '🎯' : '📈', zielQ >= 1 ? `Monatsziel von ${eur(z)} erreicht (${Math.round(zielQ * 100)} %).` : `Noch ${eur(z - m.umsatz, 0)} bis zum Monatsziel von ${eur(z)}. Das sind etwa ${Math.ceil((z - m.umsatz) / Math.max(1, m.umsatz / m.n))} Aufträge.`]);
  out.push([m.lohn >= s.zielStundenlohn ? '⏱️' : '⚠️', `Effektiv ca. ${eur(m.lohn, 0)} pro Stunde (inkl. Fahrzeit, ${m.std.toLocaleString('de-DE', {maximumFractionDigits:1})} Std. gesamt). Dein Ziel: ${eur(s.zielStundenlohn, 0)}/Std.`]);
  if (prev && prev.n) { const d = m.umsatz - prev.umsatz; out.push([d >= 0 ? '⬆️' : '⬇️', `${d >= 0 ? '+' : ''}${eur(d, 0)} gegenüber ${MONATE[+prev.mk.slice(5) - 1]}.`]); }
  const stdWoche = m.std / wochen;
  out.push(['🎓', stdWoche <= 12 ? `Ca. ${stdWoche.toLocaleString('de-DE', {maximumFractionDigits:1})} Std. pro Woche. Gut machbar neben dem Studium.` : stdWoche <= 20 ? `Ca. ${stdWoche.toLocaleString('de-DE', {maximumFractionDigits:1})} Std. pro Woche. Das ist schon viel neben dem Studium. Lieber Preise oder Extras hoch als mehr Termine.` : `Ca. ${stdWoche.toLocaleString('de-DE', {maximumFractionDigits:1})} Std. pro Woche. Über 20 Std. pro Woche kann der Studentenstatus (z. B. bei der Krankenversicherung) wackeln. Im Blick behalten.`]);
  const exQ = m.extras / m.n;
  out.push(['➕', exQ >= .4 ? `${Math.round(exQ * 100)} % der Kunden haben ein Extra gebucht. Stark.` : `Nur ${Math.round(exQ * 100)} % mit Extra. Biete Dichtungspflege oder Geruchsneutralisierung aktiv an, das hebt den Schnitt ohne viel Mehraufwand.`]);
  return {note, items: out};
}
function barChart(data, opt = {}){
  const W = 340, H = opt.h || 170, pb = 20, pt = 18, n = data.length, gap = 6;
  const max = Math.max(1, ...data.map(d => d.v));
  const bw = (W - gap * (n - 1)) / n;
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img">
  <defs><linearGradient id="gb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#43dbff"/><stop offset="1" stop-color="#0e7fa0"/></linearGradient></defs>
  ${data.map((d, i) => { const h = (H - pb - pt) * d.v / max, x = i * (bw + gap), y = H - pb - h;
    return `<g ${opt.act ? `data-act="${opt.act}" data-v="${d.key}" style="cursor:pointer"` : ''}><rect x="${x}" y="${pt}" width="${bw}" height="${H - pb - pt}" fill="transparent"/>
    <rect x="${x}" y="${y}" width="${bw}" height="${Math.max(h, d.v ? 2 : 0)}" rx="4" fill="${d.hi ? 'url(#gb)' : '#1f3140'}"/>
    ${d.v ? `<text class="v" x="${x + bw / 2}" y="${y - 4}" text-anchor="middle">${opt.fmt ? opt.fmt(d.v) : d.v}</text>` : ''}
    <text x="${x + bw / 2}" y="${H - 5}" text-anchor="middle" ${d.hi ? 'style="fill:#43dbff"' : ''}>${esc(d.label)}</text></g>`; }).join('')}</svg>`;
}
VIEWS.umsatz = () => {
  const years = [...new Set(db.auftraege.filter(a => a.datum).map(a => a.datum.slice(0, 4)).concat([String(new Date().getFullYear())]))].sort().reverse();
  if (!years.includes(uJahr)) uJahr = years[0];
  if (!uMonat.startsWith(uJahr)) uMonat = uJahr + (uJahr === todayIso().slice(0, 4) ? todayIso().slice(4, 7) : '-12');
  const months = Array.from({length: 12}, (_, i) => monatsDaten(`${uJahr}-${pad(i + 1)}`));
  const jahr = months.reduce((s, m) => ({u: s.u + m.umsatz, n: s.n + m.n, g: s.g + m.gewinn, std: s.std + m.std}), {u: 0, n: 0, g: 0, std: 0});
  const m = months[+uMonat.slice(5) - 1];
  const prevKey = (() => { const d = new Date(+uMonat.slice(0, 4), +uMonat.slice(5) - 2, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; })();
  const bw = monatsBewertung(m, monatsDaten(prevKey));
  // Kanal-Auswertung (alle Zeit, im Jahr)
  const kan = {};
  for (const a of db.auftraege.filter(a => (a.datum || '').startsWith(uJahr) && a.status !== 'abgesagt')) {
    const k = kundeById(a.kundeId), c = k?.kanal || 'sonstiges';
    kan[c] = kan[c] || {n: 0, u: 0}; kan[c].n++; if (UMSATZ_STATUS.has(a.status)) kan[c].u += preis(a);
  }
  const kanArr = Object.entries(kan).sort((a, b) => b[1].n - a[1].n), kanMax = Math.max(1, ...kanArr.map(x => x[1].n));
  const jahrList = db.auftraege.filter(a => (a.datum || '').startsWith(uJahr) && UMSATZ_STATUS.has(a.status));
  const pkJ = {}, exJ = {};
  for (const a of jahrList) { const p = paketOf(a).name; pkJ[p] = (pkJ[p] || 0) + 1; for (const id of a.extras || []) { const e = S().extras.find(x => x.id === id); if (e) exJ[e.name] = (exJ[e.name] || 0) + 1; } }
  const pkArr = Object.entries(pkJ).sort((a, b) => b[1] - a[1]), exArr = Object.entries(exJ).sort((a, b) => b[1] - a[1]);
  const pg = prognose(uMonat);
  const ku = 25000;
  return `<div class="chips scroll">${years.map(y => `<button class="chip ${uJahr === y ? 'on' : ''}" data-act="uJahr" data-v="${y}">${y}</button>`).join('')}</div>
  <div class="grid3" style="margin-top:12px"><div class="stat"><b>${eur(jahr.u, 0)}</b><span>Umsatz ${uJahr}</span></div><div class="stat"><b>${jahr.n}</b><span>Aufträge</span></div><div class="stat"><b>${jahr.std ? eur(jahr.g / jahr.std, 0) : '–'}</b><span>Gewinn/Std.</span></div></div>
  <div class="card" style="margin-top:10px">${barChart(months.map((x, i) => ({key: x.mk, label: MON[i].slice(0, 3), v: Math.round(x.umsatz), hi: x.mk === uMonat})), {act: 'uMonat', fmt: v => v >= 1000 ? (v / 1000).toLocaleString('de-DE', {maximumFractionDigits: 1}) + 'k' : v})}
  <div class="meta">Tipp auf einen Monat für die Details.</div></div>
  <div class="label">${monthLabel(uMonat)}</div>
  <div class="card glow"><div class="score-box">${bw.note != null ? `<div class="score-big ${bw.note >= 8 ? 'green' : bw.note >= 6 ? 'cyan' : bw.note >= 4 ? 'amber' : 'red'}">${scoreFmt(bw.note)}</div>` : ''}<div><b>Monatsbewertung</b><div class="meta">für nebenberuflich neben dem Studium</div></div></div>
  ${bw.items.map(i => `<div class="insight"><span class="ic">${i[0]}</span><span>${esc(i[1])}</span></div>`).join('')}
  ${m.n ? `<div class="btns"><button class="btn sm" data-act="claudeMonat">Ausführlich mit Claude analysieren</button></div>` : ''}</div>
  ${pg ? `<div class="card"><div class="card-h"><b>📈 Prognose Monatsende</b><b class="cyan">${eur(pg.tempo ?? pg.basis, 0)}</b></div>
  <div class="meta">${eur(pg.sicher, 0)} erledigt + ${eur(pg.gebucht, 0)} gebucht = ${eur(pg.basis, 0)} sicher.${pg.tempo != null ? ` Bei deinem Tempo der letzten 8 Wochen landest du bei ca. ${eur(pg.tempo, 0)}.` : ' Ab 3 erledigten Aufträgen rechnet die App auch mit deinem Tempo.'} ${S().monatsziel ? ((pg.tempo ?? pg.basis) >= S().monatsziel ? '🎯 Ziel in Reichweite.' : `Für das Ziel fehlen ca. ${eur(S().monatsziel - (pg.tempo ?? pg.basis), 0)}, noch ${pg.restTage} Tage.`) : ''}</div></div>` : ''}
  ${m.n ? `<div class="grid3"><div class="stat"><b>${eur(m.umsatz, 0)}</b><span>Umsatz</span></div><div class="stat"><b>${eur(m.lohn, 0)}</b><span>Gewinn/Std.</span></div><div class="stat"><b>${m.score != null ? scoreFmt(round05(m.score)) : '–'}</b><span>Ø Score</span></div></div>
  <div class="label">Kunden im ${MONATE[+uMonat.slice(5) - 1]}</div>${m.list.sort(byDateAsc).map(a => terminItem(a, {date: true})).join('')}` : ''}
  <div class="label">Beliebteste Pakete & Extras (${uJahr})</div>
  <div class="card">${pkArr.length ? pkArr.map(([n, c]) => `<div class="bar-row"><span>${esc(n)}</span><div class="bar"><i style="width:${c / jahrList.length * 100}%"></i></div><b>${Math.round(c / jahrList.length * 100)} %</b></div>`).join('') + (exArr.length ? `<div class="muted small" style="margin:10px 0 2px">Extras (Anteil der Aufträge)</div>` + exArr.map(([n, c]) => `<div class="bar-row"><span>${esc(n)}</span><div class="bar"><i style="width:${c / jahrList.length * 100}%"></i></div><b>${Math.round(c / jahrList.length * 100)} %</b></div>`).join('') : '<div class="muted small" style="margin-top:8px">Noch keine Extras gebucht.</div>') : '<div class="muted">Noch keine erledigten Aufträge.</div>'}</div>
  <div class="label">Woher kommen die Aufträge? (${uJahr})</div>
  <div class="card">${kanArr.length ? kanArr.map(([c, v]) => `<div class="bar-row"><span>${kanal(c)[2]} ${kanal(c)[1]}</span><div class="bar"><i style="width:${v.n / kanMax * 100}%"></i></div><b>${v.n} · ${eur(v.u, 0)}</b></div>`).join('') : '<div class="muted">Noch keine Daten. Trag beim Kunden ein, worüber er angefragt hat.</div>'}</div>
  <div class="label">Gewerbe im Blick</div>
  <div class="card small"><div class="card-h"><span>Kleinunternehmergrenze ${uJahr}</span><b>${eur(jahr.u, 0)} / ${eur(ku, 0)}</b></div><div class="progress"><i style="width:${clamp(jahr.u / ku * 100, 0, 100)}%"></i></div>
  <div class="muted">Kleingewerbe heißt: kein Kaufmann, einfache Buchhaltung. Wichtig ist die Kleinunternehmerregelung (§ 19 UStG): keine Umsatzsteuer, solange der Umsatz im Vorjahr unter 25.000 € liegt und im laufenden Jahr 100.000 € nicht überschreitet. Gewinn trotzdem in der Steuererklärung angeben. Keine Steuerberatung, im Zweifel beim Steuerberater nachfragen.</div></div>`;
};

/* =========================================================================
   VIEW: SOCIAL (Follower-/Like-Verlauf, Videos, Anfragen pro Video)
   ========================================================================= */
let sTab = 'uebersicht', sMetric = 'follower';
function videoStats(v){
  const auf = db.auftraege.filter(a => a.videoId === v.id && a.status !== 'abgesagt');
  const umsatz = auf.filter(a => UMSATZ_STATUS.has(a.status)).reduce((s, a) => s + preis(a), 0);
  const views = num(v.aufrufe) || 0;
  const inter = (num(v.likes) || 0) + 3 * (num(v.kommentare) || 0) + 5 * (num(v.shares) || 0) + 3 * (num(v.saves) || 0);
  const er = views && (num(v.likes) != null) ? ((num(v.likes) || 0) + (num(v.kommentare) || 0) + (num(v.shares) || 0) + (num(v.saves) || 0)) / views * 100 : null;
  return {anfragen: auf.length, umsatz, views, er, inter};
}
function medianViews(){ const arr = db.videos.map(v => num(v.aufrufe) || 0).filter(Boolean).sort((a, b) => a - b); return arr.length ? arr[Math.floor(arr.length / 2)] : 0; }
function videoScore(v, med){
  const st = videoStats(v); if (!st.views) return null;
  let s = 3 + clamp(Math.log2(st.views / Math.max(med, 1)) * 1.5, -3, 3.5);
  if (st.er != null) s += clamp((st.er - 4) / 2, -1.5, 2);
  s += clamp(st.anfragen * 0.75, 0, 2.5);
  return clamp(round05(s), 0, 10);
}
function lineChart(series, opt = {}){
  const W = 340, H = 170, pl = 6, pr = 6, pt = 14, pb = 22;
  const pts = series.flatMap(s => s.points); if (pts.length < 1) return '<div class="muted">Noch keine Daten.</div>';
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
  let x0 = Math.min(...xs), x1 = Math.max(...xs); if (x0 === x1) { x0 -= 864e5 * 3; x1 += 864e5 * 3; }
  let y0 = 0, y1 = Math.max(...ys) * 1.12 || 1;
  const X = x => pl + (x - x0) / (x1 - x0) * (W - pl - pr), Y = y => H - pb - (y - y0) / (y1 - y0) * (H - pt - pb);
  const ticks = [x0, (x0 + x1) / 2, x1];
  return `<svg class="chart" viewBox="0 0 ${W} ${H}">
  ${[0.25, .5, .75, 1].map(f => `<line x1="${pl}" x2="${W - pr}" y1="${Y(y1 * f / 1.12)}" y2="${Y(y1 * f / 1.12)}" stroke="#17222d"/>`).join('')}
  ${series.map(s => { const p = s.points.sort((a, b) => a.x - b.x); const d = p.map((q, i) => `${i ? 'L' : 'M'}${X(q.x).toFixed(1)},${Y(q.y).toFixed(1)}`).join('');
    return `<path d="${d}" stroke="${s.color}" stroke-width="2.5" fill="none"/>${p.map(q => `<circle cx="${X(q.x)}" cy="${Y(q.y)}" r="3.5" fill="${s.color}"/>`).join('')}
    ${p.length ? `<text class="v" x="${Math.min(X(p[p.length - 1].x), W - 30)}" y="${Y(p[p.length - 1].y) - 7}" text-anchor="middle">${fmtK(p[p.length - 1].y)}</text>` : ''}`; }).join('')}
  ${ticks.map((t, i) => `<text x="${X(t)}" y="${H - 6}" text-anchor="${i === 0 ? 'start' : i === 2 ? 'end' : 'middle'}">${new Date(t).toLocaleDateString('de-DE', {day: '2-digit', month: '2-digit', year: '2-digit'})}</text>`).join('')}</svg>
  <div class="legend">${series.map(s => `<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join('')}</div>`;
}
const PCOL = {tiktok: '#43dbff', instagram: '#ff6fae', facebook: '#6f8dff', youtube: '#ff5f6d'};
function latestSnap(pl, before){
  return db.social.filter(s => s.plattform === pl && (!before || s.datum <= before) && num(s[sMetric]) != null).sort((a, b) => b.datum.localeCompare(a.datum))[0];
}
VIEWS.social = () => {
  const seg = `<div class="seg" style="margin-bottom:12px">${[['uebersicht', 'Übersicht'], ['videos', 'Videos'], ['analyse', 'Analyse']].map(x => `<button data-act="sTab" data-v="${x[0]}" class="${sTab === x[0] ? 'on' : ''}">${x[1]}</button>`).join('')}</div>`;
  if (sTab === 'uebersicht') {
    const pls = PLATTFORMEN.map(p => p[0]).filter(p => db.social.some(s => s.plattform === p));
    const d30 = todayIso(-30);
    const cards = pls.map(p => {
      const cur = db.social.filter(s => s.plattform === p).sort((a, b) => b.datum.localeCompare(a.datum));
      const f = cur.find(s => num(s.follower) != null), l = cur.find(s => num(s.likes) != null);
      const fOld = cur.find(s => num(s.follower) != null && s.datum <= d30), lOld = cur.find(s => num(s.likes) != null && s.datum <= d30);
      const delta = (a, b, k) => a && b && a !== b ? `<span class="${a[k] - b[k] >= 0 ? 'green' : 'red'}">${a[k] - b[k] >= 0 ? '+' : ''}${fmtN(a[k] - b[k])}</span> in 30 T.` : '';
      return `<div class="card"><div class="card-h"><b>${(PLATTFORMEN.find(x => x[0] === p) || [, p])[1]}</b><span class="muted small">Stand ${esc(fmtDate(cur[0].datum))}</span></div>
      <div class="grid2" style="margin-top:6px"><div><div class="h-big num" style="font-size:26px">${fmtN(f?.follower)}</div><div class="meta">Follower ${delta(f, fOld, 'follower')}</div></div>
      <div><div class="h-big num" style="font-size:26px">${fmtN(l?.likes)}</div><div class="meta">Likes ${delta(l, lOld, 'likes')}</div></div></div></div>`;
    }).join('');
    const series = pls.map(p => ({name: (PLATTFORMEN.find(x => x[0] === p) || [, p])[1], color: PCOL[p] || '#ccc', points: db.social.filter(s => s.plattform === p && num(s[sMetric]) != null).map(s => ({x: dLocal(s.datum).getTime(), y: num(s[sMetric])}))})).filter(s => s.points.length);
    return seg + `${cards || '<div class="empty">Noch keine Werte eingetragen.</div>'}
    <div class="btns"><button class="btn pri" data-act="neuSnap">+ Aktuellen Stand eintragen</button></div>
    <div class="label">Verlauf</div>
    <div class="seg" style="margin-bottom:10px"><button data-act="sMetric" data-v="follower" class="${sMetric === 'follower' ? 'on' : ''}">Follower</button><button data-act="sMetric" data-v="likes" class="${sMetric === 'likes' ? 'on' : ''}">Likes</button></div>
    <div class="card">${lineChart(series)}</div>
    <p class="muted small">Am besten jeden Sonntag kurz die Zahlen aus TikTok und Instagram eintragen. Dann siehst du genau, welche Woche und welches Video Wachstum gebracht hat.</p>
    ${db.social.length ? `<div class="label">Einträge</div>${[...db.social].sort((a, b) => b.datum.localeCompare(a.datum)).slice(0, 30).map(s => `<button class="card tap" data-act="editSnap" data-id="${s.id}" style="padding:10px 14px"><div class="card-h"><span>${esc(fmtDate(s.datum))} ${s.datum.slice(0, 4)} · ${(PLATTFORMEN.find(x => x[0] === s.plattform) || [, s.plattform])[1]}</span><span class="muted">${fmtN(s.follower)} F · ${fmtN(s.likes)} L</span></div></button>`).join('')}` : ''}`;
  }
  if (sTab === 'videos') {
    const med = medianViews();
    const list = [...db.videos].sort((a, b) => (num(b.aufrufe) || 0) - (num(a.aufrufe) || 0));
    return seg + `<div class="btns" style="margin-top:0"><button class="btn pri" data-act="neuVideo">+ Video eintragen</button></div>
    ${list.length ? list.map(v => { const st = videoStats(v), sc = videoScore(v, med), viral = med && st.views >= med * 3 && list.length >= 3;
      return `<button class="card tap" data-act="editVideo" data-id="${v.id}" style="margin-top:10px"><div class="card-h"><div style="min-width:0"><b class="ellipsis" style="display:block">${esc(v.titel || 'Video')}</b><div class="meta">${(PLATTFORMEN.find(x => x[0] === v.plattform) || [, v.plattform])[1]}${v.datum ? ' · ' + esc(fmtDate(v.datum)) + ' ' + v.datum.slice(2, 4) : ''}${viral ? ' · <span class="green">🔥 viral</span>' : ''}</div></div>${sc != null ? scoreHtml(sc) : ''}</div>
      <div class="grid3" style="margin-top:8px;gap:6px"><div class="stat" style="padding:7px 9px"><b style="font-size:16px">${fmtK(st.views)}</b><span>Aufrufe</span></div><div class="stat" style="padding:7px 9px"><b style="font-size:16px">${fmtK(num(v.likes))}</b><span>Likes</span></div><div class="stat" style="padding:7px 9px"><b style="font-size:16px">${fmtK(num(v.kommentare))}</b><span>Kommentare</span></div></div>
      <div class="meta" style="margin-top:6px">${st.er != null ? `Engagement ${st.er.toLocaleString('de-DE', {maximumFractionDigits: 1})} % · ` : ''}<span class="${st.anfragen ? 'cyan' : ''}">${st.anfragen} Anfrage${st.anfragen === 1 ? '' : 'n'}</span>${st.umsatz ? ' · ' + eur(st.umsatz, 0) + ' Umsatz' : ''}</div></button>`; }).join('') : '<div class="empty">Noch keine Videos eingetragen.</div>'}`;
  }
  // Analyse
  const ins = socialInsights();
  return seg + `<div class="card glow"><b>92-Analyse deiner Videos</b><div class="meta" style="margin-bottom:6px">Automatisch aus deinen eingetragenen Zahlen und Aufträgen</div>
  ${ins.map(i => `<div class="insight"><span class="ic">${i[0]}</span><span>${i[1]}</span></div>`).join('')}
  <div class="btns"><button class="btn pri" data-act="claudeSocial">Ausführlich mit Claude analysieren</button></div></div>
  <div class="card small"><b>TikTok und Instagram direkt verbinden?</b><div class="muted" style="margin-top:4px">Das geht nur über die offiziellen Schnittstellen (TikTok for Developers, Instagram-API über ein Meta-Business-Konto). Dafür braucht die App einen eigenen Server und eine Freigabe von TikTok bzw. Meta. Bis dahin trägst du die Zahlen hier in 1 Minute pro Woche selbst ein. Die Anfragen pro Video zählt die App automatisch, wenn du beim Auftrag das Video auswählst.</div></div>`;
};
function socialInsights(){
  const out = [], med = medianViews();
  const vids = db.videos.filter(v => num(v.aufrufe));
  if (!vids.length) return [['📝', 'Trag deine Videos mit Aufrufen, Likes und Kommentaren ein. Dann siehst du hier, was funktioniert.']];
  const byViews = [...vids].sort((a, b) => b.aufrufe - a.aufrufe);
  const top = byViews[0];
  out.push(['🔥', `Stärkstes Video: <b>${esc(top.titel)}</b> mit ${fmtN(top.aufrufe)} Aufrufen${med ? `, das ist ${(Math.round(top.aufrufe / med * 10) / 10).toLocaleString('de-DE')}× dein Median (${fmtN(med)})` : ''}.`]);
  const withEr = vids.map(v => ({v, s: videoStats(v)})).filter(x => x.s.er != null);
  if (withEr.length) { const b = withEr.sort((a, b) => b.s.er - a.s.er)[0]; out.push(['❤️', `Bestes Engagement: <b>${esc(b.v.titel)}</b> mit ${b.s.er.toLocaleString('de-DE', {maximumFractionDigits: 1})} %. Über 5 % ist sehr gut, 2 bis 5 % solide.`]); }
  else out.push(['❤️', 'Trag bei den Videos auch Likes, Kommentare, Shares und Saves ein. Dann berechnet die App das Engagement.']);
  const withAnf = db.videos.map(v => ({v, s: videoStats(v)})).filter(x => x.s.anfragen);
  if (withAnf.length) {
    const b = withAnf.sort((a, b) => b.s.anfragen - a.s.anfragen)[0];
    out.push(['📩', `Die meisten Anfragen brachte <b>${esc(b.v.titel)}</b>: ${b.s.anfragen} Anfrage${b.s.anfragen > 1 ? 'n' : ''}${b.s.umsatz ? ', ' + eur(b.s.umsatz, 0) + ' Umsatz' : ''}${b.s.views ? `, also ${(b.s.anfragen / b.s.views * 10000).toLocaleString('de-DE', {maximumFractionDigits: 1})} Anfragen pro 10.000 Aufrufe` : ''}.`]);
  } else out.push(['📩', 'Noch keinem Video ist ein Auftrag zugeordnet. Frag Neukunden kurz „Über welches Video hast du uns gefunden?“ und wähl es beim Auftrag aus.']);
  const preisV = vids.filter(v => /\d+\s?€|euro|preis|kostet/i.test(v.titel || '')), sonst = vids.filter(v => !preisV.includes(v));
  const avg = a => a.reduce((s, v) => s + v.aufrufe, 0) / a.length;
  if (preisV.length && sonst.length) out.push(['💡', `Videos mit Preis im Hook: Ø ${fmtK(Math.round(avg(preisV)))} Aufrufe, ohne Preis: Ø ${fmtK(Math.round(avg(sonst)))}. ${avg(preisV) > avg(sonst) ? 'Preis-Hooks ziehen bei dir besser.' : 'Fragen und Probleme als Hook ziehen bei dir besser als Preise.'}`]);
  const frage = vids.filter(v => /\?/.test(v.titel || ''));
  if (frage.length && vids.length - frage.length) out.push(['❓', `Hooks als Frage: Ø ${fmtK(Math.round(avg(frage)))} Aufrufe gegenüber Ø ${fmtK(Math.round(avg(vids.filter(v => !frage.includes(v)))))} ohne Frage.`]);
  const tt = db.social.filter(s => s.plattform === 'tiktok' && num(s.follower) != null).sort((a, b) => a.datum.localeCompare(b.datum));
  const totalViews = vids.reduce((s, v) => s + v.aufrufe, 0);
  if (tt.length) out.push(['👥', `Auf ${fmtN(totalViews)} eingetragene Aufrufe kommen ${fmtN(tt[tt.length - 1].follower)} TikTok-Follower. Viele schauen, wenige folgen. Ein klarer Call-to-Action am Ende („Folg für Teil 2“, Serien mit gleichem Format) hilft, Aufrufe in Follower zu verwandeln.`]);
  return out;
}
function claudePrompt(kind){
  const s = S();
  const ctx = `Kontext: Ich (${s.name || 'Inhaber'}) betreibe "92 Aufbereitung", mobile Innenraumaufbereitung in Solingen und Umgebung, als Kleingewerbe nebenberuflich neben dem dualen Studium (seit September 2026). Pakete: ${s.pakete.map(p => `${p.name} ${p.preise.klein}/${p.preise.limo}/${p.preise.suv} €`).join(', ')}. Extras: ${s.extras.map(e => e.name + ' +' + e.preis + ' €').join(', ')}. Anfahrt ${s.anfahrtPreis} € ab über ${s.anfahrtAbKm} km Gesamtstrecke. Ziel-Stundenlohn ${s.zielStundenlohn} €, Monatsziel ${s.monatsziel} €.`;
  if (kind === 'monat') {
    const m = monatsDaten(uMonat);
    const rows = m.list.map(a => `${a.datum}; ${paketOf(a).name}; ${(KLASSEN.find(k => k[0] === a.klasse) || [])[1]}; ${a.fahrzeug || ''}; Extras: ${(a.extras || []).join('+') || '-'}; ${num(a.km) || 0} km; ${dauer(a)} Std.; ${preis(a)} €; Score ${score(a)}; Kanal ${kundeById(a.kundeId)?.kanal || '-'}`).join('\n');
    const months = Array.from({length: 12}, (_, i) => monatsDaten(`${uMonat.slice(0, 4)}-${pad(i + 1)}`)).filter(x => x.n).map(x => `${x.mk}: ${Math.round(x.umsatz)} € aus ${x.n} Aufträgen`).join('\n');
    return `${ctx}\n\nBitte bewerte meinen Monat ${monthLabel(uMonat)} ehrlich auf einer Skala von 0 bis 10 (halbe Punkte erlaubt) und gib mir 3 konkrete Verbesserungen für Umsatz, Preise und Zeit neben dem Studium.\n\nAufträge im Monat:\n${rows}\n\nVerlauf ${uMonat.slice(0, 4)}:\n${months}`;
  }
  const med = medianViews();
  const vrows = db.videos.map(v => { const st = videoStats(v); return `${v.plattform}; ${v.datum || '?'}; "${v.titel}"; Aufrufe ${v.aufrufe ?? '?'}; Likes ${v.likes ?? '?'}; Kommentare ${v.kommentare ?? '?'}; Shares ${v.shares ?? '?'}; Saves ${v.saves ?? '?'}; neue Follower ${v.follower ?? '?'}; Anfragen ${st.anfragen}; Umsatz ${st.umsatz} €; App-Score ${videoScore(v, med) ?? '?'}`; }).join('\n');
  const srows = [...db.social].sort((a, b) => a.datum.localeCompare(b.datum)).map(x => `${x.datum} ${x.plattform}: ${x.follower ?? '?'} Follower, ${x.likes ?? '?'} Likes`).join('\n');
  return `${ctx}\n\nAnalysiere meine Social-Media-Videos. Bewerte jedes Video von 0 bis 10 (halbe Punkte erlaubt), erkläre, was viral ging und warum, welche Videos Anfragen gebracht haben, und gib mir 5 konkrete Ideen für die nächsten Videos (Hook, Format, Call-to-Action). Achte besonders darauf, wie ich aus Aufrufen mehr Follower und Anfragen mache.\n\nVideos:\n${vrows}\n\nFollower-/Like-Verlauf:\n${srows}`;
}
function openSnap(snap){
  const s = snap || {id: uid(), datum: todayIso(), plattform: 'tiktok', follower: '', likes: ''};
  const isNew = !snap;
  openSheet(sheetHead(isNew ? 'Stand eintragen' : 'Stand bearbeiten') + `<form id="sf">
    <div class="grid2"><label class="f"><span>Datum</span><input type="date" name="datum" value="${esc(s.datum)}" required></label>
    <label class="f"><span>Plattform</span><select name="plattform">${PLATTFORMEN.map(p => `<option value="${p[0]}" ${s.plattform === p[0] ? 'selected' : ''}>${p[1]}</option>`).join('')}</select></label></div>
    <div class="grid2"><label class="f"><span>Follower</span><input type="number" inputmode="numeric" name="follower" value="${esc(s.follower)}"></label>
    <label class="f"><span>Likes gesamt</span><input type="number" inputmode="numeric" name="likes" value="${esc(s.likes)}"></label></div>
    <div class="btns"><button class="btn pri" type="submit">Speichern</button></div>
    ${isNew ? '' : `<div class="btns"><button type="button" class="btn sm danger" data-act="delSnap" data-id="${s.id}">Löschen</button></div>`}</form>`);
  $('#sf').onsubmit = e => {
    e.preventDefault(); const f = Object.fromEntries(new FormData(e.target));
    Object.assign(s, {datum: f.datum, plattform: f.plattform, follower: num(f.follower), likes: num(f.likes)});
    if (isNew) db.social.push(s); save(); closeSheet(); render(); toast('Gespeichert ✓');
  };
}
function openVideo(v){
  const isNew = !v; v = v || {id: uid(), plattform: 'tiktok', titel: '', url: '', datum: todayIso(), aufrufe: '', likes: '', kommentare: '', shares: '', saves: '', follower: '', notiz: ''};
  const st = isNew ? null : videoStats(v);
  const auf = isNew ? [] : db.auftraege.filter(a => a.videoId === v.id);
  openSheet(sheetHead(isNew ? 'Video eintragen' : 'Video') + `<form id="vf">
    <label class="f"><span>Titel / Hook</span><input name="titel" value="${esc(v.titel)}" placeholder="z. B. Für 39 € kann das doch nichts werden" required></label>
    <div class="grid2"><label class="f"><span>Plattform</span><select name="plattform">${PLATTFORMEN.map(p => `<option value="${p[0]}" ${v.plattform === p[0] ? 'selected' : ''}>${p[1]}</option>`).join('')}</select></label>
    <label class="f"><span>Veröffentlicht am</span><input type="date" name="datum" value="${esc(v.datum)}"></label></div>
    <label class="f"><span>Link (optional)</span><input name="url" type="url" value="${esc(v.url)}" placeholder="https://www.tiktok.com/@92.aufbereitung/video/…" autocapitalize="off"></label>
    <div class="grid3"><label class="f"><span>Aufrufe</span><input type="number" inputmode="numeric" name="aufrufe" value="${esc(v.aufrufe)}"></label>
    <label class="f"><span>Likes</span><input type="number" inputmode="numeric" name="likes" value="${esc(v.likes)}"></label>
    <label class="f"><span>Kommentare</span><input type="number" inputmode="numeric" name="kommentare" value="${esc(v.kommentare)}"></label>
    <label class="f"><span>Shares</span><input type="number" inputmode="numeric" name="shares" value="${esc(v.shares)}"></label>
    <label class="f"><span>Saves</span><input type="number" inputmode="numeric" name="saves" value="${esc(v.saves)}"></label>
    <label class="f"><span>+ Follower</span><input type="number" inputmode="numeric" name="follower" value="${esc(v.follower)}"></label></div>
    <label class="f"><span>Notiz (Song, Format, Auto …)</span><textarea name="notiz">${esc(v.notiz)}</textarea></label>
    ${st ? `<div class="card"><b>${st.anfragen} Anfrage${st.anfragen === 1 ? '' : 'n'} über dieses Video</b>${st.umsatz ? ` · ${eur(st.umsatz)} Umsatz` : ''}${auf.length ? `<div class="meta">${auf.map(a => esc(kName(kundeById(a.kundeId)))).join(', ')}</div>` : '<div class="meta">Beim Auftrag unter „Herkunft“ das Video auswählen.</div>'}</div>` : ''}
    <div class="btns"><button class="btn pri" type="submit">Speichern</button>${v.url ? `<a class="btn" href="${esc(v.url)}" target="_blank" rel="noopener">Öffnen</a>` : ''}</div>
    ${isNew ? '' : `<div class="btns"><button type="button" class="btn sm danger" data-act="delVideo" data-id="${v.id}">Löschen</button></div>`}</form>`);
  $('#vf').onsubmit = e => {
    e.preventDefault(); const f = Object.fromEntries(new FormData(e.target));
    for (const k of ['aufrufe', 'likes', 'kommentare', 'shares', 'saves', 'follower']) f[k] = num(f[k]);
    Object.assign(v, f, {updated: new Date().toISOString()}); if (isNew) db.videos.push(v);
    save(); closeSheet(); render(); toast('Gespeichert ✓');
  };
}

/* =========================================================================
   ASSISTENT (kennt dein Profil und deine Zahlen)
   ========================================================================= */
function kiKontext(){
  const s = S(), heute = todayIso(), lines = [];
  lines.push('=== Über mich ===', s.profil || '');
  lines.push('', '=== Preise ===',
    ...s.pakete.map(p => `${p.name}: Kleinwagen ${p.preise.klein} €, Limousine/Kombi ${p.preise.limo} €, SUV ${p.preise.suv} € (${p.info})`),
    `Extras: ${s.extras.map(e => e.name + ' +' + e.preis + ' €').join(', ')}`,
    `Aufwandspauschale: ${s.aufwand.map(a => a.name + ' +' + a.preis + ' €').join(', ')}`,
    `Anfahrt: ${s.anfahrtPreis} € ab über ${s.anfahrtAbKm} km Gesamtstrecke`,
    `Ziele: Monatsziel ${s.monatsziel} € Umsatz, Ziel-Stundenlohn ${s.zielStundenlohn} €`);
  lines.push('', '=== Umsatz der letzten Monate (erledigte Aufträge) ===');
  for (let i = 5; i >= 0; i--) { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i); const m = monatsDaten(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`);
    lines.push(`${monthLabel(m.mk)}: ${Math.round(m.umsatz)} € aus ${m.n} Aufträgen${m.n ? `, Gewinn/Std. ca. ${Math.round(m.lohn)} €, Ø Score ${scoreFmt(round05(m.score))}` : ''}`); }
  const pg = prognose(monthKey(heute)); if (pg) lines.push(`Prognose ${monthLabel(monthKey(heute))}: ${Math.round(pg.tempo ?? pg.basis)} € (davon ${Math.round(pg.sicher)} € erledigt, ${Math.round(pg.gebucht)} € gebucht)`);
  lines.push(`Kunden gesamt: ${db.kunden.length}, Aufträge gesamt: ${db.auftraege.filter(a => a.status !== 'abgesagt').length}`);
  const kan = {}; for (const a of db.auftraege) { const c = kanal(kundeById(a.kundeId)?.kanal)[1]; kan[c] = (kan[c] || 0) + 1; }
  lines.push(`Herkunft der Anfragen: ${Object.entries(kan).map(([k, v]) => k + ' ' + v).join(', ') || '–'}`);
  const recent = db.auftraege.filter(a => a.datum && a.datum >= todayIso(-45) && a.status !== 'abgesagt').sort(byDateAsc);
  if (recent.length) lines.push('', '=== Aufträge letzte 45 Tage und kommende (ohne Namen) ===', ...recent.slice(-25).map(a => `${a.datum} ${a.zeit || ''}; ${statusLabel(a.status)}; ${paketOf(a).name}; ${a.fahrzeug || (KLASSEN.find(k => k[0] === a.klasse) || [])[1]}; Extras: ${(a.extras || []).map(id => s.extras.find(e => e.id === id)?.name).join('+') || '-'}; ${num(a.km) || 0} km; ${preis(a)} €; Score ${scoreFmt(score(a))}`));
  const lk = naechsteLuecken(10, 5); if (lk.length) lines.push('', 'Nächste freie Zeiten: ' + lk.map(x => `${fmtDate(x.s)} ${fromMin(x.l[0])}–${fromMin(x.l[1])}`).join('; '));
  const soc = PLATTFORMEN.map(p => { const x = db.social.filter(z => z.plattform === p[0]).sort((a, b) => b.datum.localeCompare(a.datum))[0]; return x ? `${p[1]}: ${x.follower ?? '?'} Follower, ${x.likes ?? '?'} Likes (Stand ${x.datum})` : null; }).filter(Boolean);
  if (soc.length) lines.push('', '=== Social Media ===', ...soc);
  const vids = [...db.videos].sort((a, b) => (b.aufrufe || 0) - (a.aufrufe || 0)).slice(0, 8);
  if (vids.length) lines.push(...vids.map(v => `Video (${v.plattform}) „${v.titel}“: ${v.aufrufe ?? '?'} Aufrufe, ${v.likes ?? '?'} Likes, ${v.kommentare ?? '?'} Kommentare, ${videoStats(v).anfragen} Anfragen`));
  lines.push('', `Heute ist ${fmtDate(heute, true)}.`);
  return lines.join('\n');
}
const KI_IDEEN = ['Wie lief mein Monat und was soll ich verbessern?', 'Gib mir 3 Video-Ideen für diese Woche', 'Schreib eine Antwort auf eine Kundenanfrage', 'Welchen Preis für einen stark verschmutzten SUV?', 'Wie bekomme ich mehr Follower aus meinen Aufrufen?'];
function openAssistent(){
  const s = S();
  openSheet(sheetHead('✦ Assistent') + `
  <p class="muted small" style="margin-top:0">Frag einfach. Dein Profil, deine Preise, Umsätze, Termine und Social-Zahlen gehen automatisch mit, ohne Kundennamen.</p>
  <textarea id="kiFrage" placeholder="Deine Frage …" style="min-height:96px"></textarea>
  <div class="chips" style="margin-top:8px">${KI_IDEEN.map(q => `<button class="chip" data-act="kiIdee">${esc(q)}</button>`).join('')}</div>
  <div class="btns"><button class="btn pri" data-act="kiProjekt" style="flex:2">Im 92-Projekt fragen</button><button class="btn" data-act="kiNeu">Neuer Chat</button></div>
  <p class="muted small">Kopiert Frage und Zahlen und öffnet Claude. Dort nur noch einfügen und senden. Kostenlos mit deinem Claude-Konto.</p>
  ${s.apiKey ? `<div class="btns"><button class="btn wa" data-act="kiDirekt" style="flex:1">Direkt hier antworten</button></div><div id="kiChat">${kiChatHtml()}</div>` : ''}
  <details class="card" style="margin-top:14px"><summary><b>Was der Assistent über dich weiß</b> <span class="muted small">(antippen zum Bearbeiten)</span></summary>
    <textarea data-set="profil" style="min-height:260px;margin-top:10px;font-size:15px">${esc(s.profil)}</textarea>
    <div class="meta">Ergänze hier deine Reiniger, Geräte, deine Geschichte. Wird automatisch gespeichert.</div></details>
  <details class="card"><summary><b>Antworten direkt in der App</b> <span class="muted small">(optional, kostet Cent)</span></summary>
    <div class="meta" style="margin:8px 0">Mit einem eigenen Claude-API-Schlüssel (console.anthropic.com, Prepaid ab 5 $) antwortet der Assistent direkt hier. Eine Frage kostet etwa 1 bis 3 Cent. Der Schlüssel bleibt nur auf diesem Handy.</div>
    <input data-set="apiKey" type="password" value="${esc(s.apiKey)}" placeholder="sk-ant-…" autocomplete="off">
    ${s.apiKey ? '<div class="btns"><button class="btn sm" data-act="kiReset">Chatverlauf leeren</button></div>' : ''}</details>`);
}
function kiChatHtml(){
  return db.chat.slice(-12).map(m => `<div class="msg ${m.role}">${m.role === 'assistant' ? mdLite(m.content) : esc(m.content)}</div>`).join('');
}
function mdLite(t){
  return esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/^#{1,4}\s?(.+)$/gm, '<b>$1</b>').replace(/^[-*] /gm, '• ').replace(/\n/g, '<br>');
}
function kiFragenExtern(ziel){
  const q = ($('#kiFrage')?.value || '').trim();
  const text = `${q || 'Was sollte ich diese Woche für 92 Aufbereitung als Nächstes tun?'}\n\n--- Aktuelle Daten aus meiner 92 App ---\n${kiKontext()}`;
  copy(text);
  toast('Kopiert · in Claude einfügen und senden');
  const url = ziel === 'projekt' ? (S().assistentLink || 'https://claude.ai/new') : 'https://claude.ai/new?q=' + encodeURIComponent(text.slice(0, 6000));
  openUrl(url);
}
async function kiDirekt(){
  const q = ($('#kiFrage')?.value || '').trim(); if (!q) return toast('Erst eine Frage eingeben');
  db.chat.push({role: 'user', content: q}); $('#kiFrage').value = '';
  const box = $('#kiChat'); box.innerHTML = kiChatHtml() + '<div class="msg assistant" id="kiOut">…</div>';
  const out = $('#kiOut'); out.scrollIntoView({block: 'end', behavior: 'smooth'});
  const msgs = db.chat.slice(-12).map(m => ({role: m.role, content: m.content}));
  while (msgs.length && msgs[0].role !== 'user') msgs.shift();
  let txt = '', stop = null;
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {method: 'POST', headers: {
      'content-type': 'application/json', 'x-api-key': S().apiKey, 'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true', 'anthropic-beta': 'server-side-fallback-2026-07-01'},
      body: JSON.stringify({model: 'claude-opus-5-5', max_tokens: 8000, stream: true, output_config: {effort: 'low'}, fallbacks: 'default',
        system: 'Du bist der persönliche Business-Assistent von Efekan für sein Unternehmen 92 Aufbereitung. Antworte auf Deutsch, per du, ehrlich, direkt und praxisnah, kurz und auf dem Handy gut lesbar. Nutze die Daten unten. Wenn Daten fehlen, sag das kurz.\n\n' + kiKontext(),
        messages: msgs})});
    if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error?.message || ('Fehler ' + r.status)); }
    const rd = r.body.getReader(), dec = new TextDecoder(); let buf = '';
    for (;;) { const {done, value} = await rd.read(); if (done) break; buf += dec.decode(value, {stream: true});
      let i; while ((i = buf.indexOf('\n\n')) >= 0) { const chunk = buf.slice(0, i); buf = buf.slice(i + 2);
        const line = chunk.split('\n').find(l => l.startsWith('data: ')); if (!line) continue;
        let ev; try { ev = JSON.parse(line.slice(6)); } catch(_) { continue; }
        if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta') { txt += ev.delta.text; out.innerHTML = mdLite(txt); }
        if (ev.type === 'message_delta' && ev.delta?.stop_reason) stop = ev.delta.stop_reason;
        if (ev.type === 'error') throw new Error(ev.error?.message || 'Fehler'); } }
    if (stop === 'refusal' && !txt) txt = 'Dazu kann ich leider nichts sagen.';
    db.chat.push({role: 'assistant', content: txt || '(keine Antwort)'}); if (db.chat.length > 40) db.chat = db.chat.slice(-40); save();
  } catch(e) { out.innerHTML = `<span class="red">${esc(e.message || 'Keine Verbindung')}</span>`; db.chat.pop(); }
}

/* =========================================================================
   EINSTELLUNGEN & SICHERUNG
   ========================================================================= */
function openSettings(){
  const s = S();
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const notifState = !('Notification' in window) ? 'nicht unterstützt' : Notification.permission === 'granted' && s.notif ? 'an' : Notification.permission === 'denied' ? 'blockiert (in den Handy-Einstellungen erlauben)' : 'aus';
  openSheet(sheetHead('Einstellungen') + `
  ${standalone ? '' : `<div class="card glow"><b>Auf den Home-Bildschirm</b><div class="meta"><b>iPhone (Safari):</b> Teilen ↑ → „Zum Home-Bildschirm“.<br><b>Android (Chrome):</b> Menü ⋮ → „App installieren“.</div>${deferredPrompt ? '<div class="btns"><button class="btn pri" data-act="install">Jetzt installieren</button></div>' : ''}</div>`}
  <div class="label">Allgemein</div>
  <label class="f"><span>Dein Name (für die Begrüßung)</span><input data-set="name" value="${esc(s.name)}"></label>
  <div class="muted small" style="margin-bottom:6px">Anrede in Nachrichten an Kunden</div>
  <div class="seg"><button data-act="anrede" data-v="du" class="${s.anrede !== 'sie' ? 'on' : ''}">du</button><button data-act="anrede" data-v="sie" class="${s.anrede === 'sie' ? 'on' : ''}">Sie</button></div>
  <label class="f" style="margin-top:12px"><span>Google-Bewertungslink (kommt in die Bewertungsanfrage)</span><input data-set="googleReview" value="${esc(s.googleReview)}" placeholder="https://g.page/r/…" autocapitalize="off"></label>
  <div class="label">Arbeitszeiten (Obi)</div>
  <div class="card small"><div class="card-h"><span>Schichtplan für freie Lücken nutzen</span><button class="btn sm ${s.schicht.aktiv ? 'pri' : ''}" data-act="schichtToggle">${s.schicht.aktiv ? 'An' : 'Aus'}</button></div>
  ${s.schicht.aktiv ? `<div class="muted" style="margin:6px 0">Wechsel jede Woche. Diese Woche: <b class="cyan">${schichtFuer(todayIso())?.typ === 'spaet' ? 'Spätschicht' : 'Frühschicht'}</b> · Freitag und Sonntag frei.</div>
  <div class="row"><span>Früh Mo–Do</span><input class="inline-num" style="width:130px!important" data-sch="frueh.wd" value="${esc(s.schicht.frueh.wd)}"></div>
  <div class="row"><span>Früh Samstag</span><input class="inline-num" style="width:130px!important" data-sch="frueh.sa" value="${esc(s.schicht.frueh.sa)}"></div>
  <div class="row"><span>Spät Mo–Do</span><input class="inline-num" style="width:130px!important" data-sch="spaet.wd" value="${esc(s.schicht.spaet.wd)}"></div>
  <div class="row"><span>Spät Samstag</span><input class="inline-num" style="width:130px!important" data-sch="spaet.sa" value="${esc(s.schicht.spaet.sa)}"></div>
  <div class="btns"><button class="btn sm" data-act="schichtTausch">Diese Woche ist eigentlich ${schichtFuer(todayIso())?.typ === 'spaet' ? 'Früh' : 'Spät'}</button></div>
  <div class="row"><span>Frühester Start</span><input class="inline-num" type="time" data-set="slotStart" value="${esc(s.slotStart)}"></div>
  <div class="row"><span>Puffer vor/nach Schicht (Min.)</span><input class="inline-num" type="number" data-set="puffer" value="${esc(s.puffer)}"></div>
  <div class="row"><span>Lücke mindestens (Std.)</span><input class="inline-num" type="number" step="0.5" data-set="minStd" value="${esc(s.minStd)}"></div>
  <div class="row"><span>Licht nach Sonnenuntergang (Min.)</span><input class="inline-num" type="number" data-set="lichtNach" value="${esc(s.lichtNach)}"></div>` : ''}</div>
  <div class="label">Benachrichtigungen</div>
  <div class="card small"><div class="card-h"><span>Termin-Hinweise: <b>${notifState}</b></span></div>
  <div class="muted" style="margin-top:4px">Hinweis am Vortag, 1 Std. vor jedem Termin und ab 12 Uhr „Kunden für morgen erinnern“. Kommt, solange die App im Hintergrund noch aktiv ist. 100 % sicher: Termine zusätzlich in den iPhone-Kalender übernehmen (Knopf im Auftrag oder Kalender-Tab).</div>
  <div class="btns"><button class="btn ${s.notif ? '' : 'pri'}" data-act="notifToggle">${s.notif ? 'Ausschalten' : 'Einschalten'}</button>${s.notif ? '<button class="btn" data-act="notifTest">Test</button>' : ''}</div></div>
  <div class="label">Preise (von 92aufbereitung.de)</div>
  <div class="card"><table class="ptable"><tr><th style="text-align:left">Paket</th>${KLASSEN.map(k => `<th>${k[1].split(' ')[0]}</th>`).join('')}</tr>
    ${s.pakete.map((p, i) => `<tr><td>${esc(p.name)}</td>${KLASSEN.map(k => `<td><input type="number" inputmode="decimal" data-price="p.${i}.${k[0]}" value="${esc(p.preise[k[0]])}"></td>`).join('')}</tr>`).join('')}</table>
  ${s.extras.map((e, i) => `<div class="row"><span>${esc(e.name)}</span><input class="inline-num" type="number" inputmode="decimal" data-price="e.${i}" value="${esc(e.preis)}"></div>`).join('')}
  ${s.aufwand.map((e, i) => `<div class="row"><span>Aufwand ${esc(e.name)}</span><input class="inline-num" type="number" inputmode="decimal" data-price="a.${i}" value="${esc(e.preis)}"></div>`).join('')}
  <div class="row"><span>Anfahrt ab über … km gesamt</span><input class="inline-num" type="number" data-set="anfahrtAbKm" value="${esc(s.anfahrtAbKm)}"></div>
  <div class="row"><span>Anfahrtspauschale €</span><input class="inline-num" type="number" data-set="anfahrtPreis" value="${esc(s.anfahrtPreis)}"></div>
  <div class="btns"><button class="btn sm" data-act="preiseReset">Website-Preise wiederherstellen</button></div></div>
  <div class="label">Für Score und Bewertung</div>
  <div class="card">
  <div class="row"><span>Ziel-Stundenlohn €</span><input class="inline-num" type="number" data-set="zielStundenlohn" value="${esc(s.zielStundenlohn)}"></div>
  <div class="row"><span>Monatsziel Umsatz €</span><input class="inline-num" type="number" data-set="monatsziel" value="${esc(s.monatsziel)}"></div>
  <div class="row"><span>Fahrtkosten pro km €</span><input class="inline-num" type="number" step="0.01" data-set="kmKosten" value="${esc(s.kmKosten)}"></div>
  <div class="row"><span>Material pro Auftrag €</span><input class="inline-num" type="number" data-set="material" value="${esc(s.material)}"></div>
  <div class="row"><span>Ø Geschwindigkeit km/h</span><input class="inline-num" type="number" data-set="kmh" value="${esc(s.kmh)}"></div></div>
  <div class="label">Sicherung</div>
  <div class="card small"><div class="muted">Alle Kunden, Aufträge und Rechnungsbilder sind dauerhaft auf diesem Handy gespeichert (auch über Jahre). Damit nichts verloren geht, wenn das Handy kaputtgeht oder du wechselst: regelmäßig eine Sicherung in iCloud Drive / Google Drive speichern oder an dich selbst schicken.</div>
  <div class="meta">Letzte Sicherung: <b>${s.lastBackup ? esc(fmtDate(s.lastBackup.slice(0, 10), true)) : 'noch nie'}</b> · Speicher: <span id="storeInfo">…</span></div>
  <div class="btns"><button class="btn pri" data-act="backup">Sicherung erstellen</button><button class="btn" data-act="restore">Sicherung laden</button></div>
  <div class="btns"><button class="btn sm" data-act="csv">Aufträge als Excel (CSV)</button></div></div>
  <div class="label">Assistent</div>
  <div class="card small"><div class="muted">Profil, Projekt-Link und optionaler API-Schlüssel</div><div class="btns"><button class="btn" data-act="assistent">Assistent öffnen</button></div>
  <label class="f" style="margin-top:8px"><span>Link für „Im 92-Projekt fragen“</span><input data-set="assistentLink" value="${esc(s.assistentLink)}" autocapitalize="off"></label></div>
  <div class="label">Über</div>
  <div class="card small muted">92 App · Version ${VERSION} · ${db.kunden.length} Kunden · ${db.auftraege.length} Aufträge · ${db.files.length} Rechnungen<br>Pakete & Preise: 92aufbereitung.de</div>
  <div class="btns"><button class="btn sm danger" data-act="wipe">Alle Daten löschen</button></div>`);
  storageInfo();
}
async function storageInfo(){
  const el = $('#storeInfo'); if (!el) return;
  try {
    const p = navigator.storage?.persisted ? await navigator.storage.persisted() : false;
    const e = navigator.storage?.estimate ? await navigator.storage.estimate() : null;
    el.textContent = (e ? (e.usage / 1048576).toLocaleString('de-DE', {maximumFractionDigits: 1}) + ' MB belegt' : '') + (p ? ' · dauerhaft geschützt ✓' : ' · Schutz angefragt');
  } catch(_) { el.textContent = '–'; }
}
const blobToDataUrl = b => new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(b); });
const dataUrlToBlob = async u => (await fetch(u)).blob();
async function backup(){
  toast('Sicherung wird erstellt …');
  const files = {};
  for (const f of db.files) { const b = await Store.get('files', f.id); if (b) files[f.id] = await blobToDataUrl(b); }
  S().lastBackup = new Date().toISOString();
  const payload = JSON.stringify({app: '92app', version: VERSION, exported: S().lastBackup, data: db, files});
  const name = `92-App-Sicherung-${todayIso()}.json`;
  const file = new File([payload], name, {type: 'application/json'});
  save(true);
  if (navigator.canShare && navigator.canShare({files: [file]})) {
    try { await navigator.share({files: [file], title: '92 App Sicherung'}); toast('Sicherung geteilt ✓'); render(); return; } catch(e) { if (e.name === 'AbortError') return; }
  }
  download(name, file); toast('Sicherung gespeichert ✓'); render();
}
async function restore(file){
  try {
    const j = JSON.parse(await file.text());
    if (j.app !== '92app' || !j.data) throw 0;
    if (!confirm(`Sicherung vom ${new Date(j.exported).toLocaleDateString('de-DE')} laden? ${j.data.kunden?.length || 0} Kunden und ${j.data.auftraege?.length || 0} Aufträge. Die aktuellen Daten auf diesem Handy werden ersetzt.`)) return;
    await Store.clear('files'); urlCache.clear();
    for (const [id, u] of Object.entries(j.files || {})) await Store.put('files', id, await dataUrlToBlob(u));
    db = normalize(j.data); db.seeded = true; await save(true);
    closeSheet(); go('start'); toast('Sicherung geladen ✓');
  } catch(e) { toast('Datei ist keine gültige Sicherung'); }
}
function csv(){
  const cols = [['Datum', a => a.datum], ['Uhrzeit', a => a.zeit], ['Vorname', a => kundeById(a.kundeId)?.vorname], ['Nachname', a => kundeById(a.kundeId)?.nachname], ['Telefon', a => kundeById(a.kundeId)?.tel], ['E-Mail', a => kundeById(a.kundeId)?.email], ['Adresse', a => adresse(kundeById(a.kundeId))], ['Kanal', a => kanal(kundeById(a.kundeId)?.kanal)[1]], ['Fahrzeug', a => a.fahrzeug], ['Klasse', a => (KLASSEN.find(k => k[0] === a.klasse) || [])[1]], ['Paket', a => paketOf(a).name], ['Extras', a => (a.extras || []).map(id => S().extras.find(e => e.id === id)?.name).join(', ')], ['Aufwand €', a => num(a.aufwand) || 0], ['Strecke km', a => a.km], ['Anfahrt €', a => anfahrt(a)], ['Dauer Std.', a => dauer(a)], ['Preis €', a => preis(a)], ['Status', a => statusLabel(a.status)], ['Score', a => score(a)], ['Notiz', a => a.notiz]];
  const q = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  const n = v => typeof v === 'number' ? String(v).replace('.', ',') : v;
  const rows = [...db.auftraege].sort(byDateAsc).map(a => cols.map(c => q(n(c[1](a)))).join(';'));
  download(`92-Auftraege-${todayIso()}.csv`, '﻿' + [cols.map(c => q(c[0])).join(';'), ...rows].join('\r\n'), 'text/csv');
}

/* =========================================================================
   EVENTS
   ========================================================================= */
let pickTarget = null;
const ACTIONS = {
  settings: () => openSettings(),
  assistent: () => openAssistent(),
  kiIdee: el => { const t = $('#kiFrage'); t.value = el.textContent; t.focus(); },
  kiProjekt: () => kiFragenExtern('projekt'),
  kiNeu: () => kiFragenExtern('neu'),
  kiDirekt: () => kiDirekt(),
  kiReset: () => { db.chat = []; save(); const c = $('#kiChat'); if (c) c.innerHTML = ''; },
  goUmsatz: () => { uJahr = todayIso().slice(0, 4); uMonat = monthKey(todayIso()); go('umsatz'); },
  bewertung: el => { const a = auftragById(el.dataset.id), k = kundeById(a.kundeId); sendText(k, msgDanke(a, k)); a.bewertung = new Date().toISOString(); save(); setTimeout(render, 400); },
  slotTermin: el => openAuftrag(null, {preset: {datum: el.dataset.v, zeit: el.dataset.t}}),
  schnellAngebot: () => openAuftrag(null, {title: 'Angebot erstellen', angebot: true}),
  freiTag: el => { const s = el.dataset.v, sc = S().schicht; sc.frei = sc.frei || {};
    if (sc.frei[s]) { delete sc.frei[s]; toast('Schicht wieder eingetragen'); } else { sc.frei[s] = true; toast(`${s === todayIso() ? 'Heute' : fmtDate(s)} frei, Zeit ist jetzt verfügbar`); }
    for (const k of Object.keys(sc.frei)) if (k < todayIso(-60)) delete sc.frei[k];
    save(); go(null, true); },
  schichtToggle: () => { S().schicht.aktiv = !S().schicht.aktiv; save(); openSettings(); },
  schichtTausch: () => { const sc = S().schicht; sc.refTyp = sc.refTyp === 'frueh' ? 'spaet' : 'frueh'; save(); openSettings(); toast('Schichtplan umgedreht'); },
  setZeit: el => { const f = $('#af'); f.elements.zeit.value = el.dataset.t; readDraftForm(); updateDraftUi(); },
  dRoute: () => { const k = collectKunde(); if (!adresse(k)) return toast('Erst Adresse eintragen'); openUrl(mapsLink(k)); },
  close: () => closeSheet(),
  neuAuftrag: () => openAuftrag(null, tab === 'kalender' ? {preset: {datum: calSel}} : {}),
  nachtragen: () => openAuftrag(null, {title: 'Kunden nachtragen', preset: {status: 'bezahlt', datum: todayIso(-1)}}),
  openAuftrag: el => openAuftrag(auftragById(el.dataset.id)),
  openKunde: el => { kTab = 'info'; openKunde(el.dataset.id); },
  kTab: el => openKunde(el.dataset.id, el.dataset.v),
  editKunde: el => editKunde(el.dataset.id),
  delKunde: el => { const id = el.dataset.id; if (!confirm('Kunde mit allen Aufträgen und Rechnungen löschen?')) return;
    db.auftraege = db.auftraege.filter(a => a.kundeId !== id); for (const f of db.files.filter(f => f.kundeId === id)) Store.del('files', f.id);
    db.files = db.files.filter(f => f.kundeId !== id); db.kunden = db.kunden.filter(k => k.id !== id); save(); closeSheet(); render(); toast('Gelöscht'); },
  auftragFuerKunde: el => { const k = kundeById(el.dataset.id); openAuftrag(null, {preset: {kundeId: k.id, klasse: k.klasse || 'limo', fahrzeug: k.fahrzeug || '', stellplatz: k.stellplatz || ''}}); },
  kChat: el => { const k = kundeById(el.dataset.id); sendText(k, du() ? `Hi ${k.vorname || ''}, ` : `Guten Tag ${kName(k)}, `); },
  addRechnungKunde: el => { pickTarget = {kundeId: el.dataset.id, auftragId: $('#rechAuftrag')?.value || null, kunde: true}; $('#filePick').click(); },
  addRechnungDraft: () => { pickTarget = {draft: true}; $('#filePick').click(); },
  viewFile: async el => { const u = await fileUrl(el.dataset.id); if (!u) return;
    const meta = db.files.find(f => f.id === el.dataset.id);
    const v = document.createElement('div'); v.className = 'img-view';
    v.innerHTML = `<img src="${u}" alt="Rechnung"><div class="btns"><button class="btn" data-x="close">Schließen</button><button class="btn" data-x="share">Teilen</button><button class="btn danger" data-x="del">Löschen</button></div>`;
    v.onclick = async e => { const x = e.target.dataset.x;
      if (x === 'close') v.remove();
      if (x === 'share') { const b = await Store.get('files', meta.id); const f = new File([b], 'Rechnung.jpg', {type: b.type}); if (navigator.canShare?.({files: [f]})) navigator.share({files: [f]}).catch(() => {}); else download('Rechnung.jpg', b); }
      if (x === 'del' && confirm('Rechnungsbild löschen?')) { db.files = db.files.filter(f => f.id !== meta.id); Store.del('files', meta.id); save(); v.remove(); if (draft) renderDraftThumbs(); else if (meta.kundeId) openKunde(meta.kundeId, 'rechnungen'); }
    };
    document.body.appendChild(v); },
  reminders: () => openReminders(),
  remSend: el => { const a = auftragById(el.dataset.id), k = kundeById(a.kundeId); sendText(k, msgErinnerung(a, k)); a.erinnert = new Date().toISOString(); if (a.status === 'anfrage') a.status = 'bestaetigt'; save(); setTimeout(() => { openReminders(); render(); }, 400); },
  calDay: el => { calSel = el.dataset.v; const d = dLocal(calSel); if (d.getMonth() !== calM) { calM = d.getMonth(); calY = d.getFullYear(); } go(null, true); },
  calPrev: () => { calM--; if (calM < 0) { calM = 11; calY--; } go(null, true); },
  calNext: () => { calM++; if (calM > 11) { calM = 0; calY++; } go(null, true); },
  today: () => { const d = new Date(); calY = d.getFullYear(); calM = d.getMonth(); calSel = todayIso(); go(null, true); },
  neuAmTag: () => openAuftrag(null, {preset: {datum: calSel, status: calSel < todayIso() ? 'bezahlt' : 'anfrage'}}),
  icsAll: () => { const evs = db.auftraege.filter(a => a.datum && a.datum >= todayIso() && OFFEN_STATUS.has(a.status)).map(icsEvent); if (!evs.length) return toast('Keine kommenden Termine'); download('92-Termine.ics', icsWrap(evs), 'text/calendar'); },
  kJahr: el => { kJahr = el.dataset.v; kMonat = 'alle'; go(null, true); },
  kMonat: el => { kMonat = el.dataset.v; go(null, true); },
  uJahr: el => { uJahr = el.dataset.v; go(null, true); },
  uMonat: el => { uMonat = el.dataset.v; go(null, true); },
  sTab: el => { sTab = el.dataset.v; go(null, true); },
  sMetric: el => { sMetric = el.dataset.v; go(null, true); },
  neuSnap: () => openSnap(null), editSnap: el => openSnap(db.social.find(s => s.id === el.dataset.id)),
  delSnap: el => { db.social = db.social.filter(s => s.id !== el.dataset.id); save(); closeSheet(); render(); },
  neuVideo: () => openVideo(null), editVideo: el => openVideo(db.videos.find(v => v.id === el.dataset.id)),
  delVideo: el => { if (!confirm('Video löschen?')) return; db.videos = db.videos.filter(v => v.id !== el.dataset.id); db.auftraege.forEach(a => { if (a.videoId === el.dataset.id) a.videoId = ''; }); save(); closeSheet(); render(); },
  claudeMonat: () => { copy(claudePrompt('monat')); toast('Kopiert · bei Claude einfügen'); openUrl(S().assistentLink || 'https://claude.ai/new'); },
  claudeSocial: () => { copy(claudePrompt('social')); toast('Kopiert · bei Claude einfügen'); openUrl(S().assistentLink || 'https://claude.ai/new'); },
  // Auftrag-Formular
  dKlasse: el => { readDraftForm(); draft.klasse = el.dataset.v; $$('#klasseSeg button').forEach(b => b.classList.toggle('on', b === el)); $('#pkList').innerHTML = pkListHtml(); updateDraftUi(); },
  dPaket: el => { readDraftForm(); draft.paket = el.dataset.v; $$('#pkList .pk').forEach(b => b.classList.toggle('on', b === el)); updateDraftUi(); },
  dAufwand: el => { readDraftForm(); draft.aufwand = Number(el.dataset.v); $$('#aufChips .chip').forEach(b => b.classList.toggle('on', b === el)); updateDraftUi(); },
  kundeWaehlen: el => { const k = kundeById(el.dataset.id); draft.kundeId = k.id; const f = $('#af');
    for (const key of ['vorname', 'nachname', 'tel', 'email', 'strasse', 'plz', 'ort', 'kanal', 'handle']) f.elements[key].value = k[key] || '';
    if (k.fahrzeug && !f.elements.fahrzeug.value) f.elements.fahrzeug.value = k.fahrzeug;
    if (k.stellplatz && !f.elements.stellplatz.value) f.elements.stellplatz.value = k.stellplatz;
    if (k.klasse) { draft.klasse = k.klasse; $$('#klasseSeg button').forEach(b => b.classList.toggle('on', b.dataset.v === k.klasse)); $('#pkList').innerHTML = pkListHtml(); }
    $('#kHits').innerHTML = ''; $('#kSearch').value = '';
    $('#kChosen').innerHTML = `Bestehender Kunde: <b class="cyan">${esc(kName(k))}</b> · <a href="#" data-act="kundeLoesen">als neuen Kunden anlegen</a>`;
    readDraftForm(); updateDraftUi(); },
  kundeLoesen: () => { draft.kundeId = null; $('#kChosen').textContent = 'Neuer Kunde · oder oben suchen'; },
  dSend: el => { readDraftForm(); const k = Object.assign({}, kundeById(draft.kundeId) || {}, collectKunde());
    const t = {angebot: msgAngebot, best: msgBestaetigung, erin: msgErinnerung, danke: msgDanke}[el.dataset.k](draft, k);
    if ((el.dataset.k === 'best' || el.dataset.k === 'erin') && !draft.datum) return toast('Erst Datum eintragen');
    sendText(k, t);
    const setSt = st => { draft.status = st; $('#af').elements.status.value = st; setTimeout(() => toast('Status: ' + statusLabel(st) + ' · Speichern nicht vergessen'), 1200); };
    if (el.dataset.k === 'angebot' && draft.status === 'anfrage') setSt('angebot');
    if (el.dataset.k === 'best' && (draft.status === 'anfrage' || draft.status === 'angebot')) setSt('bestaetigt');
    if (el.dataset.k === 'danke') draft.bewertung = new Date().toISOString();
    if (el.dataset.k === 'erin') draft.erinnert = new Date().toISOString(); },
  dIcs: () => { readDraftForm(); if (!draft.datum) return toast('Erst Datum eintragen'); const k = collectKunde(); const tmp = kundeById(draft.kundeId); if (!tmp) { draft._k = k; }
    const ev = icsEvent(draft); download(`92-Termin-${draft.datum}.ics`, icsWrap([ev]), 'text/calendar'); },
  dGcal: () => { readDraftForm(); if (!draft.datum) return toast('Erst Datum eintragen'); openUrl(gcalLink(draft)); },
  dDup: () => { const a = draft; closeSheet(); setTimeout(() => openAuftrag(null, {preset: {kundeId: a.kundeId, klasse: a.klasse, paket: a.paket, fahrzeug: a.fahrzeug, stellplatz: a.stellplatz}}), 280); },
  dDel: () => { if (!confirm('Auftrag löschen?')) return; const id = draft.id; db.auftraege = db.auftraege.filter(a => a.id !== id);
    for (const f of db.files.filter(f => f.auftragId === id)) f.auftragId = null; save(); closeSheet(); render(); toast('Gelöscht'); },
  // Einstellungen
  anrede: el => { S().anrede = el.dataset.v; save(); $$('#sheet .seg button[data-act=anrede]').forEach(b => b.classList.toggle('on', b === el)); },
  notifToggle: async () => {
    if (S().notif) { S().notif = false; save(); return openSettings(); }
    if (!('Notification' in window)) return toast('Auf diesem Gerät nicht möglich');
    const p = await Notification.requestPermission();
    if (p === 'granted') { S().notif = true; save(); toast('Benachrichtigungen an ✓'); checkNotifs(); } else toast('Nicht erlaubt');
    openSettings(); },
  notifTest: () => notify('92 App', 'So sehen deine Termin-Hinweise aus 🚗✨', 'test'),
  preiseReset: () => { if (!confirm('Preise auf die Website-Preise zurücksetzen?')) return; const d = structuredClone(DEFAULT_SETTINGS); Object.assign(S(), {pakete: d.pakete, extras: d.extras, aufwand: d.aufwand, anfahrtAbKm: d.anfahrtAbKm, anfahrtPreis: d.anfahrtPreis}); save(); openSettings(); toast('Zurückgesetzt'); },
  backup: () => backup(),
  restore: () => { pickTarget = {restore: true}; const fp = $('#filePick'); fp.accept = 'application/json,.json'; fp.multiple = false; fp.click(); },
  csv: () => csv(),
  install: () => deferredPrompt && deferredPrompt.prompt(),
  wipe: async () => { if (!confirm('Wirklich ALLE Kunden, Aufträge und Rechnungen löschen?') || !confirm('Sicher? Das kann nicht rückgängig gemacht werden.')) return;
    await Store.clear('files'); db = emptyDb(); db.seeded = true; await save(true); closeSheet(); go('start'); toast('Alles gelöscht'); }
};
document.addEventListener('click', e => {
  const link = e.target.closest('a[href]');
  if (link && !link.dataset.act) return;
  const el = e.target.closest('[data-act]');
  if (el) { const f = ACTIONS[el.dataset.act]; if (f) { if (el.tagName === 'A' && el.getAttribute('href') === '#') e.preventDefault(); if (el.tagName !== 'INPUT' && el.tagName !== 'SELECT') { e.preventDefault(); f(el, e); } } return; }
  const nb = e.target.closest('#nav button'); if (nb) { haptic(); go(nb.dataset.tab); }
});
$('#sheetBg').addEventListener('click', closeSheet);
document.addEventListener('keydown', e => { if (e.key === 'Escape') { const iv = $('.img-view'); if (iv) iv.remove(); else closeSheet(); } });

let inputTimer = null;
document.addEventListener('input', e => {
  const el = e.target;
  if (el.dataset.inp === 'kSuche') { kSuche = el.value; clearTimeout(inputTimer); inputTimer = setTimeout(() => {
    // nur die Liste neu zeichnen, damit die Tastatur offen bleibt
    const all = kundenStats(); const q = kSuche.toLowerCase().trim();
    const list = all.filter(x => (kJahr === 'alle' || [...x.months].some(m => m.startsWith(kJahr))) && (kMonat === 'alle' || x.months.has(kMonat)) && (!q || [x.k.vorname, x.k.nachname, x.k.tel, x.k.email, x.k.ort, x.k.plz, x.k.strasse, x.k.fahrzeug, x.k.handle].join(' ').toLowerCase().includes(q)));
    list.sort((a, b) => (b.last || '').localeCompare(a.last || ''));
    $('#kList').innerHTML = kundenListHtml(list); }, 80); }
});
document.addEventListener('change', e => {
  const el = e.target;
  if (el.dataset.inp === 'kSort') { kSort = el.value; render(); }
  if (el.dataset.set) { const v = el.type === 'number' ? num(el.value) ?? 0 : el.value; S()[el.dataset.set] = v; save(); if (el.dataset.set !== 'profil') toast('Gespeichert'); if (el.dataset.set === 'apiKey' && $('#kiFrage')) openAssistent(); }
  if (el.dataset.sch) { const [t, k] = el.dataset.sch.split('.'); const v = el.value.replace(/\s/g, '').replace(/–/g, '-'); if (!/^\d{1,2}:\d{2}-\d{1,2}:\d{2}$/.test(v) && v !== '') return toast('Format: 08:00-17:00'); S().schicht[t][k] = v; save(); toast('Gespeichert'); }
  if (el.dataset.price) { const p = el.dataset.price.split('.'), n = num(el.value) || 0, s = S();
    if (p[0] === 'p') s.pakete[+p[1]].preise[p[2]] = n; else if (p[0] === 'e') s.extras[+p[1]].preis = n; else if (p[0] === 'a') s.aufwand[+p[1]].preis = n;
    save(); toast('Preis gespeichert'); }
});
$('#filePick').addEventListener('change', async e => {
  const fp = e.target, files = [...fp.files]; fp.value = '';
  const t = pickTarget; pickTarget = null; fp.accept = 'image/*'; fp.multiple = true;
  if (!files.length || !t) return;
  if (t.restore) return restore(files[0]);
  toast('Wird gespeichert …');
  if (t.draft && draft) { const add = await addFiles(files, draft.kundeId, draft.id); draftFiles.push(...add); renderDraftThumbs(); toast('Rechnung hinzugefügt ✓'); return; }
  if (t.kunde) { await addFiles(files, t.kundeId, t.auftragId); openKunde(t.kundeId, 'rechnungen'); toast('Rechnung hinzugefügt ✓'); }
});

/* Wischen zum Schließen des Sheets */
(() => {
  const s = $('#sheet'); let y0 = null, dy = 0;
  s.addEventListener('touchstart', e => { y0 = s.scrollTop <= 0 ? e.touches[0].clientY : null; dy = 0; }, {passive: true});
  s.addEventListener('touchmove', e => { if (y0 == null) return; dy = e.touches[0].clientY - y0; if (dy > 0) { s.style.transition = 'none'; s.style.transform = `translate3d(0,${dy}px,0)`; } }, {passive: true});
  s.addEventListener('touchend', () => { if (y0 == null) return; s.style.transition = ''; s.style.transform = ''; if (dy > 110) closeSheet(); y0 = null; });
})();

/* iOS: :active-Zustände aktivieren */
document.addEventListener('touchstart', () => {}, {passive: true});

/* ---------------- PWA ---------------- */
let deferredPrompt = null;
addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredPrompt = e; });
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
document.addEventListener('visibilitychange', () => { if (!document.hidden) { checkNotifs(); if (!$('#sheet').classList.contains('open')) render(); } });
setInterval(checkNotifs, 60e3);

/* ---------------- Start ---------------- */
(async function init(){
  try { await Store.open(); db = normalize(await Store.get('kv', 'data')); }
  catch(e) { db = normalize(null); toast('Speicher nicht verfügbar'); }
  seed(); save();
  try { if (navigator.storage?.persist) navigator.storage.persist(); } catch(_) {}
  go('start');
  const sp = $('#splash'), wait = Math.max(0, 650 - performance.now());
  setTimeout(() => { sp.classList.add('hide'); setTimeout(() => sp.remove(), 400); }, wait);
  checkNotifs();
  ladeWetter();
})();
