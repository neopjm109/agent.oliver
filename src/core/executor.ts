// 제한적 명령 실행 — scaffold 화이트리스트만. 명령은 코드가 결정론적으로 조립하고
// (LLM 아님 → 오타·환각 0), execFile 로 셸 없이 실행한다(인젝션 불가).
// 산출물 파일 저장(writeArtifact)도 여기서 담당(workspace 밖 금지·비파괴).
import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, isAbsolute, join, relative, resolve } from 'node:path';
import { isBinaryDoc, extractDocText } from './docExtract.js';
import { shortTopic } from './naming.js';

/** workspace 기준 경로를 안전하게 절대경로로 해석. 밖(../·절대·드라이브/UNC)이면 null. */
function safeResolve(workspace: string, relPath: string): string | null {
  if (relPath.includes('\0')) return null; // 널바이트 차단
  const root = resolve(workspace);
  const target = resolve(root, relPath);
  const rel = relative(root, target);
  if (rel === '') return target; // root 자기 자신
  // 상위로 탈출(../)하거나, rel 이 절대경로면(다른 드라이브·UNC 포함) 거부. isAbsolute 로 Windows 드라이브도 포괄.
  if (rel.startsWith('..') || isAbsolute(rel)) return null;
  return target;
}

/** 발화에서 프로젝트명 후보 추출 — 영문 식별자 첫 개(프레임워크/불용 키워드 제외). 없으면 null. */
const NAME_STOP = new Set([
  'spring', 'springboot', 'boot', 'nestjs', 'nest', 'django', 'drf', 'nextjs', 'next', 'flutter', 'tauri',
  'project', 'app', 'api', 'web', 'backend', 'frontend', 'server', 'rest', 'graphql', 'grpc',
  'cli', 'sdk', 'http', 'https', 'db', 'ui', 'ux', 'ci', 'cd', 'scaffold', 'command',
  // 기술 접미사 — "Next.js"·"Node.js" 가 점에서 쪼개져 'js'/'ts' 가 이름으로 뽑히는 것을 막는다.
  'js', 'ts', 'jsx', 'tsx', 'node', 'nodejs',
  // 흔한 기술 용어 — 이름으로 오인되기 쉬운 것들("Spring Boot"→boot, "GraphQL 서버"→graphql).
  'react', 'vue', 'svelte', 'express', 'fastapi', 'gin', 'gradle', 'maven',
  'postgres', 'postgresql', 'mysql', 'mariadb', 'mongo', 'mongodb', 'redis', 'kafka',
  'docker', 'kubernetes', 'k8s', 'prisma', 'typeorm', 'jpa',
]);

