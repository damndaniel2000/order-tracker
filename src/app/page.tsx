import { SiteHeader } from "@/components/SiteHeader";
import { HomeTracker } from "@/components/HomeTracker";

type Props = {
  searchParams: Promise<{ order?: string; email?: string }>;
};

export default async function HomePage({ searchParams }: Props) {
  const params = await searchParams;

  return (
    <>
      <SiteHeader />
      <main className="flex-1 px-4 py-8 sm:py-12">
        <HomeTracker
          initialOrderNumber={params.order ?? ""}
          initialEmail={params.email ?? ""}
        />
      </main>
      <footer className="border-t border-zinc-200 py-6 text-center text-xs text-zinc-500 dark:border-zinc-800">
        Likhit Order Tracking · Testing environment
      </footer>
    </>
  );
}
