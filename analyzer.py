import anthropic
import json
from config import ANTHROPIC_API_KEY, DEPORTES

client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

SYSTEM_PROMPT = """Eres BetAnalyzer Pro, un bot experto en análisis deportivo.

Tu trabajo es:
1. Buscar en internet los partidos más importantes del día usando web_search
2. Para cada partido encontrado, buscar: forma reciente, lesiones, historial h2h, cuotas actuales
3. Analizarlo desde 3 perspectivas distintas de tipsters
4. Dar un veredicto consensuado claro

REGLAS CRÍTICAS:
- Nunca inventes estadísticas. Si no encuentras datos, dilo.
- Si hay muchas incertidumbres, baja el nivel de confianza
- El error es dinero — prefiere pasar que dar un mal análisis
- Siempre busca al menos 2 fuentes antes de dar un veredicto

Responde SIEMPRE en este formato JSON exacto, sin texto extra:
{
  "partidos": [
    {
      "match": "Equipo A vs Equipo B",
      "liga": "Nombre de la liga",
      "hora": "21:00h",
      "deporte": "Fútbol",
      "tipsters": [
        {
          "nombre": "El Estadístico",
          "pick": "1 - Victoria local",
          "razon": "Explicación basada en estadísticas (2 oraciones)",
          "confianza": 75
        },
        {
          "nombre": "El Táctico",
          "pick": "1 - Victoria local",
          "razon": "Explicación basada en forma y táctica (2 oraciones)",
          "confianza": 70
        },
        {
          "nombre": "El Conservador",
          "pick": "Doble chance 1X",
          "razon": "Explicación desde perspectiva de riesgo (2 oraciones)",
          "confianza": 60
        }
      ],
      "consenso": {
        "pick": "Victoria local",
        "acuerdo": "2/3 tipsters",
        "confianza": 72,
        "veredicto": "APOSTAR",
        "factores": [
          "Factor clave 1",
          "Factor clave 2",
          "Factor clave 3"
        ],
        "advertencia": "Advertencia importante si hay dudas, o null si no hay"
      }
    }
  ]
}

Veredictos posibles según confianza:
- 80%+ → "APOSTAR CON CONFIANZA"  
- 65-79% → "APOSTAR CON PRECAUCIÓN"
- 50-64% → "RIESGO ALTO — solo expertos"
- <50% → "EVITAR — demasiada incertidumbre"
"""

def buscar_y_analizar_partidos() -> list[dict]:
    """
    Llama a Claude Haiku con web search activo.
    Busca partidos del día y retorna análisis completos.
    """
    deportes_str = ", ".join(DEPORTES)
    
    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=4000,
        system=SYSTEM_PROMPT,
        tools=[
            {
                "type": "web_search_20250305",
                "name": "web_search"
            }
        ],
        messages=[
            {
                "role": "user",
                "content": (
                    f"Busca los 3 partidos más importantes de HOY en: {deportes_str}. "
                    "Prioriza partidos con alta audiencia o importancia de clasificación. "
                    "Para cada partido, busca forma reciente, lesiones importantes y cuotas actuales. "
                    "Devuelve el JSON con el análisis completo de cada partido."
                )
            }
        ]
    )

    # Extraer el texto JSON de la respuesta
    for bloque in response.content:
        if bloque.type == "text":
            texto = bloque.text.strip()
            # Limpiar posibles backticks de markdown
            if texto.startswith("```"):
                texto = texto.split("```")[1]
                if texto.startswith("json"):
                    texto = texto[4:]
            try:
                data = json.loads(texto.strip())
                return data.get("partidos", [])
            except json.JSONDecodeError:
                print(f"❌ Error parseando JSON: {texto[:200]}")
                return []

    return []


def formatear_mensaje_telegram(partido: dict) -> str:
    """
    Convierte el análisis JSON en un mensaje formateado para Telegram.
    Usa Markdown compatible con Telegram.
    """
    m = partido
    consenso = m.get("consenso", {})
    tipsters = m.get("tipsters", [])
    confianza = consenso.get("confianza", 0)

    # Emoji según nivel de confianza
    if confianza >= 80:
        emoji_conf = "🟢"
        nivel = "ALTA"
    elif confianza >= 65:
        emoji_conf = "🟡"
        nivel = "MEDIA"
    else:
        emoji_conf = "🔴"
        nivel = "BAJA"

    # Barra de confianza visual
    bloques_llenos = round(confianza / 10)
    barra = "█" * bloques_llenos + "░" * (10 - bloques_llenos)

    # Construir líneas de tipsters
    lineas_tipsters = ""
    for t in tipsters:
        lineas_tipsters += f"• *{t['nombre']}* → {t['pick']} ({t['confianza']}%)\n"
        lineas_tipsters += f"  _{t['razon']}_\n\n"

    # Factores clave
    factores = consenso.get("factores", [])
    lineas_factores = "\n".join([f"→ {f}" for f in factores])

    # Advertencia (opcional)
    advertencia = consenso.get("advertencia")
    bloque_advertencia = f"\n⚠️ _{advertencia}_\n" if advertencia else ""

    mensaje = f"""⚽ *{m.get('match', '')}*
🏆 {m.get('liga', '')} · {m.get('hora', '')}

📊 *Análisis de 3 Tipsters:*

{lineas_tipsters}
━━━━━━━━━━━━━━━━━━━━
🎯 *VEREDICTO FINAL*
Pick: *{consenso.get('pick', '')}*
Acuerdo: {consenso.get('acuerdo', '')} tipsters
Confianza: {emoji_conf} {confianza}% ({nivel})
`{barra}`

📌 *Factores clave:*
{lineas_factores}
{bloque_advertencia}
🏷 _{consenso.get('veredicto', '')}_
━━━━━━━━━━━━━━━━━━━━
_⚠️ Solo análisis estadístico. No garantiza resultados. Apuesta con responsabilidad._"""

    return mensaje