/** "이름은 X" · "X라는" · 따옴표로 감싼 X 처럼 사용자가 이름을 명시한 경우를 먼저 잡는다. */
function explicitName(text: string): string | null {
  const pats = [
    /이름\s*(?:은|는|을|:)?\s*["'`]?([a-zA-Z][\w-]{1,40})["'`]?/,
    /["'`]([a-zA-Z][\w-]{1,40})["'`]\s*(?:라는|이라는|라고|이라고|로|으로)?/,
    // 후행 경계 없음 — '라는' 뒤(공백/한글)는 \w 경계가 성립하지 않아 \b 를 쓰면 매칭 자체가 무효가 된다.
    /([a-zA-Z][\w-]{1,40})\s*(?:라는|이라는|라고|이라고)/,
  ];
  for (const re of pats) {
    const m = text.match(re);
    if (m && !NAME_STOP.has(m[1].toLowerCase()) && !/^[A-Z0-9]+$/.test(m[1])) return m[1];
  }
  return null;
}

export function extractProjectName(text: string): string | null {
  const explicit = explicitName(text);
  if (explicit) return explicit;
  const tokens = text.match(/[a-zA-Z][\w-]{1,40}/g) ?? [];
  for (const t of tokens) {
    // 전부 대문자인 약어(CLI·REST·SDK…)는 프로젝트명으로 의도된 경우가 거의 없어 건너뛴다.
    if (/^[A-Z0-9]+$/.test(t)) continue;
    if (!NAME_STOP.has(t.toLowerCase())) return t;
  }
  return null;
}

/** 목표 문자열 → 폴더명 슬러그(영숫자·한글 유지, 그 외 → '-'). 비면 'plan'. */
export function slugify(s: string): string {
  const out = s.trim().toLowerCase().replace(/[^\w가-힣]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  return out || 'plan';
}

/**
 * workspace 기준으로 산출물을 안전 저장한다. workspace 밖 경로는 거부(경로 탈출 차단),
 * 디렉토리는 자동 생성, 같은 파일이 있으면 -2,-3 로 비파괴 저장. 저장한 절대경로 반환.
 */
export function writeArtifact(workspace: string, relPath: string, content: string): string {
  let target = safeResolve(workspace, relPath);
  if (!target) throw new Error(`작업 폴더 밖 경로에는 저장할 수 없어요: ${relPath}`);
  // 비파괴: 이미 있으면 name-2.ext, name-3.ext …
  if (existsSync(target)) {
    const ext = extname(target);
    const base = target.slice(0, target.length - ext.length);
    let i = 2;
    while (existsSync(`${base}-${i}${ext}`)) i++;
    target = `${base}-${i}${ext}`;
  }
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content, 'utf8');
  return target;
}

/** "node.js"·"vue.js" 처럼 파일이 아니라 프레임워크/런타임을 가리키는 점표기(오매칭 방지). */
const NON_FILE_DOTTED = new Set([
  'node.js', 'next.js', 'nuxt.js', 'vue.js', 'three.js', 'd3.js', 'express.js', 'nest.js', 'react.js',
]);

/** 발화에서 파일 경로 후보(확장자 있는 토큰, 예 src/foo.ts·foo.py) 첫 개. 없으면 null. */
export function extractFilePath(text: string): string | null {
  const all = text.match(/[\w./-]*[\w-]+\.[a-zA-Z][a-zA-Z0-9]{0,9}\b/g) ?? [];
  if (!all.length) return null;
  // 슬래시가 있으면 명백한 경로 → 우선. (예: "src/foo.ts")
  const withSlash = all.find((t) => t.includes('/'));
  if (withSlash) return withSlash;
  // 슬래시 없는 단일 파일명: 프레임워크 표기("node.js")는 제외.
  return all.find((t) => !NON_FILE_DOTTED.has(t.toLowerCase())) ?? null;
}

/** 파일 확장자 → analyze_document 의 doc_type 스킬명. 확장자가 곧 문서 타입이라 LLM 추측보다 정확. */
const DOC_TYPE_BY_EXT: Record<string, string> = {
  pdf: 'docs-analyze-pdf',
  docx: 'docs-analyze-docx', doc: 'docs-analyze-docx',
  xlsx: 'docs-analyze-xlsx', xls: 'docs-analyze-xlsx',
  pptx: 'docs-analyze-pptx', ppt: 'docs-analyze-pptx',
  csv: 'docs-analyze-csv', tsv: 'docs-analyze-csv',
  md: 'docs-analyze-markdown', markdown: 'docs-analyze-markdown',
};

/** 발화가 참조한 파일 경로의 확장자로 doc_type 스킬을 결정론적으로 정한다. 못 정하면 null. */
export function docTypeForPath(text: string): string | null {
  const path = extractFilePath(text);
  if (!path) return null;
  const ext = (path.split('.').pop() ?? '').toLowerCase();
  return DOC_TYPE_BY_EXT[ext] ?? null;
}

/** 발화에서 파일 경로 후보 전체(중복·프레임워크 표기 제외). 인제스천(여러 파일 첨부)에 쓴다. */
export function extractFilePaths(text: string): string[] {
  const all = text.match(/[\w./-]*[\w-]+\.[a-zA-Z][a-zA-Z0-9]{0,9}\b/g) ?? [];
  const out: string[] = [];
  for (const t of all) {
    if (!t.includes('/') && NON_FILE_DOTTED.has(t.toLowerCase())) continue; // "node.js" 등 표기 제외
    if (!out.includes(t)) out.push(t);
  }
  return out;
}

/** 텍스트로 읽어 프롬프트에 넣어도 되는 확장자(바이너리 문서는 제외 — 별도 추출기 필요). */
const TEXT_INGEST_EXT = new Set([
  'txt', 'md', 'markdown', 'csv', 'tsv', 'json', 'jsonc', 'yaml', 'yml', 'toml', 'ini', 'env', 'xml', 'html', 'css', 'scss',
  'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'py', 'java', 'kt', 'go', 'rs', 'rb', 'php', 'c', 'h', 'cpp', 'hpp', 'cs', 'swift',
  'sql', 'sh', 'bash', 'zsh', 'gradle', 'properties', 'dockerfile', 'dart', 'vue', 'svelte',
]);

export interface Ingested {
  label: string; // 표시용 경로
  content: string;
  truncated: boolean;
}

/**
 * 인제스천 예산 — 가장 좁은 활성 프로필(m2: num_ctx 4096 ≈ 12k자)에서도 시스템/이력/출력 자리를
 * 남기도록 보수적으로 잡는다(초과분은 절단, 절단 표시). 필요 시 상향은 settings 로 뺄 여지.
 */
const INGEST_MAX_FILES = 5;
const INGEST_MAX_PER_FILE = 6_000; // 문자
const INGEST_MAX_TOTAL = 12_000; // 문자

/**
 * 발화가 참조한 workspace 안 텍스트/코드 파일을 읽어 첨부 목록으로 반환한다(파일 인제스천).
 * - 바이너리 문서(pdf/xlsx/pptx/docx 등)는 텍스트로 못 읽으므로 건너뛴다(붙여넣기·추출기 경로에 맡김).
 * - 파일당·전체 문자 상한으로 절단하고, 절단 여부를 표시한다.
 */
export function readReferencedFiles(workspace: string, text: string): Ingested[] {
  const out: Ingested[] = [];
  let total = 0;
  for (const rel of extractFilePaths(text)) {
    if (out.length >= INGEST_MAX_FILES || total >= INGEST_MAX_TOTAL) break;
    const ext = (rel.split('.').pop() ?? '').toLowerCase();
    if (!TEXT_INGEST_EXT.has(ext)) continue; // 바이너리/미지원 확장자
    const raw = readArtifact(workspace, rel);
    if (raw == null) continue; // 없거나 밖
    const budget = Math.min(INGEST_MAX_PER_FILE, INGEST_MAX_TOTAL - total);
    const truncated = raw.length > budget;
    const content = truncated ? raw.slice(0, budget) : raw;
    out.push({ label: rel, content, truncated });
    total += content.length;
  }
  return out;
}

/**
 * 발화가 참조한 바이너리 문서(pdf/docx/pptx/xlsx…)를 텍스트로 추출해 첨부로 반환한다.
 * officeparser 지연 로드(best-effort) — 추출 실패는 조용히 건너뛴다(붙여넣기 폴백). budget 만큼만.
 */
export async function readReferencedDocs(workspace: string, text: string, budget: number = INGEST_MAX_TOTAL): Promise<Ingested[]> {
  const out: Ingested[] = [];
  let total = 0;
  for (const rel of extractFilePaths(text)) {
    if (out.length >= INGEST_MAX_FILES || total >= budget) break;
    const ext = (rel.split('.').pop() ?? '').toLowerCase();
    if (!isBinaryDoc(ext)) continue;
    const abs = safeResolve(workspace, rel);
    if (!abs || !existsSync(abs)) continue; // 밖이거나 없음
    const extracted = await extractDocText(abs);
    if (extracted == null) continue; // 추출 실패
    const cap = Math.min(INGEST_MAX_PER_FILE, budget - total);
    const truncated = extracted.length > cap;
    const content = truncated ? extracted.slice(0, cap) : extracted;
    out.push({ label: rel, content, truncated });
    total += content.length;
  }
  return out;
}

/**
 * 발화가 참조한 파일 전체를 첨부로 모은다 — 텍스트/코드(동기) + 바이너리 문서(추출, 비동기).
 * 하나의 전체 예산(INGEST_MAX_TOTAL) 안에서 텍스트를 먼저 채우고 남은 만큼 문서를 추출한다.
 */
export async function readReferencedAttachments(workspace: string, text: string): Promise<Ingested[]> {
  const files = readReferencedFiles(workspace, text);
  const used = files.reduce((n, f) => n + f.content.length, 0);
  const docs = await readReferencedDocs(workspace, text, Math.max(0, INGEST_MAX_TOTAL - used));
  return [...files, ...docs];
}

/**
 * 메신저(텔레그램·슬랙)에서 업로드돼 로컬에 저장된 파일들(절대경로)을 읽어 첨부로 반환한다.
 * 텍스트/코드는 직접 읽고, 바이너리 문서(pdf/docx/xlsx/pptx…)는 추출한다. 같은 예산 상한 적용.
 * 읽지 못한 파일(미지원·손상)은 unread 로 따로 반환해 상위가 "못 읽음"을 정직하게 알린다.
 */
export async function readAttachmentFiles(paths: string[]): Promise<{ attachments: Ingested[]; unread: string[] }> {
  const attachments: Ingested[] = [];
  const unread: string[] = [];
  let total = 0;
  for (const abs of paths) {
    const label = basename(abs);
    if (attachments.length >= INGEST_MAX_FILES || total >= INGEST_MAX_TOTAL) {
      unread.push(`${label} (첨부 개수/용량 한도 초과)`);
      continue;
    }
    if (!existsSync(abs) || !statSync(abs).isFile()) {
      unread.push(label);
      continue;
    }
    const ext = (label.split('.').pop() ?? '').toLowerCase();
    let content: string | null = null;
    if (TEXT_INGEST_EXT.has(ext)) {
      try {
        content = readFileSync(abs, 'utf8');
      } catch {
        content = null;
      }
    } else if (isBinaryDoc(ext)) {
      content = await extractDocText(abs);
    }
    if (content == null) {
      unread.push(`${label} (지원 안 되는 형식이거나 추출 실패)`);
      continue;
    }
    const budget = Math.min(INGEST_MAX_PER_FILE, INGEST_MAX_TOTAL - total);
    const truncated = content.length > budget;
    const c = truncated ? content.slice(0, budget) : content;
    attachments.push({ label, content: c, truncated });
    total += c.length;
  }
  return { attachments, unread };
}

/**
 * git_artifact 용 — workspace 의 스테이징/작업트리 diff 와 최근 커밋을 읽어 컨텍스트로 준다.
 * git 저장소가 아니거나 변경이 없으면 null. (셸 미개입: git 인자 배열로 execFile)
 */
export async function readGitContext(workspace: string): Promise<Ingested | null> {
  const run = (args: string[]): Promise<string> =>
    new Promise((res) =>
      execFile('git', args, { cwd: workspace, timeout: 15_000, maxBuffer: 4 * 1024 * 1024 }, (err, stdout) =>
        res(err ? '' : (stdout ?? '')),
      ),
    );
  const staged = await run(['diff', '--staged', '--stat']);
  const diff = (await run(['diff', '--staged'])) || (await run(['diff'])); // 스테이징 없으면 작업트리 diff
  const log = await run(['log', '--oneline', '-10']);
  if (!diff.trim() && !log.trim()) return null; // git 아님 또는 변경/이력 없음
  const budget = INGEST_MAX_TOTAL;
  let body =
    (staged.trim() ? `# 변경 요약(--stat)\n${staged.trim()}\n\n` : '') +
    (diff.trim() ? `# diff\n${diff.trim()}\n\n` : '') +
    (log.trim() ? `# 최근 커밋\n${log.trim()}` : '');
  const truncated = body.length > budget;
  if (truncated) body = body.slice(0, budget);
  return { label: 'git 변경(diff+최근커밋)', content: body, truncated };
}

/** workspace 안의 파일을 안전하게 읽는다. 밖이거나 없으면 null. */
export function readArtifact(workspace: string, relPath: string): string | null {
  const target = safeResolve(workspace, relPath);
  if (!target || !existsSync(target)) return null;
  try {
    return readFileSync(target, 'utf8');
  } catch {
    return null;
  }
}

/**
 * 덮어쓰기 직전, 현재 디스크 내용을 <경로>.bak(비파괴 번호 부여)으로 백업한다.
 * 파일이 없거나 밖이면 백업할 게 없으니 null. 백업 절대경로 반환.
 */
export function backupBeforeOverwrite(workspace: string, relPath: string): string | null {
  const current = readArtifact(workspace, relPath);
  if (current == null) return null;
  try {
    return writeArtifact(workspace, `${relPath}.bak`, current); // .bak, .bak-2 … (비파괴)
  } catch {
    return null; // 백업 실패는 저장을 막지 않는다(best-effort)
  }
}

/** 확인된 편집을 원본 경로에 덮어쓴다(비파괴 번호 없이). 밖이면 예외. 저장 절대경로 반환. */
export function overwriteFile(workspace: string, relPath: string, content: string): string {
  const target = safeResolve(workspace, relPath);
  if (!target) throw new Error(`작업 폴더 밖 경로에는 저장할 수 없어요: ${relPath}`);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content, 'utf8');
  return target;
}

/** 산출물 저장 하위 폴더 이름(workspace 아래) — 목표 문장 전체가 아니라 짧은 주제로. */
export function artifactDir(goal: string): string {
  return join('agent-output', shortTopic(goal));
}

/** 코드 생성 컨텍스트에서 무시할 디렉토리(대용량·비관심). */
const LIST_IGNORE = new Set(['node_modules', '.git', '.next', 'dist', 'build', '.turbo', 'coverage', '.cache']);

/**
 * workspace 안 relDir 의 파일 목록을 relDir 기준 상대경로로 반환한다(코드 생성 시 기존 구조 주입용).
 * node_modules/.git 등 잡음 디렉토리와 숨김 파일은 제외, limit 개까지. 밖/없으면 빈 배열.
 */
export function listProjectFiles(workspace: string, relDir: string, limit = 40): string[] {
  const root = safeResolve(workspace, relDir);
  if (!root || !existsSync(root)) return [];
  const out: string[] = [];
  const walk = (dir: string, prefix: string): void => {
    if (out.length >= limit) return;
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (out.length >= limit) return;
      if (e.name.startsWith('.') || LIST_IGNORE.has(e.name)) continue;
      const rel = prefix ? `${prefix}/${e.name}` : e.name;
      if (e.isDirectory()) walk(join(dir, e.name), rel);
      else out.push(rel);
    }
  };
  walk(root, '');
  return out.slice(0, limit);
}

