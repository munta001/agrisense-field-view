import { describe, expect, it } from "vitest";
import { alertsForAppliance, canControlAutomation } from "@/lib/automation";

describe("manual controller permissions", () => {
  it("allows admins and operators", () => {
    expect(canControlAutomation("admin")).toBe(true);
    expect(canControlAutomation("operator")).toBe(true);
  });
  it("does not allow viewers or signed-out users", () => {
    expect(canControlAutomation("viewer")).toBe(false);
    expect(canControlAutomation(undefined)).toBe(false);
  });
  it("shows only alerts from the appliance's zone", () => {
    const alerts = [{ id: "a", sensors: { zone_id: "north" } }, { id: "b", sensors: { zone_id: "south" } }, { id: "c", sensors: null }];
    expect(alertsForAppliance(alerts, "north").map(a => a.id)).toEqual(["a"]);
    expect(alertsForAppliance(alerts, null)).toEqual([]);
  });
});