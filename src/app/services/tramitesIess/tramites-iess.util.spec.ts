import {
  Tramite,
  agruparPorCliente,
  estadoCaso,
  cambiosAlAgregarGestion,
  cambiosAlCambiarEtapa,
  cambiosAlCerrar,
  cambiosAlGuardarCosto,
  cambiosAlPagarTercero,
  cambiosAlQuitarCosto,
  cambiosAlReabrir,
  cambiosAlRegistrarPago,
  cambiosAlReversarPago,
  cambiosAlReversarPagoTercero,
  conceptoSugerido,
  diasSinMovimiento,
  esperandoA,
  etapaActual,
  etapasDe,
  etiquetaTipo,
  filtrarTramites,
  normalizarDatos,
  progresoEtapas,
  resumenDe,
  totalesDe,
  tramiteNuevo
} from './tramites-iess.util';

const usuario = { uid: 'u1', nombre: 'VICENTE NENGER' };
const ahora = new Date(2026, 9, 27, 10, 0, 0);
const dias = (n: number) => new Date(ahora.getTime() - n * 86400000);
const HOY = '2026-10-27';

function tramite(extra: Partial<Tramite> = {}): Tramite {
  return {
    id: 't1', clienteNombre: 'EJEMPLO S.A.', tipo: 'anulacion_finiquito', estado: 'en_curso',
    honorario: 1000, pagos: [], costosTerceros: [], gestiones: [], creadoPor: usuario,
    fechaCreacion: dias(10), ultimoMovimiento: dias(2), ...extra
  };
}

function mensaje(fn: () => unknown): string {
  try { fn(); return ''; } catch (e: any) { return e.message; }
}

describe('etapas', () => {
  it('cada tipo trae sus etapas: el finiquito es el más largo', () => {
    expect(etapasDe(tramite()).length).toBe(7);
    expect(etapasDe(tramite({ tipo: 'anulacion_conyuges' })).length).toBe(3);
    expect(etapasDe(tramite({ tipo: 'anulacion_ruc' })).length).toBe(3);
  });

  it('la etapa actual es la primera que falta y se puede omitir lo que no aplica', () => {
    let t = tramite({ etapas: { verificar: { estado: 'hecha' }, analizar: { estado: 'hecha' } } });
    expect(etapaActual(t)?.id).toBe('sut');
    t = tramite({ etapas: { verificar: { estado: 'hecha' }, analizar: { estado: 'hecha' }, sut: { estado: 'omitida' }, contrato: { estado: 'omitida' } } });
    expect(etapaActual(t)?.id).toBe('acta');
  });

  it('con todas resueltas no queda etapa actual', () => {
    const etapas: Record<string, any> = {};
    etapasDe(tramite()).forEach(e => (etapas[e.def.id] = { estado: 'hecha' }));
    expect(etapaActual(tramite({ etapas })) === null).toBe(true);
  });

  it('el progreso no cuenta las omitidas', () => {
    const t = tramite({ etapas: { verificar: { estado: 'hecha' }, sut: { estado: 'omitida' }, contrato: { estado: 'omitida' } } });
    const p = progresoEtapas(t);
    expect(p.hechas).toBe(1);
    expect(p.total).toBe(5);
  });

  it('a quién se espera sale de la etapa, se puede fijar a mano y un trámite cerrado no espera a nadie', () => {
    expect(esperandoA(tramite())).toBe('oficina');
    const enSut = tramite({ etapas: { verificar: { estado: 'hecha' }, analizar: { estado: 'hecha' } } });
    expect(esperandoA(enSut)).toBe('tercero');
    expect(esperandoA({ ...enSut, esperandoAManual: 'cliente' })).toBe('cliente');
    expect(esperandoA({ ...enSut, estado: 'terminado' }) === null).toBe(true);
  });

  it('la etapa sugiere el concepto del costo a tercero', () => {
    const enSut = tramite({ etapas: { verificar: { estado: 'hecha' }, analizar: { estado: 'hecha' } } });
    expect(conceptoSugerido(enSut)).toBe('sut');
    expect(conceptoSugerido(tramite())).toBe('otro');
  });

  it('etiqueta: el tipo "otro" muestra su detalle', () => {
    expect(etiquetaTipo({ tipo: 'otro', tipoDetalle: 'Recuperación de claves SUT' })).toBe('Recuperación de claves SUT');
    expect(etiquetaTipo({ tipo: 'radiografia' })).toBe('Radiografía');
  });
});

