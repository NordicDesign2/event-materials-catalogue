/*
 * ─────────────────────────────────────────────────────────────
 *  Event Materials Catalogue – settings
 *  This is the only file you need to edit to set the site up.
 * ─────────────────────────────────────────────────────────────
 */
window.CATALOGUE_CONFIG = {
  title: "Event Materials",
  subtitle: "Nordic Group · events team",

  // THE MASTER GOOGLE SHEET
  // Paste the Web App URL you get from apps-script/Code.gs (see README, step 3).
  // While this is empty the site runs in DEMO MODE: it reads the CSV files in
  // /data and saves changes in your own browser only.
  // PDF downloads are OFF because this site is public – anyone with the link could download our materials.
  // Only switch this to true once the GitHub repo is private and the site needs a sign-in (paid GitHub plan),
  // and the print-ready PDFs have been added to the pdfs/ folder.
  allowDownloads: false,

  apiUrl: "",

  // Demo-mode data files (also used by the Google Sheet's one-click import)
  bannersCsv: "data/banners.csv",
  eventsCsv: "data/events.csv",
  offersCsv: "data/offers.csv",
  postersCsv: "data/posters.csv",
  pricelistsCsv: "data/pricelists.csv",
  pasteventsCsv: "data/pastevents.csv",
  brochuresCsv: "data/brochures.csv",
  clinicalCsv: "data/clinical.csv",
  digitalCsv: "data/digital.csv",
  miscCsv: "data/misc.csv",
  kitlistsCsv: "data/kitlists.csv",

  // Event types (used for filters, colours and the archive)
  eventTypes: ["The Nordic Conference", "dnalife Certification Course", "Masterclass & testing basics", "External"],

  // Event statuses treated as finished
  // Which regional version (logo, website, education link) to use for an event, by country.
  // Nordic Labs region uses Nordic Labs logos, nordic-labs.com, Nordic VMS and education.nordicvms.com;
  // everywhere else uses dnalife branding and dnalife.healthcare. Canada is dual branded.
  // Only stock kept here is dispatched and counted back in; elsewhere we just show what each office has
  // Event requests from sales colleagues are emailed here (set the same address as REQUEST_EMAIL in apps-script/Code.gs)
  requestEmail: "se@nordicgroup.eu",
  monitoredLocations: ["UK office", "To confirm"],
  nordicRegion: ["Denmark", "Sweden", "Finland", "United Kingdom", "UK", "Germany", "Portugal"],
  dualBrandRegion: ["Canada"],

  closedStatuses: ["Completed", "Cancelled"],
};
