# data-dashboard in WSL

Project path:

`/home/maya/projects/data-dashboard`

## Open in VS Code

Open a WSL terminal and run:

```bash
cd /home/maya/projects/data-dashboard
code .
```

Or in VS Code:

1. Use `WSL: Connect to WSL`.
2. Open folder `/home/maya/projects/data-dashboard`.

## Run locally

This project now runs as a Node website with server-side authentication and database-backed workbook storage.

From the project directory:

```bash
npm install
npm start
```

Then open:

`http://127.0.0.1:4173/index.html`

## Useful checks

You can re-run syntax checks with:

```bash
node --check server.js
node --check dashboard.js
node --check template-core.js
```

## Current Workbook Structure

- 首页当前保留 3 个入口：
  - `煤炭售价统计表`
  - `产量与工业总产值统计表`
  - `煤炭销售统计表`
- 旧的 `book=3` 链接已兼容跳转到 `book=2`。
- `产量与工业总产值统计表`
  - 只保留一个工作簿入口，包含 `产量表`、`工业总产值表` 两张月度表。
  - 两张月度表都支持 `年份 + 月份` 筛选。
  - 年份按本地存储分桶，适合后续跨年、跨月长期录入。
  - 月份切换会在表格内部定位到对应月份列。
- `煤炭售价统计表`
  - 已恢复 `一、混煤（元/吨）`、`二、电煤（元/吨）`、`三、市场煤` 三行。
- `煤炭销售统计表`
  - 表格主体使用内部滚动，表头固定。
  - `原因分析` 改成工具栏按钮，点击后从右侧独立面板打开。

## Notes

- 用户账号、角色权限和模板录入数据将统一走服务端数据库存储。
- 浏览器不再作为主数据源；旧版 `localStorage` 数据需要先导出，再由主账号在系统后台导入。
- 月度表的旧数据在首次迁移到“按年份存储”后，会默认归到当前年份。
- 如果刚改完 `CSS/JS` 后浏览器表现和预期不一致，先执行一次 `Ctrl+F5` 强制刷新，避免缓存旧资源。
- The old Windows copy remains at `C:\Users\admin01\Desktop\data-dashboard` as a backup source.

## One-click start in VS Code

Open the `Run and Debug` view and select `Open data-dashboard`, then click the green play button.
This should start the local Node server and open `http://127.0.0.1:4173/index.html` automatically.

Use `Terminal: Run Task` only when you want:
- `Serve data-dashboard`
- `Check template.js`
