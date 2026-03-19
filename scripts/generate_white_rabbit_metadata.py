"""
White Rabbit Token Metadata Generator.

Generates JSON and human-readable text metadata files for the White Rabbit (WRAB) token.
"""

from __future__ import annotations

import json
import logging
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict

BASE_DIR = Path(__file__).resolve().parents[1]
OUTPUT_DIR = BASE_DIR / "data"
LOG_DIR = BASE_DIR / "logs"

LOG_DIR.mkdir(parents=True, exist_ok=True)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.FileHandler(LOG_DIR / "white_rabbit_generator.log"),
        logging.StreamHandler(sys.stdout),
    ],
)
logger = logging.getLogger(__name__)


class TokenMetadataGenerator:
    """Generator for White Rabbit token metadata."""

    VERSION = "1.0.0"
    TOKEN_NAME = "White Rabbit"
    TOKEN_SYMBOL = "WRAB"

    def __init__(self, output_dir: Path = OUTPUT_DIR) -> None:
        """Initialize the generator with an output directory."""
        self.output_dir = output_dir
        self.timestamp = self._current_timestamp()

    def _current_timestamp(self) -> str:
        """Return an RFC 3339 timestamp string in UTC."""
        timestamp = datetime.now(timezone.utc).isoformat()
        return timestamp.replace("+00:00", "Z")

    def generate_metadata(self) -> Dict[str, Any]:
        """Build the token metadata payload."""
        return {
            "name": self.TOKEN_NAME,
            "symbol": self.TOKEN_SYMBOL,
            "version": self.VERSION,
            "creator": "Michael Vincent Patrick (MVPuknowme)",
            "description": (
                "The White Rabbit token from the Aura-Core Multiconfigurator universe. "
                "Evolves through states, with lore and utility."
            ),
            "token_type": "evolving",
            "rarity_class": "dynamic",
            "roles": ["chaos_messenger", "key_carrier", "lore_initiate"],
            "functions": [
                "unlock_gate",
                "trigger_narrative_branch",
                "auth_badge",
                "visual_seed",
            ],
            "evolution_states": [
                {"stage": 1, "name": "Cute Rabbit"},
                {"stage": 2, "name": "Chaotic Hopper"},
                {"stage": 3, "name": "Courier of Doom"},
                {"stage": 4, "name": "Myth-Class Guardian"},
            ],
            "bindings": {
                "auracore.logic.module": "postman_rabbit",
                "multiconfigurator.key": "rabbit_v1",
                "discord_role": "🐇Rabbit Holder",
                "codex_trigger": "unlock://spacetime/relay-rabbit",
            },
            "timestamp": self.timestamp,
        }

    def generate_text_content(self, metadata: Dict[str, Any]) -> str:
        """Create a human-readable representation of the metadata."""
        roles_text = "\n".join(f"- {role}" for role in metadata["roles"])
        functions_text = "\n".join(f"- {function}" for function in metadata["functions"])
        states_text = "\n".join(
            f"- Stage {state['stage']}: {state['name']}"
            for state in metadata["evolution_states"]
        )
        bindings_text = "\n".join(
            f"- {key}: {value}" for key, value in metadata["bindings"].items()
        )

        return f"""\
Token Name: {metadata['name']}
Symbol: {metadata['symbol']}
Version: {metadata['version']}
Creator: {metadata['creator']}
Token Type: {metadata['token_type']}
Rarity Class: {metadata['rarity_class']}

Description:
{metadata['description']}

Roles:
{roles_text}

Functions:
{functions_text}

Evolution States:
{states_text}

Bindings:
{bindings_text}

Timestamp: {metadata['timestamp']}
"""

    def validate_metadata(self, metadata: Dict[str, Any]) -> None:
        """Validate required metadata fields and structure."""
        required_fields = [
            "name",
            "symbol",
            "version",
            "creator",
            "description",
            "token_type",
            "roles",
            "functions",
            "evolution_states",
            "bindings",
            "timestamp",
        ]

        for field in required_fields:
            if field not in metadata:
                raise ValueError(f"Missing required field: {field}")

        if not metadata["evolution_states"]:
            raise ValueError("Evolution states cannot be empty")

        for state in metadata["evolution_states"]:
            if "stage" not in state or "name" not in state:
                raise ValueError("Invalid evolution state structure")

        logger.info("Metadata validation passed")

    def write_json_file(self, metadata: Dict[str, Any], filepath: Path) -> None:
        """Write the metadata JSON to disk."""
        try:
            with filepath.open("w", encoding="utf-8") as file_handle:
                json.dump(metadata, file_handle, indent=2, ensure_ascii=False)
            logger.info("JSON metadata written to: %s", filepath)
        except OSError as exc:
            logger.error("Failed to write JSON file: %s", exc)
            raise

    def write_text_file(self, content: str, filepath: Path) -> None:
        """Write the text metadata to disk."""
        try:
            filepath.write_text(content, encoding="utf-8")
            logger.info("Text file written to: %s", filepath)
        except OSError as exc:
            logger.error("Failed to write text file: %s", exc)
            raise

    def generate(self) -> Dict[str, Path]:
        """Generate and persist both metadata files."""
        logger.info("Starting metadata generation")

        try:
            self.output_dir.mkdir(parents=True, exist_ok=True)
            logger.info("Output directory ready: %s", self.output_dir)
        except OSError as exc:
            logger.error("Failed to create output directory: %s", exc)
            raise

        metadata = self.generate_metadata()
        self.validate_metadata(metadata)

        json_path = self.output_dir / "white_rabbit_token_metadata.json"
        text_path = self.output_dir / "white_rabbit_token_info.txt"

        self.write_json_file(metadata, json_path)
        text_content = self.generate_text_content(metadata)
        self.write_text_file(text_content, text_path)

        logger.info("Metadata generation completed successfully")

        return {"json": json_path, "text": text_path}


def main() -> int:
    try:
        generator = TokenMetadataGenerator()
        output_files = generator.generate()

        print("\n" + "=" * 60)
        print("WHITE RABBIT TOKEN METADATA GENERATION COMPLETE")
        print("=" * 60)
        print(f"JSON Metadata: {output_files['json']}")
        print(f"Text Info:     {output_files['text']}")
        print("=" * 60 + "\n")

        return 0
    except Exception as exc:
        logger.error("Fatal error during generation: %s", exc, exc_info=True)
        print(f"\nERROR: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
