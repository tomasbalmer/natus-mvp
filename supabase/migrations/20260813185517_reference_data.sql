-- Natus MVP — reference data
--
-- Generated from the JSON seeds in data/ rather than transcribed. Those
-- files remain the source of truth for the demo's fixture path, so a seed
-- edit and this table cannot drift into disagreeing about what a modality
-- says. Regenerate rather than hand-edit.
--
-- Idempotent: every insert upserts on its primary key, so re-running this
-- against a database that already holds it is a no-op rather than an error.

-- PDR 5.3 — 21 modalities. The recommendation pool.
insert into public.modalities (
  slug, name_es, name_en, family, short_description, what_happens,
  works_well_for, typical_format, typical_horizon, intensity,
  evidence_level, contraindications, requires_clinical_support, is_active
) values
  ('psicologia-clinica', 'Psicología clínica', 'Clinical psychology', 'psicologica', 'Terapia con un profesional de la salud mental, sostenida en el tiempo.', 'Conversás una hora por semana con un psicólogo o psicóloga. Contás lo que te pasa y esa persona te devuelve lecturas, hipótesis y preguntas. No hay técnica única: cada profesional trabaja desde su corriente. Lo que sostiene el proceso es el vínculo, y por eso los primeros encuentros son también para ver si esa persona te hace sentido.', array['ansiedad', 'depresion', 'duelo', 'trauma', 'autoestima', 'transiciones', 'identidad', 'alimentacion', 'sexualidad']::text[], '1:1 semanal', 'long', 3, 'clinica', '{}', false, true),
  ('terapia-gestalt', 'Terapia gestalt', 'Gestalt therapy', 'psicologica', 'Terapia centrada en lo que te está pasando ahora, no en reconstruir el pasado.', 'En vez de analizar por qué te pasa algo, el foco está en cómo te pasa en este momento: qué hacés con las manos cuando lo contás, qué evitás mirar, qué frase se te corta. Es habitual que te propongan ejercicios en la sesión, como hablarle a una silla vacía donde ubicás a alguien de tu vida. Suena raro dicho así, y funciona por eso mismo: saca la conversación del plano de la explicación.', array['ansiedad', 'autoestima', 'pareja', 'duelo', 'identidad', 'transiciones']::text[], '1:1 semanal', 'medium', 3, 'emergente', '{}', false, true),
  ('psicologia-transpersonal', 'Psicología transpersonal', 'Transpersonal psychology', 'psicologica', 'Terapia que incluye lo espiritual como material de trabajo, no como creencia aparte.', 'Es una terapia conversada, con la diferencia de que las experiencias que no entran en el marco clínico habitual — un sueño que te marcó, una experiencia de sentido, una crisis de fe — se toman como material legítimo en vez de sortearlas. Se trabaja con biografía, símbolo e imaginación. No pide que creas en nada en particular.', array['proposito', 'espiritualidad', 'transiciones', 'duelo', 'identidad']::text[], '1:1 semanal', 'long', 3, 'emergente', '{}', false, true),
  ('terapia-somatica', 'Terapia somática', 'Somatic therapy', 'corporal', 'Trabaja desde la sensación física antes que desde el relato.', 'Te van a pedir que notés dónde sentís algo en el cuerpo antes de explicarlo: el pecho que se cierra, la mandíbula tensa, el estómago. Se avanza despacio y en dosis chicas, alternando entre acercarse a lo difícil y volver a un lugar donde te sentís estable. Casi siempre es sentado y hablando; el contacto físico, si lo hay, se acuerda antes.', array['trauma', 'ansiedad', 'duelo', 'autoestima', 'alimentacion', 'sexualidad']::text[], '1:1 semanal', 'medium', 3, 'emergente', '{}', false, true),
  ('terapia-sistemica', 'Terapia sistémica y familiar', 'Systemic and family therapy', 'psicologica', 'Mira el problema como algo del vínculo, no de una persona.', 'Podés ir solo, en pareja o con tu familia. La pregunta no es quién tiene el problema sino qué hace el sistema para que el problema siga en su lugar. Se dibujan mapas del árbol familiar, se rastrean patrones que se repiten entre generaciones y se prueban cambios chicos en cómo circula la información entre las personas.', array['pareja', 'familia', 'adicciones', 'identidad', 'transiciones', 'sexualidad']::text[], '1:1 semanal', 'medium', 3, 'clinica', '{}', false, true),
  ('tcc', 'Terapia cognitivo-conductual', 'Cognitive behavioural therapy', 'psicologica', 'Estructurada, con tareas y un plazo definido desde el principio.', 'Se acuerdan objetivos concretos en las primeras sesiones y se trabaja hacia ellos con una agenda por encuentro. Vas a registrar situaciones, pensamientos y reacciones entre sesión y sesión, y a probar experimentos en tu vida real para chequear si lo que suponés se cumple. Es la modalidad más directiva de la lista y suele durar entre tres y seis meses.', array['ansiedad', 'depresion', 'alimentacion', 'adicciones', 'autoestima']::text[], '1:1 semanal', 'short', 2, 'clinica', '{}', false, true),
  ('emdr', 'EMDR', 'EMDR', 'psicologica', 'Protocolo específico para recuerdos traumáticos, con un profesional formado.', 'Traés un recuerdo concreto mientras seguís con los ojos el movimiento de una mano, o recibís golpecitos alternados en las manos. Ese estímulo de lado a lado se repite en tandas cortas, con pausas para decir qué apareció. La sensación habitual es que el recuerdo pierde carga sin que hayas tenido que contarlo en detalle. No es una charla: es un protocolo con pasos.', array['trauma', 'ansiedad', 'duelo']::text[], '1:1 semanal', 'short', 4, 'clinica', array['Requiere estabilidad previa: no se empieza en medio de una crisis aguda.']::text[], true, true),
  ('coaching-ontologico', 'Coaching ontológico', 'Ontological coaching', 'psicologica', 'Orientado a la acción y a decisiones concretas, no a procesar el pasado.', 'Se trabaja sobre una situación que querés mover: un cambio de trabajo, una conversación que venís postergando, una decisión trabada. El foco está en cómo hablás de eso y en qué compromisos asumís para la semana siguiente. Es corto, orientado a resultados, y no es terapia: si aparece algo clínico, un buen coach te lo dice y deriva.', array['desarrollo-profesional', 'proposito', 'transiciones', 'autoestima']::text[], '1:1 semanal', 'short', 2, 'emergente', array['No sustituye tratamiento clínico en depresión, ansiedad severa o consumo problemático.']::text[], false, true),
  ('constelaciones-familiares', 'Constelaciones familiares', 'Family constellations', 'simbolica', 'Trabajo grupal e intenso donde otras personas representan a tu familia.', 'En un taller con desconocidos, elegís personas del grupo para que ocupen el lugar de miembros de tu familia y las ubicás en el espacio. Después se observa qué pasa: quién mira a quién, quién no puede quedarse quieto. Es breve, muy cargado emocionalmente, y muchas veces remueve cosas que después necesitan acompañamiento. No hay evidencia clínica que lo respalde; es una práctica de tradición.', array['familia', 'duelo', 'identidad', 'pareja']::text[], 'taller intensivo', 'short', 5, 'tradicional', array['Desaconsejado en crisis activa, duelo reciente o cuadros disociativos.', 'Exponer tu historia familiar frente a un grupo no es reversible.']::text[], true, true),
  ('astrologia-psicologica', 'Astrología psicológica', 'Psychological astrology', 'simbolica', 'Usa la carta natal como lenguaje para pensarte, no para predecir.', 'Alguien lee tu carta natal con vos y traduce sus figuras a preguntas sobre tu vida: qué tensión aparece una y otra vez, qué se te da fácil, qué evitás. No se predice nada ni se dice qué va a pasar. Sirve como espejo y como vocabulario para nombrar cosas que ya intuías. Es tradición simbólica, no una disciplina con evidencia clínica.', array['proposito', 'identidad', 'transiciones', 'espiritualidad', 'autoestima']::text[], '1:1 semanal', 'flexible', 1, 'tradicional', '{}', false, true),
  ('numerologia', 'Numerología', 'Numerology', 'simbolica', 'Lee tu nombre y tu fecha de nacimiento como un mapa simbólico.', 'Se calculan unos pocos números a partir de tu nombre completo de nacimiento y tu fecha, y cada uno se lee como una imagen: el camino, lo que expresás, lo que buscás. Funciona como punto de partida para conversar sobre vos, más parecido a un test proyectivo que a un diagnóstico. Es tradición pitagórica, sin evidencia clínica.', array['proposito', 'identidad', 'espiritualidad']::text[], 'práctica autónoma', 'flexible', 1, 'tradicional', '{}', false, true),
  ('tarot-terapeutico', 'Tarot terapéutico', 'Therapeutic tarot', 'simbolica', 'Usa las imágenes de las cartas para abrir preguntas, no para adivinar.', 'Se tiran unas cartas y se conversa sobre lo que sus imágenes te evocan a vos, no sobre lo que significan en un manual. La pregunta que devuelve quien acompaña suele ser "¿qué ves acá?" antes que "esto quiere decir". La versión terapéutica se distingue de la adivinatoria justamente en eso: no habla del futuro.', array['identidad', 'transiciones', 'proposito', 'pareja']::text[], '1:1 semanal', 'flexible', 2, 'tradicional', array['Buscar certezas sobre el futuro en las cartas puede reforzar la ansiedad en vez de aliviarla.']::text[], false, true),
  ('reiki', 'Reiki y sanación energética', 'Reiki and energy healing', 'energetica', 'Sesión pasiva de imposición de manos, en silencio.', 'Te acostás vestido en una camilla y la persona apoya las manos sobre distintas zonas del cuerpo, o las mantiene apenas por encima, durante unos cuarenta minutos. Casi no se habla. Lo que reportan quienes lo practican es calor, hormigueo o sueño profundo. No hay evidencia de un mecanismo energético; lo que sí está documentado es el efecto de una hora de descanso, contacto y atención.', array['ansiedad', 'duelo', 'espiritualidad']::text[], '1:1 semanal', 'flexible', 1, 'tradicional', '{}', false, true),
  ('yoga-terapeutico', 'Yoga terapéutico', 'Therapeutic yoga', 'contemplativa', 'Yoga adaptado a una necesidad concreta, no una clase abierta.', 'A diferencia de una clase general, se arma una secuencia corta para vos y para algo puntual: dormir mejor, aflojar la espalda, bajar la activación. Se trabaja despacio, con posturas sostenidas y atención a la respiración, y la idea es que después la practiques sola en casa en diez o quince minutos.', array['ansiedad', 'depresion', 'trauma', 'autoestima']::text[], 'práctica autónoma', 'medium', 2, 'emergente', array['Avisar lesiones, embarazo o hipertensión antes de empezar.']::text[], false, true),
  ('mindfulness-meditacion', 'Mindfulness y meditación', 'Mindfulness and meditation', 'contemplativa', 'Entrenar la atención, con práctica diaria corta.', 'Aprendés a llevar la atención a algo concreto — la respiración, el cuerpo, los sonidos — y a volver ahí cada vez que la cabeza se va. Eso es toda la práctica: irse y volver, sin castigo. Los programas estructurados duran ocho semanas con un encuentro grupal por semana y práctica diaria de diez a treinta minutos. Es de lo más estudiado de esta lista.', array['ansiedad', 'depresion', 'adicciones', 'autoestima', 'espiritualidad']::text[], 'práctica autónoma', 'medium', 2, 'clinica', array['En trauma no procesado, la atención sostenida al cuerpo puede activar más de lo esperado: conviene empezar acompañada.']::text[], false, true),
  ('hipnosis', 'Hipnoterapia', 'Hypnotherapy', 'psicologica', 'Estado de atención focalizada guiado por un profesional formado.', 'Con los ojos cerrados y una voz que te guía, entrás en un estado de concentración parecido al de perderte en una película. No perdés el control ni la conciencia, y podés interrumpir cuando quieras. Desde ahí se trabaja con sugestiones acordadas de antemano o se revisan escenas concretas. Tiene evidencia para dolor, hábitos y ansiedad específica.', array['ansiedad', 'adicciones', 'alimentacion', 'trauma']::text[], '1:1 semanal', 'short', 4, 'clinica', array['Desaconsejada en cuadros psicóticos o disociativos.']::text[], true, true),
  ('biodanza', 'Biodanza', 'Biodanza', 'corporal', 'Movimiento y música en grupo, sin coreografía ni performance.', 'Un grupo de personas se mueve con música en una sala, siguiendo consignas simples: caminar, encontrarse, quedarse quieto. No hay pasos que aprender y no se baila para nadie. Hay ejercicios que incluyen contacto con otros, siempre opcionales. Lo que se busca es vitalidad y salir del registro mental, no interpretar nada.', array['depresion', 'autoestima', 'identidad', 'transiciones']::text[], 'grupal', 'flexible', 2, 'tradicional', array['Si el contacto físico con desconocidos te resulta difícil, avisalo antes: todo ejercicio es opcional.']::text[], false, true),
  ('flores-de-bach', 'Flores de Bach', 'Bach flower remedies', 'energetica', 'Preparados líquidos elegidos según el estado emocional.', 'En una entrevista de una hora se conversa sobre cómo estás y se arma una mezcla de unos pocos preparados florales que tomás en gotas durante algunas semanas. Después se revisa y se ajusta. Los ensayos controlados no encuentran efecto más allá del placebo; lo que sí hay es una conversación pautada sobre tu estado emocional cada tantas semanas.', array['ansiedad', 'duelo', 'transiciones']::text[], 'práctica autónoma', 'flexible', 1, 'tradicional', array['No reemplaza medicación psiquiátrica ni tratamiento clínico.']::text[], false, true),
  ('medicina-ancestral', 'Medicina ancestral y chamanismo', 'Ancestral medicine and shamanism', 'energetica', 'Ceremonias de tradición indígena, guiadas y de alta intensidad.', 'Ceremonias que pueden durar una noche entera, con canto, humo, música y a veces plantas. Se hacen en grupo y con un guía de la tradición. La experiencia es intensa y difícil de anticipar, y lo que se mueve ahí suele necesitar semanas de integración después. El marco legal de las plantas varía según el país.', array['proposito', 'espiritualidad', 'adicciones', 'duelo', 'trauma']::text[], 'taller intensivo', 'short', 5, 'tradicional', array['Contraindicado con antecedentes psicóticos, bipolaridad o medicación psiquiátrica activa.', 'Interacciones graves con antidepresivos.', 'El marco legal de las plantas varía según el país.']::text[], true, true),
  ('sound-healing', 'Sound healing', 'Sound healing', 'contemplativa', 'Sesión receptiva: te acostás y escuchás.', 'Te acostás con una manta y alguien hace sonar cuencos, gongs o campanas alrededor de la sala durante unos cuarenta minutos. No tenés que hacer nada. La mayoría se duerme o entra en un estado entre la vigilia y el sueño. Las frecuencias específicas que se nombran no tienen respaldo, pero el efecto de estar cuarenta minutos quieta escuchando es real.', array['ansiedad', 'duelo', 'espiritualidad']::text[], 'grupal', 'flexible', 1, 'emergente', array['Precaución con hipersensibilidad auditiva.']::text[], false, true),
  ('breathwork', 'Breathwork', 'Breathwork', 'contemplativa', 'Respiración pautada para regular el estado, en sesiones cortas.', 'Se practican patrones concretos de respiración durante unos minutos: alargar la exhalación, sostener el aire, contar tiempos. Con eso solo el cuerpo cambia de estado en cuestión de minutos, y es de lo más fácil de llevarse a casa. Las versiones intensas y prolongadas, del tipo holotrópico, son otra cosa: no se hacen sola y requieren acompañamiento.', array['ansiedad', 'trauma', 'depresion', 'adicciones']::text[], 'práctica autónoma', 'short', 3, 'emergente', array['Precaución con embarazo, epilepsia, hipertensión y cardiopatías.', 'Las variantes holotrópicas o de hiperventilación sostenida requieren acompañamiento y no entran en esta descripción.']::text[], false, true)
