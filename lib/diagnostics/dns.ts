import { promises as dns } from "node:dns";
import type { DiagnosticsReport, DnsFinding } from "@/types/smtp";

/** TXT records joined into single strings (a TXT record can arrive in chunks). */
async function resolveTxt(name: string): Promise<string[]> {
  try {
    const records = await dns.resolveTxt(name);
    return records.map((parts) => parts.join("")).filter(Boolean);
  } catch {
    return [];
  }
}

const truncate = (value: string, max = 220) =>
  value.length > max ? `${value.slice(0, max)}…` : value;

// Selectors tried for DKIM. Covers the big providers; a custom selector will
// miss, which the report calls out explicitly rather than claiming "no DKIM".
const DKIM_SELECTORS = [
  "default", "google", "selector1", "selector2", "selector1-mailo", "selector2-mailo",
  "k1", "k2", "k3", "s1", "s2", "s1024", "s2048", "mail", "mx", "smtp", "dkim",
  "dkim1", "dkim2", "protonmail", "pm", "mesmtp", "amazon", "sendgrid", "mandrill",
  "zoho", "fastmail", "mailo", "api", "smtpapi",
];

function analyseSpf(records: string[]): DnsFinding {
  const spf = records.find((r) => r.toLowerCase().startsWith("v=spf1"));
  if (!spf) {
    return {
      status: "fail",
      label: "No SPF record",
      detail:
        "There is no SPF (v=spf1) TXT record on this domain. Receiving servers have no list of which machines may send for you, so mail is easier to spoof and more likely to land in spam.",
    };
  }

  const lower = spf.toLowerCase();
  const lookups = (lower.match(/\b(include|a|mx|redirect|exists|ptr)\b/g) ?? []).length;
  const records_ = [truncate(spf)];

  if (/\+all\b/.test(lower)) {
    return {
      status: "fail",
      label: "SPF ends in +all (allow anyone)",
      detail:
        "The record ends with +all, which authorises every server on the internet to send as this domain. That is an open invitation to spoofers - change it to ~all or -all.",
      records: records_,
    };
  }
  if (/-all\b/.test(lower)) {
    return {
      status: "pass",
      label: "SPF published (hard fail -all)",
      detail:
        "SPF is published with a hard-fail (-all) policy - the strongest setting. Unauthorised senders are told to reject the mail outright.",
      records: records_,
    };
  }
  if (/~all\b/.test(lower)) {
    const lookupNote =
      lookups > 10
        ? ` Heads up: it has about ${lookups} DNS lookups - the spec caps this at 10, beyond which receivers stop evaluating and may treat SPF as failing.`
        : "";
    return {
      status: "pass",
      label: "SPF published (soft fail ~all)",
      detail: `SPF is published with a soft-fail (~all) policy - unauthorised mail is marked but usually still delivered.${lookupNote}`,
      records: records_,
    };
  }
  return {
    status: "warn",
    label: "SPF has no -all / ~all qualifier",
    detail:
      "The SPF record does not end with an all mechanism (-all or ~all). Without it the policy is neutral and gives receivers little to act on.",
    records: records_,
  };
}

function analyseDmarc(records: string[]): DnsFinding {
  const dmarc = records.find((r) => r.toLowerCase().startsWith("v=dmarc1"));
  if (!dmarc) {
    return {
      status: "warn",
      label: "No DMARC record",
      detail:
        "There is no DMARC record at _dmarc.<domain>. DMARC tells receivers what to do with mail that fails SPF/DKIM and gives you aggregate reports. Without it you are flying blind on spoofing.",
    };
  }
  const lower = dmarc.toLowerCase();
  const records_ = [truncate(dmarc)];
  const hasReports = /rua=|ruf=/.test(lower);

  if (/p=reject/.test(lower)) {
    return {
      status: "pass",
      label: "DMARC policy: reject",
      detail:
        "DMARC is set to p=reject - the strongest policy. Mail that fails authentication is rejected, which is the best defence against domain spoofing.",
      records: records_,
    };
  }
  if (/p=quarantine/.test(lower)) {
    return {
      status: "pass",
      label: "DMARC policy: quarantine",
      detail: "DMARC is set to p=quarantine - failing mail is sent to spam rather than the inbox.",
      records: records_,
    };
  }
  if (/p=none/.test(lower)) {
    return {
      status: "warn",
      label: "DMARC policy: none (monitoring only)",
      detail: `DMARC exists but is p=none, so it only reports and does not protect yet.${
        hasReports ? " Aggregate reports (rua) are configured, which is a good first step." : ""
      } Move to quarantine or reject once you trust your SPF/DKIM coverage.`,
      records: records_,
    };
  }
  return { status: "info", label: "DMARC present", detail: "A DMARC record was found.", records: records_ };
}

async function analyseDkim(domain: string): Promise<DnsFinding> {
  for (const selector of DKIM_SELECTORS) {
    const records = await resolveTxt(`${selector}._domainkey.${domain}`);
    const dkim = records.find((r) => r.toLowerCase().includes("v=dkim1"));
    if (dkim) {
      return {
        status: "pass",
        label: `DKIM configured (selector: ${selector})`,
        detail:
          "DKIM is published, so outgoing mail can be signed and receivers can verify it was not altered in transit. This materially improves deliverability.",
        records: [truncate(dkim)],
      };
    }
  }
  return {
    status: "warn",
    label: "No DKIM under common selectors",
    detail:
      "No DKIM (v=DKIM1) record was found under the common selectors tried. If your provider uses a custom selector, DKIM may still be configured - check your email provider's DNS settings. Without DKIM, mail cannot be verified as unaltered in transit.",
  };
}

export async function runDiagnostics(domain: string): Promise<DiagnosticsReport> {
  const [domainTxt, dmarcTxt] = await Promise.all([
    resolveTxt(domain),
    resolveTxt(`_dmarc.${domain}`),
  ]);

  const spf = analyseSpf(domainTxt);
  const dmarc = analyseDmarc(dmarcTxt);
  const dkim = await analyseDkim(domain);

  const summary: string[] = [];
  const verdict = (f: DnsFinding) =>
    f.status === "pass" ? "configured" : f.status === "fail" ? "missing or misconfigured" : "needs attention";
  summary.push(`SPF: ${verdict(spf)}.`);
  summary.push(`DKIM: ${verdict(dkim)}.`);
  summary.push(`DMARC: ${verdict(dmarc)}.`);

  const failing = [spf, dkim, dmarc].filter((f) => f.status === "fail" || f.status === "warn");
  if (failing.length === 0) {
    summary.push("All three authentication records look healthy - this domain is set up to land in the inbox.");
  } else {
    summary.push(
      `${failing.length} of 3 records need work. Fixing these is the single biggest lever on whether your mail reaches the inbox or the spam folder.`,
    );
  }

  return { domain, spf, dkim, dmarc, summary, checkedAt: Date.now() };
}
