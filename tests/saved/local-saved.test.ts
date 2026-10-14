import { describe, expect, it } from "vitest";
import { createSavedStore, parseSaved, SAVED_KEY } from "../../src/lib/saved/local-saved";
import { createLocalProfileStore } from "../../src/lib/profile/local-profile";
import { safeJobReturn } from "../../src/lib/radar/url-state";

function storage() {
  const map = new Map<string, string>();
  return { get length() { return map.size; }, key: (i: number) => [...map.keys()][i] ?? null,
    getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => { map.set(k, v); },
    removeItem: (k: string) => { map.delete(k); }, clear: () => map.clear() } satisfies Storage;
}
describe("versioned Guest saved jobs", () => {
  it("saves only id/time, deduplicates explicit save and preserves original save time", () => {
    const disk = storage(); let time = "2026-10-10T01:00:00Z";
    const store = createSavedStore(() => disk, () => time);
    expect(store.getSnapshot().loaded).toBe(false);
    expect(store.read().entries).toEqual([]);
    expect(store.setSaved("a", true)).toBe(true);
    time = "2026-10-10T02:00:00Z";
    store.setSaved("a", true);store.setSaved("b", true);
    expect(store.getSnapshot().entries).toEqual([{job_id:"b",saved_at:time},{job_id:"a",saved_at:"2026-10-10T01:00:00Z"}]);
    expect(JSON.parse(disk.getItem(SAVED_KEY)!)).toEqual({version:1,entries:expect.arrayContaining([{job_id:"a",saved_at:"2026-10-10T01:00:00Z"}])});
    expect(createSavedStore(() => disk).read().entries).toEqual(store.getSnapshot().entries);
    store.setSaved("a", false);store.setSaved("a", false);
    expect(store.getSnapshot().entries.map(e=>e.job_id)).toEqual(["b"]);
  });
  it("reads another tab's latest data before mutation and refreshes subscribed consumers", () => {
    const disk=storage(), a=createSavedStore(()=>disk), b=createSavedStore(()=>disk);let notifications=0;
    const stop=a.subscribe(()=>notifications++);
    a.setSaved("a",true);b.setSaved("b",true);a.read();
    expect(a.getSnapshot().entries.map(e=>e.job_id).sort()).toEqual(["a","b"]);
    b.setSaved("a",false);a.read();expect(a.getSnapshot().entries.map(e=>e.job_id)).toEqual(["b"]);
    expect(notifications).toBe(3);stop();a.read();expect(notifications).toBe(3);
  });
  it("failed write/delete never publishes optimistic success; retry works", () => {
    const disk=storage();let blocked=false;
    const store=createSavedStore(()=>({...disk,setItem:(k,v)=>{if(blocked)throw Error("quota");disk.setItem(k,v);}}));
    store.setSaved("a",true);blocked=true;
    expect(store.setSaved("b",true)).toBe(false);expect(store.setSaved("a",false)).toBe(false);
    expect(store.getSnapshot().entries.map(e=>e.job_id)).toEqual(["a"]);expect(store.getSnapshot().error).toBeTruthy();
    blocked=false;expect(store.setSaved("a",false)).toBe(true);expect(store.getSnapshot().error).toBeNull();
  });
  it("denied read and corrupt storage are reported, never overwritten", () => {
    const denied=createSavedStore(()=>{throw Error("denied");});expect(denied.read().error).toBeTruthy();expect(denied.setSaved("a",true)).toBe(false);
    const disk=storage();disk.setItem(SAVED_KEY,'{"version":2,"entries":[]}');
    const store=createSavedStore(()=>disk);expect(store.read().error).toBeTruthy();expect(store.setSaved("a",true)).toBe(false);
    expect(disk.getItem(SAVED_KEY)).toContain('"version":2');
  });
  it("existing clear removes Saved and Profile namespace only", () => {
    const disk=storage(), store=createSavedStore(()=>disk);store.setSaved("a",true);disk.setItem("other-app","keep");
    expect(createLocalProfileStore(()=>disk).clear()).toBe(true);expect(store.read().entries).toEqual([]);expect(disk.getItem("other-app")).toBe("keep");
  });
  it("keeps unavailable ids instead of silently pruning them", () => {
    const disk=storage(), store=createSavedStore(()=>disk);store.setSaved("no-longer-present",true);
    expect(createSavedStore(()=>disk).read().entries[0].job_id).toBe("no-longer-present");
  });
  it.each(["{", '{"version":1}', '{"version":1,"entries":[{"job_id":"","saved_at":"2026-10-10"}]}', '{"version":1,"entries":[{"job_id":"x","saved_at":"bad"}]}'])("rejects invalid persisted value %s", raw=>expect(()=>parseSaved(raw)).toThrow());
  it("deduplicates a valid persisted envelope deterministically",()=> {
    expect(parseSaved(JSON.stringify({version:1,entries:[{job_id:"a",saved_at:"2026-10-09"},{job_id:"a",saved_at:"2026-10-10"}]}))).toEqual([{job_id:"a",saved_at:"2026-10-10"}]);
  });
  it("Saved return navigation stays local and preserves selected id",()=> {
    expect(safeJobReturn("/saved?job=a")).toBe("/saved?job=a");expect(safeJobReturn("https://evil.test/saved")).toBe("/radar");
    expect(safeJobReturn("/radar?company=x")).toBe("/radar?company=x");
  });
});
