using System;
using System.Collections.Generic;
using UnityEngine;

namespace Cubeborn.Sound
{
    /// <summary>
    /// All sound is synthesised at runtime (no audio files), like the web build's WebAudio engine:
    /// SFX are short recipes of oscillators, filtered noise and exponential envelopes; music is a
    /// step sequencer with per-map scales, tempo and timbre. Rendered in OnAudioFilterRead.
    /// </summary>
    public class Synth : MonoBehaviour
    {
        public enum Wave { Sine, Square, Saw, Triangle }
        public enum Filter { Lowpass, Highpass, Bandpass }

        class Voice
        {
            public bool noise;
            public Wave wave;
            public Filter filter;
            public bool music;
            public double offset; // seconds from "now" (main thread) or absolute sample (music)
            public long start, attackEnd, end, stop;
            public double f0, f1, dur, vol, attack, q;
            // runtime
            public double phase, freq, freqMul, g, gMulA, gMulD;
            public double fx1, fx2, fy1, fy2, b0, b1, b2, a1, a2;
            public int coefCountdown;
            public bool started;
        }

        class Song
        {
            public double bpm;
            public int root;
            public int[] scale, prog, arp, bassPat;
            public Wave lead, pad;
            public int drums;
            public double swing, bright;
        }

        static readonly int[] MINOR = { 0, 2, 3, 5, 7, 8, 10 }, DORIAN = { 0, 2, 3, 5, 7, 9, 10 }, PHRYG = { 0, 1, 3, 5, 7, 8, 10 };
        static readonly int[] HARM = { 0, 2, 3, 5, 7, 8, 11 }, MAJOR = { 0, 2, 4, 5, 7, 9, 11 }, LYD = { 0, 2, 4, 6, 7, 9, 11 };

        static Song S(double bpm, int root, int[] scale, int[] prog, Wave lead, Wave pad, int drums, double swing, int[] arp, int[] bass, double bright) =>
            new Song { bpm = bpm, root = root, scale = scale, prog = prog, lead = lead, pad = pad, drums = drums, swing = swing, arp = arp, bassPat = bass, bright = bright };

        static readonly Dictionary<string, Song> Songs = new Dictionary<string, Song>
        {
            { "menu", S(84, 50, DORIAN, new[] { 0, 5, 3, 4 }, Wave.Triangle, Wave.Sine, 0, 0, new[] { 0, -1, 1, -1, 2, -1, 1, -1, 0, -1, 2, -1, 3, -1, 2, -1 }, new[] { 0, -1, -1, -1, -1, -1, -1, -1, 0, -1, -1, -1, -1, -1, -1, -1 }, 1800) },
            { "forest", S(112, 45, DORIAN, new[] { 0, 6, 5, 4 }, Wave.Square, Wave.Triangle, 1, 0.08, new[] { 0, 1, 2, 1, 3, 2, 1, 2, 0, 1, 2, 3, 4, 3, 2, 1 }, new[] { 0, -1, 0, -1, -1, -1, 0, -1, 0, -1, -1, 0, -1, -1, 0, -1 }, 2400) },
            { "city", S(118, 47, HARM, new[] { 0, 5, 3, 4 }, Wave.Saw, Wave.Triangle, 2, 0.12, new[] { 0, -1, 2, 1, -1, 2, 3, -1, 0, -1, 2, 1, 4, -1, 3, 2 }, new[] { 0, -1, 0, 0, -1, -1, 0, -1, 0, -1, 0, 0, -1, 0, -1, -1 }, 2000) },
            { "catacombs", S(100, 43, PHRYG, new[] { 0, 1, 0, 6 }, Wave.Triangle, Wave.Saw, 1, 0, new[] { 0, -1, -1, 2, -1, -1, 1, -1, 0, -1, -1, 3, -1, 2, -1, -1 }, new[] { 0, -1, -1, -1, 0, -1, -1, -1, 0, -1, -1, -1, 0, -1, 0, -1 }, 1400) },
            { "volcano", S(132, 40, PHRYG, new[] { 0, 1, 6, 4 }, Wave.Saw, Wave.Square, 2, 0, new[] { 0, 0, 2, 0, 3, 0, 2, 4, 0, 0, 2, 0, 5, 4, 3, 2 }, new[] { 0, 0, -1, 0, 0, -1, 0, -1, 0, 0, -1, 0, 0, 0, -1, 0 }, 2600) },
            { "tundra", S(104, 50, MINOR, new[] { 0, 5, 2, 6 }, Wave.Sine, Wave.Triangle, 1, 0.05, new[] { 0, 2, 4, 2, 5, 4, 2, 4, 0, 2, 4, 6, 5, 4, 2, 1 }, new[] { 0, -1, -1, -1, 0, -1, -1, 0, 0, -1, -1, -1, 0, -1, -1, -1 }, 3000) },
            { "ruins", S(124, 46, LYD, new[] { 0, 1, 5, 4 }, Wave.Square, Wave.Sine, 2, 0.06, new[] { 0, 2, 4, 6, 4, 2, 5, 3, 0, 2, 4, 6, 7, 6, 4, 2 }, new[] { 0, -1, 0, -1, 0, -1, 0, 0, 0, -1, 0, -1, 0, 0, -1, 0 }, 3200) },
            { "boss", S(140, 41, HARM, new[] { 0, 0, 5, 4 }, Wave.Saw, Wave.Saw, 2, 0, new[] { 0, 2, 0, 3, 0, 4, 0, 3, 0, 2, 0, 6, 5, 4, 3, 2 }, new[] { 0, 0, 0, -1, 0, 0, 0, -1, 0, 0, 0, 0, 0, -1, 0, 0 }, 2800) },
            { "victory", S(96, 52, MAJOR, new[] { 0, 3, 4, 0 }, Wave.Triangle, Wave.Sine, 0, 0, new[] { 0, 1, 2, 4, 2, 1, 0, -1, 0, 2, 4, 6, 4, 2, 0, -1 }, new[] { 0, -1, -1, -1, -1, -1, -1, -1, 0, -1, -1, -1, -1, -1, -1, -1 }, 2400) },
        };

