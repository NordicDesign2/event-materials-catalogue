/**
 * Event Materials Catalogue – Google Sheet back end
 * ------------------------------------------------------------------
 * Paste this whole file into Extensions → Apps Script in your master
 * Google Sheet, then follow the README (steps 2 and 3).
 *
 * Tabs it uses (created by setup()):
 *   Banners    – the master banner list (one row per design). Edit freely.
 *   Posters    – posters (printed new for each event, not stock-counted). Edit freely.
 *   Offers     – special offer forms (printed per event, not stock-counted). Edit freely.
 *   Events     – one row per event. Edit freely.
 *   Ideas      – design jobs: materials the design team needs to make for an event (shown in Reports › Design jobs).
 *   Bookings   – which banners each event has asked for (written by the site).
 *   Movements  – every dispatch / return / loss / stock change (written by the site).
 */

// ▼ Optional: email address(es) to tell the design team about new ideas (comma-separated). Leave '' for none.
const NOTIFY_EMAIL = '';
// ▼ Where event requests from the "Request an event" form are emailed
const REQUEST_EMAIL = 'se@nordicgroup.eu';

// ▼ Set this to your GitHub Pages address before running setup()
const SITE_URL = 'https://YOUR-USERNAME.github.io/event-catalogue/';

const TABS = {
  Banners: ['banner_id', 'name', 'brand', 'section', 'language', 'stored_at', 'banner_type', 'qty_owned', 'status',
            'action_needed', 'verified_in_audit', 'last_audit', 'thumbnail', 'notes', 'artwork_file', 'artwork_date', 'design_id'],
  Events: ['event_id', 'event_name', 'event_type', 'start_date', 'end_date', 'venue', 'city', 'country', 'ship_by',
           'return_by', 'status', 'owner', 'notes', 'featured_items',
           'requested_by', 'requester_email', 'request_type', 'attendees', 'brand_region', 'materials_requested'],
  Offers: ['item_id', 'name', 'section', 'format', 'currency', 'region', 'brand', 'version', 'event_specific', 'pages',
           'thumbnail', 'thumbnail_2', 'print_file', 'source_file', 'status', 'notes'],
  Posters: ['item_id', 'name', 'section', 'format', 'currency', 'region', 'language', 'brand', 'version', 'event_specific',
            'pages', 'thumbnail', 'thumbnail_2', 'print_file', 'source_file', 'status', 'notes', 'design_id', 'edition'],
  Ideas: ['idea_id', 'created_at', 'by', 'type', 'title', 'details', 'related_items', 'markets', 'event_id', 'needed_by',
          'status', 'designer_notes', 'updated_at', 'updated_by'],
  PriceLists: ['item_id', 'name', 'section', 'format', 'currency', 'region', 'language', 'brand', 'version', 'event_specific',
               'pages', 'thumbnail', 'thumbnail_2', 'print_file', 'source_file', 'status', 'notes'],
  Clinical: ['item_id', 'name', 'section', 'format', 'language', 'brand', 'test_area', 'version', 'pages', 'thumbnail', 'thumbnail_2', 'source_file', 'status', 'notes', 'design_id', 'edition', 'material', 'design_only'],
  Digital: ['item_id', 'name', 'section', 'format', 'language', 'brand', 'version', 'event_id', 'event_specific', 'images', 'thumbnail', 'thumbnail_2', 'source_file', 'status', 'notes', 'design_id', 'edition', 'material'],
  Brochures: ['item_id', 'name', 'section', 'format', 'currency', 'region', 'language', 'brand', 'version', 'event_specific',
              'pages', 'thumbnail', 'thumbnail_2', 'print_file', 'source_file', 'status', 'notes', 'design_id', 'edition'],
  Misc: ['item_id', 'name', 'section', 'brand', 'consumable', 'stored_at', 'qty_owned', 'usual_qty', 'format', 'photo_wanted', 'thumbnail', 'thumbnail_2', 'source_file', 'status', 'notes'],
  KitLists: ['event_id', 'group', 'day', 'timing', 'item', 'qty', 'item_ref'],
  PastEventMaterials: ['item_id', 'name', 'section', 'event_id', 'kind', 'format', 'currency', 'region', 'language', 'brand',
                       'version', 'event_specific', 'pages', 'thumbnail', 'thumbnail_2', 'print_file', 'source_file', 'status', 'notes', 'stock_item', 'material', 'design_id', 'edition', 'banner_ref', 'generic', 'offer_design'],
  Bookings: ['event_id', 'banner_id', 'qty', 'status', 'updated_at', 'updated_by', 'note', 'day'],
  Movements: ['timestamp', 'event_id', 'banner_id', 'type', 'qty', 'by', 'note'],
};

