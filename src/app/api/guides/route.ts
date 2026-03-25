import { NextResponse } from "next/server";
import { listGuideHandlers } from "@/lib/guide-library";

export const runtime = "nodejs";

export async function GET() {
  try {
    const guides = await listGuideHandlers();

    return NextResponse.json(guides, {
      headers: {
        "Cache-Control":
          "public, max-age=300, s-maxage=300, stale-while-revalidate=86400",
      },
    });
  } catch (error) {
    console.error("Failed to load guide handlers from R2", error);

    return NextResponse.json(
      { error: "Guide handlers failed to load from R2." },
      { status: 500 },
    );
  }
}
