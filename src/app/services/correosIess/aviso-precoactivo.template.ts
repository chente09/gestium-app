// Aviso pre-coactivo que el despacho envía a cada coactivado desde la cuenta
// de notificaciones del IESS. Es una función pura (sin Angular ni Firestore):
// la usan tanto la vista previa como el envío, así lo que se revisa en
// pantalla es exactamente lo que sale en el correo.
//
// El texto legal es el de la plantilla original del despacho — no se cambia
// sin que lo apruebe el abogado. Solo varían los datos del coactivado y quien
// firma: su nombre y el género del cargo ("Abogada"/"Abogado").

// El género de cada cartera está en SharedDataService (generosAbogadosIess):
// no se deduce del nombre.
export type GeneroFirma = 'femenino' | 'masculino';

export interface DatosAviso {
  nombre: string; // razón social
  ruc: string;
  capital: number; // suma del capital de los títulos incluidos
  titulos: string[]; // números de título, en el orden en que se muestran
  abogado: string; // quien firma: es el nombre de la cartera
  generoAbogado: GeneroFirma;
  // Solo empresas: el "Estimado:" va dirigido al representante legal (no se
  // puede escribir "Estimado: PRONACA") y la razón social queda en el detalle
  // de la obligación. En una persona natural no se pasa, y su nombre aparece
  // en las dos partes.
  representanteLegal?: string;
}

export interface CorreoAviso {
  asunto: string;
  html: string;
  texto: string;
}

export const ASUNTO_AVISO = 'AVISO Pre-Coactivo IESS - Obligaciones Patronales';

// Datos del despacho: son los mismos para todos los abogados.
const TELEFONO_DESPACHO = '0983875666';
const WHATSAPP_DESPACHO = ['593983875666', '593988188102', '593986917149'];
const CARGO_FIRMA: Record<GeneroFirma, string> = {
  femenino: 'Abogada – Secretaria Externa del IESS',
  masculino: 'Abogado – Secretario Externo del IESS'
};
const CALIDAD_INTRO: Record<GeneroFirma, string> = {
  femenino: 'Abogada Externa y Secretaria Delegada',
  masculino: 'Abogado Externo y Secretario Delegado'
};
const DIRECCION_FIRMA = [
  'Av. 12 de Octubre N24-660 y Francisco Salazar',
  'Edif. Concorde, Piso 15, Of. 15C – Quito, Ecuador',
  '098 818 8102 / 098 387 5666 / 02 254 3653'
];

// Un párrafo es un bloque de líneas; cada línea, una lista de trozos que
// pueden ir en negrita o ser un enlace. El mismo modelo se pinta como HTML
// y como texto plano, para que las dos versiones no se desincronicen.
interface Trozo {
  texto: string;
  negrita?: boolean;
  enlace?: string;
}
type Linea = Trozo[];
interface Bloque {
  lineas: Linea[];
  tenue?: boolean; // letra chica y gris, para el aviso de confidencialidad
}

const parrafo = (texto: string): Bloque => ({ lineas: [[{ texto }]] });
const lineaSimple = (texto: string): Linea => [{ texto }];