on conflict (slug) do update set
  name_es = excluded.name_es,
  name_en = excluded.name_en,
  family = excluded.family,
  short_description = excluded.short_description,
  what_happens = excluded.what_happens,
  works_well_for = excluded.works_well_for,
  typical_format = excluded.typical_format,
  typical_horizon = excluded.typical_horizon,
  intensity = excluded.intensity,
  evidence_level = excluded.evidence_level,
  contraindications = excluded.contraindications,
  requires_clinical_support = excluded.requires_clinical_support,
  is_active = excluded.is_active;

-- PDR 5.3 — 15 topics. The join key between what someone
-- describes and modalities.works_well_for.
insert into public.topics (slug, name_es, name_en) values
  ('ansiedad', 'Ansiedad', 'Anxiety'),
  ('depresion', 'Depresión', 'Depression'),
  ('duelo', 'Duelo y pérdida', 'Grief and loss'),
  ('pareja', 'Pareja y relaciones', 'Couples and relationships'),
  ('sexualidad', 'Sexualidad', 'Sexuality'),
  ('familia', 'Familia y crianza', 'Family and parenting'),
  ('trauma', 'Trauma', 'Trauma'),
  ('autoestima', 'Autoestima', 'Self-esteem'),
  ('proposito', 'Propósito de vida', 'Life purpose'),
  ('transiciones', 'Transiciones de vida', 'Life transitions'),
  ('espiritualidad', 'Espiritualidad', 'Spirituality'),
  ('adicciones', 'Adicciones', 'Addiction'),
  ('alimentacion', 'Trastornos alimentarios', 'Eating disorders'),
  ('desarrollo-profesional', 'Desarrollo profesional', 'Professional development'),
  ('identidad', 'Identidad y orientación', 'Identity and orientation')
