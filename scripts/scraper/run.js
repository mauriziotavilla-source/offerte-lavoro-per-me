/**
 * Scraper: legge le fonti, normalizza le offerte, le unisce a quelle "seed"
 * (inserite a mano in data/offerte.json), calcola le novità e salva i file.
 *
 * Uso:
 *   node scraper/run.js          -> anteprima (non salva)
 *   node scraper/run.js --write  -> salva data/offerte.json e data/novita.json
 *
 * Copyright © 2026 Maurizio Tavilla
 */

const path = require('path');
const fs = require('fs');
const sources = require('./sources');
const { readJson, writeJson } = require('./lib/io');
const { collectFromSource } = require('./lib/parsers');
const { normalizeSourceItems } = require('./lib/normalize');
const { buildDiff, nextTopLevelData } = require('./lib/diff');
const { filterForProfile, filterStats, valutaProfilo, loadProfilo } = require('./lib/profile-filter');
const { shouldRetainPrevious } = require('./lib/retention');

const ROOT = path.join(__dirname, '..', '..');

function resolvePath(...candidates) {
  for (const c of candidates) if (c && fs.existsSync(c)) return c;
  return candidates[0];
}

const OFFERTE_FILE = resolvePath(path.join(ROOT, 'data', 'offerte.json'), path.join(ROOT, 'offerte.json'));
const NOVITA_FILE =
  path.dirname(OFFERTE_FILE) === ROOT
    ? path.join(ROOT, 'novita.json')
    : path.join(ROOT, 'data', 'novita.json');

function isWriteMode() {
  return process.argv.includes('--write');
}

function canonicalUrl(url) {
  return String(url || '').trim().replace(/[?#].*$/, '').replace(/\/$/, '');
}

function dedupe(list) {
  const byKey = new Map();
  list.forEach((o) => {
    const key = canonicalUrl(o.link_ufficiale) || canonicalUrl(o.url_origine) || `${o.id}::${(o.nome || '').toLowerCase()}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, o);
      return;
    }
    const existingScore = Number(Boolean(existing.hash_contenuto)) + Number(Boolean(existing.scadenze?.length));
    const nextScore = Number(Boolean(o.hash_contenuto)) + Number(Boolean(o.scadenze?.length));
    if (nextScore >= existingScore) byKey.set(key, { ...existing, ...o });
  });
  return [...byKey.values()];
}

function splitPrevious(previousData) {
  const seed = [];
  const retained = [];
  (previousData.offerte || []).forEach((o) => {
    if (!o.fonte_scraper || o.fonte_scraper === 'manual_seed') {
      seed.push({ ...o, fonte_scraper: 'manual_seed', url_origine: o.url_origine || o.link_ufficiale || '' });
      return;
    }
    if (shouldRetainPrevious(o)) retained.push(o);
  });
  return { seed, retained };
}

async function collectAll() {
  const collected = [];
  const errors = [];
  for (const source of sources.filter((s) => s.enabled !== false)) {
    try {
      const raw = await collectFromSource(source);
      const normalized = normalizeSourceItems(source, raw);
      const filtrati = filterForProfile(normalized);
      const stats = filterStats(normalized);
      console.log(
        `Fonte ${source.id}: ${normalized.length} elementi → ${filtrati.length} adatti al profilo (scartati ${stats.scartati})`
      );
      collected.push(...filtrati);
    } catch (err) {
      const detail = { source: source.id, message: err.message || String(err) };
      console.warn(`Fonte ${source.id} fallita: ${detail.message}`);
      errors.push(detail);
    }
  }
  return { collected, errors };
}

function sortByName(list) {
  return [...list].sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'it'));
}

async function main() {
  const previousData = readJson(OFFERTE_FILE, { offerte: [], versione: 1 });
  const { seed, retained } = splitPrevious(previousData);
  const { collected, errors } = await collectAll();

  const profilo = loadProfilo();
  const retainedFiltered = retained.filter((o) => valutaProfilo(o, profilo).ok);
  if (retainedFiltered.length < retained.length) {
    console.log(
      `Rimossi ${retained.length - retainedFiltered.length} bandi conservati non più adatti al profilo`
    );
  }

  const merged = sortByName(dedupe([...seed, ...retainedFiltered, ...collected]));
  if (retainedFiltered.length) {
    console.log(`Conservati ${retainedFiltered.length} bandi precedenti ancora entro scadenza`);
  }
  const nextData = nextTopLevelData(previousData, merged, { sourceErrors: errors });
  const novita = buildDiff(previousData, nextData, errors);

  if (!isWriteMode()) {
    console.log(`\nAnteprima: ${merged.length} offerte totali`);
    console.log(`Nuove: ${novita.counts.nuovi} | Aggiornate: ${novita.counts.aggiornati}`);
    if (errors.length) console.log(`Fonti con errore: ${errors.length}`);
    console.log('(Esegui con --write per salvare i file)');
    return;
  }

  writeJson(OFFERTE_FILE, nextData);
  writeJson(NOVITA_FILE, novita);
  console.log(`\nSalvato ${OFFERTE_FILE}`);
  console.log(`Salvato ${NOVITA_FILE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
