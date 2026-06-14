import { NextRequest, NextResponse } from "next/server";
import { expressFetch } from "@/lib/express-client";

export async function POST(request: NextRequest) {
  try {
    const refreshToken = request.cookies.get("refreshToken")?.value;

    if (!refreshToken) {
      return NextResponse.json(
        { status: 0, errmsg: "无刷新令牌" },
        { status: 401 }
      );
    }

    const result = await expressFetch<{
      status: number;
      errmsg?: string;
      data?: { token: string; refreshToken: string };
    }>("/auth/refresh-token", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    });

    if (result.status !== 1 || !result.data) {
      return NextResponse.json(
        { status: 0, errmsg: result.errmsg || "刷新失败" },
        { status: 401 }
      );
    }

    const response = NextResponse.json({ status: 1 });

    response.cookies.set("token", result.data.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60,
      path: "/",
    });

    response.cookies.set("refreshToken", result.data.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Refresh token error:", error);
    return NextResponse.json(
      { status: 0, errmsg: "刷新服务异常" },
      { status: 500 }
    );
  }
}
