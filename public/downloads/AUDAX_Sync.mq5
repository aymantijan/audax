//+------------------------------------------------------------------+
//| AUDAX_Sync.mq5                                                   |
//| Sends your CLOSED positions to AUDAX (Trading journal).          |
//| READ-ONLY: this EA never opens, modifies or closes any trade.    |
//|                                                                  |
//| Setup (once):                                                    |
//|  1. MT5 > Tools > Options > Expert Advisors > tick "Allow        |
//|     WebRequest for listed URL" and add https://vaudax.vercel.app |
//|  2. Copy this file to File > Open Data Folder > MQL5 > Experts,  |
//|     open it in MetaEditor and press Compile (F7).                |
//|  3. Drag "AUDAX_Sync" onto any chart and paste your MT5 sync key |
//|     (AUDAX > Trading > Accounts > MT5 live sync).                |
//| Keep the chart open: it syncs every few minutes and right after  |
//| each closed trade. "Algo Trading" does NOT need to be enabled.   |
//+------------------------------------------------------------------+
#property copyright "AUDAX"
#property version   "1.00"
#property description "Sends closed positions to your AUDAX trading journal. Never places, modifies or closes trades."

input string AudaxUrl         = "https://vaudax.vercel.app/api/mt5-sync"; // AUDAX sync address
input string SyncKey          = "";                                        // MT5 sync key (audaxmt5_...)
input int    DaysBack         = 60;                                        // History sent on the first sync (days)
input int    SyncEveryMinutes = 5;                                         // Regular sync interval (minutes)

datetime g_lastOk      = 0;     // last successful sync (server time)
bool     g_pending     = true;  // a sync is due
int      g_minutes     = 0;
double   g_firstDeposit     = 0;
long     g_firstDepositTime = 0;

string Esc(string s)
  {
   StringReplace(s, "\\", "\\\\");
   StringReplace(s, "\"", "\\\"");
   return s;
  }

// Broker server time minus UTC, in seconds (rounded to 15 minutes).
long ServerOffset()
  {
   long diff = (long)(TimeTradeServer() - TimeGMT());
   return (long)(MathRound(diff / 900.0) * 900);
  }

void FindFirstDeposit(long offset)
  {
   if(!HistorySelect(0, TimeCurrent() + 86400))
      return;
   int total = HistoryDealsTotal();
   for(int i = 0; i < total; i++)
     {
      ulong d = HistoryDealGetTicket(i);
      if(HistoryDealGetInteger(d, DEAL_TYPE) == DEAL_TYPE_BALANCE && HistoryDealGetDouble(d, DEAL_PROFIT) > 0)
        {
         g_firstDeposit     = HistoryDealGetDouble(d, DEAL_PROFIT);
         g_firstDepositTime = (long)HistoryDealGetInteger(d, DEAL_TIME) - offset;
         return;
        }
     }
  }

int OnInit()
  {
   if(StringLen(SyncKey) < 20 || StringFind(SyncKey, "audaxmt5_") != 0)
     {
      Alert("AUDAX Sync: paste your MT5 sync key (starts with audaxmt5_) in the EA inputs.");
      return(INIT_PARAMETERS_INCORRECT);
     }
   FindFirstDeposit(ServerOffset());
   EventSetTimer(60);
   Comment("AUDAX Sync: starting...");
   return(INIT_SUCCEEDED);
  }

void OnDeinit(const int reason)
  {
   EventKillTimer();
   Comment("");
  }

void OnTimer()
  {
   g_minutes++;
   if(g_pending || g_minutes >= SyncEveryMinutes)
     {
      g_minutes = 0;
      Sync();
     }
  }

void OnTradeTransaction(const MqlTradeTransaction &trans, const MqlTradeRequest &request, const MqlTradeResult &result)
  {
   if(trans.type == TRADE_TRANSACTION_DEAL_ADD)
      g_pending = true; // synced at the next timer tick (<= 1 min)
  }

