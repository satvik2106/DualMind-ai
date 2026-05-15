"""
DualMind AI OS — Agent Registry
Central access point for all cognitive agents.
"""
from typing import Dict
from agents.base_agent import BaseAgent


_agents: Dict[str, BaseAgent] = {}


def get_agent(role: str) -> BaseAgent:
    """Get or create a named agent."""
    if role not in _agents:
        from agents.planner_researcher import PlannerAgent, ResearcherAgent
        from agents.synthesis_verification import (
            SynthesizerAgent, VerifierAgent, AnalystAgent, VisualizationAgent
        )
        agent_map = {
            "planner": PlannerAgent,
            "researcher": ResearcherAgent,
            "analyst": AnalystAgent,
            "synthesizer": SynthesizerAgent,
            "verifier": VerifierAgent,
            "visualizer": VisualizationAgent,
        }
        cls = agent_map.get(role)
        if cls is None:
            raise ValueError(f"Unknown agent role: {role}")
        _agents[role] = cls()
    return _agents[role]


def get_all_agents() -> Dict[str, BaseAgent]:
    """Instantiate and return all agents."""
    for role in ["planner", "researcher", "analyst", "synthesizer", "verifier", "visualizer"]:
        get_agent(role)
    return dict(_agents)
