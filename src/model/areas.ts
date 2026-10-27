import type { Screen } from "./types";

/** Room around an area's screens: its name sits in the top band. Auto-arrange leaves the same room. */
export const AREA_PAD = { top: 40, side: 24 };

// "/beans", "/bean/[id]" and "/bean-edit" all belong to "bean"; "/" and its states stay together.
const routeKey = (route: string) => {
  const first = route.split("/").find(Boolean);
  return first ? first.split("-")[0].replace(/s$/, "") : "/";
};

/**
 * The feature area of each screen that has one: the name set in the inspector, or else screens whose routes share a
 * first segment, named after the screen with the shortest route. An automatic area needs at least two screens.
 */
export function screenAreas(screens: Screen[]): Map<string, string> {
  const groups = new Map<string, Screen[]>();
  for (const s of screens) if (!s.area && s.route) groups.set(routeKey(s.route), [...(groups.get(routeKey(s.route)) ?? []), s]);
  const areas = new Map<string, string>();
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const lead = [...group].sort((a, b) => (a.route?.length ?? 0) - (b.route?.length ?? 0))[0];
    const name = lead.name.split(" · ")[0].trim();
    for (const s of group) areas.set(s.id, name);
  }
  for (const s of screens) if (s.area) areas.set(s.id, s.area);
  return areas;
}
