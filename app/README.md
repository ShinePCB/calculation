# PCB 计算器 App

此目录使用 Capacitor 将上级目录的 `dist/` 静态网站封装为 Android / iOS 原生应用。

## 更新原生工程中的网页

网站文件有修改后，先在项目根目录刷新资源版本，再同步到原生工程：

```powershell
cd ..
node scripts/stamp-version.mjs
cd app
npm run sync
```

`npm run sync` 会把 `../dist` 复制进 Android / iOS 工程，并更新原生依赖。

如修改了 `assets/` 中的图标或启动图，可重新生成原生资源：

```powershell
npx --yes @capacitor/assets@3.0.5 generate --ios --android --iconBackgroundColor "#0b1020" --iconBackgroundColorDark "#0b1020" --splashBackgroundColor "#ffffff" --splashBackgroundColorDark "#111111"
```

## Android

需要 Android Studio 2025.2.1 或更新版本、JDK 21 和 Android SDK 36。

```powershell
npm run open:android
```

也可直接构建调试 APK：

```powershell
npm run build:android:debug
```

生成位置：`android/app/build/outputs/apk/debug/app-debug.apk`。

正式发布前，请在 Android Studio 中配置自己的签名证书，再生成签名 AAB / APK。不要把证书或密码提交到版本库。

## iOS

iOS 最终构建需要 macOS、Xcode 26 或更新版本，以及 Apple 开发者签名：

```sh
npm run open:ios
```

在 Xcode 中选择开发团队、设置签名，然后运行或归档。

## 应用标识

- App ID：`com.shinepcb.calculator`
- 名称：`PCB 计算器`
- Web 资源：`../dist`

App ID 发布后不宜修改；若需要使用公司已有的 Bundle ID / Application ID，请在首次上架前统一修改 Capacitor 配置和两个原生工程。
