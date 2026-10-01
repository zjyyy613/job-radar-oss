import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { resolveCompanyBrand } from "../../src/lib/radar/company-brand";

describe("curated company identity", () => {
  it("Tencent never resolves to the rejected subsidiary favicon", () => {
    expect(resolveCompanyBrand("腾讯")).toMatchObject({ asset: null, initial: "腾" });
    expect(existsSync("public/company-marks/tencent.png")).toBe(false);
  });
  it.each([
    [" 小米 ", "/company-marks/xiaomi.ico"],
    ["中国银行股份有限公司", "/company-marks/boc.ico"],
  ])("verified identity %s resolves to its existing local asset", (company, asset) => {
    expect(resolveCompanyBrand(company).asset).toBe(asset);
    expect(existsSync(`public${asset}`)).toBe(true);
  });
  it("normalizes conservatively, never guesses affiliates or aliases", () => {
    expect(resolveCompanyBrand(" ＶＩＶＯ ")).toMatchObject({ identity: "vivo", asset: null });
    for (const company of ["小米招聘", "中国银行", "腾讯文档", "constructor", "__proto__"])
      expect(resolveCompanyBrand(company).asset).toBeNull();
  });
  it("unknown company fallback is stable and empty identity is neutral", () => {
    expect(resolveCompanyBrand(" Acme ")).toEqual(resolveCompanyBrand(" Acme "));
    expect(resolveCompanyBrand(" Acme ")).toMatchObject({ asset: null, initial: "A" });
    expect(resolveCompanyBrand("")).toMatchObject({ asset: null, initial: "·" });
  });
  it("source and ATS hostnames cannot override company identity", () => {
    for (const source_url of ["https://www.mi.com", "https://tencent.m.zhiye.com", "https://jobs.ats.example"] ) {
      const record = { company: "Unknown", source_url };
      expect(resolveCompanyBrand(record.company)).toMatchObject({ asset: null, initial: "U" });
      expect(resolveCompanyBrand(source_url).asset).toBeNull();
    }
  });
});
