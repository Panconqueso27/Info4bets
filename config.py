# ============================================
# CONFIGURACIÓN — rellena estos valores
# ============================================

# 1. Token de tu bot de Telegram
#    Créalo hablando con @BotFather en Telegram
TELEGRAM_TOKEN = "TU_TOKEN_AQUI"

# 2. IDs de los grupos donde publicará el bot
#    Para obtener el ID: añade @userinfobot a tu grupo
GRUPOS = [
    -1001234567890,   # Grupo 1 — sustituye por el ID real
    # -1009876543210, # Grupo 2 — descomenta para añadir más
]

# 3. Tu API key de Anthropic (claude.ai/settings)
ANTHROPIC_API_KEY = "TU_API_KEY_AQUI"

# 4. Deportes que quieres cubrir
DEPORTES = ["fútbol", "NBA", "tenis"]

# 5. Horario de publicaciones (hora del servidor, UTC)
#    El bot publicará análisis a estas horas cada día
HORAS_PUBLICACION = ["08:00", "12:00", "17:00", "20:00"]

# 6. Mensaje de aviso legal (aparece al pie de cada análisis)
DISCLAIMER = "⚠️ Solo análisis estadístico. No garantiza resultados. Apuesta con responsabilidad."
