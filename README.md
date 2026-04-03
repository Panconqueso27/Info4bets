# 🤖 BetAnalyzer Pro — Bot de Telegram

Bot automatizado que publica análisis deportivos en grupos de Telegram usando Claude AI con búsqueda web en tiempo real.

---

## ⚡ Setup en 15 minutos

### PASO 1 — Crear tu bot en Telegram
1. Abre Telegram y busca `@BotFather`
2. Escríbele `/newbot`
3. Ponle un nombre (ej: BetAnalyzer Pro)
4. Copia el **Token** que te da y pégalo en `config.py`

### PASO 2 — Obtener el ID de tu grupo
1. Añade `@userinfobot` a tu grupo de Telegram
2. Escribe cualquier mensaje en el grupo
3. El bot te responderá con el ID del grupo (número negativo como -1001234567890)
4. Pégalo en `GRUPOS` dentro de `config.py`
5. Añade tu bot al grupo y dale permisos de administrador

### PASO 3 — API Key de Anthropic
1. Ve a https://console.anthropic.com
2. Crea una API key
3. Pégala en `ANTHROPIC_API_KEY` en `config.py`

### PASO 4 — Subir a Render.com (GRATIS)
1. Crea cuenta en https://render.com
2. Crea un nuevo "Web Service"
3. Conecta tu repositorio de GitHub con estos archivos
4. En "Start Command" pon: `python bot.py`
5. En "Environment Variables" añade las keys si prefieres no tenerlas en el código
6. Deploy — el bot corre 24/7 gratis

---

## 📁 Estructura de archivos

```
betanalyzer/
├── bot.py           # Punto de entrada principal
├── analyzer.py      # Motor de análisis con Claude + web search
├── scheduler.py     # Publicación automática programada
├── config.py        # Tu configuración (token, grupos, horarios)
└── requirements.txt # Dependencias
```

---

## ⚙️ Personalización

### Cambiar horarios de publicación
En `config.py`, modifica `HORAS_PUBLICACION`:
```python
HORAS_PUBLICACION = ["09:00", "13:00", "18:00", "21:00"]
```

### Añadir más grupos
```python
GRUPOS = [
    -1001111111111,  # Grupo VIP
    -1002222222222,  # Grupo gratuito
    -1003333333333,  # Grupo premium
]
```

### Cambiar deportes cubiertos
```python
DEPORTES = ["fútbol", "NBA", "tenis", "NFL", "MMA"]
```

---

## 💰 Costos operativos estimados

| Servicio | Plan | Costo |
|---|---|---|
| Render.com | Free tier | $0/mes |
| Claude Haiku API | ~150 análisis/mes | ~$3-5/mes |
| Telegram Bot API | Siempre gratis | $0/mes |
| **Total** | | **~$5/mes** |

---

## ⚠️ Aviso Legal

Este bot proporciona análisis estadístico con fines informativos únicamente.
No garantiza resultados en apuestas deportivas. El usuario es responsable
de sus decisiones de apuesta. Promueve el juego responsable.
