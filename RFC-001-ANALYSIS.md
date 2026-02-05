# RFC-001 Analysis: ¿Deberíamos implementar esto ahora?

## Lo Que Propone el RFC

Transformar prjct de **task tracker** a **AI development orchestrator**:

```
ANTES:  p. task → work → p. done → p. ship

DESPUÉS: p. prd → p. plan → p. task → work → p. done → p. ship → p. impact
```

Nuevos sistemas:
- PRDs obligatorios antes de features
- Roadmap con quarters y capacidad
- Impact tracking post-ship
- Dashboard de salud del proyecto
- Trazabilidad completa: PRD → Feature → Task → Outcome

---

## Beneficios Reales

### 1. Diferenciación de Mercado

**Problema actual**: prjct compite en el espacio de "context management" donde hay alternativas (Continue, Aider configs, manual CLAUDE.md).

**Con RFC-001**: prjct sería el único tool que conecta:
- Planificación (PRD)
- Ejecución (Task)
- Medición (Impact)

**Ningún competidor hace esto.** Ni Claude Code, ni Cursor, ni Continue.

### 2. Valor Visible (Tu problema #1)

**Problema actual**: 70% del valor de prjct es invisible.

**Con RFC-001**:
```
$ p. dashboard

ESTIMATE ACCURACY     52% (Need calibration!)
SUCCESS RATE          87% (7/8 features met targets)
TOTAL HOURS INVESTED  127h
```

El valor se vuelve **medible y visible**.

### 3. Justificación para Pro/Team

**Problema actual**: ¿Por qué pagar $8/mo si el CLI gratis hace todo?

**Con RFC-001**:
- Free: Task management básico
- Pro: Analytics, estimate accuracy, ROI tracking
- Team: Shared roadmaps, team velocity, capacity planning

**El upgrade tiene sentido obvio.**

### 4. Lock-in Positivo

**Problema actual**: Fácil dejar de usar prjct.

**Con RFC-001**:
- Tu historial de PRDs está en prjct
- Tus learnings acumulados
- Tu accuracy de estimación

**Switching cost alto = retención alta.**

### 5. Dogfooding Perfecto

prjct puede usarse para desarrollar prjct. Cada feature de prjct tendría:
- PRD
- Estimación
- Outcome
- Learning

**Self-improvement documentado.**

---

## Retos y Costos

### 1. Complejidad de Implementación

**El RFC agrega:**
- 4 nuevos schemas (PRD, Enhanced Roadmap, Outcomes, Analytics)
- 4 nuevos comandos (prd, plan, impact, dashboard)
- Enforcement engine
- Value calculation
- ROI formulas

**Estimación realista**: 3-4 semanas de desarrollo full-time.

### 2. Fricción para Usuarios

**Riesgo**:
```
Usuario: p. task "fix bug"
prjct: "No PRD found. Would you like to generate one?"
Usuario: "WTF I just want to fix a bug"
```

**Mitigation**: El RFC propone enforcement levels (Strict/Standard/Relaxed/Off).
Pero hay que calibrar bien el default.

### 3. Timing

**Situación actual**:
- Website en desarrollo
- Pricing recién definido
- 74 tickets en backlog
- Linear SDK migration pendiente

**Pregunta**: ¿Es momento de agregar más scope?

### 4. Adoption Risk

**El RFC cambia el mental model**:
- Antes: "prjct ayuda con contexto"
- Después: "prjct es tu PM + tracker + analytics"

**Riesgo**: Usuarios que querían algo simple se van.
**Oportunidad**: Usuarios que quieren algo serio llegan.

### 5. Dependencia de AI Quality

El RFC depende de que el AI genere buenos PRDs. Si los PRDs generados son malos, el sistema entero falla.

---

## Análisis Honesto: ¿Ahora o Después?

### Argumentos para AHORA

1. **Diferenciación urgente** — El mercado de AI coding tools está crowded. prjct necesita destacar.

2. **Justifica el pricing** — Sin esto, es difícil explicar por qué Pro vale $8.

3. **El código base está listo** — Ya tienes storage layer, templates, state management.

4. **Dogfooding** — Puedes usar el sistema para construir el sistema.

### Argumentos para DESPUÉS

1. **Primero el website** — Necesitas usuarios antes de features complejas.

2. **Validar demanda** — ¿Los usuarios realmente quieren PRDs obligatorios?

3. **Technical debt** — 74 tickets en backlog. Agregar más scope es riesgoso.

4. **Complejidad del copy** — Ya es difícil explicar qué hace prjct. Con esto es más difícil.

---

## Mi Recomendación

### Implementar en Fases, No Todo a la Vez

**Fase 0 (Ahora)**: Website + Pricing + UX improvements
- Lanzar prjct.app
- Implementar los tickets de TUX (PRJ-129 a PRJ-140)
- Linear SDK migration

**Fase 1 (Post-launch)**: PRD Básico
- Solo `p. prd` command
- Sin enforcement
- Modo "opt-in"
- Valida si usuarios lo adoptan

**Fase 2 (Si Fase 1 funciona)**: Roadmap + Planning
- `p. plan` command
- Quarter planning
- Dependency tracking

**Fase 3 (Product-market fit)**: Full Orchestration
- Impact tracking
- Dashboard
- Enforcement modes
- Analytics avanzados

### Por Qué Fases

1. **Validas hipótesis** antes de invertir todo
2. **Feedback real** de usuarios
3. **No bloqueas** el launch del website
4. **Reduces riesgo** de over-engineering

---

## El Reto Real

El RFC es bueno. El timing es la pregunta.

**Situación actual**:
```
- Website: No existe
- Usuarios: Pocos
- Revenue: $0
- Backlog: 74 tickets
- Features invisibles: 70%
```

**Prioridad sugerida**:
```
1. Website live (atraer usuarios)
2. UX visible (mostrar valor)
3. Pro/Team diferenciado (generar revenue)
4. LUEGO: Orchestration layer (retención + expansion)
```

El RFC-001 es para **retención y expansion**.
Pero primero necesitas **adquisición**.

---

## Conclusión

### ✅ Beneficios del RFC
- Diferenciación única en el mercado
- Valor visible y medible
- Justificación clara para Pro/Team
- Lock-in positivo
- Self-improvement loop

### ⚠️ Riesgos
- Complejidad de implementación (3-4 semanas)
- Posible fricción para usuarios casuales
- Timing vs otras prioridades
- Cambio de mental model

### 🎯 Recomendación
**Aprobarlo para roadmap, no para implementación inmediata.**

Orden sugerido:
1. Launch website
2. UX improvements (valor visible)
3. Fase 1 del RFC (PRD opt-in)
4. Validar adopción
5. Fases 2-3 si Fase 1 funciona

---

## Pregunta para Ti

¿El objetivo ahora es:

**A) Adquisición** — Conseguir usuarios nuevos
→ Prioriza website, copy, onboarding

**B) Retención** — Mantener usuarios existentes
→ Prioriza RFC-001, analytics, value visibility

**C) Ambos en paralelo**
→ Posible pero requiere más tiempo

¿Cuál es?
