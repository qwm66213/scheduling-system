import { NextRequest, NextResponse } from "next/server";
import { expressFetch } from "@/lib/express-client";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("token")?.value;
  if (!token) {
    return NextResponse.json({ status: 0, errmsg: "未登录" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.toString();

  try {
    const result = await expressFetch(`/schedule?${query}`, {
      headers: { authorization: `Bearer ${token}` },
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Schedule API error:", error);
    return NextResponse.json(
      { status: 0, errmsg: "获取排班数据失败" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get("token")?.value;
  if (!token) {
    return NextResponse.json({ status: 0, errmsg: "未登录" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const result = await expressFetch("/schedule/batch", {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Schedule POST error:", error);
    return NextResponse.json(
      { status: 0, errmsg: "保存排班数据失败" },
      { status: 500 }
    );
  }
}
