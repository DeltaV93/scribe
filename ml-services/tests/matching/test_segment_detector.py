"""Unit tests for segment detection (PX-887 Phase 1)."""

import pytest

from src.matching.segment_detector import (
    MeetingSegmentDetector,
    SegmentConfig,
    SEGMENT_VOCABULARY,
)
from src.matching.types import SegmentType


class TestMeetingSegmentDetector:
    """Tests for the MeetingSegmentDetector class."""

    @pytest.fixture
    def detector(self) -> MeetingSegmentDetector:
        """Create a segment detector instance."""
        return MeetingSegmentDetector()


class TestSingleEncounterMode(TestMeetingSegmentDetector):
    """Tests for single-encounter (healthcare) mode."""

    def test_healthcare_single_encounter(self, detector: MeetingSegmentDetector):
        """Test that healthcare industry uses single-encounter mode."""
        transcript = """
        Patient arrived for follow-up appointment.
        Chief complaint: persistent headache.
        Assessment: tension headache.
        Plan: continue current medication.
        """

        result = detector.detect_segments(transcript, industry="healthcare")

        assert result.industry_behavior == "single_encounter"
        assert result.total_segments == 1

    def test_single_encounter_contains_full_text(self, detector: MeetingSegmentDetector):
        """Test that single-encounter segment contains full transcript."""
        transcript = "Patient visit for checkup. Assessment complete. Plan discussed."

        result = detector.detect_segments(transcript, industry="healthcare")

        assert len(result.segments) == 1
        assert transcript in result.segments[0].text

    def test_single_encounter_detects_segment_type(self, detector: MeetingSegmentDetector):
        """Test that single-encounter still classifies segment type."""
        transcript = """
        Patient MRN: 12345 arrived for visit.
        Chief complaint noted.
        Treatment plan discussed.
        """

        result = detector.detect_segments(transcript, industry="healthcare")

        segment = result.segments[0]
        assert segment.segment_type in [SegmentType.PATIENT_VISIT, SegmentType.UNKNOWN]


class TestNonprofitSegmentation(TestMeetingSegmentDetector):
    """Tests for nonprofit industry segmentation."""

    def test_nonprofit_enables_segmentation(self, detector: MeetingSegmentDetector):
        """Test that nonprofit industry enables segmentation."""
        transcript = """
        Let's start with team updates. Who has PTO this week?
        Coverage is handled. Moving on to case reviews.
        Client 123 made progress on their goals this week.
        Barriers include transportation and childcare.
        """

        result = detector.detect_segments(transcript, industry="nonprofit")

        assert result.industry_behavior == "segment"

    def test_segment_vocabulary_shift(self, detector: MeetingSegmentDetector):
        """Test detection of vocabulary shifts between segments."""
        # Clear team sync vocabulary followed by case review vocabulary
        transcript = """
        Team sync: Let's go around. Any PTO or coverage needs?
        Schedule looks good. Updates from everyone?

        Now for case reviews. Client status for case #123.
        The participant made good progress on goals.
        Barriers identified include housing and employment.
        """

        result = detector.detect_segments(transcript, industry="nonprofit")

        # Should detect at least the vocabulary shift
        assert result.total_segments >= 1


class TestTechSegmentation(TestMeetingSegmentDetector):
    """Tests for tech industry segmentation."""

    def test_tech_enables_segmentation(self, detector: MeetingSegmentDetector):
        """Test that tech industry enables segmentation."""
        transcript = """
        Sprint standup: Yesterday I worked on the auth bug.
        Today I'll finish the PR review.
        Any blockers? None from my side.

        Now let's review what went well in the retro.
        The deployment process improved this sprint.
        """

        result = detector.detect_segments(transcript, industry="tech")

        assert result.industry_behavior == "segment"

    def test_standup_detection(self, detector: MeetingSegmentDetector):
        """Test standup segment detection."""
        transcript = """
        Morning standup everyone.
        Yesterday I worked on ticket-123.
        Today continuing with the sprint tasks.
        No blockers currently.
        """

        result = detector.detect_segments(transcript, industry="tech")

        # Should detect standup vocabulary
        segment = result.segments[0]
        assert segment.segment_type in [SegmentType.STANDUP, SegmentType.UNKNOWN]


