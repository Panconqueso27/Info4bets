import time
import schedule
import requests
import anthropic
import json
import logging

logging.basicConfig(
    format="%(asctime)s - %(levelname)s - %(message)s",
    level=logging.INFO
)

# ============ CONFIGURACION ============
TELEGRAM_TOKEN = "8629684517:AAFvPvHbTHrQ2NidcvZsYJoYAnwqcQIQr7Y"
GRUPOS = [5053492145]
ANTHROPIC_API_KEY = "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"
DEPORTES = ["fútbol", "NBA", "tenis"]
HORAS = ["09:00", "13:00", "17:00", "20:00"]
# =======================================

TELEGRAM_URL = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}"

client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

SYSTEM_PROMPT = """Eres BetAnalyzer Pro, experto en análisis deportivo para apuestas.
Usa web_search para buscar los partidos más importantes de HOY y analízalos.
Responde SOLO con JSON válido, sin texto extra, sin backticks, sin markdown:
{
  "partidos": [
    {
      "match": "Equipo A vs Equipo B",
      "liga": "Nombre liga",
      "hora": "21:00h",
      "tipsters": [
        {"nombre": "El Estadístico", "pick": "Victoria local", "razon": "Razón breve.", "confianza": 75},
        {"nombre": "El Táctico", "pick": "Victoria local", "razon": "Razón breve.", "confianza": 70},
        {"nombre": "El Conservador", "pick": "Doble chance 1X", "razon": "Razón breve.", "confianza": 60}
      ],
      "consenso": {
        "pick": "Victoria local",
        "confianza": 72,
        "veredicto": "APOSTAR CON PRECAUCIÓN",
        "factores": ["Factor 1", "Factor 2", "Factor 3"],
        "advertencia": null
      }
    }
  ]
}"""


def send_telegram(grupo_id, mensaje):
    try:
        r = requests.post(f"{TELEGRAM_URL}/sendMessage", json={
            "chat_id": grupo_id,
            "text": mensaje,
            "parse_mode": "Markdown"
        }, timeout=30)
        if r.status_code == 200:
            logging.info(f"✅ Mensaje enviado a {grupo_id}")
        else:
            logging.error(f"❌ Error Telegram: {r.text}")
    except Exception as e:
        logging.error(f"❌ Error enviando mensaje: {e}")


def analizar_partidos():
    deportes_str = ", ".join(DEPORTES)
    try:
        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=4000,
            system=SYSTEM_PROMPT,
            tools=[{"type": "web_search_20250305", "name": "web_search"}],
            messages=[{
                "role": "user",
                "content": f"Busca y analiza los 3 partidos más importantes de HOY en: {deportes_str}."
            }]
        )
        for bloque in response.content:
            if bloque.type == "text":
                texto = bloque.text.strip()
                try:
                    data = json.loads(texto)
                    return data.get("partidos", [])
                except:
                    pass
        return []
    except Exception as e:
        logging.error(f"❌ Error Claude API: {e}")
        return []


def formatear_mensaje(partido):
    consenso = partido.get("consenso", {})
    tipsters = partido.get("tipsters", [])
    confianza = consenso.get("confianza", 0)

    emoji = "🟢" if confianza >= 80 else "🟡" if confianza >= 65 else "🔴"
    barra = "█" * round(confianza / 10) + "░" * (10 - round(confianza / 10))

    lineas = ""
    for t in tipsters:
        lineas += f"• *{t['nombre']}* → {t['pick']} ({t['confianza']}%)\n_{t['razon']}_\n\n"

    factores = "\n".join([f"→ {f}" for f in consenso.get("factores", [])])
    adv = consenso.get("advertencia")
    bloque_adv = f"\n⚠️ _{adv}_\n" if adv else ""

    return f"""⚽ *{partido.get('match', '')}*
🏆 {partido.get('liga', '')} · {partido.get('hora', '')}

📊 *Análisis de 3 Tipsters:*
{lineas}
━━━━━━━━━━━━━━━━━━━━
🎯 *VEREDICTO FINAL*
Pick: *{consenso.get('pick', '')}*
Confianza: {emoji} {confianza}%
`{barra}`

📌 *Factores clave:*
{factores}
{bloque_adv}
🏷 _{consenso.get('veredicto', '')}_
━━━━━━━━━━━━━━━━━━━━
_⚠️ Solo análisis estadístico. Apuesta con responsabilidad._"""


def ciclo_publicacion():
    logging.info("⏰ Iniciando ciclo de publicación...")
    partidos = analizar_partidos()
    if not partidos:
        logging.warning("No se encontraron partidos.")
        return
    for partido in partidos:
        mensaje = formatear_mensaje(partido)
        for grupo_id in GRUPOS:
            send_telegram(grupo_id, mensaje)
            time.sleep(2)


# Programar publicaciones
for hora in HORAS:
    schedule.every().day.at(hora).do(ciclo_publicacion)
    logging.info(f"⏰ Programado para las {hora}")

logging.info("🤖 BetAnalyzer Pro activo y esperando...")

# Loop principal
while True:
    schedule.run_pending()
    time.sleep(30)