        static readonly Dictionary<string, double> MinGap = new Dictionary<string, double>
        {
            { "hurt", 0.12 }, { "coin", 0.05 }, { "levelup", 0.3 }, { "explosion", 0.07 }, { "bossRoar", 1 }, { "slash", 0.06 },
            { "zap", 0.05 }, { "hit", 0.03 }, { "kill", 0.03 }, { "xp", 0.035 },
        };

        public static Synth I;

        int sampleRate = 48000;
        long clock;
        readonly List<Voice> voices = new List<Voice>();
        readonly List<Voice> pending = new List<Voice>();
        readonly List<Voice> building = new List<Voice>();
        readonly object gate = new object();
        readonly System.Random arng = new System.Random(7);

        // main-thread state
        readonly Dictionary<string, double> last = new Dictionary<string, double>();
        readonly List<double> active = new List<double>();
        volatile float sfxVol = 0.8f, musicVol = 0.6f, intensity;
        volatile Song song;
        volatile bool songChanged;
        string songId = "";
        bool paused;

        // audio-thread state
        long nextStep;
        int step;
        double mfCur = 2000, mfTarget = 2000, mfTau = 0.5;
        double mx1, mx2, my1, my2;
        double compEnv;
        Song playing;

        public static Synth Create()
        {
            var go = new GameObject("Synth");
            DontDestroyOnLoad(go);
            var src = go.AddComponent<AudioSource>();
            int sr = AudioSettings.outputSampleRate;
            src.clip = AudioClip.Create("silence", sr, 2, sr, false);
            src.loop = true;
            src.playOnAwake = false;
            src.spatialBlend = 0;
            src.volume = 1;
            I = go.AddComponent<Synth>();
            I.sampleRate = sr;
            src.Play();
            return I;
        }

        void Awake()
        {
            sampleRate = AudioSettings.outputSampleRate;
        }

        public void SetVolumes(double sfx, double music)
        {
            sfxVol = (float)sfx;
            musicVol = (float)music;
        }

        public void Suspend(bool on)
        {
            paused = on;
            AudioListener.pause = on;
        }

        // ------------------------------------------------------------ recipe primitives (main thread)

        void Tone(double t, Wave type, double f0, double f1, double dur, double vol, double attack = 0.005, bool music = false)
        {
            building.Add(new Voice { noise = false, wave = type, f0 = f0, f1 = f1, dur = dur, vol = vol, attack = attack, offset = t, music = music });
        }

