// Comprehensive AUDAX skill tree (~211 skills).
// Prereq rule: a skill unlocks when ALL prereq skills reach internal Lv2+.
// "LvN" in a skill NAME is its tier in the progression chain (separate node);
// each node still has its own internal level 1-5 (Novice→Master).
// Foundation nodes (Currency Pairs, Volatility Analysis, etc.) were added beyond
// the original spec because its prerequisites referenced skills it never defined.

import { PROFESSIONAL_SKILLS, inferBaseTrack } from './professional-skills.js';

const mk = (category) => (id, name, subcategory, prereqs, description) => ({ id, name, category, subcategory, prereqs, description });
const t = mk('Trading');
const f = mk('Finance');
const k = mk('Knowledge');
const s = mk('Soft Skills');
const d = mk('Discipline');

const BASE_SKILLS = [
  // ════════ TRADING · Strategy Mastery (15) ════════
  t('trend-following-lv1', 'Trend Following Lv1', 'Strategy Mastery', [], 'Identify and ride established directional moves using moving averages and structure'),
  t('trend-following-lv2', 'Trend Following Lv2', 'Strategy Mastery', ['trend-following-lv1'], 'Advanced trend identification: ADX, momentum divergence, trend exhaustion signals'),
  t('trend-following-lv3', 'Trend Following Lv3', 'Strategy Mastery', ['trend-following-lv2'], 'Multi-timeframe trend analysis and volatility-adjusted position sizing'),
  t('range-trading-lv1', 'Range Trading Lv1', 'Strategy Mastery', ['support-resistance-lv2'], 'Trade bounces within established support/resistance zones'),
  t('range-trading-lv2', 'Range Trading Lv2', 'Strategy Mastery', ['range-trading-lv1'], 'Volume-based range identification, false breakout detection'),
  t('range-trading-lv3', 'Range Trading Lv3', 'Strategy Mastery', ['range-trading-lv2'], 'Dynamic range adjustment based on volatility, mean reversion optimization'),
  t('breakout-trading-lv1', 'Breakout Trading Lv1', 'Strategy Mastery', ['volatility-analysis-lv2'], 'Trade breakouts from consolidation zones around catalysts'),
  t('breakout-trading-lv2', 'Breakout Trading Lv2', 'Strategy Mastery', ['breakout-trading-lv1'], 'Volume confirmation, false breakout filtering, news event timing'),
  t('breakout-trading-lv3', 'Breakout Trading Lv3', 'Strategy Mastery', ['breakout-trading-lv2'], 'Multi-leg breakouts, fading vs. chasing, runaway gap recognition'),
  t('scalping-day-trading-lv1', 'Scalping & Day Trading Lv1', 'Strategy Mastery', ['technical-analysis-lv2'], 'Rapid entries/exits within intraday moves, microstructure awareness'),
  t('swing-trading-lv1', 'Swing Trading Lv1', 'Strategy Mastery', ['trend-following-lv2'], 'Hold 2-10 day swings on secondary retracements'),
  t('carry-trade-lv1', 'Carry Trade Strategy Lv1', 'Strategy Mastery', ['interest-rate-differentials-lv2', 'currency-pairs-lv2'], 'Exploit rate differentials in EURUSD, GBPUSD, USDJPY, emerging market pairs'),
  t('statistical-arbitrage-lv1', 'Statistical Arbitrage Lv1', 'Strategy Mastery', ['correlation-analysis-lv2', 'statistical-modeling-lv2'], 'Mean reversion using pairs trading and correlation breakdowns'),
  t('options-derivatives-lv1', 'Options & Derivatives Lv1', 'Strategy Mastery', ['volatility-analysis-lv2'], 'Understand Greeks (delta, gamma, vega, theta), basic option strategies'),
  t('multi-asset-correlation-lv1', 'Multi-Asset Correlation Trading Lv1', 'Strategy Mastery', ['correlation-analysis-lv2'], 'Trade breakdowns/buildups in multi-asset correlation (bonds/equities/commodities/FX)'),

  // ════════ TRADING · Instrument Mastery (15) ════════
  t('eurusd-mastery-lv1', 'EURUSD Mastery Lv1', 'Instrument Mastery', ['currency-pairs-lv1'], 'EUR-zone economic data sensitivity, ECB policy impact'),
  t('eurusd-mastery-lv2', 'EURUSD Mastery Lv2', 'Instrument Mastery', ['eurusd-mastery-lv1'], 'Relative growth differentials, capital flows, political risk'),
  t('gbpusd-mastery-lv1', 'GBPUSD Mastery Lv1', 'Instrument Mastery', ['currency-pairs-lv1'], 'UK economic data, Brexit-era policy, BoE decision sensitivity'),
  t('usdjpy-mastery-lv1', 'USDJPY Mastery Lv1', 'Instrument Mastery', ['currency-pairs-lv1', 'carry-trade-lv1'], 'Yen as safe haven, rate differentials, risk-on/off correlation'),
  t('usdjpy-mastery-lv2', 'USDJPY Mastery Lv2', 'Instrument Mastery', ['usdjpy-mastery-lv1'], 'BOJ intervention, geopolitical risk flows, technical zone levels'),
  t('commodity-pairs-lv1', 'Commodity Pairs Lv1', 'Instrument Mastery', ['currency-pairs-lv1'], 'AUDUSD, NZDUSD, CADUSD — commodity linked currencies'),
  t('emerging-market-fx-lv1', 'Emerging Market FX Lv1', 'Instrument Mastery', ['currency-pairs-lv1'], 'USDMXN, USDBRL, USDRUB — high yield, higher volatility'),
  t('gold-mastery-lv1', 'Gold (XAUUSD) Mastery Lv1', 'Instrument Mastery', ['commodity-markets-lv1'], 'Real yields, USD strength, risk-off flows, geopolitical premium'),
  t('gold-mastery-lv2', 'Gold (XAUUSD) Mastery Lv2', 'Instrument Mastery', ['gold-mastery-lv1'], 'Seasonal patterns, mining supply cycles, central bank demand'),
  t('silver-mastery-lv1', 'Silver (XAGUSD) Mastery Lv1', 'Instrument Mastery', ['commodity-markets-lv1'], 'Industrial demand sensitivity, gold ratio dynamics'),
  t('crude-oil-mastery-lv1', 'Crude Oil Mastery Lv1', 'Instrument Mastery', ['commodity-markets-lv1'], 'OPEC politics, inventory data, supply/demand cycles'),
  t('bitcoin-mastery-lv1', 'Bitcoin Mastery Lv1', 'Instrument Mastery', ['crypto-fundamentals-lv1'], 'Risk-asset correlation, halving cycles, regulatory sentiment'),
  t('bitcoin-mastery-lv2', 'Bitcoin Mastery Lv2', 'Instrument Mastery', ['bitcoin-mastery-lv1'], 'On-chain analysis, institutional adoption, macro regime correlation shifts'),
  t('altcoin-trading-lv1', 'Altcoin Trading Lv1', 'Instrument Mastery', ['crypto-fundamentals-lv2'], 'Ethereum, major alts — market cap weighting, beta dynamics'),
  t('index-futures-lv1', 'Index Futures Lv1', 'Instrument Mastery', ['market-microstructure-lv1'], 'S&P 500, NASDAQ, DAX, Nikkei — equity beta hedging and correlation'),

  // ════════ TRADING · Risk & Position Management (12) ════════
  t('position-sizing-lv1', 'Position Sizing Lv1', 'Risk & Position Management', [], 'Risk-per-trade approach: 1-2% account risk max'),
  t('position-sizing-lv2', 'Position Sizing Lv2', 'Risk & Position Management', ['position-sizing-lv1'], 'Kelly criterion, volatility-adjusted sizing, correlation adjustment'),
  t('position-sizing-lv3', 'Position Sizing Lv3', 'Risk & Position Management', ['position-sizing-lv2'], 'Portfolio-level optimization, leverage curves, drawdown protection'),
  t('stop-loss-placement-lv1', 'Stop-Loss Placement Lv1', 'Risk & Position Management', ['position-sizing-lv2'], 'ATR-based, support/resistance-based, time-based stops'),
  t('stop-loss-placement-lv2', 'Stop-Loss Placement Lv2', 'Risk & Position Management', ['stop-loss-placement-lv1'], 'Trailing stops, volatility-based adjustment, breakeven management'),
  t('portfolio-risk-lv1', 'Portfolio Risk Management Lv1', 'Risk & Position Management', ['position-sizing-lv2'], 'Max daily loss limits, max weekly loss limits, account drawdown caps'),
  t('portfolio-risk-lv2', 'Portfolio Risk Management Lv2', 'Risk & Position Management', ['portfolio-risk-lv1'], 'Correlation-based hedging, sector exposure limits, concentration risk'),
  t('leverage-management-lv1', 'Leverage Management Lv1', 'Risk & Position Management', ['position-sizing-lv1'], 'Understanding margin, avoiding overleveraging, leverage decay in drawdowns'),
  t('drawdown-recovery-lv1', 'Drawdown Recovery Planning Lv1', 'Risk & Position Management', ['portfolio-risk-lv1'], 'Path to recovery, drawdown psychology, when to reduce size'),
  t('volatility-adjustment-lv1', 'Volatility Adjustment Lv1', 'Risk & Position Management', ['volatility-analysis-lv1'], 'Reducing size in high volatility, increasing size in low volatility'),
  t('slippage-spread-lv1', 'Slippage & Spread Management Lv1', 'Risk & Position Management', [], 'Broker spread costs, slippage in fast markets, limit vs. market orders'),
  t('liquidity-management-lv1', 'Liquidity Management Lv1', 'Risk & Position Management', ['market-microstructure-lv1'], 'Bid-ask depth, avoiding illiquid pairs/times, size limits'),

  // ════════ TRADING · Macro Analysis (12) ════════
  t('central-bank-policy-lv1', 'Central Bank Policy Lv1', 'Macro Analysis', [], 'Fed, ECB, BOE, BOJ rate decisions and forward guidance'),
  t('central-bank-policy-lv2', 'Central Bank Policy Lv2', 'Macro Analysis', ['central-bank-policy-lv1'], 'QT, QE cycles, balance sheet impact, emergency tools'),
  t('interest-rate-differentials-lv1', 'Interest Rate Differentials Lv1', 'Macro Analysis', ['central-bank-policy-lv1'], 'Carry trade basics: why USDJPY and emerging market pairs move'),
  t('interest-rate-differentials-lv2', 'Interest Rate Differentials Lv2', 'Macro Analysis', ['interest-rate-differentials-lv1'], 'Real vs. nominal rates, term structure, forward rates'),
  t('yield-curves-lv1', 'Yield Curves Lv1', 'Macro Analysis', ['interest-rate-differentials-lv1'], 'Normal, flat, inverted curves; Fed policy impact'),
  t('yield-curves-lv2', 'Yield Curves Lv2', 'Macro Analysis', ['yield-curves-lv1'], 'Curve steepening/flattening trades, duration risk'),
  t('inflation-cpi-lv1', 'Inflation & CPI Lv1', 'Macro Analysis', [], 'CPI data releases, core vs. headline, inflation expectations market impact'),
  t('inflation-cpi-lv2', 'Inflation & CPI Lv2', 'Macro Analysis', ['inflation-cpi-lv1'], 'Real yields calculation, deflation risk, stagflation scenarios'),
  t('employment-data-lv1', 'Employment Data Lv1', 'Macro Analysis', [], 'NFP, jobless claims, wage growth, labor market slack'),
  t('gdp-growth-data-lv1', 'GDP & Growth Data Lv1', 'Macro Analysis', [], 'GDP growth rates, PMI, ISM, regional manufacturing data'),
  t('capital-flows-lv1', 'Currency & Capital Flows Lv1', 'Macro Analysis', [], 'Portfolio flows, emerging market flows, dollar demand cycles'),
  t('geopolitical-risk-macro-lv1', 'Geopolitical Risk Assessment Lv1', 'Macro Analysis', [], 'Sanctions, war, elections — geopolitical impact on markets'),

  // ════════ TRADING · Trading Psychology (6) ════════
  t('emotional-regulation-lv1', 'Emotional Regulation Lv1', 'Trading Psychology', [], 'Managing fear, greed, FOMO, revenge trading urges'),
  t('emotional-regulation-lv2', 'Emotional Regulation Lv2', 'Trading Psychology', ['emotional-regulation-lv1'], 'Trauma from big losses, overconfidence after wins, burnout recovery'),
  t('discipline-execution-lv1', 'Discipline & Execution Lv1', 'Trading Psychology', [], 'Sticking to plan, honoring stops, taking profits at target'),
  t('win-loss-processing-lv1', 'Win/Loss Processing Lv1', 'Trading Psychology', [], 'Learning from losses without shame, celebrating wins without complacency'),
  t('losing-streak-recovery-lv1', 'Losing Streak Recovery Lv1', 'Trading Psychology', ['emotional-regulation-lv1'], 'Mental resilience during drawdowns, when to reduce size, when to take breaks'),
  t('decision-confidence-lv1', 'Decision Confidence Calibration Lv1', 'Trading Psychology', [], 'Honest self-assessment: edge vs. illusion, confidence vs. overconfidence'),

  // ════════ FINANCE · Valuation (12) ════════
  f('dcf-analysis-lv1', 'DCF Analysis Lv1', 'Valuation', [], 'Discounted cash flow: WACC, terminal value, sensitivity analysis'),
  f('dcf-analysis-lv2', 'DCF Analysis Lv2', 'Valuation', ['dcf-analysis-lv1'], 'Scenario analysis, Monte Carlo, path dependency'),
  f('dcf-analysis-lv3', 'DCF Analysis Lv3', 'Valuation', ['dcf-analysis-lv2'], 'Enterprise value adjustments, tax shields, real option valuation'),
  f('comparables-lv1', 'Comparables (Multiples) Lv1', 'Valuation', [], 'EV/EBITDA, P/E, P/B, P/S, PEG ratios and peer benchmarking'),
  f('comparables-lv2', 'Comparables (Multiples) Lv2', 'Valuation', ['comparables-lv1'], 'Adjusting for growth, leverage, cyclicality; transaction comps'),
  f('asset-based-valuation-lv1', 'Asset-Based Valuation Lv1', 'Valuation', [], 'Book value, NAV, liquidation value, tangible book value'),
  f('dividend-discount-model-lv1', 'Dividend Discount Model Lv1', 'Valuation', ['dcf-analysis-lv1'], 'Valuation based on dividend streams, dividend growth assumptions'),
  f('relative-valuation-lv1', 'Relative Valuation Lv1', 'Valuation', ['comparables-lv1'], 'Cross-market comparisons, basis point to multiple conversion'),
  f('enterprise-value-lv1', 'Enterprise Value Lv1', 'Valuation', [], 'Market cap + debt - cash; equity vs. enterprise valuation'),
  f('sum-of-parts-lv1', 'Sum-of-Parts Valuation Lv1', 'Valuation', ['dcf-analysis-lv1'], 'Separating by business segment, conglomerate discount'),
  f('wacc-calculation-lv1', 'WACC Calculation Lv1', 'Valuation', [], 'Weighted average cost of capital; cost of equity, cost of debt'),
  f('terminal-value-lv1', 'Terminal Value Estimation Lv1', 'Valuation', ['dcf-analysis-lv1'], 'Perpetual growth method, exit multiple method, sustainable growth'),

  // ════════ FINANCE · Corporate Finance (12) ════════
  f('capital-structure-lv1', 'Capital Structure Lv1', 'Corporate Finance', [], 'Debt vs. equity, leverage ratios, optimal capital structure'),
  f('ma-strategy-lv1', 'M&A Strategy Lv1', 'Corporate Finance', [], 'Strategic vs. financial buyers, deal rationales, synergy identification'),
  f('deal-structure-lv1', 'Deal Structure Lv1', 'Corporate Finance', ['ma-strategy-lv1'], 'Stock vs. cash, earnouts, collars, voting structures'),
  f('lbo-analysis-lv1', 'LBO Analysis Lv1', 'Corporate Finance', ['capital-structure-lv1'], 'Leveraged buyout mechanics, EBITDA multiples, IRR optimization'),
  f('lbo-analysis-lv2', 'LBO Analysis Lv2', 'Corporate Finance', ['lbo-analysis-lv1'], 'Cascade debt structures, PIK toggles, covenant packages'),
  f('synergy-analysis-lv1', 'Synergy Analysis Lv1', 'Corporate Finance', ['ma-strategy-lv1'], 'Revenue synergies, cost synergies, working capital optimization'),
  f('dividend-policy-lv1', 'Dividend Policy Lv1', 'Corporate Finance', [], 'Payout ratios, dividend growth, buyback vs. dividends'),
  f('cost-of-capital-lv1', 'Cost of Capital Lv1', 'Corporate Finance', [], 'CAPM, beta estimation, risk premiums'),
  f('corporate-restructuring-lv1', 'Corporate Restructuring Lv1', 'Corporate Finance', ['capital-structure-lv1'], 'Spin-offs, divestitures, recapitalization'),
  f('bankruptcy-distress-lv1', 'Bankruptcy & Distress Lv1', 'Corporate Finance', [], 'Debt restructuring, Chapter 11, recovery scenarios'),
  f('ipo-capital-raising-lv1', 'IPO & Capital Raising Lv1', 'Corporate Finance', [], 'IPO process, SPAC, secondary offerings, capital efficiency'),
  f('shareholder-value-lv1', 'Shareholder Value Creation Lv1', 'Corporate Finance', [], 'ROE, ROIC, EVA, shareholder yield metrics'),

  // ════════ FINANCE · Investment Analysis (12) ════════
  f('equity-research-lv1', 'Equity Research Lv1', 'Investment Analysis', ['dcf-analysis-lv1', 'comparables-lv1'], 'Stock picking framework, bull/bear case development'),
  f('equity-research-lv2', 'Equity Research Lv2', 'Investment Analysis', ['equity-research-lv1'], 'Deep industry analysis, competitive positioning, risk factors'),
  f('fixed-income-analysis-lv1', 'Fixed Income Analysis Lv1', 'Investment Analysis', [], 'Bond yields, credit spreads, duration, convexity'),
  f('credit-analysis-lv1', 'Credit Analysis Lv1', 'Investment Analysis', ['fixed-income-analysis-lv1'], 'Default risk assessment, credit ratios, CDS spreads'),
  f('real-estate-investment-lv1', 'Real Estate Investment Lv1', 'Investment Analysis', ['dcf-analysis-lv1'], 'Cap rates, NOI, REIT analysis, property valuation'),
  f('commodities-metals-lv1', 'Commodities & Precious Metals Lv1', 'Investment Analysis', [], 'Futures curves, supply/demand, storage costs, convenience yields'),
  f('crypto-asset-analysis-lv1', 'Crypto Asset Analysis Lv1', 'Investment Analysis', ['crypto-fundamentals-lv1'], 'On-chain metrics, token economics, protocol analysis'),
  f('portfolio-construction-lv1', 'Portfolio Construction Lv1', 'Investment Analysis', [], 'Asset allocation, diversification, correlation, rebalancing'),
  f('risk-adjusted-returns-lv1', 'Risk-Adjusted Returns Lv1', 'Investment Analysis', [], 'Sharpe ratio, Sortino ratio, information ratio, alpha/beta'),
  f('scenario-analysis-lv1', 'Scenario Analysis Lv1', 'Investment Analysis', [], 'Base case, bull case, bear case; tail risk assessment'),
  f('market-timing-lv1', 'Market Timing vs. Timing-Free Lv1', 'Investment Analysis', [], 'Dollar-cost averaging, tactical allocation, rebalancing bands'),
  f('value-vs-growth-lv1', 'Value vs. Growth Investing Lv1', 'Investment Analysis', [], 'Value trap detection, growth-at-reasonable-price (GARP)'),

  // ════════ FINANCE · Financial Modeling (8) ════════
  f('excel-mastery-lv1', 'Excel Mastery Lv1', 'Financial Modeling', [], 'Pivot tables, VBA, complex formulas, sensitivity tables'),
  f('three-statement-modeling-lv1', '3-Statement Modeling Lv1', 'Financial Modeling', [], 'Income statement, balance sheet, cash flow linkages'),
  f('projection-building-lv1', 'Projection Building Lv1', 'Financial Modeling', ['three-statement-modeling-lv1'], 'Revenue drivers, COGS, working capital, capex forecasting'),
  f('lbo-modeling-lv1', 'LBO Modeling Lv1', 'Financial Modeling', ['lbo-analysis-lv1'], 'Debt schedule, sources & uses, IRR calculation'),
  f('ma-modeling-lv1', 'M&A Modeling Lv1', 'Financial Modeling', ['deal-structure-lv1'], 'Accretion/dilution, purchase accounting, integration assumptions'),
  f('sensitivity-analysis-lv1', 'Sensitivity Analysis Lv1', 'Financial Modeling', [], 'Two-way tables, scenario outputs, tornado diagrams'),
  f('option-pricing-lv1', 'Option Pricing Lv1', 'Financial Modeling', [], 'Black-Scholes, binomial trees, implied volatility'),
  f('python-finance-lv1', 'Python for Finance Lv1', 'Financial Modeling', [], 'Pandas, numpy, matplotlib for financial analysis and modeling'),

  // ════════ FINANCE · Risk Management (6) ════════
  f('var-lv1', 'Value at Risk (VaR) Lv1', 'Risk Management', [], 'Historical, parametric, Monte Carlo VaR methods'),
  f('stress-testing-lv1', 'Stress Testing Lv1', 'Risk Management', [], 'Scenario analysis for tail events, correlation breakdowns'),
  f('hedging-strategies-lv1', 'Hedging Strategies Lv1', 'Risk Management', [], 'Natural hedges, derivatives hedging, cost-benefit tradeoffs'),
  f('counterparty-risk-lv1', 'Counterparty Risk Lv1', 'Risk Management', [], 'Credit exposure, netting, collateral agreements'),
  f('liquidity-risk-lv1', 'Liquidity Risk Lv1', 'Risk Management', [], 'Funding risk, market liquidity, liquidity coverage ratios'),
  f('operational-risk-lv1', 'Operational Risk Lv1', 'Risk Management', [], 'People, processes, systems, compliance risks'),

  // ════════ KNOWLEDGE · Macro Economics (15) ════════
  k('macro-theory-lv1', 'Macroeconomic Theory Lv1', 'Macro Economics', [], 'Keynesian, supply-side, rational expectations, MMT'),
  k('business-cycle-lv1', 'Business Cycle Theory Lv1', 'Macro Economics', [], 'Expansion, peak, contraction, trough; leading/lagging/coincident indicators'),
  k('recession-forecasting-lv1', 'Recession Forecasting Lv1', 'Macro Economics', ['business-cycle-lv1'], 'Yield curve inversion, PMI contraction, unemployment trends'),
  k('inflation-theory-lv1', 'Inflation Theory Lv1', 'Macro Economics', [], 'Demand-pull, cost-push, expectations-driven, structural inflation'),
  k('labor-economics-lv1', 'Unemployment & Labor Economics Lv1', 'Macro Economics', [], 'NAIRU, Phillips curve, wage pressure, labor productivity'),
  k('growth-theory-lv1', 'Growth Theory Lv1', 'Macro Economics', [], 'Solow model, endogenous growth, productivity, secular stagnation'),
  k('exchange-rate-theory-lv1', 'Exchange Rate Theory Lv1', 'Macro Economics', [], 'PPP, UIRP, portfolio balance approach, order flow'),
  k('trade-theory-lv1', 'Trade & Comparative Advantage Lv1', 'Macro Economics', [], 'Ricardian model, factor endowments, protectionism impact'),
  k('debt-cycles-lv1', 'Debt Cycles Lv1', 'Macro Economics', [], 'Private sector, public sector, sovereign debt dynamics'),
  k('financial-crises-lv1', 'Financial Crises Lv1', 'Macro Economics', [], 'Bank runs, asset bubbles, leverage cycles, contagion'),
  k('monetary-transmission-lv1', 'Monetary Policy Transmission Lv1', 'Macro Economics', [], 'Policy rates, money supply, credit channels, expectations channel'),
  k('fiscal-policy-lv1', 'Fiscal Policy & Stimulus Lv1', 'Macro Economics', [], 'Multipliers, debt sustainability, deficit dynamics'),
  k('currency-devaluation-lv1', 'Currency Devaluation & Revaluation Lv1', 'Macro Economics', [], 'Competitive devaluation, pass-through effects, reserve currency status'),
  k('monetary-systems-lv1', 'Gold Standard & Monetary Systems Lv1', 'Macro Economics', [], 'Bretton Woods, fiat systems, crypto as money, CBDCs'),
  k('em-macro-lv1', 'Emerging Market Macroeconomics Lv1', 'Macro Economics', [], 'Commodity dependence, capital flight, capital controls, EM crises'),

  // ════════ KNOWLEDGE · Market Structure (12) ════════
  k('market-microstructure-lv1', 'Market Microstructure Lv1', 'Market Structure', [], 'Bid-ask spreads, market impact, inventory models, order flow'),
  k('electronic-trading-lv1', 'Electronic Trading Systems Lv1', 'Market Structure', [], 'Central limit order books, matching engines, latency, HFT'),
  k('broker-dealer-lv1', 'Broker-Dealer Models Lv1', 'Market Structure', [], 'Market makers, agency brokers, payment for order flow'),
  k('clearing-settlement-lv1', 'Central Clearing & Settlement Lv1', 'Market Structure', [], 'CCPs, T+2 settlement, DVP, OTC vs. exchange-traded'),
  k('regulatory-framework-lv1', 'Regulatory Framework Lv1', 'Market Structure', [], 'SEC, CFTC, MiFID II, market abuse regulations, position limits'),
  k('index-construction-lv1', 'Index Construction Lv1', 'Market Structure', [], 'Market-cap weighting, equal weighting, rules-based indices'),
  k('etfs-lv1', 'Exchange-Traded Funds (ETFs) Lv1', 'Market Structure', ['index-construction-lv1'], 'Creation/redemption mechanism, tracking error, factor ETFs'),
  k('derivatives-markets-lv1', 'Derivatives Markets Lv1', 'Market Structure', [], 'Futures, options, swaps ecosystem, standardization, leverage'),
  k('crypto-exchanges-lv1', 'Cryptocurrency Exchanges Lv1', 'Market Structure', [], 'CEX vs. DEX, liquidity pools, automated market makers, slippage'),
  k('repo-markets-lv1', 'Repo Markets Lv1', 'Market Structure', [], 'Repo mechanics, haircuts, systemic liquidity, 2008 crisis role'),
  k('fixed-income-markets-lv1', 'Fixed Income Markets Lv1', 'Market Structure', [], 'Treasury market, corporate bonds, MBS, OTC trading'),
  k('commodity-futures-lv1', 'Commodity Futures & Options Lv1', 'Market Structure', [], 'Contango, backwardation, roll yields, hedging vs. speculation'),

  // ════════ KNOWLEDGE · Technical Analysis (14) ════════
  k('technical-analysis-lv1', 'Technical Analysis Lv1', 'Technical Analysis', [], 'Core chart reading: price action, structure, timeframes'),
  k('technical-analysis-lv2', 'Technical Analysis Lv2', 'Technical Analysis', ['technical-analysis-lv1'], 'Confluence: combining structure, momentum, volume into setups'),
  k('support-resistance-lv1', 'Support & Resistance Lv1', 'Technical Analysis', [], 'Horizontal levels, trend lines, moving averages, Fibonacci'),
  k('support-resistance-lv2', 'Support & Resistance Lv2', 'Technical Analysis', ['support-resistance-lv1'], 'Dynamic support/resistance, market structure, order flow clustering'),
  k('chart-patterns-lv1', 'Chart Patterns Lv1', 'Technical Analysis', [], 'Head & shoulders, triangles, flags, cup & handle, wedges'),
  k('candlestick-analysis-lv1', 'Candlestick Analysis Lv1', 'Technical Analysis', [], 'Engulfing, doji, hammer, shooting star patterns'),
  k('volume-analysis-lv1', 'Volume Analysis Lv1', 'Technical Analysis', [], 'Volume trends, on-balance volume (OBV), volume-price confirmation'),
  k('momentum-indicators-lv1', 'Momentum Indicators Lv1', 'Technical Analysis', [], 'RSI, MACD, Stochastic, CCI, momentum oscillators'),
  k('moving-averages-lv1', 'Moving Averages Lv1', 'Technical Analysis', [], 'SMA, EMA, crossovers, lag, exponential smoothing'),
  k('bollinger-volatility-lv1', 'Bollinger Bands & Volatility Lv1', 'Technical Analysis', ['moving-averages-lv1'], 'Standard deviation bands, mean reversion, squeeze setups'),
  k('elliott-wave-lv1', 'Elliott Wave Theory Lv1', 'Technical Analysis', [], '5-3 structure, impulse & corrective waves, Fibonacci ratios'),
  k('wyckoff-method-lv1', 'Wyckoff Method Lv1', 'Technical Analysis', [], 'Accumulation, markup, distribution, markdown phases'),
  k('market-profile-lv1', 'Market Profile Lv1', 'Technical Analysis', [], 'Point of control, value area, volume profile trading'),
  k('ichimoku-lv1', 'Ichimoku Cloud Lv1', 'Technical Analysis', [], 'Tenkan-sen, kijun-sen, cloud, lagging span'),

  // ════════ KNOWLEDGE · Quantitative Foundations (7, added — spec prereqs referenced these) ════════
  k('volatility-analysis-lv1', 'Volatility Analysis Lv1', 'Quantitative Foundations', [], 'ATR, historical vs. implied volatility, volatility regimes'),
  k('volatility-analysis-lv2', 'Volatility Analysis Lv2', 'Quantitative Foundations', ['volatility-analysis-lv1'], 'Volatility clustering, term structure, vol-of-vol, event vol'),
  k('correlation-analysis-lv1', 'Correlation Analysis Lv1', 'Quantitative Foundations', [], 'Pearson correlation, rolling correlation, spurious correlation traps'),
  k('correlation-analysis-lv2', 'Correlation Analysis Lv2', 'Quantitative Foundations', ['correlation-analysis-lv1'], 'Cross-asset correlation regimes, breakdown detection, cointegration'),
  k('statistical-modeling-lv1', 'Statistical Modeling Lv1', 'Quantitative Foundations', [], 'Distributions, hypothesis testing, regression basics'),
  k('statistical-modeling-lv2', 'Statistical Modeling Lv2', 'Quantitative Foundations', ['statistical-modeling-lv1'], 'Time series, stationarity, mean reversion tests, overfitting control'),
  k('commodity-markets-lv1', 'Commodity Markets Lv1', 'Quantitative Foundations', [], 'Physical vs. paper markets, supply/demand drivers, seasonality'),

  // ════════ KNOWLEDGE · FX Foundations (2, added) ════════
  k('currency-pairs-lv1', 'Currency Pairs Lv1', 'FX Foundations', [], 'Majors, crosses, quote conventions, pip mechanics, session behavior'),
  k('currency-pairs-lv2', 'Currency Pairs Lv2', 'FX Foundations', ['currency-pairs-lv1'], 'Pair personalities, correlation clusters, liquidity windows'),

  // ════════ KNOWLEDGE · Behavioral Finance (10) ════════
  k('cognitive-biases-lv1', 'Cognitive Biases Lv1', 'Behavioral Finance', [], 'Confirmation bias, anchoring, availability heuristic, overconfidence'),
  k('prospect-theory-lv1', 'Prospect Theory Lv1', 'Behavioral Finance', [], 'Loss aversion, reference points, risk attitudes, value functions'),
  k('herd-behavior-lv1', 'Herd Behavior & Bubbles Lv1', 'Behavioral Finance', [], 'Bubble formation, momentum chasing, crash dynamics'),
  k('market-anomalies-lv1', 'Market Anomalies Lv1', 'Behavioral Finance', [], 'January effect, momentum, mean reversion, size/value premium'),
  k('sentiment-analysis-lv1', 'Sentiment Analysis Lv1', 'Behavioral Finance', [], 'Fear & greed indices, media sentiment, positioning extremes'),
  k('market-efficiency-lv1', 'Market Efficiency Lv1', 'Behavioral Finance', [], 'EMH, semi-strong form, weak-form efficiency, behavioral anomalies'),
  k('endowment-framing-lv1', 'Endowment Effect & Framing Lv1', 'Behavioral Finance', [], 'How people value what they own, decision framing effects'),
  k('sunk-cost-lv1', 'Sunk Cost Fallacy & Escalation Lv1', 'Behavioral Finance', [], 'Ignoring sunk costs, escalation of commitment in losing trades'),
  k('overconfidence-lv1', 'Overconfidence & Skill Illusion Lv1', 'Behavioral Finance', [], 'Trader overconfidence, skill vs. luck illusion, backfitting'),
  k('narratives-lv1', 'Narratives & Story-Telling Lv1', 'Behavioral Finance', [], 'How narrative drives markets, Tesla effect, meme stocks'),

  // ════════ KNOWLEDGE · Crypto & Digital Assets (8) ════════
  k('crypto-fundamentals-lv1', 'Crypto Fundamentals Lv1', 'Crypto & Digital Assets', [], 'Blockchain, distributed ledgers, consensus, mining/staking'),
  k('crypto-fundamentals-lv2', 'Crypto Fundamentals Lv2', 'Crypto & Digital Assets', ['crypto-fundamentals-lv1'], 'Smart contracts, DeFi, tokenomics, governance'),
  k('on-chain-analysis-lv1', 'On-Chain Analysis Lv1', 'Crypto & Digital Assets', ['crypto-fundamentals-lv1'], 'UTXO, address clustering, whale watching, transaction flows'),
  k('defi-protocols-lv1', 'DeFi Protocols Lv1', 'Crypto & Digital Assets', ['crypto-fundamentals-lv2'], 'Lending, swaps, staking, liquidity provision, impermanent loss'),
  k('nft-ownership-lv1', 'NFT & Digital Ownership Lv1', 'Crypto & Digital Assets', ['crypto-fundamentals-lv1'], 'ERC-721, ERC-1155, metadata, royalties, use cases'),
  k('bitcoin-protocol-lv1', 'Bitcoin Protocol Lv1', 'Crypto & Digital Assets', ['crypto-fundamentals-lv1'], 'UTXO model, PoW, halving cycles, network effects'),
  k('ethereum-protocol-lv1', 'Ethereum Protocol Lv1', 'Crypto & Digital Assets', ['crypto-fundamentals-lv1'], 'EVM, gas, state, PoS, scaling solutions'),
  k('stablecoin-mechanics-lv1', 'Stablecoin Mechanics Lv1', 'Crypto & Digital Assets', ['crypto-fundamentals-lv1'], 'Collateralized, algorithmic, seigniorage, reserve audit'),

  // ════════ KNOWLEDGE · Geopolitics & Markets (3) ════════
  k('geopolitical-risk-lv1', 'Geopolitical Risk Assessment Lv1', 'Geopolitics & Markets', [], 'Wars, sanctions, elections, trade tensions; market impact'),
  k('energy-geopolitics-lv1', 'Energy Geopolitics Lv1', 'Geopolitics & Markets', ['geopolitical-risk-lv1'], 'Oil markets, Russian gas, Middle East conflicts, OPEC+'),
  k('tech-geopolitics-lv1', 'Tech Geopolitics Lv1', 'Geopolitics & Markets', ['geopolitical-risk-lv1'], 'US-China tech war, semiconductors, rare earths, Taiwan risk'),

  // ════════ SOFT SKILLS · Communication (6) ════════
  s('presentation-skills-lv1', 'Presentation Skills Lv1', 'Communication', [], 'Structuring pitch decks, delivery, Q&A handling'),
  s('presentation-skills-lv2', 'Presentation Skills Lv2', 'Communication', ['presentation-skills-lv1'], 'Storytelling, handling hostile audiences, persuasion'),
  s('written-communication-lv1', 'Written Communication Lv1', 'Communication', [], 'Investment memos, reports, clarity, brevity'),
  s('negotiation-lv1', 'Negotiation Lv1', 'Communication', [], 'M&A negotiations, term sheet terms, value creation'),
  s('stakeholder-comm-lv1', 'Stakeholder Management Lv1', 'Communication', ['presentation-skills-lv1'], 'Board management, investor relations, managing up'),
  s('public-speaking-lv1', 'Public Speaking Lv1', 'Communication', [], 'Conference talks, earnings calls, media'),

  // ════════ SOFT SKILLS · Leadership (6) ════════
  s('team-leadership-lv1', 'Team Leadership Lv1', 'Leadership', [], 'Delegation, motivation, feedback, performance management'),
  s('decision-uncertainty-lv1', 'Decision-Making Under Uncertainty Lv1', 'Leadership', [], 'Probabilistic thinking, scenario planning, commitment'),
  s('conflict-resolution-lv1', 'Conflict Resolution Lv1', 'Leadership', [], 'Mediating disagreements, finding common ground'),
  s('strategic-thinking-lv1', 'Strategic Thinking Lv1', 'Leadership', [], 'Long-term planning, competitive advantage, positioning'),
  s('change-management-lv1', 'Change Management Lv1', 'Leadership', ['team-leadership-lv1'], 'Leading through uncertainty, organizational change, resistance'),
  s('mentoring-coaching-lv1', 'Mentoring & Coaching Lv1', 'Leadership', ['team-leadership-lv1'], 'Developing talent, one-on-ones, growth planning'),

  // ════════ SOFT SKILLS · Resilience & Adaptability (5) ════════
  s('stress-management-lv1', 'Stress Management Lv1', 'Resilience & Adaptability', [], 'Coping with pressure, burnout prevention, recovery'),
  s('failure-recovery-lv1', 'Failure Recovery Lv1', 'Resilience & Adaptability', [], 'Learning from failure, rebuilding after loss, anti-fragility'),
  s('adaptability-lv1', 'Adaptability Lv1', 'Resilience & Adaptability', [], 'Pivoting in changing markets, flexibility, learning agility'),
  s('self-awareness-lv1', 'Self-Awareness Lv1', 'Resilience & Adaptability', [], 'Emotional intelligence, personality traits, strengths/weaknesses'),
  s('networking-lv1', 'Networking & Relationship Building Lv1', 'Resilience & Adaptability', [], 'Building genuine relationships, mentorship networks, opportunities'),

  // ════════ SOFT SKILLS · Stakeholder Management (3) ════════
  s('client-relationship-lv1', 'Client Relationship Management Lv1', 'Stakeholder Management', [], 'Understanding needs, managing expectations, long-term value'),
  s('vendor-partner-lv1', 'Vendor & Partner Management Lv1', 'Stakeholder Management', [], 'Negotiating terms, managing performance, cost optimization'),
  s('board-executive-lv1', 'Board & Executive Management Lv1', 'Stakeholder Management', ['presentation-skills-lv1'], 'Board reporting, executive alignment, governance'),

  // ════════ DISCIPLINE (10) ════════
  d('trading-discipline-lv1', 'Trading Discipline Lv1', 'Trading Discipline', [], 'Honoring stops, following system, no revenge trading'),
  d('trading-discipline-lv2', 'Trading Discipline Lv2', 'Trading Discipline', ['trading-discipline-lv1'], 'Journaling every trade, reviewing systematically, continuous improvement'),
  d('trading-discipline-lv3', 'Trading Discipline Lv3', 'Trading Discipline', ['trading-discipline-lv2'], 'Maintaining discipline in long winners/losers, avoiding overconfidence'),
  d('learning-discipline-lv1', 'Learning Discipline Lv1', 'Learning Discipline', [], 'Daily reading, course attendance, concept application'),
  d('learning-discipline-lv2', 'Learning Discipline Lv2', 'Learning Discipline', ['learning-discipline-lv1'], 'Spaced repetition, Zettelkasten, knowledge integration'),
  d('financial-discipline-lv1', 'Financial Discipline Lv1', 'Financial Discipline', [], 'Budget adherence, no emotional spending, savings goals'),
  d('financial-discipline-lv2', 'Financial Discipline Lv2', 'Financial Discipline', ['financial-discipline-lv1'], 'Net worth tracking, no excessive leverage, long-term thinking'),
  d('health-discipline-lv1', 'Health Discipline Lv1', 'Health Discipline', [], 'Exercise consistency, sleep hygiene, meditation practice'),
  d('health-discipline-lv2', 'Health Discipline Lv2', 'Health Discipline', ['health-discipline-lv1'], 'Nutrition optimization, stress recovery, energy management'),
  d('decision-discipline-lv1', 'Decision-Making Discipline Lv1', 'Decision-Making Discipline', [], 'Logged decisions, probabilistic thinking, outcome tracking'),
];

