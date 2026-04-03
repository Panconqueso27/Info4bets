import anthropic
import json
from config import ANTHROPIC_API_KEY, DEPORTES

client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

SYSTEM_PROMPT = """Eres BetAnalyzer Pro, experto en análisis deportivo.
Busca los partidos más importantes de hoy con web_search y analízalos.
Responde SOLO con este JSON exacto, sin texto extra ni backticks:
{
  "partidos": [
    {
      "match": "Equipo A vs Equipo B",
      "liga": "Nombre liga",
      "hora": "21:00h",
      "deporte": "Fútbol",
      "tipsters": [
        {"nombre": "El Estadístico", "pick": "1 Madrid", "razon": "Razón estadística.", "confianza": 75},
        {"nombre": "El Táctico", "pick": "1 Madrid", "razon": "Razón táctica.", "confianza": 70},
        {"nombre": "El Conservador", "pick": "1X Doble", "razon": "Razón conservadora.", "confianza": 60}
      ],
      "consenso": {
        "pick": "Victoria local",
        "acuerdo": "2/3 tipsters",
        "confianza": 72,
        "veredicto": "APOSTAR CON PRECAUCIÓN",
        "factores": ["Factor 1", "Factor 2", "Factor 3"],
        "advertencia": null
      }
    }
  ]
}"""

def buscar_y_analizar_partidos():
    deportes_str = ", ".join(DEPORTES)
    try:
        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=4000,
            system=SYSTEM_PROMPT,
            tools=[{"type": "web_search_20250305", "name": "web_search"}],
            messages=[{
                "role": "user",
                "content": f"Busca los 3 partidos más importantes de HOY en: {deportes_str}. Devuelve el JSON."
            }]
        )
        for bloque in response.content:
            if bloque.type == "text":
                texto = bloque.text.strip().replace("```json", "").replace("```", "").strip()
                try:
                    return json.loads(texto).get("partidos", [])
                except:
                    return []
    except Exception as e:
        print(f"Error API: {e}")
        return []

def formatear_mensaje_telegram(partido):
    consenso = partido.get("consenso", {})
    tipsters = partido.get("tipsters", [])
    confianza = consenso.get("confianza", 0)

    if confianza >= 80:
        emoji = "🟢"
    elif confianza >= 65:
        emoji = "🟡"
    else:
        emoji = "🔴"

    barra = "█" * round(confianza / 10) + "░" * (10 - round(confianza / 10))

    lineas_tipsters = ""
    for t in tipsters:
        lineas_tipsters += f"• *{t['nombre']}* → {t['pick']} ({t['confianza']}%)\n_{t['razon']}_\n\n"

    factores = "\n".join([f"→ {f}" for f in consenso.get("factores", [])])
    advertencia = consenso.get("advertencia")
    bloque_adv = f"\n⚠️ _{advertencia}_\n" if advertencia else ""

    return f"""⚽ *{partido.get('match', '')}*
🏆 {partido.get('liga', '')} · {partido.get('hora', '')}

📊 *Análisis de 3 Tipsters:*
{lineas_tipsters}
━━━━━━━━━━━━━━━━━━━━
🎯 *VEREDICTO FINAL*
Pick: *{consenso.get('pick', '')}*
Acuerdo: {consenso.get('acuerdo', '')}
Confianza: {emoji} {confianza}%
`{barra}`

📌 *Factores clave:*
{factores}
{bloque_adv}
🏷 _{consenso.get('veredicto', '')}_
━━━━━━━━━━━━━━━━━━━━
_⚠️ Solo análisis estadístico. Apuesta con responsabilidad._"""