        void Noise(double t, double dur, double vol, Filter type, double f0, double f1, double q = 1, bool music = false)
        {
            building.Add(new Voice { noise = true, filter = type, f0 = f0, f1 = f1, dur = dur, vol = vol, attack = 0.004, q = q, offset = t, music = music });
        }

        public void Play(string id, double volume = 1)
        {
            if (sfxVol <= 0 || paused) return;
            double now = Time.unscaledTimeAsDouble;
            double gap = MinGap.TryGetValue(id, out var g) ? g : 0.045;
            if (last.TryGetValue(id, out var l) && now - l < gap) return;
            for (int i = active.Count - 1; i >= 0; i--) if (now - active[i] > 0.25) active.RemoveAt(i);
            if (active.Count > 28) return;
            building.Clear();
            if (!Recipe(id, Math.Min(1.2, volume))) return;
            last[id] = now;
            active.Add(now);
            lock (gate) pending.AddRange(building);
            building.Clear();
        }

        static double Rnd => UnityEngine.Random.value;

        bool Recipe(string id, double v)
        {
            const double t = 0;
            switch (id)
            {
                case "slash": Noise(t, 0.12, 0.25 * v, Filter.Bandpass, 3200, 900, 1.4); break;
                case "punch": Tone(t, Wave.Sine, 180, 60, 0.1, 0.4 * v); Noise(t, 0.06, 0.2 * v, Filter.Lowpass, 2000, 400); break;
                case "thrust": Noise(t, 0.16, 0.25 * v, Filter.Bandpass, 1400, 4000, 2); break;
                case "throw": Noise(t, 0.08, 0.15 * v, Filter.Highpass, 3000, 5000, 1); break;
                case "magic": Tone(t, Wave.Triangle, 660, 1320, 0.15, 0.12 * v); Tone(t + 0.03, Wave.Sine, 990, 1980, 0.12, 0.08 * v); break;
                case "fire": Noise(t, 0.25, 0.22 * v, Filter.Lowpass, 1500, 300, 1); Tone(t, Wave.Saw, 160, 80, 0.15, 0.06 * v); break;
                case "ice": Tone(t, Wave.Sine, 1800, 2600, 0.12, 0.1 * v); Noise(t, 0.1, 0.1 * v, Filter.Highpass, 5000, 8000, 3); break;
                case "bow": Tone(t, Wave.Triangle, 300, 120, 0.1, 0.18 * v); Noise(t, 0.06, 0.1 * v, Filter.Highpass, 2500, 5000); break;
                case "whoosh": Noise(t, 0.22, 0.18 * v, Filter.Bandpass, 600, 2400, 1.5); break;
                case "saw": Tone(t, Wave.Saw, 900, 700, 0.1, 0.06 * v); break;
                case "zap": Tone(t, Wave.Square, 1200, 200, 0.1, 0.08 * v); Noise(t, 0.08, 0.12 * v, Filter.Highpass, 4000, 2000); break;
                case "beam": Tone(t, Wave.Saw, 440, 880, 0.25, 0.08 * v, 0.02); break;
                case "pulse": Tone(t, Wave.Sine, 220, 90, 0.3, 0.25 * v); break;
                case "wind": Noise(t, 0.4, 0.15 * v, Filter.Bandpass, 400, 1200, 3); break;
                case "glass": Tone(t, Wave.Triangle, 2200, 1800, 0.18, 0.08 * v); Noise(t, 0.12, 0.12 * v, Filter.Highpass, 6000, 3000, 2); break;
                case "explosion": Noise(t, 0.5, 0.45 * v, Filter.Lowpass, 2400, 120, 0.7); Tone(t, Wave.Sine, 140, 30, 0.45, 0.45 * v); break;
                case "mine": Tone(t, Wave.Square, 880, 880, 0.05, 0.06 * v); break;
                case "bones": Noise(t, 0.05, 0.15 * v, Filter.Bandpass, 2000, 1500, 4); Noise(t + 0.05, 0.05, 0.12 * v, Filter.Bandpass, 1600, 1200, 4); break;
                case "crate": Noise(t, 0.15, 0.3 * v, Filter.Bandpass, 900, 300, 2); Tone(t, Wave.Square, 120, 60, 0.1, 0.1 * v); break;
                case "shield": Tone(t, Wave.Triangle, 800, 400, 0.25, 0.15 * v); break;
                case "hurt": Tone(t, Wave.Square, 220, 90, 0.16, 0.18 * v); Noise(t, 0.1, 0.15 * v, Filter.Lowpass, 1600, 400); break;
                case "revive": Seq(new double[] { 523, 659, 784, 1046 }, 0.08, Wave.Triangle, 0.35, 0.16 * v); break;
                case "heal":
                    Tone(t, Wave.Sine, 523, 523 * 1.01, 0.25, 0.13 * v);
                    Tone(t + 0.07, Wave.Sine, 784, 784 * 1.01, 0.25, 0.13 * v);
                    break;
                case "coin": Tone(t, Wave.Square, 1318, 1318, 0.05, 0.05 * v); Tone(t + 0.05, Wave.Square, 1760, 1760, 0.12, 0.05 * v); break;
                case "xp": Tone(t, Wave.Sine, 1400 + Rnd * 600, 2200, 0.05, 0.05 * v); break;
                case "magnet": Tone(t, Wave.Sine, 300, 1600, 0.5, 0.15 * v, 0.05); break;
                case "powerup": Seq(new double[] { 440, 554, 659, 880 }, 0.05, Wave.Square, 0.12, 0.06 * v); break;
                case "chestDrop": Tone(t, Wave.Sine, 90, 50, 0.3, 0.4 * v); Noise(t, 0.2, 0.2 * v, Filter.Lowpass, 900, 200); break;
                case "chestOpen": Seq(new double[] { 523, 659, 784, 1046, 1318, 1568 }, 0.07, Wave.Triangle, 0.4, 0.12 * v); break;
                case "levelup": Seq(new double[] { 392, 523, 659, 784 }, 0.06, Wave.Square, 0.2, 0.07 * v); break;
                case "death":
                    {
                        double[] f = { 392, 330, 262, 196 };
                        for (int i = 0; i < f.Length; i++) Tone(t + i * 0.18, Wave.Triangle, f[i], f[i] * 0.97, 0.4, 0.18 * v);
                        break;
                    }
                case "victory": Seq(new double[] { 523, 659, 784, 659, 784, 1046 }, 0.12, Wave.Square, 0.3, 0.08 * v); break;
                case "bossRoar": Tone(t, Wave.Saw, 90, 50, 1.0, 0.3 * v, 0.1); Noise(t, 1.0, 0.25 * v, Filter.Lowpass, 600, 150, 2); break;
                case "bossPhase": Tone(t, Wave.Saw, 70, 140, 0.6, 0.25 * v, 0.05); Noise(t, 0.6, 0.2 * v, Filter.Bandpass, 300, 1200, 2); break;
                case "bossShoot": Tone(t, Wave.Square, 330, 160, 0.12, 0.07 * v); break;
                case "bossCharge": Tone(t, Wave.Saw, 80, 400, 0.6, 0.15 * v, 0.1); break;
                case "summon": Tone(t, Wave.Triangle, 200, 600, 0.4, 0.12 * v, 0.05); Noise(t, 0.4, 0.1 * v, Filter.Bandpass, 500, 2000, 4); break;
                case "teleport": Tone(t, Wave.Sine, 1600, 200, 0.3, 0.12 * v); break;
                case "dash": Noise(t, 0.3, 0.25 * v, Filter.Bandpass, 300, 1500, 1); break;
                case "slam": Tone(t, Wave.Sine, 100, 30, 0.5, 0.5 * v); Noise(t, 0.35, 0.3 * v, Filter.Lowpass, 1200, 100); break;
                case "bossDeath":
                    Noise(t, 1.4, 0.5 * v, Filter.Lowpass, 3000, 60, 0.7);
                    Tone(t, Wave.Sine, 160, 25, 1.4, 0.5 * v);
                    {
                        double[] f = { 523, 659, 784 };
                        for (int i = 0; i < f.Length; i++) Tone(t + 0.6 + i * 0.1, Wave.Triangle, f[i], f[i], 0.5, 0.1 * v);
                    }
                    break;
                case "hit": Noise(t, 0.04, 0.1 * v, Filter.Bandpass, 1800, 900, 2); break;
                case "kill": Tone(t, Wave.Square, 300 + Rnd * 120, 80, 0.06, 0.05 * v); break;
                case "ui": Tone(t, Wave.Square, 880, 880, 0.04, 0.05 * v); break;
                case "uiBack": Tone(t, Wave.Square, 520, 440, 0.06, 0.05 * v); break;
                case "select": Tone(t, Wave.Square, 660, 660, 0.05, 0.05 * v); Tone(t + 0.05, Wave.Square, 990, 990, 0.08, 0.05 * v); break;
                case "evolution": Seq(new double[] { 262, 330, 392, 523, 659, 784, 1046 }, 0.06, Wave.Saw, 0.3, 0.05 * v); break;
                case "buy": Seq(new double[] { 784, 1046, 1318 }, 0.05, Wave.Square, 0.1, 0.05 * v); break;
                case "denied": Tone(t, Wave.Square, 160, 140, 0.15, 0.08 * v); break;
                case "warn": Tone(t, Wave.Square, 880, 880, 0.12, 0.06 * v); Tone(t + 0.18, Wave.Square, 880, 880, 0.12, 0.06 * v); break;
                default: return false;
            }
            return true;
        }

