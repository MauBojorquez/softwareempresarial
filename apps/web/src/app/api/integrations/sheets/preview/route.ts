import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { fetchSheetGrid } from "@/lib/google-sheets";

const MAX_ROWS = 60;
const MAX_COLS = 26;

/** POST /api/integrations/sheets/preview — { url } → returns the grid for cell mapping. */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { url } = (await req.json()) as { url: string };
  if (!url) return NextResponse.json({ error: "URL requerida" }, { status: 400 });

  const result = await fetchSheetGrid(url);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  // Trim to a sane preview size.
  const grid = result.grid.slice(0, MAX_ROWS).map((r) => r.slice(0, MAX_COLS));
  return NextResponse.json({ grid });
}
