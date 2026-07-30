// 배포(빌드 산출물) — 프레임워크별 "빌드 명령 + 산출물 경로 + 실행법"을 결정론 템플릿으로 낸다.
// Docker·CI·서버설정 없음(사용자 선호). 스택은 프로젝트 마커 파일로 자동 감지(환각 0).
// 감지 실패 시 호출부가 deploy-advisor(LLM 안내)로 폴백한다.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface BuildInfo {
  stack: string; // 표시명
  build: string[]; // 빌드 명령(순서대로)
  artifact: string; // 산출물 위치
  run: string; // 산출물 실행 명령
  notes?: string[]; // 주의/대안
}

/** 프로젝트 마커 파일로 스택을 감지한다. 못 찾으면 null(→ LLM 안내 폴백). */
export function detectStack(workspace: string): string | null {
  const has = (p: string): boolean => existsSync(join(workspace, p));
  if (has('pubspec.yaml')) return 'flutter';
  if (has('manage.py')) return 'django';
  if (has('go.mod')) return 'go';
  if (has('src-tauri')) return 'tauri';
  if (has('build.gradle') || has('build.gradle.kts') || has('pom.xml')) return 'spring';
  if (has('package.json')) {
    try {
      const pkg = JSON.parse(readFileSync(join(workspace, 'package.json'), 'utf8')) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      if (deps.next) return 'nextjs';
      if (deps['@nestjs/core'] || has('nest-cli.json')) return 'nestjs';
      if (deps['@tauri-apps/cli']) return 'tauri';
    } catch {
      /* package.json 파싱 실패 → generic node */
    }
    return 'node';
  }
  return null;
}

/** flutter 는 타깃이 여러 개 — 발화에서 고른다(기본 apk). */
function flutterTarget(text: string): BuildInfo {
  if (/\bweb\b|웹/i.test(text))
    return { stack: 'Flutter (web)', build: ['flutter build web --release'], artifact: 'build/web/', run: '정적 서버로 build/web/ 서빙 (예: npx serve build/web)' };
  if (/\bios\b|아이폰|아이오에스/i.test(text))
    return { stack: 'Flutter (iOS)', build: ['flutter build ipa --release'], artifact: 'build/ios/ipa/*.ipa', run: 'App Store Connect/TestFlight 업로드' };
  return {
    stack: 'Flutter (Android)',
    build: ['flutter build apk --release'],
    artifact: 'build/app/outputs/flutter-apk/app-release.apk',
    run: '기기/스토어에 apk 설치·배포',
    notes: ['웹으로 빌드하려면 "web", iOS 는 "ios" 라고 말해주세요.'],
  };
}

/** 스택 → 빌드 산출물 정보(결정론). */
export function buildInfo(stack: string, text = ''): BuildInfo | null {
  switch (stack) {
    case 'spring':
      return {
        stack: 'Spring Boot (Gradle)',
        build: ['./gradlew clean build -x test'],
        artifact: 'build/libs/*.jar (실행 가능한 fat jar)',
        run: 'java -jar build/libs/*.jar',
        notes: ['Maven 프로젝트면 `./mvnw clean package` → target/*.jar', 'JAR 은 그대로 서버에 올려 java 로 실행하면 됩니다(별도 런타임 불필요, JDK 만).'],
      };
    case 'nestjs':
      return { stack: 'NestJS', build: ['npm ci', 'npm run build'], artifact: 'dist/', run: 'node dist/main.js', notes: ['운영 의존성만 설치하려면 `npm ci --omit=dev`.'] };
    case 'nextjs':
      return {
        stack: 'Next.js',
        build: ['npm ci', 'npm run build'],
        artifact: '.next/ (next.config 에 output: "standalone" 이면 .next/standalone/)',
        run: 'npm start  (standalone 이면 node .next/standalone/server.js)',
        notes: ['정적 내보내기(output: "export")면 산출물은 out/ 이고 아무 정적 호스팅에나 올리면 됩니다.'],
      };
    case 'django':
      return {
        stack: 'Django',
        build: ['pip install -r requirements.txt', 'python manage.py collectstatic --noinput', 'python manage.py migrate'],
        artifact: '프로젝트 소스 + 수집된 정적파일(staticfiles/). (별도 번들 없음)',
        run: 'gunicorn <프로젝트>.wsgi:application --bind 0.0.0.0:8000',
        notes: ['`<프로젝트>` 를 settings.py 가 있는 패키지명으로 바꾸세요.', 'gunicorn 미설치면 `pip install gunicorn`.'],
      };
    case 'tauri':
      return { stack: 'Tauri', build: ['npm ci', 'npm run tauri build'], artifact: 'src-tauri/target/release/bundle/ (dmg/msi/AppImage 등)', run: '생성된 설치파일을 배포·설치', notes: ['OS 별로 그 OS 에서 빌드해야 합니다(크로스 빌드 제한).'] };
    case 'flutter':
      return flutterTarget(text);
    case 'go':
      return { stack: 'Go', build: ['go build -o bin/app ./...'], artifact: 'bin/app (단일 실행 바이너리)', run: './bin/app', notes: ['크로스 컴파일: GOOS/GOARCH 환경변수로.'] };
    case 'node':
      return { stack: 'Node.js', build: ['npm ci', 'npm run build'], artifact: 'dist/ 또는 build/ (빌드 스크립트에 따라)', run: 'node dist/index.js', notes: ['빌드 스크립트가 없으면 소스를 그대로 올려 `node <진입파일>` 로 실행합니다.'] };
    default:
      return null;
  }
}

/** 실행 가능한 build.sh 내용을 만든다. */
export function renderBuildScript(info: BuildInfo): string {
  return (
    '#!/usr/bin/env bash\n' +
    'set -euo pipefail\n\n' +
    `# ${info.stack} 빌드 스크립트 (자동 생성 — Docker/CI 없이 산출물만)\n\n` +
    info.build.join('\n') +
    '\n\n' +
    `echo "✅ 빌드 완료 — 산출물: ${info.artifact}"\n` +
    `echo "▶ 실행: ${info.run}"\n`
  );
}

/** 사람이 읽는 요약. */
export function renderBuildGuide(info: BuildInfo): string {
  const notes = info.notes?.length ? '\n\n참고:\n' + info.notes.map((n) => `- ${n}`).join('\n') : '';
  return (
    `🏗 ${info.stack} 빌드 산출물 배포\n\n` +
    `1) 빌드:\n${info.build.map((c) => `   ${c}`).join('\n')}\n` +
    `2) 산출물: ${info.artifact}\n` +
    `3) 실행: ${info.run}\n\n` +
    `위 순서를 담은 build.sh 를 첨부했어요. 프로젝트 루트에서 \`bash build.sh\` 로 실행하면 됩니다.${notes}`
  );
}
