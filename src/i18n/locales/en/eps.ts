/**
 * EPS insight sentences. Filled by src/lib/epsText.ts from the `code` and `params`
 * that tools/eps_insights.py sends with each flag, note and skipped holding.
 */
export default {
  flag_LOSS: "The company lost money over the last 12 months (EPS {eps} per share). A P/E ratio means nothing for a loss.",
  flag_PROFIT_FALLING_lower: "Profit so far this year is {pct}% lower than the same period last year.",
  flag_PROFIT_FALLING_turned_to_loss:
    "The company made a profit in the same period last year but a loss so far this year.",
  flag_PROFIT_RISING: "Profit so far this year is {pct}% higher than the same period last year.",
  flag_SEASONAL_ANNUALIZED:
    "Annualized EPS ({ann}) is far above the 12-month EPS ({ttm}). The monsoon quarter is this sector's best, so scaling it up to a full year inflates the figure. The 12-month EPS is the better guide.",
  flag_ANNUALIZED_GAP:
    "Annualized EPS ({ann}) differs a lot from the 12-month EPS ({ttm}). The annualized figure only scales up the year so far; the 12-month figure is the better guide.",
  flag_EXPENSIVE_AT_COST:
    "You paid {pac} times the 12-month EPS, more than twice the {sector} median P/E of {sectorPe}. The profit you get for each rupee you paid is low for this sector.",
  flag_CHEAP_VS_SECTOR:
    "The market P/E of {mpe} is well below the {sector} median of {sectorPe}. Check whether profits are about to fall.",

  note_ONLY_ANNUALIZED: "Only the annualized EPS is available for this company.",

  skip_MUTUAL_FUND: "mutual funds have no EPS",
  skip_NO_QUARTERLY: "no quarterly report on file",
  skip_NO_SHARES: "number of shares not available",
  skip_NO_PROFIT: "no net profit in the latest quarterly report",
};
