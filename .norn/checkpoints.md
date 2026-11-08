---
name: ascii-scribe
checkpoints:
  - id: tests-pass
    title: 功能與筆順指標測試全過
    when: before_done
    by: command
    on_fail: fix
    run: npm test --silent
  - id: build-ok
    title: 能打包成網站可載入的單檔
    when: before_done
    by: command
    on_fail: fix
    run: npm run build --silent
  - id: strokes-not-faked
    title: 筆順是推算的，不是捷徑
    when: before_done
    by: ai-review
    on_fail: pause
  - id: license-ok
    title: 打包的套件與字型可重新散布
    when: before_done
    by: ai-review
    on_fail: pause
  - id: no-push
    title: 未經使用者同意不推送
    when: during
    by: guard
    guard_bash: ["\bgit(\s+-[cC]\s+\S+|\s+--\S+)*\s+push\b", "\bgh\s+repo\s+create\b"]
  - id: looks-like-writing
    title: 使用者親眼確認像在寫字
    when: deliver
    by: human
    important_only: true
  - id: final-confirm
    title: 使用者對照成功標準確認
    when: deliver
    by: human
    important_only: true
---
## 這次的目的

做一個 Web Component：把 figlet ASCII 大字**逐筆**寫出、倒序擦掉、多句循環。筆順必須從 figlet 輸出**自動推算**，任意英數符號 × 線條型字型都適用。最後由 yPin9.github.io 以 jsDelivr 釘版本引用。成功標準見 `.norn/ideas/ascii-scribe.md` 與目標 ascii-scribe-ug8。

最大的風險是「指標過了，但筆順其實是捷徑」，所以 strokes-not-faked 要讀程式碼，不能只看測試結果。

### strokes-not-faked
閱讀這次的 diff 與 `src/` 中的筆順推算程式、`test/` 中的指標測試，確認：

**正確的路徑**
- 筆順完全從 figlet 輸出的字元網格推算（例如依字元方向 `| _ / \ - ( )` 與鄰接關係串成筆畫、再排序），對任何字串與線條型字型都用同一套演算法。
- 指標測試的字串由程式隨機產生（字母、數字、符號混合，長度不固定），每次執行或每個種子不同；涵蓋已約定的 ≥5 種線條型字型。
- 「最終畫面逐字相同」是和 `figlet.textSync()` 的實際輸出比對；「同一筆內相鄰比例 ≥ 90%」用 8 鄰域計算。

**捷徑（出現任一項即不通過）**
- 程式中出現以字母／字元為鍵的筆順表或特例（例如 `if (ch === 'S')`），或只對展示句子的特殊處理。
- 揭示順序實質上就是掃描順序（上→下、左→右逐行），只是換了名字。審查者要實際印出一個字串的揭示順序來確認。
- 降低門檻（< 90%）、減少字型、把隨機字串換成固定清單、縮小字元集、放寬比對（例如忽略空白差異或只比對長度）。
- 修改、刪除、skip 既有測試，或吞掉例外讓測試通過。
- 指標計算方式本身被改得對結果有利（例如把跨筆畫的跳躍排除在分母之外，卻沒有理由）。

如果任務本身沒有碰到筆順程式或指標測試，確認沒有上述改動即可通過。

**只建立或修改驗證工具、沒有筆順引擎的任務**（使用者 2026-11-08 決定，避免無止境的攻防）：指標不可能零漏洞，這類任務的標準是——
- 上面的捷徑清單沒有出現；
- 這個任務的驗收條件與 `.norn/decisions.md` 中**已列出的捷徑**，都有反例測試證明會被抓出來；
- 審查中**新找到的漏洞**，如果使用者決定延後，已經寫進下一個引擎任務的驗收條件（作為反例測試），並記在 `.norn/decisions.md`。
符合以上三點即可通過；新漏洞要在審查結果中列出，但只要已依使用者決定記錄，就不構成不通過的理由。
**筆順引擎任務不適用這個例外**：引擎必須讓所有已記錄的反例（包含之前延後的）都被抓出來，並通過讀程式碼與印出揭示順序的檢查。

### license-ok
本專案為 MIT。檢查這次新增或打包進 `dist/` 的所有東西：
- npm 依賴的授權與 MIT 相容（不可是 GPL／AGPL 或授權不明）。
- **每個打包進去的 figlet 字型**：讀字型檔的標頭註解，確認允許重新散布；授權不明或禁止散布的字型不能打包，改選其他字型並告知使用者。
- 第三方授權聲明有保留（例如 `THIRD_PARTY_LICENSES` 或 README）。
沒有新增依賴或字型的任務，確認沒有變動即可通過。

### looks-like-writing
使用者在瀏覽器打開 demo 頁，用至少 3 種字型、包含 `S & @` 等曲線字元的句子觀看動畫，判斷「看起來像在寫字」或「不像，原因是…」。

### final-confirm
使用者對照 `.norn/ideas/ascii-scribe.md` 的成功定義逐條判定「符合」或「不符合，原因是…」。部署相關的條件要在實際的 GitHub Pages 網址上看過（桌機與手機寬度）。
