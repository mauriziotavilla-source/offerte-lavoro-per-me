#!/usr/bin/env python3
"""
Stampa in console le prossime scadenze delle offerte/concorsi.
Uso: python scripts/prossime_scadenze.py
"""

import json
from datetime import date, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OFFERTE = ROOT / "data" / "offerte.json"

ETICHETTA_TIPO = {
    "lavoro": "Lavoro",
    "concorso": "Concorso",
    "categoria_protetta": "Cat. protetta",
}


def parse_data(s):
    try:
        return datetime.strptime(s, "%Y-%m-%d").date()
    except (ValueError, TypeError):
        return None


def main():
    if not OFFERTE.is_file():
        print(f"Manca {OFFERTE}")
        return

    dati = json.loads(OFFERTE.read_text(encoding="utf-8"))
    oggi = date.today()
    righe = []

    for o in dati.get("offerte", []):
        for s in o.get("scadenze", []):
            d = parse_data(s.get("data"))
            if d and d >= oggi:
                giorni = (d - oggi).days
                righe.append((d, giorni, o, s))

    righe.sort(key=lambda x: x[0])

    if not righe:
        print("\n  Nessuna scadenza futura nelle offerte attuali.")
        print("  (Molti annunci di lavoro non hanno una data fissa di scadenza.)\n")
        return

    print("\n  PROSSIME SCADENZE\n  " + "-" * 50)
    for d, giorni, o, s in righe:
        tipo = ETICHETTA_TIPO.get(o.get("tipo"), o.get("tipo", ""))
        urgente = "  ⚠️ URGENTE" if giorni <= 15 else ""
        print(f"  {d.strftime('%d/%m/%Y')}  (tra {giorni} gg){urgente}")
        print(f"     [{tipo}] {o.get('nome', '')}")
        print(f"     {s.get('fase', '')} — {o.get('ente', '')}\n")


if __name__ == "__main__":
    main()
