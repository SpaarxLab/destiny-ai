interface ProgressTrackProps {
  current: number;
  total: number;
  label: string;
}

export function ProgressTrack({ current, total, label }: ProgressTrackProps) {
  const bounded = Math.max(0, Math.min(current, total));
  return (
    <div className="progress-track" aria-label={`${label}: ${bounded} of ${total}`}>
      <div className="progress-track__copy">
        <span>{label}</span>
        <span className="progress-track__count">{bounded} of {total}</span>
      </div>
      <div
        className="progress-track__rail"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={bounded}
      >
        <span style={{ inlineSize: `${(bounded / total) * 100}%` }} />
      </div>
    </div>
  );
}
