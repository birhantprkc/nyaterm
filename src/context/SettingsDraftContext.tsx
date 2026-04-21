import { createContext, useContext } from "react";
import type { AppSettings } from "@/types/global";

interface SettingsDraftContextValue {
  committedSettings: AppSettings;
  isDirty: boolean;
  isSaving: boolean;
}

export const SettingsDraftContext = createContext<SettingsDraftContextValue | null>(null);

export function useSettingsDraft() {
  const context = useContext(SettingsDraftContext);
  if (!context) {
    throw new Error("useSettingsDraft must be used within SettingsDraftContext");
  }
  return context;
}
