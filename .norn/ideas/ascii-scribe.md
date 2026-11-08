# ascii-scribe — ASCII 筆順打字效果

**一句話**：用 figlet ASCII 大字逐筆「寫」出句子 → 停頓 → 倒序擦掉 → 下一句，循環。做成獨立 Web Component，給 yPin9.github.io 以 jsDelivr 釘版本引用。
**為誰**：yPin9.github.io（λ66，Hugo + charaka 主題，GitHub Pages，CTF/pwn/LLVM 部落格）的訪客。
**解決的問題**：首頁一進來就有記憶點、符合 CTF／終端機調性。現有工具只有整塊替換/淡入或一般文字打字，沒有 ASCII 大字逐筆畫。
**原本的想法 → 提升後的目標**：網頁 ASCII 動畫 → 從 figlet 輸出**自動推算筆順**，任意英數符號 × 任意線條型字型皆可逐筆畫出，零手寫筆順資料。
**成功的定義**：
1. 程式隨機產生的英數符號字串，在 ≥5 種線條型 figlet 字型下都能逐筆畫出；程式中沒有任何寫死的字母筆順。
2. 最終畫面與 `figlet.textSync()` 輸出逐字相同（不少字、不多字、不錯位）。
3. 同一筆內，下一個出現的字元與上一個相鄰（8 鄰域）的比例 ≥ 90%。
4. 刪除時照原順序倒著擦；多句循環；速度、停頓可設定。
5. `prefers-reduced-motion` 直接顯示完整文字；螢幕閱讀器讀到原文；手機寬度（360px）不溢出。
6. 使用者親眼確認「看起來像在寫字」。
7. 在 yPin9.github.io 以 jsDelivr 釘版本引用，正式 Hugo 建置 + GitHub Pages 部署後正常運作。
**證據與條件**：自動測試（最終畫面逐字比對、相鄰比例）使用程式隨機產生、事先沒看過的字串；正式 Hugo 建置 + GitHub Pages 上桌機與手機寬度實測。
**可能的捷徑**：只對展示句寫死筆順；用掃描順序（上→下、左→右）冒充筆順；挑字型或字串讓測試通過；測試用固定字串。
**範圍**：要做——筆順推算、打字/刪除循環、Web Component、單檔打包（含 figlet 與選定字型）、網站整合。不做——中文、方塊型字型（█）、錦鯉池背景、npm 發布。
**現有方案**：採用 [figlet.js](https://github.com/patorjk/figlet.js)（MIT，3.0k 星，v1.12.0 2026-09）。不用 [Typed.js](https://github.com/mattboldt/typed.js)（GPL-3.0，商用需付費；循環邏輯簡單自寫）。參考過 react-ascii-text、tte.js、ascii-pond（都沒有逐筆畫）。我們的差異：自動推算筆順。
**主要風險**：S、&、@ 等曲線字元筆順不自然；長句手機溢出；網站的 jQuery／charaka 樣式干擾元件；figlet 在瀏覽器單檔打包（npm 套件有 importable-fonts，可行性高但未在瀏覽器實測）。
**需要親自確認的步驟**：選字型、筆順觀感、要打的句子、部署後效果；建立 GitHub repo 與 push。
**建議的下一步**：/norn:setup
