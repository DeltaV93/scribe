"""
Taxonomy Pattern Matching using TF-IDF.
PX-878: Tiered Content Classifier

Matches text against predefined patterns for sensitivity classification.
"""

import re
import logging
from typing import Optional

from app.schemas.sensitivity import SensitivityTier, TaxonomySignal


logger = logging.getLogger(__name__)


# Taxonomy patterns organized by category and tier
TAXONOMY_PATTERNS = {
    # REDACTED patterns (personal/off-topic content)
    "personal_struggles": {
        "tier": SensitivityTier.REDACTED,
        "patterns": [
            r"marriage.*falling|divorce|divorcing|separated",
            r"(my|our)\s+(relationship|marriage)\s+(is|has been|was)",
            r"financial.*trouble|bankruptcy|foreclosure|eviction",
            r"mental.*health|depression|anxiety|therapy|therapist",
            r"(so|really|very)\s+(stressed|overwhelmed|exhausted|burned out)",
            r"can't (sleep|eat|focus|concentrate)",
            r"(my|our) (kids|children|family) (are|is|have been)",
        ],
    },
    "gossip": {
        "tier": SensitivityTier.REDACTED,
        "patterns": [
            r"did you hear about",
            r"between you and me",
            r"don't tell anyone",
            r"off the record",
            r"just between us",
            r"I heard that.*boss|manager|coworker",
            r"(he|she|they) (said|told me).*about (him|her|them)",
        ],
    },
    "off_topic": {
        "tier": SensitivityTier.REDACTED,
        "patterns": [
            r"(this|last) weekend",
            r"(favorite|good) (show|movie|restaurant|place)",
            r"(sports?|game|match|score|team).*(\?|!|yesterday|last night)",
            r"(weather|rain|snow|sunny|cold|hot) (today|this week|lately)",
            r"(holiday|vacation|trip) (plans?|coming up)",
            r"(birthday|party|celebration|anniversary)",
        ],
    },

    # RESTRICTED patterns (sensitive business content)
    "hr_sensitive": {
        "tier": SensitivityTier.RESTRICTED,
        "patterns": [
            r"terminat(ion|ed|ing)|fired|let go",
            r"performance.*improvement|PIP",
            r"(salary|compensation|raise|bonus|pay)",
            r"harass(ment|ed|ing)|discriminat(ion|ed)",
            r"(formal\s+)?complaint|grievance",
            r"(disciplinary|corrective)\s+action",
            r"(promoted|promotion|demot(ed|ion))",
            r"(hiring|firing)\s+(decision|process)",
        ],
    },
    "legal": {
        "tier": SensitivityTier.RESTRICTED,
        "patterns": [
            r"lawsuit|litigation|legal action|sue|suing",
            r"settlement|mediation|arbitration",
            r"compliance.*violation|regulatory",
            r"(legal|attorney|lawyer)\s+(advised?|review|opinion)",
            r"(contract|agreement)\s+(breach|violation|dispute)",
            r"(confidential|privileged)\s+(information|document)",
        ],
    },
    "strategic": {
        "tier": SensitivityTier.RESTRICTED,
        "patterns": [
            r"merger|acquisition|M&A|buyout",
            r"layoff|restructur(ing|e)|downsiz(ing|e)",
            r"confidential.*project|secret.*initiative",
            r"(board|executive)\s+(meeting|decision)",
            r"(funding|investment)\s+(round|decision)",
            r"(company|org(anization)?)\s+(strategy|direction)",
        ],
    },
    "health": {
        "tier": SensitivityTier.RESTRICTED,
        "patterns": [
            r"(patient|client)\s+(diagnosis|condition|treatment)",
            r"(medical|health)\s+(record|history|information)",
            r"HIPAA|PHI|protected\s+health",
            r"(prescription|medication|drug)\s+(history|use)",
            r"(mental|physical)\s+health\s+(status|condition|issue)",
        ],
    },
    "financial": {
        "tier": SensitivityTier.RESTRICTED,
        "patterns": [
            r"(revenue|profit|loss|earnings)\s+(report|numbers|figures)",
            r"(budget|spending|cost)\s+(cut|reduction|overrun)",
            r"(financial|fiscal)\s+(projection|forecast|results)",
            r"(investor|shareholder)\s+(information|relations)",
            r"(audit|accounting)\s+(issue|finding|concern)",
        ],
    },
}


class TaxonomyMatcher:
    """
    Match text against taxonomy patterns.
    """

    def __init__(self):
        # Compile all patterns for efficiency
        self.compiled_patterns = {}
        for category, config in TAXONOMY_PATTERNS.items():
            self.compiled_patterns[category] = {
                "tier": config["tier"],
                "patterns": [
                    re.compile(p, re.IGNORECASE)
                    for p in config["patterns"]
                ],
            }
        logger.info(f"Taxonomy matcher loaded with {len(self.compiled_patterns)} categories")

    def match(self, text: str) -> list[TaxonomySignal]:
        """
        Match text against all taxonomy patterns.

        Args:
            text: Input text

        Returns:
            List of TaxonomySignal objects for all matches
        """
        matches = []

        for category, config in self.compiled_patterns.items():
            for pattern in config["patterns"]:
                match = pattern.search(text)
                if match:
                    # Calculate score based on match quality
                    score = self._calculate_score(text, match)

                    matches.append(TaxonomySignal(
                        pattern=pattern.pattern,
                        category=category,
                        tier=config["tier"],
                        score=score,
                    ))

        # Sort by score descending
        matches.sort(key=lambda x: x.score, reverse=True)

        return matches

    def _calculate_score(self, text: str, match: re.Match) -> float:
        """
        Calculate match score based on:
        - Match length relative to text
        - Position in text (earlier = higher)
        - Match type (exact phrase vs partial)
        """
        # Base score
        score = 0.7

        # Boost for longer matches
        match_length = match.end() - match.start()
        text_length = len(text)
        length_ratio = match_length / text_length if text_length > 0 else 0
        score += min(length_ratio * 0.2, 0.15)

        # Boost for matches at start of text
        position_ratio = match.start() / text_length if text_length > 0 else 0
        if position_ratio < 0.2:
            score += 0.1
        elif position_ratio < 0.5:
            score += 0.05

        # Cap at 0.95
        return min(score, 0.95)
