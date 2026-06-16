export function calculateDynamicEggCost(adultBatches, feedConsumptionAdult, ponedoraCostPerKg) {
  const totalFemales = adultBatches.reduce((acc, b) => acc + (b.femalesQuantity || 0), 0);
  const totalAdults = adultBatches.reduce((acc, b) => acc + (b.currentQuantity || 0), 0);

  const dailyFeedPerAdult = parseFloat(feedConsumptionAdult || 0.025);
  const dailyFeedCost = totalAdults * dailyFeedPerAdult * ponedoraCostPerKg;
  const dailyEggs = totalFemales * 0.8;
  
  if (dailyEggs <= 0) return 0;
  
  return dailyFeedCost / dailyEggs;
}
