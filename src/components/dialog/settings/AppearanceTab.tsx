import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { MdAdd, MdClose } from "react-icons/md";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useApp } from "@/context/AppContext";
import { AVAILABLE_LANGUAGES } from "@/i18n";
import { themeList } from "@/themes";
import { SettingNumberInput, SettingRow, SettingSelect, SettingSwitch } from "./SettingFormItems";

export function AppearanceTab() {
  const { t, i18n } = useTranslation();
  const { appSettings, updateAppSettings, uiConfig, updateUiConfig } = useApp();
  const [systemFonts, setSystemFonts] = useState<string[]>([]);

  useEffect(() => {
    invoke<string[]>("get_system_fonts")
      .then((fonts) => setSystemFonts(fonts))
      .catch(console.error);
  }, []);

  return (
    <div className="space-y-5">
      <SettingSelect
        label={t("settings.theme", "Theme")}
        desc={t("settings.themeDesc", "Select the color theme for the terminal and application.")}
        value={appSettings.appearance.theme || "github-dark"}
        onValueChange={(v) =>
          updateAppSettings({ appearance: { ...appSettings.appearance, theme: v } })
        }
      >
        {themeList.map((tm) => (
          <SelectItem key={tm.id} value={tm.id}>
            {tm.name}
          </SelectItem>
        ))}
      </SettingSelect>

      <SettingSelect
        label={t("settings.language", "Language")}
        desc={t(
          "settings.languageDesc",
          "Select the display language for the application interface.",
        )}
        value={uiConfig.language || "en"}
        onValueChange={(lng) => {
          i18n.changeLanguage(lng);
          updateUiConfig({ language: lng });
        }}
      >
        {AVAILABLE_LANGUAGES.map((lng) => (
          <SelectItem key={lng.id} value={lng.id}>
            {lng.name}
          </SelectItem>
        ))}
      </SettingSelect>

      {/* Font Family */}
      <div className="space-y-2">
        <Label className="font-medium text-sm">{t("settings.fontFamily", "Font Family")}</Label>
        <p className="text-xs text-muted-foreground">
          {t(
            "settings.fontFamilyDesc",
            "The font family used in the terminal and app UI. Topmost font has highest priority.",
          )}
        </p>
        <div className="space-y-2">
          {appSettings.appearance.font_family
            .split(",")
            .map((f) => f.trim())
            .map((font, idx, arr) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="text-xs w-20 shrink-0 text-muted-foreground">
                  {idx === 0
                    ? t("settings.fontPrimary", "Primary")
                    : `${t("settings.fontFallback", "Fallback")} ${idx}`}
                </span>
                <Select
                  value={systemFonts.includes(font) ? font : ""}
                  onValueChange={(v) => {
                    const newFonts = [...arr];
                    newFonts[idx] = v;
                    updateAppSettings({
                      appearance: {
                        ...appSettings.appearance,
                        font_family: newFonts.filter(Boolean).join(", "),
                      },
                    });
                  }}
                >
                  <SelectTrigger className="flex-1 h-9 px-3 text-sm shadow-xs focus:ring-1 focus:ring-ring focus:outline-none">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {!systemFonts.includes(font) && (
                      <SelectItem value={font}>{font} (Custom/Missing)</SelectItem>
                    )}
                    {systemFonts.map((f) => (
                      <SelectItem key={f} value={f}>
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="text-destructive hover:bg-destructive/10"
                  title={t("common.remove", "Remove")}
                  onClick={() => {
                    const newFonts = arr.filter((_, i) => i !== idx);
                    if (newFonts.length === 0) newFonts.push("Consolas");
                    updateAppSettings({
                      appearance: { ...appSettings.appearance, font_family: newFonts.join(", ") },
                    });
                  }}
                >
                  <MdClose className="text-[16px]" />
                </Button>
              </div>
            ))}
        </div>
        <Button
          variant="ghost"
          size="xs"
          className="text-primary"
          onClick={() => {
            const newFonts = [
              ...appSettings.appearance.font_family.split(",").map((f) => f.trim()),
              systemFonts[0] || "Arial",
            ];
            updateAppSettings({
              appearance: { ...appSettings.appearance, font_family: newFonts.join(", ") },
            });
          }}
        >
          <MdAdd className="text-[14px]" /> {t("settings.addFallbackFont", "Add Fallback")}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <SettingNumberInput
          label={t("settings.fontSize", "Font Size (px)")}
          min={8}
          max={72}
          value={appSettings.appearance.font_size}
          onChange={(v) =>
            updateAppSettings({ appearance: { ...appSettings.appearance, font_size: v || 14 } })
          }
        />
        <SettingSelect
          label={t("settings.cursorStyle", "Cursor Style")}
          value={appSettings.appearance.cursor_style}
          onValueChange={(v) =>
            updateAppSettings({ appearance: { ...appSettings.appearance, cursor_style: v } })
          }
        >
          <SelectItem value="block">{t("settings.cursorBlock", "Block")}</SelectItem>
          <SelectItem value="underline">{t("settings.cursorUnderline", "Underline")}</SelectItem>
          <SelectItem value="bar">{t("settings.cursorBar", "Bar")}</SelectItem>
        </SettingSelect>
      </div>

      <SettingRow label={t("settings.cursorBlink", "Cursor Blink")}>
        <SettingSwitch
          checked={appSettings.appearance.cursor_blink}
          onChange={(v) =>
            updateAppSettings({ appearance: { ...appSettings.appearance, cursor_blink: v } })
          }
        />
      </SettingRow>

      <SettingRow
        label={t("settings.fontLigatures", "Enable Font Ligatures")}
        desc={t(
          "settings.fontLigaturesDesc",
          "Combine multiple characters into a single typographical glyph.",
        )}
      >
        <SettingSwitch
          checked={appSettings.appearance.ligatures}
          onChange={(v) =>
            updateAppSettings({ appearance: { ...appSettings.appearance, ligatures: v } })
          }
        />
      </SettingRow>
    </div>
  );
}
