import { NextRequest, NextResponse } from "next/server";
import { expressFetch } from "@/lib/express-client";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const result = await expressFetch<{
      status: number;
      errmsg?: string;
      data?: {
        user: unknown;
        token: string;
        refreshToken: string;
      };
    }>("/auth/login", {
      method: "POST",
      body: JSON.stringify(body),
    });

    if (result.status !== 1 || !result.data) {
      return NextResponse.json(
        { status: 0, errmsg: result.errmsg || "登录失败" },
        { status: 401 }
      );
    }

    const { user, token, refreshToken } = result.data;

    // 设置 httpOnly cookie
    const response = NextResponse.json({
      status: 1,
      data: { user },
    });

    response.cookies.set("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60, // 24 小时
      path: "/",
    });

    response.cookies.set("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60, // 7 天
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Login API error:", error);
    return NextResponse.json(
      { status: 0, errmsg: "登录服务异常" },
      { status: 500 }
    );
  }
}
