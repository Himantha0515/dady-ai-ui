import { useQuery } from "@tanstack/react-query";
import { catalogApi, walletApi } from "../lib/api/catalog";
import { useAuth } from "../lib/auth/context";

export function usePlans() {
  return useQuery({ queryKey: ["plans"], queryFn: () => catalogApi.listPlans() });
}

export function useCreditPacks() {
  return useQuery({ queryKey: ["credit-packs"], queryFn: () => catalogApi.listCreditPacks() });
}

export function useModels(generationType?: string) {
  return useQuery({
    queryKey: ["models", generationType ?? "all"],
    queryFn: () => catalogApi.listModels(generationType),
  });
}

export function useTemplates() {
  return useQuery({ queryKey: ["templates"], queryFn: () => catalogApi.listTemplates() });
}

export function useWallet() {
  const { wallet, refreshWallet } = useAuth();
  return { wallet, refreshWallet, credits: wallet?.available_credits ?? 0 };
}

export function useCreditTransactions(limit = 40) {
  return useQuery({
    queryKey: ["credit-transactions", limit],
    queryFn: () => walletApi.listTransactions(limit),
  });
}

export function useCreditGrants() {
  return useQuery({
    queryKey: ["credit-grants"],
    queryFn: () => walletApi.listGrants(),
  });
}

export function useActiveSubscription() {
  return useQuery({
    queryKey: ["active-subscription"],
    queryFn: () => walletApi.getActiveSubscription(),
  });
}

export function usePlatformStats() {
  return useQuery({
    queryKey: ["platform-stats"],
    queryFn: () => catalogApi.getPlatformStats(),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
}
