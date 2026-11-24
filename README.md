# Event Materials Catalogue

A visual, Nordic-branded catalogue of every **roll-up banner** and **special offer form**, used to plan which banners go to each event, pack and dispatch them, count them back in, and keep stock levels up to date. A Google Sheet is the single master copy. The website reads from that sheet and writes to it.

| Who | What they do |
|---|---|
| **Your boss / event owners** | **Catalogue** tab → pick an event → press **+** on the banners they want → **Save list** |
| **Warehouse** | **Warehouse** tab → tick each banner as packed → **Mark as dispatched**. When the banners come back, enter how many came back OK, damaged or missing → **Complete check-in** |
| **Design team** | **Reports → Design jobs** lists everything that needs making for an event – what to make, which event, which past event's style to copy, how many copies and when it's needed. Update the status (To do → In design → Done) as you go. Jobs appear automatically when someone picks something from **Made for each event** or **From past events** for an event and saves the list. |
| **Anyone** | **Reports** tab → stock levels, what's out at events, losses and damage, the activity log, and the **visual audit**, which replaces the Slides deck. Print it or save it as a PDF |

Click any banner, anywhere on the site, to see it large. Click the large image to zoom in, and use ← → to browse.

---

## Setup (about 15 minutes, one time only)

### 1. Put the site on GitHub Pages
1. Create a free account at github.com, then click **New repository**. Name it `event-catalogue`, set it to **Public**, and click **Create**.
2. On the new repository page, click **uploading an existing file**. Drag in **everything inside this folder**: `index.html`, `config.js`, and the `css`, `js`, `data`, `images` and `apps-script` folders. Then click **Commit changes**.
3. Go to **Settings → Pages**. Under *Branch*, choose `main` and `/ (root)`, then click **Save**.
4. After a minute your site is live at `https://YOUR-USERNAME.github.io/event-catalogue/`.

The site now runs in **demo mode**. Everyone can browse, but any changes are saved only in the browser of the person who made them.

### 2. Create the master Google Sheet
1. Create a new Google Sheet and name it something like **Event Materials – MASTER**.
2. Go to **Extensions → Apps Script**. Delete what's there, then paste in everything from `apps-script/Code.gs`.
3. On the line `const SITE_URL = ...`, replace the address with your GitHub Pages address from step 1.
4. Choose **setup** from the function menu and click **Run**. Approve the permissions it asks for: it needs to edit this sheet and read your site.
   This creates the tabs (**Banners**, **Posters**, **PriceLists**, **Brochures**, **PastEventMaterials**, **Offers**, **Events**, **Ideas** (design jobs), **Bookings**, **Movements**) and imports all the banners, posters, special offer forms and events.

### 3. Connect the site to the sheet
1. In Apps Script, go to **Deploy → New deployment**. Under the cog, choose **Web app**.
   - *Execute as*: **Me**
   - *Who has access*: **Anyone**
2. Click **Deploy** and copy the **Web app URL**. It ends in `/exec`.
3. On GitHub, open `config.js`, click the ✏️ pencil, and paste the URL between the quotes on the line `apiUrl: "",`. Click **Commit changes**.
4. Reload the site. The badge at the top right should now read **● Live – Google Sheet**.

---

## Keeping it up to date: edit only the Google Sheet

