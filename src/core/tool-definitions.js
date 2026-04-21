const TOOLS = {
  SCREENER: [
    {
      name: "get_market_snapshot",
      description: "Return the latest futures market snapshot for candidate screening."
    },
    {
      name: "open_paper_position",
      description: "Open a paper futures position after risk validation passes."
    },
    {
      name: "get_risk_state",
      description: "Return account limits, free balance, and open exposure."
    }
  ],
  MANAGER: [
    {
      name: "get_open_positions",
      description: "Return current paper positions and their mark-to-market state."
    },
    {
      name: "close_paper_position",
      description: "Close an existing paper position at the latest quote."
    },
    {
      name: "get_risk_state",
      description: "Return account limits, free balance, and open exposure."
    }
  ]
};

export function getToolsForRole(role) {
  return TOOLS[role] || [];
}
