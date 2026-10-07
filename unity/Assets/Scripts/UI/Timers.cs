using System;
using System.Collections.Generic;
using UnityEngine;

namespace Cubeborn.UI
{
    /// <summary>setTimeout-style callbacks on unscaled time, ticked by the app loop.</summary>
    public static class Timers
    {
        struct Item
        {
            public double t;
            public Action fn;
        }

        static readonly List<Item> items = new List<Item>();
        static readonly List<Item> due = new List<Item>();

        public static void After(double seconds, Action fn) => items.Add(new Item { t = Time.unscaledTimeAsDouble + seconds, fn = fn });

        public static void Tick()
        {
            double now = Time.unscaledTimeAsDouble;
            due.Clear();
            for (int i = items.Count - 1; i >= 0; i--)
                if (items[i].t <= now)
                {
                    due.Add(items[i]);
                    items.RemoveAt(i);
                }
            for (int i = due.Count - 1; i >= 0; i--)
            {
                try { due[i].fn(); }
                catch (Exception e) { Debug.LogException(e); }
            }
        }
    }
}
