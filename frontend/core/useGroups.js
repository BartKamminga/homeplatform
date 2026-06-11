import { useState, useEffect } from "react";
import { api } from "./api.js";

export function useGroups() {
  const [groups, setGroups] = useState([]);
  const [active, setActive] = useState(null);

  useEffect(() => {
    api.get("/api/auth/me").then((data) => {
      setGroups(data.groups || []);
      setActive(data.active_group || null);
    }).catch(() => {});

    function onGroupChange(e) {
      setActive(e.detail);
    }
    window.addEventListener("groupchange", onGroupChange);
    return () => window.removeEventListener("groupchange", onGroupChange);
  }, []);

  async function setActiveGroup(slug) {
    const next = slug === "" ? null : slug;
    try {
      await api.patch("/api/auth/me/active-group", { group_slug: next });
      setActive(next);
      window.dispatchEvent(new CustomEvent("groupchange", { detail: next }));
    } catch {}
  }

  return { groups, active, setActiveGroup };
}