on conflict (slug) do update set
  name_es = excluded.name_es, name_en = excluded.name_en;

-- PDR 6.4 — 16 resources, every one with verified_at null.
--
-- These numbers were transcribed from the PDR and have NOT been called.
-- Verification is by telephone, not by search, and it is an absolute
-- launch blocker. While verified_at is null the crisis screen renders an
-- unverified notice and shows the international fallback alongside.
--
-- Keyed on (country, name, contact) so re-running updates rather than
-- duplicating; there is no natural single-column key in the seed.
insert into public.crisis_resources
  (country, type, name, contact, note, priority, is_active, verified_at)
values
  ('CL', 'hotline', 'Salud Responde', '600 360 7777', 'Orientación en salud mental, 24 horas.', 1, true, null),
  ('CL', 'hotline', 'Fono Esperanza', '800 800 077', 'Escucha y contención.', 2, true, null),
  ('CL', 'hotline', 'Línea Libre', '1515', 'Para personas de 8 a 29 años.', 3, true, null),
  ('CL', 'emergency', 'Emergencias', '131', 'Ambulancia SAMU.', 4, true, null),
  ('MX', 'hotline', 'Línea de la Vida', '800 290 0024', 'Atención en crisis, 24 horas.', 1, true, null),
  ('MX', 'hotline', 'SAPTEL', '55 5259 8121', 'Apoyo psicológico por teléfono.', 2, true, null),
  ('MX', 'emergency', 'Emergencias', '911', null, 3, true, null),
  ('CO', 'hotline', 'Línea Salud Mental', '192', 'Marcar 192 y elegir la opción 4.', 1, true, null),
  ('CO', 'hotline', 'Línea Amiga', '106', 'Bogotá.', 2, true, null),
  ('CO', 'emergency', 'Emergencias', '123', null, 3, true, null),
  ('AR', 'hotline', 'Centro de Asistencia al Suicida', '135', 'Desde otras provincias: (011) 5275-1135.', 1, true, null),
  ('AR', 'hotline', 'Hablemos', '0800 345 1435', 'Escucha y orientación.', 2, true, null),
  ('AR', 'emergency', 'Emergencias', '911', null, 3, true, null),
  ('PE', 'hotline', 'Línea de Salud Mental MINSA', '113', 'Marcar 113 y elegir la opción 5.', 1, true, null),
  ('PE', 'hotline', 'Ayúdame a Vivir', '0800 37822', 'Prevención del suicidio.', 2, true, null),
  ('PE', 'emergency', 'Emergencias', '106', 'Ambulancia SAMU.', 3, true, null)
