const H_PUBLIC_INFO = {
  H1: {
    title: 'Deterioro del PIB',
    description: 'Mide si la economía real está perdiendo fuerza a través del crecimiento del PIB. Cuando se activa, sugiere que la actividad económica se está enfriando y que el mercado puede estar entrando en una fase más vulnerable.'
  },
  H2: {
    title: 'Repunte del desempleo',
    description: 'Vigila si el paro empieza a subir de forma relevante. Un aumento del desempleo suele indicar deterioro económico y menor fortaleza del consumo, por eso se interpreta como una señal de riesgo para la bolsa.'
  },
  H3: {
    title: 'Rebote tras recortes de la Fed',
    description: 'Observa momentos posteriores a recortes de tipos por parte de la Reserva Federal. La idea es detectar fases en las que el mercado puede empezar a mejorar después de que la política monetaria se vuelva más favorable.'
  },
  H5: {
    title: 'Divergencia confianza-valoración',
    description: 'Compara la confianza del consumidor con la valoración del mercado. Si la bolsa está cara pero la confianza no acompaña, puede ser una señal de fragilidad; si la confianza mejora mientras las valoraciones se relajan, puede apoyar una lectura positiva.'
  },
  H6: {
    title: 'Tipos reales restrictivos',
    description: 'Compara los tipos de interés con la inflación. Cuando los tipos están claramente por encima de la inflación, las condiciones financieras son más duras y pueden presionar a la economía y a la bolsa.'
  },
  H7: {
    title: 'Inversión de la curva de tipos',
    description: 'Detecta cuando los tipos a corto plazo superan a los de largo plazo. Históricamente, esta situación ha sido una advertencia de desaceleración o recesión futura.'
  },
  H8: {
    title: 'Señal oro/plata de apetito por riesgo',
    description: 'Usa la relación entre oro y plata como termómetro de apetito por riesgo. Cuando la plata mejora frente al oro, suele indicar más confianza en crecimiento y activos de riesgo.'
  },
  H9: {
    title: 'Rebote tras estrés de volatilidad',
    description: 'Observa episodios de volatilidad extrema, como picos del VIX. La lectura es contraria: cuando el miedo ya ha sido muy alto, puede aparecer una fase posterior de recuperación del mercado.'
  },
  H11: {
    title: 'Shock del petróleo y riesgo de recesión',
    description: 'Mide subidas fuertes del petróleo en términos reales. Un shock energético puede dañar consumo, márgenes empresariales y actividad económica, aumentando el riesgo de mercado.'
  },
  H13: {
    title: 'Fed por encima del bono a 10 años',
    description: 'Detecta cuando el tipo de la Fed está por encima del rendimiento del bono a 10 años. Es una señal de política monetaria restrictiva y tensión en la curva de tipos.'
  },
  H15: {
    title: 'Liderazgo de pequeñas compañías',
    description: 'Mira si las small caps están superando con fuerza al S&P 500. Cuando las empresas pequeñas lideran, suele reflejar mayor apetito por riesgo y una lectura más constructiva del ciclo.'
  },
  H19: {
    title: 'Sentimiento AAII extremo',
    description: 'Usa encuestas de sentimiento de inversores particulares. Lecturas muy extremas pueden advertir de euforia o pánico, según la dirección, y ayudan a detectar excesos emocionales del mercado.'
  },
  H20: {
    title: 'Señal Sahm de recuperación',
    description: 'Observa la regla de Sahm y posibles mejoras tras deterioros del mercado laboral. Busca momentos donde el empleo deja de empeorar y puede aparecer una fase de recuperación.'
  },
  H22: {
    title: 'Pánico AAII, compra contraria',
    description: 'Detecta niveles altos de pesimismo en inversores particulares. Cuando el miedo es extremo, puede actuar como señal contraria, porque parte de la venta ya podría haberse producido.'
  },
  H26: {
    title: 'Enfriamiento del mercado inmobiliario',
    description: 'Vigila señales de debilidad en vivienda. Si el sector inmobiliario se enfría mucho, puede anticipar menor actividad económica y presión sobre el mercado.'
  },
  H27: {
    title: 'Ciclo negativo de camiones pesados',
    description: 'Usa los camiones pesados como indicador de ciclo industrial y transporte. Si esta actividad se deteriora, puede señalar menor demanda económica futura.'
  },
  H28: {
    title: 'Rebote del ISM manufacturero',
    description: 'Detecta mejoras en el ISM manufacturero después de una fase débil. Se interpreta como una señal de recuperación industrial y posible mejora del apetito por riesgo.'
  },
  H30: {
    title: 'Pánico geopolítico, compra contraria',
    description: 'Observa picos de riesgo geopolítico. Cuando el miedo geopolítico se dispara, a veces el mercado ya ha descontado mucho riesgo y puede aparecer una oportunidad contraria.'
  },
  H31: {
    title: 'Estrés financiero de la Fed de Chicago',
    description: 'Mide tensión en el sistema financiero usando el índice NFCI. Si el estrés financiero sube, las condiciones de crédito y liquidez empeoran, lo que suele ser negativo para la bolsa.'
  },
  H35: {
    title: 'Deterioro de subsidios continuados',
    description: 'Mira si aumentan las personas que siguen cobrando subsidio por desempleo. Una tendencia al alza indica que encontrar empleo cuesta más y que el mercado laboral se debilita.'
  },
  H36: {
    title: 'Recuperación de la producción industrial',
    description: 'Detecta mejoras en la producción industrial. Cuando la actividad productiva se recupera, suele indicar que el ciclo económico gana tracción.'
  },
  H38: {
    title: 'Rebote de viviendas iniciadas',
    description: 'Observa si las nuevas construcciones de vivienda vuelven a mejorar tras una caída. Puede señalar que el sector inmobiliario empieza a estabilizarse.'
  },
  H39: {
    title: 'Permisos de construcción líderes',
    description: 'Usa los permisos de construcción como indicador adelantado de vivienda. Si los permisos caen, puede anticipar debilidad; si repuntan, puede anticipar recuperación del sector.'
  },
  H40: {
    title: 'Ciclo de ventas minoristas reales',
    description: 'Mide las ventas minoristas ajustadas por inflación. Ayuda a ver si el consumidor mantiene fuerza real o si el consumo se está debilitando.'
  }
};

export function hCodeFromValue(value) {
  const match = String(value || '').trim().toUpperCase().match(/^(H\d+)(?:_|$)/);
  return match ? match[1] : '';
}

export function hypothesisPublicInfo(value) {
  const hCode = hCodeFromValue(value);
  return hCode ? H_PUBLIC_INFO[hCode] || null : null;
}

export function hypothesisPublicTitle(value, fallback = '') {
  return hypothesisPublicInfo(value)?.title || fallback || String(value || '');
}

export function hypothesisPublicDescription(value) {
  return hypothesisPublicInfo(value)?.description || '';
}

export function replaceHypothesisNamesInText(value) {
  return String(value || '').replace(/\bH\d+(?:_[A-Z0-9]+)*\b/g, match => hypothesisPublicTitle(match, match));
}
