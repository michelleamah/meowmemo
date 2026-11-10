"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", text: "Record" },
  { href: "/journal", text: "Journal" },
  { href: "/cats", text: "Cats" },
];

export function Nav() {
  const path = usePathname();
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-rule bg-sheet/95 backdrop-blur pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto flex max-w-xl">
        {TABS.map((t) => {
          const active = t.href === "/" ? path === "/" : path.startsWith(t.href);
          return (
            <li key={t.href} className="flex-1">
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-1 py-3 text-[15px] ${active ? "font-bold text-ink" : "text-ink-soft"}`}
              >
                <span aria-hidden className={`h-1 w-8 rounded-full ${active ? "bg-marigold" : "bg-transparent"}`} />
                {t.text}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
