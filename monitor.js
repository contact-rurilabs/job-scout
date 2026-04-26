// monitor.js — runs 3x/day, watches specific company career pages for new Frontend EM roles
import Anthropic from "@anthropic-ai/sdk";
import { sendEmail } from "./email.js";
import { readFileSync, writeFileSync, existsSync } from "fs";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const CACHE_FILE = "./monitor-cache.json";

function loadCache() {
  if (!existsSync(CACHE_FILE)) return {};
  return JSON.parse(readFileSync(CACHE_FILE, "utf8"));
}

function saveCache(cache) {
  writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
}

function loadWatchlist() {
  return JSON.parse(readFileSync("./watchlist.json", "utf8"));
}

function loadApplied() {
  const data = JSON.parse(readFileSync("./applied.json", "utf8"));
  return [...new Set(data.map((a) => a.company.toLowerCase()))];
}

async function checkCompany(company, url) {
  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1000,
    tools: [{ type: "web_search_20250305", name: "web_search" }],
    messages: [
      {
        role: "user",
        content: `Check ${company}'s careers page at ${url} for any Engineering Manager, Senior Engineering Manager, or Director of Engineering roles that are:
- Frontend, UI, Design Systems, Developer Experience, or Consumer Product focused
- Remote US or Remote US+Canada eligible

Return ONLY a JSON array of matching roles. If none found, return [].
Format: [{"title": "...", "url": "...", "remote": "...", "comp": "..."}]
Return raw JSON only, no markdown, no explanation.`,
      },
    ],
  });

  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");

  try {
    // Extract JSON from response
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return [];
    return JSON.parse(match[0]);
  } catch {
    return [];
  }
}

async function runMonitor() {
  const watchlist = loadWatchlist();
  const appliedCompanies = loadApplied();
  const cache = loadCache();
  const newFindings = [];

  console.log(`👁️  Monitoring ${watchlist.length} companies...`);

  for (const { company, url } of watchlist) {
    // Skip if already applied
    if (appliedCompanies.includes(company.toLowerCase())) {
      console.log(`  ⏭️  ${company} — already applied, skipping`);
      continue;
    }

    console.log(`  🔍 Checking ${company}...`);
    const roles = await checkCompany(company, url);

    if (roles.length === 0) {
      console.log(`     No matching roles`);
      continue;
    }

    // Check against cache — only alert on new roles
    const cacheKey = company.toLowerCase();
    const cachedTitles = cache[cacheKey] || [];
    const newRoles = roles.filter(
      (r) => !cachedTitles.includes(r.title)
    );

    if (newRoles.length > 0) {
      console.log(`  🆕 ${company}: ${newRoles.length} NEW role(s) found!`);
      newFindings.push({ company, roles: newRoles });
      // Update cache
      cache[cacheKey] = roles.map((r) => r.title);
    } else {
      console.log(
        `     ${roles.length} role(s) found but already in cache`
      );
    }
  }

  // Save updated cache
  saveCache(cache);

  // Only send email if there's something new
  if (newFindings.length === 0) {
    console.log("✅ No new roles detected on watched career pages.");
    return;
  }

  const findingsHtml = newFindings
    .map(
      ({ company, roles }) => `
    <div style="background:#f0fff4;border-left:4px solid #16a34a;padding:16px;border-radius:4px;margin-bottom:16px;">
      <strong style="font-size:16px;">🆕 ${company}</strong>
      ${roles
        .map(
          (r) => `
        <div style="margin-top:10px;padding:10px;background:white;border-radius:4px;">
          <strong>${r.title}</strong><br>
          <span style="color:#555;font-size:13px;">Remote: ${r.remote || "check posting"} · Comp: ${r.comp || "not listed"}</span><br>
          ${r.url ? `<a href="${r.url}" style="color:#1a56db;font-size:13px;">View posting →</a>` : ""}
        </div>`
        )
        .join("")}
    </div>`
    )
    .join("");

  await sendEmail({
    subject: `🆕 Career Page Alert — ${newFindings.length} new role(s) detected!`,
    html: `
      <p style="color:#16a34a;font-weight:bold;">New Frontend EM roles appeared on watched career pages:</p>
      ${findingsHtml}
      <p style="font-size:13px;color:#666;margin-top:24px;">
        These were not previously seen on these career pages. Apply fast — early applicants have an edge.
      </p>`,
  });
}

runMonitor().catch((err) => {
  console.error("❌ Error:", err.message);
  process.exit(1);
});
