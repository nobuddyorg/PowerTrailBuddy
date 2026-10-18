# User guide

Every task in PowerTrailBuddy. First time? Start with
[Getting started](../tutorials/getting-started.md).

PowerTrailBuddy only reads files you downloaded yourself; it never signs in
to geocaching.com and never sends your data anywhere. The only thing it
loads from the internet is the OpenStreetMap map.

## Create a Pocket Query for power trails

Pocket Queries are a Geocaching.com Premium feature, under **Play → Pocket
Queries**.

- **At most 1,000 caches** per query, the site's limit. For a larger area,
  create several queries with neighbouring centres and import them all; the
  app merges them.
- **Traditional only** is recommended. Other types can be included in
  [Settings](#change-the-trail-settings), but power trails are made of
  Traditionals and every extra cache makes the import slower.
- **That I haven't found** and **Is enabled**: found caches and disabled ones
  are left out of trails anyway, so including them only costs space.
- **Difficulty and terrain up to 2** matches the default settings.
- **Compress files into a .zip**: the app reads the zip directly.

## Get the Pocket Query file

- **Download**: once the query has run, its `.zip` is under **Ready for
  download** on the Pocket Queries page for a few days. This works for any
  size up to 1,000 caches.
- **E-mail**: queries with up to 500 caches are also e-mailed as an
  attachment. Save the attachment, or share it straight to the app (below).

The zip holds one `.gpx` file with the caches and usually a second
`*-wpts.gpx` with additional waypoints (parking, stages). Both may be
imported; additional waypoints are skipped.

GPX files exported from GSAK, Locus Map, c:geo or Cachly use the same format
and import too.

## Import files

Choose **Import** and pick one or more `.zip` or `.gpx` files. The app
reports, per file, how many caches it read, or why it could not read one:

- **unsupported**: not a `.zip` or `.gpx` file, or not a geocache GPX;
- **unreadable**: a damaged file;
- **too large**: a zip of more than 50 files or more than 100 MB unpacked.

Importing again adds to what is already there: a cache imported twice is
kept once, the newer file's details winning. Re-import a fresh run of the
same query to catch disabled or archived caches.

## Share a file to the app (Android)

Install the app first ([below](#install-the-app)); Android only offers
installed web apps in the share sheet. Then, in your e-mail or files app,
share the `.zip` or `.gpx` and pick **PowerTrailBuddy**. The app opens and
imports it.

iOS does not let web apps receive shared files; use **Import** there.

## Pick a trail

Trails are listed best first: most caches per hour, then most caches. Each
shows its number of caches, walking distance and time, and whether it is a
**line** (a chain along a path) or an **area** (a cluster to criss-cross).
Open one to see it on the map in walking order.

Long chains are split into several walks no longer than the
[maximum walk length](#change-the-trail-settings).

## Walk a trail

Start the walk to be guided cache by cache: the next cache, its distance and
direction from where you are (when you allow location access), and buttons to
mark it **found** or **skip** it. The walk is saved as you go; reopen the app
to continue. Caches you mark found are remembered and left out of future
trails even before your next Pocket Query.

## Change the trail settings

Under **Settings**: which cache types count, the highest difficulty and
terrain, the largest gap between two caches of one trail, the fewest caches a
trail needs, the longest single walk, and the walking speed and minutes per
cache used for the time estimate. Defaults and meanings:
[Configuration](../reference/configuration.md).

## Clear your data

**Clear all data** removes every imported cache, your settings, the caches you
marked found and any walk in progress from this browser. Nothing else holds a
copy.

## Install the app

- **Android / Chrome**: menu → **Install app**.
- **iOS / Safari**: Share → **Add to Home Screen**.

Installed, the app opens full screen and works offline once it has been
loaded; the map needs a connection for areas you have not viewed.

## Language

German by default, English if your browser prefers it; switchable in the app.