describe('totales', () => {
  it('cobrado, por cobrar, terceros y utilidad se calculan solos', () => {
    const t = tramite({
      honorario: 1000,
      pagos: [{ monto: 500, fecha: HOY, registradoPor: usuario }],
      costosTerceros: [
        { id: 'a', concepto: 'sut', tercero: 'JUAN', monto: 300, pagos: [{ monto: 100, fecha: HOY, registradoPor: usuario }] },
        { id: 'b', concepto: 'tramitador_iess', tercero: 'ANA', monto: 200, pagos: [] }
      ]
    });
    const tot = totalesDe(t);
    expect(tot.cobrado).toBe(500);
    expect(tot.porCobrar).toBe(500);
    expect(tot.pactadoTerceros).toBe(500);
    expect(tot.pagadoTerceros).toBe(100);
    expect(tot.porPagarTerceros).toBe(400);
    expect(tot.utilidad).toBe(500);
  });

  it('cobrar de más no da saldo negativo y suma en centavos sin errores', () => {
    const t = tramite({ honorario: 0.3, pagos: [{ monto: 0.1, fecha: HOY, registradoPor: usuario }, { monto: 0.2, fecha: HOY, registradoPor: usuario }] });
    expect(totalesDe(t).cobrado).toBe(0.3);
    expect(totalesDe(t).porCobrar).toBe(0);
    expect(totalesDe(tramite({ honorario: 100, pagos: [{ monto: 150, fecha: HOY, registradoPor: usuario }] })).porCobrar).toBe(0);
  });

  it('sin movimiento: solo cuenta un trámite en curso', () => {
    expect(diasSinMovimiento(tramite({ ultimoMovimiento: dias(20) }), ahora)).toBe(20);
    expect(diasSinMovimiento(tramite({ ultimoMovimiento: dias(20), estado: 'terminado' }), ahora) === null).toBe(true);
  });

  it('el resumen no cobra los desistidos pero sí paga a los terceros', () => {
    const costo = [{ id: 'a', concepto: 'sut' as const, tercero: 'JUAN', monto: 100, pagos: [] }];
    const lista = [
      tramite({ honorario: 300, ultimoMovimiento: dias(30) }),
      tramite({ honorario: 200, estado: 'terminado', costosTerceros: costo }),
      tramite({ honorario: 500, estado: 'desistido', costosTerceros: costo })
    ];
    const r = resumenDe(lista, ahora);
    expect(r.enCurso).toBe(1);
    expect(r.porCobrar).toBe(500);
    expect(r.porPagarTerceros).toBe(200);
    expect(r.sinMovimiento).toBe(1);
  });
});

describe('filtros', () => {
  const lista = [
    tramite({ id: '1', clienteNombre: 'JOSÉ ÁLVAREZ', clienteRuc: '1700000001001', tipo: 'radiografia', ultimoMovimiento: dias(1) }),
    tramite({ id: '2', clienteNombre: 'MARÍA PÉREZ', tipo: 'anulacion_ruc', ultimoMovimiento: dias(40) }),
    tramite({ id: '3', clienteNombre: 'LUIS GÓMEZ', tipo: 'anulacion_ruc', estado: 'terminado' })
  ];
  const ids = (f: Parameters<typeof filtrarTramites>[1]) => filtrarTramites(lista, f, ahora).map(t => t.id).join(',');

  it('busca por nombre sin importar tildes ni mayúsculas, y por RUC', () => {
    expect(ids({ texto: 'jose alvarez' })).toBe('1');
    expect(ids({ texto: '1700000001' })).toBe('1');
    expect(ids({ texto: 'perez maria' })).toBe('2');
  });

  it('filtra por tipo, estado y seguimiento', () => {
    expect(ids({ tipo: 'anulacion_ruc' })).toBe('2,3');
    expect(ids({ estado: 'terminado' })).toBe('3');
    expect(ids({ estado: 'en_curso', soloSinMovimiento: true })).toBe('2');
    expect(ids({})).toBe('1,2,3');
  });

  it('filtra por a quién se espera', () => {
    expect(ids({ esperandoA: 'cliente' })).toBe('1,2');
    expect(ids({ esperandoA: 'oficina' })).toBe('');
  });
});

