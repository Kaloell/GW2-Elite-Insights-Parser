﻿using System;
using System.Collections.Generic;
using System.Linq;
using LuckParser.Exceptions;
using LuckParser.Models;
using LuckParser.Models.Logic;
using LuckParser.Models.ParseModels;

namespace LuckParser.Parser
{
    public class ParsedLog
    {
        private readonly List<Mob> _auxMobs = new List<Mob>();

        public LogData LogData { get; }
        public FightData FightData { get; }
        public AgentData AgentData { get; }
        public SkillData SkillData { get; }
        public CombatData CombatData { get; }
        public List<Player> PlayerList { get; }
        public HashSet<AgentItem> PlayerAgents { get; }
        public bool IsBenchmarkMode => FightData.Logic.Mode == FightLogic.ParseMode.Golem;
        public Dictionary<string, List<Player>> PlayerListBySpec { get; }
        public DamageModifiersContainer DamageModifiers { get; }
        public BoonsContainer Boons { get; }
        public bool CanCombatReplay => CombatData.HasMovementData && FightData.Logic.HasCombatReplayMap;

        public readonly MechanicData MechanicData;
        public readonly Target LegacyTarget;
        public readonly Statistics Statistics;

        public ParsedLog(string buildVersion, FightData fightData, AgentData agentData, SkillData skillData, 
                List<CombatItem> combatItems, List<Player> playerList, Target target)
        {
            FightData = fightData;
            AgentData = agentData;
            SkillData = skillData;
            PlayerList = playerList;
            //
            PlayerListBySpec = playerList.GroupBy(x => x.Prof).ToDictionary(x => x.Key, x => x.ToList());
            PlayerAgents = new HashSet<AgentItem>(playerList.Select(x => x.AgentItem));
            CombatData = new CombatData(combatItems, fightData, agentData, playerList);
            LogData = new LogData(buildVersion, CombatData, combatItems);
            //
            UpdateFightData();
            //
            Boons = new BoonsContainer(LogData.GW2Version);
            DamageModifiers = new DamageModifiersContainer(LogData.GW2Version);
            MechanicData = FightData.Logic.GetMechanicData();
            Statistics = new Statistics(CombatData, AgentData, FightData, PlayerList, Boons);
            LegacyTarget = target;
        }

        private void UpdateFightData()
        {
            FightData.Logic.CheckSuccess(CombatData, AgentData, FightData, PlayerAgents);
            if (FightData.FightDuration <= 2200)
            {
                throw new TooShortException();
            }
            if (Properties.Settings.Default.SkipFailedTries && !FightData.Success)
            {
                throw new SkipException();
            }
            CombatData.UpdateDamageEvents(FightData.FightDuration);
            FightData.SetCM(CombatData, AgentData, FightData);
        }

        public AbstractActor FindActor(long logTime, ushort instid)
        {
            AbstractActor res = PlayerList.FirstOrDefault(x => x.InstID == instid);
            if (res == null)
            {
                foreach (Player p in PlayerList)
                {
                    Dictionary<string, Minions> minionsDict = p.GetMinions(this);
                    foreach (Minions minions in minionsDict.Values)
                    {
                        res = minions.FirstOrDefault(x => x.InstID == instid && x.FirstAwareLogTime <= logTime && x.LastAwareLogTime >= logTime);
                        if (res != null)
                        {
                            return res;
                        }
                    }
                }
                res = FightData.Logic.Targets.FirstOrDefault(x => x.InstID == instid && x.FirstAwareLogTime <= logTime && x.LastAwareLogTime >= logTime);
                if (res == null)
                {
                    res = _auxMobs.FirstOrDefault(x => x.InstID == instid && x.FirstAwareLogTime <= logTime && x.LastAwareLogTime >= logTime);
                    if (res == null)
                    {
                        _auxMobs.Add(new Mob(AgentData.GetAgentByInstID(instid, logTime)));
                        res = _auxMobs.Last();
                    }
                }
            }
            return res;
        }
    }
}
