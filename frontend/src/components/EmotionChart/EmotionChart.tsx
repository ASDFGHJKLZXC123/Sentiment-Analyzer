import { useEffect, useRef } from "react";
import type { EmotionView } from "@/api/toView";
import { EMOTION_COLORS } from "./colors";

interface Props {
  emotions: EmotionView[];
}

export function EmotionChart({ emotions }: Props) {
  const detailsRef = useRef<HTMLDetailsElement>(null);

  // Spec §6.3: keep the table expanded by default at narrow widths where the
  // bars feel cramped. Open initial-only — once mounted, leave the user's
  // toggle state alone. (jsdom doesn't ship matchMedia, hence the typeof check.)
  useEffect(() => {
    if (
      detailsRef.current &&
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(max-width: 767px)").matches
    ) {
      detailsRef.current.open = true;
    }
  }, []);

  return (
    <div>
      <h3 className="result-block-label">Emotions</h3>
      <div
        className="emotion-chart"
        role="img"
        aria-label="Emotion scores bar chart. Use the table below for exact values."
      >
        {emotions.map((e) => {
          const pct = Math.round(e.score * 100);
          return (
            <div className="emotion-row" key={e.key}>
              <span className="e-name">{e.label}</span>
              <div className="emotion-bar-track" aria-hidden="true">
                <div
                  className="emotion-bar-fill"
                  style={{ width: `${pct}%`, background: EMOTION_COLORS[e.key] }}
                />
              </div>
              <span className="e-pct">{pct}%</span>
            </div>
          );
        })}
      </div>
      <details ref={detailsRef} className="details">
        <summary>Show as table</summary>
        <table>
          <thead>
            <tr>
              <th scope="col">Emotion</th>
              <th scope="col">Score</th>
            </tr>
          </thead>
          <tbody>
            {emotions.map((e) => (
              <tr key={e.key}>
                <td>{e.label}</td>
                <td>{Math.round(e.score * 100)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
