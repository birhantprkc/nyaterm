import { MoreHorizontalIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { MdAdd, MdDelete, MdEdit, MdLan, MdRouter } from "react-icons/md";
import { toast } from "sonner";
import { ProxyDialog } from "@/components/dialog/network/ProxyDialog";
import {
  buildGroupPath,
  type ConnectionOption,
  EmptyState,
  StatusBadge,
  sortLabel,
} from "@/components/dialog/network/shared";
import { TunnelDialog } from "@/components/dialog/network/TunnelDialog";
import PanelHeader from "@/components/layout/PanelHeader";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApp } from "@/context/AppContext";
import { invoke } from "@/lib/invoke";
import { cn } from "@/lib/utils";
import type { ProxyConfig, TunnelConfig } from "@/types/global";

type NetworkTab = "proxy" | "tunnel";

function ProxyRow({
  proxy,
  onEdit,
  onDelete,
}: {
  proxy: ProxyConfig;
  onEdit: (proxy: ProxyConfig) => void;
  onDelete: (id: string) => void;
}) {
  const { t } = useTranslation();
  const address = `${proxy.host}:${proxy.port}`;

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-accent">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <div className="truncate text-sm font-medium" style={{ color: "var(--df-text)" }}>
            {proxy.name}
          </div>
        </div>
        <div className="mt-0.5 truncate text-xs" style={{ color: "var(--df-text-dimmed)" }}>
          {proxy.protocol.toUpperCase()}
        </div>
        <div className="mt-0.5 text-[0.6875rem]" style={{ color: "var(--df-text-muted)" }}>
          {proxy.username ? `${proxy.username}@${address}` : address}
        </div>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm">
            <MoreHorizontalIcon className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onEdit(proxy)}>
            <MdEdit className="mr-2 text-base" />
            {t("common.edit")}
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={() => onDelete(proxy.id)}
          >
            <MdDelete className="mr-2 text-base" />
            {t("common.delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function TunnelRow({
  tunnel,
  connectionOption,
  onEdit,
  onDelete,
  onToggle,
}: {
  tunnel: TunnelConfig;
  connectionOption?: ConnectionOption;
  onEdit: (tunnel: TunnelConfig) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string, open: boolean) => void;
}) {
  const { t } = useTranslation();
  const typeLabel =
    {
      local: t("network.localTunnel"),
      remote: t("network.remoteTunnel"),
      dynamic: t("network.dynamicTunnel"),
    }[tunnel.tunnel_type] ?? tunnel.tunnel_type;

  const endpoint =
    tunnel.tunnel_type === "dynamic"
      ? `SOCKS5 · ${tunnel.listen_port}`
      : `${tunnel.listen_port} → ${tunnel.target_host}:${tunnel.target_port}`;

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-accent">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <div className="truncate text-sm font-medium" style={{ color: "var(--df-text)" }}>
            {tunnel.name || endpoint}
          </div>
          <StatusBadge
            active={tunnel.is_open}
            activeLabel={t("network.tunnelOpen")}
            inactiveLabel={t("network.tunnelClosed")}
          />
        </div>
        <div className="mt-0.5 truncate text-xs" style={{ color: "var(--df-text-dimmed)" }}>
          {connectionOption?.connection.name ?? t("network.connectionMissing")} · {typeLabel}
        </div>
        <div className="mt-0.5 text-[0.6875rem]" style={{ color: "var(--df-text-muted)" }}>
          {endpoint}
        </div>
      </div>

      <Switch
        checked={tunnel.is_open}
        onCheckedChange={(checked) => onToggle(tunnel.id, checked)}
      />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm">
            <MoreHorizontalIcon className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onEdit(tunnel)}>
            <MdEdit className="mr-2 text-base" />
            {t("common.edit")}
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={() => onDelete(tunnel.id)}
          >
            <MdDelete className="mr-2 text-base" />
            {t("common.delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export default function NetworkPanel() {
  const { t } = useTranslation();
  const { savedConnections, savedGroups } = useApp();
  const [activeTab, setActiveTab] = useState<NetworkTab>("tunnel");

  const [proxies, setProxies] = useState<ProxyConfig[]>([]);
  const [proxyDialog, setProxyDialog] = useState<ProxyConfig | "new" | null>(null);
  const [proxySaving, setProxySaving] = useState(false);

  const [tunnels, setTunnels] = useState<TunnelConfig[]>([]);
  const [tunnelDialog, setTunnelDialog] = useState<TunnelConfig | "new" | null>(null);
  const [tunnelSaving, setTunnelSaving] = useState(false);

  const groupsById = useMemo(
    () => new Map(savedGroups.map((group) => [group.id, group])),
    [savedGroups],
  );

  const connectionOptions = useMemo<ConnectionOption[]>(() => {
    return [...savedConnections]
      .map((connection) => {
        const groupPath = buildGroupPath(connection.group_id, groupsById);
        const subtitle = groupPath
          ? `${groupPath} · ${connection.host}:${connection.port}`
          : `${connection.host}:${connection.port}`;

        return {
          connection,
          groupPath,
          subtitle,
          searchText: [connection.name, connection.host, connection.username, groupPath]
            .filter(Boolean)
            .join(" "),
          disabled: false,
        };
      })
      .sort((left, right) => {
        const pathSort = sortLabel(left.groupPath, right.groupPath);
        return pathSort !== 0 ? pathSort : sortLabel(left.connection.name, right.connection.name);
      });
  }, [groupsById, savedConnections]);

  const connectionOptionMap = useMemo(
    () => new Map(connectionOptions.map((option) => [option.connection.id, option])),
    [connectionOptions],
  );

  // --- Proxy operations ---

  const loadProxies = useCallback(async () => {
    try {
      const next = await invoke<ProxyConfig[]>("get_proxies");
      setProxies(next);
    } catch (error) {
      toast.error(String(error));
    }
  }, []);

  useEffect(() => {
    void loadProxies();
  }, [loadProxies]);

  const handleSaveProxy = useCallback(
    async (proxy: ProxyConfig) => {
      setProxySaving(true);
      try {
        const payload = proxy.id ? proxy : { ...proxy, id: crypto.randomUUID() };
        await invoke("save_proxy", { proxy: payload });
        await loadProxies();
        setProxyDialog(null);
      } catch (error) {
        toast.error(String(error));
      } finally {
        setProxySaving(false);
      }
    },
    [loadProxies],
  );

  const handleDeleteProxy = useCallback(
    async (proxyId: string) => {
      try {
        await invoke("delete_proxy", { proxyId });
        await loadProxies();
      } catch (error) {
        toast.error(String(error));
      }
    },
    [loadProxies],
  );

  // --- Tunnel operations ---

  const loadTunnels = useCallback(async () => {
    try {
      const next = await invoke<TunnelConfig[]>("get_tunnels");
      setTunnels(next);
    } catch (error) {
      toast.error(String(error));
    }
  }, []);

  useEffect(() => {
    void loadTunnels();
  }, [loadTunnels]);

  const handleSaveTunnel = useCallback(
    async (tunnel: TunnelConfig) => {
      setTunnelSaving(true);
      try {
        const payload = tunnel.id ? tunnel : { ...tunnel, id: crypto.randomUUID() };
        await invoke("save_tunnel", { tunnel: payload });
        await loadTunnels();
        setTunnelDialog(null);
      } catch (error) {
        toast.error(String(error));
      } finally {
        setTunnelSaving(false);
      }
    },
    [loadTunnels],
  );

  const handleDeleteTunnel = useCallback(
    async (tunnelId: string) => {
      try {
        await invoke("delete_tunnel", { tunnelId });
        await loadTunnels();
      } catch (error) {
        toast.error(String(error));
      }
    },
    [loadTunnels],
  );

  const handleToggleTunnel = useCallback(
    async (tunnelId: string, open: boolean) => {
      try {
        await invoke(open ? "open_tunnel" : "close_tunnel", { tunnelId });
        await loadTunnels();
      } catch (error) {
        toast.error(String(error));
      }
    },
    [loadTunnels],
  );

  return (
    <aside
      className="flex h-full flex-col overflow-hidden"
      style={{ backgroundColor: "var(--df-bg-panel)" }}
    >
      <PanelHeader
        title={t("panel.network")}
        actions={
          <span className="text-[0.6875rem]" style={{ color: "var(--df-text-dimmed)" }}>
            {activeTab === "tunnel" ? tunnels.length : proxies.length}
          </span>
        }
      />

      <div className="flex-1 overflow-y-auto p-3 terminal-scroll">
        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as NetworkTab)}
          className="w-full"
        >
          <TabsList className="grid h-8 w-full grid-cols-2">
            <TabsTrigger value="tunnel" className="text-xs">
              {t("network.tunnels")}
            </TabsTrigger>
            <TabsTrigger value="proxy" className="text-xs">
              {t("network.proxy")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tunnel" className="mt-3">
            <div className="space-y-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="font-medium text-sm">{t("network.tunnelConfig")}</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-primary text-xs"
                    onClick={() => setTunnelDialog("new")}
                    disabled={savedConnections.length === 0}
                    title={
                      savedConnections.length === 0 ? t("network.bindConnectionFirst") : undefined
                    }
                  >
                    <MdAdd className="text-base mr-1" />
                    {t("network.newTunnel")}
                  </Button>
                </div>

                <div className="border rounded-md overflow-hidden">
                  {tunnels.length === 0 ? (
                    <EmptyState
                      icon={MdLan}
                      title={
                        savedConnections.length === 0
                          ? t("network.noConnections")
                          : t("network.noTunnels")
                      }
                      description={
                        savedConnections.length === 0
                          ? t("network.noConnectionsHint")
                          : t("network.tunnelEmptyHint")
                      }
                    />
                  ) : (
                    tunnels.map((tunnel, index) => (
                      <div
                        key={tunnel.id}
                        className={cn(index < tunnels.length - 1 ? "border-b" : undefined)}
                      >
                        <TunnelRow
                          tunnel={tunnel}
                          connectionOption={
                            tunnel.connection_id
                              ? connectionOptionMap.get(tunnel.connection_id)
                              : undefined
                          }
                          onEdit={setTunnelDialog}
                          onDelete={handleDeleteTunnel}
                          onToggle={handleToggleTunnel}
                        />
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="proxy" className="mt-3">
            <div className="space-y-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="font-medium text-sm">{t("network.proxyConfig")}</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-primary text-xs"
                    onClick={() => setProxyDialog("new")}
                  >
                    <MdAdd className="text-base mr-1" />
                    {t("network.newProxy")}
                  </Button>
                </div>

                <div className="border rounded-md overflow-hidden">
                  {proxies.length === 0 ? (
                    <EmptyState
                      icon={MdRouter}
                      title={t("network.noProxyConfigs")}
                      description={t("network.proxyEmptyHint")}
                    />
                  ) : (
                    proxies.map((proxy, index) => (
                      <div
                        key={proxy.id}
                        className={cn(index < proxies.length - 1 ? "border-b" : undefined)}
                      >
                        <ProxyRow
                          proxy={proxy}
                          onEdit={setProxyDialog}
                          onDelete={handleDeleteProxy}
                        />
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <ProxyDialog
        open={proxyDialog !== null}
        proxy={proxyDialog && proxyDialog !== "new" ? proxyDialog : null}
        saving={proxySaving}
        onOpenChange={(open) => {
          if (!open) {
            setProxyDialog(null);
          }
        }}
        onSave={handleSaveProxy}
      />

      <TunnelDialog
        open={tunnelDialog !== null}
        tunnel={tunnelDialog && tunnelDialog !== "new" ? tunnelDialog : null}
        connectionOptions={connectionOptions}
        saving={tunnelSaving}
        onOpenChange={(open) => {
          if (!open) {
            setTunnelDialog(null);
          }
        }}
        onSave={handleSaveTunnel}
      />
    </aside>
  );
}
