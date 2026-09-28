"""Offline NCSS contract, failure-isolation and persistence tests."""
import copy
import json
from pathlib import Path
import runpy
import sys
import unittest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts/ingest"))
adapter = runpy.run_path(str(ROOT / "scripts/ingest/ncss-adapter.py"))
runner = runpy.run_path(str(ROOT / "scripts/ingest/run-ncss.py"))
from ncss_source_store import SourceStore, server_config

NOW = "2026-09-28T03:00:00.000Z"
RAW = json.loads((ROOT / "tests/fixtures/ncss/list-live.json").read_text(encoding="utf-8-sig"))["data"]["list"][0]


class AdapterTests(unittest.TestCase):
    def map(self, raw):
        return adapter["map_record"](raw, NOW)

    def test_real_fixture(self):
        result = self.map(RAW)
        self.assertEqual(result["title"], RAW["jobName"])
        self.assertEqual(result["company"], RAW["recName"])
        self.assertEqual(result["location"], ["北京"])
        self.assertEqual(result["salary"], "5K-15K/月")
        self.assertEqual(result["published_at"], "2026-09-04T01:57:04.236Z")
        self.assertEqual(result["company_nature"], "国有企业")
        self.assertEqual(result["raw_payload"]["degreeName"], "本科及以上")
        self.assertEqual(result["source_url"], f'https://www.ncss.cn/student/jobs/{RAW["jobId"]}/detail.html')
        self.assertIsNone(result["industry"])
        self.assertIsNone(result["description"])
        self.assertIsNone(result["recruitment_batch"])
        self.assertIsNone(result["internship_type"])
        self.assertEqual(result["raw_payload"], RAW)

    def test_sparse_and_industry_variants(self):
        fixture = json.loads((ROOT / "tests/fixtures/ncss/synthetic-industry.json").read_text(encoding="utf-8"))
        self.assertEqual(self.map(fixture)["industry"], "制造业")
        raw = {"jobId": "a/b", "jobName": "实习生2027", "recName": "公司"}
        result = self.map(raw)
        for key in ("salary", "industry", "published_at", "company_nature", "requirements", "apply_url"):
            self.assertIsNone(result[key])
        self.assertEqual(result["location"], [])
        self.assertEqual(result["welfare"], [])
        self.assertIn("a%2Fb", result["source_url"])
        for field in ("industrySectorsName", "industryName"):
            self.assertEqual(self.map({**raw, field: "制造业"})["industry"], "制造业")

    def test_salary_precision_and_incomplete_bounds(self):
        self.assertEqual(self.map({**RAW, "lowMonthPay": 5.4})["salary"], "5.4K-15K/月")
        for value in (None, "", True, -1, "bad"):
            self.assertIsNone(self.map({**RAW, "lowMonthPay": value})["salary"])
        self.assertIsNone(self.map({**RAW, "lowMonthPay": 0, "highMonthPay": 0})["salary"])

    def test_identity_and_hash(self):
        for field in ("jobId", "jobName", "recName"):
            with self.assertRaises(ValueError):
                self.map({**RAW, field: None})
        self.assertEqual(self.map(RAW)["raw_hash"], self.map(dict(reversed(list(RAW.items()))))["raw_hash"])
        self.assertNotEqual(self.map(RAW)["raw_hash"], self.map({**RAW, "degreeName": "硕士"})["raw_hash"])
        original = copy.deepcopy(RAW)
        self.map(RAW)
        self.assertEqual(RAW, original)

    def test_response_validation(self):
        for value in ({}, {"flag": False, "data": {"list": []}}, {"flag": True, "data": {"list": "bad"}},
                      {"flag": True, "data": {"list": [], "pagenation": {"count": 20}}},
                      {"flag": True, "data": {"list": [RAW, RAW, RAW]}}):
            with self.assertRaises(ValueError):
                adapter["parse_response"](value, 2)
        self.assertEqual(adapter["parse_response"]({"flag": True, "data": {"list": [], "pagenation": {"count": 0}}}, 2), [])

    def test_invalid_dates_are_not_invented(self):
        for value in (None, "2026-09-28", True, -1, float("inf"), 10**100):
            self.assertIsNone(adapter["published_at"](value))


