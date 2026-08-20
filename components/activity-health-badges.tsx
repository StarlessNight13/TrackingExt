import {
  describeActivityHealthIssue,
  type ActivityHealth,
  hasActivityHealthIssues,
} from "@/lib/activity-health";

export function ActivityHealthBadges({ health }: { health?: ActivityHealth }) {
  if (!health || !hasActivityHealthIssues(health)) return null;

  return (
    <div className="row wrap activity-health-badges" style={{ gap: 6 }}>
      {health.issues.map((issue) => (
        <span
          key={issue}
          className={`pill${issue === "stale" || issue === "owner_offline" || issue === "ownership_conflict" ? " pill--warning" : ""}`}
        >
          {describeActivityHealthIssue(issue)}
        </span>
      ))}
    </div>
  );
}
