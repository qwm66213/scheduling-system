"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (data.status === 1) {
        router.push("/dashboard");
      } else {
        setError(data.errmsg || "登录失败");
      }
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex bg-background">
      {/* 左侧装饰区 */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-sidebar">
        {/* 装饰光晕 */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gold/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-gold-bright/5 rounded-full blur-2xl" />

        {/* 内容 */}
        <div className="relative z-10 flex flex-col justify-center px-16">
          {/* Logo */}
          <div className="mb-12">
            <div className="inline-flex items-center gap-4 mb-6">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-gold to-gold-bright flex items-center justify-center shadow-lg shadow-gold/20">
                <span className="text-2xl font-bold text-white">93</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">930 私房菜</h1>
                <p className="text-sm text-gold-bright/80">运营管理平台</p>
              </div>
            </div>
            <p className="text-sidebar-foreground/60 text-sm leading-relaxed max-w-md">
              数据驱动经营决策，智能化门店管理。
              <br />
              实时掌握营业额、排班、考勤、奖金等核心指标。
            </p>
          </div>

          {/* 特性列表 */}
          <div className="space-y-4">
            {[
              { icon: "📊", text: "经营数据可视化" },
              { icon: "📅", text: "智能排班管理" },
              { icon: "💰", text: "奖金自动核算" },
            ].map((item) => (
              <div
                key={item.text}
                className="flex items-center gap-3 text-sidebar-foreground/80"
              >
                <span className="text-lg">{item.icon}</span>
                <span className="text-sm">{item.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 底部装饰线 */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-gold/40 to-transparent" />
      </div>

      {/* 右侧登录区 */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          {/* 移动端 Logo */}
          <div className="lg:hidden text-center mb-10">
            <div className="inline-flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-gold to-gold-bright flex items-center justify-center">
                <span className="text-xl font-bold text-white">93</span>
              </div>
              <div className="text-left">
                <h1 className="text-xl font-bold text-foreground">930 私房菜</h1>
                <p className="text-xs text-muted-foreground">运营管理平台</p>
              </div>
            </div>
          </div>

          {/* 登录表单 */}
          <div>
            <h2 className="text-xl font-semibold text-foreground mb-1">
              欢迎回来
            </h2>
            <p className="text-sm text-muted-foreground mb-8">
              请输入您的账号信息登录系统
            </p>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* 错误提示 */}
              {error && (
                <div className="p-3.5 text-sm text-destructive bg-destructive/5 border border-destructive/15 rounded-xl">
                  {error}
                </div>
              )}

              {/* 用户名 */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-foreground">
                  用户名
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-4 py-3 bg-card border border-border rounded-xl text-foreground placeholder:text-muted-foreground/50 outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold transition-all"
                  placeholder="请输入用户名"
                  required
                />
              </div>

              {/* 密码 */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-foreground">
                  密码
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 pr-12 bg-card border border-border rounded-xl text-foreground placeholder:text-muted-foreground/50 outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold transition-all"
                    placeholder="请输入密码"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* 登录按钮 */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-gradient-to-r from-gold to-gold-bright text-white rounded-xl font-medium hover:shadow-lg hover:shadow-gold/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    登录中...
                  </span>
                ) : (
                  "登录"
                )}
              </button>
            </form>

            {/* 底部信息 */}
            <p className="mt-8 text-center text-xs text-muted-foreground/50">
              © 2024 930 私房菜 · 运营管理平台
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