// "$1,234.50": punto decimal, como lo escribe el IESS en sus títulos.
export function formatoCapitalAviso(valor: number): string {
  return '$' + valor.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function armarBloques(datos: DatosAviso): Bloque[] {
  const nombre = datos.nombre.trim();
  const destinatario = datos.representanteLegal?.trim() || nombre;
  const etiqueta = (texto: string): Trozo => ({ texto, negrita: true });

  return [
    parrafo('Estimado:'),
    { lineas: [[{ texto: destinatario, negrita: true }]] },
    parrafo(`Reciba un cordial saludo. En mi calidad de ${CALIDAD_INTRO[datos.generoAbogado]} por el INSTITUTO ECUATORIANO DE SEGURIDAD SOCIAL (IESS) para la recuperación de cartera, me dirijo a usted desde este despacho jurídico para notificarle los valores adeudados que mantiene con la institución.`),
    parrafo('El presente comunicado tiene un carácter PRE-COACTIVO y EXTRAJUDICIAL. Nuestro objetivo principal, previo a impulsar el proceso coactivo y solicitar la ejecución de medidas cautelares, es poner en su conocimiento esta deuda para brindarle la oportunidad de regularizar sus obligaciones de manera voluntaria. De esta forma, usted podrá evitar los perjuicios económicos, bloqueos y embargos que conlleva un juicio de coactiva.'),
    parrafo('A continuación, detallo las obligaciones vencidas que requieren su cancelación inmediata:'),
    {
      lineas: [
        [etiqueta('RAZÓN SOCIAL: '), { texto: nombre }],
        [etiqueta('C.C./RUC: '), { texto: datos.ruc.trim() }],
        [etiqueta('VALOR CAPITAL ADEUDADO: '), { texto: `${formatoCapitalAviso(datos.capital)} + intereses y honorarios` }],
        [etiqueta('TÍTULOS DE CRÉDITOS: '), { texto: datos.titulos.join('; ') }]
      ]
    },
    parrafo('A fin de realizar dichos pagos, deberá acercarse a la matriz del Instituto Ecuatoriano de Seguridad Social, ubicado en la Av. 10 de Agosto y Bogotá (Caja del Seguro), solicitar un turno en información para generar los comprobantes de pago de los títulos de crédito antes referidos o generarlo por la página del IESS con su usuario de empleador y clave.'),
    parrafo('Tomar en cuenta que, en el caso de tener acumulados fondos de reserva o cesantía mediante la cuenta personal del IESS puede solicitar el cruce de fondos para poder cubrir la totalidad o parte de la deuda.'),
    parrafo('Una vez efectuados dichos pagos, por favor enviar mediante correo electrónico o vía WhatsApp los depósitos efectuados al contacto de nuestro despacho que consta al pie de firma.'),
    parrafo('En caso de que Usted no realice los pagos correspondientes en el término de tres días a partir de la presente notificación, se realizarán las acciones legales que en derecho corresponda.'),
    parrafo('Conforme lo establece el Código Civil Ecuatoriano la responsabilidad dentro de la sociedad Conyugal nos permite hacer extensiva la obligación a los cónyuges.'),
    parrafo('En el caso de la muerte del titular, la muerte no es una causal para extinguir las obligaciones, las deudas pasarán a los herederos sucesorios y continuará vigente hasta que sus herederos sean padre, madre, hijos y cónyuge sobreviviente, realicen la cancelación total.'),
    parrafo('El Capítulo Tercero Fase de Apremio del Código Orgánico Administrativo establece las medidas cautelares que pueden disponerse a las distintas entidades públicas una vez iniciado el proceso:'),
    {
      lineas: [
        lineaSimple('1.- SUPERINTENDENCIA DE BANCOS: Retención de fondos en cuentas Bancarias;'),
        lineaSimple('2.- MINISTERIO DE TRABAJO: Prohibición de trabajar en el sector público;'),
        lineaSimple('3.- AGENCIA NACIONAL DE TRÁNSITO: Prohibición de enajenar y matricular vehículos y automotores, respetando el principio de proporcionalidad;'),
        lineaSimple('4.- SUPERINTENDENCIA DE ECONOMÍA POPULAR Y SOLIDARIA: Retención de fondos en cuentas de Cooperativas y Cajas de ahorro;'),
        lineaSimple('5.- REGISTRO DE LA PROPIEDAD: Prohibición de enajenar bienes inmuebles, respetando el principio de proporcionalidad;'),
        lineaSimple('6.- EMBARGOS DE BIENES: Por falta de pago de la obligación y por facilidades de pago vencidas.')
      ]
    },
    parrafo('ACCIÓN PENAL POR RETENCIÓN ILEGAL DE APORTACIÓN A LA SEGURIDAD SOCIAL.- El Código Orgánico Integral Penal (COIP), en su Art. 242, sanciona la retención ilegal de aportes a la seguridad social; así: “La persona que retenga los aportes patronales o personales o efectúe los descuentos por rehabilitación de tiempos de servicio o de dividendos de préstamos hipotecarios y quirografarios de sus trabajadores y no los deposite en el Instituto Ecuatoriano de Seguridad Social dentro del plazo máximo de noventa días, contados a partir de la fecha de la respectiva retención, será sancionada con pena privativa de libertad de uno a tres años. Para el efecto, la o el afectado, el Director General o el Director Provincial del Instituto Ecuatoriano de Seguridad Social, en su caso, se dirigirá a la Fiscalía para que inicie la investigación respectiva. Si se determina responsabilidad penal de la persona jurídica, será sancionada con la clausura de sus locales o establecimientos, hasta que cancele los valores adeudados”'),
    {
      lineas: [
        [etiqueta('IMPORTANTE:')],
        lineaSimple(`En caso de requerir mayor información sobre cómo regularizar su situación en esta FASE PRE-COACTIVA, comuníquese directamente con nuestro despacho a los números: ${TELEFONO_DESPACHO}`)
      ]
    },
    {
      lineas: WHATSAPP_DESPACHO.map((numero): Linea => {
        const url = `https://wa.me/${numero}`;
        return [{ texto: 'WhatsApp: ' }, { texto: url, enlace: url }];
      })
    },
    {
      lineas: [
        lineaSimple('--'),
        lineaSimple(`Ab. ${datos.abogado.trim()}`),
        lineaSimple(CARGO_FIRMA[datos.generoAbogado]),
        ...DIRECCION_FIRMA.map(lineaSimple)
      ]
    },
    {
      tenue: true,
      lineas: [[{
        texto: 'AVISO DE CONFIDENCIALIDAD Y PROTECCIÓN DE DATOS (LOPDP): Este correo electrónico y cualquier archivo adjunto contienen información confidencial, privilegiada y de carácter estrictamente personal, dirigida única y exclusivamente a su destinatario. El tratamiento de los datos personales incluidos en esta comunicación se realiza al amparo del Art. 7 de la Ley Orgánica de Protección de Datos Personales (LOPDP), en cumplimiento de una obligación legal y en ejercicio de potestades públicas delegadas para la gestión de recuperación de cartera del Instituto Ecuatoriano de Seguridad Social (IESS). Si usted ha recibido este correo por error, le notificamos que queda estrictamente prohibida su revisión, copia, distribución o retención. Por favor, notifique inmediatamente al remitente respondiendo a este mensaje y proceda a eliminarlo de su sistema de forma definitiva.'
      }]]
    }
  ];
}

// Los datos del coactivado vienen de Firestore y de la matriz del IESS: se
// escapan siempre, aunque el texto fijo no lo necesite.
function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function trozoHtml(t: Trozo): string {
  let html = escaparHtml(t.texto);
  if (t.negrita) html = `<b>${html}</b>`;
  if (t.enlace) html = `<a href="${escaparHtml(t.enlace)}">${html}</a>`;
  return html;
}

function bloqueHtml(b: Bloque): string {
  const estilo = b.tenue ? 'margin:0 0 14px;font-size:12px;color:#666' : 'margin:0 0 14px';
  const lineas = b.lineas.map(l => l.map(trozoHtml).join('')).join('<br>');
  return `<p style="${estilo}">${lineas}</p>`;
}

export function armarAvisoPreCoactivo(datos: DatosAviso): CorreoAviso {
  const bloques = armarBloques(datos);

  const cuerpo = bloques.map(bloqueHtml).join('\n');
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#222">\n${cuerpo}\n</div>`;

  const texto = bloques
    .map(b => b.lineas.map(l => l.map(t => t.texto).join('')).join('\n'))
    .join('\n\n');

  return { asunto: ASUNTO_AVISO, html, texto };
}
