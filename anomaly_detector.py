"""
LogForge AI Anomaly Detection Service
Uses Isolation Forest for unsupervised anomaly detection.
Detects brute-force attacks, unusual traffic, and suspicious patterns.
"""

import numpy as np
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from collections import defaultdict, deque
import threading

logger = logging.getLogger(__name__)

# Try to import sklearn; gracefully degrade if unavailable
try:
    from sklearn.ensemble import IsolationForest
    from sklearn.preprocessing import StandardScaler
    SKLEARN_AVAILABLE = True
except ImportError:
    logger.warning("scikit-learn not available, using rule-based detection only")
    SKLEARN_AVAILABLE = False


class AnomalyDetector:
    """
    Multi-layered anomaly detection:
    1. Rule-based: brute-force, known attack patterns
    2. Statistical: Z-score on request rates
    3. ML-based: Isolation Forest on feature vectors
    """

    def __init__(self):
        self.model: Optional[object] = None  # IsolationForest
        self.scaler: Optional[object] = None  # StandardScaler
        self.is_trained = False
        self.lock = threading.Lock()

        # Sliding window tracking
        self.ip_failures: Dict[str, deque] = defaultdict(lambda: deque())
        self.ip_requests: Dict[str, deque] = defaultdict(lambda: deque())
        self.user_failures: Dict[str, deque] = defaultdict(lambda: deque())

        # Feature buffer for ML training
        self.feature_buffer: List[List[float]] = []
        self.max_buffer_size = 5000

    # ─── Rule-Based Detection ────────────────────────────────────────────────

    def check_brute_force(self, ip: str, username: str, is_failed: bool, window_seconds: int = 300) -> Tuple[bool, str, float]:
        """
        Detect brute-force login attempts.
        Returns: (is_attack, description, confidence)
        """
        now = datetime.utcnow()
        cutoff = now - timedelta(seconds=window_seconds)

        if is_failed:
            # Track IP failures
            self.ip_failures[ip].append(now)
            # Remove old entries
            while self.ip_failures[ip] and self.ip_failures[ip][0] < cutoff:
                self.ip_failures[ip].popleft()

            # Track user failures
            if username:
                self.user_failures[username].append(now)
                while self.user_failures[username] and self.user_failures[username][0] < cutoff:
                    self.user_failures[username].popleft()

        ip_fail_count = len(self.ip_failures.get(ip, []))
        user_fail_count = len(self.user_failures.get(username or "", []))

        # Brute force thresholds
        if ip_fail_count >= 10:
            confidence = min(0.95, 0.5 + ip_fail_count * 0.05)
            return True, f"Brute force detected: {ip_fail_count} failures from {ip} in {window_seconds}s", confidence
        elif ip_fail_count >= 5:
            confidence = 0.6 + ip_fail_count * 0.04
            return True, f"Suspicious login activity: {ip_fail_count} failures from {ip}", confidence
        elif user_fail_count >= 8:
            confidence = 0.7
            return True, f"Password spraying on user '{username}': {user_fail_count} attempts", confidence

        return False, "", 0.0

    def check_traffic_spike(self, ip: str, window_seconds: int = 60) -> Tuple[bool, str, float]:
        """Detect unusual traffic spikes from a single IP."""
        now = datetime.utcnow()
        cutoff = now - timedelta(seconds=window_seconds)

        self.ip_requests[ip].append(now)
        while self.ip_requests[ip] and self.ip_requests[ip][0] < cutoff:
            self.ip_requests[ip].popleft()

        req_count = len(self.ip_requests[ip])
        if req_count > 200:
            return True, f"DDoS/scraping: {req_count} requests from {ip} in {window_seconds}s", 0.85
        elif req_count > 100:
            return True, f"High traffic: {req_count} requests from {ip} in {window_seconds}s", 0.65

        return False, "", 0.0

    # ─── ML-Based Detection ──────────────────────────────────────────────────

    def extract_features(self, log_data: dict) -> List[float]:
        """Extract numerical features from a log entry for ML model."""
        features = [
            # HTTP status code (normalized)
            (log_data.get("http_status") or 200) / 600.0,
            # Response time
            min(log_data.get("response_time") or 0, 30.0) / 30.0,
            # Hour of day (cyclical)
            np.sin(2 * np.pi * (log_data.get("hour", 12)) / 24),
            np.cos(2 * np.pi * (log_data.get("hour", 12)) / 24),
            # Log level encoded
            {"DEBUG": 0, "INFO": 0.2, "WARNING": 0.6, "ERROR": 0.8, "CRITICAL": 1.0}.get(
                log_data.get("log_level", "INFO"), 0.2
            ),
            # Is error status
            1.0 if (log_data.get("http_status") or 200) >= 400 else 0.0,
            # Has IP
            1.0 if log_data.get("ip_address") else 0.0,
            # Has username
            1.0 if log_data.get("username") else 0.0,
        ]
        return features

    def add_to_buffer(self, log_data: dict):
        """Add a feature vector to the training buffer."""
        features = self.extract_features(log_data)
        with self.lock:
            self.feature_buffer.append(features)
            if len(self.feature_buffer) > self.max_buffer_size:
                self.feature_buffer = self.feature_buffer[-self.max_buffer_size:]

    def train_model(self):
        """Train the Isolation Forest on accumulated feature vectors."""
        if not SKLEARN_AVAILABLE:
            return
        with self.lock:
            if len(self.feature_buffer) < 50:
                return
            X = np.array(self.feature_buffer)

        try:
            scaler = StandardScaler()
            X_scaled = scaler.fit_transform(X)

            model = IsolationForest(
                n_estimators=100,
                contamination=0.05,  # Expect ~5% anomalies
                random_state=42,
                n_jobs=-1,
            )
            model.fit(X_scaled)

            with self.lock:
                self.model = model
                self.scaler = scaler
                self.is_trained = True

            logger.info(f"✅ Isolation Forest trained on {len(X)} samples")
        except Exception as e:
            logger.error(f"Model training failed: {e}")

    def predict_anomaly(self, log_data: dict) -> Tuple[float, bool]:
        """
        Predict anomaly score for a log entry.
        Returns: (score 0-1, is_anomaly)
        """
        if not SKLEARN_AVAILABLE or not self.is_trained:
            return self._rule_based_score(log_data)

        try:
            features = self.extract_features(log_data)
            X = np.array([features])
            X_scaled = self.scaler.transform(X)

            # Isolation Forest: -1 = anomaly, 1 = normal
            prediction = self.model.predict(X_scaled)[0]
            raw_score = self.model.score_samples(X_scaled)[0]

            # Normalize score to 0-1 (higher = more anomalous)
            score = max(0.0, min(1.0, 1.0 - (raw_score + 0.5)))
            is_anomaly = prediction == -1

            return round(score, 3), is_anomaly
        except Exception as e:
            logger.debug(f"Prediction error: {e}")
            return self._rule_based_score(log_data)

    def _rule_based_score(self, log_data: dict) -> Tuple[float, bool]:
        """Fallback rule-based scoring when ML model isn't ready."""
        score = 0.0
        status = log_data.get("http_status") or 200
        level = log_data.get("log_level", "INFO")

        if status >= 500:
            score += 0.4
        elif status == 403:
            score += 0.3
        elif status == 401:
            score += 0.25

        level_scores = {"CRITICAL": 0.5, "ERROR": 0.35, "WARNING": 0.15}
        score += level_scores.get(level, 0.0)

        return min(score, 1.0), score > 0.5


# Global singleton
anomaly_detector = AnomalyDetector()
