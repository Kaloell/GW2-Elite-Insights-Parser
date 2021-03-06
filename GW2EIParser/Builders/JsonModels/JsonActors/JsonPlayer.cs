﻿using System.Collections.Generic;
using System.Linq;
using GW2EIParser.EIData;
using GW2EIParser.Parser.ParsedData;
using static GW2EIParser.Builders.JsonModels.JsonBuffsUptime;
using static GW2EIParser.Builders.JsonModels.JsonPlayerBuffsGeneration;
using static GW2EIParser.Builders.JsonModels.JsonStatistics;

namespace GW2EIParser.Builders.JsonModels
{
    public class JsonPlayer : JsonActor
    {
        /// <summary>
        /// Account name of the player
        /// </summary>
        public string Account { get; }
        /// <summary>
        /// Group of the player
        /// </summary>
        public int Group { get; }
        /// <summary>
        /// Profession of the player
        /// </summary>
        public string Profession { get; }
        /// <summary>
        /// Weapons of the player \n
        /// 0-1 are the first land set, 1-2 are the second land set \n
        /// 3-4 are the first aquatic set, 5-6 are the second aquatic set \n
        /// When unknown, 'Unknown' value will appear \n
        /// If 2 handed weapon even indices will have "2Hand" as value
        /// </summary>
        public string[] Weapons { get; }
        /// <summary>
        /// Array of Total DPS stats \n
        /// Length == # of targets and the length of each sub array is equal to # of phases
        /// </summary>
        /// <seealso cref="JsonDPS"/>
        public JsonDPS[][] DpsTargets { get; }
        /// <summary>
        /// Array of int representing 1S damage points \n
        /// Length == # of targets and the length of each sub array is equal to # of phases
        /// </summary>
        /// <remarks>
        /// If the duration of the phase in seconds is non integer, the last point of this array will correspond to the last point  \n
        /// ex: duration === 15250ms, the array will have 17 elements [0, 1000,...,15000,15250]
        /// </remarks>
        public List<int>[][] TargetDamage1S { get; }
        /// <summary>
        /// Per Target Damage distribution array \n
        /// Length == # of targets and the length of each sub array is equal to # of phases
        /// </summary>
        /// <seealso cref="JsonDamageDist"/>
        public List<JsonDamageDist>[][] TargetDamageDist { get; }
        /// <summary>
        /// Stats against targets  \n
        /// Length == # of targets and the length of each sub array is equal to # of phases
        /// </summary>
        /// <seealso cref="JsonGameplayStats"/>
        public JsonGameplayStats[][] StatsTargets { get; }
        /// <summary>
        /// Support stats \n
        /// Length == # of phases
        /// </summary>
        /// <seealso cref="JsonPlayerSupport"/>
        public JsonPlayerSupport[] Support { get; }
        /// <summary>
        /// Damage modifiers against all
        /// </summary>
        /// <seealso cref="JsonDamageModifierData"/>
        public List<JsonDamageModifierData> DamageModifiers { get; }
        /// <summary>
        /// Damage modifiers against targets \n
        /// Length == # of targets
        /// </summary>
        /// <seealso cref="JsonDamageModifierData"/>
        public List<JsonDamageModifierData>[] DamageModifiersTarget { get; }
        /// <summary>
        /// List of buff status
        /// </summary>
        /// <seealso cref="JsonBuffsUptime"/>
        public List<JsonBuffsUptime> BuffUptimes { get; }
        /// <summary>
        /// List of buff status on self generation  \n
        /// Key is "'b' + id"
        /// </summary>
        /// <seealso cref="JsonBuffsUptime"/>
        public List<JsonPlayerBuffsGeneration> SelfBuffs { get; }
        /// <summary>
        /// List of buff status on group generation
        /// </summary>
        /// <seealso cref="JsonPlayerBuffsGeneration"/>
        public List<JsonPlayerBuffsGeneration> GroupBuffs { get; }
        /// <summary>
        /// List of buff status on off group generation
        /// </summary>
        /// <seealso cref="JsonPlayerBuffsGeneration"/>
        public List<JsonPlayerBuffsGeneration> OffGroupBuffs { get; }
        /// <summary>
        /// List of buff status on squad generation
        /// </summary>
        /// <seealso cref="JsonPlayerBuffsGeneration"/>
        public List<JsonPlayerBuffsGeneration> SquadBuffs { get; }
        /// <summary>
        /// List of buff status on active time
        /// </summary>
        /// <seealso cref="JsonBuffsUptime"/>
        public List<JsonBuffsUptime> BuffUptimesActive { get; }
        /// <summary>
        /// List of buff status on self generation on active time
        /// </summary>
        /// <seealso cref="JsonBuffsUptime"/>
        public List<JsonPlayerBuffsGeneration> SelfBuffsActive { get; }
        /// <summary>
        /// List of buff status on group generation on active time
        /// <seealso cref="JsonPlayerBuffsGeneration"/>
        public List<JsonPlayerBuffsGeneration> GroupBuffsActive { get; }
        /// <summary>
        /// List of buff status on off group generation on active time
        /// <seealso cref="JsonPlayerBuffsGeneration"/>
        public List<JsonPlayerBuffsGeneration> OffGroupBuffsActive { get; }
        /// <summary>
        /// List of buff status on squad generation on active time
        /// </summary>
        /// <seealso cref="JsonPlayerBuffsGeneration"/>
        public List<JsonPlayerBuffsGeneration> SquadBuffsActive { get; }
        /// <summary>
        /// List of death recaps \n
        /// Length == number of death
        /// </summary>
        /// <seealso cref="JsonDeathRecap"/>
        public List<JsonDeathRecap> DeathRecap { get; }
        /// <summary>
        /// List of used consumables
        /// </summary>
        /// <seealso cref="JsonConsumable"/>
        public List<JsonConsumable> Consumables { get; }
        /// <summary>
        /// List of time during which the player was active (not dead and not dc) \n
        /// Length == number of phases
        /// </summary>
        public List<long> ActiveTimes { get; }


