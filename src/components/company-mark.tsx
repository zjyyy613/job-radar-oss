"use client";
import Image from "next/image";
import { useState } from "react";
const marks: Record<string, string> = {
  腾讯: "tencent.png",
  小米: "xiaomi.ico",
  vivo: "vivo.ico",
  中国银行股份有限公司: "boc.ico",
};
/** Presentation-only exact company mapping, never used for canonicalization. */
export function CompanyMark({ company }: { company: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  const asset = Object.hasOwn(marks, company) ? marks[company] : null;
  return (
    <span className="company-mark" aria-hidden="true">
      {asset && failed !== company ? (
        <Image
          src={`/company-marks/${asset}`}
          alt=""
          width={18}
          height={18}
          unoptimized
          onError={() => setFailed(company)}
        />
      ) : (
        <span>{Array.from(company.trim())[0]?.toLocaleUpperCase() || "·"}</span>
      )}
    </span>
  );
}
