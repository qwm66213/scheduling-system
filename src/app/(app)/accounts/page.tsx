"use client";

import { useState, useEffect } from "react";
import { PageHeading } from "@/components/layout/page-heading";
import { STORES } from "@/lib/stores";

interface User {
  id: string;
  username: string;
  role: string;
  real_name?: string;
  store_id?: number;
  is_active: boolean;
}

export default function AccountsPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    role: "operator",
    store_id: "",
    real_name: "",
  });
  const [message, setMessage] = useState("");

  // 加载用户列表
  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/users");
      const data = await res.json();
      if (data.status === 1) {
        setUsers(data.data || []);
      }
    } catch {
      console.error("获取用户列表失败");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // 创建用户
  const handleCreate = async () => {
    setMessage("");
    try {
      const res = await fetch("/api/auth/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (data.status === 1) {
        setMessage("创建成功");
        setShowForm(false);
        setFormData({
          username: "",
          password: "",
          role: "operator",
          store_id: "",
          real_name: "",
        });
        fetchUsers();
      } else {
        setMessage(data.errmsg || "创建失败");
      }
    } catch {
      setMessage("创建失败");
    }
  };

  return (
    <div>
      <PageHeading
        title="账号管理"
        subtitle="管理系统账号和权限"
        actions={
          <button
            onClick={() => setShowForm(!showForm)}
            className="h-9 px-4 bg-gold text-white rounded-lg text-sm font-medium hover:bg-gold-bright transition-colors"
          >
            {showForm ? "取消" : "新建账号"}
          </button>
        }
      />

      {/* 新建表单 */}
      {showForm && (
        <div className="bg-card border border-border rounded-xl p-6 mb-6">
          <h3 className="font-display text-lg text-foreground mb-4">
            新建账号
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-lg">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">
                用户名
              </label>
              <input
                type="text"
                value={formData.username}
                onChange={(e) =>
                  setFormData({ ...formData, username: e.target.value })
                }
                className="w-full h-9 px-3 border border-border rounded-lg bg-secondary text-foreground outline-none focus:border-gold"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">
                密码
              </label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                className="w-full h-9 px-3 border border-border rounded-lg bg-secondary text-foreground outline-none focus:border-gold"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">
                姓名
              </label>
              <input
                type="text"
                value={formData.real_name}
                onChange={(e) =>
                  setFormData({ ...formData, real_name: e.target.value })
                }
                className="w-full h-9 px-3 border border-border rounded-lg bg-secondary text-foreground outline-none focus:border-gold"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">
                角色
              </label>
              <select
                value={formData.role}
                onChange={(e) =>
                  setFormData({ ...formData, role: e.target.value })
                }
                className="w-full h-9 px-3 border border-border rounded-lg bg-secondary text-foreground outline-none focus:border-gold"
              >
                <option value="operator">操作员</option>
                <option value="admin">管理员</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">
                门店
              </label>
              <select
                value={formData.store_id}
                onChange={(e) =>
                  setFormData({ ...formData, store_id: e.target.value })
                }
                className="w-full h-9 px-3 border border-border rounded-lg bg-secondary text-foreground outline-none focus:border-gold"
              >
                <option value="">全部门店</option>
                {STORES.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {message && (
            <div className="mt-4 text-sm text-destructive">{message}</div>
          )}
          <button
            onClick={handleCreate}
            className="mt-4 h-9 px-4 bg-gold text-white rounded-lg text-sm font-medium hover:bg-gold-bright transition-colors"
          >
            创建
          </button>
        </div>
      )}

      {/* 用户列表 */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-6 border-b border-border">
          <h3 className="font-display text-xl text-foreground">用户列表</h3>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-muted-foreground">
            加载中...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border hover:bg-transparent">
                  <th className="text-left p-4 font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                    用户名
                  </th>
                  <th className="text-left p-4 font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                    姓名
                  </th>
                  <th className="text-left p-4 font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                    角色
                  </th>
                  <th className="text-left p-4 font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                    门店
                  </th>
                  <th className="text-left p-4 font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                    状态
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b border-border hover:bg-gold/[0.04] transition-colors"
                  >
                    <td className="p-4 font-medium">{user.username}</td>
                    <td className="p-4 text-muted-foreground">
                      {user.real_name || "--"}
                    </td>
                    <td className="p-4">
                      <span
                        className={`text-xs border rounded px-2 py-0.5 ${
                          user.role === "admin"
                            ? "border-gold/40 text-gold-bright bg-gold-soft"
                            : "border-border text-muted-foreground"
                        }`}
                      >
                        {user.role === "admin" ? "管理员" : "操作员"}
                      </span>
                    </td>
                    <td className="p-4 text-muted-foreground">
                      {STORES.find((s) => s.id === user.store_id)?.name ||
                        "全部门店"}
                    </td>
                    <td className="p-4">
                      <span
                        className={`text-xs ${
                          user.is_active
                            ? "text-success"
                            : "text-destructive"
                        }`}
                      >
                        {user.is_active ? "启用" : "禁用"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
