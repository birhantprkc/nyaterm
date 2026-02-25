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

export function ProxyTab() {
  const { t } = useTranslation();
  const { appSettings, updateAppSettings } = useApp();

  return (
    <div className="space-y-4">
      <SettingRow
        label={t("settings.enableProxy", "Enable Proxy")}
        desc={t("settings.enableProxyDesc", "Route SSH connections through a proxy server.")}
      >
        <SettingSwitch
          checked={appSettings.proxy.enabled}
          onChange={(v) => updateAppSettings({ proxy: { ...appSettings.proxy, enabled: v } })}
        />
      </SettingRow>

      <div
        className={`space-y-4 ${!appSettings.proxy.enabled ? "opacity-50 pointer-events-none" : ""}`}
      >
        <SettingSelect
          label={t("settings.proxyProtocol", "Protocol")}
          value={appSettings.proxy.protocol}
          onValueChange={(v) => updateAppSettings({ proxy: { ...appSettings.proxy, protocol: v } })}
        >
          <SelectItem value="socks5">SOCKS5</SelectItem>
          <SelectItem value="http">HTTP</SelectItem>
        </SettingSelect>

        <div className="flex gap-2">
          <div className="flex-1">
            <SettingInput
              label={t("settings.proxyHost", "Host")}
              placeholder="127.0.0.1"
              value={appSettings.proxy.host}
              onChange={(e) =>
                updateAppSettings({ proxy: { ...appSettings.proxy, host: e.target.value } })
              }
            />
          </div>
          <div className="w-32">
            <SettingNumberInput
              label={t("settings.proxyPort", "Port")}
              min={1}
              max={65535}
              value={appSettings.proxy.port || 0}
              onChange={(v) => updateAppSettings({ proxy: { ...appSettings.proxy, port: v || 0 } })}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
