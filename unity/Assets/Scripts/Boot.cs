using UnityEngine;

public class Boot : MonoBehaviour
{
    [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
    static void Start0()
    {
        var cam = new GameObject("Camera").AddComponent<Camera>();
        cam.transform.position = new Vector3(0, 2, -5);
        cam.transform.LookAt(Vector3.zero);
        cam.clearFlags = CameraClearFlags.SolidColor;
        cam.backgroundColor = new Color(0.1f, 0.08f, 0.15f);
        new GameObject("Light").AddComponent<Light>().type = LightType.Directional;
        var cube = GameObject.CreatePrimitive(PrimitiveType.Cube);
        cube.AddComponent<Boot>();
    }

    void Update() => transform.Rotate(30 * Time.deltaTime, 45 * Time.deltaTime, 0);

    void OnGUI()
    {
        GUI.skin.label.fontSize = Screen.height / 20;
        GUI.Label(new Rect(20, 20, Screen.width, Screen.height / 8f), "Cubeborn Unity: OK");
    }
}
