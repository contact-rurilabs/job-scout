// search.js — runs 2x/day, finds new remote Frontend EM roles
import Anthropic from "@anthropic-ai/sdk";
import { sendEmail } from "./email.js";
import { readFileSync } from "fs";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function loadApplied() {
  const data = JSON.parse(readFileSync("./applied.json", "utf8"));
  // Deduplicate company names, exclude employed/watchlist entries
  return [...new Set(data.map((a) => a.company))];
}

async function runSearch() {
  const excluded = loadApplied();

  const prompt = `You are a job search assistant for AJ, an Engineering Manager targeting remote Frontend/UI EM roles.

AJ's criteria:
- Titles: Engineering Manager, Senior Engineering Manager, Director of Engineering (frontend/UI focus)
- Must be: Remote US or Remote US+Canada
- Base salary: $225,000+ minimum. If base not listed, total comp $280K+
- Tech focus: Frontend, UI, React, TypeScript, Design Systems, Developer Experience, Consumer Products
- NOT a fit: backend-only, infra/DevOps, native mobile (iOS/Android), data engineering, QA-only
- Start date available: June 2, 2026

EXCLUDE these companies entirely (already applied or rejected):
${excluded.join(", ")}

Your task — run multiple searches:
1. New remote Frontend EM / Senior EM roles posted in last 48 hours
2. New remote Director of Engineering (frontend) roles in last 48 hours
3. Check Greenhouse job boards for fresh frontend EM postings
4. Any well-funded startups or notable tech companies hiring frontend EM remotely right now

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

  const now = new Date().toLocaleString("en-US", {
    timeZone: "America/Denver",
    dateStyle: "full",
    timeStyle: "short",
  });

  await sendEmail({
    subject: `🎯 Job Scout — ${now}`,
    html: `
      <div style="background:#f0f4ff;border-left:4px solid #1a56db;padding:12px;border-radius:4px;margin-bottom:20px;font-size:13px;color:#444;">
        Excluding ${excluded.length} companies already applied/rejected · $225K+ base · Remote US/Canada · Frontend/UI EM
      </div>
      ${summary}`,
  });
}

runSearch().catch((err) => {
  console.error("❌ Error:", err.message);
  process.exit(1);
});
