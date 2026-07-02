"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { buildConfigDerived } from "@/lib/config/utils";
import type { AgentConfig, AppConfig, AppConfigDerived } from "@/lib/config/types";

type AppConfigContextValue = AppConfig & AppConfigDerived;

const AppConfigContext = createContext<AppConfigContextValue | null>(null);

type AppConfigProviderProps = {
  config: AppConfig;
  children: ReactNode;
};

export function AppConfigProvider({ config, children }: AppConfigProviderProps) {
  const value = useMemo(
    () => ({ ...config, ...buildConfigDerived(config.agents) }),
    [config],
  );

  return (
    <AppConfigContext.Provider value={value}>{children}</AppConfigContext.Provider>
  );
}

export function useAppConfig(): AppConfigContextValue {
  const ctx = useContext(AppConfigContext);
  if (!ctx) {
    throw new Error("useAppConfig must be used within AppConfigProvider");
  }
  return ctx;
}

export function useAgentTeam(): AgentConfig[] {
  return useAppConfig().agents;
}
