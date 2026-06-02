# soft-candy-match

## 游戏名称

《软糖消消乐》

## 游戏玩法

这是一款手机端 7 x 7 Match-3 消消乐小游戏。玩家交换相邻软糖，横向或纵向 3 个及以上相同软糖连成一线即可消除。消除后上方软糖下落，顶部自动补充新软糖，并支持连续消除 Combo。

关卡目标：

- 初始步数：25 步
- 目标分数：3000 分
- 消除 3 个软糖得 100 分
- 4 个及以上额外加分
- 达到目标分数胜利，步数用完且未达成目标则失败

## 操作方式

- 手机：按住棋子向上下左右滑动，交换相邻软糖
- 手机：也可以点击两个相邻棋子交换
- 电脑：鼠标点击两个相邻棋子交换，方便调试

## 如何运行

本项目是纯静态网页，不依赖后端、数据库或外部图片素材。

本地预览：

1. 使用 VS Code 安装 Live Server 插件
2. 右键 `index.html`
3. 选择 `Open with Live Server`

GitHub Pages 部署：

1. 在 GitHub 创建仓库，仓库名建议为 `soft-candy-match`
2. 上传本项目所有文件
3. 进入仓库 `Settings` -> `Pages`
4. 在 `Build and deployment` 中选择 `GitHub Actions`
5. 推送到 `main` 分支后，GitHub Actions 会自动发布
6. 发布完成后访问：

```text
https://你的用户名.github.io/soft-candy-match/
```

## 文件结构

```text
soft-candy-match/
├── index.html
├── style.css
├── game.js
├── README.md
└── .github/
    └── workflows/
        └── deploy.yml
```

## 后续可扩展方向

- 增加四消、五消特殊棋子
- 增加 Web Audio API 音效
- 增加本地最高分记录
- 增加更多关卡目标
- 增加障碍物、冰块、果酱等玩法
- 增加 PWA 图标和离线缓存，让手机可以添加到桌面
