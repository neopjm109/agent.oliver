import express from "express";
import Agent from "../engine/agent/agent";

const app = express();

app.set("port", process.env.PORT || 9999);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.get("/query/:q", async (req, res) => {
  const { q } = req.params; // 경로에서 'id' 변수 추출
  const agent = new Agent();
  const result = await agent.run(q);
  console.log(result);
  res.send(result);
});

app.get("/prd", async (req, res) => {
  const agent = new Agent();
  const result = await agent.run(`
#계산기 웹페이지 만들기

## 요구사항
- 웹페이지로 계산기 기능을 만든다
- 키보드 숫자키패드 배열과 수식 버튼을 만든다. (0~9, +, -, *, /, C, =)
- 키보드 숫자키패드 입력시 상단에 입력되는 숫자와 수식이 보여져야한다.
- = 을 눌렀을 경우, 입력된 수식이 실행이 되어야한다.
- C 를 누르면, 입력된 수식이 초기화 된다.
- 기능 구현시, eval은 사용하지 않는다.
`);
  console.log(result);
  res.send(result);
});

app.listen(app.get("port"), () => {
  console.log(app.get("port"), "번에서 대기중");
});
