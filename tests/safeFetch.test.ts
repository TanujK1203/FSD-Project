import { describe, expect, it } from "vitest";
import { assertPublicUrl, BlockedUrlError, isPrivateIp } from "@/server/import/safeFetch";
import { normalizeInputUrl } from "@/server/import/detect";

describe("SSRF guard", () => {
  it("classifies private addresses", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fe80::1", "fd00::1", "::ffff:127.0.0.1", "::ffff:7f00:1", "64:ff9b::a00:5", "64:ff9b::192.168.1.1", "64:ff9b:1::1"]) {
      expect(isPrivateIp(ip), ip).toBe(true);
    }
    // NAT64 addresses of public sites (IPv6-only networks) are public
    for (const ip of ["8.8.8.8", "104.20.23.154", "172.32.0.1", "2606:4700::1111", "64:ff9b::17e3:2641", "64:ff9b::23.227.38.65"]) {
      expect(isPrivateIp(ip), ip).toBe(false);
    }
  });
  it("rejects internal and odd URLs before any request", async () => {
    for (const u of [
      "http://localhost:3000/",
      "http://127.0.0.1/",
      "http://[::1]/",
      "http://169.254.169.254/latest/meta-data",
      "http://10.0.0.5/",
      "file:///etc/passwd",
      "ftp://x.in/",
      "https://user:pw@x.in/",
      "http://printer.local/",
      "http://intranet/",
      "https://x.in:22/",
    ]) {
      await expect(assertPublicUrl(u), u).rejects.toBeInstanceOf(BlockedUrlError);
    }
  });
  it("normalises what sellers type", () => {
    expect(normalizeInputUrl("mystore.in")?.toString()).toBe("https://mystore.in/");
    expect(normalizeInputUrl("  https://shop.x.in/collections/all#top ")?.toString()).toBe("https://shop.x.in/collections/all");
    expect(normalizeInputUrl("not a url")).toBeNull();
    expect(normalizeInputUrl("")).toBeNull();
  });
});