        void Seq(double[] f, double step, Wave w, double dur, double vol)
        {
            for (int i = 0; i < f.Length; i++) Tone(i * step, w, f[i], f[i], dur, vol);
        }

        // ------------------------------------------------------------ music (main thread API)

        public void PlayMusic(string id)
        {
            if (songId == id) return;
            songId = id;
            song = Songs.TryGetValue(id, out var s) ? s : null;
            songChanged = true;
        }

        public void SetIntensity(double v) => intensity = (float)v;

        public void StopMusic()
        {
            songId = "";
            song = null;
            songChanged = true;
        }

        // ------------------------------------------------------------ audio thread

        static double Mtof(double m) => 440 * Math.Pow(2, (m - 69) / 12);

        int Note(Song s, int deg, int oct)
        {
            int n = s.scale.Length;
            int o = (int)Math.Floor(deg / (double)n);
            int d = ((deg % n) + n) % n;
            return s.root + s.scale[d] + 12 * (o + oct);
        }

        void MTone(long at, Wave type, double f0, double f1, double dur, double vol, double attack)
        {
            var v = new Voice { noise = false, wave = type, f0 = f0, f1 = f1, dur = dur, vol = vol, attack = attack, music = true };
            Begin(v, at);
            voices.Add(v);
        }

        void MNoise(long at, double dur, double vol, Filter type, double f0, double f1, double q)
        {
            var v = new Voice { noise = true, filter = type, f0 = f0, f1 = f1, dur = dur, vol = vol, attack = 0.004, q = q, music = true };
            Begin(v, at);
            voices.Add(v);
        }

