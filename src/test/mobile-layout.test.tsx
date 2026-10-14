import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { MasterAdminLayout } from "@/components/MasterAdminLayout";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ isMasterAdmin: true, masterAdminLoading: false, signOut: vi.fn() }),
}));
vi.mock("@/components/PlatformLogo", () => ({ PlatformLogo: () => <span>Logo</span> }));
vi.mock("@/components/BrandName", () => ({ BrandName: () => <span>ThirdEye</span> }));

afterEach(cleanup);

describe("mobile layout safeguards", () => {
  it("opens administration navigation and closes it after selecting a page", () => {
    render(<MemoryRouter><MasterAdminLayout><h1>Users</h1></MasterAdminLayout></MemoryRouter>);
    const toggle = screen.getByRole("button", { name: "Toggle administration menu" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(screen.getByRole("link", { name: "Organisations" }));
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  it("constrains long dialogs to the dynamic viewport and enables internal scrolling", () => {
    render(<Dialog open><DialogContent><DialogTitle>Edit zone</DialogTitle><p>Long form</p></DialogContent></Dialog>);
    const dialog = screen.getByRole("dialog");
    expect(dialog.className).toContain("max-h-[calc(100dvh-2rem)]");
    expect(dialog.className).toContain("w-[calc(100%-2rem)]");
    expect(dialog.className).toContain("overflow-y-auto");
  });

  it("keeps wide tables in a keyboard-accessible local scroll region", () => {
    render(<Table><TableBody><TableRow><TableCell>Sensor data</TableCell></TableRow></TableBody></Table>);
    const region = screen.getByRole("region", { name: "Scrollable table" });
    expect(region).toHaveAttribute("tabindex", "0");
    expect(region.className).toContain("overflow-x-auto");
    expect(region.className).toContain("min-w-0");
  });
});