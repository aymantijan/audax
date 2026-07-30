import { useEffect, useState } from 'react';
import { Activity, Sparkles, Send } from 'lucide-react';
import { useTradingStore } from '../../store/tradingStore';
import { fmtSignedMoney, fmtPct } from '../../utils/formatters';
import { Card, Button, Input } from '../common/ui';

const toneColor = { danger: 'var(--error)', warning: 'var(--warning)', success: 'var(--success)', info: 'var(--accent-primary)' };

export default function TradingCoach({ accountId }) {
  const { getCoachRecommendation, refreshAICoach, askTradingQuestion, getWeeklyDigest } = useTradingStore();
  const coach = getCoachRecommendation(accountId);
  const digest = getWeeklyDigest(accountId);

  // Tries to upgrade the instant local heuristic to a real AI recommendation —
  // no-ops silently if the OpenRouter proxy isn't configured/reachable.
  useEffect(() => {
    refreshAICoach(accountId);
  }, [accountId, refreshAICoach]);

  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState(null);
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState('');

  const submitQuestion = async (e) => {
    e.preventDefault();
    if (!question.trim()) return;
    setAsking(true);
    setAskError('');
    setAnswer(null);
    try {
      const text = await askTradingQuestion(accountId, question.trim());
      setAnswer(text);
    } catch {
      setAskError("AI coach isn't available right now (not configured or offline) — try again later.");
    } finally {
      setAsking(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="border border-line rounded-xl p-4 flex items-start gap-3" style={{ borderColor: toneColor[coach.tone], background: `color-mix(in srgb, ${toneColor[coach.tone]} 8%, transparent)` }}>
        <Activity size={18} style={{ color: toneColor[coach.tone] }} className="shrink-0 mt-0.5" />
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: toneColor[coach.tone] }}>Trading Coach</div>
            {coach.source === 'ai' && (
              <span className="flex items-center gap-1 text-[10px] text-accent"><Sparkles size={10} /> AI</span>
            )}
          </div>
          <div className="text-sm">{coach.text}</div>
        </div>
      </div>

      <Card title="Ask the Trading AI">
        <form onSubmit={submitQuestion} className="flex gap-2 mb-3">
          <Input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="e.g. Why did my win rate drop this week?" className="flex-1" />
          <Button type="submit" disabled={asking}>
            <span className="flex items-center gap-2">{asking ? 'Thinking…' : <><Send size={13} /> Ask</>}</span>
          </Button>
        </form>
        {answer && <div className="text-sm bg-surface border border-line rounded-lg p-3">{answer}</div>}
        {askError && <div className="text-sm text-bad">{askError}</div>}
        {!answer && !askError && !asking && <div className="text-xs text-mute">Ask anything about your own logged trades — requires the AI coach to be configured on this deployment.</div>}
      </Card>

      {digest.tradeCount > 0 && (
        <Card title="Weekly Journal Digest">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
            <div><div className="text-xs text-mute mb-1">Trades</div><div className="text-lg font-semibold">{digest.tradeCount}</div></div>
            <div><div className="text-xs text-mute mb-1">Win rate</div><div className="text-lg font-semibold">{fmtPct(digest.winRate)}</div></div>
            <div><div className="text-xs text-mute mb-1">P&L</div><div className="text-lg font-semibold" style={{ color: digest.totalPnl >= 0 ? 'var(--success)' : 'var(--error)' }}>{fmtSignedMoney(digest.totalPnl)}</div></div>
            <div><div className="text-xs text-mute mb-1">Revenge/Tilt flags</div><div className="text-lg font-semibold">{digest.revengeCount + digest.tiltCount}</div></div>
          </div>
        </Card>
      )}
    </div>
  );
}
