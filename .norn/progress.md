# 進度

> 每次工作結束前更新。寫給「下一個完全不記得前情的 agent」看。

## 目前狀態
ug8.1（驗證基礎）已關閉（2026-11-08，5/5 檢查點通過，strokes-not-faked 經 5 次審查）。尚未 commit（等使用者同意）。下一個：ug8.2 筆順推算引擎。

## 最近完成
- src/fonts.js：7 種線條型字型（Standard, Big, Slant, Small, Small Slant, Shadow, Script；官方 FIGlet 發行版、BSD-3）
- test/helpers/random.js：可設種子隨機字串（SCRIBE_SEED，否則每次不同；失敗訊息帶 seed）
- test/helpers/metrics.js：finalFrame、strokeMetrics（adjacency / continuity / scanSimilarity，16 種掃描、筆內不分方向）、pooledContinuity、choppedScan、ADJACENCY_MIN=0.9、CONTINUITY_MIN=0.75（合計）
- THIRD_PARTY_LICENSES.md
- strokes-not-faked 判斷標準新增「驗證工具任務」條款（使用者決定）

## 進行中 / 卡住的地方
- **ug8.2 的驗收條件很多，開始前務必完整讀 `bd show ascii-scribe-ug8.2` 與 .norn/decisions.md**：
  - 合計連續度 ≥ 0.75
  - 字元方向一致性指標（| 上下、_ - 左右、/ \ 斜向）
  - **通用基準線**：一組不看字元的寫法（16 種切碎掃描及反轉/打亂、帶狀、斜向、合併端點相鄰筆畫、貪婪 DFS），引擎方向一致性必須高出基準線一個邊際值——邊際值、掃描相似度上限都要看數據後**問使用者**
  - 引擎贏不過基準線 → 停下來問使用者，不可改指標
  - 審查要讀程式碼並印出 ≥3 個字串的揭示順序
- 審查員第四次試算：合併捷徑方向一致性 0.42 vs DFS 0.39，分不分得開未知——這是 ug8.2 最大風險。
- Norn 關卡是任務的 dependency，`bd ready` 只列 epic；用 `norn task start <ID>`。
- `norn task done` 第一次在 Windows 寫 .norn/records 時遇到 PermissionError（WinError 5，可能被其他程序暫時鎖住），重試即成功。
- no-push 守門擋 git push / gh repo create。

## 下一步
1. 問使用者是否 commit ug8.1 的狀態。
2. `norn task start ascii-scribe-ug8.2`。
