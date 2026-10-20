import Link from "next/link";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";

async function ErrorMessage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <p className="text-muted-foreground">{error ?? "Something went wrong signing you in."}</p>;
}

export default function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 px-4 py-16">
      <h1 className="text-3xl font-black">That login didn&apos;t work</h1>
      <Suspense>
        <ErrorMessage searchParams={searchParams} />
      </Suspense>
      <p className="text-muted-foreground">
        Login links expire after an hour and only work once. Request a new one — or type the code
        from the email instead.
      </p>
      <Button asChild size="xl">
        <Link href="/login">Back to sign in</Link>
      </Button>
    </div>
  );
}
