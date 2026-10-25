export type CategoryChild = { id: string };

/** Walk every depth, paging each batch so large category trees are not truncated. */
export async function collectCategoryIds(
  rootId: string,
  fetchChildren: (parentIds: string[], offset: number, limit: number) => Promise<CategoryChild[]>,
): Promise<string[]> {
  const seen = new Set([rootId]);
  let parents = [rootId];
  const pageSize = 1000;
  while (parents.length) {
    const next: string[] = [];
    for (let start = 0; start < parents.length; start += 100) {
      const batch = parents.slice(start, start + 100);
      for (let offset = 0; ; offset += pageSize) {
        const children = await fetchChildren(batch, offset, pageSize);
        for (const child of children) {
          if (seen.has(child.id)) continue;
          seen.add(child.id);
          next.push(child.id);
        }
        if (children.length < pageSize) break;
      }
    }
    parents = next;
  }
  return [...seen];
}

export function categoryBrowsePath(slug: string, newArrivals = false): string {
  return `/category/${encodeURIComponent(slug)}${newArrivals ? "?arrivals=1" : ""}`;
}