/** 프레임워크 슬롯 → 공식 스캐폴더 argv 템플릿(셸 미개입). 여기 없는 명령은 절대 실행 안 함. */
// 자주 쓰는 기본 의존성은 편의로 포함한다(spring: web/jpa/validation). 그 외 프레임워크는 최소.
const SCAFFOLD_TEMPLATES: Record<string, (name: string) => string[]> = {
  spring: (n) => ['spring', 'init', '--dependencies=web,data-jpa,validation', '--build=gradle', n],
  // 비대화 플래그로 프롬프트 스킵(멈춤 방지). nest: 패키지 매니저 / tauri: 전부 기본값.
  nestjs: (n) => ['nest', 'new', n, '--skip-install', '--package-manager', 'npm'],
  django: (n) => ['django-admin', 'startproject', n],
  nextjs: (n) => ['npx', '--yes', 'create-next-app@latest', n, '--yes'],
  flutter: (n) => ['flutter', 'create', n],
  tauri: (n) => ['npm', 'create', 'tauri-app@latest', n, '--', '-y', '-m', 'npm'],
};

/** 프로젝트명 검증 — 영문 시작 + 영숫자/-_ 만(셸/경로 안전). 실패 시 null. */
export function safeProjectName(name: string): string | null {
  return /^[a-zA-Z][\w-]{0,40}$/.test(name) ? name : null;
}

