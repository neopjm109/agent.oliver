import express from "express";
import Agent from "../engine/agent/agent";

const app = express();

app.set("port", process.env.PORT || 9999);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.get("/query/:q", (req, res) => {
  const { q } = req.params; // 경로에서 'id' 변수 추출
  const agent = new Agent();
  agent.run(q);
  agent.run(`
# 제목
## 서브제목
- 테스트중입니다
- 이걸 복잡한걸로 받아줄까요?
- 단순하게 할 땐 안되더라구요
    `);
  res.send("Hello World!");
});

app.listen(app.get("port"), () => {
  console.log(app.get("port"), "번에서 대기중");
});