// Base skills get an inferred career track; professional skills carry an explicit one.
export const SKILL_TREE = [
  ...BASE_SKILLS.map((sk) => ({ ...sk, track: inferBaseTrack(sk) })),
  ...PROFESSIONAL_SKILLS,
];

export const SKILL_MAP = Object.fromEntries(SKILL_TREE.map((sk) => [sk.id, sk]));

// Maps the original 20-skill MVP ids onto the expanded tree so existing XP survives migration.
export const LEGACY_SKILL_MAP = {
  'trend-following': 'trend-following-lv1',
  'range-trading': 'range-trading-lv1',
  'breakout-trading': 'breakout-trading-lv1',
  'position-sizing': 'position-sizing-lv1',
  'stop-placement': 'stop-loss-placement-lv1',
  'drawdown-control': 'drawdown-recovery-lv1',
  'emotional-control': 'emotional-regulation-lv1',
  'patience': 'discipline-execution-lv1',
  'journaling-discipline': 'trading-discipline-lv1',
  'technical-analysis': 'technical-analysis-lv1',
  'support-resistance': 'support-resistance-lv1',
  'macro-analysis': 'macro-theory-lv1',
  'financial-accounting': 'three-statement-modeling-lv1',
  'budgeting': 'financial-discipline-lv1',
  'saving-discipline': 'financial-discipline-lv1',
  'net-worth-building': 'financial-discipline-lv2',
  'routine-consistency': 'learning-discipline-lv1',
  'sleep-hygiene': 'health-discipline-lv1',
  'deep-work': 'learning-discipline-lv1',
  'reflection': 'self-awareness-lv1',
};
