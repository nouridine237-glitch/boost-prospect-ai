import { queryOptions } from "@tanstack/react-query";
import { getDuplication } from "./duplication.functions";

export const duplicationOptions = (userId: string) => queryOptions({ queryKey: ["duplication", userId], queryFn: () => getDuplication(), staleTime: 0 });