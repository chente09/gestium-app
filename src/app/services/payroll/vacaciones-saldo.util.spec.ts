import {
  aniversariosAcreditadosAuto,
  diasCorridos,
  diasLaborables,
  etiquetaSaldo,
  proximoAniversario,
  saldoVacacionesAlDia
} from './vacaciones-saldo.util';

// Mes en Date es base 0: new Date(2026, 9, 16) = 16 de octubre de 2026.
const dia = (anio: number, mes: number, d: number) => new Date(anio, mes - 1, d);

describe('saldoVacacionesAlDia', () => {
  it('Ingrid: cumplió el año el 06/10/2026 con 4 días de adelanto → le quedan 7', () => {
    const r = saldoVacacionesAlDia(
      { fechaAfiliacionIESS: '2025-10-06', saldoVacacionesDisponible: -4 },
      dia(2026, 10, 16)
    );
    expect(r.saldo).toBe(7);
    expect(r.aniversariosPorAcreditar).toBe(1);
    expect(r.acreditadoHasta).toBe('2026-10-16');
  });

  it('una vez guardado con la marca de hoy, no vuelve a sumar', () => {
    const r = saldoVacacionesAlDia(
      { fechaAfiliacionIESS: '2025-10-06', saldoVacacionesDisponible: 7, vacacionesAcreditadasHasta: '2026-10-16' },
      dia(2026, 10, 20)
    );
    expect(r.saldo).toBe(7);
    expect(r.aniversariosPorAcreditar).toBe(0);
  });

  it('Eduardo: con 1 día de adelanto, en abril 2027 refleja 10', () => {
    const datos = { fechaAfiliacionIESS: '2026-04-07', saldoVacacionesDisponible: -1 };
    expect(saldoVacacionesAlDia(datos, dia(2026, 10, 16)).saldo).toBe(-1);
    expect(saldoVacacionesAlDia(datos, dia(2027, 4, 6)).saldo).toBe(-1);
    expect(saldoVacacionesAlDia(datos, dia(2027, 4, 7)).saldo).toBe(10);
  });

  it('Marylin: el adelanto de 11 se compensa el día de su aniversario', () => {
    const datos = { fechaAfiliacionIESS: '2025-11-20', saldoVacacionesDisponible: -11 };
    expect(saldoVacacionesAlDia(datos, dia(2026, 11, 19)).saldo).toBe(-11);
    expect(saldoVacacionesAlDia(datos, dia(2026, 11, 20)).saldo).toBe(0);
  });

  it('no suma los aniversarios anteriores al 1/10/2026 (ya estaban en el saldo cargado a mano)', () => {
    const celso = { fechaAfiliacionIESS: '2022-05-04', saldoVacacionesDisponible: 8 };
    expect(saldoVacacionesAlDia(celso, dia(2026, 10, 16)).saldo).toBe(8);
    expect(saldoVacacionesAlDia(celso, dia(2027, 5, 4)).saldo).toBe(19);
  });

  it('un aniversario justo el 1/10/2026 sí se acredita', () => {
    const r = saldoVacacionesAlDia({ fechaAfiliacionIESS: '2025-10-01', saldoVacacionesDisponible: 0 }, dia(2026, 10, 1));
    expect(r.saldo).toBe(11);
  });

  it('suma varios aniversarios pendientes de una vez, sin tope', () => {
    const r = saldoVacacionesAlDia(
      { fechaAfiliacionIESS: '2020-03-01', saldoVacacionesDisponible: 3, vacacionesAcreditadasHasta: '2022-01-01' },
      dia(2025, 3, 2)
    );
    expect(r.aniversariosPorAcreditar).toBe(4); // 2022, 2023, 2024 y 2025
    expect(r.saldo).toBe(47);
  });

  it('antes de cumplir el año no suma nada', () => {
    const r = saldoVacacionesAlDia({ fechaAfiliacionIESS: '2026-09-01', saldoVacacionesDisponible: null }, dia(2026, 10, 16));
    expect(r.saldo).toBe(0);
    expect(r.aniversariosPorAcreditar).toBe(0);
  });

  it('un pasante (sin afiliación) conserva su saldo y no acumula', () => {
    const r = saldoVacacionesAlDia({ fechaAfiliacionIESS: null, saldoVacacionesDisponible: 2 }, dia(2030, 1, 1));
    expect(r.saldo).toBe(2);
    expect(r.aniversariosPorAcreditar).toBe(0);
  });
});

describe('etiquetaSaldo', () => {
  it('rotula positivo, cero, deuda (ya cumplió el año) y adelanto (todavía no)', () => {
    expect(etiquetaSaldo(7, true).texto).toBe('7 días');
    expect(etiquetaSaldo(7, true).color).toBe('green');
    expect(etiquetaSaldo(0, false).texto).toBe('0 días');
    expect(etiquetaSaldo(-4, true).texto).toBe('Debe 4');
    expect(etiquetaSaldo(-4, true).color).toBe('red');
    expect(etiquetaSaldo(-1, false).texto).toBe('Adelanto 1');
    expect(etiquetaSaldo(-1, false).color).toBe('gold');
  });
});

describe('aniversarios', () => {
  it('lista solo los aniversarios acreditados solos (desde el 1/10/2026)', () => {
    expect(aniversariosAcreditadosAuto('2025-10-06', dia(2026, 10, 16)).join('|')).toBe('2026-10-06');
    expect(aniversariosAcreditadosAuto('2022-05-04', dia(2026, 10, 16)).length).toBe(0); // el de 2026-05-04 es anterior
    expect(aniversariosAcreditadosAuto('2022-05-04', dia(2027, 5, 4)).join('|')).toBe('2027-05-04');
  });

  it('próximo aniversario después de hoy', () => {
    expect(proximoAniversario('2025-10-06', dia(2026, 10, 16))).toBe('2027-10-06');
    expect(proximoAniversario('2026-04-07', dia(2026, 10, 16))).toBe('2027-04-07');
    expect(proximoAniversario('2026-04-07', dia(2027, 4, 7))).toBe('2028-04-07'); // el del propio día ya cuenta como cumplido
  });
});

describe('diasCorridos', () => {
  it('cuenta sábados y domingos (como se descontaba antes)', () => {
    expect(diasCorridos('2026-10-05', '2026-10-12')).toBe(8);
    expect(diasCorridos('2026-10-07', '2026-10-07')).toBe(1);
  });
});

describe('diasLaborables', () => {
  it('una semana de lunes a viernes son 5', () => {
    expect(diasLaborables('2026-10-05', '2026-10-09')).toBe(5);
  });

  it('del lunes al lunes siguiente son 6, no 8', () => {
    expect(diasLaborables('2026-10-05', '2026-10-12')).toBe(6);
  });

  it('los 15 días corridos de vacaciones suman 11 laborables', () => {
    expect(diasLaborables('2026-10-05', '2026-10-19')).toBe(11);
  });

  it('un solo día laborable es 1; un fin de semana es 0', () => {
    expect(diasLaborables('2026-10-07', '2026-10-07')).toBe(1);
    expect(diasLaborables('2026-10-10', '2026-10-11')).toBe(0);
  });

  it('con fechas al revés devuelve 0', () => {
    expect(diasLaborables('2026-10-09', '2026-10-05')).toBe(0);
  });
});
