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
  const result = agent.run(``);
  console.log(result);
  res.send(result);
});

app.listen(app.get("port"), () => {
  console.log(app.get("port"), "번에서 대기중");
});
