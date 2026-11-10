#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Скрипт разведки рынка и анализа ниши (Урок 11 курса Вайбкодинг — адаптировано для МЕТОДИКО / Офицерский дуэт).
Автоматически считывает ключ из файла .env в текущей папке.
Поддерживает:
  1) OPENROUTER_API_KEY (модель Perplexity через OpenRouter, как в Уроке 11)
  2) GEMINI_API_KEY (бесплатный ключ Google AI Studio с поиском Google)
"""

import json
import os
import ssl
import sys
import urllib.error
import urllib.request
from datetime import datetime
from pathlib import Path

DEFAULT_NICHE = (
    "Услуги методолога и педагогического дизайнера в Казахстане, России и СНГ (2025-2026): "
    "1) Разработка УМКД, силлабусов, ФОС и подготовка к аккредитации для вузов и колледжей; "
    "2) Авторские программы, методические пособия и КСП для школ и аттестации учителей; "
    "3) Корпоративное обучение B2B для предпринимателей: книги продаж, регламенты, СОПы, академии онбординга и диалоговые тренажеры для сотрудников; "
    "4) Проектирование и аудит онлайн-курсов (EdTech)."
)


def load_dotenv_file() -> None:
    """Читает файл .env в папке со скриптом, чтобы не вводить ключ вручную в терминале."""
    env_path = Path(__file__).resolve().parent / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, val = line.split("=", 1)
        key = key.strip()
        val = val.strip().strip("'").strip('"')
        if val and not val.startswith("ВСТАВЬТЕ_"):
            os.environ.setdefault(key, val)


def build_ssl_context() -> ssl.SSLContext:
    try:
        import certifi
        return ssl.create_default_context(cafile=certifi.where())
    except ImportError:
        return ssl.create_default_context()


def build_prompt(niche: str) -> str:
    return f"""Проведи глубокое маркетинговое и продуктовое исследование за 2025–2026 гг. по теме:
"{niche}"

Разбери подробно все 4 сегмента (1. Вузы и колледжи РК/СНГ; 2. Школы и учителя; 3. Предприниматели и корпоративное обучение B2B / тренажеры / регламенты; 4. Онлайн-школы и EdTech):
1. Какие задачи и боли стоят наиболее остро прямо сейчас (за что готовы платить без долгих уговоров)?
2. Какие актуальные цены в Казахстане (в тенге) и России (в рублях) на эти услуги в 2025-2026 гг.?
3. Кто конкуренты, какие у них слабые места и в чем дефицит хороших специалистов?
4. Какие форматы наиболее комфортны для выполнения силами семейного экспертного бюро за 2-3 часа в день с помощью ИИ?
5. Какие экспертные статьи, шаблоны и запросы ищут клиенты в Google и через поисковики нейросетей (ChatGPT, Perplexity, Gemini), чтобы продвигаться строго без лица (через экспертный сайт и Telegram)?

Дай сводную сравнительную таблицу по 4 сегментам и конкретные ссылки на источники."""


def ask_perplexity_openrouter(api_key: str, niche: str) -> str:
    url = "https://openrouter.ai/api/v1/chat/completions"
    model = os.getenv("OPENROUTER_MODEL", "perplexity/sonar-pro")
    payload = {
        "model": model,
        "max_tokens": 3500,
        "messages": [
            {
                "role": "system",
                "content": (
                    "Ты главный аналитик рынка образования, B2B-консалтинга и EdTech в Казахстане и СНГ. "
                    "Отвечай на русском языке, структурно, с таблицами, реальными ценами в тенге и рублях и ссылками на источники."
                ),
            },
            {"role": "user", "content": build_prompt(niche)},
        ],
    }
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://coursemaker.kz",
            "X-Title": "METODIKO Niche Analyzer",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=180, context=build_ssl_context()) as resp:
        result = json.loads(resp.read().decode("utf-8"))
        return result["choices"][0]["message"]["content"].strip()


def ask_gemini_search(api_key: str, niche: str) -> str:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
    payload = {
        "contents": [{"parts": [{"text": build_prompt(niche)}]}],
        "tools": [{"google_search": {}}],
    }
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=180, context=build_ssl_context()) as resp:
        result = json.loads(resp.read().decode("utf-8"))
        parts = result["candidates"][0]["content"]["parts"]
        return "\n".join(p.get("text", "") for p in parts).strip()


def main() -> int:
    load_dotenv_file()
    openrouter_key = os.getenv("OPENROUTER_API_KEY", "").strip()
    gemini_key = os.getenv("GEMINI_API_KEY", "").strip()
    niche = os.getenv("NICHE", DEFAULT_NICHE).strip()

    script_dir = Path(__file__).resolve().parent
    date_stamp = datetime.now().strftime("%Y-%m-%d")
    output_path = script_dir / f"niche_map_{date_stamp}.md"

    if openrouter_key:
        print("Найден ключ OPENROUTER_API_KEY. Запускаю Perplexity через OpenRouter...")
        try:
            content = ask_perplexity_openrouter(openrouter_key, niche)
            provider = "Perplexity (через OpenRouter API)"
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", errors="replace")
            print(f"\n⚠️ Ошибка от OpenRouter (код {e.code}):\n{body}\n", file=sys.stderr)
            if e.code == 402:
                print(
                    "Подсказка: Код 402 означает, что на балансе OpenRouter закончились средства для платной модели Perplexity.\n"
                    "Вы можете использовать бесплатный ключ GEMINI_API_KEY из Google AI Studio или наш встроенный отчет!",
                    file=sys.stderr,
                )
            return 1
    elif gemini_key:
        print("Найден ключ GEMINI_API_KEY. Запускаю исследование через Gemini + живой поиск Google...")
        content = ask_gemini_search(gemini_key, niche)
        provider = "Google Gemini + Google Search Grounding"
    else:
        print(
            "Ключ еще не добавлен в файл .env.\n"
            "Создайте в этой папке файл .env и впишите туда:\n"
            "  OPENROUTER_API_KEY=ваш_ключ\n"
            "или\n"
            "  GEMINI_API_KEY=ваш_ключ_из_Google_AI_Studio"
        )
        return 1

    header = (
        f"# 🧭 Карта рынка и анализ ниши: МЕТОДИКО & Офицерский дуэт\n\n"
        f"- **Дата анализа:** {date_stamp}\n"
        f"- **Источник разведки:** `{provider}`\n\n---\n\n"
    )
    output_path.write_text(header + content + "\n", encoding="utf-8")
    print(f"✅ Готово! Отчет сохранен в файл: {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
