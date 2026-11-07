<!-- norn -->
## Norn

本專案使用 Norn：任務存在 beads（`bd`），Norn 負責規則與檢查點，設定在 `.norn/`；規則與工作類型來自團隊、個人、專案三層（`norn layers`）。

- 可以做的任務用 `bd ready` 查看。受 Norn 追蹤的任務，必須通過 `norn task check <ID>` 的檢查點才能關閉，或直接用 `norn task done <ID>`。
- 開始任務前，執行 `norn task show <ID>` 和 `norn context --type <類型>`。
- 需要判斷的檢查點失敗，要先停下來詢問使用者。不要為了通過檢查去修改驗證條件，也不要繞過關卡。
- 結束前更新 `.norn/progress.md`；重要決策寫進 `.norn/decisions.md`。
