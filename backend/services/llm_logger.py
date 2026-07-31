import json
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import AsyncGenerator, Optional

from .llm_service import LLMService


LOGS_DIR = Path(__file__).parent.parent / "logs"


class LLMCallLogger:
    def __init__(self):
        LOGS_DIR.mkdir(exist_ok=True)

    def _log_path(self) -> Path:
        date_str = datetime.now().strftime("%Y%m%d")
        return LOGS_DIR / f"llm_{date_str}.jsonl"

    def log(
        self,
        label: str,
        service_id: str,
        model: str,
        system_prompt: str,
        user_prompt: str,
        response: str,
        duration_ms: float,
        success: bool,
        error: Optional[str] = None,
        history: list[dict] | None = None,
    ):
        entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "label": label,
            "service_id": service_id,
            "model": model,
            "duration_ms": round(duration_ms),
            "success": success,
            "error": error,
            "system_prompt": system_prompt,
            "history": history or [],
            "user_prompt": user_prompt,
            "response": response,
        }
        with open(self._log_path(), "a", encoding="utf-8") as f:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")

        status = "OK" if success else "ERROR"
        print(f"[LLM] {label} | {service_id}/{model} | {round(duration_ms)}ms | {status}")


_logger = LLMCallLogger()


class LoggingLLMService(LLMService):
    def __init__(self, adapter: LLMService, service_id: str, model: str):
        self._adapter = adapter
        self._service_id = service_id
        self._model = model

    async def generate_sync(self, system_prompt: str, user_prompt: str, label: str = "", history: list[dict] | None = None, response_schema: type | None = None) -> str:
        start = time.perf_counter()
        error = None
        response = ""
        try:
            response = await self._adapter.generate_sync(system_prompt, user_prompt, history=history, response_schema=response_schema)
            return response
        except Exception as e:
            error = str(e)
            raise
        finally:
            duration_ms = (time.perf_counter() - start) * 1000
            _logger.log(
                label=label or "unknown",
                service_id=self._service_id,
                model=self._model,
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                response=response,
                duration_ms=duration_ms,
                success=error is None,
                error=error,
                history=history,
            )

    async def generate_stream(self, system_prompt: str, user_prompt: str, label: str = "", history: list[dict] | None = None) -> AsyncGenerator[str, None]:
        start = time.perf_counter()
        chunks: list[str] = []
        error = None
        try:
            async for chunk in self._adapter.generate_stream(system_prompt, user_prompt, history=history):
                chunks.append(chunk)
                yield chunk
        except Exception as e:
            error = str(e)
            raise
        finally:
            duration_ms = (time.perf_counter() - start) * 1000
            _logger.log(
                label=label or "unknown",
                service_id=self._service_id,
                model=self._model,
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                response="".join(chunks),
                duration_ms=duration_ms,
                success=error is None,
                error=error,
                history=history,
            )
