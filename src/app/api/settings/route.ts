import { NextRequest, NextResponse } from "next/server";
import { expressFetch } from "@/lib/express-client";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("token")?.value;
  if (!token) {
    return NextResponse.json({ status: 0, errmsg: "未登录" }, { status: 401 });
  }

  try {
    const result = await expressFetch("/settings", {
      headers: { authorization: `Bearer ${token}` },
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Settings API error:", error);
    return NextResponse.json(
      { status: 0, errmsg: "获取设置失败" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const token = request.cookies.get("token")?.value;
  if (!token) {
    return NextResponse.json({ status: 0, errmsg: "未登录" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const result = await expressFetch("/settings", {
      method: "PUT",
      headers: { authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Settings PUT error:", error);
    return NextResponse.json(
      { status: 0, errmsg: "更新设置失败" },
      { status: 500 }
    );
  }
}