        void MusicStep(Song s, long t, int st, int bar, double sd)
        {
            int chord = s.prog[bar];
            if (st == 0)
                foreach (int k in new[] { 0, 2, 4 })
                {
                    double f = Mtof(Note(s, chord + k, 1));
                    MTone(t, s.pad, f, f, sd * 16, 0.05, 0.4);
                }
            if (s.bassPat[st] >= 0)
            {
                double f = Mtof(Note(s, chord, 0));
                MTone(t, Wave.Triangle, f, f * 0.98, sd * 1.8, 0.22, 0.005);
            }
            int a = s.arp[st];
            if (a >= 0 && (step >> 6) % 4 != 3)
            {
                double f = Mtof(Note(s, chord + a, 2));
                MTone(t, s.lead, f, f, sd * 1.4, s.lead == Wave.Saw || s.lead == Wave.Square ? 0.035 : 0.06, 0.004);
            }
            int dr = s.drums + (intensity > 0.6f ? 1 : 0);
            if (dr > 0)
            {
                if (st % 8 == 0 || (dr > 1 && st % 8 == 6 && arng.NextDouble() < 0.5)) MTone(t, Wave.Sine, 120, 40, 0.18, 0.4, 0.002);
                if (st % 8 == 4) MNoise(t, 0.12, 0.16, Filter.Bandpass, 1800, 900, 0.8);
                if (dr > 1 && st % 2 == 0) MNoise(t, 0.04, 0.05, Filter.Highpass, 7000, 6000, 1);
                if (dr > 2 && st % 2 == 1) MNoise(t, 0.03, 0.035, Filter.Highpass, 8000, 7000, 1);
            }
        }

