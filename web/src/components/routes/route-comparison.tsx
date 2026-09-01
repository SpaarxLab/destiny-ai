import type { RoutePreview } from "../../domain/workspace";
import { ROUTE_LABELS } from "../../content/journey";
import type { RouteMarks } from "../journey/journey-state";

interface RouteComparisonProps {
  routes: readonly RoutePreview[];
  marks: Record<string, RouteMarks>;
}

export function RouteComparison({ routes, marks }: RouteComparisonProps) {
  const activeRoutes = routes.filter((route) => route.status !== "rejected");
  return (
    <section className="comparison-board" aria-labelledby="comparison-title">
      <div className="comparison-board__heading">
        <p className="eyebrow">Your comparison</p>
        <h2 id="comparison-title">See your marks side by side</h2>
        <p>The order stays fixed. This board does not score or rank your routes.</p>
      </div>
      <div className="comparison-grid">
        {activeRoutes.map((route) => {
          const routeMarks = marks[route.ref] ?? { draws: "", worries: "", teaches: "" };
          return (
            <article key={route.ref}>
              <p className="route-kind">{ROUTE_LABELS[route.kind].name}</p>
              <h3>{route.title}</h3>
              <dl>
                <div>
                  <dt>Draws me in</dt>
                  <dd>{routeMarks.draws || "No mark yet"}</dd>
                </div>
                <div>
                  <dt>Worries me</dt>
                  <dd>{routeMarks.worries || "No mark yet"}</dd>
                </div>
                <div>
                  <dt>Could teach me</dt>
                  <dd>{routeMarks.teaches || route.learningQuestion}</dd>
                </div>
              </dl>
            </article>
          );
        })}
      </div>
    </section>
  );
}