class MemoryStore:
    def __init__(self):
        self.records = {("job-pro:tencent", "1"): {"title": "unchanged"}}
        self.runs = [{"source": "job-pro:tencent", "status": "success"}]

    def upsert_record(self, record):
        key = (record["source"], record["source_job_id"])
        outcome = "updated" if key in self.records else "new"
        self.records[key] = record
        return outcome

    def write_run(self, run):
        self.runs.append(copy.deepcopy(run))


class RunnerTests(unittest.TestCase):
    def test_failure_isolation(self):
        store = MemoryStore()
        before = copy.deepcopy(store.records)
        def failed(_limit):
            raise RuntimeError("private upstream error")
        result = runner["ingest"](2, failed, store)
        self.assertEqual(result["status"], "failed")
        self.assertEqual(store.records, before)
        self.assertEqual(store.runs[0], {"source": "job-pro:tencent", "status": "success"})
        self.assertEqual(store.runs[-1]["source"], "ncss")
        self.assertNotIn("private", json.dumps(result))

    def test_partial_and_repeat(self):
        store = MemoryStore()
        result = runner["ingest"](2, lambda _: [RAW, {}], store)
        self.assertEqual(result["status"], "partial")
        self.assertEqual(result["records_new"], 1)
        self.assertFalse(result["full_list"])
        repeat = runner["ingest"](2, lambda _: [RAW], store)
        self.assertEqual(repeat["records_updated"], 1)
        self.assertEqual(repeat["records_new"], 0)

    def test_write_and_audit_failure(self):
        store = MemoryStore()
        store.upsert_record = lambda _: (_ for _ in ()).throw(RuntimeError("secret"))
        result = runner["ingest"](2, lambda _: [RAW], store)
        self.assertEqual(result["status"], "failed")
        self.assertEqual(result["records_new"], 0)
        store.write_run = lambda _: (_ for _ in ()).throw(RuntimeError("secret"))
        with self.assertRaises(RuntimeError):
            runner["ingest"](2, lambda _: [], store)


class StoreTests(unittest.TestCase):
    def test_other_sources_are_rejected_before_any_request(self):
        store = SourceStore("https://example.com", "sb_secret_test")
        store.call = lambda *_: self.fail("Must not call Supabase for another source")
        with self.assertRaises(ValueError):
            store.upsert_record({"source": "job-pro:tencent"})
        with self.assertRaises(ValueError):
            store.write_run({"source": "job-pro:tencent"})

    def test_credentials(self):
        self.assertEqual(server_config({"SUPABASE_URL": "https://example.com", "SUPABASE_SECRET_KEY": "new", "SUPABASE_SERVICE_ROLE_KEY": "old"})[1], "new")
        self.assertEqual(server_config({"SUPABASE_URL": "https://example.com", "SUPABASE_SERVICE_ROLE_KEY": "old"})[1], "old")
        self.assertNotIn("Authorization", SourceStore("https://example.com", "sb_secret_test").headers)
        self.assertEqual(SourceStore("https://example.com", "legacy").headers["Authorization"], "Bearer legacy")
        for url in ("http://example.com", "https://user@example.com", "https://example.com/path", "https://example.com?x=1"):
            with self.assertRaises(ValueError):
                SourceStore(url, "key")

    def test_write_confirmation(self):
        store = SourceStore("https://example.com", "sb_secret_test")
        calls = []
        def call(table, query, payload=None):
            calls.append((table, query, payload))
            return [] if payload is None else [{"source": payload["source"], "source_job_id": payload["source_job_id"]}]
        store.call = call
        self.assertEqual(store.upsert_record(adapter["map_record"](RAW, NOW)), "new")
        self.assertEqual({c[0] for c in calls}, {"source_records"})
        self.assertEqual(calls[0][1]["source"], "eq.ncss")
        store.call = lambda *_: []
        with self.assertRaises(ValueError):
            store.upsert_record(adapter["map_record"](RAW, NOW))
        with self.assertRaises(ValueError):
            store.write_run({"id": "run", "source": "ncss"})


if __name__ == "__main__":
    unittest.main()
