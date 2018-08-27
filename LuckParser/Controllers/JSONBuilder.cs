﻿using System;
using System.Collections;
using System.Collections.Generic;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Windows.Forms;
using LuckParser.Models.DataModels;
using LuckParser.Models.ParseModels;
using Newtonsoft.Json;

namespace LuckParser.Controllers
{
    class JSONBuilder
    {
        readonly SettingsContainer _settings;

        readonly ParsedLog _log;

        readonly Statistics _statistics;
        readonly StreamWriter _sw;

        public static void UpdateStatisticSwitches(StatisticsCalculator.Switches switches)
        {
            switches.CalculateBoons = true;
            switches.CalculateDPS = true;
            switches.CalculateConditions = true;
            switches.CalculateDefense = true;
            switches.CalculateStats = true;
            switches.CalculateSupport = true;
            switches.CalculateCombatReplay = true;
            switches.CalculateMechanics = true;
        }

        public JSONBuilder(StreamWriter sw, ParsedLog log, SettingsContainer settings, Statistics statistics)
        {
            _log = log;
            _sw = sw;
            _settings = settings;

            _statistics = statistics;
        }

        /*
         * Structs to get serialized into json
         */
        private struct JsonLog
        {
            public struct JsonDps
            {
                public int[] AllDps;
                public int[] AllDamage;
                public int[] AllCondiDps;
                public int[] AllCondiDamage;
                public int[] AllPowerDps;
                public int[] AllPowerDamage;
                // Boss
                public int[] BossDps;
                public int[] BossDamage;
                public int[] BossCondiDps;
                public int[] BossCondiDamage;
                public int[] BossPowerDps;
                public int[] BossPowerDamage;
                // Player only
                public int[] PlayerPowerDamage;
                public int[] PlayerBossPowerDamage;
            }

            public struct JsonBoss
            {
                public string Name;
                public ushort Id;
                public int TotalHealth;
                public double FinalHealth;
                public double HealthPercentBurned;
                public List<Point> HealthOverTime;
                public JsonDps Dps;
            }

            public struct JsonPlayer
            {
                public string Character;
                public string Account;
                public int Condition;
                public int Concentration;
                public int Healing;
                public int Toughness;
                public int Group;
                public string Profession;
                public string[] Weapons;
                public JsonDps Dps;
                public Statistics.FinalStats[] Stats;
                public Statistics.FinalDefenses[] Defenses;
                public Statistics.FinalSupport[] Support;
                public Dictionary<long, Statistics.FinalBoonUptime>[] SelfBoons;
                public Dictionary<long, Statistics.FinalBoonUptime>[] GroupBoons;
                public Dictionary<long, Statistics.FinalBoonUptime>[] OffGroupBoons;
                public Dictionary<long, Statistics.FinalBoonUptime>[] SquadBoons;
            }

            public struct JsonPhase
            {
                public long Duration;
                public string Name;
            }

            public string EliteInsightsVersion;
            public string ArcVersion;
            public string RecordedBy;
            public string TimeStart;
            public string TimeEnd;
            public string Duration;
            public bool Success;
            public JsonBoss Boss;
            public ArrayList Players;
            public ArrayList Phases;
            public List<Point3D> StackCenterPositions;
        }

        private JsonLog.JsonDps BuildDPS(Statistics.FinalDPS[] statDps)
        {
            int phases = _statistics.Phases.Count;
            JsonLog.JsonDps dps = new JsonLog.JsonDps
            {
                AllCondiDamage = new int[phases],
                AllCondiDps = new int[phases],
                AllDamage = new int[phases],
                AllDps = new int[phases],
                AllPowerDamage = new int[phases],
                AllPowerDps = new int[phases],
                BossCondiDamage = new int[phases],
                BossCondiDps = new int[phases],
                BossDamage = new int[phases],
                BossDps = new int[phases],
                BossPowerDamage = new int[phases],
                BossPowerDps = new int[phases],
                PlayerBossPowerDamage = new int[phases],
                PlayerPowerDamage = new int[phases]
            };

            for (int phaseIndex = 0; phaseIndex < phases; phaseIndex++)
            {
                dps.AllDps[phaseIndex] = statDps[phaseIndex].AllDps;
                dps.AllDamage[phaseIndex] = statDps[phaseIndex].AllDamage;
                dps.AllPowerDps[phaseIndex] = statDps[phaseIndex].AllPowerDps;
                dps.AllCondiDamage[phaseIndex] = statDps[phaseIndex].AllCondiDamage;
                dps.AllCondiDps[phaseIndex] = statDps[phaseIndex].AllCondiDps;
                dps.AllPowerDamage[phaseIndex] = statDps[phaseIndex].AllPowerDamage;
                dps.BossCondiDamage[phaseIndex] = statDps[phaseIndex].BossCondiDamage;
                dps.BossPowerDamage[phaseIndex] = statDps[phaseIndex].BossPowerDamage;
                dps.BossCondiDps[phaseIndex] = statDps[phaseIndex].BossCondiDps;
                dps.BossPowerDps[phaseIndex] = statDps[phaseIndex].BossPowerDps;
                dps.BossDamage[phaseIndex] = statDps[phaseIndex].BossDamage;
                dps.BossDps[phaseIndex] = statDps[phaseIndex].BossDps;
                dps.PlayerPowerDamage[phaseIndex] = statDps[phaseIndex].PlayerPowerDamage;
                dps.PlayerBossPowerDamage[phaseIndex] = statDps[phaseIndex].PlayerBossPowerDamage;
            }

            return dps;
        }

