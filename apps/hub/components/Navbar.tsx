"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

interface UserSession {
  user_id: string;
  username: string;
  avatar_url: string;
  role: string;
}

export default function Navbar() {
  const pathname = usePathname();
  const [user, setUser] = useState<UserSession | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => setUser(d.user ?? null))
      .catch(() => {});
  }, []);

  const isAdmin = user?.role === "admin" || user?.role === "reviewer";

  const links = [
    { href: "/", label: "Templates" },
    { href: "/themes", label: "Themes" },
    { href: "/publish", label: "Publish" },
    ...(isAdmin ? [{ href: "/review", label: "Review" }] : []),
  ];

  return (
    <nav className="border-b border-[var(--border)] bg-[var(--surface-2)]/80 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/icon.png" alt="" width={24} height={24} />
            <span className="text-lg font-bold text-[var(--purple)]">Hub</span>
          </Link>
          <div className="flex items-center gap-1">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  pathname === link.href
                    ? "bg-[var(--surface)] text-[var(--text)]"
                    : "text-[var(--text-muted)] hover:text-[var(--text)]"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {user ? (
            <Link
              href="/account"
              className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text)]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={user.avatar_url}
                alt={user.username}
                width={22}
                height={22}
                className="rounded-full"
              />
              {user.username}
            </Link>
          ) : (
            <a
              href="/api/auth/login"
              className="rounded-md px-3 py-1.5 text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text)]"
            >
              Sign in
            </a>
          )}
        </div>
      </div>
    </nav>
  );
}
