/* Event Materials Catalogue – app logic (no build step, no dependencies) */
(() => {
  "use strict";
  const CFG = window.CATALOGUE_CONFIG || {};
  const LIVE = !!(CFG.apiUrl && CFG.apiUrl.trim());
  const DEMO_KEY = "emc-demo-v1";

  // ───────────────────────── state ─────────────────────────
  const S = {
    banners: [], events: [], bookings: [], movements: [],
    view: "catalogue",
    planEvent: "", draft: {}, dirty: false,
    cat: "banners",
    f: { q: "", chip: "all", sel: {}, section: "all", action: false, group: "section" },
    lbList: [], lbIndex: 0,
    whEvent: "", packed: new Set(),
    reportTab: "stock", auditLoc: "all",
    ideas: [], ideaDraft: null, ideaFilter: "open",
    showNewEvent: false, evTab: "upcoming", evType: "all",
  };

  const CATS = {
    banners: { label: "Roll-up banners", unit: "designs", chipKey: "stored_at", chipAll: "All locations",
      selects: [["language", "Language"], ["brand", "Brand"], ["banner_type", "Type"]] },
    backlit: { label: "Backlit banners", unit: "designs", chipKey: "stored_at", chipAll: "All locations",
      selects: [["language", "Language"], ["brand", "Brand"], ["banner_type", "Type"]] },
    large: { label: "Large banners", unit: "designs", chipKey: "stored_at", chipAll: "All locations",
      selects: [["language", "Language"], ["brand", "Brand"], ["banner_type", "Type"]] },
    posters: { label: "Posters", unit: "posters", chipKey: "format", chipAll: "All sizes",
      selects: [["language", "Language"], ["brand", "Brand"], ["region", "Market"]] },
    misc: { label: "Stands & extras", unit: "items", chipKey: "section", chipAll: "All",
      selects: [["brand", "Brand"]] },
    brochures: { label: "Brochures & flyers", unit: "items", chipKey: "language", chipAll: "All languages",
      selects: [["brand", "Brand"], ["format", "Format"]] },
    digital: { label: "Digital assets", unit: "assets", chipKey: "section", chipAll: "All types",
      selects: [["brand", "Brand"]] },
    clinical: { label: "Clinical handouts & guides", unit: "items", chipKey: "test_area", chipAll: "All tests",
      selects: [["language", "Language"], ["brand", "Brand"], ["format", "Format"]] },
    pricelists: { label: "Price lists", unit: "price lists", chipKey: "currency", chipAll: "All currencies",
      selects: [["language", "Language"], ["region", "Country"], ["brand", "Brand"]] },
    templates: { label: "Made for each event", unit: "types", chipKey: "section", chipAll: "All",
      selects: [["brand", "Brand"]] },
    pastevents: { label: "From past events", unit: "items", chipKey: "kind", chipAll: "All kinds",
      selects: [["brand", "Brand"], ["currency", "Currency"], ["format", "Size"]] },
    offers: { label: "Special offer forms", unit: "forms", chipKey: "currency", chipAll: "All currencies",
      selects: [["region", "Country / VAT"], ["brand", "Brand"], ["format", "Format"]] },
  };
  const resetFilters = () => { S.f = { q: "", chip: "all", sel: {}, section: "all", action: false, group: "section" }; };

  // ───────────────────────── helpers ───────────────────────
  const $ = (sel, el = document) => el.querySelector(sel);
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const num = (v) => { const n = Number(String(v ?? "").trim()); return Number.isFinite(n) ? n : 0; };
  const uniq = (arr) => [...new Set(arr.filter((x) => x !== "" && x != null))];
  const byId = (id) => S.banners.find((b) => b.banner_id === id);
  const evById = (id) => S.events.find((e) => e.event_id === id);
  const today = () => new Date().toISOString().slice(0, 10);
  const fmtDate = (d) => { if (!d) return ""; const x = new Date(d + "T00:00:00"); return isNaN(x) ? d : x.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }); };
  const imgSrc = (b) => (b && b.thumbnail ? b.thumbnail : "");

  function parseCSV(text) {
    const rows = []; let row = [], field = "", q = false;
    text = text.replace(/^﻿/, "");
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
        else field += c;
      } else if (c === '"') q = true;
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(field); rows.push(row); row = []; field = "";
      } else field += c;
    }
    if (field !== "" || row.length) { row.push(field); rows.push(row); }
    const head = (rows.shift() || []).map((h) => h.trim());
    return rows.filter((r) => r.some((v) => v.trim() !== ""))
      .map((r) => Object.fromEntries(head.map((h, j) => [h, (r[j] ?? "").trim()])));
  }
  function toCSV(rows, cols) {
    const q = (v) => { const s = String(v ?? ""); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    return [cols.join(","), ...rows.map((r) => cols.map((c) => q(r[c])).join(","))].join("\r\n");
  }
  function download(name, text) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + text], { type: "text/csv;charset=utf-8" }));
    a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  let toastT;
  function toast(msg, err = false) {
    const t = $("#toast"); t.textContent = msg; t.className = "toast show" + (err ? " err" : "");
    clearTimeout(toastT); toastT = setTimeout(() => (t.className = "toast"), 2600);
  }
  function who() {
    let n = ""; try { n = localStorage.getItem("emc-user") || ""; } catch (e) {}
    if (!n) { n = (window.prompt("Your name (shown in the activity log):") || "").trim() || "Unknown"; try { localStorage.setItem("emc-user", n); } catch (e) {} }
    return n;
  }
  const thumbHTML = (b, cls = "") => {
    const src = imgSrc(b);
    return src
      ? `<img class="${cls}" src="${esc(src)}" alt="${esc(b.name)}" loading="lazy" data-zoom="${esc(b.banner_id)}">`
      : `<div class="mini-ph ${cls}" data-zoom="${esc(b?.banner_id || "")}"></div>`;
  };

  // ───────────────────────── data layer ─────────────────────
  // Browser storage can be blocked (e.g. inside the preview frame), so keep a copy in memory as well.
  let MEM_STORE = null;
  function demoStore() {
    if (MEM_STORE) return JSON.parse(JSON.stringify(MEM_STORE));
    try { return JSON.parse(localStorage.getItem(DEMO_KEY)) || {}; } catch (e) { return {}; }
  }
  function saveDemo(st) { MEM_STORE = JSON.parse(JSON.stringify(st)); try { localStorage.setItem(DEMO_KEY, JSON.stringify(st)); } catch (e) {} }

  // A banner can sit in more than one section: a large backlit backdrop shows under Backlit AND Large.
  const catsOf = (t = "") => {
    const c = [];
    if (/backlit/i.test(t)) c.push("backlit");
    if (/backdrop|stage|large/i.test(t)) c.push("large");
    return c.length ? c : ["banners"];
  };
  const asBanner = (b) => { const cats = catsOf(b.banner_type); return { ...b, cats, category: cats[0], tracked: true }; };
  // Printed fresh for each event (special offer forms, posters): no stock count, quantity = copies to print
  const asPrint = (cat) => (o) => ({ ...o, banner_id: o.item_id, category: cat, cats: [cat], tracked: false, stored_at: "Print on demand", language: o.language || o.currency, banner_type: o.format, qty_owned: 0 });
  const asOffer = asPrint("offers"), asPoster = asPrint("posters"), asPriceList = asPrint("pricelists"), asPast = asPrint("pastevents"), asBrochure = asPrint("brochures"), asDigital = (o) => ({ ...asPrint("digital")(o), stored_at: "Digital – nothing to print" }), asClinical = (o) => { const b = asPrint("clinical")(o); if (/^y/i.test(o.design_only || "")) b.cats = []; return b; }; // dated posters: only offered as a style under "Made for each event"
  // Stands, table cloths, giveaways etc. Equipment is stock (comes back); consumables (cups, pens, bags…) are used up at the event
  const asMisc = (o) => { const cons = /^(y|yes|true|1)$/i.test(String(o.consumable || "").trim());
    return { ...o, banner_id: o.item_id, category: "misc", cats: ["misc"], tracked: !cons, consumable: cons, count_needed: String(o.qty_owned ?? "").trim() === "",
      qty_owned: num(o.qty_owned), stored_at: o.stored_at || "To confirm", language: "", banner_type: o.format || "", photo_needed: !o.thumbnail }; };
  const linkOf = (b) => (b && b.stock_item ? byId(b.stock_item) : null); // a past-event item that IS a physical item we own
  const sidesOf = (b) => S.banners.filter((x) => x.stock_item && x.stock_item === b.banner_id); // past-event entries pointing at this stock item
  const isGeneric = (b) => b && b.category === "pastevents" && /^y/i.test(String(b.generic || ""));
  const isDesign = (b) => b && ((b.category === "pastevents" && !linkOf(b) && !isGeneric(b)) || b.category === "templates" || b.category === "digital" || (b.category === "clinical" && /^y/i.test(b.design_only || "")));
  // Generic past-event items (no event named on them) are also listed with the everyday posters, offer forms and price lists
  const GENERIC_HOME = { "Test & training poster": ["posters", "Education & training"], "Brand poster": ["posters", "dnalife"],
    "Test offers sheet": ["offers", "Test offers"], "Supplements discount voucher": ["offers", "Supplement vouchers"],
    "Test price list": ["pricelists", "Test price lists"], "Supplements price list": ["pricelists", "Supplement price lists"] };
  // The front page of a special offer order form is often printed on its own as a poster to advertise the offer
  const POSTER_SUFFIX = "-POSTER";
  function addOfferPosters() {
    S.banners.filter((b) => b.category === "offers" && !b._copyOf && /2 sides|form/i.test(b.format || "") && b.section !== "Event-specific" && b.section !== "Biohackers events").forEach((b) => {
      S.banners.push({ ...b, banner_id: b.banner_id + POSTER_SUFFIX, _posterOf: b.banner_id, category: "posters", cats: ["posters"], section: "Offer posters (front of an order form)",
        name: b.name + " – front as poster", format: "A3 or A4 poster", banner_type: "A3 or A4 poster", thumbnail_2: "", pages: 1,
        notes: `The front page of ${b.banner_id} (${b.name}${b.currency ? ", " + b.currency : ""}${b.region ? ", " + b.region : ""}) printed on its own to advertise the offer. Print the full form separately for people to fill in.` });
    });
  }
  // Previews show the front page only – forms are the exception (people need to see what they fill in)
  const isForm = (b) => /\bform\b|order form|feedback|request sheet|registration/i.test(`${b.material || ""} ${b.name || ""} ${b.format || ""}`);
  const showPage2 = (b) => isForm(b) || (!["brochures", "clinical"].includes(b.category) && (b.category === "large" || b.category === "banners"));
  // From past events: versions of the same material at one event (early bird / full price / with offer, EUR / DKK,
  // Nordic Labs / dnalife) become one card with a bubble per version
  const PAST_GROUP = /^(Event poster|Test offers sheet|Event flyer \(4 pages\)|Event flyer \(A4\)|Programme overview|Agenda|Name badge|Attendance certificate|Feedback form)$/;
  function groupPastVariants() {
    const m = new Map();
    S.banners.filter((b) => b.category === "pastevents" && b.event_id && PAST_GROUP.test(b.material || "")).forEach((b) => { const k = b.event_id + "|" + b.material; if (!m.has(k)) m.set(k, []); m.get(k).push(b); });
    m.forEach((list, k) => {
      if (list.length < 2) return;
      const words = list.map((b) => String(b.name).replace(/[()]/g, " ").split(/[\s,–-]+/).filter(Boolean));
      const common = words[0].filter((w) => words.every((ws) => ws.map((x) => x.toLowerCase()).includes(w.toLowerCase())));
      if (common.length < 2 || !words[0].join(" ").toLowerCase().includes(common.join(" ").toLowerCase())) return; // different materials, not versions of one
      list.forEach((b, i) => {
        const own = words[i].filter((w) => !common.some((c) => c.toLowerCase() === w.toLowerCase())).join(" ").trim();
        const cur = b.currency && !/all/i.test(b.currency) ? b.currency : "";
        const reg = /region/i.test(b.edition || "") ? b.edition.replace(/ region/i, "") : "";
        b.edition = [own ? own[0].toUpperCase() + own.slice(1) : "Standard", reg, own.includes(cur) ? "" : cur].filter(Boolean).join(" · ") + (reg ? " region" : "");
        b.design_id = "PAST:" + k;
        b._groupName = common.join(" ").replace(/\s+/g, " ").trim() || b.material;
      });
    });
  }
  function addGenericCopies() {
    S.banners.filter((b) => isGeneric(b) && GENERIC_HOME[b.material] && !/Same poster as/.test(b.notes || "") && !linkOf(b)).forEach((b) => {
      const [cat, sec] = GENERIC_HOME[b.material];
      S.banners.push({ ...b, category: cat, cats: [cat], section: sec, _copyOf: b.banner_id, event_specific: shortEv(b.event_id),
        // vouchers that only differ by their code/date are one card, with a bubble per event they were made for
        ...(b.offer_design ? { design_id: b.offer_design, edition: (/dnalife/i.test(b.brand + " " + (b.notes || "")) || /dnalife ?vms/i.test(b.name) ? "dnalife · " : "") + (shortEv(b.event_id) || b.section) } : {}) });
    });
  }
  // "Made for each event": one card per kind of material (certificate, name badge…) – each past event's version is a style to copy
  const MATERIAL_GROUPS = [["Promotion", ["Event roll-up banner", "Event poster", "Event flyer (4 pages)", "Event flyer (A4)", "Masterclasses flyer", "Webinar / test launch poster", "Competition poster (scan to win)", "Event sign (A3)"]],
    ["Offers & prices", ["Test offers sheet", "Supplements discount voucher", "Conference discount voucher", "Test discount voucher", "Test price list", "Supplements price list"]],
    ["On the day", ["Name badge", "Attendance certificate", "Agenda", "Programme overview", "Feedback form", "Additional resources QR flyer"]]];
  const slug = (t) => String(t).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  function buildTemplates() {
    S.banners = S.banners.filter((b) => b.category !== "templates");
    const evDate = (b) => (evById(b.event_id) || {}).start_date || b.version || "";
    const order = MATERIAL_GROUPS.flatMap(([g, l]) => l.map((m) => [g, m]));
    // Old or superseded designs stay on their event's record but aren't offered as a style to copy
    const isStyle = (b) => !/^(old design|superseded)/i.test(b.status || "") && ((b.category === "pastevents" && !isGeneric(b)) || (b.category === "clinical" && /^y/i.test(b.design_only || "")));
    const mats = uniq(S.banners.filter((b) => isStyle(b) && b.material).map((b) => b.material));
    mats.sort((a, b) => (order.findIndex((x) => x[1] === a) + 1 || 99) - (order.findIndex((x) => x[1] === b) + 1 || 99));
    mats.forEach((m) => {
      const seenD = new Set();
      const styles = S.banners.filter((b) => isStyle(b) && b.material === m).sort((a, b) => evDate(b).localeCompare(evDate(a)) || ED_ORDER(a.edition) - ED_ORDER(b.edition))
        .filter((b) => { const k = b.design_id || b.banner_id; if (seenD.has(k)) return false; seenD.add(k); return true; });
      const n = styles[0];
      S.banners.push({ banner_id: "TPL-" + slug(m), name: m, material: m, category: "templates", cats: ["templates"], tracked: false,
        section: (order.find((x) => x[1] === m) || ["Other"])[0], styles: styles.map((x) => x.banner_id), brand: n.brand, language: n.language,
        format: n.format, thumbnail: n.thumbnail, thumbnail_2: isForm(n) ? n.thumbnail_2 : "", version: n.version, status: "Final", stored_at: "Made for each event", qty_owned: 0 });
    });
  }
  const shortEv = (id) => String((evById(id) || {}).event_name || "").replace(/^The /, "");
  const styleName = (x) => shortEv(x.event_id) || (x.category === "pastevents" && x.section) || x.name;
  const designLabel = (b) => (b.category === "pastevents" || b.category === "clinical") && b.material ? `${b.material} – in the style of ${styleName(b)}` : b.name;
  // Both faces of a double-sided stock item: its own picture + the other side from the linked past-event entry
  const facesOf = (b) => {
    const o = sidesOf(b).find((x) => x.thumbnail_2); if (!b.tracked || !o || !/double sided/i.test(b.name || "")) return [];
    const lab = ((b.name || "").match(/\(([^)]*\/[^)]*)\)\s*$/) || [, " / "])[1].split(" / ");
    return [{ src: imgSrc(b), label: lab[0] || "Side 1" }, { src: o.thumbnail_2, label: lab[1] || "Side 2" }];
  }; // made for an earlier event – the design team adapts it, the warehouse doesn't pick it
  const designReq = (eventId, itemId) => S.ideas.find((i) => i.event_id === eventId && String(i.related_items || "").split(/[,\s]+/).includes(itemId) && i.type === "Adapt for another event");
  const isPrint = (cat) => ["digital", "offers", "posters", "brochures", "clinical", "pricelists", "pastevents", "templates"].includes(cat);
  async function loadAll() {
    if (LIVE) {
      const r = await fetch(CFG.apiUrl + (CFG.apiUrl.includes("?") ? "&" : "?") + "action=all&t=" + Date.now());
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "Could not load the Google Sheet");
      S.banners = [...j.banners.map(asBanner), ...(j.offers || []).map(asOffer), ...(j.posters || []).map(asPoster), ...(j.pricelists || []).map(asPriceList), ...(j.pastevents || []).map(asPast), ...(j.brochures || []).map(asBrochure), ...(j.clinical || []).map(asClinical), ...(j.digital || []).map(asDigital), ...(j.misc || []).map(asMisc)]; S.kits = j.kitlists || []; S.events = j.events; S.bookings = j.bookings; S.movements = j.movements; S.ideas = j.ideas || [];
    } else {
      const [bt, et, ot, pt, lt, at, brt, mt, kt, clt, dgt] = await Promise.all([CFG.bannersCsv, CFG.eventsCsv, CFG.offersCsv || "data/offers.csv", CFG.postersCsv || "data/posters.csv", CFG.pricelistsCsv || "data/pricelists.csv", CFG.pasteventsCsv || "data/pastevents.csv", CFG.brochuresCsv || "data/brochures.csv", CFG.miscCsv || "data/misc.csv", CFG.kitlistsCsv || "data/kitlists.csv", CFG.clinicalCsv || "data/clinical.csv", CFG.digitalCsv || "data/digital.csv"].map((u) => fetch(u, { cache: "no-cache" }).then((r) => (r.ok ? r.text() : ""))));
      const st = demoStore();
      S.banners = [...parseCSV(bt).map((b) => asBanner({ ...b, ...(st.overrides?.[b.banner_id] || {}) })), ...parseCSV(ot).map(asOffer), ...parseCSV(pt).map(asPoster), ...parseCSV(lt).map(asPriceList), ...parseCSV(at).map(asPast), ...parseCSV(brt).map(asBrochure), ...parseCSV(clt).map(asClinical), ...parseCSV(dgt).map(asDigital), ...parseCSV(mt).map((o) => asMisc({ ...o, ...(st.overrides?.[o.item_id] || {}) }))];
      S.kits = parseCSV(kt);
      S.events = [...parseCSV(et), ...(st.events || []).map((e) => ({ ...e, _added: true }))];
      S.bookings = st.bookings || [];
      S.ideas = st.ideas || [];
      S.movements = st.movements || [];
    }
    S.banners.forEach((b, i) => { b.qty_owned = num(b.qty_owned); b._row = i; });
    buildTemplates(); addGenericCopies(); addOfferPosters(); groupPastVariants(); buildLastUsed();
    S.bookings.forEach((b) => { b.qty = num(b.qty); });
    S.movements.forEach((m) => { m.qty = num(m.qty); });
  }

  async function act(payload) {
    payload.by = payload.by || who();
    if (LIVE) {
      const r = await fetch(CFG.apiUrl, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload) });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "Save failed");
    } else demoApply(payload);
    await loadAll();
  }

  // Mirrors apps-script/Code.gs so demo mode behaves like the real thing
  function demoApply(p) {
    const st = demoStore();
    st.bookings = st.bookings || []; st.movements = st.movements || []; st.events = st.events || []; st.overrides = st.overrides || {};
    const now = new Date().toISOString();
    const mv = (event_id, banner_id, type, qty, note = "") => st.movements.push({ timestamp: now, event_id, banner_id, type, qty, by: p.by, note });
    const owned = (id) => num(st.overrides[id]?.qty_owned ?? byId(id)?.qty_owned);
    if (p.action === "saveBooking") {
      if (st.bookings.some((b) => b.event_id === p.event_id && b.status !== "Requested")) throw new Error("This event has already been dispatched – its list can't be changed.");
      st.bookings = st.bookings.filter((b) => b.event_id !== p.event_id);
      p.items.filter((i) => num(i.qty) > 0).forEach((i) => st.bookings.push({ event_id: p.event_id, banner_id: i.banner_id, qty: num(i.qty), day: i.day || "", status: "Requested", updated_at: now, updated_by: p.by, note: p.note || "" }));
    } else if (p.action === "dispatch") {
      st.bookings.filter((b) => b.event_id === p.event_id).forEach((b) => { b.status = "Dispatched"; b.updated_at = now; b.updated_by = p.by; mv(p.event_id, b.banner_id, "dispatch", b.qty);
        const sp = spareOf(b.banner_id, st.movements); if (sp > 0) mv(p.event_id, b.banner_id, "spare used", Math.min(sp, num(b.qty)), "Spare copies left over from an earlier event, sent first"); });
    } else if (p.action === "checkIn") {
      p.items.forEach((i) => {
        if (num(i.returned)) mv(p.event_id, i.banner_id, "return", num(i.returned), p.note);
        if (num(i.damaged)) mv(p.event_id, i.banner_id, "damaged", num(i.damaged), i.note || p.note);
        if (num(i.missing)) mv(p.event_id, i.banner_id, "missing", num(i.missing), i.note || p.note);
        const lost = num(i.damaged) + num(i.missing);
        if (lost) { const left = Math.max(0, owned(i.banner_id) - lost); st.overrides[i.banner_id] = { ...(st.overrides[i.banner_id] || {}), qty_owned: left, ...(left === 0 && num(i.damaged) ? { status: "Broken – out of stock" } : {}) }; }
        const was = st.overrides[i.banner_id]?.stored_at ?? byId(i.banner_id)?.stored_at;
        if (i.store_at && i.store_at !== was) { st.overrides[i.banner_id] = { ...(st.overrides[i.banner_id] || {}), stored_at: i.store_at }; mv(p.event_id, i.banner_id, "moved", num(i.returned), `Now stored at ${i.store_at} (was ${was || "—"})`); }
      });
      (p.leftovers || []).forEach((l) => { if (num(l.qty) > 0) mv(p.event_id, l.banner_id, "leftover", num(l.qty), l.note || "Unused – back in store"); });
      st.bookings.filter((b) => b.event_id === p.event_id).forEach((b) => { b.status = "Returned"; b.updated_at = now; b.updated_by = p.by; });
    } else if (p.action === "addEvent") {
      st.events.push(p.event);
    } else if (p.action === "setBookingDay") {
      const b = st.bookings.find((x) => x.event_id === p.event_id && x.banner_id === p.banner_id); if (!b) throw new Error("Item not on this event's list");
      if (b.status !== "Requested") throw new Error("Already dispatched – day boxes can't be changed");
      b.day = p.day || ""; b.updated_at = now; b.updated_by = p.by;
    } else if (p.action === "deleteEvent") {
      if (!st.events.some((e) => e.event_id === p.event_id)) throw new Error("Only events added here can be deleted in demo mode");
      st.events = st.events.filter((e) => e.event_id !== p.event_id);
      st.bookings = st.bookings.filter((b) => b.event_id !== p.event_id);
      st.ideas = (st.ideas || []).filter((i) => !(i.event_id === p.event_id && i.status === "New")); // design jobs not started yet go too
    } else if (p.action === "addIdea") {
      st.ideas = st.ideas || [];
      const n = st.ideas.reduce((m, x) => Math.max(m, num(String(x.idea_id).replace(/\D/g, ""))), 0) + 1;
      st.ideas.push({ ...p.idea, idea_id: "IDEA-" + String(n).padStart(3, "0"), created_at: now, by: p.by, status: "New", updated_at: now });
    } else if (p.action === "updateIdea") {
      st.ideas = st.ideas || [];
      const i = st.ideas.find((x) => x.idea_id === p.idea_id); if (!i) throw new Error("Idea not found");
      Object.assign(i, p.changes, { updated_at: now, updated_by: p.by });
    } else if (p.action === "markBroken") {
      const left = Math.max(0, owned(p.banner_id) - Math.max(1, num(p.qty)));
      st.overrides[p.banner_id] = { ...(st.overrides[p.banner_id] || {}), qty_owned: left, ...(left === 0 ? { status: "Broken – out of stock" } : {}) };
      mv("", p.banner_id, "damaged", Math.max(1, num(p.qty)), p.note || "Marked as broken");
    } else if (p.action === "moveStock") {
      const was = st.overrides[p.banner_id]?.stored_at ?? byId(p.banner_id)?.stored_at;
      st.overrides[p.banner_id] = { ...(st.overrides[p.banner_id] || {}), stored_at: p.stored_at };
      mv("", p.banner_id, "moved", owned(p.banner_id), `Now stored at ${p.stored_at} (was ${was || "—"})`);
    } else if (p.action === "adjustStock") {
      const old = owned(p.banner_id);
      st.overrides[p.banner_id] = { ...(st.overrides[p.banner_id] || {}), qty_owned: num(p.qty_owned) };
      mv("", p.banner_id, "adjust", num(p.qty_owned) - old, p.note || `Stock count: ${old} → ${num(p.qty_owned)}`);
    } else throw new Error("Unknown action");
    saveDemo(st);
  }

  // ───────────────────────── stock maths ────────────────────
  function outNow(id) {
    let out = 0;
    S.movements.forEach((m) => {
      if (m.banner_id !== id) return;
      if (m.type === "dispatch") out += m.qty;
      else if (m.type === "return" || m.type === "damaged" || m.type === "missing") out -= m.qty;
    });
    return Math.max(0, out);
  }
  // Unused printed items / supplies counted back in after an event – used first next time
  const spareOf = (id, list = S.movements) => Math.max(0, list.reduce((n, m) => m.banner_id !== id ? n : m.type === "leftover" ? n + num(m.qty) : m.type === "spare used" ? n - num(m.qty) : n, 0));
  const LOCATIONS = () => uniq([...(CFG.storeLocations || []), ...S.banners.filter((b) => b.tracked).map((b) => b.stored_at)]).filter((l) => !/artwork only|to confirm/i.test(l)).sort();
  const locSelect = (cur, attr) => `<select ${attr}>${uniq([cur, ...LOCATIONS()]).filter(Boolean).map((l) => `<option ${l === cur ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>`;
  // Only UK stock is monitored (dispatched and counted back in). Items kept in other countries just show what's there.
  const HOME = () => CFG.monitoredLocations || ["UK office", "To confirm"];
  const isAway = (b) => !!b && b.tracked !== false && !!b.stored_at && !/artwork only/i.test(b.stored_at) && !HOME().some((l) => l.toLowerCase() === String(b.stored_at).toLowerCase());
  const stock = (b) => { if (b && b.tracked === false) return { owned: 0, out: 0, available: 0 };
    if (isAway(b)) return { owned: b.qty_owned, out: 0, available: b.qty_owned, away: true }; const out = outNow(b.banner_id); return { owned: b.qty_owned, out, available: Math.max(0, b.qty_owned - out) }; };
  const eventStatus = (eid) => {
    const rows = S.bookings.filter((b) => b.event_id === eid);
    if (!rows.length) return "";
    if (rows.some((r) => r.status === "Dispatched")) return "Dispatched";
    if (rows.every((r) => r.status === "Returned")) return "Returned";
    return "Requested";
  };
  const windowOf = (e) => [e.ship_by || e.start_date || "", e.return_by || e.end_date || e.start_date || ""];
  function overlaps(a, b) {
    const [a1, a2] = windowOf(a), [b1, b2] = windowOf(b);
    if (!a1 || !b1) return false;
    return a1 <= (b2 || b1) && b1 <= (a2 || a1);
  }
  // How many of a banner are promised to other events whose dates overlap this one
  function committedElsewhere(bannerId, eventId) {
    const ev = evById(eventId); if (!ev) return { qty: 0, events: [] };
    let qty = 0; const events = [];
    S.bookings.forEach((bk) => {
      if (bk.banner_id !== bannerId || bk.event_id === eventId || bk.status === "Returned" || byId(bannerId)?.tracked === false) return;
      const other = evById(bk.event_id);
      if (other && overlaps(ev, other)) { qty += bk.qty; events.push(other.event_name); }
    });
    return { qty, events: uniq(events) };
  }
  const isClosed = (e) => (CFG.closedStatuses || []).includes(e.status) || (e.end_date && e.end_date < today() && eventStatus(e.event_id) !== "Dispatched");

  // "+ New event" is available everywhere: header, catalogue plan bar and the Events page
  // Digital run-up: an event's digital assets in the order they went out (month from the artwork date)
  function runupPanel(evId) {
    const e = evById(evId), list = S.banners.filter((b) => b.category === "digital" && b.event_id === evId).sort((a, z) => String(a.version).localeCompare(String(z.version)) || String(a.banner_id).localeCompare(String(z.banner_id)));
    S.lbList = list.map((b) => b.banner_id);
    const months = uniq(list.map((b) => String(b.version).slice(0, 7)));
    const mName = (m) => { const d = new Date(m + "-01"); return isNaN(d) ? m : d.toLocaleDateString("en-GB", { month: "long", year: "numeric" }); };
    return `<div class="panel kit-panel" style="margin-bottom:16px">
      <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center">
        <div><h2 style="margin:0">📱 Digital run-up – ${esc(e.event_name)}</h2><div class="muted">WhatsApp invitations, social posts, email artwork and website graphics, in the order they went out. Click one to see it large.</div></div>
        <button class="btn small" data-act="show-runup" data-id="${esc(evId)}">Close</button></div>
      <div class="runup">${months.map((m) => `<div class="runup-month"><div class="runup-when">${esc(mName(m))}</div><div class="runup-items">${list.filter((b) => String(b.version).slice(0, 7) === m).map((b) => `
        <button class="runup-item" data-zoom="${esc(b.banner_id)}"><img src="${esc(imgSrc(b))}" alt="" loading="lazy"><span><b>${esc(b.name)}</b><i>${esc(b.section)}${b.edition ? " · " + esc(b.edition) : ""}${num(b.images) > 1 ? ` · ${b.images} images` : ""}</i></span></button>`).join("")}</div></div>`).join("")}</div></div>`;
  }
  function openNewEvent() {
    go("events", { showNewEvent: true, showRequest: false, evTab: "upcoming" });
    setTimeout(() => { const f = document.getElementById("new-event"); if (f) { f.scrollIntoView({ behavior: "smooth", block: "start" }); f.querySelector("input")?.focus(); } }, 50);
  }
  // ───────────────────────── routing ───────────────────────
  function go(view, opts = {}) {
    if (S.dirty && view !== "catalogue" && !confirm("You have unsaved picks for this event. Leave without saving?")) return;
    if (view !== "catalogue") { S.dirty = false; }
    if (view === "reports" && S.view !== "reports") { if (isPrint(S.cat)) S.cat = "banners"; resetFilters(); }
    Object.assign(S, opts); S.view = view;
    location.hash = view + (opts.whEvent ? "/" + opts.whEvent : "");
    render();
    window.scrollTo(0, 0);
  }
  function startPlanning(eventId) {
    S.planEvent = eventId; S.dirty = false; S.draft = {}; S.draftDay = {};
    S.bookings.filter((b) => b.event_id === eventId).forEach((b) => { S.draft[b.banner_id] = b.qty; if (b.day) S.draftDay[b.banner_id] = String(b.day); });
  }

  // ───────────────────────── render: shell ──────────────────
  // Keep sticky strips (e.g. the warehouse day boxes) just under the sticky top bar, whatever its height
  const setTopbarH = () => { const t = document.querySelector(".topbar"); if (t) document.documentElement.style.setProperty("--topbar-h", t.offsetHeight + "px"); };
  window.addEventListener("resize", setTopbarH);
  function render() {
    setTimeout(setTopbarH, 0);
    document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.view === S.view));
    const planning = S.view === "catalogue" && S.planEvent;
    document.body.classList.toggle("planning", !!planning);
    $("#tray").hidden = !planning;
    const v = $("#view");
    if (S.view === "catalogue") v.innerHTML = viewCatalogue();
    else if (S.view === "events") v.innerHTML = viewEvents();
    else if (S.view === "warehouse") v.innerHTML = viewWarehouse();
    else if (S.view === "reports") v.innerHTML = viewReports();
    const nNew = S.ideas.filter((i) => i.status === "New" || i.status === "In design").length, badge = $("#ideas-badge");
    if (badge) { badge.hidden = !nNew; badge.textContent = nNew; }
    if (planning) renderTray();
  }

  // ───────────────────────── catalogue ─────────────────────
  function filtered(cat = S.cat, ignoreSection = false) {
    const f = S.f, q = f.q.toLowerCase(), ck = CATS[cat].chipKey;
    return S.banners.filter((b) => b.cats.includes(cat) &&
      (f.chip === "all" || b[ck] === f.chip) &&
      Object.entries(f.sel).every(([k, v]) => v === "all" || (k === "usedat" ? ((S.usedAt && S.usedAt.get(b._posterOf || b.banner_id)) || new Set()).has(v) : k === "mregion" ? regionMatch(b, v) : b[k] === v || (k === "brand" && brandsOf(b).includes(v)))) &&
      (ignoreSection || f.section === "all" || b.section === f.section) &&
      (!f.action || b.action_needed || (b.status && !["In use", "Final", "Artwork only", "Old design"].includes(b.status))) &&
      (!q || [b.banner_id, b.name, b.brand, b.section, b.language, b.stored_at, b.region, b.format, b.event_specific, b.notes].join(" ").toLowerCase().includes(q)));
  }
  // Region a material is for: from its regional edition, else from its brand (Nordic Labs / Nordic Health / Nordic VMS → Nordic region)
  const REGIONS = ["Nordic Labs region", "dnalife region", "Dual branded"];
  const matRegion = (b) => { const e = String(b.edition || "");
    if (/nordic labs region/i.test(e)) return "Nordic Labs region"; if (/dnalife region/i.test(e)) return "dnalife region";
    const br = String(b.brand || ""); if (/&/.test(br) || /dual/i.test(br)) return "Dual branded";
    if (/^nordic/i.test(br)) return "Nordic Labs region"; if (/dnalife/i.test(br)) return "dnalife region"; return ""; };
  // Dual-branded items fit either region; items with no regional branding (e.g. FuFu) fit everywhere
  const regionMatch = (b, v) => { const r = matRegion(b); return v === "Dual branded" ? r === v : !r || r === v || r === "Dual branded"; };
  const regionSelect = () => { const cur = S.f.sel.mregion || "all";
    return `<select data-filter="sel:mregion" aria-label="Region"><option value="all">Region: all</option>${REGIONS.map((v) => `<option ${cur === v ? "selected" : ""}>${esc(v)}</option>`).join("")}</select>`; };
  // Dual-branded items ("Nordic Labs & dnalife") also show when filtering by either brand on its own
  const brandsOf = (b) => String(b.brand || "").split(/\s*&\s*/);
  const selectHTML = (key, label, cat = S.cat) => {
    const vals = uniq(S.banners.filter((b) => b.cats.includes(cat)).map((b) => b[key])).sort();
    const cur = S.f.sel[key] || "all";
    return `<select data-filter="sel:${key}" aria-label="${label}"><option value="all">${label}: all</option>${vals.map((v) => `<option ${cur === v ? "selected" : ""}>${esc(v)}</option>`).join("")}</select>`;
  };
  // Which test/product a banner is mainly about – used to keep e.g. all DNA Core or all DUTCH banners side by side
  const PRODUCTS = [
    ["Nordic VMS", /Nordic VMS/i], // newest corporate banners (Nov 2026) – shown first
    ["Nordic Labs Finland", /^Nordic Labs EN –/i], // next newest (Finland lab, 2026)
    ["DUTCH", /DUTCH/i], ["Baby Gut Health", /Baby Gut/i], ["DNA Core", /\b(DNA ?)?Core\b/i], ["DNA Gut", /\bDNA ?Gut\b/i],
    ["DNA Hormones", /\bDNA ?Hormones\b/i], ["DNA Health", /\bDNA ?Health\b/i], ["DNA Mind", /\b(DNA ?)?Mind\b/i],
    ["DNA Smile", /Smile/i], ["DNA Skin", /\bSkin\b/i], ["DNA Risk", /\bRisk\b/i], ["DNA Resilience", /Resilience/i],
    ["Growbaby", /Growbaby|First 1000/i], ["Medcheck", /Medcheck/i], ["All DNA", /All DNA/i],
    ["GI-MAP", /GI-?MAP/i], ["GI Effects", /GI Effects/i], ["OMX", /\bOMX\b/i], ["Organic Acids", /Organic Acids|\bOAT\b/i],
    ["Metabolomix", /Metabolomix/i], ["MycoTOX", /MycoTOX/i], ["TOXDetect", /TOXDetect/i], ["Thermocheck", /Thermocheck/i],
    ["Tickplex / Lyme", /Tickplex|Lyme/i], ["Multi-supps", /Multi-supps/i], ["Broccolox", /Broccolox/i], ["NucleoX", /NucleoX/i],
    ["SporeBiotic", /SporeBiotic/i], ["Spermidine", /Spermidine/i], ["Daily Creatine", /Creatine/i], ["Daily D3", /Daily D3/i],
    ["Smoothie", /Smoothie/i], ["FuFu", /FuFu|Functional Future/i], ["International Patients", /International Patients/i],
    ["dnalife", /dnalife/i], ["Nordic Labs", /Nordic Labs|About the company/i],
  ];
  function productOf(b) {
    let best = null;
    PRODUCTS.forEach(([name, re], order) => { const m = re.exec(b.name || ""); if (m && (!best || m.index < best.at || (m.index === best.at && order < best.order))) best = { name, at: m.index, order }; });
    return best || { name: b.name, at: 0, order: 999 };
  }
  // All the tests a banner features, e.g. "Core + Mind + OMX + GI-MAP ES" → DNA Core·DNA Mind·GI-MAP·OMX
  const EXTRA = [["DNA Hormones", /(^|[+–]\s*)Hormones\b/i], ["DNA Gut", /(^|[+–]\s*)Gut\b/i], ["DNA Health", /(^|[+–]\s*)Health\b/i], ["TruAge", /TruAge/i]];
  function testsOf(b) {
    const n = b.name || "", found = new Map();
    [...PRODUCTS, ...EXTRA].forEach(([name, re]) => { if (re.test(n) && !/^(Nordic|dnalife|Multi-supps|International)/.test(name)) found.set(name, PRODUCTS.findIndex((p) => p[0] === name)); });
    return [...found.entries()].sort((x, y) => (x[1] < 0 ? 999 : x[1]) - (y[1] < 0 ? 999 : y[1])).map((e) => e[0]);
  }
  const testsKey = (b) => testsOf(b).join(" · ");
  // Newest first: an item's date is the later of its artwork/version date and the last event it was used at
  function buildLastUsed() {
    const m = new Map(), put = (id, d) => { if (!id || !d) return; d = String(d).slice(0, 10); if (!m.has(id) || m.get(id) < d) m.set(id, d); };
    const evD = (id) => (evById(id) || {}).start_date || "";
    (S.kits || []).forEach((k) => String(k.item_ref || "").split(/[\s,]+/).forEach((id) => put(id.replace(/-POSTER$/, ""), evD(k.event_id))));
    S.bookings.forEach((b) => put(b.banner_id, evD(b.event_id)));
    S.events.forEach((e) => String(e.featured_items || "").split(/[\s,]+/).forEach((id) => put(id, e.start_date)));
    S.banners.forEach((b) => { if (b.category === "pastevents") { put(b.stock_item, evD(b.event_id)); put(b.banner_ref, evD(b.event_id)); put(b.banner_id, evD(b.event_id)); } });
    S.lastUsed = m;
    // Event tags: every event an item was used at (kit lists, event plans, featured items, past-event links)
    const u = new Map(), tag = (id, ev) => { if (!id || !ev) return; id = id.replace(/-POSTER$/, ""); if (!u.has(id)) u.set(id, new Set()); u.get(id).add(ev); };
    (S.kits || []).forEach((k) => String(k.item_ref || "").split(/[\s,]+/).forEach((id) => tag(id, k.event_id)));
    S.bookings.forEach((b) => tag(b.banner_id, b.event_id));
    S.events.forEach((e) => String(e.featured_items || "").split(/[\s,]+/).forEach((id) => tag(id, e.event_id)));
    S.banners.forEach((b) => { if (b.category === "pastevents") { tag(b.stock_item, b.event_id); tag(b.banner_ref, b.event_id); tag(b.banner_id, b.event_id); } if (b.category === "digital") tag(b.banner_id, b.event_id); });
    S.usedAt = u;
  }
  const usedAt = (b) => uniq((b._rows && b._rows.length ? b._rows : [b]).flatMap((x) => [...((S.usedAt && S.usedAt.get(x._posterOf || x.banner_id)) || [])]))
    .map(evById).filter(Boolean).sort((a, z) => (z.start_date || "").localeCompare(a.start_date || ""));
  const evShort = (e) => [e.city || e.event_name, (e.start_date || "").slice(0, 4)].filter(Boolean).join(" ");
  const eventTags = (b, max = 3) => { const ev = usedAt(b); if (!ev.length) return "";
    return `<div class="ev-tags">${ev.slice(0, max).map((e) => `<span class="ev-tag" title="${esc(e.event_name)}">📍 ${esc(evShort(e))}</span>`).join("")}${ev.length > max ? `<span class="ev-tag more">+${ev.length - max}</span>` : ""}</div>`; };
  const recencyOne = (b) => { const own = String(b.artwork_date || b.version || "").slice(0, 7), used = (S.lastUsed && S.lastUsed.get(b._posterOf || b.banner_id)) || ""; return own > used ? own : used; };
  const recency = (b) => (b._rows && b._rows.length ? b._rows : [b]).reduce((m, x) => { const r = recencyOne(x); return r > m ? r : m; }, recencyOne(b));
  const LOC_ORDER = (l) => (l === "UK office" ? 0 : l === "Artwork only" ? 9 : l === "To confirm" ? 8 : 1);
  // newest artwork first within each test (banners with no dated artwork go last)
  const isLarge = (b) => (b.cats || []).includes("large");
  const byProduct = (a, b) => (isLarge(a) && isLarge(b)
    ? recency(b).localeCompare(recency(a)) || (a._row || 0) - (b._row || 0) // large banners: newest first, then sheet order
    : 0) || productOf(a).order - productOf(b).order ||
    (a.section === "Multi-test" && b.section === "Multi-test" ? testsKey(a).localeCompare(testsKey(b)) : 0) ||
    recency(b).localeCompare(recency(a)) || (a.language === "English" ? 0 : 1) - (b.language === "English" ? 0 : 1)
    || (a.language || "").localeCompare(b.language || "") || (a.name || "").localeCompare(b.name || "");
  // Identical designs kept in several places share a design_id and show as one card
  const rowsOf = (b) => (b.design_id ? S.banners.filter((x) => x.design_id === b.design_id).sort((x, y) => LOC_ORDER(x.stored_at) - LOC_ORDER(y.stored_at)) : [b]);
  // Regional versions (Nordic Labs region / dnalife region) of the same design show as one card with region bubbles
  const ED_ORDER = (e) => (/nordic/i.test(e || "") ? 0 : /dnalife/i.test(e || "") ? 1 : /^english/i.test(e || "") ? 2 : 3); // regional versions first, then English, then other languages
  // Region for an event's country: Nordic Labs (DK, SE, FI, UK, DE, PT), dual branded (Canada) or dnalife (everywhere else)
  const regionOf = (country) => { const c = String(country || "").trim().toLowerCase(); if (!c) return "";
    if ((CFG.dualBrandRegion || []).some((x) => x.toLowerCase() === c)) return "Dual branded";
    return (CFG.nordicRegion || []).some((x) => x.toLowerCase() === c) ? "Nordic Labs region" : "dnalife region"; };
  const fitsRegion = (edition, ev) => { const r = ev && regionOf(ev.country); return !!r && !!edition && (r === "Dual branded" || r === edition); };
  function collapsePrint(list) {
    const out = [], seen = new Map();
    list.forEach((b) => {
      const k = b.design_id || b.banner_id;
      if (!seen.has(k)) { const d = { ...b, _rows: [] }; seen.set(k, d); out.push(d); }
      seen.get(k)._rows.push(b);
    });
    out.forEach((d) => { d._rows.sort((x, y) => ED_ORDER(x.edition) - ED_ORDER(y.edition)); const f = d._rows[0]; Object.assign(d, { ...f, _rows: d._rows }); if (d._rows.length > 1 && f._groupName) d.name = f._groupName + ` (${d._rows.length} versions)`; });
    return likeSort(out);
  }
  // Sections listed A–Z by test name rather than newest first
  const ALPHA_SECTIONS = /^(Practitioner test handouts|Patient test handouts|Sample reports)/i;
  const alphaKey = (d) => String(d.name || "").toLowerCase().replace(/^(the|a)\s+/, "");
  function likeSort(out) {
    if (out.length && out.every((d) => ALPHA_SECTIONS.test(d.section || ""))) return out.sort((a, b) => alphaKey(a).localeCompare(alphaKey(b)) || ED_ORDER(a.edition) - ED_ORDER(b.edition));
    // newest / most recently used first, but versions of the same thing stay side by side (e.g. supplement catalogue EN + DE)
    const LANGS = "English|German|Danish|Swedish|Finnish|Spanish|Portuguese|French|Dutch|Czech|Russian|Turkish|Serbian|Arabic|Italian|Polish";
    // "Like things": same name once brand, language, currency, size and version notes are taken out
    // (e.g. Nordic Labs company overview (English) ≈ dnalife company overview (Spanish))
    const BRANDS = /\b(nordic labs?|nordic laboratories|dnalife|nordic health|nordic vms|functional future|fufu)\b/g;
    const fam = (d) => String(d.name || "").toLowerCase().replace(/\([^)]*\)/g, " ").replace(new RegExp(`\\s[–-]\\s*(${LANGS.toLowerCase()})\\b.*$`), "")
      .replace(/\s*[–-]\s*front as poster$/, "").replace(BRANDS, " ").replace(/[–\-:,]/g, " ").replace(/\s+/g, " ").trim();
    const GENERIC_P = new Set(["dnalife", "Nordic Labs", "Nordic VMS", "Nordic Labs Finland", "International Patients"]);
    const famOf = (d) => { const p = productOf(d); return p.order < 999 && p.at === 0 && !GENERIC_P.has(p.name) ? "product:" + p.name : fam(d).replace(/\s(poster|flyer|sheet|form)$/, ""); }; // same test/product = like things
    const sub = (d) => String(d.brand || "").toLowerCase();
    const rows = out.map((d, i) => ({ d, i, f: famOf(d), b: sub(d), r: d.category === "templates" ? "" : recency(d) }));
    const fr = new Map(), fi = new Map(), br = new Map();
    rows.forEach((x) => { if (!fr.has(x.f) || fr.get(x.f) < x.r) fr.set(x.f, x.r); if (!fi.has(x.f)) fi.set(x.f, x.i); const k = x.f + "|" + x.b; if (!br.has(k) || br.get(k) < x.r) br.set(k, x.r); });
    return rows.sort((x, y) => fr.get(y.f).localeCompare(fr.get(x.f)) || fi.get(x.f) - fi.get(y.f) ||
      br.get(y.f + "|" + y.b).localeCompare(br.get(x.f + "|" + x.b)) || x.b.localeCompare(y.b) ||
      (x.d.language === "English" ? 0 : 1) - (y.d.language === "English" ? 0 : 1) || y.r.localeCompare(x.r) || x.i - y.i).map((x) => x.d);
  }
  const variantsOf = (b) => b.design_id ? S.banners.filter((x) => x.design_id === b.design_id && x.category === b.category).sort((x, y) => ED_ORDER(x.edition) - ED_ORDER(y.edition)) : [b];
  function collapse(list) {
    const out = [], seen = new Map();
    list.slice().sort((x, y) => LOC_ORDER(x.stored_at) - LOC_ORDER(y.stored_at)).forEach((b) => {
      const k = b.design_id || b.banner_id;
      if (!seen.has(k)) { const d = { ...b, _rows: [] }; seen.set(k, d); out.push(d); }
      seen.get(k)._rows.push(b);
    });
    if (out.length && out.every((d) => d.category === "misc")) return likeSort(out); // stands & extras: like things together (e.g. both request sheets)
    // newest (or most recently used) first – products are ordered by their newest banner, so the same test still sits together
    const pr = new Map(); out.forEach((d) => { const k = productOf(d).name, r = recency(d); if (!pr.has(k) || pr.get(k) < r) pr.set(k, r); });
    return out.sort((a, b) => (isLarge(a) && isLarge(b) ? 0 : (pr.get(productOf(b).name) || "").localeCompare(pr.get(productOf(a).name) || "")) || byProduct(a, b));
  }
  const SEC_COLOURS = ["#006a84", "#2a8fa8", "#00475a", "#5aa9b8", "#7a5ea8", "#d17a22", "#3f8f5f", "#b04a5a", "#4a6a8a"];
  const secColour = (sec) => { const all = uniq(S.banners.map((b) => b.section)); return SEC_COLOURS[Math.max(0, all.indexOf(sec)) % SEC_COLOURS.length]; };

  function viewCatalogue() {
    const upcoming = S.events.filter((e) => !isClosed(e)).sort((a, b) => (a.start_date || "").localeCompare(b.start_date || ""));
    const ev = evById(S.planEvent);
    const locked = ev && eventStatus(ev.event_id) && eventStatus(ev.event_id) !== "Requested";
    const C = CATS[S.cat];
    const list = isPrint(S.cat) ? collapsePrint(filtered()) : collapse(filtered());
    const pool = isPrint(S.cat) ? collapsePrint(filtered(S.cat, true)) : collapse(filtered(S.cat, true));
    const inCat = S.banners.filter((b) => b.cats.includes(S.cat));
    const chips = uniq(inCat.map((b) => b[C.chipKey]));
    const secs = uniq(inCat.map((b) => b.section));

    let groups;
    if (S.f.group === "none") groups = [["All " + C.label.toLowerCase(), list]];
    else {
      const key = S.f.group; const m = new Map();
      list.forEach((b) => { const k = b[key] || "—"; if (!m.has(k)) m.set(k, []); m.get(k).push(b); });
      groups = [...m.entries()];
      groups.forEach((g) => { if (ALPHA_SECTIONS.test(g[0])) g[1].sort((a, b) => alphaKey(a).localeCompare(alphaKey(b))); }); // handouts & sample reports A–Z
      // keep sections in the master-sheet order (Genetic tests first, then Functional tests, …)
      if (key === "section" && S.cat === "pastevents") { const d = (g) => ((evById(g[1][0].event_id) || {}).start_date || ""); groups.sort((x, y) => d(y).localeCompare(d(x))); } // newest event first
      else if (key === "section") { const order = uniq(inCat.map((b) => b.section)); const last = (g) => (/biohackers/i.test(g) ? 1 : 0); groups.sort((x, y) => last(x[0]) - last(y[0]) || order.indexOf(x[0]) - order.indexOf(y[0])); }
      else if (key === "stored_at") groups.sort((x, y) => LOC_ORDER(x[0]) - LOC_ORDER(y[0]) || x[0].localeCompare(y[0]));
    }
    S.lbList = list.map((b) => b.banner_id);
    const groupOpts = S.cat === "posters"
      ? [["section", "Group by topic"], ["format", "Group by size"], ["brand", "Group by brand"], ["language", "Group by language"], ["none", "No grouping"]]
      : S.cat === "misc" ? [["section", "Group by type"], ["brand", "Group by brand"], ["none", "No grouping"]]
      : S.cat === "brochures" || S.cat === "clinical" ? [["section", "Group by type"], ["language", "Group by language"], ["brand", "Group by brand"], ["format", "Group by format"], ["none", "No grouping"]]
      : S.cat === "templates" ? [["section", "Group by type"], ["none", "No grouping"]]
      : S.cat === "digital" ? [["section", "Group by type"], ["event_specific", "Group by event"], ["brand", "Group by brand"], ["none", "No grouping"]]
      : S.cat === "pastevents" ? [["section", "Group by event"], ["kind", "Group by kind"], ["brand", "Group by brand"], ["none", "No grouping"]]
      : S.cat === "pricelists" ? [["section", "Group by type"], ["currency", "Group by currency"], ["language", "Group by language"], ["none", "No grouping"]]
      : S.cat !== "offers"
      ? [["section", "Group by type of banner"], ["stored_at", "Group by location"], ["language", "Group by language"], ["brand", "Group by brand"], ["none", "No grouping"]]
      : [["section", "Group by type of offer"], ["currency", "Group by currency"], ["region", "Group by country / VAT"], ["brand", "Group by brand"], ["none", "No grouping"]];

    return `
      <section class="hero">
        <div class="hero-inner">
          <div>
            <h1>Event materials</h1>
            <p>Browse everything we take to events, pick it for an event, and see where it is.</p>
          </div>
          <div class="cat-switch" role="tablist">
            ${Object.entries(CATS).map(([k, c]) => `<button class="cat ${S.cat === k ? "on" : ""}" data-cat="${k}">
              <span class="cat-icon ${k}"></span><span><b>${c.label}</b><small>${S.banners.filter((b) => b.cats.includes(k)).length} ${c.unit}</small></span></button>`).join("")}
          </div>
        </div>
        <svg class="wave" viewBox="0 0 1440 60" preserveAspectRatio="none" aria-hidden="true"><path d="M0,30 C320,70 720,-10 1080,25 C1260,42 1380,38 1440,30 L1440,60 L0,60 Z"/></svg>
      </section>
      <div class="plan-bar ${ev ? "on" : ""}">
        <label for="plan-select"><span class="plan-ico">📋</span>${ev ? "Planning materials for" : "Plan materials for an event"}</label>
        <select id="plan-select" data-act="plan-select">
          <option value="">— Choose an event to plan for —</option>
          <optgroup label="Current events">${upcoming.map((e) => `<option value="${esc(e.event_id)}" ${e.event_id === S.planEvent ? "selected" : ""}>${esc(e.event_name)} · ${fmtDate(e.start_date)}</option>`).join("")}</optgroup>
          <option value="__new">＋ Add a new event…</option>
        </select>
        <button class="btn small primary" data-act="global-new-event">+ New event</button>
        ${ev ? `<span class="muted">${esc(ev.event_type || "")} · ${esc(ev.city || "")} · ship by ${fmtDate(ev.ship_by) || "—"}</span>` : `<span class="muted">Pick an event to add materials to its list. Click anything to see it large.</span>`}
        ${locked ? `<span class="pill warn">${esc(eventStatus(ev.event_id))} – list is locked</span>` : ""}
      </div>

      <div class="sections">
        <button class="sec-tile ${S.f.section === "all" ? "on" : ""}" data-sec="all" style="--c:#12202b">
          <span class="sec-name">All types</span><span class="sec-n">${pool.length}</span></button>
        ${secs.map((sec) => {
          const items = pool.filter((b) => b.section === sec);
          const ex = inCat.find((b) => b.section === sec && imgSrc(b));
          return `<button class="sec-tile ${S.f.section === sec ? "on" : ""}" data-sec="${esc(sec)}" style="--c:${secColour(sec)}">
            ${ex ? `<img src="${esc(imgSrc(ex))}" alt="" loading="lazy">` : ""}
            <span class="sec-name">${esc(sec)}</span><span class="sec-n">${items.length}</span></button>`;
        }).join("")}
      </div>

      <div class="chips">
        <button class="chip ${S.f.chip === "all" ? "on" : ""}" data-chip="all">${C.chipAll}<span class="n">${isPrint(S.cat) ? inCat.length : collapse(inCat).length}</span></button>
        ${chips.map((l) => `<button class="chip ${S.f.chip === l ? "on" : ""}" data-chip="${esc(l)}">${esc(l)}<span class="n">${inCat.filter((b) => b[C.chipKey] === l).length}</span></button>`).join("")}
      </div>
      <div class="filters">
        <input type="search" placeholder="Search ${C.label.toLowerCase()}…" value="${esc(S.f.q)}" data-filter="q" aria-label="Search">
        ${regionSelect()}${(() => { const cur = S.f.sel.usedat || "all", evs = S.events.filter((e) => S.banners.some((b) => b.cats.includes(S.cat) && S.usedAt && (S.usedAt.get(b._posterOf || b.banner_id) || new Set()).has(e.event_id))).sort((a, z) => (a.start_date || "").localeCompare(z.start_date || "")); // date order
          return evs.length ? `<select data-filter="sel:usedat" aria-label="Used at"><option value="all">Used at: any event</option>${evs.map((e) => `<option value="${esc(e.event_id)}" ${cur === e.event_id ? "selected" : ""}>${esc(e.event_name)}</option>`).join("")}</select>` : ""; })()}${C.selects.map(([k, l]) => selectHTML(k, l)).join("")}
        ${S.cat === "banners" ? `<label class="muted"><input type="checkbox" data-filter="action" ${S.f.action ? "checked" : ""}> Needs action</label>` : ""}
        <select data-filter="group" aria-label="Group by">${groupOpts.map(([v, l]) => `<option value="${v}" ${S.f.group === v ? "selected" : ""}>${l}</option>`).join("")}</select>
        <span class="result-count">${list.length} ${C.unit}${!isPrint(S.cat) ? ` · ${list.reduce((s, d) => s + (d._rows || [d]).reduce((t, r) => t + num(r.qty_owned), 0), 0)} in stock` : ""}</span>
      </div>
      ${list.length ? groups.map(([g, items]) => `
        <div class="group-band" style="--c:${S.f.group === "section" ? secColour(g) : "#006a84"}"><h2>${esc(g)}</h2><span>${items.length} ${C.unit}</span></div>
        <div class="grid ${S.cat === "digital" ? "wide" : isPrint(S.cat) ? "a4" : S.cat === "large" ? "wide" : S.cat === "backlit" ? "backlit" : ""}">${items.map((b) => cardHTML(b, ev, locked)).join("")}</div>`).join("")
      : `<div class="empty"><h2>Nothing matches</h2><p>Try clearing a filter.</p></div>`}
    `;
  }

  const isBannerJob = (b) => b && !b.tracked && /banner|backdrop|roll-?up|stage/i.test([b.name, b.kind, b.material, b.format].join(" ")) && !/flyer|poster|voucher|brochure/i.test([b.name, b.kind, b.material].join(" "));
  const stepOf = (b) => (b.tracked || b.stock_item || isOneOff(b) || isBannerJob(b) ? 1 : 10);
  // Digital assets are made once per event: a tick box, not a number of copies
  const isOneOff = (b) => b && b.category === "digital";
  const tickHTML = (b, on, locked) => `<button class="tick-pick ${on ? "on" : ""}" data-step="${on ? -1 : 1}" data-id="${esc(b.banner_id)}" ${locked ? "disabled" : ""} aria-pressed="${on}">
      <span class="box">${on ? "✓" : ""}</span><span>${on ? "Added – design team makes it" : "Add to this event"}</span></button>`;
  const sumStock = (rows) => rows.reduce((a, r) => { const s = stock(r); return { owned: a.owned + s.owned, out: a.out + s.out, available: a.available + s.available }; }, { owned: 0, out: 0, available: 0 });
  const freeFor = (r, evId) => Math.max(0, num(r.qty_owned) - committedElsewhere(r.banner_id, evId).qty - num(S.draft[r.banner_id]));
  function locBubbles(rows, ev) {
    return `<div class="locs">${rows.map((r) => {
      const q = num(r.qty_owned), pk = ev ? num(S.draft[r.banner_id]) : 0;
      const label = r.stored_at === "Artwork only" ? "Artwork only" : `${esc(r.stored_at)} <b>${q}</b>`;
      return `<span class="loc ${q ? "" : "zero"} ${S.f.chip === r.stored_at ? "on" : ""}" title="${esc(r.stored_at)}: ${q} owned">${label}${pk ? ` <i>· ${pk} picked</i>` : ""}</span>`;
    }).join("")}</div>`;
  }
  function cardHTML(b, ev, locked) {
    const rows = b._rows || [b];
    const st = b.tracked ? sumStock(rows) : stock(b);
    let picked = ev ? rows.reduce((s, r) => s + num(S.draft[r.banner_id]), 0) : 0;
    if (ev && b.category === "templates") picked = b.styles.reduce((s, id) => s + num(S.draft[id]), 0);
    const flags = [];
    if (b.action_needed) flags.push(`<span class="pill warn">${esc(b.action_needed)}</span>`);
    if (b.status === "Artwork only" || b.status === "Old design") flags.push(`<span class="pill">${esc(b.status)}</span>`);
    else if (b.status && b.status !== "In use" && b.status !== "Final") flags.push(`<span class="pill ${b.qty_owned ? "warn" : "bad"}">${esc(b.status)}</span>`);
    if (b.event_specific) flags.push(`<span class="pill warn">${esc(b.event_specific)}</span>`);
    if (isDesign(b)) flags.push(`<span class="pill design">🎨 To be made by design</span>`);
    if (b.photo_needed) flags.push(`<span class="pill warn">📷 Photo needed</span>`);
    else if (b.photo_wanted) flags.push(`<span class="pill warn" title="${esc(b.photo_wanted)}">📷 Plain photo wanted</span>`);
    if (b.consumable) flags.push(`<span class="pill">Used up at events</span>`);
    if (linkOf(b)) flags.push(`<span class="pill good">✓ In stock – same as ${esc(b.stock_item)}</span>`);
    if (/double sided/i.test(b.name || "")) flags.push(`<span class="pill accent">⇄ Double sided</span>`);
    if (b.tracked && sidesOf(b).length) flags.push(`<span class="pill">Also in From past events</span>`);
    const src = imgSrc(b);
    let stepper = "";
    if (ev) {
      const n = stepOf(b), L = linkOf(b);
      let sub;
      if (L) { sub = `picks ${esc(L.banner_id)} · ${freeFor(L, ev.event_id)} free`; picked = num(S.draft[L.banner_id]); }
      else if (b.tracked) { const free = rows.reduce((s, r) => s + freeFor(r, ev.event_id), 0); sub = `${free} more free`; }
      else sub = isDesign(b) ? "🎨 design team makes" : "copies to print";
      stepper = isOneOff(b) ? tickHTML(b, picked > 0, locked) : `<div class="stepper">
        <button data-step="-${n}" data-id="${esc(b.banner_id)}" data-group="1" ${locked ? "disabled" : ""} aria-label="Remove">−</button>
        <div style="text-align:center"><div class="q">${picked}</div><div class="avail">${sub}</div></div>
        <button data-step="${n}" data-id="${esc(b.banner_id)}" data-group="1" ${locked ? "disabled" : ""} aria-label="Add">+</button>
      </div>`;
    }
    const prod = productOf(b).name;
    const meta = b.tracked
      ? `<span class="pill accent">${esc(b.language)}</span><span class="pill">${esc(b.brand)}</span>${b.banner_type && !["Roll-up", "Large banner"].includes(b.banner_type) ? `<span class="pill">${esc(b.banner_type === "Large banner – backlit" ? "Backlit" : b.banner_type)}</span>` : ""}`
      : (b.category === "templates" ? [`${b.styles.length} style${b.styles.length > 1 ? "s" : ""}`, "Latest: " + ((e, x) => e ? [e.city, (e.start_date || "").slice(0, 4)].filter(Boolean).join(" ") : styleName(x))(evById(byId(b.styles[0]).event_id), byId(b.styles[0]))] : b.category === "pastevents" ? [b.kind, b.brand, b.currency] : [b.currency || b.language, b.region, b.format]).filter(Boolean).map((v, i) => `<span class="pill ${i ? "" : "accent"}">${esc(v)}</span>`).join("");
    return `<div class="card ${picked ? "picked" : ""}">
      <div class="thumb" data-zoom="${esc(b.banner_id)}" title="Click to enlarge">
        ${facesOf(b).length ? `<div class="two-sides">${facesOf(b).map((x) => `<img src="${esc(x.src)}" alt="${esc(x.label)}" loading="lazy">`).join("")}</div>`
          : src ? `<img src="${esc(src)}" alt="${esc(b.name)}" loading="lazy">` : `<div class="placeholder">${esc(b.name)}<br><br>No artwork yet</div>`}
        <div class="flag">${flags.join("")}</div>
        ${b.count_needed ? `<span class="qtybadge" title="Stock not counted yet">count needed</span>` : b.tracked ? `<span class="qtybadge" title="In store / owned, all locations">${st.available}/${st.owned}</span>` : `<span class="qtybadge">v${esc(b.version || "")}</span>`}
      </div>
      <div class="card-body">
        ${b.tracked ? `<div class="card-sec" style="color:${secColour(b.section)}">${esc(b.section === "Multi-test" && testsOf(b).length > 1 ? testsKey(b) : prod)}</div>` : S.f.group !== "section" ? `<div class="card-sec" style="color:${secColour(b.section)}">${esc(b.section)}</div>` : ""}
        <div class="card-name">${esc(b.name)}</div>
        <div class="card-meta">${meta}</div>${eventTags(b)}
        ${b.tracked ? locBubbles(rows, ev) : rows.length > 1 ? `<div class="locs">${rows.map((r) => `<button class="loc ${fitsRegion(r.edition, ev) ? "on" : ""}" data-zoom="${esc(r.banner_id)}" title="Open the ${esc(r.edition || r.banner_id)} version${fitsRegion(r.edition, ev) ? " – the one for " + esc(ev.country) : ""}">${fitsRegion(r.edition, ev) ? "✓ " : ""}${esc(r.edition || r.banner_id)}${ev && num(S.draft[r.banner_id]) ? ` · ${num(S.draft[r.banner_id])}` : ""}</button>`).join("")}</div>` : ""}
        ${stepper}
      </div>
    </div>`;
  }

  // Days of an event (1 for a one-day event, at most 7), for sorting materials into day boxes
  const daysOf = (ev) => { if (!ev || !ev.start_date) return 3; if (!ev.end_date) return 3; const a = new Date(ev.start_date), z = new Date(ev.end_date || ev.start_date); const n = Math.round((z - a) / 864e5) + 1; return isNaN(n) ? 1 : Math.max(1, Math.min(7, n)); };
  const dayLabel = (d) => (d === "SPLIT" ? "Split across days" : d ? "Day " + d : "Whole event / set-up");
  // A day value is "" (whole event), "2" (one day) or "split:1=50,2=50" (some on each day)
  const isSplit = (v) => /^split:/.test(v || "");
  const parseSplit = (v) => Object.fromEntries(String(v || "").replace(/^split:/, "").split(",").filter(Boolean).map((x) => x.split("=")).map(([d, q]) => [d, num(q)]));
  const makeSplit = (m) => "split:" + Object.entries(m).filter(([, q]) => num(q) > 0).sort((a, z) => num(a[0]) - num(z[0])).map(([d, q]) => d + "=" + num(q)).join(",");
  const dayText = (v) => (!v ? "" : isSplit(v) ? Object.entries(parseSplit(v)).map(([d, q]) => `Day ${d}: ${q}`).join(" · ") : `Day ${v} box`);
  const daySelect = (b, ev, locked) => { const n = daysOf(ev), cur = (S.draftDay || {})[b.banner_id] || "", sp = isSplit(cur), m = sp ? parseSplit(cur) : {};
    return `<select class="day-sel" data-day="${esc(b.banner_id)}" ${locked ? "disabled" : ""} aria-label="Which day">
      <option value="">Whole event</option>${Array.from({ length: n }, (_, i) => `<option value="${i + 1}" ${cur === String(i + 1) ? "selected" : ""}>Day ${i + 1}</option>`).join("")}
      ${n > 1 ? `<option value="split" ${sp ? "selected" : ""}>Split across days…</option>` : ""}</select>
      ${sp ? `<div class="split-days">${Array.from({ length: n }, (_, i) => `<label>Day ${i + 1}<input type="number" min="0" value="${num(m[i + 1])}" data-split="${esc(b.banner_id)}" data-d="${i + 1}" ${locked ? "disabled" : ""}></label>`).join("")}</div>` : ""}`; };

  // Warehouse day boxes: drag (or tap, then tap a box) to say which day box each item goes in
  function dayChips(rows, d) {
    return rows.flatMap((r) => { if (isOneOff(r.b)) return []; const v = r.day || "";
      if (isSplit(v)) { const m = parseSplit(v), used = Object.values(m).reduce((a, q) => a + num(q), 0);
        if (d === "") { const left = num(r.qty) - used; return left > 0 ? [{ r, q: left }] : []; }
        return num(m[d]) > 0 ? [{ r, q: num(m[d]) }] : []; }
      return v === d ? [{ r, q: num(r.qty) }] : []; });
  }
  function dayBoard(ev, rows, locked) {
    const n = daysOf(ev), boxes = Array.from({ length: n }, (_, i) => String(i + 1));
    return `<div class="day-drop-bar">
      <div class="day-drop-hint">📦 <b>Day boxes</b> – drag a row from the list onto the day it's needed, or use the Day menu on the row. Items with no day can stay as they are.</div>
      <div class="day-drops">${boxes.map((d) => { const chips = dayChips(rows, d), units = chips.reduce((a, c) => a + c.q, 0);
        return `<div class="day-drop ${d ? "" : "unassigned"}" data-dbox="${d}"><b>${d ? `Day ${d}` : "No day yet"}</b><span>${chips.length} item${chips.length === 1 ? "" : "s"}${units ? ` · ${units} pcs` : ""}</span></div>`; }).join("")}</div></div>`;
  }
  async function setRowDay(evId, id, day) {
    try { await act({ action: "setBookingDay", event_id: evId, banner_id: id, day: day || "" }); render(); } catch (err) { toast(err.message, true); }
  }
  const whDaySelect = (ev, r) => { const n = daysOf(ev), v = r.day || "";
    return `<select class="day-sel" data-whday="${esc(r.banner_id)}" aria-label="Day box">
      <option value="">No day</option>${Array.from({ length: n }, (_, i) => `<option value="${i + 1}" ${v === String(i + 1) ? "selected" : ""}>Day ${i + 1}</option>`).join("")}
      ${isSplit(v) ? `<option value="__split" selected>${esc(dayText(v))}</option>` : ""}</select>`; };
  async function moveDay(evId, id, from, to) {
    if (from === to) return;
    const bk = S.bookings.find((b) => b.event_id === evId && b.banner_id === id); if (!bk) return;
    const total = num(bk.qty), cur = bk.day || "";
    let m = isSplit(cur) ? parseSplit(cur) : cur ? { [cur]: total } : {};
    const used = Object.values(m).reduce((a, q) => a + num(q), 0);
    const q = from === "" ? total - used : num(m[from]);
    if (from !== "") delete m[from];
    if (to !== "") m[to] = num(m[to]) + q;
    const ks = Object.keys(m).filter((k) => num(m[k]) > 0), sum = ks.reduce((a, k) => a + num(m[k]), 0);
    const day = !ks.length ? "" : ks.length === 1 && sum === total ? ks[0] : makeSplit(m);
    S.daySel = null;
    try { await act({ action: "setBookingDay", event_id: evId, banner_id: id, day }); render(); } catch (err) { toast(err.message, true); }
  }

  // ───────────────────────── planning tray ─────────────────
  function renderTray() {
    const ev = evById(S.planEvent); if (!ev) return;
    const status = eventStatus(ev.event_id);
    const locked = status && status !== "Requested";
    const items = Object.entries(S.draft).filter(([, q]) => num(q) > 0).map(([id, q]) => ({ b: byId(id), q: num(q) })).filter((x) => x.b);
    const units = items.reduce((s, x) => s + x.q, 0);
    $("#tray").innerHTML = `
      <div class="tray-head">
        <h3>${esc(ev.event_name)}</h3>
        <div class="muted">${fmtDate(ev.start_date)}${ev.end_date && ev.end_date !== ev.start_date ? " – " + fmtDate(ev.end_date) : ""} · ${esc(ev.city || "")}</div>
        <div class="muted">${items.filter((x) => x.b.tracked).reduce((s, x) => s + x.q, 0)} banners · ${items.filter((x) => !x.b.tracked && !isDesign(x.b)).reduce((s, x) => s + x.q, 0)} to print${items.some((x) => isDesign(x.b)) ? ` · ${items.filter((x) => isDesign(x.b)).length} for design to make` : ""} ${S.dirty ? '· <b style="color:var(--warn)">unsaved</b>' : status ? "· saved" : ""}</div>
        ${items.some((x) => !isOneOff(x.b)) && !locked ? `<div class="day-hint">📦 Use the <b>day menu</b> under each item to put it in a day box, or split it across days.</div>` : ""}
      </div>
      <div class="tray-list">
        ${items.length ? [...(() => { const n = daysOf(ev); const dd = (x) => { const v = (S.draftDay || {})[x.b.banner_id] || ""; return isSplit(v) ? "SPLIT" : v; };
            const phys = items.filter((x) => !isDesign(x.b) || (!isOneOff(x.b) && dd(x)));
            if (!phys.some(dd)) return [["", phys]];
            return ["", ...Array.from({ length: n }, (_, i) => String(i + 1)), ...(phys.some((x) => dd(x) === "SPLIT") ? ["SPLIT"] : [])].map((d) => [`DAY:${d}`, phys.filter((x) => dd(x) === d)]).filter(([t, l]) => l.length || t !== "DAY:"); })(),
            ["🎨 For the design team to make", items.filter((x) => isDesign(x.b) && !(!isOneOff(x.b) && (S.draftDay || {})[x.b.banner_id]))]].filter(([t, l]) => l.length || String(t).startsWith("DAY:")).map(([title, list]) => `${String(title).startsWith("DAY:") ? (() => { const d = title.slice(4); const sp = d && d !== "SPLIT" ? items.filter((x) => isSplit((S.draftDay || {})[x.b.banner_id]) && num(parseSplit(S.draftDay[x.b.banner_id])[d]) > 0) : [];
              const bits = [list.length ? list.length + " item" + (list.length > 1 ? "s" : "") : "", sp.length ? `+ from split items: ${sp.map((x) => `${num(parseSplit(S.draftDay[x.b.banner_id])[d])} × ${x.b.name}`).join(", ")}` : ""].filter(Boolean);
              return `<div class="tray-group day">📦 ${esc(dayLabel(d))}<span>${esc(bits.join(" ") || "Nothing yet – choose this day on any item")}</span></div>`; })() : title ? `<div class="tray-group design">${title}<span>Not picked by the warehouse – a design request is sent when you save</span></div>` : ""}${list.map(({ b, q }) => {
          const c = committedElsewhere(b.banner_id, ev.event_id);
          const free = b.qty_owned - c.qty;
          const warn = b.tracked && !locked && q > free ? `Only ${Math.max(0, free)} free${c.events.length ? " – also on " + c.events.join(", ") : ""}` : "";
          return `<div class="tray-item">
            ${thumbHTML(b)}
            <div><div class="nm">${esc(isDesign(b) ? designLabel(b) : b.name)}</div><div class="sub">${esc(b.banner_id)} · ${b.tracked ? `${esc(b.language)} · ${esc(b.stored_at)}` : isOneOff(b) ? `${esc(b.section || "Digital asset")} · digital, made once` : isDesign(b) ? `${esc(b.kind || "")} · adapt & print · copies` : `${esc(b.currency)} · ${esc(b.region)} · copies`}</div>${warn ? `<div class="warn">⚠ ${esc(warn)}</div>` : ""}${!isOneOff(b) ? `<div class="day-row">${daySelect(b, ev, locked)}</div>` : ""}</div>
            ${isOneOff(b) ? `<button class="btn small" data-step="-1" data-id="${esc(b.banner_id)}" ${locked ? "disabled" : ""} title="Take it off this event">Remove</button>` : isSplit((S.draftDay || {})[b.banner_id]) ? `<div class="split-total" title="Total across the days">${q}</div>` : `<input type="number" min="0" value="${q}" data-qty="${esc(b.banner_id)}" ${locked ? "disabled" : ""} aria-label="Quantity">`}
          </div>`;
        }).join("")}`).join("") : `<div class="tray-empty">Use the <b>+</b> buttons or tick boxes to add materials to this event's list.</div>`}
      </div>
      <div class="tray-foot">
        ${locked ? `<div class="pill warn">Already ${esc(status.toLowerCase())} – view it in Warehouse</div>` : ""}
        <div class="row">
          <button class="btn primary" data-act="save-plan" ${locked || !S.dirty ? "disabled" : ""}>Save list</button>
          <button class="btn" data-act="export-plan" ${items.length ? "" : "disabled"}>Download CSV</button>
          <button class="btn" data-act="close-plan">Close</button>
        </div>
      </div>`;
  }

  // ───────────────────────── lightbox ──────────────────────
  function openLB(id) {
    if (!id) return;
    if (!S.lbList.includes(id)) S.lbList = [id];
    S.lbIndex = S.lbList.indexOf(id);
    $("#lightbox").hidden = false; document.body.style.overflow = "hidden";
    renderLB();
  }
  function closeLB() { $("#lightbox").hidden = true; document.body.style.overflow = ""; }
  function renderLB() {
    const b = byId(S.lbList[S.lbIndex]); if (!b) return closeLB();
    if (!b.tracked) return b.category === "templates" ? renderLBTemplate(b) : renderLBOffer(b);
    const rows = rowsOf(b);
    const st = sumStock(rows);
    const ev = S.view === "catalogue" ? evById(S.planEvent) : null;
    const locked = ev && eventStatus(ev.event_id) && eventStatus(ev.event_id) !== "Requested";
    const ids = rows.map((r) => r.banner_id);
    const bookings = S.bookings.filter((x) => ids.includes(x.banner_id) && x.status !== "Returned").map((x) => ({ ...x, ev: evById(x.event_id) })).filter((x) => x.ev);
    const lastMoves = S.movements.filter((m) => ids.includes(m.banner_id)).slice(-5).reverse();
    const src = imgSrc(b);
    $(".lb-prev").style.visibility = S.lbList.length > 1 ? "visible" : "hidden";
    $(".lb-next").style.visibility = S.lbList.length > 1 ? "visible" : "hidden";
    $("#lb-body").innerHTML = `
      <div class="lb-image" data-act="zoom">
        ${facesOf(b).length ? `<div class="sides-view">${facesOf(b).map((x, i) => `<figure><img src="${esc(x.src)}" alt="${esc(x.label)}"><figcaption>Side ${i + 1} – ${esc(x.label)}</figcaption></figure>`).join("")}</div><span class="hint">Double sided – both sides shown · ← → to browse · Esc to close</span>`
          : src ? `<img src="${esc(src)}" alt="${esc(b.name)}"><span class="hint">Click image to zoom · ← → to browse · Esc to close</span>` : `<div class="placeholder" style="color:#fff;opacity:.7">No artwork yet</div>`}
      </div>
      <div class="lb-info">
        <div>
          <div class="muted" style="font-size:12px">${esc(b.banner_id)} · ${S.lbIndex + 1} of ${S.lbList.length}</div>
          <h2>${esc(b.name)}</h2>
          <div class="card-meta" style="margin-top:8px">
            <span class="pill accent">${esc(b.language)}</span><span class="pill">${esc(b.brand)}</span>${b.banner_type && b.banner_type !== "Large banner" ? `<span class="pill">${esc(b.banner_type)}</span>` : ""}
            ${b.action_needed ? `<span class="pill warn">${esc(b.action_needed)}</span>` : ""}
            ${b.status && b.status !== "In use" ? `<span class="pill warn">${esc(b.status)}</span>` : ""}
          </div>
        </div>
        <div class="stock-row">
          <div class="stock-box"><b>${st.owned}</b><span>Owned</span></div>
          <div class="stock-box"><b>${st.out}</b><span>Out now</span></div>
          <div class="stock-box"><b style="color:${st.available ? "var(--good)" : "var(--bad)"}">${st.available}</b><span>In store</span></div>
        </div>
        <dl class="facts">
          <dt>Section</dt><dd>${esc(b.section)}</dd>
          ${b.size ? `<dt>Size</dt><dd>${esc(b.size)}</dd>` : ""}
          <dt>Last audit</dt><dd>${esc(b.last_audit || "—")} ${b.verified_in_audit === "Yes" ? '<span class="pill good">checked</span>' : '<span class="pill">not checked</span>'}</dd>
          ${b.notes ? `<dt>Notes</dt><dd style="font-weight:500">${esc(b.notes)}</dd>` : ""}
          ${b.artwork_date ? `<dt>Artwork date</dt><dd>${esc(b.artwork_date)}</dd>` : ""}
          ${b.artwork_file ? `<dt>Artwork</dt><dd style="font-weight:500;font-size:11px;word-break:break-word">All Banners / ${esc(b.artwork_file)}</dd>` : ""}
        </dl>
        ${(() => { const fe = uniq([...S.events.filter((e) => String(e.featured_items || "").split(/[,\s]+/).some((x) => ids.includes(x))), ...ids.flatMap((x) => [...((S.usedAt && S.usedAt.get(x)) || [])]).map(evById).filter(Boolean)]).sort((a, z) => (z.start_date || "").localeCompare(a.start_date || "")); return fe.length ? `<div class="lb-section"><b>Used at events</b>${fe.map((e) => `<div><a href="#events" data-act="open-event" data-id="${esc(e.event_id)}">${esc(e.event_name)}</a> <span class="muted">· ${fmtDate(e.start_date)}${e.end_date && e.end_date !== e.start_date ? " – " + fmtDate(e.end_date) : ""}</span></div>`).join("")}</div>` : ""; })()}
        ${sidesOf(b).length ? `<div class="lb-section"><b>Also in From past events</b>
          <div class="sides">${sidesOf(b).map((x) => `<button class="side" data-zoom="${esc(x.banner_id)}" title="Open ${esc(x.banner_id)}"><img src="${esc(x.thumbnail)}" alt=""><span>${esc(x.name)}<br><i>${esc(x.banner_id)}</i></span></button>`).join("")}</div></div>` : ""}
        <div class="lb-section">
          <b>Where it's kept</b>
          <table class="tbl loc-tbl"><tbody>
          ${rows.map((r) => { const rs = stock(r); return `<tr>
            <td><b>${esc(r.stored_at)}</b><div class="muted" style="font-size:11px">${esc(r.banner_id)} · ${rs.away ? `${rs.owned} there · not monitored (only UK stock is counted in and out)` : `${rs.available} in store${rs.out ? ` · ${rs.out} out` : ""}`}</div></td>
            <td class="num"><input type="number" min="0" value="${rs.owned}" data-adjqty="${esc(r.banner_id)}" aria-label="Number owned at ${esc(r.stored_at)}" style="width:58px"></td>
            <td class="num" style="white-space:nowrap"><button class="btn small" data-act="broken" data-id="${esc(r.banner_id)}" ${rs.owned ? "" : "disabled"} title="Take one out of stock as broken">Broken</button>
              <button class="btn small" data-act="move" data-id="${esc(r.banner_id)}" title="Change where it's stored">Move…</button></td>
            ${ev ? `<td class="num"><div class="stepper" style="border:0;padding:0;gap:6px">
              <button data-step="-1" data-id="${esc(r.banner_id)}" ${locked ? "disabled" : ""}>−</button><span class="q">${num(S.draft[r.banner_id])}</span>
              <button data-step="1" data-id="${esc(r.banner_id)}" ${locked ? "disabled" : ""}>+</button></div></td>` : ""}
          </tr>`; }).join("")}
          </tbody></table>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            <button class="btn small" data-act="adjust">Save stock counts</button>
            <span class="muted" style="font-size:12px">${ev ? `Use − / + to pick from a location for ${esc(ev.event_name)}. ` : ""}Number owned per location – changes go in the activity log.</span>
          </div>
        </div>
        ${bookings.length ? `<div class="lb-section"><b>Booked for events</b>
          ${bookings.map((x) => `<div>${esc(x.ev.event_name)} <span class="muted">· ${fmtDate(x.ev.start_date)} · from ${esc(byId(x.banner_id)?.stored_at || "")}</span> · <b>${x.qty}</b> <span class="pill">${esc(x.status)}</span></div>`).join("")}</div>` : ""}
        ${lastMoves.length ? `<div class="lb-section"><b>Recent activity</b>${lastMoves.map((m) => `<div class="muted" style="font-size:12px">${esc((m.timestamp || "").slice(0, 10))} · ${esc(m.type)} ${m.qty} ${m.event_id ? "· " + esc(evById(m.event_id)?.event_name || m.event_id) : ""} · ${esc(m.by)}</div>`).join("")}</div>` : ""}
      </div>`;
  }

  function renderLBTemplate(b) {
    const ev = S.view === "catalogue" ? evById(S.planEvent) : null;
    const locked = ev && eventStatus(ev.event_id) && eventStatus(ev.event_id) !== "Requested";
    const styles = b.styles.map(byId).filter(Boolean);
    $(".lb-prev").style.visibility = S.lbList.length > 1 ? "visible" : "hidden";
    $(".lb-next").style.visibility = S.lbList.length > 1 ? "visible" : "hidden";
    $("#lb-body").innerHTML = `
      <div class="lb-image style-wall">
        ${styles.map((x) => `<figure data-zoom="${esc(x.banner_id)}" title="Open ${esc(x.name)}"><img src="${esc(x.thumbnail)}" alt="${esc(x.name)}"><figcaption>${esc(styleName(x))}</figcaption></figure>`).join("")}
        <span class="hint">Every style we've made so far · click one to see it large · ← → to browse · Esc to close</span>
      </div>
      <div class="lb-info">
        <div>
          <div class="muted" style="font-size:12px">${S.lbIndex + 1} of ${S.lbList.length} · ${esc(b.section)}</div>
          <h2>${esc(b.name)}</h2>
          <div class="card-meta" style="margin-top:8px"><span class="pill design">🎨 Made new for each event</span><span class="pill">${styles.length} style${styles.length > 1 ? "s" : ""}</span></div>
        </div>
        <div class="design-note">🎨 <b>The design team makes this fresh for each event.</b> Choose the style to copy – they'll change the event name, dates, venue and offers. It then appears in <b>Reports › Design jobs</b>. The warehouse doesn't pick it.</div>
        ${ev ? "" : `<div class="muted" style="font-size:13px">To ask for one, choose an event under <b>Plan for an event</b> first.</div>`}
        <div class="lb-section">
          <b>${ev ? `Choose a style for ${esc(ev.event_name)}` : "Styles"}</b>
          ${styles.map((x) => `<div class="style-row">
            <img src="${esc(x.thumbnail)}" alt="" data-zoom="${esc(x.banner_id)}">
            <div><b>${esc(styleName(x))}</b><div class="muted" style="font-size:12px">${esc(x.format || "")} · ${esc(x.language || "")} · ${esc(x.version || "")}</div></div>
            ${ev ? `<div class="stepper" style="border:0;padding:0">
              <button data-step="-${stepOf(x)}" data-id="${esc(x.banner_id)}" ${locked ? "disabled" : ""} aria-label="Fewer">−</button>
              <div style="text-align:center"><div class="q">${num(S.draft[x.banner_id])}</div><div class="avail">copies</div></div>
              <button data-step="${stepOf(x)}" data-id="${esc(x.banner_id)}" ${locked ? "disabled" : ""} aria-label="More">+</button></div>` : ""}
          </div>`).join("")}
        </div>
      </div>`;
  }
  function renderLBOffer(b) {
    const ev = S.view === "catalogue" ? evById(S.planEvent) : null;
    const locked = ev && eventStatus(ev.event_id) && eventStatus(ev.event_id) !== "Requested";
    const used = S.bookings.filter((x) => x.banner_id === b.banner_id).map((x) => ({ ...x, ev: evById(x.event_id) })).filter((x) => x.ev);
    $(".lb-prev").style.visibility = S.lbList.length > 1 ? "visible" : "hidden";
    $(".lb-next").style.visibility = S.lbList.length > 1 ? "visible" : "hidden";
    $("#lb-body").innerHTML = `
      <div class="lb-image pages" data-act="zoom">
        <img src="${esc(b.thumbnail)}" alt="${esc(b.name)} – page 1">
        ${b.thumbnail_2 && showPage2(b) ? `<img src="${esc(b.thumbnail_2)}" alt="${esc(b.name)} – page 2">` : ""}
        <span class="hint">Click to zoom · ← → to browse · Esc to close</span>
      </div>
      <div class="lb-info">
        <div>
          <div class="muted" style="font-size:12px">${esc(b.banner_id)} · ${S.lbIndex + 1} of ${S.lbList.length}</div>
          <h2>${esc(b.name)}</h2>
          <div class="card-meta" style="margin-top:8px">${[b.currency || b.language, b.region].filter(Boolean).map((v, i) => `<span class="pill ${i ? "" : "accent"}">${esc(v)}</span>`).join("")}<span class="pill good">${esc(b.status || "Final")}</span>
          ${b.event_specific ? `<span class="pill warn">${esc(b.event_specific)}</span>` : ""}</div>
        </div>
        ${linkOf(b) ? `<div class="design-note stock">✓ <b>This is a physical item we own:</b> ${esc(linkOf(b).name)} (${esc(linkOf(b).banner_id)}, ${esc(linkOf(b).stored_at)} · ${stock(linkOf(b)).available} in store). Picking it books that backdrop for the warehouse to pack.
          <button class="btn small" data-zoom="${esc(linkOf(b).banner_id)}">View it in Large banners →</button></div>` : ""}
        ${b.banner_ref && byId(b.banner_ref) ? `<div class="lb-section"><b>Banner record</b><div style="margin-top:6px"><button class="btn small" data-zoom="${esc(b.banner_ref)}">${esc(byId(b.banner_ref).name)} (${esc(b.banner_ref)}) in Roll-up banners →</button></div></div>` : ""}
        ${b._posterOf ? `<div class="design-note stock">🖼 <b>Front of an order form, used as a poster.</b> ${esc(b.notes)} <button class="btn small" data-zoom="${esc(b._posterOf)}">See the full form →</button></div>`
          : byId(b.banner_id + POSTER_SUFFIX) ? `<div class="lb-section"><b>Also as a poster</b><div class="muted" style="font-size:12px;margin-top:4px">The front page can be printed on its own (A3 or A4) to advertise the offer.</div><div style="margin-top:6px"><button class="btn small" data-zoom="${esc(b.banner_id + POSTER_SUFFIX)}">Use the front as a poster →</button></div></div>` : ""}
        ${isGeneric(b) ? `<div class="design-note">♻️ <b>Generic – reuse as it is.</b> It was used at ${esc(shortEv(b.event_id))} but doesn't name the event, so it can simply be reprinted${/end date/.test(b.notes || "") ? " (check the offer end date first)" : ""}.</div>` : ""}
        ${isDesign(b) ? `<div class="design-note">🎨 <b>Made for a past event.</b> Picking it for a new event adds a job for the design team to make one in this style (see <b>Reports › Design jobs</b>) – the warehouse won't pick it.</div>` : ""}
        ${CFG.allowDownloads && b.print_file ? `<a class="btn ${isDesign(b) ? "" : "primary"}" href="${esc(b.print_file)}" target="_blank" rel="noopener">${isDesign(b) ? "Open the original PDF" : "Open print-ready PDF"}</a>` : ""}
        ${variantsOf(b).length > 1 ? `<div class="lb-section"><b>Regional versions</b><div class="locs" style="margin-top:6px">${variantsOf(b).map((x) => `<button class="loc ${x.banner_id === b.banner_id ? "on" : ""}" data-zoom="${esc(x.banner_id)}">${esc(x.edition || x.banner_id)}</button>`).join("")}</div><div class="muted" style="font-size:12px;margin-top:4px">Same design – only the logos, website and education links change. <b>Nordic Labs region:</b> Denmark, Sweden, Finland, UK, Germany, Portugal. <b>Canada:</b> dual branded. <b>Everywhere else:</b> dnalife.${(() => { const ev = evById(S.planEvent); return ev && ev.country ? ` For ${esc(ev.event_name)} (${esc(ev.country)}) use the <b>${esc(regionOf(ev.country))}</b> version.` : ""; })()}</div></div>` : ""}
        <dl class="facts">
          <dt>Type</dt><dd>${esc(b.section)}</dd>
          ${b.kind ? `<dt>Kind</dt><dd>${esc(b.kind)}</dd>` : ""}
          <dt>Format</dt><dd>${esc(b.format)} · ${esc(b.pages)} page${num(b.pages) > 1 ? "s" : ""}</dd>
          ${b.currency ? `<dt>Currency</dt><dd>${esc(b.currency)}</dd>` : ""}
          ${b.language && b.category !== "offers" ? `<dt>Language</dt><dd>${esc(b.language)}</dd>` : ""}
          ${b.region ? `<dt>${b.category === "posters" ? "Market" : "Country / VAT"}</dt><dd>${esc(b.region)}</dd>` : ""}
          ${b.event_specific ? `<dt>Made for</dt><dd>${esc(b.event_specific)}</dd>` : ""}
          <dt>Brand</dt><dd>${esc(b.brand)}</dd>
          ${b.category === "pastevents" ? `<dt>Made for</dt><dd>${esc(evById(b.event_id)?.event_name || b.section)}</dd>` : ""}
          <dt>Version</dt><dd>${esc(b.version)}</dd>
          ${b.notes ? `<dt>Notes</dt><dd style="font-weight:500">${esc(b.notes)}</dd>` : ""}
          ${b.source_file ? `<dt>Design file</dt><dd style="font-weight:500;font-size:11px;word-break:break-word">${/^(Print Materials|TESTS & CLINICAL MATERIALS|Promotions For Events)\//.test(b.source_file) ? "" : (b._posterOf ? "Special Offers" : ({ posters: "Posters", brochures: "Print Materials", pricelists: "Price lists", pastevents: "Archived event materials", digital: "Archived event materials" })[b.category] || "Special Offers") + " / "}${esc(b.source_file)}</dd>` : ""}
        </dl>
        ${ev && isOneOff(b) ? `<div class="lb-section"><b>For ${esc(ev.event_name)}</b><div style="margin-top:6px">${tickHTML(b, num(S.draft[b.banner_id]) > 0, locked)}</div></div>` : ""}
        ${ev && !linkOf(b) && !isOneOff(b) ? `<div class="lb-section">
          <b>Copies for ${esc(ev.event_name)}</b>
          <div class="stepper" style="border:0;padding:0">
            <button data-step="-${stepOf(b)}" data-id="${esc(b.banner_id)}" ${locked ? "disabled" : ""}>−</button>
            <div class="q">${num(S.draft[b.banner_id])}</div>
            <button data-step="${stepOf(b)}" data-id="${esc(b.banner_id)}" ${locked ? "disabled" : ""}>+</button>
          </div></div>` : ""}
        <div class="lb-section">
          <b>Used at events</b>
          ${used.length ? used.map((x) => `<div>${esc(x.ev.event_name)} <span class="muted">· ${fmtDate(x.ev.start_date)}</span> · <b>${x.qty}</b> copies</div>`).join("") : usedAt(b).length ? usedAt(b).map((e) => `<div>${esc(e.event_name)} <span class="muted">· ${fmtDate(e.start_date)}</span></div>`).join("") : '<span class="muted">Not used at any event yet.</span>'}
        </div>
      </div>`;
  }

  // ───────────────────────── events ────────────────────────
  const TYPES = () => uniq([...(CFG.eventTypes || []), ...S.events.map((e) => e.event_type)]);
  // Kit list: everything taken to an event (from the events team's packing spreadsheet), linked to catalogue items where we can
  function kitTable(evId, forPrint) {
    const rows = (S.kits || []).filter((x) => x.event_id === evId); let g = null, d = null, out = "";
    rows.forEach((r) => {
      if (r.group !== g) { g = r.group; d = null; out += `<tr class="wh-band"><td colspan="4">${esc(g || "Other")}</td></tr>`; }
      if ((r.day || "") !== (d || "") && r.day) { d = r.day; out += `<tr class="kit-day"><td colspan="4">📦 ${esc(d)} box</td></tr>`; }
      const its = String(r.item_ref || "").split(/[\s,]+/).map(byId).filter(Boolean), it = its[0]; // one line can cover several items (e.g. folders 1 & 2)
      out += `<tr><td>${it && !forPrint ? its.map((x) => `<span data-zoom="${esc(x.banner_id)}" style="cursor:zoom-in">${thumbHTML(x)}</span>`).join(" ") : ""}</td>
        <td>${r.timing ? `<span class="pill">${esc(r.timing)}</span> ` : ""}<b>${esc(r.item)}</b>${its.map((x) => `<div class="muted">${esc(x.banner_id)} · ${esc(x.name)}</div>`).join("")}</td>
        <td class="num">${esc(r.qty || "—")}</td><td>${forPrint ? "☐" : it ? "" : `<span class="muted" style="font-size:12px">not in catalogue</span>`}</td></tr>`;
    });
    return `<table class="tbl"><thead><tr><th></th><th>Item</th><th class="num">Qty</th><th></th></tr></thead><tbody>${out}</tbody></table>`;
  }
  function viewEvents() {
    const all = S.events.slice().sort((a, b) => (a.start_date || "").localeCompare(b.start_date || ""));
    const archive = S.evTab === "archive";
    let list = all.filter((e) => (archive ? isClosed(e) : !isClosed(e)));
    if (archive) list.reverse();
    const pool = list;
    if (S.evType !== "all") list = list.filter((e) => e.event_type === S.evType);
    const types = TYPES();
    return `
      <div class="page-head">
        <div><h1>Events</h1><div class="muted">${LIVE ? "Events live in the Events tab of the Google Sheet – edit them there or add one here." : "Demo mode – events come from data/events.csv. New ones are saved in this browser."}</div></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" data-act="toggle-request">📨 Request an event</button><button class="btn primary" data-act="toggle-new-event">+ New event</button></div>
      </div>
      ${S.runupEvent && evById(S.runupEvent) ? runupPanel(S.runupEvent) : ""}
      ${S.kitEvent && evById(S.kitEvent) ? `<div class="panel kit-panel" style="margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center">
          <div><h2 style="margin:0">📋 Kit list – ${esc(evById(S.kitEvent).event_name)}</h2><div class="muted">Everything the events team took, from their packing spreadsheet. Items with a picture are linked to the catalogue – click to see them large.</div></div>
          <div style="display:flex;gap:8px"><button class="btn small" data-act="print-kit">Print</button><button class="btn small" data-act="show-kit" data-id="${esc(S.kitEvent)}">Close</button></div></div>
        <div class="table-wrap" style="margin-top:10px">${kitTable(S.kitEvent)}</div></div>` : ""}
      ${S.showRequest ? `<form class="panel" id="event-request" style="margin-bottom:16px">
        <h2>Request an event</h2>
        <p class="muted" style="margin-top:0">For sales colleagues who'd like to run an event, or are attending or exhibiting at one and need materials. It's emailed to the events team${CFG.requestEmail ? ` (<a href="mailto:${esc(CFG.requestEmail)}">${esc(CFG.requestEmail)}</a>)` : ""}, who will pick it up and plan what to send.${LIVE ? "" : " <b>Demo mode:</b> no email is sent until the site is connected to the Google Sheet."}</p>
        <div class="form-grid">
          <label>Your name*<input type="text" name="requested_by" required></label>
          <label>Your work email*<input type="email" name="requester_email" required placeholder="name@nordicgroup.eu"></label>
          <label>What's the request?*<select name="request_type" required><option>We'd like to run an event</option><option>I'm attending / exhibiting at an event</option></select></label>
          <label>Type of event<select name="event_type">${types.map((t) => `<option ${t === "External" ? "selected" : ""}>${esc(t)}</option>`).join("")}</select></label>
          <label>Event name*<input type="text" name="event_name" required></label>
          <label>Start date*<input type="date" name="start_date" required></label>
          <label>End date<input type="date" name="end_date"></label>
          <label>Venue<input type="text" name="venue"></label>
          <label>City<input type="text" name="city"></label>
          <label>Country<input type="text" name="country"></label>
          <label>Expected attendees<input type="number" name="attendees" min="0"></label>
          <label>Brand / region<select name="brand_region"><option>Nordic Labs region</option><option>dnalife region</option><option>Both</option><option>Not sure</option></select></label>
        </div>
        <fieldset class="req-mats"><legend>Materials you'd like</legend>
          ${["Roll-up banners", "Backdrop / large banner", "Posters", "Brochures & flyers", "Test price lists", "Special offer forms", "Name badges", "Certificates", "Vouchers", "Not sure – please advise"].map((m) => `<label><input type="checkbox" name="materials" value="${esc(m)}"> ${esc(m)}</label>`).join("")}
        </fieldset>
        <label class="muted" style="display:block;margin-top:10px">Anything else? (stand size, delivery contact, deadlines…)<textarea name="notes" rows="2"></textarea></label>
        <p class="muted" style="font-size:12px">Your email and delivery details go only to the events team, not onto this page.</p>
        <div style="margin-top:12px;display:flex;gap:8px"><button class="btn primary" type="submit">Send request</button><button class="btn" type="button" data-act="toggle-request">Cancel</button></div>
      </form>` : ""}
      <div class="ev-switch">
        <button class="${!archive ? "on" : ""}" data-evtab="upcoming"><b>Current events</b><span class="n">${all.filter((e) => !isClosed(e)).length}</span><small>Compiling materials now</small></button>
        <button class="${archive ? "on" : ""}" data-evtab="archive"><b>Previous events</b><span class="n">${all.filter(isClosed).length}</span><small>What we took and made – browse, reuse or adapt</small></button>
      </div>
      <div class="subtabs">
        <button class="chip ${S.evType === "all" ? "on" : ""}" data-evtype="all">All types<span class="n">${pool.length}</span></button>
        ${types.map((t) => `<button class="chip ${S.evType === t ? "on" : ""}" data-evtype="${esc(t)}">${esc(t)}<span class="n">${pool.filter((e) => e.event_type === t).length}</span></button>`).join("")}
      </div>
      ${S.requestMail ? `<div class="panel" style="margin-bottom:16px;border:2px solid var(--accent,#006a84)">
        <h2 style="margin-top:0">📨 One more step – send the email</h2>
        <p class="muted" style="margin-top:0">This preview isn't connected to the Google Sheet yet, so it can't email the events team by itself. Your request is on the events list – click below to open it as a ready-written email to ${esc(CFG.requestEmail)}.</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap"><a class="btn primary" href="${esc(S.requestMail)}" target="_blank" rel="noopener">Open email to ${esc(CFG.requestEmail)}</a><button class="btn" data-act="close-request-mail">Done</button></div></div>` : ""}
      ${S.showNewEvent ? `<form class="panel" id="new-event" style="margin-bottom:16px">
        <h2>New event</h2>
        <div class="form-grid">
          <label>Event name*<input type="text" name="event_name" required></label>
          <label>Type*<select name="event_type" required>${types.map((t) => `<option>${esc(t)}</option>`).join("")}</select></label>
          <label>Start date*<input type="date" name="start_date" required></label>
          <label>End date<input type="date" name="end_date"></label>
          <label>Venue<input type="text" name="venue"></label>
          <label>City<input type="text" name="city"></label>
          <label>Country<input type="text" name="country"></label>
          <label>Ship by<input type="date" name="ship_by"></label>
          <label>Back in store by<input type="date" name="return_by"></label>
          <label>Owner<input type="text" name="owner"></label>
        </div>
        <label class="muted" style="display:block;margin-top:10px">Notes<textarea name="notes" rows="2"></textarea></label>
        <div style="margin-top:12px;display:flex;gap:8px"><button class="btn primary" type="submit">Add event</button><button class="btn" type="button" data-act="toggle-new-event">Cancel</button></div>
      </form>` : ""}
      ${list.length ? `<div class="events-grid">${list.map((e) => eventCard(e, archive)).join("")}</div>`
        : `<div class="empty"><h2>${archive ? "No previous events yet" : "No current events"}</h2><p>${archive ? "Events move here automatically once they've finished." : "Add one with “New event”."}</p></div>`}`;
  }
  const TYPE_COLOURS = ["#0d6e7c", "#6b4bb8", "#c76a00", "#4a5866", "#1b7a46", "#b3261e"];
  const typeColour = (t) => TYPE_COLOURS[Math.max(0, TYPES().indexOf(t)) % TYPE_COLOURS.length];
  function eventCard(e, archive) {
    const rows = S.bookings.filter((b) => b.event_id === e.event_id);
    const st = eventStatus(e.event_id);
    const units = rows.reduce((s, r) => s + r.qty, 0);
    const pill = { Requested: "accent", Dispatched: "warn", Returned: "good" }[st] || "";
    const mv = S.movements.filter((m) => m.event_id === e.event_id);
    const lost = mv.filter((m) => m.type === "missing" || m.type === "damaged").reduce((s, m) => s + m.qty, 0);
    return `<div class="panel event-card" id="ev-${esc(e.event_id)}" style="border-top:4px solid ${typeColour(e.event_type)}">
      ${e.event_type ? `<div><span class="pill" style="background:${typeColour(e.event_type)};color:#fff">${esc(e.event_type)}</span></div>` : ""}
      <div class="date">${fmtDate(e.start_date)}${e.end_date && e.end_date !== e.start_date ? " – " + fmtDate(e.end_date) : ""}</div>
      <h3>${esc(e.event_name)}</h3>
      <div class="muted">${esc([e.venue, e.city, e.country].filter(Boolean).join(" · "))}</div>
      <div class="card-meta">
        ${e.status ? `<span class="pill">${esc(e.status)}</span>` : ""}
        ${st ? `<span class="pill ${pill}">Materials: ${esc(st)}</span>` : `<span class="pill">No materials picked</span>`}
        ${e.ship_by ? `<span class="pill">Ship by ${fmtDate(e.ship_by)}</span>` : ""}
        ${e.owner ? `<span class="pill">${esc(e.owner)}</span>` : ""}
      </div>
      ${e.featured_items ? (() => { const fb = uniq(String(e.featured_items).split(/[,\s]+/)).map(byId).filter(Boolean); return `<div class="featured">${fb.map((b) => `<div data-zoom="${esc(b.banner_id)}" title="${esc(b.name)}">${imgSrc(b) ? `<img src="${esc(imgSrc(b))}" alt="${esc(b.name)}" loading="lazy">` : ""}</div>`).join("")}</div>
      <div class="feat-cap"><b>Materials for this event:</b> ${fb.map((b) => `<a href="#" data-zoom="${esc(b.banner_id)}">${esc(b.name)}</a>`).join(" · ")}</div>`; })() : ""}
      ${e.country ? `<div class="muted" style="font-size:12px">Branding: <b>${esc(regionOf(e.country))}</b></div>` : ""}
      ${e.status === "Requested" || e.requested_by ? `<div class="request-box"><b>📨 Requested by ${esc(e.requested_by || "sales")}</b>${e.request_type ? ` · ${esc(e.request_type)}` : ""}
        ${e.materials_requested ? `<div>Wants: ${esc(e.materials_requested)}</div>` : ""}${e.attendees ? `<div class="muted">~${esc(e.attendees)} attendees${e.brand_region ? " · " + esc(e.brand_region) : ""}</div>` : e.brand_region ? `<div class="muted">${esc(e.brand_region)}</div>` : ""}</div>` : ""}
      ${!archive ? (() => { const jobs = S.ideas.filter((j) => j.event_id === e.event_id), open = jobs.filter((j) => ["New", "In design"].includes(j.status)).length;
        return `<div class="compile"><b>${rows.length ? `${rows.length} item${rows.length > 1 ? "s" : ""} on the list` : "Nothing picked yet"}</b>${jobs.length ? ` · <a href="#reports" data-act="go-jobs">${open} of ${jobs.length} design job${jobs.length > 1 ? "s" : ""} still to make</a>` : ""}</div>`; })() : ""}
      ${rows.length ? `<div class="strip">${rows.slice(0, 12).map((r) => thumbHTML(byId(r.banner_id) || {})).join("")}</div><div class="muted">${rows.length} designs · ${units} banners${archive && st === "Returned" ? (lost ? ` · <b style="color:var(--bad)">${lost} damaged/missing</b>` : " · all returned") : ""}</div>` : archive && !e.featured_items ? `<div class="muted">No materials recorded</div>` : ""}
      ${e.notes ? `<div class="muted" style="font-size:12px">${esc(e.notes)}</div>` : ""}
      ${(() => { const k = (S.kits || []).filter((x) => x.event_id === e.event_id); return k.length ? `<button class="btn small kit-btn" data-act="show-kit" data-id="${esc(e.event_id)}">📋 Full kit list · ${k.length} lines</button>` : ""; })()}
      ${(() => { const d = S.banners.filter((b) => b.category === "digital" && b.event_id === e.event_id); return d.length ? `<button class="btn small kit-btn" data-act="show-runup" data-id="${esc(e.event_id)}">📱 Digital run-up · ${d.length} assets</button>` : ""; })()}
      ${(() => { const made = collapsePrint(S.banners.filter((b) => b.category === "pastevents" && b.event_id === e.event_id)); return made.length ? `<button class="made" data-act="show-made" data-id="${esc(e.event_id)}">
        <span class="made-strip">${made.slice(0, 6).map((b) => `<img src="${esc(b.thumbnail)}" alt="" loading="lazy">`).join("")}</span>
        <span><b>${made.length} materials made for this event</b><br><span class="muted">Browse, reuse or adapt them</span></span></button>` : ""; })()}
      <div class="actions">
        ${archive ? `<button class="btn small" data-act="reuse" data-id="${esc(e.event_id)}" ${rows.length ? "" : "disabled"} title="Copy this list into an upcoming event">Reuse list…</button>` : ""}
        <button class="btn ${archive ? "" : "primary"} small" data-act="plan" data-id="${esc(e.event_id)}">${st && st !== "Requested" ? "View materials" : rows.length ? "Edit materials" : "Pick materials"}</button>
        ${rows.length ? `<button class="btn small" data-act="to-warehouse" data-id="${esc(e.event_id)}">Warehouse</button>
        <button class="btn small" data-act="export-event" data-id="${esc(e.event_id)}">CSV</button>` : ""}
        ${LIVE || e._added ? `<button class="btn small danger-btn" data-act="delete-event" data-id="${esc(e.event_id)}" title="Delete this event, its materials list and any design jobs not started yet">${S.confirmDel === e.event_id ? "Click again to delete" : "Delete"}</button>` : ""}
      </div>
    </div>`;
  }

  // ───────────────────────── warehouse ─────────────────────
  // Warehouse groups every kind of material – stock items to pick, print items to collect from the print run, design jobs to pack once printed
  const WH_GROUPS = [["banners", "Roll-up banners"], ["backlit", "Backlit banners"], ["large", "Large banners & backdrops"], ["misc", "Stands & extras"], ["posters", "Posters"],
    ["brochures", "Brochures & flyers"], ["clinical", "Clinical handouts & guides"], ["pricelists", "Price lists"], ["offers", "Special offer forms"], ["made", "Made for this event (design team)"]];
  const whGroup = (b) => (isDesign(b) ? "made" : b.category === "misc" ? "misc" : b.tracked ? ((b.cats || []).find((c) => ["banners", "backlit", "large"].includes(c)) || "banners") : b.category || "posters");
  const whKind = (b) => (isDesign(b) ? "design" : b.consumable ? "supply" : b.tracked ? "stock" : "print");
  function whRows(eventId) {
    const order = WH_GROUPS.map((g) => g[0]);
    return S.bookings.filter((x) => x.event_id === eventId).map((r) => ({ ...r, b: byId(r.banner_id) || { banner_id: r.banner_id, name: r.banner_id, tracked: true } }))
      .map((r) => ({ ...r, g: whGroup(r.b), kind: whKind(r.b) }))
      .sort((x, y) => order.indexOf(x.g) - order.indexOf(y.g) || LOC_ORDER(x.b.stored_at) - LOC_ORDER(y.b.stored_at) || (x.b.name || "").localeCompare(y.b.name || ""));
  }
  function whFrom(r, ev) {
    if (r.kind === "stock") return esc(r.b.stored_at || "");
    if (r.kind === "print") return `<span class="pill">🖨 Print run</span>`;
    if (r.kind === "supply") return `${esc(r.b.stored_at || "")} <span class="pill">used up</span>`;
    const q = designReq(ev.event_id, r.banner_id);
    return `<span class="pill ${q && q.status === "Done" ? "good" : "design"}">🎨 ${q ? (q.status === "Done" ? "Designed – print" : "Design: " + esc(jobLabel(q.status))) : "Not started"}</span>`;
  }
  function viewWarehouse() {
    const evIds = uniq(S.bookings.map((b) => b.event_id));
    const evs = evIds.map(evById).filter(Boolean).sort((a, b) => (a.ship_by || a.start_date || "").localeCompare(b.ship_by || b.start_date || ""));
    if (!S.whEvent || !evIds.includes(S.whEvent)) S.whEvent = (evs.find((e) => eventStatus(e.event_id) !== "Returned") || evs[0] || {}).event_id || "";
    const ev = evById(S.whEvent);
    const head = `<div class="page-head">
      <div><h1>Warehouse</h1><div class="muted">Pack and send everything for each event – banners from the store, printed materials from the print run – then count the stock items back in.</div></div>
      <select data-act="wh-select" aria-label="Event">${evs.map((e) => `<option value="${esc(e.event_id)}" ${e.event_id === S.whEvent ? "selected" : ""}>${esc(e.event_name)} · ${esc(eventStatus(e.event_id))}</option>`).join("")}</select>
    </div>`;
    if (!ev) return head + `<div class="empty"><h2>Nothing to pack yet</h2><p>Once someone saves a materials list for an event, it shows up here.</p></div>`;
    const st = eventStatus(ev.event_id);
    const rows = whRows(ev.event_id);
    S.lbList = rows.map((r) => r.banner_id);
    const steps = ["Requested", "Dispatched", "Returned"];
    const idx = steps.indexOf(st);
    const stepper = `<div class="status-steps">${steps.map((s, i) => `<span class="s ${i < idx ? "done" : i === idx ? "on" : ""}">${i + 1}. ${s === "Requested" ? "Pick & pack" : s === "Dispatched" ? "Out at event" : "Checked back in"}</span>`).join('<span class="muted">→</span>')}</div>`;
    const cnt = (k) => rows.filter((r) => r.kind === k).length;
    const info = `<div class="panel" style="margin-bottom:14px"><h2 style="margin:0">${esc(ev.event_name)}</h2>
      <div class="muted">${esc([ev.venue, ev.city, ev.country].filter(Boolean).join(" · "))} · ${fmtDate(ev.start_date)} · <b>Ship by ${fmtDate(ev.ship_by) || "—"}</b> · back by ${fmtDate(ev.return_by) || "—"}</div>${stepper}
      <div class="wh-sum"><span><b>${cnt("stock") + cnt("supply")}</b> from the store</span><span><b>${cnt("print")}</b> to print</span><span><b>${cnt("design")}</b> being made by design</span></div></div>`;
    if (st === "Requested") {
      const allPacked = rows.every((r) => S.packed.has(ev.event_id + "|" + r.banner_id));
      const body = WH_GROUPS.map(([g, label]) => { const gr = rows.filter((r) => r.g === g); if (!gr.length) return "";
        return `<tr class="wh-band"><td colspan="7">${esc(label)} <span class="muted">· ${gr.length}</span></td></tr>` + gr.map((r) => {
          const k = ev.event_id + "|" + r.banner_id; const s = r.kind === "stock" && !r.b.count_needed ? stock(r.b) : null;
          return `<tr class="${S.packed.has(k) ? "done" : ""} ${isOneOff(r.b) ? "" : "drag-row"}" ${isOneOff(r.b) ? "" : `draggable="true" data-drow="${esc(r.banner_id)}"`}><td>${isOneOff(r.b) ? "" : `<span class="grip" title="Drag onto a day box">⠿</span>`}<input type="checkbox" data-pack="${esc(k)}" ${S.packed.has(k) ? "checked" : ""} aria-label="Packed"></td>
            <td>${thumbHTML(r.b)}</td><td><b>${esc(isDesign(r.b) ? designLabel(r.b) : r.b.name)}</b><div class="muted">${esc([r.banner_id, r.b.language, r.b.edition || r.b.format || r.b.banner_type].filter(Boolean).join(" · "))}</div>${r.day ? `<span class="kit-day">📦 ${esc(dayText(r.day))}</span>` : ""}</td>
            <td>${isOneOff(r.b) ? '<span class="muted">digital</span>' : whDaySelect(ev, r)}</td><td>${whFrom(r, ev)}</td><td class="num"><b>${r.qty}</b>${r.kind === "print" || r.kind === "design" ? " copies" : ""}</td>
            <td class="num">${s ? (s.available < r.qty ? `<span class="pill bad">${s.available}</span>` : s.available) : r.b.count_needed ? `<span class="pill warn">count needed</span>` : spareOf(r.banner_id) ? `<span class="pill good" title="Left over from earlier events – send these first and print fewer">${spareOf(r.banner_id)} spare</span>` : "—"}</td></tr>`; }).join(""); }).join("");
      return head + info + dayBoard(ev, rows, false) + `<div class="table-wrap"><table class="tbl">
        <thead><tr><th>Packed</th><th></th><th>Item</th><th>Day box</th><th>From</th><th class="num">Qty</th><th class="num">In store now</th></tr></thead>
        <tbody>${body}</tbody></table></div>
        ${cnt("design") ? `<p class="muted">🎨 Design-team items are packed once they've been designed and printed – track them in <a href="#reports" data-act="go-jobs">Reports › Design jobs</a>.</p>` : ""}
        <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap">
          <button class="btn" data-act="print-pack">Print packing list</button>
          <button class="btn" data-act="export-event" data-id="${esc(ev.event_id)}">Download CSV</button>
          <button class="btn primary" data-act="dispatch" ${allPacked ? "" : "disabled"} title="${allPacked ? "" : "Tick every line as packed first"}">Mark as dispatched</button>
        </div>`;
    }
    if (st === "Dispatched") {
      const back = rows.filter((r) => r.kind === "stock" && !isAway(r.b)), away = rows.filter((r) => r.kind === "stock" && isAway(r.b)), used = rows.filter((r) => r.kind !== "stock");
      return head + info + `<h2>UK stock items to count back in</h2>${away.length ? `<p class="muted" style="margin-top:-6px">Not counted back in – kept in other countries: ${away.map((r) => `${esc(r.b.name)} (${esc(r.b.stored_at)})`).join(" · ")}.</p>` : ""}<div class="table-wrap"><table class="tbl" id="checkin">
        <thead><tr><th></th><th>Item</th><th>Store at</th><th class="num">Sent</th><th class="num">Back OK</th><th class="num" title="Broken items are taken out of stock">Broken</th><th class="num">Missing</th><th>Note</th></tr></thead>
        <tbody>${back.map((r) => `<tr data-row="${esc(r.banner_id)}" data-sent="${r.qty}">
          <td>${thumbHTML(r.b)}</td><td><b>${esc(r.b.name)}</b><div class="muted">${esc(r.banner_id)} · ${esc((WH_GROUPS.find((g) => g[0] === r.g) || [, ""])[1])}</div></td><td>${locSelect(r.b.stored_at || "", 'data-ci="store_at" aria-label="Store at"')}</td>
          <td class="num"><b>${r.qty}</b></td>
          <td class="num"><input type="number" min="0" value="${r.qty}" data-ci="returned"></td>
          <td class="num"><input type="number" min="0" value="0" data-ci="damaged"></td>
          <td class="num"><input type="number" min="0" value="0" data-ci="missing"></td>
          <td><input type="text" data-ci="note" placeholder="optional" style="width:100%"></td></tr>`).join("") || `<tr><td colspan="8" class="muted">No UK stock items were sent.</td></tr>`}</tbody></table></div>
        ${used.length ? `<h2 style="margin-top:22px">Unused materials (optional)</h2>
        <p class="muted" style="margin-top:-6px">Printed items and supplies don't have to come back – but if some are left over and go back on the shelf, count them in here. They're shown as spares and used first next time.</p>
        <div class="table-wrap"><table class="tbl" id="leftovers"><thead><tr><th></th><th>Item</th><th class="num">Sent</th><th class="num">Unused, back in store</th></tr></thead>
        <tbody>${used.map((r) => `<tr data-left="${esc(r.banner_id)}" data-sent="${r.qty}"><td>${thumbHTML(r.b)}</td><td><b>${esc(isDesign(r.b) ? designLabel(r.b) : r.b.name)}</b><div class="muted">${esc(r.banner_id)}</div></td>
          <td class="num">${r.qty}</td><td class="num"><input type="number" min="0" max="${r.qty}" value="0" data-lq></td></tr>`).join("")}</tbody></table></div>` : ""}
        <p class="muted">Broken and missing items are taken off the “owned” count (a banner with none left shows as <b>Broken – out of stock</b>) and recorded in Reports → Losses &amp; damage. Change <b>Store at</b> if it's going back to a different office or country.</p>
        <button class="btn primary" data-act="checkin">Complete check-in</button>`;
    }
    const mv = S.movements.filter((m) => m.event_id === ev.event_id && m.type !== "dispatch");
    const used = rows.filter((r) => r.kind !== "stock");
    return head + info + `<div class="table-wrap"><table class="tbl"><thead><tr><th></th><th>Item</th><th>Result</th><th class="num">Qty</th><th>By</th><th>When</th><th>Note</th></tr></thead>
      <tbody>${mv.map((m) => { const b = byId(m.banner_id) || {}; return `<tr><td>${thumbHTML(b)}</td><td>${esc(b.name || m.banner_id)}</td><td><span class="pill ${m.type === "return" ? "good" : "bad"}">${esc(m.type === "return" ? "back OK" : m.type)}</span></td><td class="num">${m.qty}</td><td>${esc(m.by)}</td><td>${esc((m.timestamp || "").slice(0, 10))}</td><td>${esc(m.note || "")}</td></tr>`; }).join("")}
      ${used.map((r) => `<tr><td>${thumbHTML(r.b)}</td><td>${esc(isDesign(r.b) ? designLabel(r.b) : r.b.name)}</td><td><span class="pill">used at event</span></td><td class="num">${r.qty}</td><td></td><td></td><td class="muted">printed copies</td></tr>`).join("")}</tbody></table></div>`;
  }

  // ───────────────────────── reports ───────────────────────
  function viewReports() {
    const open = S.ideas.filter((i) => i.status === "New" || i.status === "In design").length;
    const tabs = [["jobs", `Design jobs${open ? ` · ${open} to do` : ""}`], ["stock", "Stock levels"], ["out", "Out at events"], ["taken", "Taken at events"], ["losses", "Losses & damage"], ["log", "Activity log"], ["audit", "Visual audit"]];
    const nav = `<div class="page-head"><div><h1>Reports</h1><div class="muted">Everything here is worked out from the master sheet – nothing to keep in sync.</div></div></div>
      <div class="subtabs">${tabs.map(([k, l]) => `<button class="chip ${S.reportTab === k ? "on" : ""}" data-rtab="${k}">${l}</button>`).join("")}</div>`;
    return nav + ({ jobs: repJobs, stock: repStock, out: repOut, taken: repTaken, losses: repLosses, log: repLog, audit: repAudit }[S.reportTab])();
  }
  // Design jobs – materials the design team needs to make for an event (created when someone picks a "Made for each event" style)
  const JOB_STATUS = [["New", "To do"], ["In design", "In design"], ["Done", "Done"], ["Not now", "Not needed"]];
  const jobLabel = (s) => (JOB_STATUS.find((x) => x[0] === s) || [s, s])[1];
  function jobRows() {
    return S.ideas.map((j) => {
      const ids = uniq(String(j.related_items || "").split(/[,\s]+/)).filter(Boolean), src = byId(ids[0]) || null, ev = evById(j.event_id) || null;
      const bk = S.bookings.find((x) => x.event_id === j.event_id && ids.includes(x.banner_id));
      return { ...j, src, ev, copies: bk ? bk.qty : "", due: j.needed_by || (ev && (ev.ship_by || ev.start_date)) || "" };
    }).sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999"));
  }
  function repJobs() {
    const f = S.jobFilter || "open";
    const all = jobRows(), list = all.filter((j) => f === "all" || (f === "open" ? ["New", "In design"].includes(j.status) : j.status === f));
    const n = (s) => all.filter((j) => j.status === s).length;
    S.lbList = list.map((j) => j.src && j.src.banner_id).filter(Boolean);
    return `<div class="summary-cards">
        <div class="panel"><b>${n("New")}</b><span>to do</span></div>
        <div class="panel"><b>${n("In design")}</b><span>in design</span></div>
        <div class="panel"><b>${n("Done")}</b><span>done</span></div>
      </div>
      <div class="filters">
        ${[["open", "Still to make"], ["New", "To do"], ["In design", "In design"], ["Done", "Done"], ["all", "All"]].map(([k, l]) => `<button class="chip ${f === k ? "on" : ""}" data-jobfilter="${k}">${l}</button>`).join("")}
        <span class="result-count"><button class="btn small" data-act="export-jobs">Download CSV</button> <button class="btn small" data-act="print-jobs">Print</button></span>
      </div>
      ${list.length ? `<div class="table-wrap" id="jobs-table"><table class="tbl">
        <thead><tr><th></th><th>What to make</th><th>For event</th><th>In the style of</th><th class="num">Copies</th><th>Needed by</th><th>Status</th><th class="no-print">Note</th></tr></thead>
        <tbody>${list.map((j) => `<tr>
          <td>${j.src ? thumbHTML(j.src) : ""}</td>
          <td><b>${esc(j.src && j.src.material ? j.src.material : j.title)}</b><div class="muted">${esc(j.idea_id)}${j.designer_notes ? " · " + esc(j.designer_notes) : ""}</div></td>
          <td>${j.ev ? `${esc(j.ev.event_name)}<div class="muted">${fmtDate(j.ev.start_date)}${j.ev.city ? " · " + esc(j.ev.city) : ""}</div>` : '<span class="muted">—</span>'}</td>
          <td>${j.src ? esc(styleName(j.src)) : "—"}</td>
          <td class="num">${j.copies || "—"}</td>
          <td>${j.due ? fmtDate(j.due) : "—"}</td>
          <td><select data-ideastatus="${esc(j.idea_id)}" aria-label="Status">${JOB_STATUS.map(([v, l]) => `<option value="${v}" ${j.status === v ? "selected" : ""}>${l}</option>`).join("")}</select><span class="print-only">${esc(jobLabel(j.status))}</span></td>
          <td class="no-print"><div style="display:flex;gap:6px"><input type="text" placeholder="Note…" data-ideanote="${esc(j.idea_id)}" style="width:130px"><button class="btn small" data-act="idea-save" data-id="${esc(j.idea_id)}">Update</button></div></td>
        </tr>`).join("")}</tbody></table></div>`
      : `<div class="empty"><h2>${f === "In design" ? "Nothing in design yet" : f === "Done" ? "Nothing finished yet" : f === "open" ? "Nothing for the design team to make" : "No design jobs here"}</h2><p>${f === "In design"
        ? `When a designer starts a job, change its <b>Status</b> from “To do” to “In design” (in the <b>To do</b> list) and it moves here.${n("New") ? ` There ${n("New") === 1 ? "is 1 job" : `are ${n("New")} jobs`} waiting in To do.` : ""}`
        : f === "Done" ? "Set a job's <b>Status</b> to “Done” once its file has gone to print and it moves here."
        : "Jobs appear here when someone picks something from <b>Made for each event</b>, <b>Digital assets</b> or <b>From past events</b> for an event and saves the list."}</p></div>`}`;
  }
  function stockRows() {
    const seen = new Set();
    return [...filtered("banners"), ...filtered("backlit"), ...filtered("large")].filter((b) => !seen.has(b.banner_id) && seen.add(b.banner_id)).map((b) => ({ ...b, ...stock(b) }));
  }
  function repStock() {
    const rows = stockRows();
    S.lbList = rows.map((r) => r.banner_id);
    const tot = (k) => rows.reduce((s, r) => s + r[k], 0);
    const action = rows.filter((r) => r.action_needed || (r.status && !["In use", "Final", "Artwork only", "Old design"].includes(r.status))).length;
    return `<div class="summary-cards">
        <div class="panel"><b>${rows.length}</b><span>banner designs</span></div>
        <div class="panel"><b>${tot("owned")}</b><span>banners owned</span></div>
        <div class="panel"><b>${tot("out")}</b><span>out at events</span></div>
        <div class="panel"><b>${tot("available")}</b><span>in store</span></div>
        <div class="panel"><b>${action}</b><span>need action</span></div>
      </div>
      <div class="filters">
        <input type="search" placeholder="Search…" value="${esc(S.f.q)}" data-filter="q">
        ${selectHTML("stored_at", "Location", "banners")}${selectHTML("language", "Language", "banners")}${selectHTML("brand", "Brand", "banners")}${selectHTML("section", "Type of banner", "banners")}
        <label class="muted"><input type="checkbox" data-filter="action" ${S.f.action ? "checked" : ""}> Needs action</label>
        <span class="result-count"><button class="btn small" data-act="export-stock">Download CSV</button> <button class="btn small" data-act="print-stock">Print</button></span>
      </div>
      <div class="table-wrap" id="stock-table">${stockTable(rows)}</div>`;
  }
  function stockTable(rows) {
    return `<table class="tbl"><thead><tr><th></th><th>ID</th><th>Item</th><th>Location</th><th>Language</th><th class="num">Owned</th><th class="num">Out</th><th class="num">In store</th><th>Status / action</th></tr></thead>
      <tbody>${rows.map((r) => `<tr><td>${thumbHTML(r)}</td><td class="muted">${esc(r.banner_id)}</td><td><b>${esc(r.name)}</b><div class="muted">${esc(r.brand)} · ${esc(r.section)}</div></td>
        <td>${esc(r.stored_at)}</td><td>${esc(r.language)}</td><td class="num">${r.owned}</td><td class="num">${r.out || ""}</td>
        <td class="num"><b style="color:${r.available ? "inherit" : "var(--bad)"}">${r.available}</b></td>
        <td>${r.status && r.status !== "In use" ? `<span class="pill warn">${esc(r.status)}</span> ` : ""}${r.action_needed ? `<span class="pill warn">${esc(r.action_needed)}</span>` : ""}</td></tr>`).join("")}</tbody></table>`;
  }
  function repOut() {
    const evs = uniq(S.bookings.filter((b) => b.status === "Dispatched").map((b) => b.event_id)).map(evById).filter(Boolean);
    if (!evs.length) return `<div class="empty"><h2>Nothing is out right now</h2></div>`;
    return evs.map((e) => {
      const rows = S.bookings.filter((b) => b.event_id === e.event_id && !isAway(byId(b.banner_id)) && byId(b.banner_id)?.tracked !== false);
      if (!rows.length) return "";
      return `<div class="panel" style="margin-bottom:14px"><h2>${esc(e.event_name)} <span class="muted" style="font-weight:500">· ${esc(e.city || "")} · back by ${fmtDate(e.return_by) || "—"}</span></h2>
        <div class="strip" style="display:flex;gap:10px;flex-wrap:wrap">${rows.map((r) => { const b = byId(r.banner_id) || {}; return `<div style="text-align:center;width:70px;font-size:11px">${thumbHTML(b)}<b>×${r.qty}</b><div class="muted">${esc(b.name || "")}</div></div>`; }).join("")}</div></div>`;
    }).join("");
  }
  function movementTable(list) {
    if (!list.length) return `<div class="empty"><h2>Nothing recorded yet</h2></div>`;
    return `<div class="table-wrap"><table class="tbl"><thead><tr><th>When</th><th></th><th>Item</th><th>Type</th><th class="num">Qty</th><th>Event</th><th>By</th><th>Note</th></tr></thead>
      <tbody>${list.map((m) => { const b = byId(m.banner_id) || {}; return `<tr><td>${esc((m.timestamp || "").replace("T", " ").slice(0, 16))}</td><td>${thumbHTML(b)}</td><td>${esc(b.name || m.banner_id)}</td>
        <td><span class="pill ${m.type === "missing" || m.type === "damaged" ? "bad" : m.type === "return" ? "good" : ""}">${esc(m.type)}</span></td><td class="num">${m.qty}</td>
        <td>${esc(evById(m.event_id)?.event_name || m.event_id || "")}</td><td>${esc(m.by)}</td><td>${esc(m.note || "")}</td></tr>`; }).join("")}</tbody></table></div>`;
  }
  // What practitioners took away: copies sent minus the unused ones counted back in at check-in
  function takenRows() {
    return S.events.filter((e) => eventStatus(e.event_id) === "Returned").flatMap((e) => whRows(e.event_id).filter((r) => r.kind !== "stock").map((r) => {
      const back = S.movements.filter((m) => m.event_id === e.event_id && m.banner_id === r.banner_id && m.type === "leftover").reduce((n, m) => n + num(m.qty), 0);
      return { ev: e, b: r.b, banner_id: r.banner_id, sent: num(r.qty), back, taken: Math.max(0, num(r.qty) - back) };
    })).sort((a, b) => (b.ev.start_date || "").localeCompare(a.ev.start_date || "") || b.taken - a.taken);
  }
  function repTaken() {
    const rows = takenRows(); S.lbList = uniq(rows.map((r) => r.banner_id));
    if (!rows.length) return `<div class="panel"><p class="muted" style="margin:0">Nothing yet. Once an event is checked in, this shows how many printed materials and giveaways came back unused, and so how many practitioners took away. Count unused items back in on the Warehouse check-in screen.</p></div>`;
    const pct = (r) => (r.sent ? Math.round((100 * r.taken) / r.sent) : 0);
    const byItem = new Map(); rows.forEach((r) => { const x = byItem.get(r.banner_id) || { b: r.b, banner_id: r.banner_id, sent: 0, back: 0, taken: 0, events: 0 }; x.sent += r.sent; x.back += r.back; x.taken += r.taken; x.events++; byItem.set(r.banner_id, x); });
    const items = [...byItem.values()].sort((a, b) => pct(b) - pct(a) || b.taken - a.taken);
    const bar = (r) => `<div style="display:flex;align-items:center;gap:8px"><div style="flex:1;min-width:70px;height:8px;background:#e6eef1;border-radius:4px;overflow:hidden"><div style="width:${pct(r)}%;height:100%;background:var(--accent,#006a84)"></div></div><span style="width:38px;text-align:right">${pct(r)}%</span></div>`;
    const evs = uniq(rows.map((r) => r.ev.event_id));
    return `<p class="muted">Printed materials and giveaways sent to each event, minus the unused ones counted back in. Stock items (banners, stands, table cloths…) always come back, so they're not shown here.</p>
      <div class="filters"><span class="result-count"><button class="btn small" data-act="export-taken">Download CSV</button></span></div>
      <h2>Most taken – all events</h2>
      <div class="table-wrap"><table class="tbl"><thead><tr><th></th><th>Item</th><th class="num">Events</th><th class="num">Sent</th><th class="num">Came back</th><th class="num">Taken</th><th style="width:180px">Taken</th></tr></thead>
      <tbody>${items.map((r) => `<tr><td>${thumbHTML(r.b)}</td><td><b>${esc(isDesign(r.b) ? designLabel(r.b) : r.b.name)}</b><div class="muted">${esc(r.banner_id)}</div></td><td class="num">${r.events}</td><td class="num">${r.sent}</td><td class="num">${r.back}</td><td class="num"><b>${r.taken}</b></td><td>${bar(r)}</td></tr>`).join("")}</tbody></table></div>
      ${evs.map((id) => { const e = evById(id), list = rows.filter((r) => r.ev.event_id === id), t = list.reduce((a, r) => ({ sent: a.sent + r.sent, taken: a.taken + r.taken }), { sent: 0, taken: 0 });
        return `<h2 style="margin-top:22px">${esc(e.event_name)} <span class="muted" style="font-size:14px;font-weight:400">· ${fmtDate(e.start_date)} · ${t.taken} of ${t.sent} taken${e.attendees ? ` · ${esc(e.attendees)} attendees` : ""}</span></h2>
        <div class="table-wrap"><table class="tbl"><thead><tr><th></th><th>Item</th><th class="num">Sent</th><th class="num">Came back</th><th class="num">Taken</th><th style="width:180px">Taken</th></tr></thead>
        <tbody>${list.map((r) => `<tr><td>${thumbHTML(r.b)}</td><td><b>${esc(isDesign(r.b) ? designLabel(r.b) : r.b.name)}</b><div class="muted">${esc(r.banner_id)}</div></td><td class="num">${r.sent}</td><td class="num">${r.back}</td><td class="num"><b>${r.taken}</b></td><td>${bar(r)}</td></tr>`).join("")}</tbody></table></div>`; }).join("")}`;
  }
  function repLosses() {
    const list = S.movements.filter((m) => m.type === "missing" || m.type === "damaged").slice().reverse();
    S.lbList = uniq(list.map((m) => m.banner_id));
    return `<div style="margin-bottom:10px"><button class="btn small" data-act="export-moves" data-kind="losses">Download CSV</button></div>` + movementTable(list);
  }
  function repLog() {
    const list = S.movements.slice().reverse();
    S.lbList = uniq(list.map((m) => m.banner_id));
    return `<div style="margin-bottom:10px"><button class="btn small" data-act="export-moves" data-kind="all">Download CSV</button></div>` + movementTable(list);
  }
  function auditHTML(loc) {
    const banners = S.banners.filter((b) => b.tracked && b.status !== "Artwork only" && b.status !== "Old design");
    const locs = loc === "all" ? uniq(banners.map((b) => b.stored_at)) : [loc];
    return locs.map((l) => {
      const items = banners.filter((b) => b.stored_at === l);
      const secs = uniq(items.map((b) => b.section));
      return `<div class="audit-loc"><h2>${esc(l)} <span class="muted" style="font-size:13px;font-weight:500">${items.length} designs · ${items.reduce((s, b) => s + b.qty_owned, 0)} banners</span></h2>
        ${secs.map((s) => `<h3 style="margin:14px 0 8px">${esc(s)}</h3><div class="audit-grid">${items.filter((b) => b.section === s).map((b) => `
          <div class="audit-item"><div class="im" data-zoom="${esc(b.banner_id)}">${imgSrc(b) ? `<img src="${esc(imgSrc(b))}" alt="" loading="lazy">` : '<span class="muted">No artwork</span>'}</div>
            <span class="q ${b.qty_owned ? "" : "zero"}">${b.qty_owned}</span>
            <div class="nm">${esc(b.name)}</div><div class="muted">${esc(b.language)}${b.action_needed ? " · " + esc(b.action_needed) : ""}</div></div>`).join("")}</div>`).join("")}
      </div>`;
    }).join("");
  }
  function repAudit() {
    const locs = uniq(S.banners.filter((b) => b.tracked && b.status !== "Artwork only" && b.status !== "Old design").map((b) => b.stored_at));
    S.lbList = S.banners.filter((b) => b.tracked && (S.auditLoc === "all" || b.stored_at === S.auditLoc)).map((b) => b.banner_id);
    return `<div class="filters">
        <select data-act="audit-loc">${["all", ...locs].map((l) => `<option value="${esc(l)}" ${S.auditLoc === l ? "selected" : ""}>${l === "all" ? "All locations" : esc(l)}</option>`).join("")}</select>
        <span class="muted">Replaces the Slides audit deck – always current. Print or “Save as PDF” to share.</span>
        <span class="result-count"><button class="btn small primary" data-act="print-audit">Print / save PDF</button></span>
      </div>
      <div class="panel">${auditHTML(S.auditLoc)}</div>`;
  }

  // ───────────────────────── ideas board ───────────────────
  const IDEA_TYPES = ["Adapt for another event", "New banner", "New backlit / large banner", "New poster", "New special offer", "New test focus", "Change to an existing item", "Other"];
  const IDEA_STATUS = ["New", "In design", "Done", "Not now"];
  const ideaPill = { New: "warn", "In design": "accent", Done: "good", "Not now": "" };
  function viewIdeas() {
    const d = S.ideaDraft;
    const list = S.ideas.slice().reverse().filter((i) => S.ideaFilter === "all" || (S.ideaFilter === "open" ? i.status === "New" || i.status === "In design" : i.status === S.ideaFilter));
    const relHTML = (ids) => uniq(String(ids || "").split(/[,\s]+/)).map(byId).filter(Boolean).map((b) => `<div class="rel" title="${esc(b.name)}">${thumbHTML(b)}<span>${esc(b.name)}</span></div>`).join("");
    const counts = Object.fromEntries(IDEA_STATUS.map((s) => [s, S.ideas.filter((i) => i.status === s).length]));
    return `
      <div class="page-head">
        <div><h1>Ideas</h1><div class="muted">Spotted something while browsing? Suggest a new banner, offer, poster or test focus – the design team picks it up here.</div></div>
        ${d ? "" : `<button class="btn primary" data-act="idea-new">💡 New idea</button>`}
      </div>
      ${d ? `<form class="panel idea-form" id="idea-form">
        <h2>New idea</h2>
        ${d.related ? `<div class="rels">${relHTML(d.related)}</div><input type="hidden" name="related_items" value="${esc(d.related)}">` : ""}
        <div class="form-grid">
          <label>What kind of idea?*<select name="type" required>${IDEA_TYPES.map((t) => `<option ${d.type === t ? "selected" : ""}>${t}</option>`).join("")}</select></label>
          <label style="grid-column:span 2">Short title*<input type="text" name="title" required placeholder="e.g. DNA Mind roll-up in German for Frankfurt"></label>
          <label>Countries / languages<input type="text" name="markets" placeholder="e.g. Germany, Austria"></label>
          <label>For an event?<select name="event_id"><option value="">— not for a specific event —</option>${S.events.filter((e) => !isClosed(e)).map((e) => `<option value="${esc(e.event_id)}">${esc(e.event_name)}</option>`).join("")}</select></label>
          <label>Needed by<input type="date" name="needed_by"></label>
        </div>
        <label class="muted" style="display:block;margin-top:10px">The idea – what should it say, show or offer?*<textarea name="details" rows="5" required placeholder="Describe the idea. Mention any tests, prices, images or wording you have in mind."></textarea></label>
        <div style="margin-top:12px;display:flex;gap:8px"><button class="btn primary" type="submit">Send to design team</button><button class="btn" type="button" data-act="idea-cancel">Cancel</button></div>
      </form>` : ""}
      <div class="subtabs">
        ${[["open", `Open (${counts.New + counts["In design"]})`], ...IDEA_STATUS.map((s) => [s, `${s} (${counts[s]})`]), ["all", `All (${S.ideas.length})`]].map(([k, l]) => `<button class="chip ${S.ideaFilter === k ? "on" : ""}" data-ideafilter="${esc(k)}">${l}</button>`).join("")}
      </div>
      ${list.length ? `<div class="ideas">${list.map((i) => `
        <div class="panel idea">
          <div class="idea-head">
            <span class="pill ${ideaPill[i.status] || ""}">${esc(i.status)}</span><span class="pill">${esc(i.type)}</span>
            ${i.needed_by ? `<span class="pill warn">Needed by ${fmtDate(i.needed_by)}</span>` : ""}
            <span class="muted" style="margin-left:auto;font-size:12px">${esc(i.idea_id)} · ${esc(i.by)} · ${esc((i.created_at || "").slice(0, 10))}</span>
          </div>
          <h3>${esc(i.title)}</h3>
          <p class="idea-text">${esc(i.details)}</p>
          <div class="card-meta">${i.markets ? `<span class="pill accent">${esc(i.markets)}</span>` : ""}${i.event_id ? `<span class="pill">For ${esc(evById(i.event_id)?.event_name || i.event_id)}</span>` : ""}</div>
          ${i.related_items ? `<div class="rels">${relHTML(i.related_items)}</div>` : ""}
          ${i.designer_notes ? `<div class="reply"><b>Reply${i.updated_by ? ` from ${esc(i.updated_by)}` : ""}:</b> ${esc(i.designer_notes)}</div>` : ""}
          <div class="idea-actions">
            <select data-ideastatus="${esc(i.idea_id)}" aria-label="Status">${IDEA_STATUS.map((s) => `<option ${i.status === s ? "selected" : ""}>${s}</option>`).join("")}</select>
            <input type="text" placeholder="Reply / designer note…" data-ideanote="${esc(i.idea_id)}" value="">
            <button class="btn small" data-act="idea-save" data-id="${esc(i.idea_id)}">Update</button>
          </div>
        </div>`).join("")}</div>`
      : `<div class="empty"><h2>No ideas here yet</h2><p>Open any banner, poster or offer and press “Suggest an idea based on this”, or use “New idea”.</p></div>`}`;
  }

  // ───────────────────────── printing & exports ────────────
  function printHTML(title, body) {
    $("#print-area").innerHTML = `<h1 style="font-size:20px">${esc(title)}</h1><div class="muted" style="margin-bottom:12px">Printed ${new Date().toLocaleString("en-GB")}</div>${body}`;
    const imgs = [...$("#print-area").querySelectorAll("img")];
    imgs.forEach((i) => (i.loading = "eager"));
    Promise.all(imgs.map((i) => (i.complete ? 1 : new Promise((r) => { i.onload = i.onerror = r; })))).then(() => window.print());
  }
  function eventRows(eid) {
    const e = evById(eid) || {};
    return S.bookings.filter((b) => b.event_id === eid).map((r) => {
      const b = byId(r.banner_id) || {};
      return { event_id: eid, event_name: e.event_name, ship_by: e.ship_by, category: b.tracked === false ? ({ posters: "Poster", brochures: "Brochure / flyer", clinical: "Clinical handout / guide", pricelists: "Price list", pastevents: "Past event material" })[b.category] || "Special offer form" : "Banner", banner_id: r.banner_id, banner_name: b.name, language: b.language, brand: b.brand, banner_type: b.banner_type, stored_at: b.stored_at, qty: r.qty, day: dayText(r.day), status: r.status };
    });
  }
  const EVENT_COLS = ["event_id", "event_name", "ship_by", "day", "category", "banner_id", "banner_name", "language", "brand", "banner_type", "stored_at", "qty", "status"];

  // ───────────────────────── events (DOM) ──────────────────
  function setStep(id, d, group) {
    const ev = evById(S.planEvent); if (!ev) return;
    let b = byId(id); if (!b) return;
    if (linkOf(b)) { b = linkOf(b); id = b.banner_id; }
    if (b.category === "templates") { const tpl = b; id = d < 0 ? tpl.styles.find((x) => num(S.draft[x]) > 0) : tpl.styles[0]; if (!id) return; b = byId(id); if (!b) return; }
    let target = id;
    if (group && b.tracked && b.design_id) {
      const rows = rowsOf(b);
      if (d > 0) target = (rows.filter((r) => freeFor(r, ev.event_id) > 0).sort((x, y) => LOC_ORDER(x.stored_at) - LOC_ORDER(y.stored_at))[0] || rows[0]).banner_id;
      else { const has = rows.filter((r) => num(S.draft[r.banner_id]) > 0); if (!has.length) return; target = has[has.length - 1].banner_id; }
    }
    S.draft[target] = Math.max(0, num(S.draft[target]) + d); if (isOneOff(byId(target))) S.draft[target] = Math.min(1, S.draft[target]);
    const dv = (S.draftDay || {})[target]; if (isSplit(dv)) { const m = parseSplit(dv), ks = Object.keys(m).sort((a, z) => num(a) - num(z)); const k = ks[ks.length - 1] || "1"; m[k] = Math.max(0, num(m[k]) + d); S.draftDay[target] = makeSplit(m); S.draft[target] = Object.values(m).reduce((a, q) => a + num(q), 0); }
    S.dirty = true;
    render(); if (!$("#lightbox").hidden) renderLB();
  }

  document.addEventListener("click", async (e) => {
    const t = e.target;
    if (t.closest('[data-act="global-new-event"]')) { e.preventDefault(); return openNewEvent(); }
    const tab = t.closest(".tab, [data-tabgo]"); if (tab) { e.preventDefault(); return go(tab.dataset.view || tab.dataset.tabgo); }
    const lb = t.closest("[data-lb]");
    if (lb) { const a = lb.dataset.lb; if (a === "close") return closeLB(); S.lbIndex = (S.lbIndex + (a === "next" ? 1 : -1) + S.lbList.length) % S.lbList.length; return renderLB(); }
    if (t.id === "lightbox") return closeLB();
    const step = t.closest("[data-step]"); if (step) return setStep(step.dataset.id, num(step.dataset.step), step.dataset.group === "1");
    const zoomImg = t.closest("[data-act=zoom]"); if (zoomImg) { zoomImg.classList.toggle("zoomed"); return; }
    const z = t.closest("[data-zoom]"); if (z && z.dataset.zoom) return openLB(z.dataset.zoom);
    const chip = t.closest("[data-chip]"); if (chip) { S.f.chip = chip.dataset.chip; return render(); }
    const cat = t.closest("[data-cat]"); if (cat) { if (S.cat !== cat.dataset.cat) { S.cat = cat.dataset.cat; resetFilters(); } return render(); }
    const sec = t.closest("[data-sec]"); if (sec) { S.f.section = S.f.section === sec.dataset.sec ? "all" : sec.dataset.sec; return render(); }
    const evtab = t.closest("[data-evtab]"); if (evtab) { S.evTab = evtab.dataset.evtab; return render(); }
    const evtype = t.closest("[data-evtype]"); if (evtype) { S.evType = evtype.dataset.evtype; return render(); }
    const ifl = t.closest("[data-ideafilter]"); if (ifl) { S.ideaFilter = ifl.dataset.ideafilter; return render(); }
    const rtab = t.closest("[data-rtab]"); if (rtab) { S.reportTab = rtab.dataset.rtab; return render(); }
    const jf = t.closest("[data-jobfilter]"); if (jf) { S.jobFilter = jf.dataset.jobfilter; return render(); }
    const el = t.closest("[data-act]"); if (!el) return;
    const a = el.dataset.act;
    try {
      if (a === "plan") { startPlanning(el.dataset.id); go("catalogue"); }
      else if (a === "to-warehouse") go("warehouse", { whEvent: el.dataset.id });
      else if (a === "close-plan") { if (S.dirty && !confirm("Discard unsaved picks?")) return; S.planEvent = ""; S.dirty = false; render(); }
      else if (a === "save-plan") {
        el.disabled = true;
        const items = Object.entries(S.draft).map(([banner_id, qty]) => ({ banner_id, qty: num(qty), day: (S.draftDay || {})[banner_id] || "" })).filter((i) => i.qty > 0);
        await act({ action: "saveBooking", event_id: S.planEvent, items });
        const ev = evById(S.planEvent); let made = 0;
        for (const it of items) {
          const b = byId(it.banner_id);
          if (!isDesign(b) || designReq(S.planEvent, b.banner_id)) continue;
          await act({ action: "addIdea", idea: { type: "Adapt for another event", title: `${b.material || b.name} for ${ev.event_name}`,
            details: `${isOneOff(b) ? "Needed" : it.qty + " copies needed"} for ${ev.event_name}${ev.city ? " (" + ev.city + ")" : ""}, in the style of the one made for ${evById(b.event_id)?.event_name || b.section} – update the event name, dates, venue, prices and offers, then send the print file.`,
            related_items: b.banner_id, event_id: ev.event_id, needed_by: ev.ship_by || ev.start_date || "", markets: [ev.city, ev.country].filter(Boolean).join(", ") } });
          made++;
        }
        S.lastSaveMsg = made ? `List saved – ${made} design request${made > 1 ? "s" : ""} added to Reports › Design jobs` : "";
        S.dirty = false; render(); toast(S.lastSaveMsg || "List saved – the warehouse can see it now");
      }
      else if (a === "export-plan" || a === "export-event") {
        const eid = a === "export-plan" ? S.planEvent : el.dataset.id;
        const rows = a === "export-plan" ? Object.entries(S.draft).filter(([, q]) => num(q) > 0).map(([id, q]) => { const b = byId(id) || {}; const ev = evById(eid) || {}; return { event_id: eid, event_name: ev.event_name, ship_by: ev.ship_by, category: b.tracked === false ? ({ posters: "Poster", brochures: "Brochure / flyer", clinical: "Clinical handout / guide", pricelists: "Price list", pastevents: "Past event material" })[b.category] || "Special offer form" : "Banner", banner_id: id, banner_name: b.name, language: b.language, brand: b.brand, banner_type: b.banner_type, stored_at: b.stored_at, qty: num(q), status: S.dirty ? "Unsaved" : eventStatus(eid) }; }) : eventRows(eid);
        download(`banners_${eid}.csv`, toCSV(rows, EVENT_COLS));
      }
      else if (a === "show-runup") { S.runupEvent = S.runupEvent === el.dataset.id ? "" : el.dataset.id; S.kitEvent = ""; render(); window.scrollTo({ top: 0, behavior: "smooth" }); }
      else if (a === "show-kit") { S.kitEvent = S.kitEvent === el.dataset.id ? "" : el.dataset.id; render(); window.scrollTo({ top: 0, behavior: "smooth" }); }
      else if (a === "print-kit") { const ev = evById(S.kitEvent); printHTML(`Kit list – ${ev.event_name}`, kitTable(S.kitEvent, true)); }
      else if (a === "go-jobs") { e.preventDefault(); go("reports", { reportTab: "jobs" }); }
      else if (a === "export-jobs") download("design_jobs.csv", toCSV(jobRows().map((j) => ({ job_id: j.idea_id, what_to_make: j.src && j.src.material ? j.src.material : j.title, event: j.ev ? j.ev.event_name : "", style_of: j.src && j.src.event_id ? shortEv(j.src.event_id) : "", based_on_item: j.src ? j.src.banner_id : "", copies: j.copies, needed_by: j.due, status: jobLabel(j.status), notes: j.designer_notes || "" })), ["job_id", "what_to_make", "event", "style_of", "based_on_item", "copies", "needed_by", "status", "notes"]));
      else if (a === "print-jobs") printHTML("Design jobs", $("#jobs-table") ? $("#jobs-table").innerHTML : "<p>No design jobs.</p>");
      else if (a === "open-event") { e.preventDefault(); const ev = evById(el.dataset.id); closeLB(); go("events", { evTab: ev && isClosed(ev) ? "archive" : "upcoming", evType: "all" });
        setTimeout(() => { const c = document.getElementById("ev-" + el.dataset.id); if (c) { c.scrollIntoView({ block: "center" }); c.classList.add("flash"); } }, 50); }
      else if (a === "idea-from") { const b = byId(el.dataset.id); closeLB(); S.ideaDraft = { related: el.dataset.id, type: b && !b.tracked ? (b.category === "posters" ? "New poster" : b.category === "brochures" ? "Change to an existing item" : b.category === "pricelists" ? "Change to an existing item" : b.category === "pastevents" ? "Adapt for another event" : "New special offer") : "Change to an existing item" }; go("ideas"); }
      else if (a === "idea-new") { S.ideaDraft = { type: "New banner" }; render(); }
      else if (a === "idea-cancel") { S.ideaDraft = null; render(); }
      else if (a === "idea-save") {
        const id = el.dataset.id, status = $(`[data-ideastatus="${id}"]`).value, note = $(`[data-ideanote="${id}"]`).value.trim();
        const cur = S.ideas.find((i) => i.idea_id === id) || {};
        const changes = { status }; if (note) changes.designer_notes = (cur.designer_notes ? cur.designer_notes + " · " : "") + note;
        await act({ action: "updateIdea", idea_id: id, changes }); render(); toast("Design job updated");
      }
      else if (a === "show-made") { const ev = evById(el.dataset.id); S.cat = "pastevents"; resetFilters(); S.f.section = ev ? ev.event_name : "all"; go("catalogue"); }
      else if (a === "toggle-new-event") { S.showNewEvent = !S.showNewEvent; S.showRequest = false; render(); }
      else if (a === "delete-event") {
        const id = el.dataset.id, ev = evById(id);
        if (S.confirmDel !== id) { S.confirmDel = id; render(); clearTimeout(S._delT); S._delT = setTimeout(() => { if (S.confirmDel === id) { S.confirmDel = ""; render(); } }, 5000); return; }
        S.confirmDel = "";
        try { await act({ action: "deleteEvent", event_id: id }); if (S.planEvent === id) S.planEvent = ""; if (S.kitEvent === id) S.kitEvent = ""; render(); toast(`Deleted “${ev ? ev.event_name : id}”`); }
        catch (err) { toast(err.message, true); }
      }
      else if (a === "close-request-mail") { S.requestMail = ""; render(); }
      else if (a === "toggle-request") { S.showRequest = !S.showRequest; S.showNewEvent = false; render(); }
      else if (a === "reuse") {
        const src = evById(el.dataset.id);
        const targets = S.events.filter((x) => !isClosed(x) && eventStatus(x.event_id) !== "Dispatched" && eventStatus(x.event_id) !== "Returned");
        if (!targets.length) return toast("Add an upcoming event first", true);
        const pick = prompt(`Copy the materials list from “${src.event_name}” into which event? Type its number:\n\n` + targets.map((x, i) => `${i + 1}. ${x.event_name} (${fmtDate(x.start_date)})`).join("\n"));
        const tgt = targets[num(pick) - 1]; if (!tgt) return;
        startPlanning(tgt.event_id);
        S.bookings.filter((b) => b.event_id === src.event_id).forEach((b) => (S.draft[b.banner_id] = b.qty));
        S.dirty = true; go("catalogue"); toast("List copied – check it and press Save");
      }
      else if (a === "dispatch") {
        const ev = evById(S.whEvent);
        if (!confirm(`Mark all materials for “${ev.event_name}” as dispatched?`)) return;
        await act({ action: "dispatch", event_id: S.whEvent }); render(); toast("Dispatched – stock updated");
      }
      else if (a === "checkin") {
        const items = []; let bad = "";
        document.querySelectorAll("#checkin tr[data-row]").forEach((tr) => {
          const g = (k) => tr.querySelector(`[data-ci=${k}]`).value;
          const it = { banner_id: tr.dataset.row, returned: num(g("returned")), damaged: num(g("damaged")), missing: num(g("missing")), note: g("note"), store_at: g("store_at") };
          if (it.returned + it.damaged + it.missing !== num(tr.dataset.sent)) bad = byId(it.banner_id)?.name || it.banner_id;
          items.push(it);
        });
        if (bad) return toast(`Numbers for “${bad}” don't add up to the quantity sent`, true);
        const leftovers = [...document.querySelectorAll("#leftovers tr[data-left]")].map((tr) => ({ banner_id: tr.dataset.left, qty: Math.min(num(tr.querySelector("[data-lq]").value), num(tr.dataset.sent)) })).filter((l) => l.qty > 0);
        if (!confirm("Complete check-in for this event?")) return;
        await act({ action: "checkIn", event_id: S.whEvent, items, leftovers }); render(); toast("Checked in – stock updated");
      }
      else if (a === "print-pack") {
        const ev = evById(S.whEvent), rows = whRows(ev.event_id);
        const body = WH_GROUPS.map(([g, label]) => { const gr = rows.filter((r) => r.g === g); if (!gr.length) return "";
          return `<tr><td colspan="6" style="background:#eef4f6;font-weight:700">${esc(label)}</td></tr>` + gr.map((r) => `<tr><td>☐</td><td>${imgSrc(r.b) ? `<img src="${esc(imgSrc(r.b))}" style="height:70px;width:auto">` : ""}</td><td><b>${esc(isDesign(r.b) ? designLabel(r.b) : r.b.name)}</b><br><span class="muted">${esc([r.b.language, r.b.edition || r.b.format || r.b.banner_type].filter(Boolean).join(" · "))}</span></td><td>${esc(r.banner_id)}</td><td>${r.kind === "stock" || r.kind === "supply" ? esc(r.b.stored_at) : r.kind === "print" ? "Print run" : "Design team → print"}</td><td class="num"><b>${r.qty}</b>${r.kind === "print" || r.kind === "design" ? " copies" : ""}</td></tr>`).join(""); }).join("");
        printHTML(`Packing list – ${ev.event_name}`, `<p>${esc([ev.venue, ev.city, ev.country].filter(Boolean).join(", "))} · Event ${fmtDate(ev.start_date)} · <b>Ship by ${fmtDate(ev.ship_by) || "—"}</b></p>
          <table class="tbl"><thead><tr><th>✓</th><th></th><th>Item</th><th>ID</th><th>From</th><th class="num">Qty</th></tr></thead><tbody>${body}</tbody></table><p style="margin-top:20px">Packed by: ____________________ Date: ____________</p>`);
      }
      else if (a === "export-stock") download("banner_stock.csv", toCSV(stockRows(), ["banner_id", "name", "brand", "section", "language", "stored_at", "banner_type", "owned", "out", "available", "status", "action_needed", "notes"]));
      else if (a === "print-stock") printHTML("Banner stock levels", stockTable(stockRows()));
      else if (a === "export-moves") {
        const list = el.dataset.kind === "losses" ? S.movements.filter((m) => m.type === "missing" || m.type === "damaged") : S.movements;
        download(`banner_${el.dataset.kind === "losses" ? "losses" : "activity"}.csv`, toCSV(list.map((m) => ({ ...m, banner_name: byId(m.banner_id)?.name, event_name: evById(m.event_id)?.event_name })), ["timestamp", "type", "banner_id", "banner_name", "qty", "event_id", "event_name", "by", "note"]));
      }
      else if (a === "print-audit") printHTML(`Banner audit${S.auditLoc === "all" ? "" : " – " + S.auditLoc}`, auditHTML(S.auditLoc));
      else if (a === "export-taken") download("taken_at_events.csv", toCSV(takenRows().map((r) => ({ event_id: r.ev.event_id, event_name: r.ev.event_name, start_date: r.ev.start_date, item_id: r.banner_id, item_name: r.b.name, sent: r.sent, came_back: r.back, taken: r.taken })), ["event_id", "event_name", "start_date", "item_id", "item_name", "sent", "came_back", "taken"]));
      else if (a === "broken") {
        const b = byId(el.dataset.id); const note = window.prompt(`Mark one “${b.name}” (${b.stored_at}) as broken? It comes out of stock.\nWhat's wrong with it? (optional)`, "");
        if (note === null) return;
        await act({ action: "markBroken", banner_id: b.banner_id, qty: 1, note: note ? "Broken: " + note : "Marked as broken" }); render(); renderLB(); toast("Marked as broken – taken out of stock");
      }
      else if (a === "move") {
        const b = byId(el.dataset.id); const locs = LOCATIONS();
        const to = (window.prompt(`Where is “${b.name}” stored now?\nCurrently: ${b.stored_at}\nOptions: ${locs.join(", ")}`, b.stored_at) || "").trim();
        if (!to || to === b.stored_at) return;
        await act({ action: "moveStock", banner_id: b.banner_id, stored_at: to }); render(); renderLB(); toast(`Now stored at ${to}`);
      }
      else if (a === "adjust") {
        const changes = [...document.querySelectorAll("[data-adjqty]")].map((i) => ({ id: i.dataset.adjqty, v: num(i.value) })).filter((c) => num(byId(c.id)?.qty_owned) !== c.v);
        if (!changes.length) return toast("No changes to save");
        for (const c of changes) await act({ action: "adjustStock", banner_id: c.id, qty_owned: c.v });
        render(); renderLB(); toast("Stock count updated");
      }
    } catch (err) { console.error(err); toast(err.message || String(err), true); render(); }
  });

  document.addEventListener("input", (e) => {
    const t = e.target;
    if (t.dataset.filter === "q") {
      S.f.q = t.value; const pos = t.selectionStart; render();
      const box = document.querySelector('[data-filter="q"]'); if (box) { box.focus(); box.setSelectionRange(pos, pos); }
    }
  });
  document.addEventListener("change", (e) => {
    const t = e.target;
    if (t.dataset.filter && t.dataset.filter.startsWith("sel:")) { S.f.sel[t.dataset.filter.slice(4)] = t.value; return render(); }
    if (t.dataset.filter && t.dataset.filter !== "q") { S.f[t.dataset.filter] = t.type === "checkbox" ? t.checked : t.value; return render(); }
    if (t.dataset.act === "plan-select") {
      if (t.value === "__new") { t.value = S.planEvent; return openNewEvent(); }
      if (S.dirty && !confirm("Discard unsaved picks for the current event?")) { t.value = S.planEvent; return; }
      startPlanning(t.value); return render();
    }
    if (t.dataset.act === "wh-select") { S.whEvent = t.value; location.hash = "warehouse/" + t.value; return render(); }
    if (t.dataset.act === "audit-loc") { S.auditLoc = t.value; return render(); }
    if (t.dataset.qty) { S.draft[t.dataset.qty] = Math.max(0, num(t.value)); S.dirty = true; return render(); }
    if (t.dataset.day !== undefined && t.classList.contains("day-sel")) { S.draftDay = S.draftDay || {}; const id = t.dataset.day, was = S.draftDay[id] || "";
      if (t.value === "split") { if (!isSplit(was)) S.draftDay[id] = makeSplit({ [was || "1"]: num(S.draft[id]) }); }
      else if (t.value) S.draftDay[id] = t.value; else delete S.draftDay[id];
      S.dirty = true; return render(); }
    if (t.dataset.split) { const id = t.dataset.split, m = parseSplit((S.draftDay || {})[id]); m[t.dataset.d] = Math.max(0, num(t.value));
      const tot = Object.values(m).reduce((a, q) => a + num(q), 0); S.draftDay[id] = makeSplit(m) === "split:" ? "split:1=0" : makeSplit(m); S.draft[id] = tot; S.dirty = true; return render(); }
    if (t.dataset.pack) { t.checked ? S.packed.add(t.dataset.pack) : S.packed.delete(t.dataset.pack); return render(); }
  });
  // Forms are handled from the button click too: the preview frame can block real form submits.
  document.addEventListener("click", (e) => {
    const btn = e.target.closest('button[type="submit"]'), form = btn && btn.form;
    if (!form || !["idea-form", "event-request", "new-event"].includes(form.id)) return;
    e.preventDefault();
    if (!form.reportValidity()) return;
    handleForm({ target: form, preventDefault() {} });
  }, true);
  document.addEventListener("submit", (e) => handleForm(e));
  document.addEventListener("dragstart", (e) => { const r = e.target.closest && e.target.closest("[data-drow]"); if (!r) return;
    S.drag = { id: r.dataset.drow }; e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", r.dataset.drow); r.classList.add("dragging"); document.body.classList.add("is-dragging"); });
  document.addEventListener("dragend", () => { S.drag = null; document.body.classList.remove("is-dragging"); document.querySelectorAll(".day-drop.over, .dragging").forEach((x) => x.classList.remove("over", "dragging")); });
  document.addEventListener("dragover", (e) => { const b = e.target.closest && e.target.closest("[data-dbox]"); if (!b || !S.drag) return; e.preventDefault(); document.querySelectorAll(".day-drop.over").forEach((x) => x !== b && x.classList.remove("over")); b.classList.add("over"); });
  document.addEventListener("drop", (e) => { const b = e.target.closest && e.target.closest("[data-dbox]"); if (!b || !S.drag) return; e.preventDefault();
    const d = S.drag; S.drag = null; document.body.classList.remove("is-dragging"); setRowDay(S.whEvent, d.id, b.dataset.dbox); });
  document.addEventListener("change", (e) => { const t = e.target; if (!t.dataset || !t.dataset.whday || t.value === "__split") return; setRowDay(S.whEvent, t.dataset.whday, t.value); });
  async function handleForm(e) {
    if (e.target.id === "idea-form") {
      e.preventDefault();
      const idea = Object.fromEntries(new FormData(e.target).entries());
      try { await act({ action: "addIdea", idea }); S.ideaDraft = null; S.ideaFilter = "open"; render(); toast("Thanks – sent to the design team"); }
      catch (err) { toast(err.message, true); }
      return;
    }
    if (e.target.id === "event-request") {
      e.preventDefault();
      const fd = new FormData(e.target), o = Object.fromEntries(fd.entries());
      o.materials_requested = fd.getAll("materials").join(", "); delete o.materials;
      const n = S.events.reduce((m, x) => Math.max(m, num((x.event_id || "").replace(/\D/g, ""))), 0) + 1;
      const event = { event_id: "EVT-" + String(n).padStart(3, "0"), status: "Requested", ...o };
      if (!LIVE) { delete event.requester_email; } // demo: keep contact details out of the shared page data
      const mail = CFG.requestEmail ? "mailto:" + CFG.requestEmail + "?subject=" + encodeURIComponent("Event request: " + (o.event_name || "")) + "&body=" + encodeURIComponent(Object.entries(o).filter(([, v]) => v).map(([k, v]) => k.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()) + ": " + v).join("\n")) : "";
      try { await act({ action: "addEvent", event }); S.showRequest = false; S.evTab = "upcoming"; S.requestMail = LIVE ? "" : mail; render(); window.scrollTo({ top: 0, behavior: "smooth" }); toast(LIVE ? `Thanks – your request has gone to the events team${CFG.requestEmail ? " (" + CFG.requestEmail + ")" : ""}` : "Request added to the events list – now send the email"); }
      catch (err) { toast(err.message, true); }
      return;
    }
    if (e.target.id !== "new-event") return;
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target).entries());
    const n = S.events.reduce((m, x) => Math.max(m, num((x.event_id || "").replace(/\D/g, ""))), 0) + 1;
    const event = { event_id: "EVT-" + String(n).padStart(3, "0"), status: "Planning", ...fd };
    try { await act({ action: "addEvent", event }); S.showNewEvent = false; render(); toast("Event added"); }
    catch (err) { toast(err.message, true); }
  }
  document.addEventListener("keydown", (e) => {
    if ($("#lightbox").hidden) return;
    if (e.key === "Escape") closeLB();
    else if (e.key === "ArrowRight" && S.lbList.length > 1) { S.lbIndex = (S.lbIndex + 1) % S.lbList.length; renderLB(); }
    else if (e.key === "ArrowLeft" && S.lbList.length > 1) { S.lbIndex = (S.lbIndex - 1 + S.lbList.length) % S.lbList.length; renderLB(); }
  });
  window.addEventListener("beforeunload", (e) => { if (S.dirty) { e.preventDefault(); e.returnValue = ""; } });

  // ───────────────────────── boot ──────────────────────────
  (async function boot() {
    document.title = CFG.title || "Event Materials";
    $("#site-title").textContent = CFG.title || "Event Materials";
    $("#site-sub").textContent = CFG.subtitle || "";
    const mb = $("#mode-badge");
    mb.className = "mode " + (LIVE ? "live" : "demo");
    mb.textContent = LIVE ? "● Live" : "Demo mode";
    mb.title = LIVE ? "Connected to the master Google Sheet" : "Demo mode – changes are saved in this browser only";
    $("#view").innerHTML = `<div class="empty"><h2>Loading…</h2></div>`;
    try { await loadAll(); }
    catch (err) { $("#view").innerHTML = `<div class="empty"><h2>Couldn't load the data</h2><p>${esc(err.message)}</p></div>`; return; }
    const [v, arg] = (location.hash.slice(1) || "catalogue").split("/");
    if (["catalogue", "events", "warehouse", "reports"].includes(v)) S.view = v;
    if (v === "ideas" || (v === "reports" && arg === "jobs")) { S.view = "reports"; S.reportTab = "jobs"; }
    if (v === "warehouse" && arg) S.whEvent = decodeURIComponent(arg);
    render();
  })();
})();
