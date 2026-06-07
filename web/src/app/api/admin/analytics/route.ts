import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/server/adminAuth";
import { fetchAnalyticsDashboard } from "@/lib/server/fetchAnalytics";

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = await fetchAnalyticsDashboard();
    return NextResponse.json(data);
  } catch (err) {
    console.error("[admin/analytics]", err);
    return NextResponse.json({ error: "Failed to load analytics" }, { status: 500 });
  }
}
