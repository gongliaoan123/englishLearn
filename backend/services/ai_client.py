import os
from typing import Literal
from dotenv import load_dotenv
from openai import OpenAI
from anthropic import Anthropic

load_dotenv()

Provider = Literal["openai", "anthropic", "minimax"]

def _get_provider() -> Provider:
    if os.getenv("ANTHROPIC_API_KEY"):
        return "anthropic"
    if os.getenv("MINIMAX_API_KEY"):
        return "minimax"
    return "openai"


class AIClient:
    def __init__(self):
        self.provider = _get_provider()
        if self.provider == "openai":
            self.client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        elif self.provider == "minimax":
            self.client = OpenAI(
                api_key=os.getenv("MINIMAX_API_KEY"),
                base_url="https://api.minimax.chat/v1",
            )
        else:
            self.client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

    def chat(self, system: str, user: str, model: str = "gpt-4o") -> str:
        if self.provider == "openai":
            response = self.client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                temperature=0.3,
            )
            return response.choices[0].message.content
        elif self.provider == "minimax":
            # MiniMax uses OpenAI-compatible API
            # Default model: abab6.5s-chat
            response = self.client.chat.completions.create(
                model="abab6.5s-chat",
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                temperature=0.3,
            )
            return response.choices[0].message.content
        else:
            # anthropic
            response = self.client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=2048,
                system=system,
                messages=[{"role": "user", "content": user}],
            )
            return response.content[0].text
