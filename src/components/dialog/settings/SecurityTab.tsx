import { useTranslation } from "react-i18next";
import { SelectItem } from "@/components/ui/select";
import { useApp } from "../../../context/AppContext";
import {
  SettingInput,
  SettingNumberInput,
  SettingRow,
  SettingSelect,
  SettingSwitch,
} from "./SettingFormItems";

export function SecurityTab() {
  const { t } = useTranslation();
  const { appSettings, updateAppSettings } = useApp();

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h4 className="font-semibold text-sm">
          {t("settings.credentialStorage", "Credential Storage")}
        </h4>

        <SettingRow
          label={t("settings.useOsKeyring", "Use OS Keyring")}
          desc={t(
            "settings.useOsKeyringDesc",
            "Securely store SSH passwords and keys in your system's native keychain.",
          )}
        >
          <SettingSwitch
            checked={appSettings.security.use_os_keyring}
            onChange={(v) =>
              updateAppSettings({ security: { ...appSettings.security, use_os_keyring: v } })
            }
          />
        </SettingRow>

        <SettingRow
          label={t("settings.requireMasterPassword", "Require Master Password")}
          desc={t(
            "settings.requireMasterPasswordDesc",
            "Require a master password to encrypt your session database.",
          )}
        >
          <SettingSwitch
            checked={appSettings.security.require_master_password}
            onChange={(v) =>
              updateAppSettings({
                security: { ...appSettings.security, require_master_password: v },
              })
            }
          />
        </SettingRow>
      </div>

      <div className="border-t pt-4 space-y-4">
        <h4 className="font-semibold text-sm">
          {t("settings.sessionSecurity", "Session Security")}
        </h4>

        <SettingRow
          label={t("settings.idleLockMinutes", "Session Lock Interval")}
          desc={t(
            "settings.idleLockMinutesDesc",
            "Lock the application after a specified duration of inactivity (0 to disable).",
          )}
        >
          <div className="flex items-center gap-3">
            <SettingNumberInput
              label=""
              min={0}
              max={1440}
              className="w-28"
              value={appSettings.security.idle_lock_minutes}
              onChange={(v) =>
                updateAppSettings({
                  security: { ...appSettings.security, idle_lock_minutes: v || 0 },
                })
              }
            />
            <span className="text-sm text-muted-foreground">{t("common.minutes", "mins")}</span>
          </div>
        </SettingRow>

        {appSettings.security.idle_lock_minutes > 0 && (
          <SettingInput
            label={t("settings.lockPassword", "Unlock Password")}
            desc={t(
              "settings.lockPasswordDesc",
              "Set a password required to unlock the application. Leave empty for click-to-unlock.",
            )}
            type="password"
            placeholder={
              appSettings.security.lock_password === "__SET__"
                ? "••••••••"
                : t("settings.lockPasswordPlaceholder", "Optional")
            }
            value={
              appSettings.security.lock_password === "__SET__"
                ? ""
                : appSettings.security.lock_password || ""
            }
            onChange={(e) => {
              const val = e.target.value;
              // Empty string clears the password; non-empty sets new plaintext
              updateAppSettings({
                security: { ...appSettings.security, lock_password: val || undefined },
              });
            }}
          />
        )}

        <SettingSelect
          label={t("settings.hostKeyPolicy", "Host Key Policy")}
          desc={t(
            "settings.hostKeyPolicyDesc",
            "How the application handles unrecognized SSH host keys.",
          )}
          value={appSettings.security.host_key_policy}
          onValueChange={(v) =>
            updateAppSettings({ security: { ...appSettings.security, host_key_policy: v } })
          }
        >
          <SelectItem value="strict">
            {t("settings.hostKeyStrict", "Strict (Reject unknown hosts)")}
          </SelectItem>
          <SelectItem value="prompt">
            {t("settings.hostKeyPrompt", "Prompt (Ask user for confirmation)")}
          </SelectItem>
          <SelectItem value="accept">
            {t("settings.hostKeyAccept", "Accept (Automatically add new hosts)")}
          </SelectItem>
        </SettingSelect>
      </div>
    </div>
  );
}
