import { SiteHeader } from "@/components/SiteHeader";
import { CustomerTracker } from "@/components/CustomerTracker";

type Props = {
  searchParams: Promise<{ order?: string }>;
};

export default async function TrackPage({ searchParams }: Props) {
  const params = await searchParams;

  return (
    <>
      <SiteHeader />
      <main className="flex-1 px-4 py-8 sm:py-12">
        <CustomerTracker initialOrderNumber={params.order ?? ""} />
      </main>
      <footer className="border-t border-zinc-200 py-6 text-center text-xs text-zinc-500 dark:border-zinc-800">
        Likhit Order Tracking · Testing environment
      </footer>
    </>
  );
}