        void Begin(Voice v, long at)
        {
            double sr = sampleRate;
            v.start = at;
            long n = Math.Max(1, (long)(v.dur * sr));
            long na = Math.Max(1, Math.Min(n - 1, (long)(v.attack * sr)));
            v.attackEnd = at + na;
            v.end = at + n;
            v.stop = v.end + (long)(0.02 * sr);
            v.g = 0.0001;
            double vol = Math.Max(0.0001, v.vol);
            v.gMulA = Math.Pow(vol / 0.0001, 1.0 / na);
            v.gMulD = Math.Pow(0.0001 / vol, 1.0 / Math.Max(1, n - na));
            v.freq = v.f0;
            double f1 = Math.Max(v.noise ? 30 : 20, v.f1);
            v.freqMul = v.f1 != v.f0 ? Math.Pow(f1 / v.f0, 1.0 / n) : 1;
            v.phase = arng.NextDouble();
            v.started = false;
        }

        static void Coefs(Voice v, double sr)
        {
            double f = Math.Min(v.freq, sr * 0.45);
            double w0 = 2 * Math.PI * f / sr;
            double cs = Math.Cos(w0), sn = Math.Sin(w0);
            double q = v.filter == Filter.Bandpass ? Math.Max(0.0001, v.q) : Math.Pow(10, v.q / 20);
            double alpha = sn / (2 * q);
            double a0 = 1 + alpha;
            double b0, b1, b2;
            switch (v.filter)
            {
                case Filter.Lowpass: b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = (1 - cs) / 2; break;
                case Filter.Highpass: b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = (1 + cs) / 2; break;
                default: b0 = alpha; b1 = 0; b2 = -alpha; break;
            }
            v.b0 = b0 / a0; v.b1 = b1 / a0; v.b2 = b2 / a0;
            v.a1 = -2 * cs / a0; v.a2 = (1 - alpha) / a0;
        }

        static double PolyBlep(double t, double dt)
        {
            if (t < dt) { t /= dt; return t + t - t * t - 1; }
            if (t > 1 - dt) { t = (t - 1) / dt; return t * t + t + t + 1; }
            return 0;
        }

        uint noiseState = 22222;

        double White()
        {
            noiseState ^= noiseState << 13;
            noiseState ^= noiseState >> 17;
            noiseState ^= noiseState << 5;
            return noiseState / 2147483648.0 - 1;
        }

        float[] sfxBuf = new float[4096], musBuf = new float[4096];