- **New banner:** add a row to the **Banners** tab with the next free ID (for example `BN-111`). Then upload its image to `images/banners/` on GitHub (drag it onto that folder and **Commit**), named after the ID: `BN-111.jpg`. In the `thumbnail` column, enter `images/banners/BN-111.jpg`.
- **Banner moved, reprinted or binned:** change its `stored_at`, `qty_owned` or `status` in the sheet.
- **Materials made for a specific event** (flyers, posters, vouchers, certificates, name badges and so on) go in *MARKETING / Event materials catalogue [linked to]*, in one folder per event. On the site they appear under **From past events**, grouped by event and linked from that event's card in the archive. These haven't been made for the new event yet, so they're marked **🎨 To be made by design**. When one is picked for an event and the list is saved, a design request is added to the **Ideas** board automatically, linked to the event and dated for its ship-by date. In **Warehouse** they appear in a separate "Being made by the design team" box, not on the packing list. You can also send one to the designers on its own with **Ask the designers to adapt this for another event**. To add a new event's materials, add rows to the **PastEventMaterials** tab, with `event_id` set to the event, plus a picture in `images/pastevents/` and the PDF in `pdfs/`. Or ask Claude to read the event's folder and do it for you.
- **New clinical handout, cheat sheet, chart or guide:** add a row to the **Clinical** tab (for example `CL-148`) with its front page in `images/clinical/`. These come from the TESTS & CLINICAL MATERIALS drive (Functional, Genetic, Multi-test). Only the front page is shown – forms are the exception and may show more pages. Language and regional versions of the same design share a `design_id` and show on one card.
- **Digital assets for an event's run-up** (WhatsApp invitations, social posts, email banners, website sliders, holding screens): add a row to the **Digital** tab (for example `DA-023`) with the event's `event_id`, the month it went out in `version` (e.g. `2026-08`) and the first image in `images/digital/`. Put the number of images in a set in `images`. Each event card then shows a **📱 Digital run-up** button listing them in date order. Picking one for a new event adds a design job – nothing is packed.
- **New brochure or flyer:** add a row to the **Brochures** tab (for example `BR-061`), with its cover in `images/brochures/` (and page 2 as `-p2.jpg`) and its PDF in `pdfs/`. Use only final print files (Final_, For print_ or To Print folders) – never anything with draft in the name.
- **New price list:** add a row to the **PriceLists** tab (for example `PL-007`), with its picture in `images/pricelists/` and its PDF in `pdfs/`. Price lists are printed for each event, like posters.
- **New poster:** add a row to the **Posters** tab (for example `PO-015`). Upload a picture to `images/posters/` and the print PDF to `pdfs/`. Posters are printed new for each event, so like special offer forms they have no stock count.
- **New special offer form:** add a row to the **Offers** tab with the next free ID (for example `SO-019`). Upload a picture of page 1 to `images/offers/` (and page 2 as `SO-019-p2.jpg`, if it has one), and the print-ready PDF to `pdfs/` as `SO-019.pdf`. Special offer forms are printed for each event, so they have no stock count: the quantity picked for an event is the number of copies to print.
- **New event:** add it on the site (**Events → + New event**) or add a row to the **Events** tab.
- **Don't edit** the **Bookings** or **Movements** tabs by hand. The site writes to them, and they're the record of what happened.

Stock is always worked out the same way: *in store = owned − out at events*. Dispatching takes banners out. Checking them back in returns them. Damaged or missing banners are taken off **owned** automatically and listed under **Reports → Losses & damage**.

### The same banner in several places
Each row in the **Banners** tab is one design *at one location*. When the same design is kept in more than one place (for example DNA Core in the UK office and in Denmark), give those rows the same `design_id` (for example `D02`). The site then shows them as a single card, with a bubble for each location showing how many are kept there. Clicking the card shows each location's stock count separately. When a design is picked for an event, the site takes it from the UK office first, then from other locations.

Banners are sorted so that all banners for the same test appear next to each other, in every language (all DNA Core, all DUTCH, and so on), with the newest artwork first. The `artwork_date` column (YYYY-MM) sets that order.

### Columns in the Banners tab
`banner_id` · `name` · `brand` · `section` · `language` · `stored_at` (the location chips) · `banner_type` (Roll-up / Backlit / Table-top) · `qty_owned` · `status` (`In use`, `To check`, `In review`, `To make`, …) · `action_needed` (shown as an orange flag, for example `Print x1`) · `verified_in_audit` · `last_audit` · `thumbnail` · `notes` · `artwork_file` · `design_id`

---

## Good to know
- **It's public.** A free GitHub Pages site can be opened by anyone with the link, and so can the Web app URL. Neither is listed anywhere public, but don't put anything confidential in the sheet. Making it private needs GitHub Enterprise Cloud, or a move to a host with a sign-in step. The site is plain HTML, so moving it is easy.
- **After editing Code.gs**, go to **Deploy → Manage deployments → ✏️ → Version: New version → Deploy**. This keeps the same URL.
- **Event types** for filters and colours are set in `config.js` → `eventTypes`.
- `data/offers.csv` only includes the final versions of the special offer forms, taken from the `Final_`, `For print_` and `To Print` folders in *Promotions For Events / Special Offers*. The DNA Hormones and Growbaby flyers have no final folder, so the non-draft PDFs were used.
- Banner previews come from the final artwork in *BRAND ASSETS / All Banners* (Roll-up, Backlit and Stage banners). Nothing in a folder or file with "draft" in its name was used. Banners show a preview only, with no download. The `artwork_file` column records which artwork file each preview came from.
- Banners with `stored_at = Artwork only` have final artwork but weren't in the August 2026 audit. When one is printed, set its location and `qty_owned`.
- **Backlit banners** and **Large banners** (backdrops and stage banners together) each have their own section. A row whose `banner_type` contains "Backlit" shows in Backlit banners, and one containing "Backdrop", "Stage" or "Large" shows in Large banners. A large backlit backdrop matches both, so it appears in both sections but is only counted once in stock.
- `data/banners.csv` was generated from *Banner Audit 0826*. Rows marked `verified_in_audit = No` weren't highlighted green in that deck, and the five `stored_at = To confirm` rows are the Russian and Serbian banners, whose location the deck doesn't say.

