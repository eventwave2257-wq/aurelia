import { useState } from 'react';
import { Sparkles, Brain, AlertCircle, CheckCircle2, HeartHandshake, Smile } from 'lucide-react';
import type { CompletedTrip } from '../types/aurelia';

interface AiFeedbackAnalysisCardProps {
  trips: CompletedTrip[];
}

interface SentimentBreakdown {
  positive: number;
  comfortFocused: number;
  careSpecific: number;
  constructive: number;
}

interface FeedbackCategoryItem {
  categoryName: string;
  count: number;
  sampleComment: string;
}

interface AnalysisResult {
  summary: string;
  sentimentBreakdown: SentimentBreakdown;
  categories: FeedbackCategoryItem[];
  coachingTips: string[];
}

export function AiFeedbackAnalysisCard({ trips }: AiFeedbackAnalysisCardProps) {
  const [loading, setLoading] = useState<boolean>(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRunAnalysis = async () => {
    setLoading(true);
    setError(null);
    try {
      const feedbackItems = trips.map((t) => ({
        id: t.id,
        category: t.category,
        route: t.routeSummary,
        riderRating: t.riderRatingGiven ?? 5.0,
        careNotes: t.driverPassengerRating?.privateCareNotes || '',
        curbReadiness: t.driverPassengerRating?.curbReadiness || 5,
        communication: t.driverPassengerRating?.communication || 5,
      }));

      const res = await fetch('/api/gemini/feedback-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedbackItems }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to analyze feedback');
      }

      setAnalysis(data.analysis);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error connecting to Gemini feedback analysis service.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      data-testid="ai-feedback-analysis-card"
      className="p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-white via-amber-50/30 to-amber-100/40 dark:from-[#101218] dark:via-[#15120a] dark:to-[#1f160b] backdrop-blur-xl border border-amber-300/60 dark:border-amber-500/30 shadow-sm space-y-4"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/15 dark:bg-amber-400/20 border border-amber-300 dark:border-amber-500/40 flex items-center justify-center text-amber-700 dark:text-amber-300">
            <Brain className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-700 dark:text-amber-400">
                Gemini AI Intelligence
              </span>
              <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/80 text-[10px] font-bold text-amber-800 dark:text-amber-300 border border-amber-300/70 dark:border-amber-700/60">
                Live Sentiment Engine
              </span>
            </div>
            <h2 className="font-display text-xl font-bold text-stone-900 dark:text-stone-50">
              Rider Feedback & Sentiment Analysis
            </h2>
          </div>
        </div>

        <button
          type="button"
          data-testid="run-ai-feedback-btn"
          onClick={handleRunAnalysis}
          disabled={loading}
          className="min-h-[44px] px-4 py-2 rounded-2xl bg-[#B48A3E] hover:bg-[#9A722A] dark:bg-[#D4AF63] dark:hover:bg-[#E2C27D] text-white dark:text-stone-950 font-semibold text-xs flex items-center gap-2 disabled:opacity-50 transition-colors shadow-sm cursor-pointer whitespace-nowrap"
        >
          <Sparkles className="w-4 h-4" />
          <span>{loading ? 'Analyzing Rider Feedback...' : analysis ? 'Refresh AI Analysis' : 'Analyze Feedback with Gemini AI'}</span>
        </button>
      </div>

      {error && (
        <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-800 text-xs font-medium text-rose-900 dark:text-rose-200 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
          <span>{error} Your API key can be found in the <strong>Settings &gt; Secrets</strong> panel.</span>
        </div>
      )}

      {!analysis && !loading && !error && (
        <p className="text-xs text-stone-600 dark:text-stone-400">
          Click the button above to have Gemini AI summarize completed trip comments into sentiment categories (Positive, Comfort-Focused, Care-Specific, Constructive) with driver coaching takeaways.
        </p>
      )}

      {loading && (
        <div className="py-8 flex flex-col items-center justify-center gap-3 text-stone-500 dark:text-stone-400 text-xs font-mono-tabular">
          <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <span>Gemini is synthesizing passenger feedback notes and calculating sentiment breakdown...</span>
        </div>
      )}

      {analysis && !loading && (
        <div className="space-y-4 pt-2">
          {/* Summary */}
          <div className="p-4 rounded-2xl bg-white/90 dark:bg-[#080A0F]/80 border border-stone-200/80 dark:border-white/10 space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
              Executive Sentiment Summary
            </p>
            <p className="text-sm font-medium text-stone-900 dark:text-stone-100">
              {analysis.summary}
            </p>
          </div>

          {/* Sentiment Breakdown Badges & Bars */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 space-y-1">
              <span className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
                <Smile className="w-3.5 h-3.5" /> Positive
              </span>
              <p className="text-xl font-bold text-emerald-900 dark:text-emerald-200 font-mono-tabular">
                {analysis.sentimentBreakdown?.positive ?? 0}%
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 space-y-1">
              <span className="text-[11px] font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" /> Comfort-Focused
              </span>
              <p className="text-xl font-bold text-amber-900 dark:text-amber-200 font-mono-tabular">
                {analysis.sentimentBreakdown?.comfortFocused ?? 0}%
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-teal-50/80 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800/60 space-y-1">
              <span className="text-[11px] font-semibold text-teal-800 dark:text-teal-300 flex items-center gap-1">
                <HeartHandshake className="w-3.5 h-3.5" /> Care-Specific
              </span>
              <p className="text-xl font-bold text-teal-900 dark:text-teal-200 font-mono-tabular">
                {analysis.sentimentBreakdown?.careSpecific ?? 0}%
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-stone-100 dark:bg-stone-800/80 border border-stone-200 dark:border-stone-700 space-y-1">
              <span className="text-[11px] font-semibold text-stone-700 dark:text-stone-300 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Constructive
              </span>
              <p className="text-xl font-bold text-stone-900 dark:text-stone-100 font-mono-tabular">
                {analysis.sentimentBreakdown?.constructive ?? 0}%
              </p>
            </div>
          </div>

          {/* Categories / Highlights */}
          {analysis.categories && analysis.categories.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-stone-700 dark:text-stone-300 uppercase tracking-wider">
                Feedback Themes & Sample Highlights
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {analysis.categories.map((cat, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-white/70 dark:bg-[#080A0F]/70 border border-stone-200 dark:border-stone-800 flex flex-col justify-between gap-1.5"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-stone-900 dark:text-stone-100">
                        {cat.categoryName}
                      </span>
                      <span className="font-mono-tabular text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-md">
                        {cat.count} trips
                      </span>
                    </div>
                    {cat.sampleComment && (
                      <p className="text-xs text-stone-600 dark:text-stone-300 italic">
                        "{cat.sampleComment}"
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Coaching Tips */}
          {analysis.coachingTips && analysis.coachingTips.length > 0 && (
            <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-300/80 dark:border-amber-800/60 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                Driver Quality & Coaching Takeaways
              </p>
              <ul className="space-y-1.5 text-xs text-stone-800 dark:text-stone-200 list-disc list-inside">
                {analysis.coachingTips.map((tip, idx) => (
                  <li key={idx} className="leading-relaxed">
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
