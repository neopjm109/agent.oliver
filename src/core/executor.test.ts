import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  extractProjectName,
  extractFilePath,
  extractFilePaths,
  docTypeForPath,
  readReferencedFiles,
  readReferencedAttachments,
  readGitContext,
  safeProjectName,
  slugify,
  buildScaffold,
  scaffoldDirName,
  writeArtifact,
  overwriteFile,
  readArtifact,
  backupBeforeOverwrite,
  verifyGeneratedProject,
} from './executor.js';

test('extractProjectName: 프레임워크/불용어를 건너뛰고 이름 후보를 뽑는다', () => {
  assert.equal(extractProjectName('스프링 프로젝트 myapp 만들어줘'), 'myapp');
  assert.equal(extractProjectName('nextjs 프론트 프로젝트 생성'), null); // 전부 불용어
  assert.equal(extractProjectName('REST API 서버'), null); // 전부 대문자 약어
});

test('extractProjectName: M1 회귀 — 기술어 오선택 방지 + 명시 이름 우선', () => {
  assert.equal(extractProjectName('Spring Boot 프로젝트 만들어줘'), null); // "Boot" 를 이름으로 안 뽑음
  assert.equal(extractProjectName('GraphQL 서버 만들어줘'), null); // graphql stop
  assert.equal(extractProjectName('이름은 shopmall 로 만들어줘'), 'shopmall'); // 명시 이름
  assert.equal(extractProjectName('"orders" 라는 프로젝트'), 'orders'); // 따옴표 명시
  assert.equal(extractProjectName('blog 라는 이름으로 스프링'), 'blog'); // X라는
  // R2 회귀 — 앞에 다른 latin 토큰(decoy)이 있어도 "X라는" 의 X 를 이름으로 집는다(폴백 오선택 방지).
  assert.equal(extractProjectName('myfeature 관련 shopmall라는 프로젝트 만들어줘'), 'shopmall');
});

test('safeProjectName: 셸/경로 안전 이름만 통과', () => {
  assert.equal(safeProjectName('myapp'), 'myapp');
  assert.equal(safeProjectName('my-app_2'), 'my-app_2');
  assert.equal(safeProjectName('1abc'), null); // 숫자 시작 거부
  assert.equal(safeProjectName('a b'), null); // 공백 거부
  assert.equal(safeProjectName('a;rm -rf'), null); // 특수문자 거부
});

test('extractFilePath: 확장자 있는 경로 토큰을 뽑는다', () => {
  assert.equal(extractFilePath('src/foo.ts 좀 고쳐줘'), 'src/foo.ts');
  assert.equal(extractFilePath('이 부분 삭제'), null);
});

test('extractFilePath: L5 회귀 — 슬래시 경로 우선, node.js 같은 표기는 파일로 오인 안 함', () => {
  assert.equal(extractFilePath('node.js 코드 고쳐줘'), null); // 프레임워크 표기
  assert.equal(extractFilePath('app.js 고쳐줘'), 'app.js'); // 진짜 파일명은 유지
  assert.equal(extractFilePath('node.js 말고 src/index.ts 고쳐줘'), 'src/index.ts'); // 경로 우선
});

test('docTypeForPath: 확장자로 doc_type 스킬을 결정론적으로', () => {
  assert.equal(docTypeForPath('report.docx 분석해줘'), 'docs-analyze-docx');
  assert.equal(docTypeForPath('sales.xlsx 정리해줘'), 'docs-analyze-xlsx');
  assert.equal(docTypeForPath('deck.pptx 요약'), 'docs-analyze-pptx');
  assert.equal(docTypeForPath('spec.pdf 읽어줘'), 'docs-analyze-pdf');
  assert.equal(docTypeForPath('data.csv 봐줘'), 'docs-analyze-csv');
  assert.equal(docTypeForPath('경로 없음'), null);
});

test('extractFilePaths: 참조된 경로 전체(중복·표기 제외)', () => {
  assert.deepEqual(extractFilePaths('src/a.ts 랑 src/b.ts 리뷰해줘'), ['src/a.ts', 'src/b.ts']);
  assert.deepEqual(extractFilePaths('node.js 말고 app.py 봐줘'), ['app.py']); // node.js 표기 제외
  assert.deepEqual(extractFilePaths('그냥 텍스트'), []);
});

test('파일 인제스천: 텍스트/코드만 읽고 바이너리·부재·예산초과는 처리', () => {
  const ws = mkdtempSync(join(tmpdir(), 'ingest-'));
  mkdirSync(join(ws, 'src'));
  writeFileSync(join(ws, 'src/app.ts'), 'export const x = 1;', 'utf8');
  writeFileSync(join(ws, 'notes.md'), '# 메모\n내용', 'utf8');
  writeFileSync(join(ws, 'report.pdf'), 'binary-ish', 'utf8'); // 바이너리 확장자 → 스킵

  const got = readReferencedFiles(ws, 'src/app.ts 랑 notes.md 랑 report.pdf 분석해줘');
  const labels = got.map((g) => g.label);
  assert.deepEqual(labels, ['src/app.ts', 'notes.md']); // pdf 제외
  assert.equal(got[0].content, 'export const x = 1;');
  assert.equal(got[0].truncated, false);

  // 없는 파일은 조용히 스킵
  assert.deepEqual(readReferencedFiles(ws, 'src/missing.ts 봐줘'), []);

  // 파일당 상한 초과 시 절단 표시
  writeFileSync(join(ws, 'big.txt'), 'a'.repeat(10_000), 'utf8');
  const big = readReferencedFiles(ws, 'big.txt 정리해줘');
  assert.equal(big[0].truncated, true);
  assert.ok(big[0].content.length < 10_000);
});