        /*
         * Creating the JSON
         */
        public void CreateJSON()
        {
            var log = new JsonLog();

            double fightDuration = _log.GetBossData().GetAwareDuration() / 1000.0;
            var duration = TimeSpan.FromSeconds(fightDuration);
            string durationString = duration.ToString("mm") + "m " + duration.ToString("ss") + "s";
            if (duration.ToString("hh") != "00")
            {
                durationString = duration.ToString("hh") + "h " + durationString;
            }

            log.EliteInsightsVersion = Application.ProductVersion;
            log.ArcVersion = _log.GetLogData().GetBuildVersion();
            log.RecordedBy = _log.GetLogData().GetPOV().Split(':')[0].TrimEnd('\u0000');
            log.TimeStart = _log.GetLogData().GetLogStart();
            log.TimeEnd = _log.GetLogData().GetLogEnd();
            log.Duration = durationString;
            log.Success = _log.GetLogData().GetBosskill();
            log.StackCenterPositions = _statistics.StackCenterPositions;

            log = SetBoss(log);
            log = SetPlayers(log);
            log = SetPhases(log);

            var serializer = new JsonSerializer();
            serializer.NullValueHandling = NullValueHandling.Ignore;
            var writer = new JsonTextWriter(_sw);
            writer.Formatting = Formatting.Indented;
            serializer.Serialize(writer, log);
        }


        private JsonLog SetBoss(JsonLog log)
        {
            log.Boss.Id = _log.GetBossData().GetID();
            log.Boss.Name = _log.GetBossData().GetName();
            log.Boss.TotalHealth = _log.GetBossData().GetHealth();
            int finalBossHealth = _log.GetBossData().GetHealthOverTime().Count > 0
                ? _log.GetBossData().GetHealthOverTime().Last().Y
                : 10000;
            log.Boss.FinalHealth = _log.GetBossData().GetHealth() * (100.0 - finalBossHealth * 0.01);
            log.Boss.HealthPercentBurned = 100.0 - finalBossHealth * 0.01;

            log.Boss.Dps = BuildDPS(_statistics.BossDps);
            log.Boss.HealthOverTime = _log.GetBossData().GetHealthOverTime();

            return log;
        }

        private JsonLog SetPlayers(JsonLog log)
        {
            log.Players = new ArrayList();

            foreach (var player in _log.GetPlayerList())
            {
                var currentPlayer = new JsonLog.JsonPlayer
                {
                    Character = player.GetCharacter(),
                    Account = player.GetAccount(),
                    Condition = player.GetCondition(),
                    Concentration = player.GetConcentration(),
                    Healing = player.GetHealing(),
                    Toughness = player.GetToughness(),
                    Weapons = player.GetWeaponsArray(_log),
                    Group = player.GetGroup(),
                    Profession = player.GetProf(),
                    Dps = BuildDPS(_statistics.Dps[player]),
                    Stats = new Statistics.FinalStats[_statistics.Phases.Count],
                    Defenses = new Statistics.FinalDefenses[_statistics.Phases.Count],
                    Support = new Statistics.FinalSupport[_statistics.Phases.Count],
                    SelfBoons = new Dictionary<long, Statistics.FinalBoonUptime>[_statistics.Phases.Count],
                    GroupBoons = new Dictionary<long, Statistics.FinalBoonUptime>[_statistics.Phases.Count],
                    OffGroupBoons = new Dictionary<long, Statistics.FinalBoonUptime>[_statistics.Phases.Count],
                    SquadBoons = new Dictionary<long, Statistics.FinalBoonUptime>[_statistics.Phases.Count]
                };

                for (int phaseIndex = 0; phaseIndex < _statistics.Phases.Count; phaseIndex++)
                {
                    currentPlayer.Stats[phaseIndex] = _statistics.Stats[player][phaseIndex];
                    currentPlayer.Defenses[phaseIndex] = _statistics.Defenses[player][phaseIndex];
                    currentPlayer.Support[phaseIndex] = _statistics.Support[player][phaseIndex];
                    currentPlayer.SelfBoons[phaseIndex] = _statistics.SelfBoons[player][phaseIndex];
                    currentPlayer.GroupBoons[phaseIndex] = _statistics.GroupBoons[player][phaseIndex];
                    currentPlayer.OffGroupBoons[phaseIndex] = _statistics.OffGroupBoons[player][phaseIndex];
                    currentPlayer.SquadBoons[phaseIndex] = _statistics.SquadBoons[player][phaseIndex];
                }

                log.Players.Add(currentPlayer);
            }

            return log;
        }

        private JsonLog SetPhases(JsonLog log)
        {
            log.Phases = new ArrayList();

            foreach (var phase in _statistics.Phases)
            {
                log.Phases.Add(new JsonLog.JsonPhase
                {
                    Duration = phase.GetDuration(),
                    Name = phase.GetName()
                });
            }

            return log;
        }
    }
}