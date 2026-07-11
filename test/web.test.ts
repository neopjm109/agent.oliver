import { test } from "node:test";
import assert from "node:assert/strict";
import { stripHtml, parseDuckDuckGo, isBlockedUrl } from "../src/tools/web.js";
import { selectTools } from "../src/tools/index.js";

test("selectTools: 비활성 도구를 제거한다", () => {
  const all = selectTools([]).map((t) => t.name);
  assert.ok(all.includes("web_search"));
  assert.ok(all.includes("run_shell"));

  const safe = selectTools(["run_shell", "write_file"]).map((t) => t.name);
  assert.ok(!safe.includes("run_shell"));
  assert.ok(!safe.includes("write_file"));
  assert.ok(safe.includes("web_search")); // 나머지는 유지
  assert.ok(safe.includes("read_file"));
});

test("stripHtml: 태그/엔티티 제거", () => {
  assert.equal(stripHtml("<p>Hello &amp; <b>world</b></p>"), "Hello & world");
  assert.equal(stripHtml("<script>bad()</script>안녕"), "안녕");
});

test("parseDuckDuckGo: uddg 리다이렉트를 실제 URL 로 복원", () => {
  const html = `
    <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fa&rut=z">제목 A</a>
    <a class="result__snippet">요약 A</a>
    <a class="result__a" href="https://direct.example.org/b">제목 B</a>
    <a class="result__snippet">요약 B</a>
  `;
  const r = parseDuckDuckGo(html, 10);
  assert.equal(r.length, 2);
  assert.equal(r[0].url, "https://example.com/a");
  assert.equal(r[0].title, "제목 A");
  assert.equal(r[0].snippet, "요약 A");
  assert.equal(r[1].url, "https://direct.example.org/b");
});

test("parseDuckDuckGo: limit 준수", () => {
  const html = Array.from(
    { length: 5 },
    (_, i) => `<a class="result__a" href="https://x.com/${i}">t${i}</a>`,
  ).join("\n");
  assert.equal(parseDuckDuckGo(html, 3).length, 3);
});

test("isBlockedUrl: 내부/사설/비 http 차단, 공개 http(s) 허용", () => {
  for (const u of [
    "http://localhost:8080",
    "http://127.0.0.1/x",
    "http://10.0.0.5",
    "http://192.168.1.1",
    "http://169.254.1.1",
    "http://172.16.0.1",
    "ftp://example.com",
    "file:///etc/passwd",
    "not a url",
  ]) {
    assert.equal(isBlockedUrl(u), true, `차단 기대: ${u}`);
  }
  for (const u of ["https://example.com", "http://example.com/path?q=1", "https://a.co/b"]) {
    assert.equal(isBlockedUrl(u), false, `허용 기대: ${u}`);
  }
});
