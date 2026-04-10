import { NextRequest, NextResponse } from "next/server";

const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";
const USER_AGENT = "LoveTracksApp/1.0 (romantic-travel-tracker)";

interface NominatimReverseResult {
  display_name?: string;
  error?: string;
}

// GET /api/geocode/reverse?lat=x&lng=y — Reverse geocode (coordinates → place name)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");

  if (!lat || !lng) {
    return NextResponse.json(
      { error: "Missing required query parameters 'lat' and 'lng'" },
      { status: 400 },
    );
  }

  // Validate numeric values
  const latNum = parseFloat(lat);
  const lngNum = parseFloat(lng);

  if (isNaN(latNum) || latNum < -90 || latNum > 90) {
    return NextResponse.json(
      { error: "Invalid latitude value. Must be a number between -90 and 90." },
      { status: 400 },
    );
  }

  if (isNaN(lngNum) || lngNum < -180 || lngNum > 180) {
    return NextResponse.json(
      { error: "Invalid longitude value. Must be a number between -180 and 180." },
      { status: 400 },
    );
  }

  try {
    const url = `${NOMINATIM_BASE}/reverse?lat=${latNum}&lon=${lngNum}&format=json`;

    const response = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
      },
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      console.error("Nominatim reverse API error:", response.status, response.statusText);
      return NextResponse.json(
        { error: "Reverse geocoding service unavailable" },
        { status: 502 },
      );
    }

    const data: NominatimReverseResult = await response.json();

    if (data.error || !data.display_name) {
      return NextResponse.json(
        { display_name: "Unknown location" },
        { status: 200 },
      );
    }

    return NextResponse.json({ display_name: data.display_name });
  } catch (error) {
    console.error("Error reverse geocoding:", error);
    return NextResponse.json(
      { error: "Failed to reverse geocode coordinates" },
      { status: 500 },
    );
  }
}
