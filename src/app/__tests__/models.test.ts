import { closingIsEnough, spillBytes, verdict, type Resources } from "../runtime/models";

const GIB = 1024 ** 3;
const pc = (vramFree: number, ramAvailable = 5 * GIB): Resources => ({
  ram_total: 16 * GIB,
  ram_available: ramAvailable,
  gpus: [{ name: "GPU", vram_total: 8 * GIB, vram_used: 8 * GIB - vramFree, vram_free: vramFree }],
  vram_note: null,
});

describe("where a model goes", () => {
  it("fits when the free VRAM holds it with a margin", () => {
    expect(verdict(7.57 * GIB, pc(7.9 * GIB))).toBe("fits");
    expect(spillBytes(7.57 * GIB, pc(7.9 * GIB))).toBe(0);
  });

  it("offloads when it spills into RAM that is free", () => {
    expect(verdict(7.57 * GIB, pc(3.57 * GIB, 10 * GIB))).toBe("offload");
    expect(spillBytes(7.57 * GIB, pc(3.57 * GIB)) / GIB).toBeCloseTo(4.25, 2);
  });

  it("warns on the author's PC as measured on 2026-11-10", () => {
    // 3.57 GiB of VRAM and 4.94 GiB of RAM free: spilling 4.25 GiB would leave the system under 1 GiB
    expect(verdict(7.57 * GIB, pc(3.57 * GIB, 4.94 * GIB))).toBe("too-big");
  });

  it("is too big when not even RAM, keeping 2 GiB for the system, holds the rest", () => {
    expect(verdict(7.57 * GIB, pc(1 * GIB, 6 * GIB))).toBe("too-big");
  });

  it("can't tell without a readable GPU", () => {
    expect(verdict(GIB, { ...pc(GIB), gpus: [], vram_note: "NVML unavailable" })).toBe("unknown");
  });

  it("says which program alone frees enough room", () => {
    const python = { pid: 1, name: "python", bytes: 3.4 * GIB, system: false };
    const chrome = { pid: 2, name: "chrome", bytes: 0.17 * GIB, system: false };
    // The author's PC: 3.4 GiB free for a 7.3 GiB load
    expect(closingIsEnough(7.3 * GIB, 3.4 * GIB, python)).toBe(false);
    expect(closingIsEnough(7.3 * GIB, 3.4 * GIB, { ...python, bytes: 4.3 * GIB })).toBe(true);
    expect(closingIsEnough(7.3 * GIB, 3.4 * GIB, chrome)).toBe(false);
    // Nothing to close when it already fits
    expect(closingIsEnough(3 * GIB, 7 * GIB, python)).toBe(false);
  });
});
