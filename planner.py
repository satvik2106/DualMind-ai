"""
Planner LLM Module
Creates structured task pipelines for solving user queries using available tools.
"""

import json
import logging
import os
from typing import Dict, Any, List
from datetime import datetime

# Import JSON fixer for robust LLM response parsing
try:
    from json_fixer import parse_llm_json, validate_plan_json
except ImportError:
    parse_llm_json = None
    validate_plan_json = None

class Planner:
    """
    Planner LLM that acts as the Generator in the GAN-inspired architecture.
    Analyzes user queries and creates structured task pipelines using available tools.
    """

    def __init__(self, tools_file: str = "tools_description.json"):
        """
        Initialize the Planner.

        Args:
            tools_file (str): Path to tools description JSON file
        """
        self.tools_file = tools_file
        self.logger = logging.getLogger(__name__)
        self.tools = self._load_tools()
        self.llm_client = None
        
        # Try to import and initialize LLM client
        try:
            from llm_client import llm_client
            self.llm_client = llm_client
        except ImportError:
            self.logger.warning("LLM client not available, using fallback mode")
            
        # Fallback reasoning when LLM API is not available
        self.fallback_plans = {
            "research": self._create_research_plan,
            "summarize": self._create_summary_plan,
            "analyze": self._create_analysis_plan,
            "report": self._create_report_plan
        }

    def _load_tools(self) -> List[Dict[str, Any]]:
        """Load tools from the tools description file."""
        try:
            with open(self.tools_file, 'r') as f:
                data = json.load(f)
                return data.get('tools', [])
        except FileNotFoundError:
            self.logger.error(f"Tools file not found: {self.tools_file}")
            return []
        except json.JSONDecodeError:
            self.logger.error(f"Invalid JSON in tools file: {self.tools_file}")
            return []

    def _extract_keywords(self, query: str) -> str:
        """
        Extract keywords from a long query for tool input.
        
        Args:
            query (str): Full user query
            
        Returns:
            str: Extracted keywords or shortened query
        """
        # If query is short enough, return as-is
        if len(query) < 100:
            return query
        
        # Extract key topic words (simple keyword extraction)
        query_lower = query.lower()
        
        # Look for common patterns with word boundaries
        import re
        
        # Pattern: "Research [topic] applications in/for/on [domain]"
        match = re.search(r'research\s+(\w+(?:\s+\w+){0,3})\s+applications?\s+(?:in|for|on|of)\s+([^,\.]+)', query_lower)
        if match:
            topic = f"{match.group(1)} in {match.group(2)}"
            return topic.strip()[:100]
        
        # Pattern: "about [topic]"
        if " about " in query_lower:
            parts = query_lower.split(" about ", 1)
            if len(parts) > 1:
                topic = parts[1].split(",")[0].split(".")[0].strip()
                return topic[:100]
        
        # Pattern: "research on [topic]" - use word boundary
        match = re.search(r'research\s+on\s+([^,\.]+)', query_lower)
        if match:
            topic = match.group(1).strip()
            return topic[:100]
        
        # Look for topic after "research"
        if query_lower.startswith("research"):
            # Get words after "research" until comma or period
            match = re.search(r'research\s+(.+?)(?:[,\.]|$)', query_lower)
            if match:
                topic = match.group(1).strip()
                # Remove common filler words from the end
                topic = re.sub(r'\s+(?:including|with|that|which|for).*$', '', topic)
                return topic[:100]
        
        # Extract first meaningful sentence or phrase before comma
        first_part = query.split(",")[0].strip()
        if len(first_part) < 150:
            return first_part
        
        # Return first 100 characters as fallback
        return query[:100].strip()
    
    def _create_research_plan(self, query: str) -> Dict[str, Any]:
        """Create a research-focused task plan."""
        # Extract keywords for tool inputs
        keywords = self._extract_keywords(query)
        
        return {
            "query": query,
            "reasoning": "User wants to research a topic, so I'll gather information from multiple sources.",
            "pipeline": [
                {
                    "tool": "wikipedia_search",
                    "purpose": "Get foundational knowledge about the topic",
                    "input": keywords
                },
                {
                    "tool": "news_fetcher",
                    "purpose": "Find recent developments and news",
                    "input": keywords
                },
                {
                    "tool": "arxiv_summarizer",
                    "purpose": "Get academic research and papers",
                    "input": keywords
                }
            ],
            "final_output": "Comprehensive research summary with sources"
        }

    def _create_summary_plan(self, query: str) -> Dict[str, Any]:
        """Create a summarization task plan."""
        keywords = self._extract_keywords(query)
        
        return {
            "query": query,
            "reasoning": "User wants a summary, so I'll gather and condense information.",
            "pipeline": [
                {
                    "tool": "wikipedia_search",
                    "purpose": "Get main topic overview",
                    "input": keywords
                },
                {
                    "tool": "qa_engine",
                    "purpose": "Generate intelligent summary",
                    "input": f"Summarize: {keywords}"
                }
            ],
            "final_output": "Concise summary of the topic"
        }

    def _create_analysis_plan(self, query: str) -> Dict[str, Any]:
        """Create an analysis task plan."""
        keywords = self._extract_keywords(query)
        
        return {
            "query": query,
            "reasoning": "User wants analysis, so I'll gather data and provide insights.",
            "pipeline": [
                {
                    "tool": "news_fetcher",
                    "purpose": "Collect relevant data points",
                    "input": keywords
                },
                {
                    "tool": "sentiment_analyzer",
                    "purpose": "Analyze sentiment of collected information",
                    "input": keywords
                },
                {
                    "tool": "data_plotter",
                    "purpose": "Visualize analysis results",
                    "input": json.dumps({"Positive": 60, "Negative": 20, "Neutral": 20})
                }
            ],
            "final_output": "Analysis report with visualizations"
        }

    def _create_report_plan(self, query: str) -> Dict[str, Any]:
        """Create a report generation task plan."""
        keywords = self._extract_keywords(query)
        
        return {
            "query": query,
            "reasoning": "User wants a comprehensive report, so I'll gather data and format it professionally.",
            "pipeline": [
                {
                    "tool": "wikipedia_search",
                    "purpose": "Research the main topic",
                    "input": keywords
                },
                {
                    "tool": "news_fetcher",
                    "purpose": "Find current developments",
                    "input": keywords
                },
                {
                    "tool": "arxiv_summarizer",
                    "purpose": "Include academic perspectives",
                    "input": keywords
                },
                {
                    "tool": "data_plotter",
                    "purpose": "Visualize key trends for the topic",
                    "input": json.dumps({"2015": 10, "2020": 40, "2025": 65})
                },
                {
                    "tool": "document_writer",
                    "purpose": "Generate formatted PDF report with embedded chart references",
                    "input": json.dumps({"sections": [{"title": "Overview", "content": f"Research report on: {query}"}, {"title": "Key Findings", "content": "Detailed analysis and insights from multiple sources."}]})
                }
            ],
            "final_output": "Professional PDF report with visualizations"
        }

    def _create_coding_plan(self, query: str) -> Dict[str, Any]:
        """Create a coding-focused task plan."""
        return {
            "query": query,
            "reasoning": "User has a coding task, so I'll gather technical documentation and implementation details.",
            "pipeline": [
                {
                    "tool": "wikipedia_search",
                    "purpose": "Get core concept definitions",
                    "input": query
                },
                {
                    "tool": "arxiv_summarizer",
                    "purpose": "Find academic algorithms or papers related to the technical task",
                    "input": query
                },
                {
                    "tool": "qa_engine",
                    "purpose": "Generate technical implementation logic and code blocks",
                    "input": f"Write technical code and documentation for: {query}"
                }
            ],
            "final_output": "Technical implementation and code documentation"
        }

    def _create_brainstorming_plan(self, query: str) -> Dict[str, Any]:
        """Create a brainstorming task plan."""
        return {
            "query": query,
            "reasoning": "User wants to brainstorm, so I'll gather diverse inspirations and creative perspectives.",
            "pipeline": [
                {
                    "tool": "news_fetcher",
                    "purpose": "Get current trends and creative inspirations",
                    "input": query
                },
                {
                    "tool": "wikipedia_search",
                    "purpose": "Explore related lateral concepts",
                    "input": query
                },
                {
                    "tool": "qa_engine",
                    "purpose": "Generate a diverse set of creative ideas and brainstormed concepts",
                    "input": f"Brainstorm creative ideas for: {query}"
                }
            ],
            "final_output": "Creative brainstorm results and ideation list"
        }

    def create_plan(self, user_query: str, orchestrator=None, preprocessed: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        Create a task plan based on the user query with learning/adaptation and semantic intelligence.
        """
        intent = preprocessed.get("intent", "research_report") if preprocessed else "research_report"
        
        # LEARNING/ADAPTATION: Check for similar successful patterns
        similar_patterns = []
        if orchestrator:
            try:
                similar_patterns = orchestrator.get_similar_successful_patterns(user_query, limit=3)
                if similar_patterns:
                    best_match = similar_patterns[0]
                    similarity = best_match.get("similarity", 0)
                    if similarity > 0.7:
                        self.logger.info(f"📚 Learned pattern matched (similarity: {similarity:.2f})")
            except Exception as e:
                self.logger.debug(f"Pattern retrieval failed: {e}")
        
        # Try to use LLM for plan generation
        if self.llm_client and self.llm_client.is_available():
            try:
                llm_plan = self._create_llm_plan(user_query, similar_patterns, preprocessed)
                if llm_plan and "pipeline" in llm_plan and llm_plan["pipeline"]:
                    return llm_plan
            except Exception as e:
                self.logger.warning(f"LLM planning failed, using intent-based fallback: {e}")
        
        # Intent-based fallback planning
        self.logger.info(f"Using fallback plan for intent: {intent}")
        if intent == "coding_task":
            return self._create_coding_plan(user_query)
        elif intent == "brainstorming":
            return self._create_brainstorming_plan(user_query)
        elif intent == "visualization_request" or intent == "market_analysis":
            return self._create_analysis_plan(user_query)
        elif intent == "research_report":
            return self._create_report_plan(user_query)
        else:
            return self._create_research_plan(user_query)

    def create_plan_with_feedback(
        self, 
        user_query: str, 
        previous_plan: Dict[str, Any],
        feedback: str,
        issues: List[str],
        suggestions: List[str],
        score: int
    ) -> Dict[str, Any]:
        """
        Create an improved plan based on verifier feedback.
        
        Args:
            user_query: Original user query
            previous_plan: The plan that was rejected
            feedback: Human-readable feedback from verifier
            issues: List of specific issues identified
            suggestions: List of improvement suggestions
            score: Previous plan's score
            
        Returns:
            Dict[str, Any]: Improved task plan
        """
        self.logger.info(f"Regenerating plan with verifier feedback (previous score: {score})")
        
        # Try LLM-based replanning if available
        if self.llm_client and self.llm_client.is_available():
            try:
                llm_plan = self._create_llm_plan_with_feedback(
                    user_query, previous_plan, issues, suggestions, score
                )
                if llm_plan and "pipeline" in llm_plan and llm_plan["pipeline"]:
                    self.logger.info("Successfully created feedback-based LLM plan")
                    return llm_plan
                else:
                    self.logger.warning("Feedback-based LLM plan was empty, using fallback improvement")
                    return self._improve_plan_rule_based(previous_plan, issues, suggestions)
            except Exception as e:
                self.logger.warning(f"LLM feedback planning failed ({type(e).__name__}), using rule-based improvement")
                return self._improve_plan_rule_based(previous_plan, issues, suggestions)
        else:
            # Fallback to rule-based plan improvement
            return self._improve_plan_rule_based(previous_plan, issues, suggestions)
    
    def _create_llm_plan_with_feedback(
        self,
        user_query: str,
        previous_plan: Dict[str, Any],
        issues: List[str],
        suggestions: List[str],
        score: int
    ) -> Dict[str, Any]:
        """Create an improved plan using LLM with feedback context."""
        
        # Enhanced system prompt with feedback
        system_prompt = """You are a JSON-only response bot. You MUST respond with ONLY valid JSON. No other text is allowed.

Available tools:
{tools_description}

⚠️ CRITICAL INSTRUCTIONS - FOLLOW EXACTLY:
1. Your response MUST start with {{ and end with }}
2. DO NOT write ANY text before the {{
3. DO NOT write ANY text after the }}
4. DO NOT use markdown code blocks (```)
5. DO NOT include explanations or comments
6. ONLY output valid, parseable JSON

Required structure:
{{
    "query": "original user query here",
    "reasoning": "your planning reasoning addressing the feedback",
    "pipeline": [
        {{"tool": "tool_name", "purpose": "why needed", "input": "tool input"}}
    ],
    "final_output": "what the pipeline will produce"
}}

Rules:
- Use 2-5 tools maximum
- Only use tools from available list above
- Create logical sequences
- ALWAYS include qa_engine as the LAST step to synthesize a comprehensive answer
- For information gathering, use wikipedia_search, arxiv_summarizer, or news_fetcher BEFORE qa_engine
- Address ALL the issues and suggestions provided
- Ensure proper JSON syntax (commas, quotes, etc.)

IMPORTANT: Your ENTIRE response must be valid JSON. Start typing {{ immediately."""
        
        # Format available tools
        tools_description = ""
        for tool in self.tools:
            tools_description += f"- {tool.get('name', 'Unknown')}: {tool.get('description', 'No description')}\n"
        
        # Build detailed prompt with feedback
        previous_pipeline = previous_plan.get("pipeline", [])
        previous_tools = [step.get("tool") for step in previous_pipeline]
        
        prompt = f"""User Query: {user_query}

Previous Plan Score: {score}/100 (REJECTED)

Previous Pipeline:
{json.dumps(previous_pipeline, indent=2)}

Issues Identified:
{chr(10).join(f"- {issue}" for issue in issues) if issues else "- None"}

Suggestions for Improvement:
{chr(10).join(f"- {suggestion}" for suggestion in suggestions) if suggestions else "- None"}

Create an IMPROVED task plan that addresses all the issues and suggestions above:"""
        
        llm_response = self.llm_client.call_llm(
            prompt=prompt,
            system_prompt=system_prompt.format(tools_description=tools_description),
            max_tokens=1500
        )
        
        if llm_response:
            try:
                # Parse the improved plan
                if parse_llm_json:
                    expected_keys = ["query", "reasoning", "pipeline", "final_output"]
                    plan_data = parse_llm_json(llm_response, expected_keys)
                    
                    if validate_plan_json and not validate_plan_json(plan_data):
                        self.logger.warning("Improved LLM plan failed validation, enhancing...")
                        plan_data = self._validate_and_enhance_plan(plan_data, user_query)
                else:
                    clean_response = self._extract_json_from_response(llm_response)
                    plan_data = json.loads(clean_response)
                    plan_data = self._validate_and_enhance_plan(plan_data, user_query)
                
                # Validate and enhance
                plan_data = self._validate_and_enhance_plan(plan_data, user_query)
                
                # Add metadata
                plan_data.update({
                    "created_at": datetime.now().isoformat(),
                    "planner_version": "2.0.0-llm-feedback",
                    "available_tools": len(self.tools),
                    "estimated_steps": len(plan_data.get("pipeline", [])),
                    "llm_generated": True,
                    "revision_number": previous_plan.get("revision_number", 0) + 1,
                    "previous_score": score,
                    "addressed_issues": len(issues)
                })
                
                self.logger.info(f"Generated improved plan revision {plan_data.get('revision_number', 1)}")
                return plan_data
                
            except (json.JSONDecodeError, ValueError) as e:
                self.logger.debug(f"Failed to parse improved LLM JSON: {e}")
                raise
        else:
            raise ValueError("LLM returned no response for feedback-based planning")
    
    def _improve_plan_rule_based(
        self, 
        previous_plan: Dict[str, Any],
        issues: List[str],
        suggestions: List[str]
    ) -> Dict[str, Any]:
        """Improve plan using rule-based logic when LLM is unavailable."""
        self.logger.info("Using rule-based plan improvement")
        
        improved_plan = previous_plan.copy()
        pipeline = list(previous_plan.get("pipeline", []))
        query = previous_plan.get("query", "")
        
        # Rule 1: If redundancy issue, remove duplicate tools
        if any("redundant" in issue.lower() for issue in issues):
            seen_tools = set()
            unique_pipeline = []
            for step in pipeline:
                tool = step.get("tool")
                if tool not in seen_tools:
                    unique_pipeline.append(step)
                    seen_tools.add(tool)
            pipeline = unique_pipeline
            self.logger.info("Removed redundant tools")
        
        # Rule 2: If relevance issue, try to add more relevant tools
        if any("relevant" in issue.lower() for issue in issues):
            # Add wikipedia for foundational knowledge if not present
            tools_used = [step.get("tool") for step in pipeline]
            if "wikipedia_search" not in tools_used:
                pipeline.insert(0, {
                    "tool": "wikipedia_search",
                    "purpose": "Get foundational knowledge about the topic",
                    "input": query
                })
                self.logger.info("Added wikipedia_search for better relevance")
        
        # Rule 3: If completeness issue, add more data sources
        if (
            any("complete" in issue.lower() for issue in issues)
            or any("comprehensive" in suggestion.lower() for suggestion in suggestions)
        ):
            tools_used = [step.get("tool") for step in pipeline]
            
            # Add arxiv if not present
            if "arxiv_summarizer" not in tools_used:
                pipeline.append({
                    "tool": "arxiv_summarizer",
                    "purpose": "Get academic research for comprehensive coverage",
                    "input": query
                })
                self.logger.info("Added arxiv_summarizer for completeness")
            
            # Add news if not present
            if "news_fetcher" not in tools_used:
                pipeline.append({
                    "tool": "news_fetcher",
                    "purpose": "Get current developments for comprehensive coverage",
                    "input": query
                })
                self.logger.info("Added news_fetcher for completeness")
        
        # Rule 4: Ensure qa_engine is always the last step
        tools_in_pipeline = [step.get("tool") for step in pipeline]
        
        # Remove qa_engine if it's not at the end
        pipeline = [step for step in pipeline if step.get("tool") != "qa_engine"]
        
        # Add qa_engine at the end
        pipeline.append({
            "tool": "qa_engine",
            "purpose": "Synthesize comprehensive answer from all gathered information",
            "input": f"{query} (Use all information from previous tools to provide a detailed answer)"
        })
        self.logger.info("Ensured qa_engine is final synthesis step")
        
        # Update the improved plan
        improved_plan["pipeline"] = pipeline
        improved_plan["reasoning"] = f"Improved plan addressing: {', '.join(issues[:3])}" if issues else "Rule-based plan improvement"
        improved_plan.update({
            "created_at": datetime.now().isoformat(),
            "planner_version": "1.0.0-feedback-rules",
            "available_tools": len(self.tools),
            "estimated_steps": len(pipeline),
            "llm_generated": False,
            "revision_number": previous_plan.get("revision_number", 0) + 1,
            "improvements_applied": len(issues) + len(suggestions)
        })
        
        return improved_plan

    def _create_plan_from_pattern(self, user_query: str, pattern: Dict[str, Any]) -> Dict[str, Any]:
        """Create a plan based on a similar successful pattern (learning/adaptation)."""
        self.logger.info("📖 Creating plan from learned pattern")
        
        # Adapt the pattern to the new query
        pattern_plan = pattern.get("plan", {})
        adapted_plan = {
            "query": user_query,
            "reasoning": f"Adapted from similar successful pattern: {pattern.get('query', 'Unknown')}",
            "pipeline": pattern_plan.get("pipeline", []),
            "final_output": pattern_plan.get("final_output", "Comprehensive response"),
            "created_at": datetime.now().isoformat(),
            "planner_version": "2.0.0-pattern-learning",
            "learned_from": pattern.get("query", "Unknown"),
            "pattern_similarity": pattern.get("similarity", 0),
            "pattern_score": pattern.get("score", 0)
        }
        
        # Update inputs to use new query
        for step in adapted_plan["pipeline"]:
            if step.get("input") and pattern.get("query") in step["input"]:
                step["input"] = step["input"].replace(pattern.get("query", ""), user_query)
            elif not step.get("input") or len(step["input"]) < 5:
                step["input"] = user_query
        
        return adapted_plan
    
    def _create_llm_plan(self, user_query: str, similar_patterns: List[Dict[str, Any]] = None, preprocessed: Dict[str, Any] = None) -> Dict[str, Any]:
        """Create a plan using LLM for intelligent analysis with semantic research strategy."""
        
        # Add learning context if available
        learning_context = ""
        if similar_patterns:
            learning_context = "\n\nLEARNED PATTERNS (use as reference):\n"
            for i, pattern in enumerate(similar_patterns[:2], 1):  # Top 2 patterns
                learning_context += f"{i}. Similar query: {pattern.get('query', 'Unknown')}\n"
                learning_context += f"   Similarity: {pattern.get('similarity', 0):.2f}\n"
                learning_context += f"   Score: {pattern.get('score', 0)}/100\n"
                tools_used = pattern.get('plan', {}).get('tools_used', [])
                if tools_used:
                    learning_context += f"   Successful tools: {', '.join(tools_used)}\n"
        
        # Add semantic research strategy context
        research_context = ""
        if preprocessed:
            strategy = preprocessed.get("search_strategy", {})
            decomposition = preprocessed.get("task_decomposition", [])
            research_context = f"\n\nSEMANTIC RESEARCH STRATEGY:\n"
            research_context += f"Detected Intent: {preprocessed.get('intent')}\n"
            research_context += f"Visual Report Required: {preprocessed.get('visualization_required')}\n"
            research_context += "Decomposition Milestones:\n"
            for m in decomposition:
                research_context += f"- {m}\n"
            research_context += "\nDomain-Specific Optimized Queries:\n"
            research_context += f"- Academic: {', '.join(strategy.get('academic', []))}\n"
            research_context += f"- News: {', '.join(strategy.get('news', []))}\n"
            research_context += f"- General: {', '.join(strategy.get('general', []))}\n"
            research_context += f"- Data: {', '.join(strategy.get('data', []))}\n"

        # Prepare the system prompt for planning
        system_prompt = """You are the DualMind Orchestration Strategist.
Your task is to build a sophisticated multi-agent research pipeline.

Available tools:
{tools_description}

⚠️ ORCHESTRATION RULES:
1. **Semantic Query Routing**: 
   - Use 'academic' queries for arxiv_summarizer and semantic_scholar.
   - Use 'news' queries for news_fetcher.
   - Use 'general' queries for wikipedia_search.
   - Use 'data' queries for tools requiring statistics or trends.
2. **Decomposition Alignment**: Structure the pipeline to follow the provided research milestones.
3. **Visual Intent**: If 'visualization_required' is true, ENSURE data_plotter is included with data-rich inputs.
4. **Synthesis First**: ALWAYS end with qa_engine to synthesize all findings.
5. **JSON ONLY**: Respond with ONLY the JSON object.

Structure:
{{
    "query": "original user query",
    "reasoning": "Strategy explanation",
    "pipeline": [
        {{"tool": "tool_name", "purpose": "why", "input": "optimized_query_for_this_tool"}}
    ],
    "final_output": "Description"
}}"""

        # Format available tools for the prompt
        tools_description = ""
        for tool in self.tools:
            tools_description += f"- {tool.get('name', 'Unknown')}: {tool.get('description', 'No description')}\n"

        prompt = f"User Query: {user_query}{learning_context}{research_context}\n\nCreate the orchestration plan:"

        llm_response = self.llm_client.call_llm(
            prompt=prompt,
            system_prompt=system_prompt.format(tools_description=tools_description),
            max_tokens=1500
        )

        if llm_response:
            try:
                # Use robust JSON parser with automatic fixing
                if parse_llm_json:
                    # Use the advanced JSON fixer
                    expected_keys = ["query", "reasoning", "pipeline", "final_output"]
                    plan_data = parse_llm_json(llm_response, expected_keys)
                    
                    # Additional validation
                    if validate_plan_json and not validate_plan_json(plan_data):
                        self.logger.warning("LLM plan failed validation, enhancing...")
                        plan_data = self._validate_and_enhance_plan(plan_data, user_query)
                else:
                    # Fallback to old method if json_fixer not available
                    clean_response = self._extract_json_from_response(llm_response)
                    plan_data = json.loads(clean_response)
                    plan_data = self._validate_and_enhance_plan(plan_data, user_query)
                
                # Validate and enhance the plan
                plan_data = self._validate_and_enhance_plan(plan_data, user_query)
                
                # Add metadata
                plan_data.update({
                    "created_at": datetime.now().isoformat(),
                    "planner_version": "2.0.0-llm",
                    "available_tools": len(self.tools),
                    "estimated_steps": len(plan_data.get("pipeline", [])),
                    "llm_generated": True
                })
                
                self.logger.info(f"Successfully parsed and validated LLM plan with {len(plan_data.get('pipeline', []))} steps")
                return plan_data
                
            except (json.JSONDecodeError, ValueError) as e:
                self.logger.debug(f"Failed to parse LLM JSON response: {e}")
                raise  # Re-raise to be caught by create_plan
        else:
            self.logger.debug("LLM returned None, falling back")
            raise ValueError("LLM returned no response")

    def _extract_json_from_response(self, response: str) -> str:
        """Extract JSON content from LLM response, handling various formats."""
        if not response:
            raise ValueError("Empty response")
        
        import re
        
        # Strip whitespace
        response = response.strip()
        
        # Remove common LLM prefixes
        response = re.sub(r'^(Here is|Here\'s|Sure|Certainly|Of course)[^\{]*', '', response, flags=re.IGNORECASE)
        response = response.strip()
        
        # Try direct parsing first
        try:
            json.loads(response)
            return response
        except json.JSONDecodeError:
            pass
        
        # Remove markdown code blocks
        code_block_match = re.search(r'```(?:json)?\s*\n?(.*?)\n?```', response, re.DOTALL)
        if code_block_match:
            cleaned = code_block_match.group(1).strip()
            try:
                json.loads(cleaned)
                return cleaned
            except json.JSONDecodeError:
                pass
        
        # Find the first { and last } - most aggressive approach
        first_brace = response.find('{')
        last_brace = response.rfind('}')
        
        if first_brace != -1 and last_brace != -1 and last_brace > first_brace:
            potential_json = response[first_brace:last_brace + 1]
            try:
                json.loads(potential_json)
                return potential_json
            except json.JSONDecodeError:
                pass
        
        # Try to extract balanced braces from the start
        if response.startswith('{'):
            brace_count = 0
            end_idx = 0
            
            for i, char in enumerate(response):
                if char == '{':
                    brace_count += 1
                elif char == '}':
                    brace_count -= 1
                    if brace_count == 0:
                        end_idx = i + 1
                        break
            
            if end_idx > 0:
                potential_json = response[:end_idx]
                try:
                    json.loads(potential_json)
                    return potential_json
                except json.JSONDecodeError:
                    pass
        
        # Look for JSON pattern with proper structure
        json_pattern = r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}'
        matches = re.findall(json_pattern, response, re.DOTALL)
        
        for match in reversed(matches):  # Try longest matches first
            try:
                json.loads(match)
                return match
            except json.JSONDecodeError:
                continue
        
        # If nothing works, raise an error with sample of response
        sample = response[:200] if len(response) > 200 else response
        raise ValueError(f"Could not extract valid JSON from LLM response. Sample: {sample}...")

    def _validate_and_enhance_plan(self, plan_data: Dict[str, Any], original_query: str) -> Dict[str, Any]:
        """Validate and enhance the LLM-generated plan."""
        
        # Ensure required fields exist
        if "pipeline" not in plan_data:
            plan_data["pipeline"] = []
        if "reasoning" not in plan_data:
            plan_data["reasoning"] = "LLM-generated plan"
        if "final_output" not in plan_data:
            plan_data["final_output"] = "Comprehensive response"
            
        # Validate that tools exist and are available
        available_tool_names = [tool.get('name', '') for tool in self.tools]
        validated_pipeline = []
        
        for step in plan_data.get("pipeline", []):
            tool_name = step.get("tool", "")
            if tool_name in available_tool_names:
                # Ensure input is provided
                if "input" not in step or not step["input"]:
                    step["input"] = original_query
                validated_pipeline.append(step)
            else:
                self.logger.warning(f"Unknown tool '{tool_name}' in LLM plan, removing from pipeline")
                
        plan_data["pipeline"] = validated_pipeline
        
        # If no valid tools in pipeline, add a fallback
        if not validated_pipeline:
            plan_data["pipeline"] = [{
                "tool": "qa_engine",
                "purpose": "Answer the query using available knowledge",
                "input": original_query
            }]
        else:
            # CRITICAL: Always ensure qa_engine is the LAST step for comprehensive synthesis
            # Check if qa_engine is already in the pipeline
            has_qa_engine = any(step.get("tool") == "qa_engine" for step in validated_pipeline)
            
            if not has_qa_engine:
                # Add qa_engine as the final step to synthesize all previous outputs
                self.logger.info("Adding qa_engine as final synthesis step")
                validated_pipeline.append({
                    "tool": "qa_engine",
                    "purpose": "Synthesize comprehensive answer from all gathered information",
                    "input": f"{original_query} (Use all information from previous tools to provide a detailed answer)"
                })
                plan_data["pipeline"] = validated_pipeline
            
        return plan_data

    def _create_fallback_plan(self, user_query: str) -> Dict[str, Any]:
        """Create a fallback plan using keyword-based logic."""
        # Analyze the query to determine the best approach
        query_lower = user_query.lower()

        # Determine query type for fallback planning
        if any(word in query_lower for word in ['research', 'explore', 'investigate', 'find out']):
            plan = self._create_research_plan(user_query)
        elif any(word in query_lower for word in ['summarize', 'overview', 'brief']):
            plan = self._create_summary_plan(user_query)
        elif any(word in query_lower for word in ['analyze', 'sentiment', 'trend', 'pattern']):
            plan = self._create_analysis_plan(user_query)
        elif any(word in query_lower for word in ['report', 'document', 'pdf', 'write', 'visualize', 'visualization', 'graph', 'chart', 'plot']):
            plan = self._create_report_plan(user_query)
        else:
            # Default to research plan for unknown query types
            plan = self._create_research_plan(user_query)

        # Add metadata to the plan
        plan.update({
            "created_at": datetime.now().isoformat(),
            "planner_version": "1.0.0-fallback",
            "available_tools": len(self.tools),
            "estimated_steps": len(plan.get("pipeline", [])),
            "llm_generated": False
        })

        return plan

    def explain_plan(self, plan: Dict[str, Any]) -> str:
        """
        Generate a human-readable explanation of the task plan.

        Args:
            plan (Dict[str, Any]): The task plan to explain

        Returns:
            str: Human-readable explanation
        """
        explanation = "🤖 **Planner Analysis & Task Pipeline**\n\n"
        explanation += f"**Query:** {plan.get('query', 'Unknown')}\n\n"
        explanation += f"**Reasoning:** {plan.get('reasoning', 'No reasoning available')}\n\n"

        explanation += "**📋 Planned Task Pipeline:**\n"
        pipeline = plan.get('pipeline', [])
        for i, step in enumerate(pipeline, 1):
            explanation += f"{i}. **{step.get('tool', 'Unknown')}**\n"
            explanation += f"   - Purpose: {step.get('purpose', 'No purpose specified')}\n"
            explanation += f"   - Input: {step.get('input', 'No input specified')}\n\n"

        explanation += f"**🎯 Expected Output:** {plan.get('final_output', 'Unknown output type')}\n"
        explanation += f"**📊 Plan Metadata:** {plan.get('estimated_steps', 0)} steps, {plan.get('available_tools', 0)} tools available"

        return explanation


def create_planner() -> Planner:
    """
    Factory function to create a Planner instance.

    Returns:
        Planner: Configured planner instance
    """
    return Planner()