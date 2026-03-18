"""
backend/streamlit_shim.py
─────────────────────────────────────────────────────────────────────────────
Fakes `streamlit` and `st.secrets` using environment variables (.env file).
Import this BEFORE any engine imports so db.py / llm_engine.py never crash.

Your existing engine files are NOT modified at all.
─────────────────────────────────────────────────────────────────────────────
"""

import os
import sys
from dotenv import load_dotenv

load_dotenv()


class _Secrets(dict):
    """Behaves like st.secrets — supports both st.secrets["KEY"] and st.secrets["section"]["KEY"]."""

    def __getitem__(self, key):
        # Direct key lookup first
        val = os.environ.get(key)
        if val is not None:
            return val
        # Check if it's a section name (e.g. st.secrets["supabase"])
        if key == "supabase":
            return _SubSecrets()
        raise KeyError(key)

    def __contains__(self, key):
        return os.environ.get(key) is not None or key == "supabase"

    def get(self, key, default=None):
        try:
            return self[key]
        except KeyError:
            return default


class _SubSecrets(dict):
    """Handles st.secrets['supabase']['DATABASE_URL'] style lookups."""

    def __getitem__(self, key):
        val = os.environ.get(key)
        if val is not None:
            return val
        raise KeyError(key)

    def __contains__(self, key):
        return os.environ.get(key) is not None

    def get(self, key, default=None):
        return os.environ.get(key, default)


class _SessionState(dict):
    """Minimal st.session_state stub — engines that use it won't crash."""
    def __getattr__(self, key):
        return self.get(key)
    def __setattr__(self, key, value):
        self[key] = value


class _StreamlitShim:
    """Minimal Streamlit stub — only what the engines actually use."""
    secrets       = _Secrets()
    session_state = _SessionState()

    def __getattr__(self, name):
        # Swallow any st.xyz calls (st.write, st.error, etc.) silently
        return lambda *args, **kwargs: None


# Inject the shim into sys.modules BEFORE any engine imports
sys.modules["streamlit"] = _StreamlitShim()