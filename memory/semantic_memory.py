"""
DualMind AI OS — Semantic Memory Engine
Persistent vector-based memory using ChromaDB with NVIDIA embeddings.

This is NOT passive storage — memory actively influences orchestration:
- Past interactions are recalled and injected into planning context
- Cross-session continuity enables "continue previous analysis"
- Entity relationships are tracked for knowledge graph queries
- Memory decay ensures recent context is weighted higher
"""

import os
import json
import time
import logging
import hashlib
from datetime import datetime
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass, field, asdict

logger = logging.getLogger(__name__)

# ── Memory Entry Schema ─────────────────────────────────────────────────

@dataclass
class MemoryEntry:
    """A single memory record stored in the vector database."""
    id: str
    content: str
    query: str
    response_summary: str
    session_id: str
    conversation_id: str
    timestamp: float
    intent: str = ""
    tools_used: List[str] = field(default_factory=list)
    confidence: float = 0.0
    artifact_ids: List[str] = field(default_factory=list)
    entities: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class MemoryRecall:
    """A recalled memory with relevance score."""
    entry: MemoryEntry
    similarity: float
    decay_adjusted_score: float

    def to_context_string(self) -> str:
        """Format memory for injection into LLM context."""
        age_hours = (time.time() - self.entry.timestamp) / 3600
        age_str = f"{age_hours:.0f}h ago" if age_hours < 48 else f"{age_hours/24:.0f}d ago"
        return (
            f"[RECALLED MEMORY — {age_str}, relevance: {self.decay_adjusted_score:.2f}]\n"
            f"Query: {self.entry.query}\n"
            f"Summary: {self.entry.response_summary}\n"
            f"Tools: {', '.join(self.entry.tools_used)}\n"
            f"Intent: {self.entry.intent}"
        )


