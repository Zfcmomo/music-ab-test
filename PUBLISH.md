# 三步发出去（GitHub Pages）

这个目录已经是一个**提交好的 git 仓库**（main 分支、一次提交），只差推到 GitHub。
音频 24 段、19.5 MB，推一次大约几十秒。

## 1. 建仓库（30 秒，必须你点）

打开 https://github.com/new

- Repository name: `music-ab-test`
- 可见性：**Public**（Pages 免费版要求公开仓库）
- **不要**勾 "Add a README file"（否则会有冲突）
- 点 `Create repository`

## 2. 推上去（一条命令）

在本目录打开 PowerShell（地址栏输入 `powershell` 回车，或右键「在终端中打开」），执行：

```powershell
cd D:\AI_music\AI-generating-music\reports\pages
git remote add origin https://github.com/Zfcmomo/music-ab-test.git
git push -u origin main
```

第一次推会弹一个 GitHub 登录窗口（Git Credential Manager），点 `Sign in with your browser` → 授权一次即可，
之后这台机器会记住。

> 如果卡住不动超过 1 分钟，多半是网络：开一下代理再重跑上面那条 `git push`（git 会读 `HTTPS_PROXY`），
> 或者直接改用 `reports/share/ab_v2_class.zip` 发群里。

## 3. 打开 Pages（两次点击）

https://github.com/Zfcmomo/music-ab-test/settings/pages

- Source: `Deploy from a branch`
- Branch: `main` / `/ (root)`
- `Save`

等 30–60 秒刷新，地址就是：

**https://zfcmomo.github.io/music-ab-test/**

手机和电脑都能直接点开。

## 之后想换题目/换版本

```powershell
python scripts/make_pair_test.py --out reports/ab_v2_class --limit 6 --compare "..." --compare "..."
# 然后把新内容覆盖到 reports/pages/ 再 commit + push
```

页面顶部会显示「构建 xxxxxxxx」，每次重建编号都会变，同学那边不会串到旧答案。
