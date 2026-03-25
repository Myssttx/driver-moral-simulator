import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const EXPORT_DIR = path.join(process.cwd(), "data", "exports");
const CSV_PATH = path.join(EXPORT_DIR, "decisions_all_runs.csv");

function csvEscape(v) {
  if (v == null) return "";
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function ensureExportDir() {
  if (!fs.existsSync(EXPORT_DIR)) {
    fs.mkdirSync(EXPORT_DIR, { recursive: true });
  }
}

function ensureHeader() {
  if (fs.existsSync(CSV_PATH)) return;
  ensureExportDir();
  const header = ["runId", "startedAt", "scenarioId", "choice", "reactionMs"];
  fs.writeFileSync(CSV_PATH, `${header.join(",")}\n`, "utf8");
}

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return new NextResponse("Bad JSON", { status: 400 });
  }

  const { runId, startedAt, decisions } = body ?? {};
  if (!runId || !Array.isArray(decisions)) {
    return new NextResponse("Missing runId/decisions", { status: 400 });
  }

  ensureHeader();

  const lines = decisions
    .map((d) => {
      const scenarioId = d?.scenarioId ?? "";
      const choice = d?.choice ?? "";
      const reactionMs = d?.reactionMs ?? "";
      return [
        csvEscape(runId),
        csvEscape(startedAt),
        csvEscape(scenarioId),
        csvEscape(choice),
        csvEscape(reactionMs),
      ].join(",");
    })
    .join("\n");

  fs.appendFileSync(CSV_PATH, `${lines}\n`, "utf8");

  return NextResponse.json({ ok: true, appended: decisions.length });
}

export async function GET() {
  if (!fs.existsSync(CSV_PATH)) {
    return new NextResponse("No CSV data yet.", { status: 404 });
  }

  const csv = fs.readFileSync(CSV_PATH, "utf8");
  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="decisions_all_runs.csv"',
    },
  });
}

