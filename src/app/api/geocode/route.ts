import { NextRequest, NextResponse } from "next/server";

const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";
const USER_AGENT = "TravelTrackerApp/1.0 (travel-trajectory-tracker)";

interface NominatimSearchResult {
  display_name: string;
  lat: string;
  lon: string;
}

interface NominatimReverseResult {
  display_name?: string;
  error?: string;
}

// GET /api/geocode?q=searchterm — Forward geocode (place name → coordinates)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  // Check if this is a reverse geocode request (path: /api/geocode/reverse)
  // Next.js App Router handles this via a separate file, so here we only handle search

  const query = searchParams.get("q");

  if (!query) {
    return NextResponse.json(
      { error: "Missing required query parameter 'q'" },
      { status: 400 },
    );
  }

  try {
    const url = `${NOMINATIM_BASE}/search?q=${encodeURIComponent(query)}&format=json&limit=5`;

    const response = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
      },
      next: { revalidate: 3600 }, // Cache geocoding results for 1 hour
    });

    if (!response.ok) {
      console.error("Nominatim API error:", response.status, response.statusText);
      return NextResponse.json(
        { error: "Geocoding service unavailable" },
        { status: 502 },
      );
    }

    const data: NominatimSearchResult[] = await response.json();

    // Filter to only return needed fields
    const results = data.map((item) => ({
      display_name: item.display_name,
      lat: item.lat,
      lon: item.lon,
    }));

    return NextResponse.json(results);
  } catch (error) {
    console.error("Error geocoding:", error);
    return NextResponse.json(
      { error: "Failed to geocode query" },
      { status: 500 },
    );
  }
}
