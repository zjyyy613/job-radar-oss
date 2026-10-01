/** Same NFKC/whitespace/case normalization as canonicalization; no alias or fuzzy matching. */
export function normalizedCompanyIdentity(company: string): string {
  return company.normalize("NFKC").trim().replace(/\s+/gu, " ").toLowerCase();
}

/** Reviewed local assets only. Admission evidence and exclusions: public/company-marks/README.md. */
const curatedCompanyBrands: Readonly<Record<string, string>> = Object.freeze({
  vivo: "/company-marks/vivo.svg",
  小米: "/company-marks/xiaomi.svg",
  中国银行股份有限公司: "/company-marks/boc.ico",
});

/** Domain/ATS/source URL is deliberately not an input to company identity resolution. */
export function resolveCompanyBrand(company: string) {
  const identity = normalizedCompanyIdentity(company);
  return {
    identity,
    asset: Object.hasOwn(curatedCompanyBrands, identity)
      ? curatedCompanyBrands[identity]
      : null,
    initial: Array.from(company.trim())[0]?.toLocaleUpperCase() || "·",
  };
}
