"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Radar, UserRound } from "lucide-react";
import type { ReactNode } from "react";
export function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        跳至主要内容
      </a>
      <aside className="sidebar">
        <Link className="brand" href="/radar" aria-label="Job Radar">
          <Image
            className="brand-mark"
            src="/brand/brand-mark.svg"
            width={26}
            height={28}
            alt=""
            unoptimized
          />
          <Image
            className="brand-wordmark"
            src="/brand/brand-wordmark.svg"
            width={112}
            height={22}
            alt=""
            unoptimized
          />
        </Link>
        <nav aria-label="主导航">
          <Link
            href="/radar"
            aria-current={
              path.startsWith("/radar") || path.startsWith("/jobs")
                ? "page"
                : undefined
            }
          >
            <Radar size={17} aria-hidden="true" />
            Radar
          </Link>
          <Link
            href="/profile"
            aria-current={
              path.startsWith("/profile") || path.startsWith("/onboarding")
                ? "page"
                : undefined
            }
          >
            <UserRound size={17} aria-hidden="true" />
            Profile
          </Link>
        </nav>
        <p className="sidebar-note">
          从条件出发，回到证据。
          <br />
          资料仅保存在此浏览器。
        </p>
      </aside>
      <div className="app-content" id="main-content" tabIndex={-1}>
        {children}
      </div>
    </div>
  );
}
