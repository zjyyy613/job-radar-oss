"""Minimal server-only PostgREST writes; no schema or job status operations."""
import json
from urllib.parse import urlencode, urlsplit
from urllib.request import Request, build_opener, HTTPRedirectHandler


def server_config(env):
    url = env.get("SUPABASE_URL")
    key = env.get("SUPABASE_SECRET_KEY") or env.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise ValueError("Supabase server configuration is missing")
    return url, key


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


class SourceStore:
    def __init__(self, base_url, key):
        url = urlsplit(base_url)
        if (url.scheme != "https" or not url.hostname or url.username or url.password
                or url.path not in ("", "/") or url.query or url.fragment or not key):
            raise ValueError("Invalid Supabase server configuration")
        self.base_url = base_url.rstrip("/")
        self.headers = {"apikey": key, "Content-Type": "application/json"}
        if not key.startswith("sb_secret_"):
            self.headers["Authorization"] = f"Bearer {key}"
        self.opener = build_opener(NoRedirect)

    def call(self, table, query, payload=None):
        if table not in ("source_records", "source_runs"):
            raise ValueError("Unsupported ingestion table")
        headers = dict(self.headers)
        if payload is not None:
            headers["Prefer"] = "resolution=merge-duplicates,return=representation"
        request = Request(
            f"{self.base_url}/rest/v1/{table}?{urlencode(query)}",
            data=json.dumps(payload, ensure_ascii=False, allow_nan=False).encode() if payload is not None else None,
            headers=headers,
        )
        # No retries: an ambiguous write must be inspected before repeating.
        with self.opener.open(request, timeout=20) as response:
            return json.load(response)

    def upsert_record(self, record):
        if record["source"] != "ncss":
            raise ValueError("NCSS writer cannot modify another source")
        existing = self.call("source_records", {"source": "eq.ncss", "source_job_id": f"eq.{record['source_job_id']}", "select": "id", "limit": "1"})
        if not isinstance(existing, list) or any(not isinstance(row, dict) or not isinstance(row.get("id"), str) for row in existing):
            raise ValueError("Invalid source_records lookup")
        written = self.call("source_records", {"on_conflict": "source,source_job_id", "select": "source,source_job_id"}, record)
        if written != [{"source": "ncss", "source_job_id": record["source_job_id"]}]:
            raise ValueError("Unconfirmed source_records write")
        return "updated" if existing else "new"

    def write_run(self, run):
        if run.get("source") != "ncss":
            raise ValueError("NCSS writer cannot modify another source")
        written = self.call("source_runs", {"on_conflict": "id", "select": "id"}, run)
        if written != [{"id": run["id"]}]:
            raise ValueError("Unconfirmed source_runs write")
