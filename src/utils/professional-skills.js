// PE / GE / VC / RBF, advanced-trading, and curated ISCAE academic skills.
// Each carries an explicit `track` (careerTrack) used by the Skill Tree career filter
// and the deal / course auto-award engines. Merged into SKILL_TREE in skill-tree-data.js.
//
// Curated per the "PE/VC + trading + curated ISCAE" scope decision — every node is a
// real, distinct competency (not auto-numbered filler). Prereq chains stay simple and
// reference existing tree ids where natural (e.g. lbo-analysis-lv1 from Finance).

const make = (category, track) => (id, name, subcategory, prereqs, description) => ({
  id, name, category, subcategory, prereqs, track, description,
});

const pe = make('Private Equity', 'PE');
const ge = make('Growth Equity', 'GE');
const vc = make('Venture Capital', 'VC');
const rbf = make('Revenue-Based Financing', 'RBF');
const at = make('Advanced Trading', 'Trading');
const ac = make('Academics (ISCAE)', 'General');

export const PROFESSIONAL_SKILLS = [
  // ══════════════ PRIVATE EQUITY (42) ══════════════
  // Deal Mechanics
  pe('pe-lbo-value-creation-lv1', 'LBO Value Creation Lv1', 'Deal Mechanics', ['lbo-analysis-lv1'], 'Value bridge: deleveraging, multiple expansion, EBITDA growth'),
  pe('pe-lbo-value-creation-lv2', 'LBO Value Creation Lv2', 'Deal Mechanics', ['pe-lbo-value-creation-lv1'], 'Dividend recaps, add-on roll-ups, margin-led value creation'),
  pe('pe-debt-structuring', 'Debt Financing & Structuring', 'Deal Mechanics', ['capital-structure-lv1'], 'Senior/mezz/unitranche layering, covenants, leverage capacity'),
  pe('pe-acquisition-valuation', 'Valuation for Acquisition', 'Deal Mechanics', ['dcf-analysis-lv1', 'comparables-lv1'], 'Entry multiples, purchase price allocation, sources & uses'),
  pe('pe-term-sheet-negotiation', 'Term Sheet Negotiation', 'Deal Mechanics', ['negotiation-lv1'], 'Purchase agreement terms, reps & warranties, escrow, earnouts'),
  pe('pe-equity-waterfall', 'Equity Waterfall', 'Deal Mechanics', [], 'Preferred return, catch-up, carried interest, GP/LP splits'),
  pe('pe-control-premium', 'Control Premium Analysis', 'Deal Mechanics', ['comparables-lv1'], 'Control vs. minority, synergies, acquisition premia'),
  pe('pe-ebitda-adjustments', 'EBITDA Adjustments', 'Deal Mechanics', ['three-statement-modeling-lv1'], 'Add-backs, normalizations, quality-of-earnings scrutiny'),
  pe('pe-deal-sourcing', 'Deal Sourcing & Pipeline', 'Deal Mechanics', [], 'Proprietary origination, banker relationships, thesis-driven outreach'),
  // Due Diligence
  pe('pe-commercial-dd', 'Commercial Due Diligence', 'Due Diligence', [], 'Market sizing, competitive moat, customer references'),
  pe('pe-financial-dd', 'Financial Due Diligence', 'Due Diligence', ['pe-ebitda-adjustments'], 'Quality of earnings, working capital, debt-like items'),
  pe('pe-tax-dd', 'Tax Due Diligence', 'Due Diligence', [], 'Tax exposures, structuring efficiency, step-ups'),
  pe('pe-legal-dd', 'Legal Due Diligence', 'Due Diligence', [], 'Contracts, litigation, IP, change-of-control provisions'),
  pe('pe-management-assessment', 'Management Assessment', 'Due Diligence', [], 'Team quality, incentive alignment, succession risk'),
  // Value Creation
  pe('pe-100-day-plan', '100-Day Plan', 'Value Creation', [], 'Post-close priorities, quick wins, governance setup'),
  pe('pe-operational-value', 'Operational Value Creation', 'Value Creation', ['pe-100-day-plan'], 'Pricing, procurement, footprint, org design'),
  pe('pe-cost-reduction', 'Cost Reduction Programs', 'Value Creation', ['pe-operational-value'], 'Zero-based budgeting, SG&A rationalization'),
  pe('pe-revenue-growth', 'Revenue Growth Initiatives', 'Value Creation', ['pe-operational-value'], 'Sales force effectiveness, cross-sell, new channels'),
  pe('pe-margin-expansion', 'Margin Expansion', 'Value Creation', ['pe-cost-reduction'], 'Gross-margin engineering, mix shift, operating leverage'),
  pe('pe-working-capital', 'Working Capital Optimization', 'Value Creation', [], 'DSO/DPO/DIO, cash conversion cycle'),
  pe('pe-digital-transformation', 'Digital Transformation', 'Value Creation', [], 'Systems, data, automation in portfolio companies'),
  pe('pe-add-on-acquisitions', 'Add-On Acquisitions', 'Value Creation', ['pe-acquisition-valuation'], 'Buy-and-build, integration, multiple arbitrage'),
  pe('pe-carve-out', 'Carve-Out Transactions', 'Value Creation', ['pe-operational-value'], 'Standalone costs, TSAs, stranded overhead'),
  pe('pe-board-management', 'Board Management', 'Value Creation', ['board-executive-lv1'], 'Board cadence, KPI dashboards, CEO partnership'),
  pe('pe-portfolio-mgmt', 'Portfolio Company Management', 'Value Creation', ['pe-board-management'], 'Ongoing monitoring, value-creation plan tracking'),
  // Fund Management
  pe('pe-fund-formation', 'Fund Formation & Management', 'Fund Management', [], 'LPA terms, fund lifecycle, capital calls'),
  pe('pe-lp-relations', 'LP Relations', 'Fund Management', ['written-communication-lv1'], 'LP reporting, AGM, fundraising narrative'),
  pe('pe-gp-commitments', 'GP Commitments', 'Fund Management', [], 'GP co-invest, alignment, clawback'),
  pe('pe-fund-metrics', 'Fund Performance Metrics', 'Fund Management', ['pe-irr-moic'], 'DPI, RVPI, TVPI, PME benchmarking'),
  pe('pe-irr-moic', 'IRR & MOIC Analysis', 'Fund Management', [], 'Gross/net returns, J-curve, cash-on-cash'),
  pe('pe-financial-controls', 'Financial Controls', 'Fund Management', [], 'Portfolio reporting, audit, valuation policy'),
  // Exit
  pe('pe-exit-planning', 'Exit Planning & Execution', 'Exit', ['pe-portfolio-mgmt'], 'Exit readiness, timing, process management'),
  pe('pe-dividend-recap', 'Dividend Recapitalization', 'Exit', ['pe-debt-structuring'], 'Recap mechanics, leverage headroom, LP distributions'),
  pe('pe-secondary-sale', 'Secondary Sale Strategy', 'Exit', ['pe-exit-planning'], 'Sponsor-to-sponsor, continuation funds'),
  pe('pe-ipo-exit', 'IPO Path to Exit', 'Exit', ['pe-exit-planning', 'ipo-capital-raising-lv1'], 'IPO readiness, lockups, staged sell-down'),
  pe('pe-strategic-sale', 'Strategic Sale', 'Exit', ['pe-exit-planning'], 'Trade buyers, synergy positioning, auction dynamics'),
  // Process Excellence
  pe('pe-six-sigma', 'Six Sigma Application', 'Process Excellence', [], 'DMAIC, defect reduction in operations'),
  pe('pe-lean', 'Lean Implementation', 'Process Excellence', [], 'Waste elimination, flow, continuous improvement'),
  pe('pe-synergy-realization', 'Synergy Realization', 'Process Excellence', ['synergy-analysis-lv1'], 'Tracking, accountability, integration PMO'),
  pe('pe-integration-planning', 'Integration Planning', 'Process Excellence', ['pe-synergy-realization'], 'Day-1 readiness, functional integration'),
  pe('pe-industry-expertise', 'Industry Expertise', 'Process Excellence', [], 'Sector thesis, value-chain fluency, thematic edge'),
  pe('pe-succession-planning', 'Succession Planning', 'Process Excellence', ['pe-management-assessment'], 'Leadership pipeline, retention, transition'),

  // ══════════════ GROWTH EQUITY (24) ══════════════
  ge('ge-thesis', 'Growth Equity Thesis', 'Strategy', [], 'Post-PMF scaling bets, minority growth capital'),
  ge('ge-scaling-strategy', 'Scaling Strategy', 'Strategy', ['ge-thesis'], 'Repeatable go-to-market, org scaling, systems'),
  ge('ge-revenue-acceleration', 'Revenue Acceleration', 'Strategy', ['ge-scaling-strategy'], 'Sales capacity, pipeline velocity, expansion motion'),
  ge('ge-market-expansion', 'Market Expansion', 'Strategy', ['ge-scaling-strategy'], 'New segments, geographies, adjacencies'),
  ge('ge-gtm-strategy', 'Go-to-Market Strategy', 'Strategy', [], 'ICP, channel mix, sales-marketing alignment'),
  ge('ge-competitive-positioning', 'Competitive Positioning', 'Strategy', [], 'Moat, differentiation, category design'),
  ge('ge-pricing-strategy', 'Pricing Strategy', 'Strategy', [], 'Packaging, tiering, value-based pricing'),
  ge('ge-platform-buildout', 'Platform Buildout', 'Strategy', ['ge-market-expansion'], 'M&A-led expansion, platform economics'),
  // SaaS metrics
  ge('ge-saas-metrics', 'SaaS Metrics (ARR, NRR, CAC, LTV)', 'Metrics', [], 'Core SaaS KPIs and their interplay'),
  ge('ge-unit-economics', 'Unit Economics', 'Metrics', ['ge-saas-metrics'], 'CAC payback, LTV/CAC, contribution margin'),
  ge('ge-retention', 'Retention Optimization', 'Metrics', ['ge-saas-metrics'], 'Gross/net retention, cohort analysis'),
  ge('ge-churn', 'Churn Analysis', 'Metrics', ['ge-retention'], 'Logo vs. revenue churn, leading indicators'),
  ge('ge-expansion-revenue', 'Expansion Revenue', 'Metrics', ['ge-retention'], 'Upsell, cross-sell, seat expansion, NRR>100%'),
  ge('ge-concentration-risk', 'Customer Concentration Risk', 'Metrics', [], 'Revenue concentration, dependency, diversification'),
  ge('ge-sales-efficiency', 'Sales Efficiency', 'Metrics', ['ge-unit-economics'], 'Magic number, quota attainment, ramp'),
  ge('ge-magic-number', 'Marketing Efficiency', 'Metrics', ['ge-unit-economics'], 'Blended CAC, channel ROI, payback'),
  // Execution
  ge('ge-customer-success', 'Customer Success', 'Execution', ['ge-retention'], 'Onboarding, adoption, health scoring'),
  ge('ge-enterprise-sales', 'Enterprise Sales', 'Execution', ['ge-gtm-strategy'], 'Land-and-expand, complex deal cycles'),
  ge('ge-international-expansion', 'International Expansion', 'Execution', ['ge-market-expansion'], 'Localization, entity setup, GTM sequencing'),
  ge('ge-cashflow-mgmt', 'Cash Flow Management (GE)', 'Execution', [], 'Burn, runway, path to profitability'),
  ge('ge-board-dynamics', 'Board Dynamics (GE)', 'Execution', ['board-executive-lv1'], 'Minority governance, founder partnership'),
  ge('ge-dilution-mgmt', 'Equity Dilution Management', 'Execution', [], 'Cap-table modeling, option pool, round dilution'),
  ge('ge-founder-retention', 'Founder Retention', 'Execution', [], 'Incentives, vesting, alignment through scale'),
  ge('ge-series-funding', 'Series Funding Strategy', 'Execution', ['ge-cashflow-mgmt'], 'Round sequencing, valuation step-ups, timing'),

  // ══════════════ VENTURE CAPITAL (26) ══════════════
  vc('vc-thesis', 'VC Investment Thesis', 'Investing', [], 'Thematic focus, portfolio construction, power law'),
  vc('vc-startup-eval', 'Startup Evaluation', 'Investing', ['vc-thesis'], 'Team, market, product, traction framework'),
  vc('vc-founder-assessment', 'Founder Quality Assessment', 'Investing', ['vc-startup-eval'], 'Grit, insight, recruiting ability, coachability'),
  vc('vc-pmf', 'Product-Market Fit', 'Investing', [], 'Signals of PMF, retention curves, pull'),
  vc('vc-tam-sam-som', 'Market Sizing (TAM/SAM/SOM)', 'Investing', [], 'Top-down vs. bottom-up sizing, credibility'),
  vc('vc-early-metrics', 'Early-Stage Metrics', 'Investing', ['vc-pmf'], 'Engagement, retention, early revenue quality'),
  vc('vc-stage-seed', 'Seed Stage Characteristics', 'Stages', [], 'Team + narrative + early signal; pre-metrics bets'),
  vc('vc-stage-a', 'Series A Characteristics', 'Stages', ['vc-stage-seed'], 'PMF evidence, repeatable GTM, unit economics'),
  vc('vc-stage-bplus', 'Series B+ Characteristics', 'Stages', ['vc-stage-a'], 'Scale efficiency, market leadership, durability'),
  vc('vc-startup-valuation', 'Startup Valuation', 'Terms', ['vc-tam-sam-som'], 'Comps, ownership targets, dilution math'),
  vc('vc-term-sheets', 'Term Sheet Negotiation (VC)', 'Terms', ['vc-startup-valuation'], 'Ownership, pro-rata, governance terms'),
  vc('vc-liquidation-prefs', 'Liquidation Preferences', 'Terms', ['vc-term-sheets'], '1x non-participating, stacking, waterfalls'),
  vc('vc-anti-dilution', 'Anti-Dilution Mechanisms', 'Terms', ['vc-term-sheets'], 'Full ratchet vs. weighted average'),
  vc('vc-protective-provisions', 'Protective Provisions', 'Terms', ['vc-term-sheets'], 'Veto rights, information rights, board seats'),
  vc('vc-safes', 'SAFEs & Convertible Notes', 'Instruments', [], 'Caps, discounts, MFN, conversion mechanics'),
  vc('vc-venture-debt', 'Venture Debt', 'Instruments', [], 'Warrants, covenants, runway extension'),
  vc('vc-cap-tables', 'Cap Tables', 'Instruments', ['vc-safes'], 'Fully-diluted ownership, waterfalls, scenarios'),
  vc('vc-option-pools', 'Employee Option Pools', 'Instruments', ['vc-cap-tables'], 'Pool sizing, refreshes, dilution impact'),
  vc('vc-follow-on', 'Follow-On Investments', 'Portfolio', ['vc-startup-eval'], 'Pro-rata, doubling down, reserves strategy'),
  vc('vc-down-round', 'Down Round Management', 'Portfolio', ['vc-follow-on'], 'Recaps, pay-to-play, morale management'),
  vc('vc-bridge', 'Bridge Financing', 'Portfolio', ['vc-safes'], 'Insider bridges, milestones, extension terms'),
  vc('vc-portfolio-construction', 'Portfolio Construction (VC)', 'Portfolio', ['vc-thesis'], 'Reserves, ownership targets, power-law math'),
  vc('vc-exit-scenarios', 'Exit Scenarios (VC)', 'Exit', ['vc-portfolio-construction'], 'M&A, acquihire, IPO, secondaries'),
  vc('vc-fund-economics', 'VC Fund Economics', 'Exit', ['vc-portfolio-construction'], 'J-curve, DPI, fund returns, management fees'),
  vc('vc-secondaries', 'Secondary Sales (VC)', 'Exit', ['vc-exit-scenarios'], 'Liquidity for early holders, pricing'),
  vc('vc-syndication', 'Syndication & Co-Investment', 'Exit', [], 'Lead vs. follow, allocation, signaling'),

  // ══════════════ REVENUE-BASED FINANCING (16) ══════════════
  rbf('rbf-mechanics', 'RBF Mechanics', 'Fundamentals', [], 'Percent-of-revenue repayment, no equity/dilution'),
  rbf('rbf-structure', 'Revenue-Based Agreement Structure', 'Fundamentals', ['rbf-mechanics'], 'Cap multiple, revenue share %, term'),
  rbf('rbf-payback-multiple', 'Payback Multiplier', 'Fundamentals', ['rbf-structure'], '1.3–2.0x cap, effective cost of capital'),
  rbf('rbf-payback-timeline', 'Payback Timeline', 'Fundamentals', ['rbf-payback-multiple'], 'Duration sensitivity to revenue trajectory'),
  rbf('rbf-use-cases', 'Ideal RBF Use Cases', 'Fundamentals', ['rbf-mechanics'], 'Predictable recurring revenue, positive margins'),
  rbf('rbf-saas', 'SaaS RBF', 'Applications', ['rbf-use-cases'], 'ARR-backed advances, MRR-linked repayment'),
  rbf('rbf-ecommerce', 'E-commerce RBF', 'Applications', ['rbf-use-cases'], 'GMV-linked, inventory & marketing financing'),
  rbf('rbf-subscription', 'Subscription RBF', 'Applications', ['rbf-use-cases'], 'Deferred revenue advances, churn risk'),
  rbf('rbf-cac-financing', 'CAC Financing', 'Applications', ['rbf-saas'], 'Funding acquisition against LTV'),
  rbf('rbf-vs-equity', 'RBF vs. Equity Comparison', 'Analysis', ['rbf-payback-multiple'], 'Dilution-free cost trade-offs, when to use each'),
  rbf('rbf-royalty', 'Royalty-Based Financing', 'Adjacent', [], 'Royalty streams, IP-backed structures'),
  rbf('rbf-ar-financing', 'Accounts Receivable Financing', 'Adjacent', [], 'Advance rates against receivables'),
  rbf('rbf-factoring', 'Invoice Factoring', 'Adjacent', ['rbf-ar-financing'], 'Recourse vs. non-recourse, discount rates'),
  rbf('rbf-earnouts', 'Earnout Structures', 'Adjacent', [], 'Contingent payments, milestone triggers'),
  rbf('rbf-subordinated', 'Subordinated & Hybrid Notes', 'Adjacent', ['rbf-vs-equity'], 'Mezzanine, blended instruments, warrants'),
  rbf('rbf-blended', 'Blended Financing Structures', 'Adjacent', ['rbf-subordinated'], 'Combining RBF, debt, and equity to de-risk'),

  // ══════════════ ADVANCED TRADING (40) ══════════════
  // Crypto
  at('at-btc-cycles', 'Bitcoin Cycles & Halvings', 'Crypto', ['bitcoin-mastery-lv1'], 'Four-year cycle, halving supply shocks'),
  at('at-eth-mechanics', 'Ethereum Mechanics', 'Crypto', ['ethereum-protocol-lv1'], 'Gas, MEV, staking yield, EIP-1559'),
  at('at-altcoin', 'Altcoin Analysis', 'Crypto', ['at-btc-cycles'], 'Beta, rotation, narrative cycles'),
  at('at-defi', 'DeFi Protocols', 'Crypto', ['defi-protocols-lv1'], 'AMMs, lending, yield sources'),
  at('at-yield-farming', 'Yield Farming & Impermanent Loss', 'Crypto', ['at-defi'], 'LP returns, IL math, incentive decay'),
  at('at-onchain', 'On-Chain Analysis', 'Crypto', ['on-chain-analysis-lv1'], 'Flows, holder cohorts, exchange balances'),
  at('at-staking', 'Staking Strategies', 'Crypto', ['at-eth-mechanics'], 'Liquid staking, validator economics'),
  at('at-mev', 'MEV (Maximal Extractable Value)', 'Crypto', ['at-eth-mechanics'], 'Sandwiching, arbitrage, priority fees'),
  at('at-crypto-structure', 'Crypto Market Structure', 'Crypto', ['crypto-exchanges-lv1'], 'CEX/DEX liquidity, funding, basis'),
  at('at-tokenomics', 'Tokenomics Analysis', 'Crypto', ['crypto-fundamentals-lv2'], 'Emissions, sinks, vesting unlock cliffs'),
  // Derivatives
  at('at-options-strategies', 'Options Strategies', 'Derivatives', ['options-derivatives-lv1'], 'Spreads, straddles, condors, risk graphs'),
  at('at-calendar-spreads', 'Calendar Spreads', 'Derivatives', ['at-options-strategies'], 'Term structure, theta capture'),
  at('at-vol-trading', 'Volatility Trading', 'Derivatives', ['volatility-analysis-lv2'], 'Long/short vol, variance, vol risk premium'),
  at('at-iv-rank', 'IV Rank vs. Historical Vol', 'Derivatives', ['at-vol-trading'], 'Vol percentile, mean reversion of IV'),
  at('at-gamma-scalping', 'Gamma Scalping', 'Derivatives', ['at-options-strategies'], 'Delta hedging a long-gamma book'),
  at('at-theta-mgmt', 'Theta Decay Management', 'Derivatives', ['at-options-strategies'], 'Time decay, weekend effects, roll timing'),
  at('at-greeks-portfolio', 'Greeks in Portfolio', 'Derivatives', ['at-gamma-scalping'], 'Aggregate delta/gamma/vega/theta exposure'),
  at('at-vol-crush', 'Volatility Crush', 'Derivatives', ['at-iv-rank'], 'Post-event IV collapse, earnings plays'),
  at('at-bond-futures', 'Bond Futures & Curve Trades', 'Derivatives', ['yield-curves-lv2'], 'Duration, steepeners/flatteners'),
  at('at-cds', 'CDS & Credit Spreads', 'Derivatives', ['credit-analysis-lv1'], 'Default pricing, basis, spread trades'),
  // Macro & Correlations
  at('at-regime-id', 'Macro Regime Identification', 'Macro & Correlations', ['macro-theory-lv1'], 'Growth/inflation quadrants, regime shifts'),
  at('at-risk-onoff', 'Risk-On/Risk-Off Correlation', 'Macro & Correlations', ['correlation-analysis-lv2'], 'Cross-asset beta to risk sentiment'),
  at('at-real-yields-gold', 'Real Yields & Gold', 'Macro & Correlations', ['gold-mastery-lv1', 'inflation-cpi-lv2'], 'Real-rate driver of gold'),
  at('at-usd-transmission', 'USD Strength Transmission', 'Macro & Correlations', ['capital-flows-lv1'], 'Dollar impact on EM, commodities, risk'),
  at('at-em-flows', 'Emerging Market Flows', 'Macro & Correlations', ['em-macro-lv1'], 'Portfolio flows, carry, sudden stops'),
  at('at-contagion', 'Contagion & Spillovers', 'Macro & Correlations', ['financial-crises-lv1'], 'Cross-border transmission, correlation-to-1'),
  at('at-policy-surprise', 'Policy Surprise Impact', 'Macro & Correlations', ['central-bank-policy-lv2'], 'Hawkish/dovish surprises, repricing'),
  at('at-inflation-expectations', 'Inflation Expectations', 'Macro & Correlations', ['inflation-cpi-lv2'], 'Breakevens, 5y5y, survey measures'),
  at('at-recession-indicators', 'Recession Indicators', 'Macro & Correlations', ['recession-forecasting-lv1'], 'Curve inversion, claims, PMI, Sahm rule'),
  at('at-geo-pricing', 'Geopolitical Risk Pricing', 'Macro & Correlations', ['geopolitical-risk-lv1'], 'Event risk, hedges, tail pricing'),
  // Execution & Risk
  at('at-merger-arb', 'Merger Arbitrage', 'Execution & Risk', ['ma-strategy-lv1'], 'Deal spread, break risk, timeline'),
  at('at-earnings-surprises', 'Earnings Surprises', 'Execution & Risk', ['equity-research-lv1'], 'Drift, whisper numbers, positioning'),
  at('at-short-selling', 'Short Selling Mechanics', 'Execution & Risk', ['liquidity-management-lv1'], 'Borrow, squeezes, asymmetry'),
  at('at-liquidity-analysis', 'Liquidity Analysis', 'Execution & Risk', ['market-microstructure-lv1'], 'Depth, impact, participation limits'),
  at('at-slippage', 'Slippage & Execution Cost', 'Execution & Risk', ['slippage-spread-lv1'], 'TWAP/VWAP, market impact modeling'),
  at('at-pairs', 'Pairs & Relative Value', 'Execution & Risk', ['statistical-arbitrage-lv1'], 'Spread mean reversion, hedge ratios'),
  at('at-event-driven', 'Event-Driven Trading', 'Execution & Risk', ['at-merger-arb'], 'Catalysts, special situations, spinoffs'),
  at('at-position-scaling', 'Dynamic Position Scaling', 'Execution & Risk', ['position-sizing-lv3'], 'Pyramiding, de-risking, conviction sizing'),
  at('at-correlation-hedging', 'Correlation Hedging', 'Execution & Risk', ['portfolio-risk-lv2'], 'Cross-asset hedges, beta neutralization'),
  at('at-tail-hedging', 'Tail Risk Hedging', 'Execution & Risk', ['at-vol-trading'], 'Convexity, put spreads, crisis alpha'),

  // ══════════════ ACADEMICS · ISCAE (curated, 54) ══════════════
  // Comptabilité
  ac('isc-compta-generale', 'Comptabilité Générale', 'Comptabilité', [], 'Journal, grand livre, balance, écritures'),
  ac('isc-compta-financiere', 'Comptabilité Financière', 'Comptabilité', ['isc-compta-generale'], 'États de synthèse, CPC, bilan, ESG'),
  ac('isc-compta-analytique', 'Comptabilité Analytique', 'Comptabilité', ['isc-compta-generale'], 'Coûts complets, coûts partiels, imputation'),
  ac('isc-couts-methodes', 'Méthodes des Coûts', 'Comptabilité', ['isc-compta-analytique'], 'ABC, coût standard, écarts'),
  ac('isc-consolidation', 'Consolidation', 'Comptabilité', ['isc-compta-financiere'], 'Périmètre, méthodes, retraitements'),
  ac('isc-normes-ifrs', 'Normes IFRS', 'Comptabilité', ['isc-compta-financiere'], 'Référentiel international, juste valeur'),
  ac('isc-audit-general', 'Audit Général', 'Comptabilité', ['isc-compta-financiere'], 'Démarche, contrôle interne, assertions'),
  ac('isc-audit-risques', 'Audit & Approche par les Risques', 'Comptabilité', ['isc-audit-general'], 'Seuil de signification, échantillonnage'),
  // Finance & Banque
  ac('isc-math-financiere', 'Mathématiques Financières', 'Finance & Banque', [], 'Intérêts, actualisation, annuités'),
  ac('isc-eco-monetaire', 'Économie Monétaire et Financière', 'Finance & Banque', [], 'Création monétaire, politique monétaire'),
  ac('isc-techniques-banque', 'Techniques de Banque et de Crédit', 'Finance & Banque', ['isc-eco-monetaire'], 'Crédits, garanties, analyse de dossier'),
  ac('isc-finance-marche', 'Finance de Marché', 'Finance & Banque', ['isc-math-financiere'], 'Actifs, portefeuille, MEDAF'),
  ac('isc-finance-entreprise', "Finance d'Entreprise", 'Finance & Banque', ['isc-math-financiere'], 'Investissement, financement, VAN/TRI'),
  ac('isc-diagnostic-financier', 'Diagnostic Financier', 'Finance & Banque', ['isc-compta-financiere'], 'Ratios, SIG, équilibre financier'),
  ac('isc-gestion-tresorerie', 'Gestion de Trésorerie', 'Finance & Banque', ['isc-finance-entreprise'], 'BFR, plan de trésorerie, placements'),
  ac('isc-evaluation-entreprise', "Évaluation d'Entreprise", 'Finance & Banque', ['isc-diagnostic-financier'], 'DCF, multiples, actif net'),
  // Économie
  ac('isc-intro-economie', "Introduction à l'Économie", 'Économie', [], 'Agents, marchés, circuit économique'),
  ac('isc-microeconomie', 'Microéconomie', 'Économie', ['isc-intro-economie'], 'Offre, demande, équilibre, élasticités'),
  ac('isc-micro-approfondie', 'Microéconomie Approfondie', 'Économie', ['isc-microeconomie'], 'Théorie du producteur/consommateur, marchés'),
  ac('isc-macroeconomie', 'Macroéconomie', 'Économie', ['isc-intro-economie'], 'PIB, IS-LM, inflation, chômage'),
  ac('isc-macro-approfondie', 'Macroéconomie Approfondie', 'Économie', ['isc-macroeconomie'], 'Croissance, cycles, modèles dynamiques'),
  ac('isc-eco-internationale', 'Économie Internationale', 'Économie', ['isc-macroeconomie'], 'Change, balance des paiements, commerce'),
  ac('isc-problemes-eco', 'Problèmes Économiques et Sociaux', 'Économie', ['isc-macroeconomie'], 'Enjeux contemporains, politiques publiques'),
  ac('isc-finances-publiques', 'Finances Publiques Marocaines', 'Économie', [], 'Budget de l’État, LOF, fiscalité publique'),
  // Statistiques & Maths
  ac('isc-analyse-math', 'Analyse Mathématique', 'Statistiques & Maths', [], 'Fonctions, limites, dérivées, intégrales'),
  ac('isc-algebre', 'Algèbre', 'Statistiques & Maths', [], 'Matrices, espaces vectoriels, diagonalisation'),
  ac('isc-stat-descriptive', 'Statistique Descriptive', 'Statistiques & Maths', [], 'Tendance centrale, dispersion, distributions'),
  ac('isc-probabilites', 'Les Probabilités', 'Statistiques & Maths', ['isc-analyse-math'], 'Lois, variables aléatoires, espérance'),
  ac('isc-echantillonnage', 'Échantillonnage et Estimation', 'Statistiques & Maths', ['isc-probabilites'], 'Estimateurs, intervalles de confiance'),
  ac('isc-stat-decisionnelle', 'Statistiques Décisionnelles', 'Statistiques & Maths', ['isc-echantillonnage'], 'Tests d’hypothèses, régression, décision'),
  ac('isc-recherche-operationnelle', 'Recherche Opérationnelle', 'Statistiques & Maths', ['isc-algebre'], 'Programmation linéaire, optimisation'),
  // Droit & Fiscalité
  ac('isc-droit-travail', 'Droit du Travail Marocain', 'Droit & Fiscalité', [], 'Contrat de travail, code du travail, litiges'),
  ac('isc-droit-commercial', 'Droit Commercial Marocain', 'Droit & Fiscalité', [], 'Actes de commerce, sociétés, effets'),
  ac('isc-droit-societes', 'Droit des Sociétés', 'Droit & Fiscalité', ['isc-droit-commercial'], 'SA, SARL, gouvernance, constitution'),
  ac('isc-fiscalite', 'Fiscalité Marocaine', 'Droit & Fiscalité', [], 'IS, IR, TVA, procédures fiscales'),
  ac('isc-fiscalite-approfondie', 'Fiscalité Approfondie', 'Droit & Fiscalité', ['isc-fiscalite'], 'Optimisation, conventions, contentieux'),
  ac('isc-droit-affaires', 'Droit des Affaires', 'Droit & Fiscalité', ['isc-droit-commercial'], 'Contrats, concurrence, propriété'),
  // Management
  ac('isc-management-orgs', 'Management des Organisations', 'Management', [], 'Écoles, fonctions, structures'),
  ac('isc-socio-orgs', 'Sociologie des Organisations', 'Management', ['isc-management-orgs'], 'Acteurs, pouvoir, culture, changement'),
  ac('isc-comportement-org', 'Comportement Organisationnel', 'Management', ['isc-management-orgs'], 'Motivation, leadership, groupes'),
  ac('isc-grh', 'Gestion des Ressources Humaines', 'Management', ['isc-management-orgs'], 'Recrutement, GPEC, rémunération'),
  ac('isc-gestion-projet', 'Gestion de Projet', 'Management', [], 'Cadrage, planning, Gantt, risques'),
  ac('isc-strategie', "Stratégie d'Entreprise", 'Management', ['isc-management-orgs'], 'SWOT, Porter, avantage concurrentiel'),
  ac('isc-marketing', 'Marketing', 'Management', [], 'Mix, segmentation, positionnement'),
  ac('isc-marketing-strategique', 'Marketing Stratégique', 'Management', ['isc-marketing'], 'Étude de marché, ciblage, branding'),
  ac('isc-controle-gestion', 'Contrôle de Gestion', 'Management', ['isc-compta-analytique'], 'Budgets, tableaux de bord, pilotage'),
  ac('isc-supply-chain', 'Gestion de la Production & Logistique', 'Management', ['isc-gestion-projet'], 'Flux, stocks, ordonnancement'),
  // Systèmes d'information
  ac('isc-info-gestion', 'Informatique de Gestion', "Systèmes d'Information", [], 'Bureautique, tableurs, SI de gestion'),
  ac('isc-bases-donnees', 'Gestion de Bases de Données', "Systèmes d'Information", ['isc-info-gestion'], 'Modèle relationnel, SQL, MERISE'),
  ac('isc-systemes-info', "Systèmes d'Information", "Systèmes d'Information", ['isc-bases-donnees'], 'ERP, urbanisation, gouvernance SI'),
  ac('isc-business-intelligence', 'Business Intelligence', "Systèmes d'Information", ['isc-bases-donnees', 'isc-stat-decisionnelle'], 'Data warehouse, reporting, dashboards'),
  ac('isc-comm-professionnelle', 'Communication Professionnelle', 'Management', [], 'Écrit professionnel, présentation, négociation'),
  ac('isc-anglais-affaires', 'Anglais des Affaires', 'Management', [], 'Business English, terminologie financière'),
];

// careerTrack tag for the ~211 base skills (which predate the track field).
// Trading category → Trading; Finance category → General (foundational for PE);
// everything else → General.
export function inferBaseTrack(def) {
  if (def.category === 'Trading') return 'Trading';
  return 'General';
}

export const CAREER_TRACKS = ['PE', 'GE', 'VC', 'RBF', 'Trading', 'General'];
export const CAREER_GOALS = ['PE', 'GE', 'VC', 'RBF', 'Trading', 'Hybrid'];
