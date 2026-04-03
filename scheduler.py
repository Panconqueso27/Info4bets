import asyncio
import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from telegram.ext import Application
from analyzer import buscar_y_analizar_partidos, formatear_mensaje_telegram
from config import GRUPOS, HORAS_PUBLICACION

logger = logging.getLogger(__name__)

async def publicar_analisis(app: Application):
    """
    Función principal que se ejecuta automáticamente.
    Busca partidos, los analiza y publica en todos los grupos.
    """
    logger.info("⏰ Iniciando ciclo de análisis automático...")

    try:
        partidos = buscar_y_analizar_partidos()

        if not partidos:
            logger.warning("⚠️ No se encontraron partidos para analizar.")
            return

        logger.info(f"✅ {len(partidos)} partidos encontrados. Publicando...")

        for partido in partidos:
            mensaje = formatear_mensaje_telegram(partido)

            for grupo_id in GRUPOS:
                try:
                    await app.bot.send_message(
                        chat_id=grupo_id,
                        text=mensaje,
                        parse_mode="Markdown"
                    )
                    logger.info(f"📤 Publicado en grupo {grupo_id}: {partido.get('match')}")
                    await asyncio.sleep(2)  # pausa entre grupos para no saturar

                except Exception as e:
                    logger.error(f"❌ Error publicando en grupo {grupo_id}: {e}")

    except Exception as e:
        logger.error(f"❌ Error general en ciclo de análisis: {e}")


def iniciar_scheduler(app: Application):
    """
    Configura el scheduler para publicar automáticamente
    a las horas definidas en config.py
    """
    scheduler = AsyncIOScheduler(timezone="America/New_York")

    for hora_str in HORAS_PUBLICACION:
        hora, minuto = hora_str.split(":")
        scheduler.add_job(
            publicar_analisis,
            trigger="cron",
            hour=int(hora),
            minute=int(minuto),
            args=[app],
            id=f"analisis_{hora_str}",
            replace_existing=True
        )
        logger.info(f"⏰ Análisis programado para las {hora_str}")

    scheduler.start()
    logger.info("✅ Scheduler activo.")
