export async function GET() {
  const api = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "");
  if (!api) return Response.json({ status: "not-configured" }, { status: 503 });
  try {
    const response = await fetch(`${api}/health/live`, { cache: "no-store" });
    return Response.json({ status: response.ok ? "connected" : "unavailable" }, { status: response.ok ? 200 : 503 });
  } catch {
    return Response.json({ status: "unavailable" }, { status: 503 });
  }
}
