import { ASUNTO_AVISO, DatosAviso, armarAvisoPreCoactivo, formatoCapitalAviso } from './aviso-precoactivo.template';

describe('armarAvisoPreCoactivo', () => {
  const datos: DatosAviso = {
    nombre: 'LOOR CORNEJO WAGNER DANIEL',
    ruc: '1716000540001',
    capital: 661.43,
    titulos: ['41495726', '41650813', '42650812', '42852763'],
    abogado: 'Mayra Ordoñez',
    generoAbogado: 'femenino'
  };

  it('usa el asunto de la plantilla original', () => {
    expect(armarAvisoPreCoactivo(datos).asunto).toBe(ASUNTO_AVISO);
    expect(ASUNTO_AVISO).toBe('AVISO Pre-Coactivo IESS - Obligaciones Patronales');
  });

  it('arma el detalle de la obligación con los títulos separados por punto y coma', () => {
    const { texto } = armarAvisoPreCoactivo(datos);
    expect(texto.includes('RAZÓN SOCIAL: LOOR CORNEJO WAGNER DANIEL')).toBe(true);
    expect(texto.includes('C.C./RUC: 1716000540001')).toBe(true);
    expect(texto.includes('VALOR CAPITAL ADEUDADO: $661.43 + intereses y honorarios')).toBe(true);
    expect(texto.includes('TÍTULOS DE CRÉDITOS: 41495726; 41650813; 42650812; 42852763')).toBe(true);
  });

  it('formatea el capital con punto decimal y miles', () => {
    expect(formatoCapitalAviso(661.43)).toBe('$661.43');
    expect(formatoCapitalAviso(1234.5)).toBe('$1,234.50');
    expect(formatoCapitalAviso(0)).toBe('$0.00');
  });

  it('firma en femenino con el nombre del abogado', () => {
    const { texto, html } = armarAvisoPreCoactivo(datos);
    expect(texto.includes('Ab. Mayra Ordoñez\nAbogada – Secretaria Externa del IESS')).toBe(true);
    expect(html.includes('Ab. Mayra Ordoñez')).toBe(true);
    expect(texto.includes('En mi calidad de Abogada Externa y Secretaria Delegada por el INSTITUTO')).toBe(true);
    expect(texto.includes('Secretario')).toBe(false);
  });

  it('firma en masculino con el nombre del abogado', () => {
    const { texto } = armarAvisoPreCoactivo({ ...datos, abogado: 'Marcelo Mena', generoAbogado: 'masculino' });
    expect(texto.includes('Ab. Marcelo Mena\nAbogado – Secretario Externo del IESS')).toBe(true);
    expect(texto.includes('En mi calidad de Abogado Externo y Secretario Delegado por el INSTITUTO')).toBe(true);
    expect(texto.includes('Mayra')).toBe(false);
    expect(texto.includes('Secretaria')).toBe(false);
  });

  it('empresa: el "Estimado:" va al representante y la razón social queda en el detalle', () => {
    const { texto, html } = armarAvisoPreCoactivo({
      ...datos,
      nombre: 'AEROTECNOLOGIA CIA. LTDA.',
      ruc: '1791936049001',
      representanteLegal: 'ULLAURI GALVEZ JULIO CESAR'
    });
    expect(texto.startsWith('Estimado:\n\nULLAURI GALVEZ JULIO CESAR\n\nReciba un cordial saludo')).toBe(true);
    expect(texto.includes('RAZÓN SOCIAL: AEROTECNOLOGIA CIA. LTDA.')).toBe(true);
    expect(texto.includes('Estimado:\n\nAEROTECNOLOGIA')).toBe(false);
    expect(html.includes('<b>ULLAURI GALVEZ JULIO CESAR</b>')).toBe(true);
  });

  it('persona natural: sin representante el "Estimado:" lleva su nombre', () => {
    const { texto } = armarAvisoPreCoactivo({ ...datos, representanteLegal: '   ' });
    expect(texto.startsWith('Estimado:\n\nLOOR CORNEJO WAGNER DANIEL\n\nReciba')).toBe(true);
  });

  it('incluye los tres enlaces de WhatsApp del despacho', () => {
    const { html } = armarAvisoPreCoactivo(datos);
    expect(html.includes('<a href="https://wa.me/593983875666">')).toBe(true);
    expect(html.includes('<a href="https://wa.me/593988188102">')).toBe(true);
    expect(html.includes('<a href="https://wa.me/593986917149">')).toBe(true);
  });

  it('escapa el HTML de los datos del coactivado', () => {
    const { html } = armarAvisoPreCoactivo({ ...datos, nombre: 'A & B <script>alert(1)</script>' });
    expect(html.includes('<script>')).toBe(false);
    expect(html.includes('A &amp; B &lt;script&gt;')).toBe(true);
  });

  it('no deja marcadores sin reemplazar', () => {
    const { html, texto } = armarAvisoPreCoactivo(datos);
    expect(html.includes('undefined')).toBe(false);
    expect(texto.includes('undefined')).toBe(false);
    expect(texto.includes('NaN')).toBe(false);
  });
});