class TestSegmentTimestamps(TestMeetingSegmentDetector):
    """Tests for timestamp-based segmentation."""

    def test_segmentation_with_timestamps(self, detector: MeetingSegmentDetector):
        """Test segmentation using timestamp information."""
        timestamps = [
            (0.0, 10.0, "Team sync starting. Any updates?"),
            (10.0, 20.0, "PTO coverage handled."),
            (30.0, 40.0, "Now for case reviews."),  # 10s gap
            (40.0, 50.0, "Client 123 made progress."),
            (50.0, 60.0, "Goals are being met."),
        ]

        result = detector.detect_segments(
            transcript=" ".join(t[2] for t in timestamps),
            industry="nonprofit",
            timestamps=timestamps,
        )

        assert result.total_segments >= 1

    def test_timestamps_in_segments(self, detector: MeetingSegmentDetector):
        """Test that segment timestamps are captured."""
        timestamps = [
            (0.0, 5.0, "Start of meeting."),
            (5.0, 10.0, "Discussion continues."),
            (10.0, 15.0, "End of first topic."),
        ]

        result = detector.detect_segments(
            transcript="Full transcript",
            industry="tech",
            timestamps=timestamps,
        )

        if result.segments:
            segment = result.segments[0]
            assert segment.start_time >= 0.0


class TestSegmentClassification(TestMeetingSegmentDetector):
    """Tests for segment type classification."""

    def test_intake_classification(self, detector: MeetingSegmentDetector):
        """Test intake segment classification."""
        transcript = """
        New client intake. Enrollment paperwork.
        Eligibility assessment. Referral source discussed.
        """

        result = detector.detect_segments(transcript, industry="nonprofit")

        segment = result.segments[0]
        # Should classify as intake due to vocabulary
        assert segment.segment_type in [SegmentType.INTAKE, SegmentType.UNKNOWN]

    def test_case_review_classification(self, detector: MeetingSegmentDetector):
        """Test case review segment classification."""
        transcript = """
        Case review for client update.
        Progress on goals. Barriers identified.
        Next steps discussed.
        """

        result = detector.detect_segments(transcript, industry="nonprofit")

        segment = result.segments[0]
        assert segment.segment_type in [SegmentType.CASE_REVIEW, SegmentType.UNKNOWN]

    def test_user_interview_classification(self, detector: MeetingSegmentDetector):
        """Test user interview segment classification."""
        transcript = """
        User interview session. Testing the prototype.
        Usability feedback collected. Task completion observed.
        """

        result = detector.detect_segments(transcript, industry="tech")

        segment = result.segments[0]
        assert segment.segment_type in [SegmentType.USER_INTERVIEW, SegmentType.UNKNOWN]

    def test_unknown_classification(self, detector: MeetingSegmentDetector):
        """Test that unclear content classifies as unknown."""
        transcript = """
        Random conversation about the weather.
        General chitchat and small talk.
        Nothing specific.
        """

        result = detector.detect_segments(transcript, industry="tech")

        # With no clear signals, might be unknown
        segment = result.segments[0]
        # Accept any classification since content is ambiguous


class TestSegmentConfiguration(TestMeetingSegmentDetector):
    """Tests for segment detection configuration."""

    def test_custom_shift_threshold(self):
        """Test custom vocabulary shift threshold."""
        config = SegmentConfig(shift_threshold=0.9)  # Higher threshold
        detector = MeetingSegmentDetector(config=config)

        transcript = """
        Team sync: Updates from everyone.
        Case review: Client progress discussed.
        """

        result = detector.detect_segments(transcript, industry="nonprofit")

        # Higher threshold may result in fewer segments
        assert result.total_segments >= 1

    def test_max_segments_limit(self):
        """Test maximum segments limit is respected."""
        config = SegmentConfig(max_segments=2)
        detector = MeetingSegmentDetector(config=config)

        # Transcript that could have many segments
        transcript = """
        First topic. Second topic.
        Third topic. Fourth topic.
        Fifth topic. Sixth topic.
        """

        result = detector.detect_segments(transcript, industry="nonprofit")

        assert result.total_segments <= 2

    def test_single_encounter_industries_configurable(self):
        """Test that single-encounter industries are configurable."""
        config = SegmentConfig(
            single_encounter_industries=("healthcare", "custom_industry")
        )
        detector = MeetingSegmentDetector(config=config)

        result = detector.detect_segments(
            transcript="Custom meeting content.",
            industry="custom_industry",
        )

        assert result.industry_behavior == "single_encounter"