// One fully closed position as JSON ("" if not usable). Changes the history selection.
string PositionJson(ulong pid, long offset)
  {
   if(!HistorySelectByPosition(pid))
      return("");
   string symbol = "";
   long   type   = -1;
   double volIn = 0, sumIn = 0, volOut = 0, sumOut = 0;
   double commission = 0, swap = 0, profit = 0, fee = 0;
   long   tIn = 0, tOut = 0;
   int nd = HistoryDealsTotal();
   for(int i = 0; i < nd; i++)
     {
      ulong  d     = HistoryDealGetTicket(i);
      long   entry = HistoryDealGetInteger(d, DEAL_ENTRY);
      double vol   = HistoryDealGetDouble(d, DEAL_VOLUME);
      double price = HistoryDealGetDouble(d, DEAL_PRICE);
      long   t     = (long)HistoryDealGetInteger(d, DEAL_TIME);
      commission += HistoryDealGetDouble(d, DEAL_COMMISSION);
      swap       += HistoryDealGetDouble(d, DEAL_SWAP);
      profit     += HistoryDealGetDouble(d, DEAL_PROFIT);
      fee        += HistoryDealGetDouble(d, DEAL_FEE);
      if(entry == DEAL_ENTRY_IN)
        {
         if(symbol == "")
            symbol = HistoryDealGetString(d, DEAL_SYMBOL);
         if(type < 0)
            type = HistoryDealGetInteger(d, DEAL_TYPE);
         volIn += vol;
         sumIn += vol * price;
         if(tIn == 0 || t < tIn)
            tIn = t;
        }
      else
         if(entry == DEAL_ENTRY_OUT || entry == DEAL_ENTRY_OUT_BY || entry == DEAL_ENTRY_INOUT)
           {
            volOut += vol;
            sumOut += vol * price;
            if(t > tOut)
               tOut = t;
           }
     }
   if(volIn <= 0 || volOut <= 0 || symbol == "")
      return("");

   // Initial stop / target = the ones on the opening order (the order ticket is the position id).
   double sl = 0, tp = 0;
   int no = HistoryOrdersTotal();
   for(int i = 0; i < no; i++)
     {
      ulong o = HistoryOrderGetTicket(i);
      if(o == pid || i == 0)
        {
         sl = HistoryOrderGetDouble(o, ORDER_SL);
         tp = HistoryOrderGetDouble(o, ORDER_TP);
         if(o == pid)
            break;
        }
     }
   int digits = (int)SymbolInfoInteger(symbol, SYMBOL_DIGITS);
   if(digits <= 0)
      digits = 5;
   string dir = (type == DEAL_TYPE_SELL) ? "sell" : "buy";

   string j = "{";
   j += "\"position\":\"" + IntegerToString((long)pid) + "\",";
   j += "\"symbol\":\"" + Esc(symbol) + "\",";
   j += "\"type\":\"" + dir + "\",";
   j += "\"volume\":" + DoubleToString(volIn, 2) + ",";
   j += "\"openTime\":" + IntegerToString(tIn - offset) + ",";
   j += "\"openPrice\":" + DoubleToString(sumIn / volIn, digits) + ",";
   j += "\"sl\":" + DoubleToString(sl, digits) + ",";
   j += "\"tp\":" + DoubleToString(tp, digits) + ",";
   j += "\"closeTime\":" + IntegerToString(tOut - offset) + ",";
   j += "\"closePrice\":" + DoubleToString(sumOut / volOut, digits) + ",";
   j += "\"commission\":" + DoubleToString(commission + fee, 2) + ",";
   j += "\"swap\":" + DoubleToString(swap, 2) + ",";
   j += "\"profit\":" + DoubleToString(profit, 2);
   j += "}";
   return(j);
  }

