import { useTranslation } from "react-i18next";
import { useApp } from "../../../context/AppContext";
import { SettingInput, SettingRow, SettingSwitch } from "./SettingFormItems";

export function GeneralTab() {
  const { t } = useTranslation();
  const { appSettings, updateAppSettings } = useApp();

  return (
    <div className="space-y-4">
      <SettingRow
        label={t("settings.startupRestore", "Restore previous session on startup")}
        desc={t(
          "settings.startupRestoreDesc",
          "Automatically reconnect to tabs that were open when you last closed the app.",
        )}
      >
        <SettingSwitch
          checked={appSettings.general.startup_restore}
          onChange={(v) =>
            updateAppSettings({ general: { ...appSettings.general, startup_restore: v } })
          }
        />
      </SettingRow>

      <SettingInput
        label={t("settings.defaultLocalShell", "Default Local Shell")}
        desc={t(
          "settings.defaultLocalShellDesc",
          "The shell path to use when opening a local terminal.",
        )}
        value={appSettings.general.default_local_shell}
        onChange={(e) =>
          updateAppSettings({
            general: { ...appSettings.general, default_local_shell: e.target.value },
          })
        }
      />

      <SettingRow
        label={t("settings.minimizeToTray", "Minimize to tray on close")}
        desc={t(
          "settings.minimizeToTrayDesc",
          "Keep the application running in the background when the window is closed.",
        )}
      >
        <SettingSwitch
          checked={appSettings.general.minimize_to_tray}
          onChange={(v) =>
            updateAppSettings({ general: { ...appSettings.general, minimize_to_tray: v } })
          }
        />
      </SettingRow>
    </div>
  );
}
