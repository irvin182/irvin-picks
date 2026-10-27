import { redirect } from "next/navigation";
import { legacyLiveDestination } from "@/lib/liveNavigation";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  redirect(legacyLiveDestination(await searchParams));
}
