// Writes a Pocket Query .zip with its coordinates, types, ratings and log dates kept and every name, code and text invented; for docs-screenshots.mjs, never committed.
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, extname } from 'node:path';

import JSZip from 'jszip';

const [source, target] = process.argv.slice(2);
if (!source || !target) {
  throw new Error(
    'usage: npm run screenshots:anonymize -- <pocket-query.zip> <anonymized.zip>',
  );
}

const SERIES = [
  'Feldweg',
  'Wiesenblick',
  'Ackerrand',
  'Waldsaum',
  'Bachlauf',
  'Hecke',
  'Kapellenweg',
  'Flurstück',
  'Radlweg',
  'Weiherrunde',
  'Kiesgrube',
  'Obstwiese',
];
const OWNERS = [
  'Mossy Boots',
  'Team Feldmaus',
  'Dosenfuchs',
  'Kiebitz & Co',
  'Waldläufer 7',
  'Petling Pete',
];
const HINTS = [
  'Unter dem Stein am Pfosten',
  'Magnetisch',
  'Im Baum, Augenhöhe',
  'Hinter dem Schild',
  'Am Zaun, unten',
];
// Geocaching.com codes never contain S or U, so no invented code can name a real cache.
const CODE_PREFIX = 'GCSU';
// About 3 km by 3 km at Munich's latitude: caches in one cell share a series name.
const CELL_DEGREES = { latitude: 0.03, longitude: 0.045 };
const MAX_LOGS = 5;

const escapeXml = (text) =>
  text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

const firstText = (block, tag) =>
  new RegExp(`<${tag}(?:\\s[^>]*)?>([^<]*)</${tag}>`).exec(block)?.[1].trim() ??
  '';

const attribute = (block, tag, name) =>
  new RegExp(`<${tag}\\s[^>]*\\b${name}="([^"]*)"`).exec(block)?.[1] ?? '';

const waypointsOf = (xml) => xml.match(/<wpt\s[\s\S]*?<\/wpt>/g) ?? [];

function seriesNamer() {
  const counts = new Map();
  return (latitude, longitude) => {
    const row = Math.floor(latitude / CELL_DEGREES.latitude);
    const column = Math.floor(longitude / CELL_DEGREES.longitude);
    const cell = `${row}:${column}`;
    const number = (counts.get(cell) ?? 0) + 1;
    counts.set(cell, number);
    const index = Math.abs(row * 31 + column * 17);
    return {
      name: `${SERIES[index % SERIES.length]} ${String(number).padStart(2, '0')}`,
      owner: OWNERS[index % OWNERS.length],
    };
  };
}

function logsOf(block) {
  const logs = block.match(/<groundspeak:log\s[\s\S]*?<\/groundspeak:log>/g);
  return (logs ?? [])
    .slice(0, MAX_LOGS)
    .map(
      (log, index) =>
        `        <groundspeak:log id="${index + 1}">\n` +
        `          <groundspeak:date>${firstText(log, 'groundspeak:date')}</groundspeak:date>\n` +
        `          <groundspeak:type>${firstText(log, 'groundspeak:type')}</groundspeak:type>\n` +
        `          <groundspeak:finder id="${index + 1}">Finder ${index + 1}</groundspeak:finder>\n` +
        `          <groundspeak:text encoded="False">Invented log.</groundspeak:text>\n` +
        `        </groundspeak:log>\n`,
    );
}

