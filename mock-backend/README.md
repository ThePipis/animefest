# AnimeFest Backend - Optimized Server Performance

Backend optimizado para AnimeFest con caché inteligente, scraping concurrente y endpoints de alta performance.

## 🚀 Características de Performance

- **Cold Load**: ≤ 2.5s para lista completa de servidores
- **Warm Load**: ≤ 600ms con caché SWR
- **Caché Inteligente**: LRU local + Redis opcional con stale-while-revalidate
- **Scraping Optimizado**: Puppeteer con una sola página, bloqueo de recursos y concurrencia limitada
- **Deduplicación**: Requests simultáneos para la misma clave comparten el mismo Promise
- **Degradación Elegante**: Servidores fallidos se marcan como `status: 'degraded'` sin romper la lista

## 📦 Instalación

```bash
cd mock-backend
npm install
cp .env.example .env
# Configurar variables de entorno según necesidades
npm run dev
```

## ⚙️ Configuración

### Variables de Entorno (`.env`)

```bash
# Database
DATABASE_URL=./db/database.sqlite
JWT_SECRET=your-super-secret-jwt-key-here

# Redis (Opcional - fallback a LRU si no se configura)
REDIS_URL=redis://localhost:6379

# Performance Tuning
SCRAPE_CONCURRENCY=5        # Número de servidores procesados en paralelo
SCRAPE_TIMEOUT_MS=8000      # Timeout por servidor individual
PORT=3001
NODE_ENV=development
```

### Activar Redis (Opcional)

1. **Instalar Redis**:
   ```bash
   # Windows (con Chocolatey)
   choco install redis-64
   
   # Docker
   docker run -d -p 6379:6379 redis:alpine
   ```

2. **Configurar en `.env`**:
   ```bash
   REDIS_URL=redis://localhost:6379
   ```

3. **Fallback Automático**: Si Redis no está disponible, usa caché LRU en memoria.

## 🔥 Nuevos Endpoints Optimizados

### GET `/api/v1/servers`
Obtiene servidores con caché SWR y deduplicación.

```bash
# Ejemplo básico
curl "http://localhost:3001/api/v1/servers?slug=una-pareja-de-cucos-s2-latino&ep=1"

# Respuesta
{
  "success": true,
  "data": {
    "slug": "una-pareja-de-cucos-s2-latino",
    "episode": 1,
    "servers": [
      {
        "nombre": "streamwish",
        "iframe": "https://embedwish.com/e/xyz123",
        "prioridad": 1,
        "servidor": "streamwish",
        "url": "https://streamwish.com/xyz123",
        "status": "active"
      }
    ],
    "meta": {
      "total": 6,
      "active": 5,
      "degraded": 1,
      "responseTime": 245
    }
  }
}
```

### GET `/api/v1/servers/stream` (Server-Sent Events)
Stream de servidores con resultados parciales en tiempo real.

```bash
curl -N "http://localhost:3001/api/v1/servers/stream?slug=una-pareja-de-cucos-s2-latino&ep=1"

# Respuesta SSE
data: {"type":"start","timestamp":1691234567890}

data: {"type":"complete","data":{"servers":[...],"fromCache":false,"responseTime":1850}}
```

### GET `/api/v1/servers/cache/stats`
Estadísticas del caché para debugging.

```bash
curl "http://localhost:3001/api/v1/servers/cache/stats"

# Respuesta
{
  "success": true,
  "data": {
    "lruSize": 45,
    "maxLRUSize": 1000,
    "useRedis": true,
    "pendingRequests": 2
  }
}
```

### DELETE `/api/v1/servers/cache`
Invalidar caché específico.

```bash
curl -X DELETE "http://localhost:3001/api/v1/servers/cache?slug=una-pareja-de-cucos-s2-latino&ep=1"
```

## 📊 Benchmarking

### Ejecutar Benchmark

```bash
# Benchmark básico (slug y episodio por defecto)
npm run bench:servers

# Benchmark específico
npm run bench:servers -- --slug una-pareja-de-cucos-s2-latino --ep 1

# Auto-tuning automático
npm run bench:servers -- --auto-tune
```

### Ejemplo de Salida

