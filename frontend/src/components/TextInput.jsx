// TextInput region: textarea, counter, sample chips, Analyze/Clear buttons
const MAX_LEN = 2000;

const SAMPLE_CHIPS = [
  {
    id: "tweet",
    label: "Try a tweet",
    text: "Just got the new headphones and honestly I'm thrilled — battery life is amazing, sound is incredible, and they fit perfectly. Best purchase this year!"
  },
  {
    id: "review",
    label: "Try a review",
    text: "The hotel was fine. Room was clean, staff polite. The breakfast was forgettable and the wifi kept dropping. Wouldn't go out of my way to come back, but no real complaints either."
  },
  {
    id: "complaint",
    label: "Try a product complaint",
    text: "Package arrived broken, the support chatbot was useless, and after three emails nobody has responded. I am beyond frustrated. This was a complete waste of money and I'm furious."
  },
];

function TextInput({ value, onChange, onSubmit, onClear, disabled, submitDisabled }) {
  const taRef = React.useRef(null);
  const submitRef = React.useRef(null);

  const len = value.length;
  const counterCls =
    len >= MAX_LEN ? "counter error"
    : len >= MAX_LEN * 0.9 ? "counter warn"
    : "counter";

  const fillSample = (text) => {
    onChange(text);
    setTimeout(() => submitRef.current?.focus(), 0);
  };

  const handleKey = (e) => {
    // Cmd/Ctrl+Enter submits
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      if (!submitDisabled) onSubmit();
    }
    // Escape clears (only when not loading)
    if (e.key === "Escape" && !disabled && value) {
      e.preventDefault();
      onClear();
    }
  };

  return (
    <section className="region-input" aria-labelledby="input-heading">
      <div className="card">
        <div className="card-inner">
          <h2 id="input-heading" className="section-heading">Analyze</h2>
          <label htmlFor="text-input" className="sr-only">Text to analyze</label>

          <div className="textarea-wrap">
            <textarea
              id="text-input"
              ref={taRef}
              className="textarea"
              placeholder="Paste a tweet, review, message, or any text…"
              value={value}
              onChange={(e) => onChange(e.target.value.slice(0, MAX_LEN))}
              onKeyDown={handleKey}
              maxLength={MAX_LEN}
              spellCheck={true}
              aria-describedby="counter-hint kbd-hint"
            />
            <span id="counter-hint" className={counterCls} aria-live="off">
              {len.toLocaleString()} / {MAX_LEN.toLocaleString()}
            </span>
          </div>

          {!value && (
            <div className="chip-row" role="group" aria-label="Sample inputs">
              <span className="chip-label">Or try a sample:</span>
              {SAMPLE_CHIPS.map((s) => (
                <button
                  type="button"
                  key={s.id}
                  className="chip"
                  onClick={() => fillSample(s.text)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}

          <div className="button-row">
            <button
              type="button"
              className="btn btn-tertiary"
              onClick={onClear}
              disabled={disabled || !value}
            >
              Clear
            </button>
            <button
              type="button"
              ref={submitRef}
              className="btn btn-primary"
              onClick={onSubmit}
              disabled={submitDisabled}
            >
              {disabled ? "Analyzing…" : "Analyze"}
            </button>
          </div>

          <div id="kbd-hint" className="kbd-hint">
            ⌘/Ctrl + Enter to submit · Esc to clear
          </div>
        </div>
      </div>
    </section>
  );
}

window.TextInput = TextInput;
window.SAMPLE_CHIPS = SAMPLE_CHIPS;
window.MAX_LEN = MAX_LEN;
