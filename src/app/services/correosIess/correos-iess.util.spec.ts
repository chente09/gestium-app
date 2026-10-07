import {
  esCorreoValido,
  esEmpresa,
  separarCorreos,
  separarNumerosTitulo,
  sumarCapital,
  ultimoAvisoEnviado
} from './correos-iess.util';

describe('esEmpresa', () => {
  it('RUC de sociedad privada (tercer dígito 9) o pública (6) es empresa', () => {
    expect(esEmpresa('1793111564001')).toBe(true); // ABMA ASESORES
    expect(esEmpresa('1760001040001')).toBe(true); // entidad pública
  });

  it('persona natural no es empresa, con cédula o con RUC', () => {
    expect(esEmpresa('1716000540')).toBe(false); // cédula
    expect(esEmpresa('1716000540001')).toBe(false); // RUC de persona natural
  });

  it('basura o largos raros no son empresa', () => {
    expect(esEmpresa('')).toBe(false);
    expect(esEmpresa('179311156400')).toBe(false); // 12 dígitos
    expect(esEmpresa('17931115640011')).toBe(false); // 14 dígitos
    expect(esEmpresa('17A3111564001')).toBe(false);
  });
});

describe('separarNumerosTitulo', () => {
  it('separa por coma, punto y coma, espacios y saltos de línea', () => {
    const r = separarNumerosTitulo('511372908; 511530720, 512133110\n41495726');
    expect(r.numeros.join('|')).toBe('511372908|511530720|512133110|41495726');
    expect(r.invalidos.length).toBe(0);
  });

  it('quita repetidos y separa lo que no son solo dígitos', () => {
    const r = separarNumerosTitulo('511372908, 511372908, abc, 5113-72');
    expect(r.numeros.join('|')).toBe('511372908');
    expect(r.invalidos.join('|')).toBe('abc|5113-72');
  });

  it('texto vacío o nulo no da nada', () => {
    expect(separarNumerosTitulo('').numeros.length).toBe(0);
    expect(separarNumerosTitulo(null).numeros.length).toBe(0);
  });
});

describe('separarCorreos', () => {
  it('separa por coma, punto y coma, barra y espacios', () => {
    const r = separarCorreos('a@x.com, b@y.com; c@z.com / d@w.com\ne@v.com');
    expect(r.join('|')).toBe('a@x.com|b@y.com|c@z.com|d@w.com|e@v.com');
  });

  it('quita duplicados y pasa a minúsculas', () => {
    expect(separarCorreos('A@X.com, a@x.com').join('|')).toBe('a@x.com');
  });

  it('quita adornos como <> y comillas', () => {
    expect(separarCorreos('<juan@x.com>, "ana@y.com".').join('|')).toBe('juan@x.com|ana@y.com');
  });

  it('conserva lo que no parece correo para que se pueda corregir', () => {
    expect(separarCorreos('a@x.com y b@y.com').join('|')).toBe('a@x.com|y|b@y.com');
  });

  it('texto vacío o nulo da lista vacía', () => {
    expect(separarCorreos('').length).toBe(0);
    expect(separarCorreos(null).length).toBe(0);
    expect(separarCorreos(undefined).length).toBe(0);
  });
});

describe('esCorreoValido', () => {
  it('acepta correos normales y rechaza lo demás', () => {
    expect(esCorreoValido('daniel_loor27@hotmail.com')).toBe(true);
    expect(esCorreoValido('llantera_del_norte@gmail.com')).toBe(true);
    expect(esCorreoValido('sin-arroba.com')).toBe(false);
    expect(esCorreoValido('a@b')).toBe(false);
    expect(esCorreoValido('y')).toBe(false);
  });
});

describe('sumarCapital', () => {
  it('suma sin errores de punto flotante', () => {
    expect(sumarCapital([{ capital: 0.1 }, { capital: 0.2 }])).toBe(0.3);
    expect(sumarCapital([{ capital: 200.1 }, { capital: 461.33 }])).toBe(661.43);
    expect(sumarCapital([])).toBe(0);
  });
});

describe('ultimoAvisoEnviado', () => {
  const gestion = (tipo: string, descripcion: string, dia: number): any => ({
    tipo, descripcion, fecha: new Date(2026, 9, dia)
  });

  it('devuelve la fecha del aviso más reciente', () => {
    const r = ultimoAvisoEnviado([
      gestion('correo', 'Aviso pre-coactivo enviado por correo a a@x.com', 3),
      gestion('correo', 'Aviso pre-coactivo enviado por correo a b@y.com', 5),
      gestion('correo', 'Aviso pre-coactivo enviado por correo a c@z.com', 4)
    ]);
    expect(r?.getDate()).toBe(5);
  });

  it('ignora otras gestiones, aunque sean de tipo correo', () => {
    const r = ultimoAvisoEnviado([
      gestion('correo', 'Correo masivo del primer acercamiento', 6),
      gestion('llamada', 'Aviso pre-coactivo enviado (texto de una llamada)', 7)
    ]);
    expect(r).toBe(null);
  });
});
