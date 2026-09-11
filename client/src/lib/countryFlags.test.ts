import { describe, expect, it } from "vitest";
import { countryFlag } from "./countryFlags";

describe("flag-icons resolver", () => {
  it("renvoie une classe flag-icons pour un pays racine", () => {
    expect(countryFlag("Italie")).toBe("fi fi-it");
    expect(countryFlag("Tokyo, JP")).toBe("fi fi-jp");
  });
});
