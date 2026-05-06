// search.js — runs 2x/day, finds new remote Frontend EM roles
import Anthropic from "@anthropic-ai/sdk";
import { sendEmail } from "./email.js";
import { readFileSync } from "fs";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function loadApplied() {
  const data = JSON.parse(readFileSync("./applied.json", "utf8"));
  return [...new Set(data.map((a) => a.company))];
}

// ─── LINK VERIFICATION ───────────────────────────────────────────────────────

async function checkUrl(url) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(url, {
      method: "HEAD",
      redirect: "manual",
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; JobScout/2.0)" },
    });

    clearTimeout(timeout);

    if (res.status >= 200 && res.status < 300) return "live";
    if (res.status >= 300 && res.status < 400) return "redirect";
    if (res.status === 404 || res.status === 410) return "dead";
    return "redirect";
  } catch {
    return "redirect";
  }
}

async function verifyLinks(text) {
  const urlRegex = /https?:\/\/[^\s)"<>]+/g;
  const urls = [...new Set(text.match(urlRegex) || [])];

  if (urls.length === 0) return {};

  console.log(`  🔗 Verifying ${urls.length} link(s)...`);

  const results = await Promise.all(
    urls.map(async (url) => {
      const status = await checkUrl(url);
      console.log(`     ${status === "live" ? "✅" : status === "dead" ? "❌" : "⚠️ "} ${url}`);
      return [url, status];
    })
  );

  return Object.fromEntries(results);
}

// ─── ANNOTATE EMAIL HTML ─────────────────────────────────────────────────────

function annotateLinks(text, linkStatuses) {
  const escapeHtml = (value) =>
    value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");

  const renderTextChunk = (chunk) =>
    escapeHtml(chunk)
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\n/g, "<br>");

  const renderLink = (url, status) => {
    let badge, color, label;
    if (status === "live") {
      badge = "✅"; color = "#16a34a"; label = "Confirmed Live";
    } else if (status === "dead") {
      badge = "❌"; color = "#dc2626"; label = "Closed";
    } else {
      badge = "⚠️"; color = "#d97706"; label = "Browse Manually";
    }
    return `<a href="${escapeHtml(url)}" style="color:${color};font-weight:bold;">${badge} ${label} →</a>`;
  };

  const urlRegex = /(https?:\/\/[^\s)"<>]+)/g;
  const parts = text.split(urlRegex);

  return parts
    .map((part) => {
      const status = linkStatuses[part];
      return status ? renderLink(part, status) : renderTextChunk(part);
    })
    .join("");
}

// ─── BUILD LEGEND + STATS ────────────────────────────────────────────────────

function buildStats(linkStatuses) {
  const counts = { live: 0, redirect: 0, dead: 0 };
  for (const s of Object.values(linkStatuses)) counts[s]++;

  return `
    <div style="display:flex;gap:16px;margin-bottom:20px;flex-wrap:wrap;">
      <span style="background:#f0fff4;border:1px solid #16a34a;padding:4px 10px;border-radius:20px;font-size:12px;color:#16a34a;">
        ✅ ${counts.live} Confirmed Live
      </span>
      <span style="background:#fffbeb;border:1px solid #d97706;padding:4px 10px;border-radius:20px;font-size:12px;color:#d97706;">
        ⚠️ ${counts.redirect} Browse Manually
      </span>
      <span style="background:#fff5f5;border:1px solid #dc2626;padding:4px 10px;border-radius:20px;font-size:12px;color:#dc2626;">
        ❌ ${counts.dead} Closed
      </span>
    </div>
    <div style="background:#f8f9fa;padding:10px 14px;border-radius:4px;font-size:12px;color:#666;margin-bottom:20px;">
      ✅ <strong>Confirmed Live</strong> — apply now &nbsp;·&nbsp;
      ⚠️ <strong>Browse Manually</strong> — link redirected, role may still exist &nbsp;·&nbsp;
      ❌ <strong>Closed</strong> — skip
    </div>`;
}

// ─── MAIN ────────────────────────────────────────────────────────────────────

async function runSearch() {
  const excluded = loadApplied();

  const prompt = `You are a job search assistant for AJ, an Engineering Manager targeting remote Frontend/UI EM roles.

AJ's criteria:
- Titles: Engineering Manager, Senior Engineering Manager, Director of Engineering (frontend/UI focus)
- Location: Remote US, Remote US+Canada, OR Remote Canada (AJ is a US Citizen working remotely — eligible for Canadian companies that hire US-based remote workers)
- Base salary: $225,000+ USD minimum. For Canadian roles, $300,000+ CAD equivalent. If base not listed, total comp $280K+ USD
- Tech focus: Frontend, UI, React, TypeScript, Design Systems, Developer Experience, Consumer Products
- NOT a fit: backend-only, infra/DevOps, native mobile (iOS/Android), data engineering, QA-only
- Start date available: June 2, 2026

EXCLUDE these companies entirely (already applied or rejected):
${excluded.join(", ")}

Your task — run multiple searches:
1. New remote Frontend EM / Senior EM roles posted in last 48 hours (US + Canada)
2. New remote Director of Engineering (frontend) roles in last 48 hours (US + Canada)
3. Check Greenhouse and Lever job boards for fresh frontend EM postings open to Canada
4. Canadian tech companies (Shopify, Hootsuite, Wealthsimple, Lightspeed, GitLab, Clio, Docebo, Faire) hiring frontend EM remotely
5. Any well-funded US or Canadian startups hiring frontend EM remotely right now

For each qualifying role found, output:
**[Company] — [Role Title]**
- Comp: [range or "not listed"]
- Remote: [US only / US+Canada / worldwide]
- URL: [direct link]
- Fit: [1 sentence — be specific about why it fits or flag concerns]

If nothing new meets criteria, say so clearly. Flag borderline roles honestly.`;

  console.log("🔍 Searching for new roles...");
  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 4096,
    tools: [{ type: "web_search_20250305", name: "web_search" }],
    messages: [{ role: "user", content: prompt }],
  });

  const summary = response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n");

  const linkStatuses = await verifyLinks(summary);
  const hasLinks = Object.keys(linkStatuses).length > 0;

  const now = new Date().toLocaleString("en-US", {
    timeZone: "America/Denver",
    dateStyle: "full",
    timeStyle: "short",
  });

  const liveCount = Object.values(linkStatuses).filter((s) => s === "live").length;
  const subjectTag = liveCount > 0 ? `${liveCount} confirmed live` : "no new roles";

  await sendEmail({
    subject: `🎯 Job Scout — ${subjectTag} · ${now}`,
    html: `
      <div style="background:#f0f4ff;border-left:4px solid #1a56db;padding:12px;border-radius:4px;margin-bottom:20px;font-size:13px;color:#444;">
        Excluding ${excluded.length} companies · $225K+ base · Remote US/Canada · Frontend/UI EM
      </div>
      ${hasLinks ? buildStats(linkStatuses) : ""}
      ${hasLinks ? annotateLinks(summary, linkStatuses) : summary}`,
  });

  console.log(`✅ Done. ${liveCount} confirmed live link(s).`);
}

runSearch().catch((err) => {
  console.error("❌ Error:", err.message);
  process.exit(1);
});