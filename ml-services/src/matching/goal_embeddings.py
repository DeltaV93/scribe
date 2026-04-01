"""Goal embedding service for semantic deduplication (Goal Deduplication Feature).

Provides semantic similarity computation using sentence-transformers for:
- Matching mentioned goals in calls to existing goals
- Finding similar goals to prevent duplicates
- Batch embedding generation for backfill
"""

import time
from dataclasses import dataclass
from typing import Optional

import structlog

from src.matching.nlp.embeddings import EmbeddingModel, DEFAULT_EMBEDDING_MODEL

logger = structlog.get_logger()


@dataclass
class GoalEmbeddingResult:
    """Result of goal embedding computation."""

    embedding: list[float]
    model_name: str
    dimension: int
    processing_time_ms: float


@dataclass
class GoalSimilarityMatch:
    """A similar goal match."""

    goal_id: str
    goal_name: str
    similarity: float


@dataclass
class BatchEmbeddingResult:
    """Result of batch embedding generation."""

    results: list[dict]  # [{id, embedding, success, error}]
    processed: int
    failed: int
    processing_time_ms: float


class GoalEmbeddingService:
    """Service for generating and comparing goal embeddings.

    Uses sentence-transformers for computing dense vector embeddings.
    The all-MiniLM-L6-v2 model produces 384-dimensional vectors that
    capture semantic similarity well for short text like goal names.
    """

    def __init__(self, model_name: str = DEFAULT_EMBEDDING_MODEL):
        """Initialize the goal embedding service.

        Args:
            model_name: Name of sentence-transformers model to use.
                       Default is all-MiniLM-L6-v2 (fast, 384 dims).
        """
        self.embedding_model = EmbeddingModel(model_name=model_name, cache_size=2000)
        self.model_name = model_name

    def generate_goal_embedding(
        self,
        name: str,
        description: Optional[str] = None,
    ) -> Optional[GoalEmbeddingResult]:
        """Generate embedding for a goal from name + description.

        Combines name and description into a single text for embedding.
        The name is weighted more heavily by appearing first.

        Args:
            name: Goal name (required)
            description: Optional goal description for richer context

        Returns:
            GoalEmbeddingResult with embedding vector, or None if failed
        """
        if not name:
            return None

        # Combine name and description, name first for emphasis
        text = name
        if description:
            # Truncate very long descriptions
            desc = description[:500] if len(description) > 500 else description
            text = f"{name}. {desc}"

        start_time = time.perf_counter()
        result = self.embedding_model.embed(text)
        elapsed_ms = (time.perf_counter() - start_time) * 1000

        if result is None:
            logger.warning(
                "Failed to generate goal embedding",
                name=name[:50],
                description_len=len(description) if description else 0,
            )
            return None

        return GoalEmbeddingResult(
            embedding=result.embedding,
            model_name=result.model_name,
            dimension=len(result.embedding),
            processing_time_ms=elapsed_ms,
        )

    def find_similar_goals(
        self,
        query_text: str,
        goal_candidates: list[dict],  # [{id, name, description?, embedding}]
        threshold: float = 0.5,
        top_k: int = 5,
    ) -> list[GoalSimilarityMatch]:
        """Find similar goals using cosine similarity.

        Compares query text against pre-computed goal embeddings.

        Args:
            query_text: Text to find similar goals for (e.g., extracted mention)
            goal_candidates: List of goals with their embeddings
            threshold: Minimum similarity score (0-1) to include in results
            top_k: Maximum number of results to return

        Returns:
            List of GoalSimilarityMatch sorted by similarity descending
        """
        if not query_text or not goal_candidates:
            return []

        # Get query embedding
        query_result = self.embedding_model.embed(query_text)
        if query_result is None:
            logger.warning("Failed to embed query text", text_len=len(query_text))
            return []

        import numpy as np

        query_vec = np.array(query_result.embedding)
        query_norm = np.linalg.norm(query_vec)

        if query_norm == 0:
            return []

        matches: list[GoalSimilarityMatch] = []

        for goal in goal_candidates:
            embedding = goal.get("embedding")
            if not embedding:
                continue

            # Compute cosine similarity
            goal_vec = np.array(embedding)
            goal_norm = np.linalg.norm(goal_vec)

            if goal_norm == 0:
                continue

            similarity = float(np.dot(query_vec, goal_vec) / (query_norm * goal_norm))

            if similarity >= threshold:
                matches.append(
                    GoalSimilarityMatch(
                        goal_id=goal["id"],
                        goal_name=goal.get("name", ""),
                        similarity=similarity,
                    )
                )

        # Sort by similarity descending and limit
        matches.sort(key=lambda x: x.similarity, reverse=True)
        return matches[:top_k]

    def batch_generate_embeddings(
        self,
        goals: list[dict],  # [{id, name, description?}]
    ) -> BatchEmbeddingResult:
        """Batch generate embeddings for multiple goals.

        Efficient for backfilling embeddings for existing goals.

        Args:
            goals: List of goals with id, name, and optional description

        Returns:
            BatchEmbeddingResult with embedding for each goal
        """
        if not goals:
            return BatchEmbeddingResult(
                results=[],
                processed=0,
                failed=0,
                processing_time_ms=0,
            )

        start_time = time.perf_counter()

        # Prepare texts
        texts = []
        for goal in goals:
            name = goal.get("name", "")
            description = goal.get("description")
            if description:
                desc = description[:500] if len(description) > 500 else description
                texts.append(f"{name}. {desc}")
            else:
                texts.append(name)

        # Batch embed
        embedding_results = self.embedding_model.embed_batch(texts)

        # Build results
        results = []
        failed = 0

        for goal, emb_result in zip(goals, embedding_results):
            if emb_result is not None:
                results.append(
                    {
                        "id": goal["id"],
                        "embedding": emb_result.embedding,
                        "success": True,
                    }
                )
            else:
                results.append(
                    {
                        "id": goal["id"],
                        "embedding": None,
                        "success": False,
                        "error": "Failed to generate embedding",
                    }
                )
                failed += 1

        elapsed_ms = (time.perf_counter() - start_time) * 1000

        logger.info(
            "Batch generated goal embeddings",
            total=len(goals),
            success=len(goals) - failed,
            failed=failed,
            time_ms=elapsed_ms,
        )

        return BatchEmbeddingResult(
            results=results,
            processed=len(goals) - failed,
            failed=failed,
            processing_time_ms=elapsed_ms,
        )


# Singleton instance for dependency injection
_goal_embedding_service: Optional[GoalEmbeddingService] = None


def get_goal_embedding_service() -> GoalEmbeddingService:
    """Get singleton goal embedding service instance."""
    global _goal_embedding_service
    if _goal_embedding_service is None:
        _goal_embedding_service = GoalEmbeddingService()
    return _goal_embedding_service
