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
  res.send("Hello World!");
});

app.get("/prd", (req, res) => {
  const agent = new Agent();
  agent.run(``);
  res.send("Hello World!");
});

app.listen(app.get("port"), () => {
  console.log(app.get("port"), "번에서 대기중");
});
