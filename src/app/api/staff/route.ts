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
    const result = await expressFetch(`/staff?${query}`, {
      headers: { authorization: `Bearer ${token}` },
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Staff API error:", error);
    return NextResponse.json(
      { status: 0, errmsg: "获取员工数据失败" },
      { status: 500 }
    );
  }
}
