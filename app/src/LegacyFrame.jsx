import React, { useMemo } from "react";
import { useLocation } from "react-router-dom";

const stripTrailingSlash = (value) => {
  if (!value) return "/";
  if (value.length > 1 && value.endsWith("/")) return value.slice(0, -1);
  return value;
};

const buildLegacyUrl = (pathname, search, hash) => {
  const path = pathname || "/";
  const normalized = stripTrailingSlash(path);
  const parts = normalized.split("/").filter(Boolean);

  if (normalized === "/") return `/legacy/${search || ""}${hash || ""}`;

  if (normalized === "/u") {
    return `/legacy/profile/public/${search || ""}${hash || ""}`;
  }
  if (parts[0] === "u" && parts[1]) {
    const query = new URLSearchParams(search);
    query.set("u", parts[1]);
    const qs = query.toString();
    return `/legacy/profile/public/${qs ? `?${qs}` : ""}${hash || ""}`;
  }

  if (parts[0] === "sanpham") {
    if (parts[1]) {
      const query = new URLSearchParams(search);
      query.set("id", parts[1]);
      const qs = query.toString();
      return `/legacy/sanpham/[id]/${qs ? `?${qs}` : ""}${hash || ""}`;
    }
    return `/legacy/sanpham/${search || ""}${hash || ""}`;
  }

  if (parts[0] === "dichvu") {
    if (parts[1]) {
      const query = new URLSearchParams(search);
      query.set("id", parts[1]);
      const qs = query.toString();
      return `/legacy/dichvu/[id]/${qs ? `?${qs}` : ""}${hash || ""}`;
    }
    return `/legacy/dichvu/${search || ""}${hash || ""}`;
  }

  if (parts[0] === "gian-hang") {
    if (parts[1] === "nguoi-ban" && parts[2]) {
      const query = new URLSearchParams(search);
      query.set("u", parts[2]);
      const qs = query.toString();
      return `/legacy/gian-hang/nguoi-ban/index.html${qs ? `?${qs}` : ""}${hash || ""}`;
    }
    if (parts[1]) {
      const query = new URLSearchParams(search);
      query.set("id", parts[1]);
      const qs = query.toString();
      return `/legacy/gian-hang/[slug]/${qs ? `?${qs}` : ""}${hash || ""}`;
    }
    return `/legacy/gian-hang/${search || ""}${hash || ""}`;
  }

  if (parts[0] === "seller" && parts[1]) {
    const query = new URLSearchParams(search);
    query.set("id", parts[1]);
    const qs = query.toString();
    return `/legacy/seller/[id]/${qs ? `?${qs}` : ""}${hash || ""}`;
  }

  const fallback = `/legacy${path}${search || ""}${hash || ""}`;
  return fallback;
};

export default function LegacyFrame() {
  const { pathname, search, hash } = useLocation();
  const legacyUrl = useMemo(() => buildLegacyUrl(pathname, search, hash), [pathname, search, hash]);

  return (
    <div className="legacy-shell">
      <iframe key={legacyUrl} src={legacyUrl} className="legacy-frame" title="Legacy content" />
    </div>
  );
}
