
"""
Orchestrator Module
Coordinates Planner, Verifier, and tool execution in the DualMind system.
"""

import json
import logging
import time
import os
from typing import Dict, Any, Generator, List, Optional
from datetime import datetime

class Orchestrator:
    """
    Central coordinator for the DualMind Orchestrator system.
    Manages the interaction between Planner, Verifier, and tool execution.
    """

    def __init__(self, tools_dir: str = "tools", logs_dir: str = "logs"):
        """
        Initialize the Orchestrator.

        Args:
            tools_dir (str): Directory containing tool modules
            logs_dir (str): Directory for storing logs
        """
        self.tools_dir = tools_dir
        self.logs_dir = logs_dir
        self.logger = logging.getLogger(__name__)

        # Tools whose failure should not block the entire pipeline
        self.non_critical_tools = ["wikipedia_search"]

        # Create directories if they don't exist
        for directory in [tools_dir, logs_dir]:
            if not os.path.exists(directory):
                os.makedirs(directory)

        # Import tools dynamically
        self.tools = self._load_tools()

        # Initialize components
        from planner import create_planner
        from verifier import create_verifier

        self.planner = create_planner()
        self.verifier = create_verifier()

        # Execution state
        self.execution_history = []

    def _preprocess_query(self, raw_query: str) -> Dict[str, Any]:
        """
        Use the LLM to normalize the query, fix typos, and extract intent.
        
        Returns:
            Dict[str, Any]: {
                "cleaned_query": "normalized query",
                "search_terms": "keyword optimized for tools",
                "intent": "research|report|code|analysis|brainstorm",
                "detected_typos": True/False
            }
        """
        self.logger.info(f"Preprocessing query: {raw_query}")
        
        try:
            from llm_client import llm_client
            
            system_prompt = """You are the DualMind Semantic Processor.
Your task is to analyze raw user queries and extract structured intent.

1. Fix any spelling or grammar errors (e.g., 'summarisze' -> 'summarize').
2. Extract the core search terms for research tools (ArXiv, Wikipedia).
3. Classify the intent into one of: 
   - research_report (comprehensive summary)
   - technical_explanation (how things work)
   - coding_task (implementation/programming)
   - market_analysis (trends/companies)
   - visualization_request (charts/graphs)
   - brainstorming (ideas/creativity)

Respond ONLY with a JSON object:
{
  "cleaned_query": "the corrected query",
  "search_terms": "optimized search keywords",
  "intent": "category",
  "is_complex": true/false
}"""
            
            response = llm_client.call_llm(
                prompt=f"Raw Query: {raw_query}",
                system_prompt=system_prompt,
                require_json=True,
                max_tokens=300
            )
            
            if response and isinstance(response, dict):
                self.logger.info(f"Query preprocessed: {response.get('cleaned_query')}")
                return response
                
        except Exception as e:
            self.logger.warning(f"Preprocessing failed, using raw query: {e}")
            
        # Fallback if LLM fails
        return {
            "cleaned_query": raw_query,
            "search_terms": raw_query[:100],
            "intent": "research_report",
            "is_complex": False
        }

    def _load_tools(self) -> Dict[str, Any]:
        """Load and prepare tool functions for execution."""
        tools = {}

        try:
            # Import all tool modules
            tool_files = [
                'arxiv_summarizer', 'semantic_scholar', 'pubmed_search', 'pdf_parser',
                'wikipedia_search', 'news_fetcher',
                'sentiment_analyzer', 'data_plotter', 'qa_engine', 'document_writer'
            ]

            for tool_name in tool_files:
                try:
                    # Dynamically import the tool module
                    module = __import__(f"tools.{tool_name}", fromlist=[f"{tool_name}_tool"])

                    # Get the tool function
                    tool_function = getattr(module, f"{tool_name}_tool")
                    tools[tool_name] = tool_function

                except ImportError as e:
                    self.logger.warning(f"Could not import tool {tool_name}: {e}")
                except AttributeError as e:
                    self.logger.warning(f"Tool function not found in {tool_name}: {e}")

        except Exception as e:
            self.logger.error(f"Error loading tools: {e}")

        return tools

    def process_query(self, user_query: str, max_iterations: int = 2) -> Dict[str, Any]:
        """
        Process a user query through the complete DualMind pipeline with semantic intelligence.
        """
        start_time = time.time()
        session_id = f"session_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

        self.logger.info(f"Starting new session: {session_id}")
        
        # Phase 0: Preprocessing
        preprocessed = self._preprocess_query(user_query)
        cleaned_query = preprocessed.get("cleaned_query", user_query)
        search_terms = preprocessed.get("search_terms", user_query)

        try:
            # Phase 1: Initial Planning with cleaned query
            self.logger.info(f"Phase 1: Generating plan for: {cleaned_query} (Intent: {intent})")
            plan = self.planner.create_plan(cleaned_query, orchestrator=self, intent=intent)
            plan_explanation = self.planner.explain_plan(plan)

            # Phase 2: Adversarial Loop
            self.logger.info("Phase 2: Entering adversarial verification loop...")
            iteration = 0
            verification = None
            verifier_feedback = None
            plan_history = [{"iteration": 0, "plan": plan.copy(), "score": 0}]
            
            while iteration < max_iterations:
                iteration += 1
                self.logger.info(f"🔄 Adversarial iteration {iteration}/{max_iterations}")

                # Verify the current plan
                verification = self.verifier.verify_plan(plan)
                verifier_feedback = self.verifier.generate_feedback(verification)
                score = verification.get("score", 0)
                approved = verification.get("overall_approval", False)
                
                # Log verification results
                self.logger.info(f"Verification score: {score}/100, Approved: {approved}")
                
                # Store plan in history
                plan_history.append({
                    "iteration": iteration,
                    "plan": plan.copy(),
                    "score": score,
                    "approved": approved
                })

                # Check if plan is approved
                if approved:
                    self.logger.info(f"✅ Plan approved by verifier (score: {score}/100)")
                    break

                # Plan needs improvement - regenerate with feedback
                self.logger.warning(f"❌ Plan rejected (score: {score}/100)")
                
                if iteration < max_iterations:
                    # Extract feedback details
                    issues = verification.get("issues", [])
                    suggestions = verification.get("suggestions", [])
                    
                    self.logger.info(f"Issues: {len(issues)}, Suggestions: {len(suggestions)}")
                    self.logger.info("🔧 Regenerating plan with verifier feedback...")
                    
                    # CRITICAL: Actually regenerate the plan with feedback
                    try:
                        plan = self.planner.create_plan_with_feedback(
                            user_query=cleaned_query,
                            previous_plan=plan,
                            feedback=verifier_feedback,
                            issues=issues,
                            suggestions=suggestions,
                            score=score
                        )
                        
                        # Update explanation for the new plan
                        plan_explanation = self.planner.explain_plan(plan)
                        self.logger.info(f"✨ Generated improved plan (revision {plan.get('revision_number', iteration)})")
                        
                    except Exception as e:
                        self.logger.error(f"Failed to regenerate plan: {e}")
                        self.logger.warning("Proceeding with previous plan")
                        break
                else:
                    self.logger.warning(f"⚠️ Max iterations ({max_iterations}) reached without approval")

            # Determine if we should proceed with execution
            final_score = verification.get("score", 0) if verification else 0
            final_approval = verification.get("overall_approval", False) if verification else False
            
            # Phase 3: Execution Decision with Self-Correction Support
            if not final_approval and final_score < 50:
                # Plan is too bad to execute
                self.logger.error(f"Plan quality too low (score: {final_score}/100). Refusing to execute.")
                error_results = {
                    "session_id": session_id,
                    "user_query": user_query,
                    "execution_time": time.time() - start_time,
                    "iterations": iteration,
                    "plan": plan,
                    "plan_history": plan_history,
                    "verification": verification,
                    "verifier_feedback": verifier_feedback,
                    "error": f"Plan quality insufficient (score: {final_score}/100). Cannot proceed with execution.",
                    "status": "rejected_by_verifier"
                }
                self._log_session(error_results)
                return error_results
            
            # Execute the plan (either approved or acceptable quality)
            if final_approval:
                self.logger.info("Phase 3: Executing approved task pipeline...")
            else:
                self.logger.warning(f"Phase 3: Executing plan with warnings (score: {final_score}/100)...")
            
            execution_results = self._execute_pipeline_with_selfcorrection(plan, cleaned_query, search_terms=search_terms, max_retries=2)

            # Phase 4: Final verification
            self.logger.info("Phase 4: Final verification of results...")
            final_verification = self.verifier.verify_plan({
                "query": user_query,
                "pipeline": plan.get("pipeline", []),
                "results": execution_results
            })

            # Compile complete results
            total_time = time.time() - start_time

            results = {
                "session_id": session_id,
                "user_query": user_query,
                "execution_time": total_time,
                "iterations": iteration,
                "plan": plan,
                "plan_history": plan_history,  # Track evolution of plans through iterations
                "plan_explanation": plan_explanation,
                "verification": verification,
                "verifier_feedback": verifier_feedback,
                "execution_results": execution_results,
                "final_verification": final_verification,
                "status": "completed" if verification.get("overall_approval", False) else "completed_with_issues",
                "adversarial_loop_active": True,
                "final_plan_score": final_score,
                "plan_approved": final_approval,
                "self_correction_used": execution_results[0].get("retry_count", 0) > 0 if execution_results else False
            }

            # Log the session for learning/adaptation
            self._log_session(results)
            
            # Store successful plan patterns for learning
            if final_approval and len(execution_results) > 0:
                success_count = sum(1 for r in execution_results if r.get('status') == 'success')
                if success_count >= len(execution_results) * 0.8:  # 80% success rate
                    self._store_successful_plan_pattern(user_query, plan, final_score)

            return results

        except Exception as e:
            self.logger.error(f"Error in query processing: {e}")

            # Return error results
            error_results = {
                "session_id": session_id,
                "user_query": user_query,
                "execution_time": time.time() - start_time,
                "error": str(e),
                "status": "error"
            }

            self._log_session(error_results)
            return error_results

    def process_query_stream(self, user_query: str, max_iterations: int = 2, conversation_id: str = "") -> Generator[Dict[str, Any], None, None]:
        """
        Stream orchestration events as the query is processed, and log them to Firebase.
        """
        for event in self._process_query_stream_internal(user_query, max_iterations):
            if conversation_id:
                try:
                    from firebase_helper import log_orchestration_event
                    # Copy the event to avoid mutating the yielded object
                    log_orchestration_event(conversation_id, dict(event))
                except Exception as e:
                    self.logger.error(f"Error logging event to Firebase: {e}")
            yield event

    def _process_query_stream_internal(self, user_query: str, max_iterations: int = 2) -> Generator[Dict[str, Any], None, None]:
        """
        Internal generator for streaming orchestration events with semantic intelligence.
        """
        start_time = time.time()
        session_id = f"session_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

        yield {"type": "session_started", "sessionId": session_id, "query": user_query}
        
        # --- Phase 0: Semantic Preprocessing ---
        yield {"type": "thought", "content": "Analyzing query semantics and intent..."}
        preprocessed = self._preprocess_query(user_query)
        cleaned_query = preprocessed.get("cleaned_query", user_query)
        intent = preprocessed.get("intent", "research_report")
        search_terms = preprocessed.get("search_terms", user_query)
        
        if cleaned_query != user_query:
            yield {"type": "thought", "content": f"Normalized query: \"{cleaned_query}\" (Intent: {intent})"}
        else:
            yield {"type": "thought", "content": f"Neural intent identified: {intent}"}

        try:
            # --- Phase 1: Planning ---
            yield {"type": "planner_started"}
            # Use cleaned query and intent for planning
            plan = self.planner.create_plan(cleaned_query, orchestrator=self, intent=intent)
            plan_explanation = self.planner.explain_plan(plan)
            yield {
                "type": "planner_completed",
                "plan": {
                    "pipeline": plan.get("pipeline", []),
                    "reasoning": plan.get("reasoning", ""),
                },
                "explanation": plan_explanation,
            }

            # --- Phase 2: Adversarial verification loop ---
            yield {"type": "verifier_started"}
            iteration = 0
            verification = None
            verifier_feedback = None

            while iteration < max_iterations:
                iteration += 1
                verification = self.verifier.verify_plan(plan)
                verifier_feedback = self.verifier.generate_feedback(verification)
                score = verification.get("score", 0)
                approved = verification.get("overall_approval", False)

                yield {
                    "type": "verifier_iteration",
                    "iteration": iteration,
                    "score": score,
                    "approved": approved,
                    "issues": len(verification.get("issues", [])),
                }

                if approved:
                    break

                if iteration < max_iterations:
                    try:
                        plan = self.planner.create_plan_with_feedback(
                            user_query=cleaned_query,
                            previous_plan=plan,
                            feedback=verifier_feedback,
                            issues=verification.get("issues", []),
                            suggestions=verification.get("suggestions", []),
                            score=score,
                        )
                        plan_explanation = self.planner.explain_plan(plan)
                    except Exception:
                        break

            final_score = verification.get("score", 0) if verification else 0
            final_approval = verification.get("overall_approval", False) if verification else False
            yield {
                "type": "verifier_completed",
                "score": final_score,
                "approved": final_approval,
            }

            # --- Phase 3: Tool execution ---
            if not final_approval and final_score < 50:
                yield {
                    "type": "error",
                    "message": f"Plan quality too low ({final_score}/100). Execution aborted.",
                }
                return

            pipeline = plan.get("pipeline", [])
            execution_results = []
            
            from concurrent.futures import ThreadPoolExecutor
            with ThreadPoolExecutor(max_workers=min(len(pipeline), 4)) as executor:
                futures = []
                for step_num, step in enumerate(pipeline, 1):
                    tool_name = step.get("tool", "")
                    
                    # INTELLIGENCE OVERHAUL: Skip redundant qa_engine in streaming mode
                    if tool_name == "qa_engine":
                        self.logger.info("Skipping redundant qa_engine in streaming pipeline")
                        continue
                        
                    yield {
                        "type": "tool_started",
                        "step": step_num,
                        "totalSteps": len(pipeline),
                        "tool": tool_name,
                        "purpose": step.get("purpose", ""),
                    }
                    
                    def run_tool(s_num, s_data):
                        t_name = s_data.get("tool", "")
                        # Use search_terms for research tools
                        t_input = s_data.get("input", cleaned_query)
                        if t_name in ["wikipedia_search", "arxiv_summarizer", "news_fetcher", "semantic_scholar", "pubmed_search"]:
                            t_input = search_terms
                            
                        try:
                            t0 = time.time()
                            t_output = self.tools[t_name](t_input)
                            return {"step": s_num, "tool": t_name, "status": "success",
                                    "execution_time": time.time() - t0, "output": t_output,
                                    "input": t_input, "purpose": s_data.get("purpose", "")}
                        except Exception as e:
                            return {"step": s_num, "tool": t_name, "status": "error",
                                    "error": str(e), "output": ""}

                    futures.append(executor.submit(run_tool, step_num, step))

                # Gather parallel results
                for future in futures:
                    res = future.result()
                    execution_results.append(res)
                    yield {
                        "type": "tool_completed",
                        "step": res["step"],
                        "tool": res["tool"],
                        "status": res["status"],
                        "executionTime": res.get("execution_time", 0),
                        "outputPreview": str(res.get("output", ""))[:200],
                    }

            # --- Phase 4: Synthesis with token streaming ---
            yield {"type": "synthesis_started"}

            # Build premium synthesis prompt from accumulated results
            from llm_client import llm_client
            context_parts = []
            for r in execution_results:
                if r.get("status") == "success" and r.get("output"):
                    context_parts.append(f"### Source: {r['tool']}\n{str(r['output'])[:2000]}")

            # Mode-specific instructions
            mode_instructions = {
                "research_report": "Focus on comprehensive coverage, technical depth, and clear section hierarchy. Use professional academic tone.",
                "technical_explanation": "Focus on mechanics, architecture, and 'how it works'. Use analogies where helpful but maintain technical accuracy.",
                "coding_task": "Prioritize code blocks, implementation details, and step-by-step logic. Ensure code is production-grade.",
                "market_analysis": "Focus on companies, trends, statistics, and competitive landscape. Use business-analytical tone.",
                "visualization_request": "Structure data clearly and provide insights that can be graphed. Suggest specific chart types.",
                "brainstorming": "Focus on creativity, diversity of ideas, and out-of-the-box thinking. Use an inspiring, lateral-thinking tone."
            }

            synthesis_prompt = f"""You are DualMind, a premium AGI Research Operating System.
Your task is to synthesize a world-class response for the following query.

**User Query:** {cleaned_query}
**Detected Intent:** {intent}

{mode_instructions.get(intent, mode_instructions["research_report"])}

### RESEARCH DATA FROM ORCHESTRATION PIPELINE:
{'---'.join(context_parts)}

### SYNTHESIS REQUIREMENTS:
1. **Premium Quality**: Avoid generic AI boilerplate ("Here is a summary", "In conclusion"). Start directly with high-signal insights.
2. **Structural Excellence**: Use clear Markdown hierarchy (##, ###). Use bolding for key terms.
3. **Source Grounding**: Refer to findings from the specific tools (e.g., "According to ArXiv research...", "Recent news indicates...").
4. **No Placeholders**: Do not use "fake" data. If info is missing, acknowledge the gap intelligently.
5. **Concise but Deep**: Every sentence must provide value. Avoid wordiness.
6. **Report Style**: For reports, use a professional executive summary followed by detailed sections.

Respond as the DualMind OS core:"""

            token_buffer = ""
            for token in llm_client.call_llm_stream(synthesis_prompt, max_tokens=3000):
                token_buffer += token
                yield {"type": "token", "content": token}

            # Fallback if streaming produced nothing
            if not token_buffer.strip():
                from synthesizer import synthesize_answer
                fallback = synthesize_answer(cleaned_query, execution_results, plan)
                if fallback:
                    token_buffer = fallback
                    yield {"type": "token", "content": fallback}

            yield {"type": "synthesis_completed"}

            # --- Done ---
            total_time = time.time() - start_time
            yield {
                "type": "completed",
                "sessionId": session_id,
                "executionTime": round(total_time, 2),
                "toolsExecuted": len(execution_results),
                "successCount": sum(1 for r in execution_results if r.get("status") == "success"),
            }

        except Exception as exc:
            self.logger.error(f"Streaming orchestration error: {exc}")
            yield {"type": "error", "message": str(exc)}

    def _execute_pipeline_with_selfcorrection(self, plan: Dict[str, Any], user_query: str, search_terms: str = "", max_retries: int = 2) -> List[Dict[str, Any]]:
        """Execute pipeline with self-correction capability."""
        for attempt in range(max_retries + 1):
            if attempt > 0:
                self.logger.warning(f"🔄 Self-correction attempt {attempt}/{max_retries}")
            
            execution_results = self._execute_pipeline(plan, search_terms=search_terms)
            
            # Check if execution was successful
            # Ignore failures from non-critical tools (e.g. wikipedia_search)
            failed_tools = [
                r for r in execution_results
                if r.get('status') == 'error' and r.get('tool') not in self.non_critical_tools
            ]
            
            if not failed_tools:
                # All tools succeeded
                return execution_results
            
            # Self-correction: analyze failures and retry with modified plan
            if attempt < max_retries:
                self.logger.warning(f"❌ {len(failed_tools)} tool(s) failed. Attempting self-correction...")
                
                # Create corrected plan
                try:
                    plan = self._create_corrected_plan(plan, failed_tools, user_query)
                    self.logger.info("✨ Generated corrected plan, retrying...")
                except Exception as e:
                    self.logger.error(f"Failed to create corrected plan: {e}")
                    break
            else:
                self.logger.error(f"⚠️ Max retries reached. Returning results with {len(failed_tools)} failures.")
        
        # Mark results with retry information
        for result in execution_results:
            result["retry_count"] = attempt
        
        return execution_results
    
    def _create_corrected_plan(self, plan: Dict[str, Any], failed_tools: List[Dict[str, Any]], user_query: str) -> Dict[str, Any]:
        """Create a corrected plan based on execution failures."""
        corrected_plan = plan.copy()
        pipeline = list(plan.get("pipeline", []))
        
        # Analyze failures and apply corrections
        for failed in failed_tools:
            tool_name = failed.get("tool", "")
            error = failed.get("error", "")
            step_idx = failed.get("step", 1) - 1
            
            self.logger.info(f"Analyzing failure: {tool_name} - {error}")
            
            # Strategy 1: Tool not available -> Replace with fallback
            if "not available" in error.lower():
                fallback = self._get_fallback_tool(tool_name)
                if fallback and step_idx < len(pipeline):
                    pipeline[step_idx]["tool"] = fallback
                    self.logger.info(f"Replaced {tool_name} with fallback: {fallback}")
            
            # Strategy 2: Tool failed -> Add error handling or skip
            elif step_idx < len(pipeline):
                # Remove the failed step if it's non-critical
                if tool_name not in ["qa_engine", "wikipedia_search"]:
                    pipeline.pop(step_idx)
                    self.logger.info(f"Removed non-critical failed tool: {tool_name}")
        
        # Ensure qa_engine is still present
        has_qa = any(step.get("tool") == "qa_engine" for step in pipeline)
        if not has_qa:
            pipeline.append({
                "tool": "qa_engine",
                "purpose": "Synthesize answer from available data",
                "input": user_query
            })
        
        corrected_plan["pipeline"] = pipeline
        corrected_plan["self_corrected"] = True
        return corrected_plan
    
    def _get_fallback_tool(self, tool_name: str) -> Optional[str]:
        """Get fallback tool for a failed tool."""
        fallback_map = {
            "arxiv_summarizer": "wikipedia_search",
            "news_fetcher": "wikipedia_search",
            "data_plotter": None,  # No fallback for visualization
            "document_writer": None,  # No fallback for document generation
        }
        return fallback_map.get(tool_name)
    
    def _execute_pipeline(self, plan: Dict[str, Any], search_terms: str = "") -> List[Dict[str, Any]]:
        """Execute the planned tool pipeline with context accumulation."""
        execution_results = []
        pipeline = plan.get("pipeline", [])

        for step_num, step in enumerate(pipeline, 1):
            tool_name = step.get("tool", "")
            tool_input = step.get("input", "")
            
            # Context accumulation: Pass previous outputs to qa_engine
            if tool_name == "qa_engine" and execution_results:
                context_parts = []
                for prev_result in execution_results:
                    if prev_result.get("status") == "success":
                        prev_tool = prev_result.get("tool", "")
                        prev_output = prev_result.get("output", "")
                        if prev_output and len(prev_output) > 10:
                            context_parts.append(f"[{prev_tool}]: {prev_output}")
                
                if context_parts:
                    context = "\n\n".join(context_parts)
                    tool_input = f"{tool_input}|||CONTEXT:{context}"

            self.logger.info(f"Executing step {step_num}: {tool_name}")

            if tool_name not in self.tools:
                result = {
                    "step": step_num,
                    "tool": tool_name,
                    "status": "error",
                    "error": f"Tool '{tool_name}' not available",
                    "output": ""
                }
            else:
                try:
                    # INTELLIGENCE OVERHAUL: Use search_terms for research tools
                    if search_terms and tool_name in ["wikipedia_search", "arxiv_summarizer", "news_fetcher", "semantic_scholar", "pubmed_search"]:
                        tool_input = search_terms
                        self.logger.info(f"Using optimized search terms for {tool_name}: {search_terms}")
                        
                    # Execute the tool
                    start_time = time.time()
                    output = self.tools[tool_name](tool_input)
                    execution_time = time.time() - start_time

                    result = {
                        "step": step_num,
                        "tool": tool_name,
                        "status": "success",
                        "execution_time": execution_time,
                        "output": output,
                        "input": step.get("input", ""),  # Store original input
                        "purpose": step.get("purpose", "")
                    }

                except Exception as e:
                    self.logger.error(f"Error executing tool {tool_name}: {e}")
                    result = {
                        "step": step_num,
                        "tool": tool_name,
                        "status": "error",
                        "error": str(e),
                        "output": "",
                        "input": tool_input,
                        "purpose": step.get("purpose", "")
                    }

            execution_results.append(result)

        return execution_results
    
    def _store_successful_plan_pattern(self, query: str, plan: Dict[str, Any], score: int):
        """Store successful plan patterns for learning/adaptation."""
        try:
            # Create patterns directory if it doesn't exist
            patterns_dir = os.path.join(self.logs_dir, "patterns")
            if not os.path.exists(patterns_dir):
                os.makedirs(patterns_dir)
            
            # Extract key features from query
            query_features = self._extract_query_features(query)
            
            # Create pattern entry
            pattern = {
                "timestamp": datetime.now().isoformat(),
                "query": query,
                "query_features": query_features,
                "plan": {
                    "pipeline": plan.get("pipeline", []),
                    "reasoning": plan.get("reasoning", ""),
                    "tools_used": [step.get("tool") for step in plan.get("pipeline", [])]
                },
                "score": score,
                "success": True
            }
            
            # Store pattern
            pattern_file = os.path.join(patterns_dir, f"pattern_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json")
            with open(pattern_file, 'w') as f:
                json.dump(pattern, f, indent=2)
            
            self.logger.info(f"✅ Stored successful plan pattern: {pattern_file}")
            
        except Exception as e:
            self.logger.warning(f"Failed to store plan pattern: {e}")
    
    def _extract_query_features(self, query: str) -> Dict[str, Any]:
        """Extract features from query for pattern matching."""
        query_lower = query.lower()
        
        features = {
            "length": len(query.split()),
            "has_question": "?" in query,
            "type": self._classify_query_type(query_lower),
            "keywords": []
        }
        
        # Extract domain keywords
        domains = [
            ("ai", ["ai", "artificial intelligence", "machine learning", "deep learning", "neural"]),
            ("science", ["research", "study", "scientific", "academic", "paper"]),
            ("news", ["news", "recent", "latest", "current", "update"]),
            ("analysis", ["analyze", "sentiment", "trend", "pattern", "data"]),
            ("technical", ["how", "technical", "implement", "code", "algorithm"])
        ]
        
        for domain, keywords in domains:
            if any(kw in query_lower for kw in keywords):
                features["keywords"].append(domain)
        
        return features
    
    def _classify_query_type(self, query: str) -> str:
        """Classify query into type categories."""
        if any(word in query for word in ["what", "explain", "define"]):
            return "explanation"
        elif any(word in query for word in ["how", "implement", "create"]):
            return "how-to"
        elif any(word in query for word in ["analyze", "sentiment", "trend"]):
            return "analysis"
        elif any(word in query for word in ["research", "find", "papers"]):
            return "research"
        else:
            return "general"
    
    def get_similar_successful_patterns(self, query: str, limit: int = 5) -> List[Dict[str, Any]]:
        """Retrieve similar successful patterns for learning."""
        try:
            patterns_dir = os.path.join(self.logs_dir, "patterns")
            if not os.path.exists(patterns_dir):
                return []
            
            query_features = self._extract_query_features(query)
            patterns = []
            
            # Load all patterns
            for pattern_file in os.listdir(patterns_dir):
                if pattern_file.endswith('.json'):
                    with open(os.path.join(patterns_dir, pattern_file), 'r') as f:
                        pattern = json.load(f)
                        # Calculate similarity
                        similarity = self._calculate_pattern_similarity(query_features, pattern.get("query_features", {}))
                        pattern["similarity"] = similarity
                        patterns.append(pattern)
            
            # Sort by similarity and return top matches
            patterns.sort(key=lambda x: x.get("similarity", 0), reverse=True)
            return patterns[:limit]
            
        except Exception as e:
            self.logger.warning(f"Failed to retrieve patterns: {e}")
            return []
    
    def _calculate_pattern_similarity(self, features1: Dict, features2: Dict) -> float:
        """Calculate similarity between two query feature sets."""
        score = 0.0
        
        # Type match (40%)
        if features1.get("type") == features2.get("type"):
            score += 0.4
        
        # Keyword overlap (40%)
        keywords1 = set(features1.get("keywords", []))
        keywords2 = set(features2.get("keywords", []))
        if keywords1 and keywords2:
            overlap = len(keywords1 & keywords2) / len(keywords1 | keywords2)
            score += 0.4 * overlap
        
        # Question type match (20%)
        if features1.get("has_question") == features2.get("has_question"):
            score += 0.2
        
        return score

    def _log_session(self, results: Dict[str, Any]):
        """Log the session results for traceability."""
        try:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            log_file = os.path.join(self.logs_dir, f"session_{timestamp}.json")

            with open(log_file, 'w') as f:
                json.dump(results, f, indent=2, default=str)

            self.logger.info(f"Session logged to: {log_file}")

        except Exception as e:
            self.logger.error(f"Error logging session: {e}")

    def get_execution_summary(self, results: Dict[str, Any]) -> str:
        """Generate a human-readable summary of the execution."""
        summary = "📋 **DualMind Orchestrator Execution Summary**\n\n"

        # Basic info
        summary += f"**Session ID:** {results.get('session_id', 'Unknown')}\n"
        summary += f"**Query:** {results.get('user_query', 'Unknown')}\n"
        summary += f"**Execution Time:** {results.get('execution_time', 0):.2f}s\n"
        summary += f"**Iterations:** {results.get('iterations', 0)}\n"
        summary += f"**Status:** {results.get('status', 'Unknown')}\n\n"

        # Adversarial Loop Summary
        plan_history = results.get('plan_history', [])
        if len(plan_history) > 1:
            summary += "**🔄 Adversarial Loop Evolution:**\n"
            for entry in plan_history[1:]:
                iter_num = entry.get('iteration', 0)
                score = entry.get('score', 0)
                approved = entry.get('approved', False)
                status_icon = "✅" if approved else "❌"
                summary += f"• Iteration {iter_num}: Score {score}/100 {status_icon}\n"
            
            if len(plan_history) > 2:
                first_score = plan_history[1].get('score', 0)
                last_score = plan_history[-1].get('score', 0)
                improvement = last_score - first_score
                if improvement > 0:
                    summary += f"• **Improvement:** +{improvement} points through adversarial refinement\n"
            summary += "\n"
        
        # Self-correction summary
        if results.get('self_correction_used', False):
            summary += "**🔧 Self-Correction Applied:**\n"
            summary += "• System detected execution failures and auto-corrected\n\n"

        # Plan summary
        plan = results.get('plan', {})
        revision_num = plan.get('revision_number', 0)
        summary += "**🎯 Final Plan Overview:**\n"
        summary += f"• Steps: {len(plan.get('pipeline', []))}\n"
        if revision_num > 0:
            summary += f"• Revision: {revision_num} (improved through feedback)\n"
        if plan.get('self_corrected', False):
            summary += f"• Self-corrected: Yes\n"
        summary += f"• Reasoning: {plan.get('reasoning', 'No reasoning')[:100]}...\n\n"

        # Verification summary
        verification = results.get('verification', {})
        score = verification.get('score', 0)
        approval = verification.get('overall_approval', False)
        summary += "**✅ Verification Results:**\n"
        summary += f"• Final Score: {score}/100\n"
        summary += f"• Approved: {'Yes' if approval else 'No'}\n"
        if verification.get('issues'):
            summary += f"• Issues: {len(verification['issues'])}\n"
        if verification.get('suggestions'):
            summary += f"• Suggestions: {len(verification['suggestions'])}\n\n"

        # Execution summary
        execution_results = results.get('execution_results', [])
        success_count = sum(1 for r in execution_results if r.get('status') == 'success')
        summary += "**⚙️ Execution Results:**\n"
        summary += f"• Total Steps: {len(execution_results)}\n"
        summary += f"• Successful: {success_count}\n"
        summary += f"• Failed: {len(execution_results) - success_count}\n\n"

        # Final output
        if execution_results and execution_results[-1].get('status') == 'success':
            final_output = execution_results[-1].get('output', 'No output')
            summary += "**🎉 Final Output:**\n"
            summary += f"{final_output[:200]}{'...' if len(final_output) > 200 else ''}\n"

        return summary


def create_orchestrator() -> Orchestrator:
    """
    Factory function to create an Orchestrator instance.

    Returns:
        Orchestrator: Configured orchestrator instance
    """
    return Orchestrator()