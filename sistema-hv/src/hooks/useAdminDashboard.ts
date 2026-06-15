import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { getDashboardAdminFn } from "@/rpc/admin-dashboard";

export function useAdminDashboard() {
  const fn = useServerFn(getDashboardAdminFn);
  return useQuery({
    queryKey: ["dashboard-admin"],
    queryFn: () => fn(),
  });
}
