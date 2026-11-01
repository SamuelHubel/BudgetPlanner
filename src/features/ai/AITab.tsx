/** Shows the placeholder for planned AI insights. */
export default function AITab() {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h3 className="text-xl font-semibold text-white">AI</h3>
        <p className="text-sm text-slate-400">
          AI features are coming soon. This placeholder screen shows where
          model-driven insights will appear.
        </p>
      </div>

      <div className="rounded-3xl border border-slate-800 bg-slate-950/80 p-4">
        <p className="mt-3 text-sm text-slate-300">
          Placeholder for chat, recommendations, and generated budget
          suggestions.
        </p>
      </div>
    </div>
  );
}
