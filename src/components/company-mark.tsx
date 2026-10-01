"use client";
import Image from "next/image";
import { useState } from "react";
import { resolveCompanyBrand } from "@/lib/radar/company-brand";
/** Presentation-only exact company mapping, never used for canonicalization. */
export function CompanyMark({ company }: { company: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  const { identity, asset, initial } = resolveCompanyBrand(company);
  return (
    <span className="company-mark" aria-hidden="true">
      {asset && failed !== identity ? (
        <Image
          src={asset}
          alt=""
          width={18}
          height={18}
          unoptimized
          onError={() => setFailed(identity)}
        />
      ) : (
        <span>{initial}</span>
      )}
    </span>
  );
}
