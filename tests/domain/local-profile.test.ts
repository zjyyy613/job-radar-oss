import { expect, it, vi } from "vitest";
import { createLocalProfileStore, emptyGuestProfile, PROFILE_KEY, validateGuestProfile } from "../../src/lib/profile/local-profile";
import { evaluateQualification } from "../../src/lib/domain/qualification-engine";
import type { Gate } from "../../src/lib/domain/gate";

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return { get length() { return map.size; }, key: n => [...map.keys()][n] ?? null, getItem: key => map.get(key) ?? null,
    setItem: (key, value) => { map.set(key, value); }, removeItem: key => { map.delete(key); }, clear: () => map.clear() };
}
it("read/write/reload preserve separate qualification and preference objects", () => {
  const storage = memoryStorage(), store = createLocalProfileStore(() => storage);
  expect(store.read().data).toBeNull();
  const data = emptyGuestProfile();
  data.qualification.major = "机械工程";
  data.preferences.preferred_cities = ["上海"];
  expect(store.write(data)).toBe(true);
  expect(createLocalProfileStore(() => storage).read().data).toEqual({ ...data, qualification: { ...data.qualification, major: "mechanical" } });
});
it("clear removes only Job Radar namespace, not unrelated origin data", () => {
  const storage = memoryStorage(), store = createLocalProfileStore(() => storage);
  store.write(emptyGuestProfile()); storage.setItem("job-radar:other", "x"); storage.setItem("another-app", "keep");
  expect(store.clear()).toBe(true);
  expect(storage.length).toBe(1); expect(storage.getItem("another-app")).toBe("keep");
  expect(store.getSnapshot().data).toBeNull();
});
it.each(["not JSON", '{"version":2}', '{"version":1}'])("corrupt/unsupported stored data is visible, never silently overwritten", value => {
  const storage = memoryStorage(); storage.setItem(PROFILE_KEY, value);
  expect(createLocalProfileStore(() => storage).read()).toMatchObject({ data: null, error: expect.any(String) });
  expect(storage.getItem(PROFILE_KEY)).toBe(value);
});
it("storage rejection reports failure, with no success or phantom profile", () => {
  const store = createLocalProfileStore(() => { throw new Error("Storage disabled"); });
  expect(store.read().error).toBeTruthy(); expect(store.write(emptyGuestProfile())).toBe(false); expect(store.clear()).toBe(false);
  expect(store.getSnapshot().data).toBeNull();
});
it("invalid fields and preference leakage are rejected", () => {
  const data = emptyGuestProfile();
  expect(() => validateGuestProfile({ ...data, qualification: { ...data.qualification, preferred_roles: ["x"] } })).toThrow();
  expect(() => validateGuestProfile({ ...data, qualification: { ...data.qualification, days_per_week: 8 } })).toThrow();
});
it.each(["constructor", "__proto__"])("free text %s remains a string through alias lookup and reload", major => {
  const storage = memoryStorage(), store = createLocalProfileStore(() => storage), data = emptyGuestProfile();
  data.qualification.major = major;
  expect(store.write(data)).toBe(true);
  expect(store.read().data?.qualification.major).toBe(major);
});
it("profile update synchronously recomputes qualification with zero network/model calls", () => {
  const network = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network forbidden"));
  try {
    const storage = memoryStorage(), store = createLocalProfileStore(() => storage), data = emptyGuestProfile();
    const gate: Gate = { id: "days", field: "days_per_week", requirement: "required", scope: "job", value: { kind: "minimum", value: 5 }, evidence: [{ quote: "每周5天", source: "requirements", context: null }], note: null };
    const statuses: string[] = [];
    store.subscribe(() => statuses.push(evaluateQualification(store.getSnapshot().data!.qualification, [gate], "open", {
      extraction_status: "success", raw_content_hash: "h", extraction_input_hash: "h", extraction_attempt_hash: "h", extraction_error: null,
    }).status));
    store.write(data);
    store.write({ ...data, qualification: { ...data.qualification, days_per_week: 3 } });
    store.write({ ...data, qualification: { ...data.qualification, days_per_week: 5 } });
    expect(statuses).toEqual(["Check", "Blocked", "Eligible"]);
    expect(network).not.toHaveBeenCalled();
  } finally { network.mockRestore(); }
});