        void OnAudioFilterRead(float[] data, int channels)
        {
            int frames = data.Length / channels;
            if (sfxBuf.Length < frames) { sfxBuf = new float[frames]; musBuf = new float[frames]; }
            Array.Clear(sfxBuf, 0, frames);
            Array.Clear(musBuf, 0, frames);
            double sr = sampleRate;
            long latency = (long)(0.02 * sr);
            lock (gate)
            {
                foreach (var v in pending)
                {
                    Begin(v, clock + latency + (long)(v.offset * sr));
                    voices.Add(v);
                }
                pending.Clear();
            }
            // music sequencer
            var s = song;
            if (songChanged)
            {
                songChanged = false;
                playing = s;
                step = 0;
                nextStep = clock + (long)(0.1 * sr);
                mfTarget = s?.bright ?? 2000;
                mfTau = 0.5;
            }
            if (playing != null && musicVol > 0)
            {
                double stepDur = 60 / playing.bpm / 4;
                long blockEnd = clock + frames + (long)(0.05 * sr);
                while (nextStep < blockEnd)
                {
                    int st = step % 16;
                    int bar = (step / 16) % playing.prog.Length;
                    long t = nextStep + (st % 2 == 1 ? (long)(playing.swing * stepDur * sr) : 0);
                    MusicStep(playing, t, st, bar, stepDur);
                    nextStep += (long)(stepDur * sr);
                    step++;
                }
                double target = playing.bright * (0.8 + intensity * 0.5);
                if (Math.Abs(target - mfTarget) > 1) { mfTarget = target; mfTau = 1; }
            }
            else if (playing != null) nextStep = Math.Max(nextStep, clock + frames);

            // voices
            for (int vi = voices.Count - 1; vi >= 0; vi--)
            {
                var v = voices[vi];
                if (v.stop <= clock) { voices.RemoveAt(vi); continue; }
                if (v.start >= clock + frames) continue;
                var buf = v.music ? musBuf : sfxBuf;
                int i0 = (int)Math.Max(0, v.start - clock);
                int i1 = (int)Math.Min(frames, v.stop - clock);
                double phase = v.phase, freq = v.freq, g = v.g;
                for (int i = i0; i < i1; i++)
                {
                    long t = clock + i;
                    double x;
                    if (v.noise)
                    {
                        if (v.coefCountdown-- <= 0) { Coefs(v, sr); v.coefCountdown = 16; }
                        double w = White();
                        double y = v.b0 * w + v.b1 * v.fx1 + v.b2 * v.fx2 - v.a1 * v.fy1 - v.a2 * v.fy2;
                        v.fx2 = v.fx1; v.fx1 = w; v.fy2 = v.fy1; v.fy1 = y;
                        x = y;
                    }
                    else
                    {
                        double dt = freq / sr;
                        switch (v.wave)
                        {
                            case Wave.Sine: x = Math.Sin(phase * 2 * Math.PI); break;
                            case Wave.Square:
                                x = (phase < 0.5 ? 1 : -1) + PolyBlep(phase, dt) - PolyBlep((phase + 0.5) % 1, dt);
                                break;
                            case Wave.Saw: x = 2 * phase - 1 - PolyBlep(phase, dt); break;
                            default: x = phase < 0.5 ? 4 * phase - 1 : 3 - 4 * phase; break;
                        }
                        phase += dt;
                        if (phase >= 1) phase -= 1;
                    }
                    if (t < v.end) freq *= v.freqMul;
                    if (v.noise) v.freq = freq;
                    buf[i] += (float)(x * g);
                    if (t < v.attackEnd) g *= v.gMulA;
                    else if (t < v.end) g *= v.gMulD;
                    else g = 0;
                }
                v.phase = phase;
                v.freq = freq;
                v.g = g;
            }

            // music lowpass (setTargetAtTime smoothing) + mix + compressor
            double k = 1 - Math.Exp(-(frames / sr) / mfTau);
            mfCur += (mfTarget - mfCur) * k;
            double f = Math.Min(mfCur, sr * 0.45);
            double w0 = 2 * Math.PI * f / sr, cs = Math.Cos(w0), sn = Math.Sin(w0);
            double alpha = sn / (2 * Math.Pow(10, 1 / 20.0));
            double a0 = 1 + alpha;
            double mb0 = (1 - cs) / 2 / a0, mb1 = (1 - cs) / a0, mb2 = (1 - cs) / 2 / a0, ma1 = -2 * cs / a0, ma2 = (1 - alpha) / a0;
            float sg = sfxVol * 0.9f, mg = musicVol * 0.32f;
            double thr = Math.Pow(10, -14 / 20.0);
            double att = 1 - Math.Exp(-1 / (0.003 * sr)), rel = 1 - Math.Exp(-1 / (0.25 * sr));
            for (int i = 0; i < frames; i++)
            {
                double m = musBuf[i];
                double y = mb0 * m + mb1 * mx1 + mb2 * mx2 - ma1 * my1 - ma2 * my2;
                mx2 = mx1; mx1 = m; my2 = my1; my1 = y;
                double x = sfxBuf[i] * sg + y * mg;
                double lvl = Math.Abs(x);
                compEnv += (lvl - compEnv) * (lvl > compEnv ? att : rel);
                double gain = 1;
                if (compEnv > thr)
                {
                    double over = 20 * Math.Log10(compEnv / thr);
                    gain = Math.Pow(10, -(over - over / 6) / 20);
                }
                float o = (float)(x * gain * 1.1);
                if (o > 1) o = 1; else if (o < -1) o = -1;
                for (int c = 0; c < channels; c++) data[i * channels + c] = o;
            }
            clock += frames;
        }
    }
}
