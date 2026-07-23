"use client";

import { ThemeToggle } from "@/components/motion/theme-toggle";
import { TerminalIcon } from "@/components/icons/terminal";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <a href="/" className="flex items-center gap-2.5" aria-label="Ping250 home">
          <span className="flex h-8 w-8 items-center justify-center rounded-md border border-primary/30 bg-primary/10 text-primary">
            <TerminalIcon size={17} />
          </span>
          <span className="font-mono text-lg font-semibold tracking-tight">
            Ping<span className="phosphor-glow text-primary">250</span>
          </span>
        </a>
        <div className="flex items-center gap-3">
          <span className="hidden font-mono text-xs text-muted-foreground md:inline">
            Send a test. Get a 250.
          </span>
          <ThemeToggle variant="circle" />
        </div>
      </div>
    </header>
  );
}