/** Run once from the Apps Script editor: creates the tabs and imports the banner list from the site. */
function setup() {
  const ss = SpreadsheetApp.getActive();
  Object.keys(TABS).forEach((name) => {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    if (sh.getLastRow() === 0) {
      sh.getRange(1, 1, 1, TABS[name].length).setValues([TABS[name]]).setFontWeight('bold').setBackground('#e6f3f4');
      sh.setFrozenRows(1);
    }
  });
  importCsv_('Banners', SITE_URL + 'data/banners.csv');
  importCsv_('Events', SITE_URL + 'data/events.csv');
  importCsv_('Offers', SITE_URL + 'data/offers.csv');
  importCsv_('Posters', SITE_URL + 'data/posters.csv');
  importCsv_('PriceLists', SITE_URL + 'data/pricelists.csv');
  importCsv_('Brochures', SITE_URL + 'data/brochures.csv');
  importCsv_('Clinical', SITE_URL + 'data/clinical.csv');
  importCsv_('Digital', SITE_URL + 'data/digital.csv');
  importCsv_('Misc', SITE_URL + 'data/misc.csv');
  importCsv_('KitLists', SITE_URL + 'data/kitlists.csv');
  importCsv_('PastEventMaterials', SITE_URL + 'data/pastevents.csv');
  const blank = ss.getSheetByName('Sheet1');
  if (blank && blank.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(blank);
  SpreadsheetApp.getUi && SpreadsheetApp.getUi().alert('Set-up done. Next: Deploy → New deployment → Web app (see README).');
}

function importCsv_(tab, url) {
  const sh = SpreadsheetApp.getActive().getSheetByName(tab);
  if (sh.getLastRow() > 1) return; // never overwrite existing data
  const rows = Utilities.parseCsv(UrlFetchApp.fetch(url).getContentText('UTF-8').replace(/^﻿/, ''));
  const head = rows.shift();
  const cols = TABS[tab];
  const out = rows.filter((r) => r.join('').trim()).map((r) => cols.map((c) => {
    const i = head.indexOf(c);
    return i < 0 ? '' : r[i];
  }));
  if (out.length) {
    sh.getRange(2, 1, out.length, cols.length).setNumberFormat('@').setValues(out);
    const q = cols.indexOf('qty_owned');
    if (q >= 0) sh.getRange(2, q + 1, out.length, 1).setNumberFormat('0').setValues(out.map((r) => [Number(r[q]) || 0]));
  }
}

// ─────────────────────────── API ───────────────────────────
// Event requesters' email addresses stay in the Sheet – they are removed before the site gets the data.
function doGet(e) {
  try {
    if ((e.parameter.action || 'all') !== 'all') throw new Error('Unknown action');
    return json_({ ok: true, banners: read_('Banners'), events: read_('Events').map(function (r) { delete r.requester_email; return r; }), offers: read_('Offers'), posters: read_('Posters'), pricelists: read_('PriceLists'), pastevents: read_('PastEventMaterials'), brochures: read_('Brochures'), clinical: read_('Clinical'), digital: read_('Digital'), misc: read_('Misc'), kitlists: read_('KitLists'), ideas: read_('Ideas'), bookings: read_('Bookings'), movements: read_('Movements') });
  } catch (err) {
    return json_({ ok: false, error: String(err.message || err) });
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const p = JSON.parse(e.postData.contents);
    const by = String(p.by || 'Unknown').slice(0, 80);
    const now = new Date().toISOString();
    const mv = (event_id, banner_id, type, qty, note) => append_('Movements', { timestamp: now, event_id, banner_id, type, qty, by, note: note || '' });

    if (p.action === 'saveBooking') {
      const rows = read_('Bookings');
      if (rows.some((r) => r.event_id === p.event_id && r.status !== 'Requested')) throw new Error('This event has already been dispatched – its list can\'t be changed.');
      deleteWhere_('Bookings', (r) => r.event_id === p.event_id);
      (p.items || []).filter((i) => Number(i.qty) > 0).forEach((i) =>
        append_('Bookings', { event_id: p.event_id, banner_id: i.banner_id, qty: Number(i.qty), day: i.day || '', status: 'Requested', updated_at: now, updated_by: by, note: p.note || '' }));

    } else if (p.action === 'dispatch') {
      const moves = read_('Movements');
      updateWhere_('Bookings', (r) => r.event_id === p.event_id && r.status === 'Requested', (r) => {
        mv(p.event_id, r.banner_id, 'dispatch', Number(r.qty));
        const spare = spare_(moves, r.banner_id); // unused copies counted back in after earlier events are sent first
        if (spare > 0) mv(p.event_id, r.banner_id, 'spare used', Math.min(spare, Number(r.qty)), 'Spare copies left over from an earlier event, sent first');
        return { status: 'Dispatched', updated_at: now, updated_by: by };
      });

    } else if (p.action === 'checkIn') {
      (p.items || []).forEach((i) => {
        if (Number(i.returned)) mv(p.event_id, i.banner_id, 'return', Number(i.returned), p.note);
        if (Number(i.damaged)) mv(p.event_id, i.banner_id, 'damaged', Number(i.damaged), i.note || p.note);
        if (Number(i.missing)) mv(p.event_id, i.banner_id, 'missing', Number(i.missing), i.note || p.note);
        const lost = (Number(i.damaged) || 0) + (Number(i.missing) || 0);
        if (lost) updateStock_(i.banner_id, (r) => { const left = Math.max(0, Number(r.qty_owned) - lost); return left === 0 && Number(i.damaged) ? { qty_owned: left, status: 'Broken – out of stock' } : { qty_owned: left }; });
        if (i.store_at) updateStock_(i.banner_id, (r) => { if (r.stored_at === i.store_at) return {}; mv(p.event_id, i.banner_id, 'moved', Number(i.returned) || 0, 'Now stored at ' + i.store_at + ' (was ' + (r.stored_at || '—') + ')'); return { stored_at: i.store_at }; });
      });
      (p.leftovers || []).forEach((l) => { if (Number(l.qty) > 0) mv(p.event_id, l.banner_id, 'leftover', Number(l.qty), l.note || 'Unused – back in store'); });
      updateWhere_('Bookings', (r) => r.event_id === p.event_id, () => ({ status: 'Returned', updated_at: now, updated_by: by }));

    } else if (p.action === 'markBroken') {
      const n = Math.max(1, Number(p.qty) || 1);
      updateStock_(p.banner_id, (r) => { const left = Math.max(0, Number(r.qty_owned) - n); return left === 0 ? { qty_owned: left, status: 'Broken – out of stock' } : { qty_owned: left }; });
      mv('', p.banner_id, 'damaged', n, p.note || 'Marked as broken');

    } else if (p.action === 'moveStock') {
      updateStock_(p.banner_id, (r) => { mv('', p.banner_id, 'moved', Number(r.qty_owned) || 0, 'Now stored at ' + p.stored_at + ' (was ' + (r.stored_at || '—') + ')'); return { stored_at: p.stored_at }; });

    } else if (p.action === 'setBookingDay') {
      updateWhere_('Bookings', (r) => r.event_id === p.event_id && r.banner_id === p.banner_id && r.status === 'Requested', () => ({ day: p.day || '', updated_at: now, updated_by: by }));

    } else if (p.action === 'deleteEvent') {
      if (!p.event_id) throw new Error('No event given');
      deleteWhere_('Events', (r) => r.event_id === p.event_id);
      deleteWhere_('Bookings', (r) => r.event_id === p.event_id);
      deleteWhere_('Ideas', (r) => r.event_id === p.event_id && r.status === 'New');

    } else if (p.action === 'addEvent') {
      const ev = p.event || {};
      if (!ev.event_name || !ev.start_date) throw new Error('Event name and start date are required');
      const ids = read_('Events').map((r) => Number(String(r.event_id).replace(/\D/g, '')) || 0);
      ev.event_id = 'EVT-' + String(Math.max(0, ...ids) + 1).padStart(3, '0');
      append_('Events', ev);
      if (REQUEST_EMAIL && ev.status === 'Requested') MailApp.sendEmail({ to: REQUEST_EMAIL, replyTo: ev.requester_email || '', subject: 'Event request from ' + (ev.requested_by || by) + ': ' + ev.event_name,
        body: [ev.request_type, ev.event_name + ' – ' + ev.start_date + (ev.city ? ', ' + ev.city : ''), 'Materials: ' + (ev.materials_requested || '-'),
         'Contact: ' + (ev.requester_email || '-'), ev.notes || '', 'Open the catalogue: ' + SITE_URL + '#events'].join('\n') });

    } else if (p.action === 'addIdea') {
      const idea = p.idea || {};
      if (!idea.title || !idea.details) throw new Error('Please add a title and describe the idea');
      const ids = read_('Ideas').map((r) => Number(String(r.idea_id).replace(/\D/g, '')) || 0);
      idea.idea_id = 'IDEA-' + String(Math.max(0, ...ids) + 1).padStart(3, '0');
      Object.assign(idea, { created_at: now, by, status: 'New', updated_at: now });
      append_('Ideas', idea);
      if (NOTIFY_EMAIL) MailApp.sendEmail(NOTIFY_EMAIL, 'New design job from ' + by + ': ' + idea.title,
        idea.type + '\n\n' + idea.details + '\n\n' + (idea.markets ? 'Markets: ' + idea.markets + '\n' : '') +
        (idea.needed_by ? 'Needed by: ' + idea.needed_by + '\n' : '') + (idea.related_items ? 'Based on: ' + idea.related_items + '\n' : '') +
        '\nSee all design jobs: ' + SITE_URL + '#reports/jobs');

    } else if (p.action === 'updateIdea') {
      updateWhere_('Ideas', (r) => r.idea_id === p.idea_id, () => Object.assign({}, p.changes || {}, { updated_at: now, updated_by: by }));

    } else if (p.action === 'adjustStock') {
      let old = 0;
      updateStock_(p.banner_id, (r) => { old = Number(r.qty_owned) || 0; return { qty_owned: Number(p.qty_owned), status: r.status === 'Count needed' ? 'In stock' : r.status }; });
      mv('', p.banner_id, 'adjust', Number(p.qty_owned) - old, p.note || ('Stock count: ' + old + ' → ' + Number(p.qty_owned)));

    } else {
      throw new Error('Unknown action');
    }
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err.message || err) });
  } finally {
    lock.releaseLock();
  }
}

