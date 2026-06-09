/**
 * Invia notifiche push Android (Firebase Cloud Messaging) per le nuove offerte.
 * Legge data/novita.json e invia un messaggio per ogni topic.
 *
 * Richiede la variabile d'ambiente FIREBASE_SERVICE_ACCOUNT_JSON
 * (il contenuto del file service account di Firebase).
 *
 * Uso:
 *   node scraper/send-push.js
 *   node scraper/send-push.js --test --topic=concorsi_pubblici
 *
 * Copyright © 2026 Maurizio Tavilla
 */

const path = require('path');
const fs = require('fs');
const admin = require('firebase-admin');
const { readJson } = require('./lib/io');

const ROOT = path.join(__dirname, '..', '..');

function resolveNovitaFile() {
  const candidates = [path.join(ROOT, 'data', 'novita.json'), path.join(ROOT, 'novita.json')];
  for (const c of candidates) if (fs.existsSync(c)) return c;
  return candidates[0];
}

const NOVITA_FILE = resolveNovitaFile();

function loadServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '';
  if (!raw.trim()) return null;
  return JSON.parse(raw);
}

function groupByTopic(items) {
  const grouped = new Map();
  items.forEach((item) => {
    (item.notifica_topics || []).forEach((topic) => {
      if (!grouped.has(topic)) grouped.set(topic, []);
      grouped.get(topic).push(item);
    });
  });
  return grouped;
}

function labelTopic(topic) {
  if (topic === 'concorsi_pubblici') return 'concorsi pubblici';
  if (topic === 'categorie_protette') return 'offerte categorie protette';
  return 'offerte di lavoro';
}

function titleForTopic(topic, count) {
  const label = labelTopic(topic);
  return count === 1 ? `Nuova ${label.replace(/^offerte? /, 'offerta ').replace(/^concorsi/, 'concorso')}` : `${count} nuove ${label}`;
}

function bodyForItems(items) {
  if (items.length === 1) return items[0].nome;
  return items.slice(0, 2).map((i) => i.nome).join(' • ');
}

function isTestMode() {
  return process.argv.includes('--test');
}

function getTestTopic() {
  const arg = process.argv.find((a) => a.startsWith('--topic='));
  const topic = arg ? arg.slice('--topic='.length).trim() : 'offerte_lavoro';
  const allowed = new Set(['offerte_lavoro', 'concorsi_pubblici', 'categorie_protette']);
  return allowed.has(topic) ? topic : 'offerte_lavoro';
}

function buildTestNovita(topic) {
  return {
    generated_at: new Date().toISOString(),
    source_run: 'test-push-github-actions',
    nuovi: [
      {
        id: 'test-push-github-actions',
        nome: 'Test automatico – nuova offerta (prova GitHub Actions)',
        tipo: topic === 'concorsi_pubblici' ? 'concorso' : topic === 'categorie_protette' ? 'categoria_protetta' : 'lavoro',
        notifica_topics: [topic],
      },
    ],
  };
}

async function main() {
  const serviceAccount = loadServiceAccount();
  if (!serviceAccount) {
    console.log('Push saltate: manca FIREBASE_SERVICE_ACCOUNT_JSON');
    return;
  }

  const testMode = isTestMode();
  const novita = testMode ? buildTestNovita(getTestTopic()) : readJson(NOVITA_FILE, null);

  if (!testMode) {
    console.log(`Lettura novità da: ${NOVITA_FILE}`);
    console.log(`Nuove offerte in novita.json: ${novita?.nuovi?.length ?? 0}`);
  } else {
    console.log(`Modalità test: invio push di prova al topic "${getTestTopic()}"`);
  }

  if (!novita?.nuovi?.length) {
    console.log('Nessuna nuova offerta da notificare.');
    return;
  }

  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  }

  const grouped = groupByTopic(novita.nuovi);
  for (const [topic, items] of grouped.entries()) {
    const ids = items.map((i) => i.id).filter(Boolean);
    const payload = {
      notification: { title: titleForTopic(topic, items.length), body: bodyForItems(items) },
      data: {
        kind: 'nuove_offerte',
        topic,
        count: String(items.length),
        offerta_id: ids[0] || '',
        offerta_ids: ids.join(','),
        generatedAt: novita.generated_at || '',
      },
      android: { priority: 'high', notification: { channelId: 'offerte_nuove', defaultSound: true } },
      topic,
    };
    const messageId = await admin.messaging().send(payload);
    console.log(`Push inviata a ${topic}: ${messageId}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