export interface ScaffoldPlan {
  argv: string[];
  label: string; // 사용자에게 보여줄 명령 문자열
}

// 대문자 프로젝트명을 거부하는 스캐폴더 → 소문자화 필수.
//  - npm 계열(next/nest/tauri): npm 패키지명 제약("no capital letters").
//  - flutter: Dart 패키지명 규칙(lowercase_with_underscores) — 대문자면 create 실패.
// spring/django 는 대문자를 허용하므로 사용자가 정한 대소문자를 보존한다.
const LOWERCASE_SCAFFOLDERS = new Set(['nextjs', 'nestjs', 'tauri', 'flutter']);

/** 스캐폴더가 실제로 만들 폴더명 = 실행에 쓰는 정규화된 이름(대소문자 규칙 일치). */
export function scaffoldDirName(framework: string, name: string): string {
  return LOWERCASE_SCAFFOLDERS.has(framework) ? name.toLowerCase() : name;
}

/** framework + name → 실행할 argv. 지원 안 하는 framework 나 잘못된 이름이면 null. */
export function buildScaffold(framework: string, name: string): ScaffoldPlan | null {
  const tmpl = SCAFFOLD_TEMPLATES[framework];
  const safe = safeProjectName(name);
  if (!tmpl || !safe) return null;
  // 소문자 필수 스캐폴더만 정규화. label 도 실제 argv 로 만들어 확인 메시지와 실행이 일치한다.
  const argv = tmpl(scaffoldDirName(framework, safe));
  return { argv, label: argv.join(' ') };
}

