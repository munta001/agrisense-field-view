import { StrictMode, type ReactNode } from "react";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAlertNotifications } from "@/hooks/use-alert-notifications";

const state = vi.hoisted(() => ({ orgId: "org-a" }));
const realtime = vi.hoisted(() => {
  type Channel = {
    subscribed: boolean;
    callback?: () => void;
    filter?: string;
    on: ReturnType<typeof vi.fn>;
    subscribe: ReturnType<typeof vi.fn>;
  };
  const channels = new Map<string, Channel>();
  const channel = vi.fn((name: string) => {
    const existing = channels.get(name);
    if (existing) return existing;
    const result: Channel = {
      subscribed: false,
      on: vi.fn((_event, config, callback) => {
        if (result.subscribed) throw new Error("cannot add callbacks after subscribe()");
        result.filter = config.filter;
        result.callback = callback;
        return result;
      }),
      subscribe: vi.fn(() => { result.subscribed = true; return result; }),
    };
    channels.set(name, result);
    return result;
  });
  // Retain channels to simulate asynchronous removal overlapping the next mount.
  const removeChannel = vi.fn(async () => "ok");
  const eq = vi.fn();
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  return { channels, channel, removeChannel, eq, from };
});

vi.mock("@/contexts/OrgContext", () => ({ useOrg: () => ({ currentOrg: { id: state.orgId } }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: realtime }));

let client: QueryClient;
function Wrapper({ children }: { children: ReactNode }) {
  return <StrictMode><QueryClientProvider client={client}>{children}</QueryClientProvider></StrictMode>;
}

beforeEach(() => {
  vi.clearAllMocks();
  realtime.channels.clear();
  state.orgId = "org-a";
  realtime.eq.mockImplementation((column: string) => column === "org_id" ? { eq: realtime.eq } : Promise.resolve({ count: 3, error: null }));
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
afterEach(() => { cleanup(); client.clear(); });

describe("alert notification subscriptions", () => {
  it("supports simultaneous sidebar and page consumers and StrictMode remounts", async () => {
    const hook = renderHook(() => [useAlertNotifications(), useAlertNotifications()], { wrapper: Wrapper });
    await waitFor(() => expect(hook.result.current.map(item => item.unreadCount)).toEqual([3, 3]));
    const names = realtime.channel.mock.calls.map(([name]) => name);
    expect(names.length).toBe(4);
    expect(new Set(names).size).toBe(4);
    hook.unmount();
    expect(realtime.removeChannel).toHaveBeenCalledTimes(4);
    for (const channel of realtime.channels.values()) {
      expect(realtime.removeChannel).toHaveBeenCalledWith(channel);
    }
  });

  it("invalidates the shared organisation count when an alert changes", async () => {
    const hook = renderHook(useAlertNotifications, { wrapper: Wrapper });
    await waitFor(() => expect(hook.result.current.unreadCount).toBe(3));
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const channel = [...realtime.channels.values()].at(-1);
    expect(channel?.filter).toBe("org_id=eq.org-a");
    expect(channel?.callback).toBeTypeOf("function");
    act(() => channel?.callback?.());
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["unread-alerts", "org-a"] });
  });

  it("cleans up the previous organisation channel when switching organisations", () => {
    const hook = renderHook(useAlertNotifications, { wrapper: Wrapper });
    const previous = [...realtime.channels.values()].at(-1);
    state.orgId = "org-b";
    hook.rerender();
    expect(realtime.removeChannel).toHaveBeenCalledWith(previous);
    expect([...realtime.channels.values()].at(-1)?.filter).toBe("org_id=eq.org-b");
  });
});