import logging
import asyncio
from apscheduler.schedulers.background import BackgroundScheduler
from analyzer import buscar_y_analizar_partidos, formatear_mensaje_telegram
from config import GRUPOS, HORAS_PUBLICACION

logger = logging.getLogger(__name__)

def publicar_analisis(app):
    logger.info("⏰ Buscando partidos...")
    try:
        partidos = buscar_y_analizar_partidos()
        if not partidos:
            logger.warning("No se encontraron partidos.")
            return
        for partido in partidos:
            mensaje = formatear_mensaje_telegram(partido)
            for grupo_id in GRUPOS:
                try:
                    asyncio.run(
                        app.bot.send_message(
                            chat_id=grupo_id,
                            text=mensaje,
                            parse_mode="Markdown"
                        )
                    )
                    logger.info(f"✅ Publicado en {grupo_id}: {partido.get('match')}")
                except Exception as e:
                    logger.error(f"❌ Error en grupo {grupo_id}: {e}")
    except Exception as e:
        logger.error(f"❌ Error general: {e}")

def iniciar_scheduler(app):
    scheduler = BackgroundScheduler(timezone="America/New_York")
    for hora_str in HORAS_PUBLICACION:
        hora, minuto = hora_str.split(":")
        scheduler.add_job(
            publicar_analisis,
            trigger="cron",
            hour=int(hora),
            minute=int(minuto),
            args=[app]
        )
        logger.info(f"⏰ Programado para las {hora_str}")
    scheduler.start()
    logger.info("✅ Scheduler activo.")
