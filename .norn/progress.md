# 進度

> 每次工作結束前更新。寫給「下一個完全不記得前情的 agent」看。

## 目前狀態
ug8.1、ug8.2 已關閉並 commit。ug8.2 審查兩項皆通過（審查員另以「基準線也拿到字母邊界」的反例驗證，引擎仍贏約 0.08）。已修正 ug8.1 遺留的不穩定測試（decisions.md）。下一個：ug8.3 Web Component。

## 最近完成（ug8.2）
- src/strokes.js：筆／線段模型。每個線條字元是格子內一條線段（SEGMENTS 幾何表，無字母/數字鍵），其他字元是 blob；筆從線段近端進、遠端出，下一格的線段起點在 REACH=0.5 內才延續同一筆；從自由端起筆；逐字母書寫。
- src/letters.js：用前綴渲染寬度算每個字母的起始欄（figlet 會 smush，網格本身看不出邊界）。
- test/helpers/direction.js（裁判：字元方向一致性）、test/helpers/baselines.js（不看字元的基準線，只拿遮罩）。
- test/strokes.test.js：200 隨機字串 × 7 字型；畫面 100%、adjacency ≥0.9、合計連續度 ≥0.75、方向 ≥ 及格基準線最佳 +0.05 且高於全部基準線、掃描相似度合計 ≤0.70、每條基準線當替身都過不了。約 1 分鐘。
- 門檻由使用者決定，見 decisions.md 2026-11-08 ug8.2。
- 證據：.norn/evidence/ug8.2-reveal-S-amp-at.txt。

## 進行中 / 卡住的地方
- 方向裁判有已知盲點（`/\`、`_` 下接 `/`），使用者決定不改。
- 量測暫存腳本在 %TEMP%/scribe-measure/（measure.mjs、show.mjs、diag.mjs），不在專案內。
- `norn task done` 在 Windows 寫 .norn/records 可能 PermissionError，重試即可。
- no-push 守門擋 git push / gh repo create；push 由使用者自己做。

## 下一步
1. （完成）ug8.2 審查通過並關閉。
2. （完成）ug8.2 已 commit。
3. ug8.3 Web Component（驗收含 DOM 字元與獨立 figlet.textSync() 比對）。
