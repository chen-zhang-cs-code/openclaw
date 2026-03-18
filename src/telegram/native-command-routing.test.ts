import { describe, expect, it } from "vitest";
import { extractTelegramNativeCommandToken } from "./native-command-routing.js";

describe("extractTelegramNativeCommandToken", () => {
  it("strips the matching @bot username from the leading command token", () => {
    expect(
      extractTelegramNativeCommandToken({
        text: "/skill@OpenClaw_Bot summarize this",
        botUsername: "openclaw_bot",
      }),
    ).toBe("skill");
  });

  it("preserves raw aliases instead of canonicalizing through normalizeCommandBody", () => {
    expect(
      extractTelegramNativeCommandToken({
        text: "/t high",
        botUsername: "openclaw_bot",
      }),
    ).toBe("t");
  });

  it("keeps unmatched bot mentions as part of the token", () => {
    expect(
      extractTelegramNativeCommandToken({
        text: "/skill@OtherBot summarize this",
        botUsername: "openclaw_bot",
      }),
    ).toBe("skill@otherbot");
  });
});
