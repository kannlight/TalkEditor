import os
import abc
import json
import httpx
from typing import AsyncGenerator
from google import genai
from google.genai import types
from pydantic import BaseModel


class LLMResponse(BaseModel):
    content: str


class LLMService(abc.ABC):
    @abc.abstractmethod
    async def generate_stream(self, system_prompt: str, user_prompt: str, label: str = "", history: list[dict] | None = None) -> AsyncGenerator[str, None]:
        pass

    @abc.abstractmethod
    async def generate_sync(self, system_prompt: str, user_prompt: str, label: str = "", history: list[dict] | None = None, response_schema: type | None = None) -> str:
        pass


class GeminiAdapter(LLMService):
    def __init__(self, api_key: str, model_name: str = "gemini-2.5-flash"):
        self.client = genai.Client(api_key=api_key)
        self.model_name = model_name

    def _build_contents(self, user_prompt: str, history: list[dict] | None) -> list:
        contents = []
        for msg in (history or []):
            role = "model" if msg["role"] == "assistant" else "user"
            contents.append(types.Content(role=role, parts=[types.Part(text=msg["content"])]))
        contents.append(types.Content(role="user", parts=[types.Part(text=user_prompt)]))
        return contents

    async def generate_stream(self, system_prompt: str, user_prompt: str, label: str = "", history: list[dict] | None = None) -> AsyncGenerator[str, None]:
        async for chunk in await self.client.aio.models.generate_content_stream(
            model=self.model_name,
            config=types.GenerateContentConfig(system_instruction=system_prompt),
            contents=self._build_contents(user_prompt, history),
        ):
            if chunk.text:
                yield chunk.text

    async def generate_sync(self, system_prompt: str, user_prompt: str, label: str = "", history: list[dict] | None = None, response_schema: type | None = None) -> str:
        config_kwargs = {"system_instruction": system_prompt}
        if response_schema is not None:
            config_kwargs["response_mime_type"] = "application/json"
            config_kwargs["response_schema"] = response_schema
        response = await self.client.aio.models.generate_content(
            model=self.model_name,
            config=types.GenerateContentConfig(**config_kwargs),
            contents=self._build_contents(user_prompt, history),
        )
        return response.text


class OllamaAdapter(LLMService):
    """Ollama の OpenAI互換エンドポイント（/v1/chat/completions）を使用するアダプター"""

    def __init__(self, base_url: str, model_name: str):
        self.base_url = base_url.rstrip('/')
        self.model_name = model_name
        self._client = httpx.AsyncClient(timeout=120.0)
        self._response_format_mode: str | None = None  # None=未確認, "json_schema"/"json_object"/"none"

    async def _detect_response_format_mode(self) -> str:
        url = f"{self.base_url}/v1/chat/completions"
        base_payload = {
            "model": self.model_name,
            "messages": [{"role": "user", "content": "hi"}],
            "max_tokens": 1,
        }
        # json_schema を試す
        try:
            payload = {**base_payload, "response_format": {
                "type": "json_schema",
                "json_schema": {
                    "name": "test",
                    "strict": True,
                    "schema": {"type": "object", "properties": {"ok": {"type": "boolean"}}, "required": ["ok"], "additionalProperties": False},
                },
            }}
            response = await self._client.post(url, json=payload)
            if response.status_code != 400:
                print(f"[OllamaAdapter] response_format mode: json_schema")
                return "json_schema"
        except Exception:
            pass
        # json_object を試す
        try:
            payload = {**base_payload, "response_format": {"type": "json_object"}}
            response = await self._client.post(url, json=payload)
            if response.status_code != 400:
                print(f"[OllamaAdapter] response_format mode: json_object")
                return "json_object"
        except Exception:
            pass
        print(f"[OllamaAdapter] response_format mode: none")
        return "none"

    async def _get_response_format_mode(self) -> str:
        if self._response_format_mode is None:
            self._response_format_mode = await self._detect_response_format_mode()
        return self._response_format_mode

    def _build_messages(self, system_prompt: str, user_prompt: str, history: list[dict] | None) -> list[dict]:
        messages = [{"role": "system", "content": system_prompt}]
        messages.extend(history or [])
        messages.append({"role": "user", "content": user_prompt})
        return messages

    async def generate_stream(self, system_prompt: str, user_prompt: str, label: str = "", history: list[dict] | None = None) -> AsyncGenerator[str, None]:
        url = f"{self.base_url}/v1/chat/completions"
        payload = {
            "model": self.model_name,
            "messages": self._build_messages(system_prompt, user_prompt, history),
            "stream": True,
        }
        async with self._client.stream("POST", url, json=payload) as response:
            response.raise_for_status()
            async for line in response.aiter_lines():
                if not line.startswith("data: "):
                    continue
                data = line[6:]
                if data.strip() == "[DONE]":
                    break
                try:
                    chunk = json.loads(data)
                    delta = chunk["choices"][0]["delta"].get("content", "")
                    if delta:
                        yield delta
                except (json.JSONDecodeError, KeyError, IndexError):
                    continue

    async def generate_sync(self, system_prompt: str, user_prompt: str, label: str = "", history: list[dict] | None = None, response_schema: type | None = None) -> str:
        url = f"{self.base_url}/v1/chat/completions"
        payload = {
            "model": self.model_name,
            "messages": self._build_messages(system_prompt, user_prompt, history),
            "stream": False,
        }
        if response_schema is not None:
            mode = await self._get_response_format_mode()
            if mode == "json_schema":
                payload["response_format"] = {
                    "type": "json_schema",
                    "json_schema": {
                        "name": response_schema.__name__,
                        "strict": True,
                        "schema": response_schema.model_json_schema(),
                    },
                }
            elif mode == "json_object":
                payload["response_format"] = {"type": "json_object"}
        response = await self._client.post(url, json=payload)
        response.raise_for_status()
        data = response.json()
        return data["choices"][0]["message"]["content"]
