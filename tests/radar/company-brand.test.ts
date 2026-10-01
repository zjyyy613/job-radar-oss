import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import manifest from "../../public/company-marks/manifest.json";
import { normalizedCompanyIdentity, resolveCompanyBrand } from "../../src/lib/radar/company-brand";

describe("curated company identity", () => {
  it("Tencent never resolves to the rejected subsidiary favicon", () => {
    expect(resolveCompanyBrand("腾讯")).toMatchObject({ asset: null, initial: "腾" });
    expect(existsSync("public/company-marks/tencent.png")).toBe(false);
  });
  it.each([
    ["vivo", "/company-marks/vivo.svg"],
    [" 小米 ", "/company-marks/xiaomi.svg"],
    ["中国银行股份有限公司", "/company-marks/boc.ico"],
  ])("verified identity %s resolves to its existing local asset", (company, asset) => {
    expect(resolveCompanyBrand(company).asset).toBe(asset);
    expect(existsSync(`public${asset}`)).toBe(true);
  });
  it("normalizes conservatively, never guesses affiliates or aliases", () => {
    expect(resolveCompanyBrand(" ＶＩＶＯ ")).toMatchObject({ identity: "vivo", asset: "/company-marks/vivo.svg" });
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


describe("brand asset provenance", () => {
  it("keeps all admitted mappings and local file hashes consistent with the manifest", () => {
    const identities = new Set<string>();
    for (const brand of manifest.brands) {
      expect(brand.usage_note.length).toBeGreaterThan(0);
      expect(brand.license.length).toBeGreaterThan(0);
      for (const identity of brand.identities) {
        expect(identity).toBe(normalizedCompanyIdentity(identity));
        expect(identities.has(identity)).toBe(false);
        identities.add(identity);
        expect(resolveCompanyBrand(identity).asset).toBe(brand.asset);
      }
      if (brand.asset) {
        expect(brand.status).toBe("active");
        expect(brand.asset).toMatch(/^\/company-marks\/[a-z]+\.(svg|ico)$/);
        expect(brand.source_url).toMatch(/^https:\/\//);
        const bytes = readFileSync(`public${brand.asset}`);
        expect(createHash("sha256").update(bytes).digest("hex")).toBe(brand.sha256);
        if (brand.asset.endsWith(".svg")) {
          const svg = bytes.toString("utf8");
          expect(svg).not.toMatch(/<(?:script|image|foreignObject|filter|linearGradient|radialGradient)\b|(?:href|onload|onclick)=/i);
          expect(svg).toContain("<path");
          expect(brand.source_url).toContain(brand.upstream_commit);
          expect(brand.upstream_version).toBe("16.33.0");
        }
      }
    }
  });
  it("reserves future brands without serving assets or substituting product brands", () => {
    for (const brand of manifest.brands.filter((entry) => entry.status === "reserved")) {
      expect(brand.asset).toBeNull();
      expect(existsSync(`public/company-marks/${brand.id}.svg`)).toBe(false);
    }
    for (const company of ["Tencent Hy", "网易云音乐", "Alibaba Cloud", "小米招聘", "vivo招聘"])
      expect(resolveCompanyBrand(company).asset).toBeNull();
  });
});
