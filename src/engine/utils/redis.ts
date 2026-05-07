import Redis from "ioredis";
import { AgentState } from "../types";

const TTL_SECONDS = 60 * 60 * 24; // 24시간

class RedisClient {
  private redis: Redis;

  constructor(redis: Redis) {
    this.redis = redis;
  }

  /**
   * 상태 저장 (Save)
   * 에이전트의 각 노드(Step)가 끝날 때마다 호출하여 최신 상태를 유지합니다.
   */
  async saveState(state: AgentState): Promise<void> {
    const key = `agent:session:${state.sessionId}`;

    // JSON 직렬화 (Date 객체 처리를 위해 필요시 커스텀 replacer 사용)
    const serializedState = JSON.stringify(state);

    // 가성비를 위해 TTL(Time To Live) 설정, 진행 중인 세션은 24시간 후 자동 삭제하여 Redis 용량 관리
    await this.redis.set(key, serializedState, "EX", TTL_SECONDS);

    // (선택) 보안 감사를 위해 변경 이력을 List나 Stream으로 기록할 수 있습니다.
    // await redis.lpush(`agent:history:${state.sessionId}`, serializedState);
  }

  /**
   * 상태 불러오기 (Load)
   * sessionId를 기반으로 이전 작업 흐름을 복구합니다.
   */
  async loadState(sessionId: string): Promise<AgentState | null | undefined> {
    const key = `agent:session:${sessionId}`;
    const data = await this.redis.get(key);

    if (!data) return null;

    try {
      return JSON.parse(data) as AgentState;
    } catch (error) {
      console.log(`\n\x1b[2m[Redis Data Parsing Error] ${error}\x1b[0m`);
      return null;
    }
  }
}

export default RedisClient;