function anonymizedCache(block, { code, name, owner, hint }) {
  const latitude = attribute(block, 'wpt', 'lat');
  const longitude = attribute(block, 'wpt', 'lon');
  const type = firstText(block, 'groundspeak:type');
  const difficulty = firstText(block, 'groundspeak:difficulty');
  const terrain = firstText(block, 'groundspeak:terrain');
  return (
    `  <wpt lat="${latitude}" lon="${longitude}">\n` +
    `    <time>${firstText(block, 'time')}</time>\n` +
    `    <name>${code}</name>\n` +
    `    <desc>${escapeXml(`${name} by ${owner}, ${type} (${difficulty}/${terrain})`)}</desc>\n` +
    `    <urlname>${escapeXml(name)}</urlname>\n` +
    `    <sym>Geocache</sym>\n` +
    `    <type>Geocache|${escapeXml(type)}</type>\n` +
    `    <groundspeak:cache id="${code}" available="${attribute(block, 'groundspeak:cache', 'available')}" archived="${attribute(block, 'groundspeak:cache', 'archived')}" xmlns:groundspeak="http://www.groundspeak.com/cache/1/0/1">\n` +
    `      <groundspeak:name>${escapeXml(name)}</groundspeak:name>\n` +
    `      <groundspeak:placed_by>${escapeXml(owner)}</groundspeak:placed_by>\n` +
    `      <groundspeak:owner id="1">${escapeXml(owner)}</groundspeak:owner>\n` +
    `      <groundspeak:type>${escapeXml(type)}</groundspeak:type>\n` +
    `      <groundspeak:container>${escapeXml(firstText(block, 'groundspeak:container'))}</groundspeak:container>\n` +
    `      <groundspeak:difficulty>${difficulty}</groundspeak:difficulty>\n` +
    `      <groundspeak:terrain>${terrain}</groundspeak:terrain>\n` +
    `      <groundspeak:short_description html="False">An invented cache.</groundspeak:short_description>\n` +
    `      <groundspeak:long_description html="False">Anonymized: this name and code do not exist.</groundspeak:long_description>\n` +
    `      <groundspeak:encoded_hints>${escapeXml(hint)}</groundspeak:encoded_hints>\n` +
    `      <groundspeak:logs>\n${logsOf(block).join('')}      </groundspeak:logs>\n` +
    `    </groundspeak:cache>\n` +
    `  </wpt>\n`
  );
}

function anonymizedParkingArea(block, name) {
  return (
    `  <wpt lat="${attribute(block, 'wpt', 'lat')}" lon="${attribute(block, 'wpt', 'lon')}">\n` +
    `    <name>${name}</name>\n` +
    `    <desc>Parkplatz</desc>\n` +
    `    <sym>Parking Area</sym>\n` +
    `    <type>Waypoint|Parking Area</type>\n` +
    `  </wpt>\n`
  );
}

const gpx = (name, body) =>
  `<?xml version="1.0" encoding="utf-8"?>\n` +
  `<gpx xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" version="1.0" creator="PowerTrailBuddy anonymizer" xmlns="http://www.topografix.com/GPX/1/0">\n` +
  `  <name>${name}</name>\n` +
  `  <desc>Anonymized Pocket Query: real coordinates, invented names and codes.</desc>\n` +
  body +
  `</gpx>\n`;

function anonymizeCaches(xml) {
  const nameOf = seriesNamer();
  const newSuffixes = new Map();
  const caches = waypointsOf(xml)
    .filter((block) => block.includes('<groundspeak:cache'))
    .map((block, index) => {
      const code = `${CODE_PREFIX}${index.toString(36).toUpperCase().padStart(3, '0')}`;
      newSuffixes.set(firstText(block, 'name').slice(2), code.slice(2));
      const latitude = Number(attribute(block, 'wpt', 'lat'));
      const longitude = Number(attribute(block, 'wpt', 'lon'));
      const { name, owner } = nameOf(latitude, longitude);
      const hint = HINTS[index % HINTS.length];
      return anonymizedCache(block, { code, name, owner, hint });
    });
  return { caches, newSuffixes };
}

function anonymizeParkingAreas(xml, newSuffixes) {
  return waypointsOf(xml).flatMap((block) => {
    if (!/<sym>\s*Parking Area\s*<\/sym>/.test(block)) return [];
    const name = firstText(block, 'name');
    const suffix = newSuffixes.get(name.slice(2));
    return suffix ? [anonymizedParkingArea(block, `PK${suffix}`)] : [];
  });
}

const zip = await JSZip.loadAsync(readFileSync(source));
const files = await Promise.all(
  Object.values(zip.files)
    .filter((file) => file.name.toLowerCase().endsWith('.gpx'))
    .map(async (file) => file.async('string')),
);
const cacheFiles = files.filter((xml) => xml.includes('<groundspeak:cache'));
const waypointFiles = files.filter(
  (xml) => !xml.includes('<groundspeak:cache'),
);
const { caches, newSuffixes } = anonymizeCaches(cacheFiles.join('\n'));
const parkingAreas = anonymizeParkingAreas(
  waypointFiles.join('\n'),
  newSuffixes,
);

// The app names the query after the file, so the output zip's name is what the screenshots show.
const query = basename(target, extname(target));
const output = new JSZip();
output.file(`${query}.gpx`, gpx(query, caches.join('')));
output.file(
  `${query}-wpts.gpx`,
  gpx(`${query} waypoints`, parkingAreas.join('')),
);
writeFileSync(target, await output.generateAsync({ type: 'nodebuffer' }));
console.log(
  `${target}: ${caches.length} caches, ${parkingAreas.length} parking areas`,
);
