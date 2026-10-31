"""Technician handoff from a live voice conversation."""
import os

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter()


class Line(BaseModel):
    role: str
    text: str = Field(max_length=1000)


class HandoffIn(BaseModel):
    machine: str = Field(max_length=40)
    conversation: list[Line] = Field(min_length=2, max_length=60)


@router.post('/api/handoff')
async def handoff(body: HandoffIn):
    lines = [f'{line.role}: {line.text.strip()}' for line in body.conversation
             if line.role in ('user', 'agent') and line.text.strip()]
    if not any(line.startswith('user:') for line in lines) or not any(line.startswith('agent:') for line in lines):
        raise HTTPException(400, 'A user symptom and agent response are required')
    key = os.getenv('GROQ_API_KEY', '')
    if not key:
        symptoms = [line.text.strip() for line in body.conversation if line.role == 'user' and line.text.strip()]
        findings = [line.text.strip() for line in body.conversation if line.role == 'agent' and line.text.strip()]
        return {'summary': (f'Vehicle: {body.machine}\nReported symptoms: ' + '; '.join(symptoms[-4:]) +
                            '\nAgent guidance (not confirmed as completed): ' + '; '.join(findings[-4:]) +
                            '\nStatus: Professional inspection recommended. Confirm the reported symptoms and checks before repair.')}
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post('https://api.groq.com/openai/v1/chat/completions',
                headers={'Authorization': f'Bearer {key}'},
                json={'model': 'openai/gpt-oss-120b', 'temperature': 0.1, 'max_tokens': 400,
                      'messages': [
                          {'role': 'system', 'content': (
                              'Write a concise technician handoff in plain text. Use headings: Vehicle, Reported symptoms, '
                              'Checks and findings, Safety concern, Recommended next inspection. Use accurate technical '
                              'terms only where supported by the conversation. Distinguish observed facts from suspected '
                              'causes. Never invent measurements, tests, part compatibility, or repairs completed. '
                              'Do not advise the rider to perform unsafe repairs.')},
                          {'role': 'user', 'content': f'Machine: {body.machine}\nConversation:\n' + '\n'.join(lines)},
                      ]})
        response.raise_for_status()
        summary = response.json()['choices'][0]['message']['content'].strip()
        if not summary:
            raise ValueError('empty summary')
        return {'summary': summary}
    except (httpx.HTTPError, KeyError, IndexError, ValueError) as exc:
        raise HTTPException(502, f'Handoff generation failed: {type(exc).__name__}') from exc
