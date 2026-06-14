"use client";

import { useState, useEffect } from "react";
import { PageHeading } from "@/components/layout/page-heading";
import { useAppStore } from "@/stores/app-store";

export default function SettingsPage() {
  const selectedStoreId = useAppStore((s) => s.selectedStoreId);

  const [settings, setSettings] = useState({
    front_efficiency: 2800,
    back_efficiency: 2200,
    front_bonus_ratio: "10%",
    back_bonus_ratio: "12%",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");

  // 加载设置
  useEffect(() => {
    const fetchSettings = async () => {
      setIsLoading(true);
      try {
        const res = await fetch("/api/settings");
        const data = await res.json();
        if (data.status === 1 && data.data) {
          setSettings(data.data);
        }
      } catch {
        console.error("获取设置失败");
      } finally {
        setIsLoading(false);
      }
    };
    fetchSettings();
  }, [selectedStoreId]);

  // 保存设置
  const handleSave = async () => {
    setIsSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (data.status === 1) {
        setMessage("保存成功");
      } else {
        setMessage(data.errmsg || "保存失败");
      }
    } catch {
      setMessage("保存失败");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div>
      <PageHeading title="设置" subtitle="配置人效标准和奖金比例" />

      <div className="bg-card border border-border rounded-xl p-6">
        <h3 className="font-display text-xl text-foreground mb-6">
          人效标准配置
        </h3>

        {isLoading ? (
          <div className="text-center text-muted-foreground py-8">
            加载中...
          </div>
        ) : (
          <div className="space-y-6 max-w-md">
            {/* 前厅人效 */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">
                前厅人效标准（元/人）
              </label>
              <input
                type="number"
                value={settings.front_efficiency}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    front_efficiency: Number(e.target.value),
                  })
                }
                className="w-full h-10 px-3 border border-border rounded-lg bg-secondary text-foreground outline-none focus:border-gold"
              />
            </div>

            {/* 后厨人效 */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">
                后厨人效标准（元/人）
              </label>
              <input
                type="number"
                value={settings.back_efficiency}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    back_efficiency: Number(e.target.value),
                  })
                }
                className="w-full h-10 px-3 border border-border rounded-lg bg-secondary text-foreground outline-none focus:border-gold"
              />
            </div>

            {/* 前厅奖金比例 */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">
                前厅奖金比例
              </label>
              <input
                type="text"
                value={settings.front_bonus_ratio}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    front_bonus_ratio: e.target.value,
                  })
                }
                className="w-full h-10 px-3 border border-border rounded-lg bg-secondary text-foreground outline-none focus:border-gold"
                placeholder="例如：10%"
              />
            </div>

            {/* 后厨奖金比例 */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">
                后厨奖金比例
              </label>
              <input
                type="text"
                value={settings.back_bonus_ratio}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    back_bonus_ratio: e.target.value,
                  })
                }
                className="w-full h-10 px-3 border border-border rounded-lg bg-secondary text-foreground outline-none focus:border-gold"
                placeholder="例如：12%"
              />
            </div>

            {/* 消息提示 */}
            {message && (
              <div
                className={`text-sm ${
                  message === "保存成功"
                    ? "text-success"
                    : "text-destructive"
                }`}
              >
                {message}
              </div>
            )}

            {/* 保存按钮 */}
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="h-10 px-6 bg-gold text-white rounded-lg font-medium hover:bg-gold-bright transition-colors disabled:opacity-50"
            >
              {isSaving ? "保存中..." : "保存设置"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
