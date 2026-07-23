export function SiteFooter() {
  return (
    <footer className="mt-8 border-t border-border">
      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>
          Credentials are used once per request and never logged or stored. Test history and
          encrypted profiles live only in your browser.
        </p>
        <p className="font-mono">
          Ping250 · SMTP test client ·{" "}
          <a href="/docs" className="text-foreground underline-offset-2 hover:underline">
            docs
          </a>{" "}
          · Created by{" "}
          <a
            href="https://abubakarshaikh.dev"
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground underline-offset-2 hover:underline"
          >
            Abubakar Shaikh
          </a>
        </p>
      </div>
    </footer>
  );
}