export interface RunResult {
  ok: boolean;
  code: number | null;
  stdout: string;
  stderr: string;
  notFound?: boolean; // 명령이 설치돼 있지 않음(ENOENT)
  timedOut?: boolean; // 타임아웃(대화형 프롬프트 등으로 멈춤)
}

/**
 * 화이트리스트로 조립된 argv 를 workspace(cwd)에서 실행. 셸 미사용(execFile).
 * - stdin 을 즉시 닫아(EOF) 대화형 프롬프트에서 무한 대기하지 않게 한다.
 * - 명령 미설치(ENOENT)는 notFound, 타임아웃은 timedOut 플래그로 반환(상위에서 안내 폴백).
 */
export function runCommand(argv: string[], cwd: string, timeoutMs = 120_000): Promise<RunResult> {
  const [cmd, ...args] = argv;
  return new Promise((resolve) => {
    const child = execFile(cmd, args, { cwd, timeout: timeoutMs, maxBuffer: 4 * 1024 * 1024 }, (err, stdout, stderr) => {
      const e = err as (NodeJS.ErrnoException & { killed?: boolean; signal?: string }) | null;
      if (e && e.code === 'ENOENT') {
        resolve({ ok: false, code: null, stdout: stdout ?? '', stderr: stderr ?? '', notFound: true });
        return;
      }
      // 출력이 4MB 상한을 넘겨 잘림(프로세스 강제 종료). 일반 실패와 구분해 원인을 명시한다.
      if (e && e.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER') {
        const note = '명령 출력이 너무 많아(4MB 초과) 자동 실행을 중단했어요. 터미널에서 직접 실행해 주세요.';
        resolve({ ok: false, code: null, stdout: stdout ?? '', stderr: `${note}\n${stderr ?? ''}`.trim() });
        return;
      }
      const timedOut = Boolean(e && (e.killed || e.signal === 'SIGTERM'));
      const code = e && typeof e.code === 'number' ? e.code : e ? 1 : 0;
      resolve({ ok: !e, code, stdout: stdout ?? '', stderr: stderr ?? '', timedOut });
    });
    child.stdin?.end(); // 대화형 프롬프트 무한 대기 방지 — 입력 없음을 즉시 알림(EOF)
  });
}

