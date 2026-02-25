import { useTranslation } from "react-i18next";
import { MdAdd, MdDelete } from "react-icons/md";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectItem } from "@/components/ui/select";
import { useApp } from "../../../context/AppContext";
import { SettingSelect } from "./SettingFormItems";

export function SearchTab() {
  const { t } = useTranslation();
  const { appSettings, updateAppSettings } = useApp();

  return (
    <div className="space-y-6">
      <SettingSelect
        label={t("settings.defaultSearchEngine", "Default Search Engine")}
        desc={t(
          "settings.defaultSearchEngineDesc",
          "The primary engine used when double-clicking or right-clicking to search.",
        )}
        value={appSettings.search.default_engine}
        onValueChange={(v) =>
          updateAppSettings({ search: { ...appSettings.search, default_engine: v } })
        }
      >
        {appSettings.search.custom_engines.map((engine, idx) => (
          <SelectItem key={idx} value={engine.name}>
            {engine.name}
          </SelectItem>
        ))}
      </SettingSelect>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="font-medium text-sm">
            {t("settings.customEngines", "Search Engines")}
          </Label>
          <Button
            variant="ghost"
            size="xs"
            className="text-primary"
            onClick={() => {
              const newEngines = [
                ...appSettings.search.custom_engines,
                { name: "New Engine", url_template: "https://example.com/search?q=%s" },
              ];
              updateAppSettings({ search: { ...appSettings.search, custom_engines: newEngines } });
            }}
          >
            <MdAdd className="text-[14px]" /> {t("common.add", "Add")}
          </Button>
        </div>

        <div className="border rounded-md overflow-hidden">
          {appSettings.search.custom_engines.map((engine, i) => (
            <div
              key={i}
              className="flex items-center gap-2 p-2 border-b last:border-0 hover:bg-accent transition-colors"
            >
              <Input
                placeholder="Name"
                className="w-1/3 text-sm"
                value={engine.name}
                onChange={(e) => {
                  const newEngines = [...appSettings.search.custom_engines];
                  newEngines[i] = { ...newEngines[i], name: e.target.value };
                  updateAppSettings({
                    search: { ...appSettings.search, custom_engines: newEngines },
                  });
                }}
              />
              <Input
                placeholder="URL Template (e.g. https://google.com/search?q=%s)"
                className="flex-1 text-sm"
                value={engine.url_template}
                onChange={(e) => {
                  const newEngines = [...appSettings.search.custom_engines];
                  newEngines[i] = { ...newEngines[i], url_template: e.target.value };
                  updateAppSettings({
                    search: { ...appSettings.search, custom_engines: newEngines },
                  });
                }}
              />
              <Button
                variant="ghost"
                size="icon-xs"
                className="text-destructive hover:bg-destructive/10"
                title={t("common.delete", "Delete")}
                onClick={() => {
                  const newEngines = appSettings.search.custom_engines.filter(
                    (_, idx) => idx !== i,
                  );
                  const newDefault =
                    appSettings.search.default_engine === engine.name
                      ? newEngines[0]?.name || ""
                      : appSettings.search.default_engine;
                  updateAppSettings({
                    search: { default_engine: newDefault, custom_engines: newEngines },
                  });
                }}
              >
                <MdDelete className="text-[16px]" />
              </Button>
            </div>
          ))}
          {appSettings.search.custom_engines.length === 0 && (
            <div className="text-center py-6 text-xs text-muted-foreground">
              {t("settings.noCustomEngines", "No search engines available.")}
            </div>
          )}
        </div>
        <p className="text-xs mt-1 text-muted-foreground">
          {t(
            "settings.customEnginesDesc",
            "Use %s to represent the searched text in the URL template.",
          )}
        </p>
      </div>
    </div>
  );
}
