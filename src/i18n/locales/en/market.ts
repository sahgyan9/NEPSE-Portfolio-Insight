/** Market page, new share issues (IPO) table and the 52-week scanner. Keys must match ne/market.ts. */
export default {
  pageTitle: "Market",
  pageIntro: "Today's market, new share issues, and shares priced near their yearly high or low.",
  back: "Back to home",
  refreshedTitle: "Updated",
  refreshedBody: "Market data has been refreshed.",

  showMoreTitle: "More market tools",
  showMoreText: "Shares priced near their 52-week high or low, the company data archive and how the market works.",
  showMore: "Show more",

  // ---- new share issues ----
  ipoTitle: "New share issues",
  ipoSubtitle: "IPO, FPO, right share and mutual fund issues that are coming, open now or recently closed.",
  ipoExplain1: "An IPO is when a company sells its shares to the public for the first time.",
  ipoExplain2: "You apply through Meroshare, and you need a demat account and a bank account linked to it.",
  ipoExplain3: "If more people apply than there are shares, the shares are given by lottery, so applying does not guarantee that you get shares.",
  ipoLearn: "Read more about IPO",
  ipoSearch: "Search by company name or symbol",
  ipoFilterLabel: "Filter by type",
  ipoFilterAll: "All ({n})",
  ipoFilterIpo: "IPO",
  ipoFilterRight: "Right share",
  ipoFilterMutual: "Mutual fund",
  statusOpen: "Open",
  statusClosed: "Closed",
  statusUpcoming: "Upcoming",
  statusPipeline: "Date not set",
  typeIpo: "IPO / new issue",
  typeFpo: "FPO",
  typeRight: "Right share",
  typeMutual: "Mutual fund",
  typeDebenture: "Debenture",
  colStatus: "Status",
  colCompany: "Company",
  colType: "Type",
  colPrice: "Price per unit",
  colUnits: "Units",
  colOpens: "Opens",
  colCloses: "Closes",
  notAnnounced: "Not announced",
  closesToday: "Closes today",
  oneDayLeft: "1 day left",
  daysLeft: "{n} days left",
  opensTomorrow: "Opens tomorrow",
  opensIn: "Opens in {n} days",
  loadingIssues: "Loading share issues...",
  emptyIssues: "No share issues match your search.",
  showingTop: "Showing {shown} of {total} issues. Search to narrow the list.",

  // ---- 52-week scanner ----
  scanTitle: "Shares near their 52-week high or low",
  scanSubtitle: "Shares whose price is close to the highest or the lowest price of the past year.",
  scanCaution: "A share at its 52-week high or low is a fact about its price. It is not a reason to act by itself. Check the company's reports first.",
  nearHigh: "Near 52-week high",
  nearLow: "Near 52-week low",
  scanRefresh: "Refresh this list",
  scanLoading: "Checking prices...",
  scanEmpty: "No price data is available right now.",
  colSymbol: "Symbol",
  colSector: "Sector",
  colLtp: "Price (LTP)",
  colHigh: "52-week high",
  colFromHigh: "From high",
  colLow: "52-week low",
  colFromLow: "From low",
  badgeNearHigh: "Near high",
  badgeNearLow: "Near low",

  // ---- how the market works ----
  // Sources, checked 2026-11-15 (keep ne/market.ts in step):
  // - Monday to Friday: NEPSE notice ref. 082/83 no. 1569, dated 2082/12/25, "trading Monday to Friday
  //   at the existing time", on https://www.nepalstock.com/notices
  //   (file https://www.nepalstock.com/api/nots/news/notice/fetchFiles/7bb1f07da6d4c27511e1cbbfdb984895.pdf).
  // - 11 am to 3 pm: not stated in a NEPSE document found today. Kathmandu Post, 16 April 2026, reporting
  //   the trading rule amendment ("from 11am to 3pm"), https://kathmandupost.com/money/2026/04/16/nepse-allows-round-the-clock-order-placement-as-trading-rules-revised
  //   and the nepalstock.com home page on 2026-11-15 ("MARKET CLOSED Nov 13 | 3:00 PM", a Friday).
  //   The pre-open session exists under rule 12(1) of the regulations below; its clock times are not stated here.
  // - 15% daily limit and 5% / 8% index halts: NEPSE Securities Trading Operation (Fourth Amendment)
  //   Regulations 2082, rules 12 and 17, in force from 2083/01/07 (20 April 2026) by NEPSE notice
  //   ref. 082/83 no. 1637 dated 2083/01/04, same notices page
  //   (file https://www.nepalstock.com/api/nots/news/notice/fetchFiles/5dd1a5756a83e72ba11df84b1a5bc75c.pdf).
  infoTitle: "How the market works",
  infoDaysTitle: "Trading days and hours",
  infoDays: "As of November 2026, the market is open Monday to Friday. Regular trading runs from 11 am to 3 pm, after a short pre-open session. It is closed on Saturday, Sunday and public holidays.",
  infoLimitTitle: "Daily price limit",
  infoLimit: "Since April 2026, a share's price can move at most 15% up or down from its opening price that day. If the NEPSE index moves 5% within the first two hours, the whole market stops for 15 minutes. If it moves 8% at any time, trading stops for the rest of the day.",
  infoSettleTitle: "When shares arrive",
  infoSettle: "Shares you buy reach your account a couple of working days after the trade.",
  infoIndexTitle: "NEPSE index",
  infoIndex: "One number that shows how the whole market has moved.",
};