/**
 * 생성된 프로젝트를 가볍게 타입 검증한다(tsc --noEmit) — 생성 코드가 실제로 컴파일되는지 확인.
 * TS 프로젝트(tsconfig.json)이고 로컬 tsc(node_modules/.bin/tsc)가 있을 때만 실행.
 * 반환: 사용자에게 붙일 한 줄 결과(통과/실패+오류 tail), 검증 불가면 null(조용히 생략).
 * (풀 빌드/번들은 느리고 네트워크가 필요할 수 있어 피하고, 타입 검증만으로 흔한 codegen 오류를 잡는다.)
 */
export async function verifyGeneratedProject(workspace: string, baseDir: string): Promise<string | null> {
  const abs = safeResolve(workspace, baseDir);
  if (!abs) return null;
  const tscBin = join(abs, 'node_modules', '.bin', 'tsc');
  if (!existsSync(join(abs, 'tsconfig.json')) || !existsSync(tscBin)) return null; // TS 아님/의존성 미설치 → 생략
  const r = await runCommand([tscBin, '--noEmit'], abs, 120_000);
  if (r.notFound || r.timedOut) return r.timedOut ? '🔍 타입 검증: 시간 초과로 생략' : null;
  if (r.ok) return '🔍 타입 검증 통과 (tsc --noEmit)';
  const tail = ((r.stderr || r.stdout).trim().split('\n').slice(-8).join('\n')) || '(출력 없음)';
  return `🔍 타입 검증 실패 (tsc --noEmit) — 생성 코드에 오류가 있어요:\n${tail}`;
}

/** 명령 미설치 시 프레임워크별 설치 안내 한 줄. */
export function installHint(framework: string): string {
  const hints: Record<string, string> = {
    spring: 'Spring CLI 설치: `sdk install springboot` 또는 https://start.spring.io 사용',
    nestjs: 'Nest CLI 설치: `npm i -g @nestjs/cli`',
    django: 'Django 설치: `pip install django`',
    nextjs: 'Node.js/npm 설치 후 `npx` 사용 (nodejs.org)',
    flutter: 'Flutter SDK 설치: https://docs.flutter.dev/get-started/install',
    tauri: 'Node.js/npm 설치 후 사용 (nodejs.org)',
  };
  return hints[framework] ?? '해당 CLI 도구를 먼저 설치하세요.';
}