test('verifyGeneratedProject: TS 프로젝트/의존성 아니면 조용히 null(#6)', async () => {
  const ws = mkdtempSync(join(tmpdir(), 'verify-'));
  // tsconfig 없음 → null
  assert.equal(await verifyGeneratedProject(ws, '.'), null);
  // tsconfig 는 있으나 node_modules/.bin/tsc 없음 → null(의존성 미설치 생략)
  writeFileSync(join(ws, 'tsconfig.json'), '{}', 'utf8');
  assert.equal(await verifyGeneratedProject(ws, '.'), null);
  // 작업 폴더 밖 → null
  assert.equal(await verifyGeneratedProject(ws, '../nope'), null);
});

test('readGitContext: git 저장소가 아니면 null', async () => {
  const ws = mkdtempSync(join(tmpdir(), 'nogit-'));
  assert.equal(await readGitContext(ws), null);
});

test('readReferencedAttachments: 텍스트는 읽고, 손상/부재 바이너리는 조용히 건너뜀', async () => {
  const ws = mkdtempSync(join(tmpdir(), 'attach-'));
  writeFileSync(join(ws, 'a.ts'), 'const y = 2;', 'utf8');
  writeFileSync(join(ws, 'broken.pdf'), 'not really a pdf', 'utf8'); // 추출 실패 → 건너뜀

  const got = await readReferencedAttachments(ws, 'a.ts 랑 broken.pdf 랑 missing.docx 분석해줘');
  const labels = got.map((g) => g.label);
  assert.ok(labels.includes('a.ts')); // 텍스트는 읽힘
  assert.ok(!labels.includes('broken.pdf')); // 손상 바이너리는 스킵(graceful)
  assert.ok(!labels.includes('missing.docx')); // 없는 파일도 스킵
});

test('slugify: 폴더명 슬러그', () => {
  assert.equal(slugify('주문 도메인 설계!!'), '주문-도메인-설계');
  assert.equal(slugify('   '), 'plan');
});

test('buildScaffold: 화이트리스트만, 소문자 필수 스캐폴더만 소문자화(M5/R1)', () => {
  const spring = buildScaffold('spring', 'MyApp');
  assert.ok(spring);
  assert.ok(spring!.argv.includes('MyApp'), 'spring 은 대소문자 보존'); // M5
  const next = buildScaffold('nextjs', 'MyApp');
  assert.ok(next);
  assert.ok(next!.argv.includes('myapp'), 'npm 계열은 소문자'); // create-next-app 대문자 거부 회피
  assert.ok(!next!.argv.includes('MyApp'));
  // R1 회귀 — flutter 는 Dart 패키지 규칙상 소문자여야 한다(대문자면 create 실패).
  const flutter = buildScaffold('flutter', 'MyApp');
  assert.ok(flutter);
  assert.ok(flutter!.argv.includes('myapp'), 'flutter 도 소문자');
  assert.ok(!flutter!.argv.includes('MyApp'));
  assert.equal(buildScaffold('unknown-fw', 'app'), null);
  assert.equal(buildScaffold('spring', '1bad'), null); // 잘못된 이름
});

test('scaffoldDirName: 실행 폴더명 규칙이 buildScaffold 와 일치(R3)', () => {
  assert.equal(scaffoldDirName('spring', 'MyApp'), 'MyApp'); // 보존
  assert.equal(scaffoldDirName('django', 'MyApp'), 'MyApp'); // 보존
  assert.equal(scaffoldDirName('flutter', 'MyApp'), 'myapp'); // 소문자
  assert.equal(scaffoldDirName('nextjs', 'MyApp'), 'myapp'); // 소문자
});

test('writeArtifact: 비파괴 저장(-2, -3) + 경로탈출 차단', () => {
  const ws = mkdtempSync(join(tmpdir(), 'exec-'));
  const p1 = writeArtifact(ws, 'a/b.txt', 'one');
  const p2 = writeArtifact(ws, 'a/b.txt', 'two');
  assert.notEqual(p1, p2); // 두 번째는 b-2.txt
  assert.equal(readFileSync(p1, 'utf8'), 'one');
  assert.equal(readFileSync(p2, 'utf8'), 'two');
  assert.throws(() => writeArtifact(ws, '../escape.txt', 'x'), /작업 폴더 밖/);
  assert.throws(() => writeArtifact(ws, '/etc/passwd', 'x'), /작업 폴더 밖/);
});

test('backupBeforeOverwrite: C1 — 덮어쓰기 전 원본을 .bak 으로 보존', () => {
  const ws = mkdtempSync(join(tmpdir(), 'exec-'));
  mkdirSync(join(ws, 'src'));
  writeFileSync(join(ws, 'src/f.ts'), 'original', 'utf8');

  const bak = backupBeforeOverwrite(ws, 'src/f.ts');
  assert.ok(bak && existsSync(bak));
  assert.equal(readFileSync(bak!, 'utf8'), 'original');

  overwriteFile(ws, 'src/f.ts', 'edited');
  assert.equal(readArtifact(ws, 'src/f.ts'), 'edited'); // 새 내용
  assert.equal(readFileSync(bak!, 'utf8'), 'original'); // 백업은 원본 유지

  // 없는 파일은 백업할 게 없음
  assert.equal(backupBeforeOverwrite(ws, 'src/missing.ts'), null);
});
