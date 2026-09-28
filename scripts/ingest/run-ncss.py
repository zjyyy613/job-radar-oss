"""Bounded, independent NCSS ingestion. stdout contains JSON only."""
import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import runpy
import uuid

from ncss_source_store import SourceStore, server_config

adapter = runpy.run_path(str(Path(__file__).with_name("ncss-adapter.py")))


def now():
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def ingest(limit, fetch_records=adapter["fetch_records"], store=None):
    run = {
        "id": str(uuid.uuid4()), **adapter["PROVENANCE"], "full_list": False,
        "started_at": now(), "finished_at": None, "status": "failed",
        "records_seen": 0, "records_new": 0, "records_updated": 0,
        "adapter_version": adapter["ADAPTER_VERSION"], "error_type": None, "error_message": None,
    }
    records = []
    failures = 0
    try:
        rows = fetch_records(limit)
    except Exception:
        rows = None
        run.update(error_type="source_fetch_failed", error_message="NCSS fetch or response validation failed")
    if rows is not None:
        run["records_seen"] = len(rows)
        for raw in rows:
            try:
                record = adapter["map_record"](raw, now())
            except Exception:
                failures += 1
                run.update(error_type="record_mapping_failed", error_message="NCSS record mapping failed")
                continue
            try:
                if store:
                    result = store.upsert_record(record)
                    run[f"records_{result}"] += 1
                records.append(record)
            except Exception:
                failures += 1
                run.update(error_type="record_write_failed", error_message="NCSS record write was not confirmed")
        run["status"] = "partial" if failures and records else "failed" if failures else "success"
    run["finished_at"] = now()
    if store:
        store.write_run(run)
    return run if store else {**run, "records": records}


def load_local_env():
    # Only the three named server settings, without logging or evaluating shell syntax.
    path = Path(__file__).resolve().parents[2] / ".env.local"
    if path.exists():
        for line in path.read_text(encoding="utf-8-sig").splitlines():
            key, sep, value = line.strip().partition("=")
            if sep and key in ("SUPABASE_URL", "SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY"):
                os.environ.setdefault(key, value.strip().strip('"\''))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--write", action="store_true")
    mode.add_argument("--dry-run", action="store_true")
    parser.add_argument("--limit", type=int, choices=range(1, 21), default=2)
    args = parser.parse_args()
    try:
        load_local_env()
        store = SourceStore(*server_config(os.environ)) if args.write else None
        result = ingest(args.limit, store=store)
        print(json.dumps(result, ensure_ascii=True, allow_nan=False))
        return 1 if result["status"] == "failed" else 0
    except Exception:
        print(json.dumps({"status": "failed", "error_type": "configuration_or_audit_failed", "error_message": "Check server configuration and source_runs persistence"}))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
