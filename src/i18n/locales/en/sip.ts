/** SIP page: open-ended mutual fund units bought by instalment. */
export default {
  title: "SIP (fund instalments)",
  hint: "Money you put into a mutual fund in regular instalments, and what it is worth at the latest NAV.",

  errTitle: "Could not load your SIP records",
  errHelp: "Check that the app was opened with its launcher, then try again.",
  errStatus: "The portfolio service answered with status {status}",
  errNoData: "The portfolio service returned no SIP data",
  emptyTitle: "No SIP records yet",
  emptyBody:
    "This page fills in when your portfolio has instalments of an open-ended fund, entered from the fund's SIP statement. Meroshare alone is not enough: it does not show the NAV you paid.",

  fundKind: "Open-ended mutual fund. It is not traded on NEPSE; units are bought from the fund and sold back to it at NAV.",
  sentence: "You have paid {paid} in {count} instalments since {date}. At the latest NAV this is worth {value}.",
  sentenceNoNav: "You have paid {paid} in {count} instalments since {date}. The latest NAV is not available, so the value cannot be shown yet.",

  paid: "Money paid in",
  paidNote: "{count} instalments, usually {amount} each",
  paidNoteCharge: "{count} instalments, usually {amount} each, including the {charge} charge shown on your statement",
  value: "Value now",
  valueNote: "{units} units × NAV {nav}",
  gain: "Gain or loss",
  gainNote: "Value now minus money paid in",
  gainNoteDividend: "Value now minus money paid in. Dividend units are counted in the value.",
  yearly: "Return per year",
  yearlyNote: "Counts the date of every instalment",
  yearlyNA: "Needs at least 3 months of records",
  yearlyExplain:
    "Your instalments went in on different dates, so the first one has been invested much longer than the last. This figure (called XIRR) is the single yearly rate that would turn each instalment, from its own date, into today's value. It can be compared with a bank deposit rate. It describes the past only.",

  navLine: "Latest NAV: {nav} per unit, dated {date}. NAV is published by the fund manager.",
  avgCost: "Your average cost per unit is {cost}.",
  navRange: "The NAV you paid has ranged from {low} to {high}.",
  unitsNote:
    "Meroshare shows {demat} units. Your SIP statements add up to {statement}, because Meroshare drops the fraction of every credit. The value here uses the Meroshare figure.",

  divTitle: "Dividend received",
  divTotal: "{units} units, worth {value} now",
  divFy: "Fiscal year {fy}",
  divCredited: "Units credited on {date}",
  divDeclared: "fund declared {pct}%",
  divNote:
    "This dividend came as extra units, not as cash in your bank account. The SIP statement lists only your instalments, so the dividend is not on it; it shows in Meroshare as a credit of units. These units are already counted in the value and the gain above.",
  divNone: "No dividend is recorded for this fund yet. A dividend paid as units shows in Meroshare as a credit of units, not on the SIP statement.",

  knowTitle: "Things to know",
  know1: "The same instalment buys more units when NAV is low and fewer when NAV is high. This is why your average cost differs from a simple average of NAV.",
  know2: "A fund may take a charge when units are sold back early. The amount and the period are written in the fund's scheme document.",
  know3: "Keep every SIP statement. Meroshare does not show the NAV you paid or the fractional units.",
  disclaimer: "This page explains your own records. It does not tell you to buy, sell or hold anything.",

  recentTitle: "Latest instalments",
  allTitle: "All instalments ({count})",
  showFull: "Show the chart and all instalments",
  kind_instalment: "Instalment",
  kind_dividend_units: "Dividend units",
  kind_redemption: "Sold back",
  noCash: "No cash paid",
  rowNav: "NAV {nav}",
  rowUnits: "{units} units",
  colDate: "Date",
  colKind: "Type",
  colAmount: "Amount",
  colNavPaid: "NAV paid",
  colUnits: "Units",
  colSince: "NAV change since",

  chartTitle: "NAV you paid at each instalment",
  chartSub: "The dashed line is the latest NAV ({nav}). Points below it were bought for less than today's NAV.",
  chartEmpty: "No instalments with a recorded NAV yet.",
  chartNavPaid: "NAV paid",
  chartLatest: "Latest NAV",
};
