# 资源说明

v0.3 没有使用下载的图片、音频、字体或第三方商业素材。

- 城墙、房屋、月亮、道路、炮塔、敌人和特效：项目内 Phaser Graphics 程序绘制，代码在 `src/scenes/BattleScene.ts`。
- 音效：项目内 Web Audio 振荡器合成，代码在 `src/audio.ts`。默认静音，用户点击后启用。
- 界面字体：操作系统本地字体栈，不请求远程字体。
- 界面图标：文本符号、CSS 及项目内自绘的 SVG 兵种线稿，代码在 `src/main.ts`；字体符号显示可能因系统略有差异。
- Phaser：MIT，实际依赖许可见安装包 `node_modules/phaser/LICENSE.md`。
- Phaser 使用的 eventemitter3：MIT。构建包根目录随附 PHASER-LICENSE.txt、EVENTEMITTER3-LICENSE.txt。

后续替换图片和声音时，在这里补充来源链接、作者、许可证、修改情况；AI 生成资源补充工具和实际提示词。不把计划生成的素材列为已经生成。
