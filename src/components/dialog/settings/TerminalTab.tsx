import { useTranslation } from "react-i18next";
import { useApp } from "../../../context/AppContext";
import { SettingNumberInput, SettingRow, SettingSwitch } from "./SettingFormItems";

export function TerminalTab() {
  const { t } = useTranslation();
  const { appSettings, updateAppSettings } = useApp();

  return (
    <div className="space-y-4">
      <SettingNumberInput
        label={t("settings.scrollbackLines", "Scrollback Buffer (lines)")}
        desc={t("settings.scrollbackLinesDesc", "Number of lines kept in memory for scrolling up.")}
        min={100}
        max={100000}
        step={100}
        value={appSettings.terminal.scrollback_lines}
        onChange={(v) =>
          updateAppSettings({ terminal: { ...appSettings.terminal, scrollback_lines: v || 5000 } })
        }
      />

      <SettingNumberInput
        label={t("settings.keepAliveInterval", "Keep-Alive Interval (seconds)")}
        desc={t(
          "settings.keepAliveIntervalDesc",
          "Send SSH keep-alive packets every X seconds. 0 to disable.",
        )}
        min={0}
        max={600}
        step={5}
        value={appSettings.terminal.keep_alive_interval}
        onChange={(v) =>
          updateAppSettings({ terminal: { ...appSettings.terminal, keep_alive_interval: v || 0 } })
        }
      />

      <SettingRow
        label={t("settings.hardwareAcceleration", "Hardware Acceleration")}
        desc={t(
          "settings.hardwareAccelerationDesc",
          "Use GPU for terminal rendering (WebGL/Canvas). Requires restart.",
        )}
      >
        <SettingSwitch
          checked={appSettings.terminal.hardware_acceleration}
          onChange={(v) =>
            updateAppSettings({ terminal: { ...appSettings.terminal, hardware_acceleration: v } })
          }
        />
      </SettingRow>
    </div>
  );
}
