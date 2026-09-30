/**
 * Tiny router: pathname + pushState navigation (I6: everything deep-links).
 */
import { useEffect, useState } from "react";

export interface Route {
  path: string;
  param?: string;
}

export function parseRoute(pathname: string): Route {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length === 0) return { path: "/" };
  if (parts[0] === "members" && parts[1]) return { path: "/members", param: parts[1] };
  return { path: `/${parts[0]}` };
}

export function useRoute(): [Route, (to: string) => void] {
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.pathname));
  useEffect(() => {
    const onPop = (): void => setRoute(parseRoute(window.location.pathname));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  const navigate = (to: string): void => {
    window.history.pushState(null, "", to);
    setRoute(parseRoute(to));
  };
  return [route, navigate];
}
