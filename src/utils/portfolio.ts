import { StockAnalysis, PortfolioAllocation, ExcludedAllocation } from "../services/openai";

export interface PortfolioOptions {
  forceEqualInclusion?: boolean; // When true, prioritizes allocating at least 1 share per stock first
}

export interface CalculationResult {
  allocations: PortfolioAllocation[];
  excludedAllocations: ExcludedAllocation[];
  totalInvested: number;
  remainingCash: number;
  totalExpectedProfit: number;
  totalExpectedReturnPercentage: number;
  minCapitalRequiredForAll: number;
  includedCount: number;
  totalCount: number;
}

export function calculatePortfolioDistribution(
  stocks: StockAnalysis[],
  totalCapital: number,
  options: PortfolioOptions = { forceEqualInclusion: true }
): CalculationResult {
  if (!stocks || stocks.length === 0 || totalCapital <= 0) {
    return {
      allocations: [],
      excludedAllocations: [],
      totalInvested: 0,
      remainingCash: totalCapital,
      totalExpectedProfit: 0,
      totalExpectedReturnPercentage: 0,
      minCapitalRequiredForAll: 0,
      includedCount: 0,
      totalCount: stocks ? stocks.length : 0
    };
  }

  // Ensure stocks are ordered by rank/score (highest score first)
  const sortedStocks = [...stocks].sort(
    (a, b) => (b.reversal_potential_score || 0) - (a.reversal_potential_score || 0)
  );

  // Minimum capital required to buy exactly 1 share of EVERY stock
  const minCapitalRequiredForAll = sortedStocks.reduce(
    (sum, s) => sum + (s.current_price && s.current_price > 0 ? s.current_price : 1),
    0
  );

  const allocationsMap: Map<string, {
    stock: StockAnalysis;
    currentPrice: number;
    shares: number;
  }> = new Map();

  const excludedAllocations: ExcludedAllocation[] = [];
  let remainingCash = totalCapital;

  // PASS 1: Base Allocation (Attempt 1 share per stock)
  // If totalCapital >= minCapitalRequiredForAll or forceEqualInclusion is enabled,
  // we iterate through all stocks and give 1 share to as many stocks as possible.
  for (const stock of sortedStocks) {
    const currentPrice = stock.current_price && stock.current_price > 0 ? stock.current_price : 1;

    if (remainingCash >= currentPrice) {
      allocationsMap.set(stock.ticker, {
        stock,
        currentPrice,
        shares: 1
      });
      remainingCash -= currentPrice;
    } else {
      excludedAllocations.push({
        ticker: stock.ticker,
        current_price: currentPrice,
        attempted_allocation: Number(remainingCash.toFixed(2)),
        reasoning: `Saldo restante de R$ ${remainingCash.toFixed(2)} é insuficiente para adquirir 1 cota (Preço: R$ ${currentPrice.toFixed(2)}). Capital mínimo necessário para todos os ativos: R$ ${minCapitalRequiredForAll.toFixed(2)}.`
      });
    }
  }

  // PASS 2: Proportional Weighted Redistribution of Remaining Cash
  // If we still have remaining cash and at least one stock was included,
  // distribute the leftover cash among included stocks proportional to their score weights.
  const includedItems = Array.from(allocationsMap.values());

  if (remainingCash > 0 && includedItems.length > 0) {
    const totalIncludedScore = includedItems.reduce(
      (sum, item) => sum + (item.stock.reversal_potential_score || 80),
      0
    );

    // Calculate extra shares per included stock
    for (const item of includedItems) {
      const weight = totalIncludedScore > 0 
        ? (item.stock.reversal_potential_score || 80) / totalIncludedScore 
        : 1 / includedItems.length;
      
      const extraTargetCash = remainingCash * weight;
      const extraShares = Math.floor(extraTargetCash / item.currentPrice);

      if (extraShares > 0) {
        item.shares += extraShares;
        remainingCash -= extraShares * item.currentPrice;
      }
    }

    // PASS 3: Leftover Cash Sweep (Buy extra 1-off shares for highest score stocks)
    // Sort included items by score descending to absorb remaining change
    includedItems.sort(
      (a, b) => (b.stock.reversal_potential_score || 0) - (a.stock.reversal_potential_score || 0)
    );

    let sweepIndex = 0;
    while (remainingCash > 0 && sweepIndex < includedItems.length) {
      let progressMade = false;
      for (const item of includedItems) {
        if (remainingCash >= item.currentPrice) {
          item.shares += 1;
          remainingCash -= item.currentPrice;
          progressMade = true;
        }
      }
      if (!progressMade) break; // Remaining cash is smaller than any stock price
      sweepIndex++;
    }
  }

  // Build final result
  let totalInvested = 0;
  let totalExpectedProfit = 0;
  const allocations: PortfolioAllocation[] = [];

  // Maintain original stock order in allocations
  for (const stock of stocks) {
    const item = allocationsMap.get(stock.ticker);
    if (item && item.shares >= 1) {
      const investedAmount = item.shares * item.currentPrice;
      totalInvested += investedAmount;

      const upside = (stock.target_price - item.currentPrice) / item.currentPrice;
      const expectedProfit = investedAmount * (upside > 0 ? upside : 0);
      totalExpectedProfit += expectedProfit;

      const percentage = totalCapital > 0 ? (investedAmount / totalCapital) * 100 : 0;

      allocations.push({
        ticker: stock.ticker,
        percentage: Number(percentage.toFixed(1)),
        amount_to_invest: Number(investedAmount.toFixed(2)),
        shares_to_buy: item.shares,
        expected_profit: Number(expectedProfit.toFixed(2)),
        reasoning: `${item.shares} cota(s) a R$ ${item.currentPrice.toFixed(2)}/ação. Upside estimado: +${(upside * 100).toFixed(1)}%.`
      });
    }
  }

  const totalExpectedReturnPercentage = totalInvested > 0 ? (totalExpectedProfit / totalInvested) * 100 : 0;

  return {
    allocations,
    excludedAllocations,
    totalInvested: Number(totalInvested.toFixed(2)),
    remainingCash: Number(remainingCash.toFixed(2)),
    totalExpectedProfit: Number(totalExpectedProfit.toFixed(2)),
    totalExpectedReturnPercentage: Number(totalExpectedReturnPercentage.toFixed(1)),
    minCapitalRequiredForAll: Number(minCapitalRequiredForAll.toFixed(2)),
    includedCount: allocations.length,
    totalCount: stocks.length
  };
}
