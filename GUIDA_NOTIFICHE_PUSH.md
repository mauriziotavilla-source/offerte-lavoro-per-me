# Guida alle notifiche push (Firebase + GitHub + APK Android)

Ciao Maurizio! Questa guida ti porta, un clic alla volta, ad avere le **notifiche push
sul telefono** quando arrivano nuove offerte di lavoro o concorsi.

Riusiamo lo **stesso progetto Firebase** che hai già creato per "Fonti di Finanziamento":
così non devi rifare tutto, aggiungiamo solo una nuova app Android dentro.

> **Come funziona, in due parole.** Quando lo scraper (su GitHub) trova offerte nuove,
> uno script invia un messaggio a Firebase su dei "canali" chiamati **topic**. Il tuo
> telefono, con l'app installata, è iscritto a quei topic e riceve la notifica.
>
> I topic di questo progetto sono:
> - `offerte_lavoro`
> - `concorsi_pubblici`
> - `categorie_protette`

---

## Riepilogo dei dati di questa app

| Cosa | Valore |
|------|--------|
| Nome app (telefono) | **Lavoro e Concorsi** |
| Package / ID app | **`it.mauriziotavilla.offertelavoro`** |
| Cartella app Android | **`mobile/`** |
| Canale notifiche Android | `offerte_nuove` |

Il **package** `it.mauriziotavilla.offertelavoro` è importantissimo: deve essere
**identico** a quello che scriverai in Firebase. Se sbagli anche una lettera, le notifiche
non si registrano.

---

## PARTE A — Firebase (aggiungere l'app Android)

1. Vai su <https://console.firebase.google.com/> e accedi con il tuo account Google.
2. Apri il **progetto Firebase che usi per "Fonti di Finanziamento"** (NON crearne uno nuovo).
3. In alto a sinistra clicca l'icona ⚙️ → **Impostazioni progetto**.
4. Scorri fino a **"Le tue app"** e clicca l'icona **Android** (il robottino) per
   *aggiungere un'app*.
5. Nel campo **"Nome del pacchetto Android"** scrivi **esattamente**:

   ```
   it.mauriziotavilla.offertelavoro
   ```

6. (Nickname app, facoltativo) scrivi: `Lavoro e Concorsi`. Lascia vuoto il certificato SHA-1.
7. Clicca **Registra app**.
8. Clicca **Scarica google-services.json**. Si scarica un file chiamato `google-services.json`.
9. **Copia quel file** dentro la cartella del progetto, in questo percorso esatto:

   ```
   mobile/android/app/google-services.json
   ```

10. Puoi saltare i passi "Aggiungi l'SDK Firebase" che la pagina mostra dopo: quella parte
    è già pronta nel progetto. Clicca **Avanti → Continua sulla console**.

> Senza il file `google-services.json` l'app si installa lo stesso, ma le notifiche non
> potranno registrarsi. Con il file, sì.

---

## PARTE B — GitHub (scraper automatico + invio push)

### B.1 Mettere il progetto su GitHub

1. Crea (se non ce l'hai) un account su <https://github.com>.
2. Crea un **nuovo repository**, ad esempio `offerte-lavoro-per-me`.
3. Carica i file di questa cartella (da sito: **Add file → Upload files**, oppure con Git).

> Il `.gitignore` esclude già `node_modules`, le build Android e le chiavi segrete
> (incluso `google-services.json`): è giusto così, quei file restano solo sul tuo PC.

### B.2 Impostare il "segreto" con la chiave Firebase

Serve la **service account** di Firebase (la stessa di "Fonti di Finanziamento"):
è il file che permette a GitHub di inviare le notifiche.

1. Se non ce l'hai già salvato: Firebase Console → ⚙️ Impostazioni progetto →
   scheda **Account di servizio** → **Genera nuova chiave privata** → scarichi un file `.json`.
   (Se ce l'hai già da FONTI, riusa quello: va benissimo.)
2. Su GitHub apri il tuo repository → **Settings → Secrets and variables → Actions**.
3. Clicca **New repository secret**.
   - **Name**: `FIREBASE_SERVICE_ACCOUNT_JSON`
   - **Secret**: incolla **tutto il contenuto** del file `.json` (aprilo con un editor di testo,
     seleziona tutto, copia, incolla).
4. Salva.

### B.3 Attivare lo scraper automatico

1. Nel repository apri la scheda **Actions** e, se richiesto, conferma di voler abilitare i workflow.
2. Trovi il workflow **"Scraper Offerte e Concorsi"**: gira da solo **ogni 6 ore**.
3. Per provarlo subito: aprilo e clicca **Run workflow**.

Quando trova offerte nuove: aggiorna i dati, fa un commit automatico e invia le push ai topic.

### B.4 Collegare l'app agli aggiornamenti online (badge "New" anche su PC)

1. Apri `data/aggiornamento.json`.
2. In `offerte_url` metti l'indirizzo **RAW** del tuo `offerte.json`, ad esempio:

   ```
   https://raw.githubusercontent.com/TUO-UTENTE/offerte-lavoro-per-me/main/data/offerte.json
   ```

3. Imposta `"abilitato": true`. Salva.

---

## PARTE C — Creare l'APK e installarlo sul telefono

> Requisiti (li hai già usati per FONTI): **Node.js**, **Java JDK 17+** e **Android Studio**
> (con l'Android SDK installato).

1. Assicurati di aver messo `google-services.json` in `mobile/android/app/` (PARTE A).
2. Apri la cartella `mobile/` e fai **doppio clic su `BUILD_APK.bat`**.
3. La prima volta ci mette diversi minuti (scarica e compila). Alla fine trovi l'APK in:

   ```
   mobile/dist/LavoroConcorsi-1.0.0.apk
   ```

4. Copia quel file `.apk` sul telefono (cavo USB, Google Drive, Telegram a te stesso...).
5. Sul telefono aprilo e installalo. Se Android avvisa, consenti **"Installa da origini sconosciute"**.
6. Apri l'app **"Lavoro e Concorsi"**.
7. Nel pannello laterale apri **"Notifiche Android"**, attiva l'interruttore e scegli le
   categorie che vuoi seguire. Concedi il permesso notifiche quando lo chiede.

---

## PARTE D — Provare una notifica di test

Dal tuo PC, nella cartella `scripts`, con la chiave Firebase impostata come variabile
d'ambiente, puoi inviarti una notifica di prova:

```
npm run scraper:push:test
```

Oppure, più semplice: su GitHub lancia il workflow con **Run workflow** dopo aver aggiunto
a mano una nuova offerta nei dati (così `novita.json` contiene una novità da notificare).

---

## Problemi frequenti

- **Non arriva nessuna notifica.**
  Controlla: 1) `google-services.json` nella cartella giusta; 2) package scritto identico
  in Firebase; 3) nell'app hai attivato le notifiche e dato il permesso; 4) il segreto
  `FIREBASE_SERVICE_ACCOUNT_JSON` su GitHub è il contenuto completo del file.

- **La build dell'APK fallisce.**
  Apri Android Studio → **SDK Manager** → installa **Android SDK Platform 34**. Poi rilancia
  `BUILD_APK.bat`. In alternativa: nella cartella `mobile` esegui `npm run open:android` e
  compila da Android Studio.

- **Ho due app simili sul telefono.**
  È normale: "Fonti di Finanziamento" e "Lavoro e Concorsi" sono due app separate, con
  package diversi, e ricevono notifiche diverse.

---

Se ti blocchi, scrivimi a che punto sei (Parte A/B/C/D e numero del passo) e ti guido. 💼
