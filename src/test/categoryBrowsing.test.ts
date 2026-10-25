import { describe, expect, it } from "vitest";
import { categoryBrowsePath, collectCategoryIds } from "@/lib/categoryBrowsing";

describe("category browsing", () => {
  it("opens the exact category and a separate newest-arrivals view", () => {
    expect(categoryBrowsePath("fashion-clothing")).toBe("/category/fashion-clothing");
    expect(categoryBrowsePath("fashion-clothing", true)).toBe("/category/fashion-clothing?arrivals=1");
  });

  it("includes products assigned to categories beyond three levels", async () => {
    const tree: Record<string, string[]> = { root: ["child"], child: ["grandchild"], grandchild: ["level4"], level4: ["level5"] };
    const ids = await collectCategoryIds("root", async (parents, offset, limit) =>
      parents.flatMap((id) => tree[id] ?? []).slice(offset, offset + limit).map((id) => ({ id })),
    );
    expect(ids).toEqual(["root", "child", "grandchild", "level4", "level5"]);
  });

  it("pages large trees and stops safely if a category cycle is encountered", async () => {
    const children = Array.from({ length: 1001 }, (_, i) => ({ id: `child-${i}` }));
    const ids = await collectCategoryIds("root", async (parents, offset, limit) =>
      parents.includes("root") ? children.slice(offset, offset + limit) : [{ id: "root" }],
    );
    expect(ids).toHaveLength(1002);
    expect(ids).toContain("child-1000");
  });
});