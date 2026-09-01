import type { QuoteSource } from "../../domain/workspace";

export interface WordSlip {
  ref: string;
  text: string;
}

/** Splits a reflection into plain and highlighted segments for every exact quoted substring. */
export function highlightSegments(text: string, quotes: string[]): Array<{ text: string; marked: boolean }> {
  const ranges: Array<[number, number]> = [];
  for (const quote of quotes) {
    if (!quote) continue;
    let from = 0;
    while (from <= text.length) {
      const index = text.indexOf(quote, from);
      if (index < 0) break;
      ranges.push([index, index + quote.length]);
      from = index + quote.length;
    }
  }
  ranges.sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [];
  for (const range of ranges) {
    const last = merged.at(-1);
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
    else merged.push([...range]);
  }
  const segments: Array<{ text: string; marked: boolean }> = [];
  let cursor = 0;
  for (const [start, end] of merged) {
    if (start > cursor) segments.push({ text: text.slice(cursor, start), marked: false });
    segments.push({ text: text.slice(start, end), marked: true });
    cursor = end;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor), marked: false });
  return segments;
}

export function WordsPanel({
  words,
  activeQuotes,
  title = "Your words",
  note,
}: {
  words: WordSlip[];
  activeQuotes: QuoteSource[];
  title?: string;
  note?: string;
}) {
  return (
    <aside className="words-panel" aria-label={title}>
      <p className="eyebrow">{title}</p>
      {note ? <p className="words-panel__note">{note}</p> : null}
      <ul className="word-slips">
        {words.map((word) => {
          const quotes = activeQuotes.filter((quote) => quote.reflectionRef === word.ref).map((quote) => quote.quote);
          const segments = highlightSegments(word.text, quotes);
          return (
            <li key={word.ref} className="word-slip">
              <blockquote>
                {segments.map((segment, index) =>
                  segment.marked
                    ? <mark key={index}>{segment.text}</mark>
                    : <span key={index}>{segment.text}</span>)}
              </blockquote>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
