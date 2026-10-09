import { queryOptions } from "@tanstack/react-query";
import { getScripts } from "@/lib/scripts.functions";

export const scriptsOptions = (userId: string) => queryOptions({
  queryKey: ["scripts", userId],
  queryFn: () => getScripts(),
  staleTime: 60_000,
});