describe('datos del trámite', () => {
  it('valida y normaliza: nombre en mayúsculas, RUC limpio, sin vacíos', () => {
    const { valores, borrar } = normalizarDatos({ clienteNombre: '  maría   pérez ', clienteRuc: '1700000001-001', tipo: 'radiografia', telefono: '', honorario: 80 });
    expect(valores['clienteNombre']).toBe('MARÍA PÉREZ');
    expect(valores['clienteRuc']).toBe('1700000001001');
    expect(valores['honorario']).toBe(80);
    expect(borrar.includes('telefono')).toBe(true);
    expect(borrar.includes('tipoDetalle')).toBe(true);
  });

  it('rechaza lo que no sirve', () => {
    expect(mensaje(() => normalizarDatos({ clienteNombre: ' ', tipo: 'otro' }))).toBe('El nombre del cliente es obligatorio.');
    expect(mensaje(() => normalizarDatos({ clienteNombre: 'A', clienteRuc: '123', tipo: 'otro', tipoDetalle: 'x' }))).toBe('El RUC o la cédula debe tener 10 o 13 dígitos.');
    expect(mensaje(() => normalizarDatos({ clienteNombre: 'A', tipo: 'otro' }))).toBe('Escribe qué trámite es.');
    expect(mensaje(() => normalizarDatos({ clienteNombre: 'A', tipo: 'radiografia', honorario: -1 }))).toBe('El honorario no puede ser negativo.');
    expect(mensaje(() => normalizarDatos({ clienteNombre: 'A', tipo: 'radiografia', porcentaje: 120 }))).toBe('El porcentaje no puede pasar de 100.');
    expect(mensaje(() => normalizarDatos({ clienteNombre: 'A', tipo: 'radiografia', fechaPresentacion: '31/12/2026' }))).toBe('La fecha no es válida.');
  });

  it('una edición parcial solo toca lo que viene', () => {
    const { valores, borrar } = normalizarDatos({ telefono: '0999999999', nroResolucion: '' });
    expect(Object.keys(valores).join(',')).toBe('telefono');
    expect(borrar.join(',')).toBe('nroResolucion');
  });

  it('el tipo "otro" guarda su detalle y cualquier otro tipo lo borra', () => {
    expect(normalizarDatos({ clienteNombre: 'A', tipo: 'otro', tipoDetalle: 'Claves SUT' }).valores['tipoDetalle']).toBe('Claves SUT');
    expect(normalizarDatos({ tipo: 'anulacion_ruc', tipoDetalle: 'viejo' }).borrar.includes('tipoDetalle')).toBe(true);
  });

  it('un trámite nuevo arranca en curso con su primera gestión y quién lo creó', () => {
    const t = tramiteNuevo({ clienteNombre: 'ejemplo s.a.', tipo: 'anulacion_ruc', honorario: 900 }, usuario, ahora);
    expect(t.estado).toBe('en_curso');
    expect(t.clienteNombre).toBe('EJEMPLO S.A.');
    expect(t.honorario).toBe(900);
    expect(t.gestiones.length).toBe(1);
    expect(t.gestiones[0].registradoPor.uid).toBe('u1');
    expect(t.pagos.length + t.costosTerceros.length).toBe(0);
  });
});

