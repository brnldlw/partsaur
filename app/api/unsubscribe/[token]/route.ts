import { redirect } from "next/navigation";
import { unsubscribeWantedEmails } from "@/app/actions/wanted";

// Email clients' one-click unsubscribe (RFC 8058) POSTs here.
export async function POST(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  await unsubscribeWantedEmails(token);
  return new Response("Unsubscribed", { status: 200 });
}

// A person clicking the link gets a confirm page (so link scanners can't unsubscribe them).
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  redirect(`/unsubscribe/${token}`);
}
