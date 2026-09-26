"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Menu } from "lucide-react";

export function PublicNavigation() {
  const pathname = usePathname();
  const query = useSearchParams().toString();
  const returnTo = encodeURIComponent(`${pathname}${query ? `?${query}` : ""}`);
  const links = (
    <>
      <Link href="/discover" aria-current={pathname.startsWith("/discover") ? "page" : undefined}>
        Find work
      </Link>
      <Link href="/talent" aria-current={pathname.startsWith("/talent") ? "page" : undefined}>
        Find talent
      </Link>
      <Link href={`/login?returnTo=${returnTo}`}>Sign in</Link>
      <Link className="primary-button" href="/register">
        Create account
      </Link>
    </>
  );
  return (
    <>
      <nav className="public-desktop-nav" aria-label="Marketplace navigation">
        {links}
      </nav>
      <details
        className="public-mobile-nav"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.currentTarget.open = false;
            event.currentTarget.querySelector("summary")?.focus();
          }
        }}
      >
        <summary>
          <Menu size={20} /> Menu
        </summary>
        <nav
          aria-label="Mobile marketplace navigation"
          onClick={(event) => {
            if ((event.target as HTMLElement).closest("a"))
              event.currentTarget.closest("details")?.removeAttribute("open");
          }}
        >
          {links}
        </nav>
      </details>
    </>
  );
}
