/**
 * Calculates a 4-month ROI based on total investment and monthly income.
 * @param {number} totalInvestment 
 * @param {number} totalMonthlyIncome 
 * @returns {number} The ROI ratio.
 */
export function calculate4MonthROI(totalInvestment, totalMonthlyIncome) {
  if (totalInvestment <= 0) return 0;
  // Retorno a 4 meses = (Ingreso Mensual * 4) / Inversion Total
  return (totalMonthlyIncome * 4) / totalInvestment;
}

/**
 * Suggests packaging options based on available loose eggs and empty containers.
 * @param {number} looseEggs 
 * @param {Array} products Array of product objects with container_stock and egg_count
 * @returns {Array} Array of suggestions { product, possiblePacks }
 */
export function getPackagingSuggestions(looseEggs, products) {
  if (looseEggs <= 0 || !products || products.length === 0) return [];
  
  const suggestions = [];
  
  products.forEach(p => {
    if (p.egg_count > 0 && p.container_stock > 0) {
      const maxByEggs = Math.floor(looseEggs / p.egg_count);
      const possiblePacks = Math.min(maxByEggs, p.container_stock);
      
      if (possiblePacks > 0) {
        suggestions.push({
          product: p,
          possiblePacks
        });
      }
    }
  });
  
  // Sort by largest packs first (descending by egg_count)
  suggestions.sort((a, b) => b.product.egg_count - a.product.egg_count);
  return suggestions;
}
