// Presupuesto de EJEMPLO con el que arranca una cuenta nueva.
// Las cifras son inventadas: cámbialas desde la pestaña Presupuesto de la app.
//
// Tu presupuesto real no va aquí (este archivo es público en GitHub). Para el
// modo local, ponlo en presupuesto-personal.js, que git ignora.
//
// Campos de cada partida:
//   importe     → lo que cuesta cada recibo o lo que prevés gastar
//   frecuencia  → Mensual, Bimestral, Trimestral, Semestral o Anual
//   recibo      → true si es un cargo que llega una vez (aparece en "Recibos del mes")
//   icono       → nombre del icono (ver src/lib/iconos.jsx)

export default {
  sueldoSugerido: null,
  partidas: [
    { nombre: "Alquiler o hipoteca", categoria: "Vivienda",      importe: 600, frecuencia: "Mensual",    recibo: true,  icono: "casa" },
    { nombre: "Comunidad",           categoria: "Vivienda",      importe: 50,  frecuencia: "Trimestral", recibo: true,  icono: "edificio" },
    { nombre: "Electricidad",        categoria: "Suministros",   importe: 60,  frecuencia: "Mensual",    recibo: true,  icono: "luz" },
    { nombre: "Agua",                categoria: "Suministros",   importe: 30,  frecuencia: "Bimestral",  recibo: true,  icono: "agua" },
    { nombre: "Móvil e internet",    categoria: "Suministros",   importe: 40,  frecuencia: "Mensual",    recibo: true,  icono: "movil" },
    { nombre: "Seguros",             categoria: "Seguros",       importe: 40,  frecuencia: "Mensual",    recibo: true,  icono: "seguro" },
    { nombre: "Comida",              categoria: "Alimentación",  importe: 300, frecuencia: "Mensual",    recibo: false, icono: "compra" },
    { nombre: "Transporte",          categoria: "Transporte",    importe: 100, frecuencia: "Mensual",    recibo: false, icono: "gasolina" },
    { nombre: "Suscripciones",       categoria: "Suscripciones", importe: 20,  frecuencia: "Mensual",    recibo: true,  icono: "tv" },
    { nombre: "Comidas fuera y ocio",categoria: "Ocio",          importe: 80,  frecuencia: "Mensual",    recibo: false, icono: "restaurante" },
    { nombre: "Salud",               categoria: "Salud",         importe: 30,  frecuencia: "Mensual",    recibo: false, icono: "salud" },
    { nombre: "Vacaciones y regalos",categoria: "Ocio",          importe: 600, frecuencia: "Anual",      recibo: false, icono: "viaje" },
    { nombre: "Imprevistos",         categoria: "Otros",         importe: 30,  frecuencia: "Mensual",    recibo: false, icono: "imprevistos" },
  ],
};
