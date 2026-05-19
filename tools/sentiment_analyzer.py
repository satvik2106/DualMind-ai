"""
Sentiment Analyzer Tool
Performs sentiment analysis using HuggingFace transformers.
"""

import logging
from typing import Dict, Any, Tuple

class SentimentAnalyzer:
    """Tool for performing sentiment analysis on text."""

    def __init__(self):
        """Initialize the sentiment analyzer."""
        try:
            from transformers import pipeline
            # Use a lightweight sentiment analysis model
            self.analyzer = pipeline(
                "sentiment-analysis",
                model="distilbert-base-uncased-finetuned-sst-2-english",
                tokenizer="distilbert-base-uncased-finetuned-sst-2-english"
            )
            self.model_loaded = True
        except Exception as e:
            logging.warning(f"Could not load sentiment analysis model: {e}. Using fallback method.")
            self.analyzer = None
            self.model_loaded = False

        self.logger = logging.getLogger(__name__)

    def analyze_sentiment(self, text: str) -> Dict[str, Any]:
        """
        Analyze sentiment of given text.

        Args:
            text (str): Text to analyze

        Returns:
            Dict[str, Any]: Sentiment analysis results
        """
        try:
            if self.model_loaded and self.analyzer:
                # Truncate text if too long (model limitation)
                max_length = 512
                if len(text) > max_length:
                    text = text[:max_length]

                result = self.analyzer(text)[0]

                return {
                    'label': result['label'],
                    'confidence': result['score'],
                    'success': True
                }
            else:
                # Fallback to simple keyword-based analysis
                return self._fallback_sentiment_analysis(text)

        except Exception as e:
            self.logger.error(f"Error in sentiment analysis: {e}")
            return self._fallback_sentiment_analysis(text)

    def _fallback_sentiment_analysis(self, text: str) -> Dict[str, Any]:
        """Fallback sentiment analysis using keyword matching."""
        text_lower = text.lower()

        # Simple keyword-based sentiment analysis
        positive_words = ['good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic',
                         'love', 'like', 'positive', 'happy', 'pleased', 'satisfied']
        negative_words = ['bad', 'terrible', 'awful', 'horrible', 'hate', 'dislike',
                         'negative', 'sad', 'angry', 'disappointed', 'worst']

        positive_count = sum(1 for word in positive_words if word in text_lower)
        negative_count = sum(1 for word in negative_words if word in text_lower)

        if positive_count > negative_count:
            return {
                'label': 'POSITIVE',
                'confidence': min(0.5 + (positive_count * 0.1), 0.9),
                'success': False,
                'method': 'keyword-based'
            }
        elif negative_count > positive_count:
            return {
                'label': 'NEGATIVE',
                'confidence': min(0.5 + (negative_count * 0.1), 0.9),
                'success': False,
                'method': 'keyword-based'
            }
        else:
            return {
                'label': 'NEUTRAL',
                'confidence': 0.5,
                'success': False,
                'method': 'keyword-based'
            }

    def run(self, text: str) -> str:
        """
        Main method to run the sentiment analyzer tool.

        Args:
            text (str): Text to analyze

        Returns:
            str: Formatted sentiment analysis results
        """
        result = self.analyze_sentiment(text)

        formatted_result = f"Sentiment Analysis Results:\n\n"
        formatted_result += f"**Sentiment:** {result['label']}\n"
        formatted_result += f"**Confidence:** {result['confidence']:.2%}"
        if not result.get('success', True):
            formatted_result += f"\n**Method:** {result.get('method', 'fallback')}"

        return formatted_result


def sentiment_analyzer_tool(text: str) -> str:
    """
    Standalone function for sentiment analyzer tool.

    Args:
        text (str): Text to analyze

    Returns:
        str: Formatted sentiment analysis results
    """
    analyzer = SentimentAnalyzer()
    return analyzer.run(text)
