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