describe('acciones', () => {
  it('completar una etapa la guarda con fecha y quién, y deja la línea en las gestiones', () => {
    const { cambios } = cambiosAlCambiarEtapa(tramite(), 'verificar', 'hecha', usuario, ahora, HOY);
    expect(cambios['etapas'].verificar.estado).toBe('hecha');
    expect(cambios['etapas'].verificar.fecha).toBe(HOY);
    expect(cambios['etapas'].verificar.por.uid).toBe('u1');
    expect(cambios['gestiones'][0].texto).toBe('Etapa «Verificar cuenta SUT y contrato previo» completada');
    expect(cambios['ultimoMovimiento']).toBe(ahora);
  });

  it('volver una etapa a pendiente la quita; una etapa que no existe o un trámite cerrado dan error', () => {
    const t = tramite({ etapas: { verificar: { estado: 'hecha' } } });
    expect(cambiosAlCambiarEtapa(t, 'verificar', 'pendiente', usuario, ahora, HOY).cambios['etapas'].verificar === undefined).toBe(true);
    expect(mensaje(() => cambiosAlCambiarEtapa(t, 'nada', 'hecha', usuario, ahora, HOY))).toBe('Esa etapa no existe en este tipo de trámite.');
    expect(mensaje(() => cambiosAlCambiarEtapa(tramite({ estado: 'terminado' }), 'verificar', 'hecha', usuario, ahora, HOY))).toBe('Reabre el trámite para cambiar sus etapas.');
  });

  it('un cobro se suma al historial con su comprobante y quién lo anotó', () => {
    const t = tramite({ pagos: [{ monto: 100, fecha: '2026-10-01', registradoPor: usuario }] });
    const { cambios } = cambiosAlRegistrarPago(t, { monto: 450.5, fecha: HOY, comprobante: ' 123 ' }, usuario, ahora);
    expect(cambios['pagos'].length).toBe(2);
    expect(cambios['pagos'][1].monto).toBe(450.5);
    expect(cambios['pagos'][1].comprobante).toBe('123');
    expect(cambios['pagos'][1].nota === undefined).toBe(true); // Firestore no admite undefined: ni la clave
    expect('nota' in cambios['pagos'][1]).toBe(false);
    expect(cambios['gestiones'][0].tipo).toBe('sistema');
  });

  it('un cobro con monto o fecha inválidos da error', () => {
    expect(mensaje(() => cambiosAlRegistrarPago(tramite(), { monto: 0, fecha: HOY }, usuario, ahora))).toBe('El monto debe ser mayor a cero.');
    expect(mensaje(() => cambiosAlRegistrarPago(tramite(), { monto: 10, fecha: 'hoy' }, usuario, ahora))).toBe('La fecha del pago no es válida.');
  });

  it('reversar un cobro quita solo ese y lo deja anotado', () => {
    const t = tramite({ pagos: [{ monto: 100, fecha: '2026-10-01', registradoPor: usuario }, { monto: 200, fecha: '2026-10-05', registradoPor: usuario }] });
    const { cambios } = cambiosAlReversarPago(t, 0, usuario, ahora);
    expect(cambios['pagos'].length).toBe(1);
    expect(cambios['pagos'][0].monto).toBe(200);
    expect(mensaje(() => cambiosAlReversarPago(t, 5, usuario, ahora))).toBe('El pago ya no existe.');
  });

  it('un costo a tercero se agrega y al editarlo conserva sus pagos', () => {
    const agregado = cambiosAlGuardarCosto(tramite(), { id: 'c1', concepto: 'sut', tercero: ' juan perez ', monto: 300 }, usuario, ahora).cambios;
    expect(agregado['costosTerceros'].length).toBe(1);
    expect(agregado['costosTerceros'][0].tercero).toBe('JUAN PEREZ');

    const conPago = cambiosAlPagarTercero(tramite({ costosTerceros: agregado['costosTerceros'] }), 'c1', { monto: 150, fecha: HOY }, usuario, ahora).cambios;
    expect(conPago['costosTerceros'][0].pagos.length).toBe(1);

    const editado = cambiosAlGuardarCosto(tramite({ costosTerceros: conPago['costosTerceros'] }), { id: 'c1', concepto: 'sut', tercero: 'JUAN PEREZ', monto: 350 }, usuario, ahora).cambios;
    expect(editado['costosTerceros'].length).toBe(1);
    expect(editado['costosTerceros'][0].monto).toBe(350);
    expect(editado['costosTerceros'][0].pagos.length).toBe(1);
  });

  it('un costo con pagos no se quita hasta reversarlos', () => {
    const costo = { id: 'c1', concepto: 'acta' as const, tercero: 'ANA', monto: 100, pagos: [{ monto: 50, fecha: HOY, registradoPor: usuario }] };
    const t = tramite({ costosTerceros: [costo] });
    expect(mensaje(() => cambiosAlQuitarCosto(t, 'c1', usuario, ahora))).toBe('Reversa primero los pagos de este costo.');

    const sinPagos = cambiosAlReversarPagoTercero(t, 'c1', 0, usuario, ahora).cambios;
    expect(sinPagos['costosTerceros'][0].pagos.length).toBe(0);
    const quitado = cambiosAlQuitarCosto(tramite({ costosTerceros: sinPagos['costosTerceros'] }), 'c1', usuario, ahora).cambios;
    expect(quitado['costosTerceros'].length).toBe(0);
  });

  it('un costo sin tercero o sin monto da error', () => {
    expect(mensaje(() => cambiosAlGuardarCosto(tramite(), { id: 'c1', concepto: 'sut', tercero: ' ', monto: 10 }, usuario, ahora))).toBe('Escribe a quién se le paga.');
    expect(mensaje(() => cambiosAlGuardarCosto(tramite(), { id: 'c1', concepto: 'sut', tercero: 'A', monto: 0 }, usuario, ahora))).toBe('El monto pactado debe ser mayor a cero.');
  });

  it('una gestión escrita queda como nota; vacía da error', () => {
    const { cambios } = cambiosAlAgregarGestion(tramite(), '  Se llamó al cliente  ', usuario, ahora);
    expect(cambios['gestiones'][0].texto).toBe('Se llamó al cliente');
    expect(cambios['gestiones'][0].tipo).toBe('nota');
    expect(mensaje(() => cambiosAlAgregarGestion(tramite(), '  ', usuario, ahora))).toBe('Escribe la gestión.');
  });

  it('terminar o desistir cierra el trámite con su fecha y motivo; reabrir los quita', () => {
    const desistido = cambiosAlCerrar(tramite(), 'desistido', ' no continúa ', usuario, ahora, HOY);
    expect(desistido.cambios['estado']).toBe('desistido');
    expect(desistido.cambios['fechaCierre']).toBe(HOY);
    expect(desistido.cambios['motivoCierre']).toBe('no continúa');
    expect(desistido.cambios['gestiones'][0].texto).toBe('Trámite desistido: no continúa');

    const terminado = cambiosAlCerrar(tramite({ motivoCierre: 'viejo' }), 'terminado', undefined, usuario, ahora, HOY);
    expect(terminado.quitar.join(',')).toBe('motivoCierre');
    expect(mensaje(() => cambiosAlCerrar(tramite({ estado: 'terminado' }), 'terminado', undefined, usuario, ahora, HOY))).toBe('El trámite ya está cerrado.');

    const reabierto = cambiosAlReabrir(tramite({ estado: 'desistido', fechaCierre: HOY }), usuario, ahora);
    expect(reabierto.cambios['estado']).toBe('en_curso');
    expect(reabierto.quitar.join(',')).toBe('fechaCierre,motivoCierre');
    expect(mensaje(() => cambiosAlReabrir(tramite(), usuario, ahora))).toBe('El trámite ya está en curso.');
  });
});

