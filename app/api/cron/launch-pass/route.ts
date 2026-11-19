import { NextResponse, type NextRequest } from "next/server";
import { sendLaunchPassReminders } from "@/lib/launch-emails";

// Runs once a day (see vercel.json). Vercel sends "Authorization: Bearer $CRON_SECRET".
// Does nothing outside the March 24–31, 2027 reminder windows.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await sendLaunchPassReminders();
  console.log("launch pass reminders:", result);
  return NextResponse.json(result);
}