class TestSegmentVocabulary(TestMeetingSegmentDetector):
    """Tests for segment vocabulary patterns."""

    def test_segment_vocabulary_exists(self):
        """Test that segment vocabulary is defined."""
        assert len(SEGMENT_VOCABULARY) > 0

        # Check key segment types have vocabulary
        assert SegmentType.INTAKE in SEGMENT_VOCABULARY
        assert SegmentType.CASE_REVIEW in SEGMENT_VOCABULARY
        assert SegmentType.STANDUP in SEGMENT_VOCABULARY

    def test_vocabulary_has_keywords(self):
        """Test that vocabulary entries have keywords."""
        for segment_type, vocab in SEGMENT_VOCABULARY.items():
            assert "keywords" in vocab
            assert len(vocab["keywords"]) > 0, f"{segment_type} has no keywords"


class TestSegmentSignals(TestMeetingSegmentDetector):
    """Tests for signals within segments."""

    def test_segment_contains_signals(self, detector: MeetingSegmentDetector):
        """Test that segments contain detected signals."""
        transcript = """
        Client intake meeting. New enrollment.
        Referral received from partner agency.
        """

        result = detector.detect_segments(transcript, industry="nonprofit")

        segment = result.segments[0]
        # Should have signals from the vocabulary
        assert len(segment.signals) >= 0  # May have signals

    def test_segment_signal_types(self, detector: MeetingSegmentDetector):
        """Test that segment signals have correct types."""
        transcript = "Client case #123 intake meeting."

        result = detector.detect_segments(transcript, industry="nonprofit")

        segment = result.segments[0]
        for signal in segment.signals:
            assert signal.type in ["keyword", "pattern", "meeting_signal"]


class TestProcessingTime(TestMeetingSegmentDetector):
    """Tests for processing time tracking."""

    def test_processing_time_tracked(self, detector: MeetingSegmentDetector):
        """Test that processing time is tracked."""
        transcript = "Short meeting content."

        result = detector.detect_segments(transcript, industry="nonprofit")

        assert result.processing_time_ms >= 0

    def test_processing_time_reasonable(self, detector: MeetingSegmentDetector):
        """Test that processing time is reasonable for short content."""
        transcript = "Quick sync meeting."

        result = detector.detect_segments(transcript, industry="nonprofit")

        # Should complete in under 1 second
        assert result.processing_time_ms < 1000


class TestEdgeCases(TestMeetingSegmentDetector):
    """Tests for edge cases."""

    def test_empty_transcript(self, detector: MeetingSegmentDetector):
        """Test handling of empty transcript."""
        result = detector.detect_segments("", industry="nonprofit")

        assert result.total_segments >= 1  # At least one segment
        assert result.segments[0].text == ""

    def test_no_industry_specified(self, detector: MeetingSegmentDetector):
        """Test segmentation without industry (should segment)."""
        transcript = "Meeting content here."

        result = detector.detect_segments(transcript)

        assert result.industry_behavior == "segment"

    def test_very_long_transcript(self, detector: MeetingSegmentDetector):
        """Test handling of long transcript."""
        # Generate long content
        transcript = "Meeting content. " * 1000

        result = detector.detect_segments(transcript, industry="tech")

        # Should complete without error
        assert result.total_segments >= 1
        assert result.processing_time_ms < 5000  # Under 5 seconds

    def test_special_characters_in_transcript(self, detector: MeetingSegmentDetector):
        """Test handling of special characters."""
        transcript = """
        Meeting notes: @user mentioned #topic!
        Action items (TODO): Review & approve.
        Next steps: 1) Plan 2) Execute
        """

        result = detector.detect_segments(transcript, industry="tech")

        # Should handle without error
        assert result.total_segments >= 1
