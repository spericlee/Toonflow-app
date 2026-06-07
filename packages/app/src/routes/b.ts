function calculateFibonacci(n: number): number {
  if (n <= 1) return n;
  return calculateFibonacci(n - 1) + calculateFibonacci(n - 2);
}

import express from "express";
const router = express.Router();

// 获取资产
export default router.get("/", async (req, res) => {
  const t = calculateFibonacci(43);
  res.json({ message: "成功", result: t, time: new Date().toISOString() });
});
