"""Sentence embeddings for semantic similarity (PX-887 Phase 2).

Provides semantic similarity computation using sentence-transformers.
Used for matching form field descriptions to transcript content.
"""

import hashlib
import time
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any, Optional

import structlog

if TYPE_CHECKING:
    from sentence_transformers import SentenceTransformer


logger = structlog.get_logger()


# Default model for semantic similarity
# all-MiniLM-L6-v2 is fast and effective for similarity tasks
DEFAULT_EMBEDDING_MODEL = "all-MiniLM-L6-v2"


@dataclass
class EmbeddingResult:
    """Result of embedding computation."""

    text: str
    embedding: list[float]
    model_name: str
    processing_time_ms: float


@dataclass
class SimilarityResult:
    """Result of similarity comparison."""

    text1: str
    text2: str
    similarity: float  # Cosine similarity, -1 to 1
    processing_time_ms: float


class EmbeddingModel:
    """Sentence embedding model for semantic similarity.

    Uses sentence-transformers for computing dense vector embeddings.
    Supports caching embeddings for form field descriptions.

    Lazy loading: The model is not loaded until first use.
    If sentence-transformers is not installed, methods return None.
    """

    def __init__(
        self,
        model_name: str = DEFAULT_EMBEDDING_MODEL,
        cache_size: int = 1000,
    ):
        """Initialize the embedding model.

        Args:
            model_name: Name of sentence-transformers model to use
            cache_size: Maximum number of embeddings to cache
        """
        self.model_name = model_name
        self.cache_size = cache_size

        self._model: Optional["SentenceTransformer"] = None
        self._available: Optional[bool] = None
        self._embedding_cache: dict[str, list[float]] = {}
        self._cache_order: list[str] = []

    @property
    def available(self) -> bool:
        """Check if sentence-transformers is available."""
        if self._available is None:
            try:
                from sentence_transformers import SentenceTransformer  # noqa: F401

                self._available = True
            except ImportError:
                self._available = False
                logger.warning(
                    "sentence-transformers not installed - embedding features disabled",
                    hint="Install with: pip install sentence-transformers",
                )

        return self._available

    def _load_model(self) -> Optional["SentenceTransformer"]:
        """Load the sentence-transformers model.

        Returns:
            Loaded model, or None if unavailable
        """
        if not self.available:
            return None

        if self._model is not None:
            return self._model

        try:
            from sentence_transformers import SentenceTransformer

            start_time = time.perf_counter()
            self._model = SentenceTransformer(self.model_name)
            elapsed_ms = (time.perf_counter() - start_time) * 1000

            logger.info(
                "Loaded sentence-transformers model",
                model=self.model_name,
                load_time_ms=elapsed_ms,
            )

            return self._model

        except Exception as e:
            logger.error(
                "Error loading sentence-transformers model",
                model=self.model_name,
                error=str(e),
            )
            self._available = False
            return None

    def _get_cache_key(self, text: str) -> str:
        """Generate cache key for text."""
        return hashlib.sha256(text.encode()).hexdigest()[:16]

    def _get_from_cache(self, text: str) -> Optional[list[float]]:
        """Get embedding from cache if available."""
        key = self._get_cache_key(text)
        return self._embedding_cache.get(key)

    def _add_to_cache(self, text: str, embedding: list[float]) -> None:
        """Add embedding to cache with LRU eviction."""
        key = self._get_cache_key(text)

        if key in self._embedding_cache:
            # Move to end of order
            self._cache_order.remove(key)
            self._cache_order.append(key)
            return

        # Evict oldest if at capacity
        while len(self._embedding_cache) >= self.cache_size and self._cache_order:
            oldest = self._cache_order.pop(0)
            self._embedding_cache.pop(oldest, None)

        self._embedding_cache[key] = embedding
        self._cache_order.append(key)

    def embed(self, text: str, use_cache: bool = True) -> Optional[EmbeddingResult]:
        """Compute embedding for a single text.

        Args:
            text: Text to embed
            use_cache: Whether to use/update cache

        Returns:
            EmbeddingResult, or None if unavailable
        """
        if not text:
            return None

        # Check cache first
        if use_cache:
            cached = self._get_from_cache(text)
            if cached is not None:
                return EmbeddingResult(
                    text=text,
                    embedding=cached,
                    model_name=self.model_name,
                    processing_time_ms=0.0,
                )

        model = self._load_model()
        if model is None:
            return None

        try:
            start_time = time.perf_counter()
            embedding = model.encode(text, convert_to_numpy=True).tolist()
            elapsed_ms = (time.perf_counter() - start_time) * 1000

            # Update cache
            if use_cache:
                self._add_to_cache(text, embedding)

            return EmbeddingResult(
                text=text,
                embedding=embedding,
                model_name=self.model_name,
                processing_time_ms=elapsed_ms,
            )

        except Exception as e:
            logger.error(
                "Error computing embedding",
                error=str(e),
                text_length=len(text),
            )
            return None

    def embed_batch(
        self,
        texts: list[str],
        use_cache: bool = True,
        batch_size: int = 32,
    ) -> list[Optional[EmbeddingResult]]:
        """Compute embeddings for multiple texts.

        Args:
            texts: Texts to embed
            use_cache: Whether to use/update cache
            batch_size: Batch size for processing

        Returns:
            List of EmbeddingResults (None for failures)
        """
        if not texts:
            return []

        model = self._load_model()
        if model is None:
            return [None] * len(texts)

        results: list[Optional[EmbeddingResult]] = [None] * len(texts)
        texts_to_embed: list[tuple[int, str]] = []

        # Check cache first
        for i, text in enumerate(texts):
            if not text:
                continue

            if use_cache:
                cached = self._get_from_cache(text)
                if cached is not None:
                    results[i] = EmbeddingResult(
                        text=text,
                        embedding=cached,
                        model_name=self.model_name,
                        processing_time_ms=0.0,
                    )
                    continue

            texts_to_embed.append((i, text))

        if not texts_to_embed:
            return results

        try:
            start_time = time.perf_counter()

            # Extract just the texts for batch encoding
            texts_only = [t[1] for t in texts_to_embed]
            embeddings = model.encode(
                texts_only,
                convert_to_numpy=True,
                batch_size=batch_size,
            )

            elapsed_ms = (time.perf_counter() - start_time) * 1000
            per_text_ms = elapsed_ms / len(texts_to_embed)

            # Map back to results
            for (idx, text), embedding in zip(texts_to_embed, embeddings):
                emb_list = embedding.tolist()

                if use_cache:
                    self._add_to_cache(text, emb_list)

                results[idx] = EmbeddingResult(
                    text=text,
                    embedding=emb_list,
                    model_name=self.model_name,
                    processing_time_ms=per_text_ms,
                )

            return results

        except Exception as e:
            logger.error(
                "Error batch computing embeddings",
                error=str(e),
                text_count=len(texts_to_embed),
            )
            return [None] * len(texts)

    def compute_similarity(
        self,
        text1: str,
        text2: str,
    ) -> Optional[SimilarityResult]:
        """Compute cosine similarity between two texts.

        Args:
            text1: First text
            text2: Second text

        Returns:
            SimilarityResult with cosine similarity score, or None if unavailable
        """
        if not text1 or not text2:
            return None

        model = self._load_model()
        if model is None:
            return None

        try:
            start_time = time.perf_counter()

            # Get embeddings (using cache)
            emb1_result = self.embed(text1)
            emb2_result = self.embed(text2)

            if emb1_result is None or emb2_result is None:
                return None

            # Compute cosine similarity
            import numpy as np

            emb1 = np.array(emb1_result.embedding)
            emb2 = np.array(emb2_result.embedding)

            # Cosine similarity = dot(a, b) / (norm(a) * norm(b))
            dot_product = np.dot(emb1, emb2)
            norm1 = np.linalg.norm(emb1)
            norm2 = np.linalg.norm(emb2)

            if norm1 == 0 or norm2 == 0:
                similarity = 0.0
            else:
                similarity = float(dot_product / (norm1 * norm2))

            elapsed_ms = (time.perf_counter() - start_time) * 1000

            return SimilarityResult(
                text1=text1,
                text2=text2,
                similarity=similarity,
                processing_time_ms=elapsed_ms,
            )

        except Exception as e:
            logger.error(
                "Error computing similarity",
                error=str(e),
            )
            return None

    def compute_similarity_batch(
        self,
        text: str,
        candidates: list[str],
    ) -> list[tuple[str, float]]:
        """Compute similarity between a text and multiple candidates.

        Args:
            text: Text to compare
            candidates: List of candidate texts

        Returns:
            List of (candidate, similarity) tuples, sorted by similarity descending
        """
        if not text or not candidates:
            return []

        model = self._load_model()
        if model is None:
            return []

        try:
            # Get text embedding
            text_emb = self.embed(text)
            if text_emb is None:
                return []

            # Get candidate embeddings
            candidate_embs = self.embed_batch(candidates)

            import numpy as np

            text_vec = np.array(text_emb.embedding)
            text_norm = np.linalg.norm(text_vec)

            results: list[tuple[str, float]] = []

            for candidate, emb_result in zip(candidates, candidate_embs):
                if emb_result is None:
                    results.append((candidate, 0.0))
                    continue

                cand_vec = np.array(emb_result.embedding)
                cand_norm = np.linalg.norm(cand_vec)

                if text_norm == 0 or cand_norm == 0:
                    similarity = 0.0
                else:
                    similarity = float(np.dot(text_vec, cand_vec) / (text_norm * cand_norm))

                results.append((candidate, similarity))

            # Sort by similarity descending
            results.sort(key=lambda x: x[1], reverse=True)

            return results

        except Exception as e:
            logger.error(
                "Error computing batch similarity",
                error=str(e),
            )
            return []

    def cache_field_descriptions(
        self,
        field_descriptions: list[str],
    ) -> int:
        """Pre-cache embeddings for form field descriptions.

        Call this when loading a form to ensure field embeddings
        are cached for faster matching.

        Args:
            field_descriptions: List of field descriptions to cache

        Returns:
            Number of embeddings cached
        """
        results = self.embed_batch(field_descriptions)
        cached = sum(1 for r in results if r is not None)

        logger.debug(
            "Cached field descriptions",
            total=len(field_descriptions),
            cached=cached,
        )

        return cached

    def clear_cache(self) -> None:
        """Clear the embedding cache."""
        self._embedding_cache.clear()
        self._cache_order.clear()
        logger.debug("Cleared embedding cache")

    @property
    def cache_size_current(self) -> int:
        """Current number of cached embeddings."""
        return len(self._embedding_cache)

    def unload_model(self) -> None:
        """Unload the model to free memory."""
        self._model = None
        logger.info("Unloaded embedding model", model=self.model_name)
