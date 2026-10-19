import { beforeEach, describe, expect, it, vi } from "vitest";
const { query, from } = vi.hoisted(() => {
  const query = { select: vi.fn(), eq: vi.fn(), in: vi.fn(), order: vi.fn(), range: vi.fn() };
  return { query, from: vi.fn(() => query) };
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from } }));
import { fetchAlertPage } from "@/lib/alert-feed";

beforeEach(() => {
  vi.clearAllMocks();
  for (const method of [query.select, query.eq, query.in, query.order]) method.mockReturnValue(query);
  query.range.mockResolvedValue({ data: [], count: 240, error: null });
});
describe("alert feed rules", () => {
  it("can retrieve unread alerts beyond the recent twenty", async () => {
    const result = await fetchAlertPage({ orgId: "farm", unreadOnly: true }, 2);
    expect(query.eq).toHaveBeenCalledWith("org_id", "farm");
    expect(query.eq).toHaveBeenCalledWith("is_read", false);
    expect(query.range).toHaveBeenCalledWith(200, 299);
    expect(result.count).toBe(240);
  });
  it("filters by the selected sensor", async () => {
    await fetchAlertPage({ orgId: "farm", unreadOnly: true, sensorIds: ["sensor-1"] });
    expect(query.in).toHaveBeenCalledWith("sensor_id", ["sensor-1"]);
  });
  it("filters by all sensors belonging to the selected zone", async () => {
    await fetchAlertPage({ orgId: "farm", unreadOnly: true, sensorIds: ["north-1", "north-2"] });
    expect(query.in).toHaveBeenCalledWith("sensor_id", ["north-1", "north-2"]);
  });
  it("returns no alerts for a zone without sensors", async () => {
    expect(await fetchAlertPage({ orgId: "farm", unreadOnly: true, sensorIds: [] })).toEqual({ alerts: [], count: 0 });
    expect(from).not.toHaveBeenCalled();
  });
  it("keeps recent alerts limited to twenty", async () => {
    await fetchAlertPage({ orgId: "farm", unreadOnly: false });
    expect(query.range).toHaveBeenCalledWith(0, 19);
    expect(query.eq).not.toHaveBeenCalledWith("is_read", false);
  });
});