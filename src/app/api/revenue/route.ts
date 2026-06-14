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
    const result = await expressFetch(`/revenue?${query}`, {
      headers: { authorization: `Bearer ${token}` },
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Revenue API error:", error);
    return NextResponse.json(
      { status: 0, errmsg: "获取营业额数据失败" },
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
    const result = await expressFetch("/revenue", {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Revenue POST error:", error);
    return NextResponse.json(
      { status: 0, errmsg: "创建营业额记录失败" },
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
    const { id, ...updateData } = body;
    const result = await expressFetch(`/revenue/${id}`, {
      method: "PUT",
      headers: { authorization: `Bearer ${token}` },
      body: JSON.stringify(updateData),
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Revenue PUT error:", error);
    return NextResponse.json(
      { status: 0, errmsg: "更新营业额记录失败" },
      { status: 500 }
    );
  }
}
