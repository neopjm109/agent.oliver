// 서버·클라이언트가 공유하는 접속 주소. 기본 127.0.0.1:7000.
// AGENT_HOST / AGENT_PORT 로 override.
export interface ServerAddr {
  host: string;
  port: number;
}

export function serverAddr(): ServerAddr {
  return {
    host: process.env.AGENT_HOST ?? '127.0.0.1',
    port: Number(process.env.AGENT_PORT ?? 7000),
  };
}

/** 루프백(로컬 전용) 바인딩인지. 아니면 서버가 요청의 workspace 로 임의 위치에 파일쓰기/명령실행을 하게 되어 위험. */
export function isLoopbackHost(host: string): boolean {
  return host === '127.0.0.1' || host === '::1' || host === 'localhost';
}
