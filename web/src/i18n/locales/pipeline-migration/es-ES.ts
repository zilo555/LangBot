export default {
  activationRetryHint:
    'Tras comprobar el entorno, actualiza, selecciona esta canalización y confirma para reintentar solo la activación. No se volverá a migrar la configuración guardada.',
  notices: {
    legacyArchive:
      'La configuración activa contendrá solo el Runner seleccionado. Todos los ajustes anteriores, incluidos los inactivos, se conservan en la copia de seguridad de migración.',
    contextDefaults:
      'El historial usará el nuevo presupuesto de contexto y los valores de resumen, en lugar de un límite fijo de turnos.',
    modelReasoning:
      'Se conservan los ajustes de razonamiento por modelo y el host los aplica.',
    serialTools: 'Las herramientas seguirán ejecutándose de forma secuencial.',
    retrievalDefaults:
      'La recuperación usará los nuevos límites de top-k y longitud. Revísalos después de migrar.',
    boxReset:
      'No se transfiere el estado de Box; se creará una nueva sesión aislada.',
    persistentHistory:
      'Las nuevas conversaciones tendrán un historial persistente y aislado. No se importa el historial remoto anterior.',
    tweaksDefault:
      'Langflow tweaks usa un objeto vacío de forma predeterminada.',
    timeoutDefault:
      'Dify usa un tiempo de espera de 30 segundos de forma predeterminada.',
    historyReset:
      'No se transfieren el historial ni los identificadores de sesión. Después de migrar se iniciarán conversaciones nuevas.',
    sessionTitle:
      'Las nuevas sesiones de WeKnora usan títulos generados por el plugin.',
    aliasRepaired:
      'El nombre antiguo del campo se sustituye por el nombre admitido.',
    nullDefault:
      'Este valor vacío usará el valor predeterminado del nuevo plugin.',
    outputPolicy:
      'Se conserva la visibilidad actual del contenido de razonamiento.',
    filteredVariables:
      'Solo se transfieren variables admitidas; el contexto de la conversación proporciona las variables reservadas.',
    identityPreserved:
      'La identidad de usuario del proveedor conserva su origen anterior.',
    newDefaults:
      'Las opciones nuevas usan los valores predeterminados documentados; se conservan los valores anteriores admitidos.',
    externalState:
      'Completa o cancela las interacciones remotas pendientes antes de migrar; su estado activo no se transfiere.',
    pluginVersion:
      'Instala la versión requerida del plugin y actualiza. Las versiones anteriores no admiten esta migración.',
    schemaChanged:
      'La configuración del Runner instalado no coincide con el destino. Revisa la versión del plugin y actualiza.',
    runnerExcluded:
      'Esta canalización excluye el plugin Runner necesario. Ajusta primero la configuración de extensiones.',
    boxScope:
      'La plantilla personalizada de sesión de Box no se puede migrar de forma segura. Elimínala o revisa los requisitos de aislamiento.',
    pendingInteraction:
      'Hay una conversación esperando una respuesta. Complétala o cancélala antes de migrar.',
  },
  title: 'Migración de pipelines',
  description:
    'No se cambia nada hasta seleccionar pipelines y confirmar explícitamente. Se conservan su identidad y los ajustes no relacionados.',
  detected: '{{count}} pipelines requieren revisión.',
  review: 'Revisar migración',
  readOnly: 'Solo los gestores del espacio pueden migrar pipelines.',
  previewError: 'Vista previa no disponible. Actualícela.',
  submitting: 'Enviando pipelines seleccionados…',
  running: 'Migración en curso. Cerrar el diálogo no cancela la tarea.',
  finished: 'Tarea finalizada. Revise el resultado de cada pipeline.',
  failed: 'La tarea falló. Revise el resultado de cada pipeline.',
  lost: 'Se perdió el seguimiento de la tarea; se desconoce el resultado. Actualice la vista previa antes de actuar.',
  requestError:
    'Solicitud no completada. Actualice la vista previa y vuelva a seleccionar.',
  warningFallback: 'Revise este ajuste antes de migrar.',
  blockerFallback:
    'Este ajuste o estado de ejecución no se puede migrar de forma segura. Resuélvalo y actualice la vista previa.',
  changedFields: 'Campos modificados',
  activationHint:
    'Configuración guardada, pero activación pendiente. Pida al administrador que compruebe el entorno y actualice. No repita la migración a ciegas.',
  pluginHint:
    'Instale o active el plugin requerido desde Extensiones / Mercado de extensiones y compruebe la cuota del espacio. Este asistente nunca instala plugins. Al volver, actualice la vista previa.',
  extensions: 'Abrir Extensiones',
  results: 'Resultados por pipeline',
  selection: '{{count}} seleccionados (máximo 50)',
  confirm: 'Confirmo la migración de los pipelines seleccionados.',
  refresh: 'Actualizar vista previa',
  execute: 'Migrar seleccionados',
  legacyGate:
    'La configuración antigua es de solo lectura hasta la migración. Guardar y depurar no están disponibles para evitar una conversión implícita.',
  states: {
    ready: 'Listo',
    needs_plugin: 'Plugin requerido',
    blocked: 'Bloqueado',
    already_current: 'Ya actualizado',
    not_legacy: 'No es antiguo',
    activation_pending: 'Activación pendiente',
    pending: 'Pendiente',
    migrated: 'Migrado',
    stale: 'Vista previa caducada',
    failed: 'Fallido',
  },
};
