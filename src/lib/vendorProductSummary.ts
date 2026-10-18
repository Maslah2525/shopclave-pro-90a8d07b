export function vendorProductSummary(products: readonly { status: string | null; stock: number | null }[]) {
  const active = products.filter(product => product.status === "active").length;
  return {
    total: products.length,
    active,
    inactive: products.length - active,
    drafts: products.filter(product => product.status === "draft").length,
    outOfStock: products.filter(product => product.stock !== null && product.stock <= 0).length,
  };
}