describe('casos agrupados por cliente', () => {
  const RUC = '1700000010001';
  const pago = (monto: number) => ({ monto, fecha: HOY, registradoPor: usuario });
  const caso = (): Tramite[] => [
    tramite({ id: 'anul', clienteNombre: 'CLIENTE ZETA', clienteRuc: RUC, tipo: 'anulacion_finiquito', honorario: 1800, telefono: '0990000000' }),
    tramite({ id: 'acta', clienteNombre: 'CLIENTE ZETA', clienteRuc: RUC, tipo: 'otro', tipoDetalle: 'Actas MTD', estado: 'terminado', honorario: 450, pagos: [pago(450)] }),
    tramite({ id: 'rad', clienteNombre: 'CLIENTE ZETA', clienteRuc: RUC, tipo: 'radiografia', estado: 'terminado', honorario: 170, pagos: [pago(170)] }),
    tramite({ id: 'otro', clienteNombre: 'CLIENTE OMEGA', clienteRuc: '1700000020001', tipo: 'radiografia', honorario: 100 })
  ];

  it('un cliente con varios trámites queda en un solo grupo, con las etapas en orden del caso', () => {
    const grupos = agruparPorCliente(caso(), caso(), ahora);
    expect(grupos.length).toBe(2);
    expect(grupos[0].nombre).toBe('CLIENTE ZETA');
    expect(grupos[0].tramites.map(t => t.id).join(',')).toBe('rad,acta,anul');
  });

  it('suma lo del cliente y cuenta sus estados', () => {
    const g = agruparPorCliente(caso(), caso(), ahora)[0];
    expect(g.honorario).toBe(2420);
    expect(g.cobrado).toBe(620);
    expect(g.porCobrar).toBe(1800);
    expect(g.enCurso).toBe(1);
    expect(g.terminados).toBe(2);
    expect(g.telefono).toBe('0990000000');
  });

  it('lo desistido no se cobra pero lo cobrado sí cuenta', () => {
    const lista = [tramite({ id: 'd', clienteNombre: 'A', estado: 'desistido', honorario: 500, pagos: [pago(100)] })];
    const g = agruparPorCliente(lista, lista, ahora)[0];
    expect(g.honorario).toBe(0);
    expect(g.porCobrar).toBe(0);
    expect(g.cobrado).toBe(100);
    expect(g.desistidos).toBe(1);
  });

  it('sin RUC se agrupa por el nombre, sin importar tildes ni mayúsculas', () => {
    const lista = [
      tramite({ id: 'a', clienteNombre: 'ÁLVARO EJEMPLO' }),
      tramite({ id: 'b', clienteNombre: 'Alvaro Ejemplo' })
    ];
    expect(agruparPorCliente(lista, lista, ahora).length).toBe(1);
  });

  it('avisa a quién se espera en los que siguen en curso, sin repetir', () => {
    const lista = [
      tramite({ id: 'a', clienteNombre: 'A', esperandoAManual: 'cliente' }),
      tramite({ id: 'b', clienteNombre: 'A', esperandoAManual: 'cliente' }),
      tramite({ id: 'c', clienteNombre: 'A', esperandoAManual: 'iess' }),
      tramite({ id: 'd', clienteNombre: 'A', estado: 'terminado' })
    ];
    expect(agruparPorCliente(lista, lista, ahora)[0].esperando.join(',')).toBe('cliente,iess');
  });

  it('el filtro decide qué clientes se ven, pero cada uno sale con todo su caso', () => {
    const todos = caso();
    const visibles = todos.filter(t => t.estado === 'en_curso' && t.clienteNombre === 'CLIENTE ZETA');
    const grupos = agruparPorCliente(visibles, todos, ahora);
    expect(grupos.length).toBe(1);
    expect(grupos[0].tramites.map(t => t.id).join(',')).toBe('rad,acta,anul');
    expect(grupos[0].terminados).toBe(2);
  });

  it('los clientes salen en el orden de su primer trámite visible', () => {
    const todos = caso();
    const visibles = [todos[3], todos[0]];
    expect(agruparPorCliente(visibles, todos, ahora).map(g => g.nombre).join(',')).toBe('CLIENTE OMEGA,CLIENTE ZETA');
  });

  it('pide seguimiento si algún trámite en curso lleva días sin moverse', () => {
    const lista = [
      tramite({ id: 'a', clienteNombre: 'A', ultimoMovimiento: dias(2) }),
      tramite({ id: 'b', clienteNombre: 'A', ultimoMovimiento: dias(20) })
    ];
    const g = agruparPorCliente(lista, lista, ahora)[0];
    expect(g.dias).toBe(20);
    expect(g.seguimiento).toBe(true);
    const reciente = [tramite({ id: 'c', clienteNombre: 'B', ultimoMovimiento: dias(1) })];
    expect(agruparPorCliente(reciente, reciente, ahora)[0].seguimiento).toBe(false);
  });

  it('si todo está cerrado no hay días ni seguimiento', () => {
    const lista = [tramite({ clienteNombre: 'A', estado: 'terminado', ultimoMovimiento: dias(90) })];
    const g = agruparPorCliente(lista, lista, ahora)[0];
    expect(g.dias === null).toBe(true);
    expect(g.seguimiento).toBe(false);
  });
});

