"""SpaCy tokenizer wrapper for form matching (PX-887 Phase 2).

Provides a lazy-loading wrapper around spaCy for tokenization
and linguistic analysis. Supports English and Spanish models.
"""

from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any, Iterator, Optional

import structlog

if TYPE_CHECKING:
    import spacy
    from spacy.language import Language
    from spacy.tokens import Doc as SpacyDoc
    from spacy.tokens import Span as SpacySpan
    from spacy.tokens import Token as SpacyToken


logger = structlog.get_logger()


# Model names for lazy loading
SPACY_MODELS = {
    "en": "en_core_web_sm",
    "es": "es_core_news_sm",
}


@dataclass
class Token:
    """Wrapper for a spaCy token with simplified interface.

    Provides access to common token attributes without
    exposing the full spaCy API.
    """

    text: str
    lemma: str
    pos: str  # Part of speech tag
    tag: str  # Fine-grained POS tag
    dep: str  # Dependency relation
    is_stop: bool
    is_punct: bool
    is_alpha: bool
    is_digit: bool
    idx: int  # Character offset in original text
    whitespace: str  # Trailing whitespace

    # Entity info (if part of an entity)
    ent_type: str = ""
    ent_iob: str = "O"  # B, I, O

    @classmethod
    def from_spacy(cls, token: "SpacyToken") -> "Token":
        """Create Token from spaCy token."""
        return cls(
            text=token.text,
            lemma=token.lemma_,
            pos=token.pos_,
            tag=token.tag_,
            dep=token.dep_,
            is_stop=token.is_stop,
            is_punct=token.is_punct,
            is_alpha=token.is_alpha,
            is_digit=token.is_digit,
            idx=token.idx,
            whitespace=token.whitespace_,
            ent_type=token.ent_type_,
            ent_iob=token.ent_iob_,
        )


@dataclass
class Span:
    """Wrapper for a spaCy span (sequence of tokens).

    Represents a contiguous sequence of tokens, such as
    an entity, noun chunk, or sentence.
    """

    text: str
    start: int  # Token index
    end: int  # Token index (exclusive)
    start_char: int  # Character offset
    end_char: int  # Character offset (exclusive)
    label: str  # Entity label or span type
    tokens: list[Token] = field(default_factory=list)

    @classmethod
    def from_spacy(cls, span: "SpacySpan", include_tokens: bool = True) -> "Span":
        """Create Span from spaCy span."""
        tokens = []
        if include_tokens:
            tokens = [Token.from_spacy(t) for t in span]

        return cls(
            text=span.text,
            start=span.start,
            end=span.end,
            start_char=span.start_char,
            end_char=span.end_char,
            label=span.label_,
            tokens=tokens,
        )


@dataclass
class Doc:
    """Wrapper for a spaCy Doc with simplified interface.

    Provides access to document-level features without
    exposing the full spaCy API.
    """

    text: str
    tokens: list[Token] = field(default_factory=list)
    entities: list[Span] = field(default_factory=list)
    sentences: list[Span] = field(default_factory=list)
    noun_chunks: list[Span] = field(default_factory=list)

    # Cached spacy doc for advanced operations
    _spacy_doc: Optional[Any] = field(default=None, repr=False)

    def __iter__(self) -> Iterator[Token]:
        """Iterate over tokens."""
        return iter(self.tokens)

    def __len__(self) -> int:
        """Number of tokens."""
        return len(self.tokens)

    def __getitem__(self, idx: int) -> Token:
        """Get token by index."""
        return self.tokens[idx]

    @classmethod
    def from_spacy(cls, doc: "SpacyDoc") -> "Doc":
        """Create Doc from spaCy doc."""
        tokens = [Token.from_spacy(t) for t in doc]

        entities = [Span.from_spacy(ent, include_tokens=False) for ent in doc.ents]

        sentences = []
        try:
            sentences = [Span.from_spacy(sent, include_tokens=False) for sent in doc.sents]
        except ValueError:
            # Model may not have sentence boundaries
            pass

        noun_chunks = []
        try:
            noun_chunks = [Span.from_spacy(chunk, include_tokens=False) for chunk in doc.noun_chunks]
        except ValueError:
            # Model may not support noun chunks
            pass

        return cls(
            text=doc.text,
            tokens=tokens,
            entities=entities,
            sentences=sentences,
            noun_chunks=noun_chunks,
            _spacy_doc=doc,
        )

    def get_lemmas(self) -> list[str]:
        """Get list of lemmas for all tokens."""
        return [t.lemma for t in self.tokens]

    def get_content_words(self) -> list[Token]:
        """Get non-stop, alphabetic tokens."""
        return [t for t in self.tokens if t.is_alpha and not t.is_stop]

    def get_entities_by_type(self, ent_type: str) -> list[Span]:
        """Get entities of a specific type."""
        return [e for e in self.entities if e.label == ent_type]