        public JsonPlayer(Player player, ParsedLog log, Dictionary<string, JsonLog.SkillDesc> skillDesc, Dictionary<string, JsonLog.BuffDesc> buffDesc, Dictionary<string, JsonLog.DamageModDesc> damageModDesc, Dictionary<string, HashSet<long>> personalBuffs) : base(player, log, skillDesc, buffDesc)
        {
            List<PhaseData> phases = log.FightData.GetPhases(log);
            //
            Account = player.Account;
            Weapons = player.GetWeaponsArray(log).Select(w => w ?? "Unknown").ToArray();
            Group = player.Group;
            Profession = player.Prof;
            ActiveTimes = phases.Select(x => x.GetActorActiveDuration(player, log)).ToList();
            //
            Support = player.GetPlayerSupport(log).Select(x => new JsonPlayerSupport(x)).ToArray();
            TargetDamage1S = new List<int>[log.FightData.Logic.Targets.Count][];
            DpsTargets = new JsonDPS[log.FightData.Logic.Targets.Count][];
            StatsTargets = new JsonGameplayStats[log.FightData.Logic.Targets.Count][];
            TargetDamageDist = new List<JsonDamageDist>[log.FightData.Logic.Targets.Count][];
            for (int j = 0; j < log.FightData.Logic.Targets.Count; j++)
            {
                NPC target = log.FightData.Logic.Targets[j];
                var dpsGraphList = new List<int>[phases.Count];
                var targetDamageDistList = new List<JsonDamageDist>[phases.Count];
                for (int i = 0; i < phases.Count; i++)
                {
                    PhaseData phase = phases[i];
                    if (log.ParserSettings.RawTimelineArrays)
                    {
                        dpsGraphList[i] = player.Get1SDamageList(log, i, phase, target);
                    }
                    targetDamageDistList[i] = JsonDamageDist.BuildJsonDamageDistList(player.GetDamageLogs(target, log, phase).Where(x => !x.HasDowned).GroupBy(x => x.SkillId).ToDictionary(x => x.Key, x => x.ToList()), log, skillDesc, buffDesc);
                }
                if (log.ParserSettings.RawTimelineArrays)
                {
                    TargetDamage1S[j] = dpsGraphList;
                }
                TargetDamageDist[j] = targetDamageDistList;
                DpsTargets[j] = player.GetDPSTarget(log, target).Select(x => new JsonDPS(x)).ToArray();
                StatsTargets[j] = player.GetGameplayStats(log, target).Select(x => new JsonGameplayStats(x)).ToArray();
            }
            //
            BuffUptimes = GetPlayerJsonBuffsUptime(player, player.GetBuffs(log, BuffEnum.Self), player.GetBuffsDictionary(log), log, buffDesc, personalBuffs);
            SelfBuffs = GetPlayerBuffGenerations(player.GetBuffs(log, BuffEnum.Self), log, buffDesc);
            GroupBuffs = GetPlayerBuffGenerations(player.GetBuffs(log, BuffEnum.Group), log, buffDesc);
            OffGroupBuffs = GetPlayerBuffGenerations(player.GetBuffs(log, BuffEnum.OffGroup), log, buffDesc);
            SquadBuffs = GetPlayerBuffGenerations(player.GetBuffs(log, BuffEnum.Squad), log, buffDesc);
            //
            BuffUptimesActive = GetPlayerJsonBuffsUptime(player, player.GetActiveBuffs(log, BuffEnum.Self), player.GetBuffsDictionary(log), log, buffDesc, personalBuffs);
            SelfBuffsActive = GetPlayerBuffGenerations(player.GetActiveBuffs(log, BuffEnum.Self), log, buffDesc);
            GroupBuffsActive = GetPlayerBuffGenerations(player.GetActiveBuffs(log, BuffEnum.Group), log, buffDesc);
            OffGroupBuffsActive = GetPlayerBuffGenerations(player.GetActiveBuffs(log, BuffEnum.OffGroup), log, buffDesc);
            SquadBuffsActive = GetPlayerBuffGenerations(player.GetActiveBuffs(log, BuffEnum.Squad), log, buffDesc);
            //
            List<Consumable> consumables = player.GetConsumablesList(log, 0, log.FightData.FightEnd);
            if (consumables.Any())
            {
                Consumables = new List<JsonConsumable>();
                foreach (Consumable food in consumables)
                {
                    if (!buffDesc.ContainsKey("b" + food.Buff.ID))
                    {
                        buffDesc["b" + food.Buff.ID] = new JsonLog.BuffDesc(food.Buff);
                    }
                    Consumables.Add(new JsonConsumable(food));
                }
            }
            //
            List<DeathRecap> deathRecaps = player.GetDeathRecaps(log);
            if (deathRecaps.Any())
            {
                DeathRecap = deathRecaps.Select(x => new JsonDeathRecap(x)).ToList();
            }
            // 
            DamageModifiers = JsonDamageModifierData.GetDamageModifiers(player.GetDamageModifierStats(log, null), log, damageModDesc);
            DamageModifiersTarget = JsonDamageModifierData.GetDamageModifiersTarget(player, log, damageModDesc);
        }

