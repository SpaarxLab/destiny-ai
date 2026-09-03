import type { SceneTag } from "../domain";

/**
 * Twelve flat two-ink scenes. One person, one place, one hour. No faces, no photographs.
 * `tone` picks the spot colour: warm for the person's picks, cold for the player's, neutral otherwise.
 */
export function Scene({ tag, tone = "neutral" }: { tag: SceneTag; tone?: "warm" | "cold" | "neutral" }) {
  const spot = tone === "warm" ? "#ff5a36" : tone === "cold" ? "#8fd3ff" : "#c9c4b8";
  const ink = "#1b1b1f";
  const sky = "#0f0f12";
  const figure = <g fill={ink}><circle cx="150" cy="212" r="15" /><path d="M128 300c0-30 10-62 22-62s22 32 22 62z" /></g>;

  const scenes: Record<SceneTag, React.ReactNode> = {
    office: (
      <>
        <rect width="300" height="400" fill={sky} />
        <rect x="40" y="60" width="220" height="150" fill={ink} />
        {[60, 110, 160, 210].map((x) => <rect key={x} x={x} y="80" width="30" height="110" fill={spot} opacity="0.55" />)}
        <rect x="0" y="300" width="300" height="100" fill={ink} />
        {figure}
      </>
    ),
    kitchen: (
      <>
        <rect width="300" height="400" fill={sky} />
        <rect x="0" y="230" width="300" height="70" fill={ink} />
        <circle cx="150" cy="120" r="46" fill={spot} opacity="0.85" />
        <path d="M120 120h60" stroke={sky} strokeWidth="6" />
        <rect x="0" y="300" width="300" height="100" fill="#121215" />
        {figure}
      </>
    ),
    classroom: (
      <>
        <rect width="300" height="400" fill={sky} />
        <rect x="30" y="50" width="240" height="130" fill={ink} />
        <path d="M60 110h90M60 140h140" stroke={spot} strokeWidth="6" strokeLinecap="round" />
        <rect x="0" y="300" width="300" height="100" fill="#121215" />
        {figure}
      </>
    ),
    server: (
      <>
        <rect width="300" height="400" fill={sky} />
        {[40, 120, 200].map((x) => (
          <g key={x}>
            <rect x={x} y="40" width="60" height="260" fill={ink} />
            {[70, 110, 150, 190, 230].map((y) => <rect key={y} x={x + 10} y={y} width="40" height="6" fill={spot} opacity={y === 150 ? 1 : 0.3} />)}
          </g>
        ))}
        <rect x="0" y="300" width="300" height="100" fill="#121215" />
        {figure}
      </>
    ),
    beach: (
      <>
        <rect width="300" height="400" fill={sky} />
        <circle cx="220" cy="90" r="40" fill={spot} opacity="0.9" />
        <rect x="0" y="200" width="300" height="100" fill={ink} />
        <path d="M0 210q40-16 80 0t80 0 80 0 60 0" stroke={spot} strokeWidth="4" fill="none" opacity="0.6" />
        <rect x="0" y="300" width="300" height="100" fill="#121215" />
        {figure}
      </>
    ),
    desk: (
      <>
        <rect width="300" height="400" fill={sky} />
        <rect x="60" y="120" width="180" height="120" fill={ink} />
        <rect x="90" y="140" width="120" height="70" fill={spot} opacity="0.6" />
        <rect x="0" y="300" width="300" height="100" fill="#121215" />
        {figure}
      </>
    ),
    stage: (
      <>
        <rect width="300" height="400" fill={sky} />
        <path d="M150 300L60 40h180z" fill={spot} opacity="0.28" />
        <rect x="0" y="300" width="300" height="100" fill={ink} />
        {[30, 70, 110, 190, 230, 270].map((x) => <circle key={x} cx={x} cy="340" r="9" fill="#121215" />)}
        {figure}
      </>
    ),
    phone: (
      <>
        <rect width="300" height="400" fill={sky} />
        <rect x="105" y="60" width="90" height="170" rx="14" fill={ink} />
        <rect x="118" y="80" width="64" height="120" fill={spot} opacity="0.75" />
        <rect x="0" y="300" width="300" height="100" fill="#121215" />
        {figure}
      </>
    ),
    road: (
      <>
        <rect width="300" height="400" fill={sky} />
        <path d="M150 300L20 400h260z" fill={ink} />
        <path d="M150 300L110 400M150 300l40 100" stroke={spot} strokeWidth="4" strokeDasharray="10 12" />
        <circle cx="70" cy="80" r="26" fill={spot} opacity="0.7" />
        {figure}
      </>
    ),
    workshop: (
      <>
        <rect width="300" height="400" fill={sky} />
        <rect x="30" y="150" width="240" height="24" fill={ink} />
        {[60, 110, 160, 210].map((x, index) => <rect key={x} x={x} y={90 - index * 12} width="14" height={60 + index * 12} fill={spot} opacity="0.7" />)}
        <rect x="0" y="300" width="300" height="100" fill="#121215" />
        {figure}
      </>
    ),
    home: (
      <>
        <rect width="300" height="400" fill={sky} />
        <path d="M40 200L150 90l110 110v100H40z" fill={ink} />
        <rect x="130" y="150" width="40" height="40" fill={spot} opacity="0.85" />
        <rect x="0" y="300" width="300" height="100" fill="#121215" />
        {figure}
      </>
    ),
    night: (
      <>
        <rect width="300" height="400" fill="#07070a" />
        {[[40, 60], [120, 30], [200, 70], [260, 40], [90, 110], [230, 130]].map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r="2.5" fill={spot} opacity="0.8" />)}
        <circle cx="240" cy="90" r="22" fill={spot} opacity="0.5" />
        <rect x="0" y="300" width="300" height="100" fill={ink} />
        {figure}
      </>
    ),
  };

  return (
    <svg viewBox="0 0 300 400" preserveAspectRatio="xMidYMid slice" aria-hidden="true" role="presentation">
      {scenes[tag]}
    </svg>
  );
}