class SpaCyTokenizer:
    """Lazy-loading spaCy tokenizer supporting English and Spanish.

    Models are loaded on first use and cached for reuse.
    If spaCy or the required model is not installed, methods
    return None or empty results gracefully.
    """

    def __init__(self):
        """Initialize the tokenizer.

        Models are not loaded until first use.
        """
        self._models: dict[str, "Language"] = {}
        self._spacy_available: Optional[bool] = None

    @property
    def spacy_available(self) -> bool:
        """Check if spaCy is available."""
        if self._spacy_available is None:
            try:
                import spacy  # noqa: F401

                self._spacy_available = True
            except ImportError:
                self._spacy_available = False
                logger.warning(
                    "spaCy not installed - NLP features disabled",
                    hint="Install with: pip install spacy",
                )

        return self._spacy_available

    def _load_model(self, lang: str) -> Optional["Language"]:
        """Load a spaCy model for the given language.

        Args:
            lang: Language code ("en" or "es")

        Returns:
            Loaded spaCy Language model, or None if unavailable
        """
        if not self.spacy_available:
            return None

        if lang in self._models:
            return self._models[lang]

        model_name = SPACY_MODELS.get(lang)
        if not model_name:
            logger.warning(
                "Unsupported language for spaCy",
                language=lang,
                supported=list(SPACY_MODELS.keys()),
            )
            return None

        try:
            import spacy

            nlp = spacy.load(model_name)
            self._models[lang] = nlp

            logger.info(
                "Loaded spaCy model",
                model=model_name,
                language=lang,
            )

            return nlp

        except OSError as e:
            logger.warning(
                "spaCy model not installed",
                model=model_name,
                language=lang,
                error=str(e),
                hint=f"Install with: python -m spacy download {model_name}",
            )
            return None

    def tokenize(self, text: str, lang: str = "en") -> Optional[Doc]:
        """Tokenize text using spaCy.

        Args:
            text: Text to tokenize
            lang: Language code ("en" or "es")

        Returns:
            Doc wrapper with tokens and entities, or None if unavailable
        """
        if not text:
            return Doc(text="", tokens=[], entities=[])

        nlp = self._load_model(lang)
        if nlp is None:
            return None

        try:
            spacy_doc = nlp(text)
            return Doc.from_spacy(spacy_doc)

        except Exception as e:
            logger.error(
                "Error tokenizing text",
                error=str(e),
                language=lang,
                text_length=len(text),
            )
            return None

    def tokenize_batch(
        self,
        texts: list[str],
        lang: str = "en",
        batch_size: int = 50,
    ) -> list[Optional[Doc]]:
        """Tokenize multiple texts efficiently.

        Uses spaCy's pipe() for batch processing.

        Args:
            texts: Texts to tokenize
            lang: Language code
            batch_size: Batch size for processing

        Returns:
            List of Doc wrappers (None for failed tokenizations)
        """
        if not texts:
            return []

        nlp = self._load_model(lang)
        if nlp is None:
            return [None] * len(texts)

        try:
            docs = []
            for spacy_doc in nlp.pipe(texts, batch_size=batch_size):
                docs.append(Doc.from_spacy(spacy_doc))
            return docs

        except Exception as e:
            logger.error(
                "Error batch tokenizing",
                error=str(e),
                language=lang,
                text_count=len(texts),
            )
            return [None] * len(texts)

    def get_lemmas(self, text: str, lang: str = "en") -> list[str]:
        """Get lemmas for all tokens in text.

        Args:
            text: Text to lemmatize
            lang: Language code

        Returns:
            List of lemmas, or empty list if unavailable
        """
        doc = self.tokenize(text, lang)
        if doc is None:
            return []

        return doc.get_lemmas()

    def get_entities(self, text: str, lang: str = "en") -> list[Span]:
        """Get named entities from text.

        Args:
            text: Text to analyze
            lang: Language code

        Returns:
            List of entity Spans, or empty list if unavailable
        """
        doc = self.tokenize(text, lang)
        if doc is None:
            return []

        return doc.entities

    def get_sentences(self, text: str, lang: str = "en") -> list[str]:
        """Split text into sentences.

        Args:
            text: Text to split
            lang: Language code

        Returns:
            List of sentence strings
        """
        doc = self.tokenize(text, lang)
        if doc is None:
            # Fallback to simple splitting
            return [s.strip() for s in text.split(".") if s.strip()]

        return [sent.text for sent in doc.sentences]

    def is_model_loaded(self, lang: str) -> bool:
        """Check if a model is currently loaded.

        Args:
            lang: Language code

        Returns:
            True if model is loaded
        """
        return lang in self._models

    def unload_model(self, lang: str) -> bool:
        """Unload a model to free memory.

        Args:
            lang: Language code

        Returns:
            True if model was unloaded
        """
        if lang in self._models:
            del self._models[lang]
            logger.info("Unloaded spaCy model", language=lang)
            return True
        return False

    def unload_all(self) -> None:
        """Unload all models to free memory."""
        languages = list(self._models.keys())
        self._models.clear()
        logger.info("Unloaded all spaCy models", languages=languages)
