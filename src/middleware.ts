import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// 后端服务地址
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3001";

// 缓存已验证的 token，避免重复验证
const verifiedTokens = new Map<string, { valid: boolean; expires: number }>();
const CACHE_DURATION = 60 * 1000; // 60 秒缓存

export async function middleware(request: NextRequest) {
  const token = request.cookies.get("token")?.value;
  const pathname = request.nextUrl.pathname;

  // 登录页不需要认证
  if (pathname === "/login" || pathname.startsWith("/login")) {
    return NextResponse.next();
  }

  // 根路径重定向到 dashboard
  if (pathname === "/") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // 静态资源和 _next 路径不需要认证
  if (
    pathname.startsWith("/_next") ||
    pathname.includes("/static/") ||
    pathname.match(/\.(js|css|ico|png|jpg|svg|woff|woff2)$/)
  ) {
    return NextResponse.next();
  }

  // API 路由中的登录和刷新接口不需要认证
  if (
    pathname.startsWith("/api/auth/login") ||
    pathname.startsWith("/api/auth/refresh")
  ) {
    return NextResponse.next();
  }

  // 未登录或 token 不存在 → 重定向到登录页
  if (!token) {
    // API 路由返回 401
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { status: 0, errmsg: "未登录" },
        { status: 401 }
      );
    }
    // 页面路由重定向到登录页
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // 检查缓存中是否已有验证结果
  const cached = verifiedTokens.get(token);
  if (cached && Date.now() < cached.expires) {
    if (!cached.valid) {
      // Token 无效（缓存）
      const response = pathname.startsWith("/api/")
        ? NextResponse.json({ status: 0, errmsg: "Token 无效" }, { status: 401 })
        : NextResponse.redirect(new URL("/login", request.url));

      response.cookies.set("token", "", { expires: new Date(0), path: "/" });
      return response;
    }
    // Token 有效（缓存），直接放行
    return NextResponse.next();
  }

  // 验证 token 是否有效（调用后端验证）
  try {
    const verifyRes = await fetch(`${BACKEND_URL}/api/auth/verify-token`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const verifyData = await verifyRes.json();

    const isValid = verifyData.status === 1 && verifyData.data?.user;

    // 缓存验证结果
    verifiedTokens.set(token, {
      valid: isValid,
      expires: Date.now() + CACHE_DURATION,
    });

    if (!isValid) {
      // Token 无效，清除 cookie 并重定向到登录页
      const response = pathname.startsWith("/api/")
        ? NextResponse.json({ status: 0, errmsg: "Token 无效" }, { status: 401 })
        : NextResponse.redirect(new URL("/login", request.url));

      response.cookies.set("token", "", { expires: new Date(0), path: "/" });
      return response;
    }
  } catch (error) {
    // 验证失败，重定向到登录页
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { status: 0, errmsg: "验证失败" },
        { status: 401 }
      );
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * 匹配所有路径，除了：
     * - _next/static（静态文件）
     * - _next/image（图片优化）
     * - favicon.ico
     * - 静态资源（svg、png、jpg 等）
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