        private static List<JsonPlayerBuffsGeneration> GetPlayerBuffGenerations(List<Dictionary<long, FinalPlayerBuffs>> buffs, ParsedLog log, Dictionary<string, JsonLog.BuffDesc> buffDesc)
        {
            List<PhaseData> phases = log.FightData.GetPhases(log);
            var uptimes = new List<JsonPlayerBuffsGeneration>();
            foreach (KeyValuePair<long, FinalPlayerBuffs> pair in buffs[0])
            {
                Buff buff = log.Buffs.BuffsByIds[pair.Key];
                if (!buffDesc.ContainsKey("b" + pair.Key))
                {
                    buffDesc["b" + pair.Key] = new JsonLog.BuffDesc(buff);
                }
                var data = new List<JsonBuffsGenerationData>();
                for (int i = 0; i < phases.Count; i++)
                {
                    data.Add(new JsonBuffsGenerationData(buffs[i][pair.Key]));
                }
                var jsonBuffs = new JsonPlayerBuffsGeneration()
                {
                    BuffData = data,
                    Id = pair.Key
                };
                uptimes.Add(jsonBuffs);
            }

            if (!uptimes.Any())
            {
                return null;
            }

            return uptimes;
        }

        private static List<JsonBuffsUptime> GetPlayerJsonBuffsUptime(Player player, List<Dictionary<long, FinalPlayerBuffs>> buffs, List<Dictionary<long, FinalBuffsDictionary>> buffsDictionary, ParsedLog log, Dictionary<string, JsonLog.BuffDesc> buffDesc, Dictionary<string, HashSet<long>> personalBuffs)
        {
            var res = new List<JsonBuffsUptime>();
            var profEnums = new HashSet<GeneralHelper.Source>(GeneralHelper.ProfToEnum(player.Prof));
            List<PhaseData> phases = log.FightData.GetPhases(log);
            foreach (KeyValuePair<long, FinalPlayerBuffs> pair in buffs[0])
            {
                Buff buff = log.Buffs.BuffsByIds[pair.Key];
                var data = new List<JsonBuffsUptimeData>();
                for (int i = 0; i < phases.Count; i++)
                {
                    var value = new JsonBuffsUptimeData(buffs[i][pair.Key], buffsDictionary[i][pair.Key]);
                    data.Add(value);
                }
                if (buff.Nature == Buff.BuffNature.GraphOnlyBuff && profEnums.Contains(buff.Source))
                {
                    if (player.GetBuffDistribution(log, 0).GetUptime(pair.Key) > 0)
                    {
                        if (personalBuffs.TryGetValue(player.Prof, out HashSet<long> list) && !list.Contains(pair.Key))
                        {
                            list.Add(pair.Key);
                        }
                        else
                        {
                            personalBuffs[player.Prof] = new HashSet<long>()
                                {
                                    pair.Key
                                };
                        }
                    }
                }
                res.Add(new JsonBuffsUptime(player, pair.Key, log, data, buffDesc));
            }
            return res;
        }

    }
}
