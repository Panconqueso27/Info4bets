import logging
from telegram.ext import ApplicationBuilder
from scheduler import iniciar_scheduler
from config import TELEGRAM_TOKEN

logging.basicConfig(
    format="%(asctime)s - %(levelname)s - %(message)s",
    level=logging.INFO
)

def main():
    print("🤖 BetAnalyzer Pro arrancando...")
    app = ApplicationBuilder().token(TELEGRAM_TOKEN).build()
    iniciar_scheduler(app)
    print("✅ Bot activo.")
    app.run_polling(allowed_updates=[])

if __name__ == "__main__":
    main()
