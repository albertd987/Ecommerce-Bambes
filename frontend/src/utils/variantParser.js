// src/utils/variantParser.js

/**
 * Parseja el SKU per extreure talla i color
 * Format: BRAND-PRODUCT-PARTS-SIZE-COLOR
 * Exemple: ASICS-ASICS-GEL-KAYANO-31-41-NEGRE
 */
export function parseVariantSku(sku) {
  const parts = sku.split('-')
  
  // Els dos últims elements són SIZE i COLOR
  const size = parts[parts.length - 2]
  const color = parts[parts.length - 1]
  
  return { size, color }
}

/**
 * Organitza les variants per talla i color
 */
export function organizeVariants(variants) {
  const sizes = new Set()
  const colors = new Set()
  const variantMap = new Map()
  
  variants.forEach(variant => {
    const { size, color } = parseVariantSku(variant.sku)
    sizes.add(size)
    colors.add(color)
    
    // Clau única per size+color
    const key = `${size}-${color}`
    variantMap.set(key, variant)
  })
  
  return {
    sizes: Array.from(sizes).sort((a, b) => Number(a) - Number(b)),
    colors: Array.from(colors),
    variantMap
  }
}

/**
 * Troba la variant segons talla i color seleccionats
 */
export function findVariant(variantMap, size, color) {
  if (!size || !color) return null
  const key = `${size}-${color}`
  return variantMap.get(key) || null
}

/**
 * Organize the `colors` array returned by the new API.
 *
 * Input: colors array from API:
 * [{ name: 'BLANC', images: [...], sizes: [{ size: '41', stock_status: '...', variant_id: 5 }] }]
 *
 * Output:
 * {
 *   colorNames: ['BLANC', 'NEGRE'],          // ordered as returned
 *   sizesByColor: { BLANC: ['41','42'], ... }, // sizes available per color
 *   variantMap: Map('BLANC|41' → sizeData),   // for fast lookup
 *   imagesByColor: { BLANC: ['url1', ...], }  // images per color
 * }
 */
export function organizeColors(colors) {
  if (!colors || !Array.isArray(colors) || colors.length === 0) {
    return { colorNames: [], sizesByColor: {}, variantMap: new Map(), imagesByColor: {} }
  }

  const colorNames    = colors.map((c) => c.name)
  const sizesByColor  = {}
  const variantMap    = new Map()
  const imagesByColor = {}

  for (const color of colors) {
    sizesByColor[color.name]  = (color.sizes ?? []).map((s) => s.size)
    imagesByColor[color.name] = color.images ?? []

    for (const sizeData of color.sizes ?? []) {
      variantMap.set(`${color.name}|${sizeData.size}`, sizeData)
    }
  }

  return { colorNames, sizesByColor, variantMap, imagesByColor }
}

/**
 * Find a variant given a color and size.
 * Returns an object compatible with legacy variant shape: { id, stock_status, size }
 */
export function findColorVariant(variantMap, colorName, size) {
  const data = variantMap.get(`${colorName}|${size}`) ?? null
  if (!data) return null
  return { id: data.variant_id, stock_status: data.stock_status, size: data.size }
}