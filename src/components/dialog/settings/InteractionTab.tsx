import { useTranslation } from "react-i18next";
import { SelectItem } from "@/components/ui/select";
import { useApp } from "../../../context/AppContext";
import { SettingInput, SettingRow, SettingSelect, SettingSwitch } from "./SettingFormItems";

export function InteractionTab() {
  const { t } = useTranslation();
  const { appSettings, updateAppSettings } = useApp();

  return (
    <div className="space-y-4">
      <SettingRow
        label={t("settings.copyOnSelect", "Copy on Select")}
        desc={t("settings.copyOnSelectDesc", "Automatically copy selected text to the clipboard.")}
      >
        <SettingSwitch
          checked={appSettings.interaction.copy_on_select}
          onChange={(v) =>
            updateAppSettings({ interaction: { ...appSettings.interaction, copy_on_select: v } })
          }
        />
      </SettingRow>

      <SettingRow
        label={t("settings.rightClickPaste", "Right-click Paste")}
        desc={t(
          "settings.rightClickPasteDesc",
          "Paste clipboard content on right-click instead of opening context menu.",
        )}
      >
        <SettingSwitch
          checked={appSettings.interaction.right_click_paste}
          onChange={(v) =>
            updateAppSettings({ interaction: { ...appSettings.interaction, right_click_paste: v } })
          }
        />
      </SettingRow>

      <SettingInput
        label={t("settings.wordSeparators", "Word Separators")}
        desc={t(
          "settings.wordSeparatorsDesc",
          "Characters that separate words for double-click selection.",
        )}
        value={appSettings.interaction.word_separators}
        onChange={(e) =>
          updateAppSettings({
            interaction: { ...appSettings.interaction, word_separators: e.target.value },
          })
        }
      />

      <SettingSelect
        label={t("settings.defaultEncoding", "Default Encoding")}
        value={appSettings.interaction.default_encoding}
        onValueChange={(v) =>
          updateAppSettings({ interaction: { ...appSettings.interaction, default_encoding: v } })
        }
      >
        <SelectItem value="UTF-8">UTF-8</SelectItem>
        <SelectItem value="GBK">GBK</SelectItem>
      </SettingSelect>
    </div>
  );
}