class SemanticMemoryEngine:
    """
    Persistent semantic memory with vector search and knowledge tracking.

    Uses ChromaDB for vector storage and NVIDIA embeddings for semantic similarity.
    Memory actively influences orchestration by providing cross-session context.
    """

    COLLECTION_NAME = "dualmind_memory"
    MEMORY_DIR = "memory_store"

    def __init__(self):
        self._chroma_client = None
        self._collection = None
        self._router = None
        self._initialized = False
        self._entity_graph: Dict[str, List[str]] = {}
        self._init_storage()

    def _init_storage(self):
        """Initialize ChromaDB with file-backed persistence."""
        try:
            import chromadb
            from chromadb.config import Settings

            persist_dir = os.path.join(os.getcwd(), self.MEMORY_DIR)
            os.makedirs(persist_dir, exist_ok=True)

            self._chroma_client = chromadb.Client(Settings(
                chroma_db_impl="duckdb+parquet",
                persist_directory=persist_dir,
                anonymized_telemetry=False,
            ))

            self._collection = self._chroma_client.get_or_create_collection(
                name=self.COLLECTION_NAME,
                metadata={"hnsw:space": "cosine"},
            )

            # Load entity graph
            graph_path = os.path.join(persist_dir, "entity_graph.json")
            if os.path.exists(graph_path):
                with open(graph_path, "r") as f:
                    self._entity_graph = json.load(f)

            self._initialized = True
            count = self._collection.count()
            logger.info(f"SemanticMemoryEngine initialized — {count} memories loaded")

        except ImportError:
            logger.warning("chromadb not installed — using in-memory fallback")
            self._init_fallback()
        except Exception as e:
            logger.warning(f"ChromaDB init failed ({e}) — using in-memory fallback")
            self._init_fallback()

    def _init_fallback(self):
        """In-memory fallback when ChromaDB is unavailable."""
        self._memories: List[Dict[str, Any]] = []
        self._initialized = True
        logger.info("SemanticMemoryEngine initialized (in-memory fallback)")

    def _get_router(self):
        """Lazy-load the model router."""
        if self._router is None:
            from model_router import get_router
            self._router = get_router()
        return self._router

    # ── Core Operations ──────────────────────────────────────────────

    def store(
        self,
        query: str,
        response_summary: str,
        session_id: str = "",
        conversation_id: str = "",
        intent: str = "",
        tools_used: Optional[List[str]] = None,
        confidence: float = 0.0,
        artifact_ids: Optional[List[str]] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> str:
        """
        Store a new interaction in semantic memory.

        Returns:
            The memory entry ID
        """
        entry_id = f"mem_{hashlib.md5(f'{query}{time.time()}'.encode()).hexdigest()[:12]}"
        timestamp = time.time()

        # Extract entities from query and response
        entities = self._extract_entities(query, response_summary)

        entry = MemoryEntry(
            id=entry_id,
            content=f"{query}\n\n{response_summary}",
            query=query,
            response_summary=response_summary[:500],
            session_id=session_id,
            conversation_id=conversation_id,
            timestamp=timestamp,
            intent=intent,
            tools_used=tools_used or [],
            confidence=confidence,
            artifact_ids=artifact_ids or [],
            entities=entities,
            metadata=metadata or {},
        )

        try:
            if self._collection is not None:
                # Generate embeddings
                router = self._get_router()
                embeddings = router.embed([entry.content])

                self._collection.add(
                    ids=[entry_id],
                    embeddings=embeddings,
                    documents=[entry.content],
                    metadatas=[{
                        "query": query[:200],
                        "response_summary": response_summary[:200],
                        "session_id": session_id,
                        "conversation_id": conversation_id,
                        "timestamp": str(timestamp),
                        "intent": intent,
                        "tools_used": json.dumps(tools_used or []),
                        "confidence": str(confidence),
                        "entities": json.dumps(entities),
                    }],
                )

                # Persist
                self._chroma_client.persist()
            else:
                # Fallback storage
                self._memories.append(entry.to_dict())

            # Update entity graph
            self._update_entity_graph(entities, entry_id)

            logger.info(f"Stored memory {entry_id}: {query[:60]}...")
            return entry_id

        except Exception as e:
            logger.error(f"Failed to store memory: {e}")
            return entry_id

    def recall(
        self,
        query: str,
        top_k: int = 5,
        conversation_id: Optional[str] = None,
        min_similarity: float = 0.3,
    ) -> List[MemoryRecall]:
        """
        Recall relevant memories using semantic similarity.

        Memory decay is applied: recent memories are weighted higher.

        Args:
            query: The query to search for
            top_k: Maximum number of memories to return
            conversation_id: Optional filter by conversation
            min_similarity: Minimum similarity threshold

        Returns:
            List of MemoryRecall objects sorted by decay-adjusted score
        """
        try:
            if self._collection is not None and self._collection.count() > 0:
                router = self._get_router()
                query_embedding = router.embed([query])

                where_filter = None
                if conversation_id:
                    where_filter = {"conversation_id": conversation_id}

                results = self._collection.query(
                    query_embeddings=query_embedding,
                    n_results=min(top_k * 2, self._collection.count()),
                    where=where_filter,
                    include=["documents", "metadatas", "distances"],
                )

                recalls = []
                if results and results["ids"] and results["ids"][0]:
                    for i, doc_id in enumerate(results["ids"][0]):
                        meta = results["metadatas"][0][i] if results["metadatas"] else {}
                        distance = results["distances"][0][i] if results["distances"] else 1.0

                        # Convert cosine distance to similarity
                        similarity = 1.0 - distance

                        if similarity < min_similarity:
                            continue

                        # Apply memory decay
                        timestamp = float(meta.get("timestamp", "0"))
                        decay_score = self._apply_decay(similarity, timestamp)

                        entry = MemoryEntry(
                            id=doc_id,
                            content=results["documents"][0][i] if results["documents"] else "",
                            query=meta.get("query", ""),
                            response_summary=meta.get("response_summary", ""),
                            session_id=meta.get("session_id", ""),
                            conversation_id=meta.get("conversation_id", ""),
                            timestamp=timestamp,
                            intent=meta.get("intent", ""),
                            tools_used=json.loads(meta.get("tools_used", "[]")),
                            confidence=float(meta.get("confidence", "0")),
                            entities=json.loads(meta.get("entities", "[]")),
                        )

                        recalls.append(MemoryRecall(
                            entry=entry,
                            similarity=similarity,
                            decay_adjusted_score=decay_score,
                        ))

                # Sort by decay-adjusted score
                recalls.sort(key=lambda r: r.decay_adjusted_score, reverse=True)
                return recalls[:top_k]

            elif hasattr(self, '_memories') and self._memories:
                # Fallback: simple keyword matching
                return self._fallback_recall(query, top_k)

            return []

        except Exception as e:
            logger.error(f"Memory recall failed: {e}")
            return []

    def get_session_context(self, conversation_id: str, limit: int = 10) -> List[MemoryRecall]:
        """Get all memories from a specific conversation/session."""
        try:
            if self._collection is not None and self._collection.count() > 0:
                results = self._collection.get(
                    where={"conversation_id": conversation_id},
                    include=["documents", "metadatas"],
                    limit=limit,
                )

                recalls = []
                if results and results["ids"]:
                    for i, doc_id in enumerate(results["ids"]):
                        meta = results["metadatas"][i] if results["metadatas"] else {}
                        timestamp = float(meta.get("timestamp", "0"))

                        entry = MemoryEntry(
                            id=doc_id,
                            content=results["documents"][i] if results["documents"] else "",
                            query=meta.get("query", ""),
                            response_summary=meta.get("response_summary", ""),
                            session_id=meta.get("session_id", ""),
                            conversation_id=conversation_id,
                            timestamp=timestamp,
                            intent=meta.get("intent", ""),
                            tools_used=json.loads(meta.get("tools_used", "[]")),
                        )

                        recalls.append(MemoryRecall(
                            entry=entry,
                            similarity=1.0,
                            decay_adjusted_score=1.0,
                        ))

                recalls.sort(key=lambda r: r.entry.timestamp, reverse=True)
                return recalls[:limit]

            return []

        except Exception as e:
            logger.error(f"Session context retrieval failed: {e}")
            return []

    def build_context_prompt(self, query: str, conversation_id: str = "") -> str:
        """
        Build a memory context string to inject into planning/synthesis prompts.

        This is the KEY method that makes memory ACTIVE in orchestration.
        """
        parts = []

        # 1. Recall semantically similar past interactions
        recalls = self.recall(query, top_k=3)
        if recalls:
            parts.append("## 🧠 RECALLED MEMORIES (Cross-Session Context)")
            for r in recalls:
                parts.append(r.to_context_string())
            parts.append("")

        # 2. Get recent conversation context
        if conversation_id:
            session_memories = self.get_session_context(conversation_id, limit=3)
            if session_memories:
                parts.append("## 📋 CURRENT SESSION CONTEXT")
                for m in session_memories:
                    parts.append(f"- Previous query: {m.entry.query}")
                    parts.append(f"  Result: {m.entry.response_summary[:200]}")
                parts.append("")

        # 3. Related entities
        entities = self._extract_entities(query, "")
        related = self._get_related_entities(entities)
        if related:
            parts.append("## 🔗 RELATED KNOWLEDGE")
            for entity, connections in related.items():
                parts.append(f"- {entity} → connected to: {', '.join(connections[:5])}")
            parts.append("")

        return "\n".join(parts) if parts else ""

    def get_memory_count(self) -> int:
        """Return total number of stored memories."""
        if self._collection is not None:
            return self._collection.count()
        return len(getattr(self, '_memories', []))

    # ── Internal Utilities ───────────────────────────────────────────

    def _apply_decay(self, similarity: float, timestamp: float) -> float:
        """Apply temporal decay to similarity score. Recent memories score higher."""
        if timestamp <= 0:
            return similarity * 0.5

        age_hours = (time.time() - timestamp) / 3600
        # Half-life of 72 hours (3 days)
        decay_factor = 0.5 ** (age_hours / 72)
        # Blend: 70% semantic similarity + 30% recency
        return similarity * 0.7 + decay_factor * 0.3

    def _extract_entities(self, query: str, response: str) -> List[str]:
        """Extract key entities from text using simple NLP."""
        text = f"{query} {response}".lower()
        # Extract capitalized words as potential entities
        import re
        words = re.findall(r'\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b', f"{query} {response}")
        # Deduplicate and filter short words
        entities = list(set(w.strip() for w in words if len(w) > 2))
        return entities[:20]

    def _update_entity_graph(self, entities: List[str], memory_id: str):
        """Update the entity relationship graph."""
        for entity in entities:
            if entity not in self._entity_graph:
                self._entity_graph[entity] = []
            # Connect to other entities in the same memory
            for other in entities:
                if other != entity and other not in self._entity_graph[entity]:
                    self._entity_graph[entity].append(other)

        # Persist graph
        try:
            persist_dir = os.path.join(os.getcwd(), self.MEMORY_DIR)
            graph_path = os.path.join(persist_dir, "entity_graph.json")
            os.makedirs(persist_dir, exist_ok=True)
            with open(graph_path, "w") as f:
                json.dump(self._entity_graph, f)
        except Exception:
            pass

    def _get_related_entities(self, entities: List[str]) -> Dict[str, List[str]]:
        """Find entities related to the given ones in the knowledge graph."""
        related = {}
        for entity in entities:
            if entity in self._entity_graph:
                related[entity] = self._entity_graph[entity]
        return related

    def _fallback_recall(self, query: str, top_k: int) -> List[MemoryRecall]:
        """Simple keyword-based recall for when ChromaDB is unavailable."""
        query_words = set(query.lower().split())
        scored = []

        for mem in self._memories:
            content_words = set(mem.get("content", "").lower().split())
            overlap = len(query_words & content_words)
            if overlap > 0:
                similarity = overlap / max(len(query_words), 1)
                entry = MemoryEntry(**{k: mem.get(k, "") for k in MemoryEntry.__dataclass_fields__})
                scored.append(MemoryRecall(
                    entry=entry,
                    similarity=similarity,
                    decay_adjusted_score=self._apply_decay(similarity, mem.get("timestamp", 0)),
                ))

        scored.sort(key=lambda r: r.decay_adjusted_score, reverse=True)
        return scored[:top_k]


# ── Global Singleton ────────────────────────────────────────────────────

_memory_instance: Optional[SemanticMemoryEngine] = None


def get_memory() -> SemanticMemoryEngine:
    """Get the global SemanticMemoryEngine singleton."""
    global _memory_instance
    if _memory_instance is None:
        _memory_instance = SemanticMemoryEngine()
    return _memory_instance
