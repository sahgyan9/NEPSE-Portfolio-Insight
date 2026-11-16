/** Simple (plain-language) home view. */
export default {
  summaryLabel: "Your portfolio in short",
  howTitle: "How am I doing?",

  investedSentence: "You put in {amount}.",
  investedTitle: "Money you put in",
  investedExplain: "What the shares you hold now cost you in total, worked out from each share's average cost (WACC, weighted average cost).",
  worthSentence: "Today it is worth {amount}.",
  worthTitle: "Value today",
  worthExplain: "Each share's latest price times the kitta you hold, added up. It changes every trading day.",
  upSentence: "You are up {amount} ({percent}).",
  downSentence: "You are down {amount} ({percent}).",
  flatSentence: "You are even: {amount} gain or loss.",
  gainTitle: "Profit or loss on paper",
  gainExplain: "Value today minus the money you put in. It is profit or loss on paper. It becomes real money only when shares are sold. Cash dividends are not included here.",

  perfMineGain: "For every Rs. 100 you put in, your shares earned about Rs. {amount} a year.",
  perfMineLoss: "For every Rs. 100 you put in, your shares lost about Rs. {amount} a year.",
  perfIndexGain: "The same money in the NEPSE index, on the same dates, would have earned about Rs. {amount}.",
  perfIndexLoss: "The same money in the NEPSE index, on the same dates, would have lost about Rs. {amount}.",
  perfNote: "Both numbers count when you put each amount in, so money added later counts for less time.",

  attentionTitle: "What needs your attention",
  attentionHint: "The most important first. These describe your numbers; they are not instructions.",
  attentionLink: "See the full risk check",

  eventsTitle: "What happened to your shares",

  sharesTitle: "Your shares",
  sharesHint: "Biggest first. Each card says in one line why it has its label.",
  cardKitta: "You hold",
  cardWorth: "Worth now",
  cardGain: "Profit or loss",
  gainWord: "Profit",
  lossWord: "Loss",
  flatWord: "Even",
  noPriceShort: "No price today",
  seeMoreCount: "See {count} more",

  statusOk: "Looks fine",
  statusWatch: "Keep an eye on it",
  statusProblem: "Problem",

  reasonLossMaking: "In its latest report this company made a loss (EPS, profit per share: {eps}). A company losing money has less to share with its owners.",
  reasonNoPrice: "We could not get a price for this share, so the value shown here may be wrong.",
  reasonVeryConcentrated: "{weight}% of your money is in this one share. With this much in one company, its ups and downs move your whole portfolio.",
  reasonBigLoss: "The price is {percent}% below what you paid. The company's latest quarterly report can show why.",
  reasonConcentrated: "{weight}% of your money is in this one share. Having a lot of money in one company raises your risk.",
  reasonLoss: "The price is {percent}% below what you paid. Until the shares are sold, this is a loss on paper only.",
  reasonNoData: "We do not have this company's report data, so we cannot check its profit.",
  reasonOk: "Nothing worrying in the numbers we have. It holds {weight}% of your money.",
  reasonOkFund: "This is a mutual fund. Nothing worrying in its price. It holds {weight}% of your money.",

  showAll: "Show all charts and tables",

  todayUp: "On the last trading day your portfolio went up by {amount}.",
  todayDown: "On the last trading day your portfolio went down by {amount}.",
  todayFlat: "On the last trading day there was hardly any change.",
};