- **Made for each event** groups the materials that are re-made for every event (conference posters and flyers, test offer sheets, vouchers, name badges, certificates, feedback forms, QR flyers). Each past event's version is a "style". The `material` column in **PastEventMaterials** decides which card an item belongs to – leave it blank for things that aren't re-made (for example the logo wall backdrop, which is a physical item we own).

## Downloads are switched off (public site)

Because the GitHub Pages link is public, the site shows **previews only** – no PDFs can be downloaded, and brochures and clinical handouts show just their front page (forms can show more). The print-ready files stay on the Google Drive (each item shows where its file is under *Design file*).

If you later move to a paid GitHub plan with a private repo that needs a sign-in, you can turn downloads back on: add the PDFs to the `pdfs/` folder (named as in the `print_file` column) and set `allowDownloads: true` in `config.js`.

## Which file to use for previews

Always use the **most up-to-date version** from the *Final* / *For print* folders – a newer design wins even if it only exists as INP. Between files of that same version, prefer the **web** version for the preview picture, then **EXP** (external print, with bleed), then **INP** (internal print, 5 mm border, no bleed). Never use anything with *draft* in the folder or file name, or files in *Old*, *Edits* or *Assets* folders.

## Regional versions

Many materials exist in a **Nordic Labs region** and a **dnalife region** version – same design, different logos, website (nordic-labs.com / dnalife.healthcare), Nordic VMS and education links. Give both rows the same `design_id` and set `edition` to `Nordic Labs region` or `dnalife region`; the catalogue shows them as one card with region bubbles. Early-bird, offer and currency versions stay separate cards.

Which version an event needs is set by its country in `config.js`: Nordic Labs region = Denmark, Sweden, Finland, UK, Germany, Portugal; Canada = dual branded; everywhere else = dnalife region. When you plan for an event, the matching version is ticked.

## Stands & extras and kit lists

**Stands & extras** (`data/misc.csv`, Misc tab) holds display equipment, table cloths, sample-report folders, giveaways and catering kit. Leave `consumable` blank for things that come back after an event (counted back in like banners) and put `yes` for things that are used up (cups, pens, bags, lanyards). `qty_owned` is blank until someone counts the stock – the site shows "count needed" until then. `usual_qty` is how many we normally take (from the Copenhagen 2026 kit list). Photos live in `images/misc/`; `photo_wanted` flags items that need a (better) photo.

**Kit lists** (`data/kitlists.csv`, KitLists tab) are the events team's full packing lists, one row per line, with `item_ref` linking a line to a catalogue item where there is one. They show as "Full kit list" on the event's card.


## Event requests
The **Request an event** form (Events page) adds the request to the Events tab and emails it to **se@nordicgroup.eu**, with the requester as reply-to. To change the address, edit `REQUEST_EMAIL` in `apps-script/Code.gs` (and `requestEmail` in `config.js`, which is shown on the form). The first time the script sends mail, Google asks you to allow it.


## Design team codes (who can change design job statuses)

Only the design team can change the status of a job in **Reports › Design jobs**. Each designer has their own code:

1. In the Google Sheet, open **Extensions › Apps Script**, then **Project Settings** (the cog on the left).
2. Under **Script properties**, click **Add script property**.
3. Property: `DESIGN_CODES` – Value: one `Name = code` per person, separated by `;`, for example `Anna = 4821; Ben = 7730`.
4. Save. To change a code or add/remove a person, edit the value – no need to redeploy.

On the site, a designer clicks **Unlock to change status** and enters their code once per computer; their name is then recorded on every status change. Everyone else can still see all jobs and statuses.
