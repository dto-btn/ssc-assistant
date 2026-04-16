import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import MarkdownCodeBlock from "./MarkdownCodeBlock";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("MarkdownCodeBlock", () => {
  it("renders block code as a keyboard-focusable pre region", () => {
    render(
      <MarkdownCodeBlock className="language-ts">
        {"const total = 42;\n"}
      </MarkdownCodeBlock>
    );

    const pre = screen.getByLabelText("assistant.code.scrollRegion");
    expect(pre.tagName).toBe("PRE");
    expect(pre).toHaveAttribute("tabIndex", "0");
  });

  it("renders inline code without a focusable pre region", () => {
    render(
      <MarkdownCodeBlock inline className="language-ts">
        {"const total = 42"}
      </MarkdownCodeBlock>
    );

    expect(screen.queryByLabelText("assistant.code.scrollRegion")).not.toBeInTheDocument();
    expect(screen.getByText("const total = 42").tagName).toBe("CODE");
  });
});
