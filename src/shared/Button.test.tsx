import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Button from "./Button";

describe("Button", () => {
  it("applies the requested semantic action variant", () => {
    render(
      <>
        <Button variant="primary">Save</Button>
        <Button variant="secondary">Cancel</Button>
        <Button variant="danger">Delete</Button>
      </>,
    );

    expect(screen.getByRole("button", { name: "Save" })).toHaveClass(
      "bg-slate-900",
    );
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveClass(
      "bg-white",
    );
    expect(screen.getByRole("button", { name: "Delete" })).toHaveClass(
      "bg-rose-50",
    );
  });
});