void Sync()
  {
   long     offset = ServerOffset();
   datetime now    = TimeCurrent();
   // Re-send the last 3 days on every sync (AUDAX ignores duplicates).
   datetime from   = (g_lastOk > 0) ? g_lastOk - 3 * 86400 : now - DaysBack * 86400;
   if(!HistorySelect(from, now + 86400))
     {
      Print("AUDAX Sync: could not read the history.");
      return;
     }
   // 1) Positions with a closing deal in the window (collected first:
   //    HistorySelectByPosition below replaces the history selection).
   ulong ids[];
   int n = 0;
   int total = HistoryDealsTotal();
   for(int i = 0; i < total; i++)
     {
      ulong d = HistoryDealGetTicket(i);
      long entry = HistoryDealGetInteger(d, DEAL_ENTRY);
      if(entry != DEAL_ENTRY_OUT && entry != DEAL_ENTRY_OUT_BY && entry != DEAL_ENTRY_INOUT)
         continue;
      ulong pid = (ulong)HistoryDealGetInteger(d, DEAL_POSITION_ID);
      bool seen = false;
      for(int k = 0; k < n; k++)
         if(ids[k] == pid)
           {
            seen = true;
            break;
           }
      if(!seen)
        {
         ArrayResize(ids, n + 1);
         ids[n++] = pid;
        }
     }
   // 2) Only fully closed positions (a partially closed one is sent once finished).
   string items = "";
   int count = 0;
   for(int k = 0; k < n && count < 1000; k++)
     {
      if(PositionSelectByTicket(ids[k]))
         continue;
      string item = PositionJson(ids[k], offset);
      if(item == "")
         continue;
      if(count > 0)
         items += ",";
      items += item;
      count++;
     }

   string body = "{";
   body += "\"login\":\"" + IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN)) + "\",";
   body += "\"name\":\"" + Esc(AccountInfoString(ACCOUNT_NAME)) + "\",";
   body += "\"server\":\"" + Esc(AccountInfoString(ACCOUNT_SERVER)) + "\",";
   body += "\"company\":\"" + Esc(AccountInfoString(ACCOUNT_COMPANY)) + "\",";
   body += "\"currency\":\"" + Esc(AccountInfoString(ACCOUNT_CURRENCY)) + "\",";
   body += "\"balance\":" + DoubleToString(AccountInfoDouble(ACCOUNT_BALANCE), 2) + ",";
   body += "\"equity\":" + DoubleToString(AccountInfoDouble(ACCOUNT_EQUITY), 2) + ",";
   body += "\"demo\":" + ((AccountInfoInteger(ACCOUNT_TRADE_MODE) == ACCOUNT_TRADE_MODE_DEMO) ? "true" : "false") + ",";
   if(g_firstDepositTime > 0)
     {
      body += "\"firstDeposit\":" + DoubleToString(g_firstDeposit, 2) + ",";
      body += "\"firstDepositTime\":" + IntegerToString(g_firstDepositTime) + ",";
     }
   body += "\"ea\":\"1.00\",";
   body += "\"positions\":[" + items + "]";
   body += "}";

   char   post[];
   char   response[];
   string responseHeaders;
   int len = StringToCharArray(body, post, 0, WHOLE_ARRAY, CP_UTF8);
   if(len > 0)
      ArrayResize(post, len - 1); // drop the trailing zero
   string headers = "Content-Type: application/json\r\nAuthorization: Bearer " + SyncKey + "\r\n";

   ResetLastError();
   int code = WebRequest("POST", AudaxUrl, headers, 15000, post, response, responseHeaders);
   if(code == -1)
     {
      int err = GetLastError();
      if(err == 4014)
         Print("AUDAX Sync: allow the URL first - Tools > Options > Expert Advisors > Allow WebRequest for listed URL > add https://vaudax.vercel.app");
      else
         Print("AUDAX Sync: network error ", err);
      Comment("AUDAX Sync: not connected (see the Experts tab)");
      return;
     }
   string reply = CharArrayToString(response, 0, WHOLE_ARRAY, CP_UTF8);
   if(code == 200)
     {
      g_lastOk  = now;
      g_pending = false;
      Comment("AUDAX Sync OK - ", TimeToString(TimeLocal(), TIME_MINUTES), " - ", count, " closed position(s) sent");
      Print("AUDAX Sync: ", count, " position(s) sent. ", reply);
     }
   else
     {
      Comment("AUDAX Sync: error ", code, " (see the Experts tab)");
      Print("AUDAX Sync: HTTP ", code, " ", reply);
     }
  }
//+------------------------------------------------------------------+
