import { NextResponse } from "next/server";

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Fake global stats for the result screen (no persistence). */
export async function GET() {
  const swervePct = randInt(28, 52);
  const stayPct = 100 - swervePct;
  const agreeWithYou = randInt(41, 89);
  const avgReactionMs = randInt(620, 1180);

  return NextResponse.json({
    globalSwervePercent: swervePct,
    globalStayPercent: stayPct,
    playersAgreePercent: agreeWithYou,
    avgReactionMs,
  });
}
