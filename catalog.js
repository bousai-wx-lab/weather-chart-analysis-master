"use strict";
const ChartCatalog = (() => {
  const hash = /^[a-f0-9]{64}$/;
  function validate(data) {
    if (!data || data.schema_version !== 1 || data.refresh !== "none" || !Number.isFinite(Date.parse(data.compiled_at)) || !Array.isArray(data.products) || !data.products.length || data.products.length > 100) throw Error("Invalid chart catalog");
    const ids = new Set(), drawings = new Set();
    for (const product of data.products) {
      if (!/^[a-z0-9-]+$/.test(product.id) || ids.has(product.id) || !["observation", "forecast"].includes(product.group) || typeof product.code !== "string" || typeof product.name !== "string" || !product.name || !Array.isArray(product.variants) || !product.variants.length) throw Error("Invalid chart product");
      ids.add(product.id);
      const variants = new Set();
      for (const variant of product.variants) {
        const source = new URL(variant.source_url);
        if (!/^[a-z0-9-]+$/.test(variant.id) || variants.has(variant.id) || typeof variant.label !== "string" || !hash.test(variant.source_sha256) || !Number.isFinite(Date.parse(variant.retrieved_at)) || source.protocol !== "https:" || source.username || source.password || !["www.jma.go.jp", "www.data.jma.go.jp"].includes(source.hostname) || !/\.(pdf|png)$/.test(source.pathname) || !["manual", "reviewed-aupq35", "reviewed-aupq78"].includes(variant.features) || !Array.isArray(variant.pages) || !variant.pages.length || variant.pages.length > 12) throw Error("Invalid chart source");
        variants.add(variant.id);
        for (const [index, page] of variant.pages.entries()) {
          if (page.number !== index + 1 || !hash.test(page.image_sha256) || !/^assets\/(charts\/[a-z0-9-]+|aupq35)\.png$/.test(page.image_path) || !Number.isInteger(page.width) || !Number.isInteger(page.height) || page.width < 200 || page.height < 200 || page.width > 8192 || page.height > 12288 || page.width * page.height > 40000000) throw Error("Invalid chart image");
          const key = `${product.id}/${variant.id}/${page.number}`;
          if (drawings.has(key)) throw Error("Duplicate chart drawing");
          drawings.add(key);
          if (variant.features === "reviewed-aupq78" && (product.id !== "aupq78" || variant.id !== "aupq78-00" || variant.source_sha256 !== "58be2c8fd8bcc5b27c87a8fa748869a2145ca7d8403a9ecdc3ce586cfc95f249" || page.image_sha256 !== "a45b011b2c5329b4f3c2dabd035ef7daac90669fb08d848974cf95852321382c" || variant.pages.length !== 1)) throw Error("Analysis belongs to a different chart");
          if (variant.features === "reviewed-aupq35" && (product.id !== "aupq35" || variant.id !== "aupq35-reviewed" || page.image_path !== "assets/aupq35.png" || variant.pages.length !== 1)) throw Error("Analysis belongs to a different chart");
        }
      }
    }
    return data;
  }
  function selection(catalog, productId, variantId, pageNumber) {
    const product = catalog.products.find(p => p.id === productId);
    const variant = product?.variants.find(v => v.id === variantId);
    const page = variant?.pages.find(p => p.number === pageNumber);
    if (!page) throw Error("Unknown chart selection");
    return { product, variant, page, key: `${product.id}/${variant.id}/${page.number}` };
  }
  return { validate, selection };
})();
if (typeof module !== "undefined") module.exports = ChartCatalog;
