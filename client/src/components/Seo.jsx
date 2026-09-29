import { useEffect } from "react";

/**
 * Lightweight per-page SEO helper — no extra dependency (e.g. react-helmet)
 * required. Updates document.title, meta description/OG/Twitter tags, the
 * canonical link, and an optional JSON-LD structured-data block while the
 * page is mounted.
 *
 * Note: this is a client-side update. It correctly drives the browser tab
 * title and lets crawlers that execute JavaScript (Google, Bing) read the
 * per-page tags. Crawlers that don't run JS will only see the static tags
 * already present in index.html.
 */

const SITE_URL = "https://www.buildwithvishant.in";
const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.png`;

function setMetaByAttr(attr, key, content) {
  if (!content) return;
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setCanonical(href) {
  if (!href) return;
  let el = document.head.querySelector('link[rel="canonical"]');
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", "canonical");
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

function setJsonLd(id, data) {
  if (!data) return () => {};
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement("script");
    el.type = "application/ld+json";
    el.id = id;
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
  return () => el?.remove();
}

const Seo = ({ title, description, path = "/", image = DEFAULT_OG_IMAGE, jsonLd }) => {
  useEffect(() => {
    const previousTitle = document.title;
    const canonicalUrl = `${SITE_URL}${path}`;

    if (title) document.title = title;
    setMetaByAttr("name", "description", description);
    setCanonical(canonicalUrl);

    setMetaByAttr("property", "og:title", title);
    setMetaByAttr("property", "og:description", description);
    setMetaByAttr("property", "og:url", canonicalUrl);
    setMetaByAttr("property", "og:image", image);

    setMetaByAttr("name", "twitter:title", title);
    setMetaByAttr("name", "twitter:description", description);
    setMetaByAttr("name", "twitter:image", image);

    const removeJsonLd = setJsonLd(`jsonld-${path.replace(/\W+/g, "-") || "home"}`, jsonLd);

    return () => {
      // Restore the tab title on unmount; shared tags (description, canonical,
      // OG/Twitter) are intentionally left as-is since the next page's <Seo>
      // will overwrite them on mount, avoiding a flash of default values.
      document.title = previousTitle;
      removeJsonLd();
    };
  }, [title, description, path, image, jsonLd]);

  return null;
};

export default Seo;