```
🚀 Starting benchmark for una-pareja-de-cucos-s2-latino:1
📍 Base URL: http://localhost:3001
============================================================

📊 Running COLD tests (3 iterations)...
----------------------------------------
✅ Cold 1/3: 2340ms (6 servers: 5 active, 1 degraded)
✅ Cold 2/3: 2180ms (6 servers: 6 active, 0 degraded)
✅ Cold 3/3: 2450ms (6 servers: 5 active, 1 degraded)

🔥 Running WARM tests (3 iterations)...
----------------------------------------
✅ Warm 1/3: 120ms (6 servers: 5 active, 1 degraded)
✅ Warm 2/3: 95ms (6 servers: 6 active, 0 degraded)
✅ Warm 3/3: 110ms (6 servers: 5 active, 1 degraded)

📈 BENCHMARK RESULTS
============================================================
🧊 COLD Performance:
   Mean: 2323ms
   P95:  2450ms
   Target: ≤ 2500ms
   Status: ✅ PASS

🔥 WARM Performance:
   Mean: 108ms
   P95:  120ms
   Target: ≤ 600ms
   Status: ✅ PASS

🏥 SERVER HEALTH:
   Total servers: 6
   Active: 5
   Degraded: 1
   Health: ⚠️ PARTIAL

🎯 OVERALL ASSESSMENT: ✅ PASS
============================================================
```

## 🏗️ Arquitectura de Optimización

### 1. Caché Inteligente (`lib/cache.js`)
- **LRU Cache**: Fallback en memoria (1000 entradas, TTL 20min)
- **Redis**: Cache distribuido opcional
- **SWR**: Stale-while-revalidate (respuesta inmediata + refresh en background)
- **Deduplicación**: Requests simultáneos comparten el mismo Promise

### 2. Scraping Optimizado (`scraper/`)
- **Browser Global**: Una instancia de Puppeteer reutilizada
- **Bloqueo de Recursos**: Imágenes, fuentes, CSS bloqueados para velocidad
- **Una Sola Página**: Extracción de todos los servidores sin abrir nuevas páginas
- **Concurrencia Limitada**: Control de carga con `p-limit`
- **Timeouts Cortos**: Respuesta rápida con retries exponenciales

### 3. Endpoints Optimizados
- **Cache Headers**: ETag, Cache-Control con stale-while-revalidate
- **Compresión**: Gzip automático para todas las respuestas
- **SSE**: Server-Sent Events para resultados parciales
- **Logging Estructurado**: JSON logs con métricas de performance

## 🔧 Tuning de Performance

### Ajustar Concurrencia
```bash
# Aumentar para servidores potentes
SCRAPE_CONCURRENCY=8

# Reducir para evitar rate limiting
SCRAPE_CONCURRENCY=3
```

### Ajustar Timeouts
```bash
# Conexiones rápidas
SCRAPE_TIMEOUT_MS=5000

# Conexiones lentas
SCRAPE_TIMEOUT_MS=12000
```

### Monitoreo
Los logs estructurados incluyen métricas de timing:
- `t_nav`: Tiempo de navegación
- `t_extract`: Tiempo de extracción
- `t_total`: Tiempo total
- `duration`: Tiempo de respuesta por endpoint

## 🔄 Migración desde Versión Anterior

Los endpoints existentes siguen funcionando sin cambios. La función `obtenerServidoresDesdeLatAnime` ahora delega a la versión optimizada automáticamente.

### Rutas Compatibles
- `GET /reproducir?animeSlug=X&episodio=Y` - Mantiene compatibilidad
- `GET /catalogo` - Sin cambios
- `GET /animes` - Sin cambios
- Todas las rutas de autenticación y admin - Sin cambios

## 🧪 Testing

### Verificar Health
```bash
curl http://localhost:3001/health
```

### Test de Cache
```bash
# Primera request (cold)
time curl "http://localhost:3001/api/v1/servers?slug=test&ep=1"

# Segunda request (warm)
time curl "http://localhost:3001/api/v1/servers?slug=test&ep=1"
```

### Test SSE
```bash
curl -N "http://localhost:3001/api/v1/servers/stream?slug=test&ep=1"
```

## 🐛 Troubleshooting

### Performance Issues
1. **Cold > 2.5s**: Aumentar `SCRAPE_CONCURRENCY`, reducir `SCRAPE_TIMEOUT_MS`
2. **Warm > 600ms**: Verificar conexión Redis, revisar logs de caché
3. **Muchos Degraded**: Revisar conectividad a latanime.org, ajustar timeouts

### Cache Issues
1. **No Cache Hits**: Verificar Redis connection, revisar logs
2. **Stale Data**: Ajustar TTL en `lib/cache.js`
3. **Memory Usage**: Reducir `maxLRUSize` en cache.js

### Debugging
```bash
# Logs detallados
NODE_ENV=development npm run dev

# Stats de caché
curl http://localhost:3001/api/v1/servers/cache/stats

# Limpiar caché específico
curl -X DELETE "http://localhost:3001/api/v1/servers/cache?slug=test&ep=1"
```

## 📈 Métricas de Éxito

- ✅ **Cold Load**: ≤ 2500ms
- ✅ **Warm Load**: ≤ 600ms  
- ✅ **Degradación Elegante**: Servidores fallidos no rompen la lista
- ✅ **Compatibilidad**: APIs existentes sin cambios
- ✅ **Observabilidad**: Logs estructurados + benchmarking automático
