#!/usr/bin/env python3
"""
Smoke test kontrak harga `/api/v1/prices/*` (isu #45) — zero-dependency.

Mengukur keadaan deployment nyata: dengan seluruh flag default OFF (akses
provider unconfirmed), respons HARUS jujur: `unavailable` + warning eksplisit,
tanpa nilai karangan, tanpa kebocoran kredensial.

Usage:
    python tools/prices_smoke.py [base_url]
    default base_url: http://localhost:8000
"""

import json
import sys
import urllib.error
import urllib.request

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000").rstrip("/")

RESULTS = []
SECRET_MARKERS = ("SP2KP_API_KEY", "SIPASHORTI_API_KEY", "PRICE_CRON_SECRET", "SUPABASE_SERVICE_ROLE_KEY")


def call(method, path):
    req = urllib.request.Request(f"{BASE}{path}", method=method, headers={"Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=10) as res:
            return res.status, json.loads(res.read().decode() or "{}")
    except urllib.error.HTTPError as exc:
        try:
            return exc.code, json.loads(exc.read().decode() or "{}")
        except Exception:
            return exc.code, {}
    except Exception as exc:  # noqa: BLE001
        return 0, {"error": {"message": str(exc)}}


def check(name, condition, detail=""):
    RESULTS.append((name, bool(condition), detail))


def main():
    # 1. Katalog + Terung tidak tersedia di SP2KP
    status, body = call("GET", "/api/v1/prices/commodities")
    data = body.get("data", [])
    terung = next((c for c in data if c.get("id") == "terung"), None)
    sp2kp = next((s for s in (terung or {}).get("sources", []) if s.get("source_id") == "sp2kp"), None)
    check("commodities 200 + envelope", status == 200 and body.get("meta", {}).get("request_id"))
    check("Terung first-class + available:false di SP2KP", sp2kp is not None and sp2kp.get("available") is False)

    # 2. Metadata sumber — akses jujur unconfirmed
    status, body = call("GET", "/api/v1/prices/sources")
    sources = body.get("data", [])
    check("sources 200 + 2 sumber", status == 200 and {s.get("id") for s in sources} == {"sp2kp", "sipashorti"})
    check("semua access_status unconfirmed", all(s.get("access_status") == "unconfirmed" for s in sources))

    # 3. Health
    status, body = call("GET", "/api/v1/prices/sources/sp2kp/health")
    check("health sp2kp never_fetched", status == 200 and body.get("data", {}).get("state") == "never_fetched")

    # 4. latest Terung -> unavailable + warning eksplisit, tanpa angka
    status, body = call(
        "GET",
        "/api/v1/prices/latest?commodity=terung&price_type=consumer&region_level=kabupaten&region_code=1375&source_id=sp2kp",
    )
    obs = body.get("data", {})
    warnings = obs.get("warnings", [])
    check("latest terung 200 unavailable", status == 200 and obs.get("data_status") == "unavailable")
    check("price_value null (bukan 0)", obs.get("price_value") is None)
    check("warning SOURCE_DOES_NOT_PUBLISH_COMMODITY", "SOURCE_DOES_NOT_PUBLISH_COMMODITY" in warnings)
    check("warning SOURCE_ACCESS_UNCONFIRMED", "SOURCE_ACCESS_UNCONFIRMED" in warnings)

    # 5. latest komoditas didukung pun jujur unavailable (flag off)
    status, body = call(
        "GET",
        "/api/v1/prices/latest?commodity=tomat&price_type=consumer&region_level=kabupaten&region_code=1375",
    )
    check("latest tomat unavailable (flag off)", status == 200 and body.get("data", {}).get("data_status") == "unavailable")

    # 6. kontrak error
    status, body = call("GET", "/api/v1/prices/latest?commodity=durian&price_type=consumer&region_level=nasional")
    check("404 COMMODITY_NOT_FOUND", status == 404 and body.get("error", {}).get("code") == "COMMODITY_NOT_FOUND")
    status, body = call("GET", "/api/v1/prices/latest?commodity=tomat&price_type=eceran&region_level=nasional")
    check("422 INVALID_PRICE_TYPE", status == 422 and body.get("error", {}).get("code") == "INVALID_PRICE_TYPE")
    status, body = call(
        "GET", "/api/v1/prices/history?commodity=tomat&price_type=consumer&region_level=nasional&from=2026-11-27&to=2026-11-01"
    )
    check("400 INVALID_QUERY (from>to)", status == 400 and body.get("error", {}).get("code") == "INVALID_QUERY")

    # 7. history kosong & jujur
    status, body = call("GET", "/api/v1/prices/history?commodity=tomat&price_type=consumer&region_level=nasional")
    hist = body.get("data", {})
    check("history rows kosong + warning", status == 200 and hist.get("rows") == [] and hist.get("warnings"))

    # 8. refresh terlindungi
    status, body = call("POST", "/api/v1/prices/refresh?source_id=sp2kp")
    check("refresh ditolak tanpa otorisasi (401/403)", status in (401, 403))

    # 9. tanpa kebocoran kredensial di SEMUA respons di atas
    blob = json.dumps(RESULTS)
    leaked = [m for m in SECRET_MARKERS if m in blob]
    check("tidak ada marker kredensial", not leaked, str(leaked))

    passed = sum(1 for _, ok, _ in RESULTS if ok)
    for name, ok, detail in RESULTS:
        print(("PASS" if ok else "FAIL"), "-", name, (f"[{detail}]" if detail and not ok else ""))
    print(f"\nSmoke: {passed}/{len(RESULTS)} checks passed against {BASE}")
    return 0 if passed == len(RESULTS) else 1


if __name__ == "__main__":
    sys.exit(main())
