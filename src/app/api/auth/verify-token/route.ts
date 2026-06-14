import { NextRequest, NextResponse } from "next/server";
import { expressFetch } from "@/lib/express-client";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("token")?.value;
  if (!token) {
    return NextResponse.json({ status: 0, errmsg: "未登录" }, { status: 401 });
  }

  try {
    const result = await expressFetch("/auth/verify-token", {
      headers: { authorization: `Bearer ${token}` },
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Verify token error:", error);
    return NextResponse.json(
      { status: 0, errmsg: "验证失败" },
      { status: 401 }
    );
  }
}
