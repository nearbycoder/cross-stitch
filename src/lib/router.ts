import { useEffect, useState } from "react";

export type Route = { name: "dashboard" } | { name: "project"; id: string } | { name: "account" };

function parse(): Route {
  const h = location.hash.replace(/^#\/?/, "");
  const [a, b] = h.split("/");
  if (a === "project" && b) return { name: "project", id: b };
  if (a === "account") return { name: "account" };
  return { name: "dashboard" };
}

export function navigate(path: string) {
  location.hash = path;
}

export function useRoute(): Route {
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const on = () => setRoute(parse());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return route;
}