describe('estado del caso: etapas completas no es caso terminado', () => {
  const rad = (extra: Partial<Tramite> = {}) => tramite({ id: 'rad', clienteNombre: 'A', tipo: 'radiografia', estado: 'terminado', ...extra });
  const anul = (extra: Partial<Tramite> = {}) => tramite({ id: 'anul', clienteNombre: 'A', tipo: 'anulacion_ruc', ...extra });

  it('mientras alguna etapa siga abierta, el caso sigue en curso', () => {
    expect(estadoCaso([rad(), anul()])).toBe('en_curso');
    expect(estadoCaso([anul({ estado: 'terminado' }), tramite({ clienteNombre: 'A', tipo: 'otro', tipoDetalle: 'Claves SUT' })])).toBe('en_curso');
  });

  it('con la anulación resuelta, el caso está terminado', () => {
    expect(estadoCaso([anul({ estado: 'terminado' })])).toBe('terminado');
    expect(estadoCaso([rad(), anul({ estado: 'terminado' })])).toBe('terminado');
  });

  it('una radiografía sola no cierra el caso: falta la decisión del cliente', () => {
    expect(estadoCaso([rad()])).toBe('en_curso');
  });

  it('si el cliente no siguió con la anulación, el caso desistió', () => {
    expect(estadoCaso([rad(), anul({ estado: 'desistido' })])).toBe('desistido');
  });

  it('otro trámite resuelto (claves SUT, levantamiento) cierra su caso', () => {
    expect(estadoCaso([tramite({ clienteNombre: 'A', tipo: 'otro', tipoDetalle: 'Levantamiento', estado: 'terminado' })])).toBe('terminado');
  });

  it('el filtro por estado se aplica al caso completo, no a una etapa', () => {
    const todos = [
      rad({ id: 'r1', clienteNombre: 'EN CURSO', clienteRuc: '1700000001001' }),
      anul({ id: 'a1', clienteNombre: 'EN CURSO', clienteRuc: '1700000001001' }),
      anul({ id: 'a2', clienteNombre: 'CERRADO', clienteRuc: '1700000002001', estado: 'terminado' })
    ];
    const terminados = agruparPorCliente(todos, todos, ahora, 'terminado');
    expect(terminados.map(g => g.nombre).join(',')).toBe('CERRADO');
    const enCurso = agruparPorCliente(todos, todos, ahora, 'en_curso');
    expect(enCurso.map(g => g.nombre).join(',')).toBe('EN CURSO');
    expect(enCurso[0].terminados).toBe(1);
    expect(agruparPorCliente(todos, todos, ahora).length).toBe(2);
  });

  it('el resumen cuenta casos en curso, no etapas', () => {
    const lista = [
      rad({ id: 'r', clienteNombre: 'A' }),
      anul({ id: 'a', clienteNombre: 'A' }),
      tramite({ id: 'o', clienteNombre: 'A', tipo: 'otro', tipoDetalle: 'Acta' }),
      anul({ id: 'b', clienteNombre: 'B', estado: 'terminado' })
    ];
    expect(resumenDe(lista, ahora).enCurso).toBe(1);
  });
});