// ─────────────────────────── helpers ───────────────────────
function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
function sheet_(name) {
  const sh = SpreadsheetApp.getActive().getSheetByName(name);
  if (!sh) throw new Error('Missing tab "' + name + '" – run setup()');
  return sh;
}
function cell_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return v;
}
function read_(name) {
  const values = sheet_(name).getDataRange().getValues();
  const head = values.shift().map(String);
  return values.filter((r) => r.join('') !== '').map((r) => {
    const o = {};
    head.forEach((h, i) => (o[h] = cell_(r[i])));
    return o;
  });
}
function append_(name, obj) {
  const sh = sheet_(name);
  const head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  sh.appendRow(head.map((h) => (obj[h] === undefined ? '' : obj[h])));
}
// Spare copies of printed items / supplies: counted back in as unused, minus those sent out again
function spare_(moves, id) {
  return Math.max(0, moves.reduce((n, m) => (m.banner_id !== id ? n : m.type === 'leftover' ? n + Number(m.qty) : m.type === 'spare used' ? n - Number(m.qty) : n), 0));
}
// Stock lives in the Banners tab (BN-…) or the Misc tab (MI-… stands & extras)
function updateStock_(id, patch) {
  if (String(id).indexOf('MI-') === 0) updateWhere_('Misc', (r) => r.item_id === id, patch);
  else updateWhere_('Banners', (r) => r.banner_id === id, patch);
}

function updateWhere_(name, match, patch) {
  const sh = sheet_(name);
  const values = sh.getDataRange().getValues();
  const head = values[0];
  for (let i = 1; i < values.length; i++) {
    const row = {};
    head.forEach((h, j) => (row[h] = cell_(values[i][j])));
    if (!match(row)) continue;
    const changes = patch(row) || {};
    Object.keys(changes).forEach((k) => {
      const j = head.indexOf(k);
      if (j >= 0) sh.getRange(i + 1, j + 1).setValue(changes[k]);
    });
  }
}
function deleteWhere_(name, match) {
  const sh = sheet_(name);
  const values = sh.getDataRange().getValues();
  const head = values[0];
  for (let i = values.length - 1; i >= 1; i--) {
    const row = {};
    head.forEach((h, j) => (row[h] = cell_(values[i][j])));
    if (match(row)) sh.deleteRow(i + 1);
  }
}
