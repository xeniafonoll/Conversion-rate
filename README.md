# Registro de atenciones

Herramienta sencilla para una tienda: cada vendedor apunta cada atención (compra o no compra, con motivo)
y la responsable consulta la conversión por hora, día de la semana, vendedor, semana, mes y año.

## Cómo funciona

- `index.html`: la página (una sola página, sin dependencias). Se publica con GitHub Pages.
- `apps-script/Code.gs`: API en Google Apps Script. Guarda los datos en una hoja de Google, con una pestaña por mes.
- Las estadísticas están protegidas con una clave que se comprueba en el servidor (propiedad `CLAVE` del script).

```
móvil del vendedor ──► GitHub Pages (index.html) ──fetch──► Apps Script (/exec) ──► Hoja de Google
```

## Puesta en marcha

1. Crea una hoja de Google, abre **Extensiones → Apps Script** y pega `apps-script/Code.gs`.
2. En **Configuración del proyecto → Propiedades de la secuencia de comandos**, añade `CLAVE` con la contraseña de las estadísticas.
3. **Implementar → Nueva implementación → Aplicación web**: ejecutar como *yo*, acceso *Cualquier persona*. Copia la URL que termina en `/exec`.
4. En `index.html`, pega esa URL en la constante `API`.
5. Activa **Settings → Pages** en este repositorio (rama `main`, carpeta raíz).

Cada vez que cambies `Code.gs`, crea una **nueva versión** de la implementación para que se aplique.

## Notas

- No guardes la clave en el código: vive solo en las propiedades del script.
- Con una cuenta gratuita de GitHub, Pages requiere repositorio público. La URL de la API será visible, pero los datos de
  estadísticas solo se devuelven con la clave correcta.
- Los datos se leen enteros al abrir las estadísticas. Con muchos años de datos habría que limitar el rango.
