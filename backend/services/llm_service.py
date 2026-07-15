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
    async def generate_stream(self, system_prompt: str, user_prompt: str) -> AsyncGenerator[str, None]:
        pass

    @abc.abstractmethod
    async def generate_sync(self, system_prompt: str, user_prompt: str) -> str:
        pass


class GeminiAdapter(LLMService):
    def __init__(self, api_key: str, model_name: str = "gemini-2.5-flash"):
        self.client = genai.Client(api_key=api_key)
        self.model_name = model_name

    async def generate_stream(self, system_prompt: str, user_prompt: str) -> AsyncGenerator[str, None]:
        async for chunk in await self.client.aio.models.generate_content_stream(
            model=self.model_name,
            config=types.GenerateContentConfig(
                system_instruction=system_prompt
            ),
            contents=user_prompt
        ):
            if chunk.text:
                yield chunk.text

    async def generate_sync(self, system_prompt: str, user_prompt: str) -> str:
        response = await self.client.aio.models.generate_content(
            model=self.model_name,
            config=types.GenerateContentConfig(
                system_instruction=system_prompt
            ),
            contents=user_prompt
        )
        return response.text


class OllamaAdapter(LLMService):
    """Ollama の OpenAI互換エンドポイント（/v1/chat/completions）を使用するアダプター"""

    def __init__(self, base_url: str, model_name: str):
        self.base_url = base_url.rstrip('/')
        self.model_name = model_name
        self._client = httpx.AsyncClient(timeout=120.0)

    async def generate_stream(self, system_prompt: str, user_prompt: str) -> AsyncGenerator[str, None]:
        url = f"{self.base_url}/v1/chat/completions"
        payload = {
            "model": self.model_name,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
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

    async def generate_sync(self, system_prompt: str, user_prompt: str) -> str:
        url = f"{self.base_url}/v1/chat/completions"
        payload = {
            "model": self.model_name,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "stream": False,
        }
        response = await self._client.post(url, json=payload)
        response.raise_for_status()
        data = response.json()
        return data["choices"][0]["message"]["content"]
