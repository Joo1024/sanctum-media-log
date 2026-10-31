# Sanctum Media Log

计划公开的个人书影音、游戏与文化体验记录。网站只有一页：**筛选栏 + 记录表格**，支持名称／短评／标签／时期搜索、类型／状态／年份或时期组合筛选，以及点击列头排序。窄屏自动把放不下的字段放到每条记录下方。短评直接显示，多个作品来源和博客长评以链接打开。

使用现成的 [Tabulator](https://www.tabulator.info/docs/6.x/) 表格组件，本地固定 **6.7.1**，附 MIT 许可。没有导航、介绍区、年度子页面、后台或数据库；不依赖 CDN、在线 API 或外部字体。

当前为项目框架，提交与推送按本人指令执行；网站部署另行安排，尚未配置自动部署。**未导入已有 JSON、Excel 备份，主数据仍全部为明确标注的虚构示例。**

## 运行与构建

需要 Node.js **22+**，无需安装 npm 依赖。

```sh
npm run dev       # http://127.0.0.1:4321，修改后刷新
npm run validate  # 校验主数据
npm test          # 数据、筛选和构建检查
npm run build     # 生成 dist/
npm run preview   # 预览 dist/
```

不用 npm 也可以：

```sh
node scripts/serve.mjs
node scripts/validate.mjs
node --test
node scripts/build.mjs
node scripts/serve.mjs --preview
```

终端没有配置 Node 的 PATH 时，可用现有 Node 的绝对路径替换 `node`。默认端口 4321，开发与构建预览分别启动；指定其他端口用 `node scripts/serve.mjs --port 4322`。需要通过 HTTP 预览，不直接双击 HTML。

## 目录

```text
data/records.json     唯一日常维护数据：一个 JSON 数组
src/app.mjs           表格列、筛选控件和链接展示
src/lib.mjs           类型／状态枚举、数据校验和筛选规则
src/index.html       单页入口
src/styles.css       少量样式
src/vendor/tabulator/ 本地固定的第三方组件及许可证
scripts/             校验、构建、本地预览
test/                自动检查
dist/                生成结果，不手改、不提交
```

## 主数据

每条记录对应一次阅读、观看、游玩或参观。**不拆作品库与个人记录**；重读重看可新增 ID 并重复作品资料。筛选结果与年份选项全部由这份数组生成，不维护第二份数据。

| 字段 | 规则 |
| --- | --- |
| `id` | 唯一且稳定，小写字母／数字／`-`／`_`，以字母或数字开头；改标题不改 ID |
| `title` | 非空作品或活动名称 |
| `type` | `book`、`movie`、`tv`、`music`、`game`、`museum`、`exhibition`、`performance` |
| `status` | `planned`、`in_progress`、`completed`、`paused`、`abandoned` |
| `date` | 完成／参观日期或时期：`"2026"`、`"2026-10"`、`"2026-10-31"`、`"中学时代"`、`"2026年暑假"`；未知用 `null`，也接受空字符串 |
| `rating` | 个人评分 `0`–`5`，可有小数；未评分为 `null`，`0` 作为实际评分 |
| `comment` | 短评纯文本，可为空字符串 |
| `tags` | 无重复的非空字符串数组，没有标签用 `[]` |
| `url` | 外部作品／活动来源的链接数组，如 `["https://example.com/a", "https://example.org/b"]`；没有链接用 `[]`；每项必须是非空的完整 HTTP(S) 链接 |
| `review_url` | 博客长评的完整 HTTP(S) 链接或空字符串 |

日期保留原精度，不补造日期；备份创建时间、加入清单时间、作品发行时间不当作完成时间。进行中等尚未完成的记录可保留 `null`。`review_url` 仍是单个长评链接，不改为数组。

日期与筛选规则：

- 标准日期按日历校验；以 `YYYY` 或 `YYYY-` 开头的日期不能填成 `2026-02-30`、`2026-13` 等无效日期。
- 自定义时期是非空文本，原样显示，不推断具体年份。`中学时代`、`大学期间`、`2026年暑假` 均进入“自定义时期”筛选分组，可直接搜索具体文字。
- 年份选项只从有效的 `YYYY`、`YYYY-MM`、`YYYY-MM-DD` 提取；`null` 和空字符串进入“日期未记”。
- 默认先显示标准日期，按时间倒序；自定义时期按稳定 ID 排在其后，未知日期最后，不猜测不同人生阶段的先后。

作者、地点、平台、进度等按实际需要扩展，校验允许额外字段；新增类型或状态时修改 `src/lib.mjs` 的枚举即可。

## 新增记录

当前的 8 条数据全部是虚构示例，均有 `demo: true`；页面计数和浏览器标题明确标注。示例链接指向 `example.com`。校验不允许示例与正式记录混用。

首次接入正式记录时，先把 `data/records.json` 替换为 `[]`，然后往同一数组新增对象，例如下面的**填写模板**：

```json
{
  "id": "book-2026-001",
  "title": "替换为真实作品名称",
  "type": "book",
  "status": "planned",
  "date": null,
  "rating": null,
  "comment": "",
  "tags": [],
  "url": [],
  "review_url": ""
}
```

正式记录无需 `demo` 字段；不要通过删除示例标识把虚构经历当作真实记录。新增后运行校验、刷新预览。空数组也是正常状态，不会自动回填示例。

## 备份与部署边界

原始 JSON、Excel 和附件私有保存在**仓库之外**，不复制进网站，不作为另一份日常维护数据。`.gitignore` 忽略 `imports/`、`backups/`、`private/`、Excel 和压缩包，作为防误放保护。

构建只复制 `src/` 与校验后的主数据到 `dist/`。以后可以将 `dist/` 发布到 GitHub Pages，资源使用相对路径，兼容项目子路径。主数据中的内容会随网站公开；本次没有配置部署流程。
