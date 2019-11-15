﻿using System.Collections.Generic;
using GW2EIParser.EIData;

namespace GW2EIParser.Builders.HtmlModels
{
    public class BuffData
    {
        public double Avg { get; set; }
        public List<List<object>> Data { get; set; } = new List<List<object>>();

        public BuffData(Dictionary<long, GeneralStatistics.FinalBuffs> boons, List<Buff> listToUse, double avg)
        {
            Avg = avg;
            foreach (Buff boon in listToUse)
            {
                var boonVals = new List<object>();
                Data.Add(boonVals);

                if (boons.TryGetValue(boon.ID, out GeneralStatistics.FinalBuffs uptime))
                {
                    boonVals.Add(uptime.Uptime);
                    if (boon.Type == Buff.BuffType.Intensity && uptime.Presence > 0)
                    {
                        boonVals.Add(uptime.Presence);
                    }
                }
            }
        }

        public BuffData(Dictionary<long, FinalNPCBuffs> boons, List<Buff> listToUse, double avg)
        {
            Avg = avg;
            foreach (Buff boon in listToUse)
            {
                var boonVals = new List<object>();
                Data.Add(boonVals);

                if (boons.TryGetValue(boon.ID, out FinalNPCBuffs uptime))
                {
                    boonVals.Add(uptime.Uptime);
                    if (boon.Type == Buff.BuffType.Intensity && uptime.Presence > 0)
                    {
                        boonVals.Add(uptime.Presence);
                    }
                }
            }
        }

        public BuffData(Dictionary<long, FinalBuffsDictionary> boons, List<Buff> listToUse, Player player)
        {
            foreach (Buff boon in listToUse)
            {
                var boonData = new List<object>();
                if (boons.TryGetValue(boon.ID, out FinalBuffsDictionary toUse))
                {
                    if (toUse.Generated.ContainsKey(player))
                    {
                        boonData.Add(toUse.Generated[player]);
                        boonData.Add(toUse.Overstacked[player]);
                        boonData.Add(toUse.Wasted[player]);
                        boonData.Add(toUse.UnknownExtension[player]);
                        boonData.Add(toUse.Extension[player]);
                        boonData.Add(toUse.Extended[player]);
                    } else
                    {
                        boonData.Add(0);
                        boonData.Add(0);
                        boonData.Add(0);
                        boonData.Add(0);
                        boonData.Add(0);
                        boonData.Add(0);
                    }
                }
                Data.Add(boonData);
            }
        }

        public BuffData(List<Buff> listToUse, Dictionary<long, GeneralStatistics.FinalBuffs> uptimes)
        {
            foreach (Buff boon in listToUse)
            {
                if (uptimes.TryGetValue(boon.ID, out GeneralStatistics.FinalBuffs uptime))
                {
                    Data.Add(new List<object>()
                        {
                            uptime.Generation,
                            uptime.Overstack,
                            uptime.Wasted,
                            uptime.UnknownExtended,
                            uptime.ByExtension,
                            uptime.Extended
                        });
                }
                else
                {
                    Data.Add(new List<object>()
                        {
                            0,
                            0,
                            0,
                            0,
                            0,
                            0
                        });
                }
            }
        }

        public BuffData(string prof, Dictionary<string, List<Buff>> boonsBySpec, Dictionary<long, GeneralStatistics.FinalBuffs> boons)
        {
            foreach (Buff boon in boonsBySpec[prof])
            {
                var boonVals = new List<object>();
                Data.Add(boonVals);
                if (boons.TryGetValue(boon.ID, out GeneralStatistics.FinalBuffs uptime))
                {
                    boonVals.Add(uptime.Uptime);
                    if (boon.Type == Buff.BuffType.Intensity && uptime.Presence > 0)
                    {
                        boonVals.Add(uptime.Presence);
                    }
                }
                else
                {
                    boonVals.Add(0);
                }
            }
        }
    }
}
