import { describe, expect, it } from "vitest";
import { logoCandidates } from "@/server/import/logo";

describe("store logo", () => {
  it("prefers the declared logo, then the app icon, then big favicons", () => {
    const html = `<html><head>
      <meta property="og:image" content="/banner.jpg">
      <link rel="icon" sizes="32x32" href="/fav-32.png">
      <link rel="icon" sizes="192x192" href="/fav-192.png">
      <link rel="icon" href="/favicon.ico">
      <link rel="apple-touch-icon" href="//cdn.shop.in/touch.png?v=2">
      <script type="application/ld+json">{"@context":"https://schema.org","@graph":[
        {"@type":"WebSite","name":"x"},
        {"@type":"Organization","logo":{"@type":"ImageObject","url":"https://shop.in/logo.png"}}]}</script>
      <script type="application/ld+json">not json</script>
    </head></html>`;
    expect(logoCandidates(html, "https://shop.in/")).toEqual([
      "https://shop.in/logo.png",
      "https://cdn.shop.in/touch.png?v=2",
      "https://shop.in/fav-192.png",
    ]);
  });

  it("falls back to favicons without a declared size", () => {
    const html = `<link rel="shortcut icon" href="//www.shop.in/cdn/favicon_96x.png?v=1" type="image/png">`;
    expect(logoCandidates(html, "https://www.shop.in/")).toEqual(["https://www.shop.in/cdn/favicon_96x.png?v=1"]);
  });

  it("skips svg and ico files and non-web links", () => {
    const html = `<link rel="apple-touch-icon" href="/a.svg"><link rel="apple-touch-icon" href="data:image/png;base64,AA">`;
    expect(logoCandidates(html, "https://shop.in/")).toEqual([]);
  });
});
