using System;
using System.IO;
using UnityEditor;
using UnityEditor.Build;
using UnityEditor.Build.Reporting;
using UnityEditor.SceneManagement;
using UnityEngine;

// Builds are driven from CI (GameCI). The game has no authored scenes:
// an empty scene is generated here and everything is spawned from code.
public static class BuildScript
{
    const string ScenePath = "Assets/Scenes/Main.unity";

    static string Arg(string name, string fallback = null)
    {
        var args = Environment.GetCommandLineArgs();
        for (int i = 0; i < args.Length - 1; i++)
            if (args[i] == name) return args[i + 1];
        return fallback;
    }

    static void Prepare()
    {
        Directory.CreateDirectory("Assets/Scenes");
        var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
        EditorSceneManager.SaveScene(scene, ScenePath);
        EditorBuildSettings.scenes = new[] { new EditorBuildSettingsScene(ScenePath, true) };

        PlayerSettings.companyName = "Cubeborn";
        PlayerSettings.productName = "Cubeborn";
        var version = Arg("-buildVersion", "1.0.0");
        if (version.StartsWith("v")) version = version.Substring(1);
        PlayerSettings.bundleVersion = version;
        PlayerSettings.defaultInterfaceOrientation = UIOrientation.AutoRotation;
        PlayerSettings.allowedAutorotateToLandscapeLeft = true;
        PlayerSettings.allowedAutorotateToLandscapeRight = true;
        PlayerSettings.allowedAutorotateToPortrait = false;
        PlayerSettings.allowedAutorotateToPortraitUpsideDown = false;
        PlayerSettings.colorSpace = ColorSpace.Gamma;
        PlayerSettings.runInBackground = false;
        PlayerSettings.SplashScreen.showUnityLogo = false;
        PlayerSettings.SetApplicationIdentifier(NamedBuildTarget.Android, "com.cubeborn.unity");
        PlayerSettings.SetApplicationIdentifier(NamedBuildTarget.iOS, "com.cubeborn.unity");

        var icon = AssetDatabase.LoadAssetAtPath<Texture2D>("Assets/Resources/Icon.png");
        if (icon != null) PlayerSettings.SetIcons(NamedBuildTarget.Unknown, new[] { icon }, IconKind.Any);
    }

    static string OutputPath(string fallback)
    {
        var p = Arg("-customBuildPath", fallback);
        var dir = Path.GetDirectoryName(p);
        if (!string.IsNullOrEmpty(dir)) Directory.CreateDirectory(dir);
        return p;
    }

    static void Run(BuildPlayerOptions o)
    {
        var report = BuildPipeline.BuildPlayer(o);
        Debug.Log($"Build result: {report.summary.result}, size {report.summary.totalSize}, errors {report.summary.totalErrors}");
        EditorApplication.Exit(report.summary.result == BuildResult.Succeeded ? 0 : 1);
    }

    public static void BuildAndroid()
    {
        Prepare();
        PlayerSettings.SetScriptingBackend(NamedBuildTarget.Android, ScriptingImplementation.IL2CPP);
        PlayerSettings.Android.targetArchitectures = AndroidArchitecture.ARM64 | AndroidArchitecture.ARMv7;
        PlayerSettings.Android.minSdkVersion = AndroidSdkVersions.AndroidApiLevel23;
        PlayerSettings.Android.bundleVersionCode = int.Parse(Arg("-androidVersionCode", "1"));
        EditorUserBuildSettings.buildAppBundle = false;

        var ks = Path.GetFullPath("Keystore/cubeborn.jks");
        if (File.Exists(ks))
        {
            PlayerSettings.Android.useCustomKeystore = true;
            PlayerSettings.Android.keystoreName = ks;
            PlayerSettings.Android.keystorePass = "cubeborn123";
            PlayerSettings.Android.keyaliasName = "cubeborn";
            PlayerSettings.Android.keyaliasPass = "cubeborn123";
        }

        var path = OutputPath("build/Android/Cubeborn.apk");
        if (!path.EndsWith(".apk")) path += ".apk";
        Run(new BuildPlayerOptions
        {
            scenes = new[] { ScenePath },
            locationPathName = path,
            target = BuildTarget.Android,
            options = BuildOptions.None,
        });
    }

    public static void BuildIOS()
    {
        Prepare();
        PlayerSettings.iOS.buildNumber = Arg("-androidVersionCode", "1");
        PlayerSettings.iOS.targetOSVersionString = "13.0";
        PlayerSettings.iOS.appleEnableAutomaticSigning = false;
        Run(new BuildPlayerOptions
        {
            scenes = new[] { ScenePath },
            locationPathName = OutputPath("build/iOS/iOS"),
            target = BuildTarget.iOS,
            options = BuildOptions.None,
        });
    }
}