on conflict do nothing;

-- PDR 5.7 — 5 sound beds. Synthesis descriptors, not files:
-- the bed is built in the browser, which removes the licensing question
-- entirely. license stays null until real audio replaces synthesis, at
-- which point PDR 5.7 makes it mandatory.
--
-- Single-tone drones only. Explicitly not binaural — contraindicated in
-- epilepsy, and adding them would need another clinical question.
insert into public.bed_tracks (id, name, frequency_hz, suits, synthesis, license, is_active) values
  ('cuencos-432', 'Cuencos 432 Hz', 432, 'Intenciones de calma, cierre del día, soltar.', '{"voices": [{"type": "sine", "hz": 432, "gain": 0.16}, {"type": "sine", "hz": 648, "gain": 0.05}, {"type": "sine", "hz": 864, "gain": 0.03}], "noise": null, "lfo": {"hz": 0.08, "depth": 0.35}}'::jsonb, null, true),
  ('drone-528', 'Drone 528 Hz', 528, 'Intenciones de apertura, autoestima, reparación.', '{"voices": [{"type": "sine", "hz": 528, "gain": 0.14}, {"type": "triangle", "hz": 264, "gain": 0.06}], "noise": null, "lfo": {"hz": 0.11, "depth": 0.3}}'::jsonb, null, true),
  ('drone-grave', 'Drone grave', 96, 'Intenciones de arraigo y regulación cuando hay mucha activación.', '{"voices": [{"type": "sine", "hz": 96, "gain": 0.2}, {"type": "sine", "hz": 144, "gain": 0.07}], "noise": {"type": "brown", "gain": 0.05, "lowpass_hz": 400}, "lfo": {"hz": 0.06, "depth": 0.25}}'::jsonb, null, true),
  ('lluvia', 'Lluvia', null, 'Intenciones de sueño y descanso, o cuando el tono puro molesta.', '{"voices": [], "noise": {"type": "pink", "gain": 0.14, "lowpass_hz": 1800}, "lfo": {"hz": 0.2, "depth": 0.2}}'::jsonb, null, true),
  ('silencio', 'Solo voz', null, 'Cuando la persona prefiere la guía sin fondo. Siempre disponible.', '{"voices": [], "noise": null, "lfo": null}'::jsonb, null, true)
on conflict (id) do update set
  name = excluded.name,
  frequency_hz = excluded.frequency_hz,
  suits = excluded.suits,
  synthesis = excluded.synthesis,
  license = excluded.license,
  is_active = excluded.is